/**
 * @namespace: plugin/core/corePing.js
 * @type: Handler
 * @copyright (c) 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @description Diagnostik latensi Discord, database, AI, dan integrasi pihak ketiga.
 */

const { AttachmentBuilder } = require('discord.js');
const { sequelize } = require('../../src/managers/dbManager');
const ui = require('../../src/config/ui');
const { buildContainerV2, buildLoadingContainerV2 } = require('../../src/utils/NauraContainerBuilder');
const { e, face, createNavButtons } = require('./coreCommon');

const PROBE_TIMEOUT = 3000;

/** Satu pola untuk semua probe HTTP, dulu disalin lima kali dengan isi sama. */
async function probe(url, online, offline) {
    const started = Date.now();
    try {
        const res = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(PROBE_TIMEOUT) }).catch(() => null);
        if (!res) return `${offline} Timeout`;
        return `${online} \\`${Date.now() - started}ms\\``;
    } catch (err) {
        return `${offline} Error`;
    }
}

async function handlePing(interaction, client, lang) {
    const dot = e('dot', '\\u25B6\\uFE0F');
    const online = e('online', '\\uD83D\\uDFE2');
    const offline = e('offline', '\\uD83D\\uDD34');

    const loadingPayload = buildLoadingContainerV2({
        authorName: 'Naura Loading System...',
        description: `${face('loading', '\\u23F3')} ${lang.PING_LOADING}`,
        footerText: `Sedang menyiapkan untuk ${interaction.user.username}`
    });

    // discord.js v14 tidak lagi menerima fetchReply sebagai opsi reply,
    // jadi pesan diambil terpisah lewat fetchReply().
    let sent = null;
    if (interaction.deferred) {
        sent = await interaction.editReply(loadingPayload);
    } else {
        const replied = await interaction.reply(loadingPayload);
        if (replied && replied.createdTimestamp) sent = replied;
        else if (interaction.fetchReply) sent = await interaction.fetchReply().catch(() => null);
    }

    const roundtripLatency = sent && sent.createdTimestamp
        ? sent.createdTimestamp - interaction.createdTimestamp
        : Math.round(client.ws.ping);
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
        dbPing = `${online} \\`${Date.now() - dbStart}ms\\``;
    } catch (err) { dbPing = `${offline} Error`; }

    let redisPing = `${offline} Offline`;
    try {
        const redisManager = require('../../src/managers/redisManager');
        if (redisManager.client && redisManager.client.isReady) {
            const redisStart = Date.now();
            await redisManager.client.ping();
            redisPing = `${online} \\`${Date.now() - redisStart}ms\\``;
        }
    } catch (err) { redisPing = `${offline} Error`; }

    // --- Naura Music & Audio Systems ---
    let lavalinkStr = `${offline} Offline`;
    try {
        if (client.musicManager && client.musicManager.poru) {
            const nodes = client.musicManager.poru.nodes;
            if (nodes.size > 0) {
                const nodeArr = [];
                let i = 1;
                nodes.forEach(node => {
                    const status = node.isConnected ? `${online} \\`${node.ping}ms\\`` : `${offline} Disconnected`;
                    nodeArr.push(`${dot} **Naura Node ${i}:** ${status}`);
                    i++;
                });
                lavalinkStr = '\\n' + nodeArr.join('\\n');
            } else {
                lavalinkStr = `\\n${dot} ${face('warning', '\\u26A0\\uFE0F')} Standby (Tidak ada Node aktif)`;
            }
        }
    } catch (err) { /* Lavalink belum siap; status Offline sudah memadai */ }

    // --- Naura Intelligent & Third-Party Systems ---
    const [geminiPing, verbaPing, topggPing, saweriaPing, trakteerPing] = await Promise.all([
        probe('https://generativelanguage.googleapis.com/', online, offline),
        probe('https://api.verba.ink/', online, offline),
        probe('https://top.gg', online, offline),
        probe('https://saweria.co', online, offline),
        probe('https://trakteer.id', online, offline)
    ]);

    const ePingTitle = e('ping', '\\uD83C\\uDFD3');
    const eCoreSystem = e('network_ping', '\\uD83C\\uDF10');
    const eEventLoop = e('eventloop', '\\u26A1');
    const eMemorySystem = e('database_ping', '\\uD83D\\uDDC4\\uFE0F');
    const eIntellSystem = e('intelligence', '\\uD83E\\uDDE0');
    const eThirdPartySystem = e('saweria', '\\uD83D\\uDD0C');
    const eAudioSystem = e('help_music', '\\uD83C\\uDFB5');

    const pingBanner = ui.getBanner('ping');

    // Components V2: Container tunggal, tombol navigasi ikut menyatu di dalamnya
    const payload = buildContainerV2({
        accentColorHex: ui.getColor('primary'),
        authorName: 'Naura Telemetry System',
        title: `${ePingTitle} System Diagnostics & Latency`,
        iconURL: client.user.displayAvatarURL(),
        description: lang.PING_DESC || 'Real-time monitoring of Naura Hoshino internal network and API connections.',
        fields: [
            { name: `${eCoreSystem} Naura Core Systems`, value: `${dot} **Discord WS:** ${online} \\`${websocketLatency}ms\\`\\n${dot} **Roundtrip API:** ${online} \\`${roundtripLatency}ms\\`\\n${dot} **Event Loop Delay:** ${eEventLoop} \\`${eventLoopDelay}ms\\`` },
            { name: `${eMemorySystem} Naura Memory Systems`, value: `${dot} **MySQL Server:** ${dbPing}\\n${dot} **Redis Cache:** ${redisPing}` },
            { name: `${eIntellSystem} Naura Intelligent Systems`, value: `${dot} **Google Gemini:** ${geminiPing}\\n${dot} **Verba API:** ${verbaPing}` },
            { name: `${eThirdPartySystem} Third-Party & Integrations`, value: `${dot} **Top.gg Portal:** ${topggPing}\\n${dot} **Saweria Gateway:** ${saweriaPing}\\n${dot} **Trakteer Support:** ${trakteerPing}` },
            { name: `${eAudioSystem} Naura Music & Audio Systems`, value: lavalinkStr }
        ],
        bannerAttachmentName: pingBanner ? 'banner.png' : null,
        buttonsRow: createNavButtons(),
        footerText: ui.getFooter('core')
    });

    if (pingBanner) {
        payload.files = [new AttachmentBuilder(pingBanner, { name: 'banner.png' })];
    }

    if (interaction.editReply) return interaction.editReply(payload);
    return interaction.reply(payload);
}

module.exports = { handlePing };
