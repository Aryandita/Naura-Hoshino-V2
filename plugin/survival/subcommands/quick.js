"use strict";

/**
 * @module quick
 * @description Subcommand /survival quick - Menu aksi cepat dengan select menu untuk navigasi fitur survival.
 * 
 * Fitur Utama:
 * - Select menu kategori aksi (Gathering, Vitals, Combat, Economy, Inventory, Town, Premium)
 * - Tombol shortcut ke panduan lengkap dan cek status diri
 * - Autocomplete handler (placeholder, return empty)
 * - Error handling dengan logger dan error container V2
 * - UI Components V2 dengan emoji dan deskripsi per opsi
 * 
 * Kategori Aksi:
 * - gathering: Tebang, tambang, mancing
 * - vitals: Makan, minum, istirahat, HP
 * - combat: Dungeon, duel, zona bahaya
 * - economy: Toko, bank, dompet, nafkah
 * - inventory: Ransel, craft, repair
 * - town: Kafe, bank, warga, peta
 * - premium: VIP tier, upgrade
 */

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const { logger } = require("../../../src/managers/logger");

// ============================================================================
// CONSTANTS
// ============================================================================

const QUICK_SELECT_PREFIX = "survival_quick_select";
const QUICK_INFO_PREFIX = "survival_quick_info";
const QUICK_STATUS_PREFIX = "survival_quick_status";

const ACTION_CATEGORIES = [
  { label: "Kumpul Bahan", description: "Tebang pohon, tambang batu, atau mancing ikan", value: "gathering", emoji: "⛏️" },
  { label: "Perawatan Diri", description: "Makan, minum, istirahat, pulihkan HP/stamina", value: "vitals", emoji: "❤️" },
  { label: "Petualangan", description: "Masuk dungeon, duel, atau zona bahaya", value: "combat", emoji: "🗡️" },
  { label: "Ekonomi", description: "Toko desa, bank, dompet, cari nafkah", value: "economy", emoji: "🛒" },
  { label: "Inventaris", description: "Buka ransel, craft item, perbaiki alat", value: "inventory", emoji: "📦" },
  { label: "Desa Sukamaju", description: "Kafe, bank, sapa warga, peta wilayah", value: "town", emoji: "🏘️" },
  { label: "Premium Naura", description: "Lihat manfaat tier VIP, beli upgrade", value: "premium", emoji: "💎" },
];

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mengambil emoji dari config atau fallback ke unicode
 * @param {string} name - Nama emoji di config
 * @param {string} fallback - Unicode emoji fallback
 * @returns {string} Emoji string
 */
function e(name, fallback) {
  const ui = require("../../../src/config/ui");
  return ui.getEmoji(name) || fallback || "";
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Autocomplete handler (placeholder, tidak ada opsi dinamis)
   * @param {import('discord.js').AutocompleteInteraction} interaction
   */
  async autocomplete(interaction) {
    return interaction.respond([]).catch(() => {});
  },

  /**
   * Handler utama untuk command /survival quick
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    const user = interaction.user;
    const userId = user.id;

    try {
      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("emerald"),
        authorName: `Naura Wilds • Aksi Cepat`,
        title: "🚀 Menu Aksi Cepat Survival",
        iconURL: user.displayAvatarURL(),
        expression: "Cheers",
        description:
          "Pilih aksi yang ingin kamu lakukan dari menu di bawah. Naura akan membantu kamu langsung melanjutkan petualangan tanpa harus mengetik command panjang!\n\n" +
          "**Aksi Tersedia:**\n" +
          "• ⛏️ **Kumpul Bahan** – Tebang, tambang, atau mancing\n" +
          "• ❤️ **Perawatan Diri** – Makan, minum, istirahat, pulihkan HP\n" +
          "• 🗡️ **Petualangan** – Masuk dungeon, duel, atau zona bahaya\n" +
          "• 🛒 **Ekonomi** – Toko, bank, dompet, transaksi\n" +
          "• 📦 **Inventaris** – Buka ransel, craft, perbaiki alat\n" +
          "• 🏘️ **Desa** – Kunjungi kafe, bank, sapa warga, peta wilayah\n" +
          "• 💎 **Premium** – Lihat manfaat tier VIP, beli upgrade\n",
        buttonsRow: [
          new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
              .setCustomId(`${QUICK_SELECT_PREFIX}:${userId}`)
              .setPlaceholder("Pilih kategori aksi...")
              .addOptions(ACTION_CATEGORIES),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`${QUICK_INFO_PREFIX}:${userId}`)
              .setLabel("Panduan Lengkap")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("📖"),
            new ButtonBuilder()
              .setCustomId(`${QUICK_STATUS_PREFIX}:${userId}`)
              .setLabel("Cek Status Diri")
              .setStyle(ButtonStyle.Primary)
              .setEmoji("👤"),
          ),
        ],
        footerText: survivalUI.getFooter(),
      });

      return await interaction.editReply(payload);
    } catch (error) {
      logger.error("[Survival Quick] Error:", error);
      const errPayload = buildErrorContainerV2({
        title: `${e("naura_cry", "😢")} Naura gagal membuka menu aksi cepat`,
        description:
          "Maaf ya, ada yang tersangkut waktu Naura menyusun menu ini. Coba lagi sebentar lagi!",
        footerText: survivalUI.getFooter(),
      });
      return interaction.editReply(errPayload);
    }
  },
};
