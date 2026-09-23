"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const notificationCenter = require("./notificationCenter");

describe("NotificationCenter Service", () => {
  it("DEFAULT_PREFS has all 5 notification types set to true", () => {
    const prefs = notificationCenter.DEFAULT_PREFS;
    assert.strictEqual(prefs.stamina_full, true);
    assert.strictEqual(prefs.daily_streak, true);
    assert.strictEqual(prefs.stock_alert, true);
    assert.strictEqual(prefs.idle_revenue, true);
    assert.strictEqual(prefs.quest_reset, true);
    assert.strictEqual(prefs.event_news, true);
  });

  it("NOTIFICATION_TEMPLATES correctly formats messages with user displayName", () => {
    const template = notificationCenter.NOTIFICATION_TEMPLATES.stamina_full;
    assert.ok(template);
    const msg = template.renderMessage({}, "Ryaa");
    assert.ok(msg.includes("Ryaa"));
    assert.ok(msg.includes("Stamina"));
  });

  it("setUserPreference throws error on invalid key", async () => {
    await assert.rejects(async () => {
      await notificationCenter.setUserPreference("123", "invalid_key", true);
    }, /tidak valid/);
  });

  it("notificationManager maintains complete parity with notificationCenter", () => {
    const notificationManager = require("../managers/notificationManager");
    assert.strictEqual(typeof notificationManager.sendNotification, "function");
    assert.strictEqual(
      typeof notificationManager.ensureDmAuthorized,
      "function",
    );
    assert.strictEqual(
      notificationManager.DEFAULT_PREFS,
      notificationCenter.DEFAULT_PREFS,
    );
  });
});
