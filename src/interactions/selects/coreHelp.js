"use strict";

const languageManager = require("../../managers/languageManager");
const { buildHelpPayload, HELP_CATEGORY_KEYS } = require("../../core/helpView");

module.exports = [
  {
    id: "help_category_select",
    label: "help-category-select",
    defer: "update",
    async handler(interaction) {
      const selectedValue = interaction.values[0];
      const categoryIndex =
        selectedValue === "overview"
          ? -1
          : HELP_CATEGORY_KEYS.indexOf(selectedValue);
      const userLang =
        interaction.localeLang ||
        (await languageManager.getUserLanguage(interaction.user.id));
      const lang = languageManager.getLanguageSync(userLang);

      const payload = buildHelpPayload(
        lang,
        categoryIndex,
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
