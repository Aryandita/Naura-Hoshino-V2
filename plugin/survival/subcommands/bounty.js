"use strict";

/**
 * @module bounty
 * @description Subcommand /survival bounty - Papan Buronan & Sayembara PvP Wanted Board
 * 
 * Fitur Utama:
 * - List buronan aktif dengan hadiah kepala (reward)
 * - Place bounty pada pemain lain dengan alasan custom
 * - Hunt/berburu buronan melalui duel otomatis
 * - Klaim hadiah saat berhasil mengalahkan buronan
 * - Integrasi dengan duelEngine untuk pertarungan PvP
 * 
 * @requires ../../../src/survival/engines/outlawBountyEngine
 * @requires ../../../src/survival/engines/duelEngine
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/config/ui
 * @requires ../../../src/utils/survivalUIHelper
 */

const outlawEngine = require("../../../src/survival/engines/outlawBountyEngine");
const duelEngine = require("../../../src/survival/engines/duelEngine");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildSuccessContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {Object} SUBCOMMANDS - Daftar subcommand yang tersedia */
const SUBCOMMANDS = {
  LIST: "list",
  PLACE: "place",
  HUNT: "hunt",
};

/** @const {string} DEFAULT_REASON - Alasan default saat place bounty */
const DEFAULT_REASON = "Dicari di alam liar Naura Wilds.";

/** @const {Object} ACCENT_COLORS - Warna aksen untuk berbagai status */
const ACCENT_COLORS = {
  INFO: "#3B82F6",
  DANGER: "#EF4444",
  SUCCESS: "#10B981",
};

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  name: "bounty",
  isSubcommand: true,
  description: "Papan Buronan & Sayembara Pemburu Kepala (PvP Wanted Board) di Naura Wilds",

  /**
   * Eksekusi subcommand bounty
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const sub = interaction.options?.getSubcommand(false) || SUBCOMMANDS.LIST;
    const user = interaction.user;

    try {
      switch (sub) {
        case SUBCOMMANDS.LIST:
          return handleList(interaction, user);
        
        case SUBCOMMANDS.PLACE:
          return handlePlace(interaction, user);
        
        case SUBCOMMANDS.HUNT:
          return handleHunt(interaction, user);
        
        default:
          return handleList(interaction, user);
      }
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Terjadi Kesalahan",
        errorMessage: "Gagal memproses aksi Papan Buronan.",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(errPayload).catch(() => {});
    }
  },
};

// ============================================================================
// SUBCOMMAND HANDLERS
// ============================================================================

/**
 * Handle list buronan aktif
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @returns {Promise<void>}
 */
async function handleList(interaction, user) {
  const board = await outlawEngine.getWantedBoard();

  // Guard: empty board
  if (!board || board.length === 0) {
    const emptyPayload = buildContainerV2({
      accentColorHex: ui.getColor("info") || ACCENT_COLORS.INFO,
      authorName: "NAURA WILDS WANTED BOARD",
      title: "🤠 Papan Buronan Kosong",
      description: [
        "Saat ini tidak ada buronan aktif yang kepalanya dihargai di Naura Wilds.",
        "",
        "Ingin menempatkan buronan atas pemain lain?",
        "Gunakan `/survival bounty place target:@user imbalan:<sc> alasan:<alasan>`",
      ].join("\n"),
      buttonsRow: [survivalUI.buildSurvivalActionRow("combat", user.id)],
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(emptyPayload);
  }

  const lines = board.map((b, idx) => {
    return `${idx + 1}. **<@${b.targetUserId}>**\n> 💰 Hadiah Kepala: **${b.rewardNsf.toLocaleString("id-ID")} SC**\n> 📜 Alasan: *${b.reason}*\n> 🎯 Pemburu Pengaju: <@${b.issuerId}>`;
  });

  const listPayload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.DANGER,
    authorName: "NAURA WILDS WANTED BOARD",
    title: `☠️ Papan Buronan Teratas (${board.length} Buronan)`,
    description: [
      "Para buronan berikut dicari di seluruh pelosok rimba:",
      "",
      lines.join("\n\n"),
      "",
      "- # *Gunakan `/survival bounty hunt target:@user` untuk menantang dan merebut hadiah kepalanya!*",
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", user.id)],
    footerText: ui.getFooter("survival"),
  });
  
  return interaction.editReply(listPayload);
}

/**
 * Handle place bounty pada pemain lain
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user (issuer)
 * @returns {Promise<void>}
 */
async function handlePlace(interaction, user) {
  const target = interaction.options.getUser("target");
  const reward = interaction.options.getInteger("imbalan");
  const reason = interaction.options.getString("alasan") || DEFAULT_REASON;

  const result = await outlawEngine.placeOutlawBounty({
    issuerId: user.id,
    targetUserId: target.id,
    rewardNsf: reward,
    reason,
  });

  if (!result.success) {
    const errPayload = buildErrorContainerV2({
      title: "Gagal Menaruh Buronan",
      errorMessage: result.message,
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(errPayload);
  }

  const successPayload = buildSuccessContainerV2({
    title: "☠️ Buronan Ditempatkan!",
    message: result.message,
    footerText: ui.getFooter("survival"),
  });
  
  return interaction.editReply(successPayload);
}

/**
 * Handle hunt/berburu buronan melalui duel
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user (hunter)
 * @returns {Promise<void>}
 */
async function handleHunt(interaction, user) {
  const target = interaction.options.getUser("target");
  
  // Guard: cannot hunt self
  if (target.id === user.id) {
    const errPayload = buildErrorContainerV2({
      title: "Target Tidak Valid",
      errorMessage: "Kamu tidak bisa memburu dirimu sendiri!",
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(errPayload);
  }

  // Check if target is on wanted board
  const board = await outlawEngine.getWantedBoard();
  const bounty = board.find((b) => b.targetUserId === target.id);

  if (!bounty) {
    const errPayload = buildErrorContainerV2({
      title: "Bukan Buronan",
      errorMessage: `<@${target.id}> tidak memiliki status buronan di papan sayembara.`,
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(errPayload);
  }

  // Run headhunt duel
  const duelResult = await duelEngine.runDuel(user, target);

  if (!duelResult.success) {
    const errPayload = buildErrorContainerV2({
      title: "Pengepungan Gagal",
      errorMessage: duelResult.reason || "Gagal memulai pertarungan pemburuan.",
      footerText: ui.getFooter("survival"),
    });
    return interaction.editReply(errPayload);
  }

  // Hunter wins - claim bounty
  if (duelResult.winnerId === user.id) {
    return handleHunterVictory(interaction, user, target, duelResult);
  } else {
    // Target escapes / hunter loses
    return handleHunterDefeat(interaction, target, duelResult);
  }
}

/**
 * Handle kemenangan hunter - klaim hadiah bounty
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Hunter user
 * @param {Object} target - Target user
 * @param {Object} duelResult - Hasil duel
 * @returns {Promise<void>}
 */
async function handleHunterVictory(interaction, user, target, duelResult) {
  const claimRes = await outlawEngine.claimOutlawBounty(user.id, target.id);

  const victoryPayload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.SUCCESS,
    authorName: "PERBURUAN BURONAN BERHASIL",
    title: "⚔️ Buronan Berhasil Dilumpuhkan!",
    description: [
      `Kakak berhasil mengalahkan buronan <@${target.id}> dalam pertarungan sengit!`,
      "",
      `🎁 **Hadiah Kepala Dicairkan:** **+${claimRes.rewardNsf?.toLocaleString("id-ID")} SC**!`,
      `> Sisa HP Pemburu: **${duelResult.winnerHp} HP**`,
      "",
      "- # *Nama buronan telah dihapus dari Wanted Outlaw Board.*",
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", user.id)],
    footerText: ui.getFooter("survival"),
  });
  
  return interaction.editReply(victoryPayload);
}

/**
 * Handle kekalahan hunter - buronan lolos
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} target - Target user (buronan)
 * @param {Object} duelResult - Hasil duel
 * @returns {Promise<void>}
 */
async function handleHunterDefeat(interaction, target, duelResult) {
  const defeatPayload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.DANGER,
    authorName: "PERBURUAN BURONAN GAGAL",
    title: "☠️ Buronan Berhasil Melarikan Diri!",
    description: [
      `Buronan <@${target.id}> terlalu tangguh dan berhasil mengalahkanmu!`,
      "",
      `> Sisa HP Buronan: **${duelResult.winnerHp} HP**`,
      "Tingkatkan atribut dan perlengkapanmu sebelum menantangnya kembali!",
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
    footerText: ui.getFooter("survival"),
  });
  
  return interaction.editReply(defeatPayload);
}
