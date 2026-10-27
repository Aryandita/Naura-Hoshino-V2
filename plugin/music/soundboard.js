"use strict";

/**
 * 🎙️ Soundboard Command - Custom Server Sound Effects - Naura Hoshino V2
 * ----------------------------------------------------------------------
 * Manages custom server soundboard system with official presets.
 * Supports play, list, add, and delete operations with permission checks.
 *
 * Subcommands:
 * - /soundboard play <nama>  : Play sound effect without cutting queue
 * - /soundboard list         : View all available soundboards
 * - /soundboard add <nama> <url>   : Add new soundboard (Admin)
 * - /soundboard hapus <nama>       : Delete soundboard (Admin)
 *
 * Features:
 * - Official preset soundboards (intro, welcome, AI greeting)
 * - Custom URL soundboards per server (VIP: up to 50 slots)
 * - Anti-prototype-pollution name validation
 * - Queue-interrupt-safe playback
 *
 * @module plugin/music/soundboard
 */

const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
const { logger } = require("../../src/managers/logger");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const VoiceManager = require("../../src/managers/voiceManager");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Official preset soundboards with local audio files */
const OFFICIAL_SOUNDBOARDS = {
  intro: {
    name: "intro",
    title: "Naura Intro (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Intro (ID).mp3"),
  },
  "intro-en": {
    name: "intro-en",
    title: "Naura Intro (English)",
    file: path.resolve(__dirname, "../../assets/audio/Intro (EN).mp3"),
  },
  "ai-chat": {
    name: "ai-chat",
    title: "AI Chat Greeting (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Ai Chat Intro (ID).mp3"),
  },
  "ai-chat-en": {
    name: "ai-chat-en",
    title: "AI Chat Greeting (English)",
    file: path.resolve(__dirname, "../../assets/audio/Ai Chat Intro (EN).mp3"),
  },
  welcome: {
    name: "welcome",
    title: "Server Welcome Greeting (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Server Join (ID).mp3"),
  },
  "welcome-en": {
    name: "welcome-en",
    title: "Server Welcome Greeting (English)",
    file: path.resolve(__dirname, "../../assets/audio/Server Join (EN).mp3"),
  },
};

/** Blacklisted names that could cause prototype pollution */
const RESERVED_NAMES = ["__proto__", "constructor", "prototype"];

/** Valid name pattern: 1-32 alphanumeric, underscore, or hyphen (lowercase) */
const VALID_NAME_PATTERN = /^[a-z0-9_-]{1,32}$/;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate soundboard name format and safety.
 * Prevents prototype pollution and enforces naming convention.
 * @param {string} nama - Raw soundboard name
 * @returns {boolean} True if name is valid and safe
 */
function isValidSoundboardName(nama) {
  return (
    !RESERVED_NAMES.includes(nama) && VALID_NAME_PATTERN.test(nama)
  );
}

/**
 * Validate audio URL format (must be HTTP/HTTPS).
 * @param {string} url - Raw URL string
 * @returns {boolean} True if URL is valid
 */
function isValidAudioUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Check if user has Manage Server permission.
 * @param {object} member - Guild member object
 * @returns {boolean} True if has permission
 */
function hasManagePermission(member) {
  return member.permissions.has(PermissionFlagsBits.ManageGuild);
}

/**
 * Check if user is VIP or Patron.
 * @param {string} userId - Discord user ID
 * @returns {Promise<boolean>} True if premium user
 */
async function isVipOrPatron(userId) {
  try {
    const cacheManager = require("../../src/managers/cacheManager");
    const profile = await cacheManager.getUserProfile(userId);
    return Boolean(profile?.isPremium);
  } catch {
    return false;
  }
}

/**
 * Build standardized error response.
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {object} Error payload
 */
function buildError(title, description) {
  return buildErrorContainerV2({
    title,
    description,
    footerText: ui.getFooter("music"),
  });
}

// ============================================================================
// SUBCOMMAND HANDLERS
// ============================================================================

/**
 * Handle /soundboard add subcommand.
 * Adds custom soundboard URL to guild settings with validation.
 * @param {object} interaction - Discord interaction
 * @param {string} guildId - Guild ID
 * @param {object} currentSettings - Current guild settings
 * @returns {Promise<void>}
 */
async function handleAdd(interaction, guildId, currentSettings) {
  // Permission check
  if (!hasManagePermission(interaction.member)) {
    return interaction.editReply(
      buildError("Akses Ditolak", "❌ Kamu harus memiliki izin Manage Server untuk menambah soundboard."),
    );
  }

  // Input validation
  const rawNama = interaction.options.getString("nama") || "";
  const nama = rawNama.trim().toLowerCase();
  const url = (interaction.options.getString("url") || "").trim();

  if (!isValidSoundboardName(nama)) {
    return interaction.editReply(
      buildError("Nama Tidak Valid", "❌ Nama soundboard hanya boleh 1-32 karakter alfanumerik (huruf kecil, angka, _, -) dan bukan kata kunci sistem."),
    );
  }

  if (!isValidAudioUrl(url)) {
    return interaction.editReply(
      buildError("URL Tidak Valid", "❌ URL audio soundboard wajib menggunakan tautan HTTP atau HTTPS yang valid."),
    );
  }

  // Slot limit check
  const soundboardService = require("../../src/services/soundboardService");
  const isPremium = await isVipOrPatron(interaction.user.id);
  const maxSlots = soundboardService.getMaxCustomSounds(isPremium);

  if (Object.keys(currentSettings.soundboards).length >= maxSlots) {
    return interaction.editReply(
      buildError("Batas Maksimum", `❌ Batas maksimal soundboard adalah ${maxSlots} per server.${!isPremium ? " Tingkatkan ke VIP atau Guild Patron untuk membuka hingga 50 slot!" : ""}`),
    );
  }

  // Save to guild settings
  await guildSettingsService.updateGuildSetting(guildId, (settings) => {
    if (!settings.soundboards) settings.soundboards = {};
    settings.soundboards[nama] = url;
  });

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    title: "Soundboard Ditambahkan",
    description: `✅ Soundboard **${nama}** berhasil ditambahkan!\nGunakan \`/soundboard play ${nama}\` untuk memutarnya.`,
    footerText: ui.getFooter("music"),
  });
  return interaction.editReply(payload);
}

/**
 * Handle /soundboard hapus subcommand.
 * Removes custom soundboard from guild settings.
 * @param {object} interaction - Discord interaction
 * @param {string} guildId - Guild ID
 * @param {object} currentSettings - Current guild settings
 * @returns {Promise<void>}
 */
async function handleHapus(interaction, guildId, currentSettings) {
  // Permission check
  if (!hasManagePermission(interaction.member)) {
    return interaction.editReply(
      buildError("Akses Ditolak", "❌ Kamu harus memiliki izin Manage Server untuk menghapus soundboard."),
    );
  }

  // Input validation
  const rawNama = interaction.options.getString("nama") || "";
  const nama = rawNama.trim().toLowerCase();

  if (RESERVED_NAMES.includes(nama) || !currentSettings.soundboards[nama]) {
    return interaction.editReply(
      buildError("Tidak Ditemukan", "❌ Soundboard tidak ditemukan."),
    );
  }

  // Remove from guild settings
  await guildSettingsService.updateGuildSetting(guildId, (settings) => {
    if (settings.soundboards) {
      delete settings.soundboards[nama];
    }
  });

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("error") || "#ef4444",
    title: "Soundboard Dihapus",
    description: `🗑️ Soundboard **${nama}** berhasil dihapus.`,
    footerText: ui.getFooter("music"),
  });
  return interaction.editReply(payload);
}

/**
 * Handle /soundboard list subcommand.
 * Displays all available official and custom soundboards.
 * @param {object} interaction - Discord interaction
 * @param {object} currentSettings - Current guild settings
 * @returns {Promise<void>}
 */
async function handleList(interaction, currentSettings) {
  const customList = Object.keys(currentSettings.soundboards);
  const officialList = Object.keys(OFFICIAL_SOUNDBOARDS);

  const fields = [
    {
      name: "✨ Soundboard Resmi (Official)",
      value: officialList
        .map((name) => `• \`/soundboard play ${name}\` - *${OFFICIAL_SOUNDBOARDS[name].title}*`)
        .join("\n"),
    },
  ];

  if (customList.length > 0) {
    fields.push({
      name: "🎙️ Soundboard Kustom Server",
      value: customList.map((name) => `• **${name}**`).join("\n"),
    });
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    title: "🎙️ Daftar Efek Suara Soundboard",
    description: "Mainkan efek suara langsung di Voice Channel tanpa menghentikan antrean musik utama!",
    fields,
    footerText: "Gunakan /soundboard play <nama> untuk memutar",
  });

  return interaction.editReply(payload);
}

/**
 * Handle /soundboard play subcommand.
 * Plays sound effect in voice channel without interrupting main queue.
 * @param {object} interaction - Discord interaction
 * @param {string} guildId - Guild ID
 * @param {object} currentSettings - Current guild settings
 * @returns {Promise<void>}
 */
async function handlePlay(interaction, guildId, currentSettings) {
  // Voice channel check
  const voiceChannel = interaction.member.voice.channel;
  if (!voiceChannel) {
    return interaction.editReply(
      buildError("Koneksi Gagal", "❌ Kamu harus berada di Voice Channel terlebih dahulu."),
    );
  }

  const nama = interaction.options.getString("nama").toLowerCase();

  // PATH 1: Official preset (local audio file)
  const official = OFFICIAL_SOUNDBOARDS[nama];
  if (official && fs.existsSync(official.file)) {
    const played = await VoiceManager.playFile(official.file, interaction.member);

    if (played) {
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🎙️ Naura Official Soundboard",
        description: `✨ Memutar efek suara resmi: **${official.title}** di <#${voiceChannel.id}>!`,
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(payload);
    }
  }

  // PATH 2: Custom server soundboard URL
  const url = currentSettings.soundboards[nama];
  if (!url) {
    return interaction.editReply(
      buildError("Tidak Ditemukan", `❌ Soundboard **${nama}** tidak ditemukan. Gunakan \`/soundboard list\` untuk melihat daftar yang tersedia.`),
    );
  }

  return playCustomSoundboard(interaction, guildId, voiceChannel, nama, url);
}

/**
 * Play custom soundboard URL via Poru audio engine.
 * Handles queue interruption gracefully.
 * @param {object} interaction - Discord interaction
 * @param {string} guildId - Guild ID
 * @param {object} voiceChannel - Voice channel object
 * @param {string} nama - Soundboard name
 * @param {string} url - Audio URL
 * @returns {Promise<void>}
 */
async function playCustomSoundboard(interaction, guildId, voiceChannel, nama, url) {
  const poru = interaction.client.musicManager.poru;
  let player = poru.players.get(guildId);

  // Create or validate player connection
  if (!player) {
    player = poru.createConnection({
      guildId,
      voiceChannel: voiceChannel.id,
      textChannel: interaction.channel.id,
      deaf: true,
    });
  } else if (player.voiceChannel !== voiceChannel.id) {
    return interaction.editReply(
      buildError("Voice Channel Berbeda", "❌ Bot sedang berada di Voice Channel lain."),
    );
  }

  try {
    // Resolve audio track
    const res = await poru.resolve({
      query: url,
      requester: interaction.user,
    });

    if (!res || !res.tracks || res.tracks.length === 0) {
      return interaction.editReply(
        buildError("Gagal Muat Audio", "❌ Gagal memuat efek suara. Pastikan URL valid."),
      );
    }

    const sbTrack = res.tracks[0];
    let desc;

    // Handle queue interruption
    if (player.isPlaying && player.currentTrack) {
      const mainTrack = player.currentTrack;
      mainTrack.info.resumePosition = player.position;
      player.queue.unshift(mainTrack);
      await player.play(sbTrack);
      desc = `🎙️ Memutar efek suara **${nama}**... (Lagu utama dijeda sementara)`;
    } else {
      player.queue.unshift(sbTrack);
      if (!player.isPlaying && !player.isPaused) player.play();
      desc = `🎙️ Memutar efek suara **${nama}**...`;
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#00FFFF",
      title: "🎙️ Soundboard FX",
      description: desc,
      footerText: ui.getFooter("music"),
    });

    return interaction.editReply(payload);
  } catch (error) {
    logger.error("[SOUNDBOARD ERROR]", error);
    return interaction.editReply(
      buildError("Gagal Jaringan", "❌ Terjadi kesalahan jaringan saat memuat efek suara."),
    );
  }
}

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("soundboard")
    .setDescription("Sistem Efek Suara (Soundboard) Kustom Server")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Mainkan efek suara tanpa memotong antrean")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama soundboard yang ingin diputar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Lihat daftar soundboard server ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Tambahkan soundboard baru (Admin)")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama pendek efek suara (misal: bruh)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("URL audio (MP3/WAV atau YouTube URL)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("hapus")
        .setDescription("Hapus soundboard (Admin)")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama soundboard")
            .setRequired(true),
        ),
    ),

  /**
   * Execute soundboard command based on subcommand.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const currentSettings =
      (await guildSettingsService.getGuildSetting(guildId)) || {};
    if (!currentSettings.soundboards) currentSettings.soundboards = {};

    switch (subcommand) {
      case "add":
        return handleAdd(interaction, guildId, currentSettings);
      case "hapus":
        return handleHapus(interaction, guildId, currentSettings);
      case "list":
        return handleList(interaction, currentSettings);
      case "play":
        return handlePlay(interaction, guildId, currentSettings);
      default:
        return interaction.editReply(
          buildError("Subcommand Tidak Valid", "❌ Subcommand tidak dikenali."),
        );
    }
  },
};
