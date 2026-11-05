"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  safeDeleteMessage,
  deleteAfterDelay,
  dismissMessage,
  isUnknownMessageError,
  cleanGhostContainers,
  UNKNOWN_MESSAGE_CODES,
} = require("../src/utils/messageHelper");
const messageCleaner = require("../src/utils/messageCleaner");
const { createManagedCollector } = require("../src/utils/interactionPipeline");
const cleanupPlugin = require("../plugin/utility/cleanup");

test("safeDeleteMessage: deletes message via message.delete() and returns true", async () => {
  let deleteCalled = false;
  let editCalled = false;

  const mockMessage = {
    id: "msg-001",
    delete: async () => {
      deleteCalled = true;
    },
    edit: async () => {
      editCalled = true;
    },
  };

  const result = await safeDeleteMessage(mockMessage);
  assert.equal(result, true);
  assert.equal(deleteCalled, true);
  assert.equal(editCalled, false, "Must never call edit or clear files");
});

test("safeDeleteMessage: deletes replied or deferred interaction via deleteReply()", async () => {
  let deleteReplyCalled = false;
  let editReplyCalled = false;

  const mockInteraction = {
    id: "int-001",
    deferred: true,
    replied: false,
    deleteReply: async () => {
      deleteReplyCalled = true;
    },
    editReply: async () => {
      editReplyCalled = true;
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
  assert.equal(deleteReplyCalled, true);
  assert.equal(editReplyCalled, false, "Must never strip files via editReply");
});

test("safeDeleteMessage: handles unacknowledged component interaction by deferring and deleting message", async () => {
  let deferUpdateCalled = false;
  let messageDeleteCalled = false;

  const mockInteraction = {
    id: "int-btn-001",
    deferred: false,
    replied: false,
    deferUpdate: async () => {
      deferUpdateCalled = true;
    },
    deleteReply: async () => {},
    message: {
      id: "parent-msg-001",
      delete: async () => {
        messageDeleteCalled = true;
      },
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
  assert.equal(deferUpdateCalled, true);
  assert.equal(messageDeleteCalled, true);
});

test("safeDeleteMessage: handles unacknowledged command interaction by deferring ephemerally and deleting", async () => {
  let deferReplyCalled = false;
  let deleteReplyCalled = false;

  const mockInteraction = {
    id: "int-cmd-001",
    deferred: false,
    replied: false,
    deferReply: async (opts) => {
      deferReplyCalled = true;
    },
    deleteReply: async () => {
      deleteReplyCalled = true;
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
  assert.equal(deferReplyCalled, true);
  assert.equal(deleteReplyCalled, true);
});

test("safeDeleteMessage: deletes target with nested message object", async () => {
  let deleteCalled = false;

  const mockWrapper = {
    message: {
      id: "wrapped-001",
      delete: async () => {
        deleteCalled = true;
      },
    },
  };

  const result = await safeDeleteMessage(mockWrapper);
  assert.equal(result, true);
  assert.equal(deleteCalled, true);
});

test("safeDeleteMessage: returns false on null or invalid input", async () => {
  assert.equal(await safeDeleteMessage(null), false);
  assert.equal(await safeDeleteMessage(undefined), false);
  assert.equal(await safeDeleteMessage({}), false);
});

test("safeDeleteMessage: gracefully catches and suppresses DiscordAPIError 10008 (Unknown Message)", async () => {
  const err10008 = new Error("Unknown Message");
  err10008.code = 10008;

  const mockMessage = {
    id: "msg-deleted-10008",
    delete: async () => {
      throw err10008;
    },
  };

  const result = await safeDeleteMessage(mockMessage);
  assert.equal(
    result,
    true,
    "10008 Unknown Message should be gracefully suppressed as true",
  );
});

test("safeDeleteMessage: gracefully catches and suppresses DiscordAPIError 10015 (Unknown Webhook)", async () => {
  const err10015 = new Error("Unknown Webhook");
  err10015.code = 10015;

  const mockInteraction = {
    id: "int-10015",
    deferred: true,
    deleteReply: async () => {
      throw err10015;
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
});

test("safeDeleteMessage: gracefully catches and suppresses DiscordAPIError 10062 (Unknown interaction)", async () => {
  const err10062 = new Error("Unknown interaction");
  err10062.code = 10062;

  const mockInteraction = {
    id: "int-10062",
    deferred: true,
    deleteReply: async () => {
      throw err10062;
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
});

test("safeDeleteMessage: gracefully catches and suppresses DiscordAPIError 50027 (Invalid Webhook Token)", async () => {
  const err50027 = new Error("Invalid Webhook Token");
  err50027.code = 50027;

  const mockInteraction = {
    id: "int-50027",
    deferred: true,
    deleteReply: async () => {
      throw err50027;
    },
  };

  const result = await safeDeleteMessage(mockInteraction);
  assert.equal(result, true);
});

test("safeDeleteMessage: gracefully catches HTTP 404 / 401 and AbortError", async () => {
  const err404 = new Error("Not Found");
  err404.status = 404;

  const mockMsg404 = {
    delete: async () => {
      throw err404;
    },
  };
  assert.equal(await safeDeleteMessage(mockMsg404), true);

  const abortErr = new Error("The operation was aborted");
  abortErr.name = "AbortError";

  const mockMsgAbort = {
    delete: async () => {
      throw abortErr;
    },
  };
  assert.equal(await safeDeleteMessage(mockMsgAbort), true);
});

test("deleteAfterDelay: schedules and executes safeDeleteMessage", async () => {
  let deleted = false;
  const mockMessage = {
    id: "msg-delay-01",
    delete: async () => {
      deleted = true;
    },
  };

  const cancel = deleteAfterDelay(mockMessage, 40);
  assert.equal(typeof cancel, "function");

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(deleted, true);
});

test("deleteAfterDelay: cancel prevents deletion", async () => {
  let deleted = false;
  const mockMessage = {
    id: "msg-delay-02",
    delete: async () => {
      deleted = true;
    },
  };

  const cancel = deleteAfterDelay(mockMessage, 40);
  cancel();

  await new Promise((r) => setTimeout(r, 80));
  assert.equal(deleted, false);
});

test("dismissMessage: alias calls safeDeleteMessage directly", async () => {
  let deleted = false;
  const mockMessage = {
    delete: async () => {
      deleted = true;
    },
  };

  const result = await dismissMessage(mockMessage);
  assert.equal(result, true);
  assert.equal(deleted, true);
});

test("isUnknownMessageError: recognizes known Discord deletion error codes and messages", () => {
  assert.ok(UNKNOWN_MESSAGE_CODES.has(10008));
  assert.equal(isUnknownMessageError({ code: 10008 }), true);
  assert.equal(isUnknownMessageError({ code: "10015" }), true);
  assert.equal(isUnknownMessageError({ code: 10062 }), true);
  assert.equal(isUnknownMessageError({ code: 50027 }), true);
  assert.equal(isUnknownMessageError({ status: 404 }), true);
  assert.equal(isUnknownMessageError({ name: "AbortError" }), true);
  assert.equal(isUnknownMessageError(new Error("Unknown Message")), true);
  assert.equal(
    isUnknownMessageError(new Error("Some other database error")),
    false,
  );
});

test("cleanGhostContainers: identifies and removes empty ghost container shells", async () => {
  const deletedIds = [];
  const fakeMessages = new Map([
    // Ghost message: bot message with no content, no embeds, no attachments, no components
    [
      "ghost-01",
      {
        id: "ghost-01",
        author: { bot: true, id: "bot-99" },
        content: "",
        embeds: [],
        attachments: new Map(),
        components: [],
        delete: async () => {
          deletedIds.push("ghost-01");
        },
      },
    ],
    // Normal message: has content
    [
      "normal-01",
      {
        id: "normal-01",
        author: { bot: true, id: "bot-99" },
        content: "Halo dunia!",
        embeds: [],
        attachments: new Map(),
        components: [],
        delete: async () => {
          deletedIds.push("normal-01");
        },
      },
    ],
    // Normal message: has components
    [
      "normal-02",
      {
        id: "normal-02",
        author: { bot: true, id: "bot-99" },
        content: "",
        embeds: [],
        attachments: new Map(),
        components: [{ type: 1 }],
        delete: async () => {
          deletedIds.push("normal-02");
        },
      },
    ],
  ]);

  const mockChannel = {
    messages: {
      fetch: async () => fakeMessages,
    },
  };

  const result = await cleanGhostContainers(mockChannel, { botId: "bot-99" });
  assert.equal(result.cleaned, 1);
  assert.equal(result.checked, 3);
  assert.deepEqual(deletedIds, ["ghost-01"]);
});

test("messageCleaner: registerAutoDelete with safeDeleteMessage integration", async () => {
  let deleted = false;
  const mockMessage = {
    id: "msg-cleaner-auto-01",
    delete: async () => {
      deleted = true;
    },
  };

  const cancel = messageCleaner.registerAutoDelete(mockMessage, 1);
  assert.equal(messageCleaner.activeTimers.has("msg-cleaner-auto-01"), true);
  cancel();
  assert.equal(messageCleaner.activeTimers.has("msg-cleaner-auto-01"), false);
  assert.equal(deleted, false);
});

test("interactionPipeline: managed collector with deleteOnTimeout calls safeDeleteMessage", async () => {
  let messageDeleted = false;
  let endCalled = false;

  const mockMsg = {
    id: "msg-collector-01",
    delete: async () => {
      messageDeleted = true;
    },
    createMessageComponentCollector: () => {
      const emitter = {
        handlers: {},
        on(event, handler) {
          this.handlers[event] = handler;
        },
        async trigger(event, ...args) {
          if (this.handlers[event]) {
            await this.handlers[event](...args);
          }
        },
      };
      return emitter;
    },
  };

  const collector = createManagedCollector(mockMsg, null, {
    deleteOnTimeout: true,
    onEnd: () => {
      endCalled = true;
    },
  });

  // Trigger timeout end
  await collector.trigger("end", new Map(), "time");
  assert.equal(
    messageDeleted,
    true,
    "Message should be deleted cleanly on timeout",
  );
  assert.equal(endCalled, true);
});

test("cleanup command: verifies SlashCommandBuilder specification", () => {
  assert.equal(cleanupPlugin.data.name, "cleanup");
  const json = cleanupPlugin.data.toJSON();
  assert.equal(json.name, "cleanup");
  assert.ok(json.options.some((opt) => opt.name === "jumlah"));
  assert.ok(json.options.some((opt) => opt.name === "hanya_bot"));
  assert.ok(json.options.some((opt) => opt.name === "hanya_container"));
});

test("cleanup command: executes cleanup and deletes target messages cleanly", async () => {
  const deletedIds = [];
  const mockChannelMessages = new Map([
    [
      "bot-msg-1",
      {
        id: "bot-msg-1",
        author: { bot: true, id: "bot-123" },
        content: "Bot notification",
        delete: async () => {
          deletedIds.push("bot-msg-1");
        },
      },
    ],
    [
      "user-msg-1",
      {
        id: "user-msg-1",
        author: { bot: false, id: "user-456" },
        content: "User chat",
        delete: async () => {
          deletedIds.push("user-msg-1");
        },
      },
    ],
  ]);

  let repliedPayload = null;
  const mockInteraction = {
    id: "cleanup-int-01",
    _autoDismissMs: 0,
    channel: {
      messages: {
        fetch: async () => mockChannelMessages,
      },
    },
    client: {
      user: { id: "bot-123" },
    },
    options: {
      getInteger: (name) => (name === "jumlah" ? 10 : null),
      getBoolean: (name) => {
        if (name === "hanya_bot") return true;
        if (name === "hanya_container") return false;
        return null;
      },
    },
    guild: null,
    deferReply: async () => {},
    editReply: async (payload) => {
      repliedPayload = payload;
    },
    deleteReply: async () => {},
  };

  await cleanupPlugin.execute(mockInteraction);

  assert.deepEqual(deletedIds, ["bot-msg-1"]);
  assert.ok(repliedPayload, "Response payload must be generated");
  assert.ok(
    repliedPayload.components,
    "Response payload must use Components V2",
  );
});
