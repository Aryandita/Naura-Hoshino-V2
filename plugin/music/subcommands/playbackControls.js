"use strict";
const { logger } = require("../../../src/managers/logger");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
  StringSelectMenuBuilder,
  MessageFlags,
} = require("discord.js");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { getPlatformIcon } = require("../../../src/canvas/CanvasUtils");
const { drawNowPlayingCard } = require("../../../src/canvas/nowplayingCanvas");
const { applyAudioFilter, FILTER_PRESETS } = require("../../../src/music/audioFilters");
const { formatDuration } = require("../helpers/musicShared");

module.exports = {
  async pause(ctx) {
    const { player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

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
  },

  async resume(ctx) {
    const { player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

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
  },

  async nowplaying(ctx) {
    const { player, user, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
            equippedBanner = bannerId;
          }
        }
      } catch (err) {
        logger.debug("[playbackControls:nowplaying] Operasi audio/voice gagal: " + (err?.message || err));
      }

      const playbackInfo = { position: player.position, equippedBanner };
      const imageBuffer = await drawNowPlayingCard(track, playbackInfo);
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: "nowplaying.png",
      });

      const npTitle = `${ui.getEmoji("nowplaying") || "🎶"} Memutar Saat Ini`;
      const npPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: npTitle,
        bannerAttachmentName: "nowplaying.png",
        footerText: ui.getFooter("music"),
      });

      return sendReply({ ...npPayload, files: [attachment] });
    } catch {
      const fallbackPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `${ui.getEmoji("nowplaying") || "🎶"} Memutar Saat Ini`,
        description: `### ${sourceIcon} [${track.title}](${track.uri})\n**Artis:** \`${track.author || "Tidak diketahui"}\`\n**Durasi:** \`${formatDuration(player.position)} / ${formatDuration(track.length)}\``,
        footerText: ui.getFooter("music"),
      });
      return sendReply(fallbackPayload);
    }
  },

  async queue(ctx) {
    const { player, user, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    if (!player || (!player.currentTrack && player.queue.length === 0)) {
      const errPayload = buildErrorContainerV2({
        title: "Antrean Kosong",
        description: `${eError} | Tidak ada musik yang sedang diputar atau dalam antrean. Gunakan \`/music play\` untuk memutar lagu!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const pageSize = 10;
    const totalPages = Math.max(1, Math.ceil(player.queue.length / pageSize));
    let currentPage = 0;

    const totalQueueMs = player.queue.reduce(
      (acc, t) =>
        acc +
        (t.info?.length && !isNaN(t.info.length) ? Number(t.info.length) : 0),
      0,
    );

    const renderQueuePage = (page) => {
      const start = page * pageSize;
      const end = start + pageSize;
      const currentQueue = player.queue.slice(start, end);

      let desc = "";
      if (player.currentTrack && player.currentTrack.info) {
        const ct = player.currentTrack.info;
        const nowIcon = getPlatformIcon(ct.originalSource || ct.sourceName);
        const reqStr = ct.requester?.id
          ? `<@${ct.requester.id}>`
          : ct.requester?.username || "Autoplay/Radio";
        desc += `### 🎧 Sedang Diputar\n${nowIcon} [${ct.title}](${ct.uri})\n⏱️ \`${formatDuration(ct.length)}\` • Pemohon: ${reqStr}\n\n`;
      }

      desc += `### 📋 Lagu Berikutnya (${player.queue.length} Lagu)\n`;
      if (currentQueue.length > 0) {
        desc += currentQueue
          .map((t, i) => {
            const sourceIcon = getPlatformIcon(
              t.info.originalSource || t.info.sourceName,
            );
            const req = t.info.requester?.username
              ? ` • *${t.info.requester.username}*`
              : "";
            return `**${start + i + 1}.** ${sourceIcon} [${t.info.title}](${t.info.uri}) - \`${formatDuration(t.info.length)}\`${req}`;
          })
          .join("\n");
      } else {
        desc += `*Antrean berikutnya kosong. Putar lagu baru dengan \`/music play\`!*\n`;
      }

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
        title: `📜 Antrean Musik • Halaman ${page + 1} / ${totalPages}`,
        description: desc,
        buttonsRow: row,
        footerText: `Total Antrean: ${player.queue.length} Lagu • Durasi: ${formatDuration(totalQueueMs)}`,
      });
    };

    const initialPayload = renderQueuePage(currentPage);
    const qMsg = await sendReply({ ...initialPayload, fetchReply: true });

    if (totalPages <= 1 || !qMsg || !qMsg.createMessageComponentCollector) {
      return;
    }

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
          flags: MessageFlags.Ephemeral,
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
  },

  async loop(ctx) {
    const { player, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
  },

  async shuffle(ctx) {
    const { player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
  },

  async clear(ctx) {
    const { player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
  },

  async stop(ctx) {
    const { client, player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

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
      else if (player.node && player.node.rest) {
        player.node.rest
          .updatePlayer({
            guildId: player.guildId,
            data: { track: { encoded: null } },
          })
          .catch(() => {});
      }
      const MusicUIManager = require("../../../src/music/MusicUIManager");
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
  },

  async skip(ctx) {
    const { player, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

    if (!player || !player.currentTrack) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Bisa Skip",
        description: `${eError} | Tidak ada musik yang bisa dilewati.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }
    if (typeof player.stopTrack === "function") player.stopTrack();
    else if (player.node && player.node.rest) {
      player.node.rest
        .updatePlayer({
          guildId: player.guildId,
          data: { track: { encoded: null } },
        })
        .catch(() => {});
    }
    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "Skip Track",
      description: `### ${ui.getEmoji("musicSkip") || "⏭️"} Melewati Trek\n${divider}\nMemutar urutan selanjutnya...`,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  },

  async voteskip(ctx) {
    const { client, player, member, guild, user, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    if (!player || !player.currentTrack) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Lagu Aktif",
        description: `${eError} | Tidak ada musik yang sedang diputar untuk dilewati.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const musicManager = client.musicManager;
    const vcId = member.voice?.channelId;
    if (!vcId || vcId !== player.voiceChannel) {
      const errPayload = buildErrorContainerV2({
        title: "Bukan di Saluran yang Sama",
        description: `${eError} | Kakak harus berada di Voice Channel yang sama dengan Naura untuk ikut voting!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const voiceChannel = guild.channels.cache.get(vcId);
    const nonBotMembers = voiceChannel
      ? voiceChannel.members.filter((m) => !m.user.bot)
      : new Map();
    const totalListeners = Math.max(1, nonBotMembers.size);
    const requiredVotes = Math.max(1, Math.ceil(totalListeners * 0.5));

    if (musicManager) {
      musicManager.addSkipVote(guild.id, user.id);
    }
    const currentVotes = musicManager
      ? musicManager.getSkipVotes(guild.id)
      : new Set([user.id]);

    if (currentVotes.size >= requiredVotes) {
      if (musicManager) musicManager.clearSkipVotes(guild.id);
      if (typeof player.stopTrack === "function") player.stopTrack();
      else if (player.node && player.node.rest) {
        player.node.rest
          .updatePlayer({
            guildId: player.guildId,
            data: { track: { encoded: null } },
          })
          .catch(() => {});
      }

      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        title: "⏭️ Voting Skip Berhasil!",
        description: `Batas kuorum voting tercapai (**${currentVotes.size}/${requiredVotes}** suara). Lagu berhasil dilewati!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(payload, false);
    }

    const voteRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`btn_vote_skip_${guild.id}`)
        .setLabel(`⏭️ Vote Skip (${currentVotes.size}/${requiredVotes})`)
        .setStyle(ButtonStyle.Primary),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "🗳️ Voting Skip Lagu",
      description: [
        `**${user.username}** mengajukan vote untuk melewati lagu:`,
        `> **${player.currentTrack.info.title}**`,
        "",
        `Dibutuhkan **${requiredVotes} suara** dari **${totalListeners} pendengar** aktif (Terkumpul: **${currentVotes.size}/${requiredVotes}**).`,
        "- # *Klik tombol di bawah jika Kakak setuju lagu ini dilewati.*",
      ].join("\n"),
      buttonsRow: voteRow,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, false);
  },

  async volume(ctx) {
    const { player, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

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
  },

  async filter(ctx) {
    const { player, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    if (!player) {
      const errPayload = buildErrorContainerV2({
        title: "Tidak Ada Musik",
        description: `${eError} | Tidak ada musik yang diputar.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const type = args.tipe || "off";
    applyAudioFilter(player, type);

    const activePreset = FILTER_PRESETS.find((p) => p.value === type) || {
      label: type.toUpperCase(),
      emoji: "🎛️",
    };

    const filterSelect = new StringSelectMenuBuilder()
      .setCustomId("sel_music_filter")
      .setPlaceholder("Pilih Preset Filter Audio DSP...")
      .addOptions(
        FILTER_PRESETS.map((p) => ({
          label: p.label,
          value: p.value,
          description: p.description,
          emoji: p.emoji,
          default: p.value === type,
        })),
      );

    const selectRow = new ActionRowBuilder().addComponents(filterSelect);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "NAURA HI-FI DSP STUDIO",
      title: "🎛️ Filter Audio Profesional",
      description: [
        `Filter audio aktif saat ini disetel ke: **${activePreset.emoji} ${activePreset.label}**`,
        "",
        "Pilih preset efek suara lain di bawah untuk mengubah equalizer secara instan tanpa mengetik ulang.",
      ].join("\n"),
      selectMenu: selectRow,
      footerText: ui.getFooter("music"),
    });
    return sendReply(payload, true);
  },
};
