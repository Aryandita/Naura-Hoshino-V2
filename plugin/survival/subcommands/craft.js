// Lokasi: plugin/survival/subcommands/craft.js
const { ActionRowBuilder, StringSelectMenuBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require('discord.js');
const { buildContainerV2, buildErrorContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const UserSurvival = require('../../../src/models/UserSurvival');
const UserProfile = require('../../../src/models/UserProfile');
const cacheManager = require('../../../src/managers/cacheManager');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { advanceTime } = require('../../../plugin/survival/survivalTime');
const { createCanvas, GlobalFonts } = require('@napi-rs/canvas');

// Coba memuat font dari Canvas Asset
try {
    const fs = require('fs');
    if (fs.existsSync('./assets/fonts/Inter-Bold.ttf')) GlobalFonts.registerFromPath('./assets/fonts/Inter-Bold.ttf', 'Inter');
} catch (e) {}

// Fungsi menggambar UI Crafting
async function createCraftingCanvas(recipe, currentInv) {
    const canvas = createCanvas(600, 300);
    const ctx = canvas.getContext('2d');

    // Background kayu
    ctx.fillStyle = '#3E2723';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Pattern garis-garis tipis untuk efek kayu
    ctx.strokeStyle = '#4E342E';
    ctx.lineWidth = 2;
    for (let i = 0; i < canvas.height; i += 20) {
        ctx.beginPath();
        ctx.moveTo(0, i);
        ctx.lineTo(canvas.width, i);
        ctx.stroke();
    }

    // Border bingkai
    ctx.strokeStyle = '#271911';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);

    // Judul
    ctx.font = '24px "Inter", sans-serif';
    ctx.fillStyle = '#D7CCC8';
    ctx.fillText(`${ui.getEmoji('craft_table') || '🔨'} Naura Survival Game - Meja Perajin`, 20, 40);

    // Garis pemisah judul
    ctx.beginPath();
    ctx.moveTo(20, 50);
    ctx.lineTo(canvas.width - 20, 50);
    ctx.strokeStyle = '#8D6E63';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Nama Item yang akan dibuat
    ctx.font = 'bold 28px "Inter", sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText(`Target: ${recipe.name}`, 20, 90);

    // Kebutuhan Material
    ctx.font = '20px "Inter", sans-serif';
    ctx.fillStyle = '#FFCC80';
    ctx.fillText('Material yang Dibutuhkan:', 20, 130);

    let yOffset = 160;
    let allMaterialsReady = true;

    for (const [reqId, reqAmt] of Object.entries(recipe.req)) {
        // Cek Inventory untuk material ini. Format normalisasi: cari obyek atau string id
        let playerHas = 0;
        const itemObj = currentInv.find(i => (i.id === reqId || i === reqId));
        if (itemObj) {
            playerHas = itemObj.amount || 1;
        } else {
             // Coba hitung cara lama (array of string/object tanpa amount)
             playerHas = currentInv.filter(i => (i.id === reqId || i === reqId)).length;
        }

        const isEnough = playerHas >= reqAmt;
        if (!isEnough) allMaterialsReady = false;

        ctx.fillStyle = isEnough ? '#A5D6A7' : '#EF9A9A'; // Hijau jika cukup, merah jika kurang
        ctx.fillText(`- ${reqId.toUpperCase()}: ${playerHas} / ${reqAmt}`, 30, yOffset);
        yOffset += 30;
    }

    // Status / Kesimpulan di bawah
    ctx.font = 'bold 22px "Inter", sans-serif';
    if (allMaterialsReady) {
        ctx.fillStyle = '#81C784';
        ctx.fillText('✅ Bahan Cukup! Siap dirakit.', 20, 270);
    } else {
        ctx.fillStyle = '#E57373';
        ctx.fillText('❌ Bahan Kurang! Tidak bisa dirakit.', 20, 270);
    }

    return canvas.toBuffer('image/png');
}

module.exports = {
    async execute(interaction, client) {
        const user = interaction.user;
        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

        if (survival.currentLocation === 'prison') {
            return ui.sendError(interaction, 'err_sys_37', true);
        }

        const errEmbed = (msg) => buildErrorContainerV2({ title: 'Gagal', description: `${ui.getEmoji('error') || '❌'} ${msg}`, footerText: ui.getFooter('survival') });

        if (survival.stamina <= 10) {
            return ui.sendError(interaction, 'err_sys_38', true);
        }

        const profile = await cacheManager.getUserProfile(user.id);
        let currentInv = safeParseInventory(profile.inventory);

        // Definisi Resep Crafting (Blueprints)

        const recipes = {
            'iron_sword': { id: 'iron_sword', name: 'Pedang Besi', desc: 'Senjata yang lebih kuat dari pedang tua. (+20 DMG)', req: { 'iron_ore': 3, 'wood': 1 }, emoji: ui.getEmoji('sword') || '🗡️' },
            'diamond_sword': { id: 'diamond_sword', name: 'Pedang Berlian', desc: 'Senjata pamungkas penakluk naga. (+50 DMG)', req: { 'diamond': 2, 'iron_ore': 1, 'wood': 1 }, emoji: ui.getEmoji('diamond_sword') || '💎' },
            'fishing_rod': { id: 'fishing_rod', name: 'Alat Pancing Dasar', desc: 'Alat wajib untuk memancing.', req: { 'wood': 3, 'slime_gel': 1 }, emoji: ui.getEmoji('fishing_rod') || '🎣' },
            'wooden_pickaxe': { id: 'wooden_pickaxe', name: 'Beliung Kayu', desc: 'Alat dasar untuk menambang.', req: { 'wood': 3, 'stone': 2 }, emoji: ui.getEmoji('pickaxe') || '⛏️' },
            'wooden_axe': { id: 'wooden_axe', name: 'Kapak Kayu', desc: 'Alat dasar untuk menebang pohon.', req: { 'wood': 3, 'stone': 1 }, emoji: ui.getEmoji('axe') || '🪓' },
            'luxury_meal': { id: 'luxury_meal', name: 'Makanan Mewah', desc: 'Memulihkan 100% Hunger & Stamina.', req: { 'salmon': 1, 'mystic_herb': 1, 'mineral_water': 1 }, emoji: ui.getEmoji('soup') || '🍲' },

            'health_potion': { id: 'health_potion', name: 'Ramuan Penyembuh', desc: 'Memulihkan HP secara instan.', req: { 'mystic_herb': 2, 'mineral_water': 1 }, emoji: ui.getEmoji('potion') || '🧪' },
            'heist_mask': { id: 'heist_mask', name: 'Topeng Perampok', desc: 'Item wajib untuk menyembunyikan identitas saat Heist.', req: { 'trash': 5, 'wood': 1 }, emoji: ui.getEmoji('mask') || '🎭' },
            'c4_bomb': { id: 'c4_bomb', name: 'Bom Rakitan (C4)', desc: 'Peledak kuat untuk membobol brankas bank.', req: { 'iron_ore': 5, 'slime_gel': 3 }, emoji: ui.getEmoji('bomb') || '💣' }
        };

        const rpgState = survival.rpg_state || { unlocked_recipes: [] };
        const unlockedRecipes = rpgState.unlocked_recipes || [];

        const defaultRecipes = ['wooden_pickaxe', 'wooden_axe', 'fishing_rod', 'heist_mask', 'c4_bomb'];
        const availableRecipes = {};

        for (const [id, data] of Object.entries(recipes)) {
            if (defaultRecipes.includes(id) || unlockedRecipes.includes(id)) {
                availableRecipes[id] = data;
            }
        }

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('craft_select')
            .setPlaceholder('Pilih Barang Untuk Dirakit...');

        let hasOptions = false;
        for (const [id, data] of Object.entries(availableRecipes)) {
            hasOptions = true;
            let reqText = [];
            for (const [reqId, reqAmt] of Object.entries(data.req)) {
                reqText.push(`${reqAmt}x ${reqId}`);
            }
            selectMenu.addOptions({
                label: data.name,
                description: `Butuh: ${reqText.join(', ')}`,
                value: id,
                emoji: data.emoji
            });
        }


        if (!hasOptions) {
            selectMenu.addOptions({ label: 'Tidak ada resep', value: 'none' });
            selectMenu.setDisabled(true);
        }

        const craftPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${ui.getEmoji('craft_table') || '🔨'} Meja Perakitan (Crafting)`,
            description: '"Satukan material mentah menjadi barang yang berguna!"\n\nPilih cetak biru yang ingin kamu rakit dari daftar di bawah.',
            footerText: ui.getFooter('survival')
        });

        const response = await interaction.reply({ ...craftPayload, components: [new ActionRowBuilder().addComponents(selectMenu)] });
        const collector = response.createMessageComponentCollector({ filter: i => i.user.id === user.id, time: 120000 });

        let currentSelectedRecipeId = null;

        collector.on('collect', async i => {
            if (i.customId === 'craft_select') {
                await i.deferUpdate();
                currentSelectedRecipeId = i.values[0];
                const recipe = recipes[currentSelectedRecipeId];

                // Refresh Inventory
                const updatedProfile = await cacheManager.getUserProfile(user.id);
                currentInv = updatedProfile.inventory || [];

                const buffer = await createCraftingCanvas(recipe, currentInv);
                const attachment = new AttachmentBuilder(buffer, { name: 'crafting.png' });

                // Cek kesiapan material
                let canCraft = true;
                for (const [reqId, reqAmt] of Object.entries(recipe.req)) {
                    let playerHas = 0;
                    const itemObj = currentInv.find(item => (item.id === reqId || item === reqId));
                    if(itemObj) playerHas = itemObj.amount || 1;
                    else playerHas = currentInv.filter(item => (item.id === reqId || item === reqId)).length;

                    if (playerHas < reqAmt) canCraft = false;
                }

                const actionRow = new ActionRowBuilder().addComponents(
                    new ButtonBuilder()
                        .setCustomId('craft_confirm')
                        .setLabel(canCraft ? 'Rakit Sekarang' : 'Bahan Kurang')
                        .setStyle(canCraft ? ButtonStyle.Success : ButtonStyle.Danger)
                        .setDisabled(!canCraft),
                    new ButtonBuilder()
                        .setCustomId('craft_cancel')
                        .setLabel('Batal')
                        .setStyle(ButtonStyle.Secondary)
                );

                const infoPayload = buildContainerV2({
                    accentColorHex: canCraft ? ui.getColor('success') : ui.getColor('error'),
                    title: `Blueprint: ${recipe.name}`,
                    description: `**Deskripsi:** ${recipe.desc}\n\n*Waktu Perakitan: 1 Jam In-Game*\n*Konsumsi Stamina: 10*`,
                    bannerAttachmentName: 'crafting.png',
                    footerText: ui.getFooter('survival')
                });

                await i.editReply({ ...infoPayload, files: [attachment], components: [new ActionRowBuilder().addComponents(selectMenu), actionRow] });
            }
            else if (i.customId === 'craft_confirm') {
                await i.deferUpdate();
                if (!currentSelectedRecipeId) return;
                const recipe = recipes[currentSelectedRecipeId];

                const updatedProfile = await cacheManager.getUserProfile(user.id);
                currentInv = updatedProfile.inventory || [];

                // Pastikan kembali bahan cukup sebelum memproses (mencegah eksploitasi multi-click)
                let canCraft = true;
                for (const [reqId, reqAmt] of Object.entries(recipe.req)) {
                    let playerHas = 0;
                    const itemObj = currentInv.find(item => (item.id === reqId || item === reqId));
                    if(itemObj) playerHas = itemObj.amount || 1;
                    else playerHas = currentInv.filter(item => (item.id === reqId || item === reqId)).length;

                    if (playerHas < reqAmt) canCraft = false;
                }

                if (!canCraft) return i.followUp({ ...errEmbed('Bahan tiba-tiba kurang. Pastikan kamu tidak menekan dua kali atau membuang material.'), ephemeral: true });

                // Potong bahan
                for (const [reqId, reqAmt] of Object.entries(recipe.req)) {
                     const itemIdx = currentInv.findIndex(item => (item.id === reqId || item === reqId));
                     if(itemIdx > -1) {
                         let item = currentInv[itemIdx];
                         if(item.amount) {
                             item.amount -= reqAmt;
                             if(item.amount <= 0) currentInv.splice(itemIdx, 1);
                         } else {
                             // Fallback hapus sejumlah reqAmt kalau format lama
                             for(let k=0; k<reqAmt; k++) {
                                const idx = currentInv.findIndex(itm => (itm.id === reqId || itm === reqId));
                                if(idx > -1) currentInv.splice(idx, 1);
                             }
                         }
                     }
                }

                // Tambahkan hasil
                const existingResult = currentInv.find(itm => itm.id === recipe.id);
                if(existingResult) {
                    existingResult.amount = (existingResult.amount || 1) + 1;
                } else {
                    currentInv.push({ id: recipe.id, name: recipe.name, amount: 1 });
                }

                await UserProfile.update({ inventory: currentInv }, { where: { userId: user.id } });

                const s = await UserSurvival.findOne({ where: {userId: user.id} });
                await UserSurvival.update({ stamina: Math.max(0, s.stamina - 10) }, { where: { userId: user.id } });
                await advanceTime(user.id, 1);

                try {
                    const { incrementQuestProgress } = require('../../../plugin/survival/questGenerator');
                    await incrementQuestProgress(user.id, 'craft');
                } catch(e) {}

                const successPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: `${ui.getEmoji('craft_table') || '🛠️'} Perakitan Selesai!`,
                    description: `${ui.getEmoji('success') || '✅'} Kamu berhasil merakit **${recipe.emoji} ${recipe.name}**!\nBarang telah dimasukkan ke dalam tasmu.`,
                    footerText: ui.getFooter('survival')
                });

                await i.editReply({ ...successPayload, files: [], components: [] });
                collector.stop();
            }
            else if (i.customId === 'craft_cancel') {
                await i.deferUpdate();
                const cancelPayload = buildContainerV2({
                    accentColorHex: ui.getColor('secondary') || '#6b7280',
                    title: 'Batal Crafting',
                    description: 'Kamu meninggalkan Meja Perakitan.',
                    footerText: ui.getFooter('survival')
                });
                await i.editReply({ ...cancelPayload, files: [], components: [] });
                collector.stop();
            }
        });

        collector.on('end', collected => {
            if (collected.size === 0) {
                interaction.editReply({ components: [] }).catch(()=>{});
            }
        });
    }
};
