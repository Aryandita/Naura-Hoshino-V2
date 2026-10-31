"use strict";

const { SlashCommandBuilder, AttachmentBuilder } = require("discord.js");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
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
      if (page === 1) {
        try {
          const { fetchLeaderboard } = require("../../src/services/leaderboardService");
          const lbData = await fetchLeaderboard(category, 1, 10);
          const entries = (lbData.items || []).map((it) => ({
            username: it.username || `Petualang_${it.userId ? it.userId.slice(-4) : "1"}`,
            score: it.score || 0,
          }));
          const cardBuf = await canvasWorkerPool.execute("renderLeaderboard", {
            title: `Top 10 ${lbData.category ? lbData.category.label : "Leaderboard"}`,
            category: lbData.category ? lbData.category.label : category,
            entries,
          });
          if (cardBuf) {
            payload.files = [new AttachmentBuilder(cardBuf, { name: "leaderboard.png" })];
            payload.image = { url: "attachment://leaderboard.png" };
          }
        } catch (err) {
          logger.warn("[leaderboard:execute] Render visual canvas gagal: " + (err?.message || err));
        }
      }
      await interaction.reply(payload);
    } catch (err) {
      logger.error("Error executing /leaderboard:", err);
      return ui.sendError(interaction, "Gagal memuat papan peringkat.");
    }
  },
};
