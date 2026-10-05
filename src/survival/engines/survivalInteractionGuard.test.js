"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const consumeSub = require("../../../plugin/survival/subcommands/consume");
const cacheManager = require("../../managers/cacheManager");

describe("Survival Subcommands Interaction Defer Guard", () => {
  it("otomatis memanggil deferUpdate saat menerima ButtonInteraction yang belum di-defer", async () => {
    let deferUpdateCalled = false;
    let editReplyCalled = false;

    // Mock cacheManager
    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([{ id: "apple", amount: 2 }]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: false,
        replied: false,
        user: {
          id: "test-user-123",
          displayName: "Tester",
          username: "tester",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferUpdate() {
          deferUpdateCalled = true;
          this.deferred = true;
        },
        async editReply(payload) {
          assert.strictEqual(this.deferred, true);
          editReplyCalled = true;
          return {
            createMessageComponentCollector: () => ({
              on: () => {},
            }),
          };
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferUpdateCalled, true);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });

  it("otomatis memanggil deferReply saat menerima ChatInputCommandInteraction yang belum di-defer", async () => {
    let deferReplyCalled = false;
    let editReplyCalled = false;

    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: false,
        replied: false,
        user: {
          id: "test-user-456",
          displayName: "Tester2",
          username: "tester2",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferReply() {
          deferReplyCalled = true;
          this.deferred = true;
        },
        async editReply(payload) {
          assert.strictEqual(this.deferred, true);
          editReplyCalled = true;
          return {};
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferReplyCalled, true);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });

  it("tidak memanggil defer ganda jika interaction sudah berstatus deferred", async () => {
    let deferCount = 0;
    let editReplyCalled = false;

    const originalGetUserProfile = cacheManager.getUserProfile;
    const originalGetUserSurvival = cacheManager.getUserSurvival;

    cacheManager.getUserProfile = async () => ({
      inventory: JSON.stringify([]),
    });
    cacheManager.getUserSurvival = async () => ({
      hunger: 50,
      thirst: 50,
      stamina: 50,
    });

    try {
      const mockInteraction = {
        deferred: true,
        replied: false,
        user: {
          id: "test-user-789",
          displayName: "Tester3",
          username: "tester3",
          displayAvatarURL: () => "https://example.com/avatar.png",
        },
        async deferUpdate() {
          deferCount++;
        },
        async deferReply() {
          deferCount++;
        },
        async editReply(payload) {
          editReplyCalled = true;
          return {};
        },
      };

      await consumeSub.execute(mockInteraction);

      assert.strictEqual(deferCount, 0);
      assert.strictEqual(editReplyCalled, true);
    } finally {
      cacheManager.getUserProfile = originalGetUserProfile;
      cacheManager.getUserSurvival = originalGetUserSurvival;
    }
  });
});

const { MessageFlags } = require("discord.js");
const {
  adaptSurvivalInteraction,
  stopMessageCollector,
  wrapMessageWithCollectorRegistry,
} = require("../helpers/survivalContext");

describe("adaptSurvivalInteraction Adapter Lifecycle & Collector Suppression", () => {
  it("mengalihkan reply ke editReply bila interaction sudah deferred pada ButtonInteraction", async () => {
    let editReplyPayload = null;
    const btnInteraction = {
      deferred: true,
      replied: false,
      message: { id: "msg-123" },
      isChatInputCommand: () => false,
      isButton: () => true,
      async reply() {
        throw new Error("reply must not be called directly on deferred button");
      },
      async editReply(p) {
        editReplyPayload = p;
        return { id: "msg-123", ...p };
      },
      async followUp() {},
    };

    const adapted = adaptSurvivalInteraction(btnInteraction, "inventory");
    await adapted.reply({ content: "halo dari ransel" });

    assert.ok(editReplyPayload, "editReply harus dipanggil");
    assert.strictEqual(editReplyPayload.content, "halo dari ransel");
    assert.strictEqual(adapted.options.getSubcommand(), "inventory");
  });

  it("mengalihkan ephemeral reply ke followUp tanpa menghapus pesan kartu utama", async () => {
    let followUpPayload = null;
    let deleteReplyCalled = false;

    const btnInteraction = {
      deferred: true,
      replied: false,
      message: { id: "msg-999" },
      isChatInputCommand: () => false,
      isButton: () => true,
      async reply() {},
      async editReply() {},
      async followUp(p) {
        followUpPayload = p;
        return { id: "ephem-1" };
      },
      async deleteReply() {
        deleteReplyCalled = true;
      },
    };

    const adapted = adaptSurvivalInteraction(btnInteraction, "info");
    await adapted.reply({ content: "hanya untukmu", flags: MessageFlags.Ephemeral });

    assert.ok(followUpPayload, "followUp harus dipanggil untuk ephemeral");
    assert.strictEqual(followUpPayload.content, "hanya untukmu");
    assert.strictEqual(deleteReplyCalled, false, "deleteReply dilarang dipanggil pada ButtonInteraction");
  });

  it("menyediakan mock options lengkap dengan getter aman untuk subcommand", () => {
    const rawInteraction = {
      deferred: false,
      replied: false,
      user: { id: "u-1" },
    };

    const adapted = adaptSurvivalInteraction(rawInteraction, "fish");
    assert.strictEqual(adapted.options.getSubcommand(), "fish");
    assert.strictEqual(adapted.options.getString("aksi"), "cast");
    assert.strictEqual(adapted.options.getInteger("unknown_int"), null);
    assert.strictEqual(adapted.options.getBoolean("unknown_bool"), false);
  });

  it("menekan eksekusi collector end listener jika reason bernilai 'navigated'", () => {
    let endListenerCalled = false;
    let collectorStopped = false;

    const fakeCollector = {
      listeners: {},
      on(event, fn) {
        this.listeners[event] = fn;
        return this;
      },
      stop(reason) {
        collectorStopped = true;
        if (this.listeners.end) {
          this.listeners.end([], reason);
        }
      },
    };

    const fakeMsg = {
      id: "msg-test-col",
      createMessageComponentCollector() {
        return fakeCollector;
      },
    };

    const wrappedMsg = wrapMessageWithCollectorRegistry(fakeMsg);
    const collector = wrappedMsg.createMessageComponentCollector({});

    collector.on("end", () => {
      endListenerCalled = true;
    });

    stopMessageCollector("msg-test-col", "navigated");

    assert.strictEqual(collectorStopped, true);
    assert.strictEqual(endListenerCalled, false, "end listener tidak boleh dipanggil jika reason adalah 'navigated'");
  });
});
