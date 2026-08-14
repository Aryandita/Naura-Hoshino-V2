"use strict";

const { EmbedBuilder } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");

async function openTicketFromMenu(interaction, client) {
  const { createTicketChannel } = require("../../modmail/modmailHelper");
  const targetGuildId = interaction.values[0];

  const guildData = await cacheManager.getGuildSettings(targetGuildId);
  if (!guildData?.settings?.modmail?.categoryId) {
    return ui.sendError(interaction, "err_sys_87", true);
  }

  const loadingEmbed = new EmbedBuilder()
    .setColor(ui.getColor("primary") || "#FFB6C1")
    .setAuthor({
      name: "Naura Loading System...",
      iconURL: interaction.client.user.displayAvatarURL(),
    })
    .setDescription(
      `${ui.getEmoji("loading") || "\u23f3"} Naura sedang mengetuk pintu server... Sabar ya! \ud83c\udf38`,
    )
    .setFooter({
      text: `Sedang menyiapkan untuk ${interaction.user.username}`,
      iconURL: interaction.user.displayAvatarURL(),
    });

  await interaction.update({
    content: null,
    embeds: [loadingEmbed],
    components: [],
  });

  const fetched = await interaction.channel.messages
    .fetch({ limit: 5 })
    .catch(() => null);
  const originalMessage = fetched
    ? fetched.find((m) => m.author.id === interaction.user.id)
    : null;

  const redisManager = require("../../managers/redisManager");
  const draftKey = `modmail:draft:${interaction.user.id}`;
  const draft = await redisManager.getCache(draftKey);

  try {
    await createTicketChannel(
      originalMessage || interaction,
      { id: targetGuildId, categoryId: guildData.settings.modmail.categoryId },
      client,
      draft,
    );
    await redisManager.client.del(draftKey);
  } catch (error) {
    const errEmbed = new EmbedBuilder()
      .setColor(ui.getColor("error") || "#ff3333")
      .setDescription("\u274c Terjadi kesalahan saat memproses tiket modmail.");
    await interaction
      .editReply({ embeds: [errEmbed], components: [] })
      .catch(() => {});
  }

  return undefined;
}

module.exports = [
  {
    id: "mm_select_server",
    label: "modmail-pilih-server",
    handler: openTicketFromMenu,
  },
  {
    id: "modmail_select_guild",
    label: "modmail-pilih-guild",
    handler: openTicketFromMenu,
  },
];
