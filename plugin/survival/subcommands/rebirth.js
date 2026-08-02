// Lokasi: src/commands/survival/subcommands/rebirth.js
const { ActionRowBuilder, StringSelectMenuBuilder } = require('discord.js');
const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const UserFarm = require('../../../src/models/UserFarm');
const UserPet = require('../../../src/models/UserPet');
const UserNPC = require('../../../src/models/UserNPC');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        const currentLevel = survival.survival_level || 1;
        if (currentLevel < 100) {
            return ui.sendError(interaction, `Kamu harus mencapai **Level 100** untuk melakukan Reinkarnasi (Rebirth)! (Levelmu saat ini: ${currentLevel})`, true);
        }

        const rebirthPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('diff_star') || '🌌'} Gerbang Reinkarnasi`,
            description: `Selamat... Kamu telah mencapai puncak kehidupan di Naura City.\n\nApakah kamu siap mengorbankan segalanya (Uang, Properti, Level, Item) untuk **Lahir Kembali** di tingkat kesulitan baru dengan bonus permanen?\n\n*Pilih Tingkat Kesulitan Rebirth:*\n> ${ui.getEmoji('diff_easy') || '🟢'} **Mudah:** EXP +15%, Naura Star Fragment +5%, Stamina Drain -10%\n> ${ui.getEmoji('diff_normal') || '🟡'} **Normal:** EXP +10%, Naura Star Fragment +3%, Stamina Drain -5%\n> ${ui.getEmoji('diff_hard') || '🟠'} **Sulit:** EXP +5%, Naura Star Fragment +2.5%, Stamina Drain -3%\n> ${ui.getEmoji('diff_extreme') || '🔴'} **Ekstrim:** Musuh lebih kuat 100%, Harga Shop 1100%, EXP & Naura Star Fragment -20%, Stamina Drain +20%. Murni untuk Masokis. Tamatkan untuk mendapat gelar **"The Strongest & Smartest Survivor"**!`,
            footerText: ui.getFooter('survival')
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('rebirth_diff')
            .setPlaceholder('Pilih Nasibmu Selanjutnya...')
            .addOptions([
                { label: 'Rebirth Mode MUDAH', value: 'Mudah', emoji: ui.getEmoji('diff_easy') || '🟢' },
                { label: 'Rebirth Mode NORMAL', value: 'Normal', emoji: ui.getEmoji('diff_normal') || '🟡' },
                { label: 'Rebirth Mode SULIT', value: 'Sulit', emoji: ui.getEmoji('diff_hard') || '🟠' },
                { label: 'Rebirth Mode EKSTRIM', value: 'Ekstrim', emoji: ui.getEmoji('diff_extreme') || '🔴' }
            ]);

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const response = await interaction.reply({ ...rebirthPayload, components: [row] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const difficulty = i.values[0];

            const cacheManager = require('../../../src/managers/cacheManager');
            const profile = await cacheManager.getUserProfile(user.id);

            const rpgState = survival.rpg_state || {};
            rpgState.difficulty = difficulty;
            rpgState.rebirth_count = (rpgState.rebirth_count || 0) + 1;

            if (currentLevel >= 100 && rpgState.difficulty === 'Ekstrim') {
                rpgState.beat_extreme = true;
            }

            // RESET SURVIVAL
            survival.hunger = 100;
            survival.thirst = 100;
            survival.stamina = 100;
            survival.hp = 100;
            survival.strength = 1;
            survival.agility = 1;
            survival.intelligence = 1;
            survival.luck = 1;
            survival.survival_xp = 0;
            survival.survival_level = 1;
            survival.propertyId = 'jalanan';
            survival.currentLocation = 'village';
            survival.vehicle = null;
            survival.inGameDay = 1;
            survival.inGameHour = 6;
            survival.rpg_state = rpgState;

            // RESET PROFILE
            survival.starFragments = 0;
            profile.economy_bank = 0;
            profile.inventory = [];
            profile.tool_pickaxeLevel = 1;
            profile.tool_pickaxeDurability = 100;
            profile.tool_axeLevel = 1;
            profile.tool_axeDurability = 100;
            profile.tool_fishingRodLevel = 1;
            profile.tool_fishingRodDurability = 100;
            profile.weapon_level = 1;
            profile.dungeon_floor = 1;

            await UserNPC.destroy({ where: { userId: user.id } });
            await UserFarm.destroy({ where: { userId: user.id } });
            await UserPet.destroy({ where: { userId: user.id } });

            await survival.save();
            await profile.save();

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('primary') || '#FFC0CB',
                title: `${ui.getEmoji('diff_star') || '🌌'} Yaaay! Kamu Telah Lahir Kembali~! ✨`,
                description: `Cahaya hangat menyelimutimu... Selamat! Kamu terbangun sebagai sosok yang baru dan lebih kuat di tingkat kesulitan **${difficulty.toUpperCase()}**! 💕\n\nPerjalanan barumu dimulai lagi dari Desa Pemula. Gunakan \`/survival start\` untuk mendaftar lagi yaa! ✨`,
                footerText: ui.getFooter('survival')
            });

            await i.editReply(successPayload);
            collector.stop();
        });
    }
};
