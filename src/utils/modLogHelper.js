"use strict";

const GuildSettings = require("../models/GuildSettings");
const { logger } = require("../managers/logger");

/**
 * Mengirimkan pesan log moderasi berformat Components V2 ke channel audit log server.
 * @param {import("discord.js").Guild} guild
 * @param {Object} containerPayload
 */
async function sendModLog(guild, containerPayload) {
  if (!guild || !containerPayload) return null;

  try {
    const row = await GuildSettings.findOne({ where: { guildId: guild.id } });
    if (!row || !row.settings) return null;

    const s = row.settings;
    const channelId = s.auditLogChannel || s.modLogChannel || s.logChannelId;
    if (!channelId) return null;

    const channel =
      guild.channels.cache.get(channelId) ||
      (await guild.channels.fetch(channelId).catch(() => null));

    if (!channel || typeof channel.send !== "function") return null;

    return await channel.send(containerPayload).catch((err) => {
      logger.warn(`[ModLogHelper] Gagal mengirim log ke channel ${channelId}:`, err.message);
      return null;
    });
  } catch (error) {
    logger.warn("[ModLogHelper] Error saat membaca auditLogChannel:", error.message);
    return null;
  }
}

module.exports = { sendModLog };
