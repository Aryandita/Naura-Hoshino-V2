"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  generateDailyQuest,
  getDailyQuestPayload,
  claimDailyQuestReward,
  getStreakInfo,
  getQuestState,
  getTierByLevel,
  getWeeklyQuestState,
  claimWeeklyQuestReward,
  claimWeeklyGrandReward,
} = require("../../../src/survival/engines/dailyQuestEngine");
const {
  renderQuestCard,
  renderEmptyQuest,
  renderClaimResult,
  renderWeeklyBoard,
  renderWeeklyClaimResult,
} = require("../../../src/survival/engines/dailyQuestUI");
const survivalUI = require("../../../src/utils/survivalUIHelper");

const STARTER_FLAG = "survival_started";

module.exports = {
  async execute(interaction, client) {
    const userId = interaction.user.id;
    const lang =
      typeof interaction.fetchLang === "function"
        ? await interaction.fetchLang()
        : interaction.localeLang || "id";

    // Pengecekan pendaftaran survival
    const profile = await cacheManager.getUserProfile(userId);
    const inv = profile?.inventory;
    const hasStarted =
      inv &&
      (Array.isArray(inv)
        ? inv.some((i) => i && i.id === STARTER_FLAG)
        : false);

    if (!hasStarted) {
      const { renderOnboardingPrompt } = require(
        "../../../src/survival/engines/playerOnboardingEngine"
      );
      const payload = renderOnboardingPrompt(interaction.user, lang);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    const action = (
      interaction.options?.getString?.("aksi") ||
      interaction.customAction ||
      "view"
    ).toLowerCase();

    try {
      if (action === "generate" || action === "reroll") {
        const result = await generateDailyQuest(userId);
        if (!result.ok) {
          const payload = survivalUI.buildActionResultCard({
            title: "Quest Masih Aktif",
            description: result.message || "Kakak sudah memiliki quest harian aktif.",
            type: "warning",
            buttonsRow: [
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId("btn_dailyquest_view")
                  .setLabel("Lihat Quest")
                  .setStyle(ButtonStyle.Primary)
                  .setEmoji("📜")
              ),
            ],
          });
          if (interaction.deferred || interaction.replied) {
            return interaction.editReply(payload);
          }
          return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
        }

        const streakInfo = await getStreakInfo(userId);
        const questState = await getQuestState(userId);
        const survival = await cacheManager.getUserSurvival(userId);
        const tier = getTierByLevel(survival?.survival_level || 1);

        const payload = renderQuestCard(questState, lang, streakInfo, tier);
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply(payload);
      }

      if (action === "view") {
        const streakInfo = await getStreakInfo(userId);
        const questState = await getQuestState(userId);
        const survival = await cacheManager.getUserSurvival(userId);
        const tier = getTierByLevel(survival?.survival_level || 1);

        let payload;
        if (questState.quest) {
          payload = renderQuestCard(questState, lang, streakInfo, tier);
        } else {
          payload = renderEmptyQuest(lang, streakInfo, tier);
        }

        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply(payload);
      }

      if (action === "claim") {
        const result = await claimDailyQuestReward(userId);
        const streakInfo = await getStreakInfo(userId);

        const payload = renderClaimResult(
          {
            ok: result.ok,
            message: result.message,
            streak: result.streak || streakInfo,
            bonusPercent: result.bonusPercent || 0,
            reward: result.reward || {},
            title: result.ok ? "Quest Selesai!" : "Gagal Klaim",
            milestoneAchieved: result.milestoneAchieved,
          },
          lang
        );

        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }

      if (action === "weekly" || action === "board") {
        const weeklyBoard = await getWeeklyQuestState(userId);
        const payload = renderWeeklyBoard(weeklyBoard, lang);
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply(payload);
      }

      if (action.startsWith("claim_weekly")) {
        const idx = parseInt(action.replace("claim_weekly", "").replace("_", ""), 10);
        const result = await claimWeeklyQuestReward(userId, idx);
        const payload = renderWeeklyClaimResult(result, lang);
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }

      if (action === "claim_grand" || action === "grand") {
        const result = await claimWeeklyGrandReward(userId);
        const payload = renderWeeklyClaimResult(result, lang);
        if (interaction.deferred || interaction.replied) {
          return interaction.editReply(payload);
        }
        return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
      }

      // Default fallback
      const payload = await getDailyQuestPayload(userId, lang);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.reply(payload);
    } catch (error) {
      console.error("[DailyQuest] Error:", error);
      const payload = survivalUI.buildActionResultCard({
        title: "Kesalahan Sistem",
        description: "Maaf, terjadi kesalahan saat memproses quest harian. Coba lagi nanti.",
        type: "error",
      });
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }
  },
};
