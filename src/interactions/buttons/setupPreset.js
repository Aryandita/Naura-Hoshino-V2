"use strict";

const { MessageFlags } = require("discord.js");
const { invalidateGuildSettings } = require("../../managers/cacheManager");
const GuildSettings = require("../../models/GuildSettings");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "setup_preset_",
    label: "setup-preset",
    async handler(interaction) {
      // Hanya administrator (atau orang yg memiliki manage guild) yang bisa mengatur
      if (!interaction.member.permissions.has("ManageGuild")) {
        return interaction.reply({
          content:
            "❌ Maaf, hanya Admin server yang bisa menggunakan tombol setup ini.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const preset = interaction.customId.split("_")[2];
      const guildId = interaction.guild.id;

      try {
        const [guildData] = await GuildSettings.findOrCreate({
          where: { guildId },
        });

        // Setel fitur default berdasarkan preset
        const features = guildData.settings.features || {
          leveling: false,
          economy: false,
          music: true,
        };

        let description = "";

        if (preset === "community") {
          features.leveling = true;
          features.economy = true;
          features.music = true;
          description =
            "Semua fitur sosial (Leveling, Economy, Music) telah diaktifkan!";
        } else if (preset === "gaming") {
          features.leveling = true;
          features.economy = false;
          features.music = true;
          description =
            "Fitur Leveling dan Musik telah diaktifkan untuk pengalaman gaming yang asyik!";
        } else if (preset === "minimal") {
          features.leveling = false;
          features.economy = false;
          features.music = true;
          description =
            "Hanya fitur Musik inti yang aktif agar server tetap rapi dan tidak berisik.";
        }

        guildData.settings.features = features;
        guildData.changed("settings", true);
        await guildData.save({ fields: ["settings"] });
        invalidateGuildSettings(guildId);

        // Render container hasil
        const container = buildContainerV2({
          title: `✅ Preset ${preset.toUpperCase()} Berhasil Diterapkan!`,
          description: `${description}\n\nTerima kasih! Naura sudah menyesuaikan fitur server sesuai pilihan kakak:\n\n**Status Fitur:**\n- 🌟 Leveling: **${features.leveling ? "ON" : "OFF"}**\n- 💰 Ekonomi: **${features.economy ? "ON" : "OFF"}**\n- 🎵 Musik: **${features.music ? "ON" : "OFF"}**\n\nUntuk pengaturan lebih detail, kakak bisa gunakan \`/setup\`.`,
          color: "#10B981",
        });

        return interaction.update(container);
      } catch (error) {
        return interaction.reply({
          content: "❌ Terjadi kesalahan saat menyimpan pengaturan preset.",
          flags: MessageFlags.Ephemeral,
        });
      }
    },
  },
];
