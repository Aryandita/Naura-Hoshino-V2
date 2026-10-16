"use strict";

const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const UserProfile = require("../../../src/models/UserProfile");
const UserPlaylist = require("../../../src/models/UserPlaylist");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { resolveSpotifyQuery } = require("../../../src/music/spotifyResolver");

module.exports = {
  async import(ctx) {
    const { poru, user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
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

      const res = await resolveSpotifyQuery(poru, url, user);
      if (
        res &&
        (res.loadType === "PLAYLIST_LOADED" || res.loadType === "playlist")
      ) {
        playlistName = res.playlistInfo?.name || res.name || "Imported Playlist";
        tracksToSave = res.tracks.map((t) => t.info.uri || t.info.title);
      } else if (res && res.tracks && res.tracks.length > 0) {
        playlistName = res.tracks[0].info.title || "Imported Track";
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
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Proses",
        description: `${eError} | Terjadi kesalahan saat memproses URL.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  },

  async share(ctx) {
    const { user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
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
  },

  async load(ctx) {
    const { user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
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
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menyalin",
        description: `${eError} | Gagal menyalin playlist.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
  },

  async myplaylist(ctx) {
    const { user, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
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
  },

  async playplaylist(ctx) {
    let { player } = ctx;
    const { poru, guild, memberVoice, channel, user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
      ctx.player = player;
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
        } catch (_) {}
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
  },
};
