"use strict";

const { EmbedBuilder, MessageFlags } = require("discord.js");
const ModMail = require("../../models/ModMail");
const ui = require("../../config/ui");

async function submitReply(interaction, client) {
  const replyText = interaction.fields.getTextInputValue("mm_text_input");
  const isAnon = interaction.customId === "mm_modal_anon";

  const ticket = await ModMail.findOne({
    where: { channelId: interaction.channelId, closed: false },
  });
  if (!ticket) {
    return ui.sendError(
      interaction,
      `${ui.getEmoji("error") || "\u274c"} Gagal: Tiket sudah ditutup.`,
      true,
    );
  }

  const user = await client.users.fetch(ticket.userId).catch(() => null);
  if (!user) {
    return ui.sendError(
      interaction,
      `${ui.getEmoji("error") || "\u274c"} Gagal: User sudah meninggalkan Discord.`,
      true,
    );
  }

  const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");

  const replyPayload = buildContainerV2({
    accentColorHex: "#FFB6C1",
    authorName: isAnon
      ? `Staf ${interaction.guild.name}`
      : `Balasan dari ${interaction.member.displayName}`,
    iconURL: interaction.guild.iconURL(),
    description: replyText,
    footerText: ui.getFooter("core"),
    buttonsRow: new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("mm_user_reply")
        .setLabel("Balas")
        .setEmoji(ui.getEmoji("support") || "💬")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("mm_user_close")
        .setLabel("Tutup Tiket")
        .setEmoji(ui.getEmoji("lock") || "🔒")
        .setStyle(ButtonStyle.Danger),
    ),
  });

  try {
    await user.send(replyPayload);
  } catch (error) {
    // DM tertutup. Ini kondisi normal, bukan galat sistem.
    return ui.sendError(interaction, "err_sys_91", true);
  }

  await interaction.reply({
    content: `${ui.getEmoji("success") || "\u2705"} Pesan ${isAnon ? "(Anonim)" : ""} berhasil dikirim.`,
    flags: MessageFlags.Ephemeral,
  });

  const logEmbed = new EmbedBuilder()
    .setColor(ui.getColor("success"))
    .setAuthor({
      name: isAnon ? `[ANONIM] ${interaction.user.tag}` : interaction.user.tag,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setDescription(`**Membalas:** ${replyText}`);

  await interaction.channel.send({ embeds: [logEmbed] });
  return undefined;
}

async function submitUserReply(interaction, client) {
  const replyText = interaction.fields.getTextInputValue("mm_text_input");

  const ticket = await ModMail.findOne({
    where: { userId: interaction.user.id, closed: false },
  });

  if (!ticket) {
    return ui.sendError(
      interaction,
      `${ui.getEmoji("error") || "\u274c"} Gagal: Tiket tidak ditemukan atau sudah ditutup.`,
      true,
    );
  }

  const guild = client.guilds.cache.get(ticket.guildId);
  const channel = guild?.channels.cache.get(ticket.channelId);

  if (!channel) {
    return ui.sendError(interaction, "err_sys_73", true);
  }

  const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

  const replyPayload = buildContainerV2({
    accentColorHex: "#93C5FD",
    authorName: `Balasan dari ${interaction.user.tag}`,
    iconURL: interaction.user.displayAvatarURL(),
    description: replyText,
    footerText: ui.getFooter("core"),
  });

  await channel.send(replyPayload);

  await interaction.reply({
    content: `${ui.getEmoji("success") || "\u2705"} Pesan berhasil dikirim ke staf.`,
    flags: MessageFlags.Ephemeral | 32768, // IsComponentsV2 | Ephemeral
  });
}

module.exports = [
  { id: "mm_modal_reply", label: "modmail-balas", handler: submitReply },
  { id: "mm_modal_anon", label: "modmail-balas-anonim", handler: submitReply },
  {
    id: "mm_modal_user_reply",
    label: "modmail-user-balas",
    handler: submitUserReply,
  },
];
