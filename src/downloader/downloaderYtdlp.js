"use strict";

// ==========================================
// PROVIDER: YT-DLP
// ==========================================
// Jalur paling tahan banting: mengunduh langsung ke berkas lokal, jadi
// hasilnya tidak pernah berupa tautan halaman yang salah.

const fs = require("fs");
const os = require("os");
const path = require("path");
const { logger } = require("../managers/logger");
const { ExternalAPIError } = require("../errors/DomainError");

const EXEC_TIMEOUT_MS = 60000;

let ytDlpInstance = null;
let ytDlpReady = false;

/**
 * Siapkan binary yt-dlp, unduh dari GitHub bila belum ada.
 *
 * Modul yt-dlp-wrap sengaja di-require di dalam fungsi ini. Rantai downloader
 * ikut dimuat saat CommandHandler memindai plugin/, padahal sebagian besar
 * proses bot tidak pernah menjalankan satu pun unduhan.
 *
 * @returns {Promise<object|null>}
 */
const ensureYtDlp = async () => {
  if (ytDlpReady && ytDlpInstance) return ytDlpInstance;

  try {
    const YTDlpWrap = require("yt-dlp-wrap").default;

    const binaryDir = path.join(__dirname, "..", "..", "bin");
    if (!fs.existsSync(binaryDir)) fs.mkdirSync(binaryDir, { recursive: true });

    const binaryName = process.platform === "win32" ? "yt-dlp.exe" : "yt-dlp";
    const binaryPath = path.join(binaryDir, binaryName);

    if (!fs.existsSync(binaryPath)) {
      logger.info(
        "[Downloader] Mengunduh binary yt-dlp dari GitHub (pertama kali)...",
      );
      await YTDlpWrap.downloadFromGithub(binaryPath);
      logger.info("[Downloader] Binary yt-dlp berhasil diunduh.");
    }

    if (process.platform !== "win32") {
      try {
        fs.chmodSync(binaryPath, 0o755);
      } catch (err) {
        logger.debug("[downloaderYtdlp:ensureYtDlp] Operasi berkas/proses sistem gagal: " + (err?.message || err));
      }
    }

    ytDlpInstance = new YTDlpWrap(binaryPath);
    ytDlpReady = true;
    return ytDlpInstance;
  } catch (e) {
    logger.error(`[Downloader] Gagal inisialisasi yt-dlp: ${e.message}`);
    return null;
  }
};

/**
 * Cari dan verifikasi path berkas cookies YouTube yang valid.
 * @returns {string|null}
 */
const resolveCookiePath = () => {
  try {
    const env = require("../config/env");
    const candidates = [
      env.YOUTUBE_COOKIE_PATH && String(env.YOUTUBE_COOKIE_PATH).trim()
        ? path.resolve(process.cwd(), String(env.YOUTUBE_COOKIE_PATH).trim())
        : null,
      path.resolve(process.cwd(), "cookies.txt"),
      path.resolve(process.cwd(), "assets", "cookies", "youtube_cookies.txt"),
      path.resolve(process.cwd(), "message.txt"),
    ].filter(Boolean);

    for (const candidate of candidates) {
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        return candidate;
      }
    }
  } catch (err) {
    logger.debug(
      `[downloaderYtdlp:resolveCookiePath] Verifikasi path gagal: ${err?.message || err}`,
    );
  }
  return null;
};

/**
 * Bangun array argumen yt-dlp CLI dengan injeksi cookies opsional.
 * @param {string} url
 * @param {string} tempOutput
 * @param {string|null} [cookiePath]
 * @returns {Array<string>}
 */
const buildYtdlpArgs = (url, tempOutput, cookiePath = resolveCookiePath()) => {
  const args = [
    url,
    "-f",
    "b[ext=mp4]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best",
    "--merge-output-format",
    "mp4",
    "-o",
    tempOutput,
    "--no-playlist",
    "--no-warnings",
    "--max-filesize",
    "500M",
    "--socket-timeout",
    "15",
  ];

  if (cookiePath) {
    args.push("--cookies", cookiePath);
  }
  return args;
};

/**
 * Setter instance yt-dlp untuk keperluan automated unit testing.
 * @param {object|null} instance
 */
const _setYtDlpInstanceForTesting = (instance) => {
  ytDlpInstance = instance;
  ytDlpReady = Boolean(instance);
};

/**
 * Unduh media memakai yt-dlp.
 * @param {string} url
 * @param {object} cleanup - CleanupManager
 * @returns {Promise<{status: string, url: string, isLocalFile: boolean}|null>}
 */
const tryYtdlp = async (url, cleanup) => {
  let timeoutHandle = null;

  try {
    const ytdlp = await ensureYtDlp();
    if (!ytdlp) return null;

    logger.info("[Downloader] Mencoba yt-dlp...");

    const tempDir = os.tmpdir();
    const timestamp = Date.now();
    const tempOutput = path.join(tempDir, `naura_ytdlp_${timestamp}.%(ext)s`);

    const cookiePath = resolveCookiePath();
    const args = buildYtdlpArgs(url, tempOutput, cookiePath);
    if (cookiePath) {
      logger.info(
        `[Downloader] yt-dlp menggunakan cookies dari: ${path.basename(cookiePath)}`,
      );
    }

    const execPromise = ytdlp.execPromise(args);

    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(
        () => reject(new ExternalAPIError("yt-dlp melewati batas waktu 60 detik")),
        EXEC_TIMEOUT_MS,
      );
      if (timeoutHandle.unref) timeoutHandle.unref();
    });

    await Promise.race([execPromise, timeoutPromise]);

    const produced = fs
      .readdirSync(tempDir)
      .filter((f) => f.startsWith(`naura_ytdlp_${timestamp}`))
      .map((f) => path.join(tempDir, f));

    if (produced.length > 0 && fs.existsSync(produced[0])) {
      if (cleanup) cleanup.trackAll(produced);
      logger.info(`[Downloader] yt-dlp berhasil: ${produced[0]}`);
      return { status: "stream", url: produced[0], isLocalFile: true };
    }
  } catch (e) {
    logger.error(`[Downloader] yt-dlp gagal: ${e.message}`);
  } finally {
    // Tanpa ini, timer 60 detik tetap hidup meski unduhan selesai lebih cepat.
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }

  return null;
};

module.exports = {
  ensureYtDlp,
  tryYtdlp,
  resolveCookiePath,
  buildYtdlpArgs,
  _setYtDlpInstanceForTesting,
  EXEC_TIMEOUT_MS,
};
