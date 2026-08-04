'use strict';

const { ActionRowBuilder, StringSelectMenuBuilder, MessageFlags } = require('discord.js');

const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const itemsConfig = require('../items');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

const COLLECTOR_MS = 60000;

// Dulu properti "mansion" tidak ada di daftar dan ikut kebagian 1 slot saja,
// padahal harganya paling mahal.
const SLOTS_BY_PROPERTY = {
    gudang: 1,
    kos: 2,
    rumah: 5,
    mansion: 8
};

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function ephemeral(content) {
    return { content, flags: MessageFlags.Ephemeral };
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_49', true);

        const propId = survival.propertyId || 'jalanan';
        if (propId === 'jalanan') return ui.sendError(interaction, 'err_sys_50', true);

        const rpgState = survival.rpg_state || {};
        if (!Array.isArray(rpgState.active_decorations)) rpgState.active_decorations = [];

        if (rpgState.house_seized) {
            return ui.sendError(
                interaction,
                `${e('cry', '\uD83C\uDFE0')} Rumahmu masih disegel Pak Anif karena pajaknya menunggak. Lunasi dendanya di kota dulu yaa, Naura tunggu di sini.`,
                true
            );
        }

        const maxSlots = SLOTS_BY_PROPERTY[propId] || 1;
        const profile = await cacheManager.getUserProfile(user.id);
        const inv = safeParseInventory(profile.inventory);

        const availableDecos = inv.filter(item => {
            const config = itemsConfig.find(i => i.id === item.id);
            return config && config.category === 'decoration';
        });

        const terpasang = rpgState.active_decorations.length > 0
            ? rpgState.active_decorations.map((d, idx) => `${idx + 1}. ${d.name}`).join('\n')
            : '*Masih kosong. Yuk dihias biar betah di rumah!*';

        const housePayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFC0CB',
            authorName: 'Naura Housing System',
            title: `${e('happy', '\uD83C\uDFE0')} Rumahmu: ${propId.toUpperCase()}`,
            iconURL: user.displayAvatarURL(),
            description: [
                `Naura sudah rapikan sedikit, hehe. Ini kondisi rumahmu sekarang:`,
                '',
                `**Kapasitas dekorasi:** ${rpgState.active_decorations.length}/${maxSlots} slot`,
                '',
                '**Yang sudah terpasang:**',
                terpasang
            ].join('\n'),
            footerText: ui.getFooter('survival')
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('house_equip_deco')
            .setPlaceholder('Pilih dekorasi buat dipasang atau dilepas');

        if (availableDecos.length === 0 && rpgState.active_decorations.length === 0) {
            selectMenu.addOptions([{ label: 'Belum ada dekorasi sama sekali', value: 'none' }]);
            selectMenu.setDisabled(true);
        } else {
            rpgState.active_decorations.forEach(deco => {
                selectMenu.addOptions([{ label: `[LEPAS] ${deco.name}`.substring(0, 100), value: `unequip_${deco.id}` }]);
            });

            const equippedIds = rpgState.active_decorations.map(d => d.id);
            availableDecos.forEach(deco => {
                if (!equippedIds.includes(deco.id)) {
                    selectMenu.addOptions([{ label: `[PASANG] ${deco.name}`.substring(0, 100), value: `equip_${deco.id}` }]);
                }
            });
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);

        // Container hasil builder di-spread, bukan ditimpa.
        await interaction.reply({ ...housePayload, components: [...housePayload.components, row] });
        const message = await interaction.fetchReply();

        const collector = message.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: COLLECTOR_MS
        });

        collector.on('collect', async i => {
            await i.deferUpdate();

            const value = i.values[0];
            if (value === 'none') return;

            const isEquip = value.startsWith('equip_');
            const decoId = value.replace(/^(un)?equip_/, '');

            if (isEquip) {
                if (rpgState.active_decorations.length >= maxSlots) {
                    return i.followUp(ephemeral(
                        `${e('akward', '\u274C')} Slot dekorasi di properti ini sudah penuh (${maxSlots} slot). Lepas salah satu dulu yaa!`
                    ));
                }

                const decoItem = availableDecos.find(d => d.id === decoId);
                if (!decoItem) {
                    return i.followUp(ephemeral(`${e('akward', '\u274C')} Naura nggak menemukan dekorasi itu di tasmu.`));
                }

                rpgState.active_decorations.push({ id: decoItem.id, name: decoItem.name });
                survival.rpg_state = rpgState;
                survival.changed('rpg_state', true);
                await survival.save();

                return i.followUp(ephemeral(
                    `${e('cheers', '\u2705')} **${decoItem.name}** sudah Naura pasang. Rumahmu jadi manis banget!`
                ));
            }

            const index = rpgState.active_decorations.findIndex(d => d.id === decoId);
            if (index === -1) {
                return i.followUp(ephemeral(`${e('akward', '\u274C')} Dekorasi itu memang belum terpasang, kok.`));
            }

            const removed = rpgState.active_decorations.splice(index, 1)[0];
            survival.rpg_state = rpgState;
            survival.changed('rpg_state', true);
            await survival.save();

            return i.followUp(ephemeral(
                `${e('happy', '\u2705')} **${removed.name}** sudah Naura simpan balik ke tasmu yaa.`
            ));
        });
    }
};
