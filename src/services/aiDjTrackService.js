"use strict";

const fs = require("node:fs");

const { AttachmentBuilder } = require("discord.js");
const { logger } = require("../managers/logger");
const fishAudioService = require("./fishAudioService");
const aiDjManager = require("../managers/aiDjManager");

/**
 * Menyiapkan track TTS DJ intro untuk diputar sebelum lagu utama.
 * @param {Object} params
 * @param {Object} params.poru - Poru instance
 * @param {Object} params.channel - Discord text channel
 * @param {Object} params.user - User requester
 * @param {Object} params.trackInfo - Track info object (title, author, etc)
 * @param {string} params.guildId - Guild ID
 * @param {Object} params.musicManager - MusicManager instance
 * @param {Object} [params.memberVoice] - Voice channel member is in
 * @returns {Promise<{ttsTrack: Object, messageId: string}|null>}
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
    const voiceChannel = memberVoice || musicManager.poru?.players?.get(guildId)?.voiceChannel;
    if (!voiceChannel) return null;

    const lang = await aiDjManager.detectVoiceLanguage(musicManager, guildId, voiceChannel);

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

    if (!audioBuffer) {
      try {
        const localPath = aiDjManager.getLocalDjAudioPath(genreKey, lang, 0);
        if (localPath) {
          audioBuffer = fs.readFileSync(localPath);
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
    }

    if (!audioBuffer) return null;

    // R2: Simpan file audio intro ke folder lokal sebelum lagu utama diputar
    let localIntroPath = null;
    try {
      if (typeof aiDjManager.saveLocalIntroAudio === "function") {
        localIntroPath = aiDjManager.saveLocalIntroAudio(
          audioBuffer,
          trackInfo.identifier || trackInfo.title,
        );
      }
      logger.info(`[AiDjTrackService] File audio intro lokal berhasil disimpan di: ${localIntroPath}`);
    } catch (saveErr) {
      logger.warn(`[AiDjTrackService] Gagal menyimpan file audio intro lokal: ${saveErr.message}`);
    }

    const attachment = new AttachmentBuilder(localIntroPath || audioBuffer, { name: "naura_dj_intro.mp3" });

    const ui = require("../config/ui");
    const { buildContainerV2 } = require("../utils/NauraContainerBuilder");

    const speakPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "🎙️ Hoshino FM",
      description: `> _"${script}"_`,
      expression: "singing",
      footerText: ui.getFooter("music"),
    });
    speakPayload.files = [attachment];

    const speakMsg = await channel.send(speakPayload);

    if (!speakMsg?.attachments?.size) return null;

    const firstAttachment =
      typeof speakMsg.attachments.first === "function"
        ? speakMsg.attachments.first()
        : Array.from(speakMsg.attachments.values())[0];
    const playableUrl = firstAttachment?.url;
    const ttsRes = await poru.resolve({ query: playableUrl, requester: user });

    if (!ttsRes?.tracks?.length) return null;

    const ttsTrack = ttsRes.tracks[0];
    ttsTrack.info.title = `🎙️ Naura DJ: ${classification.genre.replace("_", " ")} Session`;
    ttsTrack.info.author = "Naura Hoshino";
    ttsTrack.info.originalSource = "http";
    ttsTrack.isTTS = true;
    ttsTrack.localFilePath = localIntroPath;

    return { ttsTrack, messageId: speakMsg.id, localFilePath: localIntroPath };
  } catch (err) {
    logger.warn(`[AiDjTrackService] Gagal generate TTS intro: ${err.message}`);
    return null;
  }
}

module.exports = { prepareDjIntroTrack };
