"use strict";

const path = require("path");
const fs = require("fs");
const os = require("os");
const axios = require("axios");

const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const MAX_SIZE_BYTES = 25 * 1024 * 1024;
const CHUNK_SIZE = 3900;
const ALLOWED_MIME = [
  "audio/mpeg",
  "audio/wav",
  "audio/ogg",
  "audio/mp4",
  "audio/webm",
  "audio/flac",
  "video/mp4",
  "video/webm",
  "video/quicktime",
  "video/x-matroska",
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

let whisperPipeline = null;

/** Model Whisper berat, jadi hanya dimuat sekali lalu dipakai ulang. */
async function getWhisperPipeline() {
  if (!whisperPipeline) {
    try {
      const { pipeline } = await import("@xenova/transformers");
      whisperPipeline = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-base",
      );
    } catch (error) {
      logger.error("[AI Transcribe] Gagal memuat model Whisper", error);
    }
  }
  return whisperPipeline;
}

function failCard(title, description) {
  return buildErrorContainerV2({
    title: `${e("cry", "\u274C")} ${title}`,
    description,
    footerText: ui.getFooter("core"),
  });
}

/** Whisper maunya WAV mono 16 kHz, jadi berkas lain dikonversi dulu. */
async function toWav(sourcePath, targetPath) {
  const ffmpegStatic = require("ffmpeg-static");
  const ffmpeg = require("fluent-ffmpeg");
  ffmpeg.setFfmpegPath(ffmpegStatic);

  await new Promise((resolve, reject) => {
    ffmpeg(sourcePath)
      .audioChannels(1)
      .audioFrequency(16000)
      .format("wav")
      .output(targetPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });

  return targetPath;
}

function splitText(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > 0) {
    chunks.push(rest.substring(0, CHUNK_SIZE));
    rest = rest.substring(CHUNK_SIZE);
  }
  return chunks.length > 0 ? chunks : [""];
}

function removeQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch {
    // Berkas sementara mungkin sudah hilang; abaikan saja.
  }
}

module.exports = async function transcribe(interaction) {
  const attachment = interaction.options.getAttachment("file");

  const mimeOk =
    attachment.contentType &&
    ALLOWED_MIME.some((m) => attachment.contentType.startsWith(m));

  if (!mimeOk) {
    return interaction.editReply(
      failCard(
        "Formatnya belum Naura kenali",
        "Naura cuma bisa mendengarkan berkas **audio** (MP3, WAV, OGG, M4A, FLAC) atau **video** (MP4, WebM, MOV). Coba kirim ulang yaa!",
      ),
    );
  }

  if (attachment.size > MAX_SIZE_BYTES) {
    return interaction.editReply(
      failCard(
        "Berkasnya kebesaran",
        "Maaf yaa, Naura cuma sanggup menampung berkas sampai **25 MB**. Coba potong dulu bagian yang paling penting.",
      ),
    );
  }

  await interaction.editReply(
    buildLoadingContainerV2({
      authorName: "Naura Whisper Transcriber",
      title: `${e("thinking", "\uD83C\uDFA4")} Naura lagi mendengarkan`,
      description:
        "Sabar sebentar yaa, Naura sedang menyimak berkasmu baik-baik supaya tidak ada kata yang terlewat.",
      footerText: ui.getFooter("core"),
    }),
  );

  const tempFiles = [];

  try {
    const whisper = await getWhisperPipeline();
    if (!whisper) throw new Error("Model Whisper gagal dimuat.");

    const tempDir = os.tmpdir();
    const stamp = Date.now();
    const ext = path.extname(attachment.name) || ".mp3";
    const sourcePath = path.join(tempDir, `naura_whisper_${stamp}${ext}`);

    const download = await axios.get(attachment.url, {
      responseType: "arraybuffer",
      timeout: 30000,
    });
    fs.writeFileSync(sourcePath, Buffer.from(download.data));
    tempFiles.push(sourcePath);

    let audioPath = sourcePath;
    if (ext !== ".wav") {
      const wavPath = path.join(tempDir, `naura_whisper_${stamp}.wav`);
      audioPath = await toWav(sourcePath, wavPath);
      tempFiles.push(wavPath);
    }

    const result = await whisper(audioPath, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const text = result.text || "Naura tidak menangkap suara apa pun di sini.";
    const chunks = splitText(text);

    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: isFirst ? "Naura Whisper Transcriber" : undefined,
        title: isFirst
          ? `${e("cheers", "\uD83C\uDFA7")} Ini hasil dengarnya!`
          : undefined,
        iconURL: isFirst
          ? interaction.client.user.displayAvatarURL()
          : undefined,
        description: chunks[i],
        footerText: isLast
          ? `Powered by Whisper AI (base) \u2022 Diminta oleh ${interaction.user.username}`
          : undefined,
      });

      if (isFirst) await interaction.editReply(payload);
      else await interaction.followUp(payload);
    }
  } catch (error) {
    logger.error("[AI Transcribe] Gagal mentranskripsi", error);
    return interaction.editReply(
      failCard(
        "Naura gagal mendengarkan",
        `Maaf yaa, ada yang tersendat di tengah jalan: ${error.message}`,
      ),
    );
  } finally {
    tempFiles.forEach(removeQuietly);
  }
};
