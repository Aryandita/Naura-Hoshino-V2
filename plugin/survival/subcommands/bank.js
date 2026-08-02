// Lokasi: plugin/survival/subcommands/bank.js
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');

// Configuration for Deposit Terms (in-game days)
const DEPOSIT_TERMS = {
    '1_month': { days: 30, rate: 0.02, name: '1 Bulan In-game (Bunga 2%)', text: '1 Bulan In-game (30 hari)' },
    '4_months': { days: 120, rate: 0.10, name: '4 Bulan In-game (Bunga 10%)', text: '4 Bulan In-game (120 hari)' },
    '8_months': { days: 240, rate: 0.20, name: '8 Bulan In-game (Bunga 20%)', text: '8 Bulan In-game (240 hari)' },
    '12_months': { days: 360, rate: 0.30, name: '12 Bulan In-game (Bunga 30%)', text: '12 Bulan In-game (360 hari)' }
};

// Investment Portfolios Configuration
const INVEST_ASSETS = {
    gold: {
        id: 'gold',
        name: 'Naura Mutual Gold (Reksa Dana Emas)',
        riskLabel: 'Sangat Rendah / Very Low',
        riskEmojiKey: 'diff_easy',
        fallbackEmoji: '🟢',
        desc: 'Investasi emas berjangka aman dengan pertumbuhan stabil.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            return Math.floor(principal + principal * days * 0.012);
        }
    },
    prop: {
        id: 'prop',
        name: 'Naura Property Trust (Properti)',
        riskLabel: 'Rendah / Low',
        riskEmojiKey: 'diff_easy',
        fallbackEmoji: '🟢',
        desc: 'Kepemilikan aset properti desa & kota dengan fluktuasi kecil.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days) * 0.4 + 1.0;
            return Math.floor(principal + principal * days * 0.025 * factor);
        }
    },
    tech: {
        id: 'tech',
        name: 'Naura Tech & AI Index (Teknologi)',
        riskLabel: 'Sedang / Medium',
        riskEmojiKey: 'diff_normal',
        fallbackEmoji: '🟡',
        desc: 'Investasi di indeks teknologi & AI Naura dengan fluktuasi menengah.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days) * 0.8 + 0.8;
            return Math.floor(principal + principal * days * 0.04 * factor);
        }
    },
    energy: {
        id: 'energy',
        name: 'Naura Energy & Mining (Tambang/Energi)',
        riskLabel: 'Tinggi / High',
        riskEmojiKey: 'diff_extreme',
        fallbackEmoji: '🔴',
        desc: 'Perdagangan komoditas minyak dan tambang. Fluktuasi tinggi.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.cos(days) * 1.5 + 0.6;
            return Math.floor(principal + principal * days * 0.09 * factor);
        }
    },
    capital: {
        id: 'capital',
        name: 'Naura Star Capital (Modal Ventura)',
        riskLabel: 'Sangat Tinggi / Very High',
        riskEmojiKey: 'dungeon_skull',
        fallbackEmoji: '💀',
        desc: 'Pendanaan modal ventura sangat agresif. Resiko ekstrim, hasil luar biasa.',
        calcValue: (principal, days) => {
            if (days <= 0) return principal;
            const factor = Math.sin(days * 2.5) * 3.0 + 0.4;
            return Math.floor(principal + principal * days * 0.15 * factor);
        }
    }
};

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const survival = await cacheManager.getUserSurvival(user.id);

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, 'err_sys_34', true);
        }

        if (survival.currentLocation !== 'kota') {
            const errPayload = buildErrorContainerV2({
                title: 'Lokasi Salah',
                description: `${ui.getEmoji('error') || '❌'} Naura Central Bank hanya beroperasi di **Kota**. Gunakan \`/survival travel\` untuk pergi ke kota!`,
                footerText: ui.getFooter('survival')
            });
            return interaction.reply({ ...errPayload, ephemeral: true });
        }

        const eBank = ui.getEmoji('bank') || '🏦';
        const eWallet = ui.getEmoji('wallet') || '🪙';
        const eSuccess = ui.getEmoji('success') || '✅';
        const eError = ui.getEmoji('error') || '❌';
        const eCoin = ui.getEmoji('coin') || '🪙';
        const currencyName = ui.currencyName || 'Naura Coin';

        // Additional dynamic emojis loaded from ui.js
        const eLock = ui.getEmoji('lock') || '🔒';
        const eUnlock = ui.getEmoji('unlock') || '🔓';
        const eClock = ui.getEmoji('clock') || '⏳';
        const eArrow = ui.getEmoji('dot') || '➡️';
        const eStats = ui.getEmoji('stats') || '📈';
        const eDownload = ui.getEmoji('download') || '📥';
        const eUpload = ui.getEmoji('upload') || '📤';
        const eEasy = ui.getEmoji('diff_easy') || '🟢';
        const eNormal = ui.getEmoji('diff_normal') || '🟡';
        const eExtreme = ui.getEmoji('diff_extreme') || '🔴';
        const eSkull = ui.getEmoji('dungeon_skull') || '💀';
        const eRecipe = ui.getEmoji('recipe') || '📋';
        const eWin = ui.getEmoji('dungeon_win') || '🎉';
        const eWarn = ui.getEmoji('warning') || '⚠️';
        const eTax = ui.getEmoji('npc_tax') || '💸';
        const eBriefcase = ui.getEmoji('npc_briefcase') || '💼';

        // Helper to load current user data
        const getFreshData = async () => {
            const freshSurvival = await UserSurvival.findOne({ where: { userId: user.id } });
            const freshProfile = await cacheManager.getUserProfile(user.id);
            return { survival: freshSurvival, profile: freshProfile };
        };

        const renderMainMenu = async () => {
            const { survival: s, profile: p } = await getFreshData();
            const walletNSF = s.starFragments || 0;
            const bankNC = p.economy_bank || 0;

            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId('bank_menu_savings').setLabel('Tabungan / Savings').setStyle(ButtonStyle.Primary).setEmoji(eWallet),
                new ButtonBuilder().setCustomId('bank_menu_deposit').setLabel('Deposito / Deposit').setStyle(ButtonStyle.Success).setEmoji(eLock),
                new ButtonBuilder().setCustomId('bank_menu_invest').setLabel('Investasi / Investment').setStyle(ButtonStyle.Secondary).setEmoji(eStats)
            );

            const economyBanner = ui.getBanner ? ui.getBanner('economy') : null;
            let files = [];
            let bannerAttachmentName;
            if (economyBanner) {
                files.push(new AttachmentBuilder(economyBanner, { name: 'banner.png' }));
                bannerAttachmentName = 'banner.png';
            }

            const mainPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `${eBank} Naura Central Bank`,
                description:
                    `Selamat datang di **Naura Central Bank**, **${user.displayName}**!\n` +
                    `Kelola keuangan petualanganmu di sini dengan aman.\n\n` +
                    `*Konversi Mata Uang Resmi: 1 Naura Coin (NC) = 100 Naura Star Fragment*\n\n` +
                    `${eWallet} **Dompet Desa:** \`${walletNSF.toLocaleString('id-ID')}\` **Naura Star Fragment**\n` +
                    `${eBank} **Tabungan Kota (Bank):** \`${bankNC.toLocaleString('id-ID')}\` **NC**`,
                buttonsRow: row,
                bannerAttachmentName,
                footerText: ui.getFooter('survival')
            });

            return { ...mainPayload, files };
        };

        const response = await interaction.reply(await renderMainMenu());
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 180000 });

        collector.on('collect', async i => {
            try {
                const customId = i.customId;

                if (customId === 'bank_back') {
                    await i.deferUpdate();
                    const payload = await renderMainMenu();
                    await i.editReply(payload);
                }

                // ==========================================
                // 1. SAVINGS TAB
                // ==========================================
                else if (customId === 'bank_menu_savings') {
                    await i.deferUpdate();
                    const { survival: s, profile: p } = await getFreshData();

                    const row = new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('bank_savings_dep').setLabel('Setor (Star Fragment -> NC)').setStyle(ButtonStyle.Success).setEmoji(eDownload),
                        new ButtonBuilder().setCustomId('bank_savings_wd').setLabel('Tarik (NC -> Star Fragment)').setStyle(ButtonStyle.Danger).setEmoji(eUpload),
                        new ButtonBuilder().setCustomId('bank_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                    );

                    const savingsPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eBank} Tabungan - Setor & Tarik`,
                        description:
                            `Disini kamu bisa menyetor fragment dari desamu ke koin kota, atau menariknya kembali.\n\n` +
                            `*Kurs Konversi: 100 Naura Star Fragment = 1 NC*\n\n` +
                            `${eWallet} **Dompet Desa:** \`${(s.starFragments || 0).toLocaleString('id-ID')}\` **Naura Star Fragment**\n` +
                            `${eBank} **Tabungan Kota:** \`${(p.economy_bank || 0).toLocaleString('id-ID')}\` **NC**`,
                        buttonsRow: row,
                        footerText: ui.getFooter('survival')
                    });

                    await i.editReply({ ...savingsPayload, files: [] });
                }

                else if (customId === 'bank_savings_dep' || customId === 'bank_savings_wd') {
                    await i.deferUpdate();
                    const isDeposit = customId === 'bank_savings_dep';
                    
                    const promptPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eBank} Transaksi ${isDeposit ? 'Setor' : 'Tarik'}`,
                        description: isDeposit
                            ? `Ketik jumlah **Naura Star Fragment** yang ingin kamu setor di chat (minimal 100):\n*100 NSF = 1 NC*\n\nWaktu menjawab: 30 detik.`
                            : `Ketik jumlah **Naura Coin (NC)** yang ingin kamu tarik di chat:\n*1 NC = 100 NSF*\n\nWaktu menjawab: 30 detik.`,
                        footerText: ui.getFooter('survival')
                    });

                    await i.editReply({ ...promptPayload, files: [] });

                    if (interaction.channel) {
                        const chatFilter = m => m.author.id === user.id;
                        const chatCollector = interaction.channel.createMessageCollector({ filter: chatFilter, time: 30000, max: 1 });

                        chatCollector.on('collect', async m => {
                            try {
                                const amt = parseInt(m.content.trim());
                                const { survival: freshSurv, profile: freshProf } = await getFreshData();

                                if (isDeposit) {
                                    if (isNaN(amt) || amt < 100) {
                                        const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Jumlah setor tidak valid! Minimal setor adalah 100 Naura Star Fragment.`, footerText: ui.getFooter('survival') });
                                        await m.reply(ep);
                                        return;
                                    }
                                    if ((freshSurv.starFragments || 0) < amt) {
                                        const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Naura Star Fragment di dompet desa kamu tidak cukup!`, footerText: ui.getFooter('survival') });
                                        await m.reply(ep);
                                        return;
                                    }

                                    const ncGained = Math.floor(amt / 100);
                                    const nsfUsed = ncGained * 100;

                                    freshSurv.starFragments -= nsfUsed;
                                    await freshSurv.save();
                                    await freshProf.increment('economy_bank', { by: ncGained });

                                    const successPayload = buildContainerV2({
                                        accentColorHex: ui.getColor('success') || '#22c55e',
                                        title: `${eSuccess} Setor Berhasil!`,
                                        description: `Kamu menukarkan **${nsfUsed.toLocaleString('id-ID')} Naura Star Fragment** menjadi **+${ncGained.toLocaleString('id-ID')} NC** di Tabungan Kota!`,
                                        footerText: ui.getFooter('survival')
                                    });

                                    await m.reply(successPayload);
                                } else {
                                    // Withdraw logic here
                                }
                            } catch (err) {
                                logger.error('[Bank Savings Collect Error]', err);
                            } finally {
                                const payload = await renderMainMenu();
                                await interaction.editReply({ embeds: payload.embeds, components: payload.components, files: payload.files || [] });
                            }
                        });

                        chatCollector.on('end', async collected => {
                            if (collected.size === 0) {
                                const toPayload = buildErrorContainerV2({ title: 'Waktu Habis', description: `${eClock} Waktu transaksi habis.`, footerText: ui.getFooter('survival') });
                                await interaction.followUp({ ...toPayload, ephemeral: true }).catch(() => {});
                                const payload = await renderMainMenu();
                                await interaction.editReply({ embeds: payload.embeds, components: payload.components, files: payload.files || [] });
                            }
                        });
                    }
                }

                // ==========================================
                // 2. DEPOSIT TAB
                // ==========================================
                else if (customId === 'bank_menu_deposit') {
                    await i.deferUpdate();
                    const { survival: s, profile: p } = await getFreshData();
                    let dep = p.economy_deposit || { amount: 0, unlockDay: null, interestRate: 0, termName: null };
                    
                    const depText = dep.amount > 0 
                        ? (s.inGameDay >= dep.unlockDay ? `${eEasy} **Siap Dicairkan (Hari ke-${dep.unlockDay})**` : `${eClock} **Terkunci** (Sisa ${dep.unlockDay - (s.inGameDay || 1)} hari)`)
                        : 'Tidak ada deposito aktif';

                    const row = dep.amount > 0
                        ? new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bank_dep_claim').setLabel('Cairkan Deposito').setStyle(ButtonStyle.Success).setEmoji(eUnlock),
                            new ButtonBuilder().setCustomId('bank_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                        )
                        : new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId('bank_dep_create_1_month').setLabel('Bronze (1 Bln)').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bank_dep_create_4_months').setLabel('Silver (4 Bln)').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bank_dep_create_8_months').setLabel('Gold (8 Bln)').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bank_dep_create_12_months').setLabel('Platinum (12 Bln)').setStyle(ButtonStyle.Primary),
                            new ButtonBuilder().setCustomId('bank_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                        );

                    const depPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eLock} Deposito Berjangka (Fixed Deposit)`,
                        description: `Simpan uangmu dalam jangka waktu tertentu untuk mendapatkan keuntungan bunga pasif!\n\n${eBank} **Tabungan NC:** \`${(p.economy_bank || 0).toLocaleString('id-ID')}\` **NC**\n🔒 **Status Deposito:** ${depText}`,
                        buttonsRow: row,
                        footerText: ui.getFooter('survival')
                    });
                    await i.editReply({ ...depPayload, files: [] });
                }

                else if (customId.startsWith('bank_dep_create_')) {
                    await i.deferUpdate();
                    const termKey = customId.replace('bank_dep_create_', '');
                    
                    const promptPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eLock} Buka Deposito Baru`,
                        description: `Ketik jumlah **NC** yang ingin kamu simpan dalam deposito di chat (minimal 100 NC):\n\nWaktu menjawab: 30 detik.`,
                        footerText: ui.getFooter('survival')
                    });

                    await i.editReply({ ...promptPayload, components: [], files: [] });

                    if (interaction.channel) {
                        const chatFilter = m => m.author.id === user.id;
                        const chatCollector = interaction.channel.createMessageCollector({ filter: chatFilter, time: 30000, max: 1 });

                        chatCollector.on('collect', async m => {
                            try {
                                const amt = parseInt(m.content.trim());
                                const { survival: freshSurv, profile: freshProf } = await getFreshData();

                                if (isNaN(amt) || amt < 100) {
                                    const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Jumlah deposit tidak valid! Minimal 100 NC.`, footerText: ui.getFooter('survival') });
                                    await m.reply(ep);
                                    return;
                                }
                                if ((freshProf.economy_bank || 0) < amt) {
                                    const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Saldo bank NC kamu tidak mencukupi untuk membuat deposito!`, footerText: ui.getFooter('survival') });
                                    await m.reply(ep);
                                    return;
                                }

                                await freshProf.decrement('economy_bank', { by: amt });
                                const termObj = DEPOSIT_TERMS[termKey];
                                const currentDay = freshSurv.inGameDay || 1;

                                freshProf.economy_deposit = {
                                    amount: amt,
                                    unlockDay: currentDay + termObj.days,
                                    interestRate: termObj.rate,
                                    termName: termObj.name
                                };
                                await freshProf.save();

                                const successPayload = buildContainerV2({
                                    accentColorHex: ui.getColor('success') || '#22c55e',
                                    title: `${eSuccess} Deposito Berhasil Dibuat!`,
                                    description: `Kamu menyimpan **${amt.toLocaleString('id-ID')} NC** dalam Deposito **${termObj.name}**!\n\nJatuh tempo pada Hari ke-${currentDay + termObj.days}.`,
                                    footerText: ui.getFooter('survival')
                                });

                                await m.reply(successPayload);
                            } catch (e) {}
                        });

                        chatCollector.on('end', async collected => {
                            if (collected.size === 0) {
                                const toPayload = buildErrorContainerV2({ title: 'Waktu Habis', description: `${eClock} Waktu transaksi habis.`, footerText: ui.getFooter('survival') });
                                await interaction.followUp({ ...toPayload, ephemeral: true }).catch(() => {});
                            }
                        });
                    }
                }

                else if (customId === 'bank_dep_claim') {
                    await i.deferUpdate();
                    const { survival: s, profile: p } = await getFreshData();
                    let dep = p.economy_deposit || {};

                    if (s.inGameDay >= dep.unlockDay) {
                        const reward = Math.floor(dep.amount * dep.interestRate);
                        const payoutAmount = dep.amount + reward;
                        p.economy_bank = (p.economy_bank || 0) + payoutAmount;
                        p.economy_deposit = { amount: 0, unlockDay: null, interestRate: 0, termName: null };
                        await p.save();

                            const sellPayload = buildContainerV2({
                            accentColorHex: ui.getColor('success') || '#22c55e',
                            title: `${eSuccess} Investasi Dicairkan!`,
                            description: `Hasil penjualan aset **${assetObj.name}** sebesar **${currentVal.toLocaleString('id-ID')} NC** telah dimasukkan ke Tabungan Kota!`,
                            footerText: ui.getFooter('survival')
                        });

                        await i.editReply({ ...sellPayload, components: [], files: [] });

                        await i.editReply({ ...claimPayload, files: [] });
                    }
                }

                // ==========================================
                // 3. INVESTMENT TAB
                // ==========================================
                else if (customId === 'bank_menu_invest') {
                    await i.deferUpdate();
                    const { survival: s, profile: p } = await getFreshData();
                    const curDay = s.inGameDay || 1;
                    const rpgState = s.rpg_state || {};
                    const investments = rpgState.investments || {};

                    const investMenuPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eStats} Papan Investasi`,
                        description: 'Kembangkan asetmu melalui instrumen reksa dana dan saham lokal!',
                        footerText: ui.getFooter('survival')
                    });

                    const rows = [];
                    for (const [key, assetObj] of Object.entries(INVEST_ASSETS)) {
                        const invData = investments[key] || null;
                        const hasInv = !!invData;

                        let desc = `• Resiko: ${assetObj.riskLabel} ${ui.getEmoji(assetObj.riskEmojiKey) || assetObj.fallbackEmoji}\n` +
                                   `• Deskripsi: *${assetObj.desc}*`;

                        if (hasInv) {
                            const elapsed = curDay - invData.buyDay;
                            const currentVal = assetObj.calcValue(invData.principal, elapsed);
                            const roi = (((currentVal - invData.principal) / invData.principal) * 100).toFixed(2);
                            desc += `\n\n• **Investasi Aktif:**\n  - Modal: ${invData.principal} NC\n  - Nilai Sekarang: **${currentVal} NC** (${roi}% ROI)\n  - Durasi: ${elapsed} hari`;
                        }

                        embed.addFields({ name: assetObj.name, value: desc });
                        const subRow = new ActionRowBuilder().addComponents(
                            new ButtonBuilder().setCustomId(`bank_inv_buy_${key}`).setLabel(`Beli`).setStyle(ButtonStyle.Success).setDisabled(hasInv),
                            new ButtonBuilder().setCustomId(`bank_inv_sell_${key}`).setLabel(`Jual`).setStyle(ButtonStyle.Danger).setDisabled(!hasInv)
                        );
                        rows.push(subRow);
                    }
                    rows.push(new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bank_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)));

                    await i.editReply({ ...investMenuPayload, components: rows });
                }

                else if (customId.startsWith('bank_inv_buy_')) {
                    await i.deferUpdate();
                    const assetKey = customId.replace('bank_inv_buy_', '');
                    const assetObj = INVEST_ASSETS[assetKey];
                    
                    const promptPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFB6C1',
                        title: `${eStats} Beli Portofolio: ${assetObj.name}`,
                        description: `Ketik jumlah **NC** yang ingin kamu investasikan di chat (minimal 50 NC):\n\nWaktu menjawab: 30 detik.`,
                        footerText: ui.getFooter('survival')
                    });

                    await i.editReply({ ...promptPayload, components: [] });

                    if (interaction.channel) {
                        const chatFilter = m => m.author.id === user.id;
                        const chatCollector = interaction.channel.createMessageCollector({ filter: chatFilter, time: 30000, max: 1 });

                        chatCollector.on('collect', async m => {
                            try {
                                const amt = parseInt(m.content.trim());
                                const { survival: freshSurv, profile: freshProf } = await getFreshData();

                                if (isNaN(amt) || amt < 50) {
                                    const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Jumlah investasi tidak valid! Minimal 50 NC.`, footerText: ui.getFooter('survival') });
                                    await m.reply(ep);
                                    return;
                                }
                                if ((freshProf.economy_bank || 0) < amt) {
                                    const ep = buildErrorContainerV2({ title: 'Gagal', description: `${eError} Saldo bank NC kamu tidak mencukupi untuk melakukan investasi!`, footerText: ui.getFooter('survival') });
                                    await m.reply(ep);
                                    return;
                                }

                                await freshProf.decrement('economy_bank', { by: amt });
                                const currentDay = freshSurv.inGameDay || 1;

                                let rpgState = freshSurv.rpg_state || {};
                                rpgState.investments = rpgState.investments || {};
                                rpgState.investments[assetKey] = {
                                    assetKey,
                                    principal: amt,
                                    buyDay: currentDay
                                };

                                freshSurv.rpg_state = rpgState;
                                await freshSurv.save();

                                const successPayload = buildContainerV2({
                                    accentColorHex: ui.getColor('success') || '#22c55e',
                                    title: `${eSuccess} Investasi Berhasil!`,
                                    description: `Kamu berhasil menanamkan modal sebesar **${amt.toLocaleString('id-ID')} NC** ke dalam portofolio **${assetObj.name}**!`,
                                    footerText: ui.getFooter('survival')
                                });

                                await m.reply(successPayload);
                            } catch (e) {}
                        });

                        chatCollector.on('end', async collected => {
                            if (collected.size === 0) {
                                const toPayload = buildErrorContainerV2({ title: 'Waktu Habis', description: `${eClock} Waktu transaksi habis.`, footerText: ui.getFooter('survival') });
                                await interaction.followUp({ ...toPayload, ephemeral: true }).catch(() => {});
                            }
                        });
                    }
                }

                else if (customId.startsWith('bank_inv_sell_')) {
                    await i.deferUpdate();
                    const assetKey = customId.replace('bank_inv_sell_', '');
                    const asset = INVEST_ASSETS[assetKey];

                    const { survival: s, profile: p } = await getFreshData();
                    const investments = p.economy_investments || {};
                    const invested = investments[assetKey] || 0;
                    const buyDay = investments[`${assetKey}BuyDay`] || 0;
                    const curDay = s.inGameDay || 1;

                    if (invested <= 0) {
                        await i.editReply('❌ Kamu tidak memiliki aset ini untuk dijual.');
                        return;
                    }

                    const elapsed = curDay - buyDay;
                    const currentValue = asset.calcValue(invested, elapsed);
                    const pnlVal = currentValue - invested;
                    const pnlPercent = ((currentValue - invested) / invested) * 100;

                    p.economy_bank = (p.economy_bank || 0) + currentValue;

                    // Clear assets
                    investments[assetKey] = 0;
                    investments[`${assetKey}BuyDay`] = 0;
                    p.economy_investments = investments;
                    p.changed('economy_investments', true);
                    await p.save();

                    const liqPayload = buildContainerV2({
                        accentColorHex: ui.getColor('success') || '#22c55e',
                        title: `${eTax} Likuidasi Saham Berhasil!`,
                        description: `Portofolio investasi kamu di **${asset.name}** telah berhasil dicairkan penuh ke bank!\n\n• Pokok Pembelian: **${invested.toLocaleString()}** NC\n• Lama Investasi: **${elapsed}** hari in-game\n• Total Pencairan: **${currentValue.toLocaleString()}** NC\n• Keuntungan/Kerugian: **${pnlVal >= 0 ? '+' : ''}${pnlVal.toLocaleString()}** NC (${pnlPercent.toFixed(2)}% ROI)`,
                        footerText: ui.getFooter('survival')
                    });

                    await i.editReply({ 
                        ...liqPayload, 
                        components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('bank_back').setLabel('Kembali ke Menu Utama').setStyle(ButtonStyle.Secondary))] 
                    });
                }
            } catch (error) {
                logger.error('[Bank Subcommand Event Error]', error);
            }
        });

        collector.on('end', () => {
            // Clean components on collector end
            interaction.editReply({ components: [] }).catch(() => {});
        });
    }
};