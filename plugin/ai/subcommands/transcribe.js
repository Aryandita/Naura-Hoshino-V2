"use strict";

/**
 * 🎧 Transcribe Subcommand - AI Speech-to-Text - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Transcribes audio/video files to text using Whisper AI model.
 * Supports multiple formats with automatic conversion to WAV.
 *
 * Features:
 * - Whisper base model (Xenova/whisper-base) via transformers.js
 * - Multi-format support (MP3, WAV, OGG, M4A, FLAC, MP4, WebM, MOV)
 * - Automatic audio conversion to WAV mono 16kHz via FFmpeg
 * - File size limit enforcement (25 MB max)
 * - Chunked output for long transcriptions (3900 chars per chunk)
 * - Lazy-loaded Whisper pipeline (loaded once, reused)
 * - Temporary file cleanup after processing
 *
 * @module plugin/ai/subcommands/transcribe
 */

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
const { DomainError } = require("../../../src/errors/DomainError");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Maximum file size in bytes (25 MB) */
const MAX_SIZE_BYTES = 25 * 1024 * 1024;

/** Maximum characters per message chunk */
const CHUNK_SIZE = 3900;

/** Allowed MIME types for audio/video files */
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

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get emoji by name with fallback.
 * @param {string} name - Emoji key
 * @param {string} fallback - Fallback emoji
 * @returns {string} Resolved emoji
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/** Cached Whisper pipeline instance (lazy-loaded) */
let whisperPipeline = null;

/**
 * Get or initialize Whisper pipeline (heavy model, loaded once).
 * Uses Xenova/whisper-base for automatic speech recognition.
 * @returns {Promise<object|null>} Whisper pipeline or null if failed
 */
async function getWhisperPipeline() {
  if (!whisperPipeline) {
    try {
      const { pipeline } = await import("@xenova/transformers");
      whisperPipeline = await pipeline(
        "automatic-speech-recognition",
        "Xenova/whisper-base",
      );
    } catch (error) {
      logger.error("[AI Transcribe] Failed to load Whisper model", error);
    }
  }
  return whisperPipeline;
}

/**
 * Build standardized error card.
 * @param {string} title - Error title
 * @param {string} description - Error description
 * @returns {object} Error payload
 */
function failCard(title, description) {
  return buildErrorContainerV2({
    title: `${e("cry", "❌")} ${title}`,
    description,
    footerText: ui.getFooter("core"),
  });
}

/**
 * Convert audio/video file to WAV mono 16kHz (Whisper requirement).
 * @param {string} sourcePath - Input file path
 * @param {string} targetPath - Output WAV file path
 * @returns {Promise<string>} Path to converted WAV file
 */
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

/**
 * Split long text into chunks for Discord message limits.
 * @param {string} text - Text to split
 * @returns {Array<string>} Array of text chunks
 */
function splitText(text) {
  const chunks = [];
  let rest = text;
  while (rest.length > 0) {
    chunks.push(rest.substring(0, CHUNK_SIZE));
    rest = rest.substring(CHUNK_SIZE);
  }
  return chunks.length > 0 ? chunks : [""];
}

/**
 * Safely remove temporary file without throwing errors.
 * @param {string} filePath - File path to remove
 */
function removeQuietly(filePath) {
  try {
    fs.unlinkSync(filePath);
  } catch (err) {
    logger.debug(`[transcribe:removeQuietly] File operation failed: ${err?.message || err}`);
  }
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Execute transcribe subcommand.
 * Downloads audio/video, converts to WAV, transcribes with Whisper, and returns text.
 * @param {object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
module.exports = async function transcribe(interaction) {
  const attachment = interaction.options.getAttachment("file");

  // Validate MIME type
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

  // Validate file size
  if (attachment.size > MAX_SIZE_BYTES) {
    return interaction.editReply(
      failCard(
        "Berkasnya kebesaran",
        "Maaf yaa, Naura cuma sanggup menampung berkas sampai **25 MB**. Coba potong dulu bagian yang paling penting.",
      ),
    );
  }

  // Show loading state
  await interaction.editReply(
    buildLoadingContainerV2({
      authorName: "Naura Whisper Transcriber",
      title: "Naura Sedang Mendengarkan...",
      loadingMessage:
        "Sabar sebentar yaa, Naura sedang menyimak rekaman suaramu baik-baik supaya tidak ada kata yang terlewat.",
      withBanner: true,
      footerText: ui.getFooter("core"),
    }),
  );

  const tempFiles = [];

  try {
    // Load Whisper model
    const whisper = await getWhisperPipeline();
    if (!whisper) {
      throw new DomainError("MODEL_LOAD_FAILED", "Model Whisper gagal dimuat ke memori.");
    }

    // Download file to temp directory
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

    // Convert to WAV if needed (Whisper requires WAV mono 16kHz)
    let audioPath = sourcePath;
    if (ext !== ".wav") {
      const wavPath = path.join(tempDir, `naura_whisper_${stamp}.wav`);
      audioPath = await toWav(sourcePath, wavPath);
      tempFiles.push(wavPath);
    }

    // Transcribe audio
    const result = await whisper(audioPath, {
      chunk_length_s: 30,
      stride_length_s: 5,
      return_timestamps: false,
    });

    const text = result.text || "Naura tidak menangkap suara apa pun di sini.";
    const chunks = splitText(text);

    // Send transcription results (chunked if long)
    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: isFirst ? "Naura Whisper Transcriber" : undefined,
        title: isFirst
          ? `${e("cheers", "🎧")} Ini hasil dengarnya!`
          : undefined,
        iconURL: isFirst
          ? interaction.client.user.displayAvatarURL()
          : undefined,
        description: chunks[i],
        footerText: isLast
          ? `Powered by Whisper AI (base) • Diminta oleh ${interaction.user.username}`
          : undefined,
      });

      if (isFirst) await interaction.editReply(payload);
      else await interaction.followUp(payload);
    }
  } catch (error) {
    logger.error("[AI Transcribe] Transcription failed", error);
    return interaction.editReply(
      failCard(
        "Naura gagal mendengarkan",
        `Maaf yaa, ada yang tersendat di tengah jalan: ${error.message}`,
      ),
    );
  } finally {
    // Cleanup temporary files
    tempFiles.forEach(removeQuietly);
  }
};
