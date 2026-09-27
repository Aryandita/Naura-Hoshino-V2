"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const fs = require("node:fs");

const ui = require("../config/ui");
const languageManager = require("../managers/languageManager");

const HELP_CATEGORY_KEYS = [
  "core",
  "naura",
  "ai",
  "music",
  "survival",
  "minigame",
  "utility",
  "admin",
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function formatHelpContent(text) {
  if (!text) return "";
  return text.replace(
    /{emoji:(\w+)(?:\|([^}]+))?}/g,
    (match, key, fallback) => {
      return ui.getEmoji(key) || fallback || match;
    },
  );
}

function buildHelpCategories(langInput) {
  const lang =
    typeof langInput === "object" && langInput !== null
      ? langInput
      : languageManager.getLanguageSync(langInput);

  const isEn =
    lang && (lang.LANG_CODE === "en" || lang.HELP_TITLE?.includes("Help"));

  return {
    core: {
      emoji: e("help_core", "⚙️"),
      label: lang.HELP_CAT_CORE_LABEL || "Core System",
      desc: lang.HELP_CAT_CORE_DESC || "Sistem bot, status, dan ping.",
      content: formatHelpContent(lang.HELP_CONTENT_CORE),
    },
    naura: {
      emoji: e("help_naura", "🌸"),
      label: isEn ? "🌸 Naura Companion" : "🌸 Companion Naura",
      desc: lang.HELP_CAT_NAURA_DESC || "Interaksi personal dan cerita Naura.",
      content: formatHelpContent(lang.HELP_CONTENT_NAURA),
    },
    ai: {
      emoji: e("help_ai", "🤖"),
      label: isEn ? "🤖 AI Intelligence" : "🤖 Kecerdasan AI",
      desc: lang.HELP_CAT_AI_DESC || "AI Ensemble obrolan dan terjemahan.",
      content: formatHelpContent(lang.HELP_CONTENT_AI),
    },
    music: {
      emoji: e("help_music", "🎵"),
      label: isEn ? "⭐ Music & Audio (Popular)" : "⭐ Musik & Audio (Populer)",
      desc: lang.HELP_CAT_MUSIC_DESC || "Pemutar lagu dan radio.",
      content: formatHelpContent(lang.HELP_CONTENT_MUSIC),
    },
    survival: {
      emoji: e("help_survival", "🏕️"),
      label: isEn
        ? "⭐ RPG Survival & Economy (Featured)"
        : "⭐ RPG Survival & Ekonomi (Rekomendasi)",
      desc: lang.HELP_CAT_SURVIVAL_DESC || "Naura Wilds dan sistem ekonomi.",
      content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL),
    },
    minigame: {
      emoji: e("help_game", "🎮"),
      label: lang.HELP_CAT_GAME_LABEL || "Minigame & Arcade",
      desc: lang.HELP_CAT_GAME_DESC || "Permainan santai dan seru.",
      content: formatHelpContent(lang.HELP_CONTENT_GAME),
    },
    utility: {
      emoji: e("help_utility", "🧰"),
      label: isEn ? "🧰 Utility & Tools" : "🧰 Utilitas & Alat",
      desc: lang.HELP_CAT_UTILITY_DESC || "Alat bantu dan produktivitas.",
      content: formatHelpContent(lang.HELP_CONTENT_UTILITY),
    },
    admin: {
      emoji: e("help_admin", "🛠️"),
      label: lang.HELP_CAT_ADMIN_LABEL || "Konfigurasi Admin",
      desc: lang.HELP_CAT_ADMIN_DESC || "Setup dan moderasi server.",
      content: formatHelpContent(lang.HELP_CONTENT_ADMIN),
    },
  };
}

/**
 * Membangun payload tampilan menu bantuan berbasis Discord Components V2
 * dengan pagination 5-tombol dan dropdown menu terfilter (tanpa menu tempat pengguna berada).
 */
function buildHelpPayload(
  langInput,
  clientOrIndex,
  maybeIndex,
  maybeDisabled,
  maybeUser,
) {
  let categoryIndex = -1;
  let disabled = false;
  let user = null;

  if (typeof clientOrIndex === "number") {
    categoryIndex = clientOrIndex;
    disabled = Boolean(maybeIndex);
    user = maybeDisabled || null;
  } else {
    categoryIndex = typeof maybeIndex === "number" ? maybeIndex : -1;
    disabled = Boolean(maybeDisabled);
    user = maybeUser || null;
  }

  const lang =
    typeof langInput === "object" && langInput !== null
      ? langInput
      : languageManager.getLanguageSync(langInput);

  const categoryKeys = HELP_CATEGORY_KEYS;
  const userName = ui.ux.resolveUserName(user);
  const isEn =
    lang && (lang.LANG_CODE === "en" || lang.HELP_TITLE?.includes("Help"));
  const categories = buildHelpCategories(lang);

  const activeKey = categoryIndex >= 0 ? categoryKeys[categoryIndex] : null;
  const activeCat = activeKey ? categories[activeKey] : null;

  const greeting = isEn
    ? `Hello **${userName}**! Here are the commands you can use with Naura~ ✨`
    : `Halo Kak **${userName}**! Berikut adalah daftar perintah yang bisa kamu gunakan~ ✨`;

  const bodyContent = activeCat
    ? `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`
    : `${greeting}\n\n${formatHelpContent(lang.HELP_DESC)}`;

  const primaryHex = (ui.getColor("primary") || "#FFB6C1").replace("#", "");
  const accentColor = parseInt(primaryHex, 16);

  // 1. Dropdown Menu (Select Menu): Menampilkan SEMUA opsi KECUALI kategori tempat user saat ini berada
  const selectOptions = [];

  // Jika sedang di kategori tertentu, beri opsi kembali ke Beranda/Overview
  if (activeKey) {
    selectOptions.push({
      label: isEn ? "🏠 Main Overview" : "🏠 Ringkasan Utama",
      description: isEn
        ? "Return to the main help home page"
        : "Kembali ke beranda utama menu bantuan",
      value: "overview",
      emoji: { name: "🏠" },
    });
  }

  // Masukkan kategori-kategori yang BUKAN kategori aktif saat ini
  for (const key of categoryKeys) {
    if (key === activeKey) continue; // Skip kategori tempat pengguna saat ini berada

    const cat = categories[key];
    const option = {
      label: cat.label,
      description: cat.desc,
      value: key,
    };
    const parsedEmoji = ui.parseEmoji(cat.emoji);
    if (parsedEmoji) option.emoji = parsedEmoji;
    selectOptions.push(option);
  }

  const selectPlaceholder = activeCat
    ? (isEn ? "Select another category..." : "Pilih menu bantuan lain...")
    : (isEn ? "Select a help category..." : "Pilih kategori bantuan...");

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder(`📚 ${selectPlaceholder}`)
    .setDisabled(disabled)
    .addOptions(selectOptions);

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  // 2. Tombol Navigasi Pagination (5 Tombol: First, Prev, Page Indicator, Next, Last)
  const isFirst = categoryIndex <= 0;
  const isLast = categoryIndex >= categoryKeys.length - 1;
  const isOverview = categoryIndex === -1;

  const firstBtn = new ButtonBuilder()
    .setCustomId("help_first")
    .setLabel("⏮️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || isFirst);

  const prevBtn = new ButtonBuilder()
    .setCustomId("help_prev")
    .setLabel(isEn ? "◀️ Prev" : "◀️ Sebelumnya")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || isOverview);

  const pageIndicator = new ButtonBuilder()
    .setCustomId("help_page_indicator")
    .setLabel(
      isOverview
        ? (isEn ? "🏠 Overview" : "🏠 Beranda")
        : `📄 ${categoryIndex + 1} / ${categoryKeys.length}`,
    )
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(true);

  const nextBtn = new ButtonBuilder()
    .setCustomId("help_next")
    .setLabel(isEn ? "Next ▶️" : "Selanjutnya ▶️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || isLast);

  const lastBtn = new ButtonBuilder()
    .setCustomId("help_last")
    .setLabel("⏭️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || isLast);

  const navRow = new ActionRowBuilder().addComponents(
    firstBtn,
    prevBtn,
    pageIndicator,
    nextBtn,
    lastBtn,
  );

  const footerText = ui.stripCustomEmojis(ui.getFooter("core"));
  const eHelp = e("help", "📚");

  const categoryBanners = {
    overview:
      ui.getBanner("help") || "./assets/general/Utility & Tools Banner.jpeg",
    core:
      ui.getBanner("utility") || "./assets/general/Utility & Tools Banner.jpeg",
    naura:
      ui.getBanner("about") || "./assets/general/Utility & Tools Banner.jpeg",
    ai:
      ui.getBanner("about") || "./assets/general/Utility & Tools Banner.jpeg",
    music: ui.getBanner("music") || "./assets/general/Music Banner.jpeg",
    survival:
      ui.getBanner("economy") ||
      "./assets/general/Economy & Market Banner.jpeg",
    minigame:
      ui.getBanner("minigame") ||
      "./assets/general/Minigame & Arcade Banner.jpeg",
    utility:
      ui.getBanner("utility") || "./assets/general/Utility & Tools Banner.jpeg",
    admin:
      ui.getBanner("admin") || "./assets/general/Admin & Security Banner.jpeg",
  };

  const activeBannerPath = activeKey
    ? categoryBanners[activeKey]
    : categoryBanners.overview;
  const bannerFilename = `help-banner-${activeKey || "main"}.jpeg`;
  const files = [];

  if (activeBannerPath && fs.existsSync(activeBannerPath)) {
    files.push(
      new AttachmentBuilder(activeBannerPath, { name: bannerFilename }),
    );
  }

  const containerComponents = [
    {
      type: 10,
      content: `## ${eHelp} ${lang.HELP_TITLE || "Naura Help System"}`,
    },
    { type: 14, divider: true, spacing: 1 },
    { type: 10, content: bodyContent },
  ];

  if (files.length > 0) {
    containerComponents.push({ type: 14, divider: true, spacing: 1 });
    containerComponents.push({
      type: 12, // MEDIA_GALLERY
      items: [{ media: { url: `attachment://${bannerFilename}` } }],
    });
  }

  containerComponents.push(
    { type: 14, divider: true, spacing: 1 },
    selectRow.toJSON(),
    navRow.toJSON(),
    { type: 14, divider: false, spacing: 1 },
    { type: 10, content: `-# ${footerText}` },
  );

  return {
    flags: MessageFlags.IsComponentsV2,
    files,
    components: [
      {
        type: 17,
        accent_color: accentColor,
        components: containerComponents,
      },
    ],
    _categoryKeys: categoryKeys,
    _categories: categories,
  };
}

module.exports = {
  HELP_CATEGORY_KEYS,
  formatHelpContent,
  buildHelpCategories,
  buildHelpPayload,
};
