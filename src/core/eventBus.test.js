"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const eventBus = require("./eventBus");

test("EventBus - In-Memory Local Emission (Tier 1)", () => {
  eventBus.clear();
  let receivedData = null;

  eventBus.on("test:event", (data) => {
    receivedData = data;
  });

  const emitted = eventBus.emit("test:event", { message: "halo dunia", value: 42 });
  assert.equal(emitted, true);
  assert.deepEqual(receivedData, { message: "halo dunia", value: 42 });
  eventBus.clear();
});

test("EventBus - Broadcast helper and Redis bridge integration (Tier 2)", async () => {
  eventBus.clear();

  let publishedChannel = null;
  let publishedMessage = null;
  let subscriberCallback = null;

  const mockRedis = {
    isReady: true,
    async initPubSub(channel, cb) {
      publishedChannel = channel;
      subscriberCallback = cb;
    },
    async publish(channel, data) {
      publishedChannel = channel;
      publishedMessage = data;
    },
  };

  await eventBus.attachRedisBridge(mockRedis);

  // Test broadcast outwards
  eventBus.broadcast("test:broadcast", { testKey: "testValue" });
  assert.equal(publishedChannel, "naura:events:bridge");
  assert.equal(publishedMessage.event, "test:broadcast");
  assert.equal(publishedMessage.origin, eventBus.origin);
  assert.deepEqual(publishedMessage.data, { testKey: "testValue" });

  // Test incoming remote packet
  let remoteReceived = null;
  eventBus.on("remote:action", (data, metadata) => {
    remoteReceived = { data, metadata };
  });

  // Echo test: message from same origin must be ignored
  subscriberCallback(JSON.stringify({
    origin: eventBus.origin,
    event: "remote:action",
    data: { shouldIgnore: true },
  }));
  assert.equal(remoteReceived, null);

  // Message from remote origin must be received
  subscriberCallback(JSON.stringify({
    origin: "proc-remote-9999",
    event: "remote:action",
    data: { ok: true, remoteVal: 100 },
  }));
  assert.notEqual(remoteReceived, null);
  assert.deepEqual(remoteReceived.data, { ok: true, remoteVal: 100 });
  assert.equal(remoteReceived.metadata.fromRemote, true);

  eventBus.clear();
});

test("EventBus - Clear and MaxListeners", () => {
  eventBus.clear();
  assert.equal(eventBus.eventNames().length, 0);
  assert.equal(eventBus.getMaxListeners(), 100);
});
