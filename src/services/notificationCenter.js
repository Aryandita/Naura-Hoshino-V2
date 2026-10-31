"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
const ui = require("../config/ui");
const { ValidationError } = require("../errors/DomainError");
const UserCafe = require("../models/UserCafe");

const SNOWFLAKE_REGEX = /^\d{17,20}$/;
const e = (name, fallback = "") => ui.getEmoji(name) || fallback;

const DEFAULT_DIGEST_COOLDOWN_MS = 4 * 60 * 60 * 1000; // 4 jam sliding cooldown window
const digestCooldownCache = new Map(); // In-memory fast cache: userId -> timestamp

const DEFAULT_PREFS = {
  adventure_digest: true,
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
 * Generate 10-block visual progress bar with Unicode block characters.
 * @param {number} current
 * @param {number} max
 * @param {number} size
 * @returns {string} e.g. [██████████] 100/100
 */
function generateProgressBar(current, max, size = 10) {
  const rawMax = Number(max);
  const safeMax = Number.isNaN(rawMax) ? 100 : Math.max(1, rawMax);
  const rawCurrent = Number(current);
  const safeCurrent = Number.isNaN(rawCurrent) ? 0 : Math.max(0, rawCurrent);
  const ratio = Math.min(1, safeCurrent / safeMax);
  const filledBlocks = Math.round(ratio * size);
  const emptyBlocks = Math.max(0, size - filledBlocks);
  const bar = "█".repeat(filledBlocks) + "░".repeat(emptyBlocks);
  return `[${bar}] ${safeCurrent}/${safeMax}`;
}

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
    throw new ValidationError(`Kunci notifikasi "${key}" tidak valid.`);
  }

  const currentPrefs = await getUserPreferences(userId);
  currentPrefs[key] = Boolean(enabled);

  await cacheManager.mutateUserProfileJson(
    userId,
    "notification_prefs",
    (prefs) => {
      const obj = prefs && typeof prefs === "object" ? prefs : { ...DEFAULT_PREFS };
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
    const user = await client.users.fetch(userId).catch(() => null);
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
 * Evaluasi status kesiapan (readiness) multi-sistem pemain:
 * 1. Stamina RPG (penuh atau mendekati maksimal)
 * 2. Misi Harian RPG (baru reset / siap diklaim / sedang berlangsung)
 * 3. Pendapatan Kafe Sukamaju (akumulasi passive revenue >= 500 SC)
 * 4. Streak Login Harian (siap diklaim / hampir hangus 36-48 jam)
 *
 * @param {string} userId - ID Pengguna Discord
 * @param {object} [client] - Discord Client
 * @param {object} [options] - Opsi override (misal profile/survivalData untuk pengujian)
 * @returns {Promise<object>} Status kesiapan terperinci
 */
async function aggregateUserReadiness(userId, client = null, options = {}) {
  const profile = options.profile !== undefined ? options.profile : (await cacheManager.getUserProfile(userId).catch(() => null));
  const survival = options.survivalData !== undefined ? options.survivalData : (await cacheManager.getUserSurvival(userId).catch(() => null));
  const prefs = options.prefs !== undefined ? options.prefs : (await getUserPreferences(userId));

  const now = Date.now();

  // 1. Evaluasi Stamina
  let maxStamina = 100;
  try {
    const { getUserPremiumTier, getMaxEnergy } = require("../premium/premiumHelper");
    maxStamina = getMaxEnergy(getUserPremiumTier(profile));
  } catch (_) {
    maxStamina = 100;
  }
  const currentStamina = Number(survival?.stamina ?? 0);
  const staminaReady = currentStamina >= maxStamina || currentStamina >= 100;
  const staminaPercentage = Math.round((currentStamina / maxStamina) * 100);
  const staminaProgressBar = generateProgressBar(currentStamina, maxStamina, 10);

  // 2. Evaluasi Quest Harian
  let questReady = false;
  let questStatus = "NONE";
  const questDetails = {
    title: null,
    progress: 0,
    target: 0,
    claimed: false,
    isNew: false,
    emoji: "📜",
  };

  let qState = options.questData !== undefined ? options.questData : options.questState;
  if (qState === undefined) {
    try {
      const { getQuestState } = require("../survival/engines/dailyQuestEngine");
      qState = await getQuestState(userId);
    } catch (err) {
      logger.debug(`[NotificationCenter:aggregateUserReadiness] Quest state check: ${err.message}`);
    }
  }

  if (qState) {
    questDetails.claimed = Boolean(qState.claimed);
    questDetails.isNew = Boolean(qState.isNew);
    questDetails.progress = Number(qState.progress || 0);

    if (qState.quest) {
      questDetails.title = qState.quest.title || null;
      questDetails.target = Number(qState.quest.target || 0);
      questDetails.emoji = qState.quest.emoji || "📜";
    }

    if (qState.isNew || !qState.quest) {
      questStatus = "READY_TO_START";
      questReady = true;
    } else if (qState.quest && !qState.claimed && questDetails.progress >= questDetails.target) {
      questStatus = "READY_TO_CLAIM";
      questReady = true;
    } else if (qState.quest && !qState.claimed) {
      questStatus = "IN_PROGRESS";
      questReady = false;
    } else if (qState.claimed) {
      questStatus = "COMPLETED";
      questReady = false;
    }
  }

  // 3. Evaluasi Pendapatan Kafe
  let cafeReady = false;
  let cafeRevenue = 0;
  const cafeDetails = {
    cafeName: "Cyber Maid Lounge",
    level: 1,
    reputation: 0,
    uncollectedRevenue: 0,
  };

  try {
    let cafe = options.cafeData;
    if (!cafe) {
      cafe = await UserCafe.findByPk(userId).catch(() => null);
    }
    if (cafe) {
      cafeDetails.cafeName = cafe.cafeName || "Cyber Maid Lounge";
      cafeDetails.level = Number(cafe.level || 1);
      cafeDetails.reputation = Number(cafe.reputation || 0);

      const lastTime = cafe.lastCollectedAt ? new Date(cafe.lastCollectedAt).getTime() : now;
      const hoursPassed = Math.min(24, Math.max(0, (now - lastTime) / (1000 * 60 * 60)));
      const hourlyRate = cafeDetails.level * 35 + Math.floor(cafeDetails.reputation * 0.5);
      const addedRevenue = Math.floor(hoursPassed * hourlyRate);
      cafeRevenue = Number(cafe.uncollectedRevenue || 0) + addedRevenue;
      cafeDetails.uncollectedRevenue = cafeRevenue;
      cafeReady = cafeRevenue >= 500;
    }
  } catch (err) {
    logger.debug(`[NotificationCenter:aggregateUserReadiness] Cafe revenue check: ${err.message}`);
  }

  // 4. Evaluasi Daily Login Streak
  const cooldowns = profile?.cooldowns || {};
  const rawLastDaily = cooldowns.daily ? new Date(cooldowns.daily).getTime() : 0;
  const lastDaily = Number.isFinite(rawLastDaily) ? rawLastDaily : 0;
  const currentStreak = Number(cooldowns.daily_streak || 0);
  const timeDiff = now - lastDaily;

  const DAILY_COOLDOWN_MS = 24 * 60 * 60 * 1000;      // 24 jam
  const GRACE_PERIOD_MS = 48 * 60 * 60 * 1000;         // 48 jam
  const EXPIRING_THRESHOLD_MS = 36 * 60 * 60 * 1000;   // 36 jam (sisa 12 jam sebelum hangus)

  const canClaim = timeDiff >= DAILY_COOLDOWN_MS || lastDaily === 0;
  const isExpiring = currentStreak > 0 && timeDiff >= EXPIRING_THRESHOLD_MS && timeDiff < GRACE_PERIOD_MS;
  const streakReady = canClaim || isExpiring;

  const hoursPassed = Math.floor(timeDiff / (1000 * 60 * 60));
  const hoursLeftBeforeReset = Math.max(0, Math.floor((GRACE_PERIOD_MS - timeDiff) / (1000 * 60 * 60)));
  const nextRewardDay = ((currentStreak) % 7) + 1;

  // Rekonsiliasi kesiapan berdasarkan preferensi user
  const readyItems = [];
  const eligibleItems = [];

  if (staminaReady) {
    readyItems.push("stamina");
    if (prefs.stamina_full !== false) eligibleItems.push("stamina");
  }

  if (questReady) {
    readyItems.push("quest");
    if (prefs.quest_reset !== false) eligibleItems.push("quest");
  }

  if (cafeReady) {
    readyItems.push("cafe");
    if (prefs.idle_revenue !== false) eligibleItems.push("cafe");
  }

  if (streakReady) {
    readyItems.push("streak");
    if (prefs.daily_streak !== false) eligibleItems.push("streak");
  }

  return {
    userId,
    evaluatedAt: new Date(now),
    stamina: {
      ready: staminaReady,
      current: currentStamina,
      max: maxStamina,
      percentage: staminaPercentage,
      progressBar: staminaProgressBar,
    },
    quest: {
      ready: questReady,
      status: questStatus,
      questTitle: questDetails.title,
      questEmoji: questDetails.emoji,
      progress: questDetails.progress,
      target: questDetails.target,
      claimed: questDetails.claimed,
      isNew: questDetails.isNew,
    },
    cafe: {
      ready: cafeReady,
      totalRevenue: cafeRevenue,
      cafeName: cafeDetails.cafeName,
      level: cafeDetails.level,
    },
    streak: {
      ready: streakReady,
      currentStreak,
      canClaim,
      isExpiring,
      hoursPassed,
      hoursLeftBeforeReset,
      nextRewardDay,
    },
    readyItems,
    eligibleItems,
    hasAnyEligible: eligibleItems.length > 0,
  };
}

/**
 * Bangun container Discord Components V2 terpadu untuk Adventure Digest.
 *
 * @param {object} params
 * @param {object} params.user - Discord User objek atau mock
 * @param {object} [params.survivalData] - Data survival pengguna
 * @param {object} params.readiness - Hasil dari aggregateUserReadiness
 * @param {string} [params.lang="id"] - Bahasa antarmuka
 * @param {string} [params.displayName] - Nama tampilan pengguna
 * @returns {object} Discord Components V2 payload
 */
function buildAdventureDigestContainer({ user, survivalData = null, readiness, lang = "id", displayName = null }) {
  const name = displayName || (user ? (user.displayName || user.username) : "Petualang");
  const userId = user?.id || readiness.userId || "0";

  // Dynamic dialogue quips
  const dialogueQuips = [
    `Halo Kak **${name}**! Naura bawakan rangkuman petualanganmu hari ini nih~ Banyak hal seru yang sudah siap kamu klaim lho! ✨`,
    `Semangat hari ini, Kak **${name}**! Alam liar Sukamaju dan kafemu menyimpan banyak kabar baik yang siap kamu raih!`,
    `Wah, energimu sudah terisi penuh dan ada rezeki yang menunggu di kafe! Yuk cek persiapan petualanganmu hari ini, Kak **${name}**~`,
    `Langkah kecil hari ini, petualangan legendaris esok hari! Yuk cek persiapan petualanganmu, Kak **${name}**:`,
  ];
  // Seed deterministik sederhana berbasis userId & jam agar tidak berubah-ubah dalam render yang sama
  const quipIndex = Math.abs(Number(userId.slice(-4) || 0) + new Date().getHours()) % dialogueQuips.length;
  const dialogueText = dialogueQuips[quipIndex];

  // Dynamic avatar expression and accent color
  let expression = "happy";
  let accentColorHex = "#38BDF8"; // Sky blue default

  if (readiness.streak?.isExpiring) {
    expression = "wink";
    accentColorHex = "#F59E0B"; // Gold / amber warning
  } else if (readiness.eligibleItems?.length >= 3) {
    expression = "cheers";
    accentColorHex = readiness.cafe?.totalRevenue >= 2000 ? "#10B981" : "#38BDF8";
  }

  // Susun 4 Fields informasi status
  const fields = [];

  // Field 1: Stamina
  const staminaStatus = readiness.stamina?.ready
    ? "Pulih Maksimal ⚡"
    : `${readiness.stamina?.percentage || 0}%`;
  const staminaRecommendation = readiness.stamina?.ready
    ? "• Rekomendasi: Taklukkan Dungeon atau Bekerja di Sukamaju"
    : "• Energi sedang mengisi kembali (+1 per 3 menit)";
  fields.push({
    name: "⚡ Stamina Petualangan",
    value: `\`${readiness.stamina?.progressBar || "[██████████] 100/100"}\` • ${staminaStatus}\n${staminaRecommendation}`,
  });

  // Field 2: Daily Quest
  let questDesc = "• Status: 🌟 Misi Harian Baru Siap Dimulai!\n• Buka papan quest untuk melihat tugas hari ini";
  if (readiness.quest?.status === "READY_TO_CLAIM") {
    questDesc = `• Status: 🎁 Siap Diklaim! (${readiness.quest.progress}/${readiness.quest.target} Selesai)\n• Hadiah: +Star Fragments & Bonus XP menunggumu!`;
  } else if (readiness.quest?.status === "IN_PROGRESS") {
    questDesc = `• Status: ⚔️ Sedang Berlangsung (${readiness.quest.progress}/${readiness.quest.target})\n• Misi: ${readiness.quest.questTitle || "Tugas Petualangan"}`;
  } else if (readiness.quest?.status === "COMPLETED") {
    questDesc = "• Status: ✅ Selesai Hari Ini\n• Misi harian berikutnya hadir pukul 00:00 WIB";
  }
  fields.push({
    name: "📜 Quest Harian RPG",
    value: questDesc,
  });

  // Field 3: Cafe & Vivarium
  let cafeDesc = `• Akumulasi: **+${Number(readiness.cafe?.totalRevenue || 0).toLocaleString("id-ID")} Sukamaju Koin (SC)** 🪙\n• Status: 🎪 Siap Dicairkan ke Saldo Utama`;
  if (!readiness.cafe?.ready) {
    cafeDesc = `• Akumulasi: **${Number(readiness.cafe?.totalRevenue || 0).toLocaleString("id-ID")} SC** 🪙\n• Status: Pengunjung kafe sedang berdatangan`;
  }
  fields.push({
    name: "☕ Pendapatan Kafe & Vivarium",
    value: cafeDesc,
  });

  // Field 4: Daily Login Streak
  let streakDesc = `• Rantai Streak: **${readiness.streak?.currentStreak || 0} Hari Berturut-turut** 🔥\n• Klaim Hari Ini: 🎁 Siap Diklaim! (Hari ke-${readiness.streak?.nextRewardDay || 1})`;
  if (readiness.streak?.isExpiring) {
    streakDesc = `• Rantai Streak: **${readiness.streak?.currentStreak || 0} Hari** ⚠️ (Sisa Waktu: ${readiness.streak?.hoursLeftBeforeReset} Jam!)\n• Segera klaim sebelum streak terputus!`;
  } else if (!readiness.streak?.canClaim) {
    streakDesc = `• Rantai Streak: **${readiness.streak?.currentStreak || 0} Hari** ✅\n• Status: Sudah Diklaim Hari Ini`;
  }
  fields.push({
    name: "🔥 Streak Harian",
    value: streakDesc,
  });

  // 4 Interactive quick action buttons
  const actionRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_dailyquest_view")
      .setLabel("Buka Quest")
      .setEmoji("📜")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`survival_act_info:${userId}`)
      .setLabel("Masuk RPG")
      .setEmoji("⚔️")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("btn_daily_claim")
      .setLabel("Daily")
      .setEmoji("🎁")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("btn_notif_manage")
      .setLabel("Kelola Notif")
      .setEmoji("⚙️")
      .setStyle(ButtonStyle.Secondary),
  );

  return buildContainerV2({
    accentColorHex,
    authorName: "Naura Hoshino • Petualangan",
    title: "🗺️ Adventure Digest",
    description: dialogueText,
    expression,
    expressionImage: true,
    fields,
    buttonsRow: [actionRow],
    footerText: "Naura Hoshino Petualangan • Tekan tombol untuk aksi cepat ✨",
  });
}

/**
 * Dispatch Adventure Digest ke user dengan proteksi sliding cooldown dan validasi kesiapan.
 *
 * @param {string} userId - ID Pengguna Discord
 * @param {object} client - Discord Client
 * @param {object} [options] - Opsi eksekusi
 * @param {boolean} [options.force=false] - Abaikan cooldown check
 * @param {number} [options.cooldownMs=14400000] - Durasi sliding window (default: 4 jam)
 * @param {string} [options.trigger="cron"] - Pemicu evaluasi
 * @returns {Promise<object>} Status hasil pengiriman
 */
async function checkAndDispatchAdventureDigest(userId, client, options = {}) {
  if (!userId || !SNOWFLAKE_REGEX.test(String(userId))) {
    return { sent: false, reason: "INVALID_USER_ID" };
  }
  if (!client || !client.users) {
    return { sent: false, reason: "CLIENT_UNAVAILABLE" };
  }

  const force = Boolean(options.force);
  const cooldownMs = options.cooldownMs || DEFAULT_DIGEST_COOLDOWN_MS;
  const now = Date.now();

  // 1. Cek fast in-memory cooldown
  if (!force && digestCooldownCache.has(userId)) {
    const lastSent = digestCooldownCache.get(userId);
    if (now - lastSent < cooldownMs) {
      return { sent: false, reason: "COOLDOWN_ACTIVE", remainingMs: cooldownMs - (now - lastSent) };
    }
  }

  // 2. Ambil profil dan preferensi user
  const profile = await cacheManager.getUserProfile(userId).catch(() => null);
  const prefs = await getUserPreferences(userId);

  // Jika master toggle adventure_digest dimatikan oleh user
  if (prefs.adventure_digest === false) {
    return { sent: false, reason: "DIGEST_DISABLED" };
  }

  // 3. Cek persistent database cooldown
  if (!force && prefs.last_digest_at) {
    const lastDbTime = new Date(prefs.last_digest_at).getTime();
    if (!Number.isNaN(lastDbTime) && now - lastDbTime < cooldownMs) {
      digestCooldownCache.set(userId, lastDbTime);
      return { sent: false, reason: "COOLDOWN_ACTIVE", remainingMs: cooldownMs - (now - lastDbTime) };
    }
  }

  // 3.5. Optimistic in-memory reservation to prevent concurrent duplicate sends
  if (!force) {
    digestCooldownCache.set(userId, now);
  }

  // 4. Evaluasi status kesiapan multi-sistem
  const readiness = await aggregateUserReadiness(userId, client, { profile, prefs });
  if (!readiness.hasAnyEligible) {
    if (!force) digestCooldownCache.delete(userId);
    return { sent: false, reason: "NO_ELIGIBLE_ITEMS", readiness };
  }

  // 5. Pastikan DM terotorisasi
  const authorized = await ensureDmAuthorized(client, userId, profile);
  if (!authorized) {
    if (!force) digestCooldownCache.delete(userId);
    return { sent: false, reason: "DM_NOT_AUTHORIZED" };
  }

  // 6. Fetch user Discord dan kirim container
  try {
    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) {
      if (!force) digestCooldownCache.delete(userId);
      return { sent: false, reason: "USER_FETCH_FAILED" };
    }

    const payload = buildAdventureDigestContainer({
      user,
      readiness,
      displayName: user.displayName || user.username,
    });

    await user.send(payload);

    // Update in-memory dan database timestamp
    digestCooldownCache.set(userId, now);
    await cacheManager.mutateUserProfileJson(
      userId,
      "notification_prefs",
      (curPrefs) => {
        const obj = curPrefs && typeof curPrefs === "object" ? curPrefs : { ...DEFAULT_PREFS };
        obj.last_digest_at = new Date(now).toISOString();
        return obj;
      },
    );

    logger.info(
      `[NotificationCenter] Adventure Digest berhasil dikirim ke ${user.tag || user.username} (${userId}) [Items: ${readiness.eligibleItems.join(", ")}].`,
    );

    return {
      sent: true,
      digest: payload,
      items: readiness.eligibleItems,
      readiness,
    };
  } catch (err) {
    if (!force) digestCooldownCache.delete(userId);
    logger.warn(`[NotificationCenter] Gagal dispatch Adventure Digest ke ${userId}: ${err.message}`);
    return { sent: false, reason: "DISPATCH_ERROR", error: err.message };
  }
}

/**
 * Kirim notifikasi cerdas via DM ke pengguna.
 * @param {object} client - Discord Client
 * @param {string} userId - ID Pengguna Discord
 * @param {string} type - Tipe notifikasi
 * @param {object} [dataOrPayload] - Objek data untuk template ATAU payload siap kirim
 */
async function sendDirectNotification(client, userId, type, dataOrPayload = {}) {
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

    const user = await client.users.fetch(userId).catch(() => null);
    if (!user) return false;

    let payload;
    if (dataOrPayload.components || dataOrPayload.content || dataOrPayload.embeds) {
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
  DEFAULT_DIGEST_COOLDOWN_MS,
  digestCooldownCache,
  generateProgressBar,
  aggregateUserReadiness,
  buildAdventureDigestContainer,
  checkAndDispatchAdventureDigest,
  getUserPreferences,
  setUserPreference,
  ensureDmAuthorized,
  sendDirectNotification,
  sendNotification: sendDirectNotification,
};
