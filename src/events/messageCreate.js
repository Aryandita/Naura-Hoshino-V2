"use strict";

const { ChannelType, Collection } = require("discord.js");

const env = require("../config/env");
const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");
const languageManager = require("../managers/languageManager");
const { updateGuildSetting } = require("../managers/guildSettingsService");
const { handleAutomod } = require("../utils/automodHelper");

const { softbanTrap, minecraftBridge } = require("./messageCreate/guildGuards");
const handleGlobalChat = require("./messageCreate/globalChat");
const handleDirectMessage = require("./messageCreate/directMessage");
const handleStaffReply = require("./messageCreate/staffReply");
const handleLegacyAutomod = require("./messageCreate/legacyAutomod");
const handleAfk = require("./messageCreate/afk");
const handleCounting = require("./messageCreate/counting");
const handleTruthOrDare = require("./messageCreate/truthOrDare");
const handleReputation = require("./messageCreate/reputation");
const handleVibe = require("./messageCreate/vibe");
const handleSticky = require("./messageCreate/sticky");
const handleAiTrigger = require("./messageCreate/aiTrigger");
const handlePrefixCommand = require("./messageCreate/prefixCommand");

// Kolom settings kadang tersimpan sebagai string JSON, kadang sudah berupa objek.
function parseSettings(row) {
  if (!row) return {};
  if (typeof row.settings === "string") {
    try {
      return JSON.parse(row.settings);
    } catch (e) {
      return {};
    }
  }
  return row.settings || {};
}

/**
 * Wadah bersama antar modul. saveSettings menulis satu kolom lewat service
 * terpusat agar pola update GuildSettings tetap konsisten dan invalidasi cache
 * tidak tersebar di event handler.
 */
function createContext(message, settings) {
  const ctx = {
    settings,
    guildChannels: settings?.settings?.channels || {},
    saveSettings: async (fieldName) => {
      if (!ctx.settings || !message.guild) return;

      const nextValue = ctx.settings[fieldName];
      await updateGuildSetting(message.guild.id, (guildSettings) => {
        guildSettings[fieldName] = nextValue;
      });

      ctx.settings[fieldName] = nextValue;
      ctx.guildChannels = ctx.settings?.settings?.channels || {};
    },
  };

  return ctx;
}

/**
 * Merangkai seluruh penangan pesan secara berurutan. Setiap modul
 * mengembalikan true bila pesan sudah selesai ditangani, dan rantai berhenti
 * di titik itu. Isi tiap tahap ada di folder ./messageCreate/.
 */
module.exports = {
  name: "messageCreate",
  async execute(message, client) {
    if (message.author.bot) return;
    if (client.isShuttingDown) return;

    message.localeLang = await languageManager.getUserLanguage(
      message.author.id,
    );

    if (client.maintenanceMode && !env.OWNER_IDS.includes(message.author.id))
      return;
    if (!client.snipes) client.snipes = new Collection();

    let settings = null;

    // Penjaga tingkat server, dijalankan sebelum apa pun yang lain.
    if (message.guild) {
      try {
        const ServerChronicleEngine = require("../ai/serverChronicleEngine");
        ServerChronicleEngine.recordMessageActivity(
          message.guild.id,
          message.author.id,
          message.author.username,
          message.content,
        );

        settings = await cacheManager.getGuildSettings(message.guild.id);

        if (await softbanTrap(message, parseSettings(settings))) return;
        await minecraftBridge(message, settings);
        if (await handleGlobalChat(message, client)) return;
      } catch (error) {
        logger.error("[messageCreate] Penjaga guild gagal dijalankan", error);
      }
    }

    // Semua yang masuk lewat DM berhenti di sini.
    if (!message.guild || message.channel.type === ChannelType.DM) {
      await handleDirectMessage(message, client);
      return;
    }

    if (await handleAutomod(message, client)) return;
    if (await handleStaffReply(message, client)) return;

    const ctx = createContext(message, settings);

    if (await handleLegacyAutomod(message, client, ctx)) return;

    // AFK hanya menyisipkan pemberitahuan, alurnya tetap lanjut.
    await handleAfk(message, client, ctx);

    if (await handleCounting(message, client, ctx)) return;
    if (await handleTruthOrDare(message, client, ctx)) return;

    await handleSticky(message, client, ctx);

    if (await handleAiTrigger(message, client, ctx)) return;

    // Auto-assign reputation for thanks
    await handleReputation(message, client, ctx);

    // Contextual anime mood & vibe reaction
    await handleVibe(message, client, ctx);

    await handlePrefixCommand(message, client, ctx);
  },
};
