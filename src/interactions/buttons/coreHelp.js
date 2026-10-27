"use strict";

const languageManager = require("../../managers/languageManager");
const {
  buildHelpPayload,
  getHelpCategoryKeys,
  HELP_CATEGORY_KEYS,
} = require("../../core/helpView");

function findIndicatorBtn(message) {
  if (!message || !Array.isArray(message.components)) return null;
  for (const comp of message.components) {
    const children = comp.components || comp.data?.components;
    if (Array.isArray(children)) {
      for (const child of children) {
        const customId = child.customId || child.custom_id || child.data?.custom_id;
        if (customId === "help_page_indicator") {
          return child;
        }
        const subChildren = child.components || child.data?.components;
        if (Array.isArray(subChildren)) {
          for (const subChild of subChildren) {
            const subCustomId = subChild.customId || subChild.custom_id || subChild.data?.custom_id;
            if (subCustomId === "help_page_indicator") {
              return subChild;
            }
          }
        }
      }
    }
  }
  return null;
}

function getCurrentState(interaction) {
  let currentIndex = -1;
  const currentSubPage = 0;
  const categoryKeys =
    typeof getHelpCategoryKeys === "function"
      ? getHelpCategoryKeys()
      : HELP_CATEGORY_KEYS;
  const message = interaction.message || interaction;
  const indicatorBtn = findIndicatorBtn(message);
  const label = indicatorBtn ? (indicatorBtn.label || indicatorBtn.data?.label || "") : "";
  if (label) {
    const subPageMatch = label.match(/(\d+)\/(\d+)\s*\(([^)]+)\)/i);
    if (subPageMatch) {
      const pageNum = parseInt(subPageMatch[1], 10) - 1;
      const totalPages = parseInt(subPageMatch[2], 10);
      const catKeyRaw = subPageMatch[3].trim().toLowerCase();
      let foundIndex = categoryKeys.indexOf(catKeyRaw);
      if (foundIndex === -1) {
        if (catKeyRaw.includes("util")) {
          foundIndex = categoryKeys.indexOf("utility");
        } else {
          foundIndex = categoryKeys.findIndex((k) => catKeyRaw.includes(k) || k.includes(catKeyRaw));
        }
      }
      const isUtility = foundIndex === categoryKeys.indexOf("utility");
      return {
        currentIndex: foundIndex,
        currentSubPage: Math.max(0, pageNum),
        isUtility,
        isSubPaged: true,
        totalSubPages: totalPages,
      };
    }
    const match = label.match(/(\d+)\s*\/\s*(\d+)/);
    if (match) {
      currentIndex = parseInt(match[1], 10) - 1;
    }
  }
  return { currentIndex, currentSubPage, isUtility: false, isSubPaged: false, totalSubPages: 1 };
}

module.exports = [
  {
    id: "help_first",
    label: "help-first-button",
    defer: "update",
    async handler(interaction) {
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);
      const payload = buildHelpPayload({
        language: lang,
        categoryIndex: -1,
        disabled: false,
        user: interaction.user,
        subPage: 0,
      });
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
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);
      const state = getCurrentState(interaction);

      let targetIndex = state.currentIndex;
      let targetSubPage = 0;

      if ((state.isSubPaged || state.isUtility) && state.currentSubPage > 0) {
        targetSubPage = state.currentSubPage - 1;
      } else if (state.currentIndex <= 0) {
        targetIndex = -1;
      } else {
        targetIndex = state.currentIndex - 1;
      }

      const payload = buildHelpPayload({
        language: lang,
        categoryIndex: targetIndex,
        disabled: false,
        user: interaction.user,
        subPage: targetSubPage,
      });
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
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);
      const state = getCurrentState(interaction);

      let targetIndex = state.currentIndex;
      let targetSubPage = 0;

      if ((state.isSubPaged || state.isUtility) && state.currentSubPage < state.totalSubPages - 1) {
        targetSubPage = state.currentSubPage + 1;
      } else if (state.currentIndex === -1) {
        targetIndex = 0;
      } else {
        const categoryKeys =
          typeof getHelpCategoryKeys === "function"
            ? getHelpCategoryKeys()
            : HELP_CATEGORY_KEYS;
        targetIndex = Math.min(
          categoryKeys.length - 1,
          state.currentIndex + 1,
        );
      }

      const payload = buildHelpPayload({
        language: lang,
        categoryIndex: targetIndex,
        disabled: false,
        user: interaction.user,
        subPage: targetSubPage,
      });
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
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);
      const categoryKeys =
        typeof getHelpCategoryKeys === "function"
          ? getHelpCategoryKeys()
          : HELP_CATEGORY_KEYS;
      const targetIndex = categoryKeys.length - 1;
      const payload = buildHelpPayload({
        language: lang,
        categoryIndex: targetIndex,
        disabled: false,
        user: interaction.user,
        subPage: 0,
      });
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
];

module.exports.getCurrentState = getCurrentState;
module.exports.findIndicatorBtn = findIndicatorBtn;
