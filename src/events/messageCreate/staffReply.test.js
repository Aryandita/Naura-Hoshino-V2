"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const handleStaffReply = require("./staffReply");
const ModMail = require("../../models/ModMail");

test("handleStaffReply - returns false if channel is not a modmail thread", async () => {
  const origFindOne = ModMail.findOne;
  ModMail.findOne = async () => null;

  try {
    const fakeMessage = { channel: { id: "chan_123" } };
    const res = await handleStaffReply(fakeMessage, {});
    assert.equal(res, false);
  } finally {
    ModMail.findOne = origFindOne;
  }
});

test("handleStaffReply - replies with localized error container when userId is invalid snowflake (ID)", async () => {
  const origFindOne = ModMail.findOne;
  ModMail.findOne = async () => ({
    channelId: "chan_123",
    closed: false,
    userId: "not_a_snowflake_user",
  });

  let repliedPayload = null;
  const fakeMessage = {
    channel: { id: "chan_123" },
    author: { id: "staff_123" },
    content: "Halo kak",
    localeLang: "id",
    reply: async (payload) => {
      repliedPayload = payload;
      return true;
    },
  };

  try {
    const res = await handleStaffReply(fakeMessage, {});
    assert.equal(res, true);
    assert.ok(repliedPayload);
    assert.ok(repliedPayload.components);
    const serialized = JSON.stringify(repliedPayload);
    // Verifikasi pesan bahasa Indonesia
    assert.match(serialized, /ID Pengguna Tidak Valid/);
    assert.match(serialized, /Tiket ini tidak memiliki ID pengguna Discord yang valid/);
  } finally {
    ModMail.findOne = origFindOne;
  }
});

test("handleStaffReply - replies with localized error container when userId is invalid snowflake (EN)", async () => {
  const origFindOne = ModMail.findOne;
  ModMail.findOne = async () => ({
    channelId: "chan_123",
    closed: false,
    userId: "invalid_id_en",
  });

  let repliedPayload = null;
  const fakeMessage = {
    channel: { id: "chan_123" },
    author: { id: "staff_123" },
    content: "Hello",
    localeLang: "en",
    reply: async (payload) => {
      repliedPayload = payload;
      return true;
    },
  };

  try {
    const res = await handleStaffReply(fakeMessage, {});
    assert.equal(res, true);
    assert.ok(repliedPayload);
    assert.ok(repliedPayload.components);
    const serialized = JSON.stringify(repliedPayload);
    // Verifikasi pesan bahasa Inggris
    assert.match(serialized, /Invalid User ID/);
    assert.match(serialized, /This ticket does not have a valid Discord user ID/);
  } finally {
    ModMail.findOne = origFindOne;
  }
});
