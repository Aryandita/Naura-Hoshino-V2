// Lokasi: src/managers/voiceManager.js
const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  getVoiceConnection,
} = require("@discordjs/voice");
const { logger } = require("../managers/logger");
const googleTTS = require("google-tts-api");

class VoiceManager {
  static async speak(text, member) {
    if (!member || !member.voice.channel) {
      console.log(
        "\x1b[41m\x1b[37m 🔊 TTS ERROR \x1b[0m \x1b[31mMember tidak berada di dalam Voice Channel.\x1b[0m",
      );
      return;
    }

    const voiceChannel = member.voice.channel;
    const guildId = voiceChannel.guild.id;

    try {
      // Cek konflik dengan Poru (Lavalink)
      const client = member.client;
      if (client && client.poru && client.poru.players) {
        const player = client.poru.players.get(guildId);
        if (player && player.isPlaying) {
          console.log(
            "\x1b[43m\x1b[30m 🔊 TTS INFO \x1b[0m \x1b[33mVoice channel sedang digunakan oleh Poru untuk memutar musik. Membatalkan TTS agar tidak membajak koneksi.\x1b[0m",
          );
          return;
        }
      }

      // 1. Dapatkan URL Audio dari Google TTS (Bahasa Indonesia)
      // Limit text ke 195 karakter agar tidak terkena RangeError dari API Google TTS
      const safeText =
        text.length > 195 ? text.substring(0, 192) + "..." : text;
      const audioUrl = googleTTS.getAudioUrl(safeText, {
        lang: "id",
        slow: false,
        host: "https://translate.google.com",
      });

      // 2. Buat Resource Audio
      const resource = createAudioResource(audioUrl);
      const player = createAudioPlayer();

      // 3. Bergabung ke Voice Channel
      const connection = joinVoiceChannel({
        channelId: voiceChannel.id,
        guildId: guildId,
        adapterCreator: voiceChannel.guild.voiceAdapterCreator,
        selfDeaf: true,
      });

      // 4. Mainkan Suara
      connection.subscribe(player);
      player.play(resource);

      // 5. Cleanup Setelah Selesai Berbicara
      player.on(AudioPlayerStatus.Idle, () => {
        player.stop();
        try {
          connection.destroy();
        } catch (e) {}
      });

      player.on("error", (error) => {
        logger.error(
          "\x1b[41m\x1b[37m ⚠️ AUDIO PLAYER ERROR \x1b[0m",
          error.message,
        );
        try {
          connection.destroy();
        } catch (e) {}
      });
    } catch (error) {
      logger.error("\x1b[41m\x1b[37m ⚠️ GOOGLE TTS ERROR \x1b[0m", error);
    }
  }
}

module.exports = VoiceManager;
