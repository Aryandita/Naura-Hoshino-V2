"use strict";

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
  // Guard: Check if AI DJ is enabled and Fish Audio configured
  if (!aiDjManager.isDjEnabled(guildId) || !fishAudioService.isConfigured()) {
    return null;
  }

  // Guard: Validate channel is sendable
  if (!channel || typeof channel.send !== 'function') {
    logger.warn(`[AiDjTrackService] Invalid channel object for guild ${guildId}`);
    return null;
  }

  try {
    const requesterName = user.displayName || user.username;
    const voiceChannel = memberVoice || musicManager.poru?.players?.get(guildId)?.voiceChannel;
    
    if (!voiceChannel) return null;

    const lang = await aiDjManager.detectVoiceLanguage(musicManager, guildId, voiceChannel);
    const { script, classification } = aiDjManager.generateDjScript(trackInfo, requesterName, [], lang);

    const audioBuffer = await fishAudioService.generateSpeech(script, {
      format: "mp3",
      latency: "low",
    });

    if (!audioBuffer) return null;

    const attachment = new AttachmentBuilder(audioBuffer, { name: "naura_dj_intro.mp3" });
    
    // Build container untuk display script text
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

    const playableUrl = speakMsg.attachments.first().url;
    const ttsRes = await poru.resolve({ query: playableUrl, requester: user });
    
    if (!ttsRes?.tracks?.length) return null;

    const ttsTrack = ttsRes.tracks[0];
    ttsTrack.info.title = `🎙️ Naura DJ: ${classification.genre.replace("_", " ")} Session`;
    ttsTrack.info.author = "Naura Hoshino";
    ttsTrack.info.originalSource = "http";
    ttsTrack.isTTS = true;

    return { ttsTrack, messageId: speakMsg.id };
  } catch (err) {
    logger.warn(`[AiDjTrackService] Gagal generate TTS intro: ${err.message}`);
    return null;
  }
}

module.exports = { prepareDjIntroTrack };