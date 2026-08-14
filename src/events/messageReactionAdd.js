const { EmbedBuilder } = require("discord.js");
const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");

// Bintang standar Discord, dipakai sebagai penanda starboard.
const STAR_EMOJI = "\u2b50";
const HISTORY_LIMIT = 100;

module.exports = {
  name: "messageReactionAdd",
  async execute(reaction, user) {
    try {
      // Reaksi pada pesan lama datang dalam bentuk parsial. Keduanya wajib
      // dilengkapi sebelum dibaca, kalau tidak message.author bernilai null
      // dan seluruh handler melempar sebelum sempat bekerja.
      if (reaction.partial) await reaction.fetch();
      if (reaction.message.partial) await reaction.message.fetch();

      if (reaction.emoji.name !== STAR_EMOJI) return;

      const message = reaction.message;
      if (!message.guild) return;
      if (!message.author || message.author.bot) return;
      if (user && user.bot) return;

      const settings = await cacheManager.getGuildSettings(message.guild.id);
      const config =
        settings && settings.settings ? settings.settings.starboard : null;
      if (!config || !config.enabled || !config.channelId) return;

      const threshold = config.threshold || 3;
      const count = reaction.count || 0;
      if (count < threshold) return;

      const starboardChannel = message.guild.channels.cache.get(
        config.channelId,
      );
      if (!starboardChannel) return;

      // Jangan biarkan pesan starboard ikut di-starboard lagi.
      if (message.channel.id === starboardChannel.id) return;

      const content = `${STAR_EMOJI} **${count}** | <#${message.channel.id}>`;
      const botId = message.client.user.id;

      const history = await starboardChannel.messages
        .fetch({ limit: HISTORY_LIMIT })
        .catch(() => null);

      const existing = history
        ? history.find(
            (m) =>
              m.author.id === botId &&
              m.embeds.length === 1 &&
              m.embeds[0].footer &&
              typeof m.embeds[0].footer.text === "string" &&
              m.embeds[0].footer.text.includes(message.id),
          )
        : null;

      if (existing) {
        await existing
          .edit({ content })
          .catch((err) =>
            logger.warn(
              `[Starboard] Gagal memperbarui hitungan: ${err.message}`,
            ),
          );
        return;
      }

      const embed = new EmbedBuilder()
        .setAuthor({
          name: message.author.tag,
          iconURL: message.author.displayAvatarURL(),
        })
        .setColor("#f1c40f")
        .setDescription(
          message.content
            ? message.content.substring(0, 4000)
            : "*[Tidak ada teks]*",
        )
        .addFields({
          name: "Sumber",
          value: `[Lompat ke Pesan](${message.url})`,
        })
        .setFooter({ text: `ID: ${message.id}` })
        .setTimestamp(message.createdTimestamp);

      const image = message.attachments.find(
        (a) => a.contentType && a.contentType.startsWith("image/"),
      );
      if (image) embed.setImage(image.url);

      await starboardChannel.send({ content, embeds: [embed] });
    } catch (error) {
      logger.error("[Starboard Process Error]", error);
    }
  },
};
