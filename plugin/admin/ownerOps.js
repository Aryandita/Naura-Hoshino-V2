"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const env = require("../../src/config/env");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const incidentService = require("../../src/services/incidentService");
const accessKeyService = require("../../src/services/accessKeyService");

function isOwner(userId) {
  return Array.isArray(env.OWNER_IDS) && env.OWNER_IDS.includes(userId);
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("owner")
    .setDescription("🔒 Operasi darurat & panel manajemen teknis (Khusus DM Owner)")
    .addSubcommand((sub) =>
      sub
        .setName("maintenance")
        .setDescription("Aktifkan atau nonaktifkan pemeliharaan darurat global bot")
        .addStringOption((opt) =>
          opt
            .setName("mode")
            .setDescription("Status pemeliharaan")
            .setRequired(true)
            .addChoices(
              { name: "Aktifkan Pemeliharaan (ON)", value: "on" },
              { name: "Nonaktifkan Pemeliharaan (OFF)", value: "off" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Pesan alasan pemeliharaan untuk pengguna")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("killswitch")
        .setDescription("Matikan atau hidupkan modul perintah spesifik tanpa mematikan bot")
        .addStringOption((opt) =>
          opt
            .setName("modul")
            .setDescription("Nama modul / slash command (misal: music, auction, farm)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("status")
            .setDescription("Matikan atau Aktifkan?")
            .setRequired(true)
            .addChoices(
              { name: "Matikan Modul (DISABLED)", value: "matikan" },
              { name: "Aktifkan Kembali (ACTIVE)", value: "aktifkan" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("doctor")
        .setDescription("Jalankan diagnostik mandiri kesehatan 6 pilar infrastruktur"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("logs")
        .setDescription("Tinjau log error terbaru langsung di DM Discord")
        .addIntegerOption((opt) =>
          opt
            .setName("limit")
            .setDescription("Jumlah baris log terbaru (5-40)")
            .setRequired(false)
            .setMinValue(5)
            .setMaxValue(40),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keygen")
        .setDescription("Terbitkan Kunci Akses (Dev Key) baru untuk Code Runner")
        .addUserOption((opt) =>
          opt
            .setName("target_user")
            .setDescription("Kunci khusus untuk user tertentu (opsional)")
            .setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("max_uses")
            .setDescription("Batas kuota eksekusi (default: 10 kali)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(100),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("durasi_jam")
            .setDescription("Masa aktif kunci dalam hitungan jam (default: 24 jam)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(720),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keylist")
        .setDescription("Lihat daftar kunci akses dev yang aktif saat ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("keyrevoke")
        .setDescription("Cabut kunci akses dev tertentu seketika")
        .addStringOption((opt) =>
          opt
            .setName("key")
            .setDescription("Kode kunci yang ingin dicabut (contoh: NAURA-DEV-XXXX-XXXX)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("repair")
        .setDescription("Pulihkan status pemain yang mengalami freeze / lock deadlock")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Pemain yang hendak dipulihkan")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    // KEAMANAN & PRIVASI KETAT: Dilarang keras dieksekusi di server guild manapun
    if (interaction.guildId || !isOwner(interaction.user.id)) {
      return interaction.reply({
        content: "⛔ Perintah ini sangat rahasia dan hanya dapat diakses melalui Direct Message (DM) bersama Owner bot.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const sub = interaction.options.getSubcommand();
    const callerTag = interaction.user.globalName || interaction.user.username;

    // 1. MAINTENANCE
    if (sub === "maintenance") {
      const mode = interaction.options.getString("mode");
      const reason =
        interaction.options.getString("alasan") || "Pemeliharaan rutin terjadwal";
      const isActivating = mode === "on";

      await incidentService.setGlobalMaintenance(isActivating, reason, callerTag);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: isActivating ? "#EF4444" : "#10B981",
          authorName: "Naura Incident Response Desk",
          title: isActivating
            ? "🚨 Mode Pemeliharaan Global DIAKTIFKAN"
            : "✅ Mode Pemeliharaan Global DINONAKTIFKAN",
          description: [
            isActivating
              ? "Seluruh interaksi slash command dan tombol pengguna biasa kini ditahan sementara."
              : "Seluruh interaksi pengguna telah kembali berjalan normal.",
            "",
            `📌 **Alasan:** *"${reason}"*`,
            `👤 **Diatur Oleh:** **${callerTag}**`,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            "",
            "-# *Catatan: Akun Owner tetap memiliki bypass penuh untuk menjalankan perintah saat maintenance.*",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // 2. KILL-SWITCH
    if (sub === "killswitch") {
      const modul = interaction.options.getString("modul");
      const status = interaction.options.getString("status");
      const isKilling = status === "matikan";

      await incidentService.setModuleKillSwitch(modul, isKilling, callerTag);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: isKilling ? "#F59E0B" : "#10B981",
          authorName: "Naura Module Emergency Guard",
          title: isKilling
            ? `🛑 Modul "${modul}" Dinonaktifkan`
            : `🟢 Modul "${modul}" Diaktifkan Kembali`,
          description: [
            isKilling
              ? `Perintah **/${modul}** kini diblokir sementara untuk pengguna umum.`
              : `Perintah **/${modul}** kini dapat digunakan kembali seperti biasa.`,
            "",
            `👤 **Diatur Oleh:** **${callerTag}**`,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // 3. DOCTOR DIAGNOSTIC
    if (sub === "doctor") {
      await interaction.deferReply();
      const report = await incidentService.runDoctorDiagnostic(interaction.client);

      const statusIcons = {
        UP: "🟢",
        DEGRADED: "🟡",
        DOWN: "🔴",
      };

      const pillarLines = [
        `${statusIcons[report.pillars.relationalDb?.status] || "⚪"} **PostgreSQL / Supabase:** ${report.pillars.relationalDb?.status} (${report.pillars.relationalDb?.latencyMs ?? 0}ms)`,
        `${statusIcons[report.pillars.mongoDb?.status] || "⚪"} **MongoDB Atlas:** ${report.pillars.mongoDb?.status} ${report.pillars.mongoDb?.latencyMs ? `(${report.pillars.mongoDb.latencyMs}ms)` : `(${report.pillars.mongoDb?.note || ""})`}`,
        `${statusIcons[report.pillars.redis?.status] || "⚪"} **Redis Cache & Lock:** ${report.pillars.redis?.status} ${report.pillars.redis?.latencyMs ? `(${report.pillars.redis.latencyMs}ms)` : `(${report.pillars.redis?.note || ""})`}`,
        `${statusIcons[report.pillars.audio?.status] || "⚪"} **Lavalink Audio:** ${report.pillars.audio?.status}`,
        `${statusIcons[report.pillars.canvas?.status] || "⚪"} **Canvas Worker Pool:** ${report.pillars.canvas?.status}`,
        report.pillars.gateway
          ? `🟢 **Discord Gateway:** Ping ${report.pillars.gateway.pingMs}ms (Uptime: ${Math.floor(report.pillars.gateway.uptimeSeconds / 60)}m)`
          : "",
      ].filter(Boolean);

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("incident_flush_cache")
          .setLabel("Flush Cache")
          .setEmoji("🧹")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("incident_release_locks")
          .setLabel("Lepas Deadlock")
          .setEmoji("🔓")
          .setStyle(ButtonStyle.Primary),
      );

      return interaction.editReply({
        ...buildContainerV2({
          accentColorHex:
            report.overallStatus === "ALL_SYSTEMS_OPERATIONAL"
              ? "#10B981"
              : report.overallStatus === "DEGRADED_PERFORMANCE"
                ? "#F59E0B"
                : "#EF4444",
          authorName: "Naura Doctor Diagnostic Engine",
          title: `🩺 Diagnostik Kesehatan: ${report.overallStatus}`,
          description: [
            "Hasil pemindaian kesehatan instan 6 pilar ekosistem Naura Hoshino:",
            "",
            ...pillarLines,
            "",
            `⏱️ **Waktu Diagnostik:** \`${report.totalDurationMs}ms\``,
            "",
            "-# Gunakan tombol di bawah jika ada cache atau deadlock transaksi yang perlu dibersihkan.",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
        components: [actionRow],
      });
    }

    // 4. LOGS
    if (sub === "logs") {
      const limit = interaction.options.getInteger("limit") || 15;
      const lines = incidentService.getRecentLogs(limit);

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#3B82F6",
          authorName: "Naura Runtime Logs",
          title: `📜 ${limit} Log Error Terkini`,
          description: [
            "Berikut kutipan log error terbaru dari sistem:",
            "```text",
            lines.join("\n").substring(0, 3500),
            "```",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // 5. KEYGEN
    if (sub === "keygen") {
      const targetUser = interaction.options.getUser("target_user");
      const maxUses = interaction.options.getInteger("max_uses") || 10;
      const durationHours = interaction.options.getInteger("durasi_jam") || 24;

      const key = await accessKeyService.createKey({
        createdBy: callerTag,
        assignedToUserId: targetUser?.id || null,
        maxUses,
        durationHours,
      });

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#8B5CF6",
          authorName: "Naura Access Key Generator",
          title: "🔑 Kunci Akses Dev Berhasil Diterbitkan!",
          description: [
            "Kunci akses berikut dapat diberikan kepada pengguna untuk menjalankan kode via `/run`:",
            "",
            `🔐 **Kunci Lisensi:**`,
            `\`\`\`text`,
            key.keyString,
            `\`\`\``,
            `👤 **Target User:** ${targetUser ? `<@${targetUser.id}> (${targetUser.tag})` : "Siapa Saja (Publik)"}`,
            `📊 **Batas Pemakaian:** \`${maxUses} kali eksekusi\``,
            `⏳ **Kedaluwarsa:** ${key.expiresAt ? `<t:${Math.floor(new Date(key.expiresAt).getTime() / 1000)}:R>` : "Permanen"}`,
            "",
            "-# *Pengguna dapat menjalankan kodingan dengan perintah:*",
            `- # \`/run code:<kode> key:${key.keyString}\``,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // 6. KEYLIST
    if (sub === "keylist") {
      const keys = await accessKeyService.listKeys(15);

      if (keys.length === 0) {
        return interaction.reply({
          content: "Belum ada kunci akses dev yang diterbitkan.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const keyItems = keys.map(
        (k) =>
          `• \`${k.keyString}\` | Kuota: \`${k.usedCount}/${k.maxUses}\` | Status: ${k.isActive ? "🟢 Aktif" : "🔴 Nonaktif"} ${k.assignedToUserId ? `(Khusus: <@${k.assignedToUserId}>)` : ""}`,
      );

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#8B5CF6",
          authorName: "Naura Access Key Desk",
          title: "📋 Daftar Kunci Akses Dev",
          description: [
            "Berikut daftar 15 kunci akses dev terbaru:",
            "",
            ...keyItems,
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }

    // 7. KEYREVOKE
    if (sub === "keyrevoke") {
      const keyString = interaction.options.getString("key");
      const revoked = await accessKeyService.revokeKey(keyString);

      if (!revoked) {
        return interaction.reply({
          content: `⚠️ Kunci akses \`${keyString}\` tidak ditemukan.`,
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        content: `✅ Kunci akses **\`${keyString}\`** telah berhasil dicabut dan tidak dapat digunakan lagi.`,
      });
    }

    // 8. REPAIR
    if (sub === "repair") {
      const targetUser = interaction.options.getUser("user");
      const repairRes = await incidentService.repairPlayerState(
        targetUser.id,
        callerTag,
      );

      return interaction.reply({
        ...buildContainerV2({
          accentColorHex: "#10B981",
          authorName: "Naura Player State Doctor",
          title: `🩹 Pemulihan Akun: ${targetUser.username}`,
          description: [
            `Proses perbaikan data dan pelepasan deadlock selesai dilakukan:`,
            "",
            `👤 **Pemain:** <@${targetUser.id}> (\`${targetUser.id}\`)`,
            `🔓 **Kunci Transaksi Dilepas:** \`${repairRes.locksReleased} lock\``,
            `🕒 **Waktu:** <t:${Math.floor(Date.now() / 1000)}:T>`,
            "",
            "-# *Pemain kini dapat kembali berinteraksi tanpa terhalang status freeze atau in-action.*",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        }),
      });
    }
  },
};
