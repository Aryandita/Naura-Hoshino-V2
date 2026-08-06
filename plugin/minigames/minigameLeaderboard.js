// Papan peringkat minigame.
//
// Perbaikan penting dibanding versi lama:
// - Versi lama memanggil UserProfile.findAll() tanpa batas, memuat SELURUH
//   tabel profil ke memori, lalu menyaring dan mengurutkannya di Node. Sekarang
//   pengurutan dan pembatasan diserahkan ke basis data.
// - Fungsi penyaring lama tidak punya nilai kembalian untuk kategori tak
//   dikenal sehingga papan bisa kosong tanpa penjelasan.
// - NauraContainerBuilder di-require ulang di dalam blok padahal sudah diimpor
//   di bagian atas berkas.

const UserProfile = require('../../src/models/UserProfile');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { makeSendError } = require('./minigameCommon');

const LIMIT = 10;
const MEDALS = ['\ud83e\udd47', '\ud83e\udd48', '\ud83e\udd49'];

const CATEGORIES = {
    math: { column: 'minigame_mathScore', label: 'Matematika', unit: 'Poin', color: '#22c55e' },
    trivia: { column: 'minigame_triviaScore', label: 'Trivia', unit: 'Poin', color: '#0ea5e9' },
    duel: { column: 'minigame_duelScore', label: 'Duel Master', unit: 'Poin', color: '#ef4444' }
};

async function runLeaderboard(interaction) {
    const sendError = makeSendError(interaction);
    const key = interaction.options.getString('kategori');
    const category = CATEGORIES[key];

    if (!category) {
        return sendError('Kategori peringkat itu belum Naura kenal. Coba pilih Matematika, Trivia, atau Duel yaa~');
    }

    const rows = await UserProfile.findAll({
        order: [[category.column, 'DESC']],
        limit: LIMIT
    });

    const ranked = rows.filter(row => (row[category.column] || 0) > 0);

    if (ranked.length === 0) {
        return interaction.editReply(buildContainerV2({
            accentColorHex: '#f59e0b',
            expression: 'info',
            title: `Papan Peringkat ${category.label}`,
            description: 'Papannya masih kosong nih. Yuk jadi yang pertama mengisi namanya, Naura dukung kamu!',
            footerText: ui.getFooter('core')
        }));
    }

    const lines = await Promise.all(ranked.map(async (row, index) => {
        const medal = MEDALS[index] || `**${index + 1}.**`;
        let name = `Pemain ${row.userId}`;

        try {
            const fetched = await interaction.client.users.fetch(row.userId);
            name = fetched.username;
        } catch {
            // Pengguna mungkin sudah meninggalkan Discord; nama cadangan dipakai.
        }

        const score = Number(row[category.column] || 0).toLocaleString();
        return `${medal} **${name}** \u2014 ${score} ${category.unit}`;
    }));

    const myScore = Number((await UserProfile.findOne({ where: { userId: interaction.user.id } }))?.[category.column] || 0);

    return interaction.editReply(buildContainerV2({
        accentColorHex: category.color,
        expression: 'achievement',
        authorName: 'Papan Peringkat Minigame',
        iconURL: interaction.user.displayAvatarURL(),
        title: `Jawara ${category.label}`,
        description: `Ini dia para pemain terbaik pilihan Naura \u2728\n\n${lines.join('\n')}\n\n> Skormu saat ini: **${myScore.toLocaleString()}** ${category.unit}`,
        footerText: ui.getFooter('core')
    }));
}

module.exports = { runLeaderboard };
