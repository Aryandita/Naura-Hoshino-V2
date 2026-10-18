"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ui = require("../../../src/config/ui");
const nauraExpression = require("../../../src/utils/nauraExpression");
const cacheManager = require("../../../src/managers/cacheManager");
const { buildLoadingContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

const languageManager = require("../../../src/managers/languageManager");

const locales = {
  id: require("../../../assets/language/id.json"),
  en: require("../../../assets/language/en.json"),
};

const rawDashboard = ui.dashboards || "http://92.118.206.166:30398";
const LINKS = {
  SUPPORT: ui.support_server || "https://dsc.gg/naura-hoshino",
  DASHBOARD: rawDashboard.startsWith("http")
    ? rawDashboard
    : `http://${rawDashboard}`,
  INVITE:
    ui.invite ||
    "https://discord.com/api/oauth2/authorize?client_id=1483665745727721543&permissions=8&scope=bot%20applications.commands",
};

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function face(mood, fallback) {
  return nauraExpression.getEmoji(mood) || ui.getEmoji(mood) || fallback;
}

function createNavButtons() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setLabel("Support Server")
      .setURL(LINKS.SUPPORT)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("support", "\uD83D\uDCAC")),
    new ButtonBuilder()
      .setLabel("Web Dashboard")
      .setURL(LINKS.DASHBOARD)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("dashboard", "\uD83C\uDF10")),
    new ButtonBuilder()
      .setLabel("Invite Naura")
      .setURL(LINKS.INVITE)
      .setStyle(ButtonStyle.Link)
      .setEmoji(e("invite", "\uD83D\uDCE9")),
  );
}

async function resolveGuildLanguage(guildId) {
  if (!guildId) return languageManager.getLanguageSync("id") || locales.id;
  const settings = await cacheManager.getGuildSettings(guildId);
  const langCode = settings?.system?.language || "id";
  return languageManager.getLanguageSync(langCode) || locales[langCode] || locales.id;
}

function createMockInteraction(message, client, optionsMap = {}) {
  let replyMsg = null;
  return {
    client,
    user: message.author,
    guild: message.guild,
    member: message.member,
    localeLang: message.localeLang || "id",
    createdTimestamp: message.createdTimestamp || Date.now(),
    options: {
      getString: (key) => optionsMap[key] ?? null,
      getSubcommand: () => optionsMap.subcommand ?? null,
    },
    deferReply: async () => {
      const loadingPayload = buildLoadingContainerV2({
        authorName: "Naura Task Runner",
        title: "Sedang Menyiapkan...",
        loadingMessage: `Tunggu sebentar yaa, Naura lagi siapin semuanya buat kamu~ ${e("sparkle", "✨")}`,
        footerText: `Sedang menyiapkan untuk ${message.author.username}`,
        withBanner: true,
      });
      replyMsg = await message.reply(loadingPayload);
      return replyMsg;
    },
    reply: async (payload) => {
      replyMsg = await message.reply(payload);
      return replyMsg;
    },
    editReply: async (payload) => {
      if (replyMsg) {
        return await replyMsg.edit(payload);
      }
      replyMsg = await message.reply(payload);
      return replyMsg;
    },
  };
}

module.exports = {
  locales,
  LINKS,
  e,
  face,
  createNavButtons,
  resolveGuildLanguage,
  createMockInteraction,
};
