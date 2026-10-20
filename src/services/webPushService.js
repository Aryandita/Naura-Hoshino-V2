"use strict";

const crypto = require("node:crypto");
const { logger } = require("../managers/logger");

let vapidKeyPair = null;

function base64UrlEncode(buffer) {
  return Buffer.from(buffer)
    .toString("base64")
    .replace(/=/g, "")
    .replace(/\+/g, "-")
    .replace(/\//g, "_");
}

function initVapidKeys() {
  if (vapidKeyPair) return vapidKeyPair;

  try {
    const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
      namedCurve: "prime256v1",
      publicKeyEncoding: { type: "spki", format: "der" },
      privateKeyEncoding: { type: "pkcs8", format: "der" },
    });

    // P-256 uncompressed public key: 65 bytes starting with 0x04
    // Di DER SPKI, 65 byte raw public key terletak di 65 byte terakhir
    const rawPublicKey = publicKey.subarray(publicKey.length - 65);

    vapidKeyPair = {
      publicKeyDer: publicKey,
      privateKeyDer: privateKey,
      rawPublicKey,
      publicKeyBase64Url: base64UrlEncode(rawPublicKey),
      privateKeyObject: crypto.createPrivateKey({
        key: privateKey,
        format: "der",
        type: "pkcs8",
      }),
    };
  } catch (err) {
    logger.warn(`[WebPush] Gagal generate ECDSA keypair: ${err.message}`);
  }

  return vapidKeyPair;
}

/**
 * Mendapatkan Public Key VAPID dalam format Base64URL untuk browser PWA.
 * @returns {string}
 */
function getVapidPublicKey() {
  const keys = initVapidKeys();
  return keys ? keys.publicKeyBase64Url : "";
}

/**
 * Membuat VAPID JWT Token bertanda tangan ES256 untuk origin endpoint.
 * @param {string} audience
 * @param {string} [subject='mailto:admin@naurahoshino.com']
 * @returns {string|null}
 */
function createVapidToken(audience, subject = "mailto:admin@naurahoshino.com") {
  const keys = initVapidKeys();
  if (!keys) return null;

  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    aud: audience,
    exp: now + 86400,
    sub: subject,
  };

  const encodedHeader = base64UrlEncode(JSON.stringify(header));
  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const unsignedToken = `${encodedHeader}.${encodedPayload}`;

  const signer = crypto.createSign("SHA256");
  signer.update(unsignedToken);
  signer.end();

  const signature = signer.sign({
    key: keys.privateKeyObject,
    dsaEncoding: "ieee-p1363",
  });

  return `${unsignedToken}.${base64UrlEncode(signature)}`;
}

/**
 * Mengirim notifikasi push ke satu browser client subscription.
 * @param {object} sub - PushSubscription object dari browser
 * @param {object} notificationPayload
 * @returns {Promise<{success: boolean, status?: number, error?: string}>}
 */
async function sendPushNotification(sub, notificationPayload = {}) {
  const subscription = sub?.subscription || sub;
  const endpoint = subscription?.endpoint;

  if (!endpoint || typeof endpoint !== "string" || !endpoint.startsWith("https://")) {
    return { success: false, error: "Invalid subscription endpoint" };
  }

  try {
    const endpointUrl = new URL(endpoint);
    const audience = `${endpointUrl.protocol}//${endpointUrl.host}`;
    const token = createVapidToken(audience);
    const vapidKey = getVapidPublicKey();

    const headers = {
      TTL: "86400",
      Urgency: "high",
    };

    if (token && vapidKey) {
      headers["Authorization"] = `vapid t=${token}, k=${vapidKey}`;
    }

    const bodyString = typeof notificationPayload === "string"
      ? notificationPayload
      : JSON.stringify(notificationPayload);

    // Kirim request ke endpoint FCM / WebPush Browser
    const res = await globalThis.fetch(endpoint, {
      method: "POST",
      headers,
      body: bodyString,
    });

    if (res.status === 200 || res.status === 201 || res.status === 202) {
      return { success: true, status: res.status };
    }

    // Jika subscription sudah kedaluwarsa (HTTP 404 / 410 Gone)
    if (res.status === 404 || res.status === 410) {
      return { success: false, status: res.status, expired: true };
    }

    return { success: false, status: res.status, error: `HTTP ${res.status}` };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

/**
 * Mengirim notifikasi push ke seluruh subscriber terdaftar.
 * @param {object} payload
 * @returns {Promise<{total: number, sent: number, failed: number}>}
 */
async function broadcastPush(payload) {
  let subscribers = [];
  try {
    const { pushState } = require("../../dashboard/routes/api/helpers");
    subscribers = await pushState.getAllSubscriptions();
  } catch (_) {
    subscribers = [];
  }

  if (!Array.isArray(subscribers) || subscribers.length === 0) {
    return { total: 0, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;

  for (const sub of subscribers) {
    const res = await sendPushNotification(sub, payload);
    if (res.success) {
      sent += 1;
    } else {
      failed += 1;
      if (res.expired && sub.userId) {
        try {
          const { pushState } = require("../../dashboard/routes/api/helpers");
          await pushState.deleteSubscription(sub.userId);
        } catch (_) {}
      }
    }
  }

  return { total: subscribers.length, sent, failed };
}

/**
 * Pemicu notifikasi saat World Boss bangkit di Aetheria / Naura Wilds.
 * @param {object} params
 * @param {string} params.bossName
 * @param {number} [params.level=1]
 * @param {string} [params.location='Lembah Bintang']
 * @param {number} [params.rewardNsf=5000]
 */
async function notifyWorldBossSpawn({ bossName = "Dragon of The Abyss", level = 1, location = "Lembah Bintang", rewardNsf = 5000 } = {}) {
  const payload = {
    title: "⚔️ World Boss Telah Bangkit!",
    body: `${bossName} (Lv. ${level}) muncul di ${location}! Taklukkan bersama klanmu untuk merebut +${rewardNsf.toLocaleString("id-ID")} NSF!`,
    icon: "/naura_3d_closeup.png",
    badge: "/naura_3d_closeup.png",
    tag: "world-boss-spawn",
    url: "/world",
    data: {
      type: "world_boss",
      bossName,
      location,
      rewardNsf,
    },
  };

  return broadcastPush(payload);
}

/**
 * Pemicu notifikasi saat reset harian tiba (00:00 WIB / 00:00 UTC).
 * @param {object} [params]
 * @param {string} [params.date]
 * @param {number} [params.streakBonusPercent=25]
 */
async function notifyDailyReset({ date = new Date().toISOString().split("T")[0], streakBonusPercent = 25 } = {}) {
  const payload = {
    title: "🌅 Reset Harian Naura Wilds!",
    body: `Misi harian baru & jatah energi telah diperbarui! Selesaikan quest hari ini untuk menjaga bonus streak +${streakBonusPercent}% NSF!`,
    icon: "/naura_3d_closeup.png",
    badge: "/naura_3d_closeup.png",
    tag: "daily-reset-alert",
    url: "/activity",
    data: {
      type: "daily_reset",
      date,
    },
  };

  return broadcastPush(payload);
}

/**
 * Pemicu notifikasi penyergapan karavan dagang klan.
 * @param {object} ambushData
 */
async function notifyCaravanAmbush(ambushData = {}) {
  const route = ambushData.routeName || "Rute Perdagangan";
  const raider = ambushData.raiderName || "Perompak Gurun";

  const payload = {
    title: "🚨 Karavan Dagang Diserang!",
    body: `Karavan dagang di ${route} sedang diserang oleh ${raider}! Buka War Room untuk mengirim bantuan!`,
    icon: "/naura_3d_closeup.png",
    badge: "/naura_3d_closeup.png",
    tag: "caravan-ambush",
    url: "/war-room",
    data: ambushData,
  };

  return broadcastPush(payload);
}

module.exports = {
  getVapidPublicKey,
  createVapidToken,
  sendPushNotification,
  broadcastPush,
  notifyWorldBossSpawn,
  notifyDailyReset,
  notifyCaravanAmbush,
};
