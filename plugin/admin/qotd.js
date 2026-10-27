/**
 * ? QOTD Command - Question of the Day Manager - Naura Hoshino V2
 * ------------------------------------------------------------------
 * Manages automated daily questions sent to a designated channel.
 * Requires ManageGuild permission.
 *
 * Features:
 * - Setup: Enable QOTD with target channel and schedule time
 * - Add: Add questions to the question bank
 * - List: View all questions in the bank
 * - Disable: Turn off automatic QOTD posting
 *
 * @module plugin/admin/qotd
 */

"use strict";

// ============================================================================
// DEPENDENCIES
// ============================================================================
const {
  SlashCommandBuilder,
  PermissionsBitField,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const guildSettingsService = require("../../src/managers/guildSettingsService");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================
/** Regex pattern for HH:MM time format validation */
const TIME_FORMAT_REGEX = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/;
/** Default QOTD posting time */
const DEFAULT_QOTD_TIME = "08:00";
/** Maximum description length for Discord embeds */
const MAX_DESCRIPTION_LENGTH = 4000;

// ============================================================================
// HELPERS
// ============================================================================
/**
 * Creates default QOTD settings object.
 * @returns {Object} Default QOTD configuration
 */
function createDefaultQotdSettings() {
  return {
    enabled: false,
    channelId: null,
    questions: [],
    lastAsked: null,
    time: DEFAULT_QOTD_TIME,
  };
}

// ============================================================================
// COMMAND DEFINITION
// ============================================================================
module.exports = {
  data: new SlashCommandBuilder()
    .setName("qotd")
    .setDescription("? Atur Question of the Day (Pertanyaan Harian).")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("setup")
        .setDescription("Aktifkan QOTD dan pilih channel pengiriman.")
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Channel untuk mengirim QOTD")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("jam")
            .setDescription("Jam pengiriman (Format HH:MM, contoh 08:00)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Tambahkan daftar pertanyaan ke bank QOTD.")
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaannya")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat daftar pertanyaan di bank QOTD."),
    )
    .addSubcommand((sub) =>
      sub.setName("disable").setDescription("Matikan fitur QOTD otomatis."),
    ),

  // ========================================================================
  // EXECUTION
  // ========================================================================
  /**
   * Execute the QOTD command.
   * @param {import("discord.js").ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      if (subcommand === "setup") {
        const channel = interaction.options.getChannel("channel");
        const time = interaction.options.getString("jam") || DEFAULT_QOTD_TIME;

        if (!TIME_FORMAT_REGEX.test(time)) {
          const errPayload = buildErrorContainerV2({
            title: "Format Salah",
            description:
              "? Format jam tidak valid. Gunakan format `HH:MM` (contoh: 08:30).",
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(errPayload);
        }

        await guildSettingsService.updateGuildSetting(
          interaction.guild.id,
          (currentSettings) => {
            if (!currentSettings.qotd) {
              currentSettings.qotd = createDefaultQotdSettings();
            }
            currentSettings.qotd.enabled = true;
            currentSettings.qotd.channelId = channel.id;
            currentSettings.qotd.time = time;
          },
        );

        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          title: "QOTD Aktif",
          description: `? QOTD berhasil diaktifkan! Pertanyaan akan dikirim ke <#${channel.id}> setiap jam **${time}**.`,
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(successPayload);
      } else if (subcommand === "add") {
        const q = interaction.options.getString("pertanyaan");
        let totalCount = 0;

        await guildSettingsService.updateGuildSetting(
          interaction.guild.id,
          (currentSettings) => {
            if (!currentSettings.qotd) {
              currentSettings.qotd = createDefaultQotdSettings();
            }
            if (!Array.isArray(currentSettings.qotd.questions)) {
              currentSettings.qotd.questions = [];
            }
            currentSettings.qotd.questions.push(q);
            totalCount = currentSettings.qotd.questions.length;
          },
        );

        const successPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          title: "Pertanyaan Ditambahkan",
          description: `? Pertanyaan ditambahkan! Sekarang ada **${totalCount}** pertanyaan di bank QOTD.`,
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(successPayload);
      } else if (subcommand === "list") {
        const currentSettings =
          (await guildSettingsService.getGuildSetting(interaction.guild.id)) ||
          {};
        const qs = currentSettings.qotd?.questions;
        if (!qs || qs.length === 0) {
          const errPayload = buildErrorContainerV2({
            title: "Bank Kosong",
            description: "? Bank QOTD kosong.",
            footerText: ui.getFooter("core"),
          });
          return interaction.editReply(errPayload);
        }

        const listPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#2b2d31",
          title: `? Bank QOTD (${qs.length} Total)`,
          description: qs
            .map((q, i) => `**${i + 1}.** ${q}`)
            .join("\n")
            .substring(0, MAX_DESCRIPTION_LENGTH),
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(listPayload);
      } else if (subcommand === "disable") {
        await guildSettingsService.updateGuildSetting(
          interaction.guild.id,
          (currentSettings) => {
            if (!currentSettings.qotd) {
              currentSettings.qotd = createDefaultQotdSettings();
            }
            currentSettings.qotd.enabled = false;
          },
        );

        const disablePayload = buildContainerV2({
          accentColorHex: ui.getColor("secondary") || "#6b7280",
          title: "QOTD Dimatikan",
          description: "? QOTD otomatis telah dimatikan.",
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(disablePayload);
      }
    } catch (error) {
      logger.error("[QOTD Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal System",
        description: "? Terjadi kesalahan saat mengelola QOTD.",
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(errPayload);
    }
  },
};