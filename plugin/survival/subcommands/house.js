const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const itemsConfig = require('../../../plugin/survival/items');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_49', true);

        const propId = survival.propertyId || 'jalanan';
        if (propId === 'jalanan') return ui.sendError(interaction, 'err_sys_50', true);

        const profile = await cacheManager.getUserProfile(user.id);

        let maxSlots = 1;
        if (propId === 'gudang') maxSlots = 1;
        if (propId === 'kos') maxSlots = 2;
        if (propId === 'rumah') maxSlots = 5;

        const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false, unlocked_recipes: [], active_decorations: [] };
        if (!rpgState.active_decorations) rpgState.active_decorations = [];

        if (rpgState.house_seized) {
            return ui.sendError(interaction, `${ui.getEmoji('house') || '🏠'} **Rumah Disegel!**\nRumahmu telah disegel oleh Pak Anif karena menunggak pajak. Bayar denda di kota segera!`, true);
        }

        const inv = safeParseInventory(profile.inventory);
        const availableDecos = inv.filter(item => {
            const config = itemsConfig.find(i => i.id === item.id);
            return config && config.category === 'decoration';
        });

        const housePayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('house') || '🏠'} Properti: ${propId.toUpperCase()}`,
            description: `**Kapasitas Dekorasi:** ${rpgState.active_decorations.length}/${maxSlots} Slot\n\n**Dekorasi Terpasang:**\n${rpgState.active_decorations.length > 0 ? rpgState.active_decorations.map((d, i) => (i + 1) + '. ' + d.name).join('\n') : '*Belum ada dekorasi terpasang*'}`,
            footerText: 'Naura Housing System'
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('house_equip_deco')
            .setPlaceholder('Pilih dekorasi untuk dipasang/dilepas...');

        if (availableDecos.length === 0 && rpgState.active_decorations.length === 0) {
            selectMenu.addOptions([{ label: 'Tidak ada barang', value: 'none' }]);
            selectMenu.setDisabled(true);
        } else {
            rpgState.active_decorations.forEach(deco => {
                selectMenu.addOptions([{ label: `[LEPAS] ${deco.name}`, value: `unequip_${deco.id}` }]);
            });
            const currentEquippedIds = rpgState.active_decorations.map(d => d.id);
            availableDecos.forEach(deco => {
                if (!currentEquippedIds.includes(deco.id)) {
                    selectMenu.addOptions([{ label: `[PASANG] ${deco.name}`, value: `equip_${deco.id}` }]);
                }
            });
        }

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.reply({ ...housePayload, components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const actionStr = i.values[0];
            if (actionStr === 'none') return;

            const [action] = actionStr.split('_', 1);
            const fullDecoId = actionStr.replace(`${action}_`, '');

            if (action === 'equip') {
                if (rpgState.active_decorations.length >= maxSlots) {
                    return i.followUp({ content: `${ui.getEmoji('error') || '❌'} Slot dekorasi di properti ini sudah penuh! (${maxSlots} Slot)`, ephemeral: true });
                }
                const decoItem = availableDecos.find(d => d.id === fullDecoId);
                rpgState.active_decorations.push({ id: decoItem.id, name: decoItem.name });
                survival.rpg_state = rpgState;
                await survival.save();
                return i.followUp({ content: `${ui.getEmoji('success') || '✅'} Berhasil memasang **${decoItem.name}** di rumahmu!`, ephemeral: true });
            }

            if (action === 'unequip') {
                const index = rpgState.active_decorations.findIndex(d => d.id === fullDecoId);
                if (index !== -1) {
                    const removed = rpgState.active_decorations.splice(index, 1)[0];
                    survival.rpg_state = rpgState;
                    await survival.save();
                    return i.followUp({ content: `${ui.getEmoji('success') || '✅'} Berhasil melepas **${removed.name}** dari rumahmu!`, ephemeral: true });
                }
            }
        });
    }
};
