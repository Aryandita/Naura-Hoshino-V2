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
    // Melacak preferensi greeting per-user
    this.userGreetingStates = new Map();
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
   * Cek apakah user mengaktifkan Signature Audio Greeting VIP.
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async isGreetingEnabled(userId) {
    if (!userId) return false;
    const uid = String(userId);
    if (this.userGreetingStates.has(uid)) {
      return this.userGreetingStates.get(uid);
    }
    try {
      const cacheManager = require("./cacheManager");
      if (typeof cacheManager.getUserProfile === "function") {
        const profile = await cacheManager.getUserProfile(uid);
        if (profile?.notification_prefs?.ai_dj_greeting !== undefined) {
          const val = Boolean(profile.notification_prefs.ai_dj_greeting);
          this.userGreetingStates.set(uid, val);
          return val;
        }
      }
    } catch (_) {}
    return true; // Default aktif untuk member VIP
  }

  /**
   * Mengatur status Signature Audio Greeting VIP untuk user.
   * @param {string} userId
   * @param {boolean} enabled
   * @returns {Promise<boolean>}
   */
  async setGreetingEnabled(userId, enabled) {
    if (!userId) return false;
    const uid = String(userId);
    const val = Boolean(enabled);
    this.userGreetingStates.set(uid, val);
    try {
      const cacheManager = require("./cacheManager");
      if (typeof cacheManager.getUserProfile === "function") {
        const profile = await cacheManager.getUserProfile(uid);
        const prefs = { ...(profile?.notification_prefs || {}), ai_dj_greeting: val };
        await cacheManager.updateUserProfile(uid, { notification_prefs: prefs });
      }
    } catch (_) {}
    return val;
  }

  /**
   * Menghasilkan teks sapaan dan buffer audio greeting khas VIP.
   * @param {Object} params
   * @param {string} params.userId
   * @param {string} params.displayName
   * @param {string} params.trackTitle
   * @param {string} [params.lang='id']
   * @returns {Promise<{ script: string, audioBuffer: Buffer | null, isSignature: boolean }>}
   */
  async generateSignatureGreeting({ userId, displayName, trackTitle, lang = "id" }) {
    const isEnabled = await this.isGreetingEnabled(userId);
    if (!isEnabled) {
      return { script: "", audioBuffer: null, isSignature: false };
    }

    const res = await fishAudioService.generateSignatureGreeting(displayName, trackTitle, { lang });
    return {
      script: res.text,
      audioBuffer: res.audioBuffer,
      isSignature: true,
    };
  }

  async detectVoiceLanguage(manager, guildId, voiceChannelId) {
    let lang = "id";
    try {
      const cacheManager = require("./cacheManager");
      const guildSettings = await cacheManager.getGuildSettings(guildId);
      if (guildSettings?.settings?.language) {
        return guildSettings.settings.language;
      }

      const client = manager?.client || (manager?.channels ? manager : null);
      const voiceChannel = client?.channels?.cache?.get?.(voiceChannelId);
      const langCounts = { id: 0, en: 0 };

      if (voiceChannel && voiceChannel.members) {
        const members = Array.from(voiceChannel.members.values()).filter(m => !m.user.bot);
        const profiles = await Promise.all(
          members.map(m => cacheManager.getUserProfile(m.id).catch(() => null))
        );

        for (const p of profiles) {
          if (p && p.language) {
            if (p.language === "en") langCounts.en++;
            else if (p.language === "id") langCounts.id++;
          }
        }
      }

      if (langCounts.en > langCounts.id) {
        lang = "en";
      } else if (langCounts.id > langCounts.en) {
        lang = "id";
      }
    } catch (e) {
      logger.warn(`[AiDjManager] Gagal mendeteksi preferensi bahasa: ${e.message}`);
    }
    return lang;
  }

  /**
   * Mengambil kata ganti / sapaan khas yang selaras dinamis dengan persona Naura.
   * Digunakan untuk pengguna umum agar tidak mengeja username mentah.
   * @param {string} personaKey - 'default', 'tsundere', 'kuudere', 'gamer', 'butler'
   * @param {string} [lang='id'] - 'id' atau 'en'
   * @returns {string}
   */
  getPersonaPronoun(personaKey = "default", lang = "id") {
    const key = String(personaKey || "default").toLowerCase();
    if (lang === "en") {
      switch (key) {
        case "butler":
          return "you";
        case "gamer":
          return "teammate";
        case "kuudere":
          return "you";
        case "tsundere":
          return "you";
        default:
          return "you";
      }
    }
    // Bahasa Indonesia
    switch (key) {
      case "tsundere":
        return "kamu";
      case "kuudere":
        return "dia";
      case "gamer":
        return "sobat mabar";
      case "butler":
        return "Anda";
      default:
        return "kamu";
    }
  }

  /**
   * Direktori penyimpanan lokal audio intro DJ.
   * @returns {string}
   */
  getIntroAudioDir() {
    const path = require("path");
    return path.join(process.cwd(), "assets", "audio", "dj", "intro");
  }

  /**
   * Menyimpan buffer audio intro ke direktori lokal sebelum lagu utama diputar.
   * @param {Buffer} audioBuffer
   * @param {string} [identifier='track']
   * @returns {string} Path absolut file lokal yang disimpan
   */
  saveLocalIntroAudio(audioBuffer, identifier = "track") {
    const fs = require("fs");
    const path = require("path");
    const dir = this.getIntroAudioDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const safeId = String(identifier || "track").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 32);
    const filename = `intro_${Date.now()}_${safeId}.mp3`;
    const filePath = path.join(dir, filename);
    fs.writeFileSync(filePath, audioBuffer);

    // Prune stale intro files (keep directory bounded, older than 24h)
    try {
      const files = fs.readdirSync(dir);
      const now = Date.now();
      const MAX_AGE_MS = 24 * 60 * 60 * 1000;
      for (const f of files) {
        if (!f.startsWith("intro_") || f === filename) continue;
        const full = path.join(dir, f);
        try {
          const stat = fs.statSync(full);
          if (now - stat.mtimeMs > MAX_AGE_MS) {
            fs.unlinkSync(full);
          }
        } catch (_) {}
      }
    } catch (_) {}

    return filePath;
  }

  /**
   * Buat naskah penyiar DJ singkat, ramah, dan bernuansa anime kawaii sesuai genre trek.
   * @param {Object} trackInfo
   * @param {string} requesterName
   * @param {string[]} [listenerNames]
   * @param {string} [lang]
   * @param {Object} [options={}]
   * @returns {{ script: string, classification: { genre: string, mood: string, emoji: string } }}
   */
  generateDjScript(trackInfo, requesterName, listenerNames = [], lang = "id", options = {}) {
    const title = trackInfo.title || (lang === "en" ? "your favorite song" : "lagu favorit kalian");
    const author = trackInfo.author || (lang === "en" ? "an awesome musician" : "musisi hebat");
    const rawName = typeof requesterName === "string" ? requesterName.trim() : "";
    const PRONOUNS = new Set(["kamu", "dia", "anda", "you", "sobat mabar", "sobat naura", "teammate"]);
    const isPronoun = PRONOUNS.has(rawName.toLowerCase()) || Boolean(options.isPronoun);

    let name;
    if (!rawName) {
      name = lang === "en" ? "you" : "kamu";
    } else if (isPronoun) {
      name = rawName;
    } else {
      name = lang === "id"
        ? (rawName.startsWith("Kak ") ? rawName : `Kak ${rawName}`)
        : rawName;
    }
    const classification = classifyTrack(trackInfo);

    // Sapa pendengar aktif di voice jika ada selain requester
    let listenerGreeting = '';
    const otherListeners = listenerNames.filter((n) => n && n !== name && n !== rawName);
    if (otherListeners.length > 0) {
      listenerGreeting = lang === 'en'
        ? ' Warm greetings to everyone in the voice channel!'
        : ' Sapaan hangat juga buat teman-teman di voice channel!';
    }


    // Koleksi template tematik per-genre
    const templatesByGenre = {
      [GENRES.LOFI]: [
        `Meredupkan lampu studio sebentar... Suasana adem nan syahdu mengudara lewat ${title} karya ${author} untuk ${name}.${listenerGreeting} Tarik napas pelan-pelan, selamat menikmati ketenangannya ya~`,
        `Waktunya rehat sejenak dari hiruk-pikuk hari ini! Naura putarkan ${title} karya ${author} spesial buat ${name}.${listenerGreeting} Pas banget buat teman belajar atau santai malam ini.`,
      ],
      [GENRES.ANIME]: [
        `Kyaa! Gelombang anime mengudara di frekuensi kita! Ini dia ${title} karya ${author} untuk ${name}.${listenerGreeting} Yuk kita sing-along bareng Naura di voice channel!`,
        `Vibes jejepangan yang selalu bikin bersemangat! Naura putarkan ${title} pilihan keren dari ${name}.${listenerGreeting} Siap-siap larut dalam melodinya yaa!`,
      ],
      [GENRES.ROCK]: [
        `Whoaaa! Pasang sabuk pengaman kalian, distorsi gitar cadas mulai menggelegar! Trek ${title} oleh ${author} hadir untuk ${name}.${listenerGreeting} Bikin adrenalin langsung memuncak!`,
        `Energi tanpa batas! Riff membara dari ${author} dalam ${title} siap mengguncang server untuk ${name}.${listenerGreeting} Naikkan volume dan nikmati hentakannya!`,
      ],
      [GENRES.EDM]: [
        `Turn up the bass! Dentuman beat menghentak siap membakar suasana! Naura putarkan ${title} karya ${author} untuk ${name}.${listenerGreeting} Jangan ragu buat seru-seruan bareng di sini!`,
        `Party vibes on air! Pilihan luar biasa dari ${name}, ini dia ${title} oleh ${author}.${listenerGreeting} Rasakan gelombang energinya ya semuanya!`,
      ],
      [GENRES.KPOP]: [
        `Irama stylish dan ritmis khas K-Pop siap memikat hari kalian! Lagu ${title} dari ${author} mengudara untuk ${name}.${listenerGreeting} Melodi yang asyik banget buat sing-along!`,
        `Visual soundstage menyala! Naura hadirkan ${title} oleh ${author} untuk ${name}.${listenerGreeting} Beat-nya beneran nagih di telinga!`,
      ],
      [GENRES.ACOUSTIC]: [
        `Petikan nada yang hangat dan menyentuh hati... Ini dia ${title} persembahan ${author} untuk ${name}.${listenerGreeting} Biarkan melodinya menemani relung hatimu ya~`,
        `Sentuhan nada lembut yang menenangkan jiwa. Naura hadirkan karya manis dari ${author}, ${title}, untuk ${name}.${listenerGreeting} Selamat meresapi kehangatannya.`,
      ],
      [GENRES.GAMING]: [
        `Panggilan petualangan berbunyi! Soundtrack epik ${title} karya ${author} mulai mengalun untuk ${name}.${listenerGreeting} Rasakan atmosfer dunia fantasi yang megah!`,
        `Siapkan perlengkapanmu, penjelajah! Irama legendaris ${title} oleh ${author} hadir untuk ${name}.${listenerGreeting} Musik yang pas buat temani grinding atau santai!`,
      ],
      [GENRES.STREAM]: [
        `Sesi marathon siaran panjang telah dimulai! Naura hadirkan trek fokus ${title} untuk ${name}.${listenerGreeting} Naura bakal tetap standby menemani aktivitasmu sampai selesai ya~`,
        `Siaran berdurasi panjang untuk fokus maksimal. Naura temani ${name} dan kawan-kawan di voice channel.${listenerGreeting} Duduk manis dan nikmati alurnya!`,
      ],
      [GENRES.POP_DEFAULT]: [
        `Halo halo semuanya! Lagu spesial berikutnya, ${title} oleh ${author} mengudara untuk ${name}.${listenerGreeting} Selamat mendengarkan bersama Naura ya!`,
        `Pilihan yang manis dan menyenangkan dari ${name}! Sekarang Naura putarkan ${title} karya ${author}.${listenerGreeting} Yuk kita nikmati bareng-bareng!`,
      ],
    };

    const templatesByGenreEn = {
      [GENRES.LOFI]: [
        `Dimming the studio lights for a bit... A chill and peaceful vibe is on the air with ${title} by ${author} for ${name}.${listenerGreeting} Take a deep breath and enjoy the tranquility~`,
        `Time for a quick break from today's hustle! Naura is playing ${title} by ${author} especially for ${name}.${listenerGreeting} Perfect companion for studying or just chilling tonight.`,
      ],
      [GENRES.ANIME]: [
        `Kyaa! Anime waves are broadcasting on our frequency! Here is ${title} by ${author} for ${name}.${listenerGreeting} Let's sing along together with Naura in the voice channel!`,
        `Japanese vibes that always hype us up! Naura is playing ${title}, an awesome pick from ${name}.${listenerGreeting} Get ready to get lost in the melody!`,
      ],
      [GENRES.ROCK]: [
        `Whoaaa! Fasten your seatbelts, the heavy guitar distortion is rolling in! ${title} by ${author} is up next for ${name}.${listenerGreeting} This will surely pump up your adrenaline!`,
        `Limitless energy! The blazing riffs from ${author} in ${title} are ready to rock the server for ${name}.${listenerGreeting} Turn up the volume and enjoy the beat!`,
      ],
      [GENRES.EDM]: [
        `Turn up the bass! The dropping beats are ready to set the mood on fire! Naura is playing ${title} by ${author} for ${name}.${listenerGreeting} Don't hesitate to rave with us here!`,
        `Party vibes on air! An incredible choice from ${name}, here is ${title} by ${author}.${listenerGreeting} Feel the energy waves, everyone!`,
      ],
      [GENRES.KPOP]: [
        `The stylish and rhythmic K-Pop beats are ready to charm your day! ${title} by ${author} is on the air for ${name}.${listenerGreeting} Such a catchy melody to sing along to!`,
        `Visual soundstage activated! Naura presents ${title} by ${author} for ${name}.${listenerGreeting} The beat is absolutely addicting!`,
      ],
      [GENRES.ACOUSTIC]: [
        `Warm and heart-touching acoustic strums... Here is ${title} presented by ${author} for ${name}.${listenerGreeting} Let the melody accompany your soul~`,
        `Gentle notes that soothe the soul. Naura presents a sweet masterpiece from ${author}, ${title}, for ${name}.${listenerGreeting} Please enjoy the warmth.`,
      ],
      [GENRES.GAMING]: [
        `The call of adventure sounds! The epic soundtrack ${title} by ${author} begins to play for ${name}.${listenerGreeting} Feel the majestic fantasy world atmosphere!`,
        `Gear up, explorers! The legendary rhythm ${title} by ${author} is here for ${name}.${listenerGreeting} The perfect music to accompany your grinding or chill session!`,
      ],
      [GENRES.STREAM]: [
        `The long marathon session has begun! Naura presents the focus track ${title} for ${name}.${listenerGreeting} Naura will stay on standby to accompany your activities until you're done~`,
        `A long-duration broadcast for maximum focus. Naura is accompanying ${name} and friends in the voice channel.${listenerGreeting} Sit back and enjoy the flow!`,
      ],
      [GENRES.POP_DEFAULT]: [
        `Hello hello everyone! A special song up next, ${title} by ${author} is on the air for ${name}.${listenerGreeting} Enjoy listening together with Naura!`,
        `A sweet and delightful pick from ${name}! Now Naura is playing ${title} by ${author}.${listenerGreeting} Let's enjoy this together!`,
      ],
    };

    const targetTemplates = lang === "en" ? templatesByGenreEn : templatesByGenre;
    const genrePool = targetTemplates[classification.genre] || targetTemplates[GENRES.POP_DEFAULT];
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
    let lang = "id";
    try {
      const voiceChannel = manager.client.channels.cache.get(player.voiceChannel);
      if (voiceChannel && voiceChannel.members) {
        listenerNames = Array.from(voiceChannel.members.values())
          .filter((m) => !m.user.bot)
          .map((m) => m.displayName || m.user.username);
      }
      lang = await this.detectVoiceLanguage(manager, guildId, player.voiceChannel);
    } catch (err) {
      logger.debug("[aiDjManager:handleTrackStart] Operasi audio/voice gagal: " + (err?.message || err));
    }

    let isVipRequester = false;
    let customName = null;
    let personaKey = "default";
    const requesterId = requester?.id;
    if (requesterId) {
      try {
        const cacheManager = require("./cacheManager");
        const profile = await cacheManager.getUserProfile(requesterId);
        if (
          profile &&
          profile.isPremium &&
          profile.premiumUntil &&
          new Date(profile.premiumUntil) > new Date() &&
          ["tier2", "friends", "tier3", "vip"].includes(profile.premium_tier)
        ) {
          isVipRequester = true;
        } else if (env.OWNER_IDS && env.OWNER_IDS.includes(String(requesterId))) {
          isVipRequester = true;
        }
        if (profile?.aiPersona?.name) {
          customName = String(profile.aiPersona.name).trim();
        }
      } catch (_) {}

      try {
        const aiMemory = require("../ai/aiMemory");
        personaKey = await aiMemory.getUserPersona(requesterId);
      } catch (_) {}
    }

    const addressedName = isVipRequester
      ? (customName || requesterName)
      : this.getPersonaPronoun(personaKey, lang);

    let signatureGreeting = null;
    if (isVipRequester && (await this.isGreetingEnabled(requesterId))) {
      try {
        signatureGreeting = await this.generateSignatureGreeting({
          userId: requesterId,
          displayName: addressedName,
          trackTitle: track.info.title || "lagu pilihanmu",
          lang,
        });
      } catch (err) {
        logger.debug("[aiDjManager:handleTrackStart] Signature greeting gagal: " + (err?.message || err));
      }
    }

    const { script: djScript, classification } = this.generateDjScript(
      track.info,
      addressedName,
      listenerNames,
      lang,
      { isPronoun: !isVipRequester, isVip: isVipRequester, customName, persona: personaKey },
    );

    let script = djScript;
    if (signatureGreeting && signatureGreeting.script) {
      script = `[⭐ VIP Greeting] ${signatureGreeting.script}\n${script}`;
    }

    // Sematkan naskah dan tag genre di player agar MusicUIManager menampilkannya di kartu Now Playing
    player.currentDjSpeech = script;
    player.currentDjGenre = classification.genre.replace("_", " ");
    player.currentDjEmoji = classification.emoji;

    let audioAttachment = null;
    let audioBuffer = signatureGreeting?.audioBuffer || null;

    // Coba sintesis suara melalui Fish Audio jika terkonfigurasi & kuota aman
    if (fishAudioService.isConfigured()) {
      try {
        audioBuffer = await fishAudioService.generateSpeech(script, {
          format: "mp3",
          latency: "low",
        });

        if (audioBuffer) {
          try {
            this.saveLocalIntroAudio(audioBuffer, track.info.identifier || track.info.title);
          } catch (_) {}
          const { AttachmentBuilder } = require("discord.js");
          audioAttachment = new AttachmentBuilder(audioBuffer, {
            name: "naura_dj_intro.mp3",
          });

          // Ducking audio hanya jika suara TTS berhasil disintesis
          const originalVol = Number(player.volume) || 100;
          if (typeof player.setVolume === "function") {
            try {
              player.setVolume(15);
            } catch (err) {
              logger.debug("[aiDjManager:handleTrackStart] Operasi audio/voice gagal: " + (err?.message || err));
            }
          }

          const duckDuration = Math.max(3500, Math.min(12000, script.length * 85));
          setTimeout(() => {
            try {
              if (player && typeof player.setVolume === "function") {
                player.setVolume(originalVol);
              }
            } catch (err) {
              logger.debug("[aiDjManager:handleTrackStart] Operasi audio/voice gagal: " + (err?.message || err));
            }
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

          const msg = await channel.send(radioPayload).catch(() => {});
          if (msg) {
            setTimeout(() => {
              msg.delete().catch(() => {});
            }, 15000);
          }
        }
      } catch (sendErr) {
        logger.warn(`[AiDjManager] Gagal mengirim kartu siaran radio: ${sendErr.message}`);
      }
    }
  }

  /**
   * Generate ambient music suggestion based on RPG context (from pending_plugin/ambientMusicGenerator)
   * @param {object} rpgContext - { location, weather, timeOfDay, playerActivity }
   * @returns {{ mood: string, suggestedTrack: object, promptPrepared: string, readyForAiActivation: boolean }}
   */

  /**
   * Get path to local pre-generated DJ audio file.
   * Returns null if file doesn't exist (triggers API fallback).
   * @param {string} genre - Genre key (lofi, anime, rock, edm, kpop, acoustic, gaming, stream, pop_default)
   * @param {string} lang - Language code (id, en)
   * @param {number} [variant=0] - Template variant index (0 or 1)
   * @returns {string|null} Absolute path to .mp3 file or null
   */
  getLocalDjAudioPath(genre, lang = "id", variant = 0) {
    const fs = require('fs');
    const path = require('path');
    const cleanGenre = String(genre || "pop_default").toLowerCase().replace(/[^a-z0-9_]/g, "_");
    const cleanLang = String(lang || "id").toLowerCase().startsWith("en") ? "en" : "id";
    const vNum = Number(variant) || 0;
    const candidates = [
      `${cleanGenre}_v${vNum + 1}.mp3`,
      `${cleanGenre}_v${vNum}.mp3`,
      `${cleanGenre}_${vNum}.mp3`,
      `${cleanGenre}.mp3`,
    ];
    for (const fileName of candidates) {
      const filePath = path.join(process.cwd(), 'assets', 'audio', 'dj', cleanLang, fileName);
      if (fs.existsSync(filePath)) return filePath;
    }
    return null;
  }
}

module.exports = new AiDjManager();
