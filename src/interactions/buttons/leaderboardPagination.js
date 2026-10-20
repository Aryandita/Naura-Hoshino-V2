"use strict";

const { renderLeaderboardPayload } = require("../../services/leaderboardService");

module.exports = [
  {
    prefix: "btn_lb_prev_",
    label: "leaderboard-prev-page",
    onError: "Gagal memuat halaman sebelumnya.",
    async handler(interaction, client) {
      // customId format: btn_lb_prev_{category}_{currentPage}
      const raw = interaction.customId.replace("btn_lb_prev_", "");
      const lastUnderscore = raw.lastIndexOf("_");
      const category = lastUnderscore !== -1 ? raw.substring(0, lastUnderscore) : raw;
      const currentPage = lastUnderscore !== -1 ? parseInt(raw.substring(lastUnderscore + 1), 10) || 1 : 1;
      const targetPage = Math.max(1, currentPage - 1);

      const payload = await renderLeaderboardPayload(category, targetPage, client);
      await interaction.update(payload);
    },
  },
  {
    prefix: "btn_lb_next_",
    label: "leaderboard-next-page",
    onError: "Gagal memuat halaman selanjutnya.",
    async handler(interaction, client) {
      // customId format: btn_lb_next_{category}_{currentPage}
      const raw = interaction.customId.replace("btn_lb_next_", "");
      const lastUnderscore = raw.lastIndexOf("_");
      const category = lastUnderscore !== -1 ? raw.substring(0, lastUnderscore) : raw;
      const currentPage = lastUnderscore !== -1 ? parseInt(raw.substring(lastUnderscore + 1), 10) || 1 : 1;
      const targetPage = currentPage + 1;

      const payload = await renderLeaderboardPayload(category, targetPage, client);
      await interaction.update(payload);
    },
  },
];
