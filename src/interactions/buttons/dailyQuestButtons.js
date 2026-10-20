"use strict";

const dailyQuestSubcommand = require("../../../plugin/survival/subcommands/dailyQuest");
const { adaptSurvivalInteraction, stopMessageCollector } = require("../../survival/helpers/survivalContext");

module.exports = [
  {
    id: "btn_dailyquest_generate",
    label: "dailyquest-generate",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "generate");
      interaction.customAction = "generate";
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
  {
    id: "btn_dailyquest_view",
    label: "dailyquest-view",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "view");
      interaction.customAction = "view";
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
  {
    id: "btn_dailyquest_claim",
    label: "dailyquest-claim",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "claim");
      interaction.customAction = "claim";
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
  {
    id: "btn_dailyquest_reroll",
    label: "dailyquest-reroll",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "reroll");
      interaction.customAction = "reroll";
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
  {
    id: "btn_weeklyquest_view",
    label: "weeklyquest-view",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "weekly");
      interaction.customAction = "weekly";
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
  {
    prefix: "btn_weeklyquest_claim_",
    label: "weeklyquest-claim-slot",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      const rawId = interaction.customId;
      if (rawId === "btn_weeklyquest_claim_grand") {
        adaptSurvivalInteraction(interaction, "claim_grand");
        interaction.customAction = "claim_grand";
      } else {
        const slotIdx = rawId.replace("btn_weeklyquest_claim_", "");
        adaptSurvivalInteraction(interaction, `claim_weekly_${slotIdx}`);
        interaction.customAction = `claim_weekly_${slotIdx}`;
      }
      return dailyQuestSubcommand.execute(interaction, client);
    },
  },
];
