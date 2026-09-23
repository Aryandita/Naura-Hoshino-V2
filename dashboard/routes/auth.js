"use strict";

/**
 * dashboard/routes/auth.js
 * Router untuk status otentikasi, token refresh latar belakang, dan auto-reconnect sesi dashboard.
 */

const express = require("express");
const { logger } = require("../../src/managers/logger");

module.exports = (_client) => {
  const router = express.Router();

  /**
   * Endpoint status otentikasi sesi saat ini
   */
  router.get("/auth/status", (req, res) => {
    const isAuth =
      typeof req.isAuthenticated === "function" && req.isAuthenticated();
    return res.json({
      authenticated: Boolean(isAuth),
      user: isAuth ? req.user : null,
      timestamp: Date.now(),
    });
  });

  /**
   * Endpoint refresh sesi Discord OAuth / Web Dashboard
   * Memperpanjang masa aktif cookie sesi tanpa mereset status formulir pengguna
   */
  const handleRefresh = (req, res) => {
    const isAuth =
      typeof req.isAuthenticated === "function" && req.isAuthenticated();
    if (!isAuth || !req.user) {
      return res.status(401).json({
        success: false,
        reason: "SESSION_EXPIRED",
        message: "Sesi Anda telah berakhir, silakan login kembali.",
      });
    }

    try {
      // Sentuh sesi agar masa berlaku maxAge cookie diperpanjang
      if (req.session) {
        req.session.touch();
      }

      return res.json({
        success: true,
        user: req.user,
        refreshedAt: Date.now(),
        message: "Sesi berhasil diperbarui di latar belakang.",
      });
    } catch (err) {
      logger.error("[AuthRefresh] Gagal memperbarui sesi:", err);
      return res.status(500).json({
        success: false,
        reason: "INTERNAL_ERROR",
        message: "Terjadi kesalahan internal saat memperbarui sesi.",
      });
    }
  };

  router.post("/auth/refresh", handleRefresh);
  router.get("/auth/refresh", handleRefresh);

  /**
   * Endpoint auto-reconnect untuk validasi sambungan ulang setelah koneksi pulih
   */
  router.post("/auth/reconnect", (req, res) => {
    const isAuth =
      typeof req.isAuthenticated === "function" && req.isAuthenticated();
    return res.json({
      success: true,
      reconnected: true,
      authenticated: Boolean(isAuth),
      user: isAuth ? req.user : null,
      serverTime: Date.now(),
    });
  });

  return router;
};
