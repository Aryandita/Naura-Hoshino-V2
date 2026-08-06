/**
 * @namespace: plugin/core/coreStats.js
 * @type: Handler
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Diagnostik perangkat keras (stats) dan ringkasan server/bot (info).
 */

const { AttachmentBuilder, version: djsVersion } = require('discord.js');
const os = require('node:os');
const ui = require('../../src/config/ui');
const env = require('../../src/config/env');
const { buildContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { e, formatUptime, createNavButtons } = require('./coreCommon');

/** Membuang emoji bawaan berkas lokalisasi agar tidak dobel dengan emoji ui.js. */
function strip(text, pattern, fallback) {
    if (!text) return fallback;
    return text.replace(pattern, '');
}

async function handleStats(interaction, client, lang) {
    if (interaction.deferReply && !interaction.deferred) await interaction.deferReply();
    const dot = e('dot', '\\u25B6\\uFE0F');

    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const botMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    const cpuModel = os.cpus()[0].model.replace(/CPU|GHz|@|\\(R\\)|\\(TM\\)/g, '').trim();
    const cores = os.cpus().length;

    const eStats = e('stats', '\\uD83D\\uDCCA');
    const eServer = e('os', '\\uD83D\\uDDA5\\uFE0F');
    const eRam = e('ram', '\\uD83E\\uDDE0');
    const eSoftware = e('software', '\\u2699\\uFE0F');
    const eReach = e('reach', '\\uD83D\\uDCC8');

    const eCpu = e('cpu', '\\uD83D\\uDCBB');
    const eUptime = e('uptime', '\\u23F1\\uFE0F');
    const eGuilds = e('guilds', '\\uD83D\\uDC65');
    const eUsers = e('users', '\\uD83D\\uDC64');
    const eBotUptime = e('bot_uptime', '\\u23F1\\uFE0F');

    const cleanTitle = strip(lang.STATS_TITLE, /^\\uD83D\\uDCCA\\s*/, 'System Diagnostics');
    const cleanServer = strip(lang.STATS_SERVER, /^\\uD83D\\uDDA5\\uFE0F?\\s*/, 'Server');
    const cleanRam = strip(lang.STATS_RAM, /^\\uD83E\\uDDE0\\s*/, 'Memory');
    const cleanSoftware = strip(lang.STATS_SOFTWARE, /^\\u2699\\uFE0F?\\s*/, 'Software');
    const cleanReach = strip(lang.STATS_REACH, /^\\uD83D\\uDCC8\\s*/, 'Reach');

    const statsBanner = ui.getBanner('stats');

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('dark'),
        authorName: 'Naura Diagnostic Center',
        title: `${eStats} ${cleanTitle}`,
        iconURL: client.user.displayAvatarURL(),
        fields: [
            { name: `${eServer} ${cleanServer}`, value: `${dot} **${lang.STATS_PROCESSOR}:** ${eCpu} ${cpuModel} (${cores} Cores)\\n${dot} **${lang.STATS_OS}:** ${eServer} ${os.type()} ${os.arch()}\\n${dot} **${lang.STATS_UPTIME}:** ${eUptime} ${formatUptime(os.uptime() * 1000)}` },
            { name: `${eRam} ${cleanRam}`, value: `${dot} **${lang.STATS_RAM_SERVER}:** \\`${usedMem}GB / ${totalMem}GB\\`\\n${dot} **${lang.STATS_RAM_BOT}:** \\`${botMem} MB\\`` },
            { name: `${eSoftware} ${cleanSoftware}`, value: `${dot} **Node.js:** \\`${process.version}\\`\\n${dot} **Discord.js:** \\`v${djsVersion}\\`\\n${dot} **Engine:** \\`Naura Core v${env.ENGINE_VERSION || '1.1.0'}\\`` },
            { name: `${eReach} ${cleanReach}`, value: `${dot} **${lang.STATS_GUILDS}:** ${eGuilds} \\`${client.guilds.cache.size}\\`\\n${dot} **${lang.STATS_USERS}:** ${eUsers} \\`${client.users.cache.size}\\`\\n${dot} **${lang.STATS_BOT_UPTIME}:** ${eBotUptime} \\`${formatUptime(client.uptime)}\\`` }
        ],
        bannerAttachmentName: statsBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core')
    });

    if (statsBanner) {
        payload.files = [new AttachmentBuilder(statsBanner, { name: 'banner.png' })];
    }

    if (interaction.editReply) return interaction.editReply(payload);
    return interaction.reply(payload);
}

async function handleInfo(interaction, client, lang) {
    const eInfo = e('info', '\\u2139\\uFE0F');
    const eId = e('id', '\\uD83C\\uDD94');
    const eAdmin = e('admin', '\\uD83D\\uDC51');
    const eClock = e('clock', '\\uD83D\\uDCC5');
    const eUsers = e('users', '\\uD83D\\uDC65');
    const eBooster = e('booster', '\\uD83C\\uDF1F');
    const eReach = e('reach', '\\uD83D\\uDCC8');

    let title, thumbnailURL, fields;

    if (interaction.guild) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        const roleCount = guild.roles.cache.size;
        const channelCount = guild.channels.cache.size;

        const cleanTitle = strip(lang.INFO_SERVER_TITLE, /^\\u2139\\uFE0F?\\s*/, 'Server Info');

        title = `${eInfo} ${cleanTitle} - ${guild.name}`;
        thumbnailURL = guild.iconURL({ size: 512 }) || client.user.displayAvatarURL({ size: 512 });
        fields = [
            { name: `${eId} Server ID`, value: `\\`${guild.id}\\`` },
            { name: `${eAdmin} Owner`, value: `${owner.user.tag}` },
            { name: `${eClock} Created At`, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>` },
            { name: `${eUsers} Members [${guild.memberCount}]`, value: `Roles: ${roleCount} | Channels: ${channelCount}` },
            { name: `${eBooster} Boosts`, value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boosts)` }
        ];
    } else {
        const cleanTitle = strip(lang.INFO_BOT_TITLE, /^\\u2139\\uFE0F?\\s*/, 'Bot Info');

        title = `${eInfo} ${cleanTitle} - Naura Hoshino`;
        thumbnailURL = client.user.displayAvatarURL({ size: 512 });
        fields = [
            { name: `${eId} Bot ID`, value: `\\`${client.user.id}\\`` },
            { name: `${eAdmin} Developer`, value: 'Aryandita' },
            { name: `${eClock} Created At`, value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>` },
            { name: `${eReach} Reach`, value: `${client.guilds.cache.size} Servers | ${client.users.cache.size} Users` }
        ];
    }

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary'),
        authorName: 'Naura Info System',
        title,
        iconURL: thumbnailURL,
        fields,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core')
    });

    if (interaction.deferred || (interaction.editReply && !interaction.reply)) return interaction.editReply(payload);
    return interaction.reply(payload);
}

module.exports = { handleStats, handleInfo };
