"use strict";

/**
 * 📋 Audit Command - Server Audit Logs - Naura Hoshino V2
 * --------------------------------------------------------
 * Retrieves and displays server audit logs for specific actions.
 * Supports multiple action types with export capability for large results.
 *
 * Features:
 * - 5 audit action types (Kick, Ban, Channel Delete, Role Delete, Message Delete)
 * - Configurable result limit (1-50 entries)
 * - Automatic text file export for >10 entries
 * - Permission validation (ViewAuditLog required)
 * - Formatted timestamp display
 * - Reason display when available
 *
 * Action Types:
 * - MemberKick      : Member di-kick dari server
 * - MemberBanAdd    : Member di-ban dari server
 * - ChannelDelete   : Channel dihapus
 * - RoleDelete      : Role dihapus
 * - MessageDelete   : Pesan dihapus oleh moderator
 *
 * @module plugin/admin/audit
 */

const {
  SlashCommandBuilder,
  PermissionsBitField,
  AuditLogEvent,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

// ============================================================================
// COMMAND DEFINITION
// ============================================================================

module.exports = {
  data: new SlashCommandBuilder()
    .setName("audit")
    .setDescription("📋 Cek catatan audit log terbaru untuk aksi tertentu.")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.ViewAuditLog)
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Aksi yang ingin dicek")
        .setRequired(true)
        .addChoices(
          { name: "Member Di-Kick", value: "MemberKick" },
          { name: "Member Di-Ban", value: "MemberBanAdd" },
          { name: "Channel Dihapus", value: "ChannelDelete" },
          { name: "Role Dihapus", value: "RoleDelete" },
          { name: "Pesan Dihapus (Oleh Mod)", value: "MessageDelete" },
        ),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("limit")
        .setDescription("Jumlah log untuk diambil (Max 50)")
        .setMinValue(1)
        .setMaxValue(50),
    ),

  // ============================================================================
  // COMMAND EXECUTION
  // ============================================================================

  /**
   * Execute audit command.
   * Fetches and displays audit logs for specified action type.
   * @param {object} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    // Validate permissions
    if (
      !interaction.member.permissions.has(
        PermissionsBitField.Flags.ViewAuditLog,
      )
    ) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${ui.getEmoji("error") || "❌"} Kamu tidak memiliki izin View Audit Log.`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errPayload,
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    // Extract options
    const aksi = interaction.options.getString("aksi");
    const limitCount = interaction.options.getInteger("limit") || 5;
    const auditEvent = AuditLogEvent[aksi];

    try {
      // Fetch audit logs
      const auditLogs = await interaction.guild.fetchAuditLogs({
        limit: limitCount,
        type: auditEvent,
      });

      const entries = auditLogs.entries;

      // Handle empty results
      if (entries.size === 0) {
        const emptyPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#2b2d31",
          title: `${ui.getEmoji("clipboard") || "📋"} Audit Log: ${aksi}`,
          description: `${ui.getEmoji("success") || "✅"} Tidak ada catatan terbaru untuk aksi **${aksi}** di server ini.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(emptyPayload);
      }

      // Format audit log entries
      const descriptionText = entries
        .map((entry) => {
          const executor = entry.executor
            ? `<@${entry.executor.id}>`
            : "Tidak diketahui";
          const target = entry.target
            ? entry.target.username || entry.target.name || entry.target.id
            : "Tidak diketahui";
          const time = `<t:${Math.floor(entry.createdTimestamp / 1000)}:R>`;
          const reason = entry.reason ? `\n> Alasan: ${entry.reason}` : "";

          return `**Pelaku:** ${executor} | **Target:** \`${target}\` | ${time}${reason}`;
        })
        .join("\n\n");

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#2b2d31",
        title: `${ui.getEmoji("clipboard") || "📋"} Audit Log: ${aksi}`,
        description: descriptionText,
        footerText: ui.getFooter("core"),
      });

      // Export to file if more than 10 entries
      if (entries.size > 10) {
        let logText = `=== AUDIT LOG EXPORT: ${aksi} ===\n\n`;
        entries.forEach((entry) => {
          const { executor, target, createdAt } = entry;
          logText += `[${createdAt.toUTCString()}] Executor: ${executor?.tag || "Unknown"} (${executor?.id || "N/A"})\n`;
          logText += `Target: ${target ? target.tag || target.name || target.id : "Unknown"}\n`;
          logText += `Reason: ${entry.reason || "No reason provided"}\n----------------------\n`;
        });

        const fileName = `audit_export_${interaction.guild.id}_${Date.now()}.txt`;
        const file = new AttachmentBuilder(Buffer.from(logText, "utf-8"), {
          name: fileName,
        });
        await interaction.editReply({ ...payload, files: [file] });
      } else {
        await interaction.editReply(payload);
      }
    } catch (error) {
      logger.error("[Audit Log Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Audit Log",
        description: `${ui.getEmoji("error") || "❌"} Gagal mengambil Audit Log. Pastikan bot memiliki izin View Audit Log.`,
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
