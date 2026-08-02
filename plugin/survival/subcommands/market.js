const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const itemsConfig = require('../../../plugin/survival/items');
const ui = require('../../../src/config/ui');
const { getSeason, getWeather } = require('../../../plugin/survival/survivalTime');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, 'err_sys_51', true);
        }
        if (survival.currentLocation !== 'village') {
            return ui.sendError(interaction, 'err_sys_52', true);
        }

        const eNsf = ui.getEmoji('nsf') || '🪙';
        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal', description: `${ui.getEmoji('error') || '❌'} ${msg}`, footerText: ui.getFooter('survival') });
        const successEmbed = (msg) => buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Berhasil', description: `${ui.getEmoji('success') || '✅'} ${msg}`, footerText: ui.getFooter('survival') });

        const currentDay = survival.inGameDay || 1;
        const currentHour = survival.inGameHour || 6;
        const season = getSeason(currentDay);
        const weather = getWeather(currentDay, currentHour);
        const wallet = survival.starFragments || 0;



        const rowInit = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('market_buy_init').setLabel('Beli Barang / Buy').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('shop_cart') || '🛒'),
            new ButtonBuilder().setCustomId('market_sell_init').setLabel('Jual Hasil / Sell').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('coin') || '💰')
        );

        const mainPayload = buildContainerV2({
            accentColorHex: ui.getColor('economy'),
            authorName: 'Naura Village Market (Mbak Rini)',
            title: `⚖️ Pasar Tradisional Desa`,
            iconURL: user.displayAvatarURL(),
            description:
                `Selamat datang di Pasar Tradisional Desa! Saat ini adalah **Musim ${season.name}** ${season.emoji} dengan cuaca **${weather.name}** ${weather.emoji}.\n` +
                `*Di sini dijual berbagai kebutuhan dasar dan murah untuk bertahan hidup di desa.*\n\n` +
                `${eNsf} **Dompetmu:** ${wallet.toLocaleString('id-ID')} **Naura Star Fragment**\n\n` +
                `Pilih menu transaksi di bawah ini:`,
            buttonsRow: rowInit,
            footerText: ui.getFooter('survival')
        });

        const files = [];
        const shopBanner = ui.getBanner('shop');
        if (shopBanner) {
            files.push(new AttachmentBuilder(shopBanner, { name: 'banner.png' }));
            mainPayload.bannerAttachmentName = 'banner.png';
        }
        if (files.length > 0) {
            mainPayload.files = files;
        }

        const response = await interaction.reply(mainPayload);
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 120000 });

        const categories = {
            'consumable': 'Bahan Pangan & Medis 🍎',
            'material': 'Bahan Mentah & Umpan 🪵',
            'seed': 'Benih Pertanian 🌱',
            'tools': 'Alat Kerja & Kendaraan 🚲',
            'special': 'Properti & Lahan 🏡'
        };

        const filterMenu = new StringSelectMenuBuilder()
            .setCustomId('market_category')
            .setPlaceholder('Pilih Kategori Kebutuhan...')
            .addOptions(Object.entries(categories).map(([k, v]) => ({ label: v, value: k })));

        collector.on('collect', async i => {
            // --- INISIALISASI MENU BELI ---
            if (i.customId === 'market_buy_init') {
                await i.deferUpdate();
                const buyPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: '🛒 Pasar Tradisional - Beli Barang',
                    iconURL: user.displayAvatarURL(),
                    description: `Silakan pilih kategori barang yang ingin kamu beli di bawah ini.\n\n${eNsf} **Sisa Dompet:** ${wallet.toLocaleString('id-ID')} **Naura Star Fragment**`,
                    buttonsRow: new ActionRowBuilder().addComponents(filterMenu),
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(buyPayload);
            }

            // --- INISIALISASI MENU JUAL ---
            if (i.customId === 'market_sell_init') {
                await i.deferUpdate();

                // Re-fetch to get latest inventory
                const curProfile = await cacheManager.getUserProfile(user.id);
                const currentInv = curProfile.inventory || [];
                const sellableItems = [];

                // Group inventory items by id to merge duplicates and sum their amounts
                const groupedInv = {};
                for (const invItem of currentInv) {
                    if (!invItem.id) continue;
                    groupedInv[invItem.id] = (groupedInv[invItem.id] || 0) + (invItem.amount || 1);
                }

                for (const itemId in groupedInv) {
                    const amount = groupedInv[itemId];
                    const itemConf = itemsConfig.find(x => x.id === itemId);
                    if (itemConf) {
                        let sellPrice = itemConf.sellPrice;
                        if (!sellPrice && itemConf.price) {
                            sellPrice = Math.floor(itemConf.price * 0.5);
                        }
                        if (sellPrice && sellPrice > 0) {
                            sellableItems.push({
                                id: itemId,
                                name: itemConf.name,
                                amount: amount,
                                sellPrice: sellPrice
                            });
                        }
                    }
                }

                if (sellableItems.length === 0) {
                    const emptyPayload = buildErrorContainerV2({
                        title: 'Tas Kosong / Tidak Ada Barang',
                        description: 'Tas kamu kosong atau tidak memiliki hasil bumi/material yang bernilai jual di pasar tradisional!',
                        footerText: ui.getFooter('survival')
                    });
                    return i.editReply({ ...emptyPayload, components: [rowInit] });
                }

                const sellMenu = new StringSelectMenuBuilder()
                    .setCustomId('market_sell_item_select')
                    .setPlaceholder('Pilih barang dari tas untuk dijual...')
                    .addOptions(sellableItems.map(it => ({
                        label: `${it.name} (x${it.amount})`,
                        description: `Harga jual per unit: ${it.sellPrice} Naura Star Fragment`,
                        value: `${it.id}_${it.sellPrice}_${it.amount}`
                    })).slice(0, 25));

                const sellPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: '💰 Pasar Tradisional - Jual Barang',
                    iconURL: user.displayAvatarURL(),
                    description: `Pilih barang dari tas kamu yang ingin dijual kepada Mbak Rini di bawah ini:\n\n${eNsf} **Dompetmu:** ${wallet.toLocaleString('id-ID')} **Naura Star Fragment**`,
                    buttonsRow: [new ActionRowBuilder().addComponents(sellMenu), new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('market_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                    )],
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(sellPayload);
            }

            // --- TOMBOL KEMBALI ---
            if (i.customId === 'market_back') {
                await i.deferUpdate();
                await i.editReply(mainPayload);
            }

            // --- CATEGORY SELECT (BUY FLOW) ---
            if (i.customId === 'market_category') {
                await i.deferUpdate();
                const currentCategory = i.values[0];

                let pool = [];
                const allowedMarketIds = [
                    'apple', 'mineral_water', 'potato', 'instant_noodles', 'village_coffee', 'bandaid', 'herb_tea',
                    'wood', 'stone', 'fiber', 'worm_bait',
                    'seed_wheat', 'seed_potato', 'seed_apple',
                    'wooden_axe', 'fishing_rod'
                ];

                if (currentCategory !== 'special' && currentCategory !== 'tools') {
                    pool = itemsConfig.filter(it => it.category === currentCategory && allowedMarketIds.includes(it.id) && it.price);
                } else if (currentCategory === 'tools') {
                    pool = itemsConfig.filter(it => it.category === 'tools' && allowedMarketIds.includes(it.id) && it.price);
                    pool.push({ id: 'veh_bicycle', name: 'Sepeda Kayuh (Kendaraan)', price: 15000, desc: 'Bebas ongkos jalan.' });
                } else if (currentCategory === 'special') {
                    pool.push({ id: 'prop_gudang', name: 'Gudang Tua (Properti)', price: 10000, desc: 'Tempat berteduh kumuh sederhana.' });
                }

                const diffHelper = require('../../../plugin/survival/difficultyHelper');
                const diffConfig = diffHelper.getDifficultyConfig(survival.rpg_state?.difficulty || 'Normal');

                if (pool.length === 0) {
                    return i.editReply({ embeds: [errEmbed('Kategori ini sedang kosong di pasar tradisional.')], components: [new ActionRowBuilder().addComponents(filterMenu)] });
                }

                const buyMenu = new StringSelectMenuBuilder()
                    .setCustomId('market_buy_select')
                    .setPlaceholder(`Beli ${categories[currentCategory]}...`)
                    .addOptions(pool.map(it => {
                        let finalPrice = it.price;
                        if (diffConfig.extreme) finalPrice = Math.floor(finalPrice * 1.5);

                        let labelName = it.name;
                        if (labelName.length > 30) labelName = labelName.substring(0, 30);
                        let desc = `Harga: ${finalPrice.toLocaleString('id-ID')} NSF | ${it.description || it.desc || ''}`;
                        if (desc.length > 100) desc = desc.substring(0, 97) + '...';

                        return { label: labelName, description: desc, value: `${it.id}_${finalPrice}` };
                    }).slice(0, 25));

                const categoryPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: `🛒 Beli - ${categories[currentCategory]}`,
                    iconURL: user.displayAvatarURL(),
                    description: `Silakan pilih barang yang ingin dibeli:\n\n${eNsf} **Sisa Dompet:** ${wallet.toLocaleString('id-ID')} **Naura Star Fragment**`,
                    buttonsRow: [new ActionRowBuilder().addComponents(buyMenu), new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('market_buy_init').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                    )],
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(categoryPayload);
            }

            // --- SELECT ITEM TO SELL (SELL FLOW) ---
            if (i.customId === 'market_sell_item_select') {
                await i.deferUpdate();
                const parts = i.values[0].split('_');
                const amountStr = parts.pop();
                const sellPriceStr = parts.pop();
                const itemId = parts.join('_');
                const sellPrice = parseInt(sellPriceStr);
                const amount = parseInt(amountStr);
                const itemConf = itemsConfig.find(x => x.id === itemId);

                const confirmRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder().setCustomId(`market_sell_confirm_${itemId}_1`).setLabel('Jual 1').setStyle(ButtonStyle.Primary),
                    new ButtonBuilder().setCustomId(`market_sell_confirm_${itemId}_all`).setLabel('Jual Semua').setStyle(ButtonStyle.Danger),
                    new ButtonBuilder().setCustomId('market_sell_init').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                );

                const confirmPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: '💰 Konfirmasi Penjualan',
                    iconURL: user.displayAvatarURL(),
                    description: `Kamu memilih untuk menjual **${itemConf ? itemConf.name : itemId}**.\nJumlah di tas: **${amount} unit**\nHarga jual per unit: **${sellPrice}** ${eNsf} **Naura Star Fragment**\n\nPilih berapa banyak yang ingin kamu jual:`,
                    buttonsRow: confirmRow,
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(confirmPayload);
            }

            // --- CONFIRM SELL TRANSACTION ---
            if (i.customId.startsWith('market_sell_confirm_')) {
                await i.deferUpdate();
                const parts = i.customId.split('_');
                const sellQtyType = parts.pop(); // '1' or 'all'
                const itemId = parts.slice(3).join('_');

                // Re-fetch database records
                const curProfile = await cacheManager.getUserProfile(user.id);
                const curSurvival = await UserSurvival.findOne({ where: { userId: user.id } });

                let userInv = curProfile.inventory || [];
                
                // Group inventory to merge duplicates and get total quantity
                const cleanedInv = [];
                let totalQty = 0;
                for (const item of userInv) {
                    if (item.id === itemId) {
                        totalQty += (item.amount || 1);
                    } else {
                        cleanedInv.push(item);
                    }
                }

                if (totalQty <= 0) {
                    return i.followUp({ ...errEmbed('Barang tersebut sudah tidak ada di tas kamu!'), ephemeral: true });
                }

                const itemConf = itemsConfig.find(x => x.id === itemId);
                let sellPrice = itemConf.sellPrice;
                if (!sellPrice && itemConf.price) {
                    sellPrice = Math.floor(itemConf.price * 0.5);
                }

                let sellQty = 1;
                if (sellQtyType === 'all') {
                    sellQty = totalQty;
                }

                const totalEarned = sellPrice * sellQty;

                // Process inventory
                const remainingQty = totalQty - sellQty;
                if (remainingQty > 0) {
                    cleanedInv.push({ id: itemId, name: itemConf.name, amount: remainingQty });
                }
                
                await cacheManager.updateUserProfile(user.id, { inventory: cleanedInv });
                await cacheManager.updateUserSurvival(user.id, { starFragments: curSurvival.starFragments });

                await i.followUp({
                    ...successEmbed(`Kamu berhasil menjual **${sellQty}x ${itemConf.name}** dan mendapatkan **${totalEarned.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment**!`),
                    ephemeral: true
                });

                // Auto return to sell list
                // Re-trigger the market_sell_init flow visually
                const refreshedInv = curProfile.inventory || [];
                const sellableItems = [];
                for (const item of refreshedInv) {
                    const conf = itemsConfig.find(x => x.id === item.id);
                    if (conf) {
                        let price = conf.sellPrice || (conf.price ? Math.floor(conf.price * 0.5) : 0);
                        if (price > 0) {
                            sellableItems.push({ id: item.id, name: conf.name, amount: item.amount || 1, sellPrice: price });
                        }
                    }
                }

                if (sellableItems.length === 0) {
                    return i.editReply(mainPayload);
                }

                const sellMenu = new StringSelectMenuBuilder()
                    .setCustomId('market_sell_item_select')
                    .setPlaceholder('Pilih barang dari tas untuk dijual...')
                    .addOptions(sellableItems.map(it => ({
                        label: `${it.name} (x${it.amount})`,
                        description: `Harga jual per unit: ${it.sellPrice} Naura Star Fragment`,
                        value: `${it.id}_${it.sellPrice}_${it.amount}`
                    })).slice(0, 25));

                const sellPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: '💰 Jual Barang',
                    iconURL: user.displayAvatarURL(),
                    description: `Pilih barang dari tas kamu yang ingin dijual kepada Mbak Rini di bawah ini:\n\n${eNsf} **Dompetmu:** ${curSurvival.starFragments.toLocaleString('id-ID')} **Naura Star Fragment**`,
                    buttonsRow: [new ActionRowBuilder().addComponents(sellMenu), new ActionRowBuilder().addComponents(
                        new ButtonBuilder().setCustomId('market_back').setLabel('Kembali').setStyle(ButtonStyle.Secondary)
                    )],
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(sellPayload);
            }

            // --- BUY TRANSACTION ---
            if (i.customId === 'market_buy_select') {
                await i.deferUpdate();
                const parts = i.values[0].split('_');
                const priceStr = parts.pop();
                const itemId = parts.join('_');
                const finalPrice = parseInt(priceStr);

                // Re-fetch to prevent race conditions
                const curProfile = await cacheManager.getUserProfile(user.id);
                const curSurvival = await UserSurvival.findOne({ where: { userId: user.id } });

                if ((curSurvival.starFragments || 0) < finalPrice) {
                    return i.followUp({ ...errEmbed(`Uangmu tidak cukup! Kamu butuh **${finalPrice.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment** di dompetmu.`), ephemeral: true });
                }

                // Deduct money
                curSurvival.starFragments -= finalPrice;

                // Item processing
                let itemName = itemId;
                if (itemId.startsWith('prop_')) {
                    const propMap = { 'prop_gudang': 'gudang' };
                    curSurvival.propertyId = propMap[itemId];
                    itemName = `Properti ${propMap[itemId].toUpperCase()}`;
                } else if (itemId.startsWith('veh_')) {
                    const vehMap = { 'veh_bicycle': 'bicycle' };
                    curSurvival.vehicle = vehMap[itemId];
                    itemName = `Kendaraan ${vehMap[itemId].toUpperCase()}`;
                } else {
                    const purchasedItem = itemsConfig.find(x => x.id === itemId);
                    itemName = purchasedItem ? purchasedItem.name : itemId;
                    let currentInv = curProfile.inventory || [];
                    const existing = currentInv.find(x => x.id === itemId);
                    if (existing) {
                        existing.amount = (existing.amount || 1) + 1;
                    } else {
                        currentInv.push({ id: itemId, name: itemName, amount: 1 });
                    }
                    await cacheManager.updateUserProfile(user.id, { inventory: currentInv });
                }

                await cacheManager.updateUserSurvival(user.id, { starFragments: curSurvival.starFragments });

                await i.followUp({ ...successEmbed(`Kamu berhasil membeli **${itemName}** seharga **${finalPrice.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment**.`), ephemeral: true });

                const refreshPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Village Market (Mbak Rini)',
                    title: '🛒 Beli Barang',
                    iconURL: user.displayAvatarURL(),
                    description: `Silakan pilih barang yang ingin dibeli:\n\n${eNsf} **Sisa Dompet:** ${curSurvival.starFragments.toLocaleString('id-ID')} **Naura Star Fragment**`,
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(refreshPayload);
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) interaction.editReply({ components: [] }).catch(()=>{});
        });
    }
};