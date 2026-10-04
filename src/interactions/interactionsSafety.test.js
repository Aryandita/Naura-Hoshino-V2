"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { resolve } = require("./registry");
const { wrapInteractionSafe } = require("../events/interactionCreate");

describe("Interactions Registry & Safety Guards", () => {
  it("seluruh tombol dan modal baru terdaftar di registry", () => {
    const roleBtn = resolve("buttons", "role_assign_12345");
    assert.ok(roleBtn, "role_assign_ harus terdaftar");
    assert.strictEqual(roleBtn.label, "reaction-role-toggle");

    const friendBtn = resolve("buttons", "gchat_add_998877");
    assert.ok(friendBtn, "gchat_add_ harus terdaftar");
    assert.strictEqual(friendBtn.label, "global-chat-add-friend");

    const pvpAccBtn = resolve("buttons", "pvp_accept_111_222");
    assert.ok(pvpAccBtn, "pvp_accept_ harus terdaftar");
    assert.strictEqual(pvpAccBtn.label, "pvp-duel-accept");

    const pvpDecBtn = resolve("buttons", "pvp_decline_111_222");
    assert.ok(pvpDecBtn, "pvp_decline_ harus terdaftar");
    assert.strictEqual(pvpDecBtn.label, "pvp-duel-decline");

    const predBtn = resolve("buttons", "pred_bet_mkt01_1");
    assert.ok(predBtn, "pred_bet_ harus terdaftar");
    assert.strictEqual(predBtn.label, "predict-bet-button");

    const predModal = resolve("modals", "pred_modal_bet_mkt01_1");
    assert.ok(predModal, "pred_modal_bet_ harus terdaftar");
    assert.strictEqual(predModal.label, "predict-bet-modal-submit");

    const reportModal = resolve("modals", "report_msg_888999");
    assert.ok(reportModal, "report_msg_ harus terdaftar");
    assert.strictEqual(reportModal.label, "report-message-modal-submit");
  });

  it("wrapInteractionSafe mengalihkan reply ke editReply bila interaction sudah deferred", async () => {
    let editReplyCalled = false;
    let editPayload = null;

    const mockInteraction = {
      deferred: true,
      replied: false,
      async reply(payload) {
        throw new Error("reply called directly!");
      },
      async editReply(payload) {
        editReplyCalled = true;
        editPayload = payload;
        return payload;
      },
      async followUp() {},
      async update() {},
    };

    wrapInteractionSafe(mockInteraction);

    await mockInteraction.reply({ content: "halo aman" });

    assert.strictEqual(editReplyCalled, true);
    assert.strictEqual(editPayload.content, "halo aman");
  });

  it("wrapInteractionSafe mengalihkan reply ke followUp bila interaction sudah replied", async () => {
    let followUpCalled = false;
    let followUpPayload = null;

    const mockInteraction = {
      deferred: true,
      replied: true,
      async reply() {
        throw new Error("reply called directly!");
      },
      async editReply() {},
      async followUp(payload) {
        followUpCalled = true;
        followUpPayload = payload;
        return payload;
      },
      async update() {},
    };

    wrapInteractionSafe(mockInteraction);

    await mockInteraction.reply({ content: "pesan kedua" });

    assert.strictEqual(followUpCalled, true);
    assert.strictEqual(followUpPayload.content, "pesan kedua");
  });

  it("wrapInteractionSafe mengalihkan update ke editReply bila interaction sudah deferred", async () => {
    let editReplyCalled = false;
    let editPayload = null;

    const mockInteraction = {
      deferred: true,
      replied: false,
      async reply() {},
      async editReply(payload) {
        editReplyCalled = true;
        editPayload = payload;
        return payload;
      },
      async followUp() {},
      async update() {
        throw new Error("update called directly when deferred!");
      },
    };

    wrapInteractionSafe(mockInteraction);

    await mockInteraction.update({ content: "update aman" });

    assert.strictEqual(editReplyCalled, true);
    assert.strictEqual(editPayload.content, "update aman");
  });
});
