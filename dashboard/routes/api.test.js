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

test("Dashboard API Route - GET /topology/status returns complete multi-tier telemetry", async () => {
  const mockClient = {
    uptime: 120000,
    ws: { ping: 35 },
    guilds: {
      cache: {
        size: 10,
        reduce: (fn, init) =>
          [{ memberCount: 500 }, { memberCount: 300 }].reduce(fn, init),
      },
    },
    poru: {
      nodes: new Map([
        [
          "primary-1",
          {
            isConnected: true,
            name: "Primary Node",
            options: { host: "127.0.0.1", port: 2333 },
          },
        ],
        [
          "serenetia",
          {
            isConnected: true,
            name: "Serenetia",
            options: { isPrimaryFallback: true, port: 443 },
          },
        ],
      ]),
    },
  };

  const router = apiRoutes(mockClient);
  const topologyRoute = router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === "/topology/status" &&
      layer.route.methods.get,
  );
  assert.ok(topologyRoute, "Endpoint GET /topology/status harus terdaftar");

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

  const handler = topologyRoute.route.stack[0].handle;
  await handler(mockReq, mockRes);

  assert.equal(statusCode, 200);
  assert.equal(responseData.success, true);
  assert.ok(responseData.gateway, "Gateway telemetry harus ada");
  assert.equal(responseData.gateway.pingMs, 35);
  assert.equal(responseData.gateway.guildsCount, 10);
  assert.equal(responseData.gateway.usersCount, 800);

  assert.ok(responseData.compute, "Compute telemetry harus ada");
  assert.equal(
    responseData.compute.workerPool.service,
    "Dedicated Canvas Worker Pool",
  );

  assert.ok(responseData.persistence, "Persistence telemetry harus ada");
  assert.ok(
    responseData.persistence.relational,
    "Relational persistence tier harus ada",
  );
  assert.ok(responseData.persistence.cache, "Cache persistence tier harus ada");
  assert.ok(
    responseData.persistence.document,
    "Document persistence tier harus ada",
  );
  assert.ok(
    responseData.persistence.emergencyFallback,
    "SQLite Emergency Fallback harus ada",
  );

  assert.ok(responseData.audioCluster, "Audio cluster telemetry harus ada");
  assert.equal(responseData.audioCluster.totalNodes, 2);
  assert.equal(responseData.audioCluster.connectedNodes, 2);

  assert.ok(
    responseData.aiOrchestration,
    "AI orchestration telemetry harus ada",
  );
  assert.equal(
    responseData.aiOrchestration.primaryEngine.name,
    "Gemini 2.5 Flash",
  );
  assert.equal(
    responseData.aiOrchestration.failoverEngine.name,
    "Groq LLaMA 3.3 Versatile",
  );
});

test("Dashboard API Route - GET /automations/pipelines returns structured pipeline states", async () => {
  const mockClient = { guilds: { cache: new Map() } };
  const router = apiRoutes(mockClient);

  const pipelineRoute = router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === "/automations/pipelines" &&
      layer.route.methods.get,
  );
  assert.ok(pipelineRoute, "Endpoint GET /automations/pipelines harus terdaftar");

  let responseData = null;
  let statusCode = 200;
  const mockReq = { query: {} };
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

  await pipelineRoute.route.stack[0].handle(mockReq, mockRes);
  assert.equal(statusCode, 200);
  assert.equal(responseData.success, true);
  assert.ok(responseData.pipelines, "Objek pipelines harus tersedia");
  assert.equal(typeof responseData.pipelines.antiRaid, "boolean");
  assert.equal(typeof responseData.pipelines.aiTriage, "boolean");
  assert.equal(typeof responseData.pipelines.voiceEviction, "boolean");
  assert.equal(typeof responseData.pipelines.autoRoleLeveling, "boolean");
  assert.equal(responseData.pipelines.treasurySettlement, true);
  assert.equal(responseData.pipelines.writeBehind, true);
});

test("Dashboard API Helpers - arcadeState & pushState handles distributed/fallback caching", async () => {
  const { arcadeState, pushState } = require("./api/helpers");
  assert.ok(arcadeState, "arcadeState helper harus ada");
  assert.ok(pushState, "pushState helper harus ada");

  const testUser = "test_user_qa_123";
  const now = Date.now();

  // Test arcadeState cooldown
  await arcadeState.setCooldown(testUser, now);
  const cd = await arcadeState.getCooldown(testUser);
  assert.equal(cd, now);

  // Test arcadeState daily cap
  const today = new Date().toISOString().slice(0, 10);
  await arcadeState.setDaily(testUser, { date: today, claimed: 150 });
  const daily = await arcadeState.getDaily(testUser, today);
  assert.equal(daily.date, today);
  assert.equal(daily.claimed, 150);

  // Test pushState registration
  await pushState.setSubscription(testUser, {
    endpoint: "https://fcm.googleapis.com/fcm/send/sample",
  });
  const hasSub = await pushState.hasSubscription(testUser);
  assert.equal(hasSub, true);

  const sub = await pushState.getSubscription(testUser);
  assert.equal(sub.endpoint, "https://fcm.googleapis.com/fcm/send/sample");

  await pushState.deleteSubscription(testUser);
  const hasSubAfter = await pushState.hasSubscription(testUser);
  assert.equal(hasSubAfter, false);
});

test("Dashboard API Modular Router - All sub-module endpoints are registered on router stack", () => {
  const mockClient = { guilds: { cache: new Map() } };
  const router = apiRoutes(mockClient);

  const routes = router.stack
    .filter((layer) => layer.route)
    .map((layer) => ({
      path: layer.route.path,
      methods: Object.keys(layer.route.methods),
    }));

  const paths = routes.map((r) => r.path);

  // Telemetry routes
  assert.ok(paths.includes("/health"), "Harus memuat /health");
  assert.ok(paths.includes("/realtime/overview"), "Harus memuat /realtime/overview");
  assert.ok(paths.includes("/topology/status"), "Harus memuat /topology/status");

  // Economy routes
  assert.ok(paths.includes("/economy/deposit"), "Harus memuat /economy/deposit");
  assert.ok(paths.includes("/economy/withdraw"), "Harus memuat /economy/withdraw");
  assert.ok(paths.includes("/economy/transfer"), "Harus memuat /economy/transfer");
  assert.ok(paths.includes("/realtime/leaderboard"), "Harus memuat /realtime/leaderboard");

  // Music routes
  assert.ok(paths.includes("/music/state"), "Harus memuat /music/state");
  assert.ok(paths.includes("/music/control"), "Harus memuat /music/control");

  // Activity routes
  assert.ok(paths.includes("/chat"), "Harus memuat /chat");
  assert.ok(paths.includes("/activity/manifest"), "Harus memuat /activity/manifest");
  assert.ok(paths.includes("/arcade/claim"), "Harus memuat /arcade/claim");

  // Admin routes
  assert.ok(paths.includes("/discord/token"), "Harus memuat /discord/token");
  assert.ok(paths.includes("/push/subscribe"), "Harus memuat /push/subscribe");
  assert.ok(paths.includes("/admin/flush-cache"), "Harus memuat /admin/flush-cache");
});

