"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("./NauraContainerBuilder");

/**
 * Memvalidasi apakah interaksi komponen dijalankan oleh pemilik pesan.
 * Menghalangi interupsi pengguna lain dengan copy anti-slop ramah khas Naura.
 *
 * @param {import('discord.js').Interaction} interaction
 * @param {string} expectedUserId
 * @param {string} commandName
 * @returns {Promise<boolean>}
 */
async function validateHubOwner(interaction, expectedUserId, commandName = "menu") {
  if (interaction.user.id === expectedUserId) {
    return true;
  }

  await interaction.reply({
    ...buildErrorContainerV2({
      title: "Sesi Khusus Pemilik",
      errorMessage: `Ehh, menu interaktif ini sedang digunakan oleh <@${expectedUserId}>. Ketik \`/${commandName}\` untuk membuka sesimu sendiri ya! ✨`,
      lang: interaction.localeLang,
      expression: "sleepy",
    }),
    flags: MessageFlags.Ephemeral,
  }).catch(() => {});

  return false;
}

/**
 * Membangun payload Components V2 untuk Hub Menu Interaktif.
 *
 * @param {object} params
 * @param {string} params.title - Judul header
 * @param {string} params.authorName - Nama author/kategori
 * @param {string} params.description - Penjelasan isi hub
 * @param {string} [params.accentColorHex] - Token warna hex
 * @param {Array<{id: string, label: string, emoji?: string, style?: ButtonStyle}>} params.quickButtons - Tombol pintas cepat (2-3 fitur utama)
 * @param {Array<{value: string, label: string, description?: string, emoji?: string}>} params.selectOptions - Daftar lengkap opsi dropdown
 * @param {string} params.selectPlaceholder - Placeholder untuk dropdown
 * @param {string} params.category - Kode kategori (minigame/fun/tool/ai)
 * @param {string} params.userId - ID pengguna pemanggil
 * @param {string} [params.lang] - Bahasa
 * @returns {object} Payload message untuk interaction.reply
 */
function buildInteractiveHubPayload({
  title,
  authorName,
  description,
  accentColorHex = "#7B68EE",
  quickButtons = [],
  selectOptions = [],
  selectPlaceholder = "Pilih fitur atau permainan...",
  category,
  userId,
  lang,
}) {
  const rows = [];

  // 1. Baris Quick Action Buttons (Fitur Terpopuler)
  if (Array.isArray(quickButtons) && quickButtons.length > 0) {
    const btnRow = new ActionRowBuilder();
    quickButtons.slice(0, 5).forEach((btn) => {
      btnRow.addComponents(
        new ButtonBuilder()
          .setCustomId(`hub_btn:${category}:${btn.id}:${userId}`)
          .setLabel(btn.label)
          .setStyle(btn.style || ButtonStyle.Primary)
          .setEmoji(btn.emoji || "✨"),
      );
    });
    rows.push(btnRow);
  }

  // 2. Baris Select Menu (Katalog Lengkap)
  if (Array.isArray(selectOptions) && selectOptions.length > 0) {
    const menuRow = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId(`hub_sel:${category}:${userId}`)
        .setPlaceholder(selectPlaceholder)
        .addOptions(
          selectOptions.slice(0, 25).map((opt) => ({
            label: opt.label.slice(0, 100),
            value: opt.value.slice(0, 100),
            description: opt.description ? opt.description.slice(0, 100) : undefined,
            emoji: opt.emoji || undefined,
          })),
        ),
    );
    rows.push(menuRow);
  }

  return buildContainerV2({
    title,
    authorName,
    description,
    accentColorHex,
    buttonsRow: rows,
    lang,
    footerCategory: "default",
  });
}

module.exports = {
  validateHubOwner,
  buildInteractiveHubPayload,
};
