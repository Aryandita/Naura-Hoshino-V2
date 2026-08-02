// Lokasi: plugin/survival/subcommands/duel.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const { drawDuel } = require('../../../plugin/canvas/duelCanvas');

module.exports = {
    async execute(interaction, client) {
        const challenger = interaction.user;
        const opponent = interaction.options.getUser('lawan');
        const wager = interaction.options.getInteger('taruhan') || 0;

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal Duel', description: `${ui.getEmoji('error') || '❌'} ${msg}`, footerText: ui.getFooter('survival') });

        // 1. Validasi Awal
        if (opponent.bot) {
            return interaction.reply({ ...errEmbed('Kamu tidak bisa menantang bot!'), ephemeral: true });
        }
        if (opponent.id === challenger.id) {
            return interaction.reply({ ...errEmbed('Kamu tidak bisa menantang dirimu sendiri!'), ephemeral: true });
        }

        // Cek pendaftaran dan stats kedua pemain
        const p1Profile = await cacheManager.getUserProfile(challenger.id);
        const p2Profile = await cacheManager.getUserProfile(opponent.id);
        const [p1Survival] = await UserSurvival.findOrCreate({ where: { userId: challenger.id } });
        const [p2Survival] = await UserSurvival.findOrCreate({ where: { userId: opponent.id } });

        const p1HasStarted = (p1Profile.inventory || []).some(item => item && item.id === 'survival_started');
        const p2HasStarted = (p2Profile.inventory || []).some(item => item && item.id === 'survival_started');

        if (!p1HasStarted) {
            return interaction.reply({ ...errEmbed('Kamu belum memulai petualangan! Gunakan `/survival start` terlebih dahulu.'), ephemeral: true });
        }
        if (!p2HasStarted) {
            return interaction.reply({ ...errEmbed(`**${opponent.username}** belum terdaftar di dunia RPG. Minta lawanmu menggunakan '/survival start' terlebih dahulu.`), ephemeral: true });
        }

        // Cek HP dan Stamina
        if (p1Survival.hp <= 20 || p1Survival.stamina <= 20) {
            return interaction.reply({ ...errEmbed('Kondisi fisikmu terlalu lemah untuk bertarung! Pulihkan HP dan Stamina dulu.'), ephemeral: true });
        }
        if (p2Survival.hp <= 20 || p2Survival.stamina <= 20) {
            return interaction.reply({ ...errEmbed(`Kondisi fisik **${opponent.username}** terlalu lemah untuk diajak duel.`), ephemeral: true });
        }

        // Cek Koin Taruhan
        if (wager > 0) {
            if (p1Profile.economy_wallet < wager) {
                return interaction.reply({ ...errEmbed(`Naura Coin kamu tidak cukup untuk bertaruh sebesar 🪙 **${wager.toLocaleString()}**!`), ephemeral: true });
            }
            if (p2Profile.economy_wallet < wager) {
                return interaction.reply({ ...errEmbed(`Naura Coin **${opponent.username}** tidak cukup untuk mengimbangi taruhanmu!`), ephemeral: true });
            }
        }

        // ==========================================
        // 📨 FASE UNDANGAN DUEL
        // ==========================================
        const invitePayload = buildContainerV2({
            accentColorHex: ui.getColor('warning') || '#f59e0b',
            title: '⚔️ TANTANGAN DUEL BATTLE ARENA ⚔️',
            description: `Hai <@${opponent.id}>! Kamu ditantang oleh <@${challenger.id}> untuk berduel di Battle Arena!\n\n**Taruhan:** ${wager > 0 ? `🪙 **${wager.toLocaleString()} Naura Coin**` : 'Persahabatan / Tanpa Taruhan'}\n\nApakah kamu berani menerima tantangan duel maut ini?`,
            footerText: ui.getFooter('survival')
        });

        const inviteMessage = await interaction.reply({ content: `<@${opponent.id}>`, ...invitePayload, components: [inviteRow] });

        const inviteCollector = inviteMessage.createMessageComponentCollector({
            filter: i => i.user.id === opponent.id,
            time: 30000
        });

        inviteCollector.on('collect', async i => {
            if (i.customId === 'duel_decline') {
                inviteCollector.stop('declined');
                return;
            }

            if (i.customId === 'duel_accept') {
                inviteCollector.stop('accepted');
            }
        });

        inviteCollector.on('end', async (collected, reason) => {
            if (reason === 'declined') {
                return interaction.editReply({ content: `❌ <@${opponent.id}> menolak tantangan duel dari <@${challenger.id}>.`, embeds: [], components: [] });
            }
            if (reason === 'time') {
                return interaction.editReply({ content: `⌛ Tantangan duel kedaluwarsa karena tidak ada respons dari <@${opponent.id}>.`, embeds: [], components: [] });
            }

            if (reason === 'accepted') {
                // Tarik taruhan koin (Hold)
                if (wager > 0) {
                    // Refresh data wallet terbaru sebelum memotong
                    await p1Profile.reload();
                    await p2Profile.reload();
                    if (p1Profile.economy_wallet < wager || p2Profile.economy_wallet < wager) {
                        return interaction.editReply({ content: '❌ Sesi dibatalkan karena salah satu pemain tidak lagi memiliki koin taruhan yang cukup.', embeds: [], components: [] });
                    }
                    await p1Profile.decrement('economy_wallet', { by: wager });
                    await p2Profile.decrement('economy_wallet', { by: wager });
                }

                // ==========================================
                // 🎮 PERSIAPAN DATA PERTEMPURAN
                // ==========================================
                const p1Class = p1Survival.rpg_state?.class || null;
                const p2Class = p2Survival.rpg_state?.class || null;

                // Terapkan Bonus Kelas P1
                let p1HpBoost = 0, p1StrBoost = 0, p1AgiBoost = 0, p1IntBoost = 0, p1LuckBoost = 0;
                if (p1Class === 'warrior') { p1HpBoost = 50; p1StrBoost = 5; }
                else if (p1Class === 'mage') {
                    p1AgiBoost = 3;
                    p1IntBoost = 8;
                } else if (p1Class === 'assassin') {
                    p1AgiBoost = 8;
                    p1LuckBoost = 5;
                } else if (p1Class === 'ranger') {
                    p1AgiBoost = 5;
                    p1LuckBoost = 8;
                }

                // Terapkan Bonus Kelas P2
                let p2HpBoost = 0, p2StrBoost = 0, p2AgiBoost = 0, p2IntBoost = 0, p2LuckBoost = 0;
                if (p2Class === 'warrior') { p2HpBoost = 50; p2StrBoost = 5; }
                else if (p2Class === 'mage') {
                    p2AgiBoost = 3;
                    p2IntBoost = 8;
                } else if (p2Class === 'assassin') {
                    p2AgiBoost = 8;
                    p2LuckBoost = 5;
                } else if (p2Class === 'ranger') {
                    p2AgiBoost = 5;
                    p2LuckBoost = 8;
                }

                const p1MaxHp = (p1Survival.survival_level || 1) * 20 + 100 + p1HpBoost;
                const p2MaxHp = (p2Survival.survival_level || 1) * 20 + 100 + p2HpBoost;

                const battleData = {
                    p1: {
                        id: challenger.id,
                        username: challenger.username,
                        avatarUrl: challenger.displayAvatarURL({ extension: 'png', size: 128 }),
                        maxHp: p1MaxHp,
                        hp: Math.min(p1MaxHp, p1Survival.hp),
                        stamina: p1Survival.stamina,
                        class: p1Class,
                        strength: (p1Survival.strength || 1) + p1StrBoost,
                        agility: (p1Survival.agility || 1) + p1AgiBoost,
                        intelligence: (p1Survival.intelligence || 1) + p1IntBoost,
                        luck: (p1Survival.luck || 1) + p1LuckBoost,
                        weaponDmg: (p1Profile.weapon_level || 1) * 10 + ((p1Survival.strength || 1) + p1StrBoost) * 3
                    },
                    p2: {
                        id: opponent.id,
                        username: opponent.username,
                        avatarUrl: opponent.displayAvatarURL({ extension: 'png', size: 128 }),
                        maxHp: p2MaxHp,
                        hp: Math.min(p2MaxHp, p2Survival.hp),
                        stamina: p2Survival.stamina,
                        class: p2Class,
                        strength: (p2Survival.strength || 1) + p2StrBoost,
                        agility: (p2Survival.agility || 1) + p2AgiBoost,
                        intelligence: (p2Survival.intelligence || 1) + p2IntBoost,
                        luck: (p2Survival.luck || 1) + p2LuckBoost,
                        weaponDmg: (p2Profile.weapon_level || 1) * 10 + ((p2Survival.strength || 1) + p2StrBoost) * 3
                    },
                    round: 1,
                    currentTurn: 1, // 1 = P1, 2 = P2
                    log: `Pertarungan dimulai!\nGiliran ${challenger.username} untuk menyerang.`
                };

                // Helper untuk merender interface game
                const renderGameMessage = async (pLog) => {
                    const canvasBuffer = await drawDuel(battleData.p1, battleData.p2, pLog);
                    const attachment = new AttachmentBuilder(canvasBuffer, { name: 'duel.png' });

                    const activePlayer = battleData.currentTurn === 1 ? battleData.p1 : battleData.p2;

                    const duelPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `⚔️ Battle Arena - Round ${battleData.round}`,
                        description: `Giliran: <@${activePlayer.id}> (**${activePlayer.username}**)`,
                        bannerAttachmentName: 'duel.png',
                        footerText: ui.getFooter('survival')
                    });

                    return { content: `<@${battleData.p1.id}> vs <@${battleData.p2.id}>`, ...duelPayload, files: [attachment], components: [row] };
                };

                // Mulai Game
                const gamePayload = await renderGameMessage(battleData.log);
                const gameMessage = await interaction.editReply(gamePayload);

                const gameCollector = gameMessage.createMessageComponentCollector({
                    filter: i => i.user.id === battleData.p1.id || i.user.id === battleData.p2.id,
                    time: 240000 // Total waktu 4 menit
                });

                let winnerId = null;

                const runTurn = async (interactionBtn, action) => {
                    const activeIndex = battleData.currentTurn === 1 ? 'p1' : 'p2';
                    const targetIndex = battleData.currentTurn === 1 ? 'p2' : 'p1';

                    const active = battleData[activeIndex];
                    const target = battleData[targetIndex];

                    if (interactionBtn.user.id !== active.id) {
                        return interactionBtn.reply({ content: `${ui.getEmoji('error') || '❌'} Ini bukan giliranmu! Sabar ya.`, ephemeral: true });
                    }

                    await interactionBtn.deferUpdate();

                    let damage = 0;
                    let actionLog = '';
                    let staminaCost = 0;

                    if (action === 'attack') {
                        // Serangan Biasa
                        const baseDmg = active.weaponDmg;
                        damage = Math.floor(baseDmg * (0.85 + Math.random() * 0.3));

                        // Cek Dodge
                        const dodgeChance = Math.min(45, target.agility * 1.5);
                        const isDodged = (Math.random() * 100) < dodgeChance;

                        if (isDodged) {
                            actionLog = `🛡️ ${target.username} berhasil menghindari tebasan dari ${active.username}!`;
                        } else {
                            // Cek Crit
                            const critChance = Math.min(50, active.luck * 1.5);
                            const isCrit = (Math.random() * 100) < critChance;
                            if (isCrit) {
                                damage = Math.floor(damage * 1.6);
                                actionLog = `💥 CRITICAL! ${active.username} menebas ${target.username} sebesar ${damage} HP!`;
                            } else {
                                actionLog = `🗡️ ${active.username} menyerang ${target.username} sebesar ${damage} HP!`;
                            }
                            target.hp = Math.max(0, target.hp - damage);
                        }

                        // Pulihkan stamina dikit
                        active.stamina = Math.min(100, active.stamina + 8);
                    }

                    else if (action === 'skill') {
                        // Serangan Skill
                        if (active.class === 'warrior') {
                            staminaCost = 15;
                            const baseDmg = active.weaponDmg * 1.8;
                            damage = Math.floor(baseDmg * (0.9 + Math.random() * 0.2));
                            active.stamina -= staminaCost;
                            target.hp = Math.max(0, target.hp - damage);
                            actionLog = `🛡️ [Iron Slash] ${active.username} menghantam tameng baja ke ${target.username} sebesar ${damage} HP!`;
                        } 
                        else if (active.class === 'mage') {
                            staminaCost = 25;
                            // Magic damage scaling INT
                            const magicDmg = (active.intelligence * 4.5) + (active.weaponDmg * 1.1);
                            damage = Math.floor(magicDmg * (0.9 + Math.random() * 0.25));
                            active.stamina -= staminaCost;
                            target.hp = Math.max(0, target.hp - damage);
                            actionLog = `🔥 [Fireball] ${active.username} merapal sihir api dan meledakkan ${target.username} sebesar ${damage} HP!`;
                        } 
                        else if (active.class === 'assassin') {
                            staminaCost = 20;
                            const baseDmg = active.weaponDmg * 2.2;
                            damage = Math.floor(baseDmg * (0.8 + Math.random() * 0.4));
                            active.stamina -= staminaCost;

                            const dodgeChance = Math.min(45, target.agility * 1.5);
                            const isDodged = (Math.random() * 100) < dodgeChance;

                            if (isDodged) {
                                actionLog = `💨 [Shadow Strike] ${active.username} menyerang dari bayangan namun ${target.username} sangat lincah dan meloloskan diri!`;
                            } else {
                                target.hp = Math.max(0, target.hp - damage);
                                actionLog = `🗡️ [Shadow Strike] ${active.username} menikam titik vital ${target.username} secara mematikan sebesar ${damage} HP!`;
                            }
                        }
                        else if (active.class === 'ranger') {
                            staminaCost = 15;
                            const baseDmg = active.weaponDmg * 1.5;
                            damage = Math.floor(baseDmg * (0.9 + Math.random() * 0.2));
                            active.stamina -= staminaCost;

                            const hitChance = 85 + active.agility * 2;
                            if (Math.random() * 100 < hitChance) {
                                target.hp = Math.max(0, target.hp - damage);
                                actionLog = `🏹 [Piercing Arrow] ${active.username} melesatkan panah menembus pertahanan ${target.username} sebesar ${damage} HP!`;
                            } else {
                                actionLog = `💨 [Piercing Arrow] Anak panah ${active.username} meleset karena ${target.username} terlalu gesit!`;
                            }
                        }
                    }

                    // Cek jika K.O.
                    if (target.hp <= 0) {
                        winnerId = active.id;
                        gameCollector.stop('ko');
                        return;
                    }

                    // Lanjut turn berikutnya
                    battleData.currentTurn = battleData.currentTurn === 1 ? 2 : 1;
                    battleData.round += 1;
                    battleData.log = actionLog + `\nSekarang giliran ${target.username}.`;

                    const nextPayload = await renderGameMessage(battleData.log);
                    await interaction.editReply(nextPayload);
                };

                gameCollector.on('collect', async interactionBtn => {
                    if (interactionBtn.customId === 'duel_flee') {
                        if (interactionBtn.user.id === battleData.p1.id) {
                            winnerId = battleData.p2.id;
                            battleData.log = `🏳️ ${battleData.p1.username} menyerah dan melambaikan bendera putih.`;
                        } else {
                            winnerId = battleData.p1.id;
                            battleData.log = `🏳️ ${battleData.p2.username} menyerah dan melambaikan bendera putih.`;
                        }
                        gameCollector.stop('flee');
                        return;
                    }

                    if (interactionBtn.customId === 'duel_attack') {
                        await runTurn(interactionBtn, 'attack');
                    } else if (interactionBtn.customId === 'duel_skill') {
                        await runTurn(interactionBtn, 'skill');
                    }
                });

                gameCollector.on('end', async (collected, reason) => {
                    // 1. Jika ada pemenang (K.O. atau Flee)
                    if (winnerId) {
                        const isP1Winner = winnerId === battleData.p1.id;
                        const winner = isP1Winner ? battleData.p1 : battleData.p2;
                        const loser = isP1Winner ? battleData.p2 : battleData.p1;

                        // Berikan Koin Taruhan ke pemenang
                        if (wager > 0) {
                            const totalWin = wager * 2;
                            const wProf = isP1Winner ? p1Profile : p2Profile;
                            await wProf.increment('economy_wallet', { by: totalWin });
                            wProf.minigame_duelScore = (wProf.minigame_duelScore || 0) + 10;
                            await wProf.save();
                        }

                        // Kurangi stats HP & Stamina di Database berdasarkan hasil akhir pertarungan
                        p1Survival.hp = Math.max(20, battleData.p1.hp);
                        p1Survival.stamina = Math.max(20, battleData.p1.stamina);
                        await p1Survival.save();

                        p2Survival.hp = Math.max(20, battleData.p2.hp);
                        p2Survival.stamina = Math.max(20, battleData.p2.stamina);
                        await p2Survival.save();

                        // Canvas Hasil Akhir
                        battleData.log = `${battleData.log}\n🏆 PERTARUNGAN SELESAI!\nPemenang: ${winner.username}`;
                        const finalBuffer = await drawDuel(battleData.p1, battleData.p2, battleData.log);
                        const finalAttachment = new AttachmentBuilder(finalBuffer, { name: 'duel_final.png' });

                        const rewardEmoji = ui.getEmoji('trophy') || '🏆';
                        const coinEmoji = ui.getEmoji('coin') || '🪙';

                        const winPayload = buildContainerV2({
                            accentColorHex: ui.getColor('success') || '#22c55e',
                            title: '🏆 PEMENANG ARENA BATTLE DUEL 🏆',
                            description: `Selamat kepada <@${winner.id}> (**${winner.username}**) atas kemenangan mutlak di Battle Arena!\n\n💀 **Kondisi Loser:** K.O. / Kalah Telak\n💰 **Total Hadiah:** ${wager > 0 ? `${coinEmoji} **${(wager * 2).toLocaleString()} Naura Coin**` : 'Penghormatan & Gengsi Arena'}\n🔥 **Bonus Jawara:** +10 Poin Master Duel`,
                            bannerAttachmentName: 'duel_final.png',
                            footerText: ui.getFooter('survival')
                        });

                        await interaction.editReply({ content: `🏆 Duel berakhir! Pemenang: <@${winner.id}>`, ...winPayload, files: [finalAttachment], components: [] });
                    } 
                    
                    // 2. Jika Timeout (Salah satu afk / waktu habis)
                    else {
                        // Kembalikan dana taruhan
                        if (wager > 0) {
                            await p1Profile.increment('economy_wallet', { by: wager });
                            await p2Profile.increment('economy_wallet', { by: wager });
                        }
                        await interaction.editReply({ content: `⏳ **Duel dibatalkan** karena salah satu pemain tidak merespons giliran dalam waktu batas (atau durasi maksimal 4 menit terlampaui). Taruhan telah dikembalikan.`, embeds: [], files: [], components: [] });
                    }
                });
            }
        });
    }
};
