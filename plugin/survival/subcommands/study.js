const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../../../plugin/survival/survivalTime');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { safeParseInventory } = require('../inventoryHelper');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_63', true);

        const profile = await cacheManager.getUserProfile(user.id);

        if (survival.currentLocation !== 'academy') return ui.sendError(interaction, 'err_sys_64', true);
        if (survival.hunger <= 15 || survival.thirst <= 15) return ui.sendError(interaction, 'err_sys_65', true);

        const rpgState = survival.rpg_state || { sick: false, test_cd: 0 };
        // Normalisasi inventory untuk mencegah crash 'xxx.some is not a function'
        const safeInv = safeParseInventory(profile.inventory);
        const hasIjazah = safeInv.some(i => i && i.id === 'certificate');

        const academyPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('study_school') || '🏫'} Naura Academy`,
            description: 'Selamat datang di Naura Academy.\n\nKamu bisa memilih untuk membaca buku di perpustakaan (menambah Intelligence) atau mengambil Ujian Sertifikasi dengan Prof. Habibie agar bisa mendaftar kerja tingkat tinggi.',
            footerText: ui.getFooter('survival')
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('study_book').setLabel('Membaca Buku (3 Jam)').setStyle(ButtonStyle.Secondary).setEmoji(ui.getEmoji('book') || '📖'),
            new ButtonBuilder().setCustomId('study_exam').setLabel('Ujian Prof. Habibie').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('grad') || '🎓')
        );

        const response = await interaction.reply({ ...academyPayload, components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            if (i.customId === 'study_book') {
                await i.deferUpdate();
                const studyTime = 3;
                let intGain = Math.floor(Math.random() * 3) + 1;

                const decos = rpgState.active_decorations || [];
                if (decos.some(d => d.id === 'deco_bookshelf')) intGain += 1;

                const diffHelper = require('../../../plugin/survival/difficultyHelper');
                const diffConfig = diffHelper.getDifficultyConfig(rpgState.difficulty || 'Normal');

                const drainHunger = Math.floor(15 * diffConfig.drainMultiplier);
                const drainThirst = Math.floor(20 * diffConfig.drainMultiplier);

                const newHunger = Math.max(0, survival.hunger - drainHunger);
                const newThirst = Math.max(0, survival.thirst - drainThirst);
                const newInt = (survival.intelligence || 1) + intGain;

                const timeUpdate = await advanceTime(user.id, studyTime);
                const timeState = getTimeState(timeUpdate.hour);

                survival.hunger = newHunger;
                survival.thirst = newThirst;
                survival.intelligence = newInt;
                await survival.save();

                try {
                    const { incrementQuestProgress } = require('../../../plugin/survival/questGenerator');
                    await incrementQuestProgress(user.id, 'study');
                } catch (e) { }

                const studyPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFC0CB',
                    title: `${ui.getEmoji('study_school') || '🏫'} Belajar di Naura Academy ✨`,
                    description: `Kamu membaca buku tebal di perpustakaan kampus selama ${studyTime} jam~ Rajin banget! 📖💕\n\n**✨ Hasil Belajarmu:**\n> ${ui.getEmoji('intelligence') || '💡'} **Kepintaran:** bertambah **+${intGain}** (Total: \`${newInt}\`)\n> ${ui.getEmoji('hunger') || '🍖'} Lapar: -15 | ${ui.getEmoji('thirst') || '💧'} Haus: -20\n\n**🕒 Waktu Saat Ini:**\n> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${timeState.label})`,
                    footerText: ui.getFooter('survival')
                });
                if (timeUpdate.passedOut) {
                    const eNsf = ui.getEmoji('nsf') || '🪙';
                }
                await i.editReply(studyPayload);
            }

            if (i.customId === 'study_exam') {
                if (hasIjazah) {
                    const alreadyPayload = buildErrorContainerV2({
                        title: 'Sudah Lulus 🎓',
                        description: `${ui.getEmoji('study_grad') || '🎓'} **Prof. Habibie:** "Kamu sudah lulus dengan nilai memuaskan! Tidak perlu mengulang ujian lagi."`,
                        footerText: ui.getFooter('survival')
                    });
                    return i.reply({ ...alreadyPayload, ephemeral: true });
                }

                if (rpgState.test_cd > survival.inGameDay) {
                    const cost = 200;
                    const eNsf = ui.getEmoji('nsf') || '🪙';
                    if (survival.starFragments < cost) {
                        const cdPayload = buildErrorContainerV2({
                            title: 'Ujian Cooldown',
                            description: `🎓 **Prof. Habibie:** "Kamu gagal ujian kemarin. Tunggu hari besok, atau bayar **${cost}** ${eNsf} **Naura Star Fragment** untuk biaya ujian remedial sekarang!"`,
                            footerText: ui.getFooter('survival')
                        });
                        return i.reply({ ...cdPayload, ephemeral: true });
                    }
                    survival.starFragments -= cost;
                    await survival.save();
                }

                await i.deferUpdate();

                const passChance = Math.min(0.9, (survival.intelligence || 1) / 100);
                if (Math.random() < passChance) {
                    profile.inventory.push({ id: 'certificate', name: 'Ijazah Kelulusan' });
                    await profile.save();
                    await advanceTime(user.id, 2);

                    const passPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFC0CB',
                        title: `${ui.getEmoji('study_grad') || '🎓'} Yaaay! Selamat, Kamu Lulus Ujian~! 🎉✨`,
                        description: `🎓 **Prof. Habibie:** "Luar biasa! Analisismu sangat tajam."\n\nSelamat yaaa! Kamu berhasil meraih 🎓 **Ijazah Kelulusan** dan sekarang bisa bekerja di profesi impianmu! Naura bangga banget sama kamu~! 💕`,
                        footerText: ui.getFooter('survival')
                    });
                    await i.editReply(passPayload);
                } else {
                    rpgState.test_cd = (survival.inGameDay || 1) + 1;
                    survival.rpg_state = rpgState;
                    await survival.save();
                    await advanceTime(user.id, 2);

                    const failPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFC0CB',
                        title: `${ui.getEmoji('study_grad') || '🎓'} Aww, Ujian Belum Lulus... 💔`,
                        description: `🎓 **Prof. Habibie:** "Jawabanmu kurang tepat. Kamu harus belajar lebih giat lagi!"\n\nJangan berkecil hati yaa! Belajar lagi sedikit dan kamu pasti bisa lulus di kesempatan berikutnya! Semangat~! 💕`,
                        footerText: ui.getFooter('survival')
                    });
                    await i.editReply(failPayload);
                }
            }
        });
    }
};