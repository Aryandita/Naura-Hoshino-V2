"use strict";

/**
 * @module VoiceModCommand
 * @description Alat moderasi khusus untuk Voice Channel.
 * 
 * Fitur Utama:
 * - Server Mute: Bisukan user di voice channel (tidak bisa bicara)
 * - Server Unmute: Lepas mute dari user
 * - Voice Kick: Disconnect paksa user dari voice channel
 * - Voice Move: Pindahkan user ke voice channel lain
 * 
 * Permission: MuteMembers | MoveMembers
 * Subcommand: true (bagian dari /admin command group)
 * 
 * Catatan Penting:
 * - Bot harus memiliki role lebih tinggi dari target user
 * - Target user harus sedang berada di voice channel
 * - Semua aksi dicatat dengan alasan untuk audit trail
 */

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

// ============================================================================
// SECTION 1: KONSTANTA
// ============================================================================

/** @constant {number} GUILD_VOICE_CHANNEL_TYPE - Tipe channel GuildVoice untuk filter option */
const GUILD_VOICE_CHANNEL_TYPE = 2;

/** @constant {string} DEFAULT_REASON - Alasan default jika moderator tidak mengisi */
const DEFAULT_REASON = "Tidak ada alasan";

/** @constant {string} UNMUTE_REASON - Alasan standar untuk operasi unmute */
const UNMUTE_REASON = "Di-unmute oleh moderator";

/** @constant {string} MOVE_REASON - Alasan standar untuk operasi move */
const MOVE_REASON = "Dipindahkan oleh moderator";

// ============================================================================
// SECTION 2: SLASH COMMAND DEFINITION
// ============================================================================

module.exports = {
  isSubcommand: true,
  data: new SlashCommandBuilder()
    .setName("voicemod")
    .setDescription("\ud83c\udf99\ufe0f Alat moderasi khusus untuk Voice Channel.")
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
              .addChannelTypes(GUILD_VOICE_CHANNEL_TYPE),
          ),
    ),

  /**
   * Main executor untuk command /admin voicemod
   * Router ke handler berdasarkan subcommand (mute/unmute/kick/move).
   * 
   * @param {import("discord.js").ChatInputCommandInteraction} interaction - Discord interaction object
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.options.getUser("user");
    const reason =
      interaction.options.getString("alasan") || DEFAULT_REASON;

    // Fetch member dari guild, return error jika tidak ditemukan
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

    // Validasi: user harus berada di voice channel
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

      // Router ke aksi yang sesuai berdasarkan subcommand
      if (subcommand === "mute") {
        await member.voice.setMute(true, reason);
        actionTitle = "Server Mute Berhasil";
        actionDesc = `Berhasil melakukan Server Mute pada **${user.username}**.\n> **Alasan:** ${reason}`;
      } else if (subcommand === "unmute") {
        await member.voice.setMute(false, UNMUTE_REASON);
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
          MOVE_REASON,
        );
        actionTitle = "Pindah Voice Berhasil";
        actionDesc = `Berhasil memindahkan **${user.username}** ke channel **${targetChannel.name}**.`;
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#10B981",
        authorName: "Naura Voice Moderation",
        title: `${ui.getEmoji("success") || "\u2705"} ${actionTitle}`,
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