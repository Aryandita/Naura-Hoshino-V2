"use strict";

const { AttachmentBuilder } = require("discord.js");
const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const GuildSettings = require("../../../src/models/GuildSettings");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { resolveSpotifyQuery } = require("../../../src/music/spotifyResolver");
const { formatDuration } = require("../helpers/musicShared");
const aiDjManager = require("../../../src/managers/aiDjManager");
const fishAudioService = require("../../../src/services/fishAudioService");

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
      description: `⏳ Memindai frekuensi stasiun **${subcommand.toUpperCase()}**...`,
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
        title: `${stIcon} Stasiun Terhubung`,
        description: `Mode transmisi 24/7 otomatis aktif.\n${divider}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(connPayload);
    }
    const errPayload = buildErrorContainerV2({
      title: "Gagal Kunci Frekuensi",
      description: `${eError} | Gagal mengunci frekuensi stasiun.`,
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
      player.is247 = false;
      ctx.player = player;
    }

    const query = args.query;
    if (!query) {
      const errPayload = buildErrorContainerV2({
        title: "Query Kosong",
        description: `${eError} | Harap masukkan judul lagu atau URL yang ingin diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const defaultSearch = env.MUSIC_DEFAULT_SEARCH || "scsearch";
    let searchSource = defaultSearch;
    let finalQuery = query;
    const isDirectLink = !!query.match(/^(https?:\/\/)/);

    if (!isDirectLink) {
      if (query.startsWith("scsearch:") || query.startsWith("sc:")) {
        searchSource = "scsearch";
        finalQuery = query.startsWith("sc:")
          ? `scsearch:${query.slice(3).trim()}`
          : query;
      } else if (query.startsWith("spsearch:") || query.startsWith("sp:")) {
        searchSource = "spsearch";
        finalQuery = query.startsWith("sp:")
          ? `spsearch:${query.slice(3).trim()}`
          : query;
      } else if (query.startsWith("ytsearch:") || query.startsWith("yt:")) {
        searchSource = "ytsearch";
        finalQuery = query.startsWith("yt:")
          ? `ytsearch:${query.slice(3).trim()}`
          : query;
      } else if (query.startsWith("ytmsearch:") || query.startsWith("ytm:")) {
        searchSource = "ytmsearch";
        finalQuery = query.startsWith("ytm:")
          ? `ytmsearch:${query.slice(4).trim()}`
          : query;
      } else if (query.startsWith("amsearch:") || query.startsWith("am:")) {
        searchSource = "amsearch";
        finalQuery = query.startsWith("am:")
          ? `amsearch:${query.slice(3).trim()}`
          : query;
      } else {
        finalQuery = `${searchSource}:${query}`;
      }
    }

    const isDjActive =
      aiDjManager.isDjEnabled(guild.id) && fishAudioService.isConfigured();

    const searchingPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Mencari Audio",
      description: isDjActive
        ? `🔍 Menganalisis gelombang suara untuk: **${query}**...\n🎙️ Menyiapkan suara Naura...`
        : `🔍 Menganalisis gelombang suara untuk: **${query}**...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(searchingPayload, false);

    const res = await resolveSpotifyQuery(poru, finalQuery, user);

    if (
      !res ||
      !res.tracks ||
      res.tracks.length === 0 ||
      res.loadType === "empty" ||
      res.loadType === "NO_MATCHES"
    ) {
      const errPayload = buildErrorContainerV2({
        title: "Audio Tidak Ditemukan",
        description: `${eError} | Frekuensi audio tidak ditemukan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const firstTrackSource = res.tracks[0]?.info?.sourceName || "";
    let brandColor = searchSource === "scsearch" ? "#FF7700" : "#FF0000";
    let brandEmoji =
      searchSource === "scsearch"
        ? ui.getEmoji("soundcloud") || "☁️"
        : ui.getEmoji("youtube") || "▶️";

    if (
      query.includes("spotify.com") ||
      searchSource === "spsearch" ||
      firstTrackSource === "spotify" ||
      res.pluginInfo?.source === "spotify-fallback"
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

    if (res.loadType === "playlist" || res.loadType === "PLAYLIST_LOADED") {
      const trackToPlay = res.tracks[0];
      for (const track of res.tracks) {
        track.info.requester = user;
        player.queue.add(track);
      }
      const playlistPayload = buildContainerV2({
        accentColorHex: brandColor,
        title: `${brandEmoji} Playlist Dimuat`,
        iconURL: trackToPlay.info.image || client.user.displayAvatarURL(),
        description: `${ui.getEmoji("musicArtist") || "👤"} **Total:** \`${res.tracks.length} Lagu\`\n⏳ Memasukkan ke antrean.`,
        footerText: ui.getFooter("music"),
      });
      sendReply(playlistPayload, true);
      if (!player.isPlaying && !player.isPaused) player.play();
      return;
    }

    const track = res.tracks[0];
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
          `Lagu **${track.info.title}** oleh **${track.info.author}** sudah diputar baru-baru ini dalam 5 lagu terakhir di server ini!\n\n` +
          `Demi menjaga keragaman musik di channel suara, lagu tidak ditambahkan ke antrean.\n` +
          `💡 *Gunakan \`/music duplicates mode:off\` jika ingin mengizinkan pemutaran lagu berulang.*`,
        expression: "thinking",
        footerText: ui.getFooter("music"),
      });
      return sendReply(dupPayload, true);
    }

    let ttsTrack = null;
    if (isDjActive) {
      const requesterName = user.displayName || user.username;
      const lang = await aiDjManager.detectVoiceLanguage(
        musicManager,
        guild.id,
        memberVoice.id,
      );
      const { script, classification } = aiDjManager.generateDjScript(
        track.info,
        requesterName,
        [],
        lang,
      );

      try {
        const audioBuffer = await fishAudioService.generateSpeech(script, {
          format: "mp3",
          latency: "low",
        });

        if (audioBuffer) {
          const attachment = new AttachmentBuilder(audioBuffer, {
            name: "naura_dj_intro.mp3",
          });

          const speakPayload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: `🎙️ Hoshino FM`,
            description: `> _"${script}"_`,
            expression: "singing",
            footerText: ui.getFooter("music"),
          });
          speakPayload.files = [attachment];

          const speakMsg = await channel.send(speakPayload);

          if (
            speakMsg &&
            speakMsg.attachments &&
            speakMsg.attachments.size > 0
          ) {
            const playableUrl = speakMsg.attachments.first().url;

            const ttsRes = await poru.resolve({
              query: playableUrl,
              requester: user,
            });
            if (ttsRes && ttsRes.tracks && ttsRes.tracks.length > 0) {
              ttsTrack = ttsRes.tracks[0];
              ttsTrack.info.title = `🎙️ Naura DJ: ${classification.genre.replace("_", " ")} Session`;
              ttsTrack.info.author = "Naura Hoshino";
              ttsTrack.info.originalSource = "http";
              ttsTrack.isTTS = true;

              track.info.skipDj = true;
              if (speakMsg && speakMsg.id) track.ttsMessageId = speakMsg.id;
            }
          }
        }
      } catch (err) {
        console.warn(`[Music] Gagal generate TTS saat antre: ${err.message}`);
      }
    }

    const isFirstTrack =
      !player.isPlaying && !player.isPaused && player.queue.length === 0;

    if (ttsTrack) {
      player.queue.add(ttsTrack);
    }

    player.queue.add(track);
    if (!player.isPlaying && !player.isPaused) player.play();

    if (isFirstTrack) {
      if (deleteReply) deleteReply();
    }

    if (ttsTrack) {
      return;
    }

    if (isFirstTrack) {
      return;
    } else {
      const trackPayload = buildContainerV2({
        accentColorHex: brandColor,
        title: `${brandEmoji} ${track.info.title}`,
        iconURL: track.info.image || client.user.displayAvatarURL(),
        description: `${ui.getEmoji("musicArtist") || "👤"} **Artis:** \`${track.info.author}\`\n⏳ **Durasi:** \`${formatDuration(track.info.length)}\``,
        footerText: ui.getFooter("music"),
      });

      return sendReply(trackPayload, true);
    }
  },
};
