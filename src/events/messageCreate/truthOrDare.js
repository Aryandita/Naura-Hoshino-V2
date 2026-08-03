const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags } = require('discord.js');
const ui = require('../../config/ui');
const { logger } = require('../../managers/logger');
const gemini = require('./gemini');

const SESSION_MS = 60000;

const FALLBACK_TRUTHS = [
    'Apa rahasia terbesar yang belum pernah kamu ceritakan ke siapa pun di server ini?',
    'Kapan terakhir kali kamu menangis, dan apa penyebabnya?',
    'Siapa orang yang diam-diam kamu sukai di server Discord ini?',
    'Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?',
    'Kalau bisa bertukar tubuh dengan salah satu temanmu selama sehari, kamu pilih siapa dan kenapa?'
];

const FALLBACK_DARES = [
    'Kirim voice note nyanyi bagian chorus lagu favoritmu di chat umum sekarang juga!',
    "Ganti nickname Discord-mu jadi 'Hamba Sahaya Naura' selama 24 jam ke depan!",
    'Pakai foto profil badut lucu selama tiga hari berturut-turut!',
    'Kirim pesan gombal ke salah satu bot di server ini, lalu screenshot balasannya!',
    'Tirukan suara hewan lewat voice note, lalu kirim ke grup!'
];

function pick(list) {
    return list[Math.floor(Math.random() * list.length)];
}

function choiceRow(playerId) {
    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`tod_chan_truth_${playerId}`).setLabel('Truth').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('read') || '\uD83D\uDCDD'),
        new ButtonBuilder().setCustomId(`tod_chan_dare_${playerId}`).setLabel('Dare').setStyle(ButtonStyle.Danger).setEmoji(ui.getEmoji('hmph') || '\uD83D\uDE08'),
        new ButtonBuilder().setCustomId(`tod_chan_spin_${playerId}`).setLabel('Spin').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('chirping') || '\uD83D\uDD04')
    );
}

module.exports = async function handleTruthOrDare(message, client, ctx) {
    const channelId = ctx.guildChannels.tod;
    if (!channelId || message.channel.id !== channelId) return false;

    await message.delete().catch(() => {});

    let currentPlayerId = message.author.id;

    const intro = new EmbedBuilder()
        .setColor(ui.getColor('primary') || '#FFB6C1')
        .setTitle(`${ui.getEmoji('happy') || '\uD83C\uDFAD'} Truth or Dare bareng Naura!`)
        .setDescription(
            `Hai <@${currentPlayerId}>! Naura udah siap jadi wasitnya, hihi.\n\n` +
            'Pilih salah satu tombol di bawah buat mulai tantanganmu, yaa!'
        )
        .setThumbnail(message.author.displayAvatarURL());

    const board = await message.channel.send({ embeds: [intro], components: [choiceRow(currentPlayerId)] });

    const collector = board.createMessageComponentCollector({
        filter: i => i.customId.startsWith('tod_chan_'),
        time: SESSION_MS
    });

    collector.on('collect', async i => {
        if (i.user.id !== currentPlayerId) {
            return i.reply({
                content: `${ui.getEmoji('akward') || '\u274C'} Tombol ini punya <@${currentPlayerId}>, yaa. Sabar sebentar!`,
                flags: MessageFlags.Ephemeral
            });
        }

        await i.deferUpdate();

        // Penting: cabang selesai/giliran-baru harus diperiksa lebih dulu.
        // Keduanya juga berawalan tod_chan_, jadi kalau dibiarkan jatuh ke
        // bawah, tombol Selesai akan ikut dianggap sebagai Dare.
        if (i.customId.startsWith('tod_chan_done_')) {
            const done = new EmbedBuilder()
                .setColor(ui.getColor('success') || '#2ecc71')
                .setTitle(`${ui.getEmoji('cheers') || '\uD83C\uDF89'} Tantangan selesai!`)
                .setDescription(`Hebat banget, <@${currentPlayerId}>! Naura bangga sama kamu.\n\nMau lanjut satu ronde lagi?`);

            return i.editReply({
                embeds: [done],
                components: [new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`tod_chan_next_${currentPlayerId}`).setLabel('Main lagi').setStyle(ButtonStyle.Primary)
                )]
            });
        }

        if (i.customId.startsWith('tod_chan_next_')) {
            const again = new EmbedBuilder()
                .setColor(ui.getColor('primary') || '#FFB6C1')
                .setTitle(`${ui.getEmoji('happy') || '\uD83C\uDFAD'} Ronde baru!`)
                .setDescription(`Giliran <@${currentPlayerId}> lagi. Mau **Truth** atau **Dare**?`)
                .setThumbnail(i.user.displayAvatarURL());

            return i.editReply({ embeds: [again], components: [choiceRow(currentPlayerId)] });
        }

        if (i.customId.startsWith('tod_chan_spin_')) {
            let chosen = i.user;
            try {
                const members = await message.guild.members.fetch();
                const candidates = members.filter(m => !m.user.bot && m.user.id !== currentPlayerId);
                if (candidates.size > 0) chosen = candidates.random().user;
            } catch (err) {
                logger.error('[TOD Spin Error]', err);
            }

            currentPlayerId = chosen.id;

            const spun = new EmbedBuilder()
                .setColor(ui.getColor('primary') || '#FFB6C1')
                .setTitle(`${ui.getEmoji('shocked') || '\uD83D\uDD04'} Botolnya berhenti!`)
                .setDescription(`Waah, botolnya nunjuk <@${currentPlayerId}>!\n\nSekarang giliran kamu pilih **Truth** atau **Dare**, yaa!`)
                .setThumbnail(chosen.displayAvatarURL());

            return i.editReply({ embeds: [spun], components: [choiceRow(currentPlayerId)] });
        }

        const isTruth = i.customId.startsWith('tod_chan_truth_');
        const label = isTruth ? 'Truth' : 'Dare';
        const labelEmoji = isTruth ? (ui.getEmoji('read') || '\uD83D\uDCDD') : (ui.getEmoji('hmph') || '\uD83D\uDE08');

        await i.editReply({
            embeds: [new EmbedBuilder()
                .setColor(ui.getColor('primary') || '#FFB6C1')
                .setDescription(`${ui.getEmoji('thinking') || '\u23F3'} Bentar yaa, Naura lagi mikirin ${label} yang seru buat kamu...`)],
            components: []
        });

        const prompt = isTruth
            ? 'Buatkan 1 pertanyaan Truth yang memalukan, lucu, dan seru untuk dijawab di depan teman-teman. Jawab hanya teks pertanyaannya dalam Bahasa Indonesia, tanpa tambahan apa pun.'
            : 'Buatkan 1 tantangan Dare yang lucu, konyol, aman, dan menghibur. Jawab hanya teks tantangannya dalam Bahasa Indonesia, tanpa tambahan apa pun.';

        let challenge = null;
        try {
            challenge = await gemini.generateText(prompt);
        } catch (err) {
            logger.error('[TOD Gemini Error]', err);
        }
        if (!challenge) challenge = pick(isTruth ? FALLBACK_TRUTHS : FALLBACK_DARES);

        const player = await i.client.users.fetch(currentPlayerId).catch(() => i.user);
        const card = new EmbedBuilder()
            .setColor(isTruth ? (ui.getColor('success') || '#2ecc71') : (ui.getColor('error') || '#e74c3c'))
            .setAuthor({ name: `${label} untuk ${player.username}`, iconURL: player.displayAvatarURL() })
            .setDescription(`### ${labelEmoji} ${label}\n\n> **${challenge}**`)
            .setFooter({ text: 'Kalau sudah selesai, pencet tombolnya yaa!' });

        return i.editReply({
            embeds: [card],
            components: [new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`tod_chan_done_${currentPlayerId}`).setLabel('Selesai').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`tod_chan_next_${currentPlayerId}`).setLabel('Giliran baru').setStyle(ButtonStyle.Primary)
            )]
        });
    });

    collector.on('end', () => {
        board.delete().catch(() => {});
    });

    return true;
};
