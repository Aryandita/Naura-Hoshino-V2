"use strict";

const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");

const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const e = (name, fallback = "") => ui.getEmoji(name) || fallback;

const DEFAULT_PREFS = {
  stamina_full: true,
  daily_streak: true,
  stock_alert: true,
  idle_revenue: true,
  vote_reminder: true,
  quest_reset: true,
  event_news: true,
};

const NOTIFICATION_TEMPLATES = {
  stamina_full: {
    title: `${ui.getEmoji("stamina") || "⚡"} Stamina Survival Telah Pulih!`,
    accentColor: "#38BDF8",
    expression: "cheer",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Stamina energimu saat ini telah pulih penuh (**100/100**). Kamu sudah siap kembali menjelajah Dungeon, Menebang, atau Memancing!`,
  },
  daily_streak: {
    title: `${ui.getEmoji("fire") || "🔥"} Pengingat Daily Streak Naura`,
    accentColor: "#F59E0B",
    expression: "wink",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Jangan lupa untuk mengklaim hadiah harianmu hari ini dengan command \`/daily\` agar streak keberuntunganmu tetap terjaga!`,
  },
  stock_alert: {
    title: `${ui.getEmoji("chart") || "📈"} Peringatan Pasar Saham $NRA`,
    accentColor: "#10B981",
    expression: "happy",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Terjadi pergerakan harga signifikan pada pasar saham **${data.symbol || "$NRA"}** (Harga saat ini: **${data.price || "0"} NC**). Cek portofoliomu dengan \`/stock portfolio\`!`,
  },
  idle_revenue: {
    title: `${ui.getEmoji("cafe") || "🎪"} Pendapatan Pasif Siap Diklaim!`,
    accentColor: "#EC4899",
    expression: "love",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Vivarium Akuarium dan Kafemu telah menghasilkan pendapatan pasif sebesar **+${data.amount || "0"} Naura Coins**. Gunakan \`/survival cafe claim\` untuk mencairkannya!`,
  },
  vote_reminder: {
    title: `${ui.getEmoji("topgg") || "🗳️"} Waktunya Vote & Klaim VIP Trial!`,
    accentColor: "#FFD700",
    expression: "cheer",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Cooldown voting Top.gg kamu telah selesai. Berikan dukunganmu sekarang dengan \`/vote\` dan dapatkan **Trial V.I.P 12 Jam** instan!`,
  },
  quest_reset: {
    title: `${ui.getEmoji("desc") || "📜"} Quest Harian RPG Direset!`,
    accentColor: "#38BDF8",
    expression: "happy",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! Misi Harian (Daily Quest) RPG kamu sudah diperbarui. Yuk cek \`/survival rpg quest\` dan kumpulkan hadiahnya hari ini!`,
  },
  event_news: {
    title: `${ui.getEmoji("star") || "🌟"} Berita Event Spesial Naura`,
    accentColor: "#A855F7",
    expression: "cheer",
    renderMessage: (data, displayName) =>
      `Halo Kak **${displayName}**! ${data.message || "Ada event spesial baru yang sedang berlangsung di server! Yuk cek sekarang sebelum berakhir~"}`,
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
      const obj =
        prefs && typeof prefs === "object" ? prefs : { ...DEFAULT_PREFS };
      obj[key] = Boolean(enabled);
      return obj;
    },
  );

  return currentPrefs;
}

/**
 * Memastikan user sudah autorisasi DM. Jika belum, kirim pesan perkenalan terlebih dahulu.
 */
async function ensureDmAuthorized(client, userId, profile) {
  if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) return false;
  if (!client || !client.users) return false;

  const prefs = (profile && profile.notification_prefs) || {
    dm_authorized: false,
    ...DEFAULT_PREFS,
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
        `${e("fire", "🔥")} **Daily Streak** (Pertahankan streak harianmu)`,
        `${e("chart", "📈")} **Pasar Saham** (Alert pergerakan harga saham)`,
        `${e("cafe", "🎪")} **Kafe & Vivarium** (Pendapatan pasif yang siap diambil)`,
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

    await cacheManager.mutateUserProfileJson(
      userId,
      "notification_prefs",
      (cur) => {
        const obj = cur && typeof cur === "object" ? cur : { ...DEFAULT_PREFS };
        obj.dm_authorized = true;
        return obj;
      },
    );

    return true;
  } catch (err) {
    logger.error(
      `[NotificationCenter] Gagal mengirim pesan autorisasi ke user ${userId}:`,
      err.message,
    );
    return false;
  }
}

/**
 * Kirim notifikasi cerdas via DM ke pengguna.
 * @param {object} client - Discord Client
 * @param {string} userId - ID Pengguna Discord
 * @param {string} type - Tipe notifikasi
 * @param {object} [dataOrPayload] - Objek data untuk template ATAU payload siap kirim
 */
async function sendDirectNotification(
  client,
  userId,
  type,
  dataOrPayload = {},
) {
  if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) return false;
  if (!client || !client.users) return false;

  try {
    const profile = await cacheManager.getUserProfile(userId);
    const prefs = await getUserPreferences(userId);

    // Cek apakah user mensubscribe notifikasi tipe ini (selain custom reminder)
    if (type !== "custom_reminder" && !prefs[type]) return false;

    // Pastikan autorisasi DM
    const authorized = await ensureDmAuthorized(client, userId, profile);
    if (!authorized) return false;

    const user = await client.users.fetch(userId);
    if (!user) return false;

    let payload;
    if (
      dataOrPayload.components ||
      dataOrPayload.content ||
      dataOrPayload.embeds
    ) {
      payload = dataOrPayload;
    } else {
      const template = NOTIFICATION_TEMPLATES[type];
      if (!template) {
        logger.warn(`[NotificationCenter] Template "${type}" tidak dikenali.`);
        return false;
      }
      const displayName = user.displayName || user.username || "Kakak";
      const description = template.renderMessage(dataOrPayload, displayName);
      payload = buildContainerV2({
        accentColorHex: template.accentColor,
        title: template.title,
        description: `${description}\n\n-# *Kamu bisa mengatur preferensi notifikasi DM kapan saja dengan command \`/notifications\`.*`,
        expression: template.expression,
        footerText: ui.getFooter("utility"),
      });
    }

    await user.send(payload);
    logger.info(
      `[NotificationCenter] DM ${type} berhasil dikirim ke ${user.tag || user.username} (${userId}).`,
    );
    return true;
  } catch (err) {
    logger.warn(
      `[NotificationCenter] Gagal mengirim notifikasi ${type} ke ${userId}: ${err.message}`,
    );
    return false;
  }
}

module.exports = {
  DEFAULT_PREFS,
  NOTIFICATION_TEMPLATES,
  getUserPreferences,
  setUserPreference,
  ensureDmAuthorized,
  sendDirectNotification,
  sendNotification: sendDirectNotification,
};
