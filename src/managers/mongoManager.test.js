"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const mongoManager = require("./mongoManager");
const TicketTranscript = require("../models/mongo/TicketTranscript");
const AiChatHistory = require("../models/mongo/AiChatHistory");
const CommandAuditLog = require("../models/mongo/CommandAuditLog");

test("MongoManager - Instance & Model Registration", () => {
  assert.ok(mongoManager, "MongoManager harus terdefinisi");
  assert.ok(mongoManager.models, "models object harus ada");
  assert.equal(mongoManager.models.TicketTranscript, TicketTranscript);
  assert.equal(mongoManager.models.AiChatHistory, AiChatHistory);
  assert.equal(mongoManager.models.CommandAuditLog, CommandAuditLog);
});

test("MongoManager - getStatus format", () => {
  const status = mongoManager.getStatus();
  assert.ok(status, "getStatus harus mengembalikan objek");
  assert.ok(typeof status.state === "string");
  assert.ok(typeof status.readyState === "number");
  assert.ok(Array.isArray(status.models));
  assert.ok(status.models.includes("TicketTranscript"));
  assert.ok(status.models.includes("AiChatHistory"));
  assert.ok(status.models.includes("CommandAuditLog"));
});

test("MongoManager - Safe fallback when not connected", async () => {
  // Bila offline, helper harus mengembalikan fallback tanpa melempar error
  if (!mongoManager.isReady) {
    const transcript = await mongoManager.getTicketTranscript("non-existent");
    assert.equal(transcript, null);

    const history = await mongoManager.getAiHistory("user1", "chan1");
    assert.deepEqual(history, []);

    const logs = await mongoManager.getCommandAuditLogs({});
    assert.deepEqual(logs, []);

    const clearRes = await mongoManager.clearAiHistory("user1", "chan1");
    assert.equal(clearRes, false);
  }
});

test("Mongo Models - Schema Validation", () => {
  const sampleTranscript = new TicketTranscript({
    ticketId: "ticket-123",
    channelId: "channel-123",
    guildId: "guild-123",
    userId: "user-123",
    creatorId: "user-123",
  });
  assert.equal(sampleTranscript.ticketId, "ticket-123");
  assert.equal(sampleTranscript.category, "support");

  const sampleAiHistory = new AiChatHistory({
    userId: "user-123",
    channelId: "chan-123",
    role: "user",
    content: "Halo Naura",
  });
  assert.equal(sampleAiHistory.role, "user");
  assert.equal(sampleAiHistory.content, "Halo Naura");

  const sampleAudit = new CommandAuditLog({
    commandName: "ping",
    userId: "user-123",
    status: "SUCCESS",
  });
  assert.equal(sampleAudit.commandName, "ping");
  assert.equal(sampleAudit.status, "SUCCESS");
});
