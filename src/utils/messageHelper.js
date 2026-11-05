"use strict";

/**
 * @file messageHelper.js
 * @description Centralized helper for safe Discord message and interaction deletion.
 * Ensures total deletion of messages from Discord channels rather than clearing
 * attachments ({ files: [] }), which leaves behind orphaned Discord Components V2
 * container shells or ghost cards.
 */

const { logger } = require("../managers/logger");

/**
 * Discord API error codes that represent ignorable errors when deleting a message:
 * - 10008: Unknown Message (message was already deleted)
 * - 10015: Unknown Webhook (webhook token expired or deleted)
 * - 10062: Unknown interaction (interaction expired or deleted)
 * - 40060: Interaction has already been acknowledged
 * - 50027: Invalid Webhook Token (webhook token expired)
 */
const UNKNOWN_MESSAGE_CODES = new Set([10008, 10015, 10062, 40060, 50027]);

/**
 * Checks whether an error indicates that the message or interaction is already gone.
 * @param {Error|object} err
 * @returns {boolean}
 */
function isIgnorableDeleteError(err) {
  if (!err) return false;
  if (err.code && UNKNOWN_MESSAGE_CODES.has(Number(err.code))) return true;
  if (err.status === 404 || err.status === 401) return true;
  if (err.name === "AbortError" || err.code === "ABORT_ERR") return true;

  const msg = String(err.message || "").toLowerCase();
  if (
    msg.includes("unknown message") ||
    msg.includes("unknown webhook") ||
    msg.includes("unknown interaction") ||
    msg.includes("invalid webhook token") ||
    msg.includes("already been acknowledged")
  ) {
    return true;
  }

  return false;
}

/**
 * Safely deletes a Discord message or interaction reply from the channel.
 * Completely eliminates the message rather than stripping attachments ({ files: [] }),
 * preventing orphaned Components V2 container shells.
 *
 * @param {object} interactionOrMessage - Discord Interaction or Message instance
 * @param {object} [options={}] - Optional configuration
 * @param {boolean} [options.suppressErrors=true] - Suppress unknown message errors
 * @returns {Promise<boolean>} True if the message was deleted or already absent
 */
async function safeDeleteMessage(interactionOrMessage, options = {}) {
  if (!interactionOrMessage) {
    return false;
  }

  try {
    // 1. Target is a Discord Interaction (Command or Component Interaction)
    if (typeof interactionOrMessage.deleteReply === "function") {
      const interaction = interactionOrMessage;

      // Case A: Interaction is already acknowledged (deferred or replied)
      if (interaction.deferred || interaction.replied) {
        try {
          await interaction.deleteReply();
          return true;
        } catch (err) {
          if (isIgnorableDeleteError(err)) {
            return true;
          }
          // If deleteReply fails on an interaction with a message, try deleting interaction.message
          if (
            interaction.message &&
            typeof interaction.message.delete === "function"
          ) {
            try {
              await interaction.message.delete();
              return true;
            } catch (innerErr) {
              if (isIgnorableDeleteError(innerErr)) return true;
            }
          }
          throw err;
        }
      }

      // Case B: Component interaction (Button/Select) not yet replied or deferred
      if (
        interaction.message &&
        typeof interaction.message.delete === "function"
      ) {
        try {
          if (typeof interaction.deferUpdate === "function") {
            await interaction.deferUpdate().catch(() => {});
          }
          await interaction.message.delete();
          return true;
        } catch (err) {
          if (isIgnorableDeleteError(err)) return true;
        }
      }

      // Case C: Command interaction not yet replied or deferred
      if (typeof interaction.deferReply === "function") {
        try {
          // Defer ephemeral to acknowledge without cluttering channel
          await interaction.deferReply({ flags: 64 }).catch(() => {});
          await interaction.deleteReply();
          return true;
        } catch (err) {
          if (isIgnorableDeleteError(err)) return true;
          throw err;
        }
      }

      // Direct fallback
      await interaction.deleteReply();
      return true;
    }

    // 2. Target is a Discord Message instance
    if (typeof interactionOrMessage.delete === "function") {
      await interactionOrMessage.delete();
      return true;
    }

    // 3. Target wraps a message (e.g. { message: messageObj })
    if (
      interactionOrMessage.message &&
      typeof interactionOrMessage.message.delete === "function"
    ) {
      await interactionOrMessage.message.delete();
      return true;
    }

    return false;
  } catch (err) {
    if (isIgnorableDeleteError(err)) {
      return true;
    }

    if (logger && typeof logger.debug === "function") {
      logger.debug(
        `[MessageHelper:safeDeleteMessage] Gagal menghapus pesan: ${err?.message || err}`,
      );
    }
    return false;
  }
}

/**
 * Schedules a message or interaction for automatic deletion after a specified delay.
 * Unrefs the timer so it does not block the Node process lifecycle.
 *
 * @param {object} interactionOrMessage - Discord Interaction or Message instance
 * @param {number} [delayMs=15000] - Delay in milliseconds before deletion
 * @param {object} [options={}] - Options passed to safeDeleteMessage
 * @returns {() => void} Function to cancel the scheduled deletion
 */
function deleteAfterDelay(interactionOrMessage, delayMs = 15000, options = {}) {
  if (!interactionOrMessage) {
    return () => {};
  }

  const safeMs = Math.max(20, delayMs);
  const timer = setTimeout(async () => {
    try {
      await safeDeleteMessage(interactionOrMessage, options);
    } catch {
      // Ignored
    }
  }, safeMs);

  if (timer && typeof timer.unref === "function") {
    timer.unref();
  }

  return () => {
    clearTimeout(timer);
  };
}

/**
 * Immediate dismissal alias for safeDeleteMessage.
 *
 * @param {object} interactionOrMessage
 * @param {object} [options={}]
 * @returns {Promise<boolean>}
 */
async function dismissMessage(interactionOrMessage, options = {}) {
  return safeDeleteMessage(interactionOrMessage, options);
}

/**
 * Validates whether an error represents an ignorable unknown message/webhook error.
 *
 * @param {Error|object} err
 * @returns {boolean}
 */
function isUnknownMessageError(err) {
  return isIgnorableDeleteError(err);
}

/**
 * Cleans up orphaned or ghost container messages in a Discord channel.
 *
 * @param {object} channel - Discord TextChannel or ThreadChannel
 * @param {object} [options={}]
 * @param {number} [options.limit=50] - Number of messages to scan
 * @param {string} [options.botId] - Only inspect messages sent by this bot ID
 * @returns {Promise<{ cleaned: number, checked: number }>}
 */
async function cleanGhostContainers(channel, options = {}) {
  if (!channel || typeof channel.messages?.fetch !== "function") {
    return { cleaned: 0, checked: 0 };
  }

  const limit = Math.min(100, Math.max(1, options.limit || 50));
  const botId = options.botId || null;
  let cleaned = 0;
  let checked = 0;

  try {
    const fetched = await channel.messages.fetch({ limit });
    checked = fetched.size;

    for (const msg of fetched.values()) {
      if (botId && msg.author.id !== botId) continue;
      if (!msg.author.bot) continue;

      const hasContent = Boolean(msg.content && msg.content.trim().length > 0);
      const hasAttachments = Boolean(
        msg.attachments && msg.attachments.size > 0,
      );
      const hasEmbeds = Boolean(msg.embeds && msg.embeds.length > 0);
      const componentsCount = Array.isArray(msg.components)
        ? msg.components.length
        : 0;

      // Detect empty ghost container shells
      const isGhost =
        !hasContent && !hasAttachments && !hasEmbeds && componentsCount === 0;
      if (isGhost) {
        const deleted = await safeDeleteMessage(msg);
        if (deleted) cleaned++;
      }
    }
  } catch (err) {
    if (logger && typeof logger.debug === "function") {
      logger.debug(
        `[MessageHelper:cleanGhostContainers] Error scanning channel: ${err?.message || err}`,
      );
    }
  }

  return { cleaned, checked };
}

module.exports = {
  safeDeleteMessage,
  deleteAfterDelay,
  dismissMessage,
  isUnknownMessageError,
  cleanGhostContainers,
  UNKNOWN_MESSAGE_CODES,
};
