'use strict';

// ==========================================
// PROVIDER: YT-DLP
// ==========================================
// Jalur paling tahan banting: mengunduh langsung ke berkas lokal, jadi
// hasilnya tidak pernah berupa tautan halaman yang salah.

const fs = require('fs');
const os = require('os');
const path = require('path');
const YTDlpWrap = require('yt-dlp-wrap').default;
const { logger } = require('../../src/managers/logger');

const EXEC_TIMEOUT_MS = 60000;

let ytDlpInstance = null;
let ytDlpReady = false;

/**
 * Siapkan binary yt-dlp, unduh dari GitHub bila belum ada.
 * @returns {Promise<object|null>}
 */
const ensureYtDlp = async () => {
    if (ytDlpReady && ytDlpInstance) return ytDlpInstance;

    try {
        const binaryDir = path.join(__dirname, '..', '..', 'bin');
        if (!fs.existsSync(binaryDir)) fs.mkdirSync(binaryDir, { recursive: true });

        const binaryName = process.platform === 'win32' ? 'yt-dlp.exe' : 'yt-dlp';
        const binaryPath = path.join(binaryDir, binaryName);

        if (!fs.existsSync(binaryPath)) {
            logger.info('[Downloader] Mengunduh binary yt-dlp dari GitHub (pertama kali)...');
            await YTDlpWrap.downloadFromGithub(binaryPath);
            logger.info('[Downloader] Binary yt-dlp berhasil diunduh.');
        }

        if (process.platform !== 'win32') {
            try {
                fs.chmodSync(binaryPath, 0o755);
            } catch { /* mungkin sudah executable */ }
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
 * Unduh media memakai yt-dlp.
 * @param {string} url
 * @param {object} cleanup - CleanupManager
 * @returns {Promise<{status: string, url: string, isLocalFile: boolean}|null>}
 */
const tryYtdlp = async (url, cleanup) => {
    try {
        const ytdlp = await ensureYtDlp();
        if (!ytdlp) return null;

        logger.info('[Downloader] Mencoba yt-dlp...');

        const tempDir = os.tmpdir();
        const timestamp = Date.now();
        const tempOutput = path.join(tempDir, `naura_ytdlp_${timestamp}.%(ext)s`);

        const execPromise = ytdlp.execPromise([
            url,
            '-f', 'b[ext=mp4]/best[ext=mp4]/bestvideo[ext=mp4]+bestaudio[ext=m4a]/best',
            '--merge-output-format', 'mp4',
            '-o', tempOutput,
            '--no-playlist',
            '--no-warnings',
            '--max-filesize', '500M',
            '--socket-timeout', '15'
        ]);

        const timeoutPromise = new Promise((_, reject) => {
            setTimeout(() => reject(new Error('yt-dlp melewati batas waktu 60 detik')), EXEC_TIMEOUT_MS);
        });

        await Promise.race([execPromise, timeoutPromise]);

        const produced = fs.readdirSync(tempDir)
            .filter(f => f.startsWith(`naura_ytdlp_${timestamp}`))
            .map(f => path.join(tempDir, f));

        if (produced.length > 0 && fs.existsSync(produced[0])) {
            if (cleanup) cleanup.trackAll(produced);
            logger.info(`[Downloader] yt-dlp berhasil: ${produced[0]}`);
            return { status: 'stream', url: produced[0], isLocalFile: true };
        }
    } catch (e) {
        logger.error(`[Downloader] yt-dlp gagal: ${e.message}`);
    }
    return null;
};

module.exports = { ensureYtDlp, tryYtdlp, EXEC_TIMEOUT_MS };
