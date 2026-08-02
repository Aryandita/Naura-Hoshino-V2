// Lokasi: src/commands/survival/subcommands/info.js
const { AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildLoadingContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const { logger } = require('../../../src/managers/logger');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const UserPet = require('../../../src/models/UserPet');
const UserNPC = require('../../../src/models/UserNPC');
const UserAchievement = require('../../../src/models/UserAchievement');
const achievementsPool = require('../../../plugin/survival/achievementsData');
const ui = require('../../../src/config/ui');
const { getTimeState } = require('../../../plugin/survival/survivalTime');
const { generateSurvivalProfileImage } = require('../../canvas/CanvasUtils');
const leveling = require('../../../plugin/survival/survivalLeveling');
const { safeParseInventory } = require('../inventoryHelper');
const cacheManager = require('../../../src/managers/cacheManager');

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const client = interaction.client;

        const loadingPayload = buildLoadingContainerV2({ loadingMessage: `${ui.getEmoji('loading') || '⏳'} Memuat data...` });
        await interaction.reply(loadingPayload);

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Error', description: msg, footerText: ui.getFooter('survival') });

        try {
            const [
                profile,
                survival,
                activePets,
                marriedNPCs,
                [userAch]
            ] = await Promise.all([
                cacheManager.getUserProfile(user.id),
                cacheManager.getUserSurvival(user.id),
                UserPet.findAll({ where: { userId: user.id, isActive: true } }),
                UserNPC.findAll({ where: { userId: user.id, relationshipLevel: 4 } }),
                UserAchievement.findOrCreate({ where: { userId: user.id } })
            ]);

            // --- DATA LEVELING ---
            let currentLevel = parseInt(survival.survival_level) || 1;
            let currentXP = parseInt(survival.survival_xp) || 0;
            let reqXP = leveling.getExpRequirement(currentLevel);

            // ✨ SISTEM AUTO-HEAL: Jika ada bug XP menumpuk, langsung perbaiki!
            if (currentXP >= reqXP) {
                const fixedStats = await leveling.addPlayerXP(user.id, 0);
                currentLevel = fixedStats.currentLevel;
                currentXP = fixedStats.currentXP;
                reqXP = fixedStats.reqXP;

                // Update variabel lokal agar gambar Canvas merender data yang sudah diperbaiki
                survival.survival_level = currentLevel;
                survival.survival_xp = currentXP;
            }

            const maxStat = leveling.getMaxStatCap(currentLevel);
            const xpBar = ui.createProgressBar(currentXP, reqXP, 8);

            const activeStrength = Math.min(survival.strength || 1, maxStat);
            const maxPlayerHP = 100 + (Math.floor(currentLevel / 5) * 10) + (activeStrength * 10);
            const playerHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;

            const hpBar = ui.createProgressBar(playerHP, maxPlayerHP, 8);
            const hungerBar = ui.createProgressBar(survival.hunger || 0, 100, 8);
            const thirstBar = ui.createProgressBar(survival.thirst || 0, 100, 8);
            const staminaBar = ui.createProgressBar(survival.stamina || 0, 100, 8);

            let bonusStrength = 0;
            let bonusLuck = 0;
            let petDisplay = 'Belum punya Pet aktif';
            let petCanvasDisplay = 'Belum punya Pet aktif';

            if (activePets.length > 0) {
                const myPet = activePets[0];
                petCanvasDisplay = myPet.petName || myPet.petType;
                petDisplay = `${ui.getEmoji('pet') || '🐾'} **${petCanvasDisplay}**`;

                if (myPet.petType === 'wolf') {
                    bonusStrength += 2;
                    petDisplay += `\n> *Efek: +2 Strength*`;
                } else if (myPet.petType === 'cat') {
                    bonusLuck += 2;
                    petDisplay += `\n> *Efek: +2 Luck*`;
                }
            }

            const partnerCanvasDisplay = marriedNPCs.length > 0 ? marriedNPCs[0].npcId : 'Single';
            const partnerDisplay = marriedNPCs.length > 0 ? `${ui.getEmoji('npc') || '👤'} **${partnerCanvasDisplay}**` : 'Single';

            const locNames = {
                'village': 'Desa Pemula',
                'kota': 'Kota Naura',
                'hutan': 'Hutan Pinus',
                'laut': 'Pantai Selatan',
                'tambang': 'Tambang Kuno',
                'academy': 'Naura Academy',
                'park': 'Amusement Park',
                'jalanan': 'Pinggir Jalan'
            };
            const currentLocationKey = survival.currentLocation || 'village';
            const currentLocation = locNames[currentLocationKey] || (typeof currentLocationKey === 'string' ? currentLocationKey.toUpperCase() : 'VILLAGE');
            const properties = { 'jalanan': 'Pinggir Jalan', 'gudang': 'Gudang Tua', 'kos': 'Kos-kosan', 'rumah': 'Rumah Nyaman' };
            const myPropName = properties[survival.propertyId] || 'Pinggir Jalan';

            const timeState = getTimeState(survival.inGameHour || 6);

            const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false, weather: 'cerah' };
            const weatherName = rpgState.weather || 'cerah';
            let weatherEmoji = ui.getEmoji('clear_sky') || '☀️';
            if (weatherName === 'hujan') weatherEmoji = ui.getEmoji('rain') || '🌧️';
            if (weatherName === 'badai') weatherEmoji = ui.getEmoji('badai') || '⛈️';

            let sickStatus = rpgState.sick ? `\n${ui.getEmoji('sick') || '🤒'} **Kamu sedang sakit!** Segera periksa ke klinik.` : '';

            const timeString = `${timeState.emoji} **Hari ke-${survival.inGameDay || 1}** | Jam ${(survival.inGameHour || 6).toString().padStart(2, '0')}:00 (${timeState.label}) | Cuaca: ${weatherEmoji} ${weatherName.toUpperCase()}${sickStatus}`;


            const imageBuffer = await generateSurvivalProfileImage(user, profile, survival, ui);
            const canvasAttachment = new AttachmentBuilder(imageBuffer, { name: 'naura-survival.png' });


            // Extract some info from profile/survival

            const diffColor = { 'Mudah': '🟢', 'Normal': '🟡', 'Sulit': '🟠', 'Ekstrim': '🔴' };
            const currentDiff = rpgState.difficulty || 'Normal';
            const rebirthCount = rpgState.rebirth_count || 0;
            const diffBadge = `${diffColor[currentDiff]} Mode ${currentDiff}`;

            let titleBadge = '';
            if (rpgState.beat_extreme) titleBadge += `\n👑 **Title:** The Strongest & Smartest Survivor`;

            if (userAch && userAch.activeTitle) {
                const active = achievementsPool.find(a => a.id === userAch.activeTitle);
                if (active) {
                    titleBadge += `\n🏆 **Gelar:** ${active.emoji} ${active.title}`;
                }
            }

            let toolStatus = `${ui.getEmoji('tools') || '⚒️'} **Alat & Senjata:**\n`;
            // Normalisasi inventory untuk mencegah crash 'xxx.some is not a function'
            const safeInv = safeParseInventory(profile.inventory);
            const hasAxe = safeInv.some(i => i?.id?.includes('axe'));
            const hasPick = safeInv.some(i => i?.id?.includes('pick'));
            const hasRod = safeInv.some(i => i?.id?.includes('fishing'));
            toolStatus += `> Kapak: ${hasAxe ? 'Ada' : 'Tangan Kosong'}\n`;
            toolStatus += `> Beliung: ${hasPick ? 'Ada' : 'Tangan Kosong'}\n`;
            toolStatus += `> Pancingan: ${hasRod ? 'Ada' : 'Tidak Ada'}\n`;

            let vehEmoji = ui.getEmoji('vehicle') || '🚗';
            let vehicleStatus = `${vehEmoji} **Kendaraan:** ${survival.vehicle && survival.vehicle !== 'none' ? survival.vehicle : 'Jalan Kaki'}\n`;

            const questEmoji = ui.getEmoji('quest') || '📜';
            const isRegistered = safeInv.some(i => i?.id === 'survival_started');
            let questStatus = `${questEmoji} **Quest Aktif:** ${isRegistered ? 'Belum Ada Quest' : 'Daftar di Walikota (/survival start)'}`;
            if (isRegistered && !hasAxe && !hasPick) {
                questStatus = `${questEmoji} **Quest Aktif:** Kumpulkan material dengan tangan kosong (/survival collect) lalu craft alat.`;
            }


            const infoPayload = buildContainerV2({
                accentColorHex: timeState.color || ui.getColor('primary'),
                authorName: `Survival Info: ${user.displayName} [${rebirthCount} Rebirth]`,
                title: `${ui.getEmoji('survival') || '⚔️'} Profil Petualangan RPG`,
                iconURL: user.displayAvatarURL(),
                description:
                    `**${ui.getEmoji('clock') || '⏰'} Waktu Lokal:**\n${timeString}\n\n` +
                    `**${ui.getEmoji('lokasi') || '📍'} Lokasi:** ${currentLocation} | **${ui.getEmoji('property') || '🏠'} Tempat:** ${myPropName}\n` +
                    `${diffBadge}${titleBadge}\n\n` +
                    `**${ui.getEmoji('health') || '❤️'} Status Fisik:**\n` +
                    `${ui.getEmoji('health') || '❤️'} **HP:** ${playerHP}/${maxPlayerHP}\n${hpBar}\n` +
                    `${ui.getEmoji('hunger') || '🍖'} **Lapar:** ${survival.hunger || 0}/100\n${hungerBar}\n` +
                    `${ui.getEmoji('thirst') || '💧'} **Haus:** ${survival.thirst || 0}/100\n${thirstBar}\n` +
                    `${ui.getEmoji('stamina') || '⚡'} **Stamina:** ${survival.stamina || 0}/100\n${staminaBar}\n\n` +
                    `${toolStatus}\n${vehicleStatus}\n${questStatus}`,
                fields: [
                    {
                        name: `${ui.getEmoji('wallet') || '💰'} Saldo & Mata Uang`,
                        value: `> ${ui.getEmoji('coin') || '🪙'} **Naura Coin (NC):** **${(profile.economy_wallet || 0).toLocaleString('id-ID')}**\n> ${ui.getEmoji('nsf') || '💠'} **Star Fragment (NSF):** **${(survival.starFragments || 0).toLocaleString('id-ID')}**`
                    },
                    {
                        name: `${ui.getEmoji('experience') || '⭐'} Progres Level (Lv. ${currentLevel})`,
                        value: `> **XP:** ${currentXP} / ${reqXP}\n> ${xpBar}`
                    },
                    {
                        name: `${ui.getEmoji('stats') || ui.getEmoji('strength') || '📊'} Stats RPG (Maks: ${maxStat})`,
                        value: `> ${ui.getEmoji('strength') || '💪'} STR: **${survival.strength || 1}** (+${bonusStrength}) (Bonus Damage)\n` +
                               `> ${ui.getEmoji('agility') || '⚡'} AGI: **${survival.agility || 1}** (Peluang Dodge & Kabur)\n` +
                               `> ${ui.getEmoji('intelligence') || '🧠'} INT: **${survival.intelligence || 1}** (Bonus Gaji & Diskon Shop)\n` +
                               `> ${ui.getEmoji('luck') || '🍀'} LUK: **${survival.luck || 1}** (+${bonusLuck}) (Bonus Drop Item)`
                    },
                    {
                        name: `${ui.getEmoji('favorite') || ui.getEmoji('heart') || '💖'} Relasi`,
                        value: `> **Pet:** ${petDisplay}\n> **Pasangan:** ${partnerDisplay}`
                    }
                ],
                bannerAttachmentName: 'naura-survival.png',
                footerText: ui.getFooter('survival')
            });

            infoPayload.files = [canvasAttachment];
            return interaction.editReply(infoPayload);

        } catch (error) {
            logger.error('[SURVIVAL INFO ERROR]', error);
            const errPayload = buildErrorContainerV2({ title: 'Error Sistem', description: 'Terjadi kesalahan sistem saat memuat profil survival kamu.', footerText: ui.getFooter('survival') });
            return interaction.editReply({ ...errPayload, embeds: [] });
        }
    }
};