const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voicemod")
    .setDescription("🎙️ Alat moderasi khusus untuk Voice Channel.")
    .setDefaultMemberPermissions(
      PermissionsBitField.Flags.MuteMembers |
        PermissionsBitField.Flags.MoveMembers,
    )
    .addSubcommand((sub) =>
      sub
        .setName("mute")
        .setDescription("Mute (Server Mute) user di Voice Channel.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User yang akan di-mute")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("alasan").setDescription("Alasan").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("unmute")
        .setDescription("Lepas mute user di Voice Channel.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User yang akan di-unmute")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("kick")
        .setDescription("Tendang (Disconnect) user dari Voice Channel.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("User yang akan ditendang")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("alasan").setDescription("Alasan").setRequired(false),
        ),
    )
    .addSubcommand(
      (sub) =>
        sub
          .setName("move")
          .setDescription("Pindahkan user ke Voice Channel lain.")
          .addUserOption((opt) =>
            opt
              .setName("user")
              .setDescription("User yang akan dipindahkan")
              .setRequired(true),
          )
          .addChannelOption((opt) =>
            opt
              .setName("channel")
              .setDescription("Voice Channel tujuan")
              .setRequired(true)
              .addChannelTypes(2),
          ), // 2 is GuildVoice
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("alasan") || "Tidak ada alasan";

    const member = await interaction.guild.members
      .fetch(user.id)
      .catch(() => null);

    if (!member) {
      const errPayload = buildErrorContainerV2({
        title: "User Tidak Ditemukan",
        description: "User tidak ditemukan di server.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    if (!member.voice.channel) {
      const errPayload = buildErrorContainerV2({
        title: "Bukan di Voice Channel",
        description: `**${user.username}** sedang tidak berada di Voice Channel mana pun.`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      let actionTitle = "";
      let actionDesc = "";

      if (subcommand === "mute") {
        await member.voice.setMute(true, reason);
        actionTitle = "Server Mute Berhasil";
        actionDesc = `Berhasil melakukan Server Mute pada **${user.username}**.\n> **Alasan:** ${reason}`;
      } else if (subcommand === "unmute") {
        await member.voice.setMute(false, "Di-unmute oleh moderator");
        actionTitle = "Server Unmute Berhasil";
        actionDesc = `Berhasil melepas Server Mute pada **${user.username}**.`;
      } else if (subcommand === "kick") {
        await member.voice.disconnect(reason);
        actionTitle = "Disconnect Voice Berhasil";
        actionDesc = `Berhasil menendang **${user.username}** dari Voice Channel.\n> **Alasan:** ${reason}`;
      } else if (subcommand === "move") {
        const targetChannel = interaction.options.getChannel("channel");
        await member.voice.setChannel(
          targetChannel,
          "Dipindahkan oleh moderator",
        );
        actionTitle = "Pindah Voice Berhasil";
        actionDesc = `Berhasil memindahkan **${user.username}** ke channel **${targetChannel.name}**.`;
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "Naura Voice Moderation",
        title: `${ui.getEmoji("success") || "✅"} ${actionTitle}`,
        description: actionDesc,
        footerText: ui.getFooter("core"),
      });

      await interaction.reply(payload);
    } catch (error) {
      logger.error("[VoiceMod Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Moderasi Voice",
        description:
          "Gagal melakukan aksi moderasi voice. Pastikan posisiku lebih tinggi dari user tersebut dan aku memiliki izin yang cukup.",
        footerText: ui.getFooter("core"),
      });
      await interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
