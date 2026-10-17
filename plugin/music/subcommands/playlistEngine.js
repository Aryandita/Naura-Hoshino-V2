"use strict";
const { logger } = require("../../../src/managers/logger");

const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const UserProfile = require("../../../src/models/UserProfile");
const UserPlaylist = require("../../../src/models/UserPlaylist");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { resolveSpotifyQuery } = require("../../../src/music/spotifyResolver");
const { formatDuration } = require("../helpers/musicShared");

const playlistEngine = {
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
        tracksToSave = res.tracks.map((t) => ({
          title: t.info.title || "Track",
          author: t.info.author || "Artist",
          uri: t.info.uri || t.info.title,
          length: t.info.length || 0,
        }));
      } else if (res && res.tracks && res.tracks.length > 0) {
        playlistName = res.tracks[0].info.title || "Imported Track";
        tracksToSave = [
          {
            title: res.tracks[0].info.title || "Track",
            author: res.tracks[0].info.author || "Artist",
            uri: res.tracks[0].info.uri || res.tracks[0].info.title,
            length: res.tracks[0].info.length || 0,
          },
        ];
      }

      if (tracksToSave.length === 0) {
        const errPayload = buildErrorContainerV2({
          title: "Gagal Impor",
          description: `${eError} | Gagal mengimpor data.`,
          footerText: ui.getFooter("music"),
        });
        return sendReply(errPayload, true);
      }

      const created = await UserPlaylist.create({
        userId: user.id,
        name: playlistName,
        tracks: tracksToSave,
        spotifyUrl: url,
      });

      const totalMs = tracksToSave.reduce((acc, t) => acc + (t.length || 0), 0);
      const durText = totalMs > 0 ? ` (${formatDuration(totalMs)})` : "";

      const importedSuccessPayload = buildContainerV2({
        accentColorHex: "#1DB954",
        title: `${ui.getEmoji("success") || "✅"} Berhasil Diimpor`,
        description: `**Nama:** \`${playlistName}\`\n**Total:** \`${tracksToSave.length} Trek\`${durText}\n**ID Playlist:** \`${created.id}\`\n\nGunakan \`/music playlist query:${created.id}\` untuk memutar!`,
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

  async save(ctx) {
    const { player, user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const eSuccess = ui.getEmoji("success") || "✅";

    if (!player || (!player.currentTrack && player.queue.length === 0)) {
      const errPayload = buildErrorContainerV2({
        title: "Antrean Kosong",
        description: `${eError} | Tidak ada antrean lagu yang sedang diputar untuk disimpan.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const playlistName = (args.query || args.name || "Antrean Naura").trim();
    if (playlistName.length > 50) {
      const errPayload = buildErrorContainerV2({
        title: "Nama Terlalu Panjang",
        description: `${eError} | Nama playlist maksimal 50 karakter.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const [profile] = await UserProfile.findOrCreate({
      where: { userId: user.id },
    });
    const isPremium = profile.isPremium && profile.premiumUntil > new Date();
    const count = await UserPlaylist.count({ where: { userId: user.id } });
    if (!isPremium && count >= 3) {
      const errPayload = buildErrorContainerV2({
        title: "Batas Playlist Tercapai",
        description: `${eError} | Pengguna standar hanya dapat menyimpan maksimal **3 Playlist**.\nGunakan \`/premium\` untuk mendapatkan akses simpan tanpa batas!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const tracksToSave = [];
    let totalDurationMs = 0;

    if (player.currentTrack) {
      const info = player.currentTrack.info;
      tracksToSave.push({
        title: info.title || "Track",
        author: info.author || "Artist",
        uri: info.uri || "",
        length: info.length || 0,
      });
      if (typeof info.length === "number") totalDurationMs += info.length;
    }

    for (const t of player.queue) {
      const info = t.info;
      tracksToSave.push({
        title: info.title || "Track",
        author: info.author || "Artist",
        uri: info.uri || "",
        length: info.length || 0,
      });
      if (typeof info.length === "number") totalDurationMs += info.length;
    }

    const created = await UserPlaylist.create({
      userId: user.id,
      name: playlistName,
      tracks: tracksToSave,
    });

    const durText = totalDurationMs > 0 ? ` (${formatDuration(totalDurationMs)})` : "";
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: `${eSuccess} Antrean Berhasil Disimpan`,
      description:
        `Seluruh antrean aktif berhasil disimpan ke Cloud Playlist Naura!\n\n` +
        `• **Nama:** \`${playlistName}\`\n` +
        `• **Total Trek:** \`${tracksToSave.length} Lagu\`${durText}\n` +
        `• **ID Playlist:** \`${created.id}\`\n\n` +
        `Putar kapan saja dengan perintah \`/music playlist query:${created.id}\``,
      footerText: ui.getFooter("music"),
    });

    return sendReply(payload);
  },

  async save_queue(ctx) {
    return this.save(ctx);
  },

  async delete(ctx) {
    const { user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const eSuccess = ui.getEmoji("success") || "✅";
    const target = args.id || args.query;
    if (!target) {
      const errPayload = buildErrorContainerV2({
        title: "Parameter Kurang",
        description: `${eError} | Masukkan ID atau nama playlist yang ingin dihapus.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const isNumericId = !isNaN(target);
    const whereClause = isNumericId
      ? { userId: user.id, id: parseInt(target, 10) }
      : { userId: user.id, name: target };

    const playlist = await UserPlaylist.findOne({ where: whereClause });
    if (!playlist) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ditemukan",
        description: `${eError} | Playlist tidak ditemukan dalam daftar koleksimu.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const deletedName = playlist.name;
    await playlist.destroy();

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("danger") || "#ef4444",
      title: `${eSuccess} Playlist Dihapus`,
      description: `Playlist **${deletedName}** telah berhasil dihapus dari cloud database Naura.`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload);
  },

  async deleteplaylist(ctx) {
    return this.delete(ctx);
  },

  async share(ctx) {
    const { user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const pid = args.id || parseInt(args.query, 10);
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
        where: { id: parseInt(decodedId, 10) },
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
        description: `**Nama:** \`${newName}\`\n**Total:** \`${sourcePlaylist.tracks.length} Trek\`\n\nGunakan \`/music playlist query:${newName}\` untuk memutar!`,
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
        description: `${eError} | Kamu belum memiliki playlist tersimpan. Simpan antrean dengan \`/music save <nama>\`!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    let desc = "";
    playlists.forEach((p, i) => {
      let totalDurationMs = 0;
      let hasDuration = false;
      const trackList = Array.isArray(p.tracks) ? p.tracks : [];
      for (const t of trackList) {
        if (typeof t === "object" && t !== null && typeof t.length === "number") {
          totalDurationMs += t.length;
          hasDuration = true;
        }
      }
      const durText = hasDuration && totalDurationMs > 0
        ? ` (${formatDuration(totalDurationMs)})`
        : "";
      desc += `**${i + 1}.** ${p.name} (\`${trackList.length} Lagu\`${durText})\n*ID:* \`${p.id}\` • Putar: \`/music playlist query:${p.id}\` • Hapus: \`/music playlist aksi:delete query:${p.id}\`\n\n`;
    });

    const listPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "📁 Daftar Playlist Tersimpan",
      description: desc || "Kosong",
      footerText: ui.getFooter("music"),
    });
    return sendReply(listPayload);
  },

  async playlist(ctx) {
    const { args } = ctx;
    const action = (args.aksi || "").toLowerCase();
    const query = (args.query || "").trim();

    if (
      action === "delete" ||
      query.toLowerCase().startsWith("delete ") ||
      query.toLowerCase().startsWith("hapus ")
    ) {
      if (query.toLowerCase().startsWith("delete ")) {
        ctx.args.query = query.substring(7).trim();
      } else if (query.toLowerCase().startsWith("hapus ")) {
        ctx.args.query = query.substring(6).trim();
      }
      return this.delete(ctx);
    }

    if (action === "list" || (!action && !query)) {
      return this.myplaylist(ctx);
    }

    // Default: Putar playlist
    return this.playplaylist(ctx);
  },

  async playplaylist(ctx) {
    let { player } = ctx;
    const { poru, guild, memberVoice, channel, user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    const target = args.id || args.query;
    if (!target) {
      const errPayload = buildErrorContainerV2({
        title: "ID atau Nama Diperlukan",
        description: `${eError} | Harap masukkan ID atau nama Playlist yang ingin diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const isNumericId = !isNaN(target);
    const whereClause = isNumericId
      ? { id: parseInt(target, 10), userId: user.id }
      : { name: target, userId: user.id };

    const playlist = await UserPlaylist.findOne({
      where: whereClause,
    });
    if (!playlist) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ditemukan",
        description: `${eError} | Playlist tidak ditemukan dalam daftar milikmu.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    if (!memberVoice) {
      const errPayload = buildErrorContainerV2({
        title: "Koneksi Suara Diperlukan",
        description: `${eError} | Kamu harus bergabung ke dalam Voice Channel terlebih dahulu untuk memutar playlist.`,
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

    const trackList = Array.isArray(playlist.tracks) ? playlist.tracks : [];
    const loadingPayload = buildContainerV2({
      accentColorHex: "#1DB954",
      title: "Memuat Playlist",
      description: `⏳ Memuat \`${trackList.length}\` lagu dari **${playlist.name}** ke antrean...`,
      footerText: ui.getFooter("music"),
    });
    await sendReply(loadingPayload, true);

    let loaded = 0;
    let firstTrack = null;

    (async () => {
      for (const trackItem of trackList) {
        try {
          const query =
            typeof trackItem === "object" && trackItem !== null
              ? trackItem.uri || `${trackItem.title} ${trackItem.author || ""}`.trim()
              : trackItem;

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
        } catch (err) {
          logger.debug("[playlistEngine:playplaylist] Operasi audio/voice gagal: " + (err?.message || err));
        }
      }
      const syncPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: `${ui.getEmoji("success") || "✅"} Sinkronisasi Selesai`,
        description: `**Nama:** \`${playlist.name}\`\n**Berhasil Dimuat:** \`${loaded} / ${trackList.length} Lagu\``,
        footerText: ui.getFooter("music"),
      });
      channel
        .send(syncPayload)
        .then((m) => setTimeout(() => m.delete().catch(() => {}), 15000))
        .catch(() => {});
    })();
  },
};

module.exports = playlistEngine;
