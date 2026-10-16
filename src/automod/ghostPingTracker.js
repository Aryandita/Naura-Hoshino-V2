"use strict";

const { AuditLogEvent } = require("discord.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { sendModLog } = require("../utils/modLogHelper");
const ui = require("../config/ui");

/**
 * Default TTL for cached messages with mentions (60 seconds).
 */
const DEFAULT_TTL_MS = 60 * 1000;

/**
 * Maximum capacity of tracked messages in memory.
 */
const MAX_CACHE_SIZE = 5000;

/**
 * In-memory storage for messages containing mentions.
 * @type {Map<string, {
 *   messageId: string,
 *   guildId: string,
 *   channelId: string,
 *   authorId: string,
 *   authorTag: string,
 *   authorUsername: string,
 *   authorAvatar: string | null,
 *   content: string,
 *   createdTimestamp: number,
 *   mentions: {
 *     users: Array<{ id: string, tag: string, username: string }>,
 *     roles: Array<{ id: string, name: string }>,
 *     everyone: boolean,
 *   }
 * }>}
 */
const messageCache = new Map();

let sweeperInterval = null;

/**
 * Starts periodic cleanup of expired messages in memory.
 */
function startSweeper() {
  if (sweeperInterval) return;
  sweeperInterval = setInterval(() => {
    const now = Date.now();
    for (const [id, record] of messageCache.entries()) {
      if (now - record.createdTimestamp > DEFAULT_TTL_MS) {
        messageCache.delete(id);
      }
    }
  }, 30 * 1000);

  if (sweeperInterval.unref) {
    sweeperInterval.unref();
  }
}

/**
 * Stops periodic cleanup (primarily used in tests).
 */
function stopSweeper() {
  if (sweeperInterval) {
    clearInterval(sweeperInterval);
    sweeperInterval = null;
  }
}

startSweeper();

/**
 * Records a message in the ghost ping tracker if it contains qualifying mentions.
 * Excludes self-mentions (users mentioning themselves).
 * @param {import("discord.js").Message} message
 * @returns {boolean} Whether the message was tracked
 */
function trackMessage(message) {
  if (!message || !message.guild || message.author?.bot) {
    return false;
  }

  const authorId = message.author.id;

  // Filter out self-mentions
  const users = [];
  if (message.mentions?.users) {
    for (const user of message.mentions.users.values()) {
      if (user && user.id !== authorId) {
        users.push({
          id: user.id,
          tag: user.tag || user.username || "Unknown",
          username: user.username || "Unknown",
        });
      }
    }
  }

  const roles = [];
  if (message.mentions?.roles) {
    for (const role of message.mentions.roles.values()) {
      if (role) {
        roles.push({
          id: role.id,
          name: role.name || "Role",
        });
      }
    }
  }

  const everyone = Boolean(message.mentions?.everyone);

  // If no qualifying mentions exist, don't store in cache
  if (users.length === 0 && roles.length === 0 && !everyone) {
    return false;
  }

  // Enforce memory capacity limit (evict oldest if full)
  if (messageCache.size >= MAX_CACHE_SIZE) {
    const oldestKey = messageCache.keys().next().value;
    if (oldestKey) messageCache.delete(oldestKey);
  }

  const record = {
    messageId: message.id,
    guildId: message.guild.id,
    channelId: message.channel?.id || null,
    authorId,
    authorTag: message.author.tag || message.author.username || "Unknown",
    authorUsername: message.author.username || "Unknown",
    authorAvatar:
      typeof message.author.displayAvatarURL === "function"
        ? message.author.displayAvatarURL()
        : null,
    content: message.content || "",
    createdTimestamp: message.createdTimestamp || Date.now(),
    mentions: {
      users,
      roles,
      everyone,
    },
  };

  messageCache.set(message.id, record);
  return true;
}

/**
 * Checks if a deleted message was a ghost ping.
 * Excludes deletions executed by moderators or administrators via Audit Log.
 * @param {import("discord.js").Message} message
 * @param {import("discord.js").Client} [client]
 * @returns {Promise<{ isGhostPing: boolean, record?: Object, reason?: string, elapsedSeconds?: number }>}
 */
async function handleDelete(message, client) {
  if (!message || !message.id) {
    return { isGhostPing: false, reason: "invalid_message" };
  }

  const record = messageCache.get(message.id);
  if (!record) {
    return { isGhostPing: false, reason: "not_tracked" };
  }

  // Remove from cache once processed
  messageCache.delete(message.id);

  // Check audit log for moderator deletion exclusion
  let isModeratorAction = false;
  if (message.guild && typeof message.guild.fetchAuditLogs === "function") {
    try {
      const logs = await message.guild
        .fetchAuditLogs({ limit: 1, type: AuditLogEvent.MessageDelete })
        .catch(() => null);

      const entry = logs ? (logs.entries?.first ? logs.entries.first() : (Array.isArray(logs.entries) ? logs.entries[0] : null)) : null;
      if (entry) {
        const entryTime = entry.createdTimestamp || (entry.createdAt ? entry.createdAt.getTime() : 0);
        const isRecent = entryTime ? Math.abs(Date.now() - entryTime) < 10000 : true;
        const targetId = entry.target?.id || entry.targetId;
        const executorId = entry.executor?.id || entry.executorId;
        const targetMatch = targetId === record.authorId;
        const notSelf = executorId && executorId !== record.authorId;

        if (isRecent && targetMatch && notSelf) {
          isModeratorAction = true;
        }
      }
    } catch (err) {
      // Defensive fallback
    }
  }

  if (isModeratorAction) {
    return { isGhostPing: false, reason: "moderator_deletion" };
  }

  const elapsedSeconds = Number(
    ((Date.now() - record.createdTimestamp) / 1000).toFixed(1),
  );

  // If deleted within threshold (<= 60s), it is a ghost ping
  if (elapsedSeconds <= 60) {
    const userTargets = record.mentions.users.map((u) => `<@${u.id}>`).join(", ");
    const roleTargets = record.mentions.roles.map((r) => `<@&${r.id}>`).join(", ");
    const targetsStr = [
      userTargets,
      roleTargets,
      record.mentions.everyone ? "@everyone/@here" : "",
    ]
      .filter(Boolean)
      .join(", ");

    const safeAuthorName = ui.stripCustomEmojis
      ? ui.stripCustomEmojis(`${record.authorTag} (${record.authorId})`)
      : `${record.authorTag} (${record.authorId})`;

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("warn") || "#FFA500",
      authorName: safeAuthorName,
      title: `${ui.getEmoji("shield_alert") || "🚨"} Ghost Ping Terdeteksi!`,
      description: `Pesan dengan sebutan (mention) dihapus dengan cepat oleh pengirimnya dalam waktu **${elapsedSeconds} detik**.`,
      fields: [
        {
          name: `${ui.getEmoji("member") || "👤"} Pengirim`,
          value: `<@${record.authorId}>`,
          inline: true,
        },
        {
          name: `${ui.getEmoji("info") || "🎯"} Target Sebutan`,
          value: targetsStr || "Tidak ada rincian",
          inline: true,
        },
        {
          name: `${ui.getEmoji("desc") || "📋"} Konten Pesan yang Dihapus`,
          value: record.content
            ? `\`\`\`text\n${record.content.substring(0, 1000)}\n\`\`\``
            : "*[Hanya sebutan / lampiran]*",
          inline: false,
        },
      ],
      footerText: ui.getFooter("admin"),
    });

    try {
      const channel =
        message.channel ||
        (message.guild?.channels?.cache ? message.guild.channels.cache.get(record.channelId) : null);

      if (channel && typeof channel.send === "function") {
        await channel.send(payload).catch(() => {});
      }

      if (message.guild) {
        await sendModLog(message.guild, payload).catch(() => {});
      }
    } catch (e) {
      // Defensive fallback
    }

    return { isGhostPing: true, record, elapsedSeconds };
  }

  return { isGhostPing: false, reason: "exceeded_ttl", elapsedSeconds };
}

/**
 * Checks if mentions were silently removed during a message edit (Stealth Ghost Ping).
 * @param {import("discord.js").Message} oldMessage
 * @param {import("discord.js").Message} newMessage
 * @param {import("discord.js").Client} [client]
 * @returns {Promise<{ isStealthPing: boolean, removedUsers?: Array<Object>, removedRoles?: Array<Object> }>}
 */
async function handleUpdate(oldMessage, newMessage, client) {
  if (
    !oldMessage ||
    !newMessage ||
    !oldMessage.guild ||
    oldMessage.author?.bot ||
    oldMessage.content === newMessage.content
  ) {
    return { isStealthPing: false };
  }

  const authorId = oldMessage.author?.id || newMessage.author?.id;

  // Extract old mentions
  const oldUsers = [];
  if (oldMessage.mentions?.users) {
    for (const u of oldMessage.mentions.users.values()) {
      if (u && u.id !== authorId) {
        oldUsers.push({ id: u.id, tag: u.tag || u.username, username: u.username });
      }
    }
  }

  const oldRoles = [];
  if (oldMessage.mentions?.roles) {
    for (const r of oldMessage.mentions.roles.values()) {
      if (r) {
        oldRoles.push({ id: r.id, name: r.name });
      }
    }
  }

  // Extract new mentions
  const newUserIdSet = new Set();
  if (newMessage.mentions?.users) {
    for (const u of newMessage.mentions.users.values()) {
      if (u && u.id !== authorId) newUserIdSet.add(u.id);
    }
  }

  const newRoleIdSet = new Set();
  if (newMessage.mentions?.roles) {
    for (const r of newMessage.mentions.roles.values()) {
      if (r) newRoleIdSet.add(r.id);
    }
  }

  const removedUsers = oldUsers.filter((u) => !newUserIdSet.has(u.id));
  const removedRoles = oldRoles.filter((r) => !newRoleIdSet.has(r.id));

  if (removedUsers.length > 0 || removedRoles.length > 0) {
    const userTargets = removedUsers.map((u) => `<@${u.id}>`).join(", ");
    const roleTargets = removedRoles.map((r) => `<@&${r.id}>`).join(", ");
    const targetsStr = [userTargets, roleTargets].filter(Boolean).join(", ");

    const rawAuthorTag =
      oldMessage.author?.tag ||
      oldMessage.author?.username ||
      newMessage.author?.tag ||
      "Unknown";
    const safeAuthorName = ui.stripCustomEmojis
      ? ui.stripCustomEmojis(`${rawAuthorTag} (${authorId})`)
      : `${rawAuthorTag} (${authorId})`;

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("warn") || "#FFA500",
      authorName: safeAuthorName,
      title: `${ui.getEmoji("rename") || "🚨"} Stealth Ghost Ping Terdeteksi!`,
      description: `Pengirim telah menyunting pesan dan diam-diam menghapus sebutan (mention) target.`,
      fields: [
        {
          name: `${ui.getEmoji("member") || "👤"} Pengirim`,
          value: `<@${authorId}>`,
          inline: true,
        },
        {
          name: `${ui.getEmoji("info") || "🎯"} Sebutan yang Dihapus`,
          value: targetsStr || "Tidak diketahui",
          inline: true,
        },
        {
          name: `${ui.getEmoji("desc") || "📋"} Konten Original`,
          value: oldMessage.content
            ? `\`\`\`text\n${oldMessage.content.substring(0, 1000)}\n\`\`\``
            : "*[Kosong]*",
          inline: false,
        },
        {
          name: `${ui.getEmoji("desc") || "📋"} Konten Sesudah Diedit`,
          value: newMessage.content
            ? `\`\`\`text\n${newMessage.content.substring(0, 1000)}\n\`\`\``
            : "*[Kosong]*",
          inline: false,
        },
      ],
      footerText: ui.getFooter("admin"),
    });

    try {
      if (newMessage.channel && typeof newMessage.channel.send === "function") {
        await newMessage.channel.send(payload).catch(() => {});
      }

      if (newMessage.guild) {
        await sendModLog(newMessage.guild, payload).catch(() => {});
      }
    } catch (e) {
      // Defensive fallback
    }

    return { isStealthPing: true, removedUsers, removedRoles };
  }

  return { isStealthPing: false };
}

/**
 * Accessor for tests or internal inspection.
 */
function getCache() {
  return messageCache;
}

/**
 * Clears the message cache (useful between tests).
 */
function clearCache() {
  messageCache.clear();
}

/**
 * Gets a tracked message by its messageId.
 * @param {string} messageId
 */
function getTrackedMessage(messageId) {
  return messageCache.get(messageId) || null;
}

module.exports = {
  trackMessage,
  handleDelete,
  handleUpdate,
  handleDeletedMessage: handleDelete,
  handleUpdatedMessage: handleUpdate,
  getCache,
  clearCache,
  getTrackedMessage,
  stopSweeper,
  startSweeper,
  DEFAULT_TTL_MS,
  MAX_CACHE_SIZE,
};
