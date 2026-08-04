'use strict';

const { SlashCommandBuilder } = require('discord.js');

const ui = require('../../src/config/ui');
const UserProfile = require('../../src/models/UserProfile');
const { logger } = require('../../src/managers/logger');

const chat = require('./subcommands/chat');
const imagine = require('./subcommands/imagine');
const transcribe = require('./subcommands/transcribe');
const translate = require('./subcommands/translate');
const search = require('./subcommands/search');
const settings = require('./subcommands/settings');

const handlers = { chat, imagine, transcribe, translate, search, settings };

function isPremium(profile) {
    return Boolean(profile.isPremium && profile.premiumUntil && profile.premiumUntil > new Date());
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('ai')
        .setDescription('Kumpulan fitur kecerdasan buatan milik Naura Hoshino')
        .addSubcommand(sub => sub
            .setName('chat')
            .setDescription('Ngobrol santai bareng Naura')
            .addStringOption(opt => opt
                .setName('pesan')
                .setDescription('Apa yang ingin kamu tanyakan ke Naura?')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('imagine')
            .setDescription('Minta Naura melukiskan imajinasimu (khusus V.I.P)')
            .addStringOption(opt => opt
                .setName('prompt')
                .setDescription('Ceritakan gambar seperti apa yang kamu bayangkan')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('transcribe')
            .setDescription('Naura dengarkan audio atau videomu lalu ubah jadi teks')
            .addAttachmentOption(opt => opt
                .setName('file')
                .setDescription('Unggah audio (MP3, WAV, M4A) atau video (MP4)')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('translate')
            .setDescription('Naura bantu terjemahkan tulisanmu')
            .addStringOption(opt => opt
                .setName('teks')
                .setDescription('Teks yang ingin diterjemahkan')
                .setRequired(true))
            .addStringOption(opt => opt
                .setName('ke_bahasa')
                .setDescription('Mau diterjemahkan ke bahasa apa? (misal: English, Japanese)')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('search')
            .setDescription('Naura carikan informasinya di internet')
            .addStringOption(opt => opt
                .setName('kueri')
                .setDescription('Kata kunci yang mau dicari')
                .setRequired(true)))
        .addSubcommand(sub => sub
            .setName('settings')
            .setDescription('Atur sifat dan catatan khusus Naura untuk server ini (Admin)')
            .addStringOption(opt => opt
                .setName('persona')
                .setDescription('Sifat Naura khusus di server ini')
                .setRequired(false))
            .addStringOption(opt => opt
                .setName('knowledge')
                .setDescription('FAQ atau aturan server yang perlu Naura ingat')
                .setRequired(false))),

    async execute(interaction) {
        await interaction.deferReply();

        const subcommand = interaction.options.getSubcommand();
        const handler = handlers[subcommand];

        if (!handler) {
            return ui.sendError(interaction, 'err_sys_1', `Subcommand tidak dikenali: ${subcommand}`);
        }

        try {
            const [profile] = await UserProfile.findOrCreate({ where: { userId: interaction.user.id } });
            return await handler(interaction, { profile, isPremiumUser: isPremium(profile) });
        } catch (error) {
            logger.error(`[AI] Gagal menjalankan /ai ${subcommand}`, error);
            return ui.sendError(interaction, 'err_sys_1', `${error.message}`);
        }
    }
};
