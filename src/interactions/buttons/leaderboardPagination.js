"use strict";

const { renderLeaderboardPayload } = require("../../services/leaderboardService");

module.exports = [
  {
    prefix: "btn_lb_prev_",
    label: "leaderboard-prev-page",
    onError: "Gagal memuat halaman sebelumnya.",
    async handler(interaction, client) {
      // customId format: btn_lb_prev_{category}_{currentPage}
      const parts = interaction.customId.replace("btn_lb_prev_", "").split("_");
      const category = parts[0] || "wallet";
      const currentPage = parseInt(parts[1], 10) || 1;
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
      const parts = interaction.customId.replace("btn_lb_next_", "").split("_");
      const category = parts[0] || "wallet";
      const currentPage = parseInt(parts[1], 10) || 1;
      const targetPage = currentPage + 1;

      const payload = await renderLeaderboardPayload(category, targetPage, client);
      await interaction.update(payload);
    },
  },
];
