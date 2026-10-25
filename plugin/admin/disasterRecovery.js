"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionsBitField,
  MessageFlags,
  ComponentType,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const mongoManager = require("../../src/managers/mongoManager");
const cacheManager = require("../../src/managers/cacheManager");
const { updateGuildSetting } = require("../../src/managers/guildSettingsService");

let DisasterSnapshot = null;
try {
  DisasterSnapshot = require("../../src/models/mongo/DisasterSnapshot");
} catch (_) {
  // Model belum ada, akan dibuat nanti
}

const DEFAULT_RETENTION_DAYS = 30;
const MIN_RETENTION_DAYS = 1;
const MAX_RETENTION_DAYS = 365;

async function getGuildRetention(guildId) {
  try {
    const settings = await cacheManager.getGuildSettings(guildId);
    return settings?.settings?.recoveryRetentionDays || DEFAULT_RETENTION_DAYS;
  } catch (_) {
    return DEFAULT_RETENTION_DAYS;
  }
}

async function setGuildRetention(guildId, days) {
  try {
    await updateGuildSetting(guildId, (s) => {
      s.recoveryRetentionDays = days;
    });
    return true;
  } catch (err) {
    logger.error("[DisasterRecovery] Gagal simpan retensi:", err);
    return false;
  }
}

async function saveSnapshot(guildId, type, data, createdBy) {
  if (!mongoManager?.isReady || !DisasterSnapshot) {
    logger.warn("[DisasterRecovery] MongoDB offline atau model belum tersedia. Snapshot tidak disimpan.");
    return null;
  }

  const retentionDays = await getGuildRetention(guildId);

  try {
    const doc = await DisasterSnapshot.create({
      guildId,
      type,
      data,
      createdBy,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + retentionDays * 24 * 60 * 60 * 1000),
    });
    return doc;
  } catch (err) {
    logger.error("[DisasterRecovery] Gagal simpan snapshot:", err);
    return null;
  }
}

async function getSnapshots(guildId, type, limit = 5) {
  if (!mongoManager?.isReady || !DisasterSnapshot) {
    return [];
  }

  try {
    return await DisasterSnapshot.find({ guildId, type })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  } catch (err) {
    logger.error("[DisasterRecovery] Gagal ambil snapshot:", err);
    return [];
  }
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("recovery")
    .setDescription("Alat pemulihan darurat server dari bencana (ban massal, nuke, dll)")
    .setDefaultMemberPermissions(PermissionsBitField.Flags.Administrator)
    .addSubcommand((sub) =>
      sub
        .setName("unban-all")
        .setDescription("Buka blokir massal semua user yang sedang di-ban di server ini")
        .addStringOption((opt) =>
          opt
            .setName("alasan")
            .setDescription("Alasan unban massal")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("snapshot-roles")
        .setDescription("Backup role assignments seluruh member untuk pemulihan nanti"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("restore-roles")
        .setDescription("Pulihkan role assignments dari snapshot terakhir")
        .addStringOption((opt) =>
          opt
            .setName("snapshot_id")
            .setDescription("ID snapshot spesifik (kosongkan untuk snapshot terbaru)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list-snapshots")
        .setDescription("Lihat daftar snapshot recovery yang tersimpan"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("config")
        .setDescription("Konfigurasi retensi snapshot dan pengaturan recovery")
        .addIntegerOption((opt) =>
          opt
            .setName("retention_days")
            .setDescription("Berapa hari snapshot disimpan sebelum kedaluwarsa (1-365)")
            .setMinValue(MIN_RETENTION_DAYS)
            .setMaxValue(MAX_RETENTION_DAYS)
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    if (
      !interaction.member.permissions.has(PermissionsBitField.Flags.Administrator) &&
      !interaction.member.permissions.has(PermissionsBitField.Flags.ManageGuild)
    ) {
      const errPayload = buildErrorContainerV2({
        title: "Akses Ditolak",
        description: `${ui.getEmoji("error") || "❌"} Anda memerlukan izin **Administrator** atau **Manage Server** untuk menggunakan perintah pemulihan.`,
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
    }

    const sub = interaction.options.getSubcommand();

    if (sub === "unban-all") {
      await handleUnbanAll(interaction);
    } else if (sub === "snapshot-roles") {
      await handleSnapshotRoles(interaction);
    } else if (sub === "restore-roles") {
      await handleRestoreRoles(interaction);
    } else if (sub === "list-snapshots") {
      await handleListSnapshots(interaction);
    } else if (sub === "config") {
      await handleConfig(interaction);
    }
  },
};

async function handleUnbanAll(interaction) {
  const reason = interaction.options.getString("alasan") || "Pemulihan darurat server";

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const bans = await interaction.guild.bans.fetch();
    
    if (bans.size === 0) {
      const emptyPayload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3B82F6",
        title: "ℹ️ Tidak Ada Ban Aktif",
        expression: "info",
        description: "Server ini tidak memiliki pengguna yang sedang diblokir.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(emptyPayload);
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_unban_all")
        .setLabel(`Ya, Unban ${bans.size} User`)
        .setStyle(ButtonStyle.Danger)
        .setEmoji("🔓"),
      new ButtonBuilder()
        .setCustomId("cancel_unban_all")
        .setLabel("Batalkan")
        .setStyle(ButtonStyle.Secondary),
    );

    const confirmPayload = buildContainerV2({
      accentColorHex: "#F97316",
      title: "⚠️ Konfirmasi Unban Massal",
      expression: "warning",
      description: [
        `Anda akan membuka blokir **${bans.size} pengguna** secara massal.`,
        "",
        "📋 **Daftar User yang Akan Di-unban:**",
        ...Array.from(bans.values()).slice(0, 10).map((ban) => 
          `- \`${ban.user.id}\` (${ban.user.tag || ban.user.username})`
        ),
        bans.size > 10 ? `- ... dan ${bans.size - 10} lainnya` : null,
        "",
        "⚠️ Tindakan ini tidak dapat dibatalkan. Pastikan ini memang diperlukan.",
      ].filter(Boolean).join("\n"),
      buttonsRow: confirmRow,
      footerText: ui.getFooter("core"),
    });

    const reply = await interaction.editReply({
      ...confirmPayload,
      components: confirmPayload.components,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.customId === "cancel_unban_all") {
        const cancelPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Unban Massal Dibatalkan",
          expression: "neutral",
          description: "Operasi unban massal telah dibatalkan oleh Anda.",
          footerText: ui.getFooter("core"),
        });
        return i.update(cancelPayload);
      }

      await i.deferUpdate();

      let successCount = 0;
      let failCount = 0;
      const failedUsers = [];

      for (const [userId, ban] of bans) {
        try {
          await interaction.guild.members.unban(
            userId,
            `${reason} (Oleh: ${interaction.user.tag})`
          );
          successCount++;
        } catch (err) {
          failCount++;
          failedUsers.push(`${ban.user.tag || userId}: ${err.message}`);
          logger.debug(`[DisasterRecovery] Unban gagal untuk ${userId}: ${err.message}`);
        }
      }

      const resultPayload = buildContainerV2({
        accentColorHex: successCount > 0 ? (ui.getColor("success") || "#22c55e") : "#F59E0B",
        title: successCount > 0 ? "✅ Unban Massal Selesai" : "⚠️ Unban Massal Selesai dengan Error",
        expression: successCount > 0 ? "success" : "warning",
        description: [
          `Proses unban massal telah selesai.`,
          "",
          `🔓 **Berhasil Di-unban:** ${successCount} user`,
          `❌ **Gagal:** ${failCount} user`,
          failCount > 0 ? "" : null,
          failCount > 0 ? "**Detail Kegagalan:**" : null,
          ...failedUsers.slice(0, 5).map((f) => `- ${f}`),
          failCount > 5 ? `- ... dan ${failCount - 5} lainnya` : null,
          "",
          `🛡️ **Dieksekusi Oleh:** <@${interaction.user.id}>`,
          `📝 **Alasan:** ${reason}`,
          `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].filter(Boolean).join("\n"),
        footerText: ui.getFooter("core"),
      });

      await i.editReply(resultPayload);
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        const timeoutPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Waktu Konfirmasi Habis",
          expression: "neutral",
          description: "Operasi unban massal dibatalkan otomatis karena tidak ada konfirmasi dalam 60 detik.",
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(timeoutPayload).catch(() => {});
      }
    });
  } catch (err) {
    logger.error("[DisasterRecovery] Unban-all error:", err);
    const errPayload = buildErrorContainerV2({
      title: "Gagal Melakukan Unban Massal",
      description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(errPayload);
  }
}

async function handleSnapshotRoles(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const members = await interaction.guild.members.fetch();
    const roleData = [];

    for (const [memberId, member] of members) {
      if (member.user.bot) continue;

      const roles = member.roles.cache
        .filter((r) => r.id !== interaction.guild.id)
        .map((r) => r.id);

      if (roles.length > 0) {
        roleData.push({
          userId: memberId,
          roles,
          nickname: member.nickname || null,
        });
      }
    }

    const snapshot = await saveSnapshot(
      interaction.guild.id,
      "role_assignment",
      { memberCount: roleData.length, assignments: roleData },
      interaction.user.tag
    );

    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "✅ Snapshot Role Berhasil Dibuat",
      expression: "success",
      description: [
        `Backup role assignments telah disimpan ke database.`,
        "",
        `👥 **Total Member:** ${members.size}`,
        `📋 **Member dengan Role:** ${roleData.length}`,
        snapshot ? `🆔 **Snapshot ID:** \`${snapshot._id}\`` : "⚠️ Snapshot hanya tersimpan sementara (MongoDB offline)",
        `⏰ **Waktu Backup:** <t:${Math.floor(Date.now() / 1000)}:F>`,
        `🛡️ **Dibuat Oleh:** <@${interaction.user.id}>`,
        "",
        "-# Gunakan `/recovery restore-roles` untuk memulihkan dari snapshot ini.",
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(successPayload);
  } catch (err) {
    logger.error("[DisasterRecovery] Snapshot roles error:", err);
    const errPayload = buildErrorContainerV2({
      title: "Gagal Membuat Snapshot",
      description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(errPayload);
  }
}

async function handleRestoreRoles(interaction) {
  const snapshotId = interaction.options.getString("snapshot_id");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    let snapshot = null;

    if (snapshotId) {
      const snapshots = await getSnapshots(interaction.guild.id, "role_assignment", 10);
      snapshot = snapshots.find((s) => s._id.toString() === snapshotId);
    } else {
      const snapshots = await getSnapshots(interaction.guild.id, "role_assignment", 1);
      snapshot = snapshots[0];
    }

    if (!snapshot) {
      const notFoundPayload = buildErrorContainerV2({
        title: "Snapshot Tidak Ditemukan",
        description: snapshotId
          ? `Snapshot dengan ID \`${snapshotId}\` tidak ditemukan atau sudah kedaluwarsa.`
          : "Tidak ada snapshot role yang tersimpan untuk server ini.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(notFoundPayload);
    }

    const confirmRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("confirm_restore_roles")
        .setLabel("Ya, Pulihkan Role")
        .setStyle(ButtonStyle.Primary)
        .setEmoji("♻️"),
      new ButtonBuilder()
        .setCustomId("cancel_restore_roles")
        .setLabel("Batalkan")
        .setStyle(ButtonStyle.Secondary),
    );

    const confirmPayload = buildContainerV2({
      accentColorHex: "#F97316",
      title: "⚠️ Konfirmasi Restore Role",
      expression: "warning",
      description: [
        `Anda akan memulihkan role assignments dari snapshot berikut:`,
        "",
        `🆔 **Snapshot ID:** \`${snapshot._id}\``,
        `👥 **Jumlah Member:** ${snapshot.data.memberCount}`,
        `📅 **Waktu Backup:** <t:${Math.floor(new Date(snapshot.createdAt).getTime() / 1000)}:F>`,
        `🛡️ **Dibuat Oleh:** ${snapshot.createdBy}`,
        "",
        "⚠️ **Peringatan:**",
        "- Role yang tidak ada lagi di server akan dilewati",
        "- Bot dan member yang keluar server akan dilewati",
        "- Proses dapat memakan waktu tergantung jumlah member",
      ].join("\n"),
      buttonsRow: confirmRow,
      footerText: ui.getFooter("core"),
    });

    const reply = await interaction.editReply({
      ...confirmPayload,
      components: confirmPayload.components,
    });

    const collector = reply.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== interaction.user.id) return;

      if (i.customId === "cancel_restore_roles") {
        const cancelPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Restore Role Dibatalkan",
          expression: "neutral",
          description: "Operasi pemulihan role telah dibatalkan oleh Anda.",
          footerText: ui.getFooter("core"),
        });
        return i.update(cancelPayload);
      }

      await i.deferUpdate();

      let restoredCount = 0;
      let skippedCount = 0;
      let errorCount = 0;

      for (const assignment of snapshot.data.assignments) {
        try {
          const member = await interaction.guild.members.fetch(assignment.userId).catch(() => null);
          
          if (!member) {
            skippedCount++;
            continue;
          }

          const validRoles = assignment.roles.filter((roleId) => {
            const role = interaction.guild.roles.cache.get(roleId);
            return role && role.position < interaction.guild.members.me.roles.highest.position;
          });

          if (validRoles.length > 0) {
            await member.roles.set(validRoles, `Restore dari snapshot ${snapshot._id} oleh ${interaction.user.tag}`);
            restoredCount++;
          } else {
            skippedCount++;
          }

          if (assignment.nickname && member.manageable) {
            await member.setNickname(assignment.nickname, `Restore nickname dari snapshot`).catch(() => {});
          }
        } catch (err) {
          errorCount++;
          logger.debug(`[DisasterRecovery] Restore role gagal untuk ${assignment.userId}: ${err.message}`);
        }
      }

      const resultPayload = buildContainerV2({
        accentColorHex: restoredCount > 0 ? (ui.getColor("success") || "#22c55e") : "#F59E0B",
        title: restoredCount > 0 ? "✅ Restore Role Selesai" : "⚠️ Restore Role Selesai dengan Catatan",
        expression: restoredCount > 0 ? "success" : "warning",
        description: [
          `Proses pemulihan role dari snapshot telah selesai.`,
          "",
          `♻️ **Berhasil Dipulihkan:** ${restoredCount} member`,
          `⏭️ **Dilewati:** ${skippedCount} member (keluar server/role tidak valid)`,
          `❌ **Error:** ${errorCount} member`,
          "",
          `🆔 **Snapshot:** \`${snapshot._id}\``,
          `🛡️ **Dieksekusi Oleh:** <@${interaction.user.id}>`,
          `⏱️ **Waktu:** <t:${Math.floor(Date.now() / 1000)}:R>`,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });

      await i.editReply(resultPayload);
    });

    collector.on("end", async (collected) => {
      if (collected.size === 0) {
        const timeoutPayload = buildContainerV2({
          accentColorHex: ui.getColor("neutral") || "#64748B",
          title: "Waktu Konfirmasi Habis",
          expression: "neutral",
          description: "Operasi restore role dibatalkan otomatis karena tidak ada konfirmasi dalam 60 detik.",
          footerText: ui.getFooter("core"),
        });
        await interaction.editReply(timeoutPayload).catch(() => {});
      }
    });
  } catch (err) {
    logger.error("[DisasterRecovery] Restore roles error:", err);
    const errPayload = buildErrorContainerV2({
      title: "Gagal Memulihkan Role",
      description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(errPayload);
  }
}

async function handleListSnapshots(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const snapshots = await getSnapshots(interaction.guild.id, "role_assignment", 10);

    if (snapshots.length === 0) {
      const emptyPayload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3B82F6",
        title: "ℹ️ Tidak Ada Snapshot Tersimpan",
        expression: "info",
        description: [
          "Server ini belum memiliki snapshot role yang tersimpan.",
          "",
          "Gunakan `/recovery snapshot-roles` untuk membuat backup role assignments.",
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(emptyPayload);
    }

    const snapshotLines = snapshots.map((s, idx) => {
      const date = new Date(s.createdAt);
      const isExpired = new Date() > new Date(s.expiresAt);
      return [
        `**${idx + 1}.** Snapshot \`${s._id}\``,
        `   👥 ${s.data.memberCount} member | 📅 <t:${Math.floor(date.getTime() / 1000)}:F>`,
        `   🛡️ Oleh: ${s.createdBy} | ${isExpired ? "⚠️ KEDALUWARSA" : "✅ Aktif"}`,
      ].join("\n");
    });

    const listPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: "📋 Daftar Snapshot Recovery",
      description: [
        "Berikut snapshot role yang tersimpan untuk server ini:",
        "",
        ...snapshotLines,
        "",
        "-# Gunakan `/recovery restore-roles snapshot_id:<ID>` untuk memulihkan dari snapshot tertentu.",
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(listPayload);
  } catch (err) {
    logger.error("[DisasterRecovery] List snapshots error:", err);
    const errPayload = buildErrorContainerV2({
      title: "Gagal Mengambil Daftar Snapshot",
      description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(errPayload);
  }
}

async function handleConfig(interaction) {
  const retentionDays = interaction.options.getInteger("retention_days");

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const currentRetention = await getGuildRetention(interaction.guild.id);

    if (retentionDays === null) {
      const infoPayload = buildContainerV2({
        accentColorHex: ui.getColor("info") || "#3B82F6",
        title: "⚙️ Konfigurasi Recovery Saat Ini",
        expression: "info",
        description: [
          `**Retensi Snapshot:** ${currentRetention} hari`,
          "",
          "Snapshot akan otomatis kedaluwarsa dan dihapus setelah periode retensi berakhir.",
          "",
          `Gunakan \`/recovery config retention_days:<1-${MAX_RETENTION_DAYS}>\` untuk mengubah pengaturan.`,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(infoPayload);
    }

    const success = await setGuildRetention(interaction.guild.id, retentionDays);

    if (!success) {
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menyimpan Konfigurasi",
        description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan saat menyimpan pengaturan retensi.`,
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    const successPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#22c55e",
      title: "✅ Konfigurasi Recovery Diperbarui",
      expression: "success",
      description: [
        `Pengaturan retensi snapshot telah diperbarui.`,
        "",
        `📅 **Retensi Baru:** ${retentionDays} hari`,
        `🔄 **Sebelumnya:** ${currentRetention} hari`,
        "",
        "Snapshot baru yang dibuat akan menggunakan periode retensi ini.",
        "Snapshot lama tetap menggunakan periode retensi saat dibuat.",
      ].join("\n"),
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(successPayload);
  } catch (err) {
    logger.error("[DisasterRecovery] Config error:", err);
    const errPayload = buildErrorContainerV2({
      title: "Gagal Mengatur Konfigurasi",
      description: `${ui.getEmoji("error") || "❌"} Terjadi kesalahan: ${err.message}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(errPayload);
  }
}
