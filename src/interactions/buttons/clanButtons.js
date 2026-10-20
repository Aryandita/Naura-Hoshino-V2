"use strict";

const clanSubcommand = require("../../../plugin/survival/subcommands/clan");
const { adaptSurvivalInteraction, stopMessageCollector } = require("../../survival/helpers/survivalContext");

module.exports = [
  {
    id: "clan_hub_info",
    label: "clan-hub-info",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "info");
      interaction.customAction = "info";
      return clanSubcommand.execute(interaction, client);
    },
  },
  {
    id: "clan_hub_bounty",
    label: "clan-hub-bounty",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "bounty");
      interaction.customAction = "bounty";
      return clanSubcommand.execute(interaction, client);
    },
  },
  {
    id: "clan_hub_hall",
    label: "clan-hub-hall",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "hall");
      interaction.customAction = "hall";
      return clanSubcommand.execute(interaction, client);
    },
  },
  {
    id: "clan_hub_coffee",
    label: "clan-hub-coffee",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "coffee");
      interaction.customAction = "coffee";
      return clanSubcommand.execute(interaction, client);
    },
  },
  {
    id: "clan_hub_raid",
    label: "clan-hub-raid",
    defer: "update",
    async handler(interaction, client) {
      if (interaction.message?.id) {
        stopMessageCollector(interaction.message.id, "navigated");
      }
      adaptSurvivalInteraction(interaction, "raid");
      interaction.customAction = "raid";
      return clanSubcommand.execute(interaction, client);
    },
  },
];
