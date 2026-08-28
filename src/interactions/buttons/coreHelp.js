"use strict";

const languageManager = require("../../managers/languageManager");
const { buildHelpPayload, HELP_CATEGORY_KEYS } = require("../../core/helpView");

module.exports = [
  {
    id: "help_prev",
    label: "help-prev-button",
    defer: "update",
    async handler(interaction) {
      const userLang = await languageManager.getUserLanguage(
        interaction.user.id,
      );
      const lang = languageManager.getLanguageSync(userLang);

      // Cari indeks saat ini dari select menu komponen
      const currentSelect =
        interaction.message.components?.[0]?.components?.find(
          (c) =>
            c.customId === "help_category_select" ||
            c.data?.custom_id === "help_category_select",
        );
      const currentVal =
        currentSelect?.options?.find((o) => o.default)?.value || "overview";
      const currentIndex = Math.max(
        0,
        HELP_CATEGORY_KEYS.indexOf(currentVal) - 1,
      );

      const payload = buildHelpPayload(lang, currentIndex);
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

      const currentSelect =
        interaction.message.components?.[0]?.components?.find(
          (c) =>
            c.customId === "help_category_select" ||
            c.data?.custom_id === "help_category_select",
        );
      const currentVal =
        currentSelect?.options?.find((o) => o.default)?.value || "overview";
      const currentIndex = Math.min(
        HELP_CATEGORY_KEYS.length - 1,
        HELP_CATEGORY_KEYS.indexOf(currentVal) + 1,
      );

      const payload = buildHelpPayload(lang, currentIndex);
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
];
