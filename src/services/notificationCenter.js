"use strict";

const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");

const DEFAULT_PREFS = {
  stamina_full: true,
  daily_streak: true,
  stock_alert: true,
  idle_revenue: true,
  vote_reminder: true,
};

const NOTIFICATION_TEMPLATES = {
  stamina_full: {
    title: "⚡ Stamina Survival Telah Pulih!",
    accentColor: "#38BDF8",
    expression: "cheer",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Stamina energimu saat ini telah pulih penuh (**100/100**). Kamu sudah siap kembali menjelajah Dungeon, Menebang, atau Memancing!`,
  },
  daily_streak: {
    title: "🔥 Pengingat Daily Streak Naura",
    accentColor: "#F59E0B",
    expression: "wink",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Jangan lupa untuk mengklaim hadiah harianmu hari ini dengan command \`/daily\` agar streak keberuntunganmu tetap terjaga!`,
  },
  stock_alert: {
    title: "📈 Peringatan Pasar Saham $NRA",
    accentColor: "#10B981",
    expression: "happy",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Terjadi pergerakan harga signifikan pada pasar saham **${data.symbol || "$NRA"}** (Harga saat ini: **${data.price || "0"} NC**). Cek portofoliomu dengan \`/stock portfolio\`!`,
  },
  idle_revenue: {
    title: "🎪 Pendapatan Pasif Siap Diklaim!",
    accentColor: "#EC4899",
    expression: "love",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Vivarium Akuarium dan Kafemu telah menghasilkan pendapatan pasif sebesar **+${data.amount || "0"} Naura Coins**. Gunakan \`/survival cafe claim\` untuk mencairkannya!`,
  },
  vote_reminder: {
    title: "🗳️ Waktunya Vote & Klaim VIP Trial!",
    accentColor: "#FFD700",
    expression: "cheer",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Cooldown voting Top.gg kamu telah selesai. Berikan dukunganmu sekarang dengan \`/vote\` dan dapatkan **Trial V.I.P 12 Jam** instan!`,
  },
};

/**
 * Ambil preferensi notifikasi user (dengan default aman).
 */
async function getUserPreferences(userId) {
  try {
    const profile = await cacheManager.getUserProfile(userId);
    const prefs = profile?.notification_prefs;
    if (prefs && typeof prefs === "object") {
      return { ...DEFAULT_PREFS, ...prefs };
    }
  } catch (err) {
    logger.warn(
      `[NotificationCenter] Gagal mengambil preferensi user ${userId}: ${err.message}`,
    );
  }
  return { ...DEFAULT_PREFS };
}

/**
 * Update preferensi notifikasi user.
 */
async function setUserPreference(userId, key, enabled) {
  if (!(key in DEFAULT_PREFS)) {
    throw new Error(`Kunci notifikasi "${key}" tidak valid.`);
  }

  const currentPrefs = await getUserPreferences(userId);
  currentPrefs[key] = Boolean(enabled);

  await cacheManager.mutateUserProfileJson(
    userId,
    "notification_prefs",
    (prefs) => {
      const obj = prefs && typeof prefs === "object" ? prefs : {};
      obj[key] = Boolean(enabled);
      return obj;
    },
  );

  return currentPrefs;
}

/**
 * Kirim notifikasi cerdas via DM ke pengguna.
 * @param {object} client - Discord Client
 * @param {string} userId - ID Pengguna Discord
 * @param {string} type - Tipe notifikasi ('stamina_full' | 'daily_streak' | 'stock_alert' | 'idle_revenue' | 'vote_reminder')
 * @param {object} [data] - Data payload tambahan
 */
async function sendDirectNotification(client, userId, type, data = {}) {
  const template = NOTIFICATION_TEMPLATES[type];
  if (!template) {
    logger.warn(`[NotificationCenter] Template "${type}" tidak dikenali.`);
    return false;
  }

  // Periksa apakah user mengaktifkan notifikasi tipe ini
  const prefs = await getUserPreferences(userId);
  if (!prefs[type]) {
    return false;
  }

  try {
    const user = await client.users.fetch(userId);
    if (!user) return false;

    const displayName = user.displayName || user.username || "Kakak";
    const description = template.renderMessage(data, displayName);

    const payload = buildContainerV2({
      accentColorHex: template.accentColor,
      title: template.title,
      description: `${description}\n\n-# *Kamu bisa mengatur preferensi notifikasi DM kapan saja dengan command \`/notifications\`.*`,
      expression: template.expression,
      footerText: ui.getFooter("utility"),
    });

    await user.send(payload);
    logger.info(
      `[NotificationCenter] DM ${type} berhasil dikirim ke ${user.tag} (${userId}).`,
    );
    return true;
  } catch (err) {
    // Error jika user mematikan DM dari server/bot
    logger.debug(
      `[NotificationCenter] Gagal kirim DM ke ${userId} (${err.message}).`,
    );
    return false;
  }
}

module.exports = {
  DEFAULT_PREFS,
  NOTIFICATION_TEMPLATES,
  getUserPreferences,
  setUserPreference,
  sendDirectNotification,
};
