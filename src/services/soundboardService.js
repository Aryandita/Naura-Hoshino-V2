"use strict";

/**
 * 🎵 Soundboard Service - Audio Effects Management - Naura Hoshino V2
 * -------------------------------------------------------------------
 * Manages soundboard playback with preset and custom server sounds.
 * Handles voice channel integration via Poru player, anti-spam cooldowns,
 * and real-time event broadcasting to Socket.IO dashboard.
 *
 * Features:
 * - 13 preset high-quality SFX (memes, reactions, gaming, fantasy)
 * - Custom server soundboard support via guild settings
 * - Anti-spam per-user cooldown enforcement (2.5 seconds)
 * - Non-destructive playback (preserves current music playlist)
 * - Automatic voice channel connection if bot not connected
 * - Real-time event broadcasting via eventBus
 * - VIP/Patron slot expansion (50 vs 20 custom sounds)
 *
 * @module src/services/soundboardService
 * @example
 * const soundboard = require('./soundboardService');
 *
 * // Get all available sounds for a guild
 * const sounds = await soundboard.getAvailableSounds(guildId);
 *
 * // Play a soundboard effect
 * const result = await soundboard.playSound({
 *   client,
 *   guildId: '123456789',
 *   soundId: 'airhorn',
 *   voiceChannelId: '987654321',
 *   requester: interaction.user
 * });
 *
 * // Check custom sound limit
 * const maxSlots = soundboard.getMaxCustomSounds(isVipOrPatron);
 */

const { logger } = require("../managers/logger");
const guildSettingsService = require("../managers/guildSettingsService");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Anti-spam cooldown duration in milliseconds per user per guild */
const COOLDOWN_MS = 2500;

/** Default maximum custom soundboard slots for standard servers */
const DEFAULT_MAX_CUSTOM_SOUNDS = 20;

/** Maximum custom soundboard slots for VIP/Patron servers */
const VIP_MAX_CUSTOM_SOUNDS = 50;

/** Default icon for custom server sounds */
const CUSTOM_SOUND_ICON = "🎵";

/** Default color for custom server sounds (cyan hex) */
const CUSTOM_SOUND_COLOR = "#00FFFF";

/** Category label for custom server sounds */
const CUSTOM_SOUND_CATEGORY = "Custom Server";

/** Preset sound effects library with metadata and CDN URLs */
const PRESET_SOUNDS = [
  {
    id: "airhorn",
    title: "Air Horn MLG",
    category: "Memes",
    icon: "📢",
    color: "#EF4444",
    url: "https://cdn.freesound.org/previews/274/274178_5121236-lq.mp3",
  },
  {
    id: "applause",
    title: "Tepuk Tangan Meriah",
    category: "Reaction",
    icon: "👏",
    color: "#F59E0B",
    url: "https://cdn.freesound.org/previews/448/448080_9159316-lq.mp3",
  },
  {
    id: "bruh",
    title: "Bruh Sound Effect",
    category: "Memes",
    icon: "🗿",
    color: "#6B7280",
    url: "https://cdn.freesound.org/previews/415/415511_5121236-lq.mp3",
  },
  {
    id: "victory",
    title: "Fanfare Victory",
    category: "Reaction",
    icon: "🎺",
    color: "#10B981",
    url: "https://cdn.freesound.org/previews/270/270404_5121236-lq.mp3",
  },
  {
    id: "cheer",
    title: "Crowd Cheering",
    category: "Reaction",
    icon: "🎉",
    color: "#EC4899",
    url: "https://cdn.freesound.org/previews/337/337000_3232293-lq.mp3",
  },
  {
    id: "drumroll",
    title: "Drum Roll",
    category: "Suspense",
    icon: "🥁",
    color: "#8B5CF6",
    url: "https://cdn.freesound.org/previews/442/442938_2398403-lq.mp3",
  },
  {
    id: "gameover",
    title: "Game Over 8-bit",
    category: "Gaming",
    icon: "👾",
    color: "#3B82F6",
    url: "https://cdn.freesound.org/previews/253/253886_3167198-lq.mp3",
  },
  {
    id: "magic",
    title: "Magic Sparkle Chime",
    category: "Fantasy",
    icon: "✨",
    color: "#06B6D4",
    url: "https://cdn.freesound.org/previews/608/608645_11861866-lq.mp3",
  },
  {
    id: "badumtss",
    title: "Ba-Dum-Tss Rimshot",
    category: "Reaction",
    icon: "🥁",
    color: "#F97316",
    url: "https://cdn.freesound.org/previews/536/536108_1415754-lq.mp3",
  },
  {
    id: "gg",
    title: "GG Good Game",
    category: "Gaming",
    icon: "🏆",
    color: "#EAB308",
    url: "https://cdn.freesound.org/previews/274/274177_5121236-lq.mp3",
  },
  {
    id: "sadtrombone",
    title: "Sad Trombone Womp",
    category: "Memes",
    icon: "🎺",
    color: "#64748B",
    url: "https://cdn.freesound.org/previews/73/73581_37876-lq.mp3",
  },
  {
    id: "wow",
    title: "Anime Wow",
    category: "Reaction",
    icon: "😲",
    color: "#A855F7",
    url: "https://cdn.freesound.org/previews/415/415510_5121236-lq.mp3",
  },
  {
    id: "quack",
    title: "Duck Quack",
    category: "Memes",
    icon: "🦆",
    color: "#84CC16",
    url: "https://cdn.freesound.org/previews/495/495005_10745749-lq.mp3",
  },
];

// ============================================================================
// INTERNAL STATE
// ============================================================================

/** In-memory cooldown tracker (Key: `${guildId}_${userId}`) */
const cooldownMap = new Map();

// ============================================================================
// SERVICE FUNCTIONS
// ============================================================================

/**
 * Retrieve all available sounds for a guild (preset + custom).
 * Merges global preset library with guild-specific custom uploads.
 * @param {string} guildId - Discord guild ID
 * @returns {Promise<SoundEntry[]>} Array of available sound entries
 * @example
 * const sounds = await getAvailableSounds('123456789');
 * const airhorn = sounds.find(s => s.id === 'airhorn');
 */
async function getAvailableSounds(guildId) {
  const result = [...PRESET_SOUNDS];
  if (!guildId) return result;

  try {
    const settings = await guildSettingsService.getGuildSetting(guildId);
    if (settings && settings.soundboards && typeof settings.soundboards === "object") {
      for (const [key, url] of Object.entries(settings.soundboards)) {
        result.push({
          id: key,
          title: key.charAt(0).toUpperCase() + key.slice(1),
          category: CUSTOM_SOUND_CATEGORY,
          icon: CUSTOM_SOUND_ICON,
          color: CUSTOM_SOUND_COLOR,
          url,
          isCustom: true,
        });
      }
    }
  } catch (err) {
    logger.warn(`[SoundboardService] Gagal memuat custom soundboard guild ${guildId}: ${err.message}`);
  }

  return result;
}

/**
 * Play a soundboard effect in a voice channel via Poru player.
 * Handles cooldown enforcement, voice connection, and non-destructive playback.
 * Preserves current music queue by reinserting main track after soundboard finishes.
 * @param {Object} params - Playback parameters
 * @param {Object} params.client - Discord.js Client instance
 * @param {string} params.guildId - Target guild ID
 * @param {string} params.soundId - Sound identifier (case-insensitive match)
 * @param {string} [params.voiceChannelId] - Voice channel to connect if not already
 * @param {Object} [params.requester] - Discord user who requested playback
 * @returns {Promise<PlaySoundResult>} Playback result with success status and message
 * @example
 * const result = await playSound({
 *   client,
 *   guildId: '123456789',
 *   soundId: 'airhorn',
 *   voiceChannelId: '987654321',
 *   requester: interaction.user
 * });
 * if (result.success) {
 *   console.log(result.message);
 * }
 */
async function playSound({ client, guildId, soundId, voiceChannelId, requester }) {
  if (!guildId || !soundId) {
    return { success: false, message: "Guild ID dan Sound ID wajib disertakan." };
  }

  const reqId = requester?.id || "anon";
  const cooldownKey = `${guildId}_${reqId}`;
  const now = Date.now();
  const lastPlay = cooldownMap.get(cooldownKey) || 0;
  if (now - lastPlay < COOLDOWN_MS) {
    const remainingSec = ((COOLDOWN_MS - (now - lastPlay)) / 1000).toFixed(1);
    return {
      success: false,
      message: `Mohon tunggu ${remainingSec}s sebelum memutar soundboard lagi.`,
    };
  }

  const allSounds = await getAvailableSounds(guildId);
  const targetSound = allSounds.find((s) => s.id.toLowerCase() === soundId.toLowerCase());
  if (!targetSound) {
    return { success: false, message: `Soundboard "${soundId}" tidak ditemukan.` };
  }

  const musicManager = client.musicManager;
  if (!musicManager || !musicManager.poru) {
    return { success: false, message: "Audio engine Poru belum siap." };
  }

  const poru = musicManager.poru;
  let player = poru.players.get(guildId);

  if (!player) {
    if (!voiceChannelId) {
      return {
        success: false,
        message: "Bot tidak berada di Voice Channel. Sambungkan bot terlebih dahulu atau tentukan voice channel.",
      };
    }
    try {
      player = poru.createConnection({
        guildId,
        voiceChannel: voiceChannelId,
        deaf: true,
      });
    } catch (connErr) {
      logger.error(`[SoundboardService] Gagal createConnection di guild ${guildId}: ${connErr.message}`);
      return { success: false, message: "Gagal menghubungkan bot ke Voice Channel." };
    }
  }

  try {
    const resolveResult = await poru.resolve({
      query: targetSound.url,
      requester: requester || client.user,
    });

    if (!resolveResult || !resolveResult.tracks || resolveResult.tracks.length === 0) {
      return { success: false, message: "Gagal memuat track audio soundboard." };
    }

    const sbTrack = resolveResult.tracks[0];
    cooldownMap.set(cooldownKey, now);

    if (player.isPlaying && player.currentTrack) {
      const mainTrack = player.currentTrack;
      mainTrack.info.resumePosition = player.position;
      player.queue.unshift(mainTrack);
      await player.play(sbTrack);
    } else {
      player.queue.unshift(sbTrack);
      if (!player.isPlaying && !player.isPaused) {
        await player.play();
      }
    }

    const eventBus = require("../core/eventBus");
    eventBus.emit("soundboard:played", {
      guildId: String(guildId),
      sound: targetSound,
      requester: requester ? { id: requester.id, username: requester.username } : null,
      timestamp: Date.now(),
    });

    return {
      success: true,
      message: `Memutar soundboard: ${targetSound.title}`,
      sound: targetSound,
    };
  } catch (err) {
    logger.error(`[SoundboardService] Gagal memutar soundboard di guild ${guildId}: ${err.message}`);
    return { success: false, message: "Terjadi kesalahan internal saat memutar soundboard." };
  }
}

/**
 * Get maximum custom soundboard slots based on VIP/Patron status.
 * @param {boolean} [isVipOrPatron=false] - Whether server has VIP or Patron status
 * @returns {number} Maximum custom sound slots (50 for VIP, 20 for standard)
 * @example
 * const maxSlots = getMaxCustomSounds(true); // Returns 50
 * const standardSlots = getMaxCustomSounds(); // Returns 20
 */
function getMaxCustomSounds(isVipOrPatron = false) {
  return isVipOrPatron ? VIP_MAX_CUSTOM_SOUNDS : DEFAULT_MAX_CUSTOM_SOUNDS;
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} SoundEntry
 * @property {string} id - Unique sound identifier
 * @property {string} title - Display name
 * @property {string} category - Category label (Memes, Reaction, Gaming, etc.)
 * @property {string} icon - Emoji icon for UI display
 * @property {string} color - Hex color code for UI theming
 * @property {string} url - Direct audio file URL
 * @property {boolean} [isCustom] - True if custom server upload
 */

/**
 * @typedef {Object} PlaySoundResult
 * @property {boolean} success - Whether playback succeeded
 * @property {string} message - Human-readable status message
 * @property {SoundEntry} [sound] - Matched sound entry if successful
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  PRESET_SOUNDS,
  DEFAULT_MAX_CUSTOM_SOUNDS,
  VIP_MAX_CUSTOM_SOUNDS,
  COOLDOWN_MS,
  getMaxCustomSounds,
  getAvailableSounds,
  playSound,
};
