// Lokasi: src/managers/voiceManager.js
"use strict";

const { logger } = require("../managers/logger");
const googleTTS = require("google-tts-api");

class VoiceManager {
  static async speak(text, member) {
    if (!member || !member.voice || !member.voice.channel) {
      logger.warn("[TTS] Member tidak berada di dalam Voice Channel.");
      return;
    }

    const voiceChannel = member.voice.channel;
    const guildId = voiceChannel.guild.id;
    const client = member.client;

    try {
      // 1. Dapatkan URL Audio dari Google TTS (Bahasa Indonesia)
      const safeText =
        text.length > 195 ? text.substring(0, 192) + "..." : text;
      const audioUrl = googleTTS.getAudioUrl(safeText, {
        lang: "id",
        slow: false,
        host: "https://translate.google.com",
      });

      // 2. Coba pakai Poru (Lavalink) jika tersedia
      const poru = client?.poru || client?.musicManager?.poru;
      if (poru) {
        let player = poru.players.get(guildId);
        if (!player) {
          player = poru.createConnection({
            guildId,
            voiceChannel: voiceChannel.id,
            textChannel: member.guild?.systemChannelId || voiceChannel.id,
            deaf: true,
          });
        }

        const res = await poru.resolve({
          query: audioUrl,
          requester: member.user,
        });
        if (res && res.tracks && res.tracks.length > 0) {
          const track = res.tracks[0];
          player.queue.add(track);
          if (!player.isPlaying && !player.isPaused) {
            await player.play();
          }
          return;
        }
      }

      // 3. Fallback ke @discordjs/voice jika terinstall
      try {
        const {
          joinVoiceChannel,
          createAudioPlayer,
          createAudioResource,
          AudioPlayerStatus,
        } = require("@discordjs/voice");

        const resource = createAudioResource(audioUrl);
        const player = createAudioPlayer();

        const connection = joinVoiceChannel({
          channelId: voiceChannel.id,
          guildId: guildId,
          adapterCreator: voiceChannel.guild.voiceAdapterCreator,
          selfDeaf: true,
        });

        connection.subscribe(player);
        player.play(resource);

        player.on(AudioPlayerStatus.Idle, () => {
          player.stop();
          try {
            connection.destroy();
          } catch (e) {}
        });

        player.on("error", (error) => {
          logger.error("[VoiceManager] Audio Player Error:", error.message);
          try {
            connection.destroy();
          } catch (e) {}
        });
      } catch (voicePkgError) {
        if (voicePkgError.code === "MODULE_NOT_FOUND") {
          logger.info(
            `[VoiceManager] Suara disimulasikan (Lavalink/DiscordJS Voice belum aktif): "${safeText}"`,
          );
        } else {
          throw voicePkgError;
        }
      }
    } catch (error) {
      logger.error("[VoiceManager] Error memutar suara TTS:", error);
    }
  }
}

module.exports = VoiceManager;
