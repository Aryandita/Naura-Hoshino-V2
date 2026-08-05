'use strict';

// ==========================================
// UNDUH & SIAPKAN SATU BERKAS MEDIA
// ==========================================
// Menangani dua sumber: berkas lokal hasil yt-dlp, dan tautan langsung dari
// provider lain. Keduanya berakhir pada satu keputusan yang sama: lampirkan
// apa adanya, kompres dulu, atau serahkan ke pemilihan resolusi manual.

const fs = require('fs');
const os = require('os');
const path = require('path');
const axios = require('axios');
const { AttachmentBuilder } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const core = require('./downloaderCore');
const { compressUntilFits } = require('./downloaderCompress');
const render = require('./downloaderRender');

const STREAM_TIMEOUT_MS = 45000;
const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv'];

const mb = (bytes) => (bytes / (1024 * 1024)).toFixed(1);

/** Unduh tautan ke berkas sementara, lalu pulangkan path dan ekstensinya. */
const streamToTempFile = async (link, platform, fallbackExt) => {
    const response = await axios.get(link, {
        responseType: 'stream',
        timeout: STREAM_TIMEOUT_MS,
        httpsAgent: core.httpsAgent,
        headers: core.getMediaDownloadHeaders(platform)
    });

    const finalExt = core.mimeToExt(response.headers['content-type'] || '') || fallbackExt;
    const finalPath = path.join(os.tmpdir(), `naura_media_${Date.now()}.${finalExt}`);
    const writer = fs.createWriteStream(finalPath);

    response.data.pipe(writer);

    await new Promise((resolve, reject) => {
        const timer = setTimeout(() => {
            writer.destroy();
            reject(new Error('Unduhan melewati batas waktu 45 detik'));
        }, STREAM_TIMEOUT_MS);

        writer.on('finish', () => { clearTimeout(timer); resolve(); });
        writer.on('error', (err) => { clearTimeout(timer); reject(err); });
        response.data.on('error', (err) => { clearTimeout(timer); writer.destroy(); reject(err); });
    });

    return { finalPath, finalExt };
};

/** Tebak ekstensi dari tautan bila content-type tidak membantu. */
const extFromUrl = (link) => {
    try {
        const ext = path.extname(new URL(link).pathname).replace('.', '').toLowerCase();
        const known = ['mp4', 'webm', 'mov', 'jpg', 'jpeg', 'png', 'webp', 'gif', 'mp3', 'wav'];
        return known.includes(ext) ? ext : null;
    } catch {
        return null;
    }
};

/**
 * Kompres berkas agar muat batas unggah.
 * @returns {Promise<{ ok: boolean, attachment?: object, name?: string, note?: string, sourcePath?: string }>}
 */
const shrink = async ({ interaction, filePath, sizeBytes, limitBytes, limitMB, preselectedHeight, cleanup }) => {
    const targetText = preselectedHeight ? `ke resolusi **${preselectedHeight}p**` : 'biar muat dikirim di Discord';

    await interaction.editReply(render.compressingCard(interaction.client, `${mb(sizeBytes)} MB`, targetText)).catch(() => {});

    const result = await compressUntilFits(filePath, limitBytes, limitMB, 3, preselectedHeight, cleanup);
    if (!result.success) return { ok: false, sourcePath: filePath };

    const name = 'naura_media_compressed.mp4';
    return {
        ok: true,
        name,
        attachment: new AttachmentBuilder(result.path, { name }),
        note: `\n\n${render.e('sparkle', '\uD83D\uDDDC\uFE0F')} *Naura kecilkan dari ${mb(sizeBytes)} MB jadi ${mb(result.sizeBytes)} MB${preselectedHeight ? ` @ ${preselectedHeight}p` : ''}.*`
    };
};

/**
 * Siapkan lampiran untuk hasil berstatus stream.
 * @returns {Promise<{attachments: object[], primaryAttachmentName: string|null, linkManualText: string, resolutionPickerSource: string|null}>}
 */
const prepareSingleMedia = async ({ interaction, data, platform, cleanup, limitBytes, limitMB, preselectedHeight }) => {
    const state = {
        attachments: [],
        primaryAttachmentName: null,
        linkManualText: '',
        resolutionPickerSource: null
    };

    await interaction.editReply(render.inspectingCard(interaction.client)).catch(() => {});

    const isLocalFile = data.isLocalFile === true;
    let workingPath = null;
    let workingExt = 'mp4';
    let delivered = false;

    if (isLocalFile && data.url && fs.existsSync(data.url)) {
        workingPath = data.url;
        workingExt = path.extname(workingPath).replace('.', '') || 'mp4';
        cleanup.track(workingPath);
    } else {
        // Perkirakan ukuran lebih dulu supaya pesan tunggunya informatif.
        const probe = await core.probeUrl(data.url, platform);
        const guessedExt = core.mimeToExt(probe.contentType) || extFromUrl(data.url) || 'mp4';
        const sizeText = probe.sizeBytes > 0 ? `${mb(probe.sizeBytes)} MB` : 'ukuran belum diketahui';

        await interaction.editReply(render.fetchingCard(interaction.client, sizeText)).catch(() => {});

        try {
            const streamed = await streamToTempFile(data.url, platform, guessedExt);
            workingPath = streamed.finalPath;
            workingExt = streamed.finalExt;
            cleanup.track(workingPath);
        } catch (downloadErr) {
            logger.error(`[Downloader] Gagal mengunduh media: ${downloadErr.message}`);
            state.linkManualText += `\n\n${render.e('annoy', '\u26A0\uFE0F')} **Medianya gagal Naura unduh otomatis.** Pakai tombol di bawah untuk mengunduhnya sendiri, ya.`;
            return state;
        }
    }

    const stats = fs.statSync(workingPath);

    if (stats.size <= limitBytes) {
        const name = `naura_media.${workingExt}`;
        state.attachments.push(new AttachmentBuilder(workingPath, { name }));
        state.primaryAttachmentName = name;
        delivered = true;
    } else if (VIDEO_EXTS.includes(workingExt)) {
        try {
            const shrunk = await shrink({
                interaction,
                filePath: workingPath,
                sizeBytes: stats.size,
                limitBytes,
                limitMB,
                preselectedHeight,
                cleanup
            });

            if (shrunk.ok) {
                state.attachments.push(shrunk.attachment);
                state.primaryAttachmentName = shrunk.name;
                state.linkManualText += shrunk.note;
                delivered = true;
            } else {
                state.resolutionPickerSource = workingPath;
            }
        } catch (compressErr) {
            logger.error(`[Downloader] Kompresi gagal: ${compressErr.message}`);
            state.resolutionPickerSource = workingPath;
        }
    }

    if (!delivered) {
        state.linkManualText += state.resolutionPickerSource
            ? `\n\n${render.e('thinking', '\uD83C\uDF9A\uFE0F')} **Videonya masih kebesaran buat dikirim langsung.** Pilih resolusi di menu bawah, nanti Naura kompres ulang lalu kirimkan.`
            : `\n\n${render.e('annoy', '\u26A0\uFE0F')} **Medianya lebih dari ${limitMB.toFixed(0)} MB.** Silakan unduh manual lewat tombol di bawah, ya.`;
    }

    return state;
};

module.exports = { prepareSingleMedia, streamToTempFile, extFromUrl, VIDEO_EXTS, mb };
