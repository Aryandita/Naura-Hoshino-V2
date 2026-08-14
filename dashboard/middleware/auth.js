"use strict";

/**
 * Middleware autentikasi & otorisasi untuk Dashboard Naura.
 *
 * Sebelumnya seluruh pemeriksaan hak akses ditulis inline di server.js dan
 * beberapa endpoint sensitif sama sekali tidak dijaga. Modul ini menyatukan
 * semuanya agar setiap rute cukup memasang penjaga yang tepat.
 */

const env = require("../src/config/env");

// Discord permission bit untuk MANAGE_GUILD (1 << 5).
const MANAGE_GUILD = 1n << 5n;

/**
 * Kumpulkan daftar owner dari env.OWNER_IDS (array) maupun process.env.OWNER_ID
 * (string tunggal / dipisah koma). Hasilnya selalu array string unik.
 */
function getOwnerIds() {
  const fromConfig = Array.isArray(env.OWNER_IDS)
    ? env.OWNER_IDS.map(String)
    : [];
  const fromRaw = String(process.env.OWNER_ID || "")
    .split(/[\s,]+/)
    .filter(Boolean);
  return [...new Set([...fromConfig, ...fromRaw])];
}

/**
 * Pencocokan owner yang ketat.
 *
 * Versi lama memakai `OWNER_IDS.includes(req.user.id)` pada sebuah STRING,
 * sehingga ID yang kebetulan menjadi potongan dari string owner ikut lolos.
 * Di sini perbandingan dilakukan per elemen array, bukan substring.
 */
function isOwner(userId) {
  if (!userId) return false;
  return getOwnerIds().includes(String(userId));
}

/** Apakah request punya sesi login Discord yang sah? */
function isLoggedIn(req) {
  return (
    typeof req.isAuthenticated === "function" &&
    req.isAuthenticated() &&
    !!req.user
  );
}

/** Halaman HTML: belum login diarahkan ke alur OAuth Discord. */
function requireLogin(req, res, next) {
  if (isLoggedIn(req)) return next();
  return res.redirect("/auth/discord");
}

/** Endpoint JSON: belum login dibalas 401, bukan redirect. */
function requireApiLogin(req, res, next) {
  if (isLoggedIn(req)) return next();
  return res
    .status(401)
    .json({
      success: false,
      error: "Kamu belum login ya. Masuk dulu lewat Discord.",
    });
}

/** Endpoint khusus owner bot. */
function requireOwner(req, res, next) {
  if (!isLoggedIn(req)) {
    return res
      .status(401)
      .json({
        success: false,
        error: "Kamu belum login ya. Masuk dulu lewat Discord.",
      });
  }
  if (!isOwner(req.user.id)) {
    return res
      .status(403)
      .json({ success: false, error: "Area ini khusus Owner. Maaf ya!" });
  }
  return next();
}

/**
 * Ambil daftar guild dari profil passport-discord dan cek apakah pengguna
 * benar-benar punya izin Manage Server di guild tersebut.
 */
function canManageGuild(user, guildId) {
  if (!user || !guildId) return false;
  if (isOwner(user.id)) return true;

  const guilds = Array.isArray(user.guilds) ? user.guilds : [];
  const guild = guilds.find((g) => String(g.id) === String(guildId));
  if (!guild) return false;
  if (guild.owner === true) return true;

  try {
    const perms = BigInt(guild.permissions ?? guild.permissions_new ?? 0);
    return (perms & MANAGE_GUILD) === MANAGE_GUILD;
  } catch {
    return false;
  }
}

/**
 * Penjaga untuk semua penulisan pengaturan guild.
 *
 * guildId diambil dari body atau query, lalu diverifikasi DI SISI SERVER.
 * Browser tidak pernah dipercaya.
 */
function requireGuildManager(req, res, next) {
  if (!isLoggedIn(req)) {
    return res
      .status(401)
      .json({
        success: false,
        error: "Kamu belum login ya. Masuk dulu lewat Discord.",
      });
  }

  const guildId = req.body?.guildId || req.query?.guildId;
  if (!guildId) {
    return res
      .status(400)
      .json({ success: false, error: "Guild ID belum dikirim." });
  }

  if (!canManageGuild(req.user, guildId)) {
    return res
      .status(403)
      .json({
        success: false,
        error: "Kamu tidak punya izin Kelola Server di server itu.",
      });
  }

  req.guildId = String(guildId);
  return next();
}

/**
 * Penjaga untuk endpoint yang menyentuh data milik satu pengguna
 * (inventory, profil, dan sejenisnya).
 *
 * Sebelumnya userId cukup dikirim lewat body tanpa verifikasi apa pun,
 * sehingga siapa pun bisa menjual isi tas orang lain.
 */
function requireSelfOrOwner(req, res, next) {
  if (!isLoggedIn(req)) {
    return res
      .status(401)
      .json({
        success: false,
        error: "Kamu belum login ya. Masuk dulu lewat Discord.",
      });
  }

  const targetId = req.body?.userId || req.query?.userId || req.user.id;
  if (String(targetId) !== String(req.user.id) && !isOwner(req.user.id)) {
    return res
      .status(403)
      .json({
        success: false,
        error: "Kamu hanya boleh mengubah datamu sendiri.",
      });
  }

  req.targetUserId = String(targetId);
  return next();
}

module.exports = {
  MANAGE_GUILD,
  getOwnerIds,
  isOwner,
  isLoggedIn,
  canManageGuild,
  requireLogin,
  requireApiLogin,
  requireOwner,
  requireGuildManager,
  requireSelfOrOwner,
};
