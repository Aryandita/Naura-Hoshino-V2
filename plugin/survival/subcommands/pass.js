"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
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
      const payload = {
        ...buildContainerV2({
          authorName: "Naura Wilds",
          title: "Belum Memiliki Karakter",
          description: "Kamu belum memiliki profil petualang di Naura Wilds. Ketik `/survival profile info` untuk memulai!",
          expression: "confused",
          buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
          footerText: ui.getFooter("survival"),
        }),
      };
      return interaction.deferred || interaction.replied
        ? interaction.editReply(payload)
        : interaction.reply(payload);
    }

    const seasonXp = survival.survival_xp || survival.exp || 0;
    const progress = seasonPassEngine.calculatePassProgress(seasonXp);
    const initRpgState = survival.rpg_state || {};
    const claimedTiers = Array.isArray(initRpgState.season_claims)
      ? initRpgState.season_claims
      : Array.isArray(survival.season_claims)
        ? survival.season_claims
        : [];
    let hasPremiumPass = Boolean(initRpgState.has_star_pass || survival.has_star_pass);

    const rewards = seasonPassEngine.getTierRewards(progress.tier);

    const buildPayload = (extraMsg = "") => {
      const passBar = survivalUI.buildVitalsBar({
        current: progress.progressPercent,
        target: 100,
        length: 10,
        showPercentage: true,
      });
      const progressBar = `\`${passBar.rawBar}\` **${progress.progressPercent}%**`;

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
        new ButtonBuilder()
          .setCustomId("btn_pass_preview")
          .setLabel("Preview Manfaat")
          .setEmoji("✨")
          .setStyle(ButtonStyle.Secondary),
      );

      if (!hasPremiumPass) {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId("btn_pass_buy_prem")
            .setLabel(`Buka Star Pass (${STAR_PASS_COST_COUPONS} Kupon)`)
            .setEmoji("💎")
            .setStyle(ButtonStyle.Primary),
        );
      }

      rows.push(actionRow);
      rows.push(survivalUI.buildSurvivalActionRow("profile", user.id));

      return buildContainerV2({
        authorName: "Naura Wilds - Battle Pass",
        title: `Seasonal Star Path (Tier ${progress.tier})`,
        description: descLines.join("\n"),
        accentColorHex: ui.COLOR_SURVIVAL_GOLD || "#F59E0B",
        expression: progress.isMaxTier ? "cheers" : "happy",
        buttonsRow: rows,
        footerText: ui.getFooter("survival"),
      });
    };

    const payload = buildPayload();
    const reply = await (interaction.deferred || interaction.replied
      ? interaction.editReply(payload)
      : interaction.reply({ ...payload, fetchReply: true }));

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      const freshSurvival = (await cacheManager.getUserSurvival(user.id)) || survival;
      const freshState = freshSurvival.rpg_state || {};
      const freshClaims = Array.isArray(freshState.season_claims)
        ? freshState.season_claims
        : Array.isArray(freshSurvival.season_claims)
          ? freshSurvival.season_claims
          : [];
      const freshPrem = Boolean(freshState.has_star_pass || freshSurvival.has_star_pass);
      const freshXp = freshSurvival.survival_xp || freshSurvival.exp || 0;

      if (i.customId === "btn_pass_claim_free") {
        const claimResult = seasonPassEngine.evaluateTierClaim({
          playerTotalXp: freshXp,
          targetTier: progress.tier,
          track: "free",
          claimedTiers: freshClaims,
        });

        if (!claimResult.ok) {
          return i.reply({ content: `❌ ${claimResult.error}`, flags: MessageFlags.Ephemeral });
        }

        const mutRes = await cacheManager.mutateUserSurvivalJson(user.id, "rpg_state", (state) => {
          const s = state || {};
          s.season_claims = claimResult.updatedClaims;
          return s;
        });
        if (!mutRes?.ok) {
          return i.reply({ content: "❌ Gagal menyimpan klaim tier.", flags: MessageFlags.Ephemeral });
        }

        let totalFrag = 0;
        claimResult.rewards.forEach((r) => {
          if (r.type === "fragments") totalFrag += r.amount;
        });
        if (totalFrag > 0) {
          await cacheManager.incrementUserSurvival(user.id, "starFragments", totalFrag);
        }

        return i.update(buildPayload(`🎉 **Sukses!** Kamu berhasil mengklaim hadiah gratis Tier ${progress.tier}: ${claimResult.rewards.map((r) => r.label).join(", ")}!`));
      }

      if (i.customId === "btn_pass_claim_prem") {
        const claimResult = seasonPassEngine.evaluateTierClaim({
          playerTotalXp: freshXp,
          targetTier: progress.tier,
          track: "premium",
          hasPremiumPass: freshPrem,
          claimedTiers: freshClaims,
        });

        if (!claimResult.ok) {
          return i.reply({ content: `❌ ${claimResult.error}`, flags: MessageFlags.Ephemeral });
        }

        const mutRes = await cacheManager.mutateUserSurvivalJson(user.id, "rpg_state", (state) => {
          const s = state || {};
          s.season_claims = claimResult.updatedClaims;
          return s;
        });
        if (!mutRes?.ok) {
          return i.reply({ content: "❌ Gagal menyimpan klaim Star Pass.", flags: MessageFlags.Ephemeral });
        }

        let totalFrag = 0;
        let totalCpn = 0;
        claimResult.rewards.forEach((r) => {
          if (r.type === "fragments") totalFrag += r.amount;
          if (r.type === "coupons") totalCpn += r.amount;
        });

        if (totalFrag > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", totalFrag);
        if (totalCpn > 0) await cacheManager.incrementUserSurvival(user.id, "coupons", totalCpn);

        return i.update(buildPayload(`⭐ **Sukses!** Kamu berhasil mengklaim hadiah Star Pass Tier ${progress.tier}: ${claimResult.rewards.map((r) => r.label).join(", ")}!`));
      }

      if (i.customId === "btn_pass_preview") {
        const previewRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn_pass_back")
            .setLabel("Kembali ke Season Pass")
            .setEmoji("↩️")
            .setStyle(ButtonStyle.Secondary),
        );
        if (!freshPrem) {
          previewRow.addComponents(
            new ButtonBuilder()
              .setCustomId("btn_pass_buy_prem")
              .setLabel(`Buka Star Pass (${STAR_PASS_COST_COUPONS} Kupon)`)
              .setEmoji("💎")
              .setStyle(ButtonStyle.Primary),
          );
        }
        const previewCard = survivalUI.buildPremiumPreviewCard({
          user,
          currentTier: freshPrem ? "tier1" : "none",
          buttonsRow: [previewRow, survivalUI.buildSurvivalActionRow("profile", user.id)],
        });
        return i.update(previewCard);
      }

      if (i.customId === "btn_pass_back") {
        return i.update(buildPayload());
      }

      if (i.customId === "btn_pass_buy_prem") {
        if ((freshSurvival.coupons || 0) < STAR_PASS_COST_COUPONS) {
          return i.reply({
            content: `❌ Naura Coupon kamu tidak cukup. Membutuhkan ${STAR_PASS_COST_COUPONS} Kupon (kamu memiliki ${freshSurvival.coupons || 0} Kupon).`,
            flags: MessageFlags.Ephemeral,
          });
        }

        const debitRes = await cacheManager.debitUserSurvival(user.id, "coupons", STAR_PASS_COST_COUPONS);
        if (!debitRes?.ok) {
          return i.reply({
            content: "❌ Gagal memotong Naura Coupon. Saldo tidak mencukupi.",
            flags: MessageFlags.Ephemeral,
          });
        }
        await cacheManager.mutateUserSurvivalJson(user.id, "rpg_state", (state) => {
          const s = state || {};
          s.has_star_pass = true;
          return s;
        });

        hasPremiumPass = true;
        return i.update(buildPayload("✨ **Selamat!** Star Pass kamu telah aktif! Nikmati hadiah ganda dan kosmetik eksklusif!"));
      }
    });

    collector.on("end", async (_collected, reason) => {
      if (reason === "navigated" || reason === "messageDelete") return;
      try {
        const lastPayload = buildPayload();
        if (lastPayload.components) {
          lastPayload.components.forEach((row) => {
            row.components?.forEach((c) => {
              if (typeof c.setDisabled === "function") c.setDisabled(true);
            });
          });
          await reply.edit(lastPayload).catch(() => {});
        }
      } catch (_) {}
    });
  },
};
