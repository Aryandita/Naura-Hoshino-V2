const { SlashCommandBuilder, AttachmentBuilder, PermissionsBitField } = require('discord.js');
const ui = require('../../src/config/ui');
const env = require('../../src/config/env');
const UserProfile = require('../../src/models/UserProfile');
const GuildSettings = require('../../src/models/GuildSettings');
const { logger } = require('../../src/managers/logger');
const translate = require('@iamtraction/google-translate');
const google = require('googlethis');
const { GoogleGenerativeAI } = require('@google/generative-ai');
const path = require('path');
const fs = require('fs');
const os = require('os');
const fetch = require('node-fetch');
const axios = require('axios');
const { buildContainerV2, buildErrorContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const pinkColor = ui.getColor('primary') || '#FFB6C1';

let whisperPipeline = null;
async function getWhisperPipeline() {
    if (!whisperPipeline) {
        try {
            const { pipeline } = await import('@xenova/transformers');
            whisperPipeline = await pipeline('automatic-speech-recognition', 'Xenova/whisper-base');
        } catch (e) {
            logger.error('[AI] Gagal inisialisasi Whisper Transformer model:', e);
        }
    }
    return whisperPipeline;
}

async function generateWithFooocus(prompt) {
    const fooocusUrl = process.env.FOOOCUS_API_URL || 'http://127.0.0.1:7865';
    try {
        const response = await fetch(`${fooocusUrl}/v1/generation/text-to-image`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                prompt: prompt,
                performance_selection: 'Speed',
                aspect_ratios_selection: '1024*1024',
                image_number: 1
            }),
            timeout: 120000
        });

        if (!response.ok) throw new Error(`Fooocus API HTTP ${response.status}`);
        const data = await response.json();
        if (data && data[0] && data[0].base64) {
            return `data:image/png;base64,${data[0].base64}`;
        }
        if (data && data[0] && data[0].url) {
            return data[0].url;
        }
        throw new Error('Format response Fooocus tidak valid');
    } catch (error) {
        throw error;
    }
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Kumpulan Fitur Kecerdasan Buatan (AI) Naura Hoshino')
        .addSubcommand(sub => sub.setName('chat').setDescription('Tanya atau ngobrol dengan Naura AI (Gemini Flash)').addStringOption(opt => opt.setName('pesan').setDescription('Pertanyaan atau pesanmu').setRequired(true)))
        .addSubcommand(sub => sub.setName('imagine').setDescription('Minta Naura melukis gambar indah dari imajinasimu (Eksklusif VIP)').addStringOption(opt => opt.setName('prompt').setDescription('Deskripsikan gambar yang ingin dibuat').setRequired(true)))
        .addSubcommand(sub => sub.setName('transcribe').setDescription('Transkripsi file audio atau video menjadi teks (Whisper AI)').addAttachmentOption(opt => opt.setName('file').setDescription('Unggah file audio (MP3, WAV, M4A) atau video (MP4)').setRequired(true)))
        .addSubcommand(sub => sub.setName('translate').setDescription('Penerjemah Bahasa Canggih Naura').addStringOption(opt => opt.setName('teks').setDescription('Teks yang ingin diterjemahkan').setRequired(true)).addStringOption(opt => opt.setName('ke_bahasa').setDescription('Bahasa tujuan (misal: English, Japanese)').setRequired(true)))
        .addSubcommand(sub => sub.setName('search').setDescription('Pencarian Web Intelijen & Rangkuman AI Real-time').addStringOption(opt => opt.setName('kueri').setDescription('Kata kunci pencarian').setRequired(true)))
        .addSubcommand(sub => sub.setName('settings').setDescription('Atur Persona & Basis Pengetahuan AI untuk Server ini (Admin)').addStringOption(opt => opt.setName('persona').setDescription('Sifat / Karakter Naura khusus server ini (misal: Sopan, Komedi)').setRequired(false)).addStringOption(opt => opt.setName('knowledge').setDescription('FAQ / Aturan khusus server yang wajib diketahui Naura').setRequired(false))),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        const [userProfile] = await UserProfile.findOrCreate({ where: { userId: user.id } });
        const isPremiumUser = userProfile.isPremium && userProfile.premiumUntil && userProfile.premiumUntil > new Date();

        try {
            if (subcommand === 'chat') {
                const prompt = interaction.options.getString('pesan');

                let [guildSettings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guildId || 'DM' } });
                const currentSettings = guildSettings.settings || {};

                let systemInstruction = `Kamu adalah Naura Hoshino, asisten virtual anime yang imut, ramah, dan profesional.`;

                if (currentSettings.ai && currentSettings.ai.customPersona) {
                    systemInstruction += ` Sifat khusus server ini: ${currentSettings.ai.customPersona}`;
                }
                if (currentSettings.ai && currentSettings.ai.serverKnowledge) {
                    systemInstruction += ` Informasi khusus server ini: ${currentSettings.ai.serverKnowledge}`;
                }

                let replyText = '';
                let aiProvider = 'Gemini 2.5 Flash';

                try {
                    const genAI = new GoogleGenerativeAI(env.GEMINI_API_KEY);
                    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash', systemInstruction });
                    const chat = model.startChat();
                    const result = await chat.sendMessage(prompt);
                    replyText = result.response.text();
                } catch (geminiError) {
                    logger.error('[AI Chat Gemini Error]:', geminiError);
                    replyText = `Maaf, Naura sedang mengalami sedikit masalah koneksi ke pusat pikiran AI. Coba lagi nanti ya! 💕`;
                }

                const payload = buildContainerV2({
                    accentColorHex: pinkColor,
                    authorName: 'Naura AI Chat',
                    iconURL: interaction.client.user.displayAvatarURL(),
                    description: `**Pesan:** ${prompt}\n\n**Naura:**\n${replyText}`,
                    footerText: `Powered by ${aiProvider} • Naura Intelligence`
                });

                return interaction.editReply(payload);
            }

            else if (subcommand === 'imagine') {
                if (!isPremiumUser) {
                    const errPayload = buildErrorContainerV2({
                        title: '💎 Fitur V.I.P Terkunci',
                        description: `${ui.getEmoji('cross') || '❌'} | Akses ditolak! Pembuatan gambar resolusi tinggi memakan daya pemrosesan server yang besar. Ini adalah fitur eksklusif untuk member **Premium**.`,
                        footerText: ui.getFooter('core')
                    });
                    return interaction.editReply(errPayload);
                }
                const prompt = interaction.options.getString('prompt');
                let imageUrl = "";
                let imageSource = "Verba Image API";

                try {
                    const payloadGambar = {
                        character: process.env.VERBA_CHARACTER_SLUG || "naura",
                        prompt: prompt,
                        size: "512x512"
                    };

                    const response = await fetch('https://api.verba.ink/v1/image', {
                        method: 'POST',
                        headers: {
                            'Authorization': `Bearer ${env.VERBA_API_KEY}`,
                            'Content-Type': 'application/json',
                            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                        },
                        body: JSON.stringify(payloadGambar)
                    });

                    const rawText = await response.text();
                    if (!response.ok) {
                        let errorMessage = `HTTP ${response.status}`;
                        try {
                            const errorData = JSON.parse(rawText);
                            errorMessage = errorData.error?.message || errorData.message || errorMessage;
                        } catch (e) {
                            errorMessage = `${errorMessage} - Non-JSON response`;
                        }
                        throw new Error(`Verba API error: ${errorMessage}`);
                    }

                    let data;
                    try {
                        data = JSON.parse(rawText);
                    } catch (parseError) {
                        throw new Error(`Invalid JSON response dari Verba API (HTTP ${response.status})`);
                    }

                    imageUrl = data.url || data.image || (data.data && data.data[0] && data.data[0].url) || (data.choices && data.choices[0] && data.choices[0].url) || data.imageUrl || data.image_url;
                    if (!imageUrl) throw new Error("Format JSON API Gambar Verba tidak dikenali.");
                } catch (e) {
                    logger.error("Verba Imagine Error:", e);
                    try {
                        logger.info('[AI] 🎨 Mencoba Fooocus untuk generate gambar...');
                        imageSource = "Fooocus Local AI";
                        const fooocusResult = await generateWithFooocus(prompt);
                        if (fooocusResult) {
                            imageUrl = fooocusResult;
                        } else {
                            throw new Error('Fooocus tidak mengembalikan gambar');
                        }
                    } catch (fooocusError) {
                        logger.error(`[AI] Fooocus gagal: ${fooocusError.message}`);
                        imageSource = "Pollinations AI (Fallback)";
                        imageUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=512&height=512&nologo=true&enhance=true`;
                    }
                }

                if (imageUrl && imageUrl.startsWith('data:image')) {
                    const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
                    const tempDir = os.tmpdir();
                    const tempImagePath = path.join(tempDir, `naura_art_${Date.now()}.png`);
                    fs.writeFileSync(tempImagePath, Buffer.from(base64Data, 'base64'));

                    const attachment = new AttachmentBuilder(tempImagePath, { name: 'naura_art.png' });
                    const payload = buildContainerV2({
                        accentColorHex: pinkColor,
                        authorName: '🎨 Naura Art Studio',
                        iconURL: interaction.client.user.displayAvatarURL(),
                        description: `Kanvas telah selesai dilukis oleh AI!\n\n> ${ui.getEmoji('paintbrush') || '🖌️'} **Prompt:** *${prompt}*`,
                        bannerAttachmentName: 'naura_art.png',
                        footerText: `Rendered with Quality Preset • ${imageSource}`
                    });

                    const result = await interaction.editReply({ ...payload, files: [attachment] });
                    try { fs.unlinkSync(tempImagePath); } catch { }
                    return result;
                }

                const payload = buildContainerV2({
                    accentColorHex: pinkColor,
                    authorName: '🎨 Naura Art Studio',
                    iconURL: interaction.client.user.displayAvatarURL(),
                    description: `Kanvas telah selesai dilukis oleh AI!\n\n> ${ui.getEmoji('paintbrush') || '🖌️'} **Prompt:** *${prompt}*`,
                    footerText: `Rendered with Quality Preset • ${imageSource}`
                });

                return interaction.editReply(payload);
            }

            else if (subcommand === 'transcribe') {
                const attachment = interaction.options.getAttachment('file');

                const allowedMimeTypes = [
                    'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/mp4', 'audio/webm', 'audio/flac',
                    'video/mp4', 'video/webm', 'video/quicktime', 'video/x-matroska'
                ];

                if (!attachment.contentType || !allowedMimeTypes.some(m => attachment.contentType.startsWith(m))) {
                    const errPayload = buildErrorContainerV2({
                        title: 'Format Tidak Didukung',
                        description: `${ui.getEmoji('error') || '❌'} Format file tidak didukung! Kirim file **audio** (MP3, WAV, OGG, M4A, FLAC) atau **video** (MP4, WebM, MOV).`,
                        footerText: ui.getFooter('core')
                    });
                    return interaction.editReply(errPayload);
                }

                if (attachment.size > 25 * 1024 * 1024) {
                    const errPayload = buildErrorContainerV2({
                        title: 'File Terlalu Besar',
                        description: `${ui.getEmoji('error') || '❌'} File terlalu besar! Maksimal **25 MB** untuk transkripsi.`,
                        footerText: ui.getFooter('core')
                    });
                    return interaction.editReply(errPayload);
                }

                const loadingPayload = buildLoadingContainerV2({
                    authorName: '🎤 Naura Whisper Transcriber',
                    description: `${ui.getEmoji('loading') || '⏳'} Naura sedang mendengarkan dan mentranskripsi file audio/video... Ini mungkin memakan waktu beberapa saat.`,
                    footerText: ui.getFooter('core')
                });
                await interaction.editReply(loadingPayload);

                try {
                    const whisper = await getWhisperPipeline();
                    if (!whisper) {
                        throw new Error('Model Whisper gagal dimuat.');
                    }

                    const tempDir = os.tmpdir();
                    const ext = path.extname(attachment.name) || '.mp3';
                    const tempFilePath = path.join(tempDir, `naura_whisper_${Date.now()}${ext}`);

                    const fileResponse = await axios.get(attachment.url, {
                        responseType: 'arraybuffer',
                        timeout: 30000
                    });
                    fs.writeFileSync(tempFilePath, Buffer.from(fileResponse.data));

                    let audioPath = tempFilePath;
                    const tempWavPath = path.join(tempDir, `naura_whisper_${Date.now()}.wav`);

                    if (ext !== '.wav') {
                        const ffmpegStatic = require('ffmpeg-static');
                        const ffmpegModule = require('fluent-ffmpeg');
                        ffmpegModule.setFfmpegPath(ffmpegStatic);

                        await new Promise((resolve, reject) => {
                            ffmpegModule(tempFilePath)
                                .audioChannels(1)
                                .audioFrequency(16000)
                                .format('wav')
                                .output(tempWavPath)
                                .on('end', resolve)
                                .on('error', reject)
                                .run();
                        });
                        audioPath = tempWavPath;
                    }

                    const result = await whisper(audioPath, {
                        chunk_length_s: 30,
                        stride_length_s: 5,
                        return_timestamps: false
                    });

                    const transcribedText = result.text || 'Tidak ada teks yang terdeteksi.';

                    try { fs.unlinkSync(tempFilePath); } catch { }
                    try { if (audioPath !== tempFilePath) fs.unlinkSync(audioPath); } catch { }

                    const chunks = [];
                    let remainingText = transcribedText;
                    while (remainingText.length > 0) {
                        chunks.push(remainingText.substring(0, 3900));
                        remainingText = remainingText.substring(3900);
                    }

                    for (let i = 0; i < chunks.length; i++) {
                        const payload = buildContainerV2({
                            accentColorHex: pinkColor,
                            authorName: i === 0 ? '🎤 Naura Whisper Transcriber' : undefined,
                            iconURL: i === 0 ? interaction.client.user.displayAvatarURL() : undefined,
                            description: chunks[i],
                            footerText: i === chunks.length - 1 ? `Powered by Whisper AI (model: base) • Diminta oleh ${interaction.user.username}` : undefined
                        });
                        if (i === 0) await interaction.editReply(payload);
                        else await interaction.followUp(payload);
                    }

                } catch (whisperError) {
                    logger.error('[AI Whisper Error]:', whisperError);
                    const errPayload = buildErrorContainerV2({
                        title: 'Gagal Transkripsi',
                        description: `${ui.getEmoji('error') || '❌'} Gagal melakukan transkripsi: ${whisperError.message}`,
                        footerText: ui.getFooter('core')
                    });
                    return interaction.editReply(errPayload);
                }
            }

            else if (subcommand === 'translate') {
                const teks = interaction.options.getString('teks');
                const targetLang = interaction.options.getString('ke_bahasa').toLowerCase();
                const hasil = await translate(teks, { to: targetLang });

                const payload = buildContainerV2({
                    accentColorHex: pinkColor,
                    authorName: '🌐 Naura Global Translator',
                    iconURL: interaction.client.user.displayAvatarURL(),
                    description: `Teks berhasil diterjemahkan ke **${targetLang.toUpperCase()}**! ${ui.getEmoji('sparkles_generic') || '✨'}\n\n**${ui.getEmoji('memo') || '📝'} Teks Asli:**\n\`\`\`${teks}\`\`\`\n\n**${ui.getEmoji('check') || '✅'} Hasil Terjemahan:**\n\`\`\`${hasil.text}\`\`\``,
                    footerText: 'Powered by Advanced Neural Translation'
                });

                return interaction.editReply(payload);
            }

            else if (subcommand === 'search') {
                const query = interaction.options.getString('kueri');
                const hasilSearch = await google.search(query, { safe: false });

                let deskripsi = `Naura telah menjelajahi internet dan menemukan data berikut:\n\n`;

                if (hasilSearch.results && hasilSearch.results.length > 0) {
                    hasilSearch.results.slice(0, 3).forEach((res, index) => {
                        deskripsi += `**${index + 1}. [${res.title}](${res.url})**\n> ${res.description}\n\n`;
                    });
                } else {
                    deskripsi = `> ${ui.getEmoji('cross') || '❌'} *Aduh, Naura tidak menemukan kecocokan data apapun di database internet global...*`;
                }

                const payload = buildContainerV2({
                    accentColorHex: pinkColor,
                    authorName: `🔍 Intelijen Pencarian Web: ${query}`,
                    iconURL: interaction.client.user.displayAvatarURL(),
                    description: deskripsi,
                    footerText: 'Naura Search Protocol'
                });

                return interaction.editReply(payload);
            }

            else if (subcommand === 'settings') {
                if (!interaction.guild) {
                    const errPayload = buildErrorContainerV2({ title: 'Khusus Server', description: 'Perintah ini hanya bisa digunakan di dalam server Discord!', footerText: ui.getFooter('core') });
                    return interaction.editReply(errPayload);
                }

                if (!interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild) &&
                    !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
                    const errPayload = buildErrorContainerV2({ title: 'Akses Ditolak', description: 'Hanya Administrator atau Pengelola Server yang dapat mengubah pengaturan AI Naura.', footerText: ui.getFooter('core') });
                    return interaction.editReply(errPayload);
                }

                const newPersona = interaction.options.getString('persona');
                const newKnowledge = interaction.options.getString('knowledge');

                let [guildSettings] = await GuildSettings.findOrCreate({ where: { guildId: interaction.guild.id } });
                let settings = guildSettings.settings || {};

                if (!settings.ai) settings.ai = {};

                if (newPersona === null && newKnowledge === null) {
                    const payload = buildContainerV2({
                        accentColorHex: pinkColor,
                        authorName: `⚙️ Pengaturan AI Server - ${interaction.guild.name}`,
                        iconURL: interaction.guild.iconURL() || interaction.client.user.displayAvatarURL(),
                        description: `Berikut adalah konfigurasi AI kustom untuk server ini saat ini:\n\n**Sifat Kustom (Persona):**\n${settings.ai.customPersona ? `\`\`\`${settings.ai.customPersona}\`\`\`` : '*Belum diatur (Menggunakan persona bawaan Naura)*'}\n\n**FAQ / Basis Pengetahuan Server:**\n${settings.ai.serverKnowledge ? `\`\`\`${settings.ai.serverKnowledge}\`\`\`` : '*Belum diatur (Tidak ada batasan aturan FAQ)*'}`,
                        footerText: 'Gunakan opsi /ai settings [persona] atau [knowledge] untuk memperbarui.'
                    });

                    return interaction.editReply(payload);
                }

                let updateMsg = '';
                if (newPersona !== null) {
                    if (newPersona.length > 500) {
                        const errPayload = buildErrorContainerV2({ title: 'Persona Terlalu Panjang', description: 'Teks persona maksimal 500 karakter!', footerText: ui.getFooter('core') });
                        return interaction.editReply(errPayload);
                    }
                    settings.ai.customPersona = newPersona.trim() === '' ? null : newPersona.trim();
                    updateMsg += `${ui.getEmoji('check') || '✅'} Sifat khusus (Persona) berhasil diperbarui.\n`;
                }

                if (newKnowledge !== null) {
                    if (newKnowledge.length > 1000) {
                        const errPayload = buildErrorContainerV2({ title: 'Knowledge Terlalu Panjang', description: 'Teks FAQ / Basis pengetahuan maksimal 1000 karakter!', footerText: ui.getFooter('core') });
                        return interaction.editReply(errPayload);
                    }
                    settings.ai.serverKnowledge = newKnowledge.trim() === '' ? null : newKnowledge.trim();
                    updateMsg += `${ui.getEmoji('check') || '✅'} FAQ / Basis pengetahuan server berhasil diperbarui.\n`;
                }

                guildSettings.settings = settings;
                guildSettings.changed('settings', true);
                await guildSettings.save();

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: '⚙️ Pengaturan AI Naura Diperbarui',
                    description: updateMsg,
                    footerText: ui.getFooter('core')
                });

                return interaction.editReply(successPayload);
            }

        } catch (error) {
            logger.error('AI Error:', error);
            return ui.sendError(interaction, 'err_sys_1', `${error.message}`);
        }
    }
};
