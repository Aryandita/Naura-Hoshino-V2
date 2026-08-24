"use strict";

// ==========================================
// PERINTAH /downloader
// ==========================================
// Berkas ini hanya mengatur alur. Seluruh pekerjaan berat ada di:
//   src/downloader/downloaderCore.js      konstanta, cache, validasi content-type
//   src/downloader/downloaderChain.js     urutan provider + penyaringan hasil
//   src/downloader/downloaderFetch.js     unduh berkas tunggal + kompresi
//   src/downloader/downloaderPicker.js    menu resolusi manual
//   src/downloader/downloaderRender.js    seluruh kartu yang dilihat pengguna

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const RateLimiter = require("../../src/utils/rateLimiter");
const core = require("../../src/downloader/downloaderCore");
const { runChain } = require("../../src/downloader/downloaderChain");
const { prepareSingleMedia } = require("../../src/downloader/downloaderFetch");
const picker = require("../../src/downloader/downloaderPicker");
const render = require("../../src/downloader/downloaderRender");
const {
  getUploadLimitBytes,
  getUploadLimitMB,
} = require("../../src/downloader/downloaderCompress");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("downloader")
    .setDescription(
      "Unduh video & foto kualitas terbaik (YouTube, IG, TikTok, X, dan lainnya).",
    )
    .addStringOption((opt) =>
      opt
        .setName("url")
        .setDescription("Tautan postingan yang mau diunduh")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("quality")
        .setDescription("Pilih resolusi sebelum diunduh (bawaan: otomatis)")
        .setRequired(false)
        .addChoices(...core.QUALITY_CHOICES),
    ),

  async execute(interaction) {
    const limited = await RateLimiter.isRateLimited(
      interaction.user.id,
      "downloader",
      4,
      60,
    );
    if (limited) return ui.sendError(interaction, "err_sys_30", true);

    await interaction.deferReply();

    const url = String(interaction.options.getString("url"))
      .replace(/[<>]/g, "")
      .trim();
    const qualityChoice = interaction.options.getString("quality") || "auto";

    if (!url.startsWith("http")) {
      return interaction.editReply(render.invalidUrlCard());
    }

    const platform = core.detectPlatform(url);
    const cleanup = new core.CleanupManager();
    const limitBytes = getUploadLimitBytes(interaction);
    const limitMB = getUploadLimitMB(interaction);
    const preselectedHeight =
      qualityChoice !== "auto" ? parseInt(qualityChoice, 10) : null;

    logger.info(
      `[Downloader] Platform: ${platform} | Kualitas: ${qualityChoice} | URL: ${url.substring(0, 80)}`,
    );

    try {
      // Cache hanya berisi hasil yang sudah lolos validasi.
      let data = core.getCachedResult(url);

      if (!data) {
        const outcome = await runChain(url, platform, cleanup);
        data = outcome.data;
        if (data && !data.isLocalFile) core.setCachedResult(url, data);
      }

      if (!data) return interaction.editReply(render.failureCard(platform));

      const actionRow = new ActionRowBuilder();

      // Tambahkan tombol link postingan asli jika valid
      if (url.length <= 512) {
        const btn = new ButtonBuilder()
          .setLabel("Lihat Postingan")
          .setURL(url)
          .setStyle(ButtonStyle.Link);
        const emoji = ui.parseEmoji(ui.getEmoji("core") || "🌸");
        if (emoji) btn.setEmoji(emoji);
        actionRow.addComponents(btn);
      }

      // ==========================================
      // KASUS 1: ALBUM MULTI-FOTO / PICKER
      // ==========================================
      if (data.status === "picker" && Array.isArray(data.picker)) {
        const totalItems = data.picker.length;
        const usableRows = actionRow.components.length > 0 ? [actionRow] : [];

        // Bila foto <= 10, kirim langsung dalam 1 fase
        if (totalItems <= core.MAX_ATTACHMENTS) {
          const payload = render.multiPhotoPhaseCard({
            client: interaction.client,
            platform,
            sourceUrl: url,
            phase: 1,
            totalPhases: 1,
            startIdx: 1,
            endIdx: totalItems,
            totalPhotos: totalItems,
            mediaNames: data.picker.map((item) => item.url),
            rows: usableRows,
          });

          return await interaction.editReply(payload);
        }

        // Bila foto > 10, bagi menjadi 2 fase pengiriman agar tidak terpotong batas Discord
        const phase1Items = data.picker.slice(0, 10);
        const phase2Items = data.picker.slice(10, 20);

        const phase1Payload = render.multiPhotoPhaseCard({
          client: interaction.client,
          platform,
          sourceUrl: url,
          phase: 1,
          totalPhases: 2,
          startIdx: 1,
          endIdx: 10,
          totalPhotos: totalItems,
          mediaNames: phase1Items.map((item) => item.url),
          rows: [],
        });

        await interaction.editReply(phase1Payload);

        const endIdx = Math.min(20, totalItems);
        const phase2Payload = render.multiPhotoPhaseCard({
          client: interaction.client,
          platform,
          sourceUrl: url,
          phase: 2,
          totalPhases: 2,
          startIdx: 11,
          endIdx,
          totalPhotos: totalItems,
          mediaNames: phase2Items.map((item) => item.url),
          rows: usableRows,
        });

        return await interaction.followUp(phase2Payload);
      }

      // ==========================================
      // KASUS 2: MEDIA TUNGGAL (VIDEO / SINGLE FOTO)
      // ==========================================
      if (data.url) {
        const mediaGalleryRefs = [];
        const otherFileRefs = [];
        let attachments = [];
        let linkManualText = "";
        let primaryAttachmentName = null;
        let resolutionPickerSource = null;

        const prepared = await prepareSingleMedia({
          interaction,
          data,
          platform,
          cleanup,
          limitBytes,
          limitMB,
          preselectedHeight,
        });

        attachments = prepared.attachments;
        linkManualText += prepared.linkManualText;
        primaryAttachmentName = prepared.primaryAttachmentName;
        resolutionPickerSource = prepared.resolutionPickerSource;

        // Berkas sumber untuk menu resolusi harus lolos dari pembersihan
        // di blok finally, kalau tidak menunya akan selalu gagal.
        if (resolutionPickerSource)
          cleanup.files.delete(resolutionPickerSource);

        if (
          !data.isLocalFile &&
          typeof data.url === "string" &&
          data.url.startsWith("http")
        ) {
          if (data.url.length <= 512) {
            const btn = new ButtonBuilder()
              .setLabel("Unduh Manual")
              .setURL(data.url)
              .setStyle(ButtonStyle.Link);
            const emoji = ui.parseEmoji(ui.getEmoji("core") || "🌸");
            if (emoji) btn.setEmoji(emoji);
            actionRow.addComponents(btn);
          } else {
            linkManualText += `\n\n${render.e("naura_read", "📖")} **Tautan cadangan:** [klik di sini](${data.url})`;
          }
        }

        if (primaryAttachmentName) {
          const ext = primaryAttachmentName.split(".").pop().toLowerCase();
          const visual = [
            "mp4",
            "webm",
            "mov",
            "avi",
            "mkv",
            "jpg",
            "jpeg",
            "png",
            "webp",
            "gif",
            "bmp",
            "heic",
          ];
          if (visual.includes(ext)) mediaGalleryRefs.push(primaryAttachmentName);
          else otherFileRefs.push(primaryAttachmentName);
        }

        const rows = [actionRow];
        if (resolutionPickerSource)
          rows.push(picker.buildResolutionRow(interaction.id));
        const usableRows = rows.filter((row) => row && row.components.length > 0);

        const qualityLabel = preselectedHeight
          ? ` | pilihan kamu: **${preselectedHeight}p**`
          : "";
        const resolutionText =
          primaryAttachmentName && primaryAttachmentName.includes("compressed")
            ? `terkompresi two-pass${qualityLabel}`
            : `asli, kualitas terbaik${qualityLabel}`;

        const payload = render.resultCard({
          client: interaction.client,
          platform,
          sourceUrl: url,
          resolutionText,
          extraText: linkManualText,
          mediaNames: mediaGalleryRefs,
          fileNames: otherFileRefs,
          rows: usableRows,
        });

        if (attachments.length > 0) payload.files = attachments;

        const sentMessage = await interaction.editReply(payload);

        if (resolutionPickerSource) {
          picker.attachResolutionCollector({
            interaction,
            message: sentMessage,
            sourcePath: resolutionPickerSource,
            platform,
            sourceUrl: url,
            limitBytes,
            limitMB,
            extraRows: actionRow.components.length > 0 ? [actionRow] : [],
          });
        }

        return;
      }

      return interaction.editReply(render.unsupportedCard());
    } catch (error) {
      logger.error(`[Downloader] Kesalahan tak terduga: ${error.message}`);
      await interaction.editReply(render.failureCard(platform)).catch(() => {});
    } finally {
      await cleanup.cleanup();
    }
  },
};
