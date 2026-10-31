"use strict";

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");

const errorHandler = require("../src/managers/errorHandler");
const {
  classifyError,
  getErrorFingerprint,
  formatTruncatedStack,
  sendErrorLog,
  setupErrorHandlers,
  flushIncident,
  clearIncidents,
  incidentRegistry,
} = errorHandler;

const env = require("../src/config/env");
const designTokens = require("../src/config/tokens/designTokens");

describe("Developer Error Alerts & Throttling Upgrade Tests", () => {
  let originalOwnerIds;
  let originalWebhookUrl;

  beforeEach(() => {
    // Save original env values
    originalOwnerIds = env.OWNER_IDS;
    originalWebhookUrl = env.ERROR_WEBHOOK_URL;
    clearIncidents();
  });

  afterEach(() => {
    // Restore original env values and clean memory
    env.OWNER_IDS = originalOwnerIds;
    env.ERROR_WEBHOOK_URL = originalWebhookUrl;
    clearIncidents();
  });

  describe("1. Smart Error Classification (classifyError)", () => {
    it("should classify network and gateway errors into NETWORK_WS", () => {
      // Socket timeouts & connection resets
      const timeoutErr = new Error("connect ETIMEDOUT 104.16.1.1:443");
      timeoutErr.code = "ETIMEDOUT";
      const res1 = classifyError(timeoutErr);
      assert.equal(res1.category, "NETWORK_WS");
      assert.equal(res1.badge, "[🌐 NETWORK / GATEWAY]");
      assert.equal(res1.accentColorHex, designTokens.STATUS.syncing.hex);
      assert.equal(res1.accentColor, designTokens.STATUS.syncing.int);
      assert.equal(res1.severity, "HIGH");

      const resetErr = new Error("read ECONNRESET");
      resetErr.code = "ECONNRESET";
      const res2 = classifyError(resetErr);
      assert.equal(res2.category, "NETWORK_WS");

      const refusedErr = new Error("connect ECONNREFUSED 127.0.0.1:2333");
      refusedErr.code = "ECONNREFUSED";
      const res3 = classifyError(refusedErr);
      assert.equal(res3.category, "NETWORK_WS");

      // WebSocket drops & Lavalink disconnects
      const wsErr = new Error("WebSocket was closed before connection was established");
      const res4 = classifyError(wsErr);
      assert.equal(res4.category, "NETWORK_WS");

      const lavalinkErr = new Error("Lavalink audio node socket disconnected");
      const res5 = classifyError(lavalinkErr);
      assert.equal(res5.category, "NETWORK_WS");

      // Shard errors via type
      const shardErr = new Error("Heartbeat ack timeout");
      const res6 = classifyError(shardErr, "Shard Error (#0)");
      assert.equal(res6.category, "NETWORK_WS");
    });

    it("should classify database and ORM errors into DATABASE", () => {
      // Sequelize errors
      class SequelizeConnectionError extends Error {
        constructor(msg) {
          super(msg);
          this.name = "SequelizeConnectionError";
        }
      }
      const seqConnErr = new SequelizeConnectionError("Connection to Supabase failed");
      const res1 = classifyError(seqConnErr);
      assert.equal(res1.category, "DATABASE");
      assert.equal(res1.badge, "[🗄️ DATABASE]");
      assert.equal(res1.accentColorHex, designTokens.STATUS.idle.hex);
      assert.equal(res1.accentColor, designTokens.STATUS.idle.int);
      assert.equal(res1.severity, "HIGH");

      class SequelizeDatabaseError extends Error {
        constructor(msg) {
          super(msg);
          this.name = "SequelizeDatabaseError";
        }
      }
      const seqDbErr = new SequelizeDatabaseError("syntax error at or near 'SELECT'");
      const res2 = classifyError(seqDbErr);
      assert.equal(res2.category, "DATABASE");

      // Mongoose / MongoDB errors
      class MongoServerSelectionError extends Error {
        constructor(msg) {
          super(msg);
          this.name = "MongoServerSelectionError";
        }
      }
      const mongoErr = new MongoServerSelectionError("Server selection timed out after 30000 ms");
      const res3 = classifyError(mongoErr);
      assert.equal(res3.category, "DATABASE");

      // Redis errors
      const redisErr = new Error("ioredis command timed out after 5000ms");
      const res4 = classifyError(redisErr);
      assert.equal(res4.category, "DATABASE");
    });

    it("should classify AI quota and rate limit errors into AI_QUOTA_429", () => {
      // HTTP status 429
      const quotaErr = new Error("Quota exceeded for quota metric 'GenerateContent'");
      quotaErr.status = 429;
      const res1 = classifyError(quotaErr);
      assert.equal(res1.category, "AI_QUOTA_429");
      assert.equal(res1.badge, "[🧠 AI QUOTA 429]");
      assert.equal(res1.accentColorHex, designTokens.STATUS.maintenance.hex);
      assert.equal(res1.accentColor, designTokens.STATUS.maintenance.int);
      assert.equal(res1.severity, "HIGH");

      // RESOURCE_EXHAUSTED code
      const resExhaustedErr = new Error("Resource has been exhausted (e.g. check quota).");
      resExhaustedErr.code = "RESOURCE_EXHAUSTED";
      const res2 = classifyError(resExhaustedErr);
      assert.equal(res2.category, "AI_QUOTA_429");

      // Rate limit text from Gemini / Groq / OpenAI
      const geminiErr = new Error("429 Too Many Requests: rate limit exceeded for gemini-2.0-flash");
      const res3 = classifyError(geminiErr);
      assert.equal(res3.category, "AI_QUOTA_429");

      const groqErr = new Error("Groq API rate limit reached, please retry after 60s");
      const res4 = classifyError(groqErr);
      assert.equal(res4.category, "AI_QUOTA_429");
    });

    it("should classify fatal JavaScript errors into FATAL_CRASH", () => {
      const typeErr = new TypeError("Cannot read properties of undefined (reading 'token')");
      const res1 = classifyError(typeErr);
      assert.equal(res1.category, "FATAL_CRASH");
      assert.equal(res1.badge, "[🔴 FATAL CRASH]");
      assert.equal(res1.accentColorHex, designTokens.STATUS.dnd.hex);
      assert.equal(res1.accentColor, designTokens.STATUS.dnd.int);
      assert.equal(res1.severity, "CRITICAL");

      const refErr = new ReferenceError("unresolvedVariable is not defined");
      const res2 = classifyError(refErr);
      assert.equal(res2.category, "FATAL_CRASH");

      const rangeErr = new RangeError("Maximum call stack size exceeded");
      const res3 = classifyError(rangeErr);
      assert.equal(res3.category, "FATAL_CRASH");

      const assertErr = new assert.AssertionError({ message: "Condition failed" });
      const res4 = classifyError(assertErr);
      assert.equal(res4.category, "FATAL_CRASH");

      // Uncaught Exception context
      const fatalErr = new Error("Process killed abruptly");
      const res5 = classifyError(fatalErr, "Uncaught Exception");
      assert.equal(res5.category, "FATAL_CRASH");
    });

    it("should classify unhandled generic errors into GENERIC", () => {
      const genericErr = new Error("Something strange and unhandled occurred in worker");
      const res = classifyError(genericErr, "Unhandled Rejection");
      assert.equal(res.category, "GENERIC");
      assert.equal(res.badge, "[⚠️ GENERIC]");
      assert.equal(res.accentColorHex, designTokens.STATUS.idle.hex);
      assert.equal(res.accentColor, designTokens.STATUS.idle.int);
      assert.equal(res.severity, "MEDIUM");
    });
  });

  describe("2. Error Fingerprinting Normalization (getErrorFingerprint)", () => {
    it("should produce identical fingerprints for errors with different Snowflake IDs", () => {
      const err1 = new Error("Failed to process transaction for user 123456789012345678 in guild 234567890123456789");
      const err2 = new Error("Failed to process transaction for user 987654321098765432 in guild 876543210987654321");

      const fp1 = getErrorFingerprint(err1, "EconomyError");
      const fp2 = getErrorFingerprint(err2, "EconomyError");

      assert.equal(fp1, fp2);
      assert.equal(typeof fp1, "string");
      assert.equal(fp1.length, 32);
    });

    it("should produce identical fingerprints for errors with different ISO timestamps", () => {
      const err1 = new Error("Timeout occurred at 2026-10-31T01:15:30.000Z while fetching resource");
      const err2 = new Error("Timeout occurred at 2026-10-31T02:45:10.999Z while fetching resource");

      const fp1 = getErrorFingerprint(err1, "TimeoutError");
      const fp2 = getErrorFingerprint(err2, "TimeoutError");

      assert.equal(fp1, fp2);
    });

    it("should produce identical fingerprints for errors with different memory addresses and UUIDs", () => {
      const err1 = new Error("Segfault at address 0x7ffee1234abc with request uuid 123e4567-e89b-12d3-a456-426614174000");
      const err2 = new Error("Segfault at address 0x7faab9876def with request uuid 987fcdeb-51a2-43f1-b987-123456789abc");

      const fp1 = getErrorFingerprint(err1, "Crash");
      const fp2 = getErrorFingerprint(err2, "Crash");

      assert.equal(fp1, fp2);
    });

    it("should produce distinct fingerprints for fundamentally different errors", () => {
      const typeErr = new TypeError("Cannot read properties of null (reading 'foo')");
      const dbErr = new Error("SequelizeConnectionError: Connection refused");
      dbErr.name = "SequelizeConnectionError";

      const fp1 = getErrorFingerprint(typeErr, "Crash");
      const fp2 = getErrorFingerprint(dbErr, "Database");

      assert.notEqual(fp1, fp2);
    });
  });

  describe("3. Sliding Window Throttling & Incident Counter", () => {
    function createMockClient() {
      const sentDMs = [];
      const mockUser = {
        id: "123456789012345678",
        send: async (payload) => {
          sentDMs.push(payload);
          return { id: "msg_123" };
        },
      };

      return {
        user: { tag: "Naura#0000" },
        shard: { ids: [0] },
        users: {
          fetch: async (id) => (id === mockUser.id ? mockUser : null),
        },
        sentDMs,
      };
    }

    it("should dispatch immediate alert on the first occurrence of an error", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new TypeError("Cannot read properties of undefined (reading 'balance')");
      const result = await sendErrorLog(err, "Uncaught Exception", mockClient);

      assert.equal(result.sent, true);
      assert.equal(result.throttled, false);
      assert.equal(result.incidentCount, 1);
      assert.equal(result.isMilestone, false);
      assert.equal(mockClient.sentDMs.length, 1);

      // Verify incident is tracked in registry
      assert.equal(incidentRegistry.has(result.fingerprint), true);
      const tracked = incidentRegistry.get(result.fingerprint);
      assert.equal(tracked.count, 1);
    });

    it("should throttle rapid repeated occurrences within cooldown window and increment incident count", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new Error("Gateway connection reset by peer");
      err.code = "ECONNRESET";

      // First occurrence -> Dispatched
      const res1 = await sendErrorLog(err, "Network Disconnect", mockClient);
      assert.equal(res1.sent, true);
      assert.equal(res1.throttled, false);
      assert.equal(res1.incidentCount, 1);
      assert.equal(mockClient.sentDMs.length, 1);

      // Second occurrence within cooldown -> Throttled
      const res2 = await sendErrorLog(err, "Network Disconnect", mockClient);
      assert.equal(res2.sent, false);
      assert.equal(res2.throttled, true);
      assert.equal(res2.incidentCount, 2);
      assert.equal(mockClient.sentDMs.length, 1); // No new DM sent!

      // Third occurrence within cooldown -> Throttled
      const res3 = await sendErrorLog(err, "Network Disconnect", mockClient);
      assert.equal(res3.sent, false);
      assert.equal(res3.throttled, true);
      assert.equal(res3.incidentCount, 3);
      assert.equal(mockClient.sentDMs.length, 1); // Still 1 DM

      // Fourth occurrence within cooldown -> Throttled
      const res4 = await sendErrorLog(err, "Network Disconnect", mockClient);
      assert.equal(res4.sent, false);
      assert.equal(res4.throttled, true);
      assert.equal(res4.incidentCount, 4);
      assert.equal(mockClient.sentDMs.length, 1);
    });
  });

  describe("4. Milestone Alerts and Cooldown Flush", () => {
    function createMockClient() {
      const sentDMs = [];
      const mockUser = {
        id: "123456789012345678",
        send: async (payload) => {
          sentDMs.push(payload);
          return { id: "msg_123" };
        },
      };

      return {
        user: { tag: "Naura#0000" },
        shard: { ids: [0] },
        users: {
          fetch: async (id) => (id === mockUser.id ? mockUser : null),
        },
        sentDMs,
      };
    }

    it("should dispatch a milestone alert when recurring count reaches 5x", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new Error("Database deadlock detected on table 'UserProfiles'");
      err.name = "SequelizeDatabaseError";

      // 1st occurrence (Immediate)
      await sendErrorLog(err, "Database Deadlock", mockClient);
      assert.equal(mockClient.sentDMs.length, 1);

      // 2nd, 3rd, 4th occurrences (Throttled)
      await sendErrorLog(err, "Database Deadlock", mockClient);
      await sendErrorLog(err, "Database Deadlock", mockClient);
      await sendErrorLog(err, "Database Deadlock", mockClient);
      assert.equal(mockClient.sentDMs.length, 1);

      // 5th occurrence (Milestone reached!)
      const res5 = await sendErrorLog(err, "Database Deadlock", mockClient);
      assert.equal(res5.sent, true);
      assert.equal(res5.throttled, false);
      assert.equal(res5.isMilestone, true);
      assert.equal(res5.incidentCount, 5);

      // Verify that developer received the 2nd DM specifically for the 5x milestone
      assert.equal(mockClient.sentDMs.length, 2);
      const milestonePayload = mockClient.sentDMs[1];
      const frequencyField = milestonePayload.components[0].components.find(
        (c) => c.content && c.content.includes("Frekuensi Insiden"),
      );
      assert.ok(frequencyField, "Field frekuensi insiden harus ada");
      assert.ok(frequencyField.content.includes("5 kejadian"));
      assert.ok(frequencyField.content.includes("Milestone"));
    });

    it("should dispatch aggregated summary when cooldown window is flushed", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new Error("AI API quota exhausted (HTTP 429)");
      err.status = 429;

      // Initial error + 2 repeated occurrences (total 3 occurrences)
      const res1 = await sendErrorLog(err, "AI Rate Limit", mockClient);
      await sendErrorLog(err, "AI Rate Limit", mockClient);
      await sendErrorLog(err, "AI Rate Limit", mockClient);

      assert.equal(mockClient.sentDMs.length, 1);
      assert.equal(incidentRegistry.get(res1.fingerprint).count, 3);

      // Simulate cooldown window flush
      const flushPayload = await flushIncident(res1.fingerprint, mockClient);
      assert.ok(flushPayload, "Flush payload harus dikirim karena suppressed count > 1");

      // Verify developer received the aggregated DM
      assert.equal(mockClient.sentDMs.length, 2);
      const aggregatedDM = mockClient.sentDMs[1];
      const freqField = aggregatedDM.components[0].components.find(
        (c) => c.content && c.content.includes("Frekuensi Insiden"),
      );
      assert.ok(freqField, "Field frekuensi insiden harus ada di aggregated alert");
      assert.ok(freqField.content.includes("3 kejadian"));
      assert.ok(freqField.content.includes("Agregasi Cooldown"));

      // Verify incident registry cleared for this fingerprint
      assert.equal(incidentRegistry.has(res1.fingerprint), false);
    });

    it("should not dispatch aggregated flush if error only occurred once", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new Error("Isolated glitch");
      const res1 = await sendErrorLog(err, "OneOffGlitch", mockClient);
      assert.equal(mockClient.sentDMs.length, 1);

      // Flush when count is 1
      const flushPayload = await flushIncident(res1.fingerprint, mockClient);
      assert.equal(flushPayload, null);
      assert.equal(mockClient.sentDMs.length, 1); // No duplicate DM
      assert.equal(incidentRegistry.has(res1.fingerprint), false);
    });
  });

  describe("5. Discord Components V2 Structure & Presentation", () => {
    function createMockClient() {
      const sentDMs = [];
      const mockUser = {
        id: "123456789012345678",
        send: async (payload) => {
          sentDMs.push(payload);
          return { id: "msg_123" };
        },
      };

      return {
        user: { tag: "Naura#0000" },
        shard: { ids: [0] },
        users: {
          fetch: async (id) => (id === mockUser.id ? mockUser : null),
        },
        sentDMs,
      };
    }

    it("should construct valid Components V2 payload with type 17 container and IsComponentsV2 flag", async () => {
      const mockClient = createMockClient();
      env.OWNER_IDS = ["123456789012345678"];

      const err = new TypeError("Cannot read properties of null (reading 'run')");
      const result = await sendErrorLog(err, "Uncaught Exception", mockClient);

      const payload = result.payload;
      assert.ok(payload);
      assert.equal(payload.flags, MessageFlags.IsComponentsV2); // 32768
      assert.equal(payload.embeds.length, 0); // Zero legacy embeds!

      assert.ok(Array.isArray(payload.components));
      assert.equal(payload.components.length, 1);
      const container = payload.components[0];
      assert.equal(container.type, 17); // Discord Container Component
      assert.equal(container.accent_color, designTokens.STATUS.dnd.int); // DND red for fatal crash

      // Verify clean header and footer (no custom emoji regex)
      const headerSection = container.components.find(
        (c) => c.content && c.content.includes("Naura Crash Reporter"),
      );
      assert.ok(headerSection, "Header section dengan author Naura Crash Reporter harus ada");
      assert.equal(/<a?:\w+:\d+>/.test(headerSection.content), false);

      const footerSection = container.components.find(
        (c) => c.content && c.content.includes("Naura Hoshino"),
      );
      assert.ok(footerSection, "Footer section harus ada");
      assert.equal(/<a?:\w+:\d+>/.test(footerSection.content), false);
    });

    it("should truncate long stack traces cleanly inside a js codeblock", () => {
      const fakeLongStack = "Error: Overflow\n" + "    at execute (/app/file.js:10:20)\n".repeat(80);
      const fakeErr = { message: "Overflow", stack: fakeLongStack };

      const formatted = formatTruncatedStack(fakeErr, 500);
      assert.ok(formatted.length <= 600);
      assert.ok(formatted.includes("// ... [cuplikan dipotong untuk kebersihan tampilan]"));
    });
  });

  describe("6. Multi-Developer DM Delivery", () => {
    it("should dispatch crash alert to all configured developer IDs in env.OWNER_IDS", async () => {
      const sentOwners = [];
      const mockUsers = {
        "111111111111111111": {
          id: "111111111111111111",
          send: async () => {
            sentOwners.push("111111111111111111");
          },
        },
        "222222222222222222": {
          id: "222222222222222222",
          send: async () => {
            sentOwners.push("222222222222222222");
          },
        },
      };

      const mockClient = {
        user: { tag: "Naura#0000" },
        users: {
          fetch: async (id) => mockUsers[id] || null,
        },
      };

      // Set two valid IDs and one invalid/non-numeric ID
      env.OWNER_IDS = ["111111111111111111", "222222222222222222", "invalid_id_ignored"];

      const err = new Error("Multi-owner alert verification");
      await sendErrorLog(err, "Test Multi Owner", mockClient);

      assert.equal(sentOwners.length, 2);
      assert.ok(sentOwners.includes("111111111111111111"));
      assert.ok(sentOwners.includes("222222222222222222"));
    });

    it("should handle owner DM failures gracefully without throwing", async () => {
      const mockClient = {
        user: { tag: "Naura#0000" },
        users: {
          fetch: async () => {
            return {
              id: "123456789012345678",
              send: async () => {
                throw new Error("DiscordAPIError[50007]: Cannot send messages to this user");
              },
            };
          },
        },
      };

      env.OWNER_IDS = ["123456789012345678"];

      const err = new Error("DM Closed Test");
      // sendErrorLog should not throw
      const res = await sendErrorLog(err, "Test DM Failure", mockClient);
      assert.equal(res.sent, true);
    });
  });

  describe("7. Discord Client Listeners Integration (setupErrorHandlers)", () => {
    it("should attach error, shardError, and shardDisconnect listeners to client", () => {
      const registeredListeners = {};
      const mockClient = {
        on: (event, handler) => {
          registeredListeners[event] = handler;
        },
      };

      setupErrorHandlers(mockClient);

      assert.equal(typeof registeredListeners["error"], "function");
      assert.equal(typeof registeredListeners["shardError"], "function");
      assert.equal(typeof registeredListeners["shardDisconnect"], "function");
    });

    it("should route client error event through sendErrorLog", async () => {
      let loggedError = null;
      let loggedType = null;

      const registeredListeners = {};
      const mockClient = {
        on: (event, handler) => {
          registeredListeners[event] = handler;
        },
      };

      setupErrorHandlers(mockClient);

      // Trigger client error
      const testErr = new Error("Simulated Discord Client Error");
      registeredListeners["error"](testErr);

      // Trigger shard error
      const shardErr = new Error("WebSocket shard error");
      registeredListeners["shardError"](shardErr, 0);

      // Trigger shard disconnect
      registeredListeners["shardDisconnect"]({ code: 1006, reason: "Abnormal Closure" }, 0);
    });
  });
});
