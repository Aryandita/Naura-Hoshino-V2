"use strict";

/**
 * Route Portfolio Member, Sprint 21
 *
 * Endpoint publik (read-only, tanpa login):
 *   GET /api/portfolio/:userId       - Data JSON portfolio yang isPublic=true
 *   GET /u/:userId                   - Render halaman HTML portfolio publik
 *
 * Endpoint privat (butuh login, hanya diri sendiri atau owner):
 *   GET  /api/portfolio/me           - Ambil portfolio sendiri (termasuk draft)
 *   POST /api/portfolio/me           - Buat/update portfolio (upsert)
 *   POST /api/portfolio/me/toggle    - Toggle isPublic on/off
 *
 * Aturan premium:
 *   - accentColor, bgType:'image', bgValue, customBadge, dan tema non-default
 *     hanya bisa disimpan jika UserProfile.isPremium = true.
 *   - User non-premium yang mencoba mendapat 403 dengan pesan informatif.
 */

const express = require("express");
const path = require("path");
const { logger } = require("../../src/managers/logger");
const { requireApiLogin } = require("../middleware/auth");
const UserPortfolio = require("../../src/models/UserPortfolio");
const UserProfile = require("../../src/models/UserProfile");

const { VALID_THEMES, VALID_BG_TYPES, VALID_SECTIONS } = UserPortfolio;

// Tema yang hanya bisa dipakai pengguna premium.
const PREMIUM_THEMES = new Set(["sakura", "midnight"]);

/** Ambil data agregat satu user dari semua tabel yang relevan. */
async function aggregateUserData(userId, client) {
  const UserSurvival = require("../../src/models/UserSurvival");
  const UserPet = require("../../src/models/UserPet");
  const UserCard = require("../../src/models/UserCard");
  const UserAchievement = require("../../src/models/UserAchievement");
  const GuildClan = require("../../src/models/GuildClan");

  const [profile, survival, pets, cards, achievements] = await Promise.all([
    UserProfile.findOne({ where: { userId } }),
    UserSurvival.findOne({ where: { userId } }),
    UserPet.findAll({
      where: { userId },
      limit: 3,
      order: [["updatedAt", "DESC"]],
    }).catch(() => []),
    UserCard.findAll({
      where: { userId },
      limit: 10,
      order: [["createdAt", "DESC"]],
    }).catch(() => []),
    UserAchievement.findAll({
      where: { userId },
      limit: 6,
      order: [["createdAt", "DESC"]],
    }).catch(() => []),
  ]);

  // Ambil info klan jika bergabung
  let clan = null;
  if (survival && survival.clanId) {
    clan = await GuildClan.findOne({ where: { id: survival.clanId } }).catch(
      () => null,
    );
  }

  // Ambil nama Discord dari cache atau REST
  let discordUser = null;
  try {
    discordUser =
      client.users.cache.get(userId) ||
      (await client.users.fetch(userId).catch(() => null));
  } catch {
    /* abaikan bila bot tidak login */
  }

  return {
    discordUser,
    profile,
    survival,
    pets,
    cards,
    achievements,
    clan,
  };
}

/** Format data agregat jadi payload JSON bersih untuk frontend. */
function formatPortfolioPayload(userId, portfolio, aggregated, discordUser) {
  const { profile, survival, pets, cards, achievements, clan } = aggregated;
  const dp = discordUser || {};

  return {
    user: {
      id: userId,
      username: dp.username || "Pengguna Misterius",
      displayName: dp.displayName || dp.username || "Pengguna Misterius",
      avatar: dp.displayAvatarURL
        ? dp.displayAvatarURL({ extension: "png", size: 256 })
        : null,
      isPremium: !!(profile && profile.isPremium),
      premiumUntil: profile ? profile.premiumUntil : null,
    },
    portfolio: {
      isPublic: !!(portfolio && portfolio.isPublic),
      bio: (portfolio && portfolio.bio) || null,
      tagline: (portfolio && portfolio.tagline) || null,
      theme: (portfolio && portfolio.theme) || "default",
      accentColor: (portfolio && portfolio.accentColor) || null,
      bgType: (portfolio && portfolio.bgType) || "particles",
      bgValue: (portfolio && portfolio.bgValue) || null,
      showcaseSections: (portfolio && portfolio.showcaseSections) || [
        "survival",
        "music",
        "cards",
        "economy",
        "achievements",
      ],
      pinnedCardId: (portfolio && portfolio.pinnedCardId) || null,
      socialLinks: (portfolio && portfolio.socialLinks) || {},
      customBadge: (portfolio && portfolio.customBadge) || null,
      viewCount: (portfolio && portfolio.viewCount) || 0,
    },
    stats: {
      economy: {
        wallet: (profile && profile.economy_wallet) || 0,
        bank: (profile && profile.economy_bank) || 0,
        starFragments: (survival && survival.starFragments) || 0,
        coupons: (survival && survival.coupons) || 0,
      },
      survival: {
        level: (survival && survival.survival_level) || 1,
        xp: (survival && survival.survival_xp) || 0,
        hp: (survival && survival.hp) || 100,
        stamina: (survival && survival.stamina) || 100,
        strength: (survival && survival.strength) || 1,
        agility: (survival && survival.agility) || 1,
        intelligence: (survival && survival.intelligence) || 1,
        luck: (survival && survival.luck) || 1,
        currentLocation: (survival && survival.currentLocation) || "jalanan",
      },
      leveling: {
        level: (profile && profile.leveling_level) || 1,
        xp: (profile && profile.leveling_xp) || 0,
      },
      music: {
        tracksListened: (profile && profile.music_tracksListened) || 0,
        totalDurationMs: (profile && profile.music_totalDurationMs) || 0,
        favoriteGenre:
          (profile && profile.music_favoriteGenre) || "Belum Terdeteksi",
        lastListened:
          (profile && profile.music_lastListened) || "Belum ada lagu",
        topTrack: (profile && profile.music_topTrack) || null,
      },
      minigames: {
        triviaScore: (profile && profile.minigame_triviaScore) || 0,
        duelScore: (profile && profile.minigame_duelScore) || 0,
        rpsWin: (profile && profile.minigame_rpsWin) || 0,
        mathScore: (profile && profile.minigame_mathScore) || 0,
      },
      social: {
        reputation: (profile && profile.reputation) || 0,
        youtube: (profile && profile.social_youtube) || null,
        instagram: (profile && profile.social_instagram) || null,
        x: (profile && profile.social_x) || null,
        facebook: (profile && profile.social_facebook) || null,
      },
    },
    pets: pets.map((pet) => ({
      id: pet.id,
      name: pet.name,
      species: pet.species,
      level: pet.level,
      mood: pet.mood,
      rarity: pet.rarity,
      evolutionStage: pet.evolutionStage,
      cosmicAura: pet.cosmicAura,
    })),
    cards: cards.map((card) => ({
      id: card.id,
      cardCode: card.cardCode,
      characterName: card.characterName,
      seriesName: card.seriesName,
      rarity: card.rarity,
      quality: card.quality,
      isAwakened: card.isAwakened,
      awakeningLevel: card.awakeningLevel,
      imageUrl: card.imageUrl,
      frame: card.frame,
    })),
    achievements: achievements.map((ach) => ({
      id: ach.id,
      achievementId: ach.achievementId,
      earnedAt: ach.createdAt,
    })),
    clan: clan
      ? {
          id: clan.id,
          name: clan.name,
          tag: clan.tag,
          level: clan.level,
          description: clan.description,
        }
      : null,
  };
}

module.exports = (client) => {
  const router = express.Router();

  // =====================================================================
  // GET /api/portfolio/me, Portfolio diri sendiri (termasuk draft, butuh login)
  // =====================================================================
  router.get("/api/portfolio/me", requireApiLogin, async (req, res) => {
    try {
      const userId = req.user.id;
      const [portfolio] = await UserPortfolio.findOrCreate({
        where: { userId },
      });
      const aggregated = await aggregateUserData(userId, client);
      const payload = formatPortfolioPayload(
        userId,
        portfolio,
        aggregated,
        aggregated.discordUser || req.user,
      );
      return res.json(payload);
    } catch (err) {
      logger.error("[PORTFOLIO] GET /me error:", err);
      return res
        .status(500)
        .json({ error: "Naura gagal memuat portfolio kamu." });
    }
  });

  // =====================================================================
  // POST /api/portfolio/me, Buat/update portfolio (upsert, butuh login)
  // =====================================================================
  router.post("/api/portfolio/me", requireApiLogin, async (req, res) => {
    try {
      const userId = req.user.id;

      // Cek premium status untuk validasi field premium
      const profile = await UserProfile.findOne({ where: { userId } });
      const isPremium = !!(profile && profile.isPremium);

      const {
        bio,
        tagline,
        theme,
        accentColor,
        bgType,
        bgValue,
        showcaseSections,
        pinnedCardId,
        customBadge,
      } = req.body;

      // --- Validasi premium fields ---
      if (!isPremium) {
        if (accentColor) {
          return res.status(403).json({
            error: "Fitur warna aksen kustom hanya untuk pengguna Premium. 💎",
            premiumRequired: true,
          });
        }
        if (bgType === "image" && bgValue) {
          return res.status(403).json({
            error: "Fitur background gambar hanya untuk pengguna Premium. 💎",
            premiumRequired: true,
          });
        }
        if (customBadge) {
          return res.status(403).json({
            error: "Fitur custom badge hanya untuk pengguna Premium. 💎",
            premiumRequired: true,
          });
        }
        if (theme && PREMIUM_THEMES.has(theme)) {
          return res.status(403).json({
            error: `Tema "${theme}" hanya untuk pengguna Premium. 💎`,
            premiumRequired: true,
          });
        }
      }

      // --- Validasi umum ---
      if (bio && bio.length > 500) {
        return res
          .status(400)
          .json({ error: "Bio tidak boleh lebih dari 500 karakter." });
      }
      if (tagline && tagline.length > 80) {
        return res
          .status(400)
          .json({ error: "Tagline tidak boleh lebih dari 80 karakter." });
      }
      if (theme && !VALID_THEMES.includes(theme)) {
        return res.status(400).json({
          error: `Tema tidak valid. Pilihan: ${VALID_THEMES.join(", ")}`,
        });
      }
      if (bgType && !VALID_BG_TYPES.includes(bgType)) {
        return res.status(400).json({ error: `Tipe background tidak valid.` });
      }
      if (accentColor && !/^#[0-9A-Fa-f]{6}$/.test(accentColor)) {
        return res
          .status(400)
          .json({ error: "Format warna aksen harus #RRGGBB." });
      }
      if (customBadge && customBadge.length > 20) {
        return res
          .status(400)
          .json({ error: "Custom badge tidak boleh lebih dari 20 karakter." });
      }
      if (showcaseSections && Array.isArray(showcaseSections)) {
        const invalid = showcaseSections.filter(
          (s) => !VALID_SECTIONS.includes(s),
        );
        if (invalid.length > 0) {
          return res
            .status(400)
            .json({ error: `Seksi tidak valid: ${invalid.join(", ")}` });
        }
      }

      // Buat atau update (upsert, satu user = satu portfolio)
      const [portfolio, created] = await UserPortfolio.findOrCreate({
        where: { userId },
      });

      if (bio !== undefined) portfolio.bio = bio;
      if (tagline !== undefined) portfolio.tagline = tagline;
      if (theme !== undefined) portfolio.theme = theme;
      if (isPremium && accentColor !== undefined)
        portfolio.accentColor = accentColor;
      if (bgType !== undefined) portfolio.bgType = bgType;
      if (isPremium && bgValue !== undefined) portfolio.bgValue = bgValue;
      if (showcaseSections !== undefined)
        portfolio.showcaseSections = showcaseSections;
      if (pinnedCardId !== undefined) portfolio.pinnedCardId = pinnedCardId;
      if (isPremium && customBadge !== undefined)
        portfolio.customBadge = customBadge;

      await portfolio.save({
        fields: [
          "bio",
          "tagline",
          "theme",
          "accentColor",
          "bgType",
          "bgValue",
          "showcaseSections",
          "pinnedCardId",
          "socialLinks",
          "customBadge",
        ],
      });

      return res.json({
        success: true,
        created,
        message: created
          ? "Portfolio berhasil dibuat! 🎉"
          : "Portfolio berhasil diperbarui! ✨",
        portfolio: portfolio.toJSON(),
      });
    } catch (err) {
      logger.error("[PORTFOLIO] POST /me error:", err);
      return res
        .status(500)
        .json({ error: "Naura gagal menyimpan portfolio kamu." });
    }
  });

  // =====================================================================
  // POST /api/portfolio/me/toggle, Toggle isPublic
  // =====================================================================
  router.post("/api/portfolio/me/toggle", requireApiLogin, async (req, res) => {
    try {
      const userId = req.user.id;
      const [portfolio] = await UserPortfolio.findOrCreate({
        where: { userId },
      });
      portfolio.isPublic = !portfolio.isPublic;
      await portfolio.save({ fields: ["isPublic"] });

      return res.json({
        success: true,
        isPublic: portfolio.isPublic,
        message: portfolio.isPublic
          ? "Portfolio kamu sekarang bisa dilihat publik! 🌐"
          : "Portfolio kamu disembunyikan dari publik. 🔒",
      });
    } catch (err) {
      logger.error("[PORTFOLIO] POST /me/toggle error:", err);
      return res
        .status(500)
        .json({ error: "Naura gagal mengubah visibilitas portfolio." });
    }
  });

  // =====================================================================
  // GET /api/portfolio/:userId, Data publik portfolio user lain
  // =====================================================================
  router.get("/api/portfolio/:userId", async (req, res) => {
    try {
      const { userId } = req.params;

      // Validasi: hanya angka (Discord snowflake)
      if (!/^\d{17,20}$/.test(userId)) {
        return res.status(400).json({ error: "User ID tidak valid." });
      }

      const portfolio = await UserPortfolio.findOne({ where: { userId } });

      // Jika user login sebagai dirinya sendiri, boleh lihat draft
      const viewerIsOwner = req.user && req.user.id === userId;

      if (!portfolio || (!portfolio.isPublic && !viewerIsOwner)) {
        return res.status(404).json({
          error: "Portfolio ini belum dipublikasikan atau tidak ditemukan.",
        });
      }

      // Increment view counter (async, tidak blocking response)
      if (!viewerIsOwner && portfolio.isPublic) {
        UserPortfolio.increment("viewCount", { where: { userId } }).catch(
          () => {},
        );
      }

      const aggregated = await aggregateUserData(userId, client);
      const payload = formatPortfolioPayload(
        userId,
        portfolio,
        aggregated,
        aggregated.discordUser,
      );
      return res.json(payload);
    } catch (err) {
      logger.error(`[PORTFOLIO] GET /:userId error:`, err);
      return res.status(500).json({ error: "Naura gagal memuat portfolio." });
    }
  });

  // =====================================================================
  // GET /u/:userId, Halaman HTML portfolio publik (dengan Dynamic Open Graph Preview)
  // =====================================================================
  router.get("/u/:userId", async (req, res) => {
    const { userId } = req.params;

    if (!/^\d{17,20}$/.test(userId)) {
      return res.status(400).send("User ID tidak valid.");
    }

    const fs = require("fs");
    const distPage = path.join(
      __dirname,
      "..",
      "dist",
      "src",
      "pages",
      "portfolio.html",
    );
    const srcPage = path.join(
      __dirname,
      "..",
      "src",
      "pages",
      "portfolio.html",
    );

    const filePath = fs.existsSync(distPage) ? distPage : srcPage;

    try {
      let html = fs.readFileSync(filePath, "utf-8");

      // Ambil metadata ringkas user untuk Open Graph tag
      let discordUser = null;
      try {
        discordUser =
          client.users.cache.get(userId) ||
          (await client.users.fetch(userId).catch(() => null));
      } catch {
        /* ignore */
      }

      const profile = await UserProfile.findOne({ where: { userId } }).catch(
        () => null,
      );
      const username =
        discordUser?.globalName || discordUser?.username || "Petualang Naura";
      const level = profile?.level || 1;
      const exp = profile?.exp || 0;
      const avatarUrl = discordUser
        ? discordUser.displayAvatarURL({ extension: "png", size: 512 })
        : "/assets/dashboard/naura.png";

      const ogTitle = `${username} | Cyber Portfolio & Rank Level ${level}`;
      const ogDesc = `Jelajahi profil interaktif 3D & riwayat petualangan ${username} (Level ${level} • ${exp.toLocaleString()} EXP) di ekosistem Naura Hoshino OS.`;

      // Injeksi OG Meta Tags ke dalam HTML
      const ogTags = `
    <!-- Dynamic Open Graph / Discord Embed Preview (Sprint 21 / Proposal F9) -->
    <meta property="og:type" content="profile" />
    <meta property="og:title" content="${ogTitle}" />
    <meta property="og:description" content="${ogDesc}" />
    <meta property="og:image" content="${avatarUrl}" />
    <meta property="og:url" content="/u/${userId}" />
    <meta name="theme-color" content="#FFB6C1" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${ogTitle}" />
    <meta name="twitter:description" content="${ogDesc}" />
    <meta name="twitter:image" content="${avatarUrl}" />
      `;

      html = html.replace("</head>", `${ogTags}\n  </head>`);
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      return res.send(html);
    } catch (err) {
      logger.error("[PORTFOLIO] Gagal render OG portfolio HTML:", err);
      return res.sendFile(filePath);
    }
  });

  return router;
};
