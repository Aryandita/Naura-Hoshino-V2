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
const guildSettingsService = require("../../src/managers/guildSettingsService");
const {
  requireGuildManager,
  isOwner,
  MANAGE_GUILD,
} = require("../middleware/auth");

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

/** Konfigurasi bawaan untuk Sandbox Demo Server */
const SANDBOX_DEFAULTS = {
  guildId: "sandbox",
  guildName: "Aethelgard High Citadel",
  isSandbox: true,
  prefix: "n!",
  features: {
    music: true,
    economy: true,
    survival: true,
    leveling: true,
    aiPersona: true,
    automod: true,
  },
  music: {
    defaultVolume: 85,
    twentyFourSeven: true,
    djRoleId: "109283746592837465",
  },
  economy: {
    taxPercent: 0.5,
    allowStockMarket: true,
  },
  survival: {
    vitalDrainRate: "normal",
    wildernessPvp: true,
  },
  aiPersona: {
    autoReply: true,
    provider: "gemini",
    customPersona:
      "Naura adalah asisten pintar, ceria, dan ramah yang siap menemani seluruh petualang server.",
  },
  leveling: {
    xpMultiplier: 1.5,
    notifyMode: "channel",
  },
  automod: {
    antiSpam: true,
    antiInvite: true,
    antiCaps: false,
    massMention: 5,
  },
};

let currentSandboxConfig = JSON.parse(JSON.stringify(SANDBOX_DEFAULTS));

module.exports = (client) => {
  const router = express.Router();

  // ------------------------------------------------------------------
  // 1. Daftar Server yang Dapat Dikelola (Hybrid Live OAuth + Sandbox)
  // ------------------------------------------------------------------
  router.get("/api/guilds/manageable", (req, res) => {
    try {
      const sandboxEntry = {
        id: "sandbox",
        name: "🏰 Aethelgard High Citadel (Sandbox Demo)",
        icon: "/assets/core/avatar.png",
        acronym: "AHC",
        isSandbox: true,
        memberCount: 1420,
        owner: true,
        botPresent: true,
      };

      const userGuilds = Array.isArray(req.user?.guilds) ? req.user.guilds : [];
      const botGuilds = client.guilds?.cache || new Map();

      const manageable = userGuilds
        .filter((g) => {
          if (req.user && isOwner(req.user.id)) return true;
          if (g.owner === true) return true;
          try {
            const perms = BigInt(g.permissions ?? g.permissions_new ?? 0);
            return (perms & MANAGE_GUILD) === MANAGE_GUILD;
          } catch {
            return false;
          }
        })
        .map((g) => {
          const inBot =
            typeof botGuilds.get === "function" ? botGuilds.get(g.id) : null;
          const isGif = typeof g.icon === "string" && g.icon.startsWith("a_");
          const iconUrl = g.icon
            ? `https://cdn.discordapp.com/icons/${g.id}/${g.icon}.${isGif ? "gif" : "png"}?size=128`
            : null;
          const acronym =
            String(g.name || "")
              .replace(/'s/g, "")
              .replace(/\w+/g, (e) => e[0])
              .replace(/\s+/g, "")
              .slice(0, 3)
              .toUpperCase() || "DC";

          return {
            id: String(g.id),
            name: g.name,
            icon: iconUrl,
            acronym,
            isGif,
            isSandbox: false,
            memberCount: inBot?.memberCount || 0,
            owner: g.owner === true,
            botPresent: !!inBot,
          };
        });

      return res.json({
        success: true,
        guilds: [sandboxEntry, ...manageable],
        activeGuildId: req.query?.selected || "sandbox",
      });
    } catch (e) {
      logger.error("[API GUILDS MANAGEABLE] Error:", e);
      return res.json({
        success: true,
        guilds: [
          {
            id: "sandbox",
            name: "🏰 Aethelgard High Citadel (Sandbox Demo)",
            icon: "/assets/core/avatar.png",
            acronym: "AHC",
            isSandbox: true,
            memberCount: 1420,
            owner: true,
            botPresent: true,
          },
        ],
      });
    }
  });

  // ------------------------------------------------------------------
  // 2. Baca Konfigurasi Server Terpadu
  // ------------------------------------------------------------------
  router.get(
    "/api/guilds/:guildId/config",
    requireGuildManager,
    async (req, res) => {
      try {
        if (req.isSandbox || req.guildId === "sandbox") {
          return res.json({
            success: true,
            isSandbox: true,
            config: currentSandboxConfig,
          });
        }

        const guildId = req.guildId;
        const settings =
          (await guildSettingsService.getGuildSetting(guildId)) || {};
        const guild =
          typeof client.guilds?.cache?.get === "function"
            ? client.guilds.cache.get(guildId)
            : null;

        const rawSettings = settings.settings || {};
        const features = rawSettings.features || {};
        const music = settings.music || {};
        const automod = rawSettings.automod || {};
        const aiPersona = rawSettings.aiPersona || {};

        const config = {
          guildId,
          guildName: guild?.name || `Guild #${guildId}`,
          isSandbox: false,
          prefix: settings.system?.prefix || settings.prefix || "n!",
          features: {
            music: features.music !== false,
            economy: features.economy !== false,
            survival: features.survival !== false,
            leveling: features.leveling !== false,
            aiPersona: features.aiPersona !== false,
            automod: automod.enabled !== false,
          },
          music: {
            defaultVolume: Number(music.defaultVolume) || 80,
            twentyFourSeven: toBool(music.twentyFourSeven),
            djRoleId: music.djRoleId || "",
          },
          economy: {
            taxPercent: Number(rawSettings.economy?.taxPercent) || 0.5,
            allowStockMarket: rawSettings.economy?.allowStockMarket !== false,
          },
          survival: {
            vitalDrainRate: rawSettings.survival?.vitalDrainRate || "normal",
            wildernessPvp: rawSettings.survival?.wildernessPvp !== false,
          },
          aiPersona: {
            autoReply: aiPersona.autoReply !== false,
            provider: aiPersona.provider || "gemini",
            customPersona:
              aiPersona.customPersona || aiPersona.systemPrompt || "",
          },
          leveling: {
            xpMultiplier: Number(rawSettings.leveling?.xpMultiplier) || 1.0,
            notifyMode: rawSettings.leveling?.notifyMode || "channel",
          },
          automod: {
            antiSpam: automod.antiSpam !== false,
            antiInvite: toBool(automod.antiInvite),
            antiCaps: toBool(automod.antiCaps),
            massMention: Number(automod.massMention) || 5,
          },
        };

        return res.json({ success: true, isSandbox: false, config });
      } catch (e) {
        logger.error("[API GUILD CONFIG GET] Error:", e);
        return res
          .status(500)
          .json({ success: false, error: "Gagal memuat konfigurasi server." });
      }
    },
  );

  // ------------------------------------------------------------------
  // 3. Simpan Konfigurasi Server (PG + Redis sync)
  // ------------------------------------------------------------------
  router.post(
    "/api/guilds/:guildId/config",
    requireGuildManager,
    async (req, res) => {
      try {
        const updates = req.body || {};

        if (req.isSandbox || req.guildId === "sandbox") {
          if (updates.features)
            currentSandboxConfig.features = {
              ...currentSandboxConfig.features,
              ...updates.features,
            };
          if (updates.music)
            currentSandboxConfig.music = {
              ...currentSandboxConfig.music,
              ...updates.music,
            };
          if (updates.economy)
            currentSandboxConfig.economy = {
              ...currentSandboxConfig.economy,
              ...updates.economy,
            };
          if (updates.survival)
            currentSandboxConfig.survival = {
              ...currentSandboxConfig.survival,
              ...updates.survival,
            };
          if (updates.aiPersona)
            currentSandboxConfig.aiPersona = {
              ...currentSandboxConfig.aiPersona,
              ...updates.aiPersona,
            };
          if (updates.leveling)
            currentSandboxConfig.leveling = {
              ...currentSandboxConfig.leveling,
              ...updates.leveling,
            };
          if (updates.automod)
            currentSandboxConfig.automod = {
              ...currentSandboxConfig.automod,
              ...updates.automod,
            };
          if (updates.prefix)
            currentSandboxConfig.prefix = String(updates.prefix).slice(0, 8);

          return res.json({
            success: true,
            isSandbox: true,
            message: "Pengaturan Sandbox Demo Server berhasil disimpan!",
            config: currentSandboxConfig,
          });
        }

        const guildId = req.guildId;
        await guildSettingsService.updateGuildSetting(guildId, (settings) => {
          if (!settings.settings) settings.settings = {};
          if (!settings.settings.features) settings.settings.features = {};
          if (!settings.music) settings.music = {};

          if (updates.prefix) {
            if (!settings.system) settings.system = {};
            settings.system.prefix = String(updates.prefix).slice(0, 8);
            settings.prefix = String(updates.prefix).slice(0, 8);
          }

          if (updates.features) {
            settings.settings.features = {
              ...settings.settings.features,
              ...updates.features,
            };
          }

          if (updates.music) {
            settings.music = {
              ...settings.music,
              defaultVolume:
                updates.music.defaultVolume !== undefined
                  ? Math.max(
                      0,
                      Math.min(100, Number(updates.music.defaultVolume)),
                    )
                  : settings.music.defaultVolume,
              twentyFourSeven:
                updates.music.twentyFourSeven !== undefined
                  ? toBool(updates.music.twentyFourSeven)
                  : settings.music.twentyFourSeven,
              djRoleId:
                updates.music.djRoleId !== undefined
                  ? String(updates.music.djRoleId || "")
                  : settings.music.djRoleId,
            };
          }

          if (updates.economy) {
            if (!settings.settings.economy) settings.settings.economy = {};
            settings.settings.economy = {
              ...settings.settings.economy,
              ...updates.economy,
            };
          }

          if (updates.survival) {
            if (!settings.settings.survival) settings.settings.survival = {};
            settings.settings.survival = {
              ...settings.settings.survival,
              ...updates.survival,
            };
          }

          if (updates.aiPersona) {
            if (!settings.settings.aiPersona) settings.settings.aiPersona = {};
            settings.settings.aiPersona = {
              ...settings.settings.aiPersona,
              ...updates.aiPersona,
            };
          }

          if (updates.leveling) {
            if (!settings.settings.leveling) settings.settings.leveling = {};
            settings.settings.leveling = {
              ...settings.settings.leveling,
              ...updates.leveling,
            };
          }

          if (updates.automod) {
            if (!settings.settings.automod) settings.settings.automod = {};
            settings.settings.automod = {
              ...settings.settings.automod,
              ...updates.automod,
            };
          }
        });

        return res.json({
          success: true,
          isSandbox: false,
          message:
            "Pengaturan server berhasil disimpan ke database PostgreSQL & cache Redis telah disegarkan!",
        });
      } catch (e) {
        logger.error("[API GUILD CONFIG POST] Error:", e);
        return res
          .status(500)
          .json({ success: false, error: "Gagal menyimpan konfigurasi server." });
      }
    },
  );

  // ------------------------------------------------------------------
  // 4. Reset Konfigurasi Server ke Default
  // ------------------------------------------------------------------
  router.post(
    "/api/guilds/:guildId/reset",
    requireGuildManager,
    async (req, res) => {
      try {
        if (req.isSandbox || req.guildId === "sandbox") {
          currentSandboxConfig = JSON.parse(JSON.stringify(SANDBOX_DEFAULTS));
          return res.json({
            success: true,
            isSandbox: true,
            message: "Pengaturan Sandbox telah dikembalikan ke bawaan pabrik!",
            config: currentSandboxConfig,
          });
        }

        await guildSettingsService.updateGuildSetting(req.guildId, (settings) => {
          settings.settings = {};
          settings.music = {
            twentyFourSeven: false,
            defaultVolume: 100,
            djRoleId: null,
          };
        });

        return res.json({
          success: true,
          isSandbox: false,
          message: "Pengaturan server telah direset ke bawaan pabrik.",
        });
      } catch (e) {
        logger.error("[API GUILD CONFIG RESET] Error:", e);
        return res
          .status(500)
          .json({ success: false, error: "Gagal me-reset pengaturan server." });
      }
    },
  );

  // ------------------------------------------------------------------
  // Pengaturan umum server
  // ------------------------------------------------------------------
  router.get("/api/settings/load", requireGuildManager, async (req, res) => {
    try {
      const settings =
        (await guildSettingsService.getGuildSetting(req.guildId)) || {};
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

      await guildSettingsService.updateGuildSetting(req.guildId, (settings) => {
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
      });

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
      const settings =
        (await guildSettingsService.getGuildSetting(req.guildId)) || {};
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

      await guildSettingsService.updateGuildSetting(req.guildId, (settings) => {
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
      });

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

      const settings = await guildSettingsService.getGuildSetting(req.guildId);
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
