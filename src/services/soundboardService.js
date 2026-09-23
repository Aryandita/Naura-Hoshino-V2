"use strict";

const { logger } = require("../managers/logger");
const guildSettingsService = require("../managers/guildSettingsService");

// Preset efek suara global berkualitas tinggi (SFX Web & Discord)
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
];

// Anti-spam cooldown in memory (Key: guildId_userId)
const cooldownMap = new Map();
const COOLDOWN_MS = 2500;

/**
 * Mengambil seluruh sound yang tersedia untuk guild tertentu (preset + custom).
 * @param {string} guildId
 * @returns {Promise<Array>}
 */
async function getAvailableSounds(guildId) {
  const result = [...PRESET_SOUNDS];
  if (!guildId) return result;

  try {
    const settings = await guildSettingsService.getGuildSetting(guildId);
    if (
      settings &&
      settings.soundboards &&
      typeof settings.soundboards === "object"
    ) {
      for (const [key, url] of Object.entries(settings.soundboards)) {
        result.push({
          id: key,
          title: key.charAt(0).toUpperCase() + key.slice(1),
          category: "Custom Server",
          icon: "🎵",
          color: "#00FFFF",
          url,
          isCustom: true,
        });
      }
    }
  } catch (err) {
    logger.warn(
      `[SoundboardService] Gagal memuat custom soundboard guild ${guildId}: ${err.message}`,
    );
  }

  return result;
}

/**
 * Memainkan soundboard ke voice channel melalui Poru player.
 * @param {object} params
 * @param {object} params.client - Discord client
 * @param {string} params.guildId - ID Guild Discord
 * @param {string} params.soundId - ID Sound yang diputar
 * @param {string} [params.voiceChannelId] - Voice Channel target jika belum terkoneksi
 * @param {object} [params.requester] - Discord user yang meminta pemutaran
 * @returns {Promise<{ success: boolean, message: string, sound?: object }>}
 */
async function playSound({
  client,
  guildId,
  soundId,
  voiceChannelId,
  requester,
}) {
  if (!guildId || !soundId) {
    return {
      success: false,
      message: "Guild ID dan Sound ID wajib disertakan.",
    };
  }

  // Cooldown check
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
  const targetSound = allSounds.find(
    (s) => s.id.toLowerCase() === soundId.toLowerCase(),
  );
  if (!targetSound) {
    return {
      success: false,
      message: `Soundboard "${soundId}" tidak ditemukan.`,
    };
  }

  const musicManager = client.musicManager;
  if (!musicManager || !musicManager.poru) {
    return { success: false, message: "Audio engine Poru belum siap." };
  }

  const poru = musicManager.poru;
  let player = poru.players.get(guildId);

  // Jika bot belum di voice channel, coba sambungkan ke channel target
  if (!player) {
    if (!voiceChannelId) {
      return {
        success: false,
        message:
          "Bot tidak berada di Voice Channel. Sambungkan bot terlebih dahulu atau tentukan voice channel.",
      };
    }
    try {
      player = poru.createConnection({
        guildId,
        voiceChannel: voiceChannelId,
        deaf: true,
      });
    } catch (connErr) {
      logger.error(
        `[SoundboardService] Gagal createConnection di guild ${guildId}: ${connErr.message}`,
      );
      return {
        success: false,
        message: "Gagal menghubungkan bot ke Voice Channel.",
      };
    }
  }

  try {
    const resolveResult = await poru.resolve({
      query: targetSound.url,
      requester: requester || client.user,
    });

    if (
      !resolveResult ||
      !resolveResult.tracks ||
      resolveResult.tracks.length === 0
    ) {
      return {
        success: false,
        message: "Gagal memuat track audio soundboard.",
      };
    }

    const sbTrack = resolveResult.tracks[0];
    cooldownMap.set(cooldownKey, now);

    // Pemutaran soundboard tanpa memutus playlist
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

    // Siarkan realtime event jika Socket.IO aktif
    if (client.dashboardIo) {
      client.dashboardIo.to(String(guildId)).emit("soundboard_played", {
        sound: targetSound,
        requester: requester
          ? { id: requester.id, username: requester.username }
          : null,
        timestamp: Date.now(),
      });
    }

    return {
      success: true,
      message: `Memutar soundboard: ${targetSound.title}`,
      sound: targetSound,
    };
  } catch (err) {
    logger.error(
      `[SoundboardService] Gagal memutar soundboard di guild ${guildId}: ${err.message}`,
    );
    return {
      success: false,
      message: "Terjadi kesalahan internal saat memutar soundboard.",
    };
  }
}

module.exports = {
  PRESET_SOUNDS,
  getAvailableSounds,
  playSound,
};
