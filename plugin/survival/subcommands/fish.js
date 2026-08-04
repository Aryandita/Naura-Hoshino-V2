'use strict';

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require('discord.js');
const cacheManager = require('../../../src/managers/cacheManager');
const { safeParseInventory } = require('../inventoryHelper');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const questGen = require('../questGenerator');
const achievementHelper = require('../achievementHelper');

const STAMINA_COST = 10;
const REACTION_MS = 2500;
const WAIT_MIN_MS = 3000;
const WAIT_SPAN_MS = 4000;

function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

function addItem(inventory, id, name, amount, type) {
    const exist = inventory.find(it => it && it.id === id);
    if (exist) exist.amount = (exist.amount || 1) + amount;
    else inventory.push({ id, name, amount, type });
}

function rollCatch() {
    const rand = Math.random() * 100;

    if (rand < 50) {
        return { id: 'trash', name: 'Sampah Plastik', emoji: e('trash', '\uD83D\uDDD1\uFE0F'), mood: 'fail' };
    }
    if (rand < 90) {
        return { id: 'salmon', name: 'Ikan Salmon', emoji: e('fish', '\uD83D\uDC1F'), mood: 'success' };
    }
    return { id: 'golden_fish', name: 'Ikan Mas Koki', emoji: e('goldfish', '\uD83D\uDC21'), mood: 'reward' };
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const profile = await cacheManager.getUserProfile(user.id);
        const survival = await cacheManager.getUserSurvival(user.id);

        const inventory = safeParseInventory(profile.inventory);
        const hasRod = inventory.some(i => i && i.id === 'fishing_rod');
        const bait = inventory.find(i => i && i.id === 'worm_bait');

        if (!hasRod) return ui.sendError(interaction, 'err_sys_46', true);
        if (!bait || (bait.amount || 0) <= 0) return ui.sendError(interaction, 'err_sys_47', true);
        if ((survival.stamina || 0) < STAMINA_COST) return ui.sendError(interaction, 'err_sys_48', true);

        survival.stamina -= STAMINA_COST;
        await survival.save();

        // Umpan terpakai satu, dan entrinya dibuang kalau sudah habis.
        bait.amount = (bait.amount || 1) - 1;
        const afterBait = bait.amount <= 0
            ? inventory.filter(i => i && i.id !== 'worm_bait')
            : inventory;
        await cacheManager.updateUserProfile(user.id, { inventory: afterBait });

        const waitingPayload = buildContainerV2({
            accentColorHex: '#3b82f6',
            authorName: 'Naura Fishing Spot',
            title: `${e('happy', '\uD83C\uDFA3')} Memancing di Pantai Utara`,
            iconURL: user.displayAvatarURL(),
            expression: 'loading',
            description: 'Kailmu sudah melayang ke laut. Naura ikut duduk di sebelah kamu sambil menunggu...\n\n> Sabar ya, ikannya belum menggigit.',
            footerText: ui.getFooter('survival')
        });

        // Perintah survival sudah di-defer orkestrator, jadi wajib editReply.
        const message = await interaction.editReply({ ...waitingPayload, embeds: [] });
        const waitTime = Math.floor(Math.random() * WAIT_SPAN_MS) + WAIT_MIN_MS;

        setTimeout(async () => {
            try {
                const pullBtn = new ButtonBuilder()
                    .setCustomId('fish_pull')
                    .setLabel('TARIK KAIL!')
                    .setStyle(ButtonStyle.Success)
                    .setEmoji(ui.parseEmoji(e('fishing_rod', '\uD83C\uDFA3')) || { name: '\uD83C\uDFA3' });

                const row = new ActionRowBuilder().addComponents(pullBtn);

                const alertPayload = buildContainerV2({
                    accentColorHex: '#ef4444',
                    authorName: 'Naura Fishing Spot',
                    title: `${e('shocked', '\u203C\uFE0F')} Ada yang menggigit!`,
                    iconURL: user.displayAvatarURL(),
                    expression: 'warning',
                    description: '**Cepat tarik kailnya sebelum ikannya kabur!** Ayo, Naura percaya sama refleks kamu!',
                    footerText: ui.getFooter('survival')
                });

                await interaction.editReply({
                    ...alertPayload,
                    embeds: [],
                    components: [...alertPayload.components, row]
                });

                const collector = message.createMessageComponentCollector({
                    filter: i => i.user.id === user.id,
                    time: REACTION_MS
                });

                let pulled = false;

                collector.on('collect', async i => {
                    pulled = true;
                    collector.stop('pulled');
                    await i.deferUpdate().catch(() => {});

                    const fresh = await cacheManager.getUserProfile(user.id);
                    const bag = safeParseInventory(fresh.inventory);
                    const catchResult = rollCatch();

                    addItem(bag, catchResult.id, catchResult.name, 1, 'loot');
                    await cacheManager.updateUserProfile(user.id, { inventory: bag });

                    const lines = catchResult.id === 'trash'
                        ? [
                            'Aduh... yang kena kail malah sampah. Nggak apa-apa, sekalian bersihkan laut ya!',
                            '',
                            `**${e('cheers', '\uD83C\uDF81')} Tangkapanmu**`,
                            `> ${catchResult.emoji} **1x ${catchResult.name}**`
                        ]
                        : [
                            'Waa, refleksmu cepat banget! Kailnya kamu tarik tepat pada waktunya. Naura kagum!',
                            '',
                            `**${e('cheers', '\uD83C\uDF81')} Tangkapanmu**`,
                            `> ${catchResult.emoji} **1x ${catchResult.name}**`
                        ];

                    if (catchResult.id === 'golden_fish') {
                        lines.push('', `${e('shocked', '\u2728')} Ini Ikan Mas Koki yang langka banget! Naura sampai kaget lihatnya.`);
                    }

                    const successPayload = buildContainerV2({
                        accentColorHex: ui.getColor('primary') || '#FFC0CB',
                        authorName: 'Naura Fishing Spot',
                        title: `${e('cheers', '\uD83C\uDF89')} Kailnya kena!`,
                        iconURL: user.displayAvatarURL(),
                        expression: catchResult.mood,
                        description: lines.join('\n'),
                        footerText: ui.getFooter('survival')
                    });

                    await interaction.editReply({ ...successPayload, embeds: [] }).catch(() => {});

                    await questGen.incrementQuestProgress(user.id, 'collect', 1).catch(() => {});

                    if (catchResult.id === 'golden_fish') {
                        await achievementHelper.unlockAchievement(interaction, 'master_angler');
                    }
                });

                collector.on('end', async () => {
                    if (pulled) return;

                    const failPayload = buildContainerV2({
                        accentColorHex: ui.getColor('warning') || '#FFB347',
                        authorName: 'Naura Fishing Spot',
                        title: `${e('cry', '\uD83D\uDCA6')} Ikannya kabur`,
                        iconURL: user.displayAvatarURL(),
                        expression: 'fail',
                        description: 'Yah, sedikit terlambat menariknya. Umpannya habis dimakan dan ikannya melenggang pergi. Jangan sedih, lempar kail lagi ya, Naura tunggu di sini!',
                        footerText: ui.getFooter('survival')
                    });

                    await interaction.editReply({ ...failPayload, embeds: [] }).catch(() => {});
                });
            } catch (err) {
                // Timer berjalan di luar alur perintah, jadi galatnya harus
                // ditelan supaya tidak menjatuhkan proses bot.
            }
        }, waitTime);
    }
};
