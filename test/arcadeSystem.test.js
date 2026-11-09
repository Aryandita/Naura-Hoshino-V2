"use strict";

const { test, describe, beforeEach } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const arcade = require("../plugin/arcade/arcade");

describe("Naura Arcade System & Migration Verification", () => {
  let mockUser;
  let mockInteraction;

  beforeEach(() => {
    mockUser = {
      id: "795241173009825853",
      username: "Ryaa_",
      displayName: "Ryaa_",
      displayAvatarURL: () => "https://cdn.discordapp.com/avatars/795241173009825853/avatar.png",
    };

    mockInteraction = {
      user: mockUser,
      guildId: "1453217350257082370",
      deferred: false,
      replied: false,
      replyPayload: null,
      editReplyPayload: null,
      options: {
        _subcommand: "hub",
        _stringOptions: {},
        getSubcommand() {
          return this._subcommand;
        },
        getString(name) {
          return this._stringOptions[name] || null;
        },
        getInteger(name) {
          return null;
        },
      },
      async deferReply() {
        this.deferred = true;
        return true;
      },
      async reply(payload) {
        if (this.deferred && !this.replied) {
          return this.editReply(payload);
        }
        this.replied = true;
        this.replyPayload = payload;
        return payload;
      },
      async editReply(payload) {
        if (!this.deferred && !this.replied) {
          throw new Error("DiscordjsError [InteractionNotReplied]: The reply to this interaction has not been sent or deferred.");
        }
        this.editReplyPayload = payload;
        return payload;
      },
    };
  });

  test("execute('hub') executes without InteractionNotReplied error", async () => {
    mockInteraction.options._subcommand = "hub";
    assert.strictEqual(mockInteraction.deferred, false);
    assert.strictEqual(mockInteraction.replied, false);

    await arcade.execute(mockInteraction);

    assert.strictEqual(mockInteraction.deferred, true, "Interaction must be deferred");
    assert.ok(mockInteraction.editReplyPayload, "Hub payload must be rendered via editReply");
    assert.ok(mockInteraction.editReplyPayload.components, "Hub must provide components/select menu");
  });

  test("execute('daily') executes without InteractionNotReplied error", async () => {
    mockInteraction.options._subcommand = "daily";
    assert.strictEqual(mockInteraction.deferred, false);
    assert.strictEqual(mockInteraction.replied, false);

    await arcade.execute(mockInteraction);

    assert.strictEqual(mockInteraction.deferred, true, "Interaction must be deferred");
    assert.ok(mockInteraction.editReplyPayload, "Daily claim must be rendered via editReply");
  });

  test("execute('profile') executes without InteractionNotReplied error", async () => {
    mockInteraction.options._subcommand = "profile";
    assert.strictEqual(mockInteraction.deferred, false);

    await arcade.execute(mockInteraction);

    assert.strictEqual(mockInteraction.deferred, true, "Interaction must be deferred");
    assert.ok(mockInteraction.editReplyPayload, "Profile must be rendered via editReply");
  });

  test("execute('leaderboard') executes without InteractionNotReplied error", async () => {
    mockInteraction.options._subcommand = "leaderboard";
    mockInteraction.options._stringOptions = { scope: "global" };
    assert.strictEqual(mockInteraction.deferred, false);

    await arcade.execute(mockInteraction);

    assert.strictEqual(mockInteraction.deferred, true, "Interaction must be deferred");
    assert.ok(mockInteraction.editReplyPayload, "Leaderboard must be rendered via editReply");
  });

  test("showHub works on an undeferred component interaction (respond fallback)", async () => {
    const componentInteraction = {
      ...mockInteraction,
      deferred: false,
      replied: false,
      replyPayload: null,
      async reply(p) {
        this.replied = true;
        this.replyPayload = p;
        return p;
      },
    };

    await arcade.showHub(componentInteraction, mockUser, "id");
    assert.ok(componentInteraction.replyPayload, "Should successfully reply when not deferred");
  });

  test("All arcade subcommands exist and export execute function", () => {
    const games = Object.keys(arcade.ALL_GAMES);
    assert.ok(games.length >= 15, "Should have at least 15 registered games");

    for (const gameKey of games) {
      const subPath = path.join(__dirname, "..", "plugin", "arcade", "subcommands", `${gameKey}.js`);
      let mod;
      assert.doesNotThrow(() => {
        mod = require(subPath);
      }, `Subcommand '${gameKey}' should be loadable without errors`);
      assert.strictEqual(typeof mod.execute, "function", `Subcommand '${gameKey}' must have execute function`);
    }
  });

  test("Arcade buttons and selects are registered in interaction modules", () => {
    const buttonList = require("../src/interactions/buttons/arcade");
    const buttonIds = buttonList.map((b) => b.id || b.prefix);

    assert.ok(buttonIds.includes("arcade_daily"), "Must register arcade_daily button");
    assert.ok(buttonIds.includes("arcade_hub"), "Must register arcade_hub button");
    assert.ok(buttonIds.includes("arcade_profile"), "Must register arcade_profile button");
    assert.ok(buttonIds.includes("arcade_leaderboard"), "Must register arcade_leaderboard button");

    const selectList = require("../src/interactions/selects/arcadeSelect");
    const selectIds = selectList.map((s) => s.id);
    assert.ok(selectIds.includes("arcade_select_game"), "Must register arcade_select_game select");
  });

  test("CommandRegistry includes arcade in public categories and maps aliases", () => {
    const commandRegistry = require("../src/services/commandRegistry");
    const publicCats = commandRegistry.PUBLIC_CATEGORIES;
    assert.ok(publicCats.includes("arcade"), "arcade must be a public category");
    assert.ok(!publicCats.includes("minigames"), "minigames should be replaced by arcade");

    assert.strictEqual(commandRegistry.normalizeCategory("minigame"), "arcade");
    assert.strictEqual(commandRegistry.normalizeCategory("minigames"), "arcade");
    assert.strictEqual(commandRegistry.normalizeCategory("arcade"), "arcade");
  });
});

