const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("whois")
    .setDescription("🔍 Lihat informasi detail tentang seseorang.")
    .addSubcommand((sub) =>
      sub
        .setName("info")
        .setDescription("Lihat profil lengkap user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("avatar")
        .setDescription("Ambil foto profil user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("server_avatar")
            .setDescription("Gunakan foto profil server? (Jika ada)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("banner")
        .setDescription("Ambil banner profil user.")
        .addUserOption((opt) =>
          opt.setName("user").setDescription("Pilih user").setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user") || interaction.user;
    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (subcommand === "info") {
      let rolesStr = "Tidak ada role";
      let joinedStr = "Tidak diketahui";
      let boosterStr = "Tidak";

      if (member) {
        rolesStr =
          member.roles.cache
            .filter((r) => r.id !== interaction.guild.id)
            .sort((a, b) => b.position - a.position)
            .map((r) => r.toString())
            .join(", ") || "Tidak ada role";
        joinedStr = `<t:${Math.floor(member.joinedTimestamp / 1000)}:R>`;
        boosterStr = member.premiumSince
          ? `Ya, sejak <t:${Math.floor(member.premiumSinceTimestamp / 1000)}:R>`
          : "Tidak";
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: `Informasi Profil: ${user.tag}`,
        iconURL: user.displayAvatarURL(),
        description: `**ID:** \`${user.id}\`\n**Bot:** ${user.bot ? "Ya" : "Tidak"}\n**Akun Dibuat:** <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n**Join Server:** ${joinedStr}\n**Booster:** ${boosterStr}\n\n**Roles:** ${rolesStr}`,
        footerText: `Diminta oleh ${interaction.user.username}`,
      });

      await interaction.reply(payload);
    } else if (subcommand === "avatar") {
      const useServerAvatar = interaction.options.getBoolean("server_avatar");
      const avatarUrl =
        useServerAvatar && member && member.avatar
          ? member.displayAvatarURL({
              size: 1024,
              extension: "png",
              forceStatic: false,
            })
          : user.displayAvatarURL({
              size: 1024,
              extension: "png",
              forceStatic: false,
            });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `🖼️ Avatar dari ${user.username}`,
        description: `[Buka di Browser](${avatarUrl})`,
        footerText: `Diminta oleh ${interaction.user.username}`,
      });

      await interaction.reply(payload);
    } else if (subcommand === "banner") {
      const fetchedUser = await interaction.client.users.fetch(user.id, {
        force: true,
      });

      if (!fetchedUser.banner) {
        return interaction.reply({
          content: `${ui.getEmoji("cross") || "❌"} **${user.username}** tidak memiliki banner profil.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      const bannerUrl = fetchedUser.bannerURL({
        size: 1024,
        extension: "png",
        forceStatic: false,
      });

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `🖼️ Banner dari ${user.username}`,
        description: `[Buka di Browser](${bannerUrl})`,
        footerText: `Diminta oleh ${interaction.user.username}`,
      });

      await interaction.reply(payload);
    }
  },
};
