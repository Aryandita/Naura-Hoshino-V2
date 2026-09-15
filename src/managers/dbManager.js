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

// ==========================================
// EKSPOR SEQUELIZE
// ==========================================
module.exports = { sequelize, supabaseManager };

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
    // Safe fallback jika dipanggil saat circular dependency belum selesai
  }
}
setupAssociations();

// ==========================================
// 5. FUNGSI KONEKSI DAN SINKRONISASI TABEL
// ==========================================
let isDbOnline = true;

function getDbStatus() {
  return {
    dialect: sequelize.options.dialect,
    online: isDbOnline,
    poolMax: POOL_MAX,
    shardCount: SHARD_COUNT,
  };
}

// Hanya satu proses yang boleh menjalankan ALTER TABLE. Beberapa shard yang
// bermigrasi bersamaan berisiko saling menunggu lock metadata.
const isPrimaryProcess =
  typeof env.SHARD_ID === "undefined" || env.SHARD_ID === "0";

const connectToDatabase = async () => {
  try {
    // Inisialisasi Supabase SDK Client jika konfigurasi tersedia
    if (hasSupabaseConfig || env.SUPABASE_URL) {
      supabaseManager.initSupabase();
    }

    await sequelize.authenticate();
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
      await syncFallbackToMySQL(sequelize);
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
      await sequelize.authenticate();
      isDbOnline = true;
      logger.success(
        `\x1b[42m\x1b[30m ✨ RECONNECTED \x1b[0m \x1b[32mBerhasil terhubung kembali ke database ${dbType}.\x1b[0m`,
      );

      if (hasMySQLConfig && isPrimaryProcess) {
        const { syncFallbackToMySQL } = require("./dbMigrator");
        await syncFallbackToMySQL(sequelize);
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
}, 60000 * 15);

// Tanpa unref(), interval ini menahan event loop tetap hidup. Akibatnya script
// singkat seperti `npm run db:migrate` dan test tidak pernah berakhir sendiri.
if (healthCheckTimer.unref) healthCheckTimer.unref();

module.exports.healthCheckTimer = healthCheckTimer;
