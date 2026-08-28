"use strict";

const {
  EmbedBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
} = require("discord.js");
const ModMail = require("../../models/ModMail");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "mm_open",
    label: "tiket-buka",
    // Membuat channel butuh beberapa panggilan API; defer lebih dulu supaya
    // tidak menabrak batas tiga detik.
    defer: "reply",
    onError: "Terjadi kesalahan saat membuat tiket.",
    async handler(interaction, client) {
      const { createTicketChannel } = require("../../modmail/modmailHelper");
      const guildData = await cacheManager.getGuildSettings(
        interaction.guild.id,
      );

      if (!guildData?.settings?.modmail?.categoryId) {
        return ui.sendError(interaction, "err_sys_72", true);
      }

      return createTicketChannel(
        interaction,
        {
          id: interaction.guild.id,
          categoryId: guildData.settings.modmail.categoryId,
        },
        client,
      );
    },
  },

  {
    id: "mm_close",
    label: "tiket-tutup",
    onError: "Terjadi kesalahan saat menutup tiket.",
    async handler(interaction, client) {
      const ticket = await ModMail.findOne({
        where: { channelId: interaction.channelId, closed: false },
      });
      if (!ticket) return ui.sendError(interaction, "err_sys_73", true);

      ticket.closed = true;
      await ticket.save();

      const logEmbed = new EmbedBuilder()
        .setColor("#FF0000")
        .setDescription("\ud83d\udd12 Tiket ini ditutup oleh Staf.");
      await interaction.channel.send({ embeds: [logEmbed] });

      const user = await client.users.fetch(ticket.userId).catch(() => null);
      if (user) {
        const notifyEmbed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription(
            `\ud83d\udd12 Tiket bantuanmu dengan **${interaction.guild.name}** telah ditutup.`,
          )
          .setTimestamp();
        user.send({ embeds: [notifyEmbed] }).catch(() => {});
      }

      await interaction.reply(
        "\u23f3 Channel ini akan dihapus dalam 5 detik...",
      );
      setTimeout(() => interaction.channel.delete().catch(() => {}), 5000);
      return undefined;
    },
  },

  {
    id: "mm_reply",
    label: "tiket-balas",
    handler: (interaction) => showReplyModal(interaction, false),
  },

  {
    id: "mm_reply_anon",
    label: "tiket-balas-anonim",
    handler: (interaction) => showReplyModal(interaction, true),
  },

  {
    id: "mm_user_reply",
    label: "tiket-user-balas",
    handler: (interaction) => showUserReplyModal(interaction),
  },

  {
    id: "mm_user_close",
    label: "tiket-user-tutup",
    onError: "Terjadi kesalahan saat menutup tiket.",
    async handler(interaction, client) {
      const ticket = await ModMail.findOne({
        where: { userId: interaction.user.id, closed: false },
      });
      if (!ticket) return ui.sendError(interaction, "err_sys_73", true);

      ticket.closed = true;
      await ticket.save();

      const guild = client.guilds.cache.get(ticket.guildId);
      const channel = guild?.channels.cache.get(ticket.channelId);

      if (channel) {
        const logEmbed = new EmbedBuilder()
          .setColor("#FF0000")
          .setDescription(
            `🔒 Tiket ini ditutup oleh Pengguna (<@${interaction.user.id}>).`,
          );
        await channel.send({ embeds: [logEmbed] });

        // Rename thread to mark as closed, or delete it
        if (channel.isThread()) {
          await channel
            .setArchived(true, "Ditutup oleh pengguna")
            .catch(() => {});
        } else {
          setTimeout(() => channel.delete().catch(() => {}), 5000);
        }
      }

      await interaction.reply({
        content: "✅ Tiket modmail telah berhasil ditutup.",
        flags: 32768 | 64, // IsComponentsV2 | Ephemeral
      });
      return undefined;
    },
  },
];

function showUserReplyModal(interaction) {
  const modal = new ModalBuilder()
    .setCustomId("mm_modal_user_reply")
    .setTitle("💬 Balas Modmail");

  const input = new TextInputBuilder()
    .setCustomId("mm_text_input")
    .setLabel("Tulis balasanmu kepada staf:")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}

function showReplyModal(interaction, anonymous) {
  const modal = new ModalBuilder()
    .setCustomId(anonymous ? "mm_modal_anon" : "mm_modal_reply")
    .setTitle(
      anonymous
        ? "\ud83d\udd75\ufe0f Balas Anonim"
        : "\ud83d\udcac Balas Tiket",
    );

  const input = new TextInputBuilder()
    .setCustomId("mm_text_input")
    .setLabel("Tulis balasanmu:")
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true);

  modal.addComponents(new ActionRowBuilder().addComponents(input));
  return interaction.showModal(modal);
}
