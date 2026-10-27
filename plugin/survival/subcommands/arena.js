"use strict";

/**
 * @module arena
 * @description Subcommand /survival arena - PvP Arena, Coliseum 3v3, dan Pet Battle
 * 
 * Fitur Utama:
 * - Leaderboard Arena PvP (MMR ranking)
 * - Statistik pribadi pemain (MMR, Win Rate, K/D Ratio)
 * - Coliseum 3v3 Championship dengan simulasi battle
 * - Manajemen tim/formasi Coliseum
 * - Coliseum Leaderboard (Top 10 Global)
 * - Pet Battle Arena (PvP MMR dengan pet)
 * - Pet Arena Leaderboard dengan divisi tier
 * 
 * @requires discord.js
 * @requires ../../../src/managers/logger
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/config/ui
 * @requires ../../../src/utils/survivalUIHelper
 * @requires ../../../src/models/DuelRecord
 * @requires ../../../src/models/UserProfile
 */

const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const DuelRecord = require("../../../src/models/DuelRecord");
const UserProfile = require("../../../src/models/UserProfile");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {number} LEADERBOARD_LIMIT - Jumlah maksimum pemain di leaderboard */
const LEADERBOARD_LIMIT = 10;

/** @const {Object} MEDAL_EMOJIS - Emoji medali untuk peringkat top 3 */
const MEDAL_EMOJIS = {
  FIRST: "🥇",
  SECOND: "🥈",
  THIRD: "🥉",
};

/** @const {Object} MENU_ACTIONS - Daftar aksi menu yang tersedia */
const MENU_ACTIONS = {
  LEADERBOARD: "leaderboard",
  STATS: "stats",
  COLISEUM_MATCH: "coliseum_match",
  COLISEUM_TEAM: "coliseum_team",
  COLISEUM_LEADERBOARD: "coliseum_leaderboard",
  PET_BATTLE: "pet_battle",
  PET: "pet",
  PET_LEADERBOARD: "pet_leaderboard",
};

/** @const {Object} PET_DIVISION_THRESHOLDS - Threshold MMR untuk divisi pet arena */
const PET_DIVISION_THRESHOLDS = {
  MASTER: 2200,
  DIAMOND: 1900,
  PLATINUM: 1600,
  GOLD: 1300,
  SILVER: 1100,
};

/** @const {string} COLISEUM_IMAGE_NAME - Nama file untuk render coliseum match */
const COLISEUM_IMAGE_NAME = "coliseum_match.png";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Mendapatkan emoji dari UI config dengan fallback
 * @param {string} name - Nama emoji
 * @param {string} [fallback=""] - Emoji fallback
 * @returns {string} Emoji string
 */
function getEmoji(name, fallback = "") {
  return ui.getEmoji(name) || fallback;
}

/**
 * Mendapatkan emoji medali berdasarkan index peringkat
 * @param {number} index - Index peringkat (0-based)
 * @returns {string} Emoji medali atau formatted rank
 */
function getMedalEmoji(index) {
  if (index === 0) return MEDAL_EMOJIS.FIRST;
  if (index === 1) return MEDAL_EMOJIS.SECOND;
  if (index === 2) return MEDAL_EMOJIS.THIRD;
  return `**#${index + 1}**`;
}

/**
 * Hitung win rate percentage
 * @param {number} wins - Jumlah kemenangan
 * @param {number} totalMatches - Total pertandingan
 * @returns {string} Win rate formatted dengan 1 desimal
 */
function calculateWinRate(wins, totalMatches) {
  if (totalMatches <= 0) return "0";
  return ((wins / totalMatches) * 100).toFixed(1);
}

/**
 * Hitung K/D ratio
 * @param {number} kills - Jumlah kill
 * @param {number} deaths - Jumlah death
 * @returns {string|number} K/D ratio formatted
 */
function calculateKDRatio(kills, deaths) {
  if (deaths <= 0) return kills;
  return (kills / deaths).toFixed(2);
}

/**
 * Format ELO change dengan prefix +/-
 * @param {number} eloChange - Perubahan ELO
 * @returns {string} Formatted ELO change
 */
function formatEloChange(eloChange) {
  return eloChange > 0 ? `+${eloChange}` : `${eloChange}`;
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  /**
   * Eksekusi subcommand arena
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const menu = interaction.options.getString("menu");

    switch (menu) {
      case MENU_ACTIONS.LEADERBOARD:
        return handleLeaderboard(interaction);
      
      case MENU_ACTIONS.STATS:
        return handleStats(interaction);
      
      case MENU_ACTIONS.COLISEUM_MATCH:
        return handleColiseumMatch(interaction);
      
      case MENU_ACTIONS.COLISEUM_TEAM:
        return handleColiseumTeam(interaction);
      
      case MENU_ACTIONS.COLISEUM_LEADERBOARD:
        return handleColiseumLeaderboard(interaction);
      
      case MENU_ACTIONS.PET_BATTLE:
      case MENU_ACTIONS.PET:
        return handlePetBattle(interaction);
      
      case MENU_ACTIONS.PET_LEADERBOARD:
        return handlePetLeaderboard(interaction);
      
      default:
        return handleLeaderboard(interaction);
    }
  },
};

// ============================================================================
// ARENA PVP HANDLERS
// ============================================================================

/**
 * Handle leaderboard Arena PvP
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleLeaderboard(interaction) {
  const topPlayers = await DuelRecord.findAll({
    order: [["mmr", "DESC"]],
    limit: LEADERBOARD_LIMIT,
    include: [{ model: UserProfile, attributes: ["userId"] }],
  });

  const seasonEngine = require("../../../src/services/seasonEngine");
  const seasonName = seasonEngine.CURRENT_SEASON.name;

  // Guard: no players
  if (!topPlayers || topPlayers.length === 0) {
    return interaction.editReply(
      buildContainerV2({
        accentColorHex: ui.getColor("warning"),
        title: `${getEmoji("trophy")} Papan Peringkat Arena • ${seasonName}`,
        description: "Belum ada petarung yang tercatat di Arena musim ini.",
        expression: "Sleepy",
        buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
        footerText: ui.getFooter("survival"),
      }),
    );
  }

  const leaderboardText = topPlayers
    .map((player, index) => {
      const medal = getMedalEmoji(index);
      const wr = calculateWinRate(player.wins, player.matchesPlayed);
      return `${medal} <@${player.userId}> • **${player.mmr} MMR** (WR: ${wr}%)`;
    })
    .join("\n");

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: survivalUI.getColor("emerald"),
      title: `${getEmoji("trophy")} Papan Peringkat Arena • ${seasonName}`,
      description: `Musim kompetisi aktif: **${seasonName}**\n\n${leaderboardText}`,
      expression: "Impressed",
      buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
      footerText: ui.getFooter("survival"),
    }),
  );
}

/**
 * Handle statistik pribadi pemain
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleStats(interaction) {
  const user = interaction.user;
  const [record] = await DuelRecord.findOrCreate({
    where: { userId: user.id },
  });

  const wr = calculateWinRate(record.wins, record.matchesPlayed);
  const kd = calculateKDRatio(record.kills, record.deaths);

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      authorName: user.username,
      iconURL: user.displayAvatarURL(),
      title: "📊 Statistik Arena (PvP)",
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

// ============================================================================
// COLISEUM 3V3 HANDLERS
// ============================================================================

/**
 * Handle Coliseum 3v3 match simulation
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleColiseumMatch(interaction) {
  const coliseumEngine = require("../../../src/survival/engines/coliseumEngine");
  const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");
  const { AttachmentBuilder } = require("discord.js");

  const user = interaction.user;
  const battleRes = await coliseumEngine.simulate3v3Battle(
    user.id,
    user.displayName || user.username,
  );
  
  const files = [];

  // Render match result card
  try {
    const matchBuf = await canvasWorkerPool.execute({
      task: "renderColiseumMatch",
      payload: {
        attackerName: user.displayName || user.username,
        opponentName: battleRes.opponentName,
        opponentElo: battleRes.opponentElo,
        isVictory: battleRes.isVictory,
        score: battleRes.score,
        eloChange: formatEloChange(battleRes.eloChange),
        elo: battleRes.newElo,
        division: battleRes.newDivision,
      },
      userId: user.id,
    });
    files.push(new AttachmentBuilder(matchBuf, { name: COLISEUM_IMAGE_NAME }));
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
      "",
      ...battleRes.logs,
      "",
      `📊 **Hasil Rating:** \`${formatEloChange(battleRes.eloChange)} ELO\` (Total: \`${battleRes.newElo} ELO\` | Divisi: **${battleRes.newDivision}**)`,
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

/**
 * Handle tampilan formasi tim Coliseum
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleColiseumTeam(interaction) {
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
      "Formasi 3v3 ini akan bertarung saat kamu menantang pemain lain atau saat timmu diserang saat offline!",
      "",
      `👑 **Divisi:** \`${team.divisionTier}\` (Rating: \`${team.eloRating} ELO\`)`,
      `🏆 **Rekor Tempur:** \`${team.wins} Menang / ${team.losses} Kalah\``,
      "",
      "👥 **Anggota Formasi Skuad:**",
      fighterList,
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle Coliseum global leaderboard
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleColiseumLeaderboard(interaction) {
  const coliseumEngine = require("../../../src/survival/engines/coliseumEngine");
  const topTeams = await coliseumEngine.getLeaderboard();

  const lbList = topTeams
    .map((t, idx) => {
      const medal = getMedalEmoji(idx);
      return `${medal} <@${t.userId}>, **${t.teamName}** (\`${t.divisionTier}\` | **${t.eloRating} ELO**)`;
    })
    .join("\n");

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getRarityColor("legendary"),
    authorName: "👑 Papan Peringkat Divisi Master Galactic Coliseum",
    title: "🏆 Top 10 Juara Global",
    description: lbList || "*Belum ada tim yang bertanding di Coliseum musim ini.*",
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

// ============================================================================
// PET BATTLE ARENA HANDLERS
// ============================================================================

/**
 * Handle Pet Battle Arena (PvP MMR)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handlePetBattle(interaction) {
  const UserPet = require("../../../src/models/UserPet");
  const petBattleEngine = require("../../../src/survival/engines/petBattleEngine");

  // Find active pet or any tamed pet
  let activePet = await UserPet.findOne({
    where: { userId: interaction.user.id, isActive: true },
  });

  if (!activePet) {
    activePet = await UserPet.findOne({
      where: { userId: interaction.user.id, isTamed: true },
    });
  }

  // Guard: no pet available
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

  // Check for target opponent
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

  // Generate wild AI challenger if no player opponent
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

/**
 * Handle Pet Arena Leaderboard dengan info divisi
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handlePetLeaderboard(interaction) {
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
      `• 👑 **Master Rimba** (≥ ${PET_DIVISION_THRESHOLDS.MASTER} MMR)`,
      `• 💠 **Diamond** (${PET_DIVISION_THRESHOLDS.DIAMOND} - ${PET_DIVISION_THRESHOLDS.MASTER - 1} MMR)`,
      `• 💎 **Platinum** (${PET_DIVISION_THRESHOLDS.PLATINUM} - ${PET_DIVISION_THRESHOLDS.DIAMOND - 1} MMR)`,
      `• 🥇 **Gold** (${PET_DIVISION_THRESHOLDS.GOLD} - ${PET_DIVISION_THRESHOLDS.PLATINUM - 1} MMR)`,
      `• 🥈 **Silver** (${PET_DIVISION_THRESHOLDS.SILVER} - ${PET_DIVISION_THRESHOLDS.GOLD - 1} MMR)`,
      `• 🥉 **Bronze** (< ${PET_DIVISION_THRESHOLDS.SILVER} MMR)`,
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
