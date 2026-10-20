"use strict";

// Quick Action Menu untuk /survival quick - Select menu cepat untuk aksi survival terpopuler
// tanpa perlu ketik command panjang.

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");

const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const { logger } = require("../../../src/managers/logger");

function e(name, fallback) {
  const ui = require("../../../src/config/ui");
  return ui.getEmoji(name) || fallback || "";
}

module.exports = {
  async autocomplete(interaction) {
    return interaction.respond([]).catch(() => {});
  },

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
              .setCustomId(`survival_quick_select:${userId}`)
              .setPlaceholder("Pilih kategori aksi...")
              .addOptions([
                {
                  label: "Kumpul Bahan",
                  description: "Tebang pohon, tambang batu, atau mancing ikan",
                  value: "gathering",
                  emoji: "⛏️",
                },
                {
                  label: "Perawatan Diri",
                  description: "Makan, minum, istirahat, pulihkan HP/stamina",
                  value: "vitals",
                  emoji: "❤️",
                },
                {
                  label: "Petualangan",
                  description: "Masuk dungeon, duel, atau zona bahaya",
                  value: "combat",
                  emoji: "🗡️",
                },
                {
                  label: "Ekonomi",
                  description: "Toko desa, bank, dompet, cari nafkah",
                  value: "economy",
                  emoji: "🛒",
                },
                {
                  label: "Inventaris",
                  description: "Buka ransel, craft item, perbaiki alat",
                  value: "inventory",
                  emoji: "📦",
                },
                {
                  label: "Desa Sukamaju",
                  description: "Kafe, bank, sapa warga, peta wilayah",
                  value: "town",
                  emoji: "🏘️",
                },
                {
                  label: "Premium Naura",
                  description: "Lihat manfaat tier VIP, beli upgrade",
                  value: "premium",
                  emoji: "💎",
                },
              ]),
          ),
          new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId(`survival_quick_info:${userId}`)
              .setLabel("Panduan Lengkap")
              .setStyle(ButtonStyle.Secondary)
              .setEmoji("📖"),
            new ButtonBuilder()
              .setCustomId(`survival_quick_status:${userId}`)
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
