"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  requireSelfOrOwner,
  requireGuildManager,
  MANAGE_GUILD,
} = require("../middleware/auth");
const ticketRoutes = require("./tickets");
const apiRoutes = require("./api");

// Helper membuat mock request & response
function createMockReqRes(options = {}) {
  let statusCode = 200;
  let jsonBody = null;
  let textBody = null;
  const headers = {};

  const req = {
    isAuthenticated: () => Boolean(options.user),
    user: options.user || null,
    body: options.body || {},
    query: options.query || {},
    params: options.params || {},
    path: options.path || "/",
    originalUrl: options.originalUrl || options.path || "/",
    accepts: (type) =>
      options.accepts ? options.accepts.includes(type) : false,
    ...options.reqOverrides,
  };

  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      jsonBody = data;
      return this;
    },
    send(text) {
      textBody = text;
      return this;
    },
    redirect(url) {
      statusCode = 302;
      headers.Location = url;
      return this;
    },
    setHeader(key, val) {
      headers[key] = val;
      return this;
    },
    sendFile(filePath) {
      textBody = `[FILE: ${filePath}]`;
      return this;
    },
  };

  return {
    req,
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
    getText: () => textBody,
    getHeaders: () => headers,
  };
}

// -----------------------------------------------------------------------------
// 1. Uji Anti-IDOR pada requireSelfOrOwner
// -----------------------------------------------------------------------------
test("Security: requireSelfOrOwner menolak request yang belum login dengan HTTP 401", () => {
  const { req, res, getStatus, getJson } = createMockReqRes({ user: null });
  let nextCalled = false;

  requireSelfOrOwner(req, res, () => {
    nextCalled = true;
  });

  assert.equal(
    nextCalled,
    false,
    "next() tidak boleh dipanggil saat unauthenticated",
  );
  assert.equal(getStatus(), 401);
  assert.equal(getJson()?.success, false);
});

test("Security: requireSelfOrOwner menolak Pengguna A yang mencoba melihat/mengubah data Pengguna B via URL (?userId=...) dengan HTTP 403", () => {
  const userA = { id: "111111111111111111", username: "UserA" };
  const userBId = "222222222222222222";

  const { req, res, getStatus, getJson } = createMockReqRes({
    user: userA,
    query: { userId: userBId },
  });

  let nextCalled = false;
  requireSelfOrOwner(req, res, () => {
    nextCalled = true;
  });

  assert.equal(
    nextCalled,
    false,
    "next() tidak boleh dipanggil saat mengakses data user lain",
  );
  assert.equal(getStatus(), 403, "Harus mengembalikan HTTP 403 Forbidden");
  assert.equal(getJson()?.success, false);
  assert.match(getJson()?.error, /Akses ditolak/i);
});

test("Security: requireSelfOrOwner mengizinkan Pengguna A melihat/mengubah datanya sendiri", () => {
  const userA = { id: "111111111111111111", username: "UserA" };

  const { req, res, getStatus } = createMockReqRes({
    user: userA,
    query: { userId: "111111111111111111" },
  });

  let nextCalled = false;
  requireSelfOrOwner(req, res, () => {
    nextCalled = true;
  });

  assert.equal(
    nextCalled,
    true,
    "next() harus dipanggil saat user mengakses datanya sendiri",
  );
  assert.equal(getStatus(), 200);
  assert.equal(req.targetUserId, "111111111111111111");
});

test("Security: requireSelfOrOwner otomatis mengambil ID sesi saat query/body userId tidak dikirim", () => {
  const userA = { id: "111111111111111111", username: "UserA" };

  const { req, res, getStatus } = createMockReqRes({
    user: userA,
    query: {},
  });

  let nextCalled = false;
  requireSelfOrOwner(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(getStatus(), 200);
  assert.equal(req.targetUserId, "111111111111111111");
});

// -----------------------------------------------------------------------------
// 2. Uji Isolasi Pengaturan Server (requireGuildManager)
// -----------------------------------------------------------------------------
test("Security: requireGuildManager menolak akses jika tidak ada sesi login (HTTP 401)", () => {
  const { req, res, getStatus } = createMockReqRes({ user: null });
  let nextCalled = false;

  requireGuildManager(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 401);
});

test("Security: requireGuildManager menolak request tanpa parameter guildId (HTTP 400)", () => {
  const user = { id: "123", guilds: [] };
  const { req, res, getStatus } = createMockReqRes({ user, query: {} });
  let nextCalled = false;

  requireGuildManager(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 400);
});

test("Security: requireGuildManager menolak pengguna yang tidak memiliki izin MANAGE_GUILD pada server target (HTTP 403)", () => {
  const user = {
    id: "123",
    guilds: [{ id: "999888777", permissions: "0", owner: false }],
  };

  const { req, res, getStatus, getJson } = createMockReqRes({
    user,
    query: { guildId: "999888777" },
  });

  let nextCalled = false;
  requireGuildManager(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, false);
  assert.equal(getStatus(), 403);
  assert.match(getJson()?.error, /tidak punya izin/i);
});

test("Security: requireGuildManager mengizinkan pengguna dengan izin MANAGE_GUILD sah", () => {
  const user = {
    id: "123",
    guilds: [
      { id: "999888777", permissions: String(MANAGE_GUILD), owner: false },
    ],
  };

  const { req, res, getStatus } = createMockReqRes({
    user,
    query: { guildId: "999888777" },
  });

  let nextCalled = false;
  requireGuildManager(req, res, () => {
    nextCalled = true;
  });

  assert.equal(nextCalled, true);
  assert.equal(getStatus(), 200);
  assert.equal(req.guildId, "999888777");
});

// -----------------------------------------------------------------------------
// 3. Uji Rute Terproteksi Transkrip Tiket (/transcripts/:filename)
// -----------------------------------------------------------------------------
test("Security: GET /transcripts/:filename menolak traversal path atau nama file ilegal (HTTP 400)", async () => {
  const mockClient = { guilds: { cache: new Map() } };
  const router = ticketRoutes(mockClient);

  const transcriptRoute = router.stack.find(
    (layer) => layer.route && layer.route.path === "/transcripts/:filename",
  );
  assert.ok(transcriptRoute, "Route /transcripts/:filename harus terdaftar");

  const handler = transcriptRoute.route.stack[0].handle;

  const { req, res, getStatus, getText } = createMockReqRes({
    params: { filename: "../secret.txt" },
    user: { id: "123" },
  });

  await handler(req, res);
  assert.equal(getStatus(), 400);
  assert.match(getText(), /tidak valid/i);
});

test("Security: GET /transcripts/:filename menolak akses jika pengguna belum login", async () => {
  const mockClient = { guilds: { cache: new Map() } };
  const router = ticketRoutes(mockClient);
  const transcriptRoute = router.stack.find(
    (layer) => layer.route && layer.route.path === "/transcripts/:filename",
  );
  const handler = transcriptRoute.route.stack[0].handle;

  const { req, res, getStatus } = createMockReqRes({
    params: { filename: "transcript-12345.html" },
    user: null,
    accepts: ["html"],
  });

  await handler(req, res);
  assert.equal(getStatus(), 302);
});

// -----------------------------------------------------------------------------
// 4. Uji Proteksi API Kendali Musik (/api/music/control)
// -----------------------------------------------------------------------------
test("Security: POST /api/music/control dijaga dengan requireGuildManager", () => {
  const mockClient = { poru: { players: new Map() } };
  const router = apiRoutes(mockClient);

  const musicControlRoute = router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === "/music/control" &&
      layer.route.methods.post,
  );
  assert.ok(musicControlRoute, "Route POST /music/control harus terdaftar");

  assert.ok(
    musicControlRoute.route.stack.length >= 2,
    "POST /music/control harus memiliki middleware otorisasi requireGuildManager",
  );
});
