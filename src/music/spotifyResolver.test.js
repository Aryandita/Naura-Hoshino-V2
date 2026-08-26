// Lokasi: src/music/spotifyResolver.test.js
// Test unit spotifyResolver dengan node:test (tanpa koneksi nyata ke
// Spotify/Lavalink; fetch dan poru di-mock).

const test = require("node:test");
const assert = require("node:assert");

const env = require("../config/env");
const resolver = require("./spotifyResolver");

test("parseSpotifyUrl mendeteksi berbagai format link Spotify", () => {
  // Track biasa
  assert.deepStrictEqual(
    resolver.parseSpotifyUrl(
      "https://open.spotify.com/track/0eG08cBeKk0mzykKjw4hcQ",
    ),
    { isSpotify: true, type: "track", id: "0eG08cBeKk0mzykKjw4hcQ" },
  );
  // Link regional intl-de
  const intl = resolver.parseSpotifyUrl(
    "https://open.spotify.com/intl-de/track/0eG08cBeKk0mzykKjw4hcQ",
  );
  assert.strictEqual(intl.isSpotify, true);
  assert.strictEqual(intl.type, "track");
  // URI native
  assert.deepStrictEqual(resolver.parseSpotifyUrl("spotify:album:1a2B3c4D5e"), {
    isSpotify: true,
    type: "album",
    id: "1a2B3c4D5e",
  });
  // Prefix spsearch dianggap tipe search
  assert.deepStrictEqual(
    resolver.parseSpotifyUrl("spsearch:animals architects"),
    {
      isSpotify: true,
      type: "search",
      id: "animals architects",
    },
  );
  // Bukan Spotify
  assert.strictEqual(
    resolver.parseSpotifyUrl("https://youtube.com/watch?v=abc").isSpotify,
    false,
  );
  assert.strictEqual(resolver.parseSpotifyUrl("").isSpotify, false);
});

test("buildSearchQueries memprioritaskan ISRC lalu judul", () => {
  const withIsrc = resolver.buildSearchQueries({
    name: "Animals",
    artists: ["Architects"],
    isrc: "USEP42058010",
  });
  assert.deepStrictEqual(withIsrc, [
    'ytsearch:"USEP42058010"',
    "ytsearch:Architects - Animals",
    "ytmsearch:Architects Animals",
  ]);

  const noIsrc = resolver.buildSearchQueries({
    name: "Neon Groove",
    artists: ["DJ Naura"],
  });
  assert.strictEqual(noIsrc.length, 2);
  assert.ok(noIsrc[0].startsWith("ytsearch:DJ Naura - Neon Groove"));
});

test("resolveSpotifyQuery passthrough untuk query non-Spotify", async () => {
  let calls = 0;
  const fakePoru = {
    resolve: async ({ query }) => {
      calls++;
      return {
        loadType: "SEARCH_RESULT",
        tracks: [{ info: { title: query } }],
      };
    },
  };
  const res = await resolver.resolveSpotifyQuery(fakePoru, "ytsearch:lofi", {});
  assert.strictEqual(calls, 1);
  assert.strictEqual(res.loadType, "SEARCH_RESULT");
  assert.strictEqual(res.pluginInfo, undefined); // Tidak distempel apa pun.
});

test("resolveSpotifyQuery memakai jalur native LavaSrc bila node sukses", async () => {
  const fakePoru = {
    resolve: async () => ({
      loadType: "TRACK_LOADED",
      tracks: [
        { info: { title: "Song", author: "Artist", sourceName: "spotify" } },
      ],
    }),
  };
  const res = await resolver.resolveSpotifyQuery(
    fakePoru,
    "https://open.spotify.com/track/abc123XYZ",
    {},
  );
  assert.strictEqual(res.pluginInfo.source, "lavasrc");
  assert.strictEqual(res.tracks[0].info.originalSource, "spotify");
});

test("resolveSpotifyQuery jatuh ke translasi manual saat node gagal", async () => {
  // Simulasikan node tanpa LavaSrc: resolve URL Spotify melempar error,
  // tetapi query pencarian biasa (ytsearch/ytmsearch) tetap berhasil.
  const resolvedQueries = [];
  const fakePoru = {
    resolve: async ({ query }) => {
      if (/open\.spotify\.com/.test(query))
        throw new Error("Load failed (LavaSrc missing)");
      resolvedQueries.push(query);
      return {
        loadType: "SEARCH_RESULT",
        tracks: [{ info: { title: "Match", author: "Test Artist" } }],
      };
    },
  };

  // Mock global.fetch untuk token + endpoint track Web API.
  const originalFetch = global.fetch;
  env.SPOTIFY_CLIENT_ID = "test-id";
  env.SPOTIFY_CLIENT_SECRET = "test-secret";
  global.fetch = async (url) => {
    if (String(url).includes("accounts.spotify.com/api/token")) {
      return {
        ok: true,
        json: async () => ({ access_token: "tok", expires_in: 3600 }),
      };
    }
    if (String(url).includes("/v1/tracks/track456")) {
      return {
        ok: true,
        json: async () => ({
          name: "Test Song",
          artists: [{ name: "Test Artist" }],
          external_ids: { isrc: "IDXX12345678" },
        }),
      };
    }
    return { ok: false, json: async () => ({}) };
  };

  try {
    const res = await resolver.resolveSpotifyQuery(
      fakePoru,
      "https://open.spotify.com/track/track456",
      {},
    );
    assert.strictEqual(res.pluginInfo.source, "spotify-fallback");
    assert.strictEqual(res.loadType, "TRACK_LOADED");
    assert.strictEqual(res.tracks[0].info.originalSource, "spotify");
    // Query pertama yang dipakai harus pencarian berbasis ISRC.
    assert.strictEqual(resolvedQueries[0], 'ytsearch:"IDXX12345678"');
  } finally {
    global.fetch = originalFetch;
  }
});
