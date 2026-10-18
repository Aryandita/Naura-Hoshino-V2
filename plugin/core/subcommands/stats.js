"use strict";

const os = require("node:os");
const { AttachmentBuilder, version: djsVersion } = require("discord.js");
const ui = require("../../../src/config/ui");
const { BOT_VERSION } = require("../../../src/config/version");
const { logger } = require("../../../src/managers/logger");
const clusterManager = require("../../../src/managers/clusterManager");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { msToTime } = require("../../../src/utils/time");
const { e, createNavButtons } = require("../helpers/coreShared");

async function handleStats(interaction, client, lang) {
  if (interaction.deferReply && !interaction.deferred) {
    await interaction.deferReply();
  }
  const dot = e("dot", "\u25B6\uFE0F");

  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(2);
  const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(2);
  const usedMem = (totalMem - freeMem).toFixed(2);
  const botMem = (process.memoryUsage().rss / 1024 / 1024).toFixed(2);

  const cpuModel = os
    .cpus()[0]
    .model.replace(/CPU|GHz|@|\(R\)|\(TM\)/g, "")
    .trim();
  const cores = os.cpus().length;

  const eStats = e("stats", "\uD83D\uDCCA");
  const eServer = e("os", "\uD83D\uDDA5\uFE0F");
  const eRam = e("ram", "\uD83E\uDDE0");
  const eSoftware = e("software", "\u2699\uFE0F");
  const eReach = e("reach", "\uD83D\uDCC8");

  const eCpu = e("cpu", "\uD83D\uDCBB");
  const eUptime = e("uptime", "\u23F1\uFE0F");
  const eGuilds = e("guilds", "\uD83D\uDC65");
  const eUsers = e("users", "\uD83D\uDC64");
  const eBotUptime = e("bot_uptime", "\u23F1\uFE0F");

  const cleanTitle = (lang.STATS_TITLE || "Statistik Sistem").replace(/^\uD83D\uDCCA\s*/, "");
  const cleanServer = (lang.STATS_SERVER || "Server").replace(/^\uD83D\uDDA5\uFE0F?\s*/, "");
  const cleanRam = (lang.STATS_RAM || "RAM").replace(/^\uD83E\uDDE0\s*/, "");
  const cleanSoftware = (lang.STATS_SOFTWARE || "Software").replace(/^\u2699\uFE0F?\s*/, "");
  const cleanReach = (lang.STATS_REACH || "Jangkauan").replace(/^\uD83D\uDCC8\s*/, "");

  const shardId = clusterManager.getShardIds(client);
  const totalShards = clusterManager.getTotalShards(client);
  const memUsage = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);

  let totalGuilds = client.guilds.cache.size;
  let totalUsers = client.users.cache.reduce(
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
      logger.warn("[core:handleStats] Operasi kluster sharding gagal: " + (err?.message || err));
    }
  }

  if (totalUsers <= 0) {
    totalUsers =
      client.guilds.cache.reduce((acc, g) => acc + (g.memberCount || 0), 0) ||
      client.users.cache.size;
  }

  const eShard = e("shard", "\uD83D\uDCDF");
  const statsBanner = ui.getBanner("stats");

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("dark"),
    authorName: "Naura Diagnostic Center",
    title: `${eStats} ${cleanTitle}`,
    iconURL: client.user?.displayAvatarURL?.() || null,
    fields: [
      {
        name: `${eShard} TELEMETRI SHARD & CLUSTER`,
        value:
          `${dot} **Status Sistem:** \`Online (Stabil)\`\n` +
          `${dot} **Shard ID:** \`#${shardId} / ${totalShards}\`\n` +
          `${dot} **Shard Ping:** \`${client.ws?.ping ?? 0} ms\`\n` +
          `${dot} **Memory RSS:** \`${memUsage} MB\` (Bot: \`${botMem} MB\`)\n` +
          `${dot} **Total Guilds:** \`${totalGuilds.toLocaleString("id-ID")}\`\n` +
          `${dot} **Total Users:** \`${totalUsers.toLocaleString("id-ID")}\``,
      },
      {
        name: `${eServer} ${cleanServer}`,
        value: `${dot} **${lang.STATS_PROCESSOR || "Processor"}:** ${eCpu} ${cpuModel} (${cores} Cores)\n${dot} **${lang.STATS_OS || "OS"}:** ${eServer} ${os.type()} ${os.arch()}\n${dot} **${lang.STATS_UPTIME || "Uptime"}:** ${eUptime} ${msToTime(os.uptime() * 1000)}`,
      },
      {
        name: `${eRam} ${cleanRam}`,
        value: `${dot} **${lang.STATS_RAM_SERVER || "RAM Server"}:** \`${usedMem}GB / ${totalMem}GB\`\n${dot} **${lang.STATS_RAM_BOT || "RAM Bot"}:** \`${botMem} MB\``,
      },
      {
        name: `${eSoftware} ${cleanSoftware}`,
        value: `${dot} **Node.js:** \`${process.version}\`\n${dot} **Discord.js:** \`v${djsVersion}\`\n${dot} **Engine:** \`Naura Core v${BOT_VERSION}\`\n${dot} **Command Plugins:** \`${client.commands ? client.commands.size : 55} Modul Aktif\``,
      },
      {
        name: `${eReach} ${cleanReach}`,
        value: `${dot} **${lang.STATS_GUILDS || "Guilds"}:** ${eGuilds} \`${totalGuilds.toLocaleString("id-ID")}\`\n${dot} **${lang.STATS_USERS || "Users"}:** ${eUsers} \`${totalUsers.toLocaleString("id-ID")}\`\n${dot} **${lang.STATS_BOT_UPTIME || "Bot Uptime"}:** ${eBotUptime} \`${msToTime(client.uptime)}\``,
      },
    ],
    bannerAttachmentName: statsBanner ? "banner.png" : null,
    buttonsRow: createNavButtons(),
    footerText: ui.getFooter("core"),
  });

  if (statsBanner) {
    payload.files = [
      new AttachmentBuilder(statsBanner, { name: "banner.png" }),
    ];
  }

  if (interaction.editReply) return interaction.editReply(payload);
  return interaction.reply(payload);
}

module.exports = handleStats;
