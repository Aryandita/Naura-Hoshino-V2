"use strict";

/**
 * 📚 Help System UI Builder - Naura Hoshino V2
 * ---------------------------------------------
 * Builds interactive help menu with Components V2 Discord format.
 * Supports 13 command categories, pagination, and bilingual (ID/EN) content.
 *
 * @module src/core/helpView
 */

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
const env = require("../config/env");
const { getColorInt } = require("../config/tokens/designTokens");
const languageManager = require("../managers/languageManager");
const commandRegistry = require("../services/commandRegistry");
const { findClosestCommand } = require("../utils/levenshteinSuggest");
const { buildContainerV2, buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS - Named values for clarity and maintainability
// ============================================================================

/** Default category keys if registry unavailable */
const HELP_CATEGORY_KEYS = [
  "core", "music", "survival", "card", "ai", "leveling",
  "minigames", "fun", "utility", "premium", "naura", "admin", "modmail",
];

/** Pagination settings */
const COMMANDS_PER_PAGE = 10;
const MAX_SUBCOMMANDS_DISPLAYED = 4;
const MAX_SUBCOMMANDS_DETAIL = 15;

/** Discord API limits */
const MAX_SELECT_MENU_OPTIONS = 25;

/** Component types (Discord Components V2) */
const COMPONENT_TYPE = {
  TEXT: 10,
  SEPARATOR: 14,
  MEDIA_GALLERY: 12,
  CONTAINER: 17,
};

// ============================================================================
// HELPER FUNCTIONS - Small, focused utilities
// ============================================================================

/**
 * Get emoji by name with fallback if not found.
 * @param {string} name - Emoji key from ui config
 * @param {string} fallback - Fallback emoji string
 * @returns {string} Resolved emoji or fallback
 */
function getEmojiWithFallback(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Check if language is English based on code or title.
 * @param {object|string|null} langInput - Language object or code
 * @returns {boolean} True if English
 */
function isEnglishLanguage(langInput) {
  const lang = resolveLanguage(langInput);
  return Boolean(lang && (lang.LANG_CODE === "en" || lang.HELP_TITLE?.includes("Help")));
}

/**
 * Resolve language input to language object.
 * @param {object|string|null} langInput - Language object or code string
 * @returns {object|null} Language object or null
 */
function resolveLanguage(langInput) {
  if (typeof langInput === "object" && langInput !== null) {
    return langInput;
  }
  return languageManager.getLanguageSync(langInput);
}

/**
 * Format help content by replacing emoji placeholders.
 * Pattern: {emoji:key|fallback} -> resolved emoji or fallback
 * @param {string} text - Raw content with placeholders
 * @returns {string} Formatted content
 */
function formatHelpContent(text) {
  if (!text) return "";
  return text.replace(
    /{emoji:(\w+)(?:\|([^}]+))?}/g,
    (match, key, fallback) => ui.getEmoji(key) || fallback || match,
  );
}

/**
 * Build quick-start guide content for overview page.
 * @param {boolean} isEn - Is English language
 * @param {string} userName - User display name
 * @param {string} prefix - Bot prefix
 * @returns {string} Formatted quick-start content
 */
function buildQuickStartContent(isEn, userName, prefix) {
  const lines = [
    isEn
      ? `Hello **${userName}**! Welcome to **Naura Hoshino Help Center** ✨`
      : `Halo Kak **${userName}**! Selamat datang di **Pusat Bantuan Naura Hoshino** ✨`,
    isEn
      ? "Here are essential commands to get you started quickly:"
      : "Berikut adalah panduan perintah esensial untuk memulai:",
    "",
    "🚀 **Quick-Start Bento (Perintah Esensial):**",
    isEn
      ? "• 🎵 **/music play <query>** : Play your favorite tunes from YouTube, Spotify, or SoundCloud."
      : "• 🎵 **/music play <query>** : Putar musik favoritmu dari YouTube, Spotify, atau SoundCloud.",
    isEn
      ? "• 🏕️ **/survival start** : Begin your Naura Wilds survival RPG adventure & claim starter kit."
      : "• 🏕️ **/survival start** : Mulai petualangan survival RPG Naura Wilds dan klaim Starter Pack.",
    isEn
      ? "• 🤖 **/ai chat <message>** : Interactive conversations with Naura's Multi-Model AI Ensemble."
      : "• 🤖 **/ai chat <pesan>** : Obrolan interaktif dan cerdas bersama AI Ensemble Naura.",
    isEn
      ? "• ⭐ **/rank** : Check your visual XP card, level progress, and server standing."
      : "• ⭐ **/rank** : Cek kartu profil level, XP, dan progres keaktifanmu di server.",
    isEn
      ? "• 🎮 **/minigame** : Open casual arcade games (TicTacToe, RPS, Trivia, Word Guess)."
      : "• 🎮 **/minigame** : Buka pusat game santai (TicTacToe, RPS, Trivia, Tebak Kata).",
    "",
    isEn
      ? `⌨️ **Prefix Support:** You can also type commands with the \`${prefix}\` prefix (e.g. \`${prefix}play\`, \`${prefix}help\`, \`${prefix}rank\`, \`${prefix}ping\`).`
      : `⌨️ **Dukungan Prefix:** Selain Slash Command, kamu juga bisa mengetik langsung dengan prefix \`${prefix}\` (contoh: \`${prefix}play\`, \`${prefix}help\`, \`${prefix}rank\`, \`${prefix}ping\`).`,
    "",
    isEn
      ? "💡 *Use the dropdown menu below to explore all 13 modules, or look up any command with `/core help command:<name>`.*"
      : "💡 *Pilih kategori di menu dropdown di bawah untuk menjelajahi 13 modul lengkap, atau cari perintah instan dengan `/core help command:<nama>`.*",
  ];
  return lines.join("\n");
}

/**
 * Format command list line for display.
 * @param {object} cmd - Command object from registry
 * @returns {string} Formatted line
 */
function formatCommandLine(cmd) {
  let line = `• **\`/${cmd.name}\`**`;

  if (Array.isArray(cmd.subcommands) && cmd.subcommands.length > 0) {
    const subNames = cmd.subcommands
      .map((s) => s.name)
      .slice(0, MAX_SUBCOMMANDS_DISPLAYED)
      .join(", ");
    const more = cmd.subcommands.length > MAX_SUBCOMMANDS_DISPLAYED
      ? ` +${cmd.subcommands.length - MAX_SUBCOMMANDS_DISPLAYED}`
      : "";
    line += ` *(${cmd.subcommands.length} aksi: ${subNames}${more})* : ${cmd.description}`;
  } else if (Array.isArray(cmd.options) && cmd.options.length > 0) {
    line = `• **\`${cmd.syntax}\`** : ${cmd.description}`;
  } else {
    line += ` : ${cmd.description}`;
  }

  return line;
}

// ============================================================================
// CATEGORY BUILDERS - Data-driven configuration
// ============================================================================

/**
 * Category definition template for data-driven construction.
 * @typedef {Object} CategoryDefinition
 * @property {string} id - Category identifier
 * @property {string} emojiKey - Emoji key in ui config
 * @property {string} fallback - Fallback emoji
 * @property {string} labelKey - Label key in language file
 * @property {string} descKey - Description key in language file
 * @property {string} contentKey - Content key in language file
 * @property {Function} [labelFn] - Custom label formatter
 * @property {Function} [descFn] - Custom description formatter
 */

/** @type {CategoryDefinition[]} */
const CATEGORY_DEFINITIONS = [
  {
    id: "core",
    emojiKey: "help_core",
    fallback: "⚙️",
    labelKey: "HELP_CAT_CORE_LABEL",
    descKey: "HELP_CAT_CORE_DESC",
    contentKey: "HELP_CONTENT_CORE",
  },
  {
    id: "music",
    emojiKey: "help_music",
    fallback: "🎵",
    labelKey: "HELP_CAT_MUSIC_LABEL",
    descKey: "HELP_CAT_MUSIC_DESC",
    contentKey: "HELP_CONTENT_MUSIC",
    labelFn: (isEn) => isEn ? "⭐ Music & Audio (Popular)" : "⭐ Musik & Audio (Populer)",
  },
  {
    id: "survival",
    emojiKey: "help_survival",
    fallback: "🏕️",
    labelKey: "HELP_CAT_SURVIVAL_LABEL",
    descKey: "HELP_CAT_SURVIVAL_DESC",
    contentKey: "HELP_CONTENT_SURVIVAL",
    labelFn: (isEn) => isEn
      ? "⭐ RPG Survival & Economy (Featured)"
      : "⭐ RPG Survival & Ekonomi (Rekomendasi)",
  },
  {
    id: "card",
    emojiKey: null,
    fallback: "🃏",
    labelKey: "HELP_CAT_CARD_LABEL",
    descKey: "HELP_CAT_CARD_DESC",
    contentKey: "HELP_CONTENT_CARD",
    labelFn: (isEn) => isEn ? "Card Collection" : "Koleksi Kartu",
    descFn: (isEn) => isEn
      ? "Card collection, anime decks, and battles."
      : "Koleksi kartu anime, fusion, gacha, dan duel kartu.",
  },
  {
    id: "ai",
    emojiKey: "help_ai",
    fallback: "🤖",
    labelKey: "HELP_CAT_AI_LABEL",
    descKey: "HELP_CAT_AI_DESC",
    contentKey: "HELP_CONTENT_AI",
    labelFn: (isEn) => isEn ? "🤖 AI Intelligence" : "🤖 Kecerdasan AI",
  },
  {
    id: "leveling",
    emojiKey: null,
    fallback: "⭐",
    labelKey: "HELP_CAT_LEVELING_LABEL",
    descKey: "HELP_CAT_LEVELING_DESC",
    contentKey: "HELP_CONTENT_LEVELING",
    descFn: (isEn) => isEn
      ? "Server rankings, leaderboard, and rank cards."
      : "Peringkat server, leaderboard, dan kartu level.",
  },
  {
    id: "minigames",
    emojiKey: "help_game",
    fallback: "🎮",
    labelKey: "HELP_CAT_GAME_LABEL",
    descKey: "HELP_CAT_GAME_DESC",
    contentKey: "HELP_CONTENT_GAME",
  },
  {
    id: "fun",
    emojiKey: "help_fun",
    fallback: "🎉",
    labelKey: "HELP_CAT_FUN_LABEL",
    descKey: "HELP_CAT_FUN_DESC",
    contentKey: "HELP_CONTENT_FUN",
    labelFn: (isEn) => isEn ? "🎉 Fun & Social" : "🎉 Hiburan & Sosial",
    descFn: (isEn) => isEn
      ? "Casual social entertainment without betting or monetary risks."
      : "Perintah seru-seruan tanpa risiko saldo.",
  },
  {
    id: "utility",
    emojiKey: "help_utility",
    fallback: "🧰",
    labelKey: "HELP_CAT_UTILITY_LABEL",
    descKey: "HELP_CAT_UTILITY_DESC",
    contentKey: "HELP_CONTENT_UTILITY",
    labelFn: (isEn) => isEn ? "🧰 Utility & Tools" : "🧰 Utilitas & Alat",
  },
  {
    id: "premium",
    emojiKey: null,
    fallback: "💎",
    labelKey: "HELP_CAT_PREMIUM_LABEL",
    descKey: "HELP_CAT_PREMIUM_DESC",
    contentKey: "HELP_CONTENT_PREMIUM",
    descFn: (isEn) => isEn
      ? "Subscription benefits, voucher redemption, and perks."
      : "Informasi langganan, aktivasi voucher, dan benefit khusus.",
  },
  {
    id: "naura",
    emojiKey: "help_naura",
    fallback: "🌸",
    labelKey: "HELP_CAT_NAURA_LABEL",
    descKey: "HELP_CAT_NAURA_DESC",
    contentKey: "HELP_CONTENT_NAURA",
    labelFn: (isEn) => isEn ? "🌸 Naura Companion" : "🌸 Companion Naura",
  },
  {
    id: "admin",
    emojiKey: "help_admin",
    fallback: "🛠️",
    labelKey: "HELP_CAT_ADMIN_LABEL",
    descKey: "HELP_CAT_ADMIN_DESC",
    contentKey: "HELP_CONTENT_ADMIN",
  },
  {
    id: "recovery",
    emojiKey: null,
    fallback: "♻️",
    labelKey: "HELP_CAT_RECOVERY_LABEL",
    descKey: "HELP_CAT_RECOVERY_DESC",
    contentKey: "HELP_CONTENT_RECOVERY",
    labelFn: (isEn) => isEn ? "Disaster Recovery" : "Pemulihan Bencana",
    descFn: (isEn) => isEn
      ? "Emergency recovery tools for mass ban, role restore, and channel backup."
      : "Alat pemulihan darurat untuk unban massal, restore role, dan backup channel.",
  },
  {
    id: "modmail",
    emojiKey: null,
    fallback: "📬",
    labelKey: "HELP_CAT_MODMAIL_LABEL",
    descKey: "HELP_CAT_MODMAIL_DESC",
    contentKey: "HELP_CONTENT_MODMAIL",
    labelFn: (isEn) => isEn ? "Modmail & Tickets" : "Modmail & Tiket",
    descFn: (isEn) => isEn
      ? "Staff support message system and ticket reporting."
      : "Layanan bantuan staf dan pelaporan tiket server.",
  },
];

/**
 * Build category metadata from definitions.
 * @param {object} lang - Language object
 * @param {boolean} isEn - Is English
 * @returns {object} Categories map
 */
function buildCategoriesFromDefinitions(lang, isEn) {
  const categories = {};

  for (const def of CATEGORY_DEFINITIONS) {
    const emoji = def.emojiKey
      ? getEmojiWithFallback(def.emojiKey, def.fallback)
      : def.fallback;

    const label = lang[def.labelKey] || (def.labelFn ? def.labelFn(isEn) : def.id);
    const desc = lang[def.descKey] || (def.descFn ? def.descFn(isEn) : "");
    const content = formatHelpContent(lang[def.contentKey]);

    categories[def.id] = { emoji, label, desc, content };
  }

  return categories;
}

/**
 * Get active category keys from registry or defaults.
 * @returns {string[]} Array of category keys
 */
function getHelpCategoryKeys() {
  if (commandRegistry && typeof commandRegistry.getCategoryKeys === "function") {
    return commandRegistry.getCategoryKeys();
  }
  return HELP_CATEGORY_KEYS;
}

/**
 * Build help categories with language support.
 * @param {object|string} langInput - Language object or code
 * @returns {object} Categories map with metadata
 */
function buildHelpCategories(langInput) {
  const lang = resolveLanguage(langInput);
  const isEn = isEnglishLanguage(lang);

  const categories = buildCategoriesFromDefinitions(lang, isEn);

  // Merge dynamic categories from registry
  if (commandRegistry && typeof commandRegistry.getCategories === "function") {
    try {
      const regCats = commandRegistry.getCategories();
      for (const cat of regCats) {
        if (!categories[cat.id]) {
          categories[cat.id] = {
            emoji: cat.emoji || "📁",
            label: cat.label || (cat.id.charAt(0).toUpperCase() + cat.id.slice(1)),
            desc: cat.description || (isEn ? `Commands for ${cat.id} module.` : `Kumpulan perintah modul ${cat.id}.`),
            content: cat.description || "",
          };
        }
      }
    } catch (error) {
      // Silently ignore registry errors
    }
  }

  return categories;
}

/**
 * Build banner paths for each category.
 * @returns {object} Banner path map
 */
function buildCategoryBanners() {
  return {
    overview: ui.getBanner("help") || "./assets/general/Utility & Tools Banner.jpeg",
    core: ui.getBanner("about") || "./assets/core/banner_about.png",
    music: ui.getBanner("music") || "./assets/general/Music Banner.jpeg",
    survival: ui.getBanner("economy") || "./assets/general/Economy & Market Banner.jpeg",
    card: ui.getBanner("minigame") || "./assets/general/Minigame & Arcade Banner.jpeg",
    ai: ui.getBanner("about") || "./assets/core/banner_about.png",
    leveling: ui.getBanner("levelUp") || "./assets/core/levelbg.png",
    minigames: ui.getBanner("minigame") || "./assets/general/Minigame & Arcade Banner.jpeg",
    fun: ui.getBanner("giveaway") || "./assets/general/Giveaway & Event Banner.jpeg",
    utility: ui.getBanner("utility") || "./assets/general/Utility & Tools Banner.jpeg",
    premium: ui.getBanner("economy") || "./assets/general/Economy & Market Banner.jpeg",
    naura: ui.getBanner("about") || "./assets/core/avatar.png",
    admin: ui.getBanner("admin") || "./assets/general/Admin & Security Banner.jpeg",
    modmail: ui.getBanner("ticket") || "./assets/general/Support & Ticket Banner.jpeg",
  };
}

// ============================================================================
// MAIN PAYLOAD BUILDER - Refactored with options object
// ============================================================================

/**
 * @typedef {Object} HelpPayloadOptions
 * @property {object|string} [language='id'] - Language object or code
 * @property {number} [categoryIndex=-1] - Active category index (-1 for overview)
 * @property {boolean} [disabled=false] - Disable interactive components
 * @property {object} [user=null] - Discord user object
 * @property {number} [subPage=0] - Sub-page index for pagination
 */

/**
 * Build complete help payload with Components V2 format.
 * Uses options object pattern instead of parameter overloading.
 * @param {HelpPayloadOptions} options - Configuration options
 * @returns {object} Discord message payload
 */
function buildHelpPayload(options = {}) {
  const {
    language = "id",
    categoryIndex = -1,
    disabled = false,
    user = null,
    subPage = 0,
  } = options;

  // Resolve language and detect English
  const lang = resolveLanguage(language);
  const isEn = isEnglishLanguage(lang);
  const prefix = env.PREFIX || "n!";

  // Get category metadata
  const categoryKeys = getHelpCategoryKeys();
  const categories = buildHelpCategories(lang);
  const userName = ui.ux.resolveUserName(user);

  // Determine active category
  const activeKey = categoryIndex >= 0 ? categoryKeys[categoryIndex] : null;
  const activeCat = activeKey
    ? (categories[activeKey] || {
        emoji: "📁",
        label: activeKey.charAt(0).toUpperCase() + activeKey.slice(1),
        desc: isEn ? `Commands for ${activeKey} module.` : `Kumpulan perintah modul ${activeKey}.`,
        content: "",
      })
    : null;

  // Build body content based on context
  let bodyContent = "";
  let totalSubPages = 1;
  let currentSubPage = subPage;

  if (activeCat) {
    // Category detail view with pagination
    const catData = commandRegistry.getCategory(activeKey);
    const cmds = catData?.commands || [];

    if (cmds.length > 0) {
      totalSubPages = Math.max(1, Math.ceil(cmds.length / COMMANDS_PER_PAGE));
      currentSubPage = Math.max(0, Math.min(currentSubPage, totalSubPages - 1));

      const startIdx = currentSubPage * COMMANDS_PER_PAGE;
      const pageCmds = cmds.slice(startIdx, startIdx + COMMANDS_PER_PAGE);
      const listLines = pageCmds.map(formatCommandLine);

      const headerTitle = `${activeCat.emoji} **${activeCat.label}** (${cmds.length} ${isEn ? "Commands" : "Perintah"})`;
      const pageIndicatorText = isEn
        ? `Page **${currentSubPage + 1}** of **${totalSubPages}**`
        : `Halaman **${currentSubPage + 1}** dari **${totalSubPages}**`;
      const categoryDesc = activeCat.desc ? `*${activeCat.desc}*\n` : "";

      bodyContent = [
        headerTitle,
        categoryDesc,
        pageIndicatorText,
        "",
        listLines.join("\n"),
        "",
        isEn
          ? "-# *Tip: Use `/core help command:<name>` for instant syntax lookup.*"
          : "-# *Tips: Gunakan `/core help command:<nama>` untuk melihat detail sintaks perintah.*",
      ].filter((x) => x != null).join("\n");
    } else {
      bodyContent = `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`;
    }
  } else {
    // Overview page with quick-start guide
    bodyContent = buildQuickStartContent(isEn, userName, prefix);
  }

  // Build accent color
  const accentColor = getColorInt("primary", ui.getColor("primary") || "#FFB6C1");

  // Build select menu options
  const selectOptions = [];
  if (activeKey) {
    selectOptions.push({
      label: isEn ? "🏠 Main Overview" : "🏠 Ringkasan Utama",
      description: isEn ? "Return to the main help home page" : "Kembali ke beranda utama menu bantuan",
      value: "overview",
      emoji: { name: "🏠" },
    });
  }

  for (const key of categoryKeys) {
    if (key === activeKey) continue;
    const cat = categories[key] || {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      desc: isEn ? `Commands for ${key} module.` : `Kumpulan perintah modul ${key}.`,
      emoji: "📁",
    };
    const option = { label: cat.label, description: cat.desc, value: key };
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
    .addOptions(selectOptions.slice(0, MAX_SELECT_MENU_OPTIONS));

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  // Build navigation buttons
  const isFirst = categoryIndex <= 0 && currentSubPage <= 0;
  const isLast = categoryIndex >= categoryKeys.length - 1 && currentSubPage >= totalSubPages - 1;
  const isOverview = categoryIndex === -1;

  let indicatorLabel = "";
  if (isOverview) {
    indicatorLabel = isEn ? "🏠 Overview" : "🏠 Beranda";
  } else if (totalSubPages > 1) {
    const catLabel = activeKey === "utility" ? (isEn ? "Utility" : "Utilitas") : activeKey;
    indicatorLabel = `📄 ${currentSubPage + 1}/${totalSubPages} (${catLabel})`;
  } else {
    indicatorLabel = `📄 ${categoryIndex + 1} / ${categoryKeys.length}`;
  }

  const firstBtn = new ButtonBuilder()
    .setCustomId("help_first")
    .setLabel("⏮️")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || isFirst);

  const prevBtn = new ButtonBuilder()
    .setCustomId("help_prev")
    .setLabel(isEn ? "◀️ Prev" : "◀️ Sebelumnya")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || (isOverview && currentSubPage <= 0));

  const pageIndicator = new ButtonBuilder()
    .setCustomId("help_page_indicator")
    .setLabel(indicatorLabel)
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

  const navRow = new ActionRowBuilder().addComponents(firstBtn, prevBtn, pageIndicator, nextBtn, lastBtn);

  // Build footer and banner
  const footerText = ui.stripCustomEmojis(ui.getFooter("core"));
  const eHelp = getEmojiWithFallback("help", "📚");
  const categoryBanners = buildCategoryBanners();
  const activeBannerPath = activeKey
    ? (categoryBanners[activeKey] || categoryBanners.overview)
    : categoryBanners.overview;
  const bannerFilename = `help-banner-${activeKey || "main"}.jpeg`;
  const files = [];

  if (activeBannerPath && fs.existsSync(activeBannerPath)) {
    files.push(new AttachmentBuilder(activeBannerPath, { name: bannerFilename }));
  }

  // Build container components
  const containerComponents = [
    { type: COMPONENT_TYPE.TEXT, content: `## ${eHelp} ${lang.HELP_TITLE || "Naura Help System"}` },
    { type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing: 1 },
    { type: COMPONENT_TYPE.TEXT, content: bodyContent },
  ];

  if (files.length > 0) {
    containerComponents.push({ type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing: 1 });
    containerComponents.push({
      type: COMPONENT_TYPE.MEDIA_GALLERY,
      items: [{ media: { url: `attachment://${bannerFilename}` } }],
    });
  }

  containerComponents.push(
    { type: COMPONENT_TYPE.SEPARATOR, divider: true, spacing: 1 },
    selectRow.toJSON(),
    navRow.toJSON(),
    { type: COMPONENT_TYPE.SEPARATOR, divider: false, spacing: 1 },
    { type: COMPONENT_TYPE.TEXT, content: `-# ${footerText}` },
  );

  return {
    flags: MessageFlags.IsComponentsV2,
    files,
    components: [
      {
        type: COMPONENT_TYPE.CONTAINER,
        accent_color: accentColor,
        components: containerComponents,
      },
    ],
    _categoryKeys: categoryKeys,
    _categories: categories,
    _subPage: currentSubPage,
    _totalSubPages: totalSubPages,
  };
}

// ============================================================================
// COMMAND DETAIL HANDLER - Shows individual command info
// ============================================================================

/**
 * Handle command detail help request.
 * @param {string} query - Command name to search
 * @param {object|string} langInput - Language object or code
 * @returns {object} Discord message payload
 */
function handleCommandDetailHelp(query, langInput) {
  const lang = resolveLanguage(langInput);
  const isEn = isEnglishLanguage(lang);
  const prefix = env.PREFIX || "n!";

  const detail = commandRegistry.getCommandDetail(query);

  // Command not found - show suggestion
  if (!detail) {
    const allCmds = commandRegistry.getAllCommands().map((c) => c.name);
    const closest = findClosestCommand(query, allCmds, 3);
    const hint = closest
      ? (isEn ? `Did you mean **\`/${closest.name}\`**?` : `Mungkin maksudmu **\`/${closest.name}\`**?`)
      : (isEn ? "Type `/core help` to browse all available commands." : "Ketik `/core help` untuk melihat seluruh kategori perintah.");

    return buildErrorContainerV2({
      title: isEn ? "Command Not Found" : "Perintah Tidak Ditemukan",
      description: isEn
        ? `The command \`${query}\` was not found in Naura's registry.\n\n${hint}`
        : `Perintah \`${query}\` tidak ditemukan dalam sistem Naura.\n\n${hint}`,
      footerText: ui.getFooter("core"),
    });
  }

  // Build command detail lines
  const categoryName = (detail.category || "utility").toUpperCase();
  const desc = detail.description || (isEn ? "No description provided." : "Tidak ada deskripsi.");

  const lines = [
    `**${isEn ? "Description" : "Deskripsi"}:**\n> ${desc}`,
    "",
    `**${isEn ? "Syntax" : "Format Sintaks"}:**`,
    `\`\`\`bash\nSlash : ${detail.syntax}\nPrefix: ${prefix}${detail.name}\n\`\`\``,
  ];

  // Add parameters section
  if (Array.isArray(detail.options) && detail.options.length > 0) {
    lines.push(`**${isEn ? "Parameters" : "Parameter / Opsi"}:**`);
    for (const opt of detail.options) {
      const req = opt.required
        ? (isEn ? "Required" : "Wajib")
        : (isEn ? "Optional" : "Opsional");
      const choices = Array.isArray(opt.choices) && opt.choices.length > 0
        ? ` *[${opt.choices.join(", ")}]*`
        : "";
      lines.push(`• \`${opt.name}\` (${req}): ${opt.description || "-"}${choices}`);
    }
    lines.push("");
  }

  // Add subcommands section
  if (Array.isArray(detail.subcommands) && detail.subcommands.length > 0) {
    lines.push(`**${isEn ? "Available Subcommands" : "Subcommand Tersedia"} (${detail.subcommands.length}):**`);
    for (const sub of detail.subcommands.slice(0, MAX_SUBCOMMANDS_DETAIL)) {
      const fullCmd = sub.fullName || (sub.group ? `${detail.name} ${sub.group} ${sub.name}` : `${detail.name} ${sub.name}`);
      lines.push(`• \`/${fullCmd}\` : ${sub.description || "-"}`);
    }
    if (detail.subcommands.length > MAX_SUBCOMMANDS_DETAIL) {
      lines.push(isEn
        ? `*...and ${detail.subcommands.length - MAX_SUBCOMMANDS_DETAIL} more subcommands.*`
        : `*...dan ${detail.subcommands.length - MAX_SUBCOMMANDS_DETAIL} subcommand lainnya.*`);
    }
    lines.push("");
  }

  // Add aliases section
  if (Array.isArray(detail.aliases) && detail.aliases.length > 0) {
    const aliasSlash = detail.aliases.map((a) => `\`/${a}\``).join(", ");
    const aliasPrefix = detail.aliases.map((a) => `\`${prefix}${a}\``).join(", ");
    lines.push(`**${isEn ? "Aliases" : "Alias Singkat"}:** ${aliasSlash} · (Prefix: ${aliasPrefix})`);
    lines.push("");
  }

  // Add tip footer
  lines.push(isEn
    ? "-# *Tip: Use `/core help` or `" + prefix + "help` to return to the interactive guide.*"
    : "-# *Tips: Gunakan `/core help` atau `" + prefix + "help` untuk kembali ke panduan interaktif.*");

  return buildContainerV2({
    title: `📌 ${isEn ? "Command Guide" : "Panduan Perintah"}: /${detail.name}`,
    authorName: `NAURA SYSTEM • [${categoryName}]`,
    description: lines.join("\n"),
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    footerText: ui.getFooter("core"),
    buttonsRow: [
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("help_first")
          .setLabel(isEn ? "🏠 Help Home" : "🏠 Beranda Bantuan")
          .setStyle(ButtonStyle.Primary),
      ),
    ],
  });
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  HELP_CATEGORY_KEYS,
  getHelpCategoryKeys,
  formatHelpContent,
  buildHelpCategories,
  buildHelpPayload,
  handleCommandDetailHelp,
};
