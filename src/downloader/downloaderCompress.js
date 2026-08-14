"use strict";

// ==========================================
// FFMPEG: DETEKSI BINARY & KOMPRESI TWO-PASS
// ==========================================
// Two-pass jauh lebih akurat mengenai target ukuran dibanding single-pass:
// lintasan pertama menganalisis video, lintasan kedua memakai statistik itu
// untuk memilih bitrate yang presisi.

const fs = require("fs");
const os = require("os");
const path = require("path");
let _ffmpegCache = null;
function getFfmpeg() {
  if (!_ffmpegCache) _ffmpegCache = require("fluent-ffmpeg");
  return _ffmpegCache;
}
let _ffmpegStaticCache = null;
function getFfmpegStatic() {
  if (_ffmpegStaticCache === null)
    _ffmpegStaticCache = require("ffmpeg-static");
  return _ffmpegStaticCache;
}
const { logger } = require("../managers/logger");
const { NULL_DEVICE } = require("./downloaderCore");

/**
 * Cari binary FFmpeg: FFMPEG_PATH -> ffmpeg-static -> path sistem -> CLI.
 * @returns {string}
 */
function resolveFfmpegPath() {
  if (process.env.FFMPEG_PATH && fs.existsSync(process.env.FFMPEG_PATH)) {
    return process.env.FFMPEG_PATH;
  }

  if (getFfmpegStatic() && fs.existsSync(getFfmpegStatic())) {
    if (process.platform !== "win32") {
      try {
        fs.chmodSync(getFfmpegStatic(), 0o755);
      } catch {
        // Berkas mungkin sudah executable atau read-only; abaikan.
      }
    }
    return getFfmpegStatic();
  }

  const systemPaths = [
    "/usr/bin/ffmpeg",
    "/usr/local/bin/ffmpeg",
    "/snap/bin/ffmpeg",
    "C:\\ffmpeg\\bin\\ffmpeg.exe",
  ];
  for (const sysPath of systemPaths) {
    if (fs.existsSync(sysPath)) return sysPath;
  }

  return "ffmpeg";
}

const activeFfmpegPath = resolveFfmpegPath();
try {
  if (activeFfmpegPath) getFfmpeg().setFfmpegPath(activeFfmpegPath);
} catch {
  // Biarkan fluent-ffmpeg memakai pencarian bawaannya.
}

/** Batas unggah Discord untuk server terkait, disisakan 5 persen. */
const getUploadLimitBytes = (interaction) => {
  const guildLimit = interaction?.guild?.attachmentSizeLimit;
  if (guildLimit && guildLimit > 0) return Math.floor(guildLimit * 0.95);
  return 24 * 1024 * 1024;
};

const getUploadLimitMB = (interaction) =>
  getUploadLimitBytes(interaction) / (1024 * 1024);

/**
 * Kompresi satu video ke ukuran target memakai two-pass encoding.
 * @param {string} inputPath
 * @param {number} targetSizeMB
 * @param {number|null} forcedHeight
 * @param {object|null} cleanup - CleanupManager
 * @returns {Promise<string>} path hasil
 */
const compressWithFFmpeg = (
  inputPath,
  targetSizeMB = 23,
  forcedHeight = null,
  cleanup = null,
) => {
  return new Promise((resolve, reject) => {
    const currentPath = resolveFfmpegPath();
    if (currentPath !== "ffmpeg" && !fs.existsSync(currentPath)) {
      return reject(
        new Error(
          `Sistem FFmpeg tidak terdeteksi di server (${currentPath}). Silakan hubungi admin server.`,
        ),
      );
    }

    const timestamp = Date.now();
    const outputPath = inputPath.replace(
      /\.[^.]+$/,
      `_compressed_${timestamp}.mp4`,
    );
    const passlogPrefix = path.join(os.tmpdir(), `naura_pass_${timestamp}`);

    const { execFile } = require("child_process");

    const getDuration = () =>
      new Promise((resolveDur) => {
        getFfmpeg().ffprobe(inputPath, (err, metadata) => {
          if (!err && metadata?.format?.duration) {
            const dur = parseFloat(metadata.format.duration);
            if (dur > 0) return resolveDur(dur);
          }

          execFile(
            currentPath,
            ["-i", inputPath],
            (execErr, stdout, stderr) => {
              const out = (stderr || "") + (stdout || "");
              const durMatch = out.match(
                /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/i,
              );
              if (durMatch) {
                const hours = parseInt(durMatch[1], 10);
                const mins = parseInt(durMatch[2], 10);
                const secs = parseFloat(durMatch[3]);
                const totalSecs = hours * 3600 + mins * 60 + secs;
                if (totalSecs > 0) return resolveDur(totalSecs);
              }

              try {
                const stats = fs.statSync(inputPath);
                const estimated = Math.max(
                  10,
                  Math.min(300, stats.size / (1024 * 1024 * 0.8)),
                );
                return resolveDur(estimated);
              } catch {
                return resolveDur(60);
              }
            },
          );
        });
      });

    getDuration().then((duration) => {
      const totalBitrate = Math.floor((targetSizeMB * 8192 * 0.97) / duration);
      const audioBitrate = duration > 300 ? 96 : 128;
      const videoBitrate = Math.max(totalBitrate - audioBitrate, 150);

      logger.info(
        `[Downloader] Two-pass: durasi=${duration.toFixed(1)}s, video=${videoBitrate}k, audio=${audioBitrate}k${forcedHeight ? `, tinggi=${forcedHeight}p` : ""}`,
      );

      const videoFilters = [];
      if (forcedHeight) {
        videoFilters.push(`scale=-2:min(${forcedHeight}\\,ih)`);
      } else if (videoBitrate < 400) {
        videoFilters.push("scale=-2:480");
      } else if (videoBitrate < 1000) {
        videoFilters.push("scale=-2:720");
      }
      const vfOptions =
        videoFilters.length > 0 ? ["-vf", videoFilters.join(",")] : [];

      const finishPasslog = () => {
        if (cleanup) return cleanup.cleanupPasslog(passlogPrefix);
        for (const ext of [".log", ".log.mbtree"]) {
          try {
            if (fs.existsSync(`${passlogPrefix}${ext}`))
              fs.unlinkSync(`${passlogPrefix}${ext}`);
          } catch {
            /* abaikan */
          }
        }
      };

      const runPassTwo = () => {
        getFfmpeg()(inputPath)
          .videoCodec("libx264")
          .audioCodec("aac")
          .outputOptions([
            `-b:v ${videoBitrate}k`,
            `-b:a ${audioBitrate}k`,
            "-pass 2",
            `-passlogfile ${passlogPrefix}`,
            "-preset fast",
            "-movflags +faststart",
            "-y",
            ...vfOptions,
          ])
          .output(outputPath)
          .on("progress", (progress) => {
            if (progress.percent) {
              logger.info(
                `[Downloader] Kompresi lintasan 2: ${progress.percent.toFixed(1)}%`,
              );
            }
          })
          .on("end", () => {
            logger.info(`[Downloader] Two-pass selesai: ${outputPath}`);
            finishPasslog();
            resolve(outputPath);
          })
          .on("error", (ffmpegErr) =>
            reject(new Error(`FFmpeg lintasan 2 error: ${ffmpegErr.message}`)),
          )
          .run();
      };

      getFfmpeg()(inputPath)
        .videoCodec("libx264")
        .outputOptions([
          `-b:v ${videoBitrate}k`,
          "-pass 1",
          `-passlogfile ${passlogPrefix}`,
          "-preset fast",
          "-an",
          "-f null",
          "-y",
          ...vfOptions,
        ])
        .output(NULL_DEVICE)
        .on("end", () => {
          logger.info("[Downloader] Lintasan 1 selesai, lanjut lintasan 2...");
          runPassTwo();
        })
        .on("error", (ffmpegErr) =>
          reject(new Error(`FFmpeg lintasan 1 error: ${ffmpegErr.message}`)),
        )
        .run();
    });
  });
};

/**
 * Ulangi kompresi dengan bitrate makin rendah sampai muat batas unggah.
 * @returns {Promise<{success: boolean, path: string, sizeBytes: number, generatedFiles: string[]}>}
 */
const compressUntilFits = async (
  inputPath,
  limitBytes,
  limitMB,
  maxAttempts = 3,
  forcedHeight = null,
  cleanup = null,
) => {
  let targetMB = Math.max(Math.floor(limitMB - 1), 10);
  const generatedFiles = [];

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const outputPath = await compressWithFFmpeg(
      inputPath,
      targetMB,
      forcedHeight,
      cleanup,
    );
    generatedFiles.push(outputPath);
    if (cleanup) cleanup.track(outputPath);

    const stats = fs.statSync(outputPath);
    if (stats.size <= limitBytes) {
      return {
        success: true,
        path: outputPath,
        sizeBytes: stats.size,
        generatedFiles,
      };
    }

    logger.info(
      `[Downloader] Percobaan ${attempt}/${maxAttempts}: ${(stats.size / (1024 * 1024)).toFixed(1)}MB melebihi ${limitMB.toFixed(1)}MB.`,
    );
    targetMB = Math.max(
      Math.floor(targetMB * (limitBytes / stats.size) * 0.9),
      8,
    );
  }

  const lastPath = generatedFiles[generatedFiles.length - 1];
  return {
    success: false,
    path: lastPath,
    sizeBytes: fs.statSync(lastPath).size,
    generatedFiles,
  };
};

module.exports = {
  resolveFfmpegPath,
  activeFfmpegPath,
  getUploadLimitBytes,
  getUploadLimitMB,
  compressWithFFmpeg,
  compressUntilFits,
};
