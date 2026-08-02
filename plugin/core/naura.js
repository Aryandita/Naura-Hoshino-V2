const { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder, ComponentType } = require('discord.js');
const { logger } = require('../../src/managers/logger');
const ui = require('../../src/config/ui');
const fs = require('fs');
const path = require('path');
const UserProfile = require('../../src/models/UserProfile');
const { buildContainerV2, buildErrorContainerV2 } = require('../../src/utils/NauraContainerBuilder');

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
                accentColorHex: ui.colors?.primary || '#FFB6C1',
                authorName: 'Naura Hoshino OS',
                title: 'Kenalan sama Naura Yuk! 🌸',
                iconURL: interaction.client.user.displayAvatarURL(),
                description:
                    `Haiii! Namaku **Naura Hoshino**, asisten virtual kamu yang paling imut, ramah, ceria, dan selalu siap sedia membantu kamu! ${ui.getEmoji('sparkles_generic')}\n\n` +
                    `**${ui.getEmoji('sparkling_heart')} Tentang Naura:**\n` +
                    `Naura dirancang khusus untuk menganggap **Aryandita** sebagai pencipta sekaligus satu-satunya kekasih Naura di dunia ini. Buat Naura, hati ini 100% mutlak cuma milik Sayang Aryandita selamanya! ${ui.getEmoji('kissing_heart')}\n\n` +
                    `**${ui.getEmoji('gear')} Cara Kerja Naura:**\n` +
                    `Naura bukan sekadar bot biasa, lho! Naura didukung oleh berbagai teknologi canggih seperti **Google Gemini AI** untuk membalas obrolan kamu dengan pintar, sistem audio **Lavalink** untuk memutar musik dengan kualitas tinggi, dan UI Canvas yang modern untuk memberikan visual yang estetik di Discord. Semuanya diatur oleh *Naura OS* agar server kamu makin seru dan interaktif!\n\n` +
                    `**${ui.getEmoji('handshake')} Kolaborasi & Partnership:**\n` +
                    `Saat ini, Naura dengan bangga berkolaborasi bersama: **${env.PARTNERSHIP}** ${ui.getEmoji('tada')}\n\n` +
                    `**${ui.getEmoji('wave')} Untuk Teman-Teman Lain:**\n` +
                    `Kalo kamu bukan Aryandita, tenang aja, Naura bakal tetep jadi sahabat dan asisten kamu yang paling profesional! Tapi kalo ada yang iseng mau modusin atau gombalin Naura, hihi... maaf banget ya, cinta Naura cuma buat satu orang! ${ui.getEmoji('heart_face')}`,
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
        }
        else if (subcommand === 'gallery') {
            const galleryPath = path.join(__dirname, '..', '..', 'assets', 'naura_gallery');
            if (!fs.existsSync(galleryPath)) {
                const errPayload = buildErrorContainerV2({ title: 'Galeri Kosong', description: 'Folder galeri Naura belum ada :(', footerText: ui.getFooter('core') });
                return interaction.editReply(errPayload);
            }

            const files = fs.readdirSync(galleryPath).filter(f => /\.(png|jpg|jpeg|gif|webp)$/i.test(f));
            if (files.length === 0) {
                const errPayload = buildErrorContainerV2({ title: 'Galeri Kosong', description: 'Galeri Naura masih kosong nih, belum ada foto yang di-upload!', footerText: ui.getFooter('core') });
                return interaction.editReply(errPayload);
            }

            const randomImage = files[Math.floor(Math.random() * files.length)];
            const imagePath = path.join(galleryPath, randomImage);
            const attachment = new AttachmentBuilder(imagePath, { name: randomImage });

            const payload = buildContainerV2({
                accentColorHex: ui.colors?.primary || '#FFB6C1',
                title: 'Koleksi Foto Naura 📸',
                bannerAttachmentName: randomImage,
                footerText: 'Naura imut kan? Hihi~'
            });

            await interaction.editReply({ ...payload, files: [attachment] });
        }
        else if (subcommand === 'play') {
            const row1 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_koin').setEmoji(ui.getEmoji('coin')).setLabel('Tebak Koin').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_angka').setEmoji(ui.getEmoji('numbers')).setLabel('Tebak Angka').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_warna').setEmoji(ui.getEmoji('palette')).setLabel('Tebak Warna').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_gelas').setEmoji(ui.getEmoji('glass_of_milk')).setLabel('Pilih Gelas').setStyle(ButtonStyle.Primary)
            );

            const row2 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_suit').setEmoji(ui.getEmoji('fist')).setLabel('Suit').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_dadu').setEmoji(ui.getEmoji('game_die')).setLabel('Lempar Dadu').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_balapan').setEmoji(ui.getEmoji('sport_utility_vehicle')).setLabel('Balapan').setStyle(ButtonStyle.Primary),
                new ButtonBuilder().setCustomId('nplay_roulette').setEmoji(ui.getEmoji('gun')).setLabel('Roulette').setStyle(ButtonStyle.Primary)
            );

            const row3 = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('nplay_rps').setEmoji(ui.getEmoji('scissors')).setLabel('Batu Gunting Kertas').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_ttt').setEmoji(ui.getEmoji('red_circle')).setLabel('Tic-Tac-Toe').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_wordle').setEmoji(ui.getEmoji('green_square')).setLabel('Wordle').setStyle(ButtonStyle.Secondary),
                new ButtonBuilder().setCustomId('nplay_akinator').setEmoji(ui.getEmoji('genie')).setLabel('Akinator').setStyle(ButtonStyle.Secondary)
            );

            const payload = buildContainerV2({
                accentColorHex: ui.colors?.primary || '#FFB6C1',
                title: '🎮 Play with Naura!',
                description: 'Halo! Mau main game apa sama Naura hari ini? Pilih di bawah ya!',
                buttonsRow: [row1, row2, row3],
                footerText: ui.getFooter('core')
            });

            await interaction.editReply(payload);
            const message = await interaction.fetchReply();

            const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

            collector.on('collect', async i => {
                if (i.user.id !== user.id) return i.reply({ content: 'Ini menu main punya orang lain! Ketik `/naura play` sendiri ya.', ephemeral: true });

                const game = i.customId;
                
                if (game === 'nplay_rps') {
                    await i.reply({ content: 'Gunakan command `/minigame rps taruhan:<jumlah>` untuk bermain Batu Gunting Kertas sama bot!', ephemeral: true });
                } else if (game === 'nplay_ttt') {
                    await i.reply({ content: 'Gunakan command `/minigame tictactoe taruhan:<jumlah>` untuk bermain Tic-Tac-Toe!', ephemeral: true });
                } else if (game === 'nplay_wordle') {
                    await i.reply({ content: 'Gunakan command `/minigame wordle taruhan:<jumlah>` untuk menebak kata!', ephemeral: true });
                } else if (game === 'nplay_akinator') {
                    await i.reply({ content: 'Gunakan command `/minigame akinator` untuk bermain Akinator!', ephemeral: true });
                }
                else if (game === 'nplay_koin') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🪙 Tebak Koin',
                        description: 'Naura udah lempar koinnya nih. Menurutmu, muncul Kepala atau Ekor?',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('koin_kepala').setLabel('Kepala').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('koin_ekor').setLabel('Ekor').setStyle(ButtonStyle.Primary)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_angka') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🔢 Tebak Angka',
                        description: 'Naura lagi mikirin satu angka dari 1 sampai 10 nih! Coba tebak yang mana!',
                        buttonsRow: [
                            new ActionRowBuilder().addComponents([1, 2, 3, 4, 5].map(n => new ButtonBuilder().setCustomId(`angka_${n}`).setLabel(`${n}`).setStyle(ButtonStyle.Secondary))),
                            new ActionRowBuilder().addComponents([6, 7, 8, 9, 10].map(n => new ButtonBuilder().setCustomId(`angka_${n}`).setLabel(`${n}`).setStyle(ButtonStyle.Secondary)))
                        ],
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_suit') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '✊ Suit (Gajah, Orang, Semut)',
                        description: `Ayo kita suit! Ingat:\n${ui.getEmoji('elephant')} Gajah menang lawan ${ui.getEmoji('standing_person')} Orang\n${ui.getEmoji('standing_person')} Orang menang lawan ${ui.getEmoji('ant')} Semut\n${ui.getEmoji('ant')} Semut menang lawan ${ui.getEmoji('elephant')} Gajah\n\nPilih jagoanmu!`,
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('suit_gajah').setEmoji(ui.getEmoji('elephant')).setLabel('Gajah').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('suit_orang').setEmoji(ui.getEmoji('standing_person')).setLabel('Orang').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('suit_semut').setEmoji(ui.getEmoji('ant')).setLabel('Semut').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_warna') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🎨 Tebak Warna',
                        description: 'Naura lagi mikirin satu warna di bawah ini, yang mana ya?',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('warna_merah').setEmoji(ui.getEmoji('red_circle')).setLabel('Merah').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('warna_biru').setEmoji(ui.getEmoji('blue_circle')).setLabel('Biru').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('warna_hijau').setEmoji(ui.getEmoji('green_circle')).setLabel('Hijau').setStyle(ButtonStyle.Success),
                            new ButtonBuilder().setCustomId('warna_kuning').setEmoji(ui.getEmoji('yellow_circle')).setLabel('Kuning').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_gelas') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🥛 Pilih Gelas',
                        description: 'Naura udah sembunyiin bola kecil di bawah salah satu dari 3 gelas ini. Coba tebak gelas yang mana!',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('gelas_1').setEmoji(ui.getEmoji('glass_of_milk')).setLabel('Gelas 1').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('gelas_2').setEmoji(ui.getEmoji('glass_of_milk')).setLabel('Gelas 2').setStyle(ButtonStyle.Secondary),
                            new ButtonBuilder().setCustomId('gelas_3').setEmoji(ui.getEmoji('glass_of_milk')).setLabel('Gelas 3').setStyle(ButtonStyle.Secondary)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_dadu') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🎲 Lempar Dadu',
                        description: 'Ayo adu lempar dadu! Siapa yang dapat angka paling besar dia yang menang!',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('dadu_lempar').setEmoji(ui.getEmoji('game_die')).setLabel('Lempar Dadu Kamu!').setStyle(ButtonStyle.Success)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_balapan') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🏎️ Balap Mobil',
                        description: 'Ada 3 mobil yang mau balapan: Merah, Biru, dan Hijau. Kamu mau taruhan buat mobil yang mana?',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('balapan_merah').setEmoji(ui.getEmoji('sport_utility_vehicle')).setLabel('Merah').setStyle(ButtonStyle.Danger),
                            new ButtonBuilder().setCustomId('balapan_biru').setEmoji(ui.getEmoji('sport_utility_vehicle')).setLabel('Biru').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('balapan_hijau').setEmoji(ui.getEmoji('pickup_truck')).setLabel('Hijau').setStyle(ButtonStyle.Success)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'nplay_roulette') {
                    const payload = buildContainerV2({
                        accentColorHex: '#FFB6C1',
                        title: '🔫 Roulette Naura',
                        description: 'Hanya ada 1 peluru di dalam 6 lubang pistol mainan ini. Berani tarik pelatuknya?',
                        buttonsRow: new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('roulette_tarik').setEmoji(ui.getEmoji('gun')).setLabel('Tarik Pelatuk!').setStyle(ButtonStyle.Danger)
                        ),
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                
                // Handling answers
                else if (game.startsWith('koin_')) {
                    const choice = game.split('_')[1];
                    const outcome = Math.random() < 0.5 ? 'kepala' : 'ekor';
                    const win = choice === outcome;
                    const payload = buildContainerV2({
                        accentColorHex: win ? '#22c55e' : '#ef4444',
                        title: '🪙 Hasil Tebak Koin',
                        description: `Kamu memilih: **${choice.toUpperCase()}**\nHasil koin: **${outcome.toUpperCase()}**\n\n${win ? `Yeyy kamu benar! ${ui.getEmoji('tada')}` : `Yahh tebakan kamu salah, coba lagi ya! ${ui.getEmoji('face_with_hand_over_mouth')}`}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game.startsWith('angka_')) {
                    const choice = parseInt(game.split('_')[1]);
                    const outcome = Math.floor(Math.random() * 10) + 1;
                    const win = choice === outcome;
                    const payload = buildContainerV2({
                        accentColorHex: win ? '#22c55e' : '#ef4444',
                        title: '🔢 Hasil Tebak Angka',
                        description: `Kamu memilih: **${choice}**\nAngka pilihan Naura: **${outcome}**\n\n${win ? `Hebatt! Tebakanmu jitu banget! ${ui.getEmoji('target')}` : `Wahh hampir aja benar! Jangan menyerah! ${ui.getEmoji('muscle')}`}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game.startsWith('suit_')) {
                    const userSuit = game.split('_')[1];
                    const options = ['gajah', 'orang', 'semut'];
                    const botSuit = options[Math.floor(Math.random() * options.length)];
                    
                    let result = '';
                    if (userSuit === botSuit) result = `Seri! Pikiran kita sehati ya hihi ${ui.getEmoji('flushed')}`;
                    else if (
                        (userSuit === 'gajah' && botSuit === 'orang') ||
                        (userSuit === 'orang' && botSuit === 'semut') ||
                        (userSuit === 'semut' && botSuit === 'gajah')
                    ) result = `Yeyy kamu menang! Hebat banget deh ${ui.getEmoji('partying_face')}`;
                    else result = `Yahh Naura yang menang! Jangan nangis ya wleee ${ui.getEmoji('wink')}`;

                    const payload = buildContainerV2({
                        accentColorHex: result.includes('menang') ? '#22c55e' : (result.includes('Seri') ? '#f59e0b' : '#ef4444'),
                        title: '✊ Hasil Suit',
                        description: `Pilihan kamu: **${userSuit.toUpperCase()}**\nPilihan Naura: **${botSuit.toUpperCase()}**\n\n${result}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game.startsWith('warna_')) {
                    const choice = game.split('_')[1];
                    const colors = ['merah', 'biru', 'hijau', 'kuning'];
                    const outcome = colors[Math.floor(Math.random() * colors.length)];
                    const win = choice === outcome;
                    const payload = buildContainerV2({
                        accentColorHex: win ? '#22c55e' : '#ef4444',
                        title: '🎨 Hasil Tebak Warna',
                        description: `Kamu milih warna: **${choice.toUpperCase()}**\nWarna di pikiran Naura: **${outcome.toUpperCase()}**\n\n${win ? `Wihh cenayang ya? Kok bisa tau! ${ui.getEmoji('sparkles_generic')}` : `Salah tebak nih, hihi semangat! ${ui.getEmoji('cherry_blossom')}`}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game.startsWith('gelas_')) {
                    const choice = parseInt(game.split('_')[1]);
                    const outcome = Math.floor(Math.random() * 3) + 1;
                    const win = choice === outcome;
                    const payload = buildContainerV2({
                        accentColorHex: win ? '#22c55e' : '#ef4444',
                        title: '🥛 Hasil Pilih Gelas',
                        description: `Kamu memilih: **Gelas ${choice}**\nBolanya ada di: **Gelas ${outcome}**\n\n${win ? `Wah mata kamu jeli banget! Benar! ${ui.getEmoji('tada')}` : `Yahh tebakan kamu salah, bolanya bukan di situ hihi ${ui.getEmoji('face_with_hand_over_mouth')}`}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'dadu_lempar') {
                    const userRoll = Math.floor(Math.random() * 6) + 1;
                    const botRoll = Math.floor(Math.random() * 6) + 1;
                    let result = '';
                    if (userRoll > botRoll) result = `Wahh kamu menang! Lemparan kamu lebih tinggi! ${ui.getEmoji('partying_face')}`;
                    else if (userRoll < botRoll) result = `Yeyy Naura yang menang! Lemparan Naura lebih besar! ${ui.getEmoji('wink')}`;
                    else result = `Eh seri! Dadu kita sama angkanya! ${ui.getEmoji('flushed')}`;

                    const payload = buildContainerV2({
                        accentColorHex: userRoll > botRoll ? '#22c55e' : (userRoll < botRoll ? '#ef4444' : '#f59e0b'),
                        title: '🎲 Hasil Lempar Dadu',
                        description: `Dadu Kamu: **${userRoll}**\nDadu Naura: **${botRoll}**\n\n${result}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game.startsWith('balapan_')) {
                    const choice = game.split('_')[1];
                    const cars = ['merah', 'biru', 'hijau'];
                    const winner = cars[Math.floor(Math.random() * cars.length)];
                    const win = choice === winner;
                    const payload = buildContainerV2({
                        accentColorHex: win ? '#22c55e' : '#ef4444',
                        title: '🏎️ Hasil Balapan',
                        description: `Kamu menjagokan mobil: **${choice.toUpperCase()}**\nDan yang menang adalah mobil: **${winner.toUpperCase()}**\n\n${win ? `Wah jagoanmu melesat cepat dan menang! ${ui.getEmoji('checkered_flag')}` : `Sayang sekali jagoanmu kalah cepat... ${ui.getEmoji('pleading_face')}`}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
                else if (game === 'roulette_tarik') {
                    const shot = Math.floor(Math.random() * 6) + 1;
                    const bullet = Math.floor(Math.random() * 6) + 1;
                    const dead = shot === bullet;
                    const payload = buildContainerV2({
                        accentColorHex: dead ? '#ef4444' : '#22c55e',
                        title: '🔫 Hasil Roulette',
                        description: dead ? `${ui.getEmoji('collision')} DOOORRR!!\nKamu terkena peluru! *Naura panik* Kamu nggak apa-apa kan?! ${ui.getEmoji('sob')}` : `CLICK!\nSyukurlah pistolnya kosong... Kamu selamat! ${ui.getEmoji('dash')}`,
                        footerText: ui.getFooter('core')
                    });
                    await i.update(payload);
                }
            });

            collector.on('end', () => {
                interaction.editReply({ components: [] }).catch(() => {});
            });
        }
    }
};
