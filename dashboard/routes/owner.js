"use strict";

/**
 * Rute khusus Owner (God Mode).
 *
 * Dua hal penting yang berubah di sini:
 *
 * 1. Pemeriksaan owner tidak lagi memakai `OWNER_IDS.includes(id)` pada sebuah
 *    string. Pencocokan substring seperti itu meloloskan ID yang kebetulan
 *    menjadi potongan dari daftar owner. Sekarang perbandingan per elemen.
 *
 * 2. `/api/owner/eval` menjalankan JavaScript sembarang di dalam proses bot.
 *    Endpoint itu kini MATI secara bawaan dan hanya hidup bila kamu menyetel
 *    `OWNER_EVAL_ENABLED=true` di .env. Satu sesi owner yang bocor tidak lagi
 *    langsung berarti kendali penuh atas server.
 */

const express = require("express");
const os = require("os");
const env = require("../../src/config/env");
const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const GuildSettings = require("../../src/models/GuildSettings");
const { requireOwner } = require("../middleware/auth");
const { formatMemory } = require("../utils/format");

const EVAL_ENABLED = Boolean(env.OWNER_EVAL_ENABLED);

function broadcast(client, message) {
  if (client.dashboardIo)
    client.dashboardIo.emit("system_broadcast", { message });
}

module.exports = (client) => {
  const router = express.Router();

  // Semua rute di modul ini wajib owner.
  router.use("/api/owner", requireOwner);

  // --- Statistik host ---
  router.get("/api/owner/stats", (req, res) => {
    try {
      const memory = formatMemory(os);
      res.json({
        ram: `${memory.usedGb}GB / ${memory.totalGb}GB`,
        ramPercent: memory.percent,
        cpu: os.cpus()[0]?.model || "Tidak diketahui",
        os: `${os.type()} ${os.release()}`,
      });
    } catch (e) {
      res.status(500).json({ error: "Naura gagal membaca statistik host." });
    }
  });

  // --- Ubah data ekonomi pengguna ---
  router.post("/api/owner/update_user", async (req, res) => {
    const { targetId, wallet, bank, starFragments, isPremium } = req.body || {};
    if (!targetId)
      return res.status(400).json({ error: "Target User ID wajib diisi." });

    try {
      const [user] = await UserProfile.findOrCreate({
        where: { userId: targetId },
      });
      if (wallet !== undefined) user.economy_wallet = Number(wallet) || 0;
      if (bank !== undefined) user.economy_bank = Number(bank) || 0;

      if (isPremium !== undefined) {
        user.isPremium = !!isPremium;
        if (isPremium) {
          const expiry = new Date();
          expiry.setFullYear(expiry.getFullYear() + 100);
          user.premiumUntil = expiry;
        } else {
          user.premiumUntil = null;
        }
      }
      const fields = [];
      if (wallet !== undefined) fields.push("economy_wallet");
      if (bank !== undefined) fields.push("economy_bank");
      if (isPremium !== undefined) fields.push("isPremium", "premiumUntil");
      if (fields.length > 0) await user.save({ fields });

      if (starFragments !== undefined) {
        const UserSurvival = require("../../src/models/UserSurvival");
        const [survival] = await UserSurvival.findOrCreate({
          where: { userId: targetId },
        });
        survival.starFragments = Number(starFragments) || 0;
        await survival.save({ fields: ["starFragments"] });
      }

      res.json({
        success: true,
        message: `Data ${targetId} sudah diperbarui.`,
      });
    } catch (e) {
      logger.error("[OWNER UPDATE USER] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Pulihkan status vital pengguna (Full atau Parsial) ---
  router.post("/api/owner/heal_user", async (req, res) => {
    const { targetId, type = "all", amount } = req.body || {};
    const userId = targetId || req.user?.id;
    if (!userId) {
      return res.status(400).json({ error: "Target User ID wajib diisi." });
    }

    try {
      const cacheManager = require("../../src/managers/cacheManager");
      const leveling = require("../../src/survival/engines/survivalLeveling");
      const redisManager = require("../../src/managers/redisManager");

      const survival = await cacheManager.getUserSurvival(userId);
      if (!survival) {
        return res.status(404).json({
          error: `Data survival untuk user ID ${userId} tidak ditemukan.`,
        });
      }

      const maxHp = leveling.calculateMaxHp(
        survival,
        survival.rpg_state?.class_bonus?.hp || 0,
      );

      const statType = String(type).toLowerCase().trim();
      const numAmount = parseInt(amount, 10);
      const patch = {};
      let msg = "";

      if (statType === "stamina") {
        const val = Number.isFinite(numAmount) ? Math.max(0, Math.min(100, numAmount)) : 100;
        patch.stamina = val;
        msg = `Stamina untuk user ${userId} berhasil dipulihkan menjadi ${val}/100.`;
      } else if (statType === "hp") {
        const val = Number.isFinite(numAmount) ? Math.max(1, Math.min(maxHp, numAmount)) : maxHp;
        patch.hp = val;
        msg = `Kesehatan (HP) untuk user ${userId} berhasil dipulihkan menjadi ${val}/${maxHp}.`;
      } else if (statType === "hunger" || statType === "lapar") {
        const val = Number.isFinite(numAmount) ? Math.max(0, Math.min(100, numAmount)) : 100;
        patch.hunger = val;
        msg = `Tingkat kenyang (Lapar) untuk user ${userId} berhasil dipulihkan menjadi ${val}/100.`;
      } else if (statType === "thirst" || statType === "haus") {
        const val = Number.isFinite(numAmount) ? Math.max(0, Math.min(100, numAmount)) : 100;
        patch.thirst = val;
        msg = `Hidrasi (Haus) untuk user ${userId} berhasil dipulihkan menjadi ${val}/100.`;
      } else if (statType === "sick" || statType === "sembuh") {
        patch.rpg_state = {
          ...(survival.rpg_state || {}),
          sick: false,
        };
        msg = `Penyakit untuk user ${userId} berhasil disembuhkan total.`;
      } else {
        // Default: 'all'
        patch.hp = maxHp;
        patch.hunger = 100;
        patch.thirst = 100;
        patch.stamina = 100;
        patch.rpg_state = {
          ...(survival.rpg_state || {}),
          sick: false,
        };
        msg = `Vitals untuk user ${userId} berhasil dipulihkan penuh (HP: ${maxHp}/${maxHp}, Stamina: 100, Lapar: 100, Haus: 100, Bebas Penyakit).`;
      }

      await cacheManager.updateUserSurvival(userId, patch);
      await cacheManager.flushUser(userId);

      if (redisManager.isReady && redisManager.client) {
        try {
          await redisManager.client.del(`user:survival:${userId}`);
        } catch (_) {}
      }

      const refreshed = await cacheManager.getUserSurvival(userId);

      res.json({
        success: true,
        message: msg,
        data: {
          userId,
          hp: refreshed.hp,
          maxHp,
          hunger: refreshed.hunger,
          thirst: refreshed.thirst,
          stamina: refreshed.stamina,
          sick: refreshed.rpg_state?.sick,
        },
      });
    } catch (e) {
      logger.error("[OWNER HEAL USER] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Eksekusi JS langsung (dimatikan secara bawaan) ---
  router.post("/api/owner/eval", async (req, res) => {
    if (!EVAL_ENABLED) {
      return res.status(403).json({
        success: false,
        error:
          "Konsol eval dimatikan. Setel OWNER_EVAL_ENABLED=true di .env kalau memang mau dipakai.",
      });
    }

    const { code } = req.body || {};
    if (!code) return res.status(400).json({ error: "Kodenya masih kosong." });

    try {
      const util = require("util");

      let evaled = await eval(code);
      if (typeof evaled !== "string")
        evaled = util.inspect(evaled, { depth: 0 });

      const secrets = [
        client.token,
        env.GEMINI_API,
        env.VERBA_API_KEY,
        env.DB_PASS,
        env.SESSION_SECRET,
      ].filter(Boolean);

      let sanitized = evaled;
      for (const secret of secrets) {
        const regex = new RegExp(
          secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
          "g",
        );
        sanitized = sanitized.replace(regex, "[REDACTED]");
      }

      res.json({ success: true, output: sanitized });
      broadcast(client, "Konsol sistem baru saja dijalankan oleh Owner.");
    } catch (e) {
      res.json({ success: false, error: e.message });
    }
  });

  // --- Mode perbaikan ---
  router.post("/api/owner/maintenance", (req, res) => {
    const status = !!req.body?.status;
    client.maintenanceMode = status;

    try {
      if (status) {
        client.user.setPresence({
          activities: [{ name: "Naura lagi dirapikan sebentar" }],
          status: "dnd",
        });
      } else {
        client.user.setPresence({
          activities: [{ name: "Menemani kamu hari ini" }],
          status: "online",
        });
      }
    } catch (e) {
      logger.warn("[OWNER MAINTENANCE] Gagal mengubah presence:", e.message);
    }

    res.json({
      success: true,
      message: `Mode perbaikan sekarang ${status ? "AKTIF" : "MATI"}.`,
    });
    broadcast(
      client,
      `Mode perbaikan ${status ? "diaktifkan" : "dinonaktifkan"}.`,
    );
  });

  // --- Muat ulang satu command ---
  router.post("/api/owner/reload", (req, res) => {
    const commandName = req.body?.command;
    if (!commandName)
      return res.status(400).json({ error: "Nama command wajib diisi." });

    const cmd = client.commands.get(String(commandName).toLowerCase());
    if (!cmd)
      return res
        .status(404)
        .json({ error: `Command ${commandName} tidak ditemukan.` });

    try {
      const fs = require("fs");
      const path = require("path");
      const cmdsPath = path.join(__dirname, "../../../plugin");
      const wanted = [`${cmd.data?.name || cmd.name}.js`, `${commandName}.js`];

      let fileLocation = "";
      for (const folder of fs.readdirSync(cmdsPath)) {
        const folderPath = path.join(cmdsPath, folder);
        if (!fs.statSync(folderPath).isDirectory()) continue;
        const file = fs.readdirSync(folderPath).find((f) => wanted.includes(f));
        if (file) {
          fileLocation = path.join(folderPath, file);
          break;
        }
      }

      if (!fileLocation) {
        return res
          .status(404)
          .json({ error: `Berkas untuk ${commandName} tidak bisa dilacak.` });
      }

      delete require.cache[require.resolve(fileLocation)];
      const newCommand = require(fileLocation);
      client.commands.set(
        newCommand.data ? newCommand.data.name : newCommand.name,
        newCommand,
      );

      res.json({
        success: true,
        message: `Command ${commandName} sudah dimuat ulang.`,
      });
    } catch (error) {
      logger.error("[OWNER RELOAD] Error:", error);
      res.status(500).json({ error: `Gagal memuat ulang: ${error.message}` });
    }
  });

  // --- Profil bot ---
  router.post("/api/owner/profile", async (req, res) => {
    const { type, value } = req.body || {};
    if (!value) return res.status(400).json({ error: "Nilainya wajib diisi." });

    const actions = {
      username: () => client.user.setUsername(value),
      avatar: () => client.user.setAvatar(value),
      banner: () => client.user.setBanner(value),
    };

    if (!actions[type])
      return res.status(400).json({ error: "Jenis profil tidak dikenali." });

    try {
      await actions[type]();
      res.json({ success: true, message: `${type} bot berhasil diubah!` });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Presence ---
  router.post("/api/owner/presence", (req, res) => {
    const { type, text } = req.body || {};
    if (!type || !text)
      return res.status(400).json({ error: "Jenis dan teks wajib diisi." });

    try {
      const { ActivityType } = require("discord.js");
      if (!(type in ActivityType))
        return res
          .status(400)
          .json({ error: "Jenis aktivitas tidak dikenali." });
      client.user.setActivity(text, { type: ActivityType[type] });
      res.json({
        success: true,
        message: `Presence diubah jadi: ${type} ${text}`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- AI Voice per server ---
  router.post("/api/owner/aivoice", async (req, res) => {
    const { guildId, status } = req.body || {};
    if (!guildId)
      return res.status(400).json({ error: "Guild ID wajib diisi." });

    try {
      const [guildData] = await GuildSettings.findOrCreate({
        where: { guildId },
      });
      guildData.aiVoiceEnabled = !!status;
      await guildData.save({ fields: ["aiVoiceEnabled"] });
      res.json({
        success: true,
        message: `AI Voice server ${guildId} kini ${status ? "AKTIF" : "MATI"}.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Hapus seluruh data pengguna ---
  router.post("/api/owner/eco_reset", async (req, res) => {
    const { targetId } = req.body || {};
    if (!targetId)
      return res.status(400).json({ error: "Target User ID wajib diisi." });

    try {
      await UserProfile.destroy({ where: { userId: targetId } });
      res.json({
        success: true,
        message: `Data finansial, XP, dan inventory ${targetId} sudah dihapus.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Reset ulang tahun ---
  router.post("/api/owner/reset_bday", async (req, res) => {
    const { targetId } = req.body || {};
    if (!targetId)
      return res.status(400).json({ error: "Target User ID wajib diisi." });

    try {
      const profile = await UserProfile.findByPk(targetId);
      if (!profile)
        return res
          .status(404)
          .json({ error: "Profil pengguna tidak ditemukan." });
      profile.birthday = null;
      await profile.save({ fields: ["birthday"] });
      res.json({
        success: true,
        message: `Data ulang tahun ${targetId} sudah direset.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Setup guild dari jarak jauh ---
  router.post("/api/owner/guild_setup", async (req, res) => {
    const { guildId, type, data } = req.body || {};
    if (!guildId || !type || !data)
      return res.status(400).json({ error: "Parameternya belum lengkap." });

    try {
      const [guildData] = await GuildSettings.findOrCreate({
        where: { guildId },
      });
      const settings = guildData.settings || {};

      if (type === "minecraft") {
        settings.minecraft = {
          ...(settings.minecraft || {}),
          ip: data.ip,
          port: parseInt(data.port, 10) || 25565,
        };
      } else if (type === "sticky") {
        settings.stickyMessage = {
          channelId: data.channelId,
          message: data.message,
        };
      } else if (type === "announcement") {
        settings.announcementChannel = data.channelId;
      } else if (type === "autorole") {
        settings.autoRole = data.roleId;
      } else if (type === "autoreply") {
        if (!settings.autoReplies) settings.autoReplies = [];
        const trigger = String(data.trigger || "").toLowerCase();
        const existing = settings.autoReplies.findIndex(
          (r) => r.trigger === trigger,
        );
        if (existing !== -1) {
          settings.autoReplies[existing].response = data.response;
        } else {
          settings.autoReplies.push({ trigger, response: data.response });
        }
      } else {
        return res.status(400).json({ error: "Jenis setup tidak dikenali." });
      }

      guildData.settings = settings;
      guildData.changed("settings", true);
      await guildData.save({ fields: ["settings"] });
      res.json({
        success: true,
        message: `Setup [${type}] tersimpan untuk server ${guildId}.`,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  // --- Pengumuman massal ---
  router.post("/api/owner/announcement", async (req, res) => {
    const { message } = req.body || {};
    if (!message)
      return res.status(400).json({ error: "Pesannya masih kosong." });

    try {
      let sentCount = 0;
      const allSettings = await GuildSettings.findAll();

      for (const setting of allSettings) {
        // Perbaikan: versi lama memakai `verbaSlug1` sebagai ID kanal,
        // padahal itu slug karakter AI. Kanal pengumuman dipakai lebih dulu.
        const channelId = setting.settings?.announcementChannel;
        if (!channelId) continue;

        try {
          const channel = await client.channels.fetch(channelId);
          if (channel && channel.isTextBased()) {
            await channel.send(`**Pengumuman dari Naura**\n${message}`);
            sentCount++;
          }
        } catch {
          // Lewati kanal yang tidak bisa diakses.
        }
      }

      res.json({ success: true, message: `Terkirim ke ${sentCount} server.` });
    } catch (e) {
      logger.error("[OWNER ANNOUNCEMENT] Error:", e);
      res.status(500).json({ error: "Terjadi kesalahan sistem." });
    }
  });

  // --- Suntik status Premium langsung dari Dashboard ---
  router.post("/api/owner/premium/grant", async (req, res) => {
    const { userId, days = 30 } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "User ID Discord wajib diisi." });
    }
    const daysNum = Math.max(1, parseInt(days) || 30);

    try {
      const [profile] = await UserProfile.findOrCreate({ where: { userId } });
      const store = require("../../src/premium/premiumStore");
      const ui = require("../../src/config/ui");
      const { tierDisplayName } = require("../../src/premium/premiumTiers");
      const { sendPremiumDM } = require("../../src/premium/premiumNotify");

      const newExpiry = await store.grantPremium(userId, profile, daysNum);
      const tierKey = ui.getPremiumTier(daysNum, true);
      const displayName = tierDisplayName(tierKey, daysNum);

      let dmSent = false;
      try {
        dmSent = await sendPremiumDM(client, userId, "activated", {
          username: profile.username || "Member VIP",
          tierName: displayName,
          premiumUntil: newExpiry,
        });
      } catch (dmErr) {}

      broadcast(
        client,
        `Status premium (${displayName}) diberikan ke user ${userId}.`,
      );

      res.json({
        success: true,
        message: `Berhasil mengaktifkan status ${displayName} (${daysNum} hari) untuk user ${userId}.`,
        newExpiry,
        tier: tierKey,
        dmSent,
      });
    } catch (e) {
      logger.error("[OWNER GRANT PREMIUM] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Cabut status Premium dari Dashboard ---
  router.post("/api/owner/premium/revoke", async (req, res) => {
    const { userId } = req.body || {};
    if (!userId) {
      return res.status(400).json({ error: "User ID Discord wajib diisi." });
    }

    try {
      const profile = await UserProfile.findByPk(userId);
      if (!profile) {
        return res
          .status(404)
          .json({ error: "Profil pengguna tidak ditemukan." });
      }

      const store = require("../../src/premium/premiumStore");
      const { sendPremiumDM } = require("../../src/premium/premiumNotify");

      await store.revokePremium(userId, profile);
      try {
        await sendPremiumDM(client, userId, "removed", {
          username: profile.username || "Member",
        });
      } catch (dmErr) {}

      broadcast(client, `Status premium dicabut dari user ${userId}.`);

      res.json({
        success: true,
        message: `Status premium user ${userId} telah berhasil dicabut.`,
      });
    } catch (e) {
      logger.error("[OWNER REVOKE PREMIUM] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Dapatkan daftar Voucher V.I.P ---
  router.get("/api/owner/vouchers", async (req, res) => {
    try {
      const PremiumVoucher = require("../../src/models/PremiumVoucher");
      const vouchers = await PremiumVoucher.findAll({
        order: [["createdAt", "DESC"]],
        limit: 100,
      });
      res.json({ success: true, vouchers });
    } catch (e) {
      logger.error("[OWNER GET VOUCHERS] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Buat kode Voucher baru dari Dashboard ---
  router.post("/api/owner/vouchers/create", async (req, res) => {
    const { days = 30, expiredInDays = null, count = 1 } = req.body || {};
    const daysNum = Math.max(1, parseInt(days) || 30);
    const countNum = Math.min(50, Math.max(1, parseInt(count) || 1));

    try {
      const crypto = require("crypto");
      const PremiumVoucher = require("../../src/models/PremiumVoucher");
      const store = require("../../src/premium/premiumStore");

      let expiresAt = null;
      if (expiredInDays) {
        expiresAt = new Date(Date.now() + Number(expiredInDays) * store.DAY_MS);
      }

      const createdCodes = [];
      for (let i = 0; i < countNum; i++) {
        const code =
          "NAURA-VIP-" + crypto.randomBytes(5).toString("hex").toUpperCase();
        await PremiumVoucher.create({
          code,
          durationDays: daysNum,
          expiresAt,
        });
        createdCodes.push(code);
      }

      res.json({
        success: true,
        message: `Berhasil membuat ${createdCodes.length} kode voucher V.I.P (${daysNum} hari).`,
        codes: createdCodes,
      });
    } catch (e) {
      logger.error("[OWNER CREATE VOUCHERS] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Hapus voucher yang belum digunakan ---
  router.delete("/api/owner/vouchers/:code", async (req, res) => {
    const { code } = req.params;
    if (!code)
      return res.status(400).json({ error: "Kode voucher wajib diisi." });

    try {
      const PremiumVoucher = require("../../src/models/PremiumVoucher");
      const deleted = await PremiumVoucher.destroy({ where: { code } });
      if (!deleted) {
        return res.status(404).json({ error: "Kode voucher tidak ditemukan." });
      }
      res.json({ success: true, message: `Voucher ${code} berhasil dihapus.` });
    } catch (e) {
      logger.error("[OWNER DELETE VOUCHER] Error:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // --- Restart proses ---
  router.post("/api/owner/restart", (req, res) => {
    res.json({
      success: true,
      message: "Sistem dimatikan dan akan dinyalakan ulang...",
    });
    setTimeout(() => process.exit(0), 2000);
  });

  return router;
};

module.exports.EVAL_ENABLED = EVAL_ENABLED;
