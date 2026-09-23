// Lokasi: src/commands/music.js
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  AttachmentBuilder,
} = require("discord.js");
const ui = require("../../src/config/ui");
const UserProfile = require("../../src/models/UserProfile");
const GuildSettings = require("../../src/models/GuildSettings");
const UserPlaylist = require("../../src/models/UserPlaylist");
const env = require("../../src/config/env");

const { generateMusicProfileImage } = require("../../src/canvas/canvasHelper");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { getPlatformIcon } = require("../../src/canvas/CanvasUtils");
const { resolveSpotifyQuery } = require("../../src/music/spotifyResolver");

const formatDuration = (ms) => {
  if (!ms || isNaN(ms)) return "0:00";
  if (ms >= 8640000000) return "🔴 LIVE";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

async function runMusicLogic(
  client,
  user,
  member,
  guild,
  channel,
  subcommand,
  args,
  sendReply,
  isSlash,
) {
  const poru = client.musicManager.poru;
  const musicManager = client.musicManager;
  const memberVoice = member?.voice?.channel;
  const eError = ui.getEmoji("error") || "❌";
  const divider = `-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;

  if (subcommand === "profile") {
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki kartu profil musik!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const profile = await cacheManager.getUserProfile(target.id);
      const calculateTop5 = (jsonInput) => {
        if (!jsonInput) return [];
        try {
          const data =
            typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
          if (!data.history) return [];
          const sorted = Object.entries(data.history).sort(
            (a, b) => b[1] - a[1],
          );
          return sorted.slice(0, 5).map((entry) => entry[0]);
        } catch (e) {
          return [];
        }
      };

      const stats = {
        tracksListened: profile.music_tracksListened || 0,
        totalDurationMs: profile.music_totalDurationMs || 0,
        lastListened: profile.music_lastListened || "Belum ada data",
        topTracks: calculateTop5(profile.music_topTrack),
        topServers: calculateTop5(profile.music_topServer),
        topFriends: calculateTop5(profile.music_topFriend),
        isPremium: profile.isPremium && profile.premiumUntil > new Date(),
      };
      const imageBuffer = await generateMusicProfileImage(
        target,
        stats,
        client.user.displayAvatarURL({ extension: "png" }),
      );
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "naura-audiophile.webp",
      });
      const profilePayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `🎧 Profil Musik: ${target.username}`,
        bannerAttachmentName: "naura-audiophile.webp",
        footerText: ui.getFooter("music"),
      });
      return sendReply({ ...profilePayload, files: [attachment] });
    } catch (error) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Render Profil",
        description: `${eError} | Gagal merender kartu profil dari server.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  if (subcommand === "aura") {
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki Music Aura!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const musicAuraService = require("../../src/services/musicAuraService");
      const profile = await cacheManager.getUserProfile(target.id);

      // Ekstraksi riwayat trek musik
      let tracks = [];
      if (profile && profile.music_history) {
        try {
          const hist =
            typeof profile.music_history === "string"
              ? JSON.parse(profile.music_history)
              : profile.music_history;
          if (hist.history) {
            tracks = Object.keys(hist.history).slice(0, 10);
          }
        } catch (_) {}
      }

      // Fallback: cek lagu yang sedang aktif diputar
      if (tracks.length === 0 && poru && guild) {
        const player = poru.players?.get(guild.id);
        if (player && player.currentTrack) {
          tracks.push(player.currentTrack.info.title);
        }
      }

      const avatarUrl = target.displayAvatarURL({
        extension: "png",
        size: 256,
      });
      const { auraData, cardBuffer } = await musicAuraService.generateMusicAura(
        {
          username: target.username,
          avatarUrl,
          tracks,
          guildName: guild?.name || "Server Naura",
        },
      );

      const file = new AttachmentBuilder(cardBuffer, {
        name: "music_aura.png",
      });
      const auraPayload = buildContainerV2({
        accentColorHex: auraData.primaryColor || "#38BDF8",
        authorName: `${target.username} - Resonansi Musik`,
        title: `🔮 AI Music Aura: ${auraData.auraName}`,
        bannerAttachmentName: "music_aura.png",
        description: [
          `> *"${auraData.description}"*`,
          "",
          `• **Signature Track:** 🎵 ${auraData.signatureTrack}`,
          `• **Dominant Genres:** ${Array.isArray(auraData.genres) ? auraData.genres.join(", ") : "Lo-Fi, Synthwave"}`,
          `• **Vibe Energy:** ⚡ ${auraData.energy}% | **Tempo:** 🎚️ ${auraData.tempo} BPM`,
        ].join("\n"),
        files: [file],
        footerText: ui.getFooter("music"),
      });

      return sendReply(auraPayload);
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menganalisis Aura",
        description: `${eError} | Terjadi kesalahan saat membaca resonansi aura musik: ${err.message}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  if (subcommand === "wrapped") {
    let target = user;
    if (isSlash && args.target) target = args.target;
    if (target.bot) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${eError} | Bot tidak memiliki kartu Naura Wrapped!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
      const profile = await cacheManager.getUserProfile(target.id);
      const calculateTop5 = (jsonInput) => {
        if (!jsonInput) return [];
        try {
          const data =
            typeof jsonInput === "string" ? JSON.parse(jsonInput) : jsonInput;
          if (!data.history) return [];
          const sorted = Object.entries(data.history).sort(
            (a, b) => b[1] - a[1],
          );
          return sorted.slice(0, 5).map((entry) => entry[0]);
        } catch (e) {
          return [];
        }
      };

      const stats = {
        tracksListened: profile?.music_tracksListened || 0,
        totalDurationMs: profile?.music_totalDurationMs || 0,
        lastListened: profile?.music_lastListened || "Belum ada data",
        topTracks: calculateTop5(profile?.music_topTrack),
        topServers: calculateTop5(profile?.music_topServer),
        topFriends: calculateTop5(profile?.music_topFriend),
        isPremium: profile?.isPremium && profile?.premiumUntil > new Date(),
      };

      const imageBuffer = await canvasWorkerPool.execute({
        task: "renderWrapped",
        payload: { user: target, stats },
        userId: target.id,
      });
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "naura-wrapped.png",
      });
      const hours = (stats.totalDurationMs / (1000 * 60 * 60)).toFixed(1);
      const wrappedPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `✨ Naura Music Wrapped: ${target.displayName || target.username}`,
        description: `Kilas balik petualangan musik **${target.displayName || target.username}** bersama Naura!\n\n🎧 **Total Lagu Didengar:** \`${stats.tracksListened} lagu\`\n⏳ **Waktu Berputar:** \`${hours} jam\`\n🎵 **Lagu Teratas:** \`${stats.topTracks[0] || "Belum ada data"}\`\n🏰 **Server Favorit:** \`${stats.topServers[0] || guild.name}\`\n\n*Terima kasih telah mewarnai harimu bersama alunan musik Naura Hoshino~* 🌸`,
        bannerAttachmentName: "naura-wrapped.png",
        footerText: ui.getFooter("music"),
      });
      return sendReply({ ...wrappedPayload, files: [attachment] });
    } catch (error) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Render Wrapped",
        description: `${eError} | Gagal merender kartu Naura Wrapped dari server.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  if (!memberVoice) {
    const errPayload = buildErrorContainerV2({
      title: "Koneksi Gagal",
      description: `${eError} | Anda harus berada di dalam Voice Channel terlebih dahulu!`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(errPayload, true);
  }

  let player = poru.players.get(guild.id);
  if (player && player.voiceChannel !== memberVoice.id) {
    const errPayload = buildErrorContainerV2({
      title: "Voice Channel Berbeda",
      description: `${eError} | Naura sedang aktif di Voice Channel lain.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(errPayload, true);
  }

  if (subcommand === "dj") {
    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
    }

    const mode = args.mode || "on";
    if (mode === "on") {
      player.aiDjEnabled = true;
      player.isAutoplay = true;

      if (!player.isPlaying && player.queue.length === 0) {
        const openingTrackRes = await poru.resolve({
          query: "scsearch:cyberpunk lofi chill beats",
          requester: user,
        });
        if (
          openingTrackRes &&
          openingTrackRes.tracks &&
          openingTrackRes.tracks[0]
        ) {
          player.queue.add(openingTrackRes.tracks[0]);
          player.play();
        }
      }

      const djPayload = buildContainerV2({
        accentColorHex: "#93C5FD",
        title: "🎧 AI Smart DJ: Hoshino FM 104.5",
        expression: "cheer",
        description: `🎙️ **Naura AI Smart DJ telah Mengudara!**\n\nNaura kini aktif memandu sesi musik di <#${memberVoice.id}> dengan kurasi pintar otomatis, sinkronisasi mood obrolan, dan transisi lagu dinamis.\n${divider}\n💡 *Ketik \`/music dj off\` untuk mematikan mode DJ cerdas.*`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(djPayload);
    } else if (mode === "off") {
      player.aiDjEnabled = false;
      const offPayload = buildContainerV2({
        accentColorHex: "#FFB347",
        title: "🎧 AI Smart DJ Dimatikan",
        expression: "idle",
        description: `Mode AI Smart DJ telah dinonaktifkan. Naura kembali ke mode pemutaran antrean normal.\n${divider}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(offPayload);
    } else {
      const statusPayload = buildContainerV2({
        accentColorHex: "#93C5FD",
        title: "🎧 Status AI Smart DJ",
        expression: "smile",
        description: `Status AI DJ saat ini: **${player.aiDjEnabled ? "🟢 AKTIF" : "🔴 NONAKTIF"}**\nChannel Voice: <#${memberVoice.id}>\nAutoplay Cerdas: **${player.isAutoplay ? "Aktif" : "Mati"}**\n${divider}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(statusPayload);
    }
  }

  if (subcommand === "lofi" || subcommand === "radio") {
    if (!player)
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });

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
  }

  if (subcommand === "play") {
    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
      player.is247 = false;
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

    const searchingPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Mencari Audio",
      description: `🔍 Menganalisis gelombang suara untuk: **${query}**...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(searchingPayload, false);

    // Lewati resolver terpadu: LavaSrc di node menyelesaikan link Spotify
    // secara native, dan bila node tidak punya plugin, spotifyResolver
    // menerjemahkannya manual (Web API -> search ISRC/judul).
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
        // originalSource sudah distempel oleh spotifyResolver untuk link Spotify.
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

    player.queue.add(track);
    if (!player.isPlaying && !player.isPaused) player.play();

    const trackPayload = buildContainerV2({
      accentColorHex: brandColor,
      title: `${brandEmoji} ${track.info.title}`,
      iconURL: track.info.image || client.user.displayAvatarURL(),
      description: `${ui.getEmoji("musicArtist") || "👤"} **Artis:** \`${track.info.author}\`\n⏳ **Durasi:** \`${formatDuration(track.info.length)}\``,
      footerText: ui.getFooter("music"),
    });

    return sendReply(trackPayload, true);
  }

  if (subcommand === "import") {
    const url = args.url || args.query;
    if (!url || !url.match(/^https?:\/\//)) {
      const errPayload = buildErrorContainerV2({
        title: "URL Tidak Valid",
        description: `${eError} | Harap masukkan URL Playlist yang valid.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const [profile] = await UserProfile.findOrCreate({
      where: { userId: user.id },
    });
    const isPremium = profile.isPremium && profile.premiumUntil > new Date();
    const userPlaylistsCount = await UserPlaylist.count({
      where: { userId: user.id },
    });
    if (!isPremium && userPlaylistsCount >= 3) {
      const errPayload = buildErrorContainerV2({
        title: "Batas Playlist Tercapai",
        description: `${eError} | Pengguna standar hanya dapat menyimpan maksimal **3 Playlist**.\nGunakan \`/premium\` untuk mendapatkan akses simpan tanpa batas!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const importingPayload = buildContainerV2({
      accentColorHex: "#1DB954",
      title: "Mengimpor Playlist",
      description: `⏳ Sedang mengimpor playlist ke database Naura...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(importingPayload);

    try {
      let playlistName = "Imported Playlist";
      let tracksToSave = [];

      const res = await poru.resolve({ query: url, requester: user });
      if (
        res &&
        (res.loadType === "PLAYLIST_LOADED" || res.loadType === "playlist")
      ) {
        playlistName = res.playlistInfo.name || "Imported Playlist";
        tracksToSave = res.tracks.map((t) => t.info.uri || t.info.title);
      } else if (res && res.tracks && res.tracks.length > 0) {
        playlistName = "Imported Track";
        tracksToSave = [res.tracks[0].info.uri || res.tracks[0].info.title];
      }

      if (tracksToSave.length === 0) {
        const errPayload = buildErrorContainerV2({
          title: "Gagal Impor",
          description: `${eError} | Gagal mengimpor data.`,
          footerText: ui.getFooter("music"),
        });
        return sendReply(errPayload, true);
      }

      await UserPlaylist.create({
        userId: user.id,
        name: playlistName,
        tracks: tracksToSave,
        spotifyUrl: url,
      });
      const importedSuccessPayload = buildContainerV2({
        accentColorHex: "#1DB954",
        title: `${ui.getEmoji("success") || "✅"} Berhasil Diimpor`,
        description: `**Nama:** \`${playlistName}\`\n**Total:** \`${tracksToSave.length} Trek\`\n\nGunakan \`/music playplaylist\` untuk memutar!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(importedSuccessPayload);
    } catch (error) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Proses",
        description: `${eError} | Terjadi kesalahan saat memproses URL.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  if (subcommand === "share") {
    const pid = args.id;
    if (!pid) {
      const errPayload = buildErrorContainerV2({
        title: "ID Diperlukan",
        description: `${eError} | Harap masukkan ID Playlist untuk dibagikan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const playlist = await UserPlaylist.findOne({
      where: { id: pid, userId: user.id },
    });
    if (!playlist) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ditemukan",
        description: `${eError} | Playlist tidak ditemukan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const encodedCode = `NRA${Buffer.from(pid.toString()).toString("base64")}URA`;

    const sharePayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "🔗 Playlist Dibagikan!",
      description: `Playlist **${playlist.name}** milikmu siap dibagikan!\n\nBagikan kode ini ke temanmu:\n\`\`\`\n${encodedCode}\n\`\`\`\nMereka bisa menggunakan \`/music load <kode>\` untuk menyalinnya.`,
      footerText: ui.getFooter("music"),
    });

    return sendReply(sharePayload);
  }

  if (subcommand === "load") {
    const code = args.query;
    if (!code || !code.startsWith("NRA") || !code.endsWith("URA")) {
      const errPayload = buildErrorContainerV2({
        title: "Kode Salah",
        description: `${eError} | Kode playlist tidak valid.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    try {
      const decodedId = Buffer.from(
        code.substring(3, code.length - 3),
        "base64",
      ).toString("ascii");
      const sourcePlaylist = await UserPlaylist.findOne({
        where: { id: parseInt(decodedId) },
      });

      if (!sourcePlaylist) {
        const errPayload = buildErrorContainerV2({
          title: "Tidak Ditemukan",
          description: `${eError} | Playlist asal tidak ditemukan atau sudah dihapus.`,
          footerText: ui.getFooter("music"),
        });
        return sendReply(errPayload, true);
      }

      const newName = `${sourcePlaylist.name} (Copy)`;
      await UserPlaylist.create({
        userId: user.id,
        name: newName,
        tracks: sourcePlaylist.tracks,
        spotifyUrl: sourcePlaylist.spotifyUrl,
      });

      const copyPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("success") || "✅"} Berhasil Menyalin`,
        description: `**Nama:** \`${newName}\`\n**Total:** \`${sourcePlaylist.tracks.length} Trek\`\n\nGunakan \`/music playplaylist\` untuk memutar!`,
        footerText: ui.getFooter("music"),
      });

      return sendReply(copyPayload);
    } catch (e) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menyalin",
        description: `${eError} | Gagal menyalin playlist.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  }

  if (subcommand === "myplaylist") {
    const playlists = await UserPlaylist.findAll({
      where: { userId: user.id },
    });
    if (playlists.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Playlist Kosong",
        description: `${eError} | Kamu belum memiliki playlist tersimpan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    let desc = "";
    playlists.forEach((p, i) => {
      desc += `**${i + 1}.** ${p.name} (\`${p.tracks.length} Lagu\`)\n*ID Play:* \`${p.id}\`\n\n`;
    });

    const listPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "📁 Daftar Playlist Tersimpan",
      description: desc || "Kosong",
      footerText: ui.getFooter("music"),
    });
    return sendReply(listPayload);
  }

  if (subcommand === "playplaylist") {
    if (!memberVoice) {
      const errPayload = buildErrorContainerV2({
        title: "Koneksi Gagal",
        description: `${eError} | Anda harus berada di dalam Voice Channel terlebih dahulu!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    const pid = args.id;
    if (!pid) {
      const errPayload = buildErrorContainerV2({
        title: "ID Diperlukan",
        description: `${eError} | Harap masukkan ID Playlist.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const playlist = await UserPlaylist.findOne({
      where: { id: pid, userId: user.id },
    });
    if (!playlist) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ditemukan",
        description: `${eError} | Playlist tidak ditemukan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
      player.is247 = false;
    }

    const loadingPayload = buildContainerV2({
      accentColorHex: "#1DB954",
      title: "Memuat Playlist",
      description: `⏳ Memuat \`${playlist.tracks.length}\` lagu dari **${playlist.name}**...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(loadingPayload, true);

    let loaded = 0;
    let firstTrack = null;

    (async () => {
      for (const query of playlist.tracks) {
        try {
          const defaultSearch = env.MUSIC_DEFAULT_SEARCH || "scsearch";
          const finalQuery = query.match(
            /^(?:https?:\/\/|spsearch:|ytmsearch:|ytsearch:|scsearch:|amsearch:)/,
          )
            ? query
            : `${defaultSearch}:${query}`;
          const res = await resolveSpotifyQuery(poru, finalQuery, user);
          if (res && res.tracks && res.tracks.length > 0) {
            res.tracks[0].info.requester = user;
            player.queue.add(res.tracks[0]);
            loaded++;
            if (!firstTrack) {
              firstTrack = res.tracks[0];
              if (!player.isPlaying && !player.isPaused) player.play();
            }
          }
        } catch (e) {}
      }
      const syncPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("success") || "✅"} Sinkronisasi Selesai`,
        description: `**Nama:** \`${playlist.name}\`\n**Berhasil Dimuat:** \`${loaded} / ${playlist.tracks.length} Lagu\``,
        footerText: ui.getFooter("music"),
      });
      channel
        .send(syncPayload)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 15000))
        .catch(() => {});
    })();
    return;
  }

  if (subcommand === "pause") {
    if (!player || !player.isPlaying) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada lagu yang sedang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    if (player.isPaused) {
      const errPayload = buildErrorContainerV2({
        title: "Sudah Dijeda",
        description: `${eError} | Musik sudah dalam keadaan dijeda.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.pause(true);
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("warning") || "#f59e0b",
      title: "⏸️ Transmisi Dijeda",
      description: `Sesi audio ditahan sementara.\n${divider}`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "resume") {
    if (!player || !player.isPlaying) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada lagu yang sedang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    if (!player.isPaused) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Dijeda",
        description: `${eError} | Musik tidak sedang dijeda.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.pause(false);
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "▶️ Transmisi Dilanjutkan",
      description: `Melanjutkan pemutaran audio.\n${divider}`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "nowplaying") {
    if (!player || !player.currentTrack) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada lagu yang sedang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    const track = player.currentTrack.info;
    const sourceIcon = getPlatformIcon(
      track.originalSource || track.sourceName,
    );

    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const userProfile = await cacheManager.getUserProfile(user.id);
      let equippedBanner = null;
      try {
        if (userProfile && userProfile.activeBanners) {
          const banners =
            typeof userProfile.activeBanners === "string"
              ? JSON.parse(userProfile.activeBanners)
              : userProfile.activeBanners;
          const bannerId = banners.music;
          if (bannerId) {
            equippedBanner = `./plugin/canvas/assets/banners/${bannerId}.png`;
            // For now we will assume the banner image files are provided. Wait, I should use absolute path or require!
            // Let's just pass bannerId, we can load it in canvas
            equippedBanner = bannerId;
          }
        }
      } catch (e) {}

      const {
        drawNowPlayingCard,
      } = require("../../src/canvas/nowplayingCanvas");
      const playbackInfo = { position: player.position, equippedBanner };
      const imageBuffer = await drawNowPlayingCard(track, playbackInfo);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "nowplaying.png",
      });

      const npPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🎶 Memutar Saat Ini",
        bannerAttachmentName: "nowplaying.png",
        footerText: ui.getFooter("music"),
      });

      return sendReply({ ...npPayload, files: [attachment] });
    } catch (error) {
      console.error(
        "\x1b[41m\x1b[37m 💥 nowplaying \x1b[0m \x1b[31mGagal menggambar visualizer card:",
        error,
        "\x1b[0m",
      );

      const fallbackPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🎶 Memutar Saat Ini",
        description: `### ${sourceIcon} [${track.title}](${track.uri})\n**Artis:** \`${track.author || "Tidak diketahui"}\`\n**Durasi:** \`${formatDuration(player.position)} / ${formatDuration(track.length)}\``,
        footerText: ui.getFooter("music"),
      });
      return sendReply(fallbackPayload);
    }
  }

  if (subcommand === "queue") {
    if (!player || player.queue.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Antrean Kosong",
        description: `${eError} | Antrean lagu kosong.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const pageSize = 10;
    const totalPages = Math.ceil(player.queue.length / pageSize);
    let currentPage = 0;

    const renderQueuePage = (page) => {
      const start = page * pageSize;
      const end = start + pageSize;
      const currentQueue = player.queue.slice(start, end);

      const qList = currentQueue
        .map((t, i) => {
          const sourceIcon = getPlatformIcon(
            t.info.originalSource || t.info.sourceName,
          );
          return `**${start + i + 1}.** ${sourceIcon} [${t.info.title}](${t.info.uri}) - \`${formatDuration(t.info.length)}\``;
        })
        .join("\n");

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`queue_prev_${page}`)
          .setLabel("« Sebelumnya")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId(`queue_next_${page}`)
          .setLabel("Selanjutnya »")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      );

      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `📜 Antrean Musik, Halaman ${page + 1} / ${totalPages}`,
        description: qList,
        buttonsRow: row,
        footerText: `Total Lagu dalam Antrean: ${player.queue.length}`,
      });
    };

    const initialPayload = renderQueuePage(currentPage);
    const qMsg = await sendReply({ ...initialPayload, fetchReply: true });

    if (totalPages <= 1 || !qMsg || !qMsg.createMessageComponentCollector)
      return;

    const collector = qMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description: "❌ Hanya pemanggil command yang bisa mengubah halaman.",
          footerText: ui.getFooter("music"),
        });
        return i.reply({
          ...errPayload,
          flags: require("discord.js").MessageFlags.Ephemeral,
        });
      }

      if (i.customId.startsWith("queue_prev_")) {
        currentPage = Math.max(0, currentPage - 1);
      } else if (i.customId.startsWith("queue_next_")) {
        currentPage = Math.min(totalPages - 1, currentPage + 1);
      }

      await i.update(renderQueuePage(currentPage));
    });

    collector.on("end", () => {
      qMsg.edit({ components: [] }).catch(() => {});
    });

    return;
  }

  if (subcommand === "loop") {
    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada lagu yang sedang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    const mode = args.mode || args.query;
    if (mode === "track") {
      player.setLoop("TRACK");
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "Loop Track",
        description: "🔂 | Mode pengulangan **LAGU SAAT INI** diaktifkan.",
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload, true);
    }
    if (mode === "queue") {
      player.setLoop("QUEUE");
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "Loop Queue",
        description: "🔁 | Mode pengulangan **SELURUH ANTREAN** diaktifkan.",
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload, true);
    }
    player.setLoop("NONE");
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Loop Off",
      description: "❌ | Mode pengulangan **DIMATIKAN**.",
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "shuffle") {
    if (!player || player.queue.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Antrean Kosong",
        description: `${eError} | Antrean lagu kosong.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.queue.shuffle();
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Shuffle",
      description: "🔀 | Urutan antrean telah diacak.",
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "clear") {
    if (!player || player.queue.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Antrean Kosong",
        description: `${eError} | Antrean lagu kosong.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.queue.clear();
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Clear Queue",
      description: "🗑️ | Seluruh antrean lagu dibersihkan.",
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "stop") {
    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Frekuensi",
        description: `${eError} | Tidak ada frekuensi aktif.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.queue.clear();
    if (player.is247) {
      player.isIdle247 = true;
      if (typeof player.stopTrack === "function") player.stopTrack();
      else if (player.node && player.node.rest)
        player.node.rest
          .updatePlayer({
            guildId: player.guildId,
            data: { track: { encoded: null } },
          })
          .catch(() => {});
      const MusicUIManager = require("../../src/music/MusicUIManager");
      await MusicUIManager.renderIdle247Panel(client.musicManager, player);
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "24/7 Mode Standby",
        description: `${ui.getEmoji("music247") || "🌙"} | Sesi audio dihentikan oleh pengguna. Mode 24/7 tetap **Siaga Pasif (0kbps Bandwidth & 0% CPU Load)**.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload, true);
    } else {
      player.destroy();
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("error") || "#ef4444",
        title: "Pemutusan Sistem",
        description: `### ${ui.getEmoji("musicStop") || "⏹️"} Pemutusan Sistem\n${divider}\nSesi audio dihentikan. Naura pamit dari Voice Channel.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload, true);
    }
  }

  if (subcommand === "skip") {
    if (!player || !player.currentTrack) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Bisa Skip",
        description: `${eError} | Tidak ada musik yang bisa dilewati.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    if (typeof player.stopTrack === "function") player.stopTrack();
    else if (player.node && player.node.rest)
      player.node.rest
        .updatePlayer({
          guildId: player.guildId,
          data: { track: { encoded: null } },
        })
        .catch(() => {});
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Skip Track",
      description: `### ${ui.getEmoji("musicSkip") || "⏭️"} Melewati Trek\n${divider}\nMemutar urutan selanjutnya...`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "volume") {
    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Frekuensi",
        description: `${eError} | Tidak ada frekuensi aktif.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    const vol = args.persen;
    if (!vol || isNaN(vol) || vol < 10 || vol > 100) {
      const errPayload = buildErrorContainerV2({
        title: "Volume Salah",
        description: `${eError} | Harap masukkan angka antara 10 - 100.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.setVolume(vol);
    player.baseVolume = vol;
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Volume Adjusted",
      description: `${vol >= 50 ? ui.getEmoji("musicVolUp") || "🔊" : ui.getEmoji("musicVolDown") || "🔉"} | Volume disetel ke **${vol}%**.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "filter") {
    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada musik yang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const type = args.tipe || "off";

    if (type === "off") {
      player.clearFilters();
    } else if (type === "bassboost") {
      player.setFilters({
        equalizer: [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.67 },
          { band: 2, gain: 0.67 },
          { band: 3, gain: 0 },
          { band: 4, gain: -0.5 },
          { band: 5, gain: 0.15 },
        ],
      });
    } else if (type === "nightcore") {
      player.setFilters({ timescale: { speed: 1.2, pitch: 1.2, rate: 1.0 } });
    } else if (type === "8d") {
      player.setFilters({ rotation: { rotationHz: 0.2 } });
    } else if (type === "pop") {
      player.setFilters({
        equalizer: [
          { band: 0, gain: 0.65 },
          { band: 1, gain: 0.45 },
          { band: 2, gain: -0.45 },
          { band: 3, gain: -0.65 },
          { band: 4, gain: -0.35 },
          { band: 5, gain: 0.45 },
        ],
      });
    } else if (type === "soft") {
      player.setFilters({
        equalizer: [
          { band: 0, gain: 0 },
          { band: 1, gain: 0 },
          { band: 2, gain: 0 },
          { band: 3, gain: 0 },
          { band: 4, gain: 0 },
          { band: 5, gain: 0 },
          { band: 6, gain: 0 },
          { band: 7, gain: -0.25 },
          { band: 8, gain: -0.25 },
          { band: 9, gain: -0.25 },
          { band: 10, gain: -0.25 },
          { band: 11, gain: -0.25 },
          { band: 12, gain: -0.25 },
          { band: 13, gain: -0.25 },
        ],
      });
    } else if (type === "treblebass") {
      player.setFilters({
        equalizer: [
          { band: 0, gain: 0.6 },
          { band: 1, gain: 0.67 },
          { band: 2, gain: 0.67 },
          { band: 3, gain: 0 },
          { band: 4, gain: -0.5 },
          { band: 5, gain: 0.15 },
          { band: 6, gain: -0.45 },
          { band: 7, gain: 0.23 },
          { band: 8, gain: 0.35 },
          { band: 9, gain: 0.45 },
          { band: 10, gain: 0.55 },
          { band: 11, gain: 0.6 },
          { band: 12, gain: 0.55 },
        ],
      });
    } else if (type === "karaoke") {
      player.setFilters({
        karaoke: {
          level: 1.0,
          monoLevel: 1.0,
          filterBand: 220.0,
          filterWidth: 100.0,
        },
      });
    } else if (type === "vibrato") {
      player.setFilters({ vibrato: { frequency: 2.0, depth: 0.5 } });
    } else if (type === "tremolo") {
      player.setFilters({ tremolo: { frequency: 2.0, depth: 0.5 } });
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Filter Audio",
      description: `🎛️ | Filter audio disetel ke **${type.toUpperCase()}**.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "dedicate") {
    const targetUser = args.target;
    const pesan = args.pesan || args.query;

    if (!targetUser) {
      const errPayload = buildErrorContainerV2({
        title: "Target Tidak Valid",
        description: `${eError} | Harap sebutkan user yang ingin kamu beri dedikasi lagu!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    if (!pesan || pesan.trim().length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Pesan Kosong",
        description: `${eError} | Tuliskan pesan dedikasi yang ingin disampaikan!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "💌 Dedikasi Lagu",
      title: "Dedikasi Lagu Terkirim!",
      description: [
        `Pesan dedikasi untuk <@${targetUser.id}> berhasil dikirimkan!`,
        ``,
        `💬 **Pesan:** *"${pesan.trim()}"*`,
        `👤 **Dari:** <@${user.id}>`,
      ].join("\n"),
      footerText: ui.getFooter("music"),
    });

    return sendReply(payload);
  }

  if (subcommand === "quiz") {
    const musicQuizEngine = require("../../src/music/musicQuizEngine");
    const totalRounds = args.ronde || args.id || 5;
    const session = await musicQuizEngine.startQuizSession(
      guild.id,
      channel.id,
      totalRounds,
    );
    const round1 = session.rounds[0];

    const choicesRow = new ActionRowBuilder().addComponents(
      round1.choices.map((choice, idx) =>
        new ButtonBuilder()
          .setCustomId(`mquiz_ans_${idx}`)
          .setLabel(choice)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const payload = buildContainerV2({
      accentColorHex: "#F43F5E",
      authorName: `🎵 Anime Music Quiz, Ronde 1 / ${session.totalRounds}`,
      title: "Tebak Judul Lagu!",
      description: [
        `Dengarkan lirik / cuplikan lagu berikut ini:`,
        ``,
        `> ${round1.audioHint}`,
        ``,
        `📺 **Petunjuk Anime:** \`${round1.anime}\` | **Artis:** \`${round1.artist}\``,
        ``,
        `-# ⚡ *Tekan tombol pilihan jawaban di bawah secepat mungkin untuk mendapatkan combo streak bonus!*`,
      ].join("\n"),
      footerText: ui.getFooter("music"),
      buttonsRow: choicesRow,
    });

    const replyMsg = await sendReply(payload);
    if (!replyMsg) return;

    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 45000,
    });

    collector.on("collect", async (btnInteraction) => {
      const choiceIdx = parseInt(
        btnInteraction.customId.replace("mquiz_ans_", ""),
        10,
      );
      const chosenText = round1.choices[choiceIdx];
      const answerRes = await musicQuizEngine.submitAnswer(
        guild.id,
        btnInteraction.user.id,
        btnInteraction.user.displayName || btnInteraction.user.username,
        chosenText,
        Date.now() - session.startedAt,
      );

      if (!answerRes.success) {
        return btnInteraction.reply({
          content: "❌ Kamu sudah menjawab ronde ini!",
          flags: 64,
        });
      }

      if (answerRes.isCorrect) {
        return btnInteraction.reply({
          content: `🎉 **BENAR!** Jawabanmu tepat: **${answerRes.correctAnswer}** (+${answerRes.pointsGained} Poin | Streak x${answerRes.streak})!`,
          flags: 64,
        });
      } else {
        return btnInteraction.reply({
          content: `❌ **SALAH!** Jawaban yang benar adalah **${answerRes.correctAnswer}**. Streak terputus!`,
          flags: 64,
        });
      }
    });

    return;
  }

  if (subcommand === "247") {
    const cacheManager = require("../../src/managers/cacheManager");
    const profile = await cacheManager.getUserProfile(user.id);
    const guildSettings = await cacheManager.getGuildSettings(guild.id);

    const isUserVip =
      profile?.isPremium &&
      profile?.premiumUntil &&
      new Date(profile.premiumUntil) > new Date();
    const isGuildVip =
      guildSettings?.isPremium || guildSettings?.settings?.isPremium;
    const env = require("../../src/config/env");
    const isOwner = env.OWNER_IDS.includes(user.id);

    if (!isUserVip && !isGuildVip && !isOwner) {
      const errPayload = buildErrorContainerV2({
        title: "Fitur VIP Terkunci",
        description: `${eError} | Akses ditolak! Mode 24/7 khusus untuk VIP Premium / Owner. Gunakan /premium untuk berlangganan!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Berada di dalam Voice Channel terlebih dahulu!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    player.is247 = !player.is247;
    try {
      const [guildData] = await GuildSettings.findOrCreate({
        where: { guildId: guild.id },
      });
      guildData.music = {
        twentyFourSeven: player.is247,
        voiceChannel: player.is247 ? player.voiceChannel : null,
        textChannel: player.is247 ? player.textChannel : null,
      };
      guildData.changed("music", true);
      await guildData.save({ fields: ["music"] });
      cacheManager.invalidateGuildSettings(guild.id);
    } catch (e) {}

    if (player.is247) {
      if (!player.currentTrack && !player.isPlaying) {
        player.isIdle247 = true;
        const MusicUIManager = require("../../src/music/MusicUIManager");
        await MusicUIManager.renderIdle247Panel(client.musicManager, player);
      } else {
        client.musicManager.updatePanelEmbed(player);
      }
    } else {
      player.isIdle247 = false;
      client.musicManager.updatePanelEmbed(player);
    }

    const payload = buildContainerV2({
      accentColorHex: player.is247
        ? ui.getColor("primary") || "#FFB6C1"
        : "#2b2d31",
      title: "24/7 Mode",
      description: `${ui.getEmoji("music247") || "🌙"} | Mode Siaga 24/7 **${player.is247 ? "DIAKTIFKAN" : "DIMATIKAN"}**.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  }

  if (subcommand === "party") {
    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
    }

    const currentTrack = player.currentTrack?.info;
    const membersInVc = memberVoice.members.filter((m) => !m.user.bot);
    const hostName = member.displayName || user.username;

    const rowParty = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("queue_add_prompt")
        .setEmoji(ui.getEmoji("music_play") || "➕")
        .setLabel("Request Lagu Party")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("music_voteskip")
        .setEmoji(ui.getEmoji("skip") || "⏭️")
        .setLabel("Vote Skip")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("music_shuffle")
        .setEmoji(ui.getEmoji("shuffle") || "🔀")
        .setLabel("Acak Antrean")
        .setStyle(ButtonStyle.Secondary),
    );

    const partyPayload = buildContainerV2({
      accentColorHex: ui.getColor("accent_purple") || "#C084FC",
      authorName: "NAURA LISTENING PARTY LOBBY",
      title: `🎉 Sesi Listening Party: ${guild.name}`,
      description:
        `**${hostName}** telah membuka sesi **Listening Party Kolaboratif** di channel **${memberVoice.name}**!\n\n` +
        `👥 **Peserta Aktif di Voice:** \`${membersInVc.size} Pendengar\`\n` +
        `🎵 **Sedang Memutar:** \`${currentTrack ? `${currentTrack.title} - ${currentTrack.author}` : "Belum ada lagu (Gunakan tombol request)"}\`\n` +
        `📋 **Antrean Bersama:** \`${player.queue.length} lagu di antrean\`\n\n` +
        `Semua anggota voice channel dapat berkontribusi memasukkan lagu dan memberikan vote skip bersama-sama! 🎧✨`,
      expression: "happy",
      buttonsRow: [rowParty],
      footerText: ui.getFooter("music"),
    });

    return sendReply(partyPayload);
  }

  if (subcommand === "dj" || subcommand === "radio") {
    const aiDjManager = require("../../src/managers/aiDjManager");
    const fishAudioService = require("../../src/services/fishAudioService");
    const mode = (args.mode || "status").toLowerCase();

    if (mode === "on") {
      aiDjManager.setDjEnabled(guild.id, true);
      const isVoiceReady = fishAudioService.isConfigured();
      const statusDesc = isVoiceReady
        ? `🎙️ **Mode AI Smart DJ Naura BERHASIL DIAKTIFKAN!**\n\n` +
          `Naura akan bertindak sebagai Radio Host di Voice Channel kamu, memberikan pengumuman lagu secara personal dengan suara anime khas Naura via Fish Audio TTS! ✨🎶`
        : `🎙️ **Mode AI Smart DJ Naura BERHASIL DIAKTIFKAN!**\n\n` +
          `💡 *Catatan:* API Key Fish Audio belum terkonfigurasi di \`.env\` (\`FISH_AUDIO_API_KEY\`), sehingga AI DJ saat ini berjalan dalam mode **Visual Chat Announcer**. Masukkan API Key Fish Audio untuk mengaktifkan suara asli Naura!`;

      const djPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "HOSHINO FM • AI SMART DJ",
        title: "🎧 AI Smart DJ Companion Aktif",
        description: statusDesc,
        expression: "happy",
        footerText: ui.getFooter("music"),
      });
      return sendReply(djPayload);
    }

    if (mode === "off") {
      aiDjManager.setDjEnabled(guild.id, false);
      const djPayload = buildContainerV2({
        accentColorHex: ui.getColor("dark") || "#0b0c10",
        authorName: "HOSHINO FM • AI SMART DJ",
        title: "🎧 AI Smart DJ Companion Dinonaktifkan",
        description: `Mode AI Smart DJ telah dimatikan untuk server ini. Pemutaran musik akan berjalan standar tanpa pengumuman radio host.`,
        expression: "neutral",
        footerText: ui.getFooter("music"),
      });
      return sendReply(djPayload);
    }

    // Status Mode
    const isEnabled = aiDjManager.isDjEnabled(guild.id);
    const isVoiceReady = fishAudioService.isConfigured();
    const djPayload = buildContainerV2({
      accentColorHex: isEnabled
        ? ui.getColor("primary") || "#FFB6C1"
        : "#4B5563",
      authorName: "HOSHINO FM • AI SMART DJ STATUS",
      title: "🎧 Status Sistem AI DJ Radio Host",
      description:
        `📻 **Status DJ Server:** ${isEnabled ? "🟢 **Aktif (ON)**" : "🔴 **Nonaktif (OFF)**"}\n` +
        `🎙️ **Voice Engine (Fish Audio):** ${isVoiceReady ? "🟢 **Siap (Connected)**" : "🟡 **Belum Ada API Key (Visual Mode Only)**"}\n` +
        `🌸 **Karakter Host:** Naura Hoshino (Kawaii Radio Host)\n\n` +
        `Gunakan \`/music dj mode:on\` untuk mengaktifkan atau \`/music dj mode:off\` untuk mematikan.`,
      expression: isEnabled ? "happy" : "neutral",
      footerText: ui.getFooter("music"),
    });
    return sendReply(djPayload);
  }

  if (subcommand === "duplicates") {
    const mode = (args.mode || "status").toLowerCase();

    if (mode === "on") {
      musicManager.setDuplicateFilterEnabled(guild.id, true);
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "HOSHINO MUSIC • SMART QUEUE",
        title: "🛡️ Filter Anti-Duplikasi Aktif",
        description:
          "Sistem anti-duplikasi telah diaktifkan untuk server ini. Lagu yang sama tidak dapat diputar berulang kali dalam 5 lagu terakhir demi menjaga variasi musik.",
        expression: "happy",
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload);
    }

    if (mode === "off") {
      musicManager.setDuplicateFilterEnabled(guild.id, false);
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#F59E0B",
        authorName: "HOSHINO MUSIC • SMART QUEUE",
        title: "⚠️ Filter Anti-Duplikasi Dinonaktifkan",
        description:
          "Sistem anti-duplikasi telah dimatikan. Anggota voice channel sekarang bebas memutar lagu yang sama secara berulang tanpa pembatasan.",
        expression: "neutral",
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload);
    }

    const isEnabled = musicManager.isDuplicateFilterEnabled(guild.id);
    const payload = buildContainerV2({
      accentColorHex: isEnabled ? "#10B981" : "#6B7280",
      authorName: "HOSHINO MUSIC • SMART QUEUE STATUS",
      title: "🛡️ Status Filter Anti-Duplikasi Lagu",
      description:
        `Status saat ini: **${isEnabled ? "🟢 AKTIF (5 Lagu Terakhir Dilindungi)" : "🔴 NONAKTIF (Bebas Duplikat)"}**\n\n` +
        `Gunakan \`/music duplicates mode:on\` untuk mengaktifkan atau \`/music duplicates mode:off\` untuk mematikan.`,
      expression: isEnabled ? "happy" : "neutral",
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload);
  }

  if (subcommand === "quality") {
    const {
      lavalinkClusterManager,
    } = require("../../src/managers/lavalinkClusterManager");
    const mode = args.mode ? args.mode.toLowerCase() : null;

    if (mode) {
      lavalinkClusterManager.setGuildAudioQuality(guild.id, mode);
      const qualityMap = {
        standard: "Standard Quality (128kbps AAC/Opus)",
        hd: "HD Audio (256kbps Ultra Clear)",
        lossless: "Lossless Hi-Fi Studio (FLAC 24-bit / 384kbps Opus)",
      };

      const payload = buildContainerV2({
        accentColorHex:
          mode === "lossless"
            ? "#F59E0B"
            : mode === "hd"
              ? "#06B6D4"
              : "#94A3B8",
        authorName: "NAURA HI-FI AUDIO ENGINE",
        title: "🎚️ Mode Kualitas Audio Diperbarui",
        description: [
          `Format streaming audio server **${guild.name}** telah diubah ke:`,
          "",
          `> 💎 **Kualitas:** \`${qualityMap[mode] || mode}\``,
          `> 🌐 **Federasi Node:** Lossless Hi-Fi Lavalink Federation aktif.`,
          "",
          "-# *Kualitas Lossless memerlukan bandwidth suara server Discord yang mendukung bitrate tinggi.*",
        ].join("\n"),
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload);
    }

    const currentQ = lavalinkClusterManager.getGuildAudioQuality(guild.id);
    const payload = buildContainerV2({
      accentColorHex: "#06B6D4",
      authorName: "NAURA HI-FI AUDIO ENGINE",
      title: "🎚️ Status Kualitas Audio Server",
      description: [
        `Kualitas audio aktif saat ini untuk server **${guild.name}**: \`${currentQ.toUpperCase()}\``,
        "",
        "> • `standard` : 128kbps hemat bandwidth",
        "> • `hd` : 256kbps audio jernih standar studio",
        "> • `lossless` : 384kbps FLAC / Opus Hi-Fi tanpa kompresi",
        "",
        "Gunakan `/music quality mode:lossless` untuk mengubah mode.",
      ].join("\n"),
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload);
  }

  if (subcommand === "cluster") {
    const {
      lavalinkClusterManager,
    } = require("../../src/managers/lavalinkClusterManager");
    const fedStatus = lavalinkClusterManager.getFederationStatus(poru);

    const hiFiList =
      fedStatus.hiFiNodes.length > 0
        ? fedStatus.hiFiNodes
            .map(
              (n) =>
                `• **${n.name}** [${n.region.toUpperCase()}] : \`${n.connected ? "🟢 ONLINE" : "🔴 OFFLINE"}\` (${n.codec}, max ${Math.round(n.maxBitrate / 1000)}kbps)`,
            )
            .join("\n")
        : "*Belum ada dedicated Hi-Fi node eksternal yang didaftarkan. Menggunakan primary cluster.*";

    const payload = buildContainerV2({
      accentColorHex: "#3B82F6",
      authorName: "LAVALINK CLUSTER & HI-FI FEDERATION",
      title: "🌐 Status Kluster Audio & Federasi Node",
      description: [
        `📊 **Total Node Kluster:** \`${fedStatus.totalNodes} Nodes\` (\`${fedStatus.connectedNodes} Connected\`)`,
        `💎 **Dukungan Codec:** \`${fedStatus.supportedCodecs.join(" • ")}\``,
        "",
        "**📡 Daftar Node Lossless Hi-Fi Federation:**",
        hiFiList,
        "",
        "-# *Auto-balancing geografis otomatis mengarahkan koneksi ke node dengan latensi terendah.*",
      ].join("\n"),
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload);
  }

  const errPayload = buildErrorContainerV2({
    title: "Perintah Salah",
    description: `${eError} | Perintah tidak dikenali.`,
    footerText: ui.getFooter("music"),
  });
  return sendReply(errPayload, true);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("music")
    .setDescription("Sistem musik interaktif Naura")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Putar musik dari YouTube, Spotify, atau SoundCloud")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Judul lagu atau URL link")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("pause").setDescription("Jeda musik yang sedang berputar"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("resume")
        .setDescription("Lanjutkan kembali lagu yang dijeda"),
    )
    .addSubcommand((sub) =>
      sub.setName("skip").setDescription("Lewati lagu yang sedang berputar"),
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Hentikan musik dan hapus antrean"),
    )
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("Lihat daftar antrean lagu saat ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nowplaying")
        .setDescription("Lihat informasi lagu yang sedang diputar"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("Atur volume pemutaran musik")
        .addIntegerOption((opt) =>
          opt
            .setName("persen")
            .setDescription("Tingkat volume (1 - 150%)")
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(150),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("loop")
        .setDescription("Atur mode pengulangan musik")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilih mode loop")
            .setRequired(true)
            .addChoices(
              { name: "📴 Matikan Loop (Off)", value: "off" },
              { name: "🔂 Ulangi Lagu Ini (Track)", value: "track" },
              { name: "🔁 Ulangi Seluruh Antrean (Queue)", value: "queue" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("shuffle").setDescription("Acak urutan lagu dalam antrean"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("247")
        .setDescription("Aktifkan atau matikan mode 24/7 di Voice Channel"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lyrics")
        .setDescription(
          "Cari lirik lagu yang sedang diputar atau berdasarkan judul",
        )
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Judul lagu yang ingin dicari liriknya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("filter")
        .setDescription("Terapkan efek DSP audio profesional")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Pilih filter audio")
            .setRequired(true)
            .addChoices(
              { name: "Original (Reset)", value: "reset" },
              { name: "Bass Boost", value: "bassboost" },
              { name: "Nightcore", value: "nightcore" },
              { name: "8D Audio", value: "8d" },
              { name: "Vaporwave", value: "vaporwave" },
              { name: "Pop", value: "pop" },
              { name: "Karaoke", value: "karaoke" },
              { name: "Vibrato", value: "vibrato" },
              { name: "Tremolo", value: "tremolo" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("Tampilkan kartu profil musik statistik personal kamu")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dilihat profil musiknya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("save")
        .setDescription(
          "Simpan antrean saat ini menjadi Cloud Playlist pribadi",
        )
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Nama playlist yang ingin disimpan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("playlist")
        .setDescription("Putar salah satu Cloud Playlist milikmu")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Nama playlist yang ingin diputar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dedicate")
        .setDescription("Kirim pesan dedikasi / ucapan lagu kepada seseorang")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin kamu tuju")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Pesan dedikasi / ucapan yang ingin disampaikan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("wrapped")
        .setDescription(
          "Lihat rekap kilas balik musik personal & server Naura Wrapped",
        )
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dilihat rekap Wrapped-nya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("party")
        .setDescription(
          "Buka sesi Listening Party kolaboratif bersama seluruh anggota Voice",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("dj")
        .setDescription(
          "🎧 Aktifkan atau kelola mode AI Smart DJ Companion (Hoshino FM)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilihan mode DJ")
            .setRequired(false)
            .addChoices(
              { name: "Aktifkan AI Smart DJ (On)", value: "on" },
              { name: "Matikan AI Smart DJ (Off)", value: "off" },
              { name: "Status AI Smart DJ (Status)", value: "status" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("radio")
        .setDescription(
          "🎙️ AI Dynamic Radio Host & Voice Announcements (Hoshino FM)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilihan mode Radio Host")
            .setRequired(false)
            .addChoices(
              { name: "Aktifkan Radio Host (On)", value: "on" },
              { name: "Matikan Radio Host (Off)", value: "off" },
              { name: "Status Radio Host (Status)", value: "status" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("duplicates")
        .setDescription(
          "🛡️ Smart Duplicate Track Detection di antrean lagu guild (5 lagu terakhir)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilihan mode anti-duplikasi")
            .setRequired(false)
            .addChoices(
              { name: "Aktifkan Anti-Duplikasi (On)", value: "on" },
              { name: "Matikan Anti-Duplikasi (Off)", value: "off" },
              { name: "Status Anti-Duplikasi (Status)", value: "status" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("aura")
        .setDescription(
          "🔮 Analisis AI Music Aura & Kartu Resonansi Kepribadian Musik Kamu",
        )
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dianalisis Music Aura-nya")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("quality")
        .setDescription(
          "🎚️ Atur kualitas format audio (Standard, HD, Lossless Hi-Fi)",
        )
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Tingkat kualitas audio")
            .setRequired(false)
            .addChoices(
              { name: "Standard (128kbps)", value: "standard" },
              { name: "HD Audio (256kbps)", value: "hd" },
              { name: "Lossless Hi-Fi (384kbps FLAC/Opus)", value: "lossless" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("cluster")
        .setDescription(
          "🌐 Lihat status kluster Lavalink dan Lossless Hi-Fi Federation",
        ),
    ),

  async autocomplete(interaction) {
    const {
      getCached,
      setCache,
      choice,
      safeRespond,
      respondWithFallback,
      truncateLabel,
    } = require("../../src/utils/autocompleteHelper");

    const focusedValue = interaction.options.getFocused();
    // Spotify link: tampilkan konfirmasi langsung tanpa ke Lavalink
    if (focusedValue.match(/^(https?:\/\/)?(open\.)?spotify\.com\//)) {
      return safeRespond(interaction, [
        choice("🎧 [Spotify Link] Tekan Enter untuk memutar", focusedValue),
      ]);
    }

    // URL langsung (YouTube, SoundCloud, dll)
    if (focusedValue.match(/^https?:\/\//)) {
      return safeRespond(interaction, [
        choice("🔗 [Direct URL] Tekan Enter untuk memutar link", focusedValue),
      ]);
    }

    if (!focusedValue || focusedValue.trim().length === 0) {
      return respondWithFallback(interaction, "");
    }

    const cleanQuery = focusedValue
      .replace(
        /^(sc:|ytm:|yt:|spsearch:|ytsearch:|scsearch:|ytmsearch:|amsearch:)/,
        "",
      )
      .trim();
    const fallbackChoice = {
      name: `🔎 Cari: ${truncateLabel(cleanQuery, 85)}`,
      value:
        (cleanQuery.length > 100 ? cleanQuery.substring(0, 100) : cleanQuery) ||
        focusedValue.substring(0, 100),
    };

    try {
      // Pastikan Poru tersedia tanpa memicu lazy-init
      const manager = interaction.client.musicManager;
      if (!manager || !manager._poru) {
        return respondWithFallback(interaction, cleanQuery);
      }
      const poru = manager._poru;

      const defaultEngine = env.MUSIC_DEFAULT_SEARCH || "scsearch";

      // Query terlalu pendek: tampilkan lagu aktif di guild + hint prefix
      if (cleanQuery.length < 2) {
        const hints = [];
        const activePlayer = poru.players?.get(interaction.guildId);
        if (activePlayer && activePlayer.currentTrack) {
          const ct = activePlayer.currentTrack.info;
          const nowUri = ct.uri || `${defaultEngine}:${ct.title} ${ct.author}`;
          hints.push(
            choice(`🎵 Sedang diputar: ${ct.title} - ${ct.author}`, nowUri),
          );
        }
        hints.push(
          choice("☁️ SoundCloud (Stabil & Anti-Block)", "sc:"),
          choice("▶️ YouTube", "yt:"),
          choice("🎧 YouTube Music", "ytm:"),
          choice("🔍 Ketik nama lagu atau artis untuk mencari...", " "),
        );
        return safeRespond(interaction, hints.slice(0, 5));
      }

      // Tentukan search engine berdasarkan prefix
      const searchEngine = focusedValue.startsWith("sc:")
        ? "scsearch"
        : focusedValue.startsWith("ytm:")
          ? "ytmsearch"
          : focusedValue.startsWith("yt:")
            ? "ytsearch"
            : defaultEngine;

      // Cek cache: hindari request Lavalink saat user mengetik cepat
      const cacheKey = `music:ac:${searchEngine}:${cleanQuery}`;
      const cached = getCached(cacheKey);
      if (cached) return safeRespond(interaction, cached);

      // Timeout 2200ms - cukup untuk node lambat, masih di bawah batas Discord 3s
      const res = await Promise.race([
        poru.resolve({
          query: `${searchEngine}:${cleanQuery}`,
          requester: interaction.user,
        }),
        new Promise((resolve) => setTimeout(() => resolve(null), 2200)),
      ]);

      if (!res || !res.tracks || res.tracks.length === 0) {
        return respondWithFallback(interaction, cleanQuery);
      }

      const choices = res.tracks.slice(0, 24).map((track) => {
        const title = track.info.title || "Unknown Track";
        const author = track.info.author || "Unknown Artist";
        const duration = formatDuration(track.info.length);
        const label = `${title} - ${author} (${duration})`;

        const uri = track.info.uri;
        const val =
          uri && uri.startsWith("http")
            ? uri.substring(0, 100)
            : `${searchEngine}:${title} ${author}`.substring(0, 100);

        return choice(label, val);
      });

      // Opsi pencarian manual di posisi terakhir sebagai pilihan cadangan
      if (choices.length < 25) {
        choices.push(fallbackChoice);
      }

      // Simpan ke cache selama 10 detik
      setCache(cacheKey, choices);

      return safeRespond(interaction, choices);
    } catch (_error) {
      return respondWithFallback(interaction, cleanQuery);
    }
  },

  async execute(interaction) {
    await interaction.deferReply();
    const subcommand = interaction.options.getSubcommand();
    const args = {
      query: interaction.options.getString("query"),
      url: interaction.options.getString("url"),
      mode: interaction.options.getString("mode"),
      tipe: interaction.options.getString("tipe"),
      persen: interaction.options.getInteger("persen"),
      target: interaction.options.getUser("target"),
      pesan: interaction.options.getString("pesan"),
      id: interaction.options.getInteger("id"),
      ronde: interaction.options.getInteger("ronde"),
    };
    const sendReply = async (payload, autoDelete = false) => {
      const msg = await interaction.editReply(payload).catch(() => {});
      if (autoDelete && msg)
        setTimeout(() => interaction.deleteReply().catch(() => {}), 15000);
      return msg;
    };
    await runMusicLogic(
      interaction.client,
      interaction.user,
      interaction.member,
      interaction.guild,
      interaction.channel,
      subcommand,
      args,
      sendReply,
      true,
    );
  },

  async executePrefix(message, args, client) {
    if (!args || args.length === 0) return ui.sendError(message, "err_sys_13");
    const subcommand = args.shift().toLowerCase();
    const parsedArgs = {
      query: args.join(" "),
      url: args[0],
      persen: parseInt(args[0]),
      target: message.mentions.users.first(),
      id: parseInt(args[0]),
      mode: args[0],
    };
    const loadingPayload = buildContainerV2({
      accentColorHex: ui.getColor("dark") || "#0b0c10",
      title: "Audio Processor",
      description: "⏳ | `Memproses sistem audio...`",
      footerText: ui.getFooter("music"),
    });
    const sentMsg = await message.reply(loadingPayload);
    const sendReply = async (payload, autoDelete = false) => {
      const msg = await sentMsg.edit(payload).catch(() => {});
      if (autoDelete && msg)
        setTimeout(() => msg.delete().catch(() => {}), 15000);
      return msg;
    };
    await runMusicLogic(
      client,
      message.author,
      message.member,
      message.guild,
      message.channel,
      subcommand,
      parsedArgs,
      sendReply,
      false,
    );
  },
};
