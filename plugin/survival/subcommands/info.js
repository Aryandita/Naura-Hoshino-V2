'use strict';

// Kartu profil petualangan. Perhitungannya ada di plugin/survival/infoStats.js,
// berkas ini fokus pada cara Naura menceritakan keadaan pemain.

const { AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { logger } = require('../../../src/managers/logger');
const UserPet = require('../../../src/models/UserPet');
const UserNPC = require('../../../src/models/UserNPC');
const UserAchievement = require('../../../src/models/UserAchievement');
const achievementsPool = require('../achievementsData');
const ui = require('../../../src/config/ui');
const cacheManager = require('../../../src/managers/cacheManager');
const { buildStats } = require('../infoStats');

const IMAGE_NAME = 'naura-survival.png';

function e(name, fallback) {
    return ui.getEmoji(name) || fallback || '';
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;

        try {
            const [profile, survival, activePets, marriedNPCs, [userAch]] = await Promise.all([
                cacheManager.getUserProfile(user.id),
                cacheManager.getUserSurvival(user.id),
                UserPet.findAll({ where: { userId: user.id, isActive: true } }),
                UserNPC.findAll({ where: { userId: user.id, relationshipLevel: 4 } }),
                UserAchievement.findOrCreate({ where: { userId: user.id } })
            ]);

            const stats = await buildStats({ userId: user.id, profile, survival, activePets });

            const partnerName = marriedNPCs.length > 0 ? marriedNPCs[0].npcId : null;
            const partnerDisplay = partnerName
                ? `${e('wedding_ring')} **${partnerName}** \u2014 Naura ikut senang lihat kalian bahagia!`
                : 'Masih sendiri, dan itu sama sekali nggak apa-apa~';

            // --- Gelar dan pencapaian ---
            let titleBadge = '';
            if (stats.rpgState.beat_extreme) {
                titleBadge += `\n${e('naura_impressed')} **Gelar Khusus:** Penyintas Terkuat & Tercerdas`;
            }
            if (userAch && userAch.activeTitle) {
                const active = achievementsPool.find(a => a.id === userAch.activeTitle);
                if (active) {
                    titleBadge += `\n${e('achievement_badge')} **Gelar Aktif:** ${active.emoji || ''} ${active.title}`.replace('  ', ' ');
                }
            }

            // --- Perlengkapan ---
            const gear = stats.gear;
            const gearLines = [
                `${e('tools')} **Perlengkapanmu:**`,
                `> ${e('axe')} Kapak: ${gear.axe ? 'siap dipakai' : 'belum ada, masih tangan kosong'}`,
                `> ${e('pickaxe')} Beliung: ${gear.pickaxe ? 'siap dipakai' : 'belum ada, masih tangan kosong'}`,
                `> ${e('fishing_rod')} Pancingan: ${gear.rod ? 'siap dipakai' : 'belum ada'}`,
                `> ${e('sword')} Senjata: ${gear.sword || gear.bow ? 'sudah ada, hati-hati ya' : 'belum ada'}`,
                gear.armorCount > 0
                    ? `> ${e('shield')} Zirah: **${gear.armorCount}** keping terpasang (${gear.armorNames.slice(0, 3).join(', ')})`
                    : `> ${e('shield')} Zirah: belum ada, Naura khawatir kamu kenapa-kenapa`
            ].join('\n');

            const vehicleLine = `${e('vehicle')} **Kendaraan:** ${survival.vehicle && survival.vehicle !== 'none' ? survival.vehicle : 'masih jalan kaki, semangat ya!'}`;

            let questLine = `${e('quest')} **Petunjuk Naura:** ${stats.isRegistered ? 'Belum ada quest baru, santai dulu sebentar.' : 'Daftar dulu ke Pak Kades lewat `/survival start` ya!'}`;
            if (stats.isRegistered && !gear.axe && !gear.pickaxe) {
                questLine = `${e('quest')} **Petunjuk Naura:** Kumpulkan bahan dengan tangan kosong lewat \`/survival collect\`, lalu tempa alat pertamamu!`;
            }

            const sickLine = stats.isSick
                ? `\n${e('sick')} **Kamu sedang sakit!** Naura antar ke klinik, ya? Jangan dipaksa kerja dulu.`
                : '';

            const timeLine = `${stats.timeState.emoji} **Hari ke-${survival.inGameDay || 1}** \u2022 pukul ${(survival.inGameHour || 6).toString().padStart(2, '0')}:00 (${stats.timeState.label}) \u2022 cuaca ${stats.weather.emoji} **${stats.weather.name}**${sickLine}`;

            const balanceLines = stats.balances
                .map(b => `> ${b.emoji} **${b.name}:** **${b.amount.toLocaleString('id-ID')}**`)
                .join('\n');

            const perkNames = Object.keys(stats.perks || {});
            const perkLine = perkNames.length > 0
                ? `> ${e('sparkle')} Berkah aktif: **${perkNames.length}** (${perkNames.slice(0, 4).join(', ')})`
                : `> ${e('sparkle')} Belum ada berkah khusus. Kumpulkan Naura Coupon dulu, yuk!`;

            // Gambar profil bersifat pemanis. Kalau kanvas gagal, kartunya tetap tampil.
            let files = [];
            let bannerAttachmentName;
            try {
                const { generateSurvivalProfileImage } = require('../../canvas/CanvasUtils');
                const buffer = await generateSurvivalProfileImage(user, profile, survival, ui);
                if (buffer) {
                    files = [new AttachmentBuilder(buffer, { name: IMAGE_NAME })];
                    bannerAttachmentName = IMAGE_NAME;
                }
            } catch (canvasError) {
                logger.warn('[SURVIVAL INFO CANVAS]', canvasError.message);
            }

            const payload = buildContainerV2({
                accentColorHex: stats.timeState.color || ui.getColor('primary'),
                authorName: `Catatan Petualangan ${user.displayName || user.username} \u2022 ${stats.rebirthCount}x Rebirth`,
                title: `${e('help_survival')} Naura sudah rapikan profilmu!`,
                iconURL: user.displayAvatarURL(),
                expression: 'Cheers',
                description: [
                    `${e('clock')} **Waktu di dunia Naura:**`,
                    timeLine,
                    '',
                    `${e('lokasi')} **Kamu sedang di:** ${stats.locationName} \u2022 ${e('property')} **Tempat tinggal:** ${stats.propertyName}`,
                    `${stats.difficultyEmoji} **Mode ${stats.difficulty}**${titleBadge}`,
                    '',
                    `${e('health')} **Keadaan badanmu:**`,
                    `${e('health')} **HP:** ${stats.hp}/${stats.maxHp}\n${stats.hpBar}`,
                    `${e('hunger')} **Lapar:** ${survival.hunger || 0}/100\n${stats.hungerBar}`,
                    `${e('thirst')} **Haus:** ${survival.thirst || 0}/100\n${stats.thirstBar}`,
                    `${e('stamina')} **Stamina:** ${survival.stamina || 0}/100\n${stats.staminaBar}`,
                    '',
                    gearLines,
                    '',
                    vehicleLine,
                    questLine
                ].join('\n'),
                fields: [
                    {
                        name: `${e('wallet')} Dompet & Kupon`,
                        value: `${balanceLines}\n${perkLine}`
                    },
                    {
                        name: `${e('experience')} Progres Level (Lv. ${stats.level})`,
                        value: `> **XP:** ${stats.xp} / ${stats.reqXP}\n> ${stats.xpBar}`
                    },
                    {
                        name: `${e('stats')} Statistik RPG (batas ${stats.maxStat})`,
                        value: [
                            `> ${e('strength')} STR: **${survival.strength || 1}** (+${stats.pet.bonusStrength}) \u2014 kekuatan seranganmu`,
                            `> ${e('agility')} AGI: **${survival.agility || 1}** \u2014 peluang menghindar dan kabur`,
                            `> ${e('intelligence')} INT: **${survival.intelligence || 1}** \u2014 bonus gaji dan diskon toko`,
                            `> ${e('luck')} LUK: **${survival.luck || 1}** (+${stats.pet.bonusLuck}) \u2014 peluang jarahan langka`
                        ].join('\n')
                    },
                    {
                        name: `${e('favorite')} Orang-orang di sekitarmu`,
                        value: `> **Teman berbulu:** ${stats.pet.display}\n> **Pasangan:** ${partnerDisplay}`
                    }
                ],
                bannerAttachmentName,
                files,
                footerText: ui.getFooter('survival')
            });

            return interaction.editReply(payload);
        } catch (error) {
            logger.error('[SURVIVAL INFO ERROR]', error);
            const errPayload = buildErrorContainerV2({
                title: `${e('naura_cry')} Naura gagal membuka catatanmu`,
                description: 'Maaf ya, ada yang tersangkut waktu Naura menyusun profilmu. Coba lagi sebentar lagi, Naura tunggu!',
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply(errPayload);
        }
    }
};
