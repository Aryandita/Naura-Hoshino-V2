"use strict";

const fs = require("node:fs");

const { logger } = require("../managers/logger");
const fishAudioService = require("./fishAudioService");
const aiDjManager = require("../managers/aiDjManager");

/**
 * Menyiapkan audio intro DJ untuk diputar lewat voice native Discord.
 *
 * Catatan arsitektur: intro TIDAK lagi diunggah ke Discord lalu di-resolve
 * sebagai track Lavalink. Jalur lama membebani node Lavalink dengan stream HTTP
 * tambahan dan sering gagal senyap (URL attachment kedaluwarsa / format tidak
 * didukung). Sekarang audio dikembalikan sebagai buffer/path lokal dan diputar
 * langsung oleh VoiceManager sebelum lagu utama.
 *
 * @param {Object} params
 * @param {Object} params.poru - Poru instance (tidak dipakai untuk intro, dipertahankan untuk kompatibilitas)
 * @param {Object} params.channel - Discord text channel
 * @param {Object} params.user - User requester
 * @param {Object} params.trackInfo - Track info object (title, author, etc)
 * @param {string} params.guildId - Guild ID
 * @param {Object} params.musicManager - MusicManager instance
 * @param {string} [params.memberVoice] - Voice channel id member
 * @returns {Promise<{audioBuffer: Buffer, localFilePath: string|null, script: string, classification: Object, messageId: string|null, genreKey: string}|null>}
 */
async function prepareDjIntroTrack({ poru, channel, user, trackInfo, guildId, musicManager, memberVoice }) {
  if (!aiDjManager.isDjEnabled(guildId) || !fishAudioService.isConfigured()) {
    return null;
  }

  if (!channel || typeof channel.send !== 'function') {
    logger.warn(`[AiDjTrackService] Invalid channel object for guild ${guildId}`);
    return null;
  }

  try {
    // Normalisasi: memberVoice bisa berupa objek channel atau string id.
    const voiceChannelId =
      typeof memberVoice === "string"
        ? memberVoice
        : memberVoice?.id || musicManager.poru?.players?.get(guildId)?.voiceChannel;
    if (!voiceChannelId) return null;

    const lang = await aiDjManager.detectVoiceLanguage(musicManager, guildId, voiceChannelId);

    let isOwner = false;
    let isPremium = false;
    let customName = null;
    let personaKey = "default";

    try {
      const env = require("../config/env");
      if (env.OWNER_IDS && env.OWNER_IDS.includes(String(user?.id))) {
        isOwner = true;
      }
    } catch (_) {}

    try {
      const cacheManager = require("../managers/cacheManager");
      const profile = await cacheManager.getUserProfile(user?.id);
      if (profile) {
        if (profile.isPremium && (!profile.premiumUntil || new Date(profile.premiumUntil) > new Date())) {
          isPremium = true;
        }
        if (profile.aiPersona?.name) {
          customName = String(profile.aiPersona.name).trim();
        }
      }
    } catch (_) {}

    try {
      const aiMemory = require("../ai/aiMemory");
      personaKey = await aiMemory.getUserPersona(user?.id);
    } catch (_) {}

    const isVipOrOwner = isOwner || isPremium;
    let addressedName;
    if (isVipOrOwner) {
      // Owner dan Pengguna Premium: sebutkan display name atau nama kustom dari dashboard
      addressedName = customName || user?.displayName || user?.globalName || user?.username || "Sobat VIP";
    } else if (typeof aiDjManager.getPersonaPronoun === "function") {
      // Pengguna Umum: gunakan kata ganti selaras dinamis dengan persona Naura (tanpa mengeja username mentah)
      addressedName = aiDjManager.getPersonaPronoun(personaKey, lang);
    } else {
      addressedName = lang === "en" ? "you" : "kamu";
    }

    const { script, classification } = aiDjManager.generateDjScript(
      trackInfo,
      addressedName,
      [],
      lang,
      { isPronoun: !isVipOrOwner, isVip: isVipOrOwner, customName, persona: personaKey },
    );
    const genreKey = classification.genre;

    let audioBuffer = null;

    if (isVipOrOwner) {
      try {
        audioBuffer = await fishAudioService.getOrGeneratePremiumAudio(
          user.id,
          addressedName,
          script,
          { format: "mp3", latency: "low" },
        );
        if (audioBuffer) {
          logger.info(`[DjTrack] Using premium cached audio for ${addressedName}`);
        }
      } catch (err) {
        logger.debug(`[DjTrack] Premium audio generation failed, falling back: ${err.message}`);
      }
    }

    let localIntroPath = null;
    let isNewlyGenerated = false;

    if (!audioBuffer) {
      try {
        const localPath = aiDjManager.getLocalDjAudioPath(genreKey, lang, 0);
        if (localPath) {
          audioBuffer = fs.readFileSync(localPath);
          localIntroPath = localPath;
          logger.info(`[DjTrack] Using local audio for genre: ${genreKey}`);
        }
      } catch (localErr) {
        logger.debug(`[DjTrack] Local audio not available: ${localErr.message}`);
      }
    }

    if (!audioBuffer) {
      audioBuffer = await fishAudioService.generateSpeech(script, {
        format: "mp3",
        latency: "low",
        genre: genreKey,
        lang,
        variant: 0,
      });
      isNewlyGenerated = true;
    }

    if (!audioBuffer) return null;

    // R2: Simpan file audio intro ke folder lokal jika baru di-generate
    if (isNewlyGenerated) {
      try {
        if (typeof aiDjManager.saveLocalIntroAudio === "function") {
          localIntroPath = aiDjManager.saveLocalIntroAudio(
            audioBuffer,
            trackInfo.identifier || trackInfo.title,
          );
        }
        if (localIntroPath) {
          logger.info(`[AiDjTrackService] File audio intro lokal berhasil disimpan di: ${localIntroPath}`);
        }
      } catch (saveErr) {
        logger.warn(`[AiDjTrackService] Gagal menyimpan file audio intro lokal: ${saveErr.message}`);
      }
    }

    // Kirim kartu Now Playing/DJ ke teks channel (tanpa lampiran audio:
    // audio diputar native, bukan lewat attachment Discord).
    let messageId = null;
    try {
      const ui = require("../config/ui");
      const { buildContainerV2 } = require("../utils/NauraContainerBuilder");

      const speakPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🎙️ Hoshino FM",
        description: `> _"${script}"_`,
        expression: "singing",
        footerText: ui.getFooter("music"),
      });

      const speakMsg = await channel.send(speakPayload);
      messageId = speakMsg?.id || null;
    } catch (sendErr) {
      logger.debug(`[AiDjTrackService] Gagal mengirim kartu DJ: ${sendErr.message}`);
    }

    return {
      audioBuffer,
      localFilePath: localIntroPath,
      script,
      classification,
      messageId,
      genreKey,
    };
  } catch (err) {
    logger.warn(`[AiDjTrackService] Gagal generate TTS intro: ${err.message}`);
    return null;
  }
}

module.exports = { prepareDjIntroTrack };
