// Lokasi: src/utils/spotifyHelper.js
const env = require('../../src/config/env');
const ui = require('../../src/config/ui');

// ==========================================
// 🎵 SPOTIFY HELPER - PENERJEMAH LINK SPOTIFY
// ==========================================
// Modul ini mengubah link Spotify (track/playlist/album) menjadi
// query pencarian yang bisa diproses oleh mesin Lavalink/Poru
// via YouTube Music, SoundCloud, atau YouTube.
//
// Alur Kerja:
// 1. Validasi URL → harus dari open.spotify.com
// 2. Ambil token anonim dari Spotify Web Player
// 3. Panggil API Spotify untuk mendapatkan data lagu
// 4. Terjemahkan ke format pencarian provider (ytmsearch:, scsearch:, ytsearch:)
// 5. Fallback ke Search jika Spotify API gagal

class SpotifyHelper {
    static token = null;
    static tokenExpires = 0;
    static tokenPromise = null; // Mutex agar tidak ada fetch token paralel/duplikat

    // Kata-kata "noise" marketing yang sering menempel di judul lagu
    // dan bisa menurunkan akurasi pencarian jika tidak dibersihkan.
    static NOISE_WORDS = 'official|music|video|audio|lyrics?|visualizer|hd|4k|hq|m\\/v|mv|explicit|clean\\s*version';

    /**
     * MENDAPATKAN KUNCI (TOKEN) RESMI
     * Mengambil akses token anonim langsung dari sistem Spotify Web Player.
     * Token di-cache dan diperbarui otomatis jika mendekati kadaluarsa.
     * Menggunakan mutex (tokenPromise) agar request yang datang bersamaan
     * tidak memicu banyak fetch token duplikat ke Spotify.
     */
    static async getAccessToken() {
        // Gunakan token yang ada jika masih valid
        if (this.token && this.tokenExpires > Date.now()) return this.token;

        // Jika ada proses pengambilan token yang sedang berjalan, tunggu hasilnya
        // alih-alih memulai request baru (mencegah race condition).
        if (this.tokenPromise) return this.tokenPromise;

        this.tokenPromise = this._fetchAccessToken();
        try {
            return await this.tokenPromise;
        } finally {
            this.tokenPromise = null;
        }
    }

    static async _fetchAccessToken() {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 8000); // Timeout 8 detik

        try {
            const res = await fetch(
                'https://open.spotify.com/get_access_token?reason=transport&productType=web_player',
                {
                    headers: {
                        'User-Agent':
                            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
                        Accept: 'application/json'
                    },
                    signal: controller.signal
                }
            );

            clearTimeout(timeout);

            if (!res.ok) throw new Error(`Gagal mendapat token: HTTP ${res.status}`);
            const data = await res.json();

            if (!data.accessToken) throw new Error('Token tidak ditemukan dalam respons Spotify.');

            this.token = data.accessToken;
            // Kurangi 1 menit sebagai buffer agar selalu valid saat digunakan
            this.tokenExpires = data.accessTokenExpirationTimestampMs - 60000;
            return this.token;
        } catch (error) {
            clearTimeout(timeout);
            // Reset token agar di-refresh pada percobaan berikutnya
            this.token = null;
            this.tokenExpires = 0;

            const errMsg = error.name === 'AbortError' ? 'Request timeout setelah 8 detik' : error.message;
            console.error(
                `\x1b[41m\x1b[37m ${ui.getEmoji('spotify') || '🎵'} SPOTIFY AUTH \x1b[0m Gagal mengambil token anonim: ${errMsg}`
            );
            return null;
        }
    }

    /**
     * VALIDASI URL SPOTIFY
     * Memastikan URL yang diberikan benar-benar dari Spotify dan mengandung tipe yang didukung.
     * @param {string} url - URL yang akan divalidasi
     * @returns {{ valid: boolean, type?: string, id?: string }}
     */
    static validateSpotifyUrl(url) {
        if (typeof url !== 'string' || !url.trim()) {
            return { valid: false };
        }

        try {
            // Pastikan domain benar
            const parsed = new URL(url);
            if (!parsed.hostname.includes('spotify.com')) {
                return { valid: false };
            }
        } catch {
            return { valid: false };
        }

        // Regex yang diperbaiki: mendukung karakter '-' dan '_' dalam ID Spotify
        const regex = /\b(track|playlist|album|artist|episode)\/([a-zA-Z0-9_-]+)\b/;
        const cleanUrl = url.split('?')[0]; // Hapus parameter query seperti ?si=...
        const match = cleanUrl.match(regex);

        if (!match) return { valid: false };

        return { valid: true, type: match[1], id: match[2] };
    }

    /**
     * MEMBERSIHKAN JUDUL LAGU DARI LABEL MARKETING
     * Menghapus token seperti [Official Video], (Lyrics), - HD, dll,
     * tanpa memakan kata-kata lain yang sah dalam judul.
     * @param {string} title
     * @returns {string}
     */
    static cleanTitle(title) {
        if (!title) return '';
        const noise = this.NOISE_WORDS;
        // Kata tunggal atau frasa dua-kata umum (mis. "official video", "lyric video")
        // dianggap noise jika SETIAP kata di dalamnya cocok dengan daftar noise.
        const noiseWordRegex = new RegExp(`^(?:${noise})$`, 'i');

        const stripIfAllNoise = (_match, inner) => {
            const words = inner.trim().split(/\s+/);
            const allNoise = words.length > 0 && words.every(w => noiseWordRegex.test(w));
            return allNoise ? '' : _match;
        };

        return title
            .replace(/\[([^\]]+)\]/g, stripIfAllNoise)
            .replace(/\(([^)]+)\)/g, stripIfAllNoise)
            .replace(new RegExp(`-\\s*(?:${noise})(?:\\s+(?:${noise}))*\\s*$`, 'gi'), '')
            .replace(/\s{2,}/g, ' ')
            .trim();
    }

    /**
     * MEMBANGUN QUERY PENCARIAN DARI SATU TRACK SPOTIFY
     * Menggabungkan nama artis + judul yang sudah dibersihkan menjadi
     * query "Artis - Judul", format paling akurat untuk provider musik.
     * Menghindari duplikasi featuring artist antara title & artists array.
     * @param {{name: string, artists?: {name: string}[]}} track
     * @param {string} searchPrefix - mis. 'ytmsearch:'
     * @returns {string|null}
     */
    static buildQuery(track, searchPrefix) {
        if (!track || !track.name) return null;

        const artistNames = track.artists && track.artists.length > 0
            ? track.artists.map(a => a.name).filter(Boolean)
            : [];
        const artist = artistNames.join(', ');

        let cleanedTitle = this.cleanTitle(track.name);

        // Jika artist featuring dalam judul (mis. "(feat. X)") sudah tercakup
        // di artists array, hapus dari judul agar query tidak berulang.
        if (artistNames.length > 0) {
            const featRegex = /[\(\[]\s*(?:feat\.?|ft\.?|featuring)\s+[^\)\]]+[\)\]]/gi;
            const featMatch = cleanedTitle.match(featRegex);
            if (featMatch) {
                const alreadyListed = featMatch.every(f =>
                    artistNames.some(name => f.toLowerCase().includes(name.toLowerCase()))
                );
                if (alreadyListed) {
                    cleanedTitle = cleanedTitle.replace(featRegex, '').replace(/\s{2,}/g, ' ').trim();
                }
            }
        }

        const queryParts = artist ? `${artist} - ${cleanedTitle}` : cleanedTitle;
        return `${searchPrefix}${queryParts}`.trim();
    }

    /**
     * MENENTUKAN PREFIX PENCARIAN DARI NAMA PROVIDER
     * @param {string} provider - 'ytm' | 'sc' | 'yt'
     * @returns {string}
     */
    static getSearchPrefix(provider) {
        if (provider === 'sc') return 'scsearch:';
        if (provider === 'yt') return 'ytsearch:';
        return 'ytmsearch:'; // default: YouTube Music, paling akurat untuk lagu
    }

    /**
     * PENERJEMAH LINK SPOTIFY → QUERY AUDIO (YTM, SC, YT)
     * Menarik nama artis & judul lagu dari Spotify API, lalu mengubahnya
     * menjadi format pencarian untuk Lavalink/Poru.
     *
     * @param {string} url - URL Spotify (track/playlist/album)
     * @param {string} provider - Penyedia audio: 'ytm' (YouTube Music), 'sc' (SoundCloud), 'yt' (YouTube)
     * @returns {{ type: string, queries: string[] } | null}
     */
    static async resolveSpotify(url, provider = 'ytm') {
        // --- Langkah 0: Cek Redis Cache ---
        const redisManager = require('../../src/managers/redisManager');
        const cacheKey = `spotify_res_${Buffer.from(url).toString('base64')}_${provider}`;
        if (redisManager.client && redisManager.client.isReady) {
            try {
                const cached = await redisManager.getCache(cacheKey);
                if (cached) {
                    console.log(`\x1b[42m\x1b[30m 🟢 SPOTIFY CACHE \x1b[0m Hit untuk: ${url}`);
                    return typeof cached === 'string' ? JSON.parse(cached) : cached;
                }
            } catch (e) {}
        }

        // --- Langkah 1: Validasi URL ---
        const validation = this.validateSpotifyUrl(url);
        if (!validation.valid) {
            console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY \x1b[0m \x1b[33mURL tidak valid atau tidak didukung: ${url}\x1b[0m`);
            return null;
        }

        const { type, id } = validation;

        // --- Langkah 1.5: Pake OEmbed untuk Track (Sangat cepat & 100% Bebas 403) ---
        if (type === 'track') {
            try {
                const axios = require('axios');
                const oembedUrl = `https://open.spotify.com/oembed?url=${encodeURIComponent(url.split('?')[0])}`;
                const response = await axios.get(oembedUrl, { timeout: 5000 });
                if (response && response.data && response.data.title) {
                    const title = response.data.title;
                    // author_name dari Spotify oEmbed biasanya berupa daftar artis
                    const artist = response.data.author_name || '';
                    const searchPrefix = this.getSearchPrefix(provider);

                    const cleanTitle = this.cleanTitle(title);
                    const query = this.buildQuery({ name: title, artists: artist ? [{ name: artist }] : [] }, searchPrefix);

                    console.log(`\x1b[42m\x1b[30m 🟢 SPOTIFY OEMBED \x1b[0m \x1b[32mBerhasil menerjemahkan: ${artist} - ${cleanTitle} [provider: ${searchPrefix}]\x1b[0m`);
                    // oEmbed tidak menyediakan durasi/ISRC, jadi keduanya null di sini.
                    // Jalur API resmi di bawah akan mengisi ini jika oEmbed gagal/dilewati.
                    const result = {
                        type: 'track',
                        queries: [query],
                        spotifyMeta: { title: cleanTitle, artist, duration_ms: null, isrc: null }
                    };
                    if (redisManager.client && redisManager.client.isReady) {
                        redisManager.setCache(cacheKey, JSON.stringify(result), 3600).catch(() => {});
                    }
                    return result;
                }
            } catch (e) {
                console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY OEMBED \x1b[0m \x1b[33mOEmbed gagal, menggunakan metode standard: ${e.message}\x1b[0m`);
            }
        }

        try {
            // Gunakan spotify-url-info sebagai fallback alternatif yang solid jika token gagal atau tipe artist/episode diminta
            const fetchNode = require('isomorphic-unfetch');
            const { getPreview, getTracks } = require('spotify-url-info')(fetchNode);
            let tracks = [];

            // Coba ambil token untuk API Spotify Resmi terlebih dahulu, tapi untuk tipe spesifik saja
            let token = null;
            if (['track', 'playlist', 'album'].includes(type)) {
                token = await this.getAccessToken();
            }

            if (token) {
                const headers = {
                    Authorization: `Bearer ${token}`,
                    Accept: 'application/json'
                };

                // --- Langkah 3: Ambil Data Lagu dari Spotify API dengan Pagination ---
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 12000);

                try {
                    if (type === 'track') {
                        const res = await fetch(`https://api.spotify.com/v1/tracks/${id}`, {
                            headers,
                            signal: controller.signal
                        });
                        clearTimeout(timeout);
                        if (res.ok) {
                            tracks.push(await res.json());
                        } else if (res.status === 401) {
                            this.token = null;
                            this.tokenExpires = 0;
                        }
                    } else if (type === 'playlist') {
                        let nextUrl = `https://api.spotify.com/v1/playlists/${id}/tracks?limit=100`;
                        let fetchCount = 0;
                        while (nextUrl && fetchCount < 5) { // Maximum 500 tracks to avoid extreme load
                            const res = await fetch(nextUrl, { headers, signal: controller.signal });
                            fetchCount++;
                            if (res.ok) {
                                const data = await res.json();
                                const items = data.items ? data.items.map(item => item.track).filter(Boolean) : [];
                                tracks.push(...items);
                                nextUrl = data.next;
                            } else {
                                nextUrl = null;
                            }
                        }
                        clearTimeout(timeout);
                    } else if (type === 'album') {
                        let nextUrl = `https://api.spotify.com/v1/albums/${id}/tracks?limit=50`;
                        let fetchCount = 0;
                        while (nextUrl && fetchCount < 3) {
                            const res = await fetch(nextUrl, { headers, signal: controller.signal });
                            fetchCount++;
                            if (res.ok) {
                                const data = await res.json();
                                tracks.push(...(data.items || []));
                                nextUrl = data.next;
                            } else {
                                nextUrl = null;
                            }
                        }
                        clearTimeout(timeout);
                    }
                } catch (fetchErr) {
                    clearTimeout(timeout);
                    if (fetchErr.name === 'AbortError') {
                        console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY \x1b[0m \x1b[33mRequest ke Spotify API timeout, mencoba library alternatif...\x1b[0m`);
                    }
                }
            }

            // Jika API Resmi Gagal/Tidak didukung tipenya (Artist, Episode), gunakan scraper spotify-url-info
            if (tracks.length === 0) {
                console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY \x1b[0m \x1b[33mBeralih ke spotify-url-info untuk URL ${url}...\x1b[0m`);
                try {
                    const preview = await getPreview(url);
                    if (preview.type === 'track') {
                        tracks.push({ name: preview.track, artists: [{ name: preview.artist }] });
                    } else if (['playlist', 'album', 'artist'].includes(preview.type)) {
                        const scrapedTracks = await getTracks(url);
                        tracks = scrapedTracks.map(t => ({ name: t.name, artists: [{ name: t.artist }] }));

                        // Simpan nama artis untuk fallback cerdas jika scrapedTracks kosong
                        if (tracks.length === 0 && preview.artist) {
                            return this.buildFallback(url, type, provider, { name: preview.artist });
                        }
                    } else if (preview.type === 'episode') {
                        const episodeTitle = preview.track || preview.title;
                        const episodeShow = preview.artist || preview.description || 'Spotify Podcast';
                        if (episodeTitle) {
                            tracks.push({ name: episodeTitle, artists: [{ name: episodeShow }] });
                        } else {
                            return this.buildFallback(url, type, provider, { name: episodeShow });
                        }
                    } else {
                        tracks.push({ name: preview.title, artists: [{ name: preview.artist }] });
                    }
                } catch (e) {
                    console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY \x1b[0m \x1b[33mScraper spotify-url-info gagal. Error: ${e.message}\x1b[0m`);
                }
            }

            // --- Langkah 4: Fallback jika data kosong ---
            if (tracks.length === 0) {
                console.warn(`\x1b[43m\x1b[30m 🟢 SPOTIFY \x1b[0m \x1b[33mData ${type} kosong dari semua metode. Mencoba fallback Search...\x1b[0m`);
                return this.buildFallback(url, type, provider);
            }

            // --- Langkah 5: Terjemahkan ke format pencarian provider ---
            const searchPrefix = this.getSearchPrefix(provider);

            const searchQueries = [];
            const tracksMeta = [];

            for (const track of tracks) {
                const query = this.buildQuery(track, searchPrefix);
                if (!query) continue;
                searchQueries.push(query);

                // Simpan durasi & ISRC (jika ada) agar kode pemutar bisa memilih
                // hasil pencarian yang durasinya paling mendekati versi asli Spotify —
                // ini membantu menghindari hasil yang salah (cover/remix/live version).
                tracksMeta.push({
                    title: this.cleanTitle(track.name),
                    artist: track.artists && track.artists.length > 0
                        ? track.artists.map(a => a.name).join(', ')
                        : '',
                    duration_ms: typeof track.duration_ms === 'number' ? track.duration_ms : null,
                    isrc: track.external_ids && track.external_ids.isrc ? track.external_ids.isrc : null
                });
            }

            if (searchQueries.length === 0) return null;

            const finalResult = {
                type: type,
                queries: searchQueries,
                tracksMeta
            };

            if (redisManager.client && redisManager.client.isReady) {
                redisManager.setCache(cacheKey, JSON.stringify(finalResult), 3600).catch(() => {});
            }

            return finalResult;
        } catch (error) {
            console.error(
                `\x1b[41m\x1b[37m ${ui.getEmoji('error') || '❌'} SPOTIFY TRANSLATOR \x1b[0m Gagal menerjemahkan link: ${error.message}`
            );
            return null;
        }
    }

    /**
     * FALLBACK: Buat query Search dari URL Spotify jika API gagal
     * @param {string} url - URL Spotify asli
     * @param {string} type - Tipe konten: 'track' | 'playlist' | 'album' | 'artist' | 'episode'
     * @param {string} provider - Provider audio: 'ytm' | 'sc' | 'yt'
     * @param {{ name?: string, artist?: string }} meta - Nama/metadata yang berhasil diambil dari scraper
     */
    static buildFallback(url, type, provider, meta = {}) {
        const searchPrefix = this.getSearchPrefix(provider);

        // Gunakan metadata dari scraper jika tersedia — hasilnya jauh lebih relevan
        if (meta.name) {
            let fallbackQuery;
            if (type === 'artist') {
                // "Nama Artis top songs" lebih berguna untuk YTM/YouTube daripada ID Spotify
                fallbackQuery = `${searchPrefix}${meta.name} top songs`;
            } else if (type === 'episode') {
                // Judul podcast langsung adalah query terbaik untuk episode
                const artistPart = meta.artist ? ` ${meta.artist}` : '';
                fallbackQuery = `${searchPrefix}${meta.name}${artistPart}`;
            } else {
                // Playlist/album: cari berdasarkan nama
                fallbackQuery = `${searchPrefix}${meta.name}${meta.artist ? ` ${meta.artist}` : ''}`;
            }
            console.log(`\x1b[43m\x1b[30m 🟢 SPOTIFY FALLBACK \x1b[0m \x1b[33mMenggunakan query cerdas: ${fallbackQuery}\x1b[0m`);
            return { type, queries: [fallbackQuery] };
        }

        // Fallback generik terakhir jika tidak ada metadata sama sekali
        const cleanUrl = url.split('?')[0];
        const segments = cleanUrl.split('/').filter(Boolean);
        const identifier = segments[segments.length - 1] || '';

        // Untuk tipe yang tidak punya nama, hasil apapun lebih baik daripada ID mentah
        const genericFallback = type === 'artist'
            ? `${searchPrefix}popular music playlist`
            : `${searchPrefix}spotify ${type} ${identifier}`;

        console.log(`\x1b[43m\x1b[30m 🟢 SPOTIFY FALLBACK \x1b[0m \x1b[33mMenggunakan Search: ${genericFallback}\x1b[0m`);
        return { type, queries: [genericFallback] };
    }
}

module.exports = SpotifyHelper;
