"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const tradeEngine = require("./tradeEngine");
const landEngine = require("../survival/engines/landEngine");

describe("Discord Activity, Web Push & Caravan Ambush System", () => {
  it("tradeEngine broadcastAmbushAlert formats and triggers cleanly without throwing", async () => {
    const alertData = {
      caravanId: "crv_test_push_101",
      ownerUserId: "user_victim_101",
      routeName: "Rute Badung -> Galactic Core Nexus",
      raiderName: "Raider_BanditClan",
      lootAmount: 2500,
    };

    // Panggil broadcastAmbushAlert
    await assert.doesNotReject(async () => {
      await tradeEngine.broadcastAmbushAlert(alertData);
    });
  });

  it("landEngine generates valid spatial proximity data for Activity webview", async () => {
    const listener = { x: 3, y: 3 };
    const speaker = { x: 4, y: 4 };

    const proximity = landEngine.calculateSpatialProximity(listener, speaker);
    assert.ok(proximity);
    assert.ok(proximity.distance > 0);
    assert.strictEqual(proximity.audible, true);
    assert.ok(proximity.volume > 0 && proximity.volume <= 1.0);
    assert.ok(typeof proximity.pan === "number");
  });

  it("landEngine calculates silence for distant metaverse avatars", () => {
    const listener = { x: 1, y: 1 };
    const farSpeaker = { x: 8, y: 8 };

    const proximity = landEngine.calculateSpatialProximity(
      listener,
      farSpeaker,
    );
    assert.strictEqual(proximity.audible, false);
    assert.strictEqual(proximity.volume, 0);
  });
});
