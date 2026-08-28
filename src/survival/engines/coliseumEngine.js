"use strict";

const ColiseumTeam = require("../../models/ColiseumTeam");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");
const ui = require("../../config/ui");

const DIVISIONS = [
  {
    name: "MASTER",
    minElo: 2100,
    get badge() {
      return ui.getEmoji("badge_master") || "👑";
    },
  },
  {
    name: "DIAMOND",
    minElo: 1900,
    get badge() {
      return ui.getEmoji("badge_diamond") || "💎";
    },
  },
  {
    name: "PLATINUM",
    minElo: 1700,
    get badge() {
      return ui.getEmoji("badge_platinum") || "💠";
    },
  },
  {
    name: "GOLD",
    minElo: 1500,
    get badge() {
      return ui.getEmoji("badge_gold") || "🥇";
    },
  },
  {
    name: "SILVER",
    minElo: 1300,
    get badge() {
      return ui.getEmoji("badge_silver") || "🥈";
    },
  },
  {
    name: "BRONZE",
    minElo: 0,
    get badge() {
      return ui.getEmoji("badge_bronze") || "🥉";
    },
  },
];

function getDivision(elo) {
  for (const div of DIVISIONS) {
    if (elo >= div.minElo) return div.name;
  }
  return "BRONZE";
}

class ColiseumEngine {
  /**
   * Daftarkan atau ambil formasi tim petarung pemain
   */
  static async registerOrGetTeam(
    userId,
    teamName = "Vanguard Squad",
    formation = null,
  ) {
    let team = await ColiseumTeam.findOne({ where: { userId } });

    if (!team) {
      const defaultFormation = formation || [
        {
          slot: 1,
          name: "Cyber Striker",
          type: "DPS",
          atk: 85,
          def: 40,
          hp: 200,
        },
        {
          slot: 2,
          name: "Aegis Sentinel",
          type: "TANK",
          atk: 45,
          def: 80,
          hp: 320,
        },
        {
          slot: 3,
          name: "Aether Healer",
          type: "SUPPORT",
          atk: 50,
          def: 50,
          hp: 220,
        },
      ];

      team = await ColiseumTeam.create({
        userId,
        teamName,
        formation: defaultFormation,
        eloRating: 1200,
        divisionTier: "BRONZE",
        wins: 0,
        losses: 0,
      });
    } else if (formation && Array.isArray(formation)) {
      team.formation = formation;
      if (teamName) team.teamName = teamName;
      await team.save();
    }

    return team.toJSON();
  }

  /**
   * Cari lawan seimbang untuk pertandingan (Matchmaking)
   */
  static async findMatchmakingOpponent(userId, userElo = 1200) {
    const allTeams = await ColiseumTeam.findAll();
    const potentialOpponents = allTeams.filter((t) => t.userId !== userId);

    if (potentialOpponents.length === 0) {
      // NPC Bot Opponent
      return {
        userId: "npc_champion_neo",
        teamName: "Phantom Elite AI",
        eloRating: Math.max(
          1000,
          userElo + Math.floor(Math.random() * 60 - 30),
        ),
        divisionTier: getDivision(userElo),
        formation: [
          {
            slot: 1,
            name: "Shadowblade",
            type: "DPS",
            atk: 80,
            def: 40,
            hp: 200,
          },
          {
            slot: 2,
            name: "Titan Barrier",
            type: "TANK",
            atk: 40,
            def: 80,
            hp: 300,
          },
          {
            slot: 3,
            name: "Nano Priest",
            type: "SUPPORT",
            atk: 50,
            def: 45,
            hp: 220,
          },
        ],
      };
    }

    // Pilih lawan dengan Elo terdekat
    potentialOpponents.sort(
      (a, b) =>
        Math.abs(a.eloRating - userElo) - Math.abs(b.eloRating - userElo),
    );
    return potentialOpponents[0].toJSON();
  }

  /**
   * Jalankan simulasi duel 3v3 asinkron
   */
  static async simulate3v3Battle(attackerUserId, attackerName = "Challenger") {
    const attackerTeam = await this.registerOrGetTeam(attackerUserId);
    const opponentTeam = await this.findMatchmakingOpponent(
      attackerUserId,
      attackerTeam.eloRating,
    );

    const attackerFighters = Array.isArray(attackerTeam.formation)
      ? attackerTeam.formation
      : JSON.parse(attackerTeam.formation);
    const opponentFighters = Array.isArray(opponentTeam.formation)
      ? opponentTeam.formation
      : JSON.parse(opponentTeam.formation);

    let attackerWins = 0;
    let opponentWins = 0;
    const battleLogs = [];

    // Jalankan 3 Ronde 1v1
    for (let r = 0; r < 3; r++) {
      const f1 = attackerFighters[r] || {
        name: `Fighter ${r + 1}`,
        atk: 60,
        def: 50,
        hp: 200,
      };
      const f2 = opponentFighters[r] || {
        name: `Defender ${r + 1}`,
        atk: 60,
        def: 50,
        hp: 200,
      };

      const power1 = f1.atk * 1.5 + f1.def * 1.0 + Math.random() * 30;
      const power2 = f2.atk * 1.5 + f2.def * 1.0 + Math.random() * 30;

      if (power1 >= power2) {
        attackerWins += 1;
        battleLogs.push(
          `${ui.getEmoji("battle") || "⚔️"} **Ronde ${r + 1}:** **${f1.name}** mengalahkan **${f2.name}**!`,
        );
      } else {
        opponentWins += 1;
        battleLogs.push(
          `${ui.getEmoji("shield") || "🛡️"} **Ronde ${r + 1}:** **${f2.name}** memukul mundur **${f1.name}**!`,
        );
      }
    }

    const isAttackerVictory = attackerWins > opponentWins;
    const eloChange = isAttackerVictory ? 30 : -15;

    const newElo = Math.max(800, attackerTeam.eloRating + eloChange);
    const newDivision = getDivision(newElo);

    // Simpan hasil ke database
    const teamRecord = await ColiseumTeam.findOne({
      where: { userId: attackerUserId },
    });
    if (teamRecord) {
      teamRecord.eloRating = newElo;
      teamRecord.divisionTier = newDivision;
      if (isAttackerVictory) teamRecord.wins += 1;
      else teamRecord.losses += 1;
      teamRecord.lastFoughtAt = new Date();
      await teamRecord.save();
    }

    // Reward koin
    let rewardCoins = 0;
    if (isAttackerVictory) {
      rewardCoins = 150;
      await cacheManager.incrementUserSurvival(
        attackerUserId,
        "starFragments",
        rewardCoins,
      );
    }

    logger.info(
      `[Coliseum] Duel 3v3 selesai: ${attackerName} (${attackerWins}-${opponentWins}) vs ${opponentTeam.teamName}. Elo Baru: ${newElo}`,
    );
    return {
      success: true,
      isVictory: isAttackerVictory,
      score: `${attackerWins} - ${opponentWins}`,
      opponentName: opponentTeam.teamName,
      opponentElo: opponentTeam.eloRating,
      eloChange,
      newElo,
      newDivision,
      rewardCoins,
      logs: battleLogs,
    };
  }

  /**
   * Ambil Top 10 Peringkat Global Coliseum
   */
  static async getLeaderboard() {
    const teams = await ColiseumTeam.findAll({
      order: [["eloRating", "DESC"]],
      limit: 10,
    });
    return teams.map((t) => t.toJSON());
  }
}

module.exports = ColiseumEngine;
module.exports.DIVISIONS = DIVISIONS;
