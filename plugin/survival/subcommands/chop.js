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

const STAMINA_COST = 15;
const TIME_LIMIT_MS = 5000;
const WOOD_TARGET = 500;

// Kapak dari yang paling ringan sampai paling sakti. Semakin bagus kapaknya,
// semakin sedikit tebasan yang dibutuhkan.
const AXES = [
  { id: "obsidian_axe", clicks: 3 },
  { id: "diamond_axe", clicks: 5 },
  { id: "iron_axe", clicks: 8 },
  { id: "stone_axe", clicks: 9 },
  { id: "wooden_axe", clicks: 10 },
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const profile = await cacheManager.getUserProfile(user.id);

    const inventory = safeParseInventory(profile.inventory);
    const axe = AXES.find((a) => inventory.some((it) => it && it.id === a.id));

    if (!axe) return ui.sendError(interaction, "err_sys_35", true);

    // Stamina dipotong lewat satu UPDATE bersyarat, bukan dibaca lalu ditulis
    // ulang. Pemeriksaan kecukupan dan pemotongannya terjadi di pernyataan SQL
    // yang sama, jadi dua klik yang tiba berdekatan tidak bisa menebang pohon
    // dua kali dengan tenaga yang sama.
    const paid = await cacheManager.debitUserSurvival(
      user.id,
      "stamina",
      STAMINA_COST,
    );
    if (!paid.ok) return ui.sendError(interaction, "err_sys_36", true);

    const clicksNeeded = axe.clicks;

    const buildChopPayload = (progress) =>
      buildContainerV2({
        accentColorHex: "#22c55e",
        authorName: "Naura Forest",
        title: `${e("happy", "\uD83E\uDE93")} Ayo tebang pohonnya!`,
        iconURL: user.displayAvatarURL(),
        expression: "info",
        description: [
          "**Cepat tekan tombol CHOP!**",
          `Kamu harus menebas **${clicksNeeded} kali** dalam ${TIME_LIMIT_MS / 1000} detik. Naura hitung dari sini, semangat!`,
          progress > 0
            ? `\nProgres: **${progress} / ${clicksNeeded}** tebasan`
            : "",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

    const chopBtn = new ButtonBuilder()
      .setCustomId("chop_hit")
      .setLabel("CHOP!")
      .setStyle(ButtonStyle.Danger)
      .setEmoji(
        ui.parseEmoji(e("axe", "\uD83E\uDE93")) || { name: "\uD83E\uDE93" },
      );

    const row = new ActionRowBuilder().addComponents(chopBtn);
    const first = buildChopPayload(0);

    // Perintah survival sudah di-defer oleh orkestrator, jadi di sini wajib
    // editReply. Container builder juga harus di-spread, bukan ditimpa.
    const message = await interaction.editReply({
      ...first,
      embeds: [],
      components: [...first.components, row],
    });

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: TIME_LIMIT_MS,
    });

    let clicks = 0;

    collector.on("collect", async (i) => {
      clicks += 1;

      if (clicks >= clicksNeeded) {
        collector.stop("success");
        return i.deferUpdate().catch(() => {});
      }

      const progress = buildChopPayload(clicks);
      return i
        .update({
          ...progress,
          embeds: [],
          components: [...progress.components, row],
        })
        .catch(() => {});
    });

    collector.on("end", async (collected, reason) => {
      if (reason !== "success") {
        const failPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#FFB347",
          authorName: "Naura Forest",
          title: `${e("akward", "\uD83D\uDCA8")} Waktunya habis`,
          iconURL: user.displayAvatarURL(),
          expression: "fail",
          description: `Yah, kamu baru menebas **${clicks}** kali dan pohonnya masih kokoh berdiri. Nggak apa-apa, tangan kamu pasti pegal. Istirahat dulu, nanti Naura temani coba lagi ya!`,
          footerText: ui.getFooter("survival"),
        });

        await interaction
          .editReply({ ...failPayload, embeds: [] })
          .catch(() => {});
        return;
      }

      let rewardAmount = Math.floor(Math.random() * 3) + 1;
      let rewardId = "wood";
      let rewardName = "Kayu";
      let rewardEmoji = e("wood", "\uD83E\uDEB5");
      let bonusLine = "";

      if (Math.random() * 100 > 90) {
        if (Math.random() > 0.5) {
          rewardId = "fiber";
          rewardName = "Serat Tumbuhan";
          rewardEmoji = e("fiber", "\uD83C\uDF3F");
          rewardAmount = 2;
          bonusLine = `${e("impressed", "\u2728")} Kamu juga menemukan serat tumbuhan yang jarang ada, lho!`;
        } else {
          rewardAmount += 3;
          bonusLine = `${e("shocked", "\u2728")} Pohonnya besar sekali, kayunya jadi berlimpah!`;
        }
      }

      // === SEASONAL EVENT BOOST ===
      const {
        getCurrentSeason,
        checkNauraBirthdayEncounter,
      } = require("../../../src/survival/helpers/survivalContext");
      const season = getCurrentSeason();
      const seasonDrops = [];
      if (season) {
        rewardAmount = Math.max(1, Math.floor(rewardAmount * season.dropBoost));
        if (season.dropBoost > 1.0) {
          bonusLine += `\n${e("impressed", "\u2728")} **[${season.label}]** Hasil tebangan meningkat x${season.dropBoost}!`;
        }
        if (season.exclusiveItem && Math.random() < 0.25) {
          // 25% drop rate
          seasonDrops.push({
            id: season.exclusiveItem,
            name: "Event Item",
            amount: 1,
            type: "material",
          });
          bonusLine += `\n${e("cheers", "\uD83C\uDF81")} **[${season.label}]** Kamu juga menemukan item eksklusif event!`;
        }
      }

      // Barang masuk lewat jalur terkunci. Menulis ulang seluruh array
      // inventory membuat hadiah lain yang tiba bersamaan ikut terhapus.
      const itemsToStore = [
        {
          id: rewardId,
          name: rewardName,
          amount: rewardAmount,
          type: "material",
        },
        ...seasonDrops,
      ];

      const stored = await addItemsAtomic(user.id, itemsToStore);

      if (!stored.ok) {
        const writeFailPayload = buildContainerV2({
          accentColorHex: ui.getColor("warning") || "#FFB347",
          authorName: "Naura Forest",
          title: `${e("akward", "\uD83D\uDCA8")} Hasilnya gagal dicatat`,
          iconURL: user.displayAvatarURL(),
          expression: "fail",
          description:
            "Pohonnya tumbang, tapi Naura gagal mencatat kayunya ke dalam tas kamu. Maaf ya, coba sebentar lagi.",
          footerText: ui.getFooter("survival"),
        });

        await interaction
          .editReply({ ...writeFailPayload, embeds: [] })
          .catch(() => {});
        return;
      }

      const lines = [
        "Hebat banget! Pohonnya tumbang sekali jalan. Naura bangga sama kamu!",
        "",
        `**${e("cheers", "\uD83C\uDF81")} Hasil tebanganmu**`,
        `> ${rewardEmoji} **${rewardAmount}x ${rewardName}**`,
      ];

      if (bonusLine) lines.push("", bonusLine);

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Naura Forest",
        title: `${e("cheers", "\uD83C\uDF32")} Pohonnya tumbang!`,
        iconURL: user.displayAvatarURL(),
        expression: "success",
        description: lines.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      await interaction
        .editReply({ ...successPayload, embeds: [] })
        .catch(() => {});

      await questGen
        .incrementQuestProgress(user.id, "collect", 1)
        .catch(() => {});

      // Dihitung dari inventory hasil transaksi, bukan dari salinan lama di
      // memori, dan memakai countStack supaya tumpukan ikut terhitung.
      if (
        rewardId === "wood" &&
        countStack(stored.inventory, "wood") >= WOOD_TARGET
      ) {
        await achievementHelper.unlockAchievement(
          interaction,
          "forest_guardian",
        );
      }

      await checkNauraBirthdayEncounter(interaction, user.id);
    });
  },
};
