/**
 * @namespace: plugin/core/coreAbout.js
 * @type: Handler
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Perkenalan Naura, telemetri shard, dan program partnership.
 */

const { AttachmentBuilder } = require('discord.js');
const ui = require('../../src/config/ui');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { e, face, createNavButtons } = require('./coreCommon');

/** Menghitung jangkauan lintas shard, dengan cadangan hitungan cache lokal. */
async function collectReach(client) {
    let totalGuilds = client.guilds.cache.size;
    let totalUsers = client.users.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    if (client.shard) {
        try {
            const guildResults = await client.shard.fetchClientValues('guilds.cache.size');
            totalGuilds = guildResults.reduce((acc, count) => acc + count, 0);

            const userResults = await client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0));
            totalUsers = userResults.reduce((acc, count) => acc + count, 0);
        } catch (err) {
            // Fallback ke hitungan cache lokal
        }
    }

    if (totalUsers <= 0) {
        totalUsers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) || client.users.cache.size;
    }

    return { totalGuilds, totalUsers };
}

async function handleAbout(interaction, client, lang) {
    if (!interaction.deferred) {
        await interaction.deferReply().catch(() => { });
        interaction.deferred = true;
    }

    const shardId = client.shard ? client.shard.ids[0] : 0;
    const totalShards = client.shard ? client.shard.count : 1;
    const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const { totalGuilds, totalUsers } = await collectReach(client);

    const ePower = e('power', '\\uD83E\\uDD16');
    const eStats = e('stats', '\\uD83D\\uDCCA');
    const eDeveloper = e('admin', '\\uD83D\\uDC51');
    const eShard = e('shard', '\\uD83D\\uDCDF');
    const eMemory = e('memory', '\\uD83D\\uDCBE');
    const ePing = e('ping', '\\u26A1');
    const eGuilds = e('guilds', '\\uD83C\\uDF0D');
    const eUsers = e('users', '\\uD83D\\uDC65');
    const eHeart = e('favorite', '\\uD83D\\uDC96');
    const ePartner = e('handshake', '\\uD83E\\uDD1D');
    const eSparkle = e('sparkle', '\\u2728');
    const eStar = e('star', '\\u2B50');
    const eCheck = e('check', '\\u2705');

    // Wajah Naura untuk judul: senyum senang saat memperkenalkan diri
    const eAbout = face('happy', '\\uD83D\\uDC67');

    const sysStatus = `${ePower} **Status Sistem:** Online\\n` +
        `${eShard} **Shard ID:** \\`#${shardId} / ${totalShards}\\`\\n` +
        `${eMemory} **Memory usage:** \\`${memUsage} MB\\`\\n` +
        `${ePing} **Shard Ping:** \\`${client.ws.ping} ms\\`\\n` +
        `${eGuilds} **Total Guilds:** \\`${totalGuilds.toLocaleString('id-ID')}\\`\\n` +
        `${eUsers} **Total Users:** \\`${totalUsers.toLocaleString('id-ID')}\\``;

    const partnershipText =
        `### ${ePartner} **Program Partnership Server Discord**\\n` +
        `Hai para pemilik server! Naura selalu terbuka buat menjalin kerja sama (Partnership) dengan komunitas kalian lho ${eSparkle}. Kita bisa saling bantu mempromosikan dan memajukan server secara sehat!\\n\\n` +
        `**${eStar} Benefit Partnership Naura:**\\n` +
        `> ${eCheck} **Promosi Jaringan Server:** Server kamu dipromosikan di jaringan komunitas Naura.\\n` +
        `> ${eCheck} **Fasilitas VIP Gratis:** Akses fitur VIP Premium gratis khusus untuk server partner.\\n` +
        `> ${eCheck} **Dukungan Prioritas:** Bantuan teknis & setup prioritas langsung dari Aryandita.\\n\\n` +
        `**${eStar} Syarat & Ketentuan Partnership:**\\n` +
        `> ${eCheck} Memiliki minimal **100+ member aktif** di server Discord kamu.\\n` +
        `> ${eCheck} Mematuhi Discord Terms of Service & Community Guidelines.\\n` +
        `> ${eCheck} Memasang bot Naura Hoshino di server dan bersedia saling mempromosikan.`;

    const cleanTitle = (lang.ABOUT_TITLE || 'Meet Naura Hoshino!').replace(/^\\uD83C\\uDF80\\s*/, '');
    const aboutBanner = ui.getBanner('about');

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('accent') || '#C084FC',
        authorName: 'Naura Hoshino Identity',
        title: `${eAbout} ${cleanTitle}`,
        iconURL: client.user.displayAvatarURL(),
        expression: 'welcome',
        description:
            `Konnichiwa! Namaku **Naura Hoshino** ${eHeart}. Aku asisten virtual generasi terbaru buatan **Aryandita** yang dirancang buat nemenin hari-harimu di Discord.\\n\\n` +
            `Aku dibuat dengan penuh perhatian supaya terasa hangat, ramah, dan gak kaku selayaknya teman sungguhan! Dari mutar musik jernih 24/7, ngobrol seru bareng AI, petualangan RPG survival, sampai moderasi server, aku siap bantu kamu kapan pun! ${eSparkle}\\n\\n` +
            `${partnershipText}`,
        fields: [
            { name: `${eStats} TELEMETRI SHARD & SISTEM`, value: sysStatus },
            { name: `${eDeveloper} DEVELOPER / CREATOR`, value: '`Aryandita` (Developer Utama & Pencipta Ekosistem Naura Hoshino)' }
        ],
        bannerAttachmentName: aboutBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core')
    });

    if (aboutBanner) {
        payload.files = [new AttachmentBuilder(aboutBanner, { name: 'banner.png' })];
    }

    return interaction.editReply(payload);
}

module.exports = { handleAbout };
