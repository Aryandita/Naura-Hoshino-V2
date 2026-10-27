"use strict";

/**
 * @module achievements
 * @description Subcommand /survival achievements - Hall of Fame & Gelar Pencapaian
 * 
 * Fitur Utama:
 * - Menampilkan daftar pencapaian/gelar yang telah dibuka
 * - Select menu untuk memilih gelar aktif di profil
 * - Render canvas achievement banner saat gelar diganti
 * - Collector timeout handling dengan pesan informatif
 * 
 * @requires discord.js
 * @requires ../../../src/managers/logger
 * @requires ../../../src/models/UserAchievement
 * @requires ../../../src/survival/data/achievementsData
 * @requires ../../../src/canvas/canvasWorkerPool
 * @requires ../../../src/config/ui
 * @requires ../../../src/utils/NauraContainerBuilder
 */

const { logger } = require("../../../src/managers/logger");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
} = require("discord.js");
const UserAchievement = require("../../../src/models/UserAchievement");
const achievementsPool = require("../../../src/survival/data/achievementsData");
const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");
const ui = require("../../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {number} COLLECTOR_TIMEOUT_MS - Waktu timeout collector dalam milidetik */
const COLLECTOR_TIMEOUT_MS = 60000;

/** @const {RegExp} CUSTOM_EMOJI_REGEX - Regex untuk parsing custom emoji Discord */
const CUSTOM_EMOJI_REGEX = /^<(a)?:(\w+):(\d+)>$/;

/** @const {string} ACHIEVEMENT_IMAGE_NAME - Nama file untuk achievement banner */
const ACHIEVEMENT_IMAGE_NAME = "achievement.png";

/** @const {string} SELECT_MENU_CUSTOM_ID - Custom ID untuk select menu gelar */
const SELECT_MENU_CUSTOM_ID = "set_active_title";

/** @const {number} MAX_LABEL_LENGTH - Panjang maksimum label option select menu */
const MAX_LABEL_LENGTH = 100;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Mendapatkan emoji dari UI config dengan fallback
 * @param {string} name - Nama emoji
 * @param {string} fallback - Emoji fallback jika tidak ditemukan
 * @returns {string} Emoji string
 */
function getEmoji(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Parse raw emoji string ke format objek untuk select menu
 * Select menu menolak emoji kustom dalam bentuk teks mentah
 * @param {string} raw - Raw emoji string
 * @returns {Object|string|undefined} Objek emoji Discord atau unicode emoji
 */
function toSelectEmoji(raw) {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  const match = raw.match(CUSTOM_EMOJI_REGEX);
  if (!match) return raw;
  return { id: match[3], name: match[2], animated: Boolean(match[1]) };
}

/**
 * Format daftar pencapaian untuk ditampilkan
 * @param {Array<Object>} achievements - Array achievement yang unlocked
 * @returns {string} Formatted markdown list
 */
function formatAchievementList(achievements) {
  return achievements
    .map((a) => `> ${a.emoji} **${a.title}**\n> *${a.description}*`)
    .join("\n\n");
}

/**
 * Build select menu options dari achievement list
 * @param {Array<Object>} achievements - Array achievement yang unlocked
 * @returns {Array<Object>} Array option objects untuk select menu
 */
function buildSelectOptions(achievements) {
  return achievements.map((a) => {
    const option = {
      label: a.title.substring(0, MAX_LABEL_LENGTH),
      description: (a.description || "").substring(0, MAX_LABEL_LENGTH),
      value: a.id,
    };
    const emoji = toSelectEmoji(a.emoji);
    if (emoji) option.emoji = emoji;
    return option;
  });
}

/**
 * Render achievement banner menggunakan canvas worker
 * @param {Object} user - Discord user object
 * @param {Object} achievement - Achievement data
 * @returns {Promise<{files: Array, bannerName: string|null}>}
 */
async function renderAchievementBanner(user, achievement) {
  const files = [];
  let bannerName = null;

  try {
    const buffer = await canvasWorkerPool.execute({
      task: "renderAchievement",
      payload: {
        user,
        title: achievement.title,
        subtitle: achievement.description,
        badgeColor: achievement.color,
      },
      userId: user.id,
    });
    files.push(new AttachmentBuilder(buffer, { name: ACHIEVEMENT_IMAGE_NAME }));
    bannerName = ACHIEVEMENT_IMAGE_NAME;
  } catch (err) {
    logger.warn("[achievements:execute] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
  }

  return { files, bannerName };
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  /**
   * Eksekusi subcommand achievements
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const user = interaction.user;
    
    // Fetch or create user achievement data
    const [achievementData] = await UserAchievement.findOrCreate({
      where: { userId: user.id },
    });

    const unlockedIds = achievementData.unlockedAchievements || [];
    const unlocked = achievementsPool.filter((a) => unlockedIds.includes(a.id));

    // Guard: no achievements unlocked
    if (unlocked.length === 0) {
      return ui.sendError(interaction, "err_sys_33", true);
    }

    // Get active title info
    const activeTitle = achievementData.activeTitle
      ? achievementsPool.find((a) => a.id === achievementData.activeTitle)
      : null;

    // Build achievement list display
    const daftar = formatAchievementList(unlocked);

    // Build select menu
    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId(SELECT_MENU_CUSTOM_ID)
      .setPlaceholder("Pilih gelar yang mau dipakai di profilmu")
      .addOptions(buildSelectOptions(unlocked));

    const row = new ActionRowBuilder().addComponents(selectMenu);

    // Build initial response payload
    const payload = buildContainerV2({
      accentColorHex: "#FFD700",
      authorName: "Naura Hall of Fame",
      title: `${getEmoji("impressed", "🏆")} Koleksi pencapaian ${user.username}`,
      iconURL: user.displayAvatarURL(),
      description: `Naura simpan semua gelar yang sudah kamu raih di sini. Bangga banget lihat daftarnya sepanjang ini!\n\n${daftar}`,
      buttonsRow: [row],
      footerText: activeTitle
        ? `Gelar aktif: ${activeTitle.emoji} ${activeTitle.title}`
        : ui.getFooter("survival"),
    });

    await interaction.reply(payload);
    const message = await interaction.fetchReply();

    // Setup collector for title selection
    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_TIMEOUT_MS,
    });

    let selectionCompleted = false;

    collector.on("collect", async (i) => {
      if (i.customId !== SELECT_MENU_CUSTOM_ID) return;

      await i.deferUpdate();

      const selected = achievementsPool.find((a) => a.id === i.values[0]);
      if (!selected) return;

      // Update active title in database
      achievementData.activeTitle = selected.id;
      await achievementData.save({ fields: ["activeTitle"] });

      // Render achievement banner
      const { files, bannerName } = await renderAchievementBanner(user, selected);

      // Build success response
      const updated = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#00FF00",
        authorName: "Naura Hall of Fame",
        title: `${getEmoji("cheers", "🎉")} Gelarmu sudah Naura ganti!`,
        iconURL: user.displayAvatarURL(),
        description: `Yaay! Mulai sekarang kamu resmi menyandang gelar **${selected.title}**. Cocok banget sama kamu, lho!`,
        bannerAttachmentName: bannerName,
        files,
        footerText: ui.getFooter("survival"),
      });

      selectionCompleted = true;
      await i.editReply(updated);
      collector.stop("selected");
    });

    collector.on("end", async (collected, reason) => {
      if (selectionCompleted || reason !== "time") return;

      const timeout = buildErrorContainerV2({
        title: `${getEmoji("sleepy", "⌛")} Waktunya sudah habis`,
        description:
          "Naura tunggu agak lama, tapi belum ada gelar yang dipilih. Nggak apa-apa, panggil Naura lagi kapan saja yaa!",
        footerText: ui.getFooter("survival"),
      });

      await interaction.editReply(timeout).catch(() => {});
    });
  },
};
