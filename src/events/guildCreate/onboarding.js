"use strict";

const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");
const GuildSettings = require("../../models/GuildSettings");
const cacheManager = require("../../managers/cacheManager");

module.exports = {
  name: "guildCreate",
  async execute(guild, client) {
    logger.info(
      `[ONBOARDING] Naura bergabung ke server baru: ${guild.name} (${guild.id})`,
    );

    // Daftarkan database agar tidak error saat setup
    try {
      await GuildSettings.findOrCreate({ where: { guildId: guild.id } });
      cacheManager.invalidateGuildSettings(guild.id);
    } catch (e) {
      logger.warn(`[ONBOARDING] Gagal mendaftarkan server ${guild.id}:`, e);
    }

    // Cari channel sistem atau channel teks pertama yang bisa ditulis
    let targetChannel = guild.systemChannel;
    if (!targetChannel) {
      targetChannel = guild.channels.cache.find(
        (c) =>
          c.isTextBased() &&
          c
            .permissionsFor(guild.members.me)
            .has(["SendMessages", "ViewChannel", "EmbedLinks"]),
      );
    }

    if (!targetChannel) {
      logger.info(
        `[ONBOARDING] Tidak ada channel teks yang bisa ditulis di server ${guild.id}.`,
      );
      return;
    }

    // Buat wizard onboarding Container V2
    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("setup_preset")
        .setPlaceholder(
          `${ui.stripCustomEmojis(ui.getEmoji("settings") || "⚙️")} Pilih Preset Setup Cepat...`,
        )
        .addOptions([
          {
            label: "Community Preset",
            description: "Fitur standar (Automod, Musik, AI, Ekonomi ringan).",
            value: "preset_community",
            emoji: ui.parseEmoji(ui.getEmoji("globe")) || { name: "🌍" },
          },
          {
            label: "Gaming/RPG Preset",
            description: "Fokus RPG, Leveling, Musik, tanpa Automod ketat.",
            value: "preset_gaming",
            emoji: ui.parseEmoji(ui.getEmoji("arcade")) || { name: "🎮" },
          },
          {
            label: "Minimal Preset",
            description: "Hanya fitur inti (Musik & AI), fitur lain mati.",
            value: "preset_minimal",
            emoji: ui.parseEmoji(ui.getEmoji("leaf")) || { name: "🍃" },
          },
        ]),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: `${ui.getEmoji("sparkles") || "✨"} Halo! Aku Naura Hoshino!`,
      description: `Terima kasih sudah mengundangku ke **${guild.name}**!\n\nAku adalah asisten cerdas yang dilengkapi dengan AI Gemini, Music Player 24/7, RPG System, dan Admin Tools.\n\nUntuk memulai dengan cepat, silakan pilih **Preset Setup** di bawah ini agar aku bisa mengatur semuanya secara otomatis. Nanti kamu juga bisa mengubahnya detail di dashboard \`/setup\`.`,
      buttonsRow: row,
      footerText: "Naura Setup Wizard • Hanya Admin",
    });

    try {
      await targetChannel.send(payload);
    } catch (error) {
      logger.warn(
        `[ONBOARDING] Gagal mengirim pesan wizard ke ${guild.id}:`,
        error.message,
      );
    }
  },
};
