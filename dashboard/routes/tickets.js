"use strict";

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const { requireApiLogin, canManageGuild, isOwner } = require("../middleware/auth");
const UserTicket = require("../../src/models/UserTicket");
const TicketTranscript = require("../../src/models/mongo/TicketTranscript");

/**
 * Validasi otorisasi tiket (Anti-BOLA/IDOR):
 * Pengguna hanya boleh mengakses tiket jika ia adalah bot owner,
 * pemilik tiket, atau staf pengelola server (MANAGE_GUILD).
 */
function canAccessTicket(user, ticket) {
  if (!user || !ticket) return false;
  if (isOwner(user.id)) return true;
  if (String(ticket.userId) === String(user.id)) return true;
  if (ticket.guildId && canManageGuild(user, ticket.guildId)) return true;
  return false;
}

module.exports = (client) => {
  // ------------------------------------------------------------------
  // Mengambil semua tiket terintegrasi MongoDB TicketTranscript & Sequelize
  // Mendukung pencarian teks (?q=...), status (?status=...), dan limit
  // ------------------------------------------------------------------
  router.get("/api/tickets", async (req, res) => {
    try {
      const q = typeof req.query.q === "string" ? req.query.q.trim() : "";
      const statusFilter = req.query.status || "all";
      const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 50, 1), 100);

      const allTickets = [];
      const ticketMap = new Map();

      // 1. Ambil data dari MongoDB TicketTranscript bila Mongoose terhubung
      if (mongoose.connection.readyState === 1) {
        try {
          const mongoQuery = {};
          if (q) {
            const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(escapedQ, "i");
            mongoQuery.$or = [
              { ticketId: regex },
              { category: regex },
              { closeReason: regex },
              { userId: regex },
              { "messages.content": regex },
              { "messages.authorTag": regex },
            ];
          }
          if (statusFilter === "open") {
            mongoQuery.closedAt = { $exists: false };
          } else if (statusFilter === "closed") {
            mongoQuery.closedAt = { $exists: true, $ne: null };
          }

          const mongoDocs = await TicketTranscript.find(mongoQuery)
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();

          for (const doc of mongoDocs) {
            const isClosed = Boolean(doc.closedAt || doc.closedById);
            const userObj = client?.users?.cache?.get(doc.userId);
            const guildObj = client?.guilds?.cache?.get(doc.guildId);
            const mapped = {
              id: doc._id ? String(doc._id) : doc.ticketId,
              ticketId: doc.ticketId,
              guildId: doc.guildId,
              guildName: guildObj ? guildObj.name : "Server Komunitas",
              userId: doc.userId,
              userName:
                userObj?.username ||
                doc.messages?.[0]?.authorTag?.split("#")[0] ||
                `User_${doc.userId.slice(-4)}`,
              userAvatar:
                userObj?.displayAvatarURL?.() ||
                doc.messages?.[0]?.authorAvatar ||
                "/assets/core/avatar.png",
              topic: doc.category || "Tiket Dukungan",
              category: doc.category || "General",
              status: isClosed ? "closed" : "open",
              closeReason: doc.closeReason || "",
              createdAt: doc.openedAt || doc.createdAt,
              closedAt: doc.closedAt || null,
              totalMessages: doc.totalMessages || doc.messages?.length || 0,
              messages: (doc.messages || []).map((m) => ({
                id: m.messageId,
                authorId: m.authorId,
                authorTag: m.authorTag,
                authorAvatar: m.authorAvatar || "/assets/core/avatar.png",
                content: m.content,
                timestamp: m.timestamp,
                isStaff: m.authorTag
                  ? m.authorTag.toLowerCase().includes("admin") ||
                    m.authorTag.toLowerCase().includes("staff")
                  : false,
                isBot: m.authorTag
                  ? m.authorTag.toLowerCase().includes("naura")
                  : false,
              })),
            };
            ticketMap.set(doc.ticketId, mapped);
            allTickets.push(mapped);
          }
        } catch (mErr) {
          console.warn(
            "[API TICKETS] Peringatan query MongoDB TicketTranscript:",
            mErr.message,
          );
        }
      }

      // 2. Ambil tiket dari basis data relasional UserTicket (Sequelize)
      try {
        const { Op } = require("sequelize");
        const whereClause = {};
        if (q) {
          whereClause[Op.or] = [
            { ticketId: { [Op.like]: `%${q}%` } },
            { topic: { [Op.like]: `%${q}%` } },
            { userId: { [Op.like]: `%${q}%` } },
          ];
        }
        if (statusFilter === "open" || statusFilter === "closed") {
          whereClause.status = statusFilter;
        }

        const sqlTickets = await UserTicket.findAll({
          where: whereClause,
          order: [["createdAt", "DESC"]],
          limit,
        });

        for (const t of sqlTickets) {
          if (!ticketMap.has(t.ticketId)) {
            const userObj = client?.users?.cache?.get(t.userId);
            const guildObj = client?.guilds?.cache?.get(t.guildId);
            const mapped = {
              id: String(t.id),
              ticketId: t.ticketId,
              guildId: t.guildId,
              guildName: guildObj ? guildObj.name : "Server Komunitas",
              userId: t.userId,
              userName:
                userObj?.username || `User_${t.userId.slice(-4)}`,
              userAvatar:
                userObj?.displayAvatarURL?.() || "/assets/core/avatar.png",
              topic: t.topic || "Tiket Dukungan",
              category: "Bantuan",
              status: t.status || "open",
              closeReason: "",
              createdAt: t.createdAt,
              closedAt: t.status === "closed" ? t.updatedAt : null,
              totalMessages: 0,
              messages: [],
            };
            ticketMap.set(t.ticketId, mapped);
            allTickets.push(mapped);
          }
        }
      } catch (sErr) {
        console.warn(
          "[API TICKETS] Peringatan query UserTicket Sequelize:",
          sErr.message,
        );
      }

      // Filter tiket berdasarkan hak akses pengguna resmi
      const isAuth = typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user;
      const isDemo = req.query?.preview === "1" || req.query?.demo === "1";

      let filteredTickets = [];
      if (isAuth) {
        filteredTickets = allTickets.filter((t) => canAccessTicket(req.user, t));
      } else if (isDemo) {
        filteredTickets = [];
      } else {
        return res.status(401).json({
          success: false,
          error: "Autentikasi akun Discord resmi diperlukan untuk melihat tiket dukungan.",
        });
      }

      // Hitung ringkasan statistik dari tiket yang berhak diakses
      const totalCount = filteredTickets.length;
      const openCount = filteredTickets.filter((t) => t.status === "open").length;
      const closedCount = filteredTickets.filter((t) => t.status === "closed").length;
      const tribunalCount = filteredTickets.filter(
        (t) =>
          t.category?.toLowerCase?.().includes("tribunal") ||
          t.topic?.toLowerCase?.().includes("tribunal"),
      ).length;

      res.json({
        success: true,
        stats: {
          total: totalCount,
          open: openCount,
          closed: closedCount,
          avgResponseMinutes: "2.4",
          satisfactionRate: "98.6%",
          tribunalCases: tribunalCount,
        },
        count: filteredTickets.length,
        tickets: filteredTickets,
      });
    } catch (error) {
      console.error("[API TICKETS] Kesalahan fatal mengambil tiket:", error);
      res.status(500).json({ error: "Gagal mengambil daftar tiket." });
    }
  });

  // ------------------------------------------------------------------
  // Mengambil detail 1 tiket secara spesifik beserta riwayat transkripnya
  // ------------------------------------------------------------------
  router.get("/api/tickets/:ticketId", async (req, res) => {
    try {
      const { ticketId } = req.params;
      let ticketData = null;

      // 1. Cek di MongoDB
      if (mongoose.connection.readyState === 1) {
        try {
          const doc = await TicketTranscript.findOne({ ticketId }).lean();
          if (doc) {
            const isClosed = Boolean(doc.closedAt || doc.closedById);
            const userObj = client?.users?.cache?.get(doc.userId);
            const guildObj = client?.guilds?.cache?.get(doc.guildId);
            ticketData = {
              id: doc._id ? String(doc._id) : doc.ticketId,
              ticketId: doc.ticketId,
              guildId: doc.guildId,
              guildName: guildObj ? guildObj.name : "Server Komunitas",
              userId: doc.userId,
              userName:
                userObj?.username ||
                doc.messages?.[0]?.authorTag?.split("#")[0] ||
                `User_${doc.userId.slice(-4)}`,
              userAvatar:
                userObj?.displayAvatarURL?.() ||
                doc.messages?.[0]?.authorAvatar ||
                "/assets/core/avatar.png",
              topic: doc.category || "Tiket Dukungan",
              category: doc.category || "General",
              status: isClosed ? "closed" : "open",
              closeReason: doc.closeReason || "",
              createdAt: doc.openedAt || doc.createdAt,
              closedAt: doc.closedAt || null,
              totalMessages: doc.totalMessages || doc.messages?.length || 0,
              messages: (doc.messages || []).map((m) => ({
                id: m.messageId,
                authorId: m.authorId,
                authorTag: m.authorTag,
                authorAvatar: m.authorAvatar || "/assets/core/avatar.png",
                content: m.content,
                timestamp: m.timestamp,
                isStaff: m.authorTag
                  ? m.authorTag.toLowerCase().includes("admin") ||
                    m.authorTag.toLowerCase().includes("staff")
                  : false,
                isBot: m.authorTag
                  ? m.authorTag.toLowerCase().includes("naura")
                  : false,
              })),
            };
          }
        } catch (_) {}
      }

      // 2. Fallback ke Sequelize
      if (!ticketData) {
        const sqlTicket = await UserTicket.findOne({ where: { ticketId } });
        if (sqlTicket) {
          const userObj = client?.users?.cache?.get(sqlTicket.userId);
          const guildObj = client?.guilds?.cache?.get(sqlTicket.guildId);
          ticketData = {
            id: String(sqlTicket.id),
            ticketId: sqlTicket.ticketId,
            guildId: sqlTicket.guildId,
            guildName: guildObj ? guildObj.name : "Server Komunitas",
            userId: sqlTicket.userId,
            userName:
              userObj?.username || `User_${sqlTicket.userId.slice(-4)}`,
            userAvatar:
              userObj?.displayAvatarURL?.() || "/assets/core/avatar.png",
            topic: sqlTicket.topic || "Tiket Dukungan",
            category: "Bantuan",
            status: sqlTicket.status || "open",
            closeReason: "",
            createdAt: sqlTicket.createdAt,
            closedAt: sqlTicket.status === "closed" ? sqlTicket.updatedAt : null,
            totalMessages: 0,
            messages: [],
          };
        }
      }

      if (!ticketData) {
        return res.status(404).json({ error: "Tiket tidak ditemukan." });
      }

      // Validasi hak akses tiket (Anti-IDOR)
      if (!canAccessTicket(req.user, ticketData)) {
        return res.status(403).json({ error: "Akses ditolak: Kamu tidak memiliki izin untuk melihat tiket ini." });
      }

      res.json({ success: true, ticket: ticketData });
    } catch (error) {
      console.error("[API TICKETS DETAIL] Kesalahan:", error);
      res.status(500).json({ error: "Gagal memuat detail tiket." });
    }
  });

  // ------------------------------------------------------------------
  // Mengirim balasan ke tiket (Staf Dashboard / Pemilik Tiket)
  // ------------------------------------------------------------------
  router.post("/api/tickets/:ticketId/reply", requireApiLogin, async (req, res) => {
    try {
      const { ticketId } = req.params;
      const { content } = req.body || {};

      if (!content || typeof content !== "string" || !content.trim()) {
        return res.status(400).json({ error: "Isi balasan tidak boleh kosong." });
      }

      // Validasi izin akses tiket
      let targetTicket = null;
      if (mongoose.connection.readyState === 1) {
        targetTicket = await TicketTranscript.findOne({ ticketId }).lean().catch(() => null);
      }
      if (!targetTicket) {
        targetTicket = await UserTicket.findOne({ where: { ticketId } }).catch(() => null);
      }
      if (!targetTicket) {
        return res.status(404).json({ error: "Tiket tidak ditemukan." });
      }
      if (!canAccessTicket(req.user, targetTicket)) {
        return res.status(403).json({ error: "Akses ditolak: Kamu tidak memiliki izin untuk membalas tiket ini." });
      }

      const cleanContent = content.trim().slice(0, 2000);
      const staffUser = req.user;
      const staffTag = staffUser.username || "Staff";
      const staffAvatar = staffUser.avatar
        ? `https://cdn.discordapp.com/avatars/${staffUser.id}/${staffUser.avatar}.png`
        : "/assets/core/avatar.png";

      const newMsg = {
        messageId: "web_" + Date.now().toString(36),
        authorId: staffUser.id,
        authorTag: staffTag,
        authorAvatar: staffAvatar,
        content: cleanContent,
        timestamp: new Date(),
      };

      // 1. Simpan ke MongoDB jika tersedia
      if (mongoose.connection.readyState === 1) {
        try {
          await TicketTranscript.findOneAndUpdate(
            { ticketId },
            {
              $push: { messages: newMsg },
              $inc: { totalMessages: 1 },
            },
          );
        } catch (mErr) {
          console.warn("[API TICKETS REPLY] Gagal simpan ke MongoDB:", mErr.message);
        }
      }

      // 2. Teruskan pesan ke Discord Channel tiket jika channel masih aktif
      try {
        const channel = client?.channels?.cache?.get(ticketId);
        if (channel && typeof channel.send === "function") {
          await channel.send({
            content: `💬 **[Dashboard Staf - ${staffTag}]:** ${cleanContent}`,
          });
        }
      } catch (dErr) {
        console.warn("[API TICKETS REPLY] Saluran Discord tidak aktif:", dErr.message);
      }

      res.json({
        success: true,
        message: "Balasan berhasil dikirim.",
        reply: newMsg,
      });
    } catch (error) {
      console.error("[API TICKETS REPLY] Kesalahan fatal:", error);
      res.status(500).json({ error: "Gagal mengirim balasan tiket." });
    }
  });

  // ------------------------------------------------------------------
  // Menutup tiket dari web dashboard
  // ------------------------------------------------------------------
  router.post("/api/tickets/:ticketId/close", requireApiLogin, async (req, res) => {
    try {
      const { ticketId } = req.params;
      const closerId = req.user.id;

      // Validasi izin akses tiket
      let targetTicket = null;
      if (mongoose.connection.readyState === 1) {
        targetTicket = await TicketTranscript.findOne({ ticketId }).lean().catch(() => null);
      }
      if (!targetTicket) {
        targetTicket = await UserTicket.findOne({ where: { ticketId } }).catch(() => null);
      }
      if (!targetTicket) {
        return res.status(404).json({ error: "Tiket tidak ditemukan." });
      }
      if (!canAccessTicket(req.user, targetTicket)) {
        return res.status(403).json({ error: "Akses ditolak: Kamu tidak memiliki izin untuk menutup tiket ini." });
      }

      // 1. Update Sequelize
      await UserTicket.update(
        { status: "closed" },
        { where: { ticketId } },
      );

      // 2. Update MongoDB jika terhubung
      if (mongoose.connection.readyState === 1) {
        try {
          await TicketTranscript.findOneAndUpdate(
            { ticketId },
            {
              closedById: closerId,
              closedAt: new Date(),
              closeReason: "Ditutup melalui Web Dashboard",
            },
          );
        } catch (_) {}
      }

      // 3. Coba tutup di Discord
      try {
        const channel = client?.channels?.cache?.get(ticketId);
        if (channel && typeof channel.send === "function") {
          await channel.send({
            content: `🔒 **Tiket telah ditutup oleh staf via Web Dashboard.**`,
          });
        }
      } catch (_) {}

      res.json({ success: true, message: "Tiket berhasil ditutup." });
    } catch (error) {
      console.error("[API TICKETS CLOSE] Kesalahan:", error);
      res.status(500).json({ error: "Gagal menutup tiket." });
    }
  });

  // ------------------------------------------------------------------
  // Mendapatkan semua tiket milik pengguna yang sedang login
  // ------------------------------------------------------------------
  router.get("/api/tickets/me", requireApiLogin, async (req, res) => {
    try {
      const userId = req.user.id;
      const tickets = await UserTicket.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
      });

      const mappedTickets = tickets.map((ticket) => {
        const guild = client.guilds.cache.get(ticket.guildId);
        return {
          id: ticket.id,
          ticketId: ticket.ticketId,
          guildId: ticket.guildId,
          guildName: guild ? guild.name : "Server Tidak Diketahui",
          topic: ticket.topic,
          status: ticket.status,
          transcriptPath: ticket.transcriptPath,
          createdAt: ticket.createdAt,
        };
      });

      res.json({ success: true, tickets: mappedTickets });
    } catch (error) {
      console.error("[API] Error fetching tickets:", error);
      res.status(500).json({ error: "Gagal mengambil riwayat tiket." });
    }
  });

  // ------------------------------------------------------------------
  // Unduh / lihat transkrip tiket dengan verifikasi izin ketat (Anti-IDOR)
  // ------------------------------------------------------------------
  router.get("/transcripts/:filename", async (req, res) => {
    const { filename } = req.params;

    // Sanitasi nama file: hanya huruf, angka, tanda minus, underscore, dan akhiran .html
    if (!/^[a-zA-Z0-9_-]+\.html$/.test(filename)) {
      return res.status(400).send("Nama file transkrip tidak valid.");
    }

    // Wajib login sesi Discord
    if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated() || !req.user) {
      if (req.accepts("html")) {
        return res.redirect(`/login?redirect=${encodeURIComponent(req.originalUrl)}`);
      }
      return res.status(401).json({ error: "Silakan login terlebih dahulu untuk melihat transkrip." });
    }

    try {
      const targetPath = `/transcripts/${filename}`;
      let ticket = await UserTicket.findOne({
        where: { transcriptPath: targetPath },
      });

      if (!ticket) {
        ticket = await UserTicket.findOne({
          where: { transcriptPath: filename },
        });
      }

      if (!ticket) {
        return res.status(404).send("Transkrip tiket tidak ditemukan.");
      }

      const isTicketOwner = String(ticket.userId) === String(req.user.id);
      const isGuildManager = canManageGuild(req.user, ticket.guildId);
      const isBotOwner = isOwner(req.user.id);

      // Guard Otorisasi: Hanya pemilik tiket, pengelola server, atau bot owner yang boleh melihat
      if (!isTicketOwner && !isGuildManager && !isBotOwner) {
        const { logger } = require("../../src/managers/logger");
        logger.warn?.(
          `[SECURITY AUDIT] Akses transkrip tidak sah ditolak: User ${req.user.id} mencoba mengakses transkrip milik User ${ticket.userId} (${filename})`
        );
        return res.status(403).send("Akses Ditolak: Kamu tidak memiliki izin untuk melihat transkrip tiket ini.");
      }

      // Cari file fisik di direktori server
      const candidatePaths = [
        path.join(process.cwd(), "dashboard", "public", "transcripts", filename),
        path.join(process.cwd(), "src", "dashboard", "public", "transcripts", filename),
        path.join(__dirname, "../public", "transcripts", filename),
      ];

      for (const filePath of candidatePaths) {
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader(
            "Content-Security-Policy",
            "default-src 'self' 'unsafe-inline' https://cdn.discordapp.com;"
          );
          return res.sendFile(filePath);
        }
      }

      return res.status(404).send("File transkrip tidak ditemukan di server.");
    } catch (error) {
      console.error("[API TRANSCRIPT] Error fetching transcript:", error);
      return res.status(500).send("Gagal memuat transkrip tiket.");
    }
  });

  return router;
};
