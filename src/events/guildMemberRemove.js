const { Events } = require("discord.js");
const GuildSettings = require("../models/GuildSettings");
const StickyRole = require("../models/StickyRole");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

module.exports = {
  name: Events.GuildMemberRemove,
  async execute(member) {
    if (member.user.bot) return;

    try {
      const settings = await cacheManager.getGuildSettings(member.guild.id);
      if (!settings || !settings.settings || !settings.settings.sticky_roles)
        return;

      // Simpan role yang dimiliki user saat keluar
      const rolesToSave = member.roles.cache
        .filter((r) => !r.managed && r.id !== member.guild.id)
        .map((r) => r.id);

      if (rolesToSave.length > 0) {
        await StickyRole.upsert({
          guildId: member.guild.id,
          userId: member.user.id,
          roles: JSON.stringify(rolesToSave),
        });
        logger.info(
          `[StickyRoles] Saved ${rolesToSave.length} roles for ${member.user.tag} in ${member.guild.name}`,
        );
      }

      // Leave Greetings
      const greetings = settings.settings.greetings;
      if (
        greetings &&
        greetings.leave &&
        greetings.leave.enabled &&
        greetings.leave.channelId
      ) {
        const leaveData = greetings.leave;
        const channel = member.guild.channels.cache.get(leaveData.channelId);
        if (channel) {
          const ui = require("../config/ui");
          const {
            generateWelcomeImage,
          } = require("../canvas/CanvasUtils");
          const { EmbedBuilder, AttachmentBuilder } = require("discord.js");

          let parsedMessage = leaveData.message || "Sampai jumpa {member}!";
          parsedMessage = parsedMessage
            .replace(/\{member\}/g, `<@${member.id}>`)
            .replace(/\{user\}/g, member.user.username)
            .replace(/\{guild\}/g, member.guild.name)
            .replace(/\{count\}/g, member.guild.memberCount);

          parsedMessage = parsedMessage.replace(
            /\{([a-zA-Z0-9_]+)\}/g,
            (match, p1) => {
              const emoji = ui.getEmoji(p1.toLowerCase());
              return emoji && emoji !== "💠" ? emoji : match;
            },
          );

          const embed = new EmbedBuilder()
            .setColor(leaveData.color || ui.getColor("leave"))
            .setDescription(parsedMessage);

          const payload = { embeds: [embed] };

          if (leaveData.image) {
            try {
              const bgUrl = leaveData.background || ui.getBackground("leave");
              const imageBuffer = await generateWelcomeImage(
                member,
                "leave",
                ui,
                bgUrl,
              );
              const attachment = new AttachmentBuilder(imageBuffer, {
                name: "leave.png",
              });
              embed.setImage("attachment://leave.png");
              payload.files = [attachment];
            } catch (err) {
              logger.error("[Leave Image Error]", err);
            }
          }

          await channel
            .send(payload)
            .catch((err) => logger.error("[Leave Send Error]", err));
        }
      }
    } catch (error) {
      logger.error(`[Event: GuildMemberRemove] Error: ${error.message}`);
    }
  },
};
