"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const webPushService = require("../src/services/webPushService");

test("WebPushService - getVapidPublicKey returns a valid non-empty Base64URL string", () => {
  const key = webPushService.getVapidPublicKey();
  assert.ok(typeof key === "string");
  assert.ok(key.length > 30);
  assert.match(key, /^[A-Za-z0-9_-]+$/);
});

test("WebPushService - createVapidToken creates valid ES256 JWT structure", () => {
  const token = webPushService.createVapidToken("https://fcm.googleapis.com");
  assert.ok(typeof token === "string");
  const parts = token.split(".");
  assert.equal(parts.length, 3);

  // Decode payload
  const payloadBuf = Buffer.from(parts[1], "base64");
  const payload = JSON.parse(payloadBuf.toString());
  assert.equal(payload.aud, "https://fcm.googleapis.com");
  assert.ok(payload.exp > Math.floor(Date.now() / 1000));
});

test("WebPushService - sendPushNotification handles invalid endpoint gracefully", async () => {
  const res = await webPushService.sendPushNotification(
    { endpoint: "http://insecure.endpoint" },
    { title: "Test" },
  );
  assert.equal(res.success, false);
});

test("WebPushService - notifyWorldBossSpawn and notifyDailyReset execute cleanly", async () => {
  await assert.doesNotReject(async () => {
    const resBoss = await webPushService.notifyWorldBossSpawn({
      bossName: "Celestial Phoenix",
      level: 10,
      location: "Puncak Gunung Astral",
      rewardNsf: 8000,
    });
    assert.ok(typeof resBoss.total === "number");

    const resReset = await webPushService.notifyDailyReset({
      streakBonusPercent: 50,
    });
    assert.ok(typeof resReset.total === "number");
  });
});
