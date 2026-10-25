"use strict";

const { logger } = require("../managers/logger");

class ReactionRoleService {
  constructor() {
    this.bindings = new Map();
  }

  /**
   * Bind emoji reaction ke role pada pesan tertentu
   * @param {object} binding - { guildId, channelId, messageId, emoji, roleId }
   * @returns {{ ok: boolean, reason?: string }}
   */
  addBinding(binding) {
    const { guildId, messageId, emoji, roleId } = binding;
    if (!guildId || !messageId || !emoji || !roleId) {
      return { ok: false, reason: "INVALID_PARAMS" };
    }

    const key = `${guildId}:${messageId}:${emoji}`;
    this.bindings.set(key, { ...binding, createdAt: Date.now() });

    logger.info(`[ReactionRole] Bound ${emoji} -> role ${roleId} on message ${messageId}`);
    return { ok: true };
  }

  /**
   * Hapus binding
   * @param {string} guildId
   * @param {string} messageId
   * @param {string} emoji
   */
  removeBinding(guildId, messageId, emoji) {
    const key = `${guildId}:${messageId}:${emoji}`;
    this.bindings.delete(key);
    logger.info(`[ReactionRole] Removed binding ${key}`);
    return { ok: true };
  }

  /**
   * Handle reaction add event
   * @param {object} reaction - Discord MessageReaction
   * @param {object} user - Discord User
   * @returns {Promise<{ ok: boolean, action?: string, reason?: string }>}
   */
  async handleReactionAdd(reaction, user) {
    try {
      if (user.bot) return { ok: false, reason: "BOT_USER" };

      const guildId = reaction.message.guild?.id;
      const messageId = reaction.message.id;
      const emoji = reaction.emoji.id || reaction.emoji.name;

      const key = `${guildId}:${messageId}:${emoji}`;
      const binding = this.bindings.get(key);

      if (!binding) return { ok: false, reason: "NO_BINDING" };

      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return { ok: false, reason: "MEMBER_NOT_FOUND" };

      if (member.roles.cache.has(binding.roleId)) {
        return { ok: true, action: "already_has_role" };
      }

      await member.roles.add(binding.roleId);
      logger.info(`[ReactionRole] Assigned role ${binding.roleId} to ${user.id}`);
      return { ok: true, action: "role_assigned" };
    } catch (error) {
      logger.error("[ReactionRole] HandleAdd error:", error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Handle reaction remove event
   * @param {object} reaction
   * @param {object} user
   * @returns {Promise<{ ok: boolean, action?: string, reason?: string }>}
   */
  async handleReactionRemove(reaction, user) {
    try {
      if (user.bot) return { ok: false, reason: "BOT_USER" };

      const guildId = reaction.message.guild?.id;
      const messageId = reaction.message.id;
      const emoji = reaction.emoji.id || reaction.emoji.name;

      const key = `${guildId}:${messageId}:${emoji}`;
      const binding = this.bindings.get(key);

      if (!binding) return { ok: false, reason: "NO_BINDING" };

      const member = await reaction.message.guild.members.fetch(user.id).catch(() => null);
      if (!member) return { ok: false, reason: "MEMBER_NOT_FOUND" };

      if (!member.roles.cache.has(binding.roleId)) {
        return { ok: true, action: "already_missing_role" };
      }

      await member.roles.remove(binding.roleId);
      logger.info(`[ReactionRole] Removed role ${binding.roleId} from ${user.id}`);
      return { ok: true, action: "role_removed" };
    } catch (error) {
      logger.error("[ReactionRole] HandleRemove error:", error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  getBindings(guildId) {
    const results = [];
    for (const [key, binding] of this.bindings) {
      if (key.startsWith(`${guildId}:`)) results.push(binding);
    }
    return results;
  }
}

module.exports = { ReactionRoleService };
