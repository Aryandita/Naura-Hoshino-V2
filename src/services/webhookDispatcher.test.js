"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const webhookDispatcher = require("./webhookDispatcher");
const { EVENT_TYPES } = webhookDispatcher;

test("WebhookDispatcher - Event Types and validation", async () => {
  assert.ok(EVENT_TYPES.MEMBER_LEVEL_UP);
  assert.ok(EVENT_TYPES.TICKET_CREATED);
  assert.ok(EVENT_TYPES.LARGE_TRANSACTION);
  assert.ok(EVENT_TYPES.SEASON_TIER_CLAIMED);

  // Invalid URL should safely return false without throwing
  const result = await webhookDispatcher.dispatch(
    "invalid-url",
    EVENT_TYPES.MEMBER_LEVEL_UP,
    { userId: "123" },
  );
  assert.equal(result, false);

  const emptyResult = await webhookDispatcher.dispatch(
    "",
    EVENT_TYPES.TICKET_CREATED,
    {},
  );
  assert.equal(emptyResult, false);
});
