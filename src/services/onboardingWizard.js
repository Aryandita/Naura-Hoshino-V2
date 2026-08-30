"use strict";

const { ChannelType, PermissionFlagsBits } = require("discord.js");
const GuildSettings = require("../models/GuildSettings");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const PRESETS = {
  gaming: {
    id: "gaming",
    title: "🎮 Gaming & Anime Community",
    shortDesc: "Temp Voice, Game Arcade, AI Chat, dan Sistem Ekonomi",
    accentColor: "#38BDF8",
    channels: [
      {
        name: "🎮-game-arcade",
        type: ChannelType.GuildText,
        topic: "Ruang bermain arcade, trivia, dan duel kartu Naura.",
      },
      {
        name: "💬-ai-naura",
        type: ChannelType.GuildText,
        topic: "Kanal obrolan interaktif bersama AI Companion Naura Hoshino.",
        settingKey: "aiChannelId",
      },
      {
        name: "🔊 ➕ Buat Room Voice",
        type: ChannelType.GuildVoice,
        settingKey: "tempvoiceChannel",
      },
    ],
    settingsPatch: {
      automod: { enabled: true, antiSpam: true, antiCaps: false },
      ticketMode: "thread",
    },
  },
  security: {
    id: "security",
    title: "🛡️ Secure & Moderated Server",
    shortDesc: "Honeypot Softban Trap, AutoMod AI, ModMail, dan Audit Log",
    accentColor: "#EF4444",
    channels: [
      {
        name: "🔒-scammer-trap",
        type: ChannelType.GuildText,
        topic: "Perangkap bot scammer. Jangan kirim pesan di channel ini!",
        settingKey: "softbanChannelId",
      },
      {
        name: "📜-audit-log",
        type: ChannelType.GuildText,
        topic: "Pencatatan aktivitas moderasi dan keamanan server.",
      },
    ],
    settingsPatch: {
      automod: {
        enabled: true,
        antiSpam: true,
        antiLinks: true,
        antiMassMention: true,
      },
      aiAutomod: { enabled: true, toxicFilter: true },
      ticketMode: "channel",
    },
  },
  music: {
    id: "music",
    title: "☕ Chill Lounge & High-Fidelity Music Hub",
    shortDesc: "Music Request 24/7, Radio DJ Dedikasi, Lofi Mode, dan Kafe",
    accentColor: "#C084FC",
    channels: [
      {
        name: "🎵-music-request",
        type: ChannelType.GuildText,
        topic: "Kanal pemutaran musik berkualitas tinggi bersama Naura.",
      },
      {
        name: "☕-kafe-santai",
        type: ChannelType.GuildText,
        topic: "Ruang istirahat, mengobrol, dan menikmati idle cafe survival.",
      },
    ],
    settingsPatch: {
      automod: { enabled: true, antiSpam: true },
    },
  },
};

/**
 * Dapatkan daftar seluruh preset yang tersedia.
 */
function getPresetList() {
  return Object.values(PRESETS);
}

/**
 * Dapatkan detail preset berdasarkan key.
 */
function getPreset(key) {
  return PRESETS[key] || null;
}

/**
 * Terapkan preset ke guild Discord secara otomatis & aman.
 * @param {object} guild - Objek Guild Discord.js
 * @param {string} presetKey - Kunci preset ('gaming' | 'security' | 'music')
 * @param {object} [adminUser] - User discord yang mengeksekusi
 * @returns {Promise<{ success: boolean, createdChannels: string[], appliedSettings: object, message: string }>}
 */
async function applyPreset(guild, presetKey, adminUser = null) {
  const preset = getPreset(presetKey);
  if (!preset) {
    throw new Error(`Preset "${presetKey}" tidak valid.`);
  }

  if (!guild) {
    throw new Error("Objek Guild tidak valid.");
  }

  // Cek bot permissions di server
  const botMember = guild.members?.me;
  if (
    botMember &&
    !botMember.permissions.has(PermissionFlagsBits.ManageChannels)
  ) {
    throw new Error(
      "Naura membutuhkan permission 'Manage Channels' untuk menjalankan Onboarding Wizard.",
    );
  }

  const createdChannels = [];
  const settingsToUpdate = { ...(preset.settingsPatch || {}) };

  // 1. Buat channel-channel yang dibutuhkan
  for (const chDef of preset.channels) {
    try {
      let existing = null;
      if (guild.channels?.cache) {
        existing = guild.channels.cache.find(
          (c) => c.name === chDef.name && c.type === chDef.type,
        );
      }

      let channel = existing;
      if (!channel && guild.channels?.create) {
        channel = await guild.channels.create({
          name: chDef.name,
          type: chDef.type,
          topic: chDef.topic || undefined,
          reason: `[Naura Onboarding Wizard] Preset: ${preset.title} oleh ${adminUser?.tag || "Admin"}`,
        });
        createdChannels.push(`Created: #${channel.name}`);
      } else if (channel) {
        createdChannels.push(`Existing: #${channel.name}`);
      }

      if (channel && chDef.settingKey) {
        settingsToUpdate[chDef.settingKey] = channel.id;
      }
    } catch (err) {
      logger.warn(
        `[OnboardingWizard] Gagal membuat channel ${chDef.name}: ${err.message}`,
      );
    }
  }

  // 2. Simpan konfigurasi ke GuildSettings
  let updatedSettings = null;
  try {
    const guildSettingsService = require("../managers/guildSettingsService");
    const updated = await guildSettingsService.updateGuildSetting(
      guild.id,
      (current) => ({
        ...(current || {}),
        ...settingsToUpdate,
      }),
    );
    updatedSettings = updated?.settings || null;
  } catch (err) {
    logger.error(`[OnboardingWizard] Gagal menyimpan settings: ${err.message}`);
  }

  logger.info(
    `[OnboardingWizard] Guild ${guild.id} berhasil menerapkan preset "${preset.title}".`,
  );

  return {
    success: true,
    preset: preset.title,
    createdChannels,
    appliedSettings: updatedSettings,
    message: `Preset **${preset.title}** berhasil diterapkan dengan sempurna!`,
  };
}

module.exports = {
  PRESETS,
  getPresetList,
  getPreset,
  applyPreset,
};
