"use strict";
const { MessageFlags } = require("discord.js");

module.exports = [
  {
    id: "arcade_daily",
    label: "arcade-daily",
    defer: "reply",
    flags: MessageFlags.Ephemeral,
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.claimDaily(interaction, interaction.user, lang);
    },
  },
  {
    id: "redirect_arcade_daily",
    label: "arcade-redirect-daily",
    defer: "reply",
    flags: MessageFlags.Ephemeral,
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.claimDaily(interaction, interaction.user, lang);
    },
  },
  {
    id: "arcade_hub",
    label: "arcade-hub",
    defer: "update",
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.showHub(interaction, interaction.user, lang);
    },
  },
  {
    id: "redirect_arcade_hub",
    label: "arcade-redirect-hub",
    defer: "update",
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.showHub(interaction, interaction.user, lang);
    },
  },
  {
    id: "arcade_profile",
    label: "arcade-profile",
    defer: "update",
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.showProfile(interaction, interaction.user, lang);
    },
  },
  {
    id: "arcade_leaderboard",
    label: "arcade-leaderboard",
    defer: "update",
    async handler(interaction) {
      const arcade = require("../../../plugin/arcade/arcade");
      const lang = interaction.localeLang || "id";
      return arcade.showLeaderboard(interaction, interaction.user, lang);
    },
  },
];
