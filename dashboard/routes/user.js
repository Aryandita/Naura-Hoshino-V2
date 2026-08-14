"use strict";

/**
 * Rute yang menyentuh data satu pengguna: sesi, profil, dan inventory.
 *
 * Lubang keamanan yang ditutup di sini: `/api/inventory/action` dan
 * `/api/inventory/forge` dulu menerima `userId` mentah dari body tanpa login
 * maupun verifikasi. Siapa pun bisa menjual atau melebur isi tas orang lain
 * hanya dengan menebak ID Discord. Kini keduanya dijaga `requireSelfOrOwner`.
 */

const express = require("express");
const { logger } = require("../src/managers/logger");
const UserProfile = require("../src/models/UserProfile");
const {
  requireApiLogin,
  requireSelfOrOwner,
  isOwner,
} = require("../middleware/auth");

// Jalur peningkatan bahan saat fusi berhasil.
const FORGE_UPGRADES = {
  wood: "fiber",
  stone: "iron_ore",
  iron_ore: "silver_ore",
  silver_ore: "mythril_ore",
  mythril_ore: "naura_shard",
  diamond: "naura_shard",
};

const FORGE_SUCCESS_RATE = 0.7;

function itemIdOf(entry) {
  return entry && typeof entry === "object" ? entry.id : entry;
}

module.exports = (client) => {
  const router = express.Router();

  // ------------------------------------------------------------------
  // Sesi pengguna
  // ------------------------------------------------------------------
  router.get("/api/me", async (req, res) => {
    if (typeof req.isAuthenticated !== "function" || !req.isAuthenticated()) {
      return res.json({ loggedIn: false });
    }

    try {
      const [profile] = await UserProfile.findOrCreate({
        where: { userId: req.user.id },
      });
      const UserSurvival = require("../src/models/UserSurvival");
      const [survival] = await UserSurvival.findOrCreate({
        where: { userId: req.user.id },
      });

      return res.json({
        loggedIn: true,
        user: req.user,
        db: profile,
        survival,
        isOwner: isOwner(req.user.id),
        language: profile.language || null,
      });
    } catch (err) {
      logger.error("[API ME] Gagal memuat data pengguna:", err);
      return res.json({
        loggedIn: true,
        user: req.user,
        db: null,
        survival: null,
        isOwner: false,
      });
    }
  });

  // ------------------------------------------------------------------
  // Bahasa pilihan pengguna (disinkronkan dengan bot)
  // ------------------------------------------------------------------
  router.get("/api/me/language", requireApiLogin, async (req, res) => {
    try {
      const languageManager = require("../src/managers/languageManager");
      const lang = await languageManager.getUserLanguage(req.user.id);
      res.json({
        success: true,
        language: lang,
        supported: languageManager.SUPPORTED_LANGUAGES || ["id", "en"],
      });
    } catch (e) {
      logger.error("[API LANGUAGE GET] Error:", e);
      res
        .status(500)
        .json({
          success: false,
          error: "Naura gagal membaca pilihan bahasamu.",
        });
    }
  });

  router.post("/api/me/language", requireApiLogin, async (req, res) => {
    try {
      const languageManager = require("../src/managers/languageManager");
      const supported = languageManager.SUPPORTED_LANGUAGES || ["id", "en"];
      const lang = String(req.body?.language || "").toLowerCase();

      if (!supported.includes(lang)) {
        return res
          .status(400)
          .json({ success: false, error: "Bahasa itu belum Naura dukung ya." });
      }

      await languageManager.setUserLanguage(req.user.id, lang);
      res.json({
        success: true,
        language: lang,
        message: "Bahasanya sudah Naura ganti!",
      });
    } catch (e) {
      logger.error("[API LANGUAGE SET] Error:", e);
      res
        .status(500)
        .json({
          success: false,
          error: "Naura gagal menyimpan pilihan bahasamu.",
        });
    }
  });

  // ------------------------------------------------------------------
  // Persona AI (Premium User)
  // ------------------------------------------------------------------
  router.post("/api/me/persona", requireApiLogin, async (req, res) => {
    try {
      const { name, systemPrompt, avatarUrl } = req.body;
      const cacheManager = require("../src/managers/cacheManager");
      const profile = await cacheManager.getUserProfile(req.user.id);
      
      if (!profile.isPremium) {
          return res.status(403).json({ success: false, error: "Fitur ini hanya untuk member Premium." });
      }

      const mutator = await cacheManager.mutateUserProfileJson(req.user.id);
      if (mutator) {
          mutator.aiPersona = {
              name: name || null,
              systemPrompt: systemPrompt || null,
              avatarUrl: avatarUrl || null
          };
          await mutator.save();
      }

      res.json({ success: true, message: "Persona AI berhasil diperbarui!" });
    } catch (e) {
      logger.error("[API PERSONA SET] Error:", e);
      res.status(500).json({ success: false, error: "Gagal menyimpan persona AI." });
    }
  });

  // ------------------------------------------------------------------
  // Halaman profil pemain
  // ------------------------------------------------------------------
  router.get("/api/profile", requireSelfOrOwner, async (req, res) => {
    try {
      const userId = req.targetUserId;
      const UserSurvival = require("../src/models/UserSurvival");
      const UserNPC = require("../src/models/UserNPC");

      const [profile] = await UserProfile.findOrCreate({ where: { userId } });
      const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
      const bonds = await UserNPC.findAll({ where: { userId } });

      const cachedUser = client.users.cache.get(userId);
      const dUser =
        cachedUser || (await client.users.fetch(userId).catch(() => null));

      const relationshipNames = [
        "Kenalan",
        "Teman",
        "Sahabat",
        "Pacar",
        "Menikah",
      ];

      res.json({
        success: true,
        identity: {
          userId,
          username: dUser ? dUser.username : "Pengguna Misterius",
          avatar: dUser
            ? dUser.displayAvatarURL({ extension: "png", size: 256 })
            : client.user.displayAvatarURL({ extension: "png", size: 256 }),
        },
        economy: {
          wallet: profile.economy_wallet || 0,
          bank: profile.economy_bank || 0,
          netWorth: (profile.economy_wallet || 0) + (profile.economy_bank || 0),
          starFragments: survival.starFragments || 0,
        },
        leveling: {
          chatLevel: profile.leveling_level || 1,
          chatXp: profile.leveling_xp || 0,
          rpgLevel: survival.survival_level || 1,
          rpgXp: survival.survival_xp || 0,
        },
        status: {
          isPremium: !!profile.isPremium,
          premiumUntil: profile.premiumUntil || null,
          isOwner: isOwner(userId),
          language: profile.language || null,
        },
        inventory: profile.inventory || [],
        npcBonds: bonds
          .map((b) => ({
            npcId: b.npcId,
            affection: b.affection || 0,
            relationshipLevel: b.relationshipLevel || 0,
            relationshipName:
              relationshipNames[b.relationshipLevel || 0] || "Kenalan",
            lastInteraction: b.lastInteraction || null,
          }))
          .sort((a, b) => b.affection - a.affection),
      });
    } catch (e) {
      logger.error("[API PROFILE] Error:", e);
      res
        .status(500)
        .json({ success: false, error: "Naura gagal memuat profilmu." });
    }
  });

  // ------------------------------------------------------------------
  // Inventory: jual / buang
  // ------------------------------------------------------------------
  router.post("/api/inventory/action", requireSelfOrOwner, async (req, res) => {
    try {
      const { itemId, itemIdx, action } = req.body || {};
      if (!itemId || itemIdx === undefined || !action) {
        return res
          .status(400)
          .json({ success: false, error: "Parameternya belum lengkap ya." });
      }

      const GameItem = require("../src/models/GameItem");
      const profile = await UserProfile.findByPk(req.targetUserId);
      if (!profile)
        return res
          .status(404)
          .json({ success: false, error: "Profil pemain tidak ditemukan." });

      const inv = profile.inventory || [];
      const idx = Number(itemIdx);
      if (!Number.isInteger(idx) || idx < 0 || idx >= inv.length) {
        return res
          .status(400)
          .json({ success: false, error: "Slot item itu tidak valid." });
      }

      const item = inv[idx];
      if (itemIdOf(item) !== itemId) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Itemnya tidak cocok dengan slot itu.",
          });
      }

      let message = "";
      if (action === "sell") {
        const itemDb = await GameItem.findByPk(itemId);
        const sellPrice = itemDb ? itemDb.sellPrice : 50;
        profile.economy_wallet = (profile.economy_wallet || 0) + sellPrice;
        message = `Berhasil! 1x **${item.name || itemId}** terjual seharga 🪙 **${sellPrice.toLocaleString("id-ID")} Coin**.`;
      } else if (action === "trash") {
        message = `Oke, 1x **${item.name || itemId}** sudah Naura buang dari tasmu.`;
      } else {
        return res
          .status(400)
          .json({ success: false, error: "Aksi itu tidak dikenali." });
      }

      if ((item.amount || 1) > 1) {
        item.amount -= 1;
      } else {
        inv.splice(idx, 1);
      }

      profile.inventory = inv;
      profile.changed("inventory", true);
      await profile.save({ fields: ["inventory"] });

      res.json({ success: true, message });
    } catch (e) {
      logger.error("[API INVENTORY ACTION] Error:", e);
      res
        .status(500)
        .json({ success: false, error: "Naura gagal memproses isi tasmu." });
    }
  });

  // ------------------------------------------------------------------
  // Inventory: fusi / peleburan
  // ------------------------------------------------------------------
  router.post("/api/inventory/forge", requireSelfOrOwner, async (req, res) => {
    try {
      const { itemId } = req.body || {};
      if (!itemId)
        return res
          .status(400)
          .json({
            success: false,
            error: "Item yang mau dilebur belum dipilih.",
          });

      const GameItem = require("../src/models/GameItem");
      const profile = await UserProfile.findByPk(req.targetUserId);
      if (!profile)
        return res
          .status(404)
          .json({ success: false, error: "Profil pemain tidak ditemukan." });

      const inv = profile.inventory || [];
      const totalAmount = inv.reduce(
        (sum, entry) =>
          itemIdOf(entry) === itemId ? sum + (entry.amount || 1) : sum,
        0,
      );

      if (totalAmount < 2) {
        return res
          .status(400)
          .json({
            success: false,
            error: "Naura butuh minimal 2 item yang sama untuk melebur ya.",
          });
      }

      // Ambil 2 bahan dari belakang agar tumpukan terlama tetap utuh.
      let toDeduct = 2;
      for (let i = inv.length - 1; i >= 0 && toDeduct > 0; i--) {
        if (itemIdOf(inv[i]) !== itemId) continue;
        const amt = inv[i].amount || 1;
        if (amt > toDeduct) {
          inv[i].amount = amt - toDeduct;
          toDeduct = 0;
        } else {
          toDeduct -= amt;
          inv.splice(i, 1);
        }
      }

      const isSuccess = Math.random() < FORGE_SUCCESS_RATE;
      let message;
      let forgedItemName = itemId;

      if (isSuccess) {
        const newId = FORGE_UPGRADES[itemId] || null;

        if (newId) {
          const nextItemDb = await GameItem.findByPk(newId);
          const name = nextItemDb ? nextItemDb.name : newId;
          forgedItemName = name;

          const existing = inv.find((entry) => itemIdOf(entry) === newId);
          if (existing) {
            existing.amount = (existing.amount || 1) + 1;
          } else {
            inv.push({ id: newId, name, amount: 1 });
          }
          message = `Peleburannya berhasil! Kamu dapat 1x **${name}**. Hebat!`;
        } else {
          const itemDb = await GameItem.findByPk(itemId);
          const name = itemDb ? itemDb.name : itemId;
          const levelMatch = name.match(/\(Lv\.\s*(\d+)\)/i);
          forgedItemName = levelMatch
            ? name.replace(
                /\(Lv\.\s*\d+\)/i,
                `(Lv. ${parseInt(levelMatch[1], 10) + 1})`,
              )
            : `${name} (Lv. 2)`;

          inv.push({ id: itemId, name: forgedItemName, amount: 1 });
          message = `Peningkatannya berhasil! Itemmu naik tingkat jadi **${forgedItemName}**.`;
        }
      } else {
        // Gagal: satu bahan hancur, satu dikembalikan.
        const existing = inv.find((entry) => itemIdOf(entry) === itemId);
        if (existing) {
          existing.amount = (existing.amount || 1) + 1;
        } else {
          const itemDb = await GameItem.findByPk(itemId);
          inv.push({
            id: itemId,
            name: itemDb ? itemDb.name : itemId,
            amount: 1,
          });
        }
        message =
          "Yah, peleburannya gagal. Satu bahannya hancur. Jangan menyerah ya!";
      }

      profile.inventory = inv;
      profile.changed("inventory", true);
      await profile.save({ fields: ["inventory"] });

      res.json({ success: true, upgraded: isSuccess, message, forgedItemName });
    } catch (e) {
      logger.error("[API INVENTORY FORGE] Error:", e);
      res
        .status(500)
        .json({ success: false, error: "Naura gagal melebur itemmu." });
    }
  });

  return router;
};

module.exports.FORGE_UPGRADES = FORGE_UPGRADES;
