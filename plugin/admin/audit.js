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
const fs = require("fs");

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

  async execute(interaction) {
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
    const aksi = interaction.options.getString("aksi");
    const limitCount = interaction.options.getInteger("limit") || 5;
    const auditEvent = AuditLogEvent[aksi];

    try {
      const auditLogs = await interaction.guild.fetchAuditLogs({
        limit: limitCount,
        type: auditEvent,
      });

      const entries = auditLogs.entries;

      if (entries.size === 0) {
        const emptyPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#2b2d31",
          title: `${ui.getEmoji("clipboard") || "📋"} Audit Log: ${aksi}`,
          description: `${ui.getEmoji("success") || "✅"} Tidak ada catatan terbaru untuk aksi **${aksi}** di server ini.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(emptyPayload);
      }

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

      if (entries.size > 10) {
        let logText = `=== AUDIT LOG EXPORT: ${aksi} ===\n\n`;
        entries.forEach((entry) => {
          const { executor, target, createdAt } = entry;
          logText += `[${createdAt.toUTCString()}] Executor: ${executor?.tag || "Unknown"} (${executor?.id || "N/A"})\n`;
          logText += `Target: ${target ? target.tag || target.name || target.id : "Unknown"}\n`;
          logText += `Reason: ${entry.reason || "No reason provided"}\n----------------------\n`;
        });

        const fileName = `audit_export_${interaction.guild.id}_${Date.now()}.txt`;
        fs.writeFileSync(fileName, logText);

        const file = new AttachmentBuilder(fileName);
        await interaction.editReply({ ...payload, files: [file] });

        setTimeout(() => {
          if (fs.existsSync(fileName)) fs.unlinkSync(fileName);
        }, 5000);
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
