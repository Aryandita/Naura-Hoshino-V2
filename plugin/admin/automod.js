const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const GuildSettings = require("../../src/models/GuildSettings");
const cacheManager = require("../../src/managers/cacheManager");
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
    const [settings] = await GuildSettings.findOrCreate({
      where: { guildId: interaction.guild.id },
    });

    const automod = settings.settings.automod || {
      enabled: true,
      antiInvite: false,
      antiCaps: false,
      massMention: 5,
      antiSpam: true,
      badWords: [],
    };

    if (sub === "toggle") {
      automod.enabled = !automod.enabled;
      settings.settings.automod = automod;
      settings.changed("settings", true);
      await settings.save();
      await cacheManager
        .invalidateGuildSettings(interaction.guild.id)
        .catch(() => {});
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Automod kini **${automod.enabled ? "AKTIF" : "MATI"}**.`,
      );
    } else if (sub === "role") {
      const role = interaction.options.getRole("target");
      automod.punishRole = role.id;
      settings.settings.automod = automod;
      settings.changed("settings", true);
      await settings.save();
      await cacheManager
        .invalidateGuildSettings(interaction.guild.id)
        .catch(() => {});
      return interaction.editReply(
        `${ui.getEmoji("success") || "✅"} Role hukuman (Isolasi) diatur ke ${role}. User yang poin tata kramanya habis akan mendapatkan role ini.`,
      );
    }
  },
};
