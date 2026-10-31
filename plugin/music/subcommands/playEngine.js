"use strict";

const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const GuildSettings = require("../../../src/models/GuildSettings");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { resolveSpotifyQuery } = require("../../../src/music/spotifyResolver");
const { formatDuration } = require("../helpers/musicShared");
const aiDjTrackService = require("../../../src/services/aiDjTrackService");
module.exports = {
  async lofi(ctx) {
    return module.exports.radio(ctx);
  },

  async radio(ctx) {
    let { player } = ctx;
    const { poru, guild, memberVoice, channel, subcommand, user, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

    const VoiceManager = require("../../../src/managers/voiceManager");
    if (VoiceManager.hasActiveConnection(guild.id)) {
      await VoiceManager.yieldToMusic(guild.id);
    }

    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
      ctx.player = player;
    }

    const isLofi = subcommand === "lofi";
    const searchQuery = isLofi
      ? "scsearch:lofi hip hop chill beats"
      : "scsearch:NoCopyrightSounds gaming music";
    const stColor = isLofi ? "#9b59b6" : "#f1c40f";
    const stIcon = isLofi ? "☕" : "📻";

    const scanPayload = buildContainerV2({
      accentColorHex: stColor,
      title: "Radio Stasiun",
      description: "⏳ Memindai frekuensi stasiun **" + subcommand.toUpperCase() + "**...",
      footerText: ui.getFooter("music"),
    });
    await sendReply(scanPayload, false);

    const res = await poru.resolve({ query: searchQuery, requester: user });
    if (res && res.tracks && res.tracks.length > 0) {
      player.queue.clear();
      res.tracks[0].info.originalSource = "youtube";
      player.queue.add(res.tracks[0]);
      player.is247 = true;

      const [guildData] = await GuildSettings.findOrCreate({
        where: { guildId: guild.id },
      });
      guildData.music = {
        twentyFourSeven: true,
        voiceChannel: player.voiceChannel,
        textChannel: player.textChannel,
      };
      guildData.changed("music", true);
      await guildData.save({ fields: ["music"] });

      if (!player.isPlaying && !player.isPaused) player.play();
      const connPayload = buildContainerV2({
        accentColorHex: stColor,
        title: stIcon + " Stasiun Terhubung",
        description: "Mode transmisi 24/7 otomatis aktif.\n" + divider,
        footerText: ui.getFooter("music"),
      });
      return sendReply(connPayload);
    }
    const errPayload = buildErrorContainerV2({
      title: "Gagal Kunci Frekuensi",
      description: eError + " | Gagal mengunci frekuensi stasiun.",
      footerText: ui.getFooter("music"),
    });
    return sendReply(errPayload, true);
  },

  async play(ctx) {
    let { player } = ctx;
    const {
      client,
      poru,
      musicManager,
      guild,
      memberVoice,
      channel,
      user,
      args,
      sendReply,
      deleteReply,
    } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    const query = args?.query?.trim();
    if (!query) {
      const errPayload = buildErrorContainerV2({
        title: "Query Kosong",
        description: eError + " | Harap masukkan judul lagu atau URL yang ingin diputar.",
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const VoiceManager = require("../../../src/managers/voiceManager");
    if (VoiceManager.hasActiveConnection(guild.id)) {
      await VoiceManager.yieldToMusic(guild.id);
    }

    // Catatan: koneksi Poru sengaja DITUNDA sampai intro native selesai.
    // Satu bot hanya boleh punya satu koneksi voice per guild; kalau Poru
    // sudah join lebih dulu, voice native tidak bisa memutar intro.
    const ensurePlayer = () => {
      if (!player) {
        player = poru.createConnection({
          guildId: guild.id,
          voiceChannel: memberVoice.id,
          textChannel: channel.id,
          deaf: true,
        });
        player.is247 = false;
        ctx.player = player;
      }
      return player;
    };

    // YouTube sedang menolak request node Lavalink publik dengan bot detection.
    // Jangan biarkan env lama (mis. MUSIC_DEFAULT_SEARCH=ytsearch) membuat
    // pencarian biasa selalu gagal. Prefix eksplisit yt:/ytsearch: tetap
    // tersedia untuk pengguna yang memang ingin mencoba YouTube.
    const configuredSearch = String(env.MUSIC_DEFAULT_SEARCH || "").toLowerCase();
    const defaultSearch = ["scsearch", "spsearch", "amsearch"].includes(configuredSearch)
      ? configuredSearch
      : "scsearch";
    let searchSource = defaultSearch;
    let finalQuery = query;
    const isDirectLink = !!query.match(/^(https?:\/\/)/);

    if (!isDirectLink) {
      if (query.startsWith("scsearch:") || query.startsWith("sc:")) {
        searchSource = "scsearch";
        finalQuery = query.startsWith("sc:")
          ? "scsearch:" + query.slice(3).trim()
          : query;
      } else if (query.startsWith("spsearch:") || query.startsWith("sp:")) {
        searchSource = "spsearch";
        finalQuery = query.startsWith("sp:")
          ? "spsearch:" + query.slice(3).trim()
          : query;
      } else if (query.startsWith("ytsearch:") || query.startsWith("yt:")) {
        searchSource = "ytsearch";
        finalQuery = query.startsWith("yt:")
          ? "ytsearch:" + query.slice(3).trim()
          : query;
      } else if (query.startsWith("ytmsearch:") || query.startsWith("ytm:")) {
        searchSource = "ytmsearch";
        finalQuery = query.startsWith("ytm:")
          ? "ytmsearch:" + query.slice(4).trim()
          : query;
      } else if (query.startsWith("amsearch:") || query.startsWith("am:")) {
        searchSource = "amsearch";
        finalQuery = query.startsWith("am:")
          ? "amsearch:" + query.slice(3).trim()
          : query;
      } else {
        finalQuery = searchSource + ":" + query;
      }
    }

    const isDjActive =
      require("../../../src/managers/aiDjManager").isDjEnabled(guild.id) &&
      require("../../../src/services/fishAudioService").isConfigured();

    const searchingPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Mencari Audio",
      description: isDjActive
        ? "🔍 Menganalisis gelombang suara untuk: **" + query + "**...\n🎙️ Menyiapkan suara Naura..."
        : "🔍 Menganalisis gelombang suara untuk: **" + query + "**...",
      footerText: ui.getFooter("music"),
    });
    await sendReply(searchingPayload, false);

    let res = null;
    try {
      res = await resolveSpotifyQuery(poru, finalQuery, user);
    } catch (err) {
      const { logger } = require("../../../src/managers/logger");
      logger.warn(`[playEngine] Resolve awal gagal untuk "${finalQuery}": ${err?.message || err}`);
    }

    // FALLBACK CHAIN YouTube bypass (Fix 2026-10-28):
    // Prioritas fallback: scsearch (SoundCloud) lebih dulu karena tidak terkena
    // bot detection, lalu ytmsearch, lalu ytsearch sebagai upaya terakhir.
    let finalRes = res;

    const isResEmpty = (r) =>
      !r ||
      !r.tracks ||
      r.tracks.length === 0 ||
      r.loadType === "empty" ||
      r.loadType === "NO_MATCHES" ||
      r.loadType === "LOAD_FAILED";

    if (!isDirectLink && isResEmpty(finalRes)) {
      const cleanRawQuery = query
        .replace(/^(?:scsearch|ytsearch|ytmsearch|amsearch|spsearch|dzsearch|sc|yt|ytm|am|sp|dz):/i, "")
        .trim();
      const fallbackChain = ["scsearch", "ytmsearch", "ytsearch"].filter(
        (s) => s !== searchSource,
      );

      for (const fallbackSource of fallbackChain) {
        try {
          const fallbackRes = await poru.resolve({
            query: fallbackSource + ":" + cleanRawQuery,
            requester: user,
          });
          if (!isResEmpty(fallbackRes)) {
            finalRes = fallbackRes;
            break;
          }
        } catch (_) {}
      }
    } else if (isDirectLink && isResEmpty(finalRes)) {
      // Link langsung bisa gagal karena bot detection YouTube. Cari padanan
      // judulnya di SoundCloud sebelum menyerah.
      try {
        const { logger } = require("../../../src/managers/logger");
        const ytIdMatch = finalQuery.match(/(?:v=|\/)([0-9A-Za-z_-]{11})/);
        const fallbackQuery = ytIdMatch ? ytIdMatch[1] : query;

        logger.info(
          `[playEngine] Link langsung gagal (${finalRes?.loadType || "unknown"}). Mengalihkan ke SoundCloud: "${fallbackQuery}".`,
        );

        const scRes = await poru.resolve({
          query: `scsearch:${fallbackQuery}`,
          requester: user,
        });
        if (!isResEmpty(scRes)) {
          finalRes = scRes;
        }
      } catch (_) {}
    }


    if (
      !finalRes ||
      !finalRes.tracks ||
      finalRes.tracks.length === 0 ||
      finalRes.loadType === "empty" ||
      finalRes.loadType === "NO_MATCHES"
    ) {
      const errPayload = buildErrorContainerV2({
        title: "Audio Tidak Ditemukan",
        description: eError + " | Frekuensi audio tidak ditemukan.",
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const firstTrackSource = finalRes.tracks[0]?.info?.sourceName || "";
    let brandColor = searchSource === "scsearch" ? "#FF7700" : "#FF0000";
    let brandEmoji =
      searchSource === "scsearch"
        ? ui.getEmoji("soundcloud") || "☁️"
        : ui.getEmoji("youtube") || "▶️";

    if (
      query.includes("spotify.com") ||
      searchSource === "spsearch" ||
      firstTrackSource === "spotify" ||
      finalRes.pluginInfo?.source === "spotify-fallback"
    ) {
      brandColor = "#1DB954";
      brandEmoji = ui.getEmoji("spotify") || "🎵";
    } else if (
      searchSource === "scsearch" ||
      firstTrackSource === "soundcloud"
    ) {
      brandColor = "#FF7700";
      brandEmoji = ui.getEmoji("soundcloud") || "☁️";
    } else if (
      searchSource === "amsearch" ||
      firstTrackSource === "applemusic"
    ) {
      brandColor = "#FA243C";
      brandEmoji = ui.getEmoji("apple") || "🍎";
    }

    if (finalRes.loadType === "playlist" || finalRes.loadType === "PLAYLIST_LOADED") {
      const trackToPlay = finalRes.tracks[0];
      ensurePlayer();
      for (const track of finalRes.tracks) {
        track.info.requester = user;
        player.queue.add(track);
      }
      const playlistPayload = buildContainerV2({
        accentColorHex: brandColor,
        title: brandEmoji + " Playlist Dimuat",
        iconURL: trackToPlay.info.image || client.user.displayAvatarURL(),
        description:
          (ui.getEmoji("musicArtist") || "👤") + " **Total:** `" + finalRes.tracks.length + " Lagu`\n⏳ Memasukkan ke antrean.",
        footerText: ui.getFooter("music"),
      });
      sendReply(playlistPayload, true);
      if (!player.isPlaying && !player.isPaused) player.play();
      return;
    }

    const track = finalRes.tracks[0];
    track.info.requester = user;

    if (
      musicManager.isDuplicateFilterEnabled(guild.id) &&
      musicManager.isRecentDuplicate(guild.id, track)
    ) {
      const dupPayload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#f59e0b",
        authorName: "HOSHINO MUSIC • SMART QUEUE",
        title: "⚠️ Lagu Terdeteksi Duplikat",
        iconURL: track.info.image || client.user.displayAvatarURL(),
        description:
          "Lagu **" + track.info.title + "** oleh **" + track.info.author + "** sudah diputar baru-baru ini dalam 5 lagu terakhir di server ini!\n\n" +
          "Demi menjaga keragaman musik di channel suara, lagu tidak ditambahkan ke antrean.\n" +
          "💡 *Gunakan `/music duplicates mode:off` jika ingin mengizinkan pemutaran lagu berulang.*",
        expression: "thinking",
        footerText: ui.getFooter("music"),
      });
      return sendReply(dupPayload, true);
    }

    // Intro native hanya aman untuk lagu pertama. Kalau Lavalink sudah aktif,
    // player itu pemilik voice channel dan intro tidak boleh merebut koneksi.
    const canPlayNativeIntro =
      !player ||
      (!player.isPlaying && !player.isPaused && !player.isConnected);

    // Siapkan intro DJ (TTS) untuk diputar lewat voice native Discord.
    // Intro TIDAK masuk antrean Lavalink: itu jalur lama yang gagal senyap
    // dan membebani node audio.
    let djIntro = null;
    if (isDjActive && canPlayNativeIntro) {
      djIntro = await aiDjTrackService.prepareDjIntroTrack({
        poru,
        channel,
        user,
        trackInfo: track.info,
        guildId: guild.id,
        musicManager,
        memberVoice,
      });
    }

    // Putar intro secara native, lalu serahkan voice channel ke Lavalink.
    if (djIntro && (djIntro.audioBuffer || djIntro.localFilePath)) {
      const VoiceManager = require("../../../src/managers/voiceManager");
      const { logger } = require("../../../src/managers/logger");

      // memberVoice bisa berupa objek VoiceChannel ATAU string id, tergantung
      // pemanggil. playIntroClip memerlukan objek channel karena butuh
      // guild.voiceAdapterCreator, jadi normalisasi dulu di sini.
      const resolveVoiceChannel = () => {
        if (memberVoice && typeof memberVoice === "object" && memberVoice.guild) {
          return memberVoice;
        }
        const channelId =
          typeof memberVoice === "string" ? memberVoice : memberVoice?.id;
        if (!channelId) return null;
        return guild.channels.cache.get(channelId) || null;
      };

      const voiceChannel = resolveVoiceChannel();

      if (!voiceChannel) {
        logger.warn(
          `[playEngine] Intro native dilewati: kanal suara tidak dapat di-resolve (memberVoice=${String(memberVoice)}).`,
        );
      } else {
        const introResult = await VoiceManager.playIntroClip({
          guildId: guild.id,
          voiceChannel,
          audioBuffer: djIntro.audioBuffer,
          filePath: djIntro.localFilePath,
        });

        if (!introResult.success) {
          logger.warn(
            `[playEngine] Intro native gagal diputar (${introResult.reason || "unknown"}). Lanjut ke lagu utama.`,
          );
        } else {
          logger.info(
            `[playEngine] Intro native selesai diputar dalam ${introResult.durationMs || 0}ms.`,
          );
        }
      }
    }

    // Intro selesai (atau dilewati): pastikan koneksi native sudah lepas
    // sebelum Poru mengambil alih voice channel yang sama.
    const VoiceManagerCleanup = require("../../../src/managers/voiceManager");
    if (VoiceManagerCleanup.hasActiveConnection(guild.id)) {
      VoiceManagerCleanup.disconnect(guild.id);
    }

    ensurePlayer();

    const isFirstTrack =
      !player.isPlaying && !player.isPaused && player.queue.length === 0;

    // Lagu utama tidak perlu memicu pengumuman DJ lagi: intro sudah diputar.
    track.info.skipDj = true;

    player.queue.add(track);
    if (!player.isPlaying && !player.isPaused) player.play();

    if (isFirstTrack) {
      if (deleteReply) deleteReply();
      return;
    }

    const trackPayload = buildContainerV2({
      accentColorHex: brandColor,
      title: brandEmoji + " " + track.info.title,
      iconURL: track.info.image || client.user.displayAvatarURL(),
      description:
        (ui.getEmoji("musicArtist") || "👤") + " **Artis:** `" + track.info.author + "`\n⏳ **Durasi:** `" + formatDuration(track.info.length) + "`",
      footerText: ui.getFooter("music"),
    });

    return sendReply(trackPayload, true);
  },
};
