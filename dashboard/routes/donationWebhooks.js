"use strict";

/**
 * @file donationWebhooks.js
 * @description Router Express untuk penerimaan webhook donasi Saweria dan Trakteer.
 * Mendukung verifikasi signature HMAC SHA-256 konstan-waktu (timingSafeEqual),
 * parsing Snowflake Discord ID (17-20 digit), proteksi idempotensi claimOnce,
 * serta perpanjangan status premium secara atomik.
 */

const express = require("express");
const crypto = require("crypto");
const { EmbedBuilder } = require("discord.js");
const env = require("../../src/config/env");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const voteRewards = require("../utils/voteRewards");
const httpGuard = require("../utils/httpGuard");

// Tangga donasi: nominal minimal -> lama hari premium -> tier identitas
const DONATION_TIERS = [
  { min: 75000, days: 365, name: "Naura Bestie (1 Tahun)", tier: "tier3" },
  { min: 50000, days: 180, name: "Naura Friends (6 Bulan)", tier: "tier2" },
  { min: 35000, days: 30, name: "Naura Supporter (1 Bulan)", tier: "tier1" },
];

const CLAIM_TTL_WITH_ID = 7 * 24 * 60 * 60; // 7 hari untuk transaksi dengan ID unik
const CLAIM_TTL_FINGERPRINT = 10 * 60; // 10 menit untuk transaksi berbasis sidik jari

/**
 * Menentukan paket premium berdasarkan nominal donasi.
 * @param {number} amount
 * @returns {object|null}
 */
function resolveTier(amount) {
  const num = Number(amount) || 0;
  return DONATION_TIERS.find((t) => num >= t.min) || null;
}

/**
 * Mengekstrak Discord User ID (17-20 digit snowflake) dari string atau objek payload.
 * @param {string|object} input
 * @returns {string|null}
 */
function extractDiscordId(input) {
  if (!input) return null;
  if (typeof input === "object") {
    const directId = input.discord_id || input.user_id || input.userId;
    if (directId && /^\d{17,20}$/.test(String(directId).trim())) {
      return String(directId).trim();
    }
    const text =
      input.message ||
      input.supporter_message ||
      input.notes ||
      input.msg ||
      "";
    return extractDiscordId(text);
  }
  const match = String(input).match(/\b\d{17,20}\b/);
  return match ? match[0] : null;
}

/**
 * Memverifikasi signature atau token webhook secara konstan-waktu (timingSafeEqual).
 * Mendukung pencocokan secret token maupun HMAC SHA-256 dari payload.
 *
 * @param {object} req - Express request object
 * @param {object} options
 * @param {string} [options.envKey]
 * @param {string[]} [options.headerNames]
 * @param {string} [options.secretOverride]
 * @returns {{ok: boolean, reason?: string, method?: string}}
 */
function verifyWebhookSignature(req, { envKey, headerNames = [], secretOverride = null } = {}) {
  const secret = (secretOverride || (envKey ? env[envKey] : "") || "").trim();
  if (!secret) {
    return { ok: false, reason: "unconfigured" };
  }

  let received = null;
  const headers = req.headers || {};
  for (const name of headerNames) {
    const lower = name.toLowerCase();
    if (headers[lower]) {
      received = headers[lower];
      break;
    }
  }

  if (!received) {
    const genericHeaders = ["x-signature", "x-hub-signature-256", "authorization"];
    for (const g of genericHeaders) {
      if (headers[g]) {
        received = headers[g];
        break;
      }
    }
  }

  if (!received) {
    return { ok: false, reason: "missing_signature" };
  }

  const cleanReceived = String(Array.isArray(received) ? received[0] : received)
    .replace(/^Bearer\s+/i, "")
    .replace(/^sha256=/i, "")
    .trim();

  // 1. Pencocokan token langsung secara konstan waktu
  const recHash = crypto.createHash("sha256").update(cleanReceived, "utf8").digest();
  const secHash = crypto.createHash("sha256").update(secret, "utf8").digest();
  if (crypto.timingSafeEqual(recHash, secHash)) {
    return { ok: true, method: "token" };
  }

  // 2. Pencocokan digest HMAC SHA-256 terhadap payload
  let payloadStr = "";
  if (req.rawBody) {
    payloadStr = Buffer.isBuffer(req.rawBody) ? req.rawBody.toString("utf8") : String(req.rawBody);
  } else if (typeof req.body === "string") {
    payloadStr = req.body;
  } else if (req.body && typeof req.body === "object") {
    payloadStr = JSON.stringify(req.body);
  }

  const computedHmac = crypto.createHmac("sha256", secret).update(payloadStr, "utf8").digest("hex");
  const computedHmacBuf = Buffer.from(computedHmac, "utf8");
  const receivedBuf = Buffer.from(cleanReceived, "utf8");

  if (computedHmacBuf.length === receivedBuf.length && crypto.timingSafeEqual(computedHmacBuf, receivedBuf)) {
    return { ok: true, method: "hmac" };
  }

  const hmacSha = crypto.createHash("sha256").update(computedHmac.toLowerCase(), "utf8").digest();
  const recSha = crypto.createHash("sha256").update(cleanReceived.toLowerCase(), "utf8").digest();
  if (crypto.timingSafeEqual(hmacSha, recSha)) {
    return { ok: true, method: "hmac_case_insensitive" };
  }

  return { ok: false, reason: "mismatch" };
}

/**
 * Mengirim notifikasi DM ke user pemegang ID Discord.
 * Gagal kirim DM tidak boleh menggagalkan webhook.
 */
async function notifyUser(client, userId, embed, tag) {
  if (!client || !client.users || typeof client.users.fetch !== "function") {
    return false;
  }
  try {
    const userObj = await client.users.fetch(userId);
    if (userObj && typeof userObj.send === "function") {
      await userObj.send({ embeds: [embed] });
      return true;
    }
    return false;
  } catch (err) {
    logger.info(`[WEBHOOK ${tag}] DM ke ${userId} tidak terkirim: ${err.message}`);
    return false;
  }
}

/**
 * Pabrik handler donasi untuk Express route.
 */
function donationHandler(options) {
  const {
    tag,
    envKey,
    headerNames,
    readAmount,
    readMessage,
    readName,
    readId,
    label,
    client,
    secretOverride,
    extendPremium: customExtendPremium,
    claimOnce: customClaimOnce,
    fingerprint: customFingerprint,
  } = options;

  const extendFn = customExtendPremium || ((uid, ms, tier) => voteRewards.extendPremium(uid, ms, tier));
  const claimOnceFn = customClaimOnce || ((key, ttl) => httpGuard.claimOnce(key, ttl));
  const fingerprintFn = customFingerprint || ((parts) => httpGuard.fingerprint(parts));

  return async (req, res) => {
    // 1. Verifikasi Signature / Token
    const auth = verifyWebhookSignature(req, {
      envKey,
      headerNames,
      secretOverride,
    });

    if (!auth.ok) {
      if (auth.reason === "unconfigured") {
        logger.warn(`[WEBHOOK ${tag}] Kunci secret ${envKey} belum diatur.`);
        return res.status(401).json({ error: "Webhook is not configured or unauthorized" });
      }
      logger.warn(`[WEBHOOK ${tag}] Verifikasi gagal (${auth.reason}). Permintaan ditolak.`);
      return res.status(401).json({ error: "Unauthorized: Invalid webhook signature or token" });
    }

    const body = req.body || {};
    const rawAmount = readAmount(body);
    const amount = Number(rawAmount) || 0;
    const message = readMessage(body) || "";
    const donatorName = readName(body) || "Seseorang";

    // 2. Validasi nominal donasi
    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Bad Request: Missing or invalid donation amount" });
    }

    // 3. Validasi & Parsing ID Discord Snowflake (17-20 digit)
    const userId = extractDiscordId(body) || extractDiscordId(message);
    if (!userId) {
      return res.status(400).json({ error: "Bad Request: No valid 17-20 digit Discord ID found in donation" });
    }

    // 4. Resolusi Tier
    const tier = resolveTier(amount);
    if (!tier) {
      logger.info(`[WEBHOOK ${tag}] Donasi Rp ${amount} oleh ${userId} di bawah tier minimum.`);
      return res.status(200).json({ ok: true, message: "OK: Amount below premium tier", amount });
    }

    // 5. Proteksi Idempotensi (claimOnce)
    const eventId = readId ? readId(body) : null;
    const claimKey = eventId
      ? `webhook:donation:${tag}:${eventId}`
      : `webhook:donation:${tag}:${fingerprintFn([userId, String(amount), message])}`;
    const ttl = eventId ? CLAIM_TTL_WITH_ID : CLAIM_TTL_FINGERPRINT;

    const isFirstClaim = await claimOnceFn(claimKey, ttl);
    if (!isFirstClaim) {
      logger.info(`[WEBHOOK ${tag}] Kiriman ulang donasi untuk ${userId} diabaikan (idempotent).`);
      return res.status(200).json({ ok: true, duplicate: true, message: "OK: duplicate ignored" });
    }

    // 6. Mutasi atomik perpanjangan durasi premium
    try {
      const durationMs = tier.days * 24 * 60 * 60 * 1000;
      const expiry = await extendFn(userId, durationMs, tier.tier);

      // Kirim pesan notifikasi DM ke donatur
      try {
        const embed = new EmbedBuilder()
          .setColor(ui.getColor("economy") || "#FFD700")
          .setTitle(`${ui.getEmoji("naura_impressed") || "💖"} Dukungan ${label} kamu sudah Naura terima!`)
          .setDescription(
            `Terima kasih banyak **${donatorName}** atas dukungannya (Rp ${amount.toLocaleString("id-ID")})!\n\n` +
              "Status **Premium Naura** kamu langsung Naura aktifkan.\n\n" +
              `📦 **Paket aktif:** ${tier.name}\n` +
              `⏳ **Berlaku sampai:** <t:${Math.floor(expiry.getTime() / 1000)}:F>`
          )
          .setFooter({ text: ui.getFooter("premium") });

        await notifyUser(client, userId, embed, tag);
      } catch (notifyErr) {
        logger.info(`[WEBHOOK ${tag}] Gagal kirim notifikasi DM: ${notifyErr.message}`);
      }

      logger.info(
        `[WEBHOOK ${tag}] Sukses memproses donasi Rp ${amount} untuk user ${userId} (${tier.name}).`
      );

      return res.status(200).json({
        success: true,
        message: "Donation Processed Successfully",
        userId,
        tier: tier.name,
        expiry,
      });
    } catch (err) {
      logger.error(`[WEBHOOK ERROR] ${tag}:`, err);
      return res.status(500).json({ error: "Internal Server Error" });
    }
  };
}

/**
 * Membuat router Express untuk webhook donasi.
 * @param {object} [client] - Discord client instance
 * @param {object} [options]
 * @returns {express.Router}
 */
function createDonationWebhooksRouter(client, options = {}) {
  const router = express.Router();

  const saweriaHandler = donationHandler({
    tag: "SAWERIA",
    envKey: "WEBHOOK_AUTH_SAWERIA",
    headerNames: ["saweria-token", "x-saweria-signature", "authorization"],
    readAmount: (b) => b.amount || b.total_amount,
    readMessage: (b) => b.message,
    readName: (b) => b.donator_name || b.donator,
    readId: (b) => b.id || b.transaction_id || null,
    label: "Saweria",
    client,
    secretOverride: options.saweriaSecret,
    extendPremium: options.extendPremium,
    claimOnce: options.claimOnce,
    fingerprint: options.fingerprint,
  });

  const trakteerHandler = donationHandler({
    tag: "TRAKTEER",
    envKey: "WEBHOOK_AUTH_TRAKTEER",
    headerNames: ["x-trakteer-token", "x-trakteer-signature", "authorization"],
    readAmount: (b) => b.amount,
    readMessage: (b) => b.supporter_message || b.message,
    readName: (b) => b.supporter_name || b.donator_name,
    readId: (b) => b.transaction_id || b.id || null,
    label: "Trakteer",
    client,
    secretOverride: options.trakteerSecret,
    extendPremium: options.extendPremium,
    claimOnce: options.claimOnce,
    fingerprint: options.fingerprint,
  });

  // Routing untuk path pendek dan path bersarang /api/webhook
  router.post("/saweria", saweriaHandler);
  router.post("/api/webhook/saweria", saweriaHandler);

  router.post("/trakteer", trakteerHandler);
  router.post("/api/webhook/trakteer", trakteerHandler);

  router.get("/health", (req, res) => res.status(200).json({ ok: true }));
  router.get("/api/webhook/health", (req, res) => res.status(200).json({ ok: true }));

  return router;
}

// Ekspor fungsi utama dan helper untuk pengujian terisolasi
createDonationWebhooksRouter.DONATION_TIERS = DONATION_TIERS;
createDonationWebhooksRouter.resolveTier = resolveTier;
createDonationWebhooksRouter.extractDiscordId = extractDiscordId;
createDonationWebhooksRouter.verifyWebhookSignature = verifyWebhookSignature;
createDonationWebhooksRouter.donationHandler = donationHandler;

module.exports = createDonationWebhooksRouter;
