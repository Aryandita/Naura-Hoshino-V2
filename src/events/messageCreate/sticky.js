const { EmbedBuilder } = require("discord.js");
const ui = require("../../config/ui");

/**
 * Menempelkan ulang pesan sticky ke dasar channel setiap kali ada pesan baru.
 * Tidak pernah menghentikan alur.
 */
module.exports = async function handleSticky(message, client, ctx) {
  const sticky = ctx.settings?.settings?.stickyMessage;
  if (!sticky || sticky.channelId !== message.channel.id || !sticky.message)
    return false;

  if (sticky.lastId) {
    const previous = await message.channel.messages
      .fetch(sticky.lastId)
      .catch(() => null);
    if (previous) await previous.delete().catch(() => {});
  }

  const embed = new EmbedBuilder()
    .setColor(ui.getColor("primary") || "#FFB6C1")
    .setDescription(sticky.message);

  const sent = await message.channel
    .send({ embeds: [embed] })
    .catch(() => null);
  if (sent) {
    sticky.lastId = sent.id;
    await ctx.saveSettings("settings");
  }

  return false;
};
