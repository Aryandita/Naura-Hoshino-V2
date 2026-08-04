'use strict';

const path = require('path');
const { ActionRowBuilder, StringSelectMenuBuilder, AttachmentBuilder, MessageFlags } = require('discord.js');

const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const ui = require('../../../src/config/ui');
const items = require('../items');
const npcs = require('../npcs');
const { findPortrait } = require('../npcHelpers');
const { resolveShop, say } = require('../shopkeepers');
const stock = require('../shopStock');
const currencyHelper = require('../currency');
const { getSeason, getWeather, getShopMultiplier } = require('../survivalTime');
const { getDifficultyConfig } = require('../difficultyHelper');
const { safeParseInventory, addOrStackItem } = require('../inventoryHelper');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const COLLECTOR_MS = 120000;
const PORTRAIT_NAME = 'shopkeeper.png';

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function ephemeral(payload) {
    return { ...payload, flags: (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral };
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_58', true);

        const shop = resolveShop(survival.currentLocation);
        if (!shop) return ui.sendError(interaction, 'Di sini nggak ada penjual, lho. Coba ke desa atau kota dulu yaa!', true);

        const npc = npcs[shop.npcId] || { id: shop.npcId, name: shop.shopName };
        const currency = currencyHelper.byKind(shop.currency);
        const holders = { survival, profile };
        const vars = { nama: user.displayName || user.username };

        // Kategori bawaan toko digabung dengan kategori khusus per wilayah,
        // misalnya lapak tiket dungeon.
        const categories = { ...shop.categories, ...stock.extraCategories(shop.key) };

        // Potret NPC dipakai sebagai ikon toko, jadi terasa benar-benar miliknya.
        const portrait = findPortrait(npc);
        const attachmentName = portrait ? `shopkeeper${path.extname(portrait)}` : PORTRAIT_NAME;
        const portraitFiles = portrait ? [new AttachmentBuilder(portrait, { name: attachmentName })] : [];
        const iconURL = portrait ? `attachment://${attachmentName}` : user.displayAvatarURL();

        const season = getSeason(survival.inGameDay || 1);
        const weather = getWeather(survival.inGameDay || 1, survival.inGameHour || 6);
        const diffConfig = getDifficultyConfig(survival.rpg_state?.difficulty || 'Normal');

        let shopPurchases = survival.shop_purchases || {};
        const currentDay = survival.inGameDay || 1;
        if (currentDay >= (survival.shop_last_reset_day || 1) + 30) {
            shopPurchases = {};
            await cacheManager.updateUserSurvival(user.id, { shop_purchases: {}, shop_last_reset_day: currentDay });
        }

        function priceOf(item, purchases) {
            const flat = item.id.startsWith('prop_') || item.id.startsWith('veh_') || item.category === 'pass';
            const weatherMultiplier = flat ? 1 : getShopMultiplier(item, weather, season);
            const bought = purchases[item.id] || 0;
            let final = Math.floor(item.price * weatherMultiplier * (1 + bought * 0.1));
            if (diffConfig.extreme) final = Math.floor(final * 1.5);
            return final;
        }

        const categoryRow = () => new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder()
                .setCustomId('shop_category')
                .setPlaceholder('Mau lihat dagangan yang mana?')
                .addOptions(Object.entries(categories).map(([value, label]) => ({ label, value })))
        );

        function shopPayload(title, dialogue, extra = '') {
            const balance = currencyHelper.balanceOf(currency, holders);
            return buildContainerV2({
                accentColorHex: shop.accentColorHex,
                authorName: `${npc.name} \u2014 ${npc.title || 'Penjual'}`,
                title,
                iconURL,
                description: [
                    `> *"${dialogue}"*`,
                    '',
                    `${e('lokasi', '\uD83D\uDCCD')} **${shop.shopName}** \u2014 Musim **${season.name}** ${season.emoji}, cuaca **${weather.name}** ${weather.emoji}.`,
                    `${currencyHelper.emojiOf(currency)} Saldomu: **${balance.toLocaleString('id-ID')} ${currency.name}**`,
                    extra
                ].filter(Boolean).join('\n'),
                files: portraitFiles,
                footerText: ui.getFooter('survival')
            });
        }

        const openPayload = shopPayload(
            `${e('shop_cart', '\uD83D\uDED2')} ${shop.shopName}`,
            say(shop.dialog.greet, vars),
            '\n*Harga bergerak mengikuti cuaca, musim, dan seberapa sering kamu membeli barang yang sama bulan ini.*'
        );

        const response = await interaction.editReply({
            ...openPayload,
            components: [...openPayload.components, categoryRow()]
        });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: COLLECTOR_MS
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'shop_category') {
                const category = i.values[0];
                const pool = items.filter(it =>
                    it && it.category === category && it.price && !stock.isExcluded(it.id)
                );

                // Dagangan khusus wilayah: properti dan kendaraan di kota,
                // tiket dungeon sesuai penjualnya masing-masing.
                pool.push(...stock.exclusiveStock(shop.key, category));

                if (pool.length === 0) {
                    const emptyPayload = shopPayload(
                        `${e('shop_cart', '\uD83D\uDED2')} ${categories[category]}`,
                        'Aduh, yang itu sedang kosong. Stoknya belum datang dari pemasok.'
                    );
                    return i.editReply({ ...emptyPayload, components: [...emptyPayload.components, categoryRow()] });
                }

                const buyRow = new ActionRowBuilder().addComponents(
                    new StringSelectMenuBuilder()
                        .setCustomId('shop_buy')
                        .setPlaceholder(`Beli dari ${categories[category]}...`)
                        .addOptions(pool.slice(0, 25).map(it => {
                            const finalPrice = priceOf(it, shopPurchases);
                            const bought = shopPurchases[it.id] || 0;
                            return {
                                label: it.name.substring(0, 100),
                                description: `${finalPrice.toLocaleString('id-ID')} ${currency.short} \u2022 inflasi ${bought * 10}%`.substring(0, 100),
                                // Pemisah pipa dipakai karena banyak id memuat garis bawah,
                                // sehingga split('_') dulu memotong id jadi salah.
                                value: `${it.id}|${finalPrice}`
                            };
                        }))
                );

                const listPayload = shopPayload(
                    `${e('shop_cart', '\uD83D\uDED2')} ${categories[category]}`,
                    say(shop.dialog.browse, vars)
                );
                return i.editReply({
                    ...listPayload,
                    components: [...listPayload.components, categoryRow(), buyRow]
                });
            }

            if (i.customId === 'shop_buy') {
                const [itemId, priceStr] = i.values[0].split('|');
                const finalPrice = parseInt(priceStr, 10);

                const freshProfile = await cacheManager.getUserProfile(user.id);
                const freshSurvival = await UserSurvival.findOne({ where: { userId: user.id } });
                const freshHolders = { survival: freshSurvival, profile: freshProfile };

                const balance = currencyHelper.balanceOf(currency, freshHolders);
                if (balance < finalPrice) {
                    const kurang = (finalPrice - balance).toLocaleString('id-ID');
                    return i.followUp(ephemeral(buildErrorContainerV2({
                        title: `${e('cry', '\uD83D\uDE22')} ${npc.name} menggeleng`,
                        description: `> *"${say(shop.dialog.broke, { ...vars, kurang: `${kurang} ${currency.name}` })}"*`,
                        footerText: ui.getFooter('survival')
                    })));
                }

                await currencyHelper.charge(currency, freshHolders, finalPrice);

                const catalogItem = stock.findItem(itemId) || stock.propertyById(itemId);
                const itemName = catalogItem ? catalogItem.name : itemId;

                if (itemId.startsWith('prop_')) {
                    const propMap = { prop_kos: 'kos', prop_rumah: 'rumah', prop_mansion: 'mansion' };
                    freshSurvival.propertyId = propMap[itemId] || freshSurvival.propertyId;
                    await freshSurvival.save();
                } else if (itemId.startsWith('veh_')) {
                    freshSurvival.vehicle = itemId === 'veh_motor' ? 'motorcycle' : 'bicycle';
                    await freshSurvival.save();
                } else {
                    const inv = addOrStackItem(
                        safeParseInventory(freshProfile.inventory),
                        { id: itemId, name: itemName, amount: 1 }
                    );
                    await cacheManager.updateUserProfile(user.id, { inventory: inv });
                }

                shopPurchases[itemId] = (shopPurchases[itemId] || 0) + 1;
                await cacheManager.updateUserSurvival(user.id, { shop_purchases: shopPurchases });

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    authorName: `${npc.name} \u2014 ${npc.title || 'Penjual'}`,
                    title: `${e('cheers', '\uD83E\uDD42')} Transaksi berhasil!`,
                    iconURL,
                    description: [
                        `> *"${say(shop.dialog.bought, { ...vars, barang: itemName })}"*`,
                        '',
                        `Kamu membayar ${currencyHelper.format(currency, finalPrice)} untuk **${itemName}**.`
                    ].join('\n'),
                    files: portraitFiles,
                    footerText: ui.getFooter('survival')
                });

                return i.followUp(ephemeral(successPayload));
            }
        });

        collector.on('end', async () => {
            const closingPayload = shopPayload(
                `${e('sleepy', '\uD83D\uDCA4')} ${shop.shopName} sudah tutup`,
                say(shop.dialog.farewell, vars)
            );
            await interaction.editReply(closingPayload).catch(() => {});
        });
    }
};
