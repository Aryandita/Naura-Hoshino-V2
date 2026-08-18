const {
  buildLoadingContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");

async function openTicketFromMenu(interaction, client) {
  const {
    createTicketChannel,
  } = require("../../modmail/modmailHelper");
  const targetGuildId = interaction.values[0];

  const guildData = await cacheManager.getGuildSettings(targetGuildId);
  if (!guildData?.settings?.modmail?.categoryId) {
    return ui.sendError(interaction, "err_sys_87", true);
  }

  const loadingPayload = buildLoadingContainerV2({
    title: "Membuka Tiket...",
    description: `${ui.getEmoji("loading") || "⏳"} Naura sedang mengetuk pintu server... Sabar ya! 🌸`,
    footerText: `Sedang menyiapkan untuk ${interaction.user.username}`,
  });

  await interaction.update(loadingPayload);

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
      draft
    );
    await redisManager.client.del(draftKey);
  } catch (error) {
    const errPayload = buildErrorContainerV2({
      title: "Gagal Membuka Tiket",
      description: "❌ Terjadi kesalahan saat memproses tiket modmail.",
      footerText: ui.getFooter("core"),
    });
    await interaction
      .editReply(errPayload)
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
