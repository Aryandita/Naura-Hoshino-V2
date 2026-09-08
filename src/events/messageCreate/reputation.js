"use strict";
const { MessageFlags } = require("discord.js");
const ui = require("../../config/ui");
const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");

const THANKS_REGEX = /\b(thanks|tq|terima\s*kasih|makasih|thx|ty)\b/i;

module.exports = async function handleReputation(message, client, ctx) {
  if (!message.guild) return false;
  if (message.author.bot) return false;

  // Detect thank you messages
  if (THANKS_REGEX.test(message.content)) {
    // Find mentioned users
    const mentionedUsers = message.mentions.users.filter(
      (u) => !u.bot && u.id !== message.author.id,
    );

    if (mentionedUsers.size > 0) {
      // Apply cooldown via Redis
      const cooldownKey = `rep_thanks_cooldown_${message.author.id}`;
      const onCooldown = await redisManager.getCache(cooldownKey);

      if (onCooldown) return false; // Prevent spamming thanks

      // Set a 1-minute cooldown for giving rep via thanks
      await redisManager.setCache(cooldownKey, true, 60);

      const addedTo = [];
      for (const [id] of mentionedUsers) {
        // Increment reputation
        await cacheManager.incrementUserProfile(id, { reputation: 1 });
        addedTo.push(`<@${id}>`);
      }

      if (addedTo.length > 0) {
        const eSuccess = ui.getEmoji("success") || "✅";
        const repEmoji = ui.getEmoji("star") || "⭐";
        const msg = await message
          .reply({
            content: `${eSuccess} | Menambahkan +1 ${repEmoji} Reputasi kepada ${addedTo.join(", ")} karena telah membantu!`,
            flags: MessageFlags.Ephemeral,
          })
          .catch(() => {});

        if (msg) setTimeout(() => msg.delete().catch(() => {}), 10000);
      }
      return true; // We don't block other commands, but we processed something. Actually wait, if we return true, messageCreate might stop. We should return false to let other things process, or just true if we want to stop.
      // Let's return false so it doesn't block counting, XP, etc.
    }
  }
  return false;
};
