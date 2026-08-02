const UserProfile = require('../../../src/models/UserProfile');
const UserSurvival = require('../../../src/models/UserSurvival');
const cacheManager = require('../../../src/managers/cacheManager');
const UserPet = require('../../../src/models/UserPet');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const pets = await UserPet.findAll({ where: { userId: user.id } });

        if (pets.length === 0) {
            return ui.sendError(interaction, 'err_sys_55');
        }

        const activePet = pets.find(p => p.isActive) || pets[0];

        const buildPetPayload = (petObj, customDesc) => buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `🐾 Peliharaan: ${petObj.petName || petObj.petType}`,
            description: customDesc || `**Spesies:** ${petObj.petType.toUpperCase()}\n**Level:** ${petObj.petLevel || 1} (${petObj.petExp}/100 XP)\n**Lapar:** ${petObj.hunger}/100\n**Afeksi:** ${petObj.affection}/100\n\n**Ki Prawiro:** "Rawatlah ${petObj.petName || petObj.petType} dengan baik. Jika mereka sudah cukup kuat, bawalah kemari untuk aku *Breeding*."`,
            footerText: ui.getFooter('survival')
        });

        const row = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('pet_feed').setLabel('Beri Makan').setStyle(ButtonStyle.Success).setEmoji(ui.getEmoji('meat') || '🍖'),
            new ButtonBuilder().setCustomId('pet_breed').setLabel('Breeding (Ki Prawiro)').setStyle(ButtonStyle.Primary).setEmoji(ui.getEmoji('dna') || '🧬')
        );

        const response = await interaction.reply({ ...buildPetPayload(activePet), components: [row] });

        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.customId === 'pet_feed') {
                const p = await cacheManager.getUserProfile(user.id);
                const inv = p.inventory || [];

                const foodIndex = inv.findIndex(item => item && (item.id === 'pet_food' || item.id === 'meat'));

                if (foodIndex === -1) {
                    return i.followUp({ content: `${ui.getEmoji('error')} Kamu tidak punya Makanan Peliharaan atau Daging di inventory!`, ephemeral: true });
                }

                inv.splice(foodIndex, 1);
                p.inventory = inv;
                await p.save();

                activePet.hunger = Math.min(100, activePet.hunger + 30);
                activePet.affection = Math.min(100, activePet.affection + 5);
                activePet.petExp += 20;

                if (activePet.petExp >= 100) {
                    activePet.petLevel += 1;
                    activePet.petExp = 0;
                    i.followUp({ content: `🎉 **${activePet.petName || activePet.petType}** naik ke Level ${activePet.petLevel}!`, ephemeral: true });
                }

                await activePet.save();

                const updatedPayload = buildPetPayload(activePet, `**Spesies:** ${activePet.petType.toUpperCase()}\n**Level:** ${activePet.petLevel} (${activePet.petExp}/100 XP)\n**Lapar:** ${activePet.hunger}/100\n**Afeksi:** ${activePet.affection}/100\n\n**System:** *Nyam nyam... Peliharaanmu makan dengan lahap!*`);
                await response.edit({ ...updatedPayload, components: [row] });
            }

            if (i.customId === 'pet_breed') {
                if (activePet.petLevel < 10) {
                    return i.followUp({ content: `${ui.getEmoji('error')} **Ki Prawiro:** "Peliharaanmu masih terlalu kecil. Latih dia sampai minimal Level 10 dulu."`, ephemeral: true });
                }
                if (profile.economy_wallet < 5000) {
                    return i.followUp({ content: `${ui.getEmoji('error')} **Ki Prawiro:** "Jasa breeding butuh modal 5,000 Coin. Uangmu kurang."`, ephemeral: true });
                }

                await profile.decrement('economy_wallet', { by: 5000 });

                const rand = Math.random();
                let resultType = activePet.petType;
                if (rand < 0.1) resultType = 'mutant_' + activePet.petType;

                await UserPet.create({ userId: user.id, petType: resultType, isTamed: true, affection: 10 });
                i.followUp({ content: `🧬 **Breeding Sukses!** Kamu mendapatkan peliharaan baru bertipe **${resultType.toUpperCase()}**!`, ephemeral: true });
            }
        });

        collector.on('end', () => {
            const disabledRow = new ActionRowBuilder().addComponents(
                ...row.components.map(c => ButtonBuilder.from(c.toJSON()).setDisabled(true))
            );
            response.edit({ components: [disabledRow] }).catch(() => { });
        });
    }
};