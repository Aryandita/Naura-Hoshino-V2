"use strict";

/**
 * @namespace: plugin/utility/season.js
 * @type: Command
 * @description: /season, Sistem Musim & Battle Pass 30-Hari (Season 1)
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const seasonEngine = require("../../src/services/seasonEngine");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

function generateProgressBar(currentXp, maxExp) {
  const totalBars = 10;
  const progress = Math.min(Math.max(currentXp / maxExp, 0), 1);
  const filledBars = Math.round(progress * totalBars);
  const emptyBars = totalBars - filledBars;
  return `[${"█".repeat(filledBars)}${"░".repeat(emptyBars)}] ${Math.round(progress * 100)}%`;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("season")
    .setDescription(
      "🏆 Cek progres Battle Pass Musiman & klaim hadiah eksklusif!",
    )
    .addSubcommand((sub) =>
      sub
        .setName("view")
        .setDescription(
          "Lihat status Battle Pass dan milestone tier kamu saat ini",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("claim")
        .setDescription(
          "Klaim semua hadiah tier yang sudah berhasil kamu buka 🎁",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("upgrade")
        .setDescription(
          "Upgrade ke Premium Battle Pass (5 Kupon / Gratis untuk VIP) 💎",
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand() || "view";
    const userId = interaction.user.id;
    const displayName =
      interaction.user.displayName || interaction.user.username;

    try {
      // ── VIEW ─────────────────────────────────────────────────────
      if (sub === "view") {
        const progress = await seasonEngine.getProgress(userId);
        const s = seasonEngine.season;

        const passType = progress.isPremiumPass
          ? "💎 **PREMIUM BATTLE PASS**"
          : "🆓 **FREE PASS**";
        const pBar = generateProgressBar(progress.xp, s.xpPerTier);

        const claimedCountFree = (progress.claimedTiersFree || []).length;
        const claimedCountPrem = (progress.claimedTiersPremium || []).length;

        const desc =
          `Hai **${displayName}**! Selamat datang di **${s.name}**!\n\n` +
          `Status Pass: ${passType}\n` +
          `🏅 **Tier Saat Ini:** \`Level ${progress.level} / ${s.maxTier}\`\n` +
          `✨ **Progress EXP:** \`${progress.xp} / ${s.xpPerTier} XP\`\n` +
          `\`${pBar}\`\n\n` +
          `**🎁 Milestone Hadiah Utama Musim Ini:**\n` +
          `• **Tier 5:** 📦 Mystery Lootbox *(Free)* | 🎴 SR Card Pack *(Premium)*\n` +
          `• **Tier 10:** 🌟 Gelar [Season Pioneer] *(Premium)*\n` +
          `• **Tier 20:** 🎴 SSR Guaranteed Pack *(Premium)*\n` +
          `• **Tier 25:** 🐾 Cosmic Pet Shard *(Premium)*\n` +
          `• **Tier 30:** 👑 Badge Eksklusif [Hoshino Champion] *(Premium)*\n\n` +
          `*Hadiah Diklaim: ${claimedCountFree} Free | ${claimedCountPrem} Premium*\n` +
          `- # *Kumpulkan Season XP dari bermain Dungeon, Quest, Abyss, Cafe, dan /daily!*`;

        const btnClaim = new ButtonBuilder()
          .setCustomId("btn_season_claim")
          .setLabel("Klaim Hadiah")
          .setStyle(ButtonStyle.Success)
          .setEmoji("🎁");

        const btnUpgrade = new ButtonBuilder()
          .setCustomId("btn_season_upgrade")
          .setLabel(
            progress.isPremiumPass ? "Premium Aktif" : "Upgrade Premium (5 🎟️)",
          )
          .setStyle(
            progress.isPremiumPass
              ? ButtonStyle.Secondary
              : ButtonStyle.Primary,
          )
          .setDisabled(progress.isPremiumPass)
          .setEmoji("💎");

        const row = new ActionRowBuilder().addComponents(btnClaim, btnUpgrade);

        const payload = buildContainerV2({
          accentColorHex: progress.isPremiumPass ? "#FFD700" : "#C084FC",
          title: `🏆 Battle Pass, ${s.name}`,
          description: desc,
          expression: "happy",
          footerText: ui.getFooter("survival"),
        });

        const msg = await interaction.reply({
          ...payload,
          components: [...payload.components, row],
        });

        // Button interaction collector
        const collector = msg.createMessageComponentCollector({
          filter: (i) => i.user.id === userId,
          time: 60000,
        });

        collector.on("collect", async (btnInt) => {
          if (btnInt.customId === "btn_season_claim") {
            const result = await seasonEngine.claimAllRewards(userId);
            return btnInt.reply({
              content: result.message,
              flags: MessageFlags.Ephemeral,
            });
          }
          if (btnInt.customId === "btn_season_upgrade") {
            const result = await seasonEngine.upgradeToPremium(userId);
            return btnInt.reply({
              content: result.message,
              flags: MessageFlags.Ephemeral,
            });
          }
        });

        return;
      }

      // ── CLAIM ────────────────────────────────────────────────────
      if (sub === "claim") {
        const result = await seasonEngine.claimAllRewards(userId);
        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            accentColorHex: result.claimed ? "#86EFAC" : "#FBBF24",
            title: result.claimed
              ? "🎁 Hadiah Musiman Diklaim!"
              : "ℹ️ Status Klaim",
            description:
              `${result.message}\n\n` +
              (result.totalGold
                ? `• 💵 **+${result.totalGold.toLocaleString("id-ID")} Gold**\n`
                : "") +
              (result.totalStarFragments
                ? `• ⭐ **+${result.totalStarFragments.toLocaleString("id-ID")} Star Fragments**\n`
                : "") +
              (result.totalCoupons
                ? `• 🎟️ **+${result.totalCoupons} Naura Coupon**\n`
                : "") +
              (result.unlockedLabels && result.unlockedLabels.length > 0
                ? `\n**Item Khusus:**\n${result.unlockedLabels.map((l) => `• ${l}`).join("\n")}`
                : ""),
            expression: result.claimed ? "cheers" : "sleepy",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      // ── UPGRADE ──────────────────────────────────────────────────
      if (sub === "upgrade") {
        const result = await seasonEngine.upgradeToPremium(userId);
        return interaction.reply({
          flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          components: buildContainerV2({
            accentColorHex: result.success ? "#FFD700" : "#FF6B6B",
            title: result.success
              ? "💎 Premium Battle Pass Aktif!"
              : "❌ Gagal Upgrade",
            description: result.message,
            expression: result.success ? "cheers" : "sad",
            footerText: ui.getFooter("survival"),
          }),
        });
      }
    } catch (err) {
      return interaction.reply({
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
        components: buildContainerV2({
          accentColorHex: "#FF6B6B",
          title: "Terjadi Kesalahan",
          description: `Naura gagal memproses perintah Season Pass: ${err.message}`,
          expression: "sad",
          footerText: ui.getFooter("survival"),
        }),
      });
    }
  },
};
