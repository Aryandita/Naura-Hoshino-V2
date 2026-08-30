const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sticky")
    .setDescription("Mengatur pesan lengket (sticky message) di channel ini.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Pasang sticky message baru")
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Isi pesan sticky")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Hapus sticky message dari server ini"),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const msg = interaction.options.getString("pesan");
      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          settings.stickyMessage = {
            channelId: interaction.channel.id,
            message: msg,
            lastId: null,
          };
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Sticky message berhasil dipasang di channel ini!`,
      );
    } else {
      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          settings.stickyMessage = {
            channelId: null,
            message: null,
            lastId: null,
          };
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Sticky message berhasil dihapus.`,
      );
    }
  },
};
