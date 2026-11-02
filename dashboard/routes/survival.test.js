"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const createSurvivalRouter = require("./survival");
const cacheManager = require("../../src/managers/cacheManager");

const USER_ID = "888888888888888888";

function findRoute(router, method, routePath) {
  return router.stack.find(
    (layer) =>
      layer.route &&
      layer.route.path === routePath &&
      layer.route.methods[method.toLowerCase()],
  );
}

function createReqRes(body = {}) {
  let statusCode = 200;
  let jsonBody = null;
  const req = {
    method: "POST",
    body,
    query: {},
    params: {},
    session: {},
    user: { id: USER_ID, username: "SurvivalTester", avatar: null },
    isAuthenticated: () => true,
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
  };
  return {
    req,
    res,
    getStatus: () => statusCode,
    getJson: () => jsonBody,
  };
}

async function invokeRoute(route, req, res) {
  let index = 0;
  async function next(error) {
    if (error) throw error;
    const layer = route.route.stack[index++];
    if (!layer) return;
    await layer.handle(req, res, next);
  }
  await next();
}

function installCacheFakes(t, initialState) {
  const originals = {
    getUserSurvival: cacheManager.getUserSurvival,
    getUserProfile: cacheManager.getUserProfile,
    updateUserSurvival: cacheManager.updateUserSurvival,
    updateUserProfile: cacheManager.updateUserProfile,
    incrementUserSurvival: cacheManager.incrementUserSurvival,
    incrementUserProfile: cacheManager.incrementUserProfile,
    debitUserSurvival: cacheManager.debitUserSurvival,
    debitUserProfile: cacheManager.debitUserProfile,
    withLock: cacheManager.withLock,
  };

  const state = {
    survival: {
      hp: 50,
      stamina: 50,
      hunger: 50,
      thirst: 50,
      sukamajuCoins: 0,
      scholarshipVouchers: 0,
      vehicle: null,
      strength: 10,
      intelligence: 10,
      agility: 10,
      charisma: 10,
      luck: 10,
      ...initialState.survival,
    },
    profile: {
      pratamaDollars: 0,
      ...initialState.profile,
    },
  };

  let lockTail = Promise.resolve();
  cacheManager.withLock = async (_key, _ttl, workFn) => {
    const previous = lockTail;
    let release;
    lockTail = new Promise((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await workFn();
    } finally {
      release();
    }
  };

  cacheManager.getUserSurvival = async () => ({ ...state.survival });
  cacheManager.getUserProfile = async () => ({ ...state.profile });
  cacheManager.updateUserSurvival = async (_userId, patch) => {
    assert.equal(
      Object.hasOwn(patch, "sukamajuCoins") ||
        Object.hasOwn(patch, "scholarshipVouchers"),
      false,
      "Saldo survival tidak boleh ditulis absolut lewat updateUserSurvival",
    );
    Object.assign(state.survival, patch);
    return true;
  };
  cacheManager.updateUserProfile = async (_userId, patch) => {
    assert.equal(
      Object.hasOwn(patch, "pratamaDollars"),
      false,
      "Saldo profil tidak boleh ditulis absolut lewat updateUserProfile",
    );
    Object.assign(state.profile, patch);
    return true;
  };
  cacheManager.incrementUserSurvival = async (_userId, deltas) => {
    for (const [field, amount] of Object.entries(deltas)) {
      state.survival[field] = Number(state.survival[field] || 0) + Number(amount);
    }
    return { ...state.survival };
  };
  cacheManager.incrementUserProfile = async (_userId, deltas) => {
    for (const [field, amount] of Object.entries(deltas)) {
      state.profile[field] = Number(state.profile[field] || 0) + Number(amount);
    }
    return { ...state.profile };
  };
  cacheManager.debitUserSurvival = async (_userId, field, amount) => {
    if (Number(state.survival[field] || 0) < amount) {
      return { ok: false, reason: "insufficient" };
    }
    state.survival[field] -= amount;
    return { ok: true, amount };
  };
  cacheManager.debitUserProfile = async (_userId, field, amount) => {
    if (Number(state.profile[field] || 0) < amount) {
      return { ok: false, reason: "insufficient" };
    }
    state.profile[field] -= amount;
    return { ok: true, amount };
  };

  t.after(() => {
    Object.assign(cacheManager, originals);
  });

  return state;
}

test("Dashboard Survival: seluruh route mutasi menolak request tanpa autentikasi", async () => {
  const router = createSurvivalRouter();
  const paths = [
    "/territory/claim",
    "/world/roam",
    "/world/work",
    "/world/shop/buy",
    "/world/vehicle/buy",
    "/world/vehicle/sell",
  ];

  for (const routePath of paths) {
    const route = findRoute(router, "post", routePath);
    assert.ok(route, `POST ${routePath} harus terdaftar`);
    assert.ok(
      route.route.stack.length >= 2,
      `POST ${routePath} harus memiliki middleware autentikasi sebelum handler`,
    );

    const request = createReqRes();
    request.req.user = null;
    request.req.isAuthenticated = () => false;
    let nextCalled = false;
    await route.route.stack[0].handle(request.req, request.res, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false, `POST ${routePath} tidak boleh meneruskan request guest`);
    assert.equal(request.getStatus(), 401, `POST ${routePath} harus membalas HTTP 401`);
    assert.equal(request.getJson()?.success, false);
  }
});

test("Dashboard Survival: dua pembelian paralel tidak dapat memakai saldo yang sama", async (t) => {
  const state = installCacheFakes(t, {
    survival: { sukamajuCoins: 20 },
  });
  const router = createSurvivalRouter();
  const route = findRoute(router, "post", "/world/shop/buy");
  const first = createReqRes({
    areaId: "desa_sukamaju",
    locationId: "warung",
    itemId: "nasi_goreng",
  });
  const second = createReqRes({
    areaId: "desa_sukamaju",
    locationId: "warung",
    itemId: "nasi_goreng",
  });

  await Promise.all([
    invokeRoute(route, first.req, first.res),
    invokeRoute(route, second.req, second.res),
  ]);

  const responses = [first, second];
  assert.equal(
    responses.filter((entry) => entry.getJson()?.success === true).length,
    1,
    "Hanya satu pembelian boleh berhasil",
  );
  assert.equal(
    responses.filter((entry) => entry.getStatus() === 400).length,
    1,
    "Pembelian kedua harus ditolak karena saldo sudah terpotong",
  );
  assert.equal(state.survival.sukamajuCoins, 5);
});

test("Dashboard Survival: dua pembelian kendaraan paralel hanya mendebit sekali", async (t) => {
  const state = installCacheFakes(t, {
    survival: { sukamajuCoins: 400, vehicle: null },
  });
  const router = createSurvivalRouter();
  const route = findRoute(router, "post", "/world/vehicle/buy");
  const first = createReqRes({ vehicleId: "motor_bebek_sukamaju" });
  const second = createReqRes({ vehicleId: "motor_bebek_sukamaju" });

  await Promise.all([
    invokeRoute(route, first.req, first.res),
    invokeRoute(route, second.req, second.res),
  ]);

  const responses = [first, second];
  assert.equal(
    responses.filter((entry) => entry.getJson()?.success === true).length,
    1,
    "Hanya satu pembelian kendaraan boleh berhasil",
  );
  assert.equal(
    responses.filter((entry) => entry.getStatus() === 400).length,
    1,
    "Pembelian kedua harus ditolak setelah kendaraan pertama tersimpan",
  );
  assert.equal(state.survival.vehicle, "motor_bebek_sukamaju");
  assert.equal(state.survival.sukamajuCoins, 50);
});

test("Dashboard Survival: dua penjualan kendaraan paralel hanya memberi satu refund", async (t) => {
  const state = installCacheFakes(t, {
    survival: {
      sukamajuCoins: 0,
      vehicle: "motor_bebek_sukamaju",
    },
  });
  const router = createSurvivalRouter();
  const route = findRoute(router, "post", "/world/vehicle/sell");
  const first = createReqRes();
  const second = createReqRes();

  await Promise.all([
    invokeRoute(route, first.req, first.res),
    invokeRoute(route, second.req, second.res),
  ]);

  const responses = [first, second];
  assert.equal(
    responses.filter((entry) => entry.getJson()?.success === true).length,
    1,
    "Hanya satu penjualan boleh berhasil",
  );
  assert.equal(
    responses.filter((entry) => entry.getStatus() === 400).length,
    1,
    "Penjualan kedua harus ditolak setelah kendaraan dilepas",
  );
  assert.equal(state.survival.vehicle, null);
  assert.equal(state.survival.sukamajuCoins, 245);
});
