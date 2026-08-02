const { ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, EmbedBuilder } = require('discord.js');
const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const itemsConfig = require('../../../plugin/survival/items_static');
const ui = require('../../../src/config/ui');
const { getSeason, getWeather, getShopMultiplier } = require('../../../plugin/survival/survivalTime');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const eNsf = ui.getEmoji('nsf') || '🪙';

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, 'err_sys_58', true);
        }
        if (survival.currentLocation !== 'kota') {
            return ui.sendError(interaction, 'err_sys_59', true);
        }

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal', description: msg, footerText: ui.getFooter('survival') });
        const successEmbed = (msg) => buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Berhasil', description: msg, footerText: ui.getFooter('survival') });

        const currentDay = survival.inGameDay || 1;
        const currentHour = survival.inGameHour || 6;
        const season = getSeason(currentDay);
        const weather = getWeather(currentDay, currentHour);
        const wallet = survival.starFragments || 0;

        let shopPurchases = survival.shop_purchases || {};
        let lastResetDay = survival.shop_last_reset_day || 1;

        if (currentDay >= lastResetDay + 30) {
            shopPurchases = {};
            lastResetDay = currentDay;
            await UserSurvival.update({ shop_purchases: shopPurchases, shop_last_reset_day: lastResetDay }, { where: { userId: user.id } });
        }

        const categories = {
            'consumable': 'Makanan & Minuman Premium 🍲',
            'material': 'Bahan Baku & Material Langka 🧱',
            'tools': 'Alat & Senjata Premium ⚒️',
            'booster': 'Item Booster Kerja 🚀',
            'skill': 'Buku Keahlian (Upgrade Stats) 📖',
            'decoration': 'Dekorasi & Furniture Premium 🛏️',
            'special': 'Barang Spesial & Properti Mewah 🏡'
        };

        const filterMenu = new StringSelectMenuBuilder()
            .setCustomId('shop_category')
            .setPlaceholder('Pilih Kategori Belanja...')
            .addOptions(Object.entries(categories).map(([k, v]) => ({ label: v, value: k })));

        const mainPayload = buildContainerV2({
            accentColorHex: ui.getColor('economy'),
            authorName: 'Naura Survival Shop',
            title: `${ui.getEmoji('shop_cart') || '🛒'} Naura Premium Shop`,
            iconURL: user.displayAvatarURL(),
            description:
                `Selamat datang di toko premium Naura! Saat ini adalah **Musim ${season.name}** ${season.emoji} dengan cuaca **${weather.name}** ${weather.emoji}.\n` +
                `*Harga beberapa barang premium mungkin berubah karena cuaca dan inflasi seberapa sering kamu membelinya bulan ini.*\n\n` +
                `${eNsf} **Dompetmu:** ${wallet.toLocaleString('id-ID')} **Naura Star Fragment**\n\n` +
                `Pilih kategori barang yang ingin kamu cari di bawah ini:`,
            buttonsRow: new ActionRowBuilder().addComponents(filterMenu),
            footerText: ui.getFooter('survival')
        });

        const shopBanner = ui.getBanner('shop');
        if (shopBanner) {
            mainPayload.files = [new AttachmentBuilder(shopBanner, { name: 'banner.png' })];
        }

        const response = await interaction.reply(mainPayload);
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 120000 });

        let currentCategory = null;

        collector.on('collect', async i => {
            if (i.customId === 'shop_category') {
                await i.deferUpdate();
                currentCategory = i.values[0];

                const excludedShopItemIds = [
                    'apple', 'mineral_water', 'potato', 'instant_noodles', 'village_coffee', 'bandaid', 'herb_tea',
                    'wood', 'stone', 'fiber', 'worm_bait',
                    'seed_wheat', 'seed_potato', 'seed_apple',
                    'wooden_axe', 'fishing_rod', 'prop_gudang', 'veh_bicycle'
                ];

                let pool = itemsConfig.filter(it => it.category === currentCategory && it.price && !excludedShopItemIds.includes(it.id));

                if (currentCategory === 'special') {
                    pool.push({ id: 'prop_kos', name: 'Kamar Kos (Properti)', price: 50000, desc: 'Kamar lumayan nyaman.' });
                    pool.push({ id: 'prop_rumah', name: 'Rumah (Properti)', price: 200000, desc: 'Rumah luas untuk berkeluarga.' });
                    pool.push({ id: 'veh_motor', name: 'Sepeda Motor (Kendaraan)', price: 80000, desc: 'Butuh bensin.' });
                }

                const diffHelper = require('../../../plugin/survival/difficultyHelper');
                const diffConfig = diffHelper.getDifficultyConfig(survival.rpg_state?.difficulty || 'Normal');

                if (pool.length === 0) {
                    const emptyPayload = buildContainerV2({
                        accentColorHex: ui.getColor('error'),
                        authorName: 'Naura Survival Shop',
                        title: `🛒 Kategori Kosong`,
                        iconURL: user.displayAvatarURL(),
                        description: `Kategori ini sedang kosong saat ini.`,
                        buttonsRow: new ActionRowBuilder().addComponents(filterMenu),
                        footerText: ui.getFooter('survival')
                    });
                    return i.editReply(emptyPayload);
                }

                const buyMenu = new StringSelectMenuBuilder()
                    .setCustomId('buy_select')
                    .setPlaceholder(`Beli ${categories[currentCategory]}...`)
                    .addOptions(pool.map(it => {
                        let baseCost = it.price;
                        let weatherMultiplier = 1;
                        if (it.id && !it.id.startsWith('prop_') && !it.id.startsWith('veh_')) {
                            weatherMultiplier = getShopMultiplier(it, weather, season);
                        }

                        const purchasedCount = shopPurchases[it.id] || 0;
                        const inflationMultiplier = 1 + (purchasedCount * 0.1);
                        let finalPrice = Math.floor(baseCost * weatherMultiplier * inflationMultiplier);
                        if (diffConfig.extreme) finalPrice = Math.floor(finalPrice * 1.5);

                        let labelName = it.name;
                        if (labelName.length > 30) labelName = labelName.substring(0, 30);
                        let desc = `Harga: ${finalPrice.toLocaleString('id-ID')} NSF | Inflasi: ${purchasedCount * 10}%`;

                        return { label: labelName, description: desc, value: `${it.id}_${finalPrice}` };
                    }).slice(0, 25));

                const categoryPayload = buildContainerV2({
                    accentColorHex: ui.getColor('economy'),
                    authorName: 'Naura Survival Shop',
                    title: `${ui.getEmoji('shop_cart') || '🛒'} Kategori: ${categories[currentCategory]}`,
                    iconURL: user.displayAvatarURL(),
                    description: `Kategori: **${categories[currentCategory]}**\nSisa Dompet: **${wallet.toLocaleString('id-ID')} Naura Star Fragment**\nSilakan pilih barang premium yang ingin dibeli:`,
                    buttonsRow: [
                        new ActionRowBuilder().addComponents(filterMenu),
                        new ActionRowBuilder().addComponents(buyMenu)
                    ],
                    footerText: ui.getFooter('survival')
                });

                await i.editReply(categoryPayload);
            }

            if (i.customId === 'buy_select') {
                await i.deferUpdate();
                const [itemId, priceStr] = i.values[0].split('_');
                const finalPrice = parseInt(priceStr);

                const curProfile = await cacheManager.getUserProfile(user.id);
                const curSurvival = await UserSurvival.findOne({ where: { userId: user.id } });

                if ((curSurvival.starFragments || 0) < finalPrice) {
                    return i.followUp({ ...errEmbed(`Uangmu tidak cukup! Kamu butuh **${finalPrice.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment** di dompetmu.`), ephemeral: true });
                }

                curSurvival.starFragments -= finalPrice;

                let itemName = itemId;
                if (itemId.startsWith('prop_')) {
                    const propMap = { 'prop_gudang': 'gudang', 'prop_kos': 'kos', 'prop_rumah': 'rumah' };
                    curSurvival.propertyId = propMap[itemId];
                    itemName = `Properti ${propMap[itemId].toUpperCase()}`;
                } else if (itemId.startsWith('veh_')) {
                    const vehMap = { 'veh_bicycle': 'bicycle', 'veh_motor': 'motorcycle' };
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

                let curPurchases = curSurvival.shop_purchases || {};
                curPurchases[itemId] = (curPurchases[itemId] || 0) + 1;
                await cacheManager.updateUserSurvival(user.id, {
                    starFragments: curSurvival.starFragments,
                    shop_purchases: curPurchases
                });

                return i.followUp({ ...successEmbed(`Kamu berhasil membeli **${itemName}** seharga **${finalPrice.toLocaleString('id-ID')}** ${eNsf} **Naura Star Fragment**.`), ephemeral: true });
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) interaction.editReply({ components: [] }).catch(()=>{});
        });
    }
};