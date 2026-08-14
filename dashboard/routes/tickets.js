"use strict";

const express = require("express");
const router = express.Router();
const { requireApiLogin } = require("../middleware/auth");
const UserTicket = require("../src/models/UserTicket");

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

  return router;
};
