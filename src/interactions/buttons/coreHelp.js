"use strict";

const languageManager = require("../../managers/languageManager");
const { buildHelpPayload, HELP_CATEGORY_KEYS } = require("../../core/helpView");

function getCurrentCategoryIndex(interaction) {
  let currentIndex = -1;
  const indicatorBtn = interaction.message.components?.[1]?.components?.find(
    (c) =>
      c.customId === "help_page_indicator" ||
      c.data?.custom_id === "help_page_indicator",
  );
  if (indicatorBtn && indicatorBtn.label) {
    const match = indicatorBtn.label.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      currentIndex = parseInt(match[1], 10) - 1;
    }
  }
  return currentIndex;
}

module.exports = [
  {
    id: "help_first",
    label: "help-first-button",
    defer: "update",
    async handler(interaction) {
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);
      const payload = buildHelpPayload(lang, 0, false, interaction.user);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
  {
    id: "help_prev",
    label: "help-prev-button",
    defer: "update",
    async handler(interaction) {
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);
      const current = getCurrentCategoryIndex(interaction);
      const targetIndex = current <= 0 ? -1 : current - 1;
      const payload = buildHelpPayload(
        lang,
        targetIndex,
        false,
        interaction.user,
      );
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
  {
    id: "help_next",
    label: "help-next-button",
    defer: "update",
    async handler(interaction) {
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);
      const current = getCurrentCategoryIndex(interaction);
      const targetIndex =
        current === -1
          ? 0
          : Math.min(HELP_CATEGORY_KEYS.length - 1, current + 1);
      const payload = buildHelpPayload(
        lang,
        targetIndex,
        false,
        interaction.user,
      );
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
  {
    id: "help_last",
    label: "help-last-button",
    defer: "update",
    async handler(interaction) {
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);
      const targetIndex = HELP_CATEGORY_KEYS.length - 1;
      const payload = buildHelpPayload(
        lang,
        targetIndex,
        false,
        interaction.user,
      );
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
];
