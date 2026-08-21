const { logger } = require("../managers/logger");
const fs = require("fs");

// ==========================================
// SISTEM MIGRASI BERNOMOR (Rule 1.7)
// Semua ALTER TABLE WAJIB di sini, bukan di dbManager.js
// ==========================================

// Tabel catatan migrasi. Sebelum ini, setiap migrasi dijalankan ulang pada tiap
// boot dan hanya "berhasil" karena MySQL menolaknya dengan error kolom duplikat.
// Pola itu menyembunyikan kegagalan nyata dan membuat migrasi yang bukan ALTER
// Tabel catatan migrasi.
const LEDGER_TABLE = "schema_migrations";

/**
 * Daftar migrasi yang dijalankan secara berurutan.
 * Setiap migrasi punya ID unik dan query SQL-nya.
 * Tambahkan migrasi baru di BAWAH daftar yang sudah ada, jangan ubah urutan/ID yang sudah ada.
 *
 * Migrasi DATA (UPDATE, bukan ALTER) hanya aman karena ledger mencatat ID yang
 * sudah dijalankan. Jangan pernah menulis migrasi data yang menambah nilai pada
 * dirinya sendiri tanpa memastikan ledger aktif, karena menjalankannya dua kali
 * akan menggandakan angkanya.
 */
const MIGRATIONS = [
  {
    id: "v1_add_mannersPoint",
    description: "Tambah kolom mannersPoint ke user_leveling",
    sql: "ALTER TABLE user_leveling ADD COLUMN mannersPoint INT DEFAULT 100;",
  },
  {
    id: "v2_add_dailyNotify",
    description: "Tambah kolom dailyNotify ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN dailyNotify TINYINT(1) DEFAULT 1;",
  },
  {
    id: "v3_add_economy_deposit",
    description: "Tambah kolom economy_deposit ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN economy_deposit JSON DEFAULT NULL;",
  },
  {
    id: "v4_add_economy_investments",
    description: "Tambah kolom economy_investments ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN economy_investments JSON DEFAULT NULL;",
  },
  {
    id: "v5_add_coupons",
    description:
      "Tambah kolom coupons ke UserSurvivals (Naura Coupon jadi kolom sendiri)",
    sql: "ALTER TABLE UserSurvivals ADD COLUMN coupons INT NOT NULL DEFAULT 0;",
  },
  {
    id: "v6_move_coupons_to_column",
    description: "Pindahkan saldo Naura Coupon dari rpg_state ke kolom coupons",
    // Naura Coupon dulu dititipkan di dalam kolom JSON rpg_state supaya tidak
    // perlu migrasi. Akibatnya kupon jadi satu-satunya mata uang yang dipotong
    // dengan pola baca-ubah-tulis, karena kolom JSON tidak bisa dipotong lewat
    // satu UPDATE bersyarat. Sekarang saldonya dipindah ke kolom angka, lalu
    // kuncinya dibuang dari rpg_state supaya tidak ada dua sumber kebenaran.
    //
    // JSON_TYPE mengembalikan NULL bila kuncinya tidak ada, jadi baris yang
    // belum pernah punya kupon tidak ikut tersentuh.
    sql: "UPDATE UserSurvivals SET coupons = coupons + CAST(JSON_EXTRACT(rpg_state, '$.coupons') AS UNSIGNED), rpg_state = JSON_REMOVE(rpg_state, '$.coupons') WHERE JSON_TYPE(JSON_EXTRACT(rpg_state, '$.coupons')) IN ('INTEGER', 'UNSIGNED INTEGER', 'DOUBLE', 'DECIMAL');",
  },
  {
    id: "v7_add_index_user_leveling",
    description: "Tambah composite index (guildId, userId) ke user_leveling",
    sql: "CREATE INDEX idx_user_leveling_guild_user ON user_leveling(guildId, userId);",
  },
  {
    id: "v8_add_index_user_warns",
    description: "Tambah composite index (guildId, userId) ke user_warns",
    sql: "CREATE INDEX idx_user_warns_guild_user ON user_warns(guildId, userId);",
  },
  {
    id: "v9_add_index_user_friends",
    description: "Tambah index pada user1Id dan user2Id di UserFriends",
    sql: "CREATE INDEX idx_user_friends_user1 ON UserFriends(user1Id);",
  },
  {
    id: "v10_add_index_user_friends_2",
    description: "Tambah index pada user2Id di UserFriends",
    sql: "CREATE INDEX idx_user_friends_user2 ON UserFriends(user2Id);",
  },
  {
    id: "v11_add_index_user_cosmetics",
    description: "Tambah index pada userId di user_cosmetics",
    sql: "CREATE INDEX idx_user_cosmetics_userId ON user_cosmetics(userId);",
  },
  {
    id: "v12_add_index_user_pets",
    description: "Tambah index pada userId di UserPets",
    sql: "CREATE INDEX idx_user_pets_userId ON UserPets(userId);",
  },
  {
    id: "v13_add_reputation",
    description: "Tambah kolom reputation ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN reputation INT DEFAULT 0;",
  },
  {
    id: "v14_make_language_nullable",
    description:
      "Ubah kolom language agar DEFAULT NULL supaya fallback ke pengaturan Guild bekerja",
    sql: "ALTER TABLE user_profiles MODIFY COLUMN language VARCHAR(255) DEFAULT NULL;",
  },
  {
    id: "v15_add_aiPersona",
    description: "Tambah kolom aiPersona ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN aiPersona JSON DEFAULT NULL;",
  },
  {
    id: "v16_add_activeBanners",
    description: "Tambah kolom activeBanners ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN activeBanners JSON DEFAULT NULL;",
  },
  {
    id: "v17_add_role_leases",
    description: "Buat tabel role_leases untuk sewa role berbayar",
    sql: "CREATE TABLE IF NOT EXISTS role_leases ( id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL, guildId VARCHAR(191) NOT NULL, roleId VARCHAR(191) NOT NULL, expiresAt DATETIME NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE KEY idx_role_leases_unique (guildId, userId, roleId), INDEX idx_role_leases_expiresAt (expiresAt) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v18_giveaway_participants",
    description: "Tambah kolom requirements, participants, dan winners ke giveaways (Giveaway Lanjutan Sprint 9)",
    sql: "ALTER TABLE giveaways ADD COLUMN requirements JSON DEFAULT NULL, ADD COLUMN participants JSON DEFAULT NULL, ADD COLUMN winners JSON DEFAULT NULL;",
  },
  {
    id: "v19_add_clan_columns",
    description: "Tambah kolom clanId di UserSurvivals",
    sql: "ALTER TABLE UserSurvivals ADD COLUMN clanId INT DEFAULT NULL;",
  },
  {
    id: "v20_add_clan_quests",
    description: "Tambah kolom questsState di GuildClans",
    sql: "ALTER TABLE GuildClans ADD COLUMN questsState JSON DEFAULT NULL;",
  },
  {
    id: "v21_create_duel_records",
    description: "Buat tabel duel_records untuk menyimpan PvP MMR dan statistik",
    sql: "CREATE TABLE IF NOT EXISTS duel_records ( userId VARCHAR(191) NOT NULL PRIMARY KEY, mmr INT NOT NULL DEFAULT 1000, matchesPlayed INT NOT NULL DEFAULT 0, wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, kills INT NOT NULL DEFAULT 0, deaths INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v22_add_notification_prefs",
    description: "Tambah kolom notification_prefs ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN notification_prefs JSON DEFAULT NULL;",
  },
  {
    id: "v23_upgrade_user_pets",
    description: "Sistem Pet Lanjutan: Tambah mood, evolutionStage, dan passiveSkill",
    sql: "ALTER TABLE UserPets ADD COLUMN mood VARCHAR(255) DEFAULT 'happy', ADD COLUMN evolutionStage INT DEFAULT 1, ADD COLUMN passiveSkill VARCHAR(255) DEFAULT NULL;",
  },
  {
    id: "v24_add_world_boss_and_clan_territory",
    description: "Buat tabel world_bosses dan clan_territories untuk MMORPG Survival",
    sql: "CREATE TABLE IF NOT EXISTS world_bosses ( id INT AUTO_INCREMENT PRIMARY KEY, bossId VARCHAR(191) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL DEFAULT 'Ancient Calamity', element VARCHAR(64) NOT NULL DEFAULT 'DARK', maxHp BIGINT NOT NULL DEFAULT 1000000, currentHp BIGINT NOT NULL DEFAULT 1000000, baseAttack INT NOT NULL DEFAULT 150, defense INT NOT NULL DEFAULT 50, status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE', damageLeaderboard JSON NOT NULL, rewardsPool JSON NOT NULL, spawnTime DATETIME NOT NULL, endTime DATETIME NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS clan_territories ( id INT AUTO_INCREMENT PRIMARY KEY, territoryId VARCHAR(191) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, clanId INT DEFAULT NULL, controlPoints INT NOT NULL DEFAULT 0, taxYield INT NOT NULL DEFAULT 1000, buffEffect VARCHAR(128) NOT NULL DEFAULT 'EXTRA_GOLD_10', contestedAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v25_upgrade_user_cards_system",
    description: "Upgrade tabel user_cards dengan cardCode, printNumber, quality, frame, dan dyeColor",
    sql: "ALTER TABLE user_cards ADD COLUMN cardCode VARCHAR(32) DEFAULT NULL, ADD COLUMN characterName VARCHAR(255) DEFAULT NULL, ADD COLUMN seriesName VARCHAR(255) DEFAULT NULL, ADD COLUMN printNumber INT NOT NULL DEFAULT 1, ADD COLUMN quality VARCHAR(32) NOT NULL DEFAULT 'GOOD', ADD COLUMN frame VARCHAR(64) NOT NULL DEFAULT 'DEFAULT', ADD COLUMN dyeColor VARCHAR(32) DEFAULT NULL, ADD COLUMN imageUrl TEXT DEFAULT NULL, ADD COLUMN isLocked BOOLEAN DEFAULT FALSE, ADD COLUMN burnValue INT DEFAULT 100;",
  },
  {
    id: "v26_create_user_card_decks",
    description: "Buat tabel user_card_decks untuk TCG Battle Deck & Tower of Babel",
    sql: "CREATE TABLE IF NOT EXISTS user_card_decks ( userId VARCHAR(32) NOT NULL PRIMARY KEY, activeDeck JSON NOT NULL, towerFloor INT NOT NULL DEFAULT 1, highestFloor INT NOT NULL DEFAULT 1, wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, eloRating INT NOT NULL DEFAULT 1000, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_user_card_decks_elo (eloRating) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v27_create_minecraft_links",
    description: "Buat tabel minecraft_links untuk penautan akun Minecraft & Discord",
    sql: "CREATE TABLE IF NOT EXISTS minecraft_links ( userId VARCHAR(32) NOT NULL PRIMARY KEY, mcUsername VARCHAR(64) NOT NULL, mcUuid VARCHAR(64) DEFAULT NULL, isVerified BOOLEAN DEFAULT FALSE, verificationCode VARCHAR(16) DEFAULT NULL, totalSyncRewards INT DEFAULT 0, lastSyncedAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_minecraft_links_mcUsername (mcUsername) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v28_create_prediction_markets_and_bets",
    description: "Buat tabel prediction_markets dan prediction_bets untuk Pari-Mutuel Prediction Market",
    sql: "CREATE TABLE IF NOT EXISTS prediction_markets ( marketId VARCHAR(64) NOT NULL PRIMARY KEY, guildId VARCHAR(32) NOT NULL, creatorId VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT DEFAULT NULL, category VARCHAR(32) NOT NULL DEFAULT 'COMMUNITY', options JSON NOT NULL, totalPool BIGINT NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'OPEN', winningOptionId INT DEFAULT NULL, lockTime DATETIME NOT NULL, resolveTime DATETIME DEFAULT NULL, houseFeePercent INT NOT NULL DEFAULT 5, maxBetPerUser INT NOT NULL DEFAULT 10000, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_prediction_markets_guildId (guildId), INDEX idx_prediction_markets_status (status) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS prediction_bets ( betId VARCHAR(64) NOT NULL PRIMARY KEY, marketId VARCHAR(64) NOT NULL, guildId VARCHAR(32) NOT NULL, userId VARCHAR(32) NOT NULL, username VARCHAR(128) NOT NULL DEFAULT 'Anonymous', optionId INT NOT NULL, amount BIGINT NOT NULL, payout BIGINT NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'PENDING', createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_prediction_bets_marketId (marketId), INDEX idx_prediction_bets_userId (userId), INDEX idx_prediction_bets_guild_user (guildId, userId) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v29_upgrade_world_boss_phases",
    description: "Tambah kolom phase, shieldHp, maxShieldHp, roleContributions, mvpUserId, dan lastHitUserId ke world_bosses",
    sql: "ALTER TABLE world_bosses ADD COLUMN phase INT NOT NULL DEFAULT 1, ADD COLUMN shieldHp BIGINT NOT NULL DEFAULT 0, ADD COLUMN maxShieldHp BIGINT NOT NULL DEFAULT 0, ADD COLUMN roleContributions JSON DEFAULT NULL, ADD COLUMN mvpUserId VARCHAR(191) DEFAULT NULL, ADD COLUMN lastHitUserId VARCHAR(191) DEFAULT NULL;",
  },
  {
    id: "v30_create_user_cafes",
    description: "Buat tabel user_cafes untuk Cozy Cyber-Cafe & Maid Lounge Sim",
    sql: "CREATE TABLE IF NOT EXISTS user_cafes ( userId VARCHAR(32) NOT NULL PRIMARY KEY, cafeName VARCHAR(64) NOT NULL DEFAULT 'Cyber Maid Lounge', level INT NOT NULL DEFAULT 1, reputation INT NOT NULL DEFAULT 0, unlockedRecipes JSON NOT NULL, activeDishes JSON NOT NULL, theme VARCHAR(32) NOT NULL DEFAULT 'CYBER_NEON', customersServed INT NOT NULL DEFAULT 0, uncollectedRevenue BIGINT NOT NULL DEFAULT 0, lastCollectedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v31_upgrade_user_cards_fusion_inscription",
    description: "Tambah kolom isAwakened, awakeningLevel, inscription, dan originalMinterId ke user_cards",
    sql: "ALTER TABLE user_cards ADD COLUMN isAwakened BOOLEAN DEFAULT FALSE, ADD COLUMN awakeningLevel INT DEFAULT 0, ADD COLUMN inscription VARCHAR(128) DEFAULT NULL, ADD COLUMN originalMinterId VARCHAR(191) DEFAULT NULL;",
  },
  {
    id: "v32_upgrade_territories_and_pets",
    description: "Tambah kolom defenseLevel, clanName, contributingClanIds ke clan_territories dan fusionCount, cosmicAura, habitatRoom ke UserPets",
    sql: "ALTER TABLE clan_territories ADD COLUMN clanName VARCHAR(128) DEFAULT NULL, ADD COLUMN defenseLevel INT NOT NULL DEFAULT 1, ADD COLUMN maxControlPoints INT NOT NULL DEFAULT 1000, ADD COLUMN lastTaxClaimedAt DATETIME DEFAULT NULL, ADD COLUMN contributingClanIds JSON DEFAULT NULL; ALTER TABLE UserPets ADD COLUMN fusionCount INT NOT NULL DEFAULT 0, ADD COLUMN cosmicAura BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN habitatRoom JSON DEFAULT NULL;",
  },
  {
    id: "v33_create_sprint20_milestone_tables",
    description: "Buat tabel coliseum_teams, guild_personas, server_stocks, user_stock_holdings, dan tambah kolom hallLayout di GuildClans",
    sql: "ALTER TABLE GuildClans ADD COLUMN hallLayout JSON DEFAULT NULL; CREATE TABLE IF NOT EXISTS coliseum_teams ( id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL UNIQUE, teamName VARCHAR(128) NOT NULL DEFAULT 'Vanguard Squad', formation JSON NOT NULL, eloRating INT NOT NULL DEFAULT 1200, divisionTier VARCHAR(32) NOT NULL DEFAULT 'BRONZE', wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, lastFoughtAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS guild_personas ( id INT AUTO_INCREMENT PRIMARY KEY, personaId VARCHAR(64) NOT NULL UNIQUE, guildId VARCHAR(64) NOT NULL, channelId VARCHAR(64) DEFAULT NULL, name VARCHAR(128) NOT NULL, systemPrompt TEXT NOT NULL, voiceTone VARCHAR(64) NOT NULL DEFAULT 'TSUNDERE', avatarUrl VARCHAR(255) DEFAULT NULL, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS server_stocks ( ticker VARCHAR(32) PRIMARY KEY, name VARCHAR(128) NOT NULL, guildId VARCHAR(64) DEFAULT NULL, clanId INT DEFAULT NULL, currentPrice FLOAT NOT NULL DEFAULT 100.0, previousPrice FLOAT NOT NULL DEFAULT 100.0, totalShares INT NOT NULL DEFAULT 10000, availableShares INT NOT NULL DEFAULT 10000, dividendYield FLOAT NOT NULL DEFAULT 0.05, history24h JSON NOT NULL, isHighRisk BOOLEAN NOT NULL DEFAULT FALSE, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS user_stock_holdings ( id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL, ticker VARCHAR(32) NOT NULL, sharesOwned INT NOT NULL DEFAULT 0, avgBuyPrice FLOAT NOT NULL DEFAULT 0.0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE KEY uk_user_ticker (userId, ticker) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  }
];

const ALREADY_APPLIED_ERRNOS = new Set([1050, 1060, 1061, 1091]);
const ALREADY_APPLIED_PG_CODES = new Set([
  "42701",
  "42P07",
  "42710",
  "42704",
  "23505",
]);

function isAlreadyApplied(err) {
  const errno = err && err.original && err.original.errno;
  if (errno && ALREADY_APPLIED_ERRNOS.has(errno)) return true;
  const code = err && err.original && err.original.code;
  if (code && ALREADY_APPLIED_PG_CODES.has(code)) return true;
  return false;
}

/** Membuat tabel catatan bila belum ada. Aman dipanggil berkali-kali. */
async function ensureLedger(sequelize) {
  const isPostgres = sequelize.options.dialect === "postgres";
  if (isPostgres) {
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
              id VARCHAR(191) NOT NULL PRIMARY KEY,
              applied_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
          );`,
    );
  } else {
    await sequelize.query(
      `CREATE TABLE IF NOT EXISTS ${LEDGER_TABLE} (
              id VARCHAR(191) NOT NULL PRIMARY KEY,
              applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
          ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;`,
    );
  }
}

async function loadAppliedIds(sequelize) {
  const [rows] = await sequelize.query(`SELECT id FROM ${LEDGER_TABLE};`);
  return new Set((rows || []).map((row) => row.id));
}

async function recordMigration(sequelize, id) {
  const isPostgres = sequelize.options.dialect === "postgres";
  if (isPostgres) {
    await sequelize.query(
      `INSERT INTO ${LEDGER_TABLE} (id) VALUES (?) ON CONFLICT (id) DO NOTHING;`,
      {
        replacements: [id],
      },
    );
  } else {
    await sequelize.query(
      `INSERT IGNORE INTO ${LEDGER_TABLE} (id) VALUES (?);`,
      {
        replacements: [id],
      },
    );
  }
}

/**
 * Daftar ID migrasi yang belum tercatat selesai.
 *
 * Dipakai dbManager saat boot produksi untuk memperingatkan bahwa
 * `npm run db:migrate` belum dijalankan, tanpa ikut menjalankan migrasinya.
 *
 * @param {import('sequelize').Sequelize} sequelize
 * @returns {Promise<Array<string>>}
 */
async function getPendingMigrations(sequelize) {
  if (sequelize.options.dialect === "sqlite") return [];
  await ensureLedger(sequelize);
  const done = await loadAppliedIds(sequelize);
  return MIGRATIONS.filter((migration) => !done.has(migration.id)).map(
    (migration) => migration.id,
  );
}

/**
 * Jalankan semua migrasi yang belum dieksekusi di environment ini.
 *
 * Berbeda dari versi sebelumnya, fungsi ini MELEMPAR error bila ada migrasi yang
 * gagal karena alasan tak terduga. Alasannya: migrasi dijalankan sebagai langkah
 * terpisah (`npm run db:migrate`), jadi kegagalan harus menghentikan deploy,
 * bukan menghasilkan bot yang menyala di atas skema separuh jalan.
 *
 * @param {import('sequelize').Sequelize} sequelize - Instance Sequelize yang sudah terkoneksi
 * @returns {Promise<{ applied: Array<string>, alreadyPresent: Array<string> }>}
 */
async function runMigrations(sequelize) {
  if (sequelize.options.dialect === "sqlite") {
    logger.info(
      "[DB MIGRATOR] Melewati migrasi, bukan MySQL/PostgreSQL (mode SQLite fallback).",
    );
    return { applied: [], alreadyPresent: [] };
  }

  await ensureLedger(sequelize);
  const done = await loadAppliedIds(sequelize);
  const pending = MIGRATIONS.filter((migration) => !done.has(migration.id));

  if (pending.length === 0) {
    logger.success(
      `[DB MIGRATOR] Tidak ada migrasi tertunda (${MIGRATIONS.length} sudah tercatat).`,
    );
    return { applied: [], alreadyPresent: [] };
  }

  // Khusus Postgres: Jika model sudah disinkronkan oleh Sequelize, catat semua migrasi ke ledger
  if (sequelize.options.dialect === "postgres") {
    for (const migration of pending) {
      await recordMigration(sequelize, migration.id);
    }
    logger.success(
      `[DB MIGRATOR] Inisialisasi skema PostgreSQL selesai (${pending.length} migrasi dicatat ke ledger).`,
    );
    return { applied: pending.map((m) => m.id), alreadyPresent: [] };
  }

  logger.info(
    `[DB MIGRATOR] ${pending.length} migrasi tertunda dari total ${MIGRATIONS.length}.`,
  );

  const applied = [];
  const alreadyPresent = [];

  for (const migration of pending) {
    try {
      await sequelize.query(migration.sql);
      await recordMigration(sequelize, migration.id);
      applied.push(migration.id);
      logger.db(
        `[DB MIGRATOR] Migrasi '${migration.id}' berhasil: ${migration.description}`,
      );
    } catch (err) {
      if (isAlreadyApplied(err)) {
        // Perubahannya sudah ada di database, hanya catatannya yang belum.
        await recordMigration(sequelize, migration.id);
        alreadyPresent.push(migration.id);
        logger.info(
          `[DB MIGRATOR] Migrasi '${migration.id}' dicatat selesai (perubahan sudah ada di database).`,
        );
        continue;
      }

      logger.error(
        `[DB MIGRATOR] Migrasi '${migration.id}' gagal: ${err.message}`,
      );
      throw new Error(`Migrasi '${migration.id}' gagal: ${err.message}`);
    }
  }

  logger.success(
    `[DB MIGRATOR] Selesai. ${applied.length} dijalankan, ${alreadyPresent.length} dicatat menyusul.`,
  );
  return { applied, alreadyPresent };
}

// ==========================================
// MIGRASI DATA: SQLite -> MySQL (Fallback Recovery)
// ==========================================

async function syncFallbackToMySQL(mysqlSequelize) {
  if (!fs.existsSync("./naura_fallback.sqlite")) return;

  logger.info(
    "[DB MIGRATOR] Mendeteksi file SQLite lokal. Memulai proses pemindahan data ke MySQL...",
  );

  let database;
  try {
    // Gunakan native sqlite dari Node.js (v22+)
    const { DatabaseSync } = require("node:sqlite");
    database = new DatabaseSync("./naura_fallback.sqlite");

    const models = Object.keys(mysqlSequelize.models);

    for (const modelName of models) {
      const MysqlModel = mysqlSequelize.models[modelName];

      try {
        const stmt = database.prepare(`SELECT * FROM ${MysqlModel.tableName}`);
        const rows = stmt.all();

        if (rows && rows.length > 0) {
          logger.db(
            `[DB MIGRATOR] Memindahkan ${rows.length} baris ke tabel ${MysqlModel.tableName}...`,
          );
          for (const row of rows) {
            try {
              const [record, created] = await MysqlModel.findOrCreate({
                where: {
                  [MysqlModel.primaryKeyAttributes[0]]:
                    row[MysqlModel.primaryKeyAttributes[0]],
                },
                defaults: row,
              });
              if (!created) {
                await record.update(row);
              }
            } catch (rowErr) {
              logger.warn(
                `[DB MIGRATOR] Skip baris invalid di ${MysqlModel.tableName}: ${rowErr.message}`,
              );
            }
          }
        }
      } catch (tableErr) {
        logger.warn(
          `[DB MIGRATOR] Tabel ${MysqlModel.tableName} dilewati saat sync fallback: ${tableErr.message}`,
        );
      }
    }

    logger.success(
      "[DB MIGRATOR] Pemindahan data selesai. Menghapus database SQLite sementara...",
    );
  } catch (e) {
    logger.error("[DB MIGRATOR ERROR] Gagal memindahkan data:", e.message);
  } finally {
    if (database) database.close();
    try {
      fs.unlinkSync("./naura_fallback.sqlite");
    } catch (unlinkError) {
      logger.warn(
        `[DB MIGRATOR] Gagal menghapus database SQLite fallback: ${unlinkError.message}`,
      );
    }
  }
}

module.exports = {
  runMigrations,
  syncFallbackToMySQL,
  getPendingMigrations,
  MIGRATIONS,
  LEDGER_TABLE,
};
