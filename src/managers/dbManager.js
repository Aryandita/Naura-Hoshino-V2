/**
 * @module dbManager
 * @description Database Connection Management untuk Naura Hoshino V2
 * 
 * Manajer koneksi database yang menghandle Sequelize ORM setup, model registration,
 * association definitions, migration execution, dan health monitoring. Mendukung
 * multiple database backends (PostgreSQL/Supabase, MySQL, SQLite fallback).
 * 
 * KEY FEATURES:
 * 1. Multi-Backend Support - PostgreSQL (Supabase), MySQL, SQLite fallback otomatis
 * 2. Exponential Backoff Retry - 3 percobaan dengan jeda 2s, 4s, 8s untuk koneksi
 * 3. Model Auto-Registration - Import dan registrasi 30+ Sequelize models otomatis
 * 4. Association Setup - Define relasi hasOne/hasMany/belongsTo antar models
 * 5. Safe Migration System - Production: manual migrate, Development: auto-migrate
 * 6. Health Check Timer - Monitor koneksi setiap 30 detik dengan auto-reconnect
 * 7. Fallback Sync - Sinkronisasi data dari SQLite ke production DB saat reconnect
 * 8. Shard-Aware Migration - Hanya primary shard (SHARD_ID=0) yang jalankan migrasi
 * 9. Production Safe-Sync - alter: false di production untuk mencegah data loss
 * 10. Connection Status API - getDbStatus() untuk monitoring dan health endpoints
 * 
 * ARCHITECTURE NOTES:
 * - Config Source: src/config/database.js (sequelize instance, pool settings)
 * - Models Location: src/models/*.js (UserProfile, UserSurvival, GuildSettings, dll)
 * - Migrator: src/managers/dbMigrator.js (versioned migrations dengan tracking table)
 * - Supabase Integration: src/managers/supabaseManager.js untuk SDK client
 * - Environment Detection: NODE_ENV=production vs development untuk behavior berbeda
 * 
 * MIGRATION STRATEGY:
 * - Production: TIDAK auto-migrate saat boot. Wajib jalankan `npm run db:migrate` terpisah
 * - Development: Auto-migrate oleh primary shard (SHARD_ID=0 atau undefined)
 * - Reasoning: Mencegah multiple shards jalankan ALTER TABLE bersamaan (deadlock risk)
 * - Tracking: schema_migrations table mencatat versi yang sudah dijalankan
 * 
 * HEALTH MONITORING:
 * - Interval: 30000ms (30 detik)
 * - Method: sequelize.authenticate() dengan retry
 * - On Failure: Log alert + automatic reconnect attempt
 * - On Success: Reset isDbOnline flag + sync fallback data jika perlu
 * - Timer unref(): Mencegah event loop tetap hidup saat shutdown
 * 
 * FALLBACK BEHAVIOR:
 * - Trigger: Tidak ada DATABASE_URL atau kredensial Supabase/MySQL
 * - Action: Gunakan SQLite file ./naura_fallback.sqlite
 * - Warning: Ditampilkan di console dengan highlight kuning
 * - Sync: Data fallback dipindah ke production DB saat reconnect berhasil
 * 
 * @see {@link CacheManager} untuk caching layer di atas database
 * @see {@link RedisManager} untuk distributed caching dan pub/sub
 * @see {@link src/managers/dbMigrator.js} untuk migration system
 */

// === SECTION: DEPENDENCIES ===

const {
  sequelize,
  hasMySQLConfig,
  hasSupabaseConfig,
  hasDatabaseConfig,
  SHARD_COUNT,
  POOL_MAX,
} = require("../config/database");
const env = require("../config/env");
const supabaseManager = require("./supabaseManager");
const { logger } = require("../managers/logger");

// === SECTION: CONSTANTS & CONFIGURATION ===
// ==========================================
// KONFIGURASI RETRY DENGAN EXPONENTIAL BACKOFF
// 3 percobaan, jeda 2s, 4s, 8s antara percobaan.
// ==========================================
const DB_RETRY_MAX = 3;
const DB_BACKOFF_SEQUENCE_MS = [2000, 4000, 8000];

// === SECTION: HELPER FUNCTIONS ===
function dbSleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function dbRetryWithBackoff(fn, options = {}) {
  const max = options.max ?? DB_RETRY_MAX;
  const label = options.label ?? "operasi database";
  let lastErr;
  for (let attempt = 0; attempt < max; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      if (attempt < max - 1) {
        const delay =
          DB_BACKOFF_SEQUENCE_MS[attempt] ??
          DB_BACKOFF_SEQUENCE_MS[DB_BACKOFF_SEQUENCE_MS.length - 1];
        logger.warn(
          "[DB] " + label + " gagal (percobaan " + (attempt + 1) + "/" + max + "), retry dalam " + delay + "ms: " + err.message,
        );
        await dbSleep(delay);
      }
    }
  }
  throw lastErr;
}


// === SECTION: MODULE EXPORTS ===
// ==========================================
// EKSPOR SEQUELIZE
// ==========================================
module.exports = { sequelize, supabaseManager };

// === SECTION: MODEL REGISTRATION ===
// ==========================================
// 3. IMPORT MODEL
// ==========================================
const UserProfile = require("../models/UserProfile");
const UserSurvival = require("../models/UserSurvival");
const UserPet = require("../models/UserPet");
const UserNPC = require("../models/UserNPC");
const UserChild = require("../models/UserChild");
const UserFarm = require("../models/UserFarm");
const CanvasAsset = require("../models/CanvasAsset");
const UserCosmetic = require("../models/UserCosmetic");
const GameItem = require("../models/GameItem");

// Registrasi model Sequelize lainnya
require("../models/GuildSettings");
require("../models/ModMail");
require("../models/Giveaway");
require("../models/StickyRole");
require("../models/CryptoMarket");
require("../models/UserCrypto");
require("../models/PremiumVoucher");
require("../models/UserReminder");
require("../models/UserQuest");
require("../models/UserStrike");
require("../models/UserTicket");
require("../models/MarketAuction");
require("../models/RoleLease");
require("../models/UserLeveling");
require("../models/UserWarn");
require("../models/UserFriend");
require("../models/ClanTerritory");
require("../models/DuelRecord");
require("../models/GuildClan");
require("../models/MinecraftLink");
require("../models/SocialAlert");
require("../models/StoryProgress");
require("../models/UserAchievement");
require("../models/UserBirthday");
require("../models/UserCard");
require("../models/UserCardDeck");
require("../models/UserPlaylist");
require("../models/WorldBoss");
require("../models/ServerTreasury");

// === SECTION: MODEL ASSOCIATIONS ===
// ==========================================
// 4. SETUP RELASI (ASSOCIATIONS)
// ==========================================
function setupAssociations() {
  try {
    if (
      UserProfile &&
      UserSurvival &&
      typeof UserProfile.hasOne === "function" &&
      (!UserProfile.associations || !UserProfile.associations.survival)
    ) {
      UserProfile.hasOne(UserSurvival, {
        foreignKey: "userId",
        as: "survival",
      });
      UserSurvival.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      UserProfile &&
      UserPet &&
      typeof UserProfile.hasMany === "function" &&
      (!UserProfile.associations || !UserProfile.associations.pets)
    ) {
      UserProfile.hasMany(UserPet, { foreignKey: "userId", as: "pets" });
      UserPet.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      UserProfile &&
      UserNPC &&
      typeof UserProfile.hasMany === "function" &&
      (!UserProfile.associations || !UserProfile.associations.npc_relations)
    ) {
      UserProfile.hasMany(UserNPC, {
        foreignKey: "userId",
        as: "npc_relations",
      });
      UserNPC.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      UserProfile &&
      UserChild &&
      typeof UserProfile.hasMany === "function" &&
      (!UserProfile.associations || !UserProfile.associations.children)
    ) {
      UserProfile.hasMany(UserChild, { foreignKey: "userId", as: "children" });
      UserChild.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      UserProfile &&
      UserFarm &&
      typeof UserProfile.hasMany === "function" &&
      (!UserProfile.associations || !UserProfile.associations.farms)
    ) {
      UserProfile.hasMany(UserFarm, { foreignKey: "userId", as: "farms" });
      UserFarm.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      UserProfile &&
      UserCosmetic &&
      typeof UserProfile.hasMany === "function" &&
      (!UserProfile.associations || !UserProfile.associations.cosmetics)
    ) {
      UserProfile.hasMany(UserCosmetic, {
        foreignKey: "userId",
        as: "cosmetics",
      });
      UserCosmetic.belongsTo(UserProfile, { foreignKey: "userId" });
    }
    if (
      CanvasAsset &&
      UserCosmetic &&
      typeof CanvasAsset.hasMany === "function" &&
      (!CanvasAsset.associations || !CanvasAsset.associations.userCosmetics)
    ) {
      CanvasAsset.hasMany(UserCosmetic, {
        foreignKey: "assetId",
        as: "userCosmetics",
      });
      UserCosmetic.belongsTo(CanvasAsset, {
        foreignKey: "assetId",
        as: "asset",
      });
    }
  } catch (e) {
    logger.debug("[dbManager:setupAssociations] Galat pada rutinitas aplikasi: " + (e?.message || e));
  }
}
setupAssociations();

// === SECTION: DATABASE CONNECTION & SYNC ===
// ==========================================
// 5. FUNGSI KONEKSI DAN SINKRONISASI TABEL
// ==========================================
let isDbOnline = true;

function getDbStatus() {
  return {
    dialect: sequelize.options.dialect,
    online: isDbOnline,
    connected: isDbOnline,
    state: isDbOnline ? "ready" : "disconnected",
    ready: isDbOnline,
    poolMax: POOL_MAX,
    shardCount: SHARD_COUNT,
    sqliteFallback: Boolean(env.USE_SQLITE || !hasDatabaseConfig),
    fallbackFile: "./naura_fallback.sqlite",
  };
}

// Hanya satu proses yang boleh menjalankan ALTER TABLE. Beberapa shard yang
// bermigrasi bersamaan berisiko saling menunggu lock metadata.
const isPrimaryProcess =
  typeof env.SHARD_ID === "undefined" || env.SHARD_ID === "0";

// === SECTION: MAIN CONNECTION FUNCTION ===
const connectToDatabase = async () => {
  try {
    // Inisialisasi Supabase SDK Client jika konfigurasi tersedia
    if (hasSupabaseConfig || env.SUPABASE_URL) {
      supabaseManager.initSupabase();
    }

    await dbRetryWithBackoff(() => sequelize.authenticate(), {
      label: "koneksi database",
    });
    isDbOnline = true;
    const dbDialect = sequelize.options.dialect.toUpperCase();
    const providerName =
      hasSupabaseConfig || env.SUPABASE_URL
        ? "Supabase (PostgreSQL)"
        : dbDialect;

    // Mencegah penghapusan kolom tak disengaja di production
    if (env.NODE_ENV === "production") {
      await sequelize.sync({ alter: false }); // Biarkan migrator khusus yang merubah tabel
      logger.info(
        `Database ${providerName} terhubung (Production Safe-Sync mode).`,
      );
    } else {
      await sequelize.sync({ alter: { drop: false } });
      logger.info(
        `Database ${providerName} disinkronkan (Development mode, Drop prevented).`,
      );
    }

    // ==========================================
    // MIGRASI SKEMA (Rule 1.7)
    //
    // Di produksi, migrasi TIDAK dijalankan di sini. Migrasi yang gagal di
    // tengah boot menghasilkan bot yang menyala di atas skema separuh jalan,
    // dan setiap shard akan menjalankan ALTER TABLE yang sama bersamaan.
    // Jalankan `npm run db:migrate` sebagai langkah terpisah sebelum start.
    //
    // Di development, migrasi tetap dijalankan otomatis oleh proses utama
    // supaya alur kerja sehari-hari tidak bertambah panjang.
    // ==========================================
    const {
      runMigrations,
      getPendingMigrations,
      syncFallbackToMySQL,
    } = require("./dbMigrator");

    if (env.NODE_ENV === "production") {
      try {
        const pending = await getPendingMigrations(sequelize);
        if (pending.length > 0) {
          logger.warn(
            `[DB] ${pending.length} migrasi belum dijalankan (${pending.join(", ")}). ` +
              "Jalankan `npm run db:migrate` sebelum menyalakan bot.",
          );
        }
      } catch (pendingError) {
        logger.warn(
          "[DB] Gagal memeriksa status migrasi:",
          pendingError.message,
        );
      }
    } else if (isPrimaryProcess) {
      try {
        await runMigrations(sequelize);
      } catch (migrationError) {
        // Di development, migrasi gagal cukup dilaporkan dengan jelas.
        logger.error("[DB] Migrasi development gagal:", migrationError.message);
      }
    } else {
      logger.info(
        `[DB] Shard #${env.SHARD_ID} melewati migrasi (ditangani proses utama).`,
      );
    }

    if (!hasDatabaseConfig) {
      logger.warn(
        "\n\x1b[43m\x1b[30m ⚠️ FALLBACK DB \x1b[0m \x1b[33mMenggunakan SQLite lokal sebagai Fallback sementara karena kredensial database eksternal tidak ditemukan.\x1b[0m",
      );
    } else if (isPrimaryProcess) {
      // Pemindahan data fallback juga cukup dilakukan satu proses.
      const syncResult = await syncFallbackToMySQL(sequelize);
      if (syncResult && syncResult.ok === false) {
        // Rincian kegagalan sengaja dibiarkan terlihat. Versi lama
        // menganggap sinkronisasi selalu sukses sehingga operator tidak
        // pernah tahu ada tabel yang gagal masuk.
        logger.warn(
          `\x1b[33m[DB] Sinkronisasi fallback belum lengkap: ` +
            `${syncResult.failedTables.length} tabel gagal, ` +
            `${syncResult.moved} baris terpindah.\x1b[0m`,
        );
      }
    }

    isDbOnline = true;
    return true;
  } catch (error) {
    isDbOnline = false;
    const dbType = sequelize.options.dialect.toUpperCase();
    logger.error(
      `\n\x1b[41m\x1b[37m 💥 DATABASE ERROR \x1b[0m \x1b[31mKoneksi ${dbType} ditolak atau terputus:\x1b[0m`,
    );
    logger.error(error.message);
    logger.error(
      "\x1b[33mBot akan terus berjalan dan data akan dicache melalui sistem Fallback sementara.\x1b[0m",
    );
    return false;
  }
};

// ==========================================
// 6. SEEDING DATA AWAL (Rule 1.7, dipisah dari connectToDatabase)
// Dipanggil dari index.js setelah connectToDatabase() berhasil.
// ==========================================

/**
 * Seed data default ke database jika belum ada (pertama kali setup).
 * Dipisah dari connectToDatabase() agar mudah di-test dan tidak bercampur dengan logic koneksi.
 */
const seedInitialData = async () => {
  try {
    const backgroundCount = await CanvasAsset.count();
    if (backgroundCount === 0) {
      await CanvasAsset.bulkCreate([
        {
          name: "Abstract Blue",
          type: "background",
          url: "assets/images/canvas/abstract_blue.png",
          price: 100,
          isPremiumOnly: false,
        },
        {
          name: "Neon Cyberpunk",
          type: "background",
          url: "assets/images/canvas/neon_cyberpunk.png",
          price: 500,
          isPremiumOnly: false,
        },
        {
          name: "Gold VIP",
          type: "background",
          url: "assets/images/canvas/gold_vip.png",
          price: 0,
          isPremiumOnly: true,
        },
        {
          name: "Silver Frame",
          type: "border",
          url: "assets/images/canvas/silver_frame.png",
          price: 200,
          isPremiumOnly: false,
        },
      ]);
      logger.db("Default Canvas Assets seeded.");
    }
  } catch (e) {
    logger.error("[DB] Failed to seed Canvas Assets", e);
  }

  try {
    const itemCount = await GameItem.count();
    if (itemCount === 0) {
      const staticItems = require("../survival/data/items");
      const bulkData = staticItems.map((item) => {
        const {
          id,
          name,
          description,
          price,
          sellPrice,
          category,
          rarity,
          ...attributes
        } = item;
        return {
          id,
          name,
          description: description || "",
          price: price || 0,
          sellPrice: sellPrice || 0,
          category: category || "material",
          rarity: rarity || "Biasa",
          attributes: attributes || {},
        };
      });
      await GameItem.bulkCreate(bulkData, { ignoreDuplicates: true });
      logger.db("Default Game Items seeded.");
    }
  } catch (e) {
    logger.error("[DB] Failed to seed Game Items", e);
  }
};

module.exports.connectToDatabase = connectToDatabase;
module.exports.seedInitialData = seedInitialData;
module.exports.getDbStatus = getDbStatus;

// ==========================================
// 7. ANTI-SLEEP & AUTO-RECONNECT MECHANISM
// ==========================================
let isReconnecting = false;
// === SECTION: HEALTH CHECK TIMER ===
const healthCheckTimer = setInterval(async () => {
  try {
    await sequelize.query("SELECT 1");
    isDbOnline = true;
  } catch (err) {
    isDbOnline = false;
    if (isReconnecting) return;
    isReconnecting = true;
    const dbType = sequelize.options.dialect.toUpperCase();
    logger.error(
      `\n\x1b[41m\x1b[37m 🚨 DB ALERT \x1b[0m \x1b[31mKONEKSI ${dbType} TERPUTUS!\x1b[0m`,
    );
    logger.error(`\x1b[31mDetail Error: ${err.message}\x1b[0m`);
    logger.error(
      "\x1b[33m[DB MONITOR] Sistem mencoba melakukan reconnect di latar belakang...\x1b[0m\n",
    );

    try {
      await dbRetryWithBackoff(() => sequelize.authenticate(), {
        label: "reconnect database",
        max: DB_RETRY_MAX,
      });
      isDbOnline = true;
      logger.success(
        `\x1b[42m\x1b[30m ✨ RECONNECTED \x1b[0m \x1b[32mBerhasil terhubung kembali ke database ${dbType}.\x1b[0m`,
      );

      if (hasMySQLConfig && isPrimaryProcess) {
        const { syncFallbackToMySQL } = require("./dbMigrator");
        const syncResult = await syncFallbackToMySQL(sequelize);
        if (syncResult && syncResult.ok === false) {
          logger.warn(
            `\x1b[33m[DB] Sinkronisasi fallback setelah reconnect belum lengkap: ` +
              `${syncResult.failedTables.length} tabel gagal. ` +
              `File fallback dipertahankan untuk dicoba lagi.\x1b[0m`,
          );
        }
      }
    } catch (reconnectErr) {
      isDbOnline = false;
      logger.error(
        "\x1b[41m\x1b[37m 💥 FATAL \x1b[0m \x1b[31mGagal reconnect: " +
          reconnectErr.message +
          "\x1b[0m",
      );
    } finally {
      isReconnecting = false;
    }
  }
}, 30000);

// Tanpa unref(), interval ini menahan event loop tetap hidup. Akibatnya script
// singkat seperti `npm run db:migrate` dan test tidak pernah berakhir sendiri.
if (healthCheckTimer.unref) healthCheckTimer.unref();

module.exports.healthCheckTimer = healthCheckTimer;
