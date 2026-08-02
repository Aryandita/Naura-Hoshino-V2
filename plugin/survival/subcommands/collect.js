// Lokasi: src/commands/survival/subcommands/collect.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, MessageFlags, AttachmentBuilder } = require('discord.js');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const UserPet = require('../../../src/models/UserPet');
const { safeParseInventory } = require('../inventoryHelper');
const itemsConfig = require('../../../plugin/survival/items');
const ui = require('../../../src/config/ui');
const { advanceTime, getTimeState } = require('../../../plugin/survival/survivalTime');
const leveling = require('../../../plugin/survival/survivalLeveling');
const path = require('path');
const fs = require('fs');

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const lokasi = interaction.options.getString('lokasi');
        
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const errReply = async (interaction, msg) => {
            const ep = buildContainerV2({ accentColorHex: ui.getColor('error') || '#ef4444', title: 'Gagal', description: `${ui.getEmoji('error') || '❌'} ${msg}`, footerText: ui.getFooter('survival') });
            return interaction.reply({ ...ep, flags: MessageFlags.Ephemeral });
        };

        if (survival.currentLocation === 'prison') {
            return errReply(interaction, 'Kamu tidak bisa melakukan ini karena sedang berada di dalam **Penjara**!');
        }

        if (survival.hunger <= 10 || survival.thirst <= 10 || survival.stamina <= 10) {
            return errReply(interaction, `Kamu terlalu lemas untuk pergi ke **${lokasi}**. Makan, minum, atau tidurlah dulu!`);
        }

        const currentInv = safeParseInventory(profile.inventory);
        
        // Pengecekan Alat Pancing di Laut
        const hasFishingRod = currentInv.some(item => item && item.id === 'fishing_rod');
        const hasAxe = currentInv.some(item => item?.id?.includes('axe'));
        const hasPickaxe = currentInv.some(item => item?.id?.includes('pickaxe'));

        let usingBareHands = false;
        if (lokasi === 'laut' && !hasFishingRod) {
            return errReply(interaction, `Kamu butuh ${ui.getEmoji('fishing_rod') || '🎣'} **Fishing Rod** untuk memancing di laut! Menangkap ikan dengan tangan kosong itu mustahil.`);
        }

        if (lokasi === 'hutan' && !hasAxe) {
            usingBareHands = true;
        }

        if (lokasi === 'tambang' && !hasPickaxe) {
            usingBareHands = true;
        }

        const bareHandsFlag = usingBareHands;

        // Set lokasi user sementara
        survival.currentLocation = lokasi;
        await survival.save();

        const timeState = getTimeState(survival.inGameHour || 6);
        let encounterText = '';
        if (Math.random() < 0.1) {
            const seed = Math.random();
            if (seed < 0.5) {
                encounterText = `\n\n${ui.getEmoji('thief') || '🥷'} **Waspada!** Ada pergerakan mencurigakan di semak-semak. Mungkin itu bandit yang sedang mengintai!`;
            } else {
                encounterText = `\n\n🎒 **Loh?** Kamu melihat jejak kereta kuda di tanah. Mungkinkah Pak Damar si pedagang baru saja lewat sini?`;
            }
        }

        // Cari background lokasi
        const bgPath = ui.getSurvivalBackground(lokasi, survival.inGameHour || 6);

        const npcConfig = require('../../../plugin/survival/npcs');
        const presentNPCs = Object.values(npcConfig).filter(n => {
            const loc = (typeof n.getLocation === 'function') ? n.getLocation(survival.inGameHour || 6) : n.location;
            return loc === lokasi;
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('collect_1').setLabel('Cari di Sini').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId('collect_2').setLabel('Cari di Sana').setStyle(ButtonStyle.Secondary)
        );

        if (presentNPCs.length > 0) {
            row.addComponents(
                new ButtonBuilder().setCustomId('collect_talk_npc_prep').setLabel('Bicara dengan Warga').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('talk') || '🗣️')
            );
        }

        let files = [];
        let bannerAttachmentName;
        if (fs.existsSync(bgPath)) {
            files.push(new AttachmentBuilder(bgPath, { name: 'location.jpeg' }));
            bannerAttachmentName = 'location.jpeg';
        }

        const locPayload = buildContainerV2({
            accentColorHex: timeState.color || ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('lokasi') || '📍'} Lokasi: ${lokasi.toUpperCase()}`,
            description: `Kamu tiba di area ${lokasi}. Pilih area mana yang ingin kamu jelajahi!${encounterText}`,
            bannerAttachmentName,
            footerText: ui.getFooter('survival')
        });

        const response = await interaction.reply({ ...locPayload, components: [row], files });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 15000, max: 1 });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'collect_talk_npc_prep') {
                const disabledRow = ActionRowBuilder.from(row);
                disabledRow.components.forEach(c => c.setDisabled(true));
                await interaction.editReply({ components: [disabledRow] }).catch(() => {});

                const npcHandler = require('./npc.js');
                await npcHandler.execute(i, client);
                return;
            }

            let dropLapar = 5, dropHaus = 8, dropStamina = 10, rewardId = '';
            const activePets = await UserPet.findAll({ where: { userId: user.id, isActive: true } });
            const isWolf = activePets.some(p => p.petType === 'wolf');
            const isCat = activePets.some(p => p.petType === 'cat');

            let list = [];
            let bareHandsLoot = false;

            if (lokasi === 'hutan') { 
                if (bareHandsFlag) {
                    bareHandsLoot = true;
                    dropLapar = 10; dropHaus = 15; dropStamina = 25;
                } else {
                    list = ['wood', 'wood', 'fiber', 'apple', 'stone']; 
                    if (isCat) list.push('apple', 'seed_apple'); 
                }
            } else if (lokasi === 'sampah') { 
                list = ['trash', 'fiber', 'mineral_water']; 
            } else if (lokasi === 'tambang') {
                if (bareHandsFlag) {
                    bareHandsLoot = true;
                    dropLapar = 15; dropHaus = 20; dropStamina = 35;
                } else {
                    dropLapar = 10; dropHaus = 15; dropStamina = 20;
                    if (isWolf) { dropLapar -= 4; dropHaus -= 5; dropStamina -= 5; }
                    list = ['stone', 'stone', 'iron_ore', 'iron_ore', 'diamond', 'naura_shard'];
                    if (isCat) list.push('diamond', 'naura_shard'); 
                }
            } else if (lokasi === 'laut') {
                dropLapar = 3; dropHaus = 5; dropStamina = 5;
                list = ['small_fish', 'salmon', 'trash'];
                if (isCat) list.push('salmon', 'mystic_herb'); 
            }

            let isQTE = false;
            let qteButtons = [];

            if (!bareHandsLoot) {
                if (lokasi === 'laut') {
                    isQTE = true;
                    qteButtons = [
                        new ButtonBuilder().setCustomId('qte_wrong1').setLabel('LEPAS').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('qte_correct').setLabel('TARIK!').setStyle(ButtonStyle.Success),
                        new ButtonBuilder().setCustomId('qte_wrong2').setLabel('DIAM').setStyle(ButtonStyle.Secondary)
                    ];
                } else if (lokasi === 'tambang' && Math.random() < 0.4) {
                    isQTE = true;
                    qteButtons = [
                        new ButtonBuilder().setCustomId('qte_correct').setLabel('HANTAM!').setStyle(ButtonStyle.Danger),
                        new ButtonBuilder().setCustomId('qte_wrong1').setLabel('USAP').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('qte_wrong2').setLabel('LARI').setStyle(ButtonStyle.Secondary)
                    ];
                } else if (lokasi === 'hutan' && Math.random() < 0.3) {
                    isQTE = true;
                    qteButtons = [
                        new ButtonBuilder().setCustomId('qte_wrong1').setLabel('CABUT').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('qte_wrong2').setLabel('TENDANG').setStyle(ButtonStyle.Secondary),
                        new ButtonBuilder().setCustomId('qte_correct').setLabel('TEBANG!').setStyle(ButtonStyle.Primary)
                    ];
                }
            }

            const processLoot = async (isSuccess, interactionSource) => {
                // Selalu kembalikan lokasi ke desa/village saat selesai
                survival.currentLocation = 'village';
                await survival.save();

                if (!isSuccess) {
                    const failPayload = buildContainerV2({ accentColorHex: ui.getColor('error') || '#ef4444', title: 'Gagal!', description: `${ui.getEmoji('error') || '❌'} Gagal! Kamu salah langkah dan kehilangan target.\n\n*Kamu berjalan kembali ke Desa Pemula.*`, footerText: ui.getFooter('survival') });
                    return interactionSource.editReply({ ...failPayload, components: [], files: [] });
                }

                const updatedInv = safeParseInventory(profile.inventory);
                let successDesc = '';

                if (bareHandsLoot) {
                    if (lokasi === 'hutan') {
                        updatedInv.push({ id: 'wood', name: 'Kayu' });
                        updatedInv.push({ id: 'trash', name: 'Sampah Ranting' });
                        successDesc = `Kamu mengais hutan dengan tangan kosong.\nKamu menemukan **1x Kayu** dan **1x Ranting (Sampah)**.\n*Tanganmu terasa perih, staminamu terkuras drastis.*`;
                    } else if (lokasi === 'tambang') {
                        updatedInv.push({ id: 'stone', name: 'Batu' });
                        updatedInv.push({ id: 'trash', name: 'Kerikil' });
                        successDesc = `Kamu menggali bebatuan tambang dengan tangan kosong.\nKamu menemukan **1x Batu** dan **1x Kerikil (Sampah)**.\n*Jarimu lecet, staminamu terkuras drastis.*`;
                    }
                } else {
                    rewardId = list[Math.floor(Math.random() * list.length)];
                    const itemReward = itemsConfig.find(it => it.id === rewardId) || { id: rewardId, name: rewardId };
                    updatedInv.push({ id: rewardId, name: itemReward.name });
                    successDesc = `Kamu berhasil melakukan eksplorasi di ${lokasi}!\nKamu menemukan **${itemReward.name}**!`;
                }

                const newHunger = Math.max(0, survival.hunger - dropLapar);
                const newThirst = Math.max(0, survival.thirst - dropHaus);
                const newStamina = Math.max(0, survival.stamina - dropStamina);
                
                const hoursTaken = lokasi === 'tambang' ? 2 : 1;
                const timeUpdate = await advanceTime(user.id, hoursTaken);
                const newTimeState = getTimeState(timeUpdate.hour);

                // Simpan perubahan ke UserSurvival
                await UserSurvival.update({ 
                    hunger: newHunger, 
                    thirst: newThirst, 
                    stamina: newStamina,
                    currentLocation: 'village'
                }, { where: { userId: user.id } });
                
                await UserProfile.update({ inventory: updatedInv }, { where: { userId: user.id } });

                let gainedXP = lokasi === 'tambang' ? 10 : 5;
                await leveling.addPlayerXP(user.id, gainedXP);

                // Update Quest Progress
                try {
                    const { incrementQuestProgress } = require('../../../plugin/survival/questGenerator');
                    await incrementQuestProgress(user.id, 'collect');

                    const UserQuest = require('../../../src/models/UserQuest');
                    const today = new Date().toISOString().split('T')[0];
                    let [quest] = await UserQuest.findOrCreate({ where: { userId: user.id }, defaults: { lastReset: today } });
                    if (quest.lastReset !== today) {
                        quest.workCount = 0; quest.dungeonKills = 0; quest.collectCount = 0; quest.isClaimed = false; quest.lastReset = today;
                    }
                    quest.collectCount++;
                    await quest.save();
                } catch (e) {}

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: `${ui.getEmoji('success') || '✅'} Eksplorasi Berhasil!`,
                    description: `${successDesc}\n\n**Pengorbanan:**\n> ${ui.getEmoji('hunger') || '🍖'} Lapar: -${dropLapar} | ${ui.getEmoji('thirst') || '💧'} Haus: -${dropHaus}\n> ${ui.getEmoji('stamina') || '⚡'} Stamina: -${dropStamina} | ${ui.getEmoji('clock') || '⏰'} Waktu: +${hoursTaken} Jam\n\n${ui.getEmoji('exp') || '🌟'} **Mendapatkan +${gainedXP} XP**\n\n**Waktu Saat Ini:**\n> Hari ke-${timeUpdate.day}, Jam ${timeUpdate.hour.toString().padStart(2, '0')}:00 (${newTimeState.label})\n\n*Kamu telah kembali ke Desa Pemula.*`,
                    footerText: ui.getFooter('survival')
                });

                const talkRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('collect_talk_npc')
                        .setLabel('Bicara dengan Warga')
                        .setStyle(ButtonStyle.Success)
                        .setEmoji(ui.getEmoji('talk') || '🗣️')
                );

                const finalMsg = await interactionSource.editReply({ embeds: [successEmbed], components: [talkRow], files: [] });

                if (finalMsg && finalMsg.createMessageComponentCollector) {
                    const finalCollector = finalMsg.createMessageComponentCollector({
                        filter: btnI => btnI.user.id === user.id && btnI.customId === 'collect_talk_npc',
                        time: 30000
                    });

                    finalCollector.on('collect', async btnI => {
                        await btnI.deferUpdate();
                        const disabledRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder()
                                .setCustomId('collect_talk_npc_disabled')
                                .setLabel('Bicara dengan Warga')
                                .setStyle(ButtonStyle.Success)
                                .setEmoji(ui.getEmoji('talk') || '🗣️')
                                .setDisabled(true)
                        );
                        await btnI.editReply({ components: [disabledRow] }).catch(() => {});

                        const npcHandler = require('./npc.js');
                        await npcHandler.execute(btnI, client);
                    });
                }
            };

            if (isQTE) {
                qteButtons.sort(() => Math.random() - 0.5);
                const qteRow = new ActionRowBuilder().addComponents(qteButtons);
                
                let qteMsg = `${ui.getEmoji('fishing_rod') || '🎣'} **STRIKE!** Umpanmu ditarik kencang!`;
                if (lokasi === 'tambang') qteMsg = `${ui.getEmoji('diamond') || '💎'} **BATU KERAS!** Kamu menemukan urat mineral murni!`;
                if (lokasi === 'hutan') qteMsg = `${ui.getEmoji('tree') || '🌳'} **POHON RAKSASA!** Ayunkan kapakmu dengan benar!`;

                const qtePayload = buildContainerV2({ accentColorHex: ui.getColor('warning') || '#f59e0b', title: '⚡ Quick Time Event!', description: `${qteMsg}\n\nTekan tombol yang tepat dalam **5 Detik**!`, footerText: ui.getFooter('survival') });
                const qteResponse = await i.editReply({ ...qtePayload, components: [qteRow] });
                const qteCollector = qteResponse.createMessageComponentCollector({ filter: btnI => btnI.user.id === user.id, time: 5000, max: 1 });

                qteCollector.on('collect', async btnI => {
                    await btnI.deferUpdate();
                    if (btnI.customId === 'qte_correct') await processLoot(true, btnI);
                    else await processLoot(false, btnI);
                });

                qteCollector.on('end', async collected => {
                    if (collected.size === 0) {
                        survival.currentLocation = 'village';
                        await survival.save();
                        const toPayload = buildContainerV2({ accentColorHex: ui.getColor('error') || '#ef4444', title: 'Waktu Habis!', description: `${ui.getEmoji('clock') || '⏱️'} Waktu Habis! Kamu terlalu lambat bereaksi.`, footerText: ui.getFooter('survival') });
                        i.editReply({ ...toPayload, components: [], files: [] }).catch(() => {});
                    }
                });
            } else {
                const waitPayload = buildContainerV2({ accentColorHex: ui.getColor('primary') || '#FFB6C1', title: '🔍 Sedang Mengais...', description: 'Sedang mengais area ini...', footerText: ui.getFooter('survival') });
                await i.editReply({ ...waitPayload, components: [] });
                setTimeout(async () => { await processLoot(true, i); }, 1500);
            }
        });

        collector.on('end', async c => { 
            if (c.size === 0) {
                survival.currentLocation = 'village';
                await survival.save();
                const toPayload = buildContainerV2({ accentColorHex: ui.getColor('error') || '#ef4444', title: 'Waktu Habis!', description: 'Waktu habis, kamu melamun terlalu lama!', footerText: ui.getFooter('survival') });
                interaction.editReply({ ...toPayload, components: [], files: [] }).catch(() => {});
            }
        });
    }
};