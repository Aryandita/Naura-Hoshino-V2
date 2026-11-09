"use strict";
const UserProfile = require("../../../src/models/UserProfile");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { Sequelize } = require("sequelize");

module.exports = {
  name: "leaderboard",
  async execute(interaction, context) {
    const { sendError } = context;
    const category = (interaction.options?.getString?.("kategori")) || "math";
    const page = Math.max(1, parseInt(interaction.options?.getInteger?.("halaman") || "1", 10) || 1);
    const perPage = 10;
    const offset = (page - 1) * perPage;
    const isMath = category === "math";
    const isTrivia = category === "trivia";
    const isDuel = category === "duel";
    let title = "";
    let col = "minigame_mathScore";
    if (isMath) { title = "Top GrandMaster Matematika"; col = "minigame_mathScore"; }
    else if (isTrivia) { title = "Top GrandMaster Trivia"; col = "minigame_triviaScore"; }
    else if (isDuel) { title = "Top Jawara Duel Naura"; col = "minigame_duelScore"; }
    else return sendError("Kategori tidak dikenal.");
    let rows;
    try {
      rows = await UserProfile.findAll({ attributes: ["userId", col], where: { [col]: { [Sequelize.Op.gt]: 0 } }, order: [[col, "DESC"]], limit: perPage, offset, raw: true });
      const total = await UserProfile.count({ where: { [col]: { [Sequelize.Op.gt]: 0 } } });
      if (!rows || rows.length === 0) return sendError("Belum ada yang mencetak skor di kategori kuis ini.");
      let descString = "Halaman " + page + " dari " + Math.max(1, Math.ceil(total / perPage)) + " | Total " + total + " pemain.\n\n";
      rows.forEach((u, i) => {
        const rank = offset + i + 1;
        const medal = rank === 1 ? "1st" : rank === 2 ? "2nd" : rank === 3 ? "3rd" : "#" + rank;
        descString += medal + " | <@" + u.userId + ">\n> Skor: **" + Number(u[col] || 0).toLocaleString() + " Poin\n\n";
      });
      const payload = buildContainerV2({ accentColorHex: ui.getColor("primary") || "#00FFFF", authorName: "Naura Minigames Hall of Fame", title, iconURL: interaction.client?.user?.displayAvatarURL?.() || interaction.user.displayAvatarURL(), description: descString, footerText: ui.getFooter("core") });
      return interaction.editReply(payload);
    } catch (e) { return sendError("Gagal memuat leaderboard: " + e.message); }
  },
};
