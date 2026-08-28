"use strict";

/**
 * Rute pengaturan per-server (guild).
 *
 * Catatan penting: sebelum refactor ini SELURUH endpoint di bawah bisa diakses
 * tanpa login sama sekali. Siapa pun yang tahu sebuah Guild ID dapat mengubah
 * prefix, automod, persona AI, dan welcomer server orang lain. Kini setiap
 * rute wajib melewati `requireGuildManager`, yang memverifikasi izin
 * Kelola Server di sisi server, bukan mempercayai browser.
 */

const express = require("express");
const { EmbedBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const GuildSettings = require("../../src/models/GuildSettings");
const { requireGuildManager } = require("../middleware/auth");

/** Nilai bawaan tata letak kartu welcomer. */
const WELCOME_DEFAULTS = {
  enabled: false,
  channelId: null,
  message: null,
  image: true,
  background: null,
  avatarX: 180,
  avatarY: 165,
  avatarSize: 110,
  titleX: 370,
  titleY: 105,
  titleSize: 26,
  titleText: "WELCOME TO SERVER",
  nameX: 370,
  nameY: 170,
  nameSize: 55,
  subtitleX: 370,
  subtitleY: 220,
  subtitleSize: 22,
  glowColor: "#00FFFF",
};

const NUMERIC_WELCOME_KEYS = [
  "avatarX",
  "avatarY",
  "avatarSize",
  "titleX",
  "titleY",
  "titleSize",
  "nameX",
  "nameY",
  "nameSize",
  "subtitleX",
  "subtitleY",
  "subtitleSize",
];

function toBool(value) {
  return value === true || value === "true";
}

async function loadSettingsModel(guildId) {
  const [model] = await GuildSettings.findOrCreate({ where: { guildId } });
  return model;
}

module.exports = (client) => {
  const router = express.Router();

  // ------------------------------------------------------------------
  // Pengaturan umum server
  // ------------------------------------------------------------------
  router.get("/api/settings/load", requireGuildManager, async (req, res) => {
    try {
      const model = await loadSettingsModel(req.guildId);
      const settings = model.settings || {};
      const ai = settings.ai || {};

      // Kompatibilitas: versi lama menyimpan slug & persona di akar objek,
      // sedangkan penyimpanan menulisnya ke settings.ai. Akibatnya form
      // selalu tampil kosong. Sekarang keduanya dibaca.
      res.json({
        prefix: settings.prefix || "",
        verbaSlug1: ai.verbaSlug1 ?? settings.verbaSlug1 ?? "",
        verbaSlug2: ai.verbaSlug2 ?? settings.verbaSlug2 ?? "",
        customPersona: ai.customPersona ?? settings.customPersona ?? "",
        serverKnowledge: ai.serverKnowledge ?? settings.serverKnowledge ?? "",
        automod: toBool(settings.automod),
        twentyFourSeven: toBool(settings.twentyFourSeven),
      });
    } catch (e) {
      logger.error("[API SETTINGS LOAD] Error:", e);
      res.status(500).json({ error: "Naura gagal memuat pengaturan server." });
    }
  });

  router.post("/api/settings", requireGuildManager, async (req, res) => {
    try {
      const {
        prefix,
        automod,
        twentyFourSeven,
        verbaSlug1,
        verbaSlug2,
        customPersona,
        serverKnowledge,
      } = req.body;

      const model = await loadSettingsModel(req.guildId);
      const settings = model.settings || {};

      if (prefix !== undefined) settings.prefix = String(prefix).slice(0, 8);
      if (automod !== undefined) settings.automod = toBool(automod);
      if (twentyFourSeven !== undefined)
        settings.twentyFourSeven = toBool(twentyFourSeven);

      if (!settings.ai) settings.ai = {};
      if (verbaSlug1 !== undefined) settings.ai.verbaSlug1 = verbaSlug1;
      if (verbaSlug2 !== undefined) settings.ai.verbaSlug2 = verbaSlug2;
      if (customPersona !== undefined)
        settings.ai.customPersona = String(customPersona).slice(0, 500);
      if (serverKnowledge !== undefined)
        settings.ai.serverKnowledge = String(serverKnowledge).slice(0, 1000);

      model.settings = settings;
      model.changed("settings", true);
      // Rule 1.8/1.10: fields eksplisit + invalidasi cache lintas shard agar
      // bot langsung membaca pengaturan terbaru.
      await model.save({ fields: ["settings"] });
      await require("../../src/managers/cacheManager")
        .invalidateGuildSettings(req.guildId)
        .catch(() => {});

      res.json({ success: true, message: "Pengaturannya sudah Naura simpan!" });
    } catch (e) {
      logger.error("[API SETTINGS SAVE] Error:", e);
      res
        .status(500)
        .json({ success: false, message: "Naura gagal menyimpan pengaturan." });
    }
  });

  // ------------------------------------------------------------------
  // Welcomer
  // ------------------------------------------------------------------
  router.get("/api/welcomer", requireGuildManager, async (req, res) => {
    try {
      const model = await loadSettingsModel(req.guildId);
      const settings = model.settings || {};
      const saved = settings.greetings?.welcome || {};

      res.json({
        ...WELCOME_DEFAULTS,
        color: ui.getColor("welcome") || ui.getColor("primary"),
        ...saved,
      });
    } catch (e) {
      logger.error("[API WELCOMER LOAD] Error:", e);
      res
        .status(500)
        .json({ error: "Naura gagal memuat pengaturan welcomer." });
    }
  });

  router.post("/api/welcomer", requireGuildManager, async (req, res) => {
    try {
      const body = req.body || {};
      const model = await loadSettingsModel(req.guildId);
      const settings = model.settings || {};

      if (!settings.greetings) settings.greetings = {};
      const welcome = {
        ...WELCOME_DEFAULTS,
        color: ui.getColor("welcome") || ui.getColor("primary"),
        ...(settings.greetings.welcome || {}),
      };

      welcome.enabled = toBool(body.enabled);
      welcome.channelId = body.channelId || null;
      welcome.background = body.backgroundUrl || null;
      welcome.message = body.message || null;
      welcome.titleText = body.titleText || WELCOME_DEFAULTS.titleText;
      welcome.glowColor = body.glowColor || WELCOME_DEFAULTS.glowColor;

      for (const key of NUMERIC_WELCOME_KEYS) {
        const raw = body[key];
        welcome[key] =
          raw !== undefined && raw !== null && raw !== ""
            ? Number(raw)
            : WELCOME_DEFAULTS[key];
        if (Number.isNaN(welcome[key])) welcome[key] = WELCOME_DEFAULTS[key];
      }

      settings.greetings.welcome = welcome;
      model.settings = settings;
      model.changed("settings", true);
      // Rule 1.8/1.10: fields eksplisit + invalidasi cache lintas shard.
      await model.save({ fields: ["settings"] });
      await require("../../src/managers/cacheManager")
        .invalidateGuildSettings(req.guildId)
        .catch(() => {});

      res.json({
        success: true,
        message: "Tampilan sambutannya sudah Naura simpan!",
      });
    } catch (e) {
      logger.error("[API WELCOMER SAVE] Error:", e);
      res.status(500).json({
        success: false,
        message: "Naura gagal menyimpan pengaturan welcomer.",
      });
    }
  });

  // ------------------------------------------------------------------
  // Jembatan chat Minecraft
  // ------------------------------------------------------------------
  router.post("/api/minecraft/chat", requireGuildManager, async (req, res) => {
    try {
      const { username, message } = req.body || {};
      if (!username || !message) {
        return res
          .status(400)
          .json({ error: "Username dan pesan wajib diisi." });
      }

      const settings = await GuildSettings.findOne({
        where: { guildId: req.guildId },
      });
      const mc = settings?.settings?.minecraft;
      if (!mc)
        return res
          .status(404)
          .json({ error: "Pengaturan Minecraft belum ada untuk server ini." });
      if (!mc.bridgeEnabled || !mc.bridgeChannelId) {
        return res.status(400).json({
          error: "Bridge belum diaktifkan atau kanalnya belum diatur.",
        });
      }

      const channel = await client.channels
        .fetch(mc.bridgeChannelId)
        .catch(() => null);
      if (channel && channel.isTextBased()) {
        const safeName = encodeURIComponent(String(username).slice(0, 32));
        const embed = new EmbedBuilder()
          .setColor(ui.getColor("success") || "#00FF00")
          .setAuthor({
            name: String(username).slice(0, 80),
            iconURL: `https://crafatar.com/avatars/${safeName}?overlay=true`,
          })
          .setDescription(String(message).slice(0, 2000))
          .setFooter({
            text: "Naura Minecraft Bridge",
            iconURL: client.user.displayAvatarURL(),
          })
          .setTimestamp();

        await channel.send({ embeds: [embed] });
      }

      res.json({ success: true });
    } catch (error) {
      logger.error("[API MINECRAFT BRIDGE] Error:", error);
      res
        .status(500)
        .json({ error: "Naura gagal meneruskan pesan ke Discord." });
    }
  });

  return router;
};

module.exports.WELCOME_DEFAULTS = WELCOME_DEFAULTS;
