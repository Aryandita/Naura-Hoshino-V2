/**
 * @namespace: plugin/core/coreCommand.js
 * @type: CommandData
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Definisi slash command /core beserta alias prefix-nya.
 */

const { SlashCommandBuilder } = require('discord.js');

const data = new SlashCommandBuilder()
    .setName('core')
    .setDescription('Pusat Informasi & Sistem Inti Naura Hoshino / Core System')
    .addSubcommand(sub => sub.setName('ping').setDescription('Cek respons latensi Discord, Database MySQL, & Lavalink.'))
    .addSubcommand(sub => sub.setName('stats').setDescription('Lihat diagnostik spesifikasi server, RAM, dan OS Naura.'))
    .addSubcommand(sub => sub.setName('info').setDescription('Tampilkan info spesifik server saat ini atau info bot secara umum.'))
    .addSubcommand(sub => sub.setName('about').setDescription('Kenalan lebih dekat dengan Naura dan Aryandita!'))
    .addSubcommand(sub => sub.setName('help').setDescription('Buka panduan perintah interaktif Naura.'))
    .addSubcommand(sub => sub.setName('language').setDescription('Ubah bahasa bot di server ini / Change bot language')
        .addStringOption(opt => opt.setName('lang').setDescription('Pilih bahasa / Select language').setRequired(true).addChoices(
            { name: 'Indonesian', value: 'id' },
            { name: 'English', value: 'en' }
        )));

const aliases = ['ping', 'stats', 'info', 'about', 'help', 'language', 'lang'];

const SUBCOMMANDS = ['ping', 'stats', 'info', 'about', 'help', 'language'];

module.exports = { data, aliases, SUBCOMMANDS };
