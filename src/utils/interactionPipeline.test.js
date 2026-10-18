"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  activeCollectors,
  registerCollector,
  stopCollector,
  createManagedCollector,
  createPaginationCollector,
} = require("./interactionPipeline");

test("interactionPipeline - registerCollector and stopCollector", () => {
  let stoppedReason = null;
  const mockCollector = {
    stop(reason) {
      stoppedReason = reason;
    },
  };

  registerCollector("msg-123", mockCollector);
  assert.equal(activeCollectors.get("msg-123"), mockCollector);

  // Stop collector
  stopCollector("msg-123", "timeout");
  assert.equal(stoppedReason, "timeout");
  assert.equal(activeCollectors.has("msg-123"), false);
});

test("interactionPipeline - registerCollector stops existing collector with 'navigated'", () => {
  let oldStopped = null;
  const oldCollector = {
    stop(reason) {
      oldStopped = reason;
    },
  };
  const newCollector = {
    stop() {},
  };

  registerCollector("msg-dual", oldCollector);
  registerCollector("msg-dual", newCollector);

  assert.equal(oldStopped, "navigated");
  assert.equal(activeCollectors.get("msg-dual"), newCollector);
  activeCollectors.delete("msg-dual");
});

test("interactionPipeline - createManagedCollector handles user filter and collect callback", async () => {
  let collectHandler = null;
  let endHandler = null;

  const mockCollector = {
    on(event, handler) {
      if (event === "collect") collectHandler = handler;
      if (event === "end") endHandler = handler;
      return this;
    },
    stop() {},
  };

  const mockMessage = {
    id: "msg-managed-1",
    createMessageComponentCollector() {
      return mockCollector;
    },
    async edit() {},
  };

  const authorizedUser = { id: "user-123" };
  let processedAction = false;

  createManagedCollector(mockMessage, authorizedUser, {
    onCollect: async (i) => {
      processedAction = true;
    },
  });

  // Unauthorized click
  let rejectedReply = null;
  const unauthorizedInteraction = {
    user: { id: "user-intruder" },
    async reply(payload) {
      rejectedReply = payload;
    },
  };
  await collectHandler(unauthorizedInteraction);
  assert.notEqual(rejectedReply, null);
  assert.equal(processedAction, false);

  // Authorized click
  const authorizedInteraction = {
    user: { id: "user-123" },
  };
  await collectHandler(authorizedInteraction);
  assert.equal(processedAction, true);

  // End event
  let ended = false;
  createManagedCollector(mockMessage, authorizedUser, {
    onEnd: async () => {
      ended = true;
    },
  });
  await endHandler([], "time");
  assert.equal(ended, true);
});

test("interactionPipeline - createPaginationCollector handles page changes", async () => {
  let collectHandler = null;
  const mockCollector = {
    on(event, handler) {
      if (event === "collect") collectHandler = handler;
      return this;
    },
    stop() {},
  };

  const mockMessage = {
    id: "msg-page-1",
    createMessageComponentCollector() {
      return mockCollector;
    },
    async edit() {},
  };

  let currentPageObserved = 0;
  createPaginationCollector(mockMessage, { id: "user-1" }, {
    totalPages: 3,
    initialPage: 0,
    prevPrefix: "prev_",
    nextPrefix: "next_",
    onPageChange: async (page) => {
      currentPageObserved = page;
    },
  });

  // Next page click
  await collectHandler({
    user: { id: "user-1" },
    customId: "next_btn",
  });
  assert.equal(currentPageObserved, 1);

  // Next page click again
  await collectHandler({
    user: { id: "user-1" },
    customId: "next_btn",
  });
  assert.equal(currentPageObserved, 2);

  // Prev page click
  await collectHandler({
    user: { id: "user-1" },
    customId: "prev_btn",
  });
  assert.equal(currentPageObserved, 1);

  activeCollectors.delete("msg-page-1");
});

test("interactionPipeline - createManagedCollector supports componentType: null", () => {
  let capturedOptions = null;
  const mockMessage = {
    id: "msg-all-components",
    createMessageComponentCollector(options) {
      capturedOptions = options;
      return {
        on() {
          return this;
        },
        stop() {},
      };
    },
  };

  createManagedCollector(mockMessage, { id: "user-123" }, {
    componentType: null,
    time: 45000,
  });

  assert.equal(capturedOptions.time, 45000);
  assert.equal("componentType" in capturedOptions, false);
  activeCollectors.delete("msg-all-components");
});
