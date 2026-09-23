/**
 * aiDjManager.js - Manajer Fitur AI DJ Radio Host Naura Hoshino.
 *
 * Mengelola:
 *   1. Pembuatan naskah DJ radio kawaii & enerjik saat transisi lagu.
 *   2. Sintesis audio ucapan melalui Fish Audio Service.
 *   3. Pengiriman audio voice snippet & visual bubble ke text channel pemutar musik.
 *   4. Pengaturan status AI DJ per-guild (on/off).
 */

"use strict";

const env = require("../config/env.js");
const { logger } = require("./logger.js");
const fishAudioService = require("../services/fishAudioService.js");

class AiDjManager {
  constructor() {
    // Cache status aktif per-guild di memory (bisa diperluas ke DB/Redis)
    this.guildDjStates = new Map();
    // Melacak counter lagu per-guild untuk frekuensi pengumuman
    this.trackCounters = new Map();
  }

  /**
   * Cek apakah fitur AI DJ aktif di guild tertentu.
   * @param {string} guildId
   * @returns {boolean}
   */
  isDjEnabled(guildId) {
    if (this.guildDjStates.has(guildId)) {
      return this.guildDjStates.get(guildId);
    }
    // Default sesuai environment
    return env.AI_DJ_ENABLED ?? false;
  }

  /**
   * Set status aktif AI DJ untuk guild tertentu.
   * @param {string} guildId
   * @param {boolean} enabled
   */
  setDjEnabled(guildId, enabled) {
    this.guildDjStates.set(guildId, Boolean(enabled));
  }

  /**
   * Buat naskah penyiar DJ singkat, ramah, dan bernuansa anime kawaii.
   * @param {Object} trackInfo
   * @param {string} requesterName
   * @param {string[]} [listenerNames]
   * @returns {string}
   */
  generateDjScript(trackInfo, requesterName, listenerNames = []) {
    const title = trackInfo.title || "lagu favorit kalian";
    const author = trackInfo.author || "musisi hebat";
    const name = requesterName || "semuanya";

    // Trivia musisi
    const triviaList = [
      `${author} terkenal dengan nada-nada magis yang selalu memikat pendengar!`,
      `Trek ${title} ini merupakan salah satu lagu yang paling banyak diputar!`,
      `Irama khas dari ${author} siap menemani kalian bersantai di sini!`,
      `Sentuhan musik dari ${author} ini selalu pas untuk membangkitkan suasana.`,
    ];
    const trivia = triviaList[Math.floor(Math.random() * triviaList.length)];

    // Sapa pendengar aktif di voice jika ada selain requester
    let listenerGreeting = "";
    const otherListeners = listenerNames.filter((n) => n && n !== name);
    if (otherListeners.length > 0) {
      const luckyListener =
        otherListeners[Math.floor(Math.random() * otherListeners.length)];
      listenerGreeting = ` Sapaan hangat juga untuk Kak ${luckyListener} dan kawan-kawan yang standby di voice!`;
    }

    const templates = [
      `Halo halo semuanya! Selanjutnya lagu spesial, ${title} oleh ${author} untuk ${name}.${listenerGreeting} ${trivia} Selamat mendengarkan ya!`,
      `Wah pilihan yang keren banget dari ${name}! Sekarang Naura putarkan ${title}.${listenerGreeting} ${trivia} Yuk kita nikmati bareng-bareng!`,
      `Lagu berikutnya siap bikin harimu makin semangat: ${title} karya ${author} untuk ${name}.${listenerGreeting} ${trivia} Naura temani kalian di sini ya!`,
      `Musik pilihan ${name} nih! Lagu ${title} oleh ${author} mulai mengudara.${listenerGreeting} ${trivia} Happy listening semuanya!`,
    ];

    const idx = Math.floor(Math.random() * templates.length);
    return templates[idx];
  }

  /**
   * Tangani event pemutaran lagu baru dari Poru.
   * @param {Object} manager - MusicManager
   * @param {Object} player - Poru Player
   * @param {Object} track - Poru Track
   */
  async handleTrackStart(manager, player, track) {
    if (!player || !track || !track.info) return;

    const guildId = player.guildId;
    if (!this.isDjEnabled(guildId)) return;

    // Hitung counter lagu: default umumkan setiap lagu yang di-request manusia
    // atau setiap 2 lagu bila queue panjang
    const count = (this.trackCounters.get(guildId) || 0) + 1;
    this.trackCounters.set(guildId, count);

    // Ambil requester
    const requester = track.info.requester;
    const isBotRequester = requester && requester.bot;
    const requesterName = requester
      ? requester.displayName || requester.username || "sobat Naura"
      : "sobat Naura";

    // Lewatkan jika bot autoplay terus menerus (hanya umumkan tiap 3 lagu autoplay)
    if (isBotRequester && count % 3 !== 0) {
      return;
    }

    // Dapatkan daftar nama pendengar di voice channel
    let listenerNames = [];
    try {
      const voiceChannel = manager.client.channels.cache.get(
        player.voiceChannel,
      );
      if (voiceChannel && voiceChannel.members) {
        listenerNames = voiceChannel.members
          .filter((m) => !m.user.bot)
          .map((m) => m.displayName || m.user.username);
      }
    } catch (_) {}

    const script = this.generateDjScript(
      track.info,
      requesterName,
      listenerNames,
    );

    // Simpan script di player agar MusicUIManager bisa menampilkannya di banner UI
    player.currentDjSpeech = script;

    // Audio Ducking: Redupkan volume musik ke 15% saat Naura membawakan naskah radio
    const originalVol = Number(player.volume) || 100;
    if (typeof player.setVolume === "function") {
      try {
        player.setVolume(15);
      } catch (_) {}
    }

    const restoreVolume = () => {
      try {
        if (player && typeof player.setVolume === "function") {
          player.setVolume(originalVol);
        }
      } catch (_) {}
    };

    const duckDuration = Math.max(3500, Math.min(12000, script.length * 85));
    setTimeout(restoreVolume, duckDuration);

    // Jika Fish Audio dikonfigurasi, hasilkan audio speech suara Naura
    if (fishAudioService.isConfigured()) {
      try {
        const audioBuffer = await fishAudioService.generateSpeech(script, {
          format: "mp3",
          latency: "balanced",
        });

        if (audioBuffer && player.textChannel) {
          const channel = manager.client.channels.cache.get(player.textChannel);
          if (channel && typeof channel.send === "function") {
            const { AttachmentBuilder } = require("discord.js");
            const attachment = new AttachmentBuilder(audioBuffer, {
              name: "naura_dj_intro.mp3",
            });

            // Kirim voice snippet interaktif ke text channel
            await channel
              .send({
                content: `🎙️ **Naura AI DJ:** _"${script}"_`,
                files: [attachment],
              })
              .catch(() => {});
          }
        }
      } catch (err) {
        logger.warn(`[AiDjManager] Gagal mengirim intro suara: ${err.message}`);
      }
    }
  }
}

module.exports = new AiDjManager();
