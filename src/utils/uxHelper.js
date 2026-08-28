"use strict";

const { colors, footers } = require("../config/ui/palette");
const emojisBase = require("../config/ui/emojis_base");
const emojisGame = require("../config/ui/emojis_game");
const emojisMedia = require("../config/ui/emojis_media");

const allEmojis = {
  ...emojisBase,
  ...emojisGame,
  ...emojisMedia,
};

const ui = {
  getEmoji: (name) => allEmojis[name] || null,
  getColor: (name) => colors[name] || colors.primary || "#FFB6C1",
  getFooter: (cat = "core") => footers[cat] || footers.core || "Naura Hoshino",
};

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
  const adjustedCurrent = Math.min(
    safeTarget,
    Math.max(0, current + headStart),
  );
  const rawRatio = adjustedCurrent / safeTarget;
  const percent = Math.min(100, Math.round(rawRatio * 100));

  const filledCount = Math.min(
    length,
    Math.max(0, Math.round(rawRatio * length)),
  );
  const emptyCount = Math.max(0, length - filledCount);

  // Unicode text progress bar (aman untuk codeblocks monospace)
  const unicodeBar = `${fillChar.repeat(filledCount)}${emptyChar.repeat(emptyCount)}`;

  // Custom Discord emojis progress bar dari ui.js
  const emojiFilled =
    ui.getEmoji("bar_filled") || "<:AfterDot:1488166236004159509>";
  const emojiEmpty =
    ui.getEmoji("bar_empty") || "<:BeforeDot:1488166108081950882>";
  const customBar = `${emojiFilled.repeat(filledCount)}${emojiEmpty.repeat(emptyCount)}`;

  const bar = useCustomEmojis ? customBar : unicodeBar;

  const remaining = Math.max(0, safeTarget - (current + headStart));
  const name = resolveUserName(user);
  const eParty = ui.getEmoji("celebrate") || "🎉";
  const eSparkle = ui.getEmoji("sparkles") || "✨";
  const eHeart = ui.getEmoji("heart") || "💖";
  const eNaura = ui.getEmoji("about") || "🌸";

  let cheerMessage = "";
  if (lang === "en") {
    if (percent >= 100) {
      cheerMessage = `Awesome, ${name}! You have reached the milestone! ${eParty}${eSparkle}`;
    } else if (percent >= 80) {
      cheerMessage = `Almost there, ${name}! Just ${remaining.toLocaleString()} left to go! ${eHeart}`;
    } else if (percent >= 40) {
      cheerMessage = `Great momentum, ${name}! Keep pushing forward~ ${eNaura}`;
    } else {
      cheerMessage = `Off to a strong start, ${name}! Naura is rooting for you~ ${eSparkle}`;
    }
  } else {
    if (percent >= 100) {
      cheerMessage = `Luar biasa, Kak ${name}! Targetmu sudah tercapai sempurna! ${eParty}${eSparkle}`;
    } else if (percent >= 80) {
      cheerMessage = `Sedikit lagi sampai, Kak ${name}! Tinggal ${remaining.toLocaleString()} lagi lho~ ${eHeart}`;
    } else if (percent >= 40) {
      cheerMessage = `Progresmu mantap banget, Kak ${name}! Terus semangat ya~ ${eNaura}`;
    } else {
      cheerMessage = `Awal yang bagus, Kak ${name}! Naura selalu menyemangatimu lho~ ${eSparkle}`;
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
 * Smart Defaults & Recommendation Badges
 * Menambahkan visual badge bintang rekomendasi pada opsi unggulan
 * @param {string} label
 * @param {boolean} [isRecommended=false]
 * @returns {string}
 */
function formatRecommendationBadge(label, isRecommended = false) {
  if (!isRecommended) return label;
  const eStar = ui.getEmoji("star") || "⭐";
  return `${eStar} ${label} (Rekomendasi Naura)`;
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
function getPersonalityResponse(
  type,
  { user = null, context = {}, lang = "id" } = {},
) {
  const name = resolveUserName(user);
  const isEn = lang === "en";

  const eNaura = ui.getEmoji("about") || "🌸";
  const eSparkle = ui.getEmoji("sparkles") || "✨";
  const eParty = ui.getEmoji("celebrate") || "🎉";
  const eLove = ui.getEmoji("heart") || "💕";
  const eGift = ui.getEmoji("gift") || "🎁";

  switch (type) {
    case "cooldown": {
      const retryAfter = context.retryAfter || context.cooldown || "beberapa";
      return isEn
        ? `I-It is not like I am being strict, ${name}... but please take a breather for ${retryAfter}s before trying again! ${eNaura}`
        : `B-Bukan karena aku cerewet ya, Kak ${name}... tapi istirahat dulu sebentar (${retryAfter} detik) sebelum mencoba lagi! ${eNaura}`;
    }

    case "error": {
      return isEn
        ? `Oops... looks like something did not click, ${name}! Do not worry, let us check it together~ ${eSparkle}`
        : `A-Aduh... ada yang kurang pas nih, Kak ${name}! Jangan khawatir, yuk coba periksa kembali sama-sama ya~ ${eSparkle}`;
    }

    case "levelUp": {
      const level = context.level || "baru";
      return isEn
        ? `Yaaay! Congratulations ${name}, you have leveled up to Level ${level}! Naura is so proud of you~ ${eParty}${eSparkle}`
        : `Yaaay! Selamat Kak ${name}, kamu naik ke Level ${level}! Naura bangga banget deh sama usahamu~ ${eParty}${eSparkle}`;
    }

    case "ikeaAppreciation": {
      return isEn
        ? `Wow, your taste is aesthetic and amazing, ${name}! Your profile and customization look truly breathtaking now~ ${eLove}`
        : `Wah, selera Kak ${name} estetik banget! Kartu profil dan kustomisasimu sekarang jadi makin memukau~ ${eLove}`;
    }

    case "peakEndClosure": {
      return isEn
        ? `All done for you, ${name}! Is there anything else Naura can assist you with next? ${eNaura}${eSparkle}`
        : `Semuanya beres untuk Kak ${name}! Ada hal seru lain yang mau kita lakukan selanjutnya? ${eNaura}${eSparkle}`;
    }

    case "starterWelcome": {
      return isEn
        ? `Welcome aboard, ${name}! Naura has prepared a special Starter Kit to kickstart your journey~ ${eGift}${eSparkle}`
        : `Selamat datang, Kak ${name}! Naura sudah siapkan Starter Pack spesial untuk menemani langkah awalmu~ ${eGift}${eSparkle}`;
    }

    default:
      return isEn
        ? `Always happy to help, ${name}! ${eNaura}`
        : `Naura selalu senang membantumu, Kak ${name}! ${eNaura}`;
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
  const currentStep = isComplete
    ? steps[steps.length - 1]
    : steps[currentStepIndex] || steps[0];

  let message = "";
  if (isComplete) {
    message = isEn
      ? `All steps completed smoothly for you, ${name}! ${ui.getEmoji("celebrate") || "🎉"}`
      : `Seluruh tahapan telah selesai tuntas untuk Kak ${name}! ${ui.getEmoji("celebrate") || "🎉"}`;
  } else {
    message = isEn
      ? `Hang tight ${name}, we are currently at: **${currentStep.label}**~ ${ui.getEmoji("sparkles") || "✨"}`
      : `Mohon tunggu sebentar ya Kak ${name}, saat ini proses sedang di tahap: **${currentStep.label}**~ ${ui.getEmoji("sparkles") || "✨"}`;
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
    ? (ui.getEmoji("mode_veteran") || "👑") +
      (isEn ? " Veteran Mode" : " Mode Veteran")
    : (ui.getEmoji("mode_newbie") || "🌱") +
      (isEn ? " Newbie Guide" : " Panduan Pemula");

  const focusTip = veteranStatus
    ? isEn
      ? `Welcome back, ${name}! High-density stats and shortcut matrix are activated.`
      : `Selamat kembali, Kak ${name}! Matriks statistik padat dan pintasan aksi aktif.`
    : isEn
      ? `Welcome, ${name}! Complete your initial starter quests to unlock advanced power stats.`
      : `Halo Kak ${name}! Selesaikan quest langkah awal untuk membuka statistik lengkap.`;

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
  const cleanQuery = String(query || "")
    .trim()
    .toLowerCase();

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

/**
 * Visual Timeline Step Tracker (Enhanced Horizontal Timeline)
 * @param {object} options
 * @param {Array<{ label: string, desc?: string }>} options.steps
 * @param {number} [options.currentStepIndex=0]
 * @param {string|object} [options.user=null]
 * @param {string} [options.lang="id"]
 * @param {string} [options.style="numbered"] - 'numbered' | 'status'
 * @returns {{ timeline: string, currentStep: object, currentStepIndex: number, totalSteps: number, percent: number, isComplete: boolean, message: string }}
 */
function buildVisualTimeline({
  steps = [],
  currentStepIndex = 0,
  user = null,
  lang = "id",
  style = "numbered",
}) {
  if (!Array.isArray(steps) || steps.length === 0) {
    return {
      timeline: "",
      currentStep: null,
      currentStepIndex: 0,
      totalSteps: 0,
      percent: 0,
      isComplete: false,
      message: "",
    };
  }

  const name = resolveUserName(user);
  const isEn = lang === "en";

  const numEmojis = [
    "1️⃣",
    "2️⃣",
    "3️⃣",
    "4️⃣",
    "5️⃣",
    "6️⃣",
    "7️⃣",
    "8️⃣",
    "9️⃣",
    "🔟",
  ];
  const emojiDone = ui.getEmoji("step_done") || "✅";
  const emojiActive = ui.getEmoji("step_active") || "⏳";
  const emojiArrow = " ──▶ ";

  const renderedSteps = steps.map((step, idx) => {
    const numIcon = numEmojis[idx] || `${idx + 1}.`;

    if (idx < currentStepIndex) {
      return `~~${emojiDone} ${step.label}~~`;
    }
    if (idx === currentStepIndex) {
      const activeIcon = style === "numbered" ? numIcon : emojiActive;
      return `**[${activeIcon} ${step.label}]**`;
    }
    return `${numIcon} ${step.label}`;
  });

  const timeline = renderedSteps.join(emojiArrow);
  const isComplete = currentStepIndex >= steps.length;
  const currentStep = isComplete
    ? steps[steps.length - 1]
    : steps[currentStepIndex] || steps[0];
  const percent = Math.min(
    100,
    Math.round(
      (Math.max(0, currentStepIndex) / Math.max(1, steps.length)) * 100,
    ),
  );

  let message = "";
  if (isComplete) {
    message = isEn
      ? `All steps completed smoothly for you, ${name}! ${ui.getEmoji("celebrate") || "🎉"}`
      : `Seluruh tahapan telah selesai tuntas untuk Kak ${name}! ${ui.getEmoji("celebrate") || "🎉"}`;
  } else {
    message = isEn
      ? `Step ${currentStepIndex + 1} of ${steps.length}: **${currentStep.label}** (${percent}% complete)`
      : `Tahap ${currentStepIndex + 1} dari ${steps.length}: **${currentStep.label}** (${percent}% selesai)`;
  }

  return {
    timeline,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    percent,
    isComplete,
    message,
  };
}

/**
 * Empty State Prompt Builder: Menampilkan tampilan ilustrasi dan pesan kosong persona Naura
 * @param {object} options
 * @param {string} [options.type="default"] - 'inventory' | 'ticket' | 'barter' | 'dungeon' | 'history' | 'clan' | 'quest' | 'default'
 * @param {string|object} [options.user=null]
 * @param {string} [options.lang="id"]
 * @param {string} [options.actionCmd=null]
 * @param {string} [options.ctaLabel=null]
 * @param {string} [options.ctaCustomId=null]
 * @param {string} [options.customTitle=null]
 * @param {string} [options.customDescription=null]
 * @param {string} [options.customExpression=null]
 * @returns {{ title: string, description: string, expression: string, buttonsRow: object|null, actionSuggestion: string, payload: object }}
 */
function buildEmptyStatePrompt({
  type = "default",
  user = null,
  lang = "id",
  actionCmd = null,
  ctaLabel = null,
  ctaCustomId = null,
  customTitle = null,
  customDescription = null,
  customExpression = null,
} = {}) {
  const name = resolveUserName(user);
  const isEn = lang === "en";

  const eGame = ui.getEmoji("help_game") || "🎮";
  const eTicket = ui.getEmoji("ticket") || "🎫";
  const eCard = ui.getEmoji("card_deck") || "🎴";
  const eShop = ui.getEmoji("shop_cart") || "🛒";
  const eMusic = ui.getEmoji("music_note") || "🎵";
  const eCastle = ui.getEmoji("property") || "🏰";
  const eGift = ui.getEmoji("gift") || "🎁";
  const eSparkle = ui.getEmoji("sparkles") || "✨";
  const eNaura = ui.getEmoji("about") || "🌸";
  const eKey = ui.getEmoji("key") || "🗝️";
  const eShield = ui.getEmoji("shield") || "🛡️";
  const eScroll = ui.getEmoji("quest") || "📜";
  const eStar = ui.getEmoji("star") || "🌟";

  const templates = {
    inventory: {
      expression: "Akward",
      title: isEn
        ? "Your Inventory is Empty"
        : "Tas & Inventarismu Masih Kosong",
      desc: isEn
        ? `Looks like you haven't stored any items yet, ${name}. Let's explore Naura's world, gather materials, or craft tools to fill your bag! ${eSparkle}`
        : `Wah, sepertinya kamu belum menyimpan barang apa pun di tasmu, Kak ${name}. Yuk jelajahi dunia Naura, kumpulkan bahan, atau tempa alat pertamamu! ${eSparkle}`,
      cta: isEn ? `${eGame} Start Adventure` : `${eGame} Mulai Petualangan`,
      defaultCmd: "/survival collect",
      customId: "empty_cta_start",
    },
    ticket: {
      expression: "Cheers",
      title: isEn ? "No Open Tickets Found" : "Belum Ada Tiket Terbuka",
      desc: isEn
        ? `All questions and requests are resolved, ${name}! If you encounter any issues or need staff assistance, feel free to open a new ticket anytime~ ${eNaura}`
        : `Semua pertanyaan dan bantuan sudah selesai ditangani dengan rapi, Kak ${name}! Bila kamu mengalami kendala atau butuh bantuan staff, silakan buka tiket baru ya~ ${eNaura}`,
      cta: isEn ? `${eTicket} Open New Ticket` : `${eTicket} Buka Tiket Baru`,
      defaultCmd: "/ticket open",
      customId: "ticket_open",
    },
    barter: {
      expression: "Shy",
      title: isEn ? "No Active Barter Offers" : "Belum Ada Tawaran Barter",
      desc: isEn
        ? `The trading lounge is peaceful right now, ${name}. Pick your duplicate anime cards and invite a friend to exchange your dream cards! ${eCard}${eSparkle}`
        : `Ruang barter masih hening nih, Kak ${name}. Pilih kartu anime koleksimu dan ajak teman untuk saling bertukar kartu impian! ${eCard}${eSparkle}`,
      cta: isEn
        ? `${eCard} View Card Collection`
        : `${eCard} Lihat Koleksi Kartu`,
      defaultCmd: "/card collection",
      customId: "empty_cta_cards",
    },
    dungeon: {
      expression: "Thinking",
      title: isEn ? "Dungeon Gate is Locked" : "Pintu Dungeon Terkunci",
      desc: isEn
        ? `The ancient dungeon gate requires a **Dungeon Pass** or **Special Pass** to enter, ${name}! Visit the village market to prepare your battle supplies first. ${eKey}${eShield}`
        : `Pintu masuk dungeon dijaga ketat dan butuh **Dungeon Pass** atau **Special Pass**, Kak ${name}! Kunjungi warung desa dulu untuk membeli tiket masuk dan perlengkapan ya~ ${eKey}${eShield}`,
      cta: isEn ? `${eShop} Visit Market` : `${eShop} Kunjungi Warung Desa`,
      defaultCmd: "/survival shop",
      customId: "empty_cta_shop",
    },
    history: {
      expression: "Read",
      title: isEn ? "No History Records Yet" : "Belum Ada Riwayat Tersimpan",
      desc: isEn
        ? `Your transaction and activity log is spotless, ${name}. Start playing music or exploring features with Naura to record your journey! ${eScroll}${eSparkle}`
        : `Buku catatan riwayatmu masih bersih seperti lembaran baru, Kak ${name}. Mulai dengarkan musik atau lakukan aktivitas bersamaku untuk mencatat jejakmu! ${eScroll}${eSparkle}`,
      cta: isEn ? `${eMusic} Play Music` : `${eMusic} Putar Musik`,
      defaultCmd: "/music play",
      customId: "empty_cta_music",
    },
    clan: {
      expression: "Happy",
      title: isEn ? "Not in a Clan Yet" : "Belum Bergabung dengan Klan",
      desc: isEn
        ? `Adventures are more rewarding with allies, ${name}! Create your own clan or join an active guild to participate in territory wars. ${eCastle}${eSparkle}`
        : `Petualangan terasa jauh lebih seru saat dijalani bersama kawan-kawan, Kak ${name}! Buat klan barumu atau gabung dengan klan aktif di server ini yuk~ ${eCastle}${eSparkle}`,
      cta: isEn ? `${eCastle} Explore Clans` : `${eCastle} Jelajahi Klan`,
      defaultCmd: "/survival clan",
      customId: "empty_cta_clan",
    },
    quest: {
      expression: "Impressed",
      title: isEn ? "All Quests Completed!" : "Semua Quest Selesai!",
      desc: isEn
        ? `Incredible! All your daily quests are finished for today, ${name}. Take a good rest, fresh quests will refresh tomorrow morning! ${eStar}`
        : `Luar biasa! Seluruh quest harianmu sudah terselesaikan dengan sempurna hari ini, Kak ${name}. Istirahatlah sejenak, misi baru akan kembali besok pagi! ${eStar}`,
      cta: isEn
        ? `${eGift} Claim Quest Rewards`
        : `${eGift} Periksa Quest Harian`,
      defaultCmd: "/survival quest",
      customId: "empty_cta_quest",
    },
    default: {
      expression: "Akward",
      title: isEn ? "No Records Found" : "Data Masih Kosong",
      desc: isEn
        ? `Nothing has been recorded in this section yet for ${name}. Let's get started and create your first milestone! ${eNaura}`
        : `Belum ada data yang tercatat di bagian ini untuk Kak ${name}. Yuk coba fitur ini dan buat catatan pertamamu! ${eNaura}`,
      cta: isEn ? `${eSparkle} Try Feature` : `${eSparkle} Mulai Sekarang`,
      defaultCmd: "/help",
      customId: "empty_cta_default",
    },
  };

  const selected = templates[type] || templates.default;
  const title = customTitle || selected.title;
  const description = customDescription || selected.desc;
  const expression = customExpression || selected.expression;
  const buttonLabel = ctaLabel || selected.cta;
  const buttonId = ctaCustomId || selected.customId;
  const actionSuggestion = actionCmd || selected.defaultCmd;

  let buttonsRow = null;
  try {
    const {
      ActionRowBuilder,
      ButtonBuilder,
      ButtonStyle,
    } = require("discord.js");
    buttonsRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(buttonId)
        .setLabel(buttonLabel)
        .setStyle(ButtonStyle.Primary),
    );
  } catch (e) {
    // Fallback if discord.js builder unavailable
    buttonsRow = null;
  }

  const payload = {
    title,
    description,
    expression,
    buttonsRow,
    footerText: ui.getFooter ? ui.getFooter("core") : "Naura Hoshino",
  };

  return {
    title,
    description,
    expression,
    buttonsRow,
    actionSuggestion,
    payload,
  };
}

/**
 * Context-Aware Numeric Input & Quick Chips
 * Menyediakan kalkulasi instan persentase saldo dan nominal tombol cepat
 * @param {object} options
 * @param {number} [options.totalBalance=0]
 * @param {number} [options.currentAmount=0]
 * @param {string} [options.prefix="chip"]
 * @param {Array<{ label: string, ratio?: number, add?: number, isMax?: boolean }>} [options.customChips=null]
 * @param {string} [options.unit=""]
 * @returns {{ chips: Array<{ label: string, value: number, customId: string, style: number }>, buttonsRow: object|null }}
 */
function buildQuickNumericChips({
  totalBalance = 0,
  currentAmount = 0,
  prefix = "chip",
  customChips = null,
  unit = "",
} = {}) {
  const safeBalance = Math.max(0, Number(totalBalance) || 0);
  const safeCurrent = Math.max(0, Number(currentAmount) || 0);

  let chipDefinitions = customChips;
  if (
    !chipDefinitions ||
    !Array.isArray(chipDefinitions) ||
    chipDefinitions.length === 0
  ) {
    chipDefinitions = [
      { label: "10%", ratio: 0.1 },
      { label: "25%", ratio: 0.25 },
      { label: "50%", ratio: 0.5 },
      { label: "MAX", isMax: true },
      { label: "+100", add: 100 },
      { label: "+1K", add: 1000 },
    ];
  }

  const {
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
  } = require("discord.js");
  const chips = [];
  const buttons = [];

  for (const def of chipDefinitions) {
    let value = 0;
    let style = ButtonStyle.Secondary;

    if (def.isMax) {
      value = safeBalance;
      style = ButtonStyle.Success;
    } else if (typeof def.ratio === "number") {
      value = Math.floor(safeBalance * def.ratio);
      style = ButtonStyle.Secondary;
    } else if (typeof def.add === "number") {
      value = Math.min(safeBalance, safeCurrent + def.add);
      style = ButtonStyle.Primary;
    } else if (typeof def.value === "number") {
      value = Math.min(safeBalance, def.value);
    }

    const customId = `${prefix}_${def.label.replace(/[^a-zA-Z0-9]/g, "").toLowerCase()}_${value}`;
    chips.push({
      label: def.label,
      value,
      customId,
      style,
    });

    if (buttons.length < 5) {
      // Discord membatasi maksimal 5 tombol per ActionRow
      buttons.push(
        new ButtonBuilder()
          .setCustomId(customId)
          .setLabel(def.label + (unit ? ` ${unit}` : ""))
          .setStyle(style)
          .setDisabled(safeBalance <= 0 && !def.add),
      );
    }
  }

  const buttonsRow =
    buttons.length > 0 ? new ActionRowBuilder().addComponents(buttons) : null;

  return {
    chips,
    buttonsRow,
  };
}

module.exports = {
  resolveUserName,
  buildGoalGradientBar,
  formatRecommendationBadge,
  buildPriceAnchor,
  getPersonalityResponse,
  buildTimelineStepTracker,
  buildVisualTimeline,
  buildEmptyStatePrompt,
  buildQuickNumericChips,
  getModuleCategoryColor,
  buildAdaptiveDensityView,
  filterPredictiveSearch,
};
