"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const languageManager = require("../../../src/managers/languageManager");
const ui = require("../../../src/config/ui");
const { face, locales } = require("../helpers/coreShared");

async function handleLanguage(interaction, client, currentLang) {
  const newLang =
    interaction.options?.getString("lang") ||
    interaction.options?.getString("pilihan");

  if (!newLang || !locales[newLang]) {
    const msg = `${face("warning", "⚠️")} Pilihan bahasa tidak valid. Pilih \`id\` atau \`en\`.`;
    if (interaction.reply && !interaction.deferred) {
      return interaction.reply({ content: msg });
    }
    return interaction.editReply({ content: msg });
  }

  const userId = interaction.user.id;
  await cacheManager.updateUserProfile(userId, { language: newLang });
  await languageManager.setUserLanguage(userId, newLang).catch(() => {});

  if (ui.lang && ui.lang.userCache) {
    ui.lang.userCache.set(userId, {
      lang: newLang,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  const successMsg = `${face("success", "\u2705")} ${locales[newLang].LANG_SUCCESS || "Pengaturan bahasa berhasil diperbarui."}`;

  if (interaction.reply && !interaction.deferred) {
    return interaction.reply({ content: successMsg });
  }
  return interaction.editReply({ content: successMsg });
}

module.exports = handleLanguage;
