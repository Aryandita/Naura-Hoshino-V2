"use strict";

const { SlashCommandBuilder } = require("discord.js");
const { renderLeaderboardPayload, LEADERBOARD_CATEGORIES } = require("../../src/services/leaderboardService");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("leaderboard")
    .setDescription("Lihat papan peringkat tertinggi para petualang di berbagai kategori")
    .addStringOption((opt) =>
      opt
        .setName("kategori")
        .setDescription("Kategori papan peringkat yang ingin dilihat")
        .setRequired(false)
        .addChoices(
          ...LEADERBOARD_CATEGORIES.map((cat) => ({
            name: `${cat.emoji} ${cat.label}`,
            value: cat.id,
          })),
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("halaman")
        .setDescription("Nomor halaman peringkat")
        .setRequired(false)
        .setMinValue(1),
    ),

  async execute(interaction, client) {
    try {
      const category = interaction.options.getString("kategori") || "wallet";
      const page = interaction.options.getInteger("halaman") || 1;

      const payload = await renderLeaderboardPayload(category, page, client);
      await interaction.reply(payload);
    } catch (err) {
      logger.error("Error executing /leaderboard:", err);
      return ui.sendError(interaction, "Gagal memuat papan peringkat.");
    }
  },
};
