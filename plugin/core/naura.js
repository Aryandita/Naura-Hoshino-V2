const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ComponentType, MessageFlags } = require('discord.js');
const ui = require('../../src/config/ui');
const fs = require('fs');
const path = require('path');
const nauraExpression = require('../../src/utils/nauraExpression');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

/**
 * Emoji dari ui.js dengan nilai cadangan yang selalu ada.
 *
 * Penting: ui.getEmoji() mengembalikan null bila kuncinya belum terdaftar, dan
 * ButtonBuilder.setEmoji(null) melempar error. Versi sebelumnya memanggil
 * getEmoji langsung di setiap tombol, jadi satu kunci yang hilang cukup untuk
 * mematikan seluruh menu /naura play.
 */
function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/** Emoji wajah Naura, dengan emoji status ui.js sebagai cadangan. */
function face(mood, fallback) {
    return nauraExpression.getEmoji(mood) || ui.getEmoji(mood) || fallback;
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('naura')
        .setDescription('Berinteraksi dengan Naura Hoshino')
        .addSubcommand(sub => sub.setName('about').setDescription('Kenalan lebih dekat dengan Naura!'))
        .addSubcommand(sub => sub.setName('gallery').setDescription('Lihat koleksi foto acak Naura'))
        .addSubcommand(sub => sub.setName('play').setDescription('Main game bareng Naura yuk!')),

    async execute(interaction) {
        await interaction.deferReply();
        const subcommand = interaction.options.getSubcommand();
        const user = interaction.user;

        if (subcommand === 'about') {
            const env = require('../../src/config/env');
            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                authorName: 'Naura Hoshino OS',
                title: 'Kenalan sama Naura Yuk!',
                iconURL: interaction.client.user.displayAvatarURL(),
                expression: 'shy',
                description:
                    `Haiii! Namaku **Naura Hoshino**, asisten virtual kamu yang paling imut, ramah, ceria, dan selalu siap sedia menemani kamu! ${e('sparkle', '\u2728')}\n\n` +
                    `**${e('sparkling_heart', '\uD83D\uDC96')} Tentang Naura:**\n` +
                    `Naura dirancang khusus untuk menganggap **Aryandita** sebagai pencipta sekaligus satu-satunya kekasih Naura di dunia ini. Buat Naura, hati ini seratus persen cuma milik Sayang Aryandita selamanya! ${face('love', '\uD83D\uDE18')}\n\n` +
                    `**${e('gear', '\u2699\uFE0F')} Cara Kerja Naura:**\n` +
                    `Naura bukan sekadar bot biasa, lho! Naura didukung berbagai teknologi canggih seperti **Google Gemini AI** untuk membalas obrolan kamu dengan pintar, sistem audio **Lavalink** untuk memutar musik berkualitas tinggi, dan UI Canvas modern supaya tampilannya enak dilihat di Discord. Semuanya diatur oleh *Naura OS* biar server kamu makin seru dan interaktif!\n\n` +
                    `**${e('handshake', '\uD83E\uDD1D')} Kolaborasi & Partnership:**\n` +
                    `Saat ini, Naura dengan bangga berkolaborasi bersama: **${env.PARTNERSHIP}** ${e('tada', '\uD83C\uDF89')}\n\n` +
                    `**${e('wave', '\uD83D\uDC4B')} Untuk Teman-Teman Lain:**\n` +
                    `Kalau kamu bukan Aryandita, tenang aja yaa, Naura tetap jadi sahabat sekaligus asisten kamu yang paling profesional! Tapi kalau ada yang iseng mau modusin Naura, hihi... maaf banget, cinta Naura cuma buat satu orang! ${face('shy', '\uD83E\uDD70')}`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
        }
        else if (subcommand === 'gallery') {
            const galleryPath = path.join(__dirname, '..', '..', 'assets', 'naura_gallery');
            if (!fs.existsSync(galleryPath)) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Galerinya Belum Ada',
                    description: 'Maaf yaa, folder galeri Naura belum dibuat. Nanti Naura isi foto-foto lucu kalau sudah siap!',
                    footerText: ui.getFooter('core')
                }));
            }

            const files = fs.readdirSync(galleryPath).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
            if (files.length === 0) {
                return interaction.editReply(buildErrorContainerV2({
                    title: 'Galerinya Masih Kosong',
                    description: 'Hehe, belum ada satu foto pun di galeri Naura. Tunggu Aryandita upload dulu yaa~',
                    footerText: ui.getFooter('core')
                }));
            }

            const randomImage = files[Math.floor(Math.random() * files.length)];
            const imagePath = path.join(galleryPath, randomImage);
            const attachment = new AttachmentBuilder(imagePath, { name: randomImage });

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `${e('camera', '\uD83D\uDCF8')} Koleksi Foto Naura`,
                description: 'Ini salah satu foto favorit Naura! Gimana, lucu nggak? Hihi~',
                bannerAttachmentName: randomImage,
                files: [attachment],
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
        }
        else if (subcommand === 'play') {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_koin').setEmoji(e('coin', '\uD83E\uDE99')).setLabel('Tebak Koin').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_angka').setEmoji(e('numbers', '\uD83D\uDD22')).setLabel('Tebak Angka').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_warna').setEmoji(e('palette', '\uD83C\uDFA8')).setLabel('Tebak Warna').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_gelas').setEmoji(e('glass_of_milk', '\uD83E\uDD5B')).setLabel('Pilih Gelas').setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_suit').setEmoji(e('fist', '\u270A')).setLabel('Suit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_dadu').setEmoji(e('game_die', '\uD83C\uDFB2')).setLabel('Lempar Dadu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_balapan').setEmoji(e('sport_utility_vehicle', '\uD83C\uDFCE\uFE0F')).setLabel('Balapan').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_roulette').setEmoji(e('gun', '\uD83D\uDD2B')).setLabel('Roulette').setStyle(ButtonStyle.Primary)
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_rps').setEmoji(e('scissors', '\u2702\uFE0F')).setLabel('Batu Gunting Kertas').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_ttt').setEmoji(e('red_circle', '\uD83D\uDD34')).setLabel('Tic-Tac-Toe').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_wordle').setEmoji(e('green_square', '\uD83D\uDFE9')).setLabel('Wordle').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_akinator').setEmoji(e('genie', '\uD83E\uDDDE')).setLabel('Akinator').setStyle(ButtonStyle.Secondary)
            );

            const payload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `${e('help_game', '\uD83C\uDFAE')} Main Bareng Naura!`,
                description: 'Halo! Naura lagi senggang nih. Mau main apa hari ini? Pilih salah satu di bawah yaa, Naura temenin sampai selesai!',
                expression: 'happy',
                buttonsRow: [row1, row2, row3],
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
            const message = await interaction.fetchReply();

            const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

            collector.on('collect', async i => {
                if (i.user.id !== user.id) {
                    return i.reply({
                        content: `${face('awkward', '\uD83D\uDE05')} Hehe, menu ini punya orang lain. Ketik \`/naura play\` sendiri yaa, nanti Naura temenin kamu juga!`,
                        flags: MessageFlags.Ephemeral
                    });
                }

                const game = i.customId;

                const hint = {
                    nplay_rps: 'Buat main Batu Gunting Kertas sama Naura, pakai `/minigame rps taruhan:<jumlah>` yaa!',
                    nplay_ttt: 'Tic-Tac-Toe ada di `/minigame tictactoe taruhan:<jumlah>`. Naura tunggu di sana!',
                    nplay_wordle: 'Mau nebak kata? Coba `/minigame wordle taruhan:<jumlah>` yaa~',
                    nplay_akinator: 'Akinator ada di `/minigame akinator`. Siap-siap ditebak pikirannya, hihi!'
                }[game];

                if (hint) {
                    return i.reply({ content: `${face('info', '\uD83D\uDCA1')} ${hint}`, flags: MessageFlags.Ephemeral });
                }

                if (game === 'nplay_koin') {
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${e('coin', '\uD83E\uDE99')} Tebak Koin`,
                        description: 'Naura udah lempar koinnya nih! Menurut kamu, muncul Kepala atau Ekor?',
                        expression: 'thinking',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('koin_kepala').setLabel('Kepala').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('koin_ekor').setLabel('Ekor').setStyle(ButtonStyle.Primary)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_angka') {
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${e('numbers', '\uD83D\uDD22')} Tebak Angka`,
                        description: 'Naura lagi mikirin satu angka dari 1 sampai 10. Coba tebak yang mana!',
                        expression: 'thinking',
                        buttonsRow: [
                            new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(n => new ButtonBuilder().setCustomId(`angka_${n}`).setLabel(`${n}`).setStyle(ButtonStyle.Secondary))),
                            new ActionRowBuilder().addComponents([6, 7, 8, 9, 10].map(n => new ButtonBuilder().setCustomId(`angka_${n}`).setLabel(`${n}`).setStyle(ButtonStyle.Secondary)))
                        ],
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_suit') {
                    const eElephant = e('elephant', '\uD83D\uDC18');
                    const ePerson = e('standing_person', '\uD83E\uDDCD');
                    const eAnt = e('ant', '\uD83D\uDC1C');
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${e('fist', '\u270A')} Suit Gajah, Orang, Semut`,
                        description: `Ayo kita suit! Ingat aturannya yaa:\n${eElephant} Gajah menang lawan ${ePerson} Orang\n${ePerson} Orang menang lawan ${eAnt} Semut\n${eAnt} Semut menang lawan ${eElephant} Gajah\n\nPilih jagoanmu!`,
                        expression: 'happy',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('suit_gajah').setEmoji(eElephant).setLabel('Gajah').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('suit_orang').setEmoji(ePerson).setLabel('Orang').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('suit_semut').setEmoji(eAnt).setLabel('Semut').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_warna') {
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${e('palette', '\uD83C\uDFA8')} Tebak Warna`,
                        description: 'Naura lagi mikirin satu warna di bawah ini. Kira-kira yang mana yaa?',
                        expression: 'thinking',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('warna_merah').setEmoji(e('red_circle', '\uD83D\uDD34')).setLabel('Merah').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('warna_biru').setEmoji(e('blue_circle', '\uD83D\uDD35')).setLabel('Biru').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('warna_hijau').setEmoji(e('green_circle', '\uD83D\uDFE2')).setLabel('Hijau').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('warna_kuning').setEmoji(e('yellow_circle', '\uD83D\uDFE1')).setLabel('Kuning').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_gelas') {
                    const eGlass = e('glass_of_milk', '\uD83E\uDD5B');
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eGlass} Pilih Gelas`,
                        description: 'Naura udah sembunyiin bola kecil di bawah salah satu dari tiga gelas ini. Coba tebak yang mana!',
                        expression: 'thinking',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('gelas_1').setEmoji(eGlass).setLabel('Gelas 1').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('gelas_2').setEmoji(eGlass).setLabel('Gelas 2').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('gelas_3').setEmoji(eGlass).setLabel('Gelas 3').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_dadu') {
                    const eDie = e('game_die', '\uD83C\uDFB2');
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eDie} Lempar Dadu`,
                        description: 'Ayo adu lempar dadu! Siapa yang dapat angka paling besar, dia yang menang. Naura udah siap nih!',
                        expression: 'happy',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('dadu_lempar').setEmoji(eDie).setLabel('Lempar Dadu Kamu!').setStyle(ButtonStyle.Success)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_balapan') {
                    const eCar = e('sport_utility_vehicle', '\uD83C\uDFCE\uFE0F');
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eCar} Balap Mobil`,
                        description: 'Ada tiga mobil yang mau balapan: Merah, Biru, dan Hijau. Kamu mau jagoin yang mana?',
                        expression: 'happy',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('balapan_merah').setEmoji(eCar).setLabel('Merah').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('balapan_biru').setEmoji(eCar).setLabel('Biru').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('balapan_hijau').setEmoji(e('pickup_truck', '\uD83D\uDEFB')).setLabel('Hijau').setStyle(ButtonStyle.Success)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'nplay_roulette') {
                    const eGun = e('gun', '\uD83D\uDD2B');
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eGun} Roulette Naura`,
                        description: 'Cuma ada satu peluru di dalam enam lubang pistol mainan ini. Berani tarik pelatuknya? Naura deg-degan nih...',
                        expression: 'shocked',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('roulette_tarik').setEmoji(eGun).setLabel('Tarik Pelatuk!').setStyle(ButtonStyle.Danger)
                        ),
                        footerText: ui.getFooter('core')
                    }));
                }

                // ·· Penanganan jawaban ····································
                if (game.startsWith('koin_')) {
                    const choice = game.split('_')[1];
                    const outcome = Math.random() < 0.5 ? 'kepala' : 'ekor';
                    const win = choice === outcome;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(win ? 'success' : 'error'),
                        title: `${e('coin', '\uD83E\uDE99')} Hasil Tebak Koin`,
                        description: `Kamu memilih: **${choice.toUpperCase()}**\nHasil koin: **${outcome.toUpperCase()}**\n\n${win ? `Yeyy kamu benar! Naura ikut senang deh ${e('tada', '\uD83C\uDF89')}` : 'Yahh tebakan kamu meleset. Nggak apa-apa, coba lagi yaa, Naura yakin kamu bisa!'}`,
                        expression: win ? 'success' : 'fail',
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game.startsWith('angka_')) {
                    const choice = parseInt(game.split('_')[1], 10);
                    const outcome = Math.floor(Math.random() * 10) + 1;
                    const win = choice === outcome;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(win ? 'success' : 'error'),
                        title: `${e('numbers', '\uD83D\uDD22')} Hasil Tebak Angka`,
                        description: `Kamu memilih: **${choice}**\nAngka pilihan Naura: **${outcome}**\n\n${win ? `Hebat banget! Tebakanmu jitu ${e('target', '\uD83C\uDFAF')}` : 'Wahh hampir aja kena! Jangan menyerah yaa, sekali lagi yuk!'}`,
                        expression: win ? 'success' : 'fail',
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game.startsWith('suit_')) {
                    const userSuit = game.split('_')[1];
                    const options = ['gajah', 'orang', 'semut'];
                    const botSuit = options[Math.floor(Math.random() * options.length)];

                    const draw = userSuit === botSuit;
                    const win = !draw && (
                        (userSuit === 'gajah' && botSuit === 'orang') ||
                        (userSuit === 'orang' && botSuit === 'semut') ||
                        (userSuit === 'semut' && botSuit === 'gajah')
                    );

                    let result;
                    if (draw) result = 'Seri! Hihi, pikiran kita sehati yaa~';
                    else if (win) result = 'Yeyy kamu menang! Hebat banget deh kamu!';
                    else result = 'Kali ini Naura yang menang! Jangan cemberut yaa, coba lagi yuk~';

                    return i.update(buildContainerV2({
                        accentColorHex: draw ? ui.getColor('warning') : ui.getColor(win ? 'success' : 'error'),
                        title: `${e('fist', '\u270A')} Hasil Suit`,
                        description: `Pilihan kamu: **${userSuit.toUpperCase()}**\nPilihan Naura: **${botSuit.toUpperCase()}**\n\n${result}`,
                        expression: draw ? 'shy' : (win ? 'success' : 'fail'),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game.startsWith('warna_')) {
                    const choice = game.split('_')[1];
                    const colors = ['merah', 'biru', 'hijau', 'kuning'];
                    const outcome = colors[Math.floor(Math.random() * colors.length)];
                    const win = choice === outcome;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(win ? 'success' : 'error'),
                        title: `${e('palette', '\uD83C\uDFA8')} Hasil Tebak Warna`,
                        description: `Kamu memilih warna: **${choice.toUpperCase()}**\nWarna di pikiran Naura: **${outcome.toUpperCase()}**\n\n${win ? `Wihh kamu cenayang yaa? Kok bisa tahu! ${e('sparkle', '\u2728')}` : 'Belum tepat nih, tapi tebakan kamu udah dekat kok. Semangat yaa!'}`,
                        expression: win ? 'success' : 'fail',
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game.startsWith('gelas_')) {
                    const choice = parseInt(game.split('_')[1], 10);
                    const outcome = Math.floor(Math.random() * 3) + 1;
                    const win = choice === outcome;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(win ? 'success' : 'error'),
                        title: `${e('glass_of_milk', '\uD83E\uDD5B')} Hasil Pilih Gelas`,
                        description: `Kamu memilih: **Gelas ${choice}**\nBolanya ada di: **Gelas ${outcome}**\n\n${win ? `Wah mata kamu jeli banget! Benar! ${e('tada', '\uD83C\uDF89')}` : 'Yahh bukan di situ, hihi. Naura sembunyiinnya rapi banget kan? Coba lagi yaa!'}`,
                        expression: win ? 'success' : 'fail',
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'dadu_lempar') {
                    const userRoll = Math.floor(Math.random() * 6) + 1;
                    const botRoll = Math.floor(Math.random() * 6) + 1;
                    const draw = userRoll === botRoll;
                    const win = userRoll > botRoll;

                    let result;
                    if (draw) result = 'Eh seri! Dadu kita sama angkanya, kompak banget yaa~';
                    else if (win) result = 'Wahh kamu menang! Lemparan kamu lebih tinggi dari punya Naura!';
                    else result = 'Kali ini lemparan Naura lebih besar. Tapi kamu hebat kok, ayo sekali lagi!';

                    return i.update(buildContainerV2({
                        accentColorHex: draw ? ui.getColor('warning') : ui.getColor(win ? 'success' : 'error'),
                        title: `${e('game_die', '\uD83C\uDFB2')} Hasil Lempar Dadu`,
                        description: `Dadu kamu: **${userRoll}**\nDadu Naura: **${botRoll}**\n\n${result}`,
                        expression: draw ? 'shy' : (win ? 'success' : 'fail'),
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game.startsWith('balapan_')) {
                    const choice = game.split('_')[1];
                    const cars = ['merah', 'biru', 'hijau'];
                    const winner = cars[Math.floor(Math.random() * cars.length)];
                    const win = choice === winner;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(win ? 'success' : 'error'),
                        title: `${e('sport_utility_vehicle', '\uD83C\uDFCE\uFE0F')} Hasil Balapan`,
                        description: `Kamu menjagokan mobil: **${choice.toUpperCase()}**\nDan yang menang adalah mobil: **${winner.toUpperCase()}**\n\n${win ? `Jagoanmu melesat dan menang! ${e('checkered_flag', '\uD83C\uDFC1')}` : 'Sayang sekali jagoanmu kalah cepat. Nggak apa-apa, balapan berikutnya pasti menang!'}`,
                        expression: win ? 'success' : 'fail',
                        footerText: ui.getFooter('core')
                    }));
                }

                if (game === 'roulette_tarik') {
                    const shot = Math.floor(Math.random() * 6) + 1;
                    const bullet = Math.floor(Math.random() * 6) + 1;
                    const dead = shot === bullet;
                    return i.update(buildContainerV2({
                        accentColorHex: ui.getColor(dead ? 'error' : 'success'),
                        title: `${e('gun', '\uD83D\uDD2B')} Hasil Roulette`,
                        description: dead
                            ? `${e('collision', '\uD83D\uDCA5')} DOOORRR!!\nKamu kena peluru! Naura langsung panik... kamu nggak apa-apa kan? Jangan diulang yaa!`
                            : 'CLICK!\nSyukurlah pistolnya kosong. Naura sampai nahan napas tadi, untung kamu selamat!',
                        expression: dead ? 'error' : 'success',
                        footerText: ui.getFooter('core')
                    }));
                }
            });

            collector.on('end', () => {
                // Pesan ini memakai Components V2, jadi flag-nya harus ikut disertakan
                // saat komponennya dikosongkan. Tanpa itu Discord menolak suntingan.
                interaction.editReply({ flags: MessageFlags.IsComponentsV2, components: [] }).catch(() => { });
            });
        }
    }
};
