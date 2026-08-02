/**
 * @namespace: src/commands/Core/core.js
 * @type: Command
 * @copyright © 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.1.0
 * @description Core system, statistics, and interactive help menu for Naura with Localization.
 */

const LanguageManager = require('../../src/managers/languageManager');
const {
    SlashCommandBuilder,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    StringSelectMenuBuilder,
    AttachmentBuilder,
    ComponentType,
    MessageFlags,
    version: djsVersion
} = require('discord.js');
const os = require('node:os');
const path = require('path');
const fs = require('fs');
const { sequelize } = require('../../src/managers/dbManager');
const GuildSettings = require('../../src/models/GuildSettings');
const ui = require('../../src/config/ui');
const env = require('../../src/config/env');
const { buildContainerV2, buildErrorContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');

const locales = {
    id: require('./locales/id.json'),
    en: require('./locales/en.json')
};

// ==========================================
// 🔧 KONSTANTA & LINK BRANDING NAURA
// ==========================================
const rawDashboard = ui.dashboards || 'http://92.118.206.166:30398';
const LINKS = {
    SUPPORT: ui.support_server || 'https://dsc.gg/naura-hoshino',
    DASHBOARD: rawDashboard.startsWith('http') ? rawDashboard : `http://${rawDashboard}`,
    INVITE: ui.invite || 'https://discord.com/api/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands'
};

// ==========================================
// 🛠️ FUNGSI UTILITAS LOKAL
// ==========================================
// PERBAIKAN: Menangani ms < 1000 agar memunculkan teks "Baru saja mulai"
function formatUptime(ms) {
    if (ms < 1000) return 'Baru saja mulai ✨';

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((ms % (1000 * 60)) / 1000);

    let result = [];
    if (days > 0) result.push(`${days}d`);
    if (hours > 0) result.push(`${hours}h`);
    if (minutes > 0) result.push(`${minutes}m`);
    if (seconds > 0) result.push(`${seconds}s`);

    return result.length > 0 ? result.join(' ') : 'Baru saja mulai ✨';
}

function createNavButtons() {
    const supportEmoji = ui.getEmoji('support') || '💬';
    const dashboardEmoji = ui.getEmoji('dashboard') || '🌐';
    const inviteEmoji = ui.getEmoji('invite') || '📩';

    return new ActionRowBuilder().addComponents(
        new ButtonBuilder().setLabel('Support Server').setURL(LINKS.SUPPORT).setStyle(ButtonStyle.Link).setEmoji(supportEmoji),
        new ButtonBuilder().setLabel('Web Dashboard').setURL(LINKS.DASHBOARD).setStyle(ButtonStyle.Link).setEmoji(dashboardEmoji),
        new ButtonBuilder().setLabel('Invite Naura').setURL(LINKS.INVITE).setStyle(ButtonStyle.Link).setEmoji(inviteEmoji)
    );
}

function formatHelpContent(text) {
    if (!text) return '';
    return text.replace(/{emoji:(\w+)(?:\|([^}]+))?}/g, (match, key, fallback) => {
        return ui.getEmoji(key) || fallback || match;
    });
}


// ==========================================
// 🚀 ROUTER COMMAND UTAMA
// ==========================================
module.exports = {
    data: new SlashCommandBuilder()
        .setName('core')
        .setDescription('⚙️ Pusat Informasi & Sistem Inti Naura Hoshino / Core System')
        .addSubcommand(sub => sub.setName('ping').setDescription('🏓 Cek respons latensi Discord, Database MySQL, & Lavalink.'))
        .addSubcommand(sub => sub.setName('stats').setDescription('📊 Lihat diagnostik spesifikasi server, RAM, dan OS Naura.'))
        .addSubcommand(sub => sub.setName('info').setDescription('ℹ️ Tampilkan info spesifik server saat ini atau info bot secara umum.'))
        .addSubcommand(sub => sub.setName('about').setDescription('👧🏻 Kenalan lebih dekat dengan Naura dan Aryandita!'))
        .addSubcommand(sub => sub.setName('help').setDescription('📚 Buka panduan perintah interaktif Naura.'))
        .addSubcommand(sub => sub.setName('language').setDescription('🌐 Ubah bahasa bot di server ini / Change bot language')
            .addStringOption(opt => opt.setName('lang').setDescription('Pilih bahasa / Select language').setRequired(true).addChoices(
                { name: 'Indonesian', value: 'id' },
                { name: 'English', value: 'en' }
            ))),

    aliases: ['ping', 'stats', 'info', 'about', 'help', 'language', 'lang'],

    async executePrefix(message, args, client) {
        const prefix = env.PREFIX || 'n!';
        const cmdName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

        let subcommand = cmdName === 'core' ? (args[0] ? args[0].toLowerCase() : null) : cmdName;
        if (subcommand === 'lang') subcommand = 'language';

        let replyMsg = null;
        const mockInteraction = {
            client,
            user: message.author,
            createdTimestamp: message.createdTimestamp,
            deferReply: async () => {
                const loadingPayload = buildLoadingContainerV2({
                    authorName: 'Naura Loading System...',
                    description: `${ui.getEmoji('loading') || '⏳'} Naura sedang memproses permintaanmu... Tunggu sebentar ya! ✨`,
                    footerText: `Sedang menyiapkan untuk ${message.author.username}`
                });
                replyMsg = await message.reply(loadingPayload);
            },
            reply: async (payload) => {
                replyMsg = await message.reply(payload);
                return replyMsg;
            },
            editReply: async (payload) => {
                if (replyMsg) {
                    return await replyMsg.edit(payload);
                } else {
                    replyMsg = await message.reply(payload);
                    return replyMsg;
                }
            }
        };

        const guildId = message.guild ? message.guild.id : null;
        let langCode = 'id';
        if (guildId) {
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (settings && settings.system && settings.system.language) {
                langCode = settings.system.language;
            }
        }
        const lang = locales[langCode] || locales['id'];

        switch (subcommand) {
            case 'ping': return await handlePing(mockInteraction, client, lang);
            case 'stats': return await handleStats(mockInteraction, client, lang);
            case 'about': return await handleAbout(mockInteraction, client, lang);
            case 'help': return await handleHelp(mockInteraction, client, lang);
            case 'language':
                let newLang = null;
                if (cmdName === 'core' && args[1]) newLang = args[1].toLowerCase();
                else if (cmdName !== 'core' && args[0]) newLang = args[0].toLowerCase();
                return await handleLanguage(mockInteraction, guildId, newLang, lang);
            default:
                return message.reply(lang.ERROR_INVALID_SUBCOMMAND || `${ui.getEmoji('error') || '❌'} Subcommand tidak valid.`);
        }
    },

    async execute(interaction) {
        const subcommand = interaction.options.getSubcommand();
        const client = interaction.client;

        const guildId = interaction.guild ? interaction.guild.id : null;
        let langCode = 'id';
        if (guildId) {
            const settings = await GuildSettings.findOne({ where: { guildId } });
            if (settings && settings.system && settings.system.language) {
                langCode = settings.system.language;
            }
        }
        const lang = locales[langCode] || locales['id'];

        switch (subcommand) {
            case 'ping': return await handlePing(interaction, client, lang);
            case 'stats': return await handleStats(interaction, client, lang);
            case 'about': return await handleAbout(interaction, client, lang);
            case 'help': return await handleHelp(interaction, client, lang);
            case 'language':
                const newLang = interaction.options.getString('lang');
                return await handleLanguage(interaction, guildId, newLang, lang);
            default:
                return interaction.reply({ content: lang.ERROR_INVALID_SUBCOMMAND || `${ui.getEmoji('error') || '❌'} Subcommand tidak valid.`, ephemeral: true });
        }
    }
};

// ==========================================
// 🟢 1. PING SYSTEM (ADVANCED LATENCY)
// ==========================================
async function handlePing(interaction, client, lang) {
    const dot = ui.getEmoji('dot') || '▶️';
    const online = ui.getEmoji('online') || '🟢';
    const offline = ui.getEmoji('offline') || '🔴';
    const loadingEmoji = ui.getEmoji('loading') || '⏳';

    const loadingPayload = buildLoadingContainerV2({
        authorName: 'Naura Loading System...',
        description: `${loadingEmoji} ${lang.PING_LOADING}`,
        footerText: `Sedang menyiapkan untuk ${interaction.user.username}`
    });

    let sent;
    if (interaction.reply && !interaction.deferred) {
        sent = await interaction.reply({ ...loadingPayload, fetchReply: true });
    } else {
        sent = await interaction.editReply(loadingPayload);
    }

    const roundtripLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const websocketLatency = Math.round(client.ws.ping);

    // --- Naura Event Loop Lag Diagnostic ---
    const loopStart = Date.now();
    await new Promise(resolve => setImmediate(resolve));
    const eventLoopDelay = Date.now() - loopStart;

    // --- Naura Memory Systems ---
    let dbPing = `${offline} Offline`;
    try {
        const dbStart = Date.now();
        await sequelize.query('SELECT 1');
        dbPing = `${online} \`${Date.now() - dbStart}ms\``;
    } catch (e) { dbPing = `${offline} Error`; }

    let redisPing = `${offline} Offline`;
    try {
        const redisManager = require('../../src/managers/redisManager');
        if (redisManager.client && redisManager.client.isReady) {
            const redisStart = Date.now();
            await redisManager.client.ping();
            redisPing = `${online} \`${Date.now() - redisStart}ms\``;
        }
    } catch (e) { redisPing = `${offline} Error`; }

    // --- Naura Music & Audio Systems ---
    let lavalinkStr = `${offline} Offline`;
    try {
        if (client.musicManager && client.musicManager.poru) {
            const nodes = client.musicManager.poru.nodes;
            if (nodes.size > 0) {
                const nodeArr = [];
                let i = 1;
                nodes.forEach(node => {
                    const status = node.isConnected ? `${online} \`${node.ping}ms\`` : `${offline} Disconnected`;
                    nodeArr.push(`${dot} **Naura Node ${i}:** ${status}`);
                    i++;
                });
                lavalinkStr = '\n' + nodeArr.join('\n');
            } else {
                lavalinkStr = `\n${dot} ${ui.getEmoji('warning') || '⚠️'} Standby (Tidak ada Node aktif)`;
            }
        }
    } catch (e) { }

    // --- Naura Intelligent Systems ---
    let verbaPing = `${offline} Offline`;
    try {
        const verbaStart = Date.now();
        const fetchRes = await fetch('https://api.verba.ink/', { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (fetchRes) verbaPing = `${online} \`${Date.now() - verbaStart}ms\``;
        else verbaPing = `${offline} Timeout`;
    } catch (e) { verbaPing = `${offline} Error`; }

    let geminiPing = `${offline} Offline`;
    try {
        const geminiStart = Date.now();
        const fetchRes2 = await fetch('https://generativelanguage.googleapis.com/', { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (fetchRes2) geminiPing = `${online} \`${Date.now() - geminiStart}ms\``;
        else geminiPing = `${offline} Timeout`;
    } catch (e) { geminiPing = `${offline} Error`; }

    // --- Third-Party Integrations Systems ---
    let saweriaPing = `${offline} Offline`;
    try {
        const saweriaStart = Date.now();
        const saweriaRes = await fetch('https://saweria.co', { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (saweriaRes) saweriaPing = `${online} \`${Date.now() - saweriaStart}ms\``;
        else saweriaPing = `${offline} Timeout`;
    } catch (e) { saweriaPing = `${offline} Error`; }

    let trakteerPing = `${offline} Offline`;
    try {
        const trakteerStart = Date.now();
        const trakteerRes = await fetch('https://trakteer.id', { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (trakteerRes) trakteerPing = `${online} \`${Date.now() - trakteerStart}ms\``;
        else trakteerPing = `${offline} Timeout`;
    } catch (e) { trakteerPing = `${offline} Error`; }

    let topggPing = `${offline} Offline`;
    try {
        const topggStart = Date.now();
        const topggRes = await fetch('https://top.gg', { method: 'HEAD', signal: AbortSignal.timeout(3000) }).catch(() => null);
        if (topggRes) topggPing = `${online} \`${Date.now() - topggStart}ms\``;
        else topggPing = `${offline} Timeout`;
    } catch (e) { topggPing = `${offline} Error`; }

    // Setup visual components
    const ePingTitle = ui.getEmoji('ping') || '🏓';
    const eCoreSystem = ui.getEmoji('network_ping') || '🌐';
    const eEventLoop = ui.getEmoji('eventloop') || '⚡';
    const eMemorySystem = ui.getEmoji('database_ping') || '🗄️';
    const eIntellSystem = ui.getEmoji('intelligence') || '🧠';
    const eThirdPartySystem = ui.getEmoji('saweria') || '🔌';
    const eAudioSystem = ui.getEmoji('help_music') || '🎵';

    const pingBanner = ui.getBanner('ping');

    // Components V2: Container tunggal — tombol navigasi ikut menyatu di dalamnya
    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary'),
        authorName: 'Naura Telemetry System',
        title: `${ePingTitle} System Diagnostics & Latency`,
        iconURL: client.user.displayAvatarURL(),
        description: lang.PING_DESC || 'Real-time monitoring of Naura Hoshino\'s internal network and API connections.',
        fields: [
            { name: `${eCoreSystem} Naura Core Systems`, value: `${dot} **Discord WS:** ${online} \`${websocketLatency}ms\`\n${dot} **Roundtrip API:** ${online} \`${roundtripLatency}ms\`\n${dot} **Event Loop Delay:** ${eEventLoop} \`${eventLoopDelay}ms\`` },
            { name: `${eMemorySystem} Naura Memory Systems`, value: `${dot} **MySQL Server:** ${dbPing}\n${dot} **Redis Cache:** ${redisPing}` },
            { name: `${eIntellSystem} Naura Intelligent Systems`, value: `${dot} **Google Gemini:** ${geminiPing}\n${dot} **Verba API:** ${verbaPing}` },
            { name: `${eThirdPartySystem} Third-Party & Integrations`, value: `${dot} **Top.gg Portal:** ${topggPing}\n${dot} **Saweria Gateway:** ${saweriaPing}\n${dot} **Trakteer Support:** ${trakteerPing}` },
            { name: `${eAudioSystem} Naura Music & Audio Systems`, value: lavalinkStr },
        ],
        bannerAttachmentName: pingBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core'),
    });

    if (pingBanner) {
        payload.files = [new AttachmentBuilder(pingBanner, { name: 'banner.png' })];
    }

    if (interaction.editReply) return interaction.editReply(payload);
    return interaction.reply(payload);
}

// ==========================================
// 📊 2. STATS SYSTEM (HARDWARE DIAGNOSTIC)
// ==========================================
async function handleStats(interaction, client, lang) {
    if (interaction.deferReply && !interaction.deferred) await interaction.deferReply();
    const dot = ui.getEmoji('dot') || '▶️';

    const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
    const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
    const usedMem = (totalMem - freeMem).toFixed(2);
    const botMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

    const cpuModel = os.cpus()[0].model.replace(/CPU|GHz|@|\(R\)|\(TM\)/g, '').trim();
    const cores = os.cpus().length;

    // Resolve emojis from ui.js
    const eStats = ui.getEmoji('stats') || '📊';
    const eServer = ui.getEmoji('os') || '🖥️';
    const eRam = ui.getEmoji('ram') || '🧠';
    const eSoftware = ui.getEmoji('software') || '⚙️';
    const eReach = ui.getEmoji('reach') || '📈';

    const eCpu = ui.getEmoji('cpu') || '💻';
    const eUptime = ui.getEmoji('uptime') || '⏱️';
    const eGuilds = ui.getEmoji('guilds') || '👥';
    const eUsers = ui.getEmoji('users') || '👤';
    const eBotUptime = ui.getEmoji('bot_uptime') || '⏱️';

    // Strip default emojis from localizations if present
    const cleanTitle = lang.STATS_TITLE.replace(/^📊\s*/, '');
    const cleanServer = lang.STATS_SERVER.replace(/^🖥️\s*/, '');
    const cleanRam = lang.STATS_RAM.replace(/^🧠\s*/, '');
    const cleanSoftware = lang.STATS_SOFTWARE.replace(/^⚙️\s*/, '');
    const cleanReach = lang.STATS_REACH.replace(/^📈\s*/, '');

    const statsBanner = ui.getBanner('stats');

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('dark'),
        authorName: 'Naura Diagnostic Center',
        title: `${eStats} ${cleanTitle}`,
        iconURL: client.user.displayAvatarURL(),
        fields: [
            { name: `${eServer} ${cleanServer}`, value: `${dot} **${lang.STATS_PROCESSOR}:** ${eCpu} ${cpuModel} (${cores} Cores)\n${dot} **${lang.STATS_OS}:** ${eServer} ${os.type()} ${os.arch()}\n${dot} **${lang.STATS_UPTIME}:** ${eUptime} ${formatUptime(os.uptime() * 1000)}` },
            { name: `${eRam} ${cleanRam}`, value: `${dot} **${lang.STATS_RAM_SERVER}:** \`${usedMem}GB / ${totalMem}GB\`\n${dot} **${lang.STATS_RAM_BOT}:** \`${botMem} MB\`` },
            { name: `${eSoftware} ${cleanSoftware}`, value: `${dot} **Node.js:** \`${process.version}\`\n${dot} **Discord.js:** \`v${djsVersion}\`\n${dot} **Engine:** \`Naura Core v${env.ENGINE_VERSION || '1.1.0'}\`` },
            { name: `${eReach} ${cleanReach}`, value: `${dot} **${lang.STATS_GUILDS}:** ${eGuilds} \`${client.guilds.cache.size}\`\n${dot} **${lang.STATS_USERS}:** ${eUsers} \`${client.users.cache.size}\`\n${dot} **${lang.STATS_BOT_UPTIME}:** ${eBotUptime} \`${formatUptime(client.uptime)}\`` },
        ],
        bannerAttachmentName: statsBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core'),
    });

    if (statsBanner) {
        payload.files = [new AttachmentBuilder(statsBanner, { name: 'banner.png' })];
    }

    if (interaction.editReply) return interaction.editReply(payload);
    return interaction.reply(payload);
}


// ==========================================
// ℹ️ 3. INFO SYSTEM
// ==========================================
async function handleInfo(interaction, client, lang) {
    const eInfo = ui.getEmoji('info') || 'ℹ️';

    const eId = ui.getEmoji('id') || '🆔';
    const eAdmin = ui.getEmoji('admin') || '👑';
    const eClock = ui.getEmoji('clock') || '📅';
    const eUsers = ui.getEmoji('users') || '👥';
    const eBooster = ui.getEmoji('booster') || '🌟';
    const eReach = ui.getEmoji('reach') || '📈';

    let title, thumbnailURL, fields;

    if (interaction.guild) {
        const guild = interaction.guild;
        const owner = await guild.fetchOwner();
        const roleCount = guild.roles.cache.size;
        const channelCount = guild.channels.cache.size;

        const cleanTitle = lang.INFO_SERVER_TITLE.replace(/^ℹ️\s*/, '') || 'Server Info';

        title = `${eInfo} ${cleanTitle} - ${guild.name}`;
        thumbnailURL = guild.iconURL({ size: 512, dynamic: true });
        fields = [
            { name: `${eId} Server ID`, value: `\`${guild.id}\`` },
            { name: `${eAdmin} Owner`, value: `${owner.user.tag}` },
            { name: `${eClock} Created At`, value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>` },
            { name: `${eUsers} Members [${guild.memberCount}]`, value: `Roles: ${roleCount} | Channels: ${channelCount}` },
            { name: `${eBooster} Boosts`, value: `Level ${guild.premiumTier} (${guild.premiumSubscriptionCount} Boosts)` },
        ];
    } else {
        const cleanTitle = lang.INFO_BOT_TITLE.replace(/^ℹ️\s*/, '') || 'Bot Info';

        title = `${eInfo} ${cleanTitle} - Naura Hoshino`;
        thumbnailURL = client.user.displayAvatarURL({ size: 512 });
        fields = [
            { name: `${eId} Bot ID`, value: `\`${client.user.id}\`` },
            { name: `${eAdmin} Developer`, value: `Aryandita` },
            { name: `${eClock} Created At`, value: `<t:${Math.floor(client.user.createdTimestamp / 1000)}:R>` },
            { name: `${eReach} Reach`, value: `${client.guilds.cache.size} Servers | ${client.users.cache.size} Users` },
        ];
    }

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary'),
        authorName: 'Naura Info System',
        title,
        iconURL: thumbnailURL,
        fields,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core'),
    });

    if (interaction.deferred || (interaction.editReply && !interaction.reply)) return interaction.editReply(payload);
    return interaction.reply(payload);
}

// ==========================================
// 🎀 4. ABOUT SYSTEM
// ==========================================
async function handleAbout(interaction, client, lang) {
    if (!interaction.deferred) {
        await interaction.deferReply().catch(() => { });
        interaction.deferred = true;
    }

    let shardId = client.shard ? client.shard.ids[0] : 0;
    let totalShards = client.shard ? client.shard.count : 1;
    let memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

    let totalGuilds = client.guilds.cache.size;
    let totalUsers = client.users.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0);

    if (client.shard) {
        try {
            const guildResults = await client.shard.fetchClientValues('guilds.cache.size');
            totalGuilds = guildResults.reduce((acc, count) => acc + count, 0);

            const userResults = await client.shard.broadcastEval(c => c.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0));
            totalUsers = userResults.reduce((acc, count) => acc + count, 0);
        } catch (err) {
            // Fallback
        }
    }

    if (totalUsers <= 0) {
        totalUsers = client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) || client.users.cache.size;
    }

    const ePower = ui.getEmoji('power') || '🤖';
    const eStats = ui.getEmoji('stats') || '📊';
    const eDeveloper = ui.getEmoji('admin') || '👑';

    const eShard = ui.getEmoji('shard') || '📟';
    const eMemory = ui.getEmoji('memory') || '💾';
    const ePing = ui.getEmoji('ping') || '⚡';
    const eGuilds = ui.getEmoji('guilds') || '🌍';
    const eUsers = ui.getEmoji('users') || '👥';
    const eAbout = ui.getEmoji('about') || '👧🏻';
    const eHeart = ui.getEmoji('favorite') || '💖';
    const ePartner = ui.getEmoji('handshake') || '🤝';
    const eSparkle = ui.getEmoji('sparkle') || '✨';
    const eStar = ui.getEmoji('star') || '⭐';
    const eCheck = ui.getEmoji('check') || '✅';

    const sysStatus = `${ePower} **Status Sistem:** Online\n` +
        `${eShard} **Shard ID:** \`#${shardId} / ${totalShards}\`\n` +
        `${eMemory} **Memory usage:** \`${memUsage} MB\`\n` +
        `${ePing} **Shard Ping:** \`${client.ws.ping} ms\`\n` +
        `${eGuilds} **Total Guilds:** \`${totalGuilds.toLocaleString('id-ID')}\`\n` +
        `${eUsers} **Total Users:** \`${totalUsers.toLocaleString('id-ID')}\``;

    const partnershipText =
        `### ${ePartner} **Program Partnership Server Discord**\n` +
        `Hai para pemilik server! Naura selalu terbuka buat menjalin kerja sama (Partnership) dengan komunitas kalian lho ${eSparkle}. Kita bisa saling bantu mempromosikan dan memajukan server secara sehat!\n\n` +
        `**${eStar} Benefit Partnership Naura:**\n` +
        `> ${eCheck} **Promosi Jaringan Server:** Server kamu dipromosikan di jaringan komunitas Naura.\n` +
        `> ${eCheck} **Fasilitas VIP Gratis:** Akses fitur VIP Premium gratis khusus untuk server partner.\n` +
        `> ${eCheck} **Dukungan Prioritas:** Bantuan teknis & setup prioritas langsung dari Aryandita.\n\n` +
        `**${eStar} Syarat & Ketentuan Partnership:**\n` +
        `> ${eCheck} Memiliki minimal **100+ member aktif** di server Discord kamu.\n` +
        `> ${eCheck} Mematuhi Discord Terms of Service & Community Guidelines.\n` +
        `> ${eCheck} Memasang bot Naura Hoshino di server dan bersedia saling mempromosikan.`;

    const cleanTitle = lang.ABOUT_TITLE.replace(/^🎀\s*/, '') || 'Meet Naura Hoshino!';

    const aboutBanner = ui.getBanner('about');

    const payload = buildContainerV2({
        accentColorHex: ui.getColor('accent') || '#C084FC',
        authorName: 'Naura Hoshino Identity',
        title: `${eAbout} ${cleanTitle}`,
        iconURL: client.user.displayAvatarURL(),
        description:
            `Konnichiwa! Namaku **Naura Hoshino** ${eHeart}. Aku adalah asisten virtual generasi terbaru buatan **Aryandita** yang dirancang buat nemenin hari-harimu di Discord.\n\n` +
            `Aku dibuat dengan penuh perhatian agar terasa hangat, ramah, dan gak kaku selayaknya teman sungguhan! Dari mutar musik jernih 24/7, ngobrol seru bareng AI, petualangan RPG survival, sampai moderasi server, aku siap bantu kamu kapan pun! ${eSparkle}\n\n` +
            `${partnershipText}`,
        fields: [
            { name: `${eStats} TELEMETRI SHARD & SISTEM`, value: sysStatus },
            { name: `${eDeveloper} DEVELOPER / CREATOR`, value: `\`Aryandita\` (Developer Utama & Pencipta Ekosistem Naura Hoshino)` },
        ],
        bannerAttachmentName: aboutBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core'),
    });

    if (aboutBanner) {
        payload.files = [new AttachmentBuilder(aboutBanner, { name: 'banner.png' })];
    }

    return interaction.editReply(payload);
}

// ==========================================
// 📚 5. HELP SYSTEM — COMPONENTS V2
// ==========================================

/**
 * Membangun payload Components V2 untuk help menu.
 * @param {object} lang - Objek bahasa yang aktif.
 * @param {object} client - Discord client.
 * @param {number} categoryIndex - Indeks kategori yang sedang aktif (0-based).
 * @param {boolean} disabled - Apakah select menu dinonaktifkan (saat timeout).
 */
function buildHelpPayload(lang, client, categoryIndex = -1, disabled = false) {
    // Daftar kategori dengan urutan tetap (kategori economy dihapus agar tidak bentrok dengan survival)
    const categoryKeys = ['core', 'music', 'minigame', 'survival', 'admin'];
    const categories = {
        core: { emoji: ui.getEmoji('help_core') || '⚙️', label: lang.HELP_CAT_CORE_LABEL, desc: lang.HELP_CAT_CORE_DESC, content: formatHelpContent(lang.HELP_CONTENT_CORE) },
        music: { emoji: ui.getEmoji('help_music') || '🎵', label: lang.HELP_CAT_MUSIC_LABEL, desc: lang.HELP_CAT_MUSIC_DESC, content: formatHelpContent(lang.HELP_CONTENT_MUSIC) },
        minigame: { emoji: ui.getEmoji('help_game') || '🎮', label: lang.HELP_CAT_GAME_LABEL, desc: lang.HELP_CAT_GAME_DESC, content: formatHelpContent(lang.HELP_CONTENT_GAME) },
        survival: { emoji: ui.getEmoji('help_survival') || '🏕️', label: lang.HELP_CAT_SURVIVAL_LABEL, desc: lang.HELP_CAT_SURVIVAL_DESC, content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL) },
        admin: { emoji: ui.getEmoji('help_admin') || '🛠️', label: lang.HELP_CAT_ADMIN_LABEL, desc: lang.HELP_CAT_ADMIN_DESC, content: formatHelpContent(lang.HELP_CONTENT_ADMIN) },
    };

    // Tentukan konten yang ditampilkan di dalam Container
    let bodyContent;
    if (categoryIndex >= 0) {
        // Menampilkan isi kategori yang dipilih
        const cat = categories[categoryKeys[categoryIndex]];
        bodyContent = `${cat.emoji} **${cat.label}**\n\n${cat.content}`;
    } else {
        // Halaman default: deskripsi umum
        bodyContent = formatHelpContent(lang.HELP_DESC);
    }

    // Hitung warna accent (primary pink Naura → integer RGB)
    const primaryHex = (ui.getColor('primary') || '#FFB6C1').replace('#', '');
    const accentColor = parseInt(primaryHex, 16);

    // Build select menu options (Gunakan ui.parseEmoji agar tidak crash pada custom emoji)
    const selectOptions = categoryKeys.map(key => {
        const option = {
            label: categories[key].label,
            description: categories[key].desc,
            value: key,
            default: categoryKeys.indexOf(key) === categoryIndex,
        };
        const parsedEmoji = ui.parseEmoji(categories[key].emoji);
        if (parsedEmoji) option.emoji = parsedEmoji;
        return option;
    });

    // Select menu row
    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('help_category_select')
        .setPlaceholder(`📚 ${lang.HELP_PLACEHOLDER || 'Naura Help Menu'}`)
        .setDisabled(disabled)
        .addOptions(selectOptions);
    const selectRow = new ActionRowBuilder().addComponents(selectMenu);

    // Tombol navigasi pagination
    const prevBtn = new ButtonBuilder()
        .setCustomId('help_prev')
        .setLabel('« Categories')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex <= 0);
    const nextBtn = new ButtonBuilder()
        .setCustomId('help_next')
        .setLabel('Categories »')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled || categoryIndex >= categoryKeys.length - 1);
    const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

    // Footer text terpusat
    const footerText = ui.stripCustomEmojis(ui.getFooter('core'));

    // Komponen-komponen di dalam Container
    const containerComponents = [
        // Judul di atas (Title boleh pakai custom emoji, Header/Author & Footer yang tidak)
        {
            type: 10, // TEXT_DISPLAY
            content: `## 📚 ${lang.HELP_TITLE || 'Naura Help System'}`,
        },
        // Separator tipis
        { type: 14, divider: true, spacing: 1 },
        // Konten utama (desc atau isi kategori)
        {
            type: 10, // TEXT_DISPLAY
            content: bodyContent,
        },
        // Separator sebelum komponen interaktif
        { type: 14, divider: true, spacing: 1 },
        // Select menu dalam Action Row
        selectRow.toJSON(),
        // Tombol navigasi dalam Action Row
        navRow.toJSON(),
        // Separator sebelum footer
        { type: 14, divider: false, spacing: 1 },
        // Footer
        {
            type: 10, // TEXT_DISPLAY
            content: `-# ${footerText}`,
        },
    ];

    return {
        flags: MessageFlags.IsComponentsV2,
        components: [
            {
                type: 17, // CONTAINER
                accent_color: accentColor,
                components: containerComponents,
            }
        ],
        _categoryKeys: categoryKeys, // referensi internal (tidak dikirim ke Discord)
        _categories: categories,
    };
}

async function handleHelp(interaction, client, langParam) {
    // Tentukan teks berdasarkan bahasa guild
    const isIndo = langParam.HELP_TITLE && langParam.HELP_TITLE.includes('Pusat Bantuan');
    const placeholderText = isIndo ? 'Pilih bahasa / Choose a language' : 'Choose a language / Pilih bahasa';

    // === Langkah 1: Pilih Bahasa ===
    const langSelectRow = new ActionRowBuilder().addComponents(
        new StringSelectMenuBuilder()
            .setCustomId('help_lang_select')
            .setPlaceholder(placeholderText)
            .addOptions(
                { label: 'English', description: 'Show help menu in English', value: 'en', emoji: '🇬🇧' },
                { label: 'Indonesia', description: 'Tampilkan menu bantuan dalam Bahasa Indonesia', value: 'id', emoji: '🇮🇩' }
            )
    );

    // Author Name Embed TIDAK BOLEH pakai custom emoji string <a:...>
    const langPayload = buildContainerV2({
        accentColorHex: ui.getColor('primary') || '#FFB6C1',
        authorName: '📚 Naura Help System',
        iconURL: client.user.displayAvatarURL(),
        description: isIndo
            ? 'Silakan pilih bahasa yang kamu inginkan di bawah ini untuk melihat menu bantuan.'
            : 'Please select your preferred language below to view the help menu.',
        buttonsRow: langSelectRow,
        footerText: ui.getFooter('core')
    });

    let langResponse;
    if (interaction.deferred || (interaction.editReply && !interaction.reply)) {
        langResponse = await interaction.editReply(langPayload);
    } else {
        langResponse = await interaction.reply({ ...langPayload, fetchReply: true });
    }

    if (!langResponse || !langResponse.createMessageComponentCollector) return;

    let lang;
    try {
        const langInteraction = await langResponse.awaitMessageComponent({
            componentType: ComponentType.StringSelect,
            time: 60000,
            filter: i => i.user.id === interaction.user.id && i.customId === 'help_lang_select'
        });
        const selectedLang = langInteraction.values[0];
        lang = locales[selectedLang] || locales['en'];

        const confirmMsg = selectedLang === 'id'
            ? '✅ Bahasa Indonesia dipilih!'
            : '✅ English language selected!';
        await langInteraction.reply({ content: confirmMsg, flags: MessageFlags.Ephemeral }).catch(() => { });
    } catch (e) {
        // Timeout, fallback ke bahasa Inggris
        lang = locales['en'];
    }

    // === Langkah 2: Tampilkan Help Menu dengan Components V2 ===
    await renderHelpMenuV2(interaction, client, lang, langResponse);
}

async function renderHelpMenuV2(interaction, client, lang, existingResponse = null) {
    let currentIndex = -1; // -1 = halaman default (deskripsi umum)

    // Buat payload awal
    const initialData = buildHelpPayload(lang, client, currentIndex, false);
    const payload = {
        content: null,
        embeds: [], // penting: membersihkan embed pemilihan bahasa sebelumnya
        flags: initialData.flags,
        components: initialData.components,
    };

    // Kirim / edit pesan dengan Components V2
    let response;
    try {
        if (existingResponse) {
            response = await existingResponse.edit(payload);
        } else if (interaction.deferred) {
            response = await interaction.editReply(payload);
        } else {
            response = await interaction.reply({ ...payload, fetchReply: true });
        }
    } catch (err) {
        // Fallback: coba editReply jika edit gagal
        try { response = await interaction.editReply(payload); } catch (_) { }
    }

    if (!response || !response.createMessageComponentCollector) return;

    // Collector untuk Select Menu DAN Buttons sekaligus
    const collector = response.createMessageComponentCollector({
        time: 120000,
        filter: i => i.user.id === interaction.user.id
    });

    const categoryKeys = ['core', 'economy', 'music', 'minigame', 'survival', 'admin'];

    collector.on('collect', async i => {
        try {
            if (i.componentType === ComponentType.StringSelect && i.customId === 'help_category_select') {
                // Navigasi via dropdown
                currentIndex = categoryKeys.indexOf(i.values[0]);
            } else if (i.componentType === ComponentType.Button) {
                if (i.customId === 'help_prev') {
                    currentIndex = Math.max(0, currentIndex === -1 ? 0 : currentIndex - 1);
                } else if (i.customId === 'help_next') {
                    currentIndex = Math.min(categoryKeys.length - 1, currentIndex === -1 ? 0 : currentIndex + 1);
                } else {
                    return; // bukan tombol milik kita
                }
            } else {
                return;
            }

            // Rebuild payload dengan index baru
            const updatedData = buildHelpPayload(lang, client, currentIndex, false);
            await i.update({
                embeds: [],
                flags: updatedData.flags,
                components: updatedData.components,
            });
        } catch (err) {
            // Abaikan error (misal interaction sudah expire)
        }
    });

    collector.on('end', async () => {
        // Nonaktifkan select menu dan tombol saat collector berakhir
        try {
            const disabledData = buildHelpPayload(lang, client, currentIndex, true);
            const target = existingResponse || response;
            if (target && target.edit) {
                await target.edit({
                    embeds: [],
                    flags: disabledData.flags,
                    components: disabledData.components,
                }).catch(() => { });
            }
        } catch (_) { }
    });
}

// ==========================================
// 🌐 6. LANGUAGE SYSTEM
// ==========================================
async function handleLanguage(interaction, guildId, newLang, currentLang) {
    if (!interaction.member || !interaction.member.permissions.has('Administrator')) {
        return interaction.reply({ content: currentLang.ERROR_PERMISSION_DENIED || '❌ Anda harus menjadi Administrator untuk mengubah bahasa server.', ephemeral: true });
    }
    if (!guildId) {
        const msg = "Only available in servers.";
        if (interaction.reply && !interaction.deferred) return interaction.reply({ content: msg, ephemeral: true });
        return interaction.editReply({ content: msg });
    }

    if (!newLang || !['id', 'en'].includes(newLang)) {
        if (interaction.reply && !interaction.deferred) return interaction.reply({ content: currentLang.LANG_NOT_FOUND, ephemeral: true });
        return interaction.editReply({ content: currentLang.LANG_NOT_FOUND });
    }

    let [settings] = await GuildSettings.findOrCreate({ where: { guildId } });

    if (!settings.system) settings.system = { prefix: 'n!', language: 'id' };
    settings.system = { ...settings.system, language: newLang };

    settings.changed('system', true);
    await settings.save();

    const successMsg = locales[newLang].LANG_SUCCESS;

    if (interaction.reply && !interaction.deferred) return interaction.reply({ content: successMsg });
    return interaction.editReply({ content: successMsg });
}