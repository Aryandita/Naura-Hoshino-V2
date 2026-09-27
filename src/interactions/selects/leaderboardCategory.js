"use strict";

const { renderLeaderboardPayload } = require("../../services/leaderboardService");

module.exports = [
  {
    id: "sel_lb_cat",
    label: "leaderboard-category-select",
    onError: "Gagal mengganti kategori papan peringkat.",
    async handler(interaction, client) {
      const selectedCategory = interaction.values[0];
      const payload = await renderLeaderboardPayload(selectedCategory, 1, client);
      await interaction.update(payload);
    },
  },
];
