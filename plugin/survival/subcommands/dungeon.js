// Lokasi: plugin/survival/subcommands/dungeon.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const leveling = require('../../../plugin/survival/survivalLeveling');
const { advanceTime } = require('../../../plugin/survival/survivalTime');
const { drawBattle } = require('../../../plugin/canvas/battleCanvas');
const { safeParseInventory, hasItem, addOrStackItem } = require('../inventoryHelper');

// Fungsi random item drop
function getDungeonLoot(floor, luck) {
    const loot = [];
    const rand = Math.random() * 100;

    // Base chance modifier dari LUCK stat
    const luckMod = luck * 0.5;

    // Boss floor loot
    if (floor % 10 === 0) {
        if (rand < (20 + luckMod)) loot.push({ id: 'demon_horn', name: 'Tanduk Iblis' });
        if (rand < (10 + luckMod)) loot.push({ id: 'dragon_scale', name: 'Sisik Naga' });
        if (rand < (5 + luckMod)) loot.push({ id: 'cursed_eye', name: 'Mata Terkutuk' });
        loot.push({ id: 'mega_potion', name: 'Ramuan Mega (Emas)' });
    } else {
        // Normal floor loot
        if (rand < (40 + luckMod)) loot.push({ id: 'slime_gel', name: 'Gel Slime' });
        if (rand > 30 && rand < (60 + luckMod)) loot.push({ id: 'goblin_ear', name: 'Telinga Goblin' });
        if (rand < (10 + luckMod)) loot.push({ id: 'iron_ore', name: 'Bijih Besi' });
    }

    return loot;
}

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        // Normalisasi inventory untuk mencegah crash 'xxx.some is not a function'
        const inv = safeParseInventory(profile.inventory);
        profile.inventory = inv;

        const hasPass = hasItem(inv, 'dungeon_pass');
        if (!hasPass) {
            return ui.sendError(interaction, 'err_sys_42', true);
        }

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal', description: `${ui.getEmoji('error')} ${msg}`, footerText: ui.getFooter('survival') });

        if (survival.currentLocation !== 'tambang' && survival.currentLocation !== 'desa') {
            return interaction.reply({ ...errEmbed('Kamu harus berada di **Gua/Tambang** (Desa) untuk mengakses Infinite Dungeon!'), ephemeral: true });
        }

        if (survival.hp <= 20 || survival.stamina <= 20) {
            return interaction.reply({ ...errEmbed('Kondisi fisikmu terlalu lemah untuk bertarung! Pulihkan HP dan Stamina dulu.'), ephemeral: true });
        }

        const isPremium = profile.isPremium && profile.premiumUntil > new Date();
        const floor = (profile.dungeon_floor || 1);

        if (!isPremium && floor > 50) {
            const vipPayload = buildErrorContainerV2({
                title: '💎 Batas Dungeon Terbuka',
                description: `${ui.getEmoji('error') || '❌'} Pengguna standar hanya dapat menjelajah Dungeon sampai **Lantai 50**.\nGunakan \`/premium\` untuk mendapatkan akses tak terbatas ke lantai-lantai terdalam!`,
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...vipPayload, ephemeral: true });
        }

        const isBoss = floor % 10 === 0;

        // Tipe monster & nama
        let enemyType = 'slime';
        if (isBoss) {
            enemyType = 'demon';
        } else if (floor > 20) {
            enemyType = 'dragon';
        } else if (floor > 10) {
            enemyType = 'goblin';
        }

        let enemyName = isBoss 
            ? (ui.getEmoji('dungeon_boss') || '🔥') + ' Raja Iblis Lantai ' + floor 
            : (ui.getEmoji('dungeon_monster') || '👺') + ' ' + enemyType.toUpperCase() + ' Lantai ' + floor;

        const diffHelper = require('../../../plugin/survival/difficultyHelper');
        const diffConfig = diffHelper.getDifficultyConfig(survival.rpg_state?.difficulty || 'Normal');

        let enemyMaxHp = Math.floor(50 * Math.pow(1.2, Math.floor(floor / 2)));
        if (isBoss) enemyMaxHp *= 3;
        if (diffConfig.extreme) enemyMaxHp = Math.floor(enemyMaxHp * 1.5);

        let enemyHp = enemyMaxHp;
        let playerHp = survival.hp || 100;
        
        // Pengecekan Kelas/Class
        const rpgState = survival.rpg_state || {};
        const userClass = rpgState.class; // warrior, mage, assassin

        // Terapkan Bonus Kelas
        let classMaxHpBoost = 0;
        let classStrBoost = 0;
        let classAgiBoost = 0;
        let classIntBoost = 0;
        let classLuckBoost = 0;

        if (userClass === 'warrior') {
            classMaxHpBoost = 50;
            classStrBoost = 5;
        } else if (userClass === 'mage') {
            classAgiBoost = 3;
            classIntBoost = 8;
        } else if (userClass === 'assassin') {
            classAgiBoost = 8;
            classLuckBoost = 5;
        } else if (userClass === 'ranger') {
            classAgiBoost = 5;
            classLuckBoost = 8;
        }

        const playerMaxHp = (survival.survival_level || 1) * 20 + 100 + classMaxHpBoost;
        const strength = (survival.strength || 1) + classStrBoost;
        const agility = (survival.agility || 1) + classAgiBoost;
        const intelligence = (survival.intelligence || 1) + classIntBoost;
        const luck = (survival.luck || 1) + classLuckBoost;

        // Hitung damage base normal
        const weaponDmg = (profile.weapon_level || 1) * 10 + (strength * 3);
        const dodgeChance = Math.min(50, agility * 2);

        // Helper untuk merender adegan pertempuran
        const buildBattleMessage = async (roundLogText) => {
            const playerInfo = {
                username: user.username,
                avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
                hp: playerHp,
                maxHp: playerMaxHp,
                stamina: survival.stamina,
                class: userClass || 'No Class'
            };

            const enemyInfo = {
                name: isBoss ? `Boss: ${enemyType.toUpperCase()}` : enemyType.toUpperCase(),
                type: enemyType,
                hp: enemyHp,
                maxHp: enemyMaxHp
            };

            const imageBuffer = await drawBattle(playerInfo, enemyInfo, roundLogText);
            const attachment = new AttachmentBuilder(imageBuffer, { name: 'battle.png' });

            let tipsFooter = ui.getFooter('survival');
            if (!userClass) {
                tipsFooter += ' • 💡 Tips: Pilih kelas dengan /survival class untuk membuka skill tempur!';
            }

            const battlePayload = buildContainerV2({
                accentColorHex: isBoss ? ui.getColor('danger') : ui.getColor('warning'),
                title: `${ui.getEmoji('battle') || '⚔️'} Infinite Dungeon - Lantai ${floor}`,
                bannerAttachmentName: 'battle.png',
                footerText: tipsFooter
            });

            // Atur tombol aksi
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('dungeon_attack').setLabel('Serang').setStyle(ButtonStyle.Danger).setEmoji(ui.getEmoji('dagger') || '🗡️')
            );

            if (userClass) {
                let skillName = '';
                let skillCost = 0;
                if (userClass === 'warrior') { skillName = 'Iron Slash'; skillCost = 15; }
                else if (userClass === 'mage') { skillName = 'Fireball'; skillCost = 25; }
                else if (userClass === 'assassin') { skillName = 'Shadow Strike'; skillCost = 20; }
                else if (userClass === 'ranger') { skillName = 'Piercing Arrow'; skillCost = 15; }

                const skillButton = new ButtonBuilder()
                    .setCustomId('dungeon_skill')
                    .setLabel(`${skillName} (${skillCost} SP)`)
                    .setStyle(ButtonStyle.Primary)
                    .setEmoji(ui.getEmoji('sparkle') || '✨');

                if (survival.stamina < skillCost) {
                    skillButton.setDisabled(true);
                }
                row.addComponents(skillButton);
            }

            row.addComponents(
                new ButtonBuilder().setCustomId('dungeon_flee').setLabel('Kabur').setStyle(ButtonStyle.Secondary).setEmoji(ui.getEmoji('run') || '🏃')
            );

            return { ...battlePayload, files: [attachment], components: [row] };
        };

        const initialLog = `Kamu berhadapan dengan ${enemyName}!\nPersiapkan senjatamu!`;
        const initialPayload = await buildBattleMessage(initialLog);
        
        const response = await interaction.reply(initialPayload);
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 90000 });

        collector.on('collect', async i => {
            if (i.customId === 'dungeon_flee') {
                await i.deferUpdate();
                collector.stop();

                const fleeSuccess = (Math.random() * 100) < (50 + agility);
                if (fleeSuccess) {
                    const fleePayload = buildContainerV2({ accentColorHex: ui.getColor('secondary') || '#6b7280', title: 'Berhasil Lari', description: '🏃 Dengan kelincahanmu, kamu berhasil lari keluar dari gua tanpa terluka.', footerText: ui.getFooter('survival') });
                    return i.editReply({ ...fleePayload, components: [], files: [] });
                } else {
                    const penDmg = Math.floor(10 + (floor * 2));
                    survival.hp = Math.max(1, survival.hp - penDmg);
                    await survival.save();
                    const failFlee = buildErrorContainerV2({ title: 'Gagal Lari', description: `🏃 Kamu tersandung saat kabur dan diserang dari belakang! (-${penDmg} HP)`, footerText: ui.getFooter('survival') });
                    return i.editReply({ ...failFlee, components: [], files: [] });
                }
            }

            if (i.customId === 'dungeon_attack' || i.customId === 'dungeon_skill') {
                await i.deferUpdate();

                let pDamage = 0;
                let logText = '';
                let skillCost = 0;

                if (i.customId === 'dungeon_attack') {
                    // Normal Attack
                    pDamage = Math.floor(weaponDmg * (0.8 + Math.random() * 0.4));
                    logText = `${ui.getEmoji('battle') || '⚔️'} Kamu menebas musuh memberikan **${pDamage}** damage!`;
                } else if (i.customId === 'dungeon_skill') {
                    // Skill Attack
                    if (userClass === 'warrior') {
                        skillCost = 15;
                        pDamage = Math.floor(weaponDmg * 1.8 * (0.8 + Math.random() * 0.4));
                        logText = `🛡️ [Iron Slash] Kamu menebas perisai musuh memberikan **${pDamage}** damage!`;
                    } else if (userClass === 'mage') {
                        skillCost = 25;
                        const magicDmg = (profile.weapon_level || 1) * 8 + (intelligence * 4);
                        pDamage = Math.floor(magicDmg * 2.2 * (0.8 + Math.random() * 0.4));
                        logText = `🔮 [Fireball] Kamu menembakkan bola api raksasa memberikan **${pDamage}** damage!`;
                    } else if (userClass === 'assassin') {
                        skillCost = 20;
                        const hitChance = 70 + agility * 1;
                        if (Math.random() * 100 < hitChance) {
                            const critChance = 30 + luck * 2;
                            const isCrit = Math.random() * 100 < critChance;
                            const multiplier = isCrit ? 2.5 : 1.2;
                            pDamage = Math.floor(weaponDmg * multiplier * (0.8 + Math.random() * 0.4));
                            logText = isCrit 
                                ? `💥 [Shadow Strike - CRITICAL!] Tebasan bayangan mematikan memberikan **${pDamage}** damage!`
                                : `🗡️ [Shadow Strike] Tebasan cepat di balik bayangan memberikan **${pDamage}** damage!`;
                        } else {
                            pDamage = 0;
                            logText = `💨 [Shadow Strike - MISSED] Serangan bayanganmu meleset dari musuh!`;
                        }
                    } else if (userClass === 'ranger') {
                        skillCost = 15;
                        const hitChance = 85 + agility * 2;
                        if (Math.random() * 100 < hitChance) {
                            pDamage = Math.floor(weaponDmg * 1.5 * (0.9 + Math.random() * 0.2));
                            logText = `🏹 [Piercing Arrow] Anak panah menembus pertahanan musuh dengan akurasi tinggi memberikan **${pDamage}** damage!`;
                        } else {
                            pDamage = 0;
                            logText = `💨 [Piercing Arrow - MISSED] Musuh terlalu gesit, anak panahmu meleset!`;
                        }
                    }

                    // Potong stamina
                    survival.stamina = Math.max(0, survival.stamina - skillCost);
                }

                enemyHp -= pDamage;

                if (enemyHp <= 0) {
                    collector.stop();

                    // Update Quest Progress
                    try {
                        const { incrementQuestProgress } = require('../../../plugin/survival/questGenerator');
                        await incrementQuestProgress(user.id, 'dungeon');
                        
                        const UserQuest = require('../../../src/models/UserQuest');
                        const today = new Date().toISOString().split('T')[0];
                        let [quest] = await UserQuest.findOrCreate({ where: { userId: user.id }, defaults: { lastReset: today } });
                        if (quest.lastReset !== today) {
                            quest.workCount = 0; quest.dungeonKills = 0; quest.collectCount = 0; quest.isClaimed = false; quest.lastReset = today;
                        }
                        quest.dungeonKills++;
                        await quest.save();
                    } catch(e) {}

                    const rewardMoney = Math.floor((isBoss ? floor * 100 : floor * 20) * diffConfig.coinMultiplier);
                    const rewardXp = Math.floor((isBoss ? floor * 50 : floor * 10) * diffConfig.expMultiplier);

                    const loots = getDungeonLoot(floor, luck);
                    let lootText = loots.length > 0 ? loots.map(l => `- **${l.name}**`).join('\n') : '*Tidak ada drop item*';

                    survival.starFragments = (survival.starFragments || 0) + rewardMoney;
                    profile.dungeon_floor = floor + 1;

                    let inv = safeParseInventory(profile.inventory);
                    for(const loot of loots) {
                        const existing = inv.find(x => x.id === loot.id);
                        if(existing) existing.amount = (existing.amount || 1) + 1;
                        else inv.push({ id: loot.id, name: loot.name, amount: 1 });
                    }
                    profile.inventory = inv;

                    // Pulihkan HP player ke data survival yang aman
                    survival.hp = Math.max(1, playerHp);

                    await profile.save();
                    await survival.save();
                    await advanceTime(user.id, 1);
                    await leveling.addPlayerXP(user.id, rewardXp);

                    const eNsf = ui.getEmoji('nsf') || '🪙';
                    const winPayload = buildContainerV2({
                        accentColorHex: ui.getColor('success') || '#22c55e',
                        title: '🎉 Pertarungan Menang!',
                        description: `Kamu mengalahkan **${enemyName}**!\n\nNaura Star Fragment: **+${rewardMoney}** ${eNsf} **Naura Star Fragment**\nXP: **+${rewardXp}**\n\n**Loot Drop:**\n${lootText}\n\nMenuju lantai ${floor + 1}...`,
                        footerText: ui.getFooter('survival')
                    });

                    return i.editReply({ ...winPayload, components: [], files: [] });
                }

                // Enemy attacks back
                let eDamage = Math.floor((isBoss ? floor * 5 : floor * 2) * (0.8 + Math.random() * 0.4));
                if (diffConfig.extreme) eDamage = Math.floor(eDamage * 1.5);

                // Cek Dodge
                let dodgeMsg = '';
                if ((Math.random() * 100) < dodgeChance) {
                    eDamage = 0;
                    dodgeMsg = `\n💨 **DODGE!** Kelincahanmu berhasil menghindari serangan musuh!`;
                }

                playerHp -= eDamage;

                if (playerHp <= 0) {
                    collector.stop();
                    survival.hp = 1;
                    survival.currentLocation = 'village';
                    await survival.save();
                    await advanceTime(user.id, 4); // Pingsan lama

                    const losePayload = buildContainerV2({
                        accentColorHex: ui.getColor('error') || '#ef4444',
                        title: '💀 Terbunuh di Dungeon',
                        description: `Kamu dikalahkan oleh **${enemyName}**!\nGatot menyelamatkanmu dan menyeretmu ke luar gua. Kamu kehilangan banyak energi.`,
                        footerText: ui.getFooter('survival')
                    });

                    return i.editReply({ ...losePayload, components: [], files: [] });
                }

                // Simpan HP & Stamina terbaru sementara dalam ronde
                logText += `\n💥 Musuh membalas memberikan **${eDamage}** damage!${dodgeMsg}`;
                
                // Update survival model agar data tetap presisi jika terputus
                survival.hp = playerHp;
                await survival.save();

                // Render Canvas baru
                const nextPayload = await buildBattleMessage(logText);
                await i.editReply(nextPayload);
            }
        });

        collector.on('end', collected => {
            if(collected.size === 0) {
                interaction.editReply({ components: [] }).catch(()=>{});
            }
        });
    }
};
