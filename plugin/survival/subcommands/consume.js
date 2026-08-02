const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const itemsConfig = require('../../../plugin/survival/items');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const leveling = require('../../../plugin/survival/survivalLeveling');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const survival = await cacheManager.getUserSurvival(user.id);

        const currentInv = safeParseInventory(profile.inventory);
        const userConsumables = {};

        currentInv.forEach(item => {
            const conf = itemsConfig.find(it => it.id === item.id);
            if (conf && conf.category === 'consumable') {
                if (!userConsumables[item.id]) userConsumables[item.id] = { ...conf, count: 1 };
                else userConsumables[item.id].count += 1;
            }
        });

        const keys = Object.keys(userConsumables);
        if (keys.length === 0) {
            const errPayload = buildErrorContainerV2({
                title: 'Tas Kosong',
                description: 'Tas perbekalanmu kosong! Pergi mancing, beli di pasar, atau collect di hutan.',
                footerText: ui.getFooter('survival')
            });
            return interaction.editReply({ ...errPayload, embeds: [] });
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('consume_item')
            .setPlaceholder('Pilih perbekalan untuk digunakan...')
            .addOptions(keys.map(id => {
                const it = userConsumables[id];
                let emojiOpt = ui.getEmoji('soup') || '🍲';
                if (id === 'apple') emojiOpt = ui.getEmoji('apple') || '🍎';
                if (id === 'mineral_water') emojiOpt = ui.getEmoji('mineral_water') || '💧';

                return new StringSelectMenuOptionBuilder()
                    .setLabel(`${it.name} (x${it.count})`)
                    .setEmoji(ui.parseEmoji(emojiOpt) || { name: '🍲' })
                    .setValue(id);
            }));

        const selectRow = new ActionRowBuilder().addComponents(selectMenu);
        const menuPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFC0CB',
            title: '🎒 Bekal Survival Naura',
            description: 'Yayy~! Ini dia bekal yang ada di tasmu! Kamu mau makan, minum, atau pakai item obat yang mana nih? Pilih di bawah ini yaa! 💕✨',
            buttonsRow: selectRow,
            footerText: ui.getFooter('survival')
        });

        const response = await interaction.editReply(menuPayload);

        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 30000, max: 1 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const selId = i.values[0];
            const itemConf = itemsConfig.find(it => it.id === selId);

            const newHunger = Math.min(100, survival.hunger + (itemConf.effects?.hunger || 0));
            const newThirst = Math.min(100, survival.thirst + (itemConf.effects?.thirst || 0));
            const newStamina = Math.min(100, survival.stamina + (itemConf.effects?.stamina || 0));

            const level = survival.survival_level || 1;
            const maxStat = leveling.getMaxStatCap(level);
            const activeStrength = Math.min(survival.strength || 1, maxStat);
            const maxPlayerHP = 100 + (Math.floor(level / 5) * 10) + (activeStrength * 10);

            let newHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;
            if (itemConf.effects?.hp) {
                newHP = Math.min(maxPlayerHP, newHP + itemConf.effects.hp);
            }

            await cacheManager.updateUserSurvival(user.id, { hp: newHP, hunger: newHunger, thirst: newThirst, stamina: newStamina });

            const idx = currentInv.findIndex(inv => inv.id === selId);
            if (idx > -1) {
                currentInv.splice(idx, 1);
                await cacheManager.updateUserProfile(user.id, { inventory: currentInv });
            }

            await leveling.addPlayerXP(user.id, 1);

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFC0CB',
                title: `${ui.getEmoji('sparkle') || '✨'} Yummy! Item Berhasil Digunakan~! 💕`,
                description: `Yaaay! Kamu baru saja mengonsumsi **${itemConf.name}**! Nyam nyam~ 😋\n\n**✨ Perubahan Kondisimu Sekarang:**\n> ${ui.getEmoji('hunger') || '🍔'} **Lapar:** ➡️ \`${newHunger}/100\`\n> ${ui.getEmoji('thirst') || '🥤'} **Haus:** ➡️ \`${newThirst}/100\`\n> ⚡ **Stamina:** ➡️ \`${newStamina}/100\`${itemConf.effects?.hp ? `\n> ${ui.getEmoji('health') || '❤️'} **HP:** Pulih +**${itemConf.effects.hp}** HP!` : ''}\n\n🌟 *Naura memberikanmu bonus +1 XP! Semangat terus yaa~!* 💖`,
                footerText: ui.getFooter('survival')
            });
            await i.editReply(successPayload);
        });

        collector.on('end', c => {
            if (c.size === 0) {
                const cancelPayload = buildErrorContainerV2({
                    title: 'Aww, Waktu Memilih Habis! ⌛',
                    description: 'Aww... Karena kamu tidak memilih bekal dalam 30 detik, sesi makan dibatalkan dulu yaa. Nanti kalau mau makan lagi, panggil Naura lagi aja! 💕',
                    footerText: ui.getFooter('survival')
                });
                interaction.editReply(cancelPayload).catch(() => { });
            }
        });
    }
};