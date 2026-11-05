"use strict";

module.exports = [
  {
    id: "arcade_select_game",
    label: "arcade-select-game",
    defer: "update",
    async handler(interaction) {
      const selectedGame = interaction.values?.[0];
      if (!selectedGame) return;

      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.playGame(interaction, interaction.user, lang, selectedGame);
    },
  },
];

