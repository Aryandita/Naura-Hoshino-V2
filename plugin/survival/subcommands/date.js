const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const UserNPC = require('../../../src/models/UserNPC');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const npcConfig = require('../../../plugin/survival/npcs');
const fs = require('fs');
const path = require('path');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') return ui.sendError(interaction, 'err_sys_39', true);
        if (survival.currentLocation !== 'park') return ui.sendError(interaction, 'err_sys_40', true);

        const profile = await cacheManager.getUserProfile(user.id);
        const currentInv = safeParseInventory(profile.inventory);
        const ticketIndex = currentInv.findIndex(item => item && item.id === 'date_ticket');

        if (ticketIndex === -1) return ui.sendError(interaction, 'err_sys_41', true);

        const romanticNPCs = Object.values(npcConfig).filter(n => n.type === 'romansa');
        const userNPCs = await UserNPC.findAll({ where: { userId: user.id } });
        const npcMap = new Map(userNPCs.map(n => [n.npcId, n]));

        const datePayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: '🎡 Taman Hiburan Naura',
            description: 'Kamu memegang selembar tiket kencan. Suasana di taman hiburan sangat meriah.\nDengan siapa kamu ingin menghabiskan waktu hari ini? (Pastikan Affection NPC cukup tinggi)',
            footerText: ui.getFooter('survival')
        });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('date_npc_select')
            .setPlaceholder('Pilih Pasangan Kencan...');

        romanticNPCs.forEach(n => {
            const data = npcMap.get(n.id) || { affection: 0, relationshipLevel: 0 };
            let relLabel = 'Kenalan';
            if (data.relationshipLevel === 1) relLabel = 'Teman';
            if (data.relationshipLevel === 2) relLabel = 'Sahabat';
            if (data.relationshipLevel === 3) relLabel = 'Pacar';
            if (data.relationshipLevel === 4) relLabel = 'Menikah';

            selectMenu.addOptions({
                label: n.name,
                description: `${n.title} • Afeksi: ${data.affection}/100 (${relLabel})`,
                value: n.id,
                emoji: ui.getEmoji('heart') || '❤️'
            });
        });

        const response = await interaction.reply({ ...datePayload, components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 60000 });

        collector.on('collect', async i => {
            await i.deferUpdate();
            const npcId = i.values[0];
            const selectedNPC = npcConfig[npcId];

            const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId } });

            if (npcData.affection < 20) {
                const errPayload = buildContainerV2({
                    accentColorHex: ui.getColor('error') || '#ef4444',
                    title: '❌ Ditolak!',
                    description: `**${selectedNPC.name}** menolak ajakanmu! Hubungan kalian masih terlalu canggung (Butuh minimal **20 Afeksi**). Terus sapa atau beri hadiah di \`/survival npc\`.`,
                    footerText: ui.getFooter('survival')
                });
                return i.followUp({ ...errPayload, ephemeral: true });
            }

            currentInv.splice(ticketIndex, 1);
            await cacheManager.updateUserProfile(user.id, { inventory: currentInv });

            const bonusAff = 15;
            npcData.affection = Math.min(100, npcData.affection + bonusAff);
            if (npcData.affection >= 30 && npcData.relationshipLevel < 1) npcData.relationshipLevel = 1;
            if (npcData.affection >= 60 && npcData.relationshipLevel < 2) npcData.relationshipLevel = 2;
            if (npcData.affection >= 90 && npcData.relationshipLevel < 3) npcData.relationshipLevel = 3;
            await npcData.save();

            // Cek gambar karakter NPC
            const charImagePath = path.join('./assets/survival/characters', selectedNPC.image || `${selectedNPC.id}.jpeg`);
            let files = [];
            let bannerAttachmentName;
            if (fs.existsSync(charImagePath)) {
                files.push(new AttachmentBuilder(charImagePath, { name: 'character.jpeg' }));
                bannerAttachmentName = 'character.jpeg';
            }

            const successPayload = buildContainerV2({
                accentColorHex: ui.getColor('success') || '#22c55e',
                title: '💖 Kencan Berhasil!',
                description: `Kamu menghabiskan waktu yang menyenangkan bersama **${selectedNPC.name}** di Bianglala.\nMereka terlihat sangat senang!\n\n> **Affection bertambah +${bonusAff} Poin!**`,
                bannerAttachmentName,
                footerText: ui.getFooter('survival')
            });

            await i.editReply({ ...successPayload, components: [], files });
        });
    }
};
