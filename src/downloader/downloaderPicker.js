"use strict";

// ==========================================
// MENU PEMILIHAN RESOLUSI MANUAL
// ==========================================
// Muncul hanya bila kompresi otomatis masih melewati batas unggah. Pengguna
// memilih sendiri seberapa kecil videonya boleh dijadikan.

const fs = require("fs");
const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  ComponentType,
} = require("discord.js");
const { logger } = require("../managers/logger");
const { RESOLUTION_OPTIONS, CleanupManager } = require("./downloaderCore");
const { compressUntilFits } = require("./downloaderCompress");
const render = require("./downloaderRender");

const PICK_TIMEOUT_MS = 5 * 60 * 1000;

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

/** Baris menu resolusi untuk satu interaksi. */
const buildResolutionRow = (interactionId) =>
  new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`dl_res_${interactionId}`)
      .setPlaceholder("Pilih resolusi video...")
      .addOptions(RESOLUTION_OPTIONS),
  );

/**
 * Pasang collector pemilihan resolusi pada pesan hasil.
 * @param {object} args
 */
const attachResolutionCollector = ({
  interaction,
  message,
  sourcePath,
  platform,
  sourceUrl,
  limitBytes,
  limitMB,
  extraRows = [],
}) => {
  if (!message || typeof message.createMessageComponentCollector !== "function")
    return;

  const collector = message.createMessageComponentCollector({
    componentType: ComponentType.StringSelect,
    filter: (i) =>
      i.customId === `dl_res_${interaction.id}` &&
      i.user.id === interaction.user.id,
    time: PICK_TIMEOUT_MS,
    max: 1,
  });

  collector.on("collect", async (i) => {
    const chosenHeight = parseInt(i.values[0], 10);
    const manualCleanup = new CleanupManager();

    try {
      await i.deferUpdate().catch(() => {});
      await i
        .editReply(
          render.compressingCard(
            interaction.client,
            "ukuran aslinya",
            `ke resolusi **${chosenHeight}p**`,
          ),
        )
        .catch(() => {});

      if (!fs.existsSync(sourcePath)) {
        throw new Error(
          "Berkas sumber sudah tidak tersedia (mungkin server sempat restart).",
        );
      }

      const picked = await compressUntilFits(
        sourcePath,
        limitBytes,
        limitMB,
        3,
        chosenHeight,
        manualCleanup,
      );

      if (picked.success) {
        const finalName = `naura_media_${chosenHeight}p.mp4`;
        const payload = render.resultCard({
          client: interaction.client,
          platform,
          sourceUrl,
          resolutionText: `${chosenHeight}p (two-pass, pilihan kamu)`,
          extraText: `\n\n${render.e("naura_cheers", "✨")} *Ukuran akhirnya ${mb(picked.sizeBytes)} MB. Pas!*`,
          mediaNames: [finalName],
        });
        payload.files = [
          new AttachmentBuilder(picked.path, { name: finalName }),
        ];
        await i.editReply(payload);
        return;
      }

      await i.editReply(
        render.compressFailedCard({
          client: interaction.client,
          title: "Masih Kelewat Batas",
          description: `${render.e("naura_cry", "😢")} Naura sudah coba kecilkan ke **${chosenHeight}p**, tapi hasilnya ${mb(picked.sizeBytes)} MB dan masih di atas batas ${limitMB.toFixed(0)} MB. Coba pilih resolusi yang lebih rendah, ya.`,
        }),
      );
    } catch (pickErr) {
      logger.error(
        `[Downloader] Gagal memproses pilihan resolusi: ${pickErr.message}`,
      );

      const isFfmpegIssue = /ENOENT|FFmpeg|tidak terdeteksi/i.test(
        pickErr.message,
      );
      const description = isFfmpegIssue
        ? `${render.e("cry", "\uD83D\uDE22")} FFmpeg tidak terdeteksi atau tidak punya izin jalan di server ini, jadi Naura belum bisa mengompres. Tolong sampaikan ke pengelola server, ya.`
        : `${render.e("cry", "\uD83D\uDE22")} Ada kendala saat mengompres videonya: ${pickErr.message}. Kamu masih bisa mengunduhnya lewat tautan sumber di atas.`;

      await i
        .editReply(
          render.compressFailedCard({
            client: interaction.client,
            title: "Gagal Mengompres Media",
            description,
          }),
        )
        .catch(() => {});
    } finally {
      manualCleanup.track(sourcePath);
      await manualCleanup.cleanup();
    }
  });

  collector.on("end", (collected) => {
    if (collected.size > 0) return;

    try {
      if (fs.existsSync(sourcePath)) fs.unlinkSync(sourcePath);
    } catch {
      /* abaikan */
    }

    interaction
      .editReply(
        render.resultCard({
          client: interaction.client,
          platform,
          sourceUrl,
          resolutionText: "belum sempat dipilih",
          extraText: `\n\n${render.e("sleepy", "\u23F3")} *Waktu memilih resolusinya habis. Jalankan lagi perintahnya kalau kamu masih butuh videonya, ya.*`,
          rows: extraRows,
        }),
      )
      .catch(() => {});
  });
};

module.exports = {
  PICK_TIMEOUT_MS,
  buildResolutionRow,
  attachResolutionCollector,
};
