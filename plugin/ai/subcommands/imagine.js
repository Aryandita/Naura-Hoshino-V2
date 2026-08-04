'use strict';

const { AttachmentBuilder } = require('discord.js');
const axios = require('axios');

const ui = require('../../../src/config/ui');
const env = require('../../../src/config/env');
const { logger } = require('../../../src/managers/logger');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const FILE_NAME = 'naura_art.png';
const VERBA_URL = 'https://api.verba.ink/v1/image';
const POLLINATIONS_URL = 'https://image.pollinations.ai/prompt';
const FETCH_TIMEOUT_MS = 120000;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/** Percobaan pertama: layanan gambar Verba. */
async function generateWithVerba(prompt) {
    const response = await axios.post(
        VERBA_URL,
        {
            character: process.env.VERBA_CHARACTER_SLUG || 'naura',
            prompt,
            size: '512x512'
        },
        {
            headers: {
                Authorization: `Bearer ${env.VERBA_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: FETCH_TIMEOUT_MS,
            validateStatus: () => true
        }
    );

    if (response.status < 200 || response.status >= 300) {
        const detail = response.data?.error?.message || response.data?.message || `HTTP ${response.status}`;
        throw new Error(`Verba API error: ${detail}`);
    }

    const data = response.data || {};
    const url = data.url
        || data.image
        || data.imageUrl
        || data.image_url
        || data.data?.[0]?.url
        || data.choices?.[0]?.url;

    if (!url) throw new Error('Format balasan API gambar Verba tidak dikenali.');
    return url;
}

/** Percobaan kedua: Fooocus yang berjalan lokal. */
async function generateWithFooocus(prompt) {
    const baseUrl = process.env.FOOOCUS_API_URL || 'http://127.0.0.1:7865';
    const response = await axios.post(
        `${baseUrl}/v1/generation/text-to-image`,
        {
            prompt,
            performance_selection: 'Speed',
            aspect_ratios_selection: '1024*1024',
            image_number: 1
        },
        { headers: { 'Content-Type': 'application/json' }, timeout: FETCH_TIMEOUT_MS }
    );

    const first = Array.isArray(response.data) ? response.data[0] : null;
    if (first?.base64) return `data:image/png;base64,${first.base64}`;
    if (first?.url) return first.url;
    throw new Error('Format balasan Fooocus tidak valid.');
}

/** Cadangan terakhir yang selalu tersedia tanpa kunci API. */
function pollinationsUrl(prompt) {
    const encoded = encodeURIComponent(prompt);
    return `${POLLINATIONS_URL}/${encoded}?width=512&height=512&nologo=true&enhance=true`;
}

/**
 * Ubah hasil apa pun menjadi lampiran nyata. Versi lama hanya menempelkan URL
 * ke payload tanpa berkas, jadi gambarnya tidak pernah muncul di Discord.
 */
async function toAttachment(imageUrl) {
    if (imageUrl.startsWith('data:image')) {
        const base64 = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        return new AttachmentBuilder(Buffer.from(base64, 'base64'), { name: FILE_NAME });
    }

    const download = await axios.get(imageUrl, {
        responseType: 'arraybuffer',
        timeout: FETCH_TIMEOUT_MS
    });
    return new AttachmentBuilder(Buffer.from(download.data), { name: FILE_NAME });
}

module.exports = async function imagine(interaction, { isPremiumUser }) {
    if (!isPremiumUser) {
        return interaction.editReply(buildErrorContainerV2({
            title: `${e('hmph', '\uD83D\uDC8E')} Fitur khusus V.I.P`,
            description: 'Maaf yaa, melukis gambar resolusi tinggi itu berat sekali buat server Naura. '
                + 'Fitur ini khusus untuk member **Premium**. Naura tunggu kamu di sana!',
            footerText: ui.getFooter('core')
        }));
    }

    const prompt = interaction.options.getString('prompt');
    let imageUrl;
    let imageSource = 'Verba Image API';

    try {
        imageUrl = await generateWithVerba(prompt);
    } catch (verbaError) {
        logger.error('[AI Imagine] Verba gagal', verbaError);
        try {
            imageSource = 'Fooocus Local AI';
            imageUrl = await generateWithFooocus(prompt);
        } catch (fooocusError) {
            logger.error(`[AI Imagine] Fooocus gagal: ${fooocusError.message}`);
            imageSource = 'Pollinations AI (Fallback)';
            imageUrl = pollinationsUrl(prompt);
        }
    }

    let attachment;
    try {
        attachment = await toAttachment(imageUrl);
    } catch (error) {
        logger.error('[AI Imagine] Gagal mengunduh hasil lukisan', error);
        return interaction.editReply(buildErrorContainerV2({
            title: `${e('cry', '\u274C')} Lukisannya gagal dikirim`,
            description: 'Gambarnya sudah jadi, tapi Naura kesulitan mengambilnya dari server. Coba sekali lagi yaa?',
            footerText: ui.getFooter('core')
        }));
    }

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary') || '#FFB6C1',
        authorName: 'Naura Art Studio',
        title: `${e('impressed', '\uD83C\uDFA8')} Kanvasnya sudah jadi!`,
        iconURL: interaction.client.user.displayAvatarURL(),
        description: `Naura lukis sepenuh hati buat kamu, semoga suka yaa!\n\n> **Prompt:** *${prompt}*`,
        bannerAttachmentName: FILE_NAME,
        files: [attachment],
        footerText: `Rendered with Quality Preset \u2022 ${imageSource}`
    });

    return interaction.editReply(payload);
};
