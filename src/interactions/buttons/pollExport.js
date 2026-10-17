"use strict";

const { AttachmentBuilder, MessageFlags } = require("discord.js");
const redisManager = require("../../managers/redisManager");
const canvasWorkerPool = require("../../canvas/canvasWorkerPool");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");
const { logger } = require("../../managers/logger");

module.exports = [
  {
    prefix: "poll_export_",
    label: "poll-export-chart-button",
    defer: "reply",
    flags: MessageFlags.Ephemeral,
    onError: "Gagal mengekspor grafik hasil polling.",
    async handler(interaction) {
      const messageId = interaction.customId.replace("poll_export_", "").trim();
      const redisKey = `poll:data:${messageId}`;

      let pollData = await redisManager.getCache(redisKey);

      // Jika data tidak ada di Redis, coba cek properti global memory store
      if (!pollData && global.__nauraPollStore && global.__nauraPollStore.has(messageId)) {
        pollData = global.__nauraPollStore.get(messageId);
      }

      if (!pollData) {
        const notFound = buildErrorContainerV2({
          title: "Data Polling Tidak Ditemukan",
          errorMessage: "Data polling untuk pesan ini tidak ditemukan di cache Redis atau sesi telah kedaluwarsa.",
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply({ ...notFound });
      }

      try {
        let buffer = null;
        const cached = global.__nauraPollChartCache?.get(messageId);
        if (cached && Date.now() - cached.timestamp < 10000) {
          buffer = cached.buffer;
        } else {
          buffer = await canvasWorkerPool.runTask("renderPollChart", {
            question: pollData.question,
            options: pollData.options,
            votes: pollData.votes,
            totalVotes: pollData.totalVotes,
            author: pollData.author,
          });

          if (global.__nauraPollChartCache) {
            global.__nauraPollChartCache.set(messageId, {
              buffer,
              timestamp: Date.now(),
            });
          }
        }

        const attachment = new AttachmentBuilder(buffer, { name: "poll_chart.png" });

        const chartContainer = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#38BDF8",
          authorName: "Naura Poll Visualizer",
          title: `Grafik Voting: ${pollData.question}`,
          description: `Visualisasi diagram batang hasil perolehan suara terkini.\nStatus: **${pollData.isClosed ? "Sesi Selesai" : "Sesi Masih Berjalan"}**`,
          footerText: `Diminta oleh ${interaction.user.username} • Naura Smart Utilities`,
          withBanner: false,
        });

        return interaction.editReply({
          ...chartContainer,
          files: [attachment],
        });
      } catch (err) {
        logger.error("[PollExport] Gagal merender diagram batang polling:", err);
        const errContainer = buildErrorContainerV2({
          title: "Gagal Merender Grafik",
          errorMessage: "Terjadi gangguan saat memproses diagram batang grafis polling.",
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply({ ...errContainer });
      }
    },
  },
];
