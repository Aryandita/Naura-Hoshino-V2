"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const { logger } = require("../managers/logger");
const env = require("../config/env");
const ui = require("../config/ui");
const mongoManager = require("../managers/mongoManager");
const UserReport = require("../models/mongo/UserReport");

// In-memory fallback untuk testing atau saat koneksi MongoDB offline
const inMemoryReports = new Map();
// Penyimpanan sementara lampiran dari slash command sebelum modal di-submit (TTL 10 menit)
const tempAttachments = new Map();
const ATTACHMENT_TTL_MS = 10 * 60 * 1000;

function cleanOldAttachments() {
  const now = Date.now();
  for (const [key, val] of tempAttachments.entries()) {
    if (now - val.timestamp > ATTACHMENT_TTL_MS) {
      tempAttachments.delete(key);
    }
  }
}

function saveTempAttachment(userId, attachment) {
  if (!userId || !attachment) return;
  cleanOldAttachments();
  tempAttachments.set(userId, {
    url: attachment.url || attachment.proxyURL,
    name: attachment.name || "lampiran.png",
    contentType: attachment.contentType || "image/png",
    timestamp: Date.now(),
  });
}

function getTempAttachment(userId) {
  if (!userId) return null;
  cleanOldAttachments();
  const data = tempAttachments.get(userId);
  if (data) {
    tempAttachments.delete(userId);
    return data;
  }
  return null;
}

function generateReportId() {
  const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
  const timePart = Date.now().toString(36).slice(-2).toUpperCase();
  return `REP-${timePart}${randomPart}`;
}

async function createReport({
  userId,
  userName,
  guildId = null,
  guildName = null,
  title,
  description,
  attachmentUrl = null,
  client = null,
}) {
  if (!userId || !title || !description) {
    throw new Error("Parameter laporan tidak lengkap (userId, title, dan description wajib diisi).");
  }

  const reportId = generateReportId();
  const sanitizedTitle = String(title).trim().substring(0, 100);
  const sanitizedDesc = String(description).trim().substring(0, 1500);
  const sanitizedUser = String(userName || "Pengguna").trim();

  const reportData = {
    reportId,
    userId,
    userName: sanitizedUser,
    guildId: guildId || null,
    guildName: guildName || null,
    title: sanitizedTitle,
    description: sanitizedDesc,
    attachmentUrl: attachmentUrl || null,
    status: "PENDING",
    createdAt: new Date(),
  };

  // Simpan ke MongoDB jika terhubung, jika tidak simpan di in-memory map
  if (mongoManager?.isReady && UserReport?.create) {
    try {
      await UserReport.create(reportData);
    } catch (dbErr) {
      logger.warn(`[ReportService] Gagal menyimpan ke MongoDB, menggunakan memory store: ${dbErr.message}`);
      inMemoryReports.set(reportId, reportData);
    }
  } else {
    inMemoryReports.set(reportId, reportData);
  }

  // Notifikasi ke DM Owner
  let deliveredCount = 0;
  const ownerIds = Array.isArray(env.OWNER_IDS) ? env.OWNER_IDS : [];

  if (client && ownerIds.length > 0) {
    const ownerPayload = buildContainerV2({
      accentColorHex: "#EF4444", // Merah alert
      authorName: "Naura Incident & Feedback Desk",
      title: `🚨 Laporan Pengguna Baru: ${sanitizedTitle}`,
      description: [
        `Halo Kak! Ada laporan keluhan atau kendala baru yang dikirimkan oleh pengguna:`,
        "",
        `🎫 **ID Laporan:** \`#${reportId}\``,
        `👤 **Pelapor:** **${sanitizedUser}** (<@${userId}> | \`${userId}\`)`,
        `📍 **Lokasi:** ${guildName ? `Server **${guildName}**` : "Direct Message (DM)"}`,
        "",
        `📌 **Judul Masalah:**`,
        `> ${sanitizedTitle}`,
        "",
        `📝 **Detail Keluhan:**`,
        `\`\`\`text`,
        sanitizedDesc,
        `\`\`\``,
        attachmentUrl ? `📎 **Lampiran Foto / Bukti:** [Klik untuk melihat berkas](${attachmentUrl})` : "",
        "",
        "-# Gunakan tombol di bawah ini untuk membalas langsung ke DM pengguna atau menandai laporan telah selesai.",
      ].filter(Boolean).join("\n"),
      footerText: ui.getFooter("utility"),
    });

    // Tambahkan gambar banner jika berupa URL foto
    if (attachmentUrl && /\.(jpg|jpeg|png|webp|gif)($|\?)/i.test(attachmentUrl)) {
      ownerPayload.image = { url: attachmentUrl };
    }

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`report_reply_${reportId}`)
        .setLabel("Balas Pelapor")
        .setEmoji("💬")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId(`report_resolve_${reportId}`)
        .setLabel("Tandai Selesai")
        .setEmoji("✅")
        .setStyle(ButtonStyle.Success),
    );

    for (const ownerId of ownerIds) {
      try {
        const ownerUser = await client.users.fetch(ownerId).catch(() => null);
        if (ownerUser) {
          await ownerUser.send({
            ...ownerPayload,
            components: [actionRow],
          });
          deliveredCount++;
          logger.info(`[ReportService] Laporan ${reportId} berhasil dikirim ke DM owner (${ownerId}).`);
        }
      } catch (dmErr) {
        logger.warn(`[ReportService] Tidak dapat mengirim DM ke owner (${ownerId}): ${dmErr.message}`);
      }
    }
  }

  return {
    success: true,
    reportId,
    deliveredCount,
    data: reportData,
  };
}

async function getReport(reportId) {
  if (!reportId) return null;
  const cleanId = String(reportId).trim().toUpperCase();

  if (mongoManager?.isReady && UserReport?.findOne) {
    try {
      const doc = await UserReport.findOne({ reportId: cleanId }).lean();
      if (doc) return doc;
    } catch (err) {
      logger.warn(`[ReportService] Gagal membaca MongoDB: ${err.message}`);
    }
  }

  return inMemoryReports.get(cleanId) || null;
}

async function resolveReport(reportId, resolvedBy = "Owner") {
  const report = await getReport(reportId);
  if (!report) return null;

  const now = new Date();
  if (mongoManager?.isReady && UserReport?.findOneAndUpdate) {
    try {
      await UserReport.findOneAndUpdate(
        { reportId: report.reportId },
        { status: "RESOLVED", resolvedAt: now },
      );
    } catch (err) {
      logger.warn(`[ReportService] Gagal update status di MongoDB: ${err.message}`);
    }
  }

  report.status = "RESOLVED";
  report.resolvedAt = now;
  inMemoryReports.set(report.reportId, report);

  return report;
}

async function replyToReport(reportId, replyText, repliedBy = "Owner", client = null) {
  if (!reportId || !replyText) {
    throw new Error("ID Laporan dan teks balasan wajib diisi.");
  }

  const report = await getReport(reportId);
  if (!report) {
    throw new Error(`Laporan dengan ID #${reportId} tidak ditemukan.`);
  }

  const cleanReply = String(replyText).trim();
  const now = new Date();

  // Update status ke INVESTIGATING / dijawab
  if (mongoManager?.isReady && UserReport?.findOneAndUpdate) {
    try {
      await UserReport.findOneAndUpdate(
        { reportId: report.reportId },
        {
          ownerReply: cleanReply,
          repliedBy,
          repliedAt: now,
          status: report.status === "RESOLVED" ? "RESOLVED" : "INVESTIGATING",
        },
      );
    } catch (err) {
      logger.warn(`[ReportService] Gagal update balasan di MongoDB: ${err.message}`);
    }
  }

  report.ownerReply = cleanReply;
  report.repliedBy = repliedBy;
  report.repliedAt = now;
  if (report.status !== "RESOLVED") {
    report.status = "INVESTIGATING";
  }
  inMemoryReports.set(report.reportId, report);

  // Kirim DM ke pelapor asli
  let deliveredToUser = false;
  if (client && report.userId) {
    try {
      const reporter = await client.users.fetch(report.userId).catch(() => null);
      if (reporter) {
        const userReplyPayload = buildContainerV2({
          accentColorHex: ui.getColor("info") || "#3B82F6",
          authorName: "Pesan dari Tim Pengembang Naura Hoshino",
          title: `Tanggapan untuk Laporan #${report.reportId}`,
          description: [
            `Halo Kak **${report.userName}**! Pengembang Naura Hoshino telah membaca dan menindaklanjuti laporanmu:`,
            "",
            `📌 **Topik Laporan:** *"${report.title}"*`,
            "",
            `💬 **Pesan Balasan dari Pengembang:**`,
            `> ${cleanReply}`,
            "",
            "-# *Terima kasih sudah meluangkan waktu untuk membantu menjaga kenyamanan bot Naura Hoshino. Jika masih ada kendala lain, jangan ragu untuk menggunakan `/report` kembali.*",
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });

        await reporter.send(userReplyPayload);
        deliveredToUser = true;
        logger.info(`[ReportService] Balasan untuk laporan ${report.reportId} berhasil dikirim ke DM pelapor (${report.userId}).`);
      }
    } catch (dmErr) {
      logger.warn(`[ReportService] Gagal mengirim DM balasan ke pelapor (${report.userId}): ${dmErr.message}`);
    }
  }

  return {
    success: true,
    report,
    deliveredToUser,
  };
}

module.exports = {
  saveTempAttachment,
  getTempAttachment,
  generateReportId,
  createReport,
  getReport,
  resolveReport,
  replyToReport,
  _inMemoryReports: inMemoryReports,
  _tempAttachments: tempAttachments,
};
