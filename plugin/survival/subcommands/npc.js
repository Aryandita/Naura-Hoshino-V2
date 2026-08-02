const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const UserNPC = require('../../../src/models/UserNPC');
const ui = require('../../../src/config/ui');
const npcConfig = require('../../../plugin/survival/npcs');
const aiManager = require('../../ai/aiManager');
const redisManager = require('../../../src/managers/redisManager');
const { safeParseInventory } = require('../inventoryHelper');

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);
        const eNsf = ui.getEmoji('nsf') || '🪙';

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal', description: `${ui.getEmoji('error') || '❌'} ${msg}`, footerText: ui.getFooter('survival') });

        const lokasi = survival.currentLocation || 'desa';

        // Filter NPC based on current location (with dynamic scheduling support)
        const presentNPCs = Object.values(npcConfig).filter(n => {
            const loc = (typeof n.getLocation === 'function') ? n.getLocation(survival.inGameHour || 6) : n.location;
            return loc === lokasi;
        });

        if (presentNPCs.length === 0) {
            return ui.sendError(interaction, `Kamu melihat sekeliling **${lokasi}**... Sepi sekali. Tidak ada warga di sini.`, true);
        }

        const npcSelect = new StringSelectMenuBuilder()
            .setCustomId('npc_select')
            .setPlaceholder('Pilih warga untuk diajak bicara...');

        presentNPCs.forEach(n => {
            const relEmoji = ui.getEmoji(n.type === 'romansa' ? 'heart' : 'heart_blue') || (n.type === 'romansa' ? '❤️' : '💙');
            npcSelect.addOptions({ label: n.name, description: n.title, value: n.id, emoji: relEmoji });
        });

        const searchPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('npc_group') || '👥'} Penduduk ${lokasi.toUpperCase()}`,
            description: `${ui.getEmoji('lokasi') || '📍'} **Lokasi: ${lokasi.toUpperCase()}**\nKamu melihat beberapa warga lokal di sekitarmu.`,
            footerText: ui.getFooter('survival')
        });

        const payload = { ...searchPayload, components: [new ActionRowBuilder().addComponents(npcSelect)] };
        let response;
        if (interaction.deferred || interaction.replied) {
            response = await interaction.followUp({ ...payload, fetchReply: true });
        } else {
            response = await interaction.reply({ ...payload, fetchReply: true });
        }
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 120000 });
        let currentNpcId = null;

        collector.on('collect', async i => {
            await i.deferUpdate();

            if (i.isStringSelectMenu() && i.customId === 'npc_select') {
                currentNpcId = i.values[0];
                const selectedNPC = npcConfig[currentNpcId];

                const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });

                let relLabel = 'Kenalan';
                if (npcData.relationshipLevel === 1) relLabel = 'Teman';
                if (npcData.relationshipLevel === 2) relLabel = 'Sahabat';
                if (npcData.relationshipLevel === 3) relLabel = 'Pacar';
                if (npcData.relationshipLevel === 4) relLabel = 'Menikah';

                const affectionBar = ui.createProgressBar(npcData.affection, 100, 10);
                const relEmoji = ui.getEmoji(selectedNPC.type === 'romansa' ? 'heart' : 'heart_blue') || (selectedNPC.type === 'romansa' ? '❤️' : '💙');

                // Generate AI Dialogue
                let aiDialog = '*Sedang memikirkan sesuatu...*';
                try {
                    const prompt = `Kamu adalah karakter NPC di sebuah game RPG Discord bernama Naura Hoshino.
Nama kamu: ${selectedNPC.name}.
Pekerjaan: ${selectedNPC.title}.
Sifat kamu: ${selectedNPC.personality}.
Tingkat kedekatan kamu dengan player (${user.username}) adalah ${npcData.affection}/100 (${relLabel}).
Jika player adalah teman biasa, sapa dengan ramah/biasa. Jika pacar/menikah dan kamu tipe romantis, sapa dengan mesra.
Berikan 1 kalimat sapaan pendek yang sangat natural dan sesuai karaktermu (maksimal 2 kalimat pendek, bahasa Indonesia).`;

                    const aiResponse = await aiManager.generateResponse(prompt);
                    if (aiResponse) aiDialog = aiResponse;
                } catch(e) {
                    aiDialog = 'Halo! Ada yang bisa kubantu?';
                }

                const path = require('path');
                const fs = require('fs');

                const charImagePath = path.join('./assets/survival/characters', selectedNPC.image || `${selectedNPC.id}.jpeg`);
                let files = [];
                let bannerAttachmentName;
                if (fs.existsSync(charImagePath)) {
                    files.push(new AttachmentBuilder(charImagePath, { name: 'character.jpeg' }));
                    bannerAttachmentName = 'character.jpeg';
                }

                const infoPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFB6C1',
                    title: `${selectedNPC.name} (${selectedNPC.title})`,
                    description: `*${selectedNPC.personality}*\n\n${relEmoji} **Status Hubungan:** ${relLabel}\n**Afeksi:** ${npcData.affection}/100\n${affectionBar}\n\n▬▬▬ \n\n${ui.getEmoji('npc_talk') || '💬'} **${selectedNPC.name}:** "${aiDialog}"`,
                    bannerAttachmentName,
                    footerText: ui.getFooter('survival')
                });

                const payload = { ...infoPayload, components: [new ActionRowBuilder().addComponents(npcSelect), rowBtns], files };
                await i.editReply(payload);
            }

            if (i.isButton() && currentNpcId) {
                const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });
                const selectedNPC = npcConfig[currentNpcId];


                if (i.customId === 'npc_marry') {
                    // Normalisasi inventory sebelum akses .some() dan .findIndex()
                    const npcInv = safeParseInventory(profile.inventory);
                    profile.inventory = npcInv;

                    const hasRing = npcInv.some(item => item && item.id === 'wedding_ring');
                    if (!hasRing) {
                        return i.followUp({ embeds: [errEmbed('Kamu belum punya 💍 **Cincin Pernikahan**! Kamu bisa membelinya di Toko Emas / Merchant.')], ephemeral: true });
                    }

                    if (npcData.affection < 100) {
                        return i.followUp({ embeds: [errEmbed('Hatinya belum 100% untukmu! Tingkatkan terus afeksinya sampai penuh sebelum melamar.')], ephemeral: true });
                    }

                    // Hapus cincin dari inventory
                    const ringIndex = npcInv.findIndex(item => item && item.id === 'wedding_ring');
                    if (ringIndex !== -1) {
                        npcInv.splice(ringIndex, 1);
                        profile.inventory = npcInv;
                        await profile.save();
                    }

                    npcData.relationshipLevel = 4; // Menikah
                    await npcData.save();

                    const weddingBanner = ui.getBanner ? ui.getBanner('wedding') : null;
                    let files = [];
                    let bannerAttachmentName;
                    if (weddingBanner) {
                        files.push(new AttachmentBuilder(weddingBanner, { name: 'wedding.png' }));
                        bannerAttachmentName = 'wedding.png';
                    }

                    let extraMsg = '';
                    let currentRpgState = survival.rpg_state || {};
                    if (!currentRpgState.unlocked_cutscenes) currentRpgState.unlocked_cutscenes = [];
                    if (!currentRpgState.unlocked_cutscenes.includes('wedding')) {
                        currentRpgState.unlocked_cutscenes.push('wedding');
                        survival.rpg_state = currentRpgState;
                        await survival.save();
                        extraMsg = '\n\n🌟 **Cutscene Terbuka!** Kamu bisa melihat memori ini kapan saja di /survival gallery.';
                    }

                    const wedPayload = buildContainerV2({
                        accentColorHex: ui.getColor('success') || '#22c55e',
                        title: `${ui.getEmoji('wedding_ring') || '💍'} Pernikahan Suci`,
                        description: `Di bawah langit yang indah, kamu memberikan cincin itu kepada **${selectedNPC.name}**.\n\n"${selectedNPC.name}: Tentu saja... Aku bersedia menghabiskan hidupku bersamamu..."\n\nSelamat! Kamu resmi **Menikah** dengan ${selectedNPC.name}. Kamu membuka fitur rumah tangga khusus dan buff pasif permanen!${extraMsg}`,
                        bannerAttachmentName,
                        footerText: ui.getFooter('survival')
                    });

                    return i.followUp({ ...wedPayload, files });
                }

                if (i.customId === 'npc_greet') {
                    const bonus = Math.floor(Math.random() * 2) + 1;
                    npcData.affection = Math.min(100, npcData.affection + bonus);

                    // Level up logic
                    if (npcData.affection >= 30 && npcData.relationshipLevel < 1) npcData.relationshipLevel = 1;
                    if (npcData.affection >= 60 && npcData.relationshipLevel < 2) npcData.relationshipLevel = 2;
                    if (npcData.affection >= 90 && selectedNPC.type === 'romansa' && npcData.relationshipLevel < 3) npcData.relationshipLevel = 3;

                    await npcData.save();

                    const resPayload = buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Ngobrol', description: `Kamu mengobrol santai dengan ${selectedNPC.name}.\n> Afeksi **+${bonus} ❤️**`, footerText: ui.getFooter('survival') });
                    await i.followUp({ ...resPayload, ephemeral: true });
                }



                if (i.customId === 'npc_tax_pay') {
                    const rpgState = survival.rpg_state || { sick: false, tax_due: 0, house_seized: false };
                    if (rpgState.tax_due <= 0 && !rpgState.house_seized) {
                        const cleanPayload = buildContainerV2({ accentColorHex: ui.getColor('primary') || '#FFB6C1', title: 'Catatan Pajak', description: `${ui.getEmoji('npc_briefcase') || '💼'} **Pak Anif:** "Catatanmu bersih. Tidak ada tunggakan pajak rumah."`, footerText: ui.getFooter('survival') });
                        return i.followUp({ ...cleanPayload, ephemeral: true });
                    }

                    let cost = rpgState.tax_due;
                    if (rpgState.house_seized) cost += 1000; // Denda penyitaan

                    if (survival.starFragments < cost) {
                        return i.followUp({ embeds: [errEmbed(`Uangmu di dompet tidak cukup! (Butuh **${cost}** ${eNsf} **Naura Star Fragment**).`)], ephemeral: true });
                    }

                    survival.starFragments -= cost;
                    rpgState.tax_due = 0;
                    rpgState.house_seized = false;
                    survival.rpg_state = rpgState;

                    await profile.save();
                    await survival.save();

                    const resPayload = buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Pajak Lunas', description: `💼 **Pak Anif:** "Bagus. Pajak sudah lunas dan propertimu berstatus legal kembali."\n> Saldo berkurang **${cost}** ${eNsf} **Naura Star Fragment**.`, footerText: ui.getFooter('survival') });
                    return i.followUp({ ...resPayload, ephemeral: true });
                }

                if (i.customId === 'npc_repair') {
                    if (survival.starFragments < 500) {
                        return i.followUp({ embeds: [errEmbed('Uangmu tidak cukup untuk membayar jasa Bagas (Butuh 500 Naura Star Fragment).')], ephemeral: true });
                    }

                    survival.starFragments -= 500;
                    profile.tool_pickaxeDurability = 100;
                    profile.tool_axeDurability = 100;
                    profile.tool_fishingRodDurability = 100;
                    await profile.save();
                    await survival.save();

                    const resPayload = buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Perbaikan Alat', description: `⚒️ **Bagas:** "Beres! Semua alatmu (Kapak, Beliung, Pancingan) sudah kuperbaiki menjadi 100% tahan lama!"\n> Saldo berkurang **500** ${eNsf} **Naura Star Fragment**.`, footerText: ui.getFooter('survival') });
                    return i.followUp({ ...resPayload, ephemeral: true });
                }

                if (i.customId === 'npc_gift') {
                    if (survival.starFragments < 200) {
                        return i.followUp({ embeds: [errEmbed('Uangmu tidak cukup untuk membeli hadiah bagus (Butuh 200 Naura Star Fragment).')], ephemeral: true });
                    }

                    survival.starFragments -= 200;
                    await profile.save();
                    await survival.save();

                    const bonus = Math.floor(Math.random() * 5) + 3;
                    npcData.affection = Math.min(100, npcData.affection + bonus);

                    // Level up logic
                    if (npcData.affection >= 30 && npcData.relationshipLevel < 1) npcData.relationshipLevel = 1;
                    if (npcData.affection >= 60 && npcData.relationshipLevel < 2) npcData.relationshipLevel = 2;
                    if (npcData.affection >= 90 && selectedNPC.type === 'romansa' && npcData.relationshipLevel < 3) npcData.relationshipLevel = 3;

                    await npcData.save();

                    const resPayload = buildContainerV2({ accentColorHex: ui.getColor('success') || '#22c55e', title: 'Memberikan Hadiah', description: `Kamu membelikan hadiah mahal untuk ${selectedNPC.name}. Ia terlihat sangat senang!\n> Saldo berkurang **200** ${eNsf} **Naura Star Fragment**.\n> Afeksi **+${bonus} ❤️**`, footerText: ui.getFooter('survival') });
                    await i.followUp({ ...resPayload, ephemeral: true });
                }
            }
        });
    }
};