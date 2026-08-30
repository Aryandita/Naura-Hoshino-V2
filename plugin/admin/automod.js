const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("automod")
    .setDescription("Pengaturan Automod dan Poin Tata Krama (Manners Point).")
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand((sub) =>
      sub.setName("toggle").setDescription("Nyalakan/matikan Automod"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("role")
        .setDescription("Role hukuman ketika Poin Tata Krama habis")
        .addRoleOption((opt) =>
          opt
            .setName("target")
            .setDescription("Role yang diberikan ke pelanggar")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sub = interaction.options.getSubcommand();

    if (sub === "toggle") {
      let isEnabled = false;
      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          if (!settings.automod) {
            settings.automod = {
              enabled: true,
              antiInvite: false,
              antiCaps: false,
              massMention: 5,
              antiSpam: true,
              badWords: [],
            };
          }
          settings.automod.enabled = !settings.automod.enabled;
          isEnabled = settings.automod.enabled;
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Automod kini **${isEnabled ? "AKTIF" : "MATI"}**.`,
      );
    } else if (sub === "role") {
      const role = interaction.options.getRole("target");
      await guildSettingsService.updateGuildSetting(
        interaction.guild.id,
        (settings) => {
          if (!settings.automod) {
            settings.automod = {
              enabled: true,
              antiInvite: false,
              antiCaps: false,
              massMention: 5,
              antiSpam: true,
              badWords: [],
            };
          }
          settings.automod.punishRole = role.id;
        },
      );
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Role hukuman (Isolasi) diatur ke ${role}. User yang poin tata kramanya habis akan mendapatkan role ini.`,
      );
    }
  },
};
