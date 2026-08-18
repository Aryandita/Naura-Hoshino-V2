"use strict";

const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const DuelRecord = require("../../../src/models/DuelRecord");
const UserProfile = require("../../../src/models/UserProfile");

module.exports = {
  async execute(interaction) {
    const menu = interaction.options.getString("menu");
    const e = (name, fallback) => ui.getEmoji(name) || fallback || "";

    if (menu === "leaderboard") {
      const topPlayers = await DuelRecord.findAll({
        order: [["mmr", "DESC"]],
        limit: 10,
        include: [{ model: UserProfile, attributes: ["userId"] }]
      });

      if (!topPlayers || topPlayers.length === 0) {
        return interaction.editReply(
          buildContainerV2({
            accentColorHex: ui.getColor("warning"),
            title: `${e("trophy")} Papan Peringkat Arena`,
            description: "Belum ada petarung yang tercatat di Arena.",
            expression: "Sleepy",
            footerText: ui.getFooter("survival")
          })
        );
      }

      const leaderboardText = topPlayers.map((player, index) => {
        let medal = "";
        if (index === 0) medal = "🥇";
        else if (index === 1) medal = "🥈";
        else if (index === 2) medal = "🥉";
        else medal = `**#${index + 1}**`;

        const wr = player.matchesPlayed > 0 ? ((player.wins / player.matchesPlayed) * 100).toFixed(1) : 0;
        return `${medal} <@${player.userId}>, **${player.mmr} MMR** (WR: ${wr}%)`;
      }).join("\n");

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("primary"),
          title: `${e("trophy")} Papan Peringkat Arena`,
          description: leaderboardText,
          expression: "Impressed",
          footerText: ui.getFooter("survival")
        })
      );
    } 
    
    if (menu === "stats") {
      const user = interaction.user;
      const [record] = await DuelRecord.findOrCreate({ where: { userId: user.id } });

      const wr = record.matchesPlayed > 0 ? ((record.wins / record.matchesPlayed) * 100).toFixed(1) : 0;
      const kd = record.deaths > 0 ? (record.kills / record.deaths).toFixed(2) : record.kills;

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("success"),
          authorName: user.username,
          iconURL: user.displayAvatarURL(),
          title: `📊 Statistik Arena (PvP)`,
          description: [
            `**MMR (Matchmaking Rating):** ${record.mmr} 🏆`,
            `**Total Pertandingan:** ${record.matchesPlayed}`,
            `**Win Rate:** ${wr}% (${record.wins} Menang / ${record.losses} Kalah)`,
            `**K/D Ratio:** ${kd} (${record.kills} Kill / ${record.deaths} Death)`
          ].join("\n"),
          expression: "Happy",
          footerText: ui.getFooter("survival")
        })
      );
    }
  }
};
