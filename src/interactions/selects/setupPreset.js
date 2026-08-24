"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const GuildSettings = require("../../models/GuildSettings");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

module.exports = [
  {
    id: "setup_preset",
    label: "setup-preset-select",
    async handler(interaction) {
      // Hanya admin yang boleh mengatur preset
      if (!interaction.member.permissions.has("Administrator") && !interaction.member.permissions.has("ManageGuild")) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          errorMessage:
            "Hanya Administrator server yang bisa menggunakan Setup Wizard ini.",
          footerText: "Naura Setup Wizard",
        });
        return interaction.reply({
          ...errPayload,
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const preset = interaction.values[0];
      const guildId = interaction.guildId;

      try {
        const [settings] = await GuildSettings.findOrCreate({
          where: { guildId },
        });

        // Ambil current settings
        const currentSettings = settings.settings || {};

        // Menerapkan perubahan berdasarkan preset
        if (preset === "preset_community") {
          currentSettings.automod = {
            enabled: true,
            antiInvite: true,
            antiCaps: true,
            massMention: 5,
            antiSpam: true,
            badWords: [],
          };
          currentSettings.features = {
            leveling: true,
            economy: true,
            music: true,
          };
        } else if (preset === "preset_gaming") {
          currentSettings.automod = {
            enabled: false,
            antiInvite: false,
            antiCaps: false,
            massMention: 10,
            antiSpam: true,
            badWords: [],
          };
          currentSettings.features = {
            leveling: true,
            economy: true,
            music: true,
          };
        } else if (preset === "preset_minimal") {
          currentSettings.automod = {
            enabled: false,
            antiInvite: false,
            antiCaps: false,
            massMention: 5,
            antiSpam: false,
            badWords: [],
          };
          currentSettings.features = {
            leveling: false,
            economy: false,
            music: true,
          };
        }

        settings.settings = currentSettings;
        settings.changed("settings", true);
        await settings.save();

        // Jangan lupa membersihkan cache
        cacheManager.invalidateGuildSettings(guildId);

        const successPayload = buildContainerV2({
          accentColorHex: "#10B981",
          title: "Preset Diterapkan",
          description: `Preset **${preset.replace("preset_", "").toUpperCase()}** telah berhasil diterapkan pada server ini!\n\nSemua konfigurasi dasar sudah diatur. Anda bisa menggunakan perintah \`/setup\` untuk kustomisasi lebih lanjut.`,
          footerText: "Naura Setup Wizard",
        });

        return interaction.editReply(successPayload);
      } catch (error) {
        logger.error(
          `[ONBOARDING PRESET] Gagal menyimpan preset untuk ${guildId}:`,
          error,
        );
        const errPayload = buildErrorContainerV2({
          title: "Terjadi Kesalahan",
          errorMessage:
            "Gagal menyimpan pengaturan preset. Silakan coba lagi nanti.",
          footerText: "Naura Setup Wizard",
        });
        return interaction.editReply(errPayload);
      }
    },
  },
];
