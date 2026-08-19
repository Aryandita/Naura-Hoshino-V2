"use strict";

const ui = require("../config/ui");

/**
 * 🌸 Naura UX Psychology & Emotional Persona Helper
 *
 * Menerapkan 6 Prinsip Psikologi UX:
 * 1. Decision Fatigue (Smart Defaults & Recommendation Badges)
 * 2. Goal Gradient Effect (Artificial Head Start & Kawaii Progress Bars)
 * 3. Reciprocity (Instant Delight & Value-First Gifting)
 * 4. IKEA Effect (Personalization & Co-Creation Appreciation)
 * 5. Anchoring & Contrast Effect (Visual Value Anchoring)
 * 6. Peak-End Rule & Persona-Driven Feedback (Calling user by name)
 */

/**
 * Mengambil nama tampilan (display name / global name) pengguna secara aman
 * @param {object} userOrInteraction
 * @returns {string}
 */
function resolveUserName(userOrInteraction) {
  if (!userOrInteraction) return "Sobat Naura";

  if (userOrInteraction.member && userOrInteraction.member.displayName) {
    return userOrInteraction.member.displayName;
  }
  if (userOrInteraction.user) {
    return (
      userOrInteraction.user.globalName ||
      userOrInteraction.user.username ||
      "Sobat Naura"
    );
  }
  if (userOrInteraction.globalName) {
    return userOrInteraction.globalName;
  }
  if (userOrInteraction.username) {
    return userOrInteraction.username;
  }
  if (typeof userOrInteraction === "string") {
    return userOrInteraction;
  }
  return "Sobat Naura";
}

/**
 * Goal Gradient Effect: Membangun visual progress bar dengan dorongan semangat Naura
 * @param {object} options
 * @param {number} options.current
 * @param {number} options.target
 * @param {number} [options.headStart=0] - Nilai dorongan awal (artificial head start)
 * @param {number} [options.length=10] - Panjang bar karakter
 * @param {string} [options.fillChar="▰"]
 * @param {string} [options.emptyChar="▱"]
 * @param {boolean} [options.useCustomEmojis=false] - Gunakan custom emoji Discord dari ui.js (bar_filled / bar_empty)
 * @param {string|object} [options.user] - User atau Interaction untuk penyebutan nama
 * @param {string} [options.lang="id"]
 * @returns {{ bar: string, customBar: string, percent: number, current: number, target: number, remaining: number, cheerMessage: string }}
 */
function buildGoalGradientBar({
  current = 0,
  target = 100,
  headStart = 0,
  length = 10,
  fillChar = "▰",
  emptyChar = "▱",
  useCustomEmojis = false,
  user = null,
  lang = "id",
}) {
  const safeTarget = Math.max(1, target);
  const adjustedCurrent = Math.min(safeTarget, Math.max(0, current + headStart));
  const rawRatio = adjustedCurrent / safeTarget;
  const percent = Math.min(100, Math.round(rawRatio * 100));

  const filledCount = Math.min(length, Math.max(0, Math.round(rawRatio * length)));
  const emptyCount = Math.max(0, length - filledCount);

  // Unicode text progress bar (aman untuk codeblocks monospace)
  const unicodeBar = `${fillChar.repeat(filledCount)}${emptyChar.repeat(emptyCount)}`;

  // Custom Discord emojis progress bar dari ui.js
  const emojiFilled = ui.getEmoji("bar_filled") || "<:AfterDot:1488166236004159509>";
  const emojiEmpty = ui.getEmoji("bar_empty") || "<:BeforeDot:1488166108081950882>";
  const customBar = `${emojiFilled.repeat(filledCount)}${emojiEmpty.repeat(emptyCount)}`;

  const bar = useCustomEmojis ? customBar : unicodeBar;

  const remaining = Math.max(0, safeTarget - (current + headStart));
  const name = resolveUserName(user);

  let cheerMessage = "";
  if (lang === "en") {
    if (percent >= 100) {
      cheerMessage = `Awesome, ${name}! You have reached the milestone! 🎉✨`;
    } else if (percent >= 80) {
      cheerMessage = `Almost there, ${name}! Just ${remaining.toLocaleString()} left to go! 💖`;
    } else if (percent >= 40) {
      cheerMessage = `Great momentum, ${name}! Keep pushing forward~ 🌸`;
    } else {
      cheerMessage = `Off to a strong start, ${name}! Naura is rooting for you~ ✨`;
    }
  } else {
    if (percent >= 100) {
      cheerMessage = `Luar biasa, Kak ${name}! Targetmu sudah tercapai sempurna! 🎉✨`;
    } else if (percent >= 80) {
      cheerMessage = `Sedikit lagi sampai, Kak ${name}! Tinggal ${remaining.toLocaleString()} lagi lho~ 💖`;
    } else if (percent >= 40) {
      cheerMessage = `Progresmu mantap banget, Kak ${name}! Terus semangat ya~ 🌸`;
    } else {
      cheerMessage = `Awal yang bagus, Kak ${name}! Naura selalu menyemangatimu lho~ ✨`;
    }
  }

  return {
    bar,
    customBar,
    percent,
    current: current + headStart,
    target: safeTarget,
    remaining,
    cheerMessage,
  };
}

/**
 * Decision Fatigue: Format label dengan badge rekomendasi pintar
 * @param {string} label
 * @param {boolean} [isRecommended=false]
 * @returns {string}
 */
function formatRecommendationBadge(label, isRecommended = false) {
  if (!isRecommended) return label;
  return `⭐ ${label} (Rekomendasi Naura)`;
}

/**
 * Anchoring & Contrast Effect: Format perbandingan harga dengan lencana diskon
 * @param {object} options
 * @param {number} options.originalPrice
 * @param {number} options.discountedPrice
 * @param {string} [options.unit="Koin"]
 * @param {string} [options.badge]
 * @returns {string}
 */
function buildPriceAnchor({
  originalPrice,
  discountedPrice,
  unit = "Koin",
  badge = null,
}) {
  const origStr = originalPrice.toLocaleString("en-US");
  const discStr = discountedPrice.toLocaleString("en-US");

  if (originalPrice <= discountedPrice) {
    return `**${discStr}** ${unit}`;
  }

  const savingPercent = Math.round(
    ((originalPrice - discountedPrice) / originalPrice) * 100,
  );
  const badgeText = badge || `HEMAT ${savingPercent}%`;

  return `~~${origStr}~~ ➔ **${discStr}** ${unit} \`[${badgeText}]\``;
}

/**
 * Peak-End Rule & Expressive Persona Feedback
 * Menyediakan mikro-copy dinamis yang selalu menyebut nama pengguna
 * @param {string} type - Tipe feedback: 'cooldown' | 'error' | 'levelUp' | 'ikeaAppreciation' | 'peakEndClosure' | 'starterWelcome'
 * @param {object} options
 * @param {string|object} [options.user]
 * @param {object} [options.context]
 * @param {string} [options.lang="id"]
 * @returns {string}
 */
function getPersonalityResponse(type, { user = null, context = {}, lang = "id" } = {}) {
  const name = resolveUserName(user);
  const isEn = lang === "en";

  switch (type) {
    case "cooldown": {
      const retryAfter = context.retryAfter || context.cooldown || "beberapa";
      return isEn
        ? `I-It is not like I am being strict, ${name}... but please take a breather for ${retryAfter}s before trying again! 🌸`
        : `B-Bukan karena aku cerewet ya, Kak ${name}... tapi istirahat dulu sebentar (${retryAfter} detik) sebelum mencoba lagi! 🌸`;
    }

    case "error": {
      return isEn
        ? `Oops... looks like something did not click, ${name}! Do not worry, let us check it together~ ✨`
        : `A-Aduh... ada yang kurang pas nih, Kak ${name}! Jangan khawatir, yuk coba periksa kembali sama-sama ya~ ✨`;
    }

    case "levelUp": {
      const level = context.level || "baru";
      return isEn
        ? `Yaaay! Congratulations ${name}, you have leveled up to Level ${level}! Naura is so proud of you~ 🎉✨`
        : `Yaaay! Selamat Kak ${name}, kamu naik ke Level ${level}! Naura bangga banget deh sama usahamu~ 🎉✨`;
    }

    case "ikeaAppreciation": {
      return isEn
        ? `Wow, your taste is aesthetic and amazing, ${name}! Your profile and customization look truly breathtaking now~ 💕`
        : `Wah, selera Kak ${name} estetik banget! Kartu profil dan kustomisasimu sekarang jadi makin memukau~ 💕`;
    }

    case "peakEndClosure": {
      return isEn
        ? `All done for you, ${name}! Is there anything else Naura can assist you with next? 🌸✨`
        : `Semuanya beres untuk Kak ${name}! Ada hal seru lain yang mau kita lakukan selanjutnya? 🌸✨`;
    }

    case "starterWelcome": {
      return isEn
        ? `Welcome aboard, ${name}! Naura has prepared a special Starter Kit to kickstart your journey~ 🎁✨`
        : `Selamat datang, Kak ${name}! Naura sudah siapkan Starter Pack spesial untuk menemani langkah awalmu~ 🎁✨`;
    }

    default:
      return isEn ? `Always happy to help, ${name}! 🌸` : `Naura selalu senang membantumu, Kak ${name}! 🌸`;
  }
}

/**
 * Visual Timeline Step Tracker: Menggambarkan tahapan multi-langkah dengan emoji status & pesan empatik
 * @param {object} options
 * @param {Array<{ label: string, desc?: string }>} options.steps
 * @param {number} [options.currentStepIndex=0]
 * @param {string|object} [options.user=null]
 * @param {string} [options.lang="id"]
 * @returns {{ timeline: string, currentStep: object, isComplete: boolean, message: string }}
 */
function buildTimelineStepTracker({
  steps = [],
  currentStepIndex = 0,
  user = null,
  lang = "id",
}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return { timeline: "", currentStep: null, isComplete: false, message: "" };
  }

  const name = resolveUserName(user);
  const isEn = lang === "en";

  const emojiDone = ui.getEmoji("step_done") || "✅";
  const emojiActive = ui.getEmoji("step_active") || "⏳";
  const emojiPending = ui.getEmoji("step_pending") || "⚪";
  const emojiArrow = ui.getEmoji("step_arrow") || "➔";

  const renderedSteps = steps.map((step, idx) => {
    let icon = emojiPending;
    let labelText = step.label;

    if (idx < currentStepIndex) {
      icon = emojiDone;
      labelText = `~~${step.label}~~`;
    } else if (idx === currentStepIndex) {
      icon = emojiActive;
      labelText = `**[${step.label}]**`;
    }

    return `${icon} ${labelText}`;
  });

  const timeline = renderedSteps.join(` ${emojiArrow} `);
  const isComplete = currentStepIndex >= steps.length;
  const currentStep = isComplete ? steps[steps.length - 1] : steps[currentStepIndex] || steps[0];

  let message = "";
  if (isComplete) {
    message = isEn
      ? `All steps completed smoothly for you, ${name}! 🎉`
      : `Seluruh tahapan telah selesai tuntas untuk Kak ${name}! 🎉`;
  } else {
    message = isEn
      ? `Hang tight ${name}, we are currently at: **${currentStep.label}**~ ✨`
      : `Mohon tunggu sebentar ya Kak ${name}, saat ini proses sedang di tahap: **${currentStep.label}**~ ✨`;
  }

  return {
    timeline,
    currentStep,
    isComplete,
    message,
  };
}

/**
 * Categorical Color-Coding System: Mengembalikan warna hex token resmi per modul
 * @param {string} category
 * @returns {string} Hex color
 */
function getModuleCategoryColor(category) {
  const cat = String(category || "").toLowerCase();
  switch (cat) {
    case "core":
    case "social":
    case "identity":
      return ui.getColor("primary") || "#FFC0CB";

    case "music":
    case "audio":
    case "voice":
      return ui.getColor("music") || "#8A2BE2";

    case "economy":
    case "shop":
    case "vip":
    case "gacha":
      return ui.getColor("economy") || "#FFD700";

    case "survival":
    case "quest":
    case "craft":
    case "farm":
      return ui.getColor("crafting") || "#228B22";

    case "admin":
    case "setup":
    case "moderation":
      return ui.getColor("rank") || "#9400D3";

    case "security":
    case "softban":
    case "emergency":
      return ui.getColor("error") || "#FF0000";

    default:
      return ui.getColor("primary") || "#FFC0CB";
  }
}

/**
 * Adaptive Density View: Menentukan apakah menampilkan panduan pemula atau statistik padat veteran
 * @param {object} options
 * @param {number} [options.level=1]
 * @param {boolean} [options.isVeteran=false]
 * @param {string|object} [options.user=null]
 * @param {string} [options.lang="id"]
 * @returns {{ isVeteran: boolean, modeBadge: string, focusTip: string }}
 */
function buildAdaptiveDensityView({
  level = 1,
  isVeteran = false,
  user = null,
  lang = "id",
}) {
  const name = resolveUserName(user);
  const isEn = lang === "en";
  const veteranStatus = Boolean(isVeteran || level > 5);

  const modeBadge = veteranStatus
    ? (ui.getEmoji("mode_veteran") || "👑") + (isEn ? " Veteran Mode" : " Mode Veteran")
    : (ui.getEmoji("mode_newbie") || "🌱") + (isEn ? " Newbie Guide" : " Panduan Pemula");

  const focusTip = veteranStatus
    ? (isEn
        ? `Welcome back, ${name}! High-density stats and shortcut matrix are activated.`
        : `Selamat kembali, Kak ${name}! Matriks statistik padat dan pintasan aksi aktif.`)
    : (isEn
        ? `Welcome, ${name}! Complete your initial starter quests to unlock advanced power stats.`
        : `Halo Kak ${name}! Selesaikan quest langkah awal untuk membuka statistik lengkap.`);

  return {
    isVeteran: veteranStatus,
    modeBadge,
    focusTip,
  };
}

/**
 * Predictive Search Helper: Memfilter dan memperkaya hasil pencarian dengan context tags
 * @param {object} options
 * @param {string} options.query
 * @param {Array<{ name: string, value: string, category?: string, price?: number }>} options.items
 * @param {number} [options.maxResults=25]
 * @param {Array<{ name: string, value: string }>} [options.fallbackRecommendations=[]]
 * @returns {Array<{ name: string, value: string }>}
 */
function filterPredictiveSearch({
  query = "",
  items = [],
  maxResults = 25,
  fallbackRecommendations = [],
}) {
  const cleanQuery = String(query || "").trim().toLowerCase();

  if (!cleanQuery) {
    return items.slice(0, maxResults);
  }

  const matches = items.filter((item) => {
    const itemName = String(item.name || "").toLowerCase();
    const itemCat = String(item.category || "").toLowerCase();
    return itemName.includes(cleanQuery) || itemCat.includes(cleanQuery);
  });

  if (matches.length > 0) {
    return matches.slice(0, maxResults);
  }

  // Bila query tidak ditemukan, berikan rekomendasi cerdas Naura
  return fallbackRecommendations.slice(0, maxResults);
}

module.exports = {
  resolveUserName,
  buildGoalGradientBar,
  formatRecommendationBadge,
  buildPriceAnchor,
  getPersonalityResponse,
  buildTimelineStepTracker,
  getModuleCategoryColor,
  buildAdaptiveDensityView,
  filterPredictiveSearch,
};
