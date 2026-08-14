const { EmbedBuilder, AttachmentBuilder } = require("discord.js");
const ui = require("../../config/ui");
const ModMail = require("../../models/ModMail");

const CLOSE_DELAY_MS = 5000;

/**
 * Meneruskan balasan staf di channel tiket modmail kembali ke DM pengguna.
 *
 * @returns {Promise<boolean>} true bila channel ini memang tiket modmail.
 */
module.exports = async function handleStaffReply(message, client) {
  const thread = await ModMail.findOne({
    where: { channelId: message.channel.id, closed: false },
  }).catch(() => null);

  if (!thread) return false;

  if (message.content.toLowerCase() === "n!close") {
    thread.closed = true;
    await thread.save();

    const user = await client.users.fetch(thread.userId).catch(() => null);
    if (user) {
      await user
        .send({
          embeds: [
            new EmbedBuilder()
              .setColor(ui.getColor("error") || "#FF0000")
              .setTitle(
                `${ui.getEmoji("sleepy") || "\uD83D\uDD12"} Sesi ditutup`,
              )
              .setDescription(
                `Obrolanmu dengan staf **${message.guild.name}** sudah Naura tutup. Kalau butuh bantuan lagi, sapa Naura kapan saja, yaa!`,
              ),
          ],
        })
        .catch(() => {});
    }

    await message.channel.send(
      "Naura rapikan channel ini dalam 5 detik, yaa...",
    );
    setTimeout(() => message.channel.delete().catch(() => {}), CLOSE_DELAY_MS);
    return true;
  }

  try {
    const user = await client.users.fetch(thread.userId);
    const embed = new EmbedBuilder()
      .setAuthor({
        name: `Balasan dari ${message.guild.name}`,
        iconURL: message.guild.iconURL(),
      })
      .setDescription(message.content || "*Hanya mengirim lampiran*")
      .setColor(ui.getColor("primary") || "#FFC0CB")
      .setFooter({
        text: `Staf: ${message.author.username}`,
        iconURL: message.author.displayAvatarURL(),
      })
      .setTimestamp();

    const files =
      message.attachments.size > 0
        ? message.attachments.map(
            (a) => new AttachmentBuilder(a.url, { name: a.name }),
          )
        : [];

    await user.send({ embeds: [embed], files });
    await message.react("\uD83D\uDCE8").catch(() => {});
  } catch (error) {
    await message.channel
      .send({
        embeds: [
          new EmbedBuilder()
            .setColor(ui.getColor("error") || "#FF0000")
            .setDescription(
              `${ui.getEmoji("cry") || "\u274C"} Yah, pesannya nggak sampai. Sepertinya DM pengguna itu tertutup.`,
            ),
        ],
      })
      .catch(() => {});
  }

  return true;
};
