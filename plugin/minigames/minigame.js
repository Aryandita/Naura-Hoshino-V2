// Orkestrator /minigame.
//
// Berkas ini dulu berukuran sekitar 68 KB dan memuat seluruh logika permainan
// sekaligus. Sekarang tugasnya hanya mengarahkan subcommand ke modulnya.
//
// Perbaikan penting dibanding versi lama:
// - Mock interaction jalur prefix hanya berupa objek biasa sehingga tidak
//   terjangkau penambal prototipe localePatch. Akibatnya `interaction.localeLang`
//   selalu undefined pada jalur prefix. Sekarang properti bahasa disalin dari
//   objek Message yang memang sudah tertambal.
// - Galat tak tertangani hanya masuk ke log tanpa balasan apa pun ke pemain.

const UserProfile = require('../../src/models/UserProfile');
const ui = require('../../src/config/ui');
const { logger } = require('../../src/managers/logger');
const { buildErrorContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const data = require('./minigameCommand');
const { runTrivia, runMath } = require('./minigameQuiz');
const { runRps, runTicTacToe } = require('./minigameRps');
const { runWordle } = require('./minigameWordle');
const { runDuel } = require('./minigameDuel');
const { runAkinator } = require('./minigameAkinator');
const { runHangman, runMemory } = require('./minigameClassic');
const { runTebakKata, runTebakGambar, runTts } = require('./minigameGuess');
const { runTod } = require('./minigameTod');
const { runLeaderboard } = require('./minigameLeaderboard');

const HANDLERS = {
    math: runMath,
    trivia: runTrivia,
    rps: runRps,
    tictactoe: runTicTacToe,
    wordle: runWordle,
    duel: runDuel,
    akinator: runAkinator,
    hangman: runHangman,
    memory: runMemory,
    tebakkata: runTebakKata,
    tebakgambar: runTebakGambar,
    tts: runTts,
    tod: runTod,
    leaderboard: runLeaderboard
};

const SUBCOMMANDS = Object.keys(HANDLERS);

function loadingPayload() {
    return buildLoadingContainerV2({
        title: 'Naura Loading System...',
        description: 'Sebentar yaa, Naura sedang menyiapkan permainannya~',
        footerText: ui.getFooter('core')
    });
}

function errorPayload(description) {
    return buildErrorContainerV2({
        title: 'Maaf yaa~',
        description,
        footerText: ui.getFooter('core')
    });
}

async function runSubcommand(interaction, sub) {
    const handler = HANDLERS[sub];

    if (!handler) {
        return interaction.editReply(errorPayload(`Naura belum punya permainan bernama **${sub}**. Coba salah satu dari: ${SUBCOMMANDS.join(', ')}.`));
    }

    const [profile] = await UserProfile.findOrCreate({ where: { userId: interaction.user.id } });

    try {
        await handler(interaction, profile);
    } catch (error) {
        logger.error(`[Minigame] Subcommand ${sub} gagal: ${error.stack || error.message}`);
        await interaction.editReply(errorPayload('Aduh, ada yang tersandung di sistem Naura. Coba lagi sebentar lagi yaa~')).catch(() => { });
    }
}

async function execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
        await interaction.deferReply();
    }

    return runSubcommand(interaction, interaction.options.getSubcommand());
}

/**
 * Bungkus objek Message agar bisa dipakai modul yang menerima interaction.
 * Properti bahasa disalin dari Message yang sudah ditambal localePatch.
 */
function createMockInteraction(message, args) {
    const numbers = args.filter(a => /^\d+$/.test(a)).map(Number);
    const mentions = [...message.mentions.users.values()];
    const words = args.filter(a => !/^\d+$/.test(a) && !/^<@!?\d+>$/.test(a));

    let replyMessage = null;

    const mock = {
        user: message.author,
        member: message.member,
        guild: message.guild,
        guildId: message.guildId,
        channel: message.channel,
        client: message.client,
        deferred: false,
        replied: false,

        localeLang: message.localeLang,
        lang: message.lang,
        t: (key, placeholders) => message.t(key, placeholders),
        fetchLang: () => message.fetchLang(),

        options: {
            getSubcommand: () => words[0],
            getString: () => words[1] || null,
            getInteger: () => (numbers.length > 0 ? numbers[0] : null),
            getUser: () => mentions[0] || null
        },

        async deferReply() {
            this.deferred = true;
            replyMessage = await message.reply(loadingPayload());
            return replyMessage;
        },

        async editReply(payload) {
            if (!replyMessage) {
                replyMessage = await message.reply(payload);
                return replyMessage;
            }
            return replyMessage.edit(payload);
        },

        async fetchReply() {
            return replyMessage;
        },

        async followUp(payload) {
            return message.channel.send(payload);
        }
    };

    return mock;
}

async function executePrefix(message, args) {
    const sub = String(args[0] || '').toLowerCase();

    if (!sub || !HANDLERS[sub]) {
        return message.reply(errorPayload(`Mau main apa nih? Pilih salah satu yaa~\n\n> ${SUBCOMMANDS.join(', ')}`)).catch(() => { });
    }

    const normalized = [sub, ...args.slice(1)];
    const mock = createMockInteraction(message, normalized);

    await mock.deferReply();
    return runSubcommand(mock, sub);
}

module.exports = { data, execute, executePrefix };
