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
const {
  buildFeatureOverviewText,
  buildFeatureSummaryFields,
} = require("../utils/featureRegistryView");

const HELP_CATEGORY_KEYS = [
  "overview",
  "core",
  "music",
  "minigame",
  "survival",
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

function featureOverviewContent(lang) {
  const intro = formatHelpContent(lang.HELP_DESC);
  const overview = buildFeatureOverviewText();
  const registryFields = buildFeatureSummaryFields()
    .map((field) => `**${field.name}**\n${field.value}`)
    .join("\n\n");

  return `${intro}\n\n${overview}\n\n${registryFields}`;
}

function buildHelpCategories(langInput) {
  const lang =
    typeof langInput === "object" && langInput !== null
      ? langInput
      : languageManager.getLanguageSync(langInput);

  return {
    overview: {
      emoji: e("help", "📚"),
      label: lang.HELP_CAT_OVERVIEW_LABEL || "Feature Overview",
      desc: lang.HELP_CAT_OVERVIEW_DESC || "Modul utama Naura.",
      content: featureOverviewContent(lang),
    },
    core: {
      emoji: e("help_core", "⚙️"),
      label: lang.HELP_CAT_CORE_LABEL || "Core & Utility",
      desc: lang.HELP_CAT_CORE_DESC || "Perintah esensial bot",
      content: formatHelpContent(lang.HELP_CONTENT_CORE),
    },
    music: {
      emoji: e("help_music", "🎵"),
      label: lang.HELP_CAT_MUSIC_LABEL || "Music",
      desc: lang.HELP_CAT_MUSIC_DESC || "Pemutar audio",
      content: formatHelpContent(lang.HELP_CONTENT_MUSIC),
    },
    minigame: {
      emoji: e("help_game", "🎮"),
      label: lang.HELP_CAT_GAME_LABEL || "Minigames",
      desc: lang.HELP_CAT_GAME_DESC || "Arcade mini games",
      content: formatHelpContent(lang.HELP_CONTENT_GAME),
    },
    survival: {
      emoji: e("help_survival", "🏕️"),
      label: lang.HELP_CAT_SURVIVAL_LABEL || "Survival RPG",
      desc: lang.HELP_CAT_SURVIVAL_DESC || "Petualangan RPG",
      content: formatHelpContent(lang.HELP_CONTENT_SURVIVAL),
    },
    admin: {
      emoji: e("help_admin", "🛠️"),
      label: lang.HELP_CAT_ADMIN_LABEL || "Admin & Security",
      desc: lang.HELP_CAT_ADMIN_DESC || "Pengaturan server",
      content: formatHelpContent(lang.HELP_CONTENT_ADMIN),
    },
  };
}

function buildHelpPayload(lang, categoryIndex = 0, disabled = false) {
  const categoryKeys = HELP_CATEGORY_KEYS;
  const categories = buildHelpCategories(lang);
  const activeKey = categoryKeys[categoryIndex] || "overview";
  const activeCat = categories[activeKey];
  const bodyContent = `${activeCat.emoji} **${activeCat.label}**\n\n${activeCat.content}`;

  const primaryHex = (ui.getColor("primary") || "#FFB6C1").replace("#", "");
  const accentColor = parseInt(primaryHex, 16);

  const selectOptions = categoryKeys.map((key) => {
    const option = {
      label: categories[key].label,
      description: categories[key].desc,
      value: key,
      default: key === activeKey,
    };
    const parsedEmoji = ui.parseEmoji(categories[key].emoji);
    if (parsedEmoji) option.emoji = parsedEmoji;
    return option;
  });

  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("help_category_select")
    .setPlaceholder(`📚 ${lang.HELP_PLACEHOLDER || "Naura Help Menu"}`)
    .setDisabled(disabled)
    .addOptions(selectOptions);

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);
  const prevBtn = new ButtonBuilder()
    .setCustomId("help_prev")
    .setLabel(lang.HELP_BTN_PREV || "« Categories")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || categoryIndex <= 0);
  const nextBtn = new ButtonBuilder()
    .setCustomId("help_next")
    .setLabel(lang.HELP_BTN_NEXT || "Categories »")
    .setStyle(ButtonStyle.Secondary)
    .setDisabled(disabled || categoryIndex >= categoryKeys.length - 1);
  const navRow = new ActionRowBuilder().addComponents(prevBtn, nextBtn);

  const footerText = ui.stripCustomEmojis(ui.getFooter("core"));
  const eHelp = e("help", "📚");

  const categoryBanners = {
    overview: ui.getBanner("help") || "./assets/general/Utility & Tools Banner.jpeg",
    core: ui.getBanner("utility") || "./assets/general/Utility & Tools Banner.jpeg",
    music: ui.getBanner("music") || "./assets/general/Music Banner.jpeg",
    minigame: ui.getBanner("minigame") || "./assets/general/Minigame & Arcade Banner.jpeg",
    survival: ui.getBanner("economy") || "./assets/general/Economy & Market Banner.jpeg",
    admin: ui.getBanner("admin") || "./assets/general/Admin & Security Banner.jpeg",
  };

  const activeBannerPath = categoryBanners[activeKey] || categoryBanners.overview;
  const bannerFilename = `help-banner-${activeKey || "overview"}.jpeg`;
  const files = [];

  if (activeBannerPath && fs.existsSync(activeBannerPath)) {
    files.push(new AttachmentBuilder(activeBannerPath, { name: bannerFilename }));
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
  featureOverviewContent,
  buildHelpCategories,
  buildHelpPayload,
};
