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

const {
  generateMusicProfileImage,
} = require("../../src/canvas/canvasHelper");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { getPlatformIcon } = require("../../src/canvas/CanvasUtils");

const formatDuration = (ms) => {
  if (!ms || isNaN(ms)) return "0:00";
  if (ms >= 8640000000) return "🔴 LIVE";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

const getSourceIcon = (sourceName) => {
  if (sourceName === "spotify") return ui.getEmoji("spotify") || "🎵";
  if (sourceName === "youtube" || sourceName === "ytmsearch")
    return ui.getEmoji("youtube") || "▶️";
  if (sourceName === "soundcloud") return ui.getEmoji("soundcloud") || "☁️";
  if (sourceName === "apple") return ui.getEmoji("apple") || "🍎";
  return ui.getEmoji("nowplaying") || "🎵";
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
          let data =
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
      ? "ytsearch:lofi hip hop radio - beats to relax/study to live"
      : "ytsearch:NoCopyrightSounds 24/7 live stream";
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
      await guildData.save();

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

    let query = args.query;
    if (!query) {
      const errPayload = buildErrorContainerV2({
        title: "Query Kosong",
        description: `${eError} | Harap masukkan judul lagu atau URL yang ingin diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    let res;
    let searchSource = "ytsearch";
    let finalQuery = query;
    let isDirectLink = !!query.match(/^(https?:\/\/)/);

    if (!isDirectLink) {
      if (query.startsWith("scsearch:")) searchSource = "scsearch";
      else if (query.startsWith("spsearch:")) searchSource = "spsearch";
      else if (query.startsWith("ytsearch:")) searchSource = "ytsearch";
      else if (query.startsWith("ytmsearch:")) searchSource = "ytmsearch";
      else if (query.startsWith("amsearch:")) searchSource = "amsearch";
      else finalQuery = `${searchSource}:${query}`;
    }

    const searchingPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Mencari Audio",
      description: `🔍 Menganalisis gelombang suara untuk: **${query}**...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(searchingPayload, false);

    // Langsung berikan ke Poru. LavaSrc dan youtube-plugin di server akan
    // mengurus link Spotify/YouTube secara native, termasuk playlist!
    res = await poru.resolve({ query: finalQuery, requester: user });

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

    let brandColor = "#FF0000";
    let brandEmoji = ui.getEmoji("youtube") || "▶️";

    if (query.includes("spotify.com") || searchSource === "spsearch") {
      brandColor = "#1DB954";
      brandEmoji = ui.getEmoji("spotify") || "🎵";
    } else if (searchSource === "scsearch") {
      brandColor = "#FF7700";
      brandEmoji = ui.getEmoji("soundcloud") || "☁️";
    } else if (searchSource === "amsearch") {
      brandColor = "#FA243C";
      brandEmoji = ui.getEmoji("apple") || "🍎";
    }

    if (res.loadType === "playlist" || res.loadType === "PLAYLIST_LOADED") {
      const trackToPlay = res.tracks[0];
      for (const track of res.tracks) {
        track.info.requester = user;
        if (query.includes("spotify.com"))
          track.info.originalSource = "spotify";
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
    if (query.includes("spotify.com")) track.info.originalSource = "spotify";
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
          const res = await poru.resolve({
            query: query.match(
              /^(?:https?:\/\/|spsearch:|ytmsearch:|ytsearch:|scsearch:|amsearch:)/,
            )
              ? query
              : `ytsearch:${query}`,
            requester: user,
          });
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
      const userProfile = await cacheManager.getUserProfile(interaction.user.id);
      let equippedBanner = null;
      try {
        if (userProfile && userProfile.activeBanners) {
          const banners = typeof userProfile.activeBanners === "string" ? JSON.parse(userProfile.activeBanners) : userProfile.activeBanners;
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
      let [guildData] = await GuildSettings.findOrCreate({
        where: { guildId: guild.id },
      });
      guildData.music = {
        twentyFourSeven: player.is247,
        voiceChannel: player.is247 ? player.voiceChannel : null,
        textChannel: player.is247 ? player.textChannel : null,
      };
      guildData.changed("music", true);
      await guildData.save();
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
    .setDescription("Sistem Musik Hi-Fi Naura Hoshino")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Putar musik dari Spotify, YouTube, SoundCloud")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Judul lagu atau URL link")
            .setRequired(true)
            .setAutocomplete(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lofi")
        .setDescription("Putar siaran Lofi Hip-Hop 24/7 tanpa henti"),
    )
    .addSubcommand((sub) =>
      sub.setName("radio").setDescription("Putar siaran musik 24/7 populer"),
    )
    .addSubcommand((sub) =>
      sub.setName("pause").setDescription("Jeda lagu yang sedang berputar"),
    )
    .addSubcommand((sub) =>
      sub.setName("resume").setDescription("Lanjutkan lagu yang dijeda"),
    )
    .addSubcommand((sub) =>
      sub.setName("skip").setDescription("Lewati lagu saat ini"),
    )
    .addSubcommand((sub) =>
      sub.setName("stop").setDescription("Hentikan musik dan matikan koneksi"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("nowplaying")
        .setDescription("Tampilkan info lagu & visualizer"),
    )
    .addSubcommand((sub) =>
      sub.setName("queue").setDescription("Tampilkan antrean lagu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("volume")
        .setDescription("Atur volume pemutaran (10 - 100)")
        .addIntegerOption((opt) =>
          opt
            .setName("persen")
            .setDescription("Persentase volume (10-100)")
            .setRequired(true)
            .setMinValue(10)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("loop")
        .setDescription("Atur mode pengulangan (Track/Queue/Off)")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Pilih mode loop")
            .setRequired(true)
            .addChoices(
              { name: "Track", value: "track" },
              { name: "Queue", value: "queue" },
              { name: "Off", value: "off" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("shuffle").setDescription("Acak urutan antrean lagu"),
    )
    .addSubcommand((sub) =>
      sub.setName("clear").setDescription("Kosongkan antrean lagu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("247")
        .setDescription("Aktifkan mode siaga 24/7 di voice channel (VIP Only)"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("filter")
        .setDescription("Terapkan filter audio (Bassboost, Nightcore, 8D)")
        .addStringOption((opt) =>
          opt
            .setName("tipe")
            .setDescription("Jenis filter")
            .setRequired(true)
            .addChoices(
              { name: "Off (Clear Filters)", value: "off" },
              { name: "Bassboost", value: "bassboost" },
              { name: "Nightcore", value: "nightcore" },
              { name: "8D Audio", value: "8d" },
              { name: "Pop", value: "pop" },
              { name: "Soft", value: "soft" },
              { name: "Treblebass", value: "treblebass" },
              { name: "Karaoke", value: "karaoke" },
              { name: "Vibrato", value: "vibrato" },
              { name: "Tremolo", value: "tremolo" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("profile")
        .setDescription("Lihat statistik & kartu profil Audiophile")
        .addUserOption((opt) =>
          opt
            .setName("target")
            .setDescription("User yang ingin dilihat")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("import")
        .setDescription("Impor playlist dari Spotify/YouTube ke database")
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("URL Playlist Spotify/YouTube")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("myplaylist")
        .setDescription("Lihat daftar playlist kustom milikmu"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("playplaylist")
        .setDescription("Putar playlist kustom dari ID")
        .addIntegerOption((opt) =>
          opt.setName("id").setDescription("ID Playlist").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("share")
        .setDescription("Dapatkan kode unik untuk membagikan playlist")
        .addIntegerOption((opt) =>
          opt
            .setName("id")
            .setDescription("ID Playlist yang dibagikan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("load")
        .setDescription("Salin playlist milik orang lain dari kode")
        .addStringOption((opt) =>
          opt
            .setName("query")
            .setDescription("Kode unik playlist (misal: NRA...URA)")
            .setRequired(true),
        ),
    ),

  async autocomplete(interaction) {
    const focusedValue = interaction.options.getFocused();
    if (!focusedValue || focusedValue.trim().length === 0)
      return interaction.respond([]).catch(() => {});

    try {
      if (focusedValue.match(/^(https?:\/\/)?(open\.)?spotify\.com\//)) {
        return interaction
          .respond([
            {
              name: `🎧 [Spotify Link] Click to load track/playlist`,
              value: focusedValue,
            },
          ])
          .catch(() => {});
      }

      const searchEngine = focusedValue.startsWith("sc:")
        ? "scsearch"
        : focusedValue.startsWith("ytm:")
          ? "ytmsearch"
          : "ytsearch";
      const cleanQuery = focusedValue.replace(/^(sc:|ytm:|yt:)/, "").trim();

      if (cleanQuery.length < 2) return interaction.respond([]).catch(() => {});

      const poru = interaction.client.musicManager.poru;
      const node = poru.nodes.first();
      let searchResult = [];

      if (node) {
        try {
          const lavaSearchUrl = `http${node.secure ? "s" : ""}://${node.host}:${node.port}/v4/loadsearch?query=${encodeURIComponent(`${searchEngine}:${cleanQuery}`)}`;
          const response = await fetch(lavaSearchUrl, {
            headers: {
              Authorization: node.password,
            },
          });
          if (response.ok) {
            const data = await response.json();
            if (data && data.texts && data.texts.length > 0) {
              searchResult = data.texts.slice(0, 25).map((t) => ({
                name: `🔍 ${t.text.length > 95 ? t.text.substring(0, 95) + "..." : t.text}`,
                value: t.text.substring(0, 100),
              }));
            }
          }
        } catch (e) {
          // Fallback to poru.resolve
        }
      }

      if (searchResult.length > 0) {
        return interaction.respond(searchResult).catch(() => {});
      }

      const res = await poru.resolve({
        query: `${searchEngine}:${cleanQuery}`,
        requester: interaction.user,
      });

      if (!res || !res.tracks || res.tracks.length === 0)
        return interaction.respond([]).catch(() => {});

      const choices = res.tracks.slice(0, 25).map((track) => {
        let title = track.info.title;
        let author = track.info.author;
        let duration = formatDuration(track.info.length);
        let label = `${title} - ${author} (${duration})`;
        if (label.length > 100) label = label.substring(0, 97) + "...";
        return { name: label, value: track.info.uri || track.info.title };
      });

      return interaction.respond(choices).catch(() => {});
    } catch (error) {
      return interaction.respond([]).catch(() => {});
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
      id: interaction.options.getInteger("id"),
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
