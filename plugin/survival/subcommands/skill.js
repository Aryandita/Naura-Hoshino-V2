"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const skillTree = require("../../../src/survival/engines/skillTreeEngine");
const leveling = require("../../../src/survival/engines/survivalLeveling");

const COLLECTOR_MS = 60000;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

function buildSkillView(survival, user) {
  const unspent = skillTree.getUnspentPoints(survival);
  const bonuses = skillTree.getLifeStatBonuses(survival);
  const synergy = skillTree.getPathSynergy(survival);
  const currentLevel = survival?.survival_level || 1;
  const statCap = leveling.getMaxStatCap(currentLevel);
  const maxHp = leveling.calculateMaxHp(survival);

  const str = Number(survival?.strength || 1);
  const agi = Number(survival?.agility || 1);
  const int = Number(survival?.intelligence || 1);
  const lck = Number(survival?.luck || 1);

  const synergySection = synergy.hasSynergy
    ? [
        `**${e("sparkle", "\u2728")} Combat Path Synergy Aktif!**`,
        `> **${synergy.label}** (${String(synergy.className).toUpperCase()})`,
        `> *Efek:* ${synergy.bonusDescription}`,
        "",
      ]
    : synergy.className
      ? [
          `**${e("shield", "\uD83D\uDEE1\uFE0F")} Status Combat Path**`,
          `> Kelas aktif: **${String(synergy.className).toUpperCase()}**`,
          `> *Petunjuk Naura:* Tingkatkan stat **${String(synergy.dominantStat).toUpperCase()}** agar Path Synergy aktif di dungeon!`,
          "",
        ]
      : [
          `**${e("shield", "\uD83D\uDEE1\uFE0F")} Belum Memilih Kelas Pertarungan**`,
          `> Gunakan \`/survival class\` untuk memilih jalan tempurmu di dungeon!`,
          "",
        ];

  const lines = [
    `Halo, **${user.displayName || user.username}**! Ini adalah diagram potensi jiwamu.`,
    `Setiap naik level, kamu mendapatkan **3 Stat Points** untuk diinvestasikan di kehidupan sehari-hari.`,
    "",
    `⭐ **Stat Points Tersedia:** \`${unspent} Poin\``,
    `🛡️ **Batas Maksimal Stat (Cap):** \`${statCap}\` *(naik tiap level)*`,
    "",
    "**Statistik Kehidupan (Life Stats):**",
    `> ${e("strength", "\uD83D\uDCAA")} **Strength (STR):** \`${str}/${statCap}\` \u2022 *Bonus Kecepatan Crafting +${bonuses.craftingSpeedBonusPercent}%*`,
    `> ${e("agility", "\uD83C\uDFC3")} **Agility (AGI):** \`${agi}/${statCap}\` \u2022 *Diskon Biaya Perjalanan +${bonuses.travelDiscountPercent}%*`,
    `> ${e("intelligence", "\uD83E\uDDE0")} **Intelligence (INT):** \`${int}/${statCap}\` \u2022 *Bonus Gaji Pekerjaan +${bonuses.salaryBonusPercent}%*`,
    `> ${e("luck", "\uD83C\uDF40")} **Luck (LCK):** \`${lck}/${statCap}\` \u2022 *Bonus Drop Sumber Daya +${bonuses.resourceDropBonusPercent}%*`,
    `> ❤️ **Vital HP Pool:** \`${survival.hp || maxHp}/${maxHp}\``,
    "",
    ...synergySection,
    unspent > 0
      ? "Pilih tombol di bawah untuk mengalokasikan poinmu!"
      : "*Kumpulkan poin baru dengan bekerja, menambang, atau menjelajah dungeon!*",
  ];

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("invest_str")
      .setLabel("+1 STR")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(unspent <= 0 || str >= statCap),
    new ButtonBuilder()
      .setCustomId("invest_agi")
      .setLabel("+1 AGI")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(unspent <= 0 || agi >= statCap),
    new ButtonBuilder()
      .setCustomId("invest_int")
      .setLabel("+1 INT")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(unspent <= 0 || int >= statCap),
    new ButtonBuilder()
      .setCustomId("invest_lck")
      .setLabel("+1 LCK")
      .setStyle(ButtonStyle.Primary)
      .setDisabled(unspent <= 0 || lck >= statCap),
    new ButtonBuilder()
      .setCustomId("invest_hp")
      .setLabel("+20 HP")
      .setStyle(ButtonStyle.Success)
      .setDisabled(unspent <= 0),
  );

  const container = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: `Diagram Kemampuan ${user.displayName || user.username}`,
    title: `${e("sparkle", "\u2728")} Pohon Kemampuan & Life Stats`,
    iconURL: user.displayAvatarURL(),
    expression: unspent > 0 ? "happy" : "info",
    description: lines.join("\n"),
    buttonsRow: row,
    footerText: ui.getFooter("survival"),
  });

  return { container, row, unspent };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const survival = await cacheManager.getUserSurvival(user.id);

    if (!survival) {
      return interaction.editReply(
        buildErrorContainerV2({
          errorMessage: "Data petualanganmu belum ditemukan. Mulai dulu dengan /survival start ya!",
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    const { container } = buildSkillView(survival, user);

    const message = await interaction.editReply({
      ...container,
      embeds: [],
      flags: MessageFlags.IsComponentsV2,
    });

    if (!message || typeof message.createMessageComponentCollector !== "function") {
      return;
    }

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id && i.customId.startsWith("invest_"),
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate().catch(() => {});

      const targetMap = {
        invest_str: "strength",
        invest_agi: "agility",
        invest_int: "intelligence",
        invest_lck: "luck",
        invest_hp: "hp",
      };

      const statName = targetMap[i.customId];
      if (!statName) return;

      const result = await skillTree.investPoint(user.id, statName);

      if (!result.success) {
        if (result.reason === "STAT_CAPPED") {
          await i.followUp({
            ...buildErrorContainerV2({
              errorMessage: `Stat tersebut sudah mencapai batas maksimal level ini (${result.cap})! Naikkan levelmu dulu ya~`,
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        } else if (result.reason === "NO_POINTS") {
          await i.followUp({
            ...buildErrorContainerV2({
              errorMessage: "Poin kemampuanmu sudah habis! Dapatkan poin baru dengan menaikkan level.",
              footerText: ui.getFooter("survival"),
            }),
            flags: MessageFlags.Ephemeral,
          }).catch(() => {});
        }
        return;
      }

      const freshSurvival = await cacheManager.getUserSurvival(user.id);
      const updatedView = buildSkillView(freshSurvival, user);

      await interaction.editReply({
        ...updatedView.container,
        embeds: [],
        flags: MessageFlags.IsComponentsV2,
      }).catch(() => {});
    });
  },
};
