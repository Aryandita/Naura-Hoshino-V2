"use strict";

/**
 * Subcommand: /survival pass
 * Battle Pass 30-Tier "Naura Wilds Pass"
 * Aksi:
 *   - view: Melihat progres, tier saat ini, dan status pass.
 *   - claim: Mengklaim seluruh milestone hadiah yang sudah terbuka.
 *   - buy: Upgrade ke Premium Pass (5 Kupon / Gratis untuk VIP).
 */

const seasonEngine = require("../../../src/services/seasonEngine");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const action = interaction.options.getString("aksi") || "view";

    // 1. Aksi: BUY (Upgrade ke Premium Pass)
    if (action === "buy") {
      const upgradeRes = await seasonEngine.upgradeToPremium(user.id);
      const payload = buildContainerV2({
        accentColorHex: upgradeRes.success ? "#FFD700" : "#FF6B6B",
        authorName: "Naura Wilds Battle Pass",
        title: upgradeRes.success
          ? "✨ Premium Pass Terbuka!"
          : "⚠️ Gagal Upgrade Pass",
        iconURL: user.displayAvatarURL(),
        expression: upgradeRes.success ? "cheer" : "fail",
        description: upgradeRes.message,
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply({ ...payload, embeds: [] }).catch(() => {});
    }

    // 2. Aksi: CLAIM (Klaim Seluruh Hadiah Milestone yang Terbuka)
    if (action === "claim") {
      const claimRes = await seasonEngine.claimAllRewards(user.id);
      if (!claimRes.claimed) {
        const payload = buildContainerV2({
          accentColorHex: "#FFB347",
          authorName: "Naura Wilds Battle Pass",
          title: "📦 Belum Ada Hadiah Baru",
          iconURL: user.displayAvatarURL(),
          expression: "idle",
          description: claimRes.message,
          footerText: ui.getFooter("survival"),
        });
        return interaction
          .editReply({ ...payload, embeds: [] })
          .catch(() => {});
      }

      const rewardsSummary = [];
      if (claimRes.totalGold > 0)
        rewardsSummary.push(
          `> 🪙 **+${claimRes.totalGold.toLocaleString("id-ID")} Gold**`,
        );
      if (claimRes.totalStarFragments > 0)
        rewardsSummary.push(
          `> ⭐ **+${claimRes.totalStarFragments.toLocaleString("id-ID")} Star Fragments**`,
        );
      if (claimRes.totalCoupons > 0)
        rewardsSummary.push(`> 🎟️ **+${claimRes.totalCoupons} Naura Coupon**`);
      if (claimRes.unlockedLabels && claimRes.unlockedLabels.length > 0) {
        rewardsSummary.push(
          ...claimRes.unlockedLabels.map((l) => `> ✨ **${l}**`),
        );
      }

      const payload = buildContainerV2({
        accentColorHex: "#78C850",
        authorName: "Naura Wilds Battle Pass",
        title: "🎉 Hadiah Season Berhasil Diklaim!",
        iconURL: user.displayAvatarURL(),
        expression: "cheer",
        description: `${claimRes.message}\n\n**Rincian Hadiah yang Didapat:**\n${rewardsSummary.join("\n")}`,
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply({ ...payload, embeds: [] }).catch(() => {});
    }

    // 3. Aksi: VIEW (Default - Tampilkan Status Pass)
    const progress = await seasonEngine.getProgress(user.id);
    const season = seasonEngine.season;
    const currentTier = progress.level;
    const currentXp = progress.xp;
    const xpNeeded = season.xpPerTier;
    const isPremium = progress.isPremiumPass;

    // Visual Progress Bar (10 segmen)
    const progressPercent = Math.min(1, currentXp / xpNeeded);
    const filledBars = Math.round(progressPercent * 10);
    const progressBar = "🟩".repeat(filledBars) + "⬛".repeat(10 - filledBars);

    const lines = [
      `**${season.name}**`,
      `Musim aktif hingga: <t:${Math.floor(new Date(season.endDate).getTime() / 1000)}:R>`,
      "",
      `**Status Keanggotaan:** ${isPremium ? "👑 **PREMIUM PASS ACTIVE**" : "🌱 **FREE PASS**"}`,
      `**Tier Saat Ini:** 🏆 **Tier ${currentTier} / ${season.maxTier}**`,
      `**Progres Tier:** \`[${progressBar}]\` (${currentXp}/${xpNeeded} XP)`,
      "",
      "**✨ Milestone Hadiah Mendatang:**",
    ];

    // Tampilkan 3 milestone berikutnya
    const milestones = [currentTier, currentTier + 1, currentTier + 2].filter(
      (t) => t <= season.maxTier,
    );
    for (const t of milestones) {
      const r = seasonEngine.TIER_REWARDS[t];
      if (r) {
        const freeDesc = r.free
          ? Object.entries(r.free)
              .map(([k, v]) => `${v} ${k}`)
              .join(", ")
          : "Tidak ada";
        const premDesc = r.premium
          ? Object.entries(r.premium)
              .map(([k, v]) => `${v} ${k}`)
              .join(", ")
          : "Tidak ada";
        lines.push(
          `> 🎯 **Tier ${t}:** Free: \`${freeDesc}\` | Premium: \`${premDesc}\``,
        );
      }
    }

    if (!isPremium) {
      lines.push(
        "",
        "💡 *Upgrade ke Premium Pass seharga 5 Naura Coupon untuk membuka jalur hadiah premium 2x lipat!*",
      );
    }

    const buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pass_claim_all")
        .setLabel("Klaim Semua Hadiah")
        .setStyle(ButtonStyle.Success)
        .setEmoji("🎁"),
      new ButtonBuilder()
        .setCustomId("pass_upgrade_premium")
        .setLabel(isPremium ? "Premium Aktif" : "Beli Premium (5 🎟️)")
        .setStyle(isPremium ? ButtonStyle.Secondary : ButtonStyle.Primary)
        .setDisabled(isPremium)
        .setEmoji("👑"),
    );

    const payload = buildContainerV2({
      accentColorHex: isPremium ? "#FFD700" : "#78C850",
      authorName: "Naura Wilds Battle Pass",
      title: `🏆 Battle Pass: Tier ${currentTier}`,
      iconURL: user.displayAvatarURL(),
      expression: "smile",
      description: lines.join("\n"),
      buttonsRow,
      footerText: ui.getFooter("survival"),
    });

    return interaction.editReply({ ...payload, embeds: [] }).catch(() => {});
  },
};
