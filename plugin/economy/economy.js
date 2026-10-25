"use strict";

const { SlashCommandBuilder } = require("discord.js");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("economy")
    .setDescription("Perintah ekonomi dan analisis market")
    .addSubcommand((sub) =>
      sub
        .setName("analyze")
        .setDescription("Analisis tren ekonomi server dan rekomendasi balancing"),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const sub = require(`./subcommands/${subcommand}`);
    return sub.execute(interaction);
  },
};
