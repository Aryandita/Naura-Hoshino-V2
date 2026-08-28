# Implementation Plan, Translasi Spotify Link untuk Lavalink

[Overview]
Membuat link Spotify (`open.spotify.com/track|album|playlist|artist`, termasuk link regional seperti `/intl-de/track/...`) dapat dimainkan oleh sistem musik Naura yang berbasis Lavalink v4 + Poru, dengan strategi dua lapis sesuai keputusan user:

1. **Server-side (jalur utama):** memasang dan mengonfigurasi plugin **LavaSrc** pada node Lavalink v4 sehingga URL Spotify diselesaikan secara native oleh node, bot tidak perlu menerjemahkan apa pun. Metadata Spotify diambil LavaSrc, lalu **mirroring** mencari audio playable dari daftar `providers` fallback (`ytsearch:"%ISRC%"` lalu `ytsearch:%QUERY%`). Node juga wajib memasang plugin **youtube-source** sebagai target mirroring (sumber YouTube bawaan Lavalink v4 sudah deprecated).
2. **Bot-side (jalur cadangan):** modul translasi baru `src/music/spotifyResolver.js` yang aktif otomatis ketika node ternyata TIDAK memiliki LavaSrc (terdeteksi dari `loadType` error/empty saat resolve langsung). Modul ini mengambil metadata Spotify (Web API dengan Client Credentials yang kredensialnya sudah ada di `env.js`, fallback scraping via `spotify-url-info` yang sudah jadi dependency), lalu menerjemahkannya menjadi query pencarian (`ytsearch:"{ISRC}"` → `ytsearch:{Artis} - {Judul}`) yang diselesaikan via `poru.resolve()`, dan mengembalikan objek hasil berbentuk identik dengan respons Poru agar alur `plugin/music/music.js` tidak berubah.

Kondisi kode saat ini: `plugin/music/music.js:241-243` sudah langsung memberikan URL Spotify ke `poru.resolve()` dengan asumsi node punya LavaSrc; penanda `originalSource = "spotify"` masih dideteksi dari string `query.includes("spotify.com")`; ada fallback parsial di `src/music/poru_events/trackStart.js:112` yang mencari ulang via `ytsearch:` hanya untuk autoplay/mix. `docker-compose.yml` sudah punya service `lavalink` (image `ghcr.io/lavalink-devs/lavalink:4`) tetapi tanpa plugin dan tanpa file konfigurasi `application.yml` di repo.

[Types]
Proyek adalah JavaScript CommonJS murni tanpa TypeScript. Yang ditetapkan adalah bentuk data (kontrak) berikut:

```javascript
// Hasil normalisasi deteksi URL Spotify (dari parseSpotifyUrl):
{
  isSpotify: boolean,
  type: 'track' | 'album' | 'playlist' | 'artist' | null,
  id: string | null,        // ID Spotify base62
}

// Hasil resolve terpadu yang dikembalikan resolveSpotifyQuery()
// (mengikuti bentuk respons /v4/loadtracks Poru/Lavalink):
{
  loadType: 'TRACK_LOADED' | 'PLAYLIST_LOADED' | 'SEARCH_RESULT' | 'LOAD_FAILED' | 'NO_MATCHES',
  tracks: Array<PoruTrack>,       // objek track asli dari Poru, tidak dimodifikasi strukturnya
  pluginInfo: { source: string }, // 'lavasrc' | 'spotify-fallback' | lainnya
}

// Track yang masuk antrean diberi stempel sumber (konvensi yang sudah ada di music.js):
track.info.requester = user;
track.info.originalSource = 'spotify'; // untuk aksen hijau Spotify di MusicUIManager
```

Konfigurasi YAML baru untuk node mengikuti skema resmi LavaSrc (`plugins.lavasrc.providers`, `plugins.lavasrc.spotify.*`, blok `plugins` download untuk artefak jar LavaSrc dan youtube-source).

[Files]

**File baru:**

- `docker/lavalink/application.yml`, konfigurasi Lavalink v4 untuk container compose: password dari env, `server.sources.youtube: false` (diganti youtube-source plugin), blok `plugins` dengan auto-download jar `youtube-source` (lavalink-devs/youtube-source) dan `LavaSrc` (topi314/LavaSrc) dari release terbaru masing-masing, serta blok `plugins.lavasrc`:
  ```yaml
  plugins:
    lavasrc:
      providers:
        - 'ytsearch:"%ISRC%"'
        - "ytsearch:%QUERY%"
      sources:
        spotify: true
      lyrics-sources:
        spotify: true
      spotify:
        clientId: "${SPOTIFY_CLIENT_ID}"
        clientSecret: "${SPOTIFY_CLIENT_SECRET}"
        countryCode: "ID"
        playlistLoadLimit: 6
        albumLoadLimit: 6
        resolveArtistsInSearch: true
  ```
  Placeholder `${...}` disubstitusi Spring dari environment container.
- `src/music/spotifyResolver.js`, modul translasi fallback bot-side (rincian fungsi di bagian [Functions]). Satu file = satu tanggung jawab (aturan 1.3 #3): hanya domain resolusi Spotify.
- `src/music/spotifyResolver.test.js`, test `node:test` bersebelahan dengan modulnya (aturan 1.2).

**File dimodifikasi:**

- `docker-compose.yml`
  - Service `lavalink`: tambah `env_file: .env` (agar `SPOTIFY_CLIENT_ID/SECRET` tersedia untuk substitusi YAML) dan volume `./docker/lavalink/application.yml:/opt/Lavalink/application.yml`.
- `plugin/music/music.js`
  - Subcommand `play` (~baris 219-308): ganti pemanggilan langsung `poru.resolve({ query: finalQuery })` dengan `resolveSpotifyQuery(poru, finalQuery, user)` dari `spotifyResolver.js`. Penentuan `brandColor`/`brandEmoji` Spotify bergeser dari `query.includes("spotify.com")` ke flag `res.pluginInfo.source`. Pemberian `track.info.originalSource = "spotify"` dipindah ke resolver (berlaku konsisten juga untuk batch playlist di baris 274-292).
  - Subcommand `import` (~baris 560-595): query per-track dari playlist cloud yang tersimpan (bila berformat `spsearch:` atau URL Spotify) ikut melewati resolver, sehingga playlist yang diimpor dari Spotify tetap bisa di-resolve ulang di node tanpa LavaSrc.
  - Autocomplete (~baris 1436-1484) tidak berubah; prefix `spsearch:` sudah didukung dan akan ditangani LavaSrc di node.
- `src/music/poru_events/trackStart.js` (~baris 110-120): samakan pola query fallback dengan `buildSearchQueries()` dari `spotifyResolver.js` (ekstrak helper bersama) supaya fallback radio/mix memakai urutan ISRC lalu judul yang sama.
- `src/config/env.js`, tambahkan field opsional `SPOTIFY_MARKET` (default `"ID"`, dipakai Web API `market=` dan dokumentasi `countryCode`) dan `SPOTIFY_MAX_PLAYLIST_TRACKS` (default `100`) sesuai aturan 1.3 #4. Tidak ada variabel WAJIB baru; `SPOTIFY_CLIENT_ID/SECRET` sudah ada (baris 156-157).
- `.env.example`, tambahkan dua variabel opsional di atas dengan komentar.
- `README.md`, tabel env (bagian API Keys) + instruksi singkat menyalakan Lavalink lokal dengan LavaSrc: `docker compose up -d lavalink`.
- `AGENTS.md`, perbarui diagram 2.5: ganti kotak lama `spotifyHelper.resolveSpotify (ytmsearch:...)` dengan alur baru `URL Spotify -> poru.resolve (LavaSrc native) -> fallback spotifyResolver (Web API -> ytsearch ISRC/judul)`.

**File yang TIDAK diubah:** `src/managers/musicManager.js` (node config via env sudah benar), `package.json` (tidak ada dependency baru; `spotify-url-info` tetap dipakai lazy-load sesuai pola TODO.md Sprint 0).

[Functions]
Tidak ada signature publik command yang berubah. Semua perubahan bersifat internal atau modul baru.

**Fungsi baru (semua di `src/music/spotifyResolver.js`):**

- `parseSpotifyUrl(query: string): { isSpotify, type, id }`, regex untuk `open.spotify.com/(intl-xx/)?(track|album|playlist|artist)/<id>`, URI `spotify:(track|album|playlist|artist):<id>`, dan shortlink `spotify.link` (diikuti redirect via `fetch` dengan `redirect: 'follow'` sebelum parsing). Menerima juga prefix `spsearch:` sebagai tipe `search`.
- `getSpotifyToken(): Promise<string|null>`, Client Credentials flow ke `https://accounts.spotify.com/api/token` memakai `SPOTIFY_CLIENT_ID/SECRET` dari `env.js`. Token di-cache (Redis `cache:spotify:token` TTL 3300 detik via `redisManager.getOrSetCache`; fallback in-memory Map dengan cleanup interval + `.unref()` sesuai aturan 1.9). Mengembalikan `null` bila kredensial kosong.
- `fetchSpotifyMetadata(type, id): Promise<object|null>`, panggilan `fetch` ke Web API (`/v1/tracks/{id}`, `/v1/albums/{id}/tracks`, `/v1/playlists/{id}/tracks`, `/v1/artists/{id}/top-tracks`) dengan paginasi dibatasi 6 halaman setara `playlistLoadLimit`/`albumLoadLimit` LavaSrc dan batas `SPOTIFY_MAX_PLAYLIST_TRACKS`. Seluruhnya dibungkus try/catch (aturan 1.3 #5). Bila token `null`, fallback ke `spotify-url-info` (lazy `require` di dalam fungsi, sesuai pola TODO.md Sprint 0) untuk mendapat nama + artis tanpa ISRC.
- `buildSearchQueries(meta): string[]`, urutan prioritas: (1) `ytsearch:"{ISRC}"` bila ISRC tersedia dari `external_ids`, (2) `ytsearch:{artists.join(', ')} - {name}`, (3) `ytmsearch:{...}` sebagai upaya terakhir. Helper ini juga dipakai `trackStart.js`.
- `translateTrack(poru, meta, requester): Promise<PoruTrack|null>`, coba tiap query dari `buildSearchQueries` secara berurutan lewat `poru.resolve({ query, requester })`; ambil `tracks[0]` pertama yang berhasil; stempel `originalSource = 'spotify'`; simpan hasil ke cache.
- `resolveSpotifyQuery(poru, query, requester): Promise<result>`, pintu masuk tunggal dari `music.js`:
  1. Bila bukan Spotify URL/prefix, langsung `poru.resolve` passthrough.
  2. Coba `poru.resolve(query)` langsung (node ber-LavaSrc menyelesaikan native). Sukses: tandai `pluginInfo.source = 'lavasrc'` dan stempel `originalSource = 'spotify'` pada semua track.
  3. Gagal (`LOAD_FAILED`, exception, atau empty) DAN query adalah Spotify: jalankan jalur translasi. Single track: `translateTrack`. Album/playlist/artist: loop `translateTrack` per item (konkurensi 1, try/catch per item, item gagal dilompati), lalu kembalikan `{ loadType: 'PLAYLIST_LOADED', tracks, pluginInfo: { source: 'spotify-fallback' } }`.
  4. Cache hasil translasi di Redis `cache:spotify:res:{type}:{id}` TTL 12 jam (aturan 1.7.3: semua key ber-prefix dan bert TTL) agar playlist besar tidak di-resolve ulang.

**Fungsi dimodifikasi:**

- Handler `subcommand === "play"` di `plugin/music/music.js`, badan diganti memanggil `resolveSpotifyQuery`; logika antrean/reply Container V2 tidak berubah.
- Handler `subcommand === "import"` di `plugin/music/music.js`, loop resolve per-track menggunakan resolver bila query berformat Spotify.
- Handler event di `src/music/poru_events/trackStart.js`, query fallback radio memakai `buildSearchQueries`.

**Fungsi dihapus:** tidak ada.

[Classes]
Tidak ada class baru maupun penghapusan class. `MusicManager` (`src/managers/musicManager.js`) tidak diubah karena konfigurasi node sudah sepenuhnya dari env (`buildNodes()`), dan plugin LavaSrc adalah concern sisi server Lavalink, bukan sisi client Poru.

[Dependencies]
Tidak ada package npm baru. `spotify-url-info@^3.3.0` sudah ada di `package.json` (dipakai lazy-load). Komponen server-side adalah artefak Java yang di-download otomatis oleh Lavalink lewat blok `plugins:` di `application.yml` (bukan dependency Node): `youtube-plugin.jar` (lavalink-devs/youtube-source) dan `LavaSrc.jar` (topi314/LavaSrc).

Syarat operasional node: `SPOTIFY_CLIENT_ID` dan `SPOTIFY_CLIENT_SECRET` harus terisi di `.env` agar LavaSrc bisa search (`spsearch:`) dan mirror berbasis ISRC akurat; tanpa itu LavaSrc masih bisa resolve URL direct via anonymous token, tetapi jalur bot-side fallback akan turun ke `spotify-url-info` tanpa ISRC (akurasi pencarian sedikit menurun).

[Testing]

- **Test baru** `src/music/spotifyResolver.test.js` (`node:test`, mock `poru.resolve` dan `global.fetch` via injeksi parameter):
  1. `parseSpotifyUrl` benar untuk: track biasa, `/intl-de/track/...`, URI `spotify:track:...`, shortlink `spotify.link` (stub fetch), dan menolak URL non-Spotify.
  2. `buildSearchQueries` menghasilkan urutan `ytsearch:"{ISRC}"` lalu `ytsearch:Artis - Judul` lalu `ytmsearch:...`; tanpa ISRC langsung ke judul.
  3. `resolveSpotifyQuery` passthrough untuk query non-Spotify; memakai hasil native bila node sukses; jatuh ke translasi bila `poru.resolve` melempar error atau `LOAD_FAILED`; playlist besar dibatasi jumlah track sesuai `SPOTIFY_MAX_PLAYLIST_TRACKS`.
- **Test yang sudah ada**: `npm test`, `npm run test:requires`, `npm run lint`, `npm run format:check` wajib hijau.
- **Verifikasi manual dua-skenario:**
  1. Node DENGAN LavaSrc: `docker compose up -d lavalink`, lalu `/music play <url track/album/playlist Spotify>` harus main tanpa menyentuh jalur fallback (cek log/flag `source: lavasrc`).
  2. Node TANPA LavaSrc (blok plugins dinonaktifkan sementara): link track yang sama harus tetap main lewat `source: spotify-fallback`, dan playlist Spotify masuk antrean sebagian (item gagal dilompati) dengan pesan ringkasan jumlah berhasil.

[Implementation Order]
Urutan dirancang agar infrastruktur server siap lebih dulu (jalur utama), lalu fallback bot, lalu integrasi dan verifikasi.

1. Buat `docker/lavalink/application.yml` + wiring `docker-compose.yml` (volume + `env_file`); verifikasi container Lavalink naik dan log memuat kedua plugin (`LavaSrc`, `youtube-source`).
2. Tambah `SPOTIFY_MARKET` / `SPOTIFY_MAX_PLAYLIST_TRACKS` di `src/config/env.js` dan `.env.example`.
3. Bangun `src/music/spotifyResolver.js` (parsing -> token -> metadata -> query builder -> translate -> entrypoint `resolveSpotifyQuery` + cache Redis).
4. Wire `plugin/music/music.js` (`play`, `import`) ke resolver; pindahkan stamping `originalSource` ke resolver; selaraskan `trackStart.js` dengan `buildSearchQueries`.
5. Tulis `src/music/spotifyResolver.test.js`; jalankan sampai hijau, lalu `npm run lint && npm run format:check && npm test`.
6. Verifikasi manual dua-skenario (dengan/tanpa LavaSrc) sesuai bagian [Testing].
7. Perbarui dokumentasi: README (env + cara menyalakan node lokal) dan AGENTS.md diagram 2.5; commit dengan format `<emoji> <tipe>: <deskripsi>`, disarankan 2 commit: `✨ feat:` konfigurasi LavaSrc node, `✨ feat:` fallback resolver bot-side.
