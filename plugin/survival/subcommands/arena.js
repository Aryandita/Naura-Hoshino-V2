"use strict";

const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
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
        include: [{ model: UserProfile, attributes: ["userId"] }],
      });

      const seasonEngine = require("../../../src/services/seasonEngine");
      const seasonName = seasonEngine.CURRENT_SEASON.name;

      if (!topPlayers || topPlayers.length === 0) {
        return interaction.editReply(
          buildContainerV2({
            accentColorHex: ui.getColor("warning"),
            title: `${e("trophy")} Papan Peringkat Arena \u2022 ${seasonName}`,
            description: "Belum ada petarung yang tercatat di Arena musim ini.",
            expression: "Sleepy",
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      const leaderboardText = topPlayers
        .map((player, index) => {
          let medal = "";
          if (index === 0) medal = "🥇";
          else if (index === 1) medal = "🥈";
          else if (index === 2) medal = "🥉";
          else medal = `**#${index + 1}**`;

          const wr =
            player.matchesPlayed > 0
              ? ((player.wins / player.matchesPlayed) * 100).toFixed(1)
              : 0;
          return `${medal} <@${player.userId}> \u2022 **${player.mmr} MMR** (WR: ${wr}%)`;
        })
        .join("\n");

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("primary"),
          title: `${e("trophy")} Papan Peringkat Arena \u2022 ${seasonName}`,
          description: `Musim kompetisi aktif: **${seasonName}**\n\n${leaderboardText}`,
          expression: "Impressed",
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    if (menu === "stats") {
      const user = interaction.user;
      const [record] = await DuelRecord.findOrCreate({
        where: { userId: user.id },
      });

      const wr =
        record.matchesPlayed > 0
          ? ((record.wins / record.matchesPlayed) * 100).toFixed(1)
          : 0;
      const kd =
        record.deaths > 0
          ? (record.kills / record.deaths).toFixed(2)
          : record.kills;

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
            `**K/D Ratio:** ${kd} (${record.kills} Kill / ${record.deaths} Death)`,
          ].join("\n"),
          expression: "Happy",
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    // 3. COLISEUM 3V3 MATCH
    if (menu === "coliseum_match") {
      const coliseumEngine = require("../../../src/survival/engines/coliseumEngine");
      const {
        drawColiseumMatch,
      } = require("../../../src/canvas/coliseumCanvas");
      const { AttachmentBuilder } = require("discord.js");

      const user = interaction.user;
      const battleRes = await coliseumEngine.simulate3v3Battle(
        user.id,
        user.displayName || user.username,
      );
      const files = [];

      try {
        const matchBuf = await drawColiseumMatch({
          attackerName: user.displayName || user.username,
          opponentName: battleRes.opponentName,
          opponentElo: battleRes.opponentElo,
          isVictory: battleRes.isVictory,
          score: battleRes.score,
          eloChange:
            battleRes.eloChange > 0
              ? `+${battleRes.eloChange}`
              : `${battleRes.eloChange}`,
          elo: battleRes.newElo,
          division: battleRes.newDivision,
        });
        files.push(
          new AttachmentBuilder(matchBuf, { name: "coliseum_match.png" }),
        );
      } catch (err) {
        // Fallback jika canvas worker terkendala
      }

      const payload = buildContainerV2({
        accentColorHex: battleRes.isVictory ? "#86EFAC" : "#EF4444",
        authorName: "⚔️ Galactic Coliseum, 3v3 Championship",
        title: battleRes.isVictory
          ? `🎉 KEMENANGAN ARENA (${battleRes.score})!`
          : `☠️ KEKALAHAN ARENA (${battleRes.score})!`,
        description: [
          `Kamu bertanding melawan formasi **${battleRes.opponentName}** (${battleRes.opponentElo} ELO)!`,
          ``,
          ...battleRes.logs,
          ``,
          `📊 **Hasil Rating:** \`${battleRes.eloChange > 0 ? "+" + battleRes.eloChange : battleRes.eloChange} ELO\` (Total: \`${battleRes.newElo} ELO\` | Divisi: **${battleRes.newDivision}**)`,
          battleRes.rewardCoins > 0
            ? `💰 **Hadiah Kemenangan:** \`+${battleRes.rewardCoins} Star Fragments\``
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, files });
    }

    // 4. COLISEUM TEAM & DIVISION
    if (menu === "coliseum_team") {
      const coliseumEngine = require("../../../src/survival/engines/coliseumEngine");
      const user = interaction.user;
      const team = await coliseumEngine.registerOrGetTeam(
        user.id,
        `${user.username}'s Vanguard`,
      );

      const fighters = Array.isArray(team.formation)
        ? team.formation
        : JSON.parse(team.formation);
      const fighterList = fighters
        .map(
          (f, idx) =>
            `**Slot ${idx + 1}:** **${f.name}** (\`${f.type}\`), ⚔️ ATK: ${f.atk} | 🛡️ DEF: ${f.def} | ❤️ HP: ${f.hp}`,
        )
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: "#C084FC",
        authorName: "🛡️ Formasi Tim Galactic Coliseum",
        title: `✨ Skuad: ${team.teamName}`,
        description: [
          `Formasi 3v3 ini akan bertarung saat kamu menantang pemain lain atau saat timmu diserang saat offline!`,
          ``,
          `👑 **Divisi:** \`${team.divisionTier}\` (Rating: \`${team.eloRating} ELO\`)`,
          `🏆 **Rekor Tempur:** \`${team.wins} Menang / ${team.losses} Kalah\``,
          ``,
          `👥 **Anggota Formasi Skuad:**`,
          fighterList,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 5. COLISEUM LEADERBOARD
    if (menu === "coliseum_leaderboard") {
      const coliseumEngine = require("../../../src/survival/engines/coliseumEngine");
      const topTeams = await coliseumEngine.getLeaderboard();

      const lbList = topTeams
        .map((t, idx) => {
          const medal =
            idx === 0
              ? "🥇"
              : idx === 1
                ? "🥈"
                : idx === 2
                  ? "🥉"
                  : `**#${idx + 1}**`;
          return `${medal} <@${t.userId}>, **${t.teamName}** (\`${t.divisionTier}\` | **${t.eloRating} ELO**)`;
        })
        .join("\n");

      const payload = buildContainerV2({
        accentColorHex: "#FFD700",
        authorName: "👑 Papan Peringkat Divisi Master Galactic Coliseum",
        title: "🏆 Top 10 Juara Global",
        description:
          lbList || "*Belum ada tim yang bertanding di Coliseum musim ini.*",
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
