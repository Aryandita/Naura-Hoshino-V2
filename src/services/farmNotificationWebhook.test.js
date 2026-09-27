"use strict";

const test = require("node:test");
const assert = require("node:assert");
const farmWebhook = require("./farmNotificationWebhook");

test("FarmNotificationWebhook validates and manages user webhooks", async () => {
  const userId = "test-farmer-1";

  // Invalid URL
  const invalidRes = await farmWebhook.setWebhook(userId, "not-a-url");
  assert.strictEqual(invalidRes.success, false);

  // Valid URL
  const validRes = await farmWebhook.setWebhook(userId, "https://webhook.site/test-uuid");
  assert.strictEqual(validRes.success, true);

  // Retrieve URL
  const url = await farmWebhook.getWebhook(userId);
  assert.strictEqual(url, "https://webhook.site/test-uuid");

  // Check harvest without ready crops
  const emptyGreenhouse = { slots: [{ slotIndex: 0, cropState: "growing" }] };
  const res1 = await farmWebhook.checkAndNotifyHarvest(userId, emptyGreenhouse);
  assert.strictEqual(res1.readyCount, 0);
  assert.strictEqual(res1.dispatched, false);

  // Check harvest with ready crops (mock fetch error/dispatch handled gracefully)
  const readyGreenhouse = {
    slots: [
      {
        slotIndex: 0,
        cropState: "ready",
        seedId: "astral_strawberry",
        seedName: "Astral Strawberry",
        plantedAt: 1234567,
      },
    ],
  };
  const res2 = await farmWebhook.checkAndNotifyHarvest(userId, readyGreenhouse);
  assert.strictEqual(res2.readyCount, 1);

  // Delete webhook
  const deleted = await farmWebhook.deleteWebhook(userId);
  assert.strictEqual(deleted, true);
  const afterDelete = await farmWebhook.getWebhook(userId);
  assert.strictEqual(afterDelete, null);
});
