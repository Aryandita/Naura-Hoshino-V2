"use strict";

const { AttachmentBuilder } = require("discord.js");
const { sequelize } = require("../../../src/managers/dbManager");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
  buildLoadingContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { e, face, createNavButtons } = require("../helpers/coreShared");

async function handlePing(interaction, client, lang) {
  const dot = e("dot", "\u25B6\uFE0F");
  const online = e("online", "\uD83D\uDFE2");
  const offline = e("offline", "\uD83D\uDD34");

  const loadingPayload = buildLoadingContainerV2({
    authorName: "Naura Latency Diagnostic",
    title: "Mengukur Latensi...",
    loadingMessage:
      lang.PING_LOADING || "Menghubungi shard dan gateway Discord...",
    footerText: `Sedang menyiapkan untuk ${interaction.user.username}`,
    withBanner: true,
  });

  let sent;
  if (interaction.reply && !interaction.deferred) {
    sent = await interaction.reply({ ...loadingPayload, fetchReply: true });
  } else {
    sent = await interaction.editReply(loadingPayload);
  }

  const roundtripLatency =
    sent?.createdTimestamp && interaction?.createdTimestamp
      ? Math.max(0, sent.createdTimestamp - interaction.createdTimestamp)
      : 0;
  const websocketLatency = client.ws?.ping != null ? Math.round(client.ws.ping) : 0;

  const loopStart = Date.now();
  await new Promise((resolve) => setImmediate(resolve));
  const eventLoopDelay = Date.now() - loopStart;

  let dbPing = `${offline} Offline`;
  try {
    const dbStart = Date.now();
    await sequelize.query("SELECT 1");
    dbPing = `${online} \`${Date.now() - dbStart}ms\``;
  } catch (_) {
    dbPing = `${offline} Error`;
  }

  let redisPing = `${offline} Offline`;
  try {
    const redisManager = require("../../../src/managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) {
      const redisStart = Date.now();
      await redisManager.client.ping();
      redisPing = `${online} \`${Date.now() - redisStart}ms\``;
    }
  } catch (_) {
    redisPing = `${offline} Error`;
  }

  let mongoPing = `${offline} Offline`;
  try {
    const mongoose = require("mongoose");
    if (mongoose.connection && mongoose.connection.readyState === 1) {
      const mongoStart = Date.now();
      await mongoose.connection.db.admin().ping();
      mongoPing = `${online} \`${Date.now() - mongoStart}ms\``;
    }
  } catch (_) {
    mongoPing = `${offline} Error`;
  }

  let lavalinkStr = `${offline} Offline`;
  try {
    if (client.musicManager && client.musicManager.poru) {
      const nodes = client.musicManager.poru.nodes;
      if (nodes.size > 0) {
        const nodeArr = [];
        let i = 1;
        nodes.forEach((node) => {
          const status = node.isConnected
            ? `${online} Online (Aktif)`
            : `${offline} Offline (Mati)`;
          nodeArr.push(
            `${dot} **${node.name || `Naura Node ${i}`}:** ${status}`,
          );
          i++;
        });
        lavalinkStr = "\n" + nodeArr.join("\n");
      } else {
        lavalinkStr = `\n${dot} ${face("warning", "\u26A0\uFE0F")} Standby (Tidak ada Node aktif)`;
      }
    }
  } catch (err) {
    logger.debug("[core:handlePing] Operasi audio/voice gagal: " + (err?.message || err));
  }

  let verbaPing = `${offline} Offline`;
  try {
    const verbaStart = Date.now();
    const fetchRes = await fetch("https://api.verba.ink/", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (fetchRes) verbaPing = `${online} \`${Date.now() - verbaStart}ms\``;
    else verbaPing = `${offline} Timeout`;
  } catch (_) {
    verbaPing = `${offline} Error`;
  }

  let geminiPing = `${offline} Offline`;
  try {
    const geminiStart = Date.now();
    const fetchRes2 = await fetch(
      "https://generativelanguage.googleapis.com/",
      { method: "HEAD", signal: AbortSignal.timeout(3000) },
    ).catch(() => null);
    if (fetchRes2) geminiPing = `${online} \`${Date.now() - geminiStart}ms\``;
    else geminiPing = `${offline} Timeout`;
  } catch (_) {
    geminiPing = `${offline} Error`;
  }

  let saweriaPing = `${offline} Offline`;
  try {
    const saweriaStart = Date.now();
    const saweriaRes = await fetch("https://saweria.co", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (saweriaRes)
      saweriaPing = `${online} \`${Date.now() - saweriaStart}ms\``;
    else saweriaPing = `${offline} Timeout`;
  } catch (_) {
    saweriaPing = `${offline} Error`;
  }

  let trakteerPing = `${offline} Offline`;
  try {
    const trakteerStart = Date.now();
    const trakteerRes = await fetch("https://trakteer.id", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (trakteerRes)
      trakteerPing = `${online} \`${Date.now() - trakteerStart}ms\``;
    else trakteerPing = `${offline} Timeout`;
  } catch (_) {
    trakteerPing = `${offline} Error`;
  }

  let topggPing = `${offline} Offline`;
  try {
    const topggStart = Date.now();
    const topggRes = await fetch("https://top.gg", {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    }).catch(() => null);
    if (topggRes) topggPing = `${online} \`${Date.now() - topggStart}ms\``;
    else topggPing = `${offline} Timeout`;
  } catch (_) {
    topggPing = `${offline} Error`;
  }

  const ePingTitle = e("ping", "\uD83C\uDFD3");
  const eCoreSystem = e("network_ping", "\uD83C\uDF10");
  const eEventLoop = e("eventloop", "\u26A1");
  const eMemorySystem = e("database_ping", "\uD83D\uDDC4\uFE0F");
  const eIntellSystem = e("intelligence", "\uD83E\uDDE0");
  const eThirdPartySystem = e("saweria", "\uD83D\uDD0C");
  const eAudioSystem = e("help_music", "\uD83C\uDFB5");

  const pingBanner = ui.getBanner("ping");

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Telemetry System",
    title: `${ePingTitle} System Diagnostics & Latency`,
    iconURL: client.user.displayAvatarURL(),
    description:
      lang.PING_DESC ||
      "Real-time monitoring of Naura Hoshino's internal network and API connections.",
    fields: [
      {
        name: `${eCoreSystem} Naura Core Systems`,
        value: `${dot} **Discord WS:** ${online} \`${websocketLatency}ms\`\n${dot} **Roundtrip API:** ${online} \`${roundtripLatency}ms\`\n${dot} **Event Loop Delay:** ${eEventLoop} \`${eventLoopDelay}ms\``,
      },
      {
        name: `${eMemorySystem} Naura Memory Systems (Polyglot DB)`,
        value: `${dot} **Supabase (PostgreSQL):** ${dbPing}\n${dot} **MongoDB Atlas:** ${mongoPing}\n${dot} **Redis Cache:** ${redisPing}`,
      },
      {
        name: `${eIntellSystem} Naura Intelligent Systems`,
        value: `${dot} **Google Gemini:** ${geminiPing}\n${dot} **Verba API:** ${verbaPing}`,
      },
      {
        name: `${eThirdPartySystem} Third-Party & Integrations`,
        value: `${dot} **Top.gg Portal:** ${topggPing}\n${dot} **Saweria Gateway:** ${saweriaPing}\n${dot} **Trakteer Support:** ${trakteerPing}`,
      },
      {
        name: `${eAudioSystem} Naura Music & Audio Systems`,
        value: lavalinkStr,
      },
    ],
    bannerAttachmentName: pingBanner ? "banner.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  if (pingBanner) {
    payload.files = [new AttachmentBuilder(pingBanner, { name: "banner.png" })];
  }

  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handlePing;
