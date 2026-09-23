"use strict";

const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const {
  requireApiLogin,
  canManageGuild,
  isOwner,
} = require("../middleware/auth");
const UserTicket = require("../../src/models/UserTicket");

module.exports = (client) => {
  // Mendapatkan semua tiket milik pengguna yang sedang login
  router.get("/api/tickets/me", requireApiLogin, async (req, res) => {
    try {
      const userId = req.user.id;
      const tickets = await UserTicket.findAll({
        where: { userId },
        order: [["createdAt", "DESC"]],
      });

      // Map untuk menyertakan nama server jika memungkinkan
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
    if (
      typeof req.isAuthenticated !== "function" ||
      !req.isAuthenticated() ||
      !req.user
    ) {
      if (req.accepts("html")) {
        return res.redirect(
          `/auth/discord?returnTo=${encodeURIComponent(req.originalUrl)}`,
        );
      }
      return res
        .status(401)
        .json({
          error: "Silakan login terlebih dahulu untuk melihat transkrip.",
        });
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
          `[SECURITY AUDIT] Akses transkrip tidak sah ditolak: User ${req.user.id} mencoba mengakses transkrip milik User ${ticket.userId} (${filename})`,
        );
        return res
          .status(403)
          .send(
            "Akses Ditolak: Kamu tidak memiliki izin untuk melihat transkrip tiket ini.",
          );
      }

      // Cari file fisik di direktori server
      const candidatePaths = [
        path.join(
          process.cwd(),
          "dashboard",
          "public",
          "transcripts",
          filename,
        ),
        path.join(
          process.cwd(),
          "src",
          "dashboard",
          "public",
          "transcripts",
          filename,
        ),
        path.join(__dirname, "../public", "transcripts", filename),
      ];

      for (const filePath of candidatePaths) {
        if (fs.existsSync(filePath)) {
          res.setHeader("Content-Type", "text/html; charset=utf-8");
          res.setHeader(
            "Content-Security-Policy",
            "default-src 'self' 'unsafe-inline' https://cdn.discordapp.com;",
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
