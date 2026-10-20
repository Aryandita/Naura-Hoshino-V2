"use strict";

/**
 * Server webhook Naura (port terpisah dari dashboard).
 *
 * Vote top.gg, Saweria, dan Trakteer memakai helper bersama supaya aturan
 * premium hanya ditulis sekali.
 *
 * Tiga aturan keamanan yang berlaku untuk SEMUA endpoint di berkas ini:
 *
 * 1. Endpoint yang tokennya belum dikonfigurasi harus DITOLAK, bukan dibiarkan
 *    terbuka. Versi sebelumnya menolak hanya ketika token salah; ketika env-nya
 *    kosong, permintaan justru lolos. Karena endpoint donasi memberi premium
 *    hingga satu tahun berdasarkan ID Discord yang ditulis di pesan donasi,
 *    siapa pun yang tahu URL-nya bisa memberi dirinya sendiri premium.
 *
 * 2. Pencocokan token memakai perbandingan konstan-waktu.
 *
 * 3. Setiap kejadian yang memberi hadiah harus idempoten. Penyedia webhook
 *    biasa mengirim ulang saat balasan lambat, dan tanpa penanda sekali-pakai
 *    setiap kiriman ulang menumpuk masa premium.
 */

const express = require("express");
const env = require("../../src/config/env");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const { buildVoteStreakCelebrationCard } = require("../../src/utils/survivalUIHelper");
const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const ui = require("../../src/config/ui");
const { grantVoteRewards } = require("../utils/voteRewards");
const { verifyToken, createRateLimiter } = require("../utils/httpGuard");
const donationWebhooks = require("./donationWebhooks");

/** Kirim DM Components V2. Gagal DM tidak boleh menggagalkan webhook. */
async function notifyUser(client, userId, payload, tag) {
  try {
    const userObj = await client.users.fetch(userId);
    await userObj.send(payload);
    return true;
  } catch {
    logger.info(`[WEBHOOK ${tag}] DM ke ${userId} gagal: DM-nya tertutup.`);
    return false;
  }
}

/**
 * Penjaga token bersama.
 *
 * @returns {boolean} true bila permintaan boleh lanjut. Bila false, balasan
 *                    sudah dikirim oleh fungsi ini.
 */
function passesToken(req, res, { tag, envKey, headerNames }) {
  const state = verifyToken(req, envKey, headerNames);

  if (state === "not_configured") {
    logger.warn(
      `[WEBHOOK ${tag}] ${envKey} belum diisi. Endpoint ditutup demi keamanan.`,
    );
    res.status(503).send("Webhook is not configured");
    return false;
  }
  if (state === "mismatch") {
    logger.warn(`[WEBHOOK ${tag}] Token tidak cocok, permintaan ditolak.`);
    res.status(401).send("Unauthorized");
    return false;
  }
  return true;
}

module.exports = (client) => {
  const app = express();

  app.use(
    express.json({
      limit: "64kb",
      verify: (req, res, buf) => {
        req.rawBody = buf;
      },
    }),
  );
  app.use(express.urlencoded({ extended: true, limit: "64kb" }));

  // Di belakang reverse proxy, req.ip harus membaca X-Forwarded-For agar
  // pembatas laju tidak melihat semua orang sebagai satu IP yang sama.
  if (env.NODE_ENV === "production") app.set("trust proxy", 1);

  // Tanpa ini, token webhook bisa ditebak dengan percobaan tak terbatas.
  app.use(
    "/api/webhook",
    createRateLimiter({ windowMs: 60_000, max: 30, name: "WEBHOOK" }),
  );

  // ================= VOTE TOP.GG =================
  // top.gg mengirim { bot, user, type: 'upvote'|'test', isWeekend, query }
  // dengan header Authorization berisi secret yang kamu pasang di top.gg.
  app.post("/api/webhook/vote", async (req, res) => {
    if (
      !passesToken(req, res, {
        tag: "VOTE",
        envKey: "WEBHOOK_AUTH_VOTE",
        headerNames: ["authorization"],
      })
    ) {
      return undefined;
    }

    const body = req.body || {};
    const userId = body.user;
    if (!userId) return res.status(400).send("Missing user ID");
    if (!/^\d{17,20}$/.test(String(userId))) {
      return res.status(400).send("Invalid Discord user ID");
    }

    // Tombol "Send Test" di dasbor top.gg tidak boleh memberi hadiah nyata.
    if (body.type === "test") {
      logger.info(`[WEBHOOK VOTE] Uji coba top.gg diterima untuk ${userId}.`);
      return res.status(200).send("Test webhook received");
    }

    try {
      const isWeekend = body.isWeekend === true || body.isWeekend === "true";
      const result = await grantVoteRewards(userId, { isWeekend });

      if (!result.ok) {
        logger.info(
          `[WEBHOOK VOTE] Vote ${userId} dilewati (${result.reason}).`,
        );
        return res.status(200).send(`OK: skipped (${result.reason})`);
      }

      const userObj = await client.users.fetch(userId).catch(() => null);
      const couponEmoji = ui.getEmoji("coupon") || "\uD83C\uDF9F\uFE0F";

      const streak = Number(result.streak || 0);
      const isMilestone = streak === 7 || streak === 30 || streak === 60;

      let payload;
      if (isMilestone) {
        // Vote streak milestone: kirim kartu celebration khusus
        payload = buildVoteStreakCelebrationCard({
          user: userObj || { id: userId, displayName: "kamu", username: "kamu" },
          streak,
          isMilestone: true,
        });
      } else {
        payload = buildContainerV2({
          accentColorHex: ui.getColor("economy") || "#FFD700",
          title:
            `${ui.getEmoji("naura_cheers") || "\uD83C\uDF89"} Makasih banyak sudah vote Naura!`,
          description:
            `Hai ${userObj?.username || "kamu"}! Naura seneng banget kamu masih menyempatkan waktu buat vote hari ini.\n\n` +
            `Ini hadiah dari Naura ya:\n` +
            `\u2728 **Trial V.I.P Premium 12 jam**\n` +
            `${couponEmoji} **${result.coupons} Naura Coupon**${isWeekend ? " (bonus akhir pekan, dobel!)" : ""}\n\n` +
            `Total kuponmu sekarang **${result.totalCoupons}**. Kupon ini bisa kamu tukar dengan barang langka seperti peralatan Obsidian, lho!\n\n` +
            `\u23F3 **Premium aktif sampai:** <t:${Math.floor(result.expiry.getTime() / 1000)}:R>\n` +
            `\uD83D\uDCC5 **Vote ke-${result.streak}.** Jangan lupa balik lagi 12 jam lagi ya!`,
          footerCategory: "premium",
        });
      }

      await notifyUser(client, userId, payload, "VOTE");
      return res.status(200).send("Vote recorded successfully");
    } catch (error) {
      logger.error("[WEBHOOK ERROR] Vote:", error);
      return res.status(500).send("Internal Server Error");
    }
  });

  // ================= DONASI (SAWERIA & TRAKTEER) =================
  // Delegasikan rute donasi ke donationWebhooks
  app.use(donationWebhooks(client));

  // Penanda sehat untuk memastikan port webhook benar-benar terbuka.
  app.get("/api/webhook/health", (req, res) =>
    res.status(200).json({ ok: true }),
  );

  const port = env.WEBHOOK_PORT || 3071;
  try {
    const server = app.listen(port, () => {
      logger.info(`[WEBHOOK] Server webhook berjalan di port ${port}`);
    });
    server.on("error", (err) => {
      logger.warn(
        `[WEBHOOK] Webhook server port ${port} tidak dapat dibuka (${err.message}). Webhook endpoints tetap aktif via API utama.`,
      );
    });
  } catch (err) {
    logger.warn(`[WEBHOOK] Gagal membuka port ${port}:`, err.message);
  }

  return app;
};

module.exports.DONATION_TIERS = donationWebhooks.DONATION_TIERS;
module.exports.resolveTier = donationWebhooks.resolveTier;
module.exports.extractDiscordId = donationWebhooks.extractDiscordId;

// UserProfile tetap diekspor untuk pengujian manual di REPL.
module.exports.UserProfile = UserProfile;
