"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const seasonPassEngine = require("../../../src/survival/engines/seasonPassEngine");

const COLLECTOR_MS = 60000;
const STAR_PASS_COST_COUPONS = 50;

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const survival = await cacheManager.getUserSurvival(user.id);

    if (!survival) {
      return interaction.reply({
        ...buildContainerV2({
          authorName: "Naura Wilds",
          title: "Belum Memiliki Karakter",
          description: "Kamu belum memiliki profil petualang di Naura Wilds. Ketik `/survival profile info` untuk memulai!",
          expression: "confused",
        }),
      });
    }

    const seasonXp = survival.exp || 0;
    const progress = seasonPassEngine.calculatePassProgress(seasonXp);
    const claimedTiers = Array.isArray(survival.season_claims) ? survival.season_claims : [];
    const hasPremiumPass = Boolean(survival.has_star_pass);

    const rewards = seasonPassEngine.getTierRewards(progress.tier);

    const buildPayload = (extraMsg = "") => {
      const filledBlocks = Math.round(progress.progressPercent / 10);
      const emptyBlocks = 10 - filledBlocks;
      const progressBar = `\`[${"█".repeat(filledBlocks)}${"░".repeat(emptyBlocks)}]\` **${progress.progressPercent}%**`;

      const descLines = [
        `🏆 **Status Season Pass:** **Tier ${progress.tier} / ${seasonPassEngine.MAX_PASS_TIER}**`,
        progressBar,
        `✨ **Season XP:** \`${progress.currentTierXp} / ${progress.xpNeeded} XP\``,
        `⭐ **Status Star Pass:** ${hasPremiumPass ? "`🌟 AKTIF (PREMIUM)`" : "`🔒 TERKUNCI (GRATIS)`"}`,
        "",
        `🎁 **Hadiah Tier ${progress.tier} Saat Ini:**`,
        `• **Jalur Gratis:** ${rewards.free.map((r) => r.label).join(", ")}`,
        `• **Jalur Star Pass:** ${rewards.premium.map((r) => r.label).join(", ")}`,
      ];

      if (extraMsg) {
        descLines.push("", `> ${extraMsg}`);
      }

      const rows = [];
      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("btn_pass_claim_free")
          .setLabel(`Klaim Gratis (T${progress.tier})`)
          .setEmoji("🎁")
          .setStyle(ButtonStyle.Success)
          .setDisabled(claimedTiers.includes(`free_${progress.tier}`)),
        new ButtonBuilder()
          .setCustomId("btn_pass_claim_prem")
          .setLabel(`Klaim Star Pass (T${progress.tier})`)
          .setEmoji("⭐")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(!hasPremiumPass || claimedTiers.includes(`premium_${progress.tier}`)),
      );

      if (!hasPremiumPass) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId("btn_pass_buy_prem")
            .setLabel(`Buka Star Pass (${STAR_PASS_COST_COUPONS} Kupon)`)
            .setEmoji("💎")
            .setStyle(ButtonStyle.Secondary),
        );
      }

      rows.push(actionRow);

      return {
        ...buildContainerV2({
          authorName: "Naura Wilds - Battle Pass",
          title: `Seasonal Star Path (Tier ${progress.tier})`,
          description: descLines.join("\n"),
          accentColor: ui.COLOR_SURVIVAL_GOLD || "#F59E0B",
          expression: progress.isMaxTier ? "cheers" : "happy",
        }),
        components: rows,
      };
    };

    const reply = await interaction.reply(buildPayload());

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      const freshSurvival = (await cacheManager.getUserSurvival(user.id)) || survival;
      const freshClaims = Array.isArray(freshSurvival.season_claims) ? freshSurvival.season_claims : [];
      const freshPrem = Boolean(freshSurvival.has_star_pass);

      if (i.customId === "btn_pass_claim_free") {
        const claimResult = seasonPassEngine.evaluateTierClaim({
          playerTotalXp: freshSurvival.exp || 0,
          targetTier: progress.tier,
          track: "free",
          claimedTiers: freshClaims,
        });

        if (!claimResult.ok) {
          return i.reply({ content: `❌ ${claimResult.error}`, flags: MessageFlags.Ephemeral });
        }

        // Grant atomic fragments
        let totalFrag = 0;
        claimResult.rewards.forEach((r) => {
          if (r.type === "fragments") totalFrag += r.amount;
        });
        if (totalFrag > 0) {
          await cacheManager.incrementUserSurvival(user.id, "starFragments", totalFrag);
        }

        // Mutate claimed array
        await cacheManager.mutateUserSurvivalJson(user.id, (row) => {
          row.season_claims = claimResult.updatedClaims;
        });

        return i.update(buildPayload(`🎉 **Sukses!** Kamu berhasil mengklaim hadiah gratis Tier ${progress.tier}: ${claimResult.rewards.map((r) => r.label).join(", ")}!`));
      }

      if (i.customId === "btn_pass_claim_prem") {
        const claimResult = seasonPassEngine.evaluateTierClaim({
          playerTotalXp: freshSurvival.exp || 0,
          targetTier: progress.tier,
          track: "premium",
          hasPremiumPass: freshPrem,
          claimedTiers: freshClaims,
        });

        if (!claimResult.ok) {
          return i.reply({ content: `❌ ${claimResult.error}`, flags: MessageFlags.Ephemeral });
        }

        let totalFrag = 0;
        let totalCpn = 0;
        claimResult.rewards.forEach((r) => {
          if (r.type === "fragments") totalFrag += r.amount;
          if (r.type === "coupons") totalCpn += r.amount;
        });

        if (totalFrag > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", totalFrag);
        if (totalCpn > 0) await cacheManager.incrementUserSurvival(user.id, "coupons", totalCpn);

        await cacheManager.mutateUserSurvivalJson(user.id, (row) => {
          row.season_claims = claimResult.updatedClaims;
        });

        return i.update(buildPayload(`⭐ **Sukses!** Kamu berhasil mengklaim hadiah Star Pass Tier ${progress.tier}: ${claimResult.rewards.map((r) => r.label).join(", ")}!`));
      }

      if (i.customId === "btn_pass_buy_prem") {
        if ((freshSurvival.coupons || 0) < STAR_PASS_COST_COUPONS) {
          return i.reply({
            content: `❌ Naura Coupon kamu tidak cukup. Membutuhkan ${STAR_PASS_COST_COUPONS} Kupon (kamu memiliki ${freshSurvival.coupons || 0} Kupon).`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await cacheManager.debitUserSurvival(user.id, "coupons", STAR_PASS_COST_COUPONS);
        await cacheManager.mutateUserSurvivalJson(user.id, (row) => {
          row.has_star_pass = true;
        });

        return i.update(buildPayload("✨ **Selamat!** Star Pass kamu telah aktif! Nikmati hadiah ganda dan kosmetik eksklusif!"));
      }
    });
  },
};
