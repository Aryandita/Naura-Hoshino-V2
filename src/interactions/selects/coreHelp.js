"use strict";

const languageManager = require("../../managers/languageManager");
const {
  buildHelpPayload,
  getHelpCategoryKeys,
  HELP_CATEGORY_KEYS,
} = require("../../core/helpView");

module.exports = [
  {
    id: "help_category_select",
    label: "help-category-select",
    defer: "update",
    async handler(interaction) {
      const selectedValue = interaction.values[0];
      const categoryKeys =
        typeof getHelpCategoryKeys === "function"
          ? getHelpCategoryKeys()
          : HELP_CATEGORY_KEYS;
      const categoryIndex =
        selectedValue === "overview"
          ? -1
          : categoryKeys.indexOf(selectedValue);
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);

      const payload = buildHelpPayload({
        language: lang,
        categoryIndex: categoryIndex,
        disabled: false,
        user: interaction.user,
      });

      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.update(payload);
    },
  },
];
