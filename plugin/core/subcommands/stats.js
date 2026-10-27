"use strict";

/**
 * 📊 Stats Command - System Telemetry - Naura Hoshino V2
 * -------------------------------------------------------
 * Displays comprehensive system statistics and telemetry data.
 * Shows shard info, server specs, memory usage, and bot reach.
 *
 * Diagnostic Categories:
 * - Shard & Cluster Telemetry
 * - Server Hardware (CPU, OS, Uptime)
 * - Memory Usage (System & Bot)
 * - Software Versions (Node.js, Discord.js, Engine)
 * - Bot Reach (Guilds, Users, Uptime)
 *
 * @module plugin/core/subcommands/stats
 */

const os = require("node:os");
const { AttachmentBuilder, version: djsVersion } = require("discord.js");
const ui = require("../../../src/config/ui");
const { BOT_VERSION } = require("../../../src/config/version");
const { logger } = require("../../../src/managers/logger");
const clusterManager = require("../../../src/managers/clusterManager");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { msToTime } = require("../../../src/utils/time");
const { e, createNavButtons } = require("../helpers/coreShared");

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get memory statistics in GB and MB.
 * @returns {{totalGB: string, freeGB: string, usedGB: string, botMB: string}}
 */
function getMemoryStats() {
  const totalMem = os.totalmem() / 1024 / 1024 / 1024;
  const freeMem = os.freemem() / 1024 / 1024 / 1024;
  const botMem = process.memoryUsage().rss / 1024 / 1024;

  return {
    totalGB: totalMem.toFixed(2),
    freeGB: freeMem.toFixed(2),
    usedGB: (totalMem - freeMem).toFixed(2),
    botMB: botMem.toFixed(2),
  };
}

/**
 * Get CPU information.
 * @returns {{model: string, cores: number}}
 */
function getCpuInfo() {
  const model = os
    .cpus()[0]
    .model.replace(/CPU|GHz|@|\(R\)|\(TM\)/g, "")
    .trim();
  const cores = os.cpus().length;

  return { model, cores };
}

/**
 * Fetch aggregated guild and user counts across all shards.
 * @param {object} client - Discord client
 * @returns {Promise<{guilds: number, users: number}>}
 */
async function fetchShardCounts(client) {
  let totalGuilds = client.guilds.cache.size;
  let totalUsers = client.guilds.cache.reduce(
    (acc, g) => acc + (g.memberCount || 0),
    0,
  );

  if (client.shard) {
    try {
      const guildResults = await clusterManager.fetchClientValues(
        client,
        "guilds.cache.size",
      );
      totalGuilds = guildResults.reduce((acc, count) => acc + count, 0);

      const userResults = await clusterManager.broadcastEval(client, (c) =>
        c.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0),
      );
      totalUsers = userResults.reduce((acc, count) => acc + count, 0);
    } catch (err) {
      logger.warn(`[core:handleStats] Cluster sharding operation failed: ${err?.message || err}`);
    }
  }

  // Fallback if counts are zero
  if (totalUsers <= 0) {
    totalUsers =
      client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) ||
      client.users.cache.size;
  }

  return { guilds: totalGuilds, users: totalUsers };
}

/**
 * Clean emoji prefix from language string.
 * @param {string} text - Text with potential emoji prefix
 * @param {string} fallback - Fallback text
 * @returns {string} Cleaned text
 */
function cleanEmojiPrefix(text, fallback) {
  return (text || fallback).replace(/^[\u{1F300}-\u{1F9FF}]?\s*/u, "");
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Handle /core stats command execution.
 * Displays system telemetry and bot statistics.
 * @param {object} interaction - Discord interaction
 * @param {object} client - Discord client
 * @param {object} lang - Language dictionary
 * @returns {Promise<void>}
 */
async function handleStats(interaction, client, lang) {
  // Defer reply for processing
  if (interaction.deferReply && !interaction.deferred) {
    await interaction.deferReply();
  }

  // Get emojis
  const dot = e("dot", "▶️");
  const emojis = {
    stats: e("stats", "📊"),
    server: e("os", "🖥️"),
    ram: e("ram", "🧠"),
    software: e("software", "⚙️"),
    reach: e("reach", "📈"),
    cpu: e("cpu", "💻"),
    uptime: e("uptime", "⏱️"),
    guilds: e("guilds", "👥"),
    users: e("users", "👤"),
    botUptime: e("bot_uptime", "⏱️"),
    shard: e("shard", "📟"),
  };

  // Gather system stats
  const mem = getMemoryStats();
  const cpu = getCpuInfo();
  const counts = await fetchShardCounts(client);

  // Get shard info
  const shardId = clusterManager.getShardIds(client);
  const totalShards = clusterManager.getTotalShards(client);
  const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

  // Clean titles
  const cleanTitle = cleanEmojiPrefix(lang.STATS_TITLE, "Statistik Sistem");
  const cleanServer = cleanEmojiPrefix(lang.STATS_SERVER, "Server");
  const cleanRam = cleanEmojiPrefix(lang.STATS_RAM, "RAM");
  const cleanSoftware = cleanEmojiPrefix(lang.STATS_SOFTWARE, "Software");
  const cleanReach = cleanEmojiPrefix(lang.STATS_REACH, "Jangkauan");

  // Get banner
  const statsBanner = ui.getBanner("stats");

  // Build payload
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("dark"),
    authorName: "Naura Diagnostic Center",
    title: `${emojis.stats} ${cleanTitle}`,
    iconURL: client.user?.displayAvatarURL?.() || null,
    fields: [
      {
        name: `${emojis.shard} TELEMETRI SHARD & CLUSTER`,
        value:
          `${dot} **Status Sistem:** \`Online (Stabil)\`\n` +
          `${dot} **Shard ID:** \`#${shardId} / ${totalShards}\`\n` +
          `${dot} **Shard Ping:** \`${client.ws?.ping ?? 0} ms\`\n` +
          `${dot} **Memory RSS:** \`${memUsage} MB\` (Bot: \`${mem.botMB} MB\`)\n` +
          `${dot} **Total Guilds:** \`${counts.guilds.toLocaleString("id-ID")}\`\n` +
          `${dot} **Total Users:** \`${counts.users.toLocaleString("id-ID")}\``,
      },
      {
        name: `${emojis.server} ${cleanServer}`,
        value: `${dot} **${lang.STATS_PROCESSOR || "Processor"}:** ${emojis.cpu} ${cpu.model} (${cpu.cores} Cores)\n${dot} **${lang.STATS_OS || "OS"}:** ${emojis.server} ${os.type()} ${os.arch()}\n${dot} **${lang.STATS_UPTIME || "Uptime"}:** ${emojis.uptime} ${msToTime(os.uptime() * 1000)}`,
      },
      {
        name: `${emojis.ram} ${cleanRam}`,
        value: `${dot} **${lang.STATS_RAM_SERVER || "RAM Server"}:** \`${mem.usedGB}GB / ${mem.totalGB}GB\`\n${dot} **${lang.STATS_RAM_BOT || "RAM Bot"}:** \`${mem.botMB} MB\``,
      },
      {
        name: `${emojis.software} ${cleanSoftware}`,
        value: `${dot} **Node.js:** \`${process.version}\`\n${dot} **Discord.js:** \`v${djsVersion}\`\n${dot} **Engine:** \`Naura Core v${BOT_VERSION}\`\n${dot} **Command Plugins:** \`${client.commands ? client.commands.size : 55} Modul Aktif\``,
      },
      {
        name: `${emojis.reach} ${cleanReach}`,
        value: `${dot} **${lang.STATS_GUILDS || "Guilds"}:** ${emojis.guilds} \`${counts.guilds.toLocaleString("id-ID")}\`\n${dot} **${lang.STATS_USERS || "Users"}:** ${emojis.users} \`${counts.users.toLocaleString("id-ID")}\`\n${dot} **${lang.STATS_BOT_UPTIME || "Bot Uptime"}:** ${emojis.botUptime} \`${msToTime(client.uptime)}\``,
      },
    ],
    bannerAttachmentName: statsBanner ? "banner.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  // Add banner attachment
  if (statsBanner) {
    payload.files = [new AttachmentBuilder(statsBanner, { name: "banner.png" })];
  }

  // Send response
  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handleStats;
