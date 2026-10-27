"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");

const { CommandRegistry } = require("./commandRegistry");
const commandRegistry = require("./commandRegistry");
const { buildHelpPayload } = require("../core/helpView");
const { getCurrentState } = require("../interactions/buttons/coreHelp");

test("CommandAutoRegister - autoScanPluginDirectory dynamically discovers repository plugins", () => {
  const registry = new CommandRegistry();
  const pluginDir = path.resolve(__dirname, "../../plugin/core");

  registry.autoScanPluginDirectory(pluginDir);

  assert.ok(registry.getTotalCommandCount() > 0, "Harus menemukan setidaknya 1 command");
  assert.ok(registry.commands.has("core"), "Harus menemukan command core");

  const coreCmd = registry.commands.get("core");
  assert.ok(coreCmd);
  assert.equal(coreCmd.category, "core");
  assert.ok(Array.isArray(coreCmd.subcommands));
  assert.ok(coreCmd.subcommands.length >= 5, "Command core harus memiliki banyak subcommand");

  const subNames = coreCmd.subcommands.map((s) => s.name);
  assert.ok(subNames.includes("ping"));
  assert.ok(subNames.includes("help"));
  assert.ok(subNames.includes("stats"));
});

test("CommandAutoRegister - getCommandDetail introspects parameters and choices dynamically", () => {
  const registry = new CommandRegistry();
  const pluginDir = path.resolve(__dirname, "../../plugin/core");
  registry.autoScanPluginDirectory(pluginDir);

  const langDetail = registry.getCommandDetail("core language");
  assert.ok(langDetail, "Harus dapat menemukan subcommand core language");
  assert.equal(langDetail.type, "subcommand");
  assert.equal(langDetail.subcommand, "language");
  assert.ok(langDetail.options.length > 0, "core language harus memiliki opsi lang");
  assert.equal(langDetail.options[0].name, "lang");
  assert.ok(langDetail.options[0].required, "Opsi lang wajib diisi");

  const helpDetail = registry.getCommandDetail("core help");
  assert.ok(helpDetail);
  assert.equal(helpDetail.subcommand, "help");
});

test("CommandAutoRegister - dynamic categories are added to getCategoryKeys and getCategories", () => {
  const registry = new CommandRegistry();
  const mockClient = {
    commands: new Map([
      [
        "custom_rpg",
        {
          name: "custom_rpg",
          category: "custom_realm",
          description: "Petualangan kustom",
          data: {
            name: "custom_rpg",
            description: "Petualangan kustom",
            options: [],
          },
        },
      ],
    ]),
  };

  registry.buildRegistry(mockClient);

  const keys = registry.getCategoryKeys();
  assert.ok(keys.includes("custom_realm"), "Kategori dinamis baru harus tercatat di keys");

  const catData = registry.getCategory("custom_realm");
  assert.ok(catData);
  assert.equal(catData.count, 1);
  assert.equal(catData.commands[0].name, "custom_rpg");
});

test("CommandAutoRegister - buildHelpPayload renders dynamic command lists for categories", () => {
  const mockCommands = new Map();

  for (let i = 1; i <= 12; i++) {
    mockCommands.set(`music_cmd_${i}`, {
      name: `music_cmd_${i}`,
      category: "music",
      description: `Perintah musik ${i}`,
      data: {
        name: `music_cmd_${i}`,
        description: `Perintah musik ${i}`,
        options: [
          { type: 1, name: "play", description: "Putar lagu", options: [] },
        ],
      },
    });
  }

  commandRegistry.buildRegistry({ commands: mockCommands });

  // Panggil buildHelpPayload untuk music
  const helpMusicPage1 = buildHelpPayload({
    language: "id",
    categoryIndex: 1,
    disabled: false,
    user: { username: "Tester" },
    subPage: 0,
  });
  assert.ok(helpMusicPage1);
  assert.ok(helpMusicPage1.flags);
  assert.equal(helpMusicPage1._subPage, 0);
  assert.equal(helpMusicPage1._totalSubPages, 2);

  // Periksa bahwa komponen kontainer memuat daftar perintah dinamis
  const rootComp = helpMusicPage1.components[0];
  assert.ok(rootComp);
  assert.ok(rootComp.components.some((c) => c.content && c.content.includes("music_cmd_")));

  // Halaman 2
  const helpMusicPage2 = buildHelpPayload({
    language: "id",
    categoryIndex: 1,
    disabled: false,
    user: { username: "Tester" },
    subPage: 1,
  });
  assert.equal(helpMusicPage2._subPage, 1);
});

test("CommandAutoRegister - getCurrentState in coreHelp handles dynamic subpaged categories", () => {
  const mockInteraction = {
    message: {
      components: [
        {
          components: [
            {
              custom_id: "help_page_indicator",
              label: "📄 2/3 (music)",
            },
          ],
        },
      ],
    },
  };

  const state = getCurrentState(mockInteraction);
  assert.equal(state.currentIndex, 1, "music adalah indeks ke-1 di HELP_CATEGORY_KEYS");
  assert.equal(state.currentSubPage, 1, "Halaman ke-2 adalah 0-indexed 1");
  assert.equal(state.isSubPaged, true);
  assert.equal(state.totalSubPages, 3);
});

test("CommandAutoRegister - buildHelpPayload handles dynamic non-standard categories smoothly", () => {
  const mockCommands = new Map([
    [
      "custom_quest",
      {
        name: "custom_quest",
        category: "custom_realm",
        description: "Petualangan kustom di realm baru",
        data: {
          name: "custom_quest",
          description: "Petualangan kustom di realm baru",
          options: [
            { type: 1, name: "start", description: "Mulai petualangan", options: [] },
            { type: 1, name: "abandon", description: "Batalkan petualangan", options: [] },
          ],
        },
      },
    ],
  ]);

  commandRegistry.buildRegistry({ commands: mockCommands });

  const categoryKeys = commandRegistry.getCategoryKeys();
  assert.ok(categoryKeys.includes("custom_realm"), "custom_realm harus terdaftar di categoryKeys");

  // Overview payload must not crash and include custom_realm in selectOptions
  const overviewPayload = buildHelpPayload({
    language: "id",
    categoryIndex: -1,
    disabled: false,
    user: { username: "Tester" },
  });
  assert.ok(overviewPayload);
  assert.ok(overviewPayload.flags);

  const containerComps = overviewPayload.components[0].components;
  const selectRow = containerComps.find((c) => c.components && c.components[0]?.custom_id === "help_category_select");
  assert.ok(selectRow, "Harus menyertakan select row kategori");
  const options = selectRow.components[0].options;
  const hasCustomRealm = options.some((opt) => opt.value === "custom_realm");
  assert.ok(hasCustomRealm, "Dropdown select menu harus memiliki opsi custom_realm");

  // Category page for custom_realm
  const customIndex = categoryKeys.indexOf("custom_realm");
  assert.ok(customIndex >= 0);
  const customPayload = buildHelpPayload({
    language: "id",
    categoryIndex: customIndex,
    disabled: false,
    user: { username: "Tester" },
  });
  assert.ok(customPayload);
  const customComps = customPayload.components[0].components;
  const hasQuestCommand = customComps.some((c) => c.content && c.content.includes("custom_quest"));
  assert.ok(hasQuestCommand, "Halaman kategori dinamis harus menampilkan perintah custom_quest");
});

test("CommandAutoRegister - select menu and button navigation support dynamic categories", async () => {
  const [helpCategorySelectHandler] = require("../interactions/selects/coreHelp");
  const coreHelpButtons = require("../interactions/buttons/coreHelp");
  const helpLastHandler = coreHelpButtons.find((b) => b.id === "help_last");

  const categoryKeys = commandRegistry.getCategoryKeys();
  const customIndex = categoryKeys.indexOf("custom_realm");
  assert.ok(customIndex >= 0, "custom_realm harus ada di categoryKeys");

  // Test help_category_select with custom_realm
  let updatedPayload = null;
  const mockSelectInteraction = {
    values: ["custom_realm"],
    user: { id: "123", username: "Tester" },
    localeLang: "id",
    async update(payload) {
      updatedPayload = payload;
      return payload;
    },
  };

  await helpCategorySelectHandler.handler(mockSelectInteraction);
  assert.ok(updatedPayload, "Handler select harus menghasilkan payload");
  const customComps = updatedPayload.components[0].components;
  assert.ok(
    customComps.some((c) => c.content && c.content.includes("custom_quest")),
    "Select handler harus merender perintah di kategori custom_realm",
  );

  // Test help_last button jumps to the dynamic category
  let lastPayload = null;
  const mockLastInteraction = {
    user: { id: "123", username: "Tester" },
    localeLang: "id",
    async update(payload) {
      lastPayload = payload;
      return payload;
    },
  };

  await helpLastHandler.handler(mockLastInteraction);
  assert.ok(lastPayload, "help_last harus mengembalikan payload");
  const lastComps = lastPayload.components[0].components;
  assert.ok(
    lastComps.some((c) => c.content && c.content.includes("custom_quest")),
    "help_last harus melompat ke kategori terakhir yaitu custom_realm",
  );
});
