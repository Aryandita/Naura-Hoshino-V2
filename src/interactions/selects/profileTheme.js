"use strict";

const { MessageFlags } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

const PALETTE_NAMES = {
  neon_pink: "🌸 Cyber Neon Pink",
  cyber_blue: "🌊 Stellar Cyber Blue",
  emerald_nature: "🌿 Naura Wilds Emerald",
  sunset_gold: "🌟 Cosmic Solar Gold",
  dark_obsidian: "🌑 Midnight Obsidian",
};

module.exports = [
  {
    id: "sel_profile_theme",
    label: "profile-theme-select",
    onError: "Gagal memperbarui tema profil.",
    async handler(interaction) {
      const selectedPalette = interaction.values[0];
      const userId = interaction.user.id;

      await cacheManager.mutateUserProfileJson(userId, "activeBanners", (raw) => {
        const banners = typeof raw === "string" ? JSON.parse(raw || "{}") : { ...(raw || {}) };
        banners.profile_theme = selectedPalette;
        return banners;
      });

      cacheManager.smartInvalidateUserCanvas(userId);

      const themeName = PALETTE_NAMES[selectedPalette] || selectedPalette;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Profile Studio",
        title: "🎨 Tema Kartu Profil Diperbarui!",
        description: [
          `Palet warna kartu profil kamu berhasil diubah ke: **${themeName}**!`,
          "",
          "Gunakan `/profile view` untuk melihat tampilan baru kartu profil Canvas kamu.",
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
