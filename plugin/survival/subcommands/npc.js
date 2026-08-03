const {
    ActionRowBuilder,
    StringSelectMenuBuilder,
    ButtonBuilder,
    ButtonStyle,
    AttachmentBuilder
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const UserSurvival = require('../../../src/models/UserSurvival');
const UserNPC = require('../../../src/models/UserNPC');
const cacheManager = require('../../../src/managers/cacheManager');
const languageManager = require('../../../src/managers/languageManager');
const ui = require('../../../src/config/ui');
const { buildContainerV2 } = require('../../../src/utils/NauraContainerBuilder');
const npcConfig = require('../npcs');
const aiManager = require('../../ai/aiManager');
const { safeParseInventory } = require('../inventoryHelper');

// ·· Aturan main ··················································
const GREET_COOLDOWN_MS = 30 * 60 * 1000; // jeda sebelum ngobrol menambah afeksi lagi
const MAX_DAILY_GIFTS = 3;
const GIFT_COST = 200;
const REPAIR_COST = 500;
const SEIZE_FINE = 1000;
const COLLECTOR_MS = 120000;

/**
 * Layanan khusus yang hanya dimiliki NPC tertentu. Disimpan di sini, bukan di
 * npcs.js, supaya berkas konfigurasi karakter tetap murni berisi jati diri
 * mereka dan tidak tercampur aturan permainan.
 */
const NPC_SERVICES = {
    bagas: 'repair',
    pak_anif: 'tax'
};

const CHARACTER_DIR = path.join(__dirname, '..', '..', '..', 'assets', 'survival', 'characters');
const IMAGE_EXTENSIONS = ['.png', '.webp', '.jpeg', '.jpg'];

/** Emoji dari ui.js, dengan cadangan sederhana bila kunci belum terisi. */
function e(name, fallback) {
    return ui.getEmoji(name) || fallback;
}

/**
 * Cari potret NPC. Nama berkas di konfigurasi didahulukan, lalu ditebak dari id
 * dengan menelusuri beberapa format. Mengembalikan null bila memang tidak ada,
 * sehingga NPC tanpa gambar tetap bisa diajak bicara.
 */
function findPortrait(npc) {
    const candidates = [];
    if (npc.image) candidates.push(path.join(CHARACTER_DIR, npc.image));
    for (const ext of IMAGE_EXTENSIONS) {
        candidates.push(path.join(CHARACTER_DIR, `${npc.id}${ext}`));
    }

    for (const candidate of candidates) {
        try {
            if (fs.existsSync(candidate)) return candidate;
        } catch (error) {
            // Kegagalan akses disk diperlakukan sama seperti berkas tidak ada.
        }
    }
    return null;
}

/** Bagian hari berdasarkan jam dalam game, dipakai untuk mewarnai sapaan. */
function timeOfDayKey(hour) {
    if (hour >= 5 && hour < 11) return 'npc.time_morning';
    if (hour >= 11 && hour < 15) return 'npc.time_noon';
    if (hour >= 15 && hour < 19) return 'npc.time_evening';
    return 'npc.time_night';
}

/** Apakah dua tanggal jatuh pada hari yang sama. Dipakai mereset jatah hadiah. */
function isSameDay(a, b) {
    if (!a || !b) return false;
    return a.getFullYear() === b.getFullYear()
        && a.getMonth() === b.getMonth()
        && a.getDate() === b.getDate();
}

/** Naikkan tingkat hubungan bila afeksinya sudah pantas. */
function refreshRelationship(npcData, npc) {
    if (npcData.relationshipLevel >= 4) return; // sudah menikah, tidak turun lagi
    if (npcData.affection >= 30 && npcData.relationshipLevel < 1) npcData.relationshipLevel = 1;
    if (npcData.affection >= 60 && npcData.relationshipLevel < 2) npcData.relationshipLevel = 2;
    if (npcData.affection >= 90 && npc.type === 'romansa' && npcData.relationshipLevel < 3) {
        npcData.relationshipLevel = 3;
    }
}

module.exports = {
    async execute(interaction) {
        const user = interaction.user;
        const lang = interaction.lang || await languageManager.getUserLanguage(user.id);
        const t = (key, placeholders) => languageManager.translateSync(lang, key, placeholders);

        const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });
        const profile = await cacheManager.getUserProfile(user.id);

        const coin = e('nsf', '\ud83e\ude99');
        const lokasi = survival.currentLocation || 'desa';
        const inGameHour = survival.inGameHour || 6;
        const timeOfDay = t(timeOfDayKey(inGameHour));

        // NPC yang sedang berada di lokasi ini. Sebagian punya jadwal berpindah,
        // jadi daftarnya berubah mengikuti jam dalam game.
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
                value: n.id,
                emoji: n.type === 'romansa' ? e('heart', '\u2764\ufe0f') : e('heart_blue', '\ud83d\udc99')
            });
        });

        const listPayload = buildContainerV2({
            accentColorHex: ui.getColor('primary') || '#FFB6C1',
            title: `${e('npc_group', '\ud83d\udc65')} ${t('npc.list_title', { location: lokasi.toUpperCase() })}`,
            description: `${e('lokasi', '\ud83d\udccd')} ${t('npc.list_desc', { location: lokasi.toUpperCase(), timeOfDay, count: presentNPCs.length })}`,
            footerText: ui.getFooter('survival')
        });

        const selectRow = new ActionRowBuilder().addComponents(npcSelect);
        const openingPayload = { ...listPayload, components: [selectRow] };

        const response = (interaction.deferred || interaction.replied)
            ? await interaction.followUp({ ...openingPayload, fetchReply: true })
            : await interaction.reply({ ...openingPayload, fetchReply: true });

        const collector = response.createMessageComponentCollector({
            filter: i => i.user.id === user.id,
            time: COLLECTOR_MS
        });

        let currentNpcId = null;

        /** Rakit tombol sesuai NPC dan keadaan hubungan saat ini. */
        const buildActions = (npc, npcData) => {
            const row = new ActionRowBuilder();

            row.addComponents(
                new ButtonBuilder()
                    .setCustomId('npc_greet')
                    .setLabel(t('npc.btn_greet'))
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId('npc_gift')
                    .setLabel(t('npc.btn_gift'))
                    .setStyle(ButtonStyle.Secondary)
            );

            // Lamaran hanya muncul bila memang sudah pantas, jadi tombolnya sendiri
            // sudah menjadi petunjuk kemajuan hubungan.
            if (npc.type === 'romansa' && npcData.relationshipLevel === 3 && npcData.affection >= 100) {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('npc_marry')
                        .setLabel(t('npc.btn_marry'))
                        .setStyle(ButtonStyle.Success)
                );
            }

            const service = NPC_SERVICES[npc.id];
            if (service === 'repair') {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('npc_repair')
                        .setLabel(t('npc.btn_repair'))
                        .setStyle(ButtonStyle.Secondary)
                );
            } else if (service === 'tax') {
                row.addComponents(
                    new ButtonBuilder()
                        .setCustomId('npc_tax_pay')
                        .setLabel(t('npc.btn_tax'))
                        .setStyle(ButtonStyle.Secondary)
                );
            }

            return row;
        };

        /** Balasan singkat yang hanya terlihat oleh pemain. */
        const reply = (i, title, description, colorName = 'success') => {
            const payload = buildContainerV2({
                accentColorHex: ui.getColor(colorName) || '#FFB6C1',
                title,
                description,
                footerText: ui.getFooter('survival')
            });
            return i.followUp({ ...payload, ephemeral: true });
        };

        const fail = (i, message) => reply(i, `${e('error', '\u274c')} ${t('common.error.title')}`, message, 'error');

        collector.on('collect', async i => {
            await i.deferUpdate();

            // ·· Memilih warga ·································
            if (i.isStringSelectMenu() && i.customId === 'npc_select') {
                currentNpcId = i.values[0];
                const npc = npcConfig[currentNpcId];
                const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });

                const relLabel = t(`npc.rel_${npcData.relationshipLevel || 0}`);
                const relEmoji = npc.type === 'romansa' ? e('heart', '\u2764\ufe0f') : e('heart_blue', '\ud83d\udc99');
                const affectionBar = ui.createProgressBar(npcData.affection, 100, 10);

                const giftsToday = isSameDay(npcData.lastInteraction, new Date()) ? (npcData.dailyGifts || 0) : 0;

                // Sapaan dirangkai AI dengan bekal keadaan saat ini, sehingga kalimatnya
                // ikut berubah mengikuti waktu, lokasi, dan kedekatan kalian.
                let aiDialog = t('npc.ai_fallback');
                try {
                    const prompt = lang === 'en'
                        ? `You are an NPC in a Discord RPG called Naura Hoshino.\nYour name: ${npc.name}.\nYour job: ${npc.title}.\nYour personality: ${npc.personality}.\nYou are currently in: ${lokasi}, during the ${timeOfDay} (in-game hour ${inGameHour}).\nYour closeness with the player (${user.username}) is ${npcData.affection}/100 (${relLabel}).\nMatch your warmth to that closeness: polite with acquaintances, affectionate with a partner or spouse.\nReply with one short, natural greeting in English. Two short sentences at most.`
                        : `Kamu adalah karakter NPC di sebuah game RPG Discord bernama Naura Hoshino.\nNama kamu: ${npc.name}.\nPekerjaan: ${npc.title}.\nSifat kamu: ${npc.personality}.\nKamu sedang berada di: ${lokasi}, pada ${timeOfDay} (jam dalam game ${inGameHour}).\nTingkat kedekatan kamu dengan pemain (${user.username}) adalah ${npcData.affection}/100 (${relLabel}).\nSesuaikan kehangatanmu dengan kedekatan itu: sopan pada kenalan, mesra pada pacar atau pasangan.\nBerikan satu sapaan pendek yang natural dalam bahasa Indonesia. Maksimal dua kalimat pendek.`;

                    const aiResponse = await aiManager.generateResponse(prompt);
                    if (aiResponse) aiDialog = aiResponse;
                } catch (error) {
                    // Sapaan cadangan sudah disiapkan, jadi NPC tidak pernah bisu.
                }

                // Potret NPC. Bila berkasnya tidak ada — seperti Naura, yang memang tidak
                // punya berkas di folder karakter — wajahnya diambil dari foto profil bot
                // itu sendiri, sehingga ia tampil sebagai dirinya yang asli.
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
                    `${relEmoji} **${t('npc.status')}:** ${relLabel}`,
                    `**${t('npc.affection')}:** ${npcData.affection}/100`,
                    affectionBar,
                    `-# ${t('npc.gift_left')}: ${Math.max(0, MAX_DAILY_GIFTS - giftsToday)}/${MAX_DAILY_GIFTS}`,
                    '',
                    `${e('npc_talk', '\ud83d\udcac')} **${npc.name}:** "${aiDialog}"`
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

                return i.editReply({
                    ...infoPayload,
                    components: [selectRow, buildActions(npc, npcData)]
                });
            }

            if (!i.isButton() || !currentNpcId) return;

            const npc = npcConfig[currentNpcId];
            const [npcData] = await UserNPC.findOrCreate({ where: { userId: user.id, npcId: currentNpcId } });
            const now = new Date();

            // ·· Ngobrol ············································
            if (i.customId === 'npc_greet') {
                const last = npcData.lastInteraction ? new Date(npcData.lastInteraction) : null;
                if (last && (now - last) < GREET_COOLDOWN_MS) {
                    return fail(i, t('npc.greet_cooldown', { name: npc.name }));
                }

                const bonus = Math.floor(Math.random() * 2) + 1;
                npcData.affection = Math.min(100, npcData.affection + bonus);
                npcData.lastInteraction = now;
                refreshRelationship(npcData, npc);
                await npcData.save();

                return reply(
                    i,
                    `${e('npc_talk', '\ud83d\udcac')} ${t('npc.greet_title')}`,
                    t('npc.greet_body', { name: npc.name, bonus })
                );
            }

            // ·· Memberi hadiah ····································
            if (i.customId === 'npc_gift') {
                const giftsToday = isSameDay(npcData.lastInteraction, now) ? (npcData.dailyGifts || 0) : 0;
                if (giftsToday >= MAX_DAILY_GIFTS) {
                    return fail(i, t('npc.gift_limit', { name: npc.name, max: MAX_DAILY_GIFTS }));
                }

                if (survival.starFragments < GIFT_COST) {
                    return fail(i, t('npc.gift_poor', { cost: `${GIFT_COST} ${coin}` }));
                }

                survival.starFragments -= GIFT_COST;
                await survival.save();

                const bonus = Math.floor(Math.random() * 5) + 3;
                npcData.affection = Math.min(100, npcData.affection + bonus);
                npcData.dailyGifts = giftsToday + 1;
                npcData.lastInteraction = now;
                refreshRelationship(npcData, npc);
                await npcData.save();

                return reply(
                    i,
                    `${e('gift', '\ud83c\udf81')} ${t('npc.gift_title')}`,
                    t('npc.gift_body', { name: npc.name, cost: `${GIFT_COST} ${coin}`, bonus })
                );
            }

            // ·· Melamar ············································
            if (i.customId === 'npc_marry') {
                // Penjaga yang sebelumnya tidak ada: NPC berjenis teman tidak boleh dilamar.
                if (npc.type !== 'romansa') {
                    return fail(i, t('npc.marry_wrong_type', { name: npc.name }));
                }

                const inventory = safeParseInventory(profile.inventory);
                profile.inventory = inventory;

                const ringIndex = inventory.findIndex(item => item && item.id === 'wedding_ring');
                if (ringIndex === -1) {
                    return fail(i, t('npc.marry_no_ring'));
                }

                if (npcData.affection < 100) {
                    return fail(i, t('npc.marry_not_ready', { name: npc.name }));
                }

                inventory.splice(ringIndex, 1);
                profile.inventory = inventory;
                await profile.save();

                npcData.relationshipLevel = 4;
                npcData.lastInteraction = now;
                await npcData.save();

                let extraMsg = '';
                const rpgState = survival.rpg_state || {};
                if (!Array.isArray(rpgState.unlocked_cutscenes)) rpgState.unlocked_cutscenes = [];
                if (!rpgState.unlocked_cutscenes.includes('wedding')) {
                    rpgState.unlocked_cutscenes.push('wedding');
                    survival.rpg_state = rpgState;
                    await survival.save();
                    extraMsg = t('npc.cutscene_unlocked');
                }

                const files = [];
                let bannerAttachmentName;
                const weddingBanner = ui.getBanner ? ui.getBanner('wedding') : null;
                if (weddingBanner) {
                    files.push(new AttachmentBuilder(weddingBanner, { name: 'wedding.png' }));
                    bannerAttachmentName = 'wedding.png';
                }

                const wedPayload = buildContainerV2({
                    accentColorHex: ui.getColor('success') || '#22c55e',
                    title: `${e('wedding_ring', '\ud83d\udc8d')} ${t('npc.marry_title')}`,
                    description: `${t('npc.marry_body', { name: npc.name })}${extraMsg}`,
                    bannerAttachmentName,
                    files,
                    footerText: ui.getFooter('survival')
                });

                return i.followUp(wedPayload);
            }

            // ·· Perbaikan alat (Bagas) ··································
            if (i.customId === 'npc_repair') {
                if (survival.starFragments < REPAIR_COST) {
                    return fail(i, t('npc.repair_poor', { cost: `${REPAIR_COST} ${coin}` }));
                }

                survival.starFragments -= REPAIR_COST;
                profile.tool_pickaxeDurability = 100;
                profile.tool_axeDurability = 100;
                profile.tool_fishingRodDurability = 100;
                await profile.save();
                await survival.save();

                return reply(
                    i,
                    `${e('craft', '\u2692\ufe0f')} ${t('npc.repair_title')}`,
                    t('npc.repair_body', { name: npc.name, cost: `${REPAIR_COST} ${coin}` })
                );
            }

            // ·· Pajak (Pak Anif) ······································
            if (i.customId === 'npc_tax_pay') {
                const rpgState = survival.rpg_state || { tax_due: 0, house_seized: false };
                const taxDue = rpgState.tax_due || 0;

                if (taxDue <= 0 && !rpgState.house_seized) {
                    return reply(
                        i,
                        `${e('npc_briefcase', '\ud83d\udcbc')} ${t('npc.tax_title')}`,
                        t('npc.tax_clean', { name: npc.name }),
                        'primary'
                    );
                }

                const cost = taxDue + (rpgState.house_seized ? SEIZE_FINE : 0);
                if (survival.starFragments < cost) {
                    return fail(i, t('npc.tax_poor', { cost: `${cost} ${coin}` }));
                }

                survival.starFragments -= cost;
                rpgState.tax_due = 0;
                rpgState.house_seized = false;
                survival.rpg_state = rpgState;
                await survival.save();

                return reply(
                    i,
                    `${e('npc_briefcase', '\ud83d\udcbc')} ${t('npc.tax_title')}`,
                    t('npc.tax_paid', { name: npc.name, cost: `${cost} ${coin}` })
                );
            }
        });

        // Tombol dinonaktifkan saat sesi habis, supaya pemain tidak menekan sesuatu
        // yang sudah tidak akan menjawab.
        collector.on('end', async () => {
            try {
                await response.edit({ components: [] });
            } catch (error) {
                // Pesan mungkin sudah dihapus pemain; tidak perlu diributkan.
            }
        });
    }
};
