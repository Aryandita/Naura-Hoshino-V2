// Definisi slash command /minigame.
// Dipisahkan supaya penambahan subcommand tidak menyentuh berkas logika.

const { SlashCommandBuilder } = require('discord.js');

const DIFFICULTY_CHOICES = [
    { name: '\ud83d\udfe2 Pemula', value: 'pemula' },
    { name: '\ud83d\udd35 Tingkat Lanjut', value: 'lanjut' },
    { name: '\ud83d\udfe3 Master', value: 'master' },
    { name: '\ud83d\udfe1 GrandMaster', value: 'grandmaster' }
];

const data = new SlashCommandBuilder()
    .setName('minigame')
    .setDescription('\ud83c\udfae Ayo main bareng Naura! Ada banyak kuis dan game asah otak menantimu.');

// --- Kuis berbasis kesulitan ---
data.addSubcommand(sub => sub
    .setName('math')
    .setDescription('Adu cepat berhitung bareng Naura.')
    .addStringOption(opt => opt.setName('kesulitan').setDescription('Tingkat Kesulitan').setRequired(true).addChoices(...DIFFICULTY_CHOICES)));

data.addSubcommand(sub => sub
    .setName('trivia')
    .setDescription('Kuis pengetahuan umum yang disusun langsung oleh Naura.')
    .addStringOption(opt => opt.setName('kesulitan').setDescription('Tingkat Kesulitan').setRequired(true).addChoices(...DIFFICULTY_CHOICES)));

// --- Permainan bertaruh ---
data.addSubcommand(sub => sub
    .setName('rps')
    .setDescription('Batu Gunting Kertas melawan Naura.')
    .addIntegerOption(opt => opt.setName('taruhan').setDescription('Jumlah taruhan koin').setRequired(true))
    .addUserOption(opt => opt.setName('lawan').setDescription('Pilih pemain untuk PvP (kosongkan untuk lawan Naura)').setRequired(false)));

data.addSubcommand(sub => sub
    .setName('tictactoe')
    .setDescription('Tic-Tac-Toe melawan Naura.')
    .addIntegerOption(opt => opt.setName('taruhan').setDescription('Jumlah taruhan koin').setRequired(true))
    .addUserOption(opt => opt.setName('lawan').setDescription('Pilih pemain untuk PvP (kosongkan untuk lawan Naura)').setRequired(false)));

data.addSubcommand(sub => sub
    .setName('wordle')
    .setDescription('Tebak kata rahasia 5 huruf dalam 6 kesempatan.')
    .addIntegerOption(opt => opt.setName('taruhan').setDescription('Jumlah taruhan koin').setRequired(true)));

data.addSubcommand(sub => sub
    .setName('duel')
    .setDescription('\u2694\ufe0f Tantang temanmu adu cepat berhitung!')
    .addUserOption(opt => opt.setName('lawan').setDescription('Pilih pemain yang ingin ditantang').setRequired(true))
    .addIntegerOption(opt => opt.setName('taruhan').setDescription('Jumlah koin taruhan (opsional)').setRequired(false)));

// --- Asah otak ---
data.addSubcommand(sub => sub.setName('akinator').setDescription('\ud83e\uddde Naura menebak karakter yang ada di pikiranmu.'));
data.addSubcommand(sub => sub.setName('hangman').setDescription('\ud83d\udd24 Tebak kata klasik bersama Naura.'));
data.addSubcommand(sub => sub.setName('memory').setDescription('\ud83c\udfb4 Cocokkan pasangan emoji secepat mungkin.'));

data.addSubcommand(sub => sub
    .setName('tebakkata')
    .setDescription('\ud83d\udd20 Susun ulang huruf yang Naura acak.')
    .addStringOption(opt => opt.setName('kesulitan').setDescription('Tingkat Kesulitan').setRequired(true).addChoices(
        { name: '\ud83d\udfe2 Mudah', value: 'mudah' },
        { name: '\ud83d\udd34 Sulit', value: 'sulit' }
    )));

data.addSubcommand(sub => sub.setName('tebakgambar').setDescription('\ud83d\uddbc\ufe0f Tebak objek yang ada di dalam gambar.'));
data.addSubcommand(sub => sub.setName('tts').setDescription('\ud83d\udcdd Teka Teki Silang mini dari Naura.'));

data.addSubcommand(sub => sub
    .setName('tod')
    .setDescription('\ud83c\udfad Truth or Dare bareng teman-temanmu.')
    .addUserOption(opt => opt.setName('teman').setDescription('Pilih teman bermain (opsional)').setRequired(false)));

// --- Papan peringkat ---
data.addSubcommand(sub => sub
    .setName('leaderboard')
    .setDescription('\ud83c\udfc6 Lihat para jawara minigame Naura.')
    .addStringOption(opt => opt.setName('kategori').setDescription('Kategori Peringkat').setRequired(true).addChoices(
        { name: '\ud83e\uddee Matematika', value: 'math' },
        { name: '\ud83e\udde0 Trivia', value: 'trivia' },
        { name: '\u2694\ufe0f Duel Master', value: 'duel' }
    )));

module.exports = data;
