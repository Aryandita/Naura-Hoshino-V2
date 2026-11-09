"use strict";

const { MessageFlags, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const languageManager = require("../../managers/languageManager");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    prefix: "btn_lang_",
    label: "language-toggle",
    onError: "Gagal memperbarui preferensi bahasa.",
    async handler(interaction) {
      const customId = interaction.customId;
      const userId = interaction.user.id;

      let targetLang = "id";
      if (customId === "btn_lang_en") {
        targetLang = "en";
      } else if (customId === "btn_lang_ja") {
        targetLang = "ja";
      } else if (customId === "btn_lang_es") {
        targetLang = "es";
      } else if (customId === "btn_lang_id") {
        targetLang = "id";
      } else if (customId === "btn_lang_toggle") {
        const currentLang = await languageManager.getUserLanguage(userId, interaction.guildId);
        const order = ["id", "en", "ja", "es"];
        const idx = order.indexOf(currentLang);
        targetLang = order[(idx + 1) % order.length];
      }

      await languageManager.setUserLanguage(userId, targetLang);

      const titles = {
        id: "🌐 Bahasa Berhasil Diubah!",
        en: "🌐 Language Successfully Updated!",
        ja: "🌐 言語が正常に更新されました！",
        es: "🌐 ¡Idioma Actualizado Correctamente!",
      };

      const descriptions = {
        id: "Seluruh respons bot Naura Hoshino kini disajikan dalam **Bahasa Indonesia**.",
        en: "All Naura Hoshino bot responses will now be served in **English**.",
        ja: "ナウラ・ホシノのボット応答は**日本語**で表示されます。",
        es: "Todas las respuestas de Naura Hoshino ahora se mostrarán en **Español**.",
      };

      const langButtons = [
        { id: "id", label: "🇮🇩 ID" },
        { id: "en", label: "🇬🇧 EN" },
        { id: "ja", label: "🇯🇵 JA" },
        { id: "es", label: "🇪🇸 ES" },
      ];

      const toggleRow = new ActionRowBuilder().addComponents(
        langButtons.map((b) =>
          new ButtonBuilder()
            .setCustomId(`btn_lang_${b.id}`)
            .setLabel(b.label)
            .setStyle(targetLang === b.id ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(targetLang === b.id),
        ),
      );

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Localization Engine",
        title: titles[targetLang] || titles.id,
        description: descriptions[targetLang] || descriptions.id,
        buttonsRow: toggleRow,
        footerText: ui.getFooter("core"),
      });

      if (typeof interaction.update === "function" && !interaction.replied) {
        return interaction.update({
          ...payload,
        });
      }

      return interaction.reply({
        ...payload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
