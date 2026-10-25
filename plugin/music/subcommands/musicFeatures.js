"use strict";
const { logger } = require("../../../src/managers/logger");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const GuildSettings = require("../../../src/models/GuildSettings");
const cacheManager = require("../../../src/managers/cacheManager");
const aiDjManager = require("../../../src/managers/aiDjManager");
const fishAudioService = require("../../../src/services/fishAudioService");
const lyricsService = require("../../../src/services/lyricsService");
const musicQuizEngine = require("../../../src/music/musicQuizEngine");
const { lavalinkClusterManager } = require("../../../src/managers/lavalinkClusterManager");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  async dj(ctx) {
    let { player } = ctx;
    const { poru, guild, memberVoice, channel, user, args, sendReply } = ctx;
    const divider = "-# ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━";

    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
      ctx.player = player;
    }

    const mode = (args.mode || "on").toLowerCase();

    if (mode === "on") {
      player.aiDjEnabled = true;
      player.isAutoplay = true;
      aiDjManager.setDjEnabled(guild.id, true);

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

      const isVoiceReady = fishAudioService.isConfigured();
      const statusDesc = isVoiceReady
        ? `🎙️ **Mode AI Smart DJ Naura BERHASIL DIAKTIFKAN!**\n\n` +
          `Naura kini aktif memandu sesi musik di <#${memberVoice.id}> sebagai Radio Host cerdas, memberikan pengumuman lagu secara personal dengan suara anime khas Naura via Fish Audio TTS! ✨🎶\n${divider}\n💡 *Ketik \`/music dj mode:off\` untuk mematikan mode DJ cerdas.*`
        : `🎙️ **Mode AI Smart DJ Naura BERHASIL DIAKTIFKAN!**\n\n` +
          `Naura kini aktif memandu sesi musik di <#${memberVoice.id}> dengan kurasi pintar otomatis, sinkronisasi mood obrolan, dan transisi lagu dinamis.\n\n` +
          `💡 *Catatan:* API Key Fish Audio belum terkonfigurasi di \`.env\` (\`FISH_AUDIO_API_KEY\`), sehingga AI DJ berjalan dalam mode **Visual Chat Announcer**. Masukkan API Key Fish Audio untuk mengaktifkan suara asli Naura!\n${divider}\n💡 *Ketik \`/music dj mode:off\` untuk mematikan mode DJ cerdas.*`;

      const djPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "HOSHINO FM • AI SMART DJ",
        title: "🎧 AI Smart DJ Companion Aktif",
        expression: "happy",
        description: statusDesc,
        footerText: ui.getFooter("music"),
      });
      return sendReply(djPayload);
    } else if (mode === "off") {
      player.aiDjEnabled = false;
      aiDjManager.setDjEnabled(guild.id, false);
      const offPayload = buildContainerV2({
        accentColorHex: "#FFB347",
        title: "🎧 AI Smart DJ Dimatikan",
        expression: "idle",
        description: `Mode AI Smart DJ telah dinonaktifkan. Naura kembali ke mode pemutaran antrean normal.\n${divider}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(offPayload);
    } else {
      const isEnabled =
        aiDjManager.isDjEnabled(guild.id) || Boolean(player.aiDjEnabled);
      const isVoiceReady = fishAudioService.isConfigured();
      const statusPayload = buildContainerV2({
        accentColorHex: isEnabled
          ? ui.getColor("primary") || "#FFB6C1"
          : "#4B5563",
        authorName: "HOSHINO FM • AI SMART DJ STATUS",
        title: "🎧 Status Sistem AI DJ Radio Host",
        expression: isEnabled ? "happy" : "neutral",
        description:
          `📻 **Status DJ Server:** ${isEnabled ? "🟢 **Aktif (ON)**" : "🔴 **Nonaktif (OFF)**"}\n` +
          `🎙️ **Voice Engine (Fish Audio):** ${isVoiceReady ? "🟢 **Siap (Connected)**" : "🟡 **Belum Ada API Key (Visual Mode Only)**"}\n` +
          `🔊 **Channel Voice:** <#${memberVoice.id}>\n` +
          `🤖 **Autoplay Cerdas:** **${player.isAutoplay ? "Aktif" : "Mati"}**\n` +
          `🌸 **Karakter Host:** Naura Hoshino (Kawaii Radio Host)\n\n` +
          `Gunakan \`/music dj mode:on\` untuk mengaktifkan atau \`/music dj mode:off\` untuk mematikan.\n${divider}`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(statusPayload);
    }
  },

  async lyrics(ctx) {
    const { player, user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
    let query = args.query;
    if (!query && player && player.currentTrack) {
      query = player.currentTrack.info.title;
    }

    if (!query) {
      const errPayload = buildErrorContainerV2({
        title: "Lirik Lagu Tidak Ditemukan",
        description: `${eError} | Masukkan judul lagu atau putar lagu terlebih dahulu untuk mencari lirik!`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    const result = await lyricsService.fetchLyrics(query);

    if (!result || !result.pages || result.pages.length === 0) {
      const errPayload = buildErrorContainerV2({
        title: "Lirik Tidak Ditemukan",
        description: `❌ Maaf, tidak dapat menemukan lirik untuk lagu **${query}**.`,
        footerText: ui.getFooter("music"),
      });
      return sendReply(errPayload, true);
    }

    let currentPage = 0;
    const totalPages = result.pages.length;

    const renderLyricsContainer = (pageIndex) => {
      const pageButtons = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`lyrics_prev_${user.id}`)
          .setLabel("◀️ Halaman Sebelumnya")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex <= 0),
        new ButtonBuilder()
          .setCustomId(`lyrics_next_${user.id}`)
          .setLabel("Halaman Berikutnya ▶️")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(pageIndex >= totalPages - 1),
      );

      return buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: `🎵 Lirik Lagu: ${result.artist}`,
        title: `📜 ${result.title} (Halaman ${pageIndex + 1}/${totalPages})`,
        description: `\`\`\`text\n${result.pages[pageIndex]}\n\`\`\``,
        buttonsRow: totalPages > 1 ? pageButtons : undefined,
        footerText: ui.getFooter("music"),
      });
    };

    const initialPayload = renderLyricsContainer(currentPage);
    const sentMsg = await sendReply({ ...initialPayload, fetchReply: true });

    if (totalPages > 1 && sentMsg && sentMsg.createMessageComponentCollector) {
      const collector = sentMsg.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== user.id) {
          const errReply = buildErrorContainerV2({
            title: "Akses Ditolak",
            description: "❌ Hanya pemanggil command yang bisa mengubah halaman lirik.",
            footerText: ui.getFooter("music"),
          });
          return i.reply({ ...errReply, flags: MessageFlags.Ephemeral });
        }

        if (i.customId.startsWith("lyrics_prev_")) {
          currentPage = Math.max(0, currentPage - 1);
        } else if (i.customId.startsWith("lyrics_next_")) {
          currentPage = Math.min(totalPages - 1, currentPage + 1);
        }

        await i.update(renderLyricsContainer(currentPage));
      });

      collector.on("end", () => {
        sentMsg.edit({ components: [] }).catch(() => {});
      });
    }
  },

  async dedicate(ctx) {
    const { user, args, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";
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
  },

  async quiz(ctx) {
    const { guild, channel, args, sendReply } = ctx;
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
          flags: MessageFlags.Ephemeral,
        });
      }

      if (answerRes.isCorrect) {
        return btnInteraction.reply({
          content: `🎉 **BENAR!** Jawabanmu tepat: **${answerRes.correctAnswer}** (+${answerRes.pointsGained} Poin | Streak x${answerRes.streak})!`,
          flags: MessageFlags.Ephemeral,
        });
      } else {
        return btnInteraction.reply({
          content: `❌ **SALAH!** Jawaban yang benar adalah **${answerRes.correctAnswer}**. Streak terputus!`,
          flags: MessageFlags.Ephemeral,
        });
      }
    });
  },

  async "247"(ctx) {
    const { client, player, user, guild, sendReply } = ctx;
    const eError = ui.getEmoji("error") || "❌";

    const profile = await cacheManager.getUserProfile(user.id);
    const guildSettings = await cacheManager.getGuildSettings(guild.id);

    const isUserVip =
      profile?.isPremium &&
      profile?.premiumUntil &&
      new Date(profile.premiumUntil) > new Date();
    const isGuildVip =
      guildSettings?.isPremium || guildSettings?.settings?.isPremium;
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
    } catch (err) {
      logger.error("[musicFeatures] Operasi database gagal: " + (err?.message || err), err);
    }

    const MusicUIManager = require("../../../src/music/MusicUIManager");
    if (player.is247) {
      if (!player.currentTrack && !player.isPlaying) {
        player.isIdle247 = true;
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
  },

  async party(ctx) {
    let { player } = ctx;
    const { poru, guild, memberVoice, channel, member, user, sendReply } = ctx;

    if (!player) {
      player = poru.createConnection({
        guildId: guild.id,
        voiceChannel: memberVoice.id,
        textChannel: channel.id,
        deaf: true,
      });
      ctx.player = player;
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
  },

  async duplicates(ctx) {
    const { musicManager, guild, args, sendReply } = ctx;
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
  },

  async quality(ctx) {
    const { guild, args, sendReply } = ctx;
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
  },

  async cluster(ctx) {
    const { poru, sendReply } = ctx;
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
  },

  async audio(ctx) {
    const { args } = ctx;
    const option = (args.opsi || args.mode || "").toLowerCase();
    if (option === "cluster") {
      return this.cluster(ctx);
    }
    if (["standard", "hd", "lossless"].includes(option)) {
      return this.quality({
        ...ctx,
        args: { ...ctx.args, mode: option },
      });
    }
    return this.quality(ctx);
  },
};
