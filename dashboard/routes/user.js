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
const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const cacheManager = require("../../src/managers/cacheManager");
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

    // Pembacaan wajib lewat cacheManager, bukan memanggil model Sequelize
    // secara langsung. Dashboard berjalan di proses yang sama dengan bot, jadi
    // antrean write-behind (flush tiap 5 detik) yang dibaca langsung ke
    // Postgres bisa menampilkan saldo dan vital yang sudah basi.
    // ESLint punya aturan khusus untuk pemanggilan yang melewati cacheManager.
    const cacheManager = require("../../src/managers/cacheManager");

    try {
      const [profile, survival] = await Promise.all([
        cacheManager.getUserProfile(req.user.id),
        cacheManager.getUserSurvival(req.user.id),
      ]);

      if (!profile) {
        // Profil gagal dimuat, tapi login tetap valid. Bedakan kondisi ini
        // dari "berhasil dimuat" supaya client tidak mengira vital pemain
        // benar-benar 0 dan menampilkan bar kosong tanpa penjelasan.
        logger.error(
          "[API ME] Profil pengguna tidak dapat dimuat untuk",
          req.user.id,
        );
        return res.json({
          loggedIn: true,
          user: req.user,
          db: null,
          survival: null,
          isOwner: isOwner(req.user.id),
          dataError: "Gagal memuat profil dari database.",
        });
      }

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
        dataError: "Gagal memuat data dari database.",
      });
    }
  });

  // ------------------------------------------------------------------
  // Bahasa pilihan pengguna (disinkronkan dengan bot)
  // ------------------------------------------------------------------
  router.get("/api/me/language", requireApiLogin, async (req, res) => {
    try {
      const languageManager = require("../../src/managers/languageManager");
      const lang = await languageManager.getUserLanguage(req.user.id);
      res.json({
        success: true,
        language: lang,
        supported: languageManager.SUPPORTED_LANGUAGES || ["id", "en"],
      });
    } catch (e) {
      logger.error("[API LANGUAGE GET] Error:", e);
      res.status(500).json({
        success: false,
        error: "Naura gagal membaca pilihan bahasamu.",
      });
    }
  });

  router.post("/api/me/language", requireApiLogin, async (req, res) => {
    try {
      const languageManager = require("../../src/managers/languageManager");
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
      res.status(500).json({
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
      const cacheManager = require("../../src/managers/cacheManager");
      const profile = await cacheManager.getUserProfile(req.user.id);

      if (!profile.isPremium) {
        return res.status(403).json({
          success: false,
          error: "Fitur ini hanya untuk member Premium.",
        });
      }

      await cacheManager.mutateUserProfileJson(
        req.user.id,
        "aiPersona",
        () => ({
          name: name || null,
          systemPrompt: systemPrompt || null,
          avatarUrl: avatarUrl || null,
        }),
      );

      res.json({ success: true, message: "Persona AI berhasil diperbarui!" });
    } catch (e) {
      logger.error("[API PERSONA SET] Error:", e);
      res
        .status(500)
        .json({ success: false, error: "Gagal menyimpan persona AI." });
    }
  });

  // ------------------------------------------------------------------
  // Halaman profil pemain
  // ------------------------------------------------------------------
  router.get("/api/profile", requireSelfOrOwner, async (req, res) => {
    try {
      const userId = req.targetUserId;
      const achievementsPool = require("../../src/survival/data/achievementsData");

      const MYTHIC_IDS = new Set([
        "god_slayer",
        "elf_evolution",
        "magic_creator",
        "billionaire",
      ]);

      const RARE_IDS = new Set([
        "high_mage",
        "weapon_manifest",
        "blacksmith_master",
        "demon_contract",
        "yinyang_light",
        "cat_beast_friend",
        "gambler",
      ]);

      if (req.isPreview || userId === "demo_user") {
        const demoUnlockedIds = [
          "first_step",
          "scavenger",
          "adventurer",
          "weapon_manifest",
          "blacksmith_master",
          "chef",
          "gambler",
          "billionaire",
          "veteran_survivor",
          "fisherman",
          "tree_feller",
          "miner",
        ];

        const achievementList = achievementsPool.map((ach) => {
          let rarity = "Common";
          if (MYTHIC_IDS.has(ach.id)) rarity = "Mythic";
          else if (RARE_IDS.has(ach.id)) rarity = "Rare";

          return {
            id: ach.id,
            title: ach.title,
            description: ach.description,
            emoji: ach.emoji,
            color: ach.color,
            rarity,
            unlocked: demoUnlockedIds.includes(ach.id),
          };
        });

        const unlockedCount = demoUnlockedIds.length;
        const totalCount = achievementsPool.length;
        const percentage = Math.round((unlockedCount / totalCount) * 100);

        return res.json({
          success: true,
          identity: {
            userId: "889912345678901234",
            username: "NauraAdventurer",
            discriminator: "2026",
            avatar: "https://cdn.discordapp.com/embed/avatars/0.png",
            banner: null,
            createdAt: "2024-03-15T08:00:00.000Z",
          },
          economy: {
            wallet: 154500,
            bank: 850000,
            netWorth: 1004500,
            starFragments: 18450,
            coupons: 14,
            lotteryTickets: 5,
          },
          vitals: {
            hp: 95,
            stamina: 88,
            hydration: 90,
            satiation: 85,
          },
          stats: {
            strength: 45,
            agility: 38,
            intelligence: 52,
            luck: 25,
          },
          survival: {
            inGameDay: 48,
            inGameHour: 14,
            propertyId: "villa_bintang",
            currentLocation: "kota_pratama",
            vehicle: "Cyber Skiff",
          },
          leveling: {
            chatLevel: 38,
            chatXp: 38400,
            rpgLevel: 29,
            rpgXp: 29150,
          },
          status: {
            isPremium: true,
            premiumUntil: "2026-12-31T23:59:59.000Z",
            isOwner: true,
            language: "id",
            reputation: 350,
          },
          achievements: {
            unlockedCount,
            totalCount,
            percentage,
            activeTitle: "Sang Penakluk Bintang",
            list: achievementList,
          },
          inventory: [],
          npcBonds: [],
        });
      }

      const UserSurvival = require("../../src/models/UserSurvival");
      const UserNPC = require("../../src/models/UserNPC");
      const UserAchievement = require("../../src/models/UserAchievement");

      const [profile] = await UserProfile.findOrCreate({ where: { userId } });
      const [survival] = await UserSurvival.findOrCreate({ where: { userId } });
      const [userAch] = await UserAchievement.findOrCreate({ where: { userId } });
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

      const unlockedIds = Array.isArray(userAch.unlockedAchievements)
        ? userAch.unlockedAchievements
        : [];
      const activeTitle = userAch.activeTitle || null;

      const achievementList = achievementsPool.map((ach) => {
        let rarity = "Common";
        if (MYTHIC_IDS.has(ach.id)) rarity = "Mythic";
        else if (RARE_IDS.has(ach.id)) rarity = "Rare";

        return {
          id: ach.id,
          title: ach.title,
          description: ach.description,
          emoji: ach.emoji,
          color: ach.color,
          rarity,
          unlocked: unlockedIds.includes(ach.id),
        };
      });

      const unlockedCount = unlockedIds.length;
      const totalCount = achievementsPool.length;
      const percentage =
        totalCount > 0 ? Math.round((unlockedCount / totalCount) * 100) : 0;

      let bannerUrl = null;
      if (dUser?.banner) {
        bannerUrl = `https://cdn.discordapp.com/banners/${userId}/${dUser.banner}.png?size=1024`;
      } else if (profile.activeBanners && profile.activeBanners.profile) {
        bannerUrl = profile.activeBanners.profile;
      }

      res.json({
        success: true,
        identity: {
          userId,
          username: dUser ? dUser.username : "Pengguna Misterius",
          discriminator: dUser ? dUser.discriminator || "0" : "0",
          avatar: dUser
            ? dUser.displayAvatarURL({ extension: "png", size: 256 })
            : client.user.displayAvatarURL({ extension: "png", size: 256 }),
          banner: bannerUrl,
          createdAt: dUser?.createdAt || null,
        },
        economy: {
          wallet: profile.economy_wallet || 0,
          bank: profile.economy_bank || 0,
          netWorth: (profile.economy_wallet || 0) + (profile.economy_bank || 0),
          starFragments: survival.starFragments || 0,
          coupons: survival.coupons || 0,
          lotteryTickets: survival.lotteryTickets || 0,
        },
        vitals: {
          hp: survival.hp ?? 100,
          stamina: survival.stamina ?? 100,
          hydration: survival.thirst ?? 100,
          satiation: survival.hunger ?? 100,
        },
        stats: {
          strength: survival.strength || 1,
          agility: survival.agility || 1,
          intelligence: survival.intelligence || 1,
          luck: survival.luck || 1,
        },
        survival: {
          inGameDay: survival.inGameDay || 1,
          inGameHour: survival.inGameHour || 6,
          propertyId: survival.propertyId || "jalanan",
          currentLocation: survival.currentLocation || "jalanan",
          vehicle: survival.vehicle || null,
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
          reputation: profile.reputation || 0,
        },
        achievements: {
          unlockedCount,
          totalCount,
          percentage,
          activeTitle,
          list: achievementList,
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
  // Inventory: daftar isi tas & peralatan petualang
  // ------------------------------------------------------------------
  router.get("/api/inventory", async (req, res) => {
    try {
      const isAuth = typeof req.isAuthenticated === "function" && req.isAuthenticated() && req.user;
      const targetUserId = isAuth
        ? (isOwner(req.user.id) && req.query?.userId ? String(req.query.userId) : req.user.id)
        : null;

      if (!targetUserId) {
        return res.json({
          success: true,
          isGuest: true,
          items: [],
          tools: {
            pickaxe: { level: 1, durability: 100, maxDurability: 100 },
            axe: { level: 1, durability: 100, maxDurability: 100 },
            rod: { level: 1, durability: 100, maxDurability: 100 },
          },
          capacity: { used: 0, max: 30 },
          message: "Mode pratinjau tamu. Masuk lewat Discord untuk memuat isi ranselmu.",
        });
      }

      const cacheManager = require("../../src/managers/cacheManager");
      const GameItem = require("../../src/models/GameItem");
      const profile = await cacheManager.getUserProfile(targetUserId);

      if (!profile) {
        return res.json({
          success: true,
          isGuest: !isAuth,
          items: [],
          tools: {
            pickaxe: { level: 1, durability: 100, maxDurability: 100 },
            axe: { level: 1, durability: 100, maxDurability: 100 },
            rod: { level: 1, durability: 100, maxDurability: 100 },
          },
          capacity: { used: 0, max: 30 },
        });
      }

      const rawInv = Array.isArray(profile.inventory) ? profile.inventory : [];
      const items = await Promise.all(
        rawInv.map(async (entry, idx) => {
          const id = itemIdOf(entry);
          const dbItem = await GameItem.findByPk(id).catch(() => null);
          const name = (typeof entry === "object" && entry.name) || (dbItem && dbItem.name) || id;
          const count = (typeof entry === "object" && entry.amount) || (typeof entry === "object" && entry.count) || 1;
          const rarity = (dbItem && dbItem.rarity) || (typeof entry === "object" && entry.rarity) || "Common";
          const type = (dbItem && dbItem.category) || (typeof entry === "object" && entry.type) || "Material";
          const desc = (dbItem && dbItem.description) || (typeof entry === "object" && entry.desc) || "Barang petualangan Naura Wilds.";
          const val = (dbItem && dbItem.sellPrice) || 50;

          let icon = (typeof entry === "object" && entry.icon) || "📦";
          if (icon === "📦") {
            const low = String(id).toLowerCase();
            if (low.includes("sword") || low.includes("pedang")) icon = "🗡️";
            else if (low.includes("pickaxe") || low.includes("beliung")) icon = "⛏️";
            else if (low.includes("axe") || low.includes("kapak")) icon = "🪓";
            else if (low.includes("fish") || low.includes("ikan")) icon = "🐟";
            else if (low.includes("berry") || low.includes("buah") || low.includes("crop")) icon = "🍓";
            else if (low.includes("ore") || low.includes("mineral") || low.includes("shard")) icon = "💎";
            else if (low.includes("potion") || low.includes("jamu")) icon = "🧪";
          }

          return {
            id,
            slotIndex: idx,
            name,
            icon,
            type,
            rarity,
            durability: (typeof entry === "object" && entry.durability) ? entry.durability : "100/100",
            value: `${val.toLocaleString("id-ID")} NSF`,
            count,
            desc,
          };
        }),
      );

      const tools = {
        pickaxe: {
          level: profile.tool_pickaxeLevel || 1,
          durability: profile.tool_pickaxeDurability || 100,
          maxDurability: 100,
        },
        axe: {
          level: profile.tool_axeLevel || 1,
          durability: profile.tool_axeDurability || 100,
          maxDurability: 100,
        },
        rod: {
          level: profile.tool_rodLevel || 1,
          durability: profile.tool_rodDurability || 100,
          maxDurability: 100,
        },
      };

      return res.json({
        success: true,
        isGuest: !isAuth,
        items,
        tools,
        capacity: {
          used: items.length,
          max: 30,
        },
      });
    } catch (err) {
      logger.error("[API INVENTORY GET] Error:", err);
      return res.status(500).json({ success: false, error: "Gagal memuat isi tas ransel." });
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

      const GameItem = require("../../src/models/GameItem");
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
        return res.status(400).json({
          success: false,
          error: "Itemnya tidak cocok dengan slot itu.",
        });
      }

      let message = "";
      if (action === "sell") {
        const itemDb = await GameItem.findByPk(itemId);
        const sellPrice = itemDb ? itemDb.sellPrice : 50;
        
        // Fix: Use atomic increment via cacheManager to prevent silent data loss
        // (RULES.md §1.6 & §1.8)
        await cacheManager.incrementUserProfile(req.targetUserId, "economy_wallet", sellPrice);
        
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
        return res.status(400).json({
          success: false,
          error: "Item yang mau dilebur belum dipilih.",
        });

      const GameItem = require("../../src/models/GameItem");
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
        return res.status(400).json({
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
