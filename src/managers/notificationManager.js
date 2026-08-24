"use strict";

const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const UserProfile = require("../models/UserProfile");
const { logger } = require("./logger");

const e = (name, fallback = "") => ui.getEmoji(name) || fallback;
const SNOWFLAKE_REGEX = /^\d{17,20}$/;

/**
 * Memastikan user sudah autorisasi DM. Jika belum, kirim pesan perkenalan terlebih dahulu.
 */
async function ensureDmAuthorized(client, userId, profile) {
  if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) return false;
  if (!client || !client.users) return false;

  const prefs = (profile && profile.notification_prefs) || {
    dm_authorized: false,
    stamina_full: true,
    quest_reset: true,
    event_news: true,
  };

  if (prefs.dm_authorized) return true;

  try {
    const user = await client.users.fetch(userId);
    if (!user) return false;

    const welcomePayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      title: `${e("core", "🌸")} Layanan Notifikasi Pintar Naura`,
      description: [
        `Halo Kak **${user.displayName || user.username}**! ${e("naura_happy", "✨")}`,
        "Naura akan mengirimkan pembaruan penting langsung ke DM kamu untuk:",
        `${e("stamina", "⚡")} **Stamina RPG Penuh** (Jangan sampai energimu terbuang!)`,
        `${e("desc", "📜")} **Quest Reset** (Misi harian baru setiap jam 00:00 WIB)`,
        `${e("clock", "⏰")} **Custom Reminder** (Pengingat waktu yang kamu jadwalkan)`,
        "",
        `> ${e("info", "ℹ️")} **PENTING:** Jika kamu ingin menonaktifkan notifikasi ini, kamu **TIDAK PERLU** menandai sebagai spam. Cukup atur kapan saja lewat command \`/notifications\` di server.`,
        "",
        `Terima kasih sudah berpetualang bersama Naura! ${e("naura_blowkiss", "💖")}`,
      ].join("\n"),
      expression: "happy",
      footerText: ui.getFooter("utility"),
    });

    await user.send(welcomePayload);

    // Update db
    prefs.dm_authorized = true;
    profile.notification_prefs = prefs;
    profile.changed("notification_prefs", true);
    await profile.save({ fields: ["notification_prefs"] });

    return true;
  } catch (err) {
    logger.error(`[NotificationManager] Gagal mengirim pesan autorisasi ke user ${userId}:`, err.message);
    return false;
  }
}

/**
 * Mengirim notifikasi pintar via DM
 * @param {object} client - Discord Client
 * @param {string} userId - Target User ID
 * @param {string} type - 'stamina_full' | 'quest_reset' | 'event_news' | 'custom_reminder'
 * @param {object} payload - Hasil dari buildContainerV2
 */
async function sendNotification(client, userId, type, payload) {
  if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) return false;
  if (!client || !client.users) return false;

  try {
    const profile = await UserProfile.findByPk(userId);
    if (!profile) return false;

    const prefs = profile.notification_prefs || {
      dm_authorized: false,
      stamina_full: true,
      quest_reset: true,
      event_news: true,
    };

    // Cek apakah user mensubscribe notifikasi tipe ini (selain custom reminder)
    if (type !== "custom_reminder" && !prefs[type]) return false;

    // Pastikan autorisasi
    const authorized = await ensureDmAuthorized(client, userId, profile);
    if (!authorized) return false;

    const user = await client.users.fetch(userId);
    if (!user) return false;

    await user.send(payload);
    return true;
  } catch (err) {
    logger.warn(`[NotificationManager] Gagal mengirim notif ${type} ke ${userId}: ${err.message}`);
    return false;
  }
}

module.exports = {
  sendNotification,
  ensureDmAuthorized,
};
