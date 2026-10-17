"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const redisManager = require("../../src/managers/redisManager");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { logger } = require("../../src/managers/logger");

// Global in-memory fallback store untuk polling jika Redis tidak aktif
if (!global.__nauraPollStore) {
  global.__nauraPollStore = new Map();
}
if (!global.__nauraPollChartCache) {
  global.__nauraPollChartCache = new Map();
}
if (!global.__nauraPollDebounceTimers) {
  global.__nauraPollDebounceTimers = new Map();
}

/**
 * Membangun ActionRow kumpulan tombol opsi voting dan tombol ekspor grafik
 * @param {Array<string>} options
 * @param {string} messageId
 * @param {boolean} [disableVoting=false]
 * @returns {Array<ActionRowBuilder>}
 */
function buildPollActionRows(options, messageId, disableVoting = false) {
  const rows = [];
  let currentRow = new ActionRowBuilder();
  const numberEmojis = ["1️⃣", "2️⃣", "3️⃣", "4️⃣"];

  options.forEach((opt, index) => {
    if (currentRow.components.length === 5) {
      rows.push(currentRow);
      currentRow = new ActionRowBuilder();
    }
    currentRow.addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_opt_${index}`)
        .setLabel(opt.length > 70 ? opt.slice(0, 67) + "..." : opt)
        .setEmoji(numberEmojis[index] || "🔹")
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disableVoting),
    );
  });
  if (currentRow.components.length > 0) rows.push(currentRow);

  // Baris kedua: Tombol Ekspor Grafik
  const exportRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`poll_export_${messageId}`)
      .setLabel("Ekspor Grafik")
      .setEmoji("📊")
      .setStyle(ButtonStyle.Primary),
  );
  rows.push(exportRow);

  return rows;
}

module.exports = {
  name: "poll",
  description: "Sistem pemungutan suara interaktif dan ekspor diagram grafik visual.",

  data: new SlashCommandBuilder()
    .setName("poll")
    .setDescription("📊 Sistem voting interaktif dan visualisasi grafik perolehan suara.")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat sesi pemungutan suara (polling) interaktif baru")
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan untuk polling")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pilihan_1")
            .setDescription("Pilihan pertama")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pilihan_2")
            .setDescription("Pilihan kedua")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("pilihan_3")
            .setDescription("Pilihan ketiga")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("pilihan_4")
            .setDescription("Pilihan keempat")
            .setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("multi_vote")
            .setDescription("Boleh memilih lebih dari satu opsi? (Default: False)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Durasi polling dalam menit (Default: 60)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("results")
        .setDescription("Lihat dan ekspor kartu grafik visual hasil perolehan suara polling")
        .addStringOption((opt) =>
          opt
            .setName("message_id")
            .setDescription("ID pesan polling Discord")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    let subcommand = null;
    try {
      subcommand = interaction.options?.getSubcommand(false);
    } catch {
      subcommand = null;
    }

    // ==========================================
    // SUBCOMMAND: RESULTS (EKSPOR GRAFIK CANVAS)
    // ==========================================
    if (subcommand === "results") {
      const messageId = interaction.options.getString("message_id")?.trim();
      const redisKey = `poll:data:${messageId}`;

      let pollData = await redisManager.getCache(redisKey);
      if (!pollData && global.__nauraPollStore.has(messageId)) {
        pollData = global.__nauraPollStore.get(messageId);
      }

      if (!pollData) {
        const notFound = buildErrorContainerV2({
          title: "Polling Tidak Ditemukan",
          errorMessage: `Data polling dengan ID pesan \`${messageId}\` tidak ditemukan atau masa aktifnya telah kedaluwarsa.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.reply({
          ...notFound,
          flags: MessageFlags.Ephemeral,
        });
      }

      if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply().catch(() => {});
      }

      try {
        const chartBuffer = await canvasWorkerPool.runTask("renderPollChart", {
          question: pollData.question,
          options: pollData.options,
          votes: pollData.votes,
          totalVotes: pollData.totalVotes,
          author: pollData.author,
        });

        const attachment = new AttachmentBuilder(chartBuffer, {
          name: "poll_chart.png",
        });

        const chartContainer = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#38BDF8",
          authorName: "Naura Poll Visualizer",
          title: `Grafik Hasil: ${pollData.question}`,
          description: `Diagram batang resolusi tinggi perolehan suara (${pollData.totalVotes || 0} total suara terdaftar).\nStatus: **${pollData.isClosed ? "Selesai" : "Sedang Berlangsung"}**`,
          footerText: `Inisiator: ${pollData.author?.username || "Pengguna"} • Naura Smart Utilities`,
          withBanner: false,
        });

        return interaction.editReply({
          ...chartContainer,
          files: [attachment],
        });
      } catch (err) {
        logger.error("[Poll] Gagal merender grafik diagram polling:", err);
        const errContainer = buildErrorContainerV2({
          title: "Gagal Merender Grafik",
          errorMessage: "Terjadi gangguan saat memproses diagram batang grafis polling.",
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply({ ...errContainer });
      }
    }

    // ==========================================
    // SUBCOMMAND: CREATE (BUAT POLLING BARU)
    // ==========================================
    const question = interaction.options.getString("pertanyaan");
    const multiVote = interaction.options.getBoolean("multi_vote") || false;
    const durationMin = interaction.options.getInteger("durasi") || 60;

    const options = [];
    for (let i = 1; i <= 4; i++) {
      const opt = interaction.options.getString(`pilihan_${i}`);
      if (opt) options.push(opt);
    }

    const endUnix = Math.floor(Date.now() / 1000) + durationMin * 60;
    const votes = new Map();

    const renderDescription = (activeVotes = 0, isClosed = false) => {
      let desc = isClosed
        ? `**Sesi Voting Telah Ditutup**\nTotal Partisipasi: **${activeVotes} Suara**\n\n`
        : `Tentukan pilihanmu melalui tombol di bawah.\nAturan: ${multiVote ? "**Pilihan Ganda (Bisa memilih lebih dari satu)**" : "**Pilihan Tunggal (Hanya satu opsi)**"}\nBatas Waktu: <t:${endUnix}:R> (<t:${endUnix}:T>)\n\n`;

      const results = new Array(options.length).fill(0);
      let total = 0;
      for (const uVotes of votes.values()) {
        for (const idx of uVotes) {
          results[idx]++;
          total++;
        }
      }

      options.forEach((opt, index) => {
        const count = results[index];
        const percentage = total === 0 ? 0 : Math.round((count / total) * 100);
        const filled = Math.round(percentage / 10);
        const bar = "▰".repeat(filled) + "▱".repeat(10 - filled);
        desc += `**${index + 1}. ${opt}** (${count} suara • ${percentage}%)\n\`${bar}\`\n\n`;
      });

      return desc;
    };

    const initialPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#38BDF8",
      authorName: "Sistem Pemungutan Suara",
      iconURL: interaction.user.displayAvatarURL(),
      title: question,
      description: renderDescription(0, false),
      footerText: `Inisiator: ${interaction.user.username}`,
    });

    // Kirim pesan awal untuk mendapatkan message ID Discord
    const initialRows = buildPollActionRows(options, "pending");
    const pollMessage = await interaction.reply({
      ...initialPayload,
      components: initialRows,
      fetchReply: true,
    });

    const messageId = pollMessage.id;
    const ttlSeconds = durationMin * 60 + 86400; // TTL polling + 24 jam setelah selesai
    const redisKey = `poll:data:${messageId}`;

    // Objek state polling untuk Redis dan memori
    const pollState = {
      messageId,
      channelId: interaction.channelId,
      guildId: interaction.guildId,
      question,
      options,
      votes: {},
      totalVotes: 0,
      multiVote,
      author: {
        id: interaction.user.id,
        username: interaction.user.username,
        avatar: interaction.user.displayAvatarURL(),
      },
      createdAt: Date.now(),
      endUnix,
      durationMin,
      isClosed: false,
    };

    // Sinkronkan state awal ke Redis & Memory Store
    await redisManager.setCache(redisKey, pollState, ttlSeconds);
    global.__nauraPollStore.set(messageId, pollState);

    // Perbarui komponen tombol dengan messageId yang valid untuk tombol ekspor
    const activeRows = buildPollActionRows(options, messageId, false);
    await interaction
      .editReply({
        components: activeRows,
      })
      .catch(() => {});

    // Collector interaksi tombol
    const collector = pollMessage.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: durationMin * 60 * 1000,
    });

    collector.on("collect", async (i) => {
      // 1. Ekspor Grafik Langsung dari Tombol
      if (i.customId.startsWith("poll_export_")) {
        await i.deferReply({ flags: MessageFlags.Ephemeral });
        try {
          let currentTotal = 0;
          for (const uVotes of votes.values()) {
            currentTotal += uVotes.size;
          }

          let buffer = null;
          const cached = global.__nauraPollChartCache?.get(messageId);
          if (cached && Date.now() - cached.timestamp < 10000) {
            buffer = cached.buffer;
          } else {
            const votesRecord = Object.fromEntries(
              Array.from(votes.entries()).map(([k, v]) => [k, Array.from(v)]),
            );

            buffer = await canvasWorkerPool.runTask("renderPollChart", {
              question,
              options,
              votes: votesRecord,
              totalVotes: currentTotal,
              author: interaction.user,
            });

            if (global.__nauraPollChartCache) {
              global.__nauraPollChartCache.set(messageId, {
                buffer,
                timestamp: Date.now(),
              });
            }
          }

          const attachment = new AttachmentBuilder(buffer, {
            name: "poll_chart.png",
          });

          const chartContainer = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#38BDF8",
            authorName: "Naura Poll Visualizer",
            title: `Grafik Voting: ${question}`,
            description: `Visualisasi diagram batang hasil perolehan suara saat ini (${currentTotal} total suara terdaftar).`,
            footerText: `Diminta oleh ${i.user.username} • Naura Smart Utilities`,
            withBanner: false,
          });

          return i.editReply({
            ...chartContainer,
            files: [attachment],
          });
        } catch (err) {
          logger.error("[Poll] Gagal merender grafik dari tombol:", err);
          return i.editReply({
            content: "Terjadi kesalahan saat mengekspor grafik hasil polling.",
          });
        }
      }

      // 2. Voting Tombol Pilihan
      if (i.customId.startsWith("poll_opt_")) {
        const optIndex = parseInt(i.customId.split("_")[2], 10);
        const userId = i.user.id;

        if (!votes.has(userId)) {
          votes.set(userId, new Set());
        }

        const userVotes = votes.get(userId);

        if (!multiVote && userVotes.size > 0 && !userVotes.has(optIndex)) {
          return i.reply({
            content:
              "Kamu hanya dapat memilih satu opsi pada polling ini. Batalkan opsi sebelumnya terlebih dahulu jika ingin berganti pilihan.",
            flags: MessageFlags.Ephemeral,
          });
        }

        if (userVotes.has(optIndex)) {
          userVotes.delete(optIndex);
          await i.reply({
            content: `Pilihan untuk opsi **"${options[optIndex]}"** telah dibatalkan.`,
            flags: MessageFlags.Ephemeral,
          });
        } else {
          userVotes.add(optIndex);
          await i.reply({
            content: `Suaramu berhasil disimpan untuk opsi **"${options[optIndex]}"**.`,
            flags: MessageFlags.Ephemeral,
          });
        }

        let totalVotes = 0;
        for (const uVotes of votes.values()) {
          totalVotes += uVotes.size;
        }

        // Simpan snapshot suara ke Redis & Memory Store
        pollState.votes = Object.fromEntries(
          Array.from(votes.entries()).map(([k, v]) => [k, Array.from(v)]),
        );
        pollState.totalVotes = totalVotes;
        await redisManager.setCache(redisKey, pollState, ttlSeconds);
        global.__nauraPollStore.set(messageId, pollState);

        const updatePayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#38BDF8",
          authorName: "Sistem Pemungutan Suara",
          iconURL: interaction.user.displayAvatarURL(),
          title: question,
          description: renderDescription(totalVotes, false),
          footerText: `Inisiator: ${interaction.user.username} • Total Partisipasi: ${totalVotes} Suara`,
        });

        await interaction
          .editReply({ ...updatePayload, components: activeRows })
          .catch(() => {});

        // 3. Trailing Reset Debounce (5 Detik): Jika ada klik baru, reset timer.
        // Hanya render canvas setelah 5 detik tanpa klik suara tambahan.
        if (global.__nauraPollDebounceTimers) {
          if (global.__nauraPollDebounceTimers.has(messageId)) {
            clearTimeout(global.__nauraPollDebounceTimers.get(messageId));
          }

          const debounceTimer = setTimeout(async () => {
            try {
              global.__nauraPollDebounceTimers.delete(messageId);

              const chartBuffer = await canvasWorkerPool.runTask("renderPollChart", {
                question,
                options,
                votes: pollState.votes,
                totalVotes: pollState.totalVotes,
                author: interaction.user,
              });

              if (global.__nauraPollChartCache) {
                global.__nauraPollChartCache.set(messageId, {
                  buffer: chartBuffer,
                  timestamp: Date.now(),
                });
              }

              const chartAttachment = new AttachmentBuilder(chartBuffer, {
                name: "poll_chart.png",
              });

              await interaction
                .editReply({
                  files: [chartAttachment],
                })
                .catch(() => {});
            } catch (err) {
              logger.error("[Poll] Gagal merender diagram polling debounced:", err);
            }
          }, 5000);

          global.__nauraPollDebounceTimers.set(messageId, debounceTimer);
        }
      }
    });

    collector.on("end", async () => {
      if (global.__nauraPollDebounceTimers?.has(messageId)) {
        clearTimeout(global.__nauraPollDebounceTimers.get(messageId));
        global.__nauraPollDebounceTimers.delete(messageId);
      }
      let totalVotes = 0;
      for (const userVotes of votes.values()) {
        totalVotes += userVotes.size;
      }

      pollState.isClosed = true;
      pollState.totalVotes = totalVotes;
      pollState.votes = Object.fromEntries(
        Array.from(votes.entries()).map(([k, v]) => [k, Array.from(v)]),
      );
      await redisManager.setCache(redisKey, pollState, ttlSeconds);
      global.__nauraPollStore.set(messageId, pollState);

      const resultPayload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#34D399",
        authorName: "Hasil Akhir Pemungutan Suara",
        iconURL: interaction.user.displayAvatarURL(),
        title: question,
        description: renderDescription(totalVotes, true),
        footerText: ui.getFooter("core"),
      });

      // Tombol voting dinonaktifkan, tombol ekspor tetap aktif
      const closedRows = buildPollActionRows(options, messageId, true);
      await interaction
        .editReply({ ...resultPayload, components: closedRows })
        .catch(() => {});
    });
  },
};
