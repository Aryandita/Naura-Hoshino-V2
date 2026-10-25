"use strict";

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
const { buildLoadingContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  isSubcommand: true,
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

    const url = String(interaction.options.getString("url"))
      .replace(/[<>]/g, "")
      .trim();
    const qualityChoice = interaction.options.getString("quality") || "auto";

    const loadingPayload = buildLoadingContainerV2({
      interaction,
      authorName: "Naura Media Downloader Engine",
      title: "Memeriksa Tautan...",
      description: `${ui.getEmoji("loading") || "⏳"} ${ui.getEmoji("naura_thinking") || "🤔"} *Naura sedang memeriksa tautan dan menyiapkan media terbaik untukmu...*`,
      expression: "thinking",
      withBanner: true,
      footerText: ui.getFooter("utility"),
    });
    await interaction.deferReply();
    await interaction.editReply(loadingPayload);

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
      let data = core.getCachedResult(url);

      if (!data) {
        const fetchingPayload = render.inspectingCard(interaction.client);
        await interaction.editReply(fetchingPayload).catch(() => {});
        
        const outcome = await runChain(url, platform, cleanup);
        data = outcome.data;
        if (data && !data.isLocalFile) core.setCachedResult(url, data);
      }

      if (!data) return interaction.editReply(render.failureCard(platform));

      const actionRow = new ActionRowBuilder();

      if (url.length <= 512) {
        const btn = new ButtonBuilder()
          .setLabel("Lihat Postingan")
          .setURL(url)
          .setStyle(ButtonStyle.Link);
        const emoji = ui.parseEmoji(ui.getEmoji("core") || "🌸");
        if (emoji) btn.setEmoji(emoji);
        actionRow.addComponents(btn);
      }

      if (data.status === "picker" && Array.isArray(data.picker)) {
        const totalItems = data.picker.length;
        const usableRows = actionRow.components.length > 0 ? [actionRow] : [];

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

      if (data.url) {
        const mediaGalleryRefs = [];
        const otherFileRefs = [];
        let attachments = [];
        let linkManualText = "";
        let primaryAttachmentName = null;
        let resolutionPickerSource = null;

        const downloadingPayload = render.fetchingCard(interaction.client, "sedang diproses");
        await interaction.editReply(downloadingPayload).catch(() => {});

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
          if (visual.includes(ext))
            mediaGalleryRefs.push(primaryAttachmentName);
          else otherFileRefs.push(primaryAttachmentName);
        }

        const rows = [actionRow];
        if (resolutionPickerSource)
          rows.push(picker.buildResolutionRow(interaction.id));
        const usableRows = rows.filter(
          (row) => row && row.components.length > 0,
        );

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
          files: attachments,
          rows: usableRows,
        });

        if (attachments.length > 0 && (!payload.files || payload.files.length === 0)) {
          payload.files = attachments;
        }

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
      const isRateLimit = error.message?.includes("rate") || error.message?.includes("429");
      const isTimeout = error.message?.includes("timeout") || error.message?.includes("ETIMEDOUT");
      
      let errorDesc;
      if (isRateLimit) {
        errorDesc = `${ui.getEmoji("naura_sleepy") || "😴"} Server penyedia media sedang membatasi akses karena terlalu banyak permintaan.\n\n${ui.getEmoji("sparkle") || "✨"} *Tunggu 1-2 menit lalu coba lagi ya, Naura tungguin!*`;
      } else if (isTimeout) {
        errorDesc = `${ui.getEmoji("naura_cry") || "😢"} Koneksi ke server penyedia media terputus karena waktu habis.\n\n${ui.getEmoji("sparkle") || "✨"} *Jaringan mungkin sedang tidak stabil. Coba lagi beberapa saat lagi!*`;
      } else {
        errorDesc = `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, terjadi kesalahan saat mengunduh media.\n\n**Detail:** ${error.message}\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi nanti atau gunakan tautan lain, ya!*`;
      }
      
      const errPayload = render.failureCard(platform);
      if (errPayload.components && errPayload.components[0]) {
        const container = errPayload.components[0];
        if (container.components) {
          const descComp = container.components.find(c => c.type === 10 && c.content);
          if (descComp) descComp.content = errorDesc;
        }
      }
      
      await interaction.editReply(errPayload).catch(() => {});
    } finally {
      await cleanup.cleanup();
    }
  },
};
