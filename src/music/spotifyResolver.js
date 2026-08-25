// Lokasi: src/music/spotifyResolver.js
// Resolver link Spotify dengan strategi dua lapis:
//   1. Native via plugin LavaSrc di node Lavalink (jalur utama).
//   2. Translasi manual bot-side bila node tidak punya plugin (jalur cadangan):
//      metadata Spotify (Web API / spotify-url-info) -> ytsearch ISRC/judul.
// Hasil selalu berbentuk respons Poru agar alur plugin/music/music.js tidak berubah.

const env = require("../config/env");
const { logger } = require("../managers/logger");

const SPOTIFY_HOST_RE =
    /(?:https?:\/\/)?open\.spotify\.com\/(?:intl-[a-z-]{2,7}\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/,
  SPOTIFY_URI_RE = /^spotify:(track|album|playlist|artist):([A-Za-z0-9]+)/;

// Cache token/metadata di memori. Cleanup berkala mencegah memory leak
// (aturan 1.9); interval diberi .unref() agar tidak menahan proses.
const memoryCache = new Map();
const CACHE_SWEEPER = setInterval(
  () => {
    const now = Date.now();
    for (const [key, entry] of memoryCache) {
      if (!entry.expiresAt || entry.expiresAt < now) memoryCache.delete(key);
    }
  },
  10 * 60 * 1000,
);
if (typeof CACHE_SWEEPER.unref === "function") CACHE_SWEEPER.unref();

/**
 * Mendeteksi URL/URI/prefix Spotify dari query bebas user.
 * @param {string} query Query mentah dari user.
 * @returns {{isSpotify: boolean, type: string|null, id: string|null}}
 */
function parseSpotifyUrl(query) {
  if (!query || typeof query !== "string")
    return { isSpotify: false, type: null, id: null };
  if (query.startsWith("spsearch:"))
    return { isSpotify: true, type: "search", id: query.slice(9).trim() };
  const hostMatch = query.match(SPOTIFY_HOST_RE);
  if (hostMatch)
    return { isSpotify: true, type: hostMatch[1], id: hostMatch[2] };
  const uriMatch = query.match(SPOTIFY_URI_RE);
  if (uriMatch) return { isSpotify: true, type: uriMatch[1], id: uriMatch[2] };
  return { isSpotify: false, type: null, id: null };
}

/** Ambil nilai dari cache memori bila belum kedaluwarsa. */
function getMemory(key) {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  if (entry.expiresAt && entry.expiresAt < Date.now()) {
    memoryCache.delete(key);
    return null;
  }
  return entry.value;
}

/** Simpan nilai ke cache memori beserta masa kedaluwarsa. */
function setMemory(key, value, ttlSeconds) {
  memoryCache.set(key, {
    value,
    expiresAt: ttlSeconds ? Date.now() + ttlSeconds * 1000 : null,
  });
}

/**
 * Ambil nilai dari Redis (cache:spotify:*), jatuh ke cache memori bila
 * Redis tidak tersedia. Selalu ber-TTL sesuai aturan 1.7.3.
 */
async function getCachedJson(key, ttlSeconds, fetchFunction) {
  try {
    // Lazy-require agar test unit tidak memuat koneksi Redis.
    const redisManager = require("../managers/redisManager");
    if (redisManager && typeof redisManager.getOrSetCache === "function") {
      return await redisManager.getOrSetCache(key, ttlSeconds, fetchFunction);
    }
  } catch (e) {
    // Redis gagal/tidak tersedia: lanjut dengan cache memori saja.
  }
  const memKey = `spotify:${key}`;
  const hit = getMemory(memKey);
  if (hit !== null && hit !== undefined) return hit;
  const value = await fetchFunction();
  if (value !== null && value !== undefined)
    setMemory(memKey, value, ttlSeconds);
  return value;
}

/**
 * Token Client Credentials Spotify (dipakai Web API bot-side).
 * @returns {Promise<string|null>} Access token atau null bila kredensial kosong/gagal.
 */
async function getSpotifyToken() {
  if (!env.SPOTIFY_CLIENT_ID || !env.SPOTIFY_CLIENT_SECRET) return null;
  const cached = getMemory("token");
  if (cached) return cached;
  try {
    const basic = Buffer.from(
      `${env.SPOTIFY_CLIENT_ID}:${env.SPOTIFY_CLIENT_SECRET}`,
    ).toString("base64");
    const res = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${basic}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data || !data.access_token) return null;
    // Simpan sedikit lebih pendek dari expires_in agar aman di tepi.
    setMemory(
      "token",
      data.access_token,
      Math.max((data.expires_in || 3600) - 60, 60),
    );
    return data.access_token;
  } catch (e) {
    logger.warn("[SpotifyResolver] Gagal mengambil token Spotify:", e.message);
    return null;
  }
}

/** Panggilan GET sederhana ke Web API Spotify. */
async function spotifyApiGet(path) {
  const token = await getSpotifyToken();
  if (!token) return null;
  const res = await fetch(`https://api.spotify.com/v1${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) return null;
  return res.json();
}

/** Lazy-load spotify-url-info sebagai penyedia metadata tanpa kredensial. */
function loadSpotifyUrlInfo() {
  try {
    return require("spotify-url-info")(fetch);
  } catch (e) {
    return null;
  }
}

/** Ubah satu item track Spotify menjadi deskriptor ringan siap dicari. */
function toTrackMeta(item) {
  if (!item) return null;
  const artists = (item.artists || []).map((a) => a.name).filter(Boolean);
  return {
    name: item.name,
    artists,
    isrc: item.external_ids ? item.external_ids.isrc : undefined,
  };
}

/**
 * Ambil metadata Spotify untuk satu tipe resource (track/album/playlist/
 * artist/search) via Web API. Mengembalikan null bila tidak tersedia.
 * @returns {Promise<{type:string,name:string,items:Array}|null>}
 */
async function fetchSpotifyMetadata(type, id) {
  const market = env.SPOTIFY_MARKET || "ID";
  try {
    if (type === "track") {
      const data = await spotifyApiGet(`/tracks/${id}?market=${market}`);
      if (!data) return null;
      return { type, name: data.name, items: [toTrackMeta(data)] };
    }

    if (type === "album" || type === "playlist") {
      const path =
        type === "album"
          ? `/albums/${id}?market=${market}`
          : `/playlists/${id}/tracks?market=${market}&limit=100`;
      const data = await spotifyApiGet(path);
      if (!data) return null;
      const firstPage = type === "album" ? data.tracks : data;
      const pick = (it) =>
        type === "album"
          ? { name: it.name, artists: (it.artists || []).map((a) => a.name) }
          : it && it.track
            ? toTrackMeta(it.track)
            : null;
      let items = (firstPage.items || []).map(pick).filter(Boolean);
      let page = firstPage;
      for (
        let i = 0;
        i < 5 &&
        page &&
        page.next &&
        items.length < env.SPOTIFY_MAX_PLAYLIST_TRACKS;
        i++
      ) {
        const res = await fetch(page.next); // URL paginasi resmi dari Spotify.
        if (!res.ok) break;
        page = await res.json();
        items = items.concat((page.items || []).map(pick).filter(Boolean));
      }
      return {
        type,
        name: type === "album" ? data.name : data.name || "Playlist Spotify",
        items: items.slice(0, env.SPOTIFY_MAX_PLAYLIST_TRACKS),
      };
    }

    if (type === "artist") {
      const data = await spotifyApiGet(
        `/artists/${id}/top-tracks?market=${market}`,
      );
      if (!data) return null;
      return {
        type,
        name: "Top Tracks",
        items: (data.tracks || []).slice(0, 10).map(toTrackMeta),
      };
    }

    if (type === "search") {
      // Fallback untuk prefix spsearch: bila node tidak punya LavaSrc.
      const q = encodeURIComponent(id);
      const data = await spotifyApiGet(`/search?q=${q}&type=track&limit=10`);
      if (!data || !data.tracks) return null;
      return {
        type,
        name: id,
        items: (data.tracks.items || []).map(toTrackMeta),
      };
    }
  } catch (e) {
    logger.warn("[SpotifyResolver] Gagal ambil metadata:", e.message);
  }
  return null;
}

/** Metadata cadangan via spotify-url-info (tanpa kredensial, tanpa ISRC). */
async function fetchFallbackMetadata(type, id) {
  const scraper = loadSpotifyUrlInfo();
  if (!scraper) return null;
  try {
    if (type === "search")
      return { type, name: id, items: [{ name: id, artists: [] }] };

    const url = `https://open.spotify.com/${type}/${id}`;
    if (type === "track") {
      const data = await scraper.getData(url);
      return {
        type,
        name: data.name,
        items: [
          toTrackMeta({
            name: data.name,
            artists: data.artists,
            external_ids: {},
          }),
        ],
      };
    }

    if (type === "album" || type === "playlist") {
      const data = await scraper.getData(url);
      const list =
        type === "album" ? data.trackList || [] : data.trackList || [];
      return {
        type,
        name: data.name || "Playlist Spotify",
        items: list.slice(0, env.SPOTIFY_MAX_PLAYLIST_TRACKS).map((t) => ({
          name: t.title || t.name,
          artists: [t.artist].filter(Boolean),
        })),
      };
    }
  } catch (e) {
    logger.warn("[SpotifyResolver] Metadata cadangan gagal:", e.message);
  }
  return null;
}

/**
 * Susun daftar query pencarian berurutan untuk satu metadata lagu.
 * Dipakai juga oleh src/music/poru_events/trackStart.js agar konsisten.
 * @param {{name:string, artists:string[], isrc?:string}} meta
 * @returns {string[]}
 */
function buildSearchQueries(meta) {
  const queries = [];
  if (!meta || !meta.name) return queries;
  if (meta.isrc) queries.push(`ytsearch:"${meta.isrc}"`);
  const label =
    meta.artists && meta.artists.length ? meta.artists.join(", ") : "";
  if (label) {
    queries.push(`ytsearch:${label} - ${meta.name}`);
    queries.push(`ytmsearch:${label} ${meta.name}`);
  } else {
    queries.push(`ytsearch:${meta.name}`);
  }
  return queries;
}

/**
 * Resolve satu metadata menjadi track Poru playable via pencarian bertahap.
 * @returns {Promise<object|null>} Track Poru pertama yang cocok, atau null.
 */
async function translateTrack(poru, meta, requester) {
  const queries = buildSearchQueries(meta);
  for (const query of queries) {
    try {
      const res = await poru.resolve({ query, requester });
      if (res && Array.isArray(res.tracks) && res.tracks.length > 0)
        return res.tracks[0];
    } catch (e) {
      // Kegagalan satu pencarian bukan error fatal; coba query berikutnya.
    }
  }
  return null;
}

/** Stempel sumber Spotify pada semua track hasil resolve. */
function stampSpotify(result, source) {
  result.pluginInfo = Object.assign({}, result.pluginInfo, { source });
  for (const track of result.tracks || []) {
    if (track && track.info) track.info.originalSource = "spotify";
  }
  return result;
}

/** Deteksi cepat respons Poru yang gagal/kosong. */
function isEmptyResult(res) {
  return (
    !res ||
    !Array.isArray(res.tracks) ||
    res.tracks.length === 0 ||
    res.loadType === "empty" ||
    res.loadType === "NO_MATCHES" ||
    res.loadType === "LOAD_FAILED"
  );
}

/**
 * Pintu masuk tunggal resolusi query musik (pengganti langsung poru.resolve
 * di plugin/music/music.js).
 * - Query non-Spotify: passthrough murni ke Poru.
 * - URL/prefix Spotify: coba native dulu (LavaSrc), lalu translasi manual.
 * @param {object} poru Instance Poru aktif.
 * @param {string} query Query mentah (URL, prefix, atau teks bebas).
 * @param {object} requester User Discord peminta.
 * @returns {Promise<object>} Objek respons bergaya Poru.
 */
async function resolveSpotifyQuery(poru, query, requester) {
  const parsed = parseSpotifyUrl(query);
  if (!parsed.isSpotify) return poru.resolve({ query, requester });

  let nativeError = null;
  let result = null;
  try {
    result = await poru.resolve({ query, requester });
  } catch (e) {
    nativeError = e;
  }

  // Node punya LavaSrc: hasil native dipakai apa adanya + stempel UI hijau.
  if (result && !isEmptyResult(result)) return stampSpotify(result, "lavasrc");

  logger.info(
    `[SpotifyResolver] Node tanpa LavaSrc (${nativeError ? nativeError.message : (result && result.loadType) || "kosong"}), menerjemahkan secara manual.`,
  );

  const cacheKey = `cache:spotify:res:${parsed.type}:${parsed.id || ""}`;
  let metadata = parsed.id
    ? await getCachedJson(cacheKey, 12 * 3600, () =>
        fetchSpotifyMetadata(parsed.type, parsed.id),
      )
    : await fetchSpotifyMetadata(parsed.type, parsed.id);

  if (!metadata && parsed.type !== "search")
    metadata = await fetchFallbackMetadata(parsed.type, parsed.id);

  if (!metadata || !metadata.items || metadata.items.length === 0)
    throw (
      nativeError ||
      new Error("[SpotifyResolver] Metadata Spotify tidak dapat diambil.")
    );

  const tracks = [];
  for (const item of metadata.items.slice(0, env.SPOTIFY_MAX_PLAYLIST_TRACKS)) {
    const track = await translateTrack(poru, item, requester);
    if (track) tracks.push(track);
  }

  if (tracks.length === 0)
    return {
      loadType: "NO_MATCHES",
      tracks: [],
      pluginInfo: { source: "spotify-fallback" },
    };

  const single = parsed.type === "track" && tracks.length === 1;
  return stampSpotify(
    {
      loadType: single ? "TRACK_LOADED" : "PLAYLIST_LOADED",
      tracks,
      pluginInfo: { source: "spotify-fallback" },
    },
    "spotify-fallback",
  );
}

module.exports = {
  parseSpotifyUrl,
  getSpotifyToken,
  fetchSpotifyMetadata,
  fetchFallbackMetadata,
  buildSearchQueries,
  translateTrack,
  resolveSpotifyQuery,
};
