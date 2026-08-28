"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const apiRoutes = require("./api");

test("Dashboard API Route - GET /api/health returns correct structure", async () => {
  const mockClient = {
    uptime: 120000,
    ws: { ping: 42 },
    guilds: { cache: { size: 15 } },
    poru: {
      nodes: new Map([
        ["node-1", { isConnected: true }],
        ["node-2", { isConnected: false }],
      ]),
    },
  };

  const router = apiRoutes(mockClient);
  assert.ok(router, "Router harus berhasil dibuat");

  // Cari handler GET /health
  const healthRoute = router.stack.find(
    (layer) =>
      layer.route && layer.route.path === "/health" && layer.route.methods.get,
  );
  assert.ok(healthRoute, "Endpoint GET /health harus terdaftar");

  // Panggil handler dengan mock req & res
  let responseData = null;
  let statusCode = 200;

  const mockReq = {};
  const mockRes = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(data) {
      responseData = data;
      return this;
    },
  };

  const handler = healthRoute.route.stack[0].handle;
  await handler(mockReq, mockRes);

  assert.equal(statusCode, 200);
  assert.ok(responseData, "Response data harus terisi");
  assert.equal(responseData.status, "ok");

  // Validasi objek bot
  assert.ok(responseData.bot, "Objek bot harus ada");
  assert.equal(responseData.bot.uptimeSeconds, 120);
  assert.equal(responseData.bot.ping, 42);
  assert.equal(responseData.bot.guilds, 15);
  assert.ok(typeof responseData.bot.memoryUsageMB === "number");

  // Validasi services
  assert.ok(responseData.services, "Objek services harus ada");
  assert.ok(responseData.services.database, "Database service harus ada");
  assert.ok(responseData.services.mongodb, "MongoDB service harus ada");
  assert.ok(responseData.services.redis, "Redis service harus ada");
  assert.ok(responseData.services.lavalink, "Lavalink service harus ada");

  // Validasi sub-properti MongoDB & Lavalink
  assert.ok(typeof responseData.services.mongodb.state === "string");
  assert.equal(responseData.services.lavalink.nodes, 2);
  assert.equal(responseData.services.lavalink.connected, 1);
});
