const { Client, MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const UserProfile = require("../models/UserProfile");
const { logger } = require("./logger");

/**
 * Memastikan user sudah autorisasi DM. Jika belum, kirim pesan perkenalan terlebih dahulu.
 */
async function ensureDmAuthorized(client, userId, profile) {
  const prefs = profile.notification_prefs || {
    dm_authorized: false,
    stamina_full: true,
    quest_reset: true,
    event_news: true
  };

  if (prefs.dm_authorized) return true;

  try {
    const user = await client.users.fetch(userId);
    if (!user) return false;

    const welcomePayload = buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      title: "👋 Hai! Ini layanan Notifikasi DM Naura!",
      description: [
        "Naura akan mengirimkan pesan ke DM ini untuk memberitahu kamu tentang:",
        "⚔️ **Stamina Penuh** (Jangan sampai energi terbuang!)",
        "📜 **Quest Reset** (Misi baru setiap jam 00:00)",
        "⏰ **Custom Reminder** (Timer yang kamu buat sendiri)",
        "",
        "> **PENTING:** Jika kamu merasa terganggu, kamu **TIDAK PERLU** melaporkan bot ini sebagai spam! Cukup matikan kapan saja dengan mengetik `/notification` di server.",
        "",
        "Terima kasih sudah menggunakan Naura Hoshino V2! ❤️"
      ].join("\n"),
      expression: "Happy",
      footerText: "Ketik /notification di server untuk mematikan notifikasi"
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
 * @param {Client} client 
 * @param {string} userId 
 * @param {string} type - 'stamina_full' | 'quest_reset' | 'event_news' | 'custom_reminder'
 * @param {object} payload - Hasil dari buildContainerV2
 */
async function sendNotification(client, userId, type, payload) {
  try {
    const profile = await UserProfile.findByPk(userId);
    if (!profile) return false;

    const prefs = profile.notification_prefs || {
      dm_authorized: false,
      stamina_full: true,
      quest_reset: true,
      event_news: true
    };

    // Cek apakah user mensubscribe notifikasi tipe ini (selain custom reminder, custom reminder default masuk asal authorized)
    if (type !== 'custom_reminder' && !prefs[type]) return false;

    // Pastikan autorisasi
    const authorized = await ensureDmAuthorized(client, userId, profile);
    if (!authorized) return false;

    const user = await client.users.fetch(userId);
    if (!user) return false;

    // Tambahkan footer anti-spam
    payload.embeds = payload.embeds || [];
    if (payload.embeds[0]) {
       // Modifikasi embed V2 sudah menggunakan structure flat atau embeds array. 
       // Karena menggunakan buildContainerV2, footer bisa jadi sudah ada, tapi kita timpa saja di object jika perlu.
       // Tapi buildContainerV2 me-return JSON payload.
    }
    
    // Kita cuma perlu send
    await user.send(payload);
    return true;
  } catch (err) {
    logger.warn(`[NotificationManager] Gagal mengirim notif ${type} ke ${userId}:`, err.message);
    return false;
  }
}

module.exports = {
  sendNotification,
  ensureDmAuthorized
};
