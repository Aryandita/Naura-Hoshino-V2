const env = require("../../config/env");
const { logger } = require("../../managers/logger");
const ModMail = require("../../models/ModMail");
const persona = require("./persona");
const { handleModmailDM } = require("../../modmail/modmailHelper");
const { checkPremiumStatus } = require("../../premium/premiumHelper");
const { awardXp } = require("../../leveling/levelingEngine");

/**
 * Menangani seluruh pesan yang masuk lewat DM: modmail bila ada sesi aktif,
 * selebihnya diperlakukan sebagai obrolan dengan Naura.
 *
 * @returns {Promise<boolean>} selalu true; DM tidak pernah lanjut ke alur guild.
 */
module.exports = async function handleDirectMessage(message, client) {
  try {
    const activeMail = await ModMail.findOne({
      where: { userId: message.author.id, closed: false },
    });

    const lowered = message.content.toLowerCase();
    if (
      lowered.startsWith("n!modmail") ||
      lowered === "n!close" ||
      activeMail
    ) {
      await handleModmailDM(message, client);

      if (activeMail && activeMail.guildId) {
        const guild = client.guilds.cache.get(activeMail.guildId);
        if (guild) {
          await awardXp(
            message.author,
            guild,
            message.channel,
            message.content,
          ).catch(() => {});
        }
      }
      return true;
    }

    const isOwner = env.OWNER_IDS.includes(message.author.id);
    const isPremiumUser = await checkPremiumStatus(message.author.id);

    let previousBotMessage = "";
    if (message.reference?.messageId) {
      const replied = await message.channel.messages
        .fetch(message.reference.messageId)
        .catch(() => null);
      if (replied && replied.author.id === client.user.id) {
        previousBotMessage = `\n[Konteks] Sebelumnya kamu berkata: "${replied.content}"\n`;
      }
    }

    const userMessage = message.content
      .replace(new RegExp(`<@!?${client.user.id}>`, "g"), "")
      .trim();

    const AIRouterManager = require("../../ai/aiRouterManager");
    await AIRouterManager.processMessage(
      client,
      message,
      userMessage,
      persona.build({ username: message.author.username, isOwner }),
      previousBotMessage,
      isOwner,
      isPremiumUser,
      null,
    );
  } catch (error) {
    logger.error("[DM Error]", error);
  }

  return true;
};
