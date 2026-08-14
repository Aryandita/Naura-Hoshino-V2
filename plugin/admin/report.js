// plugin/admin/report.js
// Context Menu Command, Right Click pada pesan → Apps → "⚑ Report Pesan"
// Trigger AI Automod hanya saat ada laporan dari user (bukan per-pesan).

const {
  ContextMenuCommandBuilder,
  ApplicationCommandType,
  MessageFlags,
} = require("discord.js");
const {
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { handleAIReport } = require("../../src/utils/aiAutomodHelper");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");

module.exports = {
  data: new ContextMenuCommandBuilder()
    .setName("⚑ Report Pesan")
    .setType(ApplicationCommandType.Message),

  /**
   * Eksekusi context menu report.
   * @param {import('discord.js').MessageContextMenuCommandInteraction} interaction
   */
  async execute(interaction) {
    // Pastikan hanya berjalan di server (bukan DM)
    if (!interaction.guild) {
      return interaction.reply({
        ...buildErrorContainerV2({
          errorMessage: "Fitur report hanya tersedia di dalam server.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Ambil settings guild dari cache (Rule 1.9)
    const guildSettings = await cacheManager.getGuildSettings(
      interaction.guildId,
    );
    const aiAutomodSettings = guildSettings?.settings?.aiAutomod;

    // Cek apakah AI Automod aktif di guild ini
    if (!aiAutomodSettings?.enabled) {
      return interaction.reply({
        ...buildErrorContainerV2({
          errorMessage:
            "Fitur AI Report belum diaktifkan di server ini.\n\nAdmin dapat mengaktifkannya melalui `/setup` → panel **AI Automod**.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    // Delegasikan ke aiAutomodHelper
    try {
      await handleAIReport(interaction, guildSettings);
    } catch (error) {
      const { logger } = require("../../src/managers/logger");
      logger.error(
        "[Report Command] Error saat proses AI report:",
        error.message,
      );

      const errPayload = buildErrorContainerV2({
        errorMessage:
          "Terjadi kesalahan saat memproses laporan. Coba lagi nanti.",
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errPayload).catch(() => {});
      } else {
        await interaction
          .reply({ ...errPayload, flags: MessageFlags.Ephemeral })
          .catch(() => {});
      }
    }
  },
};
