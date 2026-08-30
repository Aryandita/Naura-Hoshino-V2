const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("autorole")
    .setDescription("Mengatur role otomatis saat member baru masuk.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Pasang auto role baru")
        .addRoleOption((opt) =>
          opt
            .setName("role")
            .setDescription("Role yang akan diberikan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("remove").setDescription("Matikan fitur auto role"),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === "set") {
      const role = interaction.options.getRole("role");

      if (
        role.position >= interaction.guild.members.me.roles.highest.position
      ) {
        return interaction.editReply(
          `${ui.getEmoji("error") || "❌"} **Akses Ditolak:** Aku tidak bisa memberikan role yang posisinya lebih tinggi dari role-ku. Pindahkan role Naura ke atas role tersebut.`,
        );
      }
      if (role.managed) {
        return interaction.editReply(
          `${ui.getEmoji("error") || "❌"} **Akses Ditolak:** Tidak bisa memberikan role integrasi/bot (Managed Role).`,
        );
      }

      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          settings.autoRole = role.id;
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Auto Role berhasil diatur ke ${role}!`,
      );
    } else {
      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          settings.autoRole = null;
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Fitur Auto Role telah dimatikan.`,
      );
    }
  },
};
