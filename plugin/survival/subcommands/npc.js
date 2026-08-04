'use strict';

const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    MessageFlags
} = require('discord.js');
const path = require('path');

const UserSurvival = require('../../../src/models/UserSurvival');
const UserNPC = require('../../../src/models/UserNPC');
const cacheManager = require('../../../src/managers/cacheManager');
const languageManager = require('../../../src/managers/languageManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const npcConfig = require('../npcs');
const aiManager = require('../../ai/aiManager');
const actions = require('../npcActions');
const {
    COLLECTOR_MS,
    e,
    findPortrait,
    timeOfDayKey,
    isSameDay,
    buildActions,
    MAX_DAILY_GIFTS
} = require('../npcHelpers');

/** Minta AI merangkai sapaan. Selalu ada kalimat cadangan supaya NPC tak bisu. */
async function composeGreeting(ctx) {
    const { npc, lang, lokasi, timeOfDay, inGameHour, username, affection, relLabel, fallback } = ctx;

    const prompt = lang === 'en'
        ? `You are an NPC in a Discord RPG called Naura Hoshino.\nYour name: ${npc.name}.\nYour job: ${npc.title}.\nYour personality: ${npc.personality}.\nYou are currently in: ${lokasi}, during the ${timeOfDay} (in-game hour ${inGameHour}).\nYour closeness with the player (${username}) is ${affection}/100 (${relLabel}).\nMatch your warmth to that closeness: polite with acquaintances, affectionate with a partner or spouse.\nReply with one short, natural greeting in English. Two short sentences at most.`
        : `Kamu adalah karakter NPC di sebuah game RPG Discord bernama Naura Hoshino.\nNama kamu: ${npc.name}.\nPekerjaan: ${npc.title}.\nSifat kamu: ${npc.personality}.\nKamu sedang berada di: ${lokasi}, pada ${timeOfDay} (jam dalam game ${inGameHour}).\nTingkat kedekatan kamu dengan pemain (${username}) adalah ${affection}/100 (${relLabel}).\nSesuaikan kehangatanmu dengan kedekatan itu: sopan pada kenalan, mesra pada pacar atau pasangan.\nBerikan satu sapaan pendek yang natural dalam bahasa Indonesia. Maksimal dua kalimat pendek.`;

    try {
        const response = await aiManager.generateResponse(prompt);
        if (response) return response;
    } catch (error) {
        // Diamkan; kalimat cadangan sudah disiapkan.
    }
    return fallback;
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const lang = interaction.lang || await languageManager.getUserLanguage(user.id);
        const t = (key, placeholders) => languageManager.translateSync(lang, key, placeholders);

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const coin = e('nsf', '\uD83E\uDE99');
        const lokasi = survival.currentLocation || 'desa';
        const inGameHour = survival.inGameHour || 6;
        const timeOfDay = t(timeOfDayKey(inGameHour));

        // Sebagian NPC punya jadwal berpindah, jadi daftarnya ikut berubah
        // mengikuti jam dalam game.
        const presentNPCs = Object.values(npcConfig).filter(n => {
            const loc = (typeof n.getLocation === 'function') ? n.getLocation(inGameHour) : n.location;
            return loc === lokasi;
        });

        if (presentNPCs.length === 0) {
            return ui.sendError(interaction, t('npc.empty', { location: lokasi.toUpperCase() }), true);
        }

        const npcSelect = new StringSelectMenuBuilder()
            .setCustomId('npc_select')
            .setPlaceholder(t('npc.placeholder'));

        presentNPCs.forEach(n => {
            npcSelect.addOptions({
                label: n.name,
                description: n.title,
                value: n.id
            });
        });

        const selectRow = new ActionRowBuilder().addComponents(npcSelect);

        const listPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${e('happy', '\uD83D\uDC65')} ${t('npc.list_title', { location: lokasi.toUpperCase() })}`,
            description: t('npc.list_desc', { location: lokasi.toUpperCase(), timeOfDay, count: presentNPCs.length }),
            footerText: ui.getFooter('survival')
        });

        // Action row ditambahkan sesudah container, bukan menggantikannya.
        // Versi lama menimpa components sehingga isi kartunya hilang sama sekali.
        let lastContainer = listPayload.components;
        const openingPayload = { ...listPayload, components: [...lastContainer, selectRow] };

        const response = (interaction.deferred || interaction.replied)
            ? await interaction.followUp({ ...openingPayload, fetchReply: true })
            : await interaction.reply({ ...openingPayload, fetchReply: true });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: COLLECTOR_MS
        });

        let currentNpcId = null;

        collector.on('collect', async i => {
            await i.deferUpdate();

            // Memilih warga
            if (i.isStringSelectMenu() && i.customId === 'npc_select') {
                currentNpcId = i.values[0];
                const npc = npcConfig[currentNpcId];
                const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });

                const relLabel = t(`npc.rel_${npcData.relationshipLevel || 0}`);
                const affectionBar = ui.createProgressBar(npcData.affection, 100, 10);
                const giftsToday = isSameDay(npcData.lastInteraction, new Date()) ? (npcData.dailyGifts || 0) : 0;

                const aiDialog = await composeGreeting({
                    npc, lang, lokasi, timeOfDay, inGameHour,
                    username: user.username,
                    affection: npcData.affection,
                    relLabel,
                    fallback: t('npc.ai_fallback')
                });

                // Naura tidak punya berkas potret, jadi wajahnya diambil dari foto
                // profil bot supaya ia tampil sebagai dirinya sendiri.
                const portrait = findPortrait(npc);
                const files = [];
                let bannerAttachmentName;
                let iconURL;

                if (portrait) {
                    const fileName = `npc_${npc.id}${path.extname(portrait)}`;
                    files.push(new AttachmentBuilder(portrait, { name: fileName }));
                    bannerAttachmentName = fileName;
                } else {
                    iconURL = interaction.client.user.displayAvatarURL({ size: 512 });
                }

                const description = [
                    `*${npc.personality}*`,
                    '',
                    `**${t('npc.status')}:** ${relLabel}`,
                    `**${t('npc.affection')}:** ${npcData.affection}/100`,
                    affectionBar,
                    `-# ${t('npc.gift_left')}: ${Math.max(0, MAX_DAILY_GIFTS - giftsToday)}/${MAX_DAILY_GIFTS}`,
                    '',
                    `${e('chirping', '\uD83D\uDCAC')} **${npc.name}:** "${aiDialog}"`
                ].join('\n');

                const infoPayload = buildContainerV2({
                    accentColorHex: ui.getColor('primary') || '#FFB6C1',
                    title: `${npc.name} (${npc.title})`,
                    iconURL,
                    description,
                    bannerAttachmentName,
                    files,
                    footerText: ui.getFooter('survival')
                });

                lastContainer = infoPayload.components;

                return i.editReply({
                    ...infoPayload,
                    components: [...lastContainer, selectRow, buildActions(npc, npcData, t)]
                });
            }

            if (!i.isButton() || !currentNpcId) return;

            const handler = actions[i.customId];
            if (!handler) return;

            const npc = npcConfig[currentNpcId];
            const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });

            return handler(i, { npc, npcData, survival, profile, t, coin, now: new Date() });
        });

        // Saat sesi habis, tombolnya dicabut tapi isi kartunya dibiarkan utuh.
        collector.on('end', async () => {
            try {
                await response.edit({
                    flags: MessageFlags.IsComponentsV2,
                    components: lastContainer
                });
            } catch (error) {
                // Pesan mungkin sudah dihapus pemain; tidak perlu diributkan.
            }
        });
    }
};
