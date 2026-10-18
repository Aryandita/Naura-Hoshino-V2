"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  CommandRegistry,
  PUBLIC_CATEGORIES,
  CATEGORY_METADATA,
} = require("./commandRegistry");

function createMockClient() {
  const commands = new Map();
  const aliases = new Map();

  commands.set("ping", {
    name: "ping",
    category: "core",
    description: "Cek latensi sistem bot",
    data: {
      name: "ping",
      description: "Cek latensi sistem bot",
      options: [],
    },
    aliases: ["p"],
  });

  commands.set("music", {
    name: "music",
    category: "music",
    description: "Sistem audio Naura",
    data: {
      name: "music",
      description: "Sistem audio Naura",
      options: [
        {
          type: 1, // Subcommand
          name: "play",
          description: "Putar lagu dari YouTube atau Spotify",
          options: [
            {
              name: "query",
              description: "Judul lagu atau URL link",
              required: true,
              type: 3,
            },
          ],
        },
        {
          type: 1, // Subcommand
          name: "pause",
          description: "Jeda musik",
          options: [],
        },
      ],
    },
    aliases: ["m"],
  });

  commands.set("secret_admin", {
    name: "secret_admin",
    category: "owner",
    description: "Perintah rahasia owner",
    data: {
      name: "secret_admin",
      description: "Perintah rahasia owner",
      options: [],
    },
  });

  aliases.set("p", "ping");
  aliases.set("m", "music");

  return { commands, aliases };
}

test("CommandRegistry - Public categories contain 13 categories", () => {
  assert.equal(PUBLIC_CATEGORIES.length, 13);
  assert.ok(PUBLIC_CATEGORIES.includes("core"));
  assert.ok(PUBLIC_CATEGORIES.includes("music"));
  assert.ok(PUBLIC_CATEGORIES.includes("survival"));
  assert.ok(PUBLIC_CATEGORIES.includes("fun"));
  assert.ok(PUBLIC_CATEGORIES.includes("utility"));
  assert.ok(!PUBLIC_CATEGORIES.includes("owner"));
  assert.ok(CATEGORY_METADATA.core);
});

test("CommandRegistry - buildRegistry parses commands and hides owner category", () => {
  const registry = new CommandRegistry();
  const client = createMockClient();

  registry.buildRegistry(client);

  assert.equal(registry.getTotalCommandCount(), 2);
  assert.ok(registry.commands.has("ping"));
  assert.ok(registry.commands.has("music"));
  assert.ok(!registry.commands.has("secret_admin"));
});

test("CommandRegistry - getCategories returns all 13 categories with counts", () => {
  const registry = new CommandRegistry();
  const client = createMockClient();
  registry.buildRegistry(client);

  const categories = registry.getCategories();
  assert.equal(categories.length, 13);

  const coreCat = categories.find((c) => c.id === "core");
  assert.ok(coreCat);
  assert.equal(coreCat.count, 1);
  assert.equal(coreCat.commands[0].name, "ping");

  const musicCat = categories.find((c) => c.id === "music");
  assert.ok(musicCat);
  assert.equal(musicCat.count, 1);
  assert.equal(musicCat.commands[0].subcommands.length, 2);
});

test("CommandRegistry - getCommandDetail handles root commands, subcommands, and aliases", () => {
  const registry = new CommandRegistry();
  const client = createMockClient();
  registry.buildRegistry(client);

  // 1. Root command
  const pingDetail = registry.getCommandDetail("ping");
  assert.ok(pingDetail);
  assert.equal(pingDetail.type, "command");
  assert.equal(pingDetail.name, "ping");
  assert.equal(pingDetail.syntax, "/ping");

  // 2. Alias lookup
  const aliasDetail = registry.getCommandDetail("/p");
  assert.ok(aliasDetail);
  assert.equal(aliasDetail.name, "ping");

  // 3. Subcommand lookup via 'music play'
  const musicPlayDetail = registry.getCommandDetail("music play");
  assert.ok(musicPlayDetail);
  assert.equal(musicPlayDetail.type, "subcommand");
  assert.equal(musicPlayDetail.root, "music");
  assert.equal(musicPlayDetail.subcommand, "play");
  assert.equal(musicPlayDetail.syntax, "/music play <query>");
  assert.equal(musicPlayDetail.options.length, 1);
  assert.equal(musicPlayDetail.options[0].name, "query");

  // 4. Standalone subcommand lookup via 'play'
  const playStandalone = registry.getCommandDetail("play");
  assert.ok(playStandalone);
  assert.equal(playStandalone.root, "music");
  assert.equal(playStandalone.subcommand, "play");

  // 5. Unknown command returns null
  assert.equal(registry.getCommandDetail("unknown_cmd"), null);
  assert.equal(registry.getCommandDetail(""), null);
  assert.equal(registry.getCommandDetail(null), null);
});

test("CommandRegistry - buildRegistry parses real SlashCommandBuilder instances with groups", () => {
  const { SlashCommandBuilder } = require("discord.js");
  const registry = new CommandRegistry();

  const cardCmd = new SlashCommandBuilder()
    .setName("card")
    .setDescription("Koleksi kartu")
    .addSubcommandGroup((group) =>
      group
        .setName("deck")
        .setDescription("Kelola deck")
        .addSubcommand((sub) =>
          sub
            .setName("add")
            .setDescription("Tambah kartu ke deck")
            .addStringOption((o) =>
              o.setName("card_id").setDescription("ID kartu").setRequired(true),
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription("Lihat album"),
    );

  const client = {
    commands: new Map([
      ["card", { data: cardCmd, category: "card" }],
    ]),
  };

  registry.buildRegistry(client);

  const cardDetail = registry.getCommandDetail("card");
  assert.ok(cardDetail);
  assert.equal(cardDetail.subcommands.length, 2);

  const fullSub = registry.getCommandDetail("card deck add");
  assert.ok(fullSub);
  assert.equal(fullSub.type, "subcommand");
  assert.equal(fullSub.group, "deck");
  assert.equal(fullSub.subcommand, "add");
  assert.equal(fullSub.syntax, "/card deck add <card_id>");

  const groupLookup = registry.getCommandDetail("card deck");
  assert.ok(groupLookup);
  assert.equal(groupLookup.type, "group");
  assert.equal(groupLookup.subcommands.length, 1);
});
