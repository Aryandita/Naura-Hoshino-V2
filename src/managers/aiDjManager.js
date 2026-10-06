/**
 * aiDjManager.js - Manajer Fitur AI DJ Radio Host Naura Hoshino.
 *
 * Mengelola:
 *   1. Pembuatan naskah DJ radio kawaii & enerjik saat transisi lagu berbasis genre heuristik.
 *   2. Sintesis audio ucapan melalui Fish Audio Service jika kuota aktif.
 *   3. Pengiriman kartu siaran radio Discord Components V2 (Opsi C Hybrid) & bubble pada panel utama.
 *   4. Pengaturan status AI DJ per-guild (on/off).
 */

"use strict";

const env = require("../config/env.js");
const { logger } = require("./logger.js");
const fishAudioService = require("../services/fishAudioService.js");
const { classifyTrack, GENRES } = require("../music/genreClassifier.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder.js");

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
   * Buat naskah penyiar DJ singkat, ramah, dan bernuansa anime kawaii sesuai genre trek.
   * @param {Object} trackInfo
   * @param {string} requesterName
   * @param {string[]} [listenerNames]
   * @returns {{ script: string, classification: { genre: string, mood: string, emoji: string } }}
   */
  generateDjScript(trackInfo, requesterName, listenerNames = []) {
    const title = trackInfo.title || "lagu favorit kalian";
    const author = trackInfo.author || "musisi hebat";
    const name = requesterName || "sobat setia Naura";
    const classification = classifyTrack(trackInfo);

    // Sapa pendengar aktif di voice jika ada selain requester
    let listenerGreeting = "";
    const otherListeners = listenerNames.filter((n) => n && n !== name);
    if (otherListeners.length > 0) {
      const luckyListener = otherListeners[Math.floor(Math.random() * otherListeners.length)];
      listenerGreeting = ` Sapaan hangat juga buat Kak ${luckyListener} dan teman-teman di voice channel!`;
    }

    // Koleksi template tematik per-genre
    const templatesByGenre = {
      [GENRES.LOFI]: [
        `Meredupkan lampu studio sebentar... Suasana adem nan syahdu mengudara lewat ${title} karya ${author} untuk Kak ${name}.${listenerGreeting} Tarik napas pelan-pelan, selamat menikmati ketenangannya ya~`,
        `Waktunya rehat sejenak dari hiruk-pikuk hari ini! Naura putarkan ${title} karya ${author} spesial buat Kak ${name}.${listenerGreeting} Pas banget buat teman belajar atau santai malam ini.`,
      ],
      [GENRES.ANIME]: [
        `Kyaa! Gelombang anime mengudara di frekuensi kita! Ini dia ${title} karya ${author} untuk Kak ${name}.${listenerGreeting} Yuk kita sing-along bareng Naura di voice channel!`,
        `Vibes jejepangan yang selalu bikin bersemangat! Naura putarkan ${title} pilihan keren dari Kak ${name}.${listenerGreeting} Siap-siap larut dalam melodinya yaa!`,
      ],
      [GENRES.ROCK]: [
        `Whoaaa! Pasang sabuk pengaman kalian, distorsi gitar cadas mulai menggelegar! Trek ${title} oleh ${author} hadir untuk Kak ${name}.${listenerGreeting} Bikin adrenalin langsung memuncak!`,
        `Energi tanpa batas! Riff membara dari ${author} dalam ${title} siap mengguncang server untuk Kak ${name}.${listenerGreeting} Naikkan volume dan nikmati hentakannya!`,
      ],
      [GENRES.EDM]: [
        `Turn up the bass! Dentuman beat menghentak siap membakar suasana! Naura putarkan ${title} karya ${author} untuk Kak ${name}.${listenerGreeting} Jangan ragu buat seru-seruan bareng di sini!`,
        `Party vibes on air! Pilihan luar biasa dari Kak ${name}, ini dia ${title} oleh ${author}.${listenerGreeting} Rasakan gelombang energinya ya semuanya!`,
      ],
      [GENRES.KPOP]: [
        `Irama stylish dan ritmis khas K-Pop siap memikat hari kalian! Lagu ${title} dari ${author} mengudara untuk Kak ${name}.${listenerGreeting} Melodi yang asyik banget buat sing-along!`,
        `Visual soundstage menyala! Naura hadirkan ${title} oleh ${author} untuk Kak ${name}.${listenerGreeting} Beat-nya beneran nagih di telinga!`,
      ],
      [GENRES.ACOUSTIC]: [
        `Petikan nada yang hangat dan menyentuh hati... Ini dia ${title} persembahan ${author} untuk Kak ${name}.${listenerGreeting} Biarkan melodinya menemani relung hatimu ya~`,
        `Sentuhan nada lembut yang menenangkan jiwa. Naura hadirkan karya manis dari ${author}, ${title}, untuk Kak ${name}.${listenerGreeting} Selamat meresapi kehangatannya.`,
      ],
      [GENRES.GAMING]: [
        `Panggilan petualangan berbunyi! Soundtrack epik ${title} karya ${author} mulai mengalun untuk Kak ${name}.${listenerGreeting} Rasakan atmosfer dunia fantasi yang megah!`,
        `Siapkan perlengkapanmu, penjelajah! Irama legendaris ${title} oleh ${author} hadir untuk Kak ${name}.${listenerGreeting} Musik yang pas buat temani grinding atau santai!`,
      ],
      [GENRES.STREAM]: [
        `Sesi marathon siaran panjang telah dimulai! Naura hadirkan trek fokus ${title} untuk Kak ${name}.${listenerGreeting} Naura bakal tetap standby menemani aktivitasmu sampai selesai ya~`,
        `Siaran berdurasi panjang untuk fokus maksimal. Naura temani Kak ${name} dan kawan-kawan di voice channel.${listenerGreeting} Duduk manis dan nikmati alurnya!`,
      ],
      [GENRES.POP_DEFAULT]: [
        `Halo halo semuanya! Lagu spesial berikutnya, ${title} oleh ${author} mengudara untuk Kak ${name}.${listenerGreeting} Selamat mendengarkan bersama Naura ya!`,
        `Pilihan yang manis dan menyenangkan dari Kak ${name}! Sekarang Naura putarkan ${title} karya ${author}.${listenerGreeting} Yuk kita nikmati bareng-bareng!`,
      ],
    };

    const genrePool = templatesByGenre[classification.genre] || templatesByGenre[GENRES.POP_DEFAULT];
    const script = genrePool[Math.floor(Math.random() * genrePool.length)];

    return { script, classification };
  }

  /**
   * Tangani event pemutaran lagu baru dari Poru.
   * Mengimplementasikan Opsi C Hybrid:
   * 1. Menanamkan speech bubble ringkas ke player untuk ditampilkan di kartu Now Playing.
   * 2. Untuk request manual (manusia), mengirimkan kartu siaran Naura Radio FM (Components V2).
   * 3. Mensintesis audio Fish Audio jika kuota aktif.
   *
   * @param {Object} manager - MusicManager
   * @param {Object} player - Poru Player
   * @param {Object} track - Poru Track
   */
  async handleTrackStart(manager, player, track) {
    if (!player || !track || !track.info) return;

    const guildId = player.guildId;
    if (!this.isDjEnabled(guildId)) return;

    // Hitung counter lagu
    const count = (this.trackCounters.get(guildId) || 0) + 1;
    this.trackCounters.set(guildId, count);

    // Ambil info pemohon lagu
    const requester = track.info.requester;
    const isBotRequester = requester && requester.bot;
    const requesterName = requester
      ? requester.displayName || requester.username || "sobat Naura"
      : "sobat Naura";

    // Lewatkan pengumuman penuh jika bot autoplay memutar berturut-turut
    if (isBotRequester && count % 3 !== 0) {
      return;
    }

    // Ambil daftar nama pendengar aktif di voice channel
    let listenerNames = [];
    try {
      const voiceChannel = manager.client.channels.cache.get(player.voiceChannel);
      if (voiceChannel && voiceChannel.members) {
        listenerNames = voiceChannel.members
          .filter((m) => !m.user.bot)
          .map((m) => m.displayName || m.user.username);
      }
    } catch (_) {}

    const { script, classification } = this.generateDjScript(
      track.info,
      requesterName,
      listenerNames,
    );

    // Sematkan naskah dan tag genre di player agar MusicUIManager menampilkannya di kartu Now Playing
    player.currentDjSpeech = script;
    player.currentDjGenre = classification.genre.replace("_", " ");
    player.currentDjEmoji = classification.emoji;

    let audioAttachment = null;
    let audioBuffer = null;

    // Coba sintesis suara melalui Fish Audio jika terkonfigurasi & kuota aman
    if (fishAudioService.isConfigured()) {
      try {
        audioBuffer = await fishAudioService.generateSpeech(script, {
          format: "mp3",
          latency: "low",
        });

        if (audioBuffer) {
          const { AttachmentBuilder } = require("discord.js");
          audioAttachment = new AttachmentBuilder(audioBuffer, {
            name: "naura_dj_intro.mp3",
          });

          // Ducking audio hanya jika suara TTS berhasil disintesis
          const originalVol = Number(player.volume) || 100;
          if (typeof player.setVolume === "function") {
            try {
              player.setVolume(15);
            } catch (_) {}
          }

          const duckDuration = Math.max(3500, Math.min(12000, script.length * 85));
          setTimeout(() => {
            try {
              if (player && typeof player.setVolume === "function") {
                player.setVolume(originalVol);
              }
            } catch (_) {}
          }, duckDuration);
        }
      } catch (err) {
        logger.warn(`[AiDjManager] TTS dialihkan ke mode teks: ${err.message}`);
      }
    }

    // Opsi C: Siarkan kartu radio Components V2 tersendiri untuk pemutaran manual
    if (!isBotRequester && player.textChannel) {
      try {
        const channel = manager.client.channels.cache.get(player.textChannel);
        if (channel && typeof channel.send === "function") {
          const title = track.info.title || "Lagu Favorit";
          const author = track.info.author || "Musisi";
          const uri = track.info.uri || "https://discord.com";

          const radioPayload = buildContainerV2({
            accentColorHex: "#FF69B4",
            authorName: "✦ NAURA RADIO 99.4 FM • LIVE ON AIR ✦",
            title: `${classification.emoji} ${classification.genre.replace("_", " ")} SESSION`,
            description:
              `> 🎙️ **DJ Host Naura:**\n> _"${script}"_\n\n` +
              `> 🎶 **Sedang Mengudara:** [${title}](${uri})\n` +
              `> 👤 **Musisi:** \`${author}\` • **Request:** \`${requesterName}\`\n` +
              `> 🎭 **Suasana Musik:** _${classification.mood}_`,
            expression: "singing",
            footerText: "Naura Radio FM 99.4 MHz • Teman Musik Setiamu ✨",
          });

          if (audioAttachment) {
            radioPayload.files = [audioAttachment];
          }

          await channel.send(radioPayload).catch(() => {});
        }
      } catch (sendErr) {
        logger.warn(`[AiDjManager] Gagal mengirim kartu siaran radio: ${sendErr.message}`);
      }
    }
  }
}

module.exports = new AiDjManager();
