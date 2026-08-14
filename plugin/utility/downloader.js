"use strict";

// ==========================================
// PERINTAH /downloader
// ==========================================
// Berkas ini hanya mengatur alur. Seluruh pekerjaan berat ada di:
//   downloaderCore.js      konstanta, cache, validasi content-type
//   downloaderChain.js     urutan provider + penyaringan hasil
//   downloaderFetch.js     unduh berkas tunggal + kompresi
//   downloaderPicker.js    menu resolusi manual
//   downloaderRender.js    seluruh kartu yang dilihat pengguna

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const RateLimiter = require("../../src/utils/rateLimiter");
const core = require("./downloaderCore");
const { runChain } = require("./downloaderChain");
const { prepareSingleMedia } = require("./downloaderFetch");
const picker = require("./downloaderPicker");
const render = require("./downloaderRender");
const {
  getUploadLimitBytes,
  getUploadLimitMB,
} = require("./downloaderCompress");

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

      const mediaGalleryRefs = [];
      const otherFileRefs = [];
      const actionRow = new ActionRowBuilder();
      let attachments = [];
      let linkManualText = "";
      let primaryAttachmentName = null;
      let resolutionPickerSource = null;

      if (data.status === "picker" && Array.isArray(data.picker)) {
        for (const item of data.picker.slice(0, core.MAX_ATTACHMENTS)) {
          mediaGalleryRefs.push(item.url);
        }
        if (data.picker.length > core.MAX_ATTACHMENTS) {
          linkManualText += `\n\n${render.e("read", "\u2139\uFE0F")} *Baru ${core.MAX_ATTACHMENTS} media pertama yang Naura tampilkan, dari total ${data.picker.length}.*`;
        }
      } else if (data.url) {
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
              .setLabel("Unduh manual")
              .setURL(data.url)
              .setStyle(ButtonStyle.Link);
            const emoji = ui.parseEmoji(
              ui.getEmoji("download") || "\uD83D\uDCE5",
            );
            if (emoji) btn.setEmoji(emoji);
            actionRow.addComponents(btn);
          } else {
            linkManualText += `\n\n${render.e("read", "\uD83D\uDD17")} **Tautan cadangan:** [klik di sini](${data.url})`;
          }
        }
      } else {
        return interaction.editReply(render.unsupportedCard());
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
    } catch (error) {
      logger.error(`[Downloader] Kesalahan tak terduga: ${error.message}`);
      await interaction.editReply(render.failureCard(platform)).catch(() => {});
    } finally {
      await cleanup.cleanup();
    }
  },
};
