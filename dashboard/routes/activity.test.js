"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const acorn = require("acorn");

const activityRouteModule = require("./api/activity");
const cacheManager = require("../../src/managers/cacheManager");
const survivalVitals = require("../../src/survival/helpers/survivalVitals");
const inventoryHelper = require("../../src/survival/engines/inventoryHelper");

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
    setHeader(key, val) {
      headers[key] = val;
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

function findHandler(router, method, routePath) {
  const layer = router.stack.find(
    (l) => l.route && l.route.path === routePath && l.route.methods[method.toLowerCase()],
  );
  if (!layer) return null;
  return layer.route.stack[layer.route.stack.length - 1].handle;
}

test("Discord Activity API - Router initialization and endpoints registration", () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  assert.ok(router, "createRouter harus mengembalikan express router");

  const authHandler = findHandler(router, "post", "/activity/auth");
  const stateHandler = findHandler(router, "get", "/activity/state");
  const gatherHandler = findHandler(router, "post", "/activity/gather");
  const npcHandler = findHandler(router, "post", "/activity/npc-interact");

  assert.ok(typeof authHandler === "function", "Handler POST /activity/auth harus terdaftar");
  assert.ok(typeof stateHandler === "function", "Handler GET /activity/state harus terdaftar");
  assert.ok(typeof gatherHandler === "function", "Handler POST /activity/gather harus terdaftar");
  assert.ok(typeof npcHandler === "function", "Handler POST /activity/npc-interact harus terdaftar");
});

test("Discord Activity API - POST /activity/auth Guest Mode creates and persists session", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const authHandler = findHandler(router, "post", "/activity/auth");

  const guestId = "guest_test_suite_001";
  const { req, res, getStatus, getJson } = createMockReqRes({
    body: { guestId, username: "SukamajuExplorer" },
  });

  await authHandler(req, res);

  assert.equal(getStatus(), 200);
  const data = getJson();
  assert.equal(data.success, true);
  assert.equal(data.isGuest, true);
  assert.equal(data.user.id, guestId);
  assert.equal(data.user.username, "SukamajuExplorer");
  assert.equal(data.location, "desa_sukamaju");
  assert.equal(data.survival.stamina, 100);
  assert.equal(data.survival.starFragments, 150);
  assert.ok(Array.isArray(data.inventory), "Inventory harus array");
  assert.ok(data.inventory.some((i) => i.id === "wooden_axe"), "Harus memiliki Kapak Kayu pemula");
  assert.ok(data.inventory.some((i) => i.id === "wooden_pickaxe"), "Harus memiliki Beliung Kayu pemula");
});

test("Discord Activity API - POST /activity/auth Authenticated Session returns user DB data", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const authHandler = findHandler(router, "post", "/activity/auth");

  const userId = "888888888888888888";
  const mockUser = { id: userId, username: "DiscordVipHero", avatar: "avatar_hash" };

  const origGetSurvival = cacheManager.getUserSurvival;
  const origGetProfile = cacheManager.getUserProfile;

  cacheManager.getUserSurvival = async (id) => ({
    userId: id,
    hp: 110,
    stamina: 85,
    hunger: 90,
    thirst: 95,
    starFragments: 420,
    survival_level: 5,
    survival_xp: 320,
  });

  cacheManager.getUserProfile = async (id) => ({
    userId: id,
    economy_wallet: 25000,
    inventory: JSON.stringify([
      { id: "iron_axe", name: "Kapak Besi", amount: 1, type: "tool" },
      { id: "wood", name: "Kayu Pinus", amount: 25, type: "material" },
    ]),
  });

  try {
    const { req, res, getStatus, getJson } = createMockReqRes({
      user: mockUser,
      body: {},
    });

    await authHandler(req, res);

    assert.equal(getStatus(), 200);
    const data = getJson();
    assert.equal(data.success, true);
    assert.equal(data.isGuest, false);
    assert.equal(data.user.id, userId);
    assert.equal(data.user.username, "DiscordVipHero");
    assert.equal(data.survival.stamina, 85);
    assert.equal(data.survival.starFragments, 420);
    assert.equal(data.survival.coins, 25000);
    assert.equal(data.survival.survival_level, 5);
    assert.ok(data.inventory.some((i) => i.id === "iron_axe"));
  } finally {
    cacheManager.getUserSurvival = origGetSurvival;
    cacheManager.getUserProfile = origGetProfile;
  }
});

test("Discord Activity API - GET /activity/state retrieves state for guest and user", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const stateHandler = findHandler(router, "get", "/activity/state");

  const guestId = "guest_state_test_002";
  const { req, res, getStatus, getJson } = createMockReqRes({
    query: { guestId },
  });

  await stateHandler(req, res);

  assert.equal(getStatus(), 200);
  const data = getJson();
  assert.equal(data.success, true);
  assert.equal(data.isGuest, true);
  assert.equal(data.user.id, guestId);
  assert.equal(data.survival.stamina, 100);
  assert.equal(data.location, "desa_sukamaju");
});

test("Discord Activity API - POST /activity/gather validates actions and stamina cost", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const gatherHandler = findHandler(router, "post", "/activity/gather");

  // 1. Invalid action validation
  const { req: reqInvalid, res: resInvalid, getStatus: getStatusInv, getJson: getJsonInv } = createMockReqRes({
    body: { action: "fly", guestId: "guest_gather_003" },
  });
  await gatherHandler(reqInvalid, resInvalid);
  assert.equal(getStatusInv(), 400);
  assert.equal(getJsonInv().success, false);
  assert.ok(getJsonInv().error.includes("Aksi gathering tidak valid"));

  // 2. Chop action (Cost 12 Stamina)
  const guestId = "guest_gather_chop_004";
  const { req: reqChop, res: resChop, getStatus: getStatusChop, getJson: getJsonChop } = createMockReqRes({
    body: { action: "chop", guestId },
  });
  await gatherHandler(reqChop, resChop);
  assert.equal(getStatusChop(), 200);
  const dataChop = getJsonChop();
  assert.equal(dataChop.success, true);
  assert.equal(dataChop.action, "chop");
  assert.equal(dataChop.staminaRemaining, 88); // 100 - 12 = 88
  assert.ok(dataChop.itemsGained.some((i) => i.id === "wood"));
  assert.equal(dataChop.starFragmentsGained, 15);
  assert.equal(dataChop.xpGained, 25);

  // 3. Insufficient stamina check
  const guestDepleted = "guest_depleted_005";
  const { req: reqDepInit, res: resDepInit } = createMockReqRes({
    body: { guestId: guestDepleted },
  });
  const authHandler = findHandler(router, "post", "/activity/auth");
  await authHandler(reqDepInit, resDepInit);

  // Drain stamina with multiple actions
  for (let i = 0; i < 7; i++) {
    const { req: r, res: s } = createMockReqRes({ body: { action: "mine", guestId: guestDepleted } });
    await gatherHandler(r, s);
  }
  // Next action must fail with 400
  const { req: reqFail, res: resFail, getStatus: getStatusFail, getJson: getJsonFail } = createMockReqRes({
    body: { action: "chop", guestId: guestDepleted },
  });
  await gatherHandler(reqFail, resFail);
  assert.equal(getStatusFail(), 400);
  assert.equal(getJsonFail().success, false);
  assert.ok(getJsonFail().error.includes("Stamina petualang tamu habis"));
});

test("Discord Activity API - POST /activity/npc-interact with Village NPCs", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const npcHandler = findHandler(router, "post", "/activity/npc-interact");

  const guestId = "guest_npc_tester_006";

  // 1. Pak Kades Tirto default dialogue
  const { req: reqKades, res: resKades, getStatus: getStatKades, getJson: getJsonKades } = createMockReqRes({
    body: { npcId: "kades_tirto", guestId },
  });
  await npcHandler(reqKades, resKades);
  assert.equal(getStatKades(), 200);
  const dataKades = getJsonKades();
  assert.equal(dataKades.success, true);
  assert.equal(dataKades.npc.name, "Pak Kades Tirto");
  assert.ok(dataKades.options.some((o) => o.id === "blessing"));

  // 2. Pak Kades Tirto blessing gives +40 Stamina & +50 NSF
  const { req: reqBless, res: resBless, getStatus: getStatBless, getJson: getJsonBless } = createMockReqRes({
    body: { npcId: "kades_tirto", choice: "blessing", guestId },
  });
  await npcHandler(reqBless, resBless);
  assert.equal(getStatBless(), 200);
  const dataBless = getJsonBless();
  assert.equal(dataBless.success, true);
  assert.equal(dataBless.reward.stamina, 40);
  assert.equal(dataBless.reward.starFragments, 50);

  // 3. Pandai Besi Bagas starter kit
  const { req: reqBagas, res: resBagas, getStatus: getStatBagas, getJson: getJsonBagas } = createMockReqRes({
    body: { npcId: "bagas", choice: "starter_kit", guestId },
  });
  await npcHandler(reqBagas, resBagas);
  assert.equal(getStatBagas(), 200);
  const dataBagas = getJsonBagas();
  assert.equal(dataBagas.success, true);
  assert.ok(dataBagas.reward.items.some((i) => i.id === "wooden_axe"));
  assert.ok(dataBagas.reward.items.some((i) => i.id === "wooden_pickaxe"));

  // 4. Mang Ujang fishing kit
  const { req: reqMang, res: resMang, getStatus: getStatMang, getJson: getJsonMang } = createMockReqRes({
    body: { npcId: "mang_ujang", choice: "fishing_kit", guestId },
  });
  await npcHandler(reqMang, resMang);
  assert.equal(getStatMang(), 200);
  const dataMang = getJsonMang();
  assert.equal(dataMang.success, true);
  assert.ok(dataMang.reward.items.some((i) => i.id === "bamboo_fishing_rod"));
});

test("Discord Activity Integration - HTML, Manifest, and Slash Command Parity", () => {
  const ROOT_DIR = path.resolve(__dirname, "../..");
  const activityHtmlPath = path.join(ROOT_DIR, "dashboard/src/pages/activity.html");
  const manifestPath = path.join(ROOT_DIR, "src/config/discordActivityManifest.json");
  const pluginActivityPath = path.join(ROOT_DIR, "plugin/utility/activity.js");

  // 1. activity.html
  assert.ok(fs.existsSync(activityHtmlPath), "activity.html harus ada di dashboard/src/pages/");
  const htmlContent = fs.readFileSync(activityHtmlPath, "utf8");
  assert.ok(htmlContent.includes('id="sanctuary3dContainer"'), "Harus memuat container WebGL 3D");
  assert.ok(htmlContent.includes("naura_hoshino_mascot.jpg"), "Harus memuat maskot resmi Naura di overlay loading");
  assert.ok(htmlContent.includes('id="hudStaminaBar"'), "Harus memuat bar stamina RPG");
  assert.ok(htmlContent.includes('id="hudFragments"'), "Harus memuat pill Star Fragments RPG");
  assert.ok(htmlContent.includes('id="activityJoystickBase"'), "Harus memuat virtual analog joystick mobile");
  assert.ok(htmlContent.includes('id="activityTouchActionBtn"'), "Harus memuat tombol interaksi dinamis sentuh mobile");
  assert.ok(htmlContent.includes('id="rpgNpcModal"'), "Harus memuat modal interaksi dialog NPC");

  // Inline script Acorn syntax parsing
  const scriptRegex = /<script(?![^>]*\bsrc\s*=)([^>]*)>([\s\S]*?)<\/script>/g;
  let match;
  let scriptCount = 0;
  while ((match = scriptRegex.exec(htmlContent))) {
    scriptCount++;
    const isImportmap = /type\s*=\s*["']importmap["']/.test(match[1]);
    if (isImportmap) {
      assert.doesNotThrow(() => JSON.parse(match[2]), "importmap harus JSON valid");
    } else {
      assert.doesNotThrow(() => {
        acorn.parse(match[2], { ecmaVersion: "latest", sourceType: "module" });
      }, `Inline script #${scriptCount} di activity.html harus valid JS`);
    }
  }
  assert.ok(scriptCount >= 2, "activity.html harus memuat minimal importmap dan script utama");

  // 2. Manifest check
  assert.ok(fs.existsSync(manifestPath), "discordActivityManifest.json harus ada");
  const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
  assert.equal(manifest.entrypoint, "/activity", "Entrypoint manifest harus menunjuk ke /activity");
  assert.ok(manifest.capabilities.includes("voice_state"), "Manifest harus memiliki kapabilitas voice_state");

  // 3. Slash command plugin check
  assert.ok(fs.existsSync(pluginActivityPath), "plugin/utility/activity.js harus ada");
  const plugin = require(pluginActivityPath);
  assert.equal(plugin.data.name, "activity");
  const subcommands = plugin.data.options.map((o) => o.name);
  assert.ok(subcommands.includes("launch"), "Command harus memiliki subcommand launch");
  assert.ok(subcommands.includes("info"), "Command harus memiliki subcommand info");
});

test("Discord Activity API - Authenticated user blessing clamps stamina to maximum 100", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const npcHandler = findHandler(router, "post", "/activity/npc-interact");

  const userId = "777777777777777777";
  const mockUser = { id: userId, username: "StaminaCappedHero" };

  const origGetSurvival = cacheManager.getUserSurvival;
  const origIncSurvival = cacheManager.incrementUserSurvival;

  let capturedDeltas = null;
  cacheManager.getUserSurvival = async () => ({
    userId,
    stamina: 85,
    starFragments: 100,
  });

  cacheManager.incrementUserSurvival = async (uid, deltas) => {
    capturedDeltas = deltas;
    return { ok: true };
  };

  try {
    const { req, res, getStatus, getJson } = createMockReqRes({
      user: mockUser,
      body: { npcId: "kades_tirto", choice: "blessing" },
    });

    await npcHandler(req, res);

    assert.equal(getStatus(), 200);
    const json = getJson();
    assert.equal(json.success, true);
    assert.ok(capturedDeltas, "incrementUserSurvival harus dipanggil dengan deltas");
    assert.equal(capturedDeltas.stamina, 15); // 100 - 85 = 15 (clamped)
    assert.equal(capturedDeltas.starFragments, 50);
  } finally {
    cacheManager.getUserSurvival = origGetSurvival;
    cacheManager.incrementUserSurvival = origIncSurvival;
  }
});

test("Discord Activity API - Authenticated user resource gathering atomic mutation", async () => {
  const mockClient = { users: { cache: new Map() } };
  const router = activityRouteModule.createRouter(mockClient);
  const gatherHandler = findHandler(router, "post", "/activity/gather");

  const userId = "999999999999999999";
  const mockUser = { id: userId, username: "MiningHero" };

  const origConsume = survivalVitals.consumeEnergyOrVitals;
  const origAddItems = inventoryHelper.addItemsAtomic;
  const origIncSurvival = cacheManager.incrementUserSurvival;
  const origGetSurvival = cacheManager.getUserSurvival;
  const origGetProfile = cacheManager.getUserProfile;

  let consumedCost = 0;
  let addedItems = null;
  let incrementedNsf = 0;

  survivalVitals.consumeEnergyOrVitals = async (uid, cost) => {
    consumedCost = cost;
    return { ok: true };
  };

  inventoryHelper.addItemsAtomic = async (uid, items) => {
    addedItems = items;
    return { ok: true, items };
  };

  cacheManager.incrementUserSurvival = async (uid, field, amount) => {
    if (field === "starFragments") incrementedNsf = amount;
    return { ok: true };
  };

  cacheManager.getUserSurvival = async () => ({
    userId,
    stamina: 85,
    starFragments: 220,
    survival_level: 2,
    survival_xp: 45,
  });

  cacheManager.getUserProfile = async () => ({
    userId,
    inventory: JSON.stringify([{ id: "stone", name: "Batu Andesit", amount: 5, type: "material" }]),
  });

  try {
    const { req, res, getStatus, getJson } = createMockReqRes({
      user: mockUser,
      body: { action: "mine" },
    });

    await gatherHandler(req, res);

    assert.equal(getStatus(), 200);
    const json = getJson();
    assert.equal(json.success, true);
    assert.equal(json.action, "mine");
    assert.equal(consumedCost, 15); // Mine cost is 15
    assert.ok(Array.isArray(addedItems), "Items harus ditambahkan via addItemsAtomic");
    assert.ok(addedItems.some((i) => i.id === "stone"));
    assert.equal(incrementedNsf, 20); // Mine NSF reward is 20
    assert.equal(json.staminaRemaining, 85);
  } finally {
    survivalVitals.consumeEnergyOrVitals = origConsume;
    inventoryHelper.addItemsAtomic = origAddItems;
    cacheManager.incrementUserSurvival = origIncSurvival;
    cacheManager.getUserSurvival = origGetSurvival;
    cacheManager.getUserProfile = origGetProfile;
  }
});
