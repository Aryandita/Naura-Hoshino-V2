"use strict";
const { logger } = require("../../../src/managers/logger");

const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
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
            buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
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
          accentColorHex: survivalUI.getColor("emerald"),
          title: `${e("trophy")} Papan Peringkat Arena \u2022 ${seasonName}`,
          description: `Musim kompetisi aktif: **${seasonName}**\n\n${leaderboardText}`,
          expression: "Impressed",
          buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
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
      const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");
      const { AttachmentBuilder } = require("discord.js");

      const user = interaction.user;
      const battleRes = await coliseumEngine.simulate3v3Battle(
        user.id,
        user.displayName || user.username,
      );
      const files = [];

      try {
        const matchBuf = await canvasWorkerPool.execute({
          task: "renderColiseumMatch",
          payload: {
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
          },
          userId: user.id,
        });
        files.push(
          new AttachmentBuilder(matchBuf, { name: "coliseum_match.png" }),
        );
      } catch (err) {
        logger.warn("[arena:execute] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
      }

      const payload = buildContainerV2({
        accentColorHex: battleRes.isVictory
          ? survivalUI.getColor("emerald")
          : survivalUI.getColor("danger"),
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
            ? `💰 **Hadiah Kemenangan:** \`+${battleRes.rewardCoins} SC\``
            : "",
        ]
          .filter(Boolean)
          .join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("combat", user.id)],
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
        accentColorHex: survivalUI.getRarityColor("epic"),
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
        accentColorHex: survivalUI.getRarityColor("legendary"),
        authorName: "👑 Papan Peringkat Divisi Master Galactic Coliseum",
        title: "🏆 Top 10 Juara Global",
        description:
          lbList || "*Belum ada tim yang bertanding di Coliseum musim ini.*",
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 6. PET BATTLE ARENA (PvP MMR)
    if (menu === "pet_battle" || menu === "pet") {
      const UserPet = require("../../../src/models/UserPet");
      const petBattleEngine = require("../../../src/survival/engines/petBattleEngine");

      // Cari pet aktif pemain
      let activePet = await UserPet.findOne({
        where: { userId: interaction.user.id, isActive: true },
      });

      if (!activePet) {
        activePet = await UserPet.findOne({
          where: { userId: interaction.user.id, isTamed: true },
        });
      }

      if (!activePet) {
        return interaction.editReply(
          buildContainerV2({
            accentColorHex: ui.getColor("warning"),
            authorName: "NAURA WILDS • Pet Battle Arena",
            title: "🐾 Belum Memiliki Pet Bertarung!",
            description: [
              "Kakak belum memiliki hewan peliharaan aktif yang siap bertarung di Arena!",
              "",
              "• Tangkap dan jinakkan hewan peliharaanmu melalui **/survival pet**.",
              "• Pastikan pet sudah disetel aktif dan dalam kondisi sehat/kenyang sebelum masuk arena.",
            ].join("\n"),
            buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
            footerText: ui.getFooter("survival"),
          }),
        );
      }

      // Periksa target user
      const targetUser = interaction.options?.getUser?.("target");
      let opponentData = null;

      if (targetUser && targetUser.id !== interaction.user.id) {
        let oppPet = await UserPet.findOne({
          where: { userId: targetUser.id, isActive: true },
        });
        if (!oppPet) {
          oppPet = await UserPet.findOne({
            where: { userId: targetUser.id, isTamed: true },
          });
        }

        if (oppPet) {
          const oppArena = await petBattleEngine.getPetArenaProfile(targetUser.id);
          opponentData = {
            isNpc: false,
            ownerName: targetUser.username,
            mmr: oppArena.mmr || 1000,
            pet: oppPet,
            stats: petBattleEngine.getPetCombatStats(oppPet),
          };
        }
      }

      // Jika tidak ada lawan sesama pemain, buat penantang liar AI
      if (!opponentData) {
        const userArena = await petBattleEngine.getPetArenaProfile(interaction.user.id);
        opponentData = petBattleEngine.generateWildChallenger(userArena.mmr || 1000);
      }

      const battleResult = await petBattleEngine.processPetBattle(
        interaction.user.id,
        activePet,
        opponentData,
      );

      const payload = petBattleEngine.renderPetBattleCard(battleResult, interaction.user);
      return interaction.editReply(payload);
    }

    // 7. PET ARENA LEADERBOARD
    if (menu === "pet_leaderboard") {
      const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
      const petBattleEngine = require("../../../src/survival/engines/petBattleEngine");
      const userArena = await petBattleEngine.getPetArenaProfile(interaction.user.id);
      const division = petBattleEngine.getDivisionTier(userArena.mmr || 1000);

      const payload = buildContainerV2({
        accentColorHex: division.color || "#F59E0B",
        authorName: "NAURA WILDS • Pet Battle Arena Leaderboard",
        title: "🐾 Hall of Fame Pet Masters",
        description: [
          `📊 **Peringkat Pribadimu:** \`${userArena.mmr || 1000} MMR\` (${division.badge} Divisi: **${division.name}**)`,
          `🏆 **Rekor Tempur:** \`${userArena.wins || 0} Menang / ${userArena.losses || 0} Kalah\` (Streak: **${userArena.streak || 0}** 🔥)`,
          "",
          "👑 **Tingkatan Divisi Pet Arena:**",
          "• 👑 **Master Rimba** (≥ 2200 MMR)",
          "• 💠 **Diamond** (1900 - 2199 MMR)",
          "• 💎 **Platinum** (1600 - 1899 MMR)",
          "• 🥇 **Gold** (1300 - 1599 MMR)",
          "• 🥈 **Silver** (1100 - 1299 MMR)",
          "• 🥉 **Bronze** (< 1100 MMR)",
          "",
          "- # *Tantang lawan baru di arena dengan memilih `/survival arena menu:pet_battle`!*",
        ].join("\n"),
        buttonsRow: [
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("btn_petarena_match")
              .setLabel("Cari Lawan Pet Arena")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("⚔️"),
          ),
        ],
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }
  },
};
