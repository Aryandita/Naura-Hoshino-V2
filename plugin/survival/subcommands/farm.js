// Lokasi: src/commands/survival/subcommands/farm.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const UserFarm = require('../../../src/models/UserFarm');
const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const itemsConfig = require('../../../plugin/survival/items');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_43', true);

        const prop = survival.property || 'jalanan';
        const rpgState = survival.rpg_state || { house_seized: false };
        if (rpgState.house_seized) return ui.sendError(interaction, 'err_sys_44', true);
        if (prop === 'jalanan') return ui.sendError(interaction, 'err_sys_45', true);

        let maxLahan = 0;
        if (prop === 'kos') maxLahan = 2;
        if (prop === 'rumah') maxLahan = 6;
        if (prop === 'mansion') maxLahan = 12;

        let [farmData] = await UserFarm.findOrCreate({ where: { userId: user.id } });
        let plots = farmData.plots || [];

        // Inisialisasi slot lahan jika baru pertama
        if (plots.length < maxLahan) {
            for (let i = plots.length; i < maxLahan; i++) {
                plots.push({ id: i, seed: null, plantedAtDay: null, harvestDay: null });
            }
            await UserFarm.update({ plots }, { where: { userId: user.id } });
        }

        let farmDesc = '';
        let farmOptions = [];

        plots.slice(0, maxLahan).forEach((plot, index) => {
            if (!plot.seed) {
                farmDesc += `${ui.getEmoji('farm_soil') || '🟫'} **Lahan ${index + 1}:** Kosong (Tanah Subur)\n`;
                farmOptions.push({ label: `Tanam di Lahan ${index + 1}`, value: `plant_${index}`, emoji: ui.getEmoji('farm_seed') || '🌱' });
            } else {
                const currentDay = survival.survival_day || 1;
                if (currentDay >= plot.harvestDay) {
                    farmDesc += `${ui.getEmoji('farm_harvest') || '🌻'} **Lahan ${index + 1}:** ${plot.seed.toUpperCase()} Siap Panen!\n`;
                    farmOptions.push({ label: `Panen Lahan ${index + 1}`, value: `harvest_${index}`, emoji: ui.getEmoji('farm_harvest') || '🌾' });
                } else {
                    const wait = plot.harvestDay - currentDay;
                    farmDesc += `${ui.getEmoji('farm_seed') || '🌱'} **Lahan ${index + 1}:** Menunggu Panen (${wait} hari lagi)\n`;
                }
            }
        });

        const farmPayload = buildContainerV2({
            accentColorHex: ui.getColor('success') || '#22c55e',
            title: `${ui.getEmoji('farm_house') || '🏡'} Sistem Perkebunan Naura`,
            description: `**Properti:** ${prop.toUpperCase()} | **Kapasitas Lahan:** ${maxLahan} Slot\n\n${farmDesc}`,
            footerText: 'Naura Farming System'
        });

        if (farmOptions.length === 0) {
            const waitPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFB6C1',
                title: `${ui.getEmoji('farm_house') || '🏡'} Sistem Perkebunan Naura`,
                description: `**Properti:** ${prop.toUpperCase()} | **Kapasitas Lahan:** ${maxLahan} Slot\n\n${farmDesc}\n\nSemua lahanmu sedang ditanami dan belum ada yang siap panen. Sabar ya! Tunggu hari berganti.`,
                footerText: 'Naura Farming System'
            });
            return interaction.reply(waitPayload);
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('farm_select')
            .setPlaceholder('Kelola Lahan...')
            .addOptions(farmOptions);

        const response = await interaction.reply({ ...farmPayload, components: [new ActionRowBuilder().addComponents(selectMenu)] });

        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 45000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const action = i.values[0].split('_')[0];
            const plotIdx = parseInt(i.values[0].split('_')[1]);

            if (action === 'plant') {
                const profile = await cacheManager.getUserProfile(user.id);
                const currentInv = safeParseInventory(profile.inventory);
                const seedsList = currentInv.filter(item => item.id.includes('seed_'));

                if (seedsList.length === 0) {
                    return i.followUp({ content: `${ui.getEmoji('error') || '❌'} Kamu tidak memiliki bibit tanaman di dalam Tas!`, ephemeral: true });
                }

                const seedToPlant = seedsList[0];
                const growTime = seedToPlant.id === 'seed_wheat' ? 1 : 2;

                plots[plotIdx].seed = seedToPlant.id.replace('seed_', '');
                plots[plotIdx].plantedAtDay = survival.survival_day || 1;
                plots[plotIdx].harvestDay = (survival.survival_day || 1) + growTime;

                const seedIdx = currentInv.findIndex(item => item.id === seedToPlant.id);
                currentInv.splice(seedIdx, 1);

                await cacheManager.updateUserProfile(user.id, { inventory: currentInv });
                await UserFarm.update({ plots }, { where: { userId: user.id } });

                return i.followUp({ content: `${ui.getEmoji('farm_seed') || '🌱'} Berhasil menanam bibit **${seedToPlant.name}** di Lahan ${plotIdx + 1}! Tunggu ${growTime} hari in-game untuk memanennya.`, ephemeral: true });
            }

            if (action === 'harvest') {
                const profile = await cacheManager.getUserProfile(user.id);
                const currentInv = safeParseInventory(profile.inventory);

                const harvestedCropId = plots[plotIdx].seed;
                const cropObj = itemsConfig.find(i => i.id === harvestedCropId);

                currentInv.push({ id: harvestedCropId, name: cropObj ? cropObj.name : harvestedCropId });
                plots[plotIdx] = { id: plotIdx, seed: null, plantedAtDay: null, harvestDay: null };

                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });
                await UserFarm.update({ plots }, { where: { userId: user.id } });

                return i.followUp({ content: `${ui.getEmoji('farm_harvest') || '🌾'} **PANEN BERHASIL!** Kamu mendapatkan **${cropObj ? cropObj.name : harvestedCropId}** dari Lahan ${plotIdx + 1}! Masuk ke dalam tas.`, ephemeral: true });
            }
        });
    }
};
