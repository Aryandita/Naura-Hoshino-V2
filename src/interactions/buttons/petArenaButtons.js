"use strict";

const arenaSubcommand = require("../../../plugin/survival/subcommands/arena");
const { adaptSurvivalInteraction, stopMessageCollector } = require("../../survival/helpers/survivalContext");

module.exports = [
  {
    id: "btn_petarena_match",
    label: "petarena-match",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "arena");
      interaction.options = {
        getString: (name) => (name === "menu" ? "pet_battle" : null),
        getUser: () => null,
      };
      return arenaSubcommand.execute(interaction, client);
    },
  },
  {
    id: "btn_petarena_leaderboard",
    label: "petarena-leaderboard",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "arena");
      interaction.options = {
        getString: (name) => (name === "menu" ? "pet_leaderboard" : null),
        getUser: () => null,
      };
      return arenaSubcommand.execute(interaction, client);
    },
  },
];
