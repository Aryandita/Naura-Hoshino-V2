"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
  countStack,
  addItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const questGen = require("../../../src/survival/engines/questGenerator");
const achievementHelper = require("../../../src/survival/helpers/achievementHelper");

const STAMINA_COST = 20;
const REACTION_MS = 3500;
const DIAMOND_TARGET = 100;

// Beliung dari yang paling sakti. `bonus` menaikkan peluang bijih bagus.
const PICKAXES = [
  { id: "obsidian_pickaxe", bonus: 20 },
  { id: "titanium_pickaxe", bonus: 14 },
  { id: "steel_pickaxe", bonus: 8 },
  { id: "iron_pickaxe", bonus: 6 },
  { id: "stone_pickaxe", bonus: 3 },
  { id: "wooden_pickaxe", bonus: 0 },
  { id: "basic_shovel", bonus: 0 },
];

const STONES = [
  { id: "red", emoji: "\uD83D\uDD34", label: "Batu Merah" },
  { id: "blue", emoji: "\uD83D\uDD35", label: "Batu Biru" },
  { id: "green", emoji: "\uD83D\uDFE2", label: "Batu Hijau" },
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

// Tabel hasil tambang. Diamond sekarang benar-benar bisa keluar, supaya
// pencapaian Kurcaci Penambang tidak lagi mustahil diraih.
function rollOre(bonus) {
  const rand = Math.random() * 100 + bonus;

  if (rand > 98)
    return {
      id: "diamond",
      name: "Diamond",
      emoji: e("gem", "\uD83D\uDC8E"),
      amount: 1,
      mood: "reward",
    };
  if (rand > 94)
    return {
      id: "mythril_ore",
      name: "Bijih Mythril",
      emoji: e("impressed", "\u2728"),
      amount: 1,
      mood: "reward",
    };
  if (rand > 80)
    return {
      id: "silver_ore",
      name: "Bijih Perak",
      emoji: e("coin", "\uD83E\uDE99"),
      amount: 1,
      mood: "success",
    };
  if (rand > 50)
    return {
      id: "iron_ore",
      name: "Bijih Besi",
      emoji: e("iron", "\u26D3\uFE0F"),
      amount: 1,
      mood: "success",
    };

  return {
    id: "stone",
    name: "Batu",
    emoji: e("stone", "\uD83E\uDEA8"),
    amount: Math.floor(Math.random() * 2) + 2,
    mood: "success",
  };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);

    const inventory = safeParseInventory(profile.inventory);
    const pickaxe = PICKAXES.find((p) =>
      inventory.some((it) => it && it.id === p.id),
    );

    if (!pickaxe) return ui.sendError(interaction, "err_sys_53", true);

    // Sama seperti chop: pemeriksaan dan pemotongan stamina jadi satu langkah
    // di database, supaya tidak ada dua tambang berjalan dari tenaga yang sama.
    const paid = await cacheManager.debitUserSurvival(
      user.id,
      "stamina",
      STAMINA_COST,
    );
    if (!paid.ok) return ui.sendError(interaction, "err_sys_54", true);

    const target = STONES[Math.floor(Math.random() * STONES.length)];

    const minePayload = buildContainerV2({
      accentColorHex: "#f59e0b",
      authorName: "Naura Ancient Cave",
      title: `${e("thinking", "\u26CF\uFE0F")} Menambang di Gua Kuno`,
      iconURL: user.displayAvatarURL(),
      expression: "info",
      description: [
        "Ada kilau aneh dari bebatuan di depanmu. Naura ikut menahan napas...",
        "",
        `Cepat pukul **${target.label}** sebelum cahayanya hilang!`,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const row = new ActionRowBuilder();
    for (const stone of STONES) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`mine_${stone.id}`)
          .setEmoji(stone.emoji)
          .setStyle(ButtonStyle.Secondary),
      );
    }

    // Orkestrator survival sudah memanggil deferReply, jadi harus editReply.
    const message = await interaction.editReply({
      ...minePayload,
      embeds: [],
      components: [...minePayload.components, row],
    });

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: REACTION_MS,
    });

    let answered = false;

    collector.on("collect", async (i) => {
      answered = true;
      collector.stop("answered");
      await i.deferUpdate().catch(() => {});

      const chosen = i.customId.replace("mine_", "");

      if (chosen !== target.id) {
        const failPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#FFB347",
          authorName: "Naura Ancient Cave",
          title: `${e("akward", "\uD83D\uDCA5")} Salah batu`,
          iconURL: user.displayAvatarURL(),
          expression: "fail",
          description:
            "Aduh, batu yang itu kosong dan beliungmu memantul keras. Tangannya nggak sakit, kan? Coba lagi ya, Naura yakin kamu bisa!",
          footerText: ui.getFooter("survival"),
        });

        await interaction
          .editReply({ ...failPayload, embeds: [] })
          .catch(() => {});
        return;
      }

      const ore = rollOre(pickaxe.bonus);

      // === SEASONAL EVENT BOOST ===
      const {
        getCurrentSeason,
        checkNauraBirthdayEncounter,
      } = require("../../../src/survival/helpers/survivalContext");
      const season = getCurrentSeason();
      const seasonDrops = [];
      if (season) {
        ore.amount = Math.max(1, Math.floor(ore.amount * season.dropBoost));
        if (season.exclusiveItem && Math.random() < 0.25) {
          seasonDrops.push({
            id: season.exclusiveItem,
            name: "Event Item",
            amount: 1,
            type: "material",
          });
        }
      }

      // Tidak perlu lagi membaca profil segar lalu menulis ulang seluruh tas.
      // Transaksi terkunci di dalam helper yang mengerjakan keduanya sekaligus.
      const itemsToStore = [
        { id: ore.id, name: ore.name, amount: ore.amount, type: "material" },
        ...seasonDrops,
      ];
      const stored = await addItemsAtomic(user.id, itemsToStore);

      if (!stored.ok) {
        const writeFailPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#FFB347",
          authorName: "Naura Ancient Cave",
          title: `${e("akward", "\uD83D\uDCA5")} Hasilnya gagal dicatat`,
          iconURL: user.displayAvatarURL(),
          expression: "fail",
          description:
            "Batunya pecah dan isinya kelihatan, tapi Naura gagal memasukkannya ke tas kamu. Maaf ya, coba sebentar lagi.",
          footerText: ui.getFooter("survival"),
        });

        await interaction
          .editReply({ ...writeFailPayload, embeds: [] })
          .catch(() => {});
        return;
      }

      const lines = [
        "Hebat! Instingmu tajam banget, batunya benar dan isinya berharga. Naura bangga!",
        "",
        `**${e("cheers", "\uD83C\uDF81")} Hasil tambanganmu**`,
        `> ${ore.emoji} **${ore.amount}x ${ore.name}**`,
      ];

      if (ore.id === "diamond") {
        lines.push(
          "",
          `${e("shocked", "\uD83D\uDC8E")} Diamond asli! Ini benar-benar langka, Naura sampai melompat kegirangan.`,
        );
      } else if (ore.id === "mythril_ore") {
        lines.push(
          "",
          `${e("impressed", "\u2728")} Bijih Mythril! Bagas pasti senang kalau kamu bawa ini ke tungkunya.`,
        );
      }

      if (season) {
        if (season.dropBoost > 1.0) {
          lines.push(
            `\n${e("impressed", "\u2728")} **[${season.label}]** Hasil tambang meningkat x${season.dropBoost}!`,
          );
        }
        if (seasonDrops.length > 0) {
          lines.push(
            `${e("cheers", "\uD83C\uDF81")} **[${season.label}]** Kamu juga menemukan item eksklusif event!`,
          );
        }
      }

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Naura Ancient Cave",
        title: `${e("cheers", "\uD83D\uDC8E")} Tambangnya berhasil!`,
        iconURL: user.displayAvatarURL(),
        expression: ore.mood,
        description: lines.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      await interaction
        .editReply({ ...successPayload, embeds: [] })
        .catch(() => {});

      await questGen
        .incrementQuestProgress(user.id, "collect", 1)
        .catch(() => {});

      if (
        ore.id === "diamond" &&
        countStack(stored.inventory, "diamond") >= DIAMOND_TARGET
      ) {
        await achievementHelper.unlockAchievement(interaction, "miner_dwarf");
      }

      await checkNauraBirthdayEncounter(interaction, user.id);
    });

    collector.on("end", async () => {
      if (answered) return;

      const timeoutPayload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#FFB347",
        authorName: "Naura Ancient Cave",
        title: `${e("sleepy", "\uD83D\uDCA8")} Cahayanya sudah hilang`,
        iconURL: user.displayAvatarURL(),
        expression: "fail",
        description:
          "Kilau batu mulianya memudar sebelum kamu sempat memukul. Nggak apa-apa, gua ini masih banyak batunya. Naura tunggu kamu coba lagi!",
        footerText: ui.getFooter("survival"),
      });

      await interaction
        .editReply({ ...timeoutPayload, embeds: [] })
        .catch(() => {});
    });
  },
};
