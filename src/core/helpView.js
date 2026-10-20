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
const env = require("../config/env");
const { getColorInt } = require("../config/tokens/designTokens");
const languageManager = require("../managers/languageManager");
const commandRegistry = require("../services/commandRegistry");
const { findClosestCommand } = require("../utils/levenshteinSuggest");
const { buildContainerV2, buildErrorContainerV2 } = require("../utils/NauraContainerBuilder");

const HELP_CATEGORY_KEYS = [
  "core",
  "music",
  "survival",
  "card",
  "ai",
  "leveling",
  "minigames",
  "fun",
  "utility",
  "premium",
  "naura",
  "admin",
  "modmail",
];

function getHelpCategoryKeys() {
  if (commandRegistry && typeof commandRegistry.getCategoryKeys === "function") {
    return commandRegistry.getCategoryKeys();
  }
  return HELP_CATEGORY_KEYS;
}

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

  const categories = {
    core: {
      emoji: e("help_core", "⚙️"),
      label: lang.HELP_CAT_CORE_LABEL || "Core System",
      desc: lang.HELP_CAT_CORE_DESC || "Sistem bot, status, dan ping.",
      content: formatHelpContent(lang.HELP_CONTENT_CORE),
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
    card: {
      emoji: "🃏",
      label: lang.HELP_CAT_CARD_LABEL || (isEn ? "Card Collection" : "Koleksi Kartu"),
      desc:
        lang.HELP_CAT_CARD_DESC ||
        (isEn
          ? "Card collection, anime decks, and battles."
          : "Koleksi kartu anime, fusion, gacha, dan duel kartu."),
      content: formatHelpContent(lang.HELP_CONTENT_CARD),
    },
    ai: {
      emoji: e("help_ai", "🤖"),
      label: isEn ? "🤖 AI Intelligence" : "🤖 Kecerdasan AI",
      desc: lang.HELP_CAT_AI_DESC || "AI Ensemble obrolan dan terjemahan.",
      content: formatHelpContent(lang.HELP_CONTENT_AI),
    },
    leveling: {
      emoji: "⭐",
      label: lang.HELP_CAT_LEVELING_LABEL || "Leveling & XP",
      desc:
        lang.HELP_CAT_LEVELING_DESC ||
        (isEn
          ? "Server rankings, leaderboard, and rank cards."
          : "Peringkat server, leaderboard, dan kartu level."),
      content: formatHelpContent(lang.HELP_CONTENT_LEVELING),
    },
    minigames: {
      emoji: e("help_game", "🎮"),
      label: lang.HELP_CAT_GAME_LABEL || "Minigame & Arcade",
      desc: lang.HELP_CAT_GAME_DESC || "Permainan santai dan seru.",
      content: formatHelpContent(lang.HELP_CONTENT_GAME),
    },
    fun: {
      emoji: e("help_fun", "🎉"),
      label: lang.HELP_CAT_FUN_LABEL || (isEn ? "🎉 Fun & Social" : "🎉 Hiburan & Sosial"),
      desc:
        lang.HELP_CAT_FUN_DESC ||
        (isEn
          ? "Casual social entertainment without betting or monetary risks."
          : "Perintah seru-seruan tanpa risiko saldo."),
      content: formatHelpContent(lang.HELP_CONTENT_FUN),
    },
    utility: {
      emoji: e("help_utility", "🧰"),
      label: isEn ? "🧰 Utility & Tools" : "🧰 Utilitas & Alat",
      desc: lang.HELP_CAT_UTILITY_DESC || "Alat bantu dan produktivitas.",
      content: formatHelpContent(lang.HELP_CONTENT_UTILITY),
    },
    premium: {
      emoji: "💎",
      label: lang.HELP_CAT_PREMIUM_LABEL || "Naura VIP Premium",
      desc:
        lang.HELP_CAT_PREMIUM_DESC ||
        (isEn
          ? "Subscription benefits, voucher redemption, and perks."
          : "Informasi langganan, aktivasi voucher, dan benefit khusus."),
      content: formatHelpContent(lang.HELP_CONTENT_PREMIUM),
    },
    naura: {
      emoji: e("help_naura", "🌸"),
      label: isEn ? "🌸 Naura Companion" : "🌸 Companion Naura",
      desc: lang.HELP_CAT_NAURA_DESC || "Interaksi personal dan cerita Naura.",
      content: formatHelpContent(lang.HELP_CONTENT_NAURA),
    },
    admin: {
      emoji: e("help_admin", "🛠️"),
      label: lang.HELP_CAT_ADMIN_LABEL || "Konfigurasi Admin",
      desc: lang.HELP_CAT_ADMIN_DESC || "Setup dan moderasi server.",
      content: formatHelpContent(lang.HELP_CONTENT_ADMIN),
    },
    modmail: {
      emoji: "📬",
      label: lang.HELP_CAT_MODMAIL_LABEL || (isEn ? "Modmail & Tickets" : "Modmail & Tiket"),
      desc:
        lang.HELP_CAT_MODMAIL_DESC ||
        (isEn
          ? "Staff support message system and ticket reporting."
          : "Layanan bantuan staf dan pelaporan tiket server."),
      content: formatHelpContent(lang.HELP_CONTENT_MODMAIL),
    },
  };

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
    } catch (_) {}
  }

  return categories;
}

function buildCategoryBanners() {
  return {
    overview:
      ui.getBanner("help") || "./assets/general/Utility & Tools Banner.jpeg",
    core: ui.getBanner("about") || "./assets/core/banner_about.png",
    music: ui.getBanner("music") || "./assets/general/Music Banner.jpeg",
    survival:
      ui.getBanner("economy") ||
      "./assets/general/Economy & Market Banner.jpeg",
    card:
      ui.getBanner("minigame") ||
      "./assets/general/Minigame & Arcade Banner.jpeg",
    ai: ui.getBanner("about") || "./assets/core/banner_about.png",
    leveling: ui.getBanner("levelUp") || "./assets/core/levelbg.png",
    minigames:
      ui.getBanner("minigame") ||
      "./assets/general/Minigame & Arcade Banner.jpeg",
    fun:
      ui.getBanner("giveaway") ||
      "./assets/general/Giveaway & Event Banner.jpeg",
    utility:
      ui.getBanner("utility") || "./assets/general/Utility & Tools Banner.jpeg",
    premium:
      ui.getBanner("economy") ||
      "./assets/general/Economy & Market Banner.jpeg",
    naura: ui.getBanner("about") || "./assets/core/avatar.png",
    admin:
      ui.getBanner("admin") || "./assets/general/Admin & Security Banner.jpeg",
    modmail:
      ui.getBanner("ticket") || "./assets/general/Support & Ticket Banner.jpeg",
  };
}

function buildHelpPayload(
  langInput,
  clientOrIndex,
  maybeIndex,
  maybeDisabled,
  maybeUser,
  subPage = 0,
) {
  let categoryIndex = -1;
  let disabled = false;
  let user = null;
  let currentSubPage = 0;

  if (typeof clientOrIndex === "number") {
    categoryIndex = clientOrIndex;
    disabled = Boolean(maybeIndex);
    user = typeof maybeDisabled === "object" ? maybeDisabled : null;
    currentSubPage =
      typeof maybeUser === "number"
        ? maybeUser
        : typeof subPage === "number"
          ? subPage
          : 0;
  } else {
    categoryIndex = typeof maybeIndex === "number" ? maybeIndex : -1;
    disabled = Boolean(maybeDisabled);
    user = maybeUser || null;
    currentSubPage = typeof subPage === "number" ? subPage : 0;
  }

  const lang =
    typeof langInput === "object" && langInput !== null
      ? langInput
      : languageManager.getLanguageSync(langInput);

  const categoryKeys = getHelpCategoryKeys();
  const userName = ui.ux.resolveUserName(user);
  const isEn =
    lang && (lang.LANG_CODE === "en" || lang.HELP_TITLE?.includes("Help"));
  const categories = buildHelpCategories(lang);

  const activeKey = categoryIndex >= 0 ? categoryKeys[categoryIndex] : null;
  const activeCat = activeKey
    ? (categories[activeKey] || {
        emoji: "📁",
        label: activeKey.charAt(0).toUpperCase() + activeKey.slice(1),
        desc: isEn ? `Commands for ${activeKey} module.` : `Kumpulan perintah modul ${activeKey}.`,
        content: "",
      })
    : null;

  let bodyContent = "";
  let totalSubPages = 1;

  if (activeCat) {
    const catData = commandRegistry.getCategory(activeKey);
    const cmds = catData?.commands || [];

    if (cmds.length > 0) {
      const pageSize = 10;
      totalSubPages = Math.max(1, Math.ceil(cmds.length / pageSize));
      if (currentSubPage >= totalSubPages) currentSubPage = totalSubPages - 1;
      if (currentSubPage < 0) currentSubPage = 0;

      const startIdx = currentSubPage * pageSize;
      const pageCmds = cmds.slice(startIdx, startIdx + pageSize);

      const listLines = pageCmds.map((c) => {
        let line = `• **\`/${c.name}\`**`;
        if (Array.isArray(c.subcommands) && c.subcommands.length > 0) {
          const subNames = c.subcommands.map((s) => s.name).slice(0, 4).join(", ");
          const more = c.subcommands.length > 4 ? ` +${c.subcommands.length - 4}` : "";
          line += ` *(${c.subcommands.length} aksi: ${subNames}${more})* : ${c.description}`;
        } else if (Array.isArray(c.options) && c.options.length > 0) {
          line = `• **\`${c.syntax}\`** : ${c.description}`;
        } else {
          line += ` : ${c.description}`;
        }
        return line;
      });

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
      ].filter((x) => x !== null && x !== undefined).join("\n");
    } else {
      bodyContent = `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`;
    }
  } else {
    // Quick-Start Bento untuk Beranda (Overview)
    bodyContent = [
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
        ? `⌨️ **Prefix Support:** You can also type commands with the \`${env.PREFIX || "n!"}\` prefix (e.g. \`${env.PREFIX || "n!"}play\`, \`${env.PREFIX || "n!"}help\`, \`${env.PREFIX || "n!"}rank\`, \`${env.PREFIX || "n!"}ping\`).`
        : `⌨️ **Dukungan Prefix:** Selain Slash Command, kamu juga bisa mengetik langsung dengan prefix \`${env.PREFIX || "n!"}\` (contoh: \`${env.PREFIX || "n!"}play\`, \`${env.PREFIX || "n!"}help\`, \`${env.PREFIX || "n!"}rank\`, \`${env.PREFIX || "n!"}ping\`).`,
      "",
      isEn
        ? "💡 *Use the dropdown menu below to explore all 13 modules, or look up any command with `/core help command:<name>`.*"
        : "💡 *Pilih kategori di menu dropdown di bawah untuk menjelajahi 13 modul lengkap, atau cari perintah instan dengan `/core help command:<nama>`.*",
    ].join("\n");
  }

  const accentColor = getColorInt("primary", ui.getColor("primary") || "#FFB6C1");

  // 1. Dropdown Menu (Select Menu): Menampilkan seluruh 13 kategori publik
  const selectOptions = [];
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

  for (const key of categoryKeys) {
    if (key === activeKey) continue;
    const cat = categories[key] || {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      desc: isEn ? `Commands for ${key} module.` : `Kumpulan perintah modul ${key}.`,
      emoji: "📁",
    };
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
    ? isEn
      ? "Select another category..."
      : "Pilih menu bantuan lain..."
    : isEn
      ? "Select a help category..."
      : "Pilih kategori bantuan...";

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder(`📚 ${selectPlaceholder}`)
    .setDisabled(disabled)
    .addOptions(selectOptions.slice(0, 25));

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  // 2. Tombol Navigasi Pagination 5-Tombol
  const isFirst = categoryIndex <= 0 && currentSubPage <= 0;
  const isLast =
    categoryIndex >= categoryKeys.length - 1 &&
    currentSubPage >= totalSubPages - 1;
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

  const navRow = new ActionRowBuilder().addComponents(
    firstBtn,
    prevBtn,
    pageIndicator,
    nextBtn,
    lastBtn,
  );

  const footerText = ui.stripCustomEmojis(ui.getFooter("core"));
  const eHelp = e("help", "📚");

  const categoryBanners = buildCategoryBanners();
  const activeBannerPath = activeKey
    ? (categoryBanners[activeKey] || categoryBanners.overview)
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
      type: 12,
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
    _subPage: currentSubPage,
    _totalSubPages: totalSubPages,
  };
}

function handleCommandDetailHelp(query, langInput) {
  const lang =
    typeof langInput === "object" && langInput !== null
      ? langInput
      : languageManager.getLanguageSync(langInput);
  const isEn =
    lang && (lang.LANG_CODE === "en" || lang.HELP_TITLE?.includes("Help"));

  const detail = commandRegistry.getCommandDetail(query);

  if (!detail) {
    const allCmds = commandRegistry.getAllCommands().map((c) => c.name);
    const closest = findClosestCommand(query, allCmds, 3);
    const hint = closest
      ? isEn
        ? `Did you mean **\`/${closest.name}\`**?`
        : `Mungkin maksudmu **\`/${closest.name}\`**?`
      : isEn
        ? "Type `/core help` to browse all available commands."
        : "Ketik `/core help` untuk melihat seluruh kategori perintah.";

    return buildErrorContainerV2({
      title: isEn ? "Command Not Found" : "Perintah Tidak Ditemukan",
      description: isEn
        ? `The command \`${query}\` was not found in Naura's registry.\n\n${hint}`
        : `Perintah \`${query}\` tidak ditemukan dalam sistem Naura.\n\n${hint}`,
      footerText: ui.getFooter("core"),
    });
  }

  const categoryName = (detail.category || "utility").toUpperCase();
  const desc = detail.description || (isEn ? "No description provided." : "Tidak ada deskripsi.");

  const prefix = env.PREFIX || "n!";
  const lines = [
    `**${isEn ? "Description" : "Deskripsi"}:**\n> ${desc}`,
    "",
    `**${isEn ? "Syntax" : "Format Sintaks"}:**`,
    `\`\`\`bash\nSlash : ${detail.syntax}\nPrefix: ${prefix}${detail.name}\n\`\`\``,
  ];

  if (Array.isArray(detail.options) && detail.options.length > 0) {
    lines.push(`**${isEn ? "Parameters" : "Parameter / Opsi"}:**`);
    for (const opt of detail.options) {
      const req = opt.required
        ? isEn
          ? "Required"
          : "Wajib"
        : isEn
          ? "Optional"
          : "Opsional";
      const choices =
        Array.isArray(opt.choices) && opt.choices.length > 0
          ? ` *[${opt.choices.join(", ")}]*`
          : "";
      lines.push(`• \`${opt.name}\` (${req}): ${opt.description || "-"}${choices}`);
    }
    lines.push("");
  }

  if (Array.isArray(detail.subcommands) && detail.subcommands.length > 0) {
    lines.push(`**${isEn ? "Available Subcommands" : "Subcommand Tersedia"} (${detail.subcommands.length}):**`);
    for (const sub of detail.subcommands.slice(0, 15)) {
      const fullCmd = sub.fullName || (sub.group ? `${detail.name} ${sub.group} ${sub.name}` : `${detail.name} ${sub.name}`);
      lines.push(`• \`/${fullCmd}\` : ${sub.description || "-"}`);
    }
    if (detail.subcommands.length > 15) {
      lines.push(isEn ? `*...and ${detail.subcommands.length - 15} more subcommands.*` : `*...dan ${detail.subcommands.length - 15} subcommand lainnya.*`);
    }
    lines.push("");
  }

  if (Array.isArray(detail.aliases) && detail.aliases.length > 0) {
    const aliasSlash = detail.aliases.map((a) => `\`/${a}\``).join(", ");
    const aliasPrefix = detail.aliases.map((a) => `\`${prefix}${a}\``).join(", ");
    lines.push(`**${isEn ? "Aliases" : "Alias Singkat"}:** ${aliasSlash} · (Prefix: ${aliasPrefix})`);
    lines.push("");
  }

  lines.push(
    isEn
      ? "-# *Tip: Use `/core help` or `" + prefix + "help` to return to the interactive guide.*"
      : "-# *Tips: Gunakan `/core help` atau `" + prefix + "help` untuk kembali ke panduan interaktif.*",
  );

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

module.exports = {
  HELP_CATEGORY_KEYS,
  getHelpCategoryKeys,
  formatHelpContent,
  buildHelpCategories,
  buildHelpPayload,
  handleCommandDetailHelp,
};
