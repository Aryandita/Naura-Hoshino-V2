const { logger } = require("../managers/logger");
const fs = require("fs");
const { SystemError } = require("../errors/DomainError");

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
    description:
      "Tambah kolom requirements, participants, dan winners ke giveaways (Giveaway Lanjutan Sprint 9)",
    sql: "ALTER TABLE giveaways ADD COLUMN requirements JSON DEFAULT NULL, ADD COLUMN participants JSON DEFAULT NULL, ADD COLUMN winners JSON DEFAULT NULL;",
  },
  {
    id: "v19_add_clan_columns",
    description: "Tambah kolom clanId di UserSurvivals",
    sql: "ALTER TABLE UserSurvivals ADD COLUMN clanId INT DEFAULT NULL;",
    down: "ALTER TABLE UserSurvivals DROP COLUMN clanId;",
  },
  {
    id: "v20_add_clan_quests",
    description: "Tambah kolom questsState di GuildClans",
    sql: "ALTER TABLE GuildClans ADD COLUMN questsState JSON DEFAULT NULL;",
  },
  {
    id: "v21_create_duel_records",
    description:
      "Buat tabel duel_records untuk menyimpan PvP MMR dan statistik",
    sql: "CREATE TABLE IF NOT EXISTS duel_records ( userId VARCHAR(191) NOT NULL PRIMARY KEY, mmr INT NOT NULL DEFAULT 1000, matchesPlayed INT NOT NULL DEFAULT 0, wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, kills INT NOT NULL DEFAULT 0, deaths INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v22_add_notification_prefs",
    description: "Tambah kolom notification_prefs ke user_profiles",
    sql: "ALTER TABLE user_profiles ADD COLUMN notification_prefs JSON DEFAULT NULL;",
  },
  {
    id: "v23_upgrade_user_pets",
    description:
      "Sistem Pet Lanjutan: Tambah mood, evolutionStage, dan passiveSkill",
    sql: "ALTER TABLE UserPets ADD COLUMN mood VARCHAR(255) DEFAULT 'happy', ADD COLUMN evolutionStage INT DEFAULT 1, ADD COLUMN passiveSkill VARCHAR(255) DEFAULT NULL;",
  },
  {
    id: "v24_add_world_boss_and_clan_territory",
    description:
      "Buat tabel world_bosses dan clan_territories untuk MMORPG Survival",
    sql: "CREATE TABLE IF NOT EXISTS world_bosses ( id INT AUTO_INCREMENT PRIMARY KEY, bossId VARCHAR(191) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, title VARCHAR(255) NOT NULL DEFAULT 'Ancient Calamity', element VARCHAR(64) NOT NULL DEFAULT 'DARK', maxHp BIGINT NOT NULL DEFAULT 1000000, currentHp BIGINT NOT NULL DEFAULT 1000000, baseAttack INT NOT NULL DEFAULT 150, defense INT NOT NULL DEFAULT 50, status VARCHAR(64) NOT NULL DEFAULT 'ACTIVE', damageLeaderboard JSON NOT NULL, rewardsPool JSON NOT NULL, spawnTime DATETIME NOT NULL, endTime DATETIME NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS clan_territories ( id INT AUTO_INCREMENT PRIMARY KEY, territoryId VARCHAR(191) NOT NULL UNIQUE, name VARCHAR(255) NOT NULL, clanId INT DEFAULT NULL, controlPoints INT NOT NULL DEFAULT 0, taxYield INT NOT NULL DEFAULT 1000, buffEffect VARCHAR(128) NOT NULL DEFAULT 'EXTRA_GOLD_10', contestedAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v25_upgrade_user_cards_system",
    description:
      "Upgrade tabel user_cards dengan cardCode, printNumber, quality, frame, dan dyeColor",
    sql: "ALTER TABLE user_cards ADD COLUMN cardCode VARCHAR(32) DEFAULT NULL, ADD COLUMN characterName VARCHAR(255) DEFAULT NULL, ADD COLUMN seriesName VARCHAR(255) DEFAULT NULL, ADD COLUMN printNumber INT NOT NULL DEFAULT 1, ADD COLUMN quality VARCHAR(32) NOT NULL DEFAULT 'GOOD', ADD COLUMN frame VARCHAR(64) NOT NULL DEFAULT 'DEFAULT', ADD COLUMN dyeColor VARCHAR(32) DEFAULT NULL, ADD COLUMN imageUrl TEXT DEFAULT NULL, ADD COLUMN isLocked BOOLEAN DEFAULT FALSE, ADD COLUMN burnValue INT DEFAULT 100;",
  },
  {
    id: "v26_create_user_card_decks",
    description:
      "Buat tabel user_card_decks untuk TCG Battle Deck & Tower of Babel",
    sql: "CREATE TABLE IF NOT EXISTS user_card_decks ( userId VARCHAR(32) NOT NULL PRIMARY KEY, activeDeck JSON NOT NULL, towerFloor INT NOT NULL DEFAULT 1, highestFloor INT NOT NULL DEFAULT 1, wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, eloRating INT NOT NULL DEFAULT 1000, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_user_card_decks_elo (eloRating) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v27_create_minecraft_links",
    description:
      "Buat tabel minecraft_links untuk penautan akun Minecraft & Discord",
    sql: "CREATE TABLE IF NOT EXISTS minecraft_links ( userId VARCHAR(32) NOT NULL PRIMARY KEY, mcUsername VARCHAR(64) NOT NULL, mcUuid VARCHAR(64) DEFAULT NULL, isVerified BOOLEAN DEFAULT FALSE, verificationCode VARCHAR(16) DEFAULT NULL, totalSyncRewards INT DEFAULT 0, lastSyncedAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_minecraft_links_mcUsername (mcUsername) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v28_create_prediction_markets_and_bets",
    description:
      "Buat tabel prediction_markets dan prediction_bets untuk Pari-Mutuel Prediction Market",
    sql: "CREATE TABLE IF NOT EXISTS prediction_markets ( marketId VARCHAR(64) NOT NULL PRIMARY KEY, guildId VARCHAR(32) NOT NULL, creatorId VARCHAR(32) NOT NULL, title VARCHAR(255) NOT NULL, description TEXT DEFAULT NULL, category VARCHAR(32) NOT NULL DEFAULT 'COMMUNITY', options JSON NOT NULL, totalPool BIGINT NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'OPEN', winningOptionId INT DEFAULT NULL, lockTime DATETIME NOT NULL, resolveTime DATETIME DEFAULT NULL, houseFeePercent INT NOT NULL DEFAULT 5, maxBetPerUser INT NOT NULL DEFAULT 10000, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_prediction_markets_guildId (guildId), INDEX idx_prediction_markets_status (status) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS prediction_bets ( betId VARCHAR(64) NOT NULL PRIMARY KEY, marketId VARCHAR(64) NOT NULL, guildId VARCHAR(32) NOT NULL, userId VARCHAR(32) NOT NULL, username VARCHAR(128) NOT NULL DEFAULT 'Anonymous', optionId INT NOT NULL, amount BIGINT NOT NULL, payout BIGINT NOT NULL DEFAULT 0, status VARCHAR(32) NOT NULL DEFAULT 'PENDING', createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_prediction_bets_marketId (marketId), INDEX idx_prediction_bets_userId (userId), INDEX idx_prediction_bets_guild_user (guildId, userId) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v29_upgrade_world_boss_phases",
    description:
      "Tambah kolom phase, shieldHp, maxShieldHp, roleContributions, mvpUserId, dan lastHitUserId ke world_bosses",
    sql: "ALTER TABLE world_bosses ADD COLUMN phase INT NOT NULL DEFAULT 1, ADD COLUMN shieldHp BIGINT NOT NULL DEFAULT 0, ADD COLUMN maxShieldHp BIGINT NOT NULL DEFAULT 0, ADD COLUMN roleContributions JSON DEFAULT NULL, ADD COLUMN mvpUserId VARCHAR(191) DEFAULT NULL, ADD COLUMN lastHitUserId VARCHAR(191) DEFAULT NULL;",
  },
  {
    id: "v30_create_user_cafes",
    description:
      "Buat tabel user_cafes untuk Cozy Cyber-Cafe & Maid Lounge Sim",
    sql: "CREATE TABLE IF NOT EXISTS user_cafes ( userId VARCHAR(32) NOT NULL PRIMARY KEY, cafeName VARCHAR(64) NOT NULL DEFAULT 'Cyber Maid Lounge', level INT NOT NULL DEFAULT 1, reputation INT NOT NULL DEFAULT 0, unlockedRecipes JSON NOT NULL, activeDishes JSON NOT NULL, theme VARCHAR(32) NOT NULL DEFAULT 'CYBER_NEON', customersServed INT NOT NULL DEFAULT 0, uncollectedRevenue BIGINT NOT NULL DEFAULT 0, lastCollectedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v31_upgrade_user_cards_fusion_inscription",
    description:
      "Tambah kolom isAwakened, awakeningLevel, inscription, dan originalMinterId ke user_cards",
    sql: "ALTER TABLE user_cards ADD COLUMN isAwakened BOOLEAN DEFAULT FALSE, ADD COLUMN awakeningLevel INT DEFAULT 0, ADD COLUMN inscription VARCHAR(128) DEFAULT NULL, ADD COLUMN originalMinterId VARCHAR(191) DEFAULT NULL;",
  },
  {
    id: "v32_upgrade_territories_and_pets",
    description:
      "Tambah kolom defenseLevel, clanName, contributingClanIds ke clan_territories dan fusionCount, cosmicAura, habitatRoom ke UserPets",
    sql: "ALTER TABLE clan_territories ADD COLUMN clanName VARCHAR(128) DEFAULT NULL, ADD COLUMN defenseLevel INT NOT NULL DEFAULT 1, ADD COLUMN maxControlPoints INT NOT NULL DEFAULT 1000, ADD COLUMN lastTaxClaimedAt DATETIME DEFAULT NULL, ADD COLUMN contributingClanIds JSON DEFAULT NULL; ALTER TABLE UserPets ADD COLUMN fusionCount INT NOT NULL DEFAULT 0, ADD COLUMN cosmicAura BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN habitatRoom JSON DEFAULT NULL;",
  },
  {
    id: "v33_create_sprint20_milestone_tables",
    description:
      "Buat tabel coliseum_teams, guild_personas, server_stocks, user_stock_holdings, dan tambah kolom hallLayout di GuildClans",
    sql: "ALTER TABLE GuildClans ADD COLUMN hallLayout JSON DEFAULT NULL; CREATE TABLE IF NOT EXISTS coliseum_teams ( id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL UNIQUE, teamName VARCHAR(128) NOT NULL DEFAULT 'Vanguard Squad', formation JSON NOT NULL, eloRating INT NOT NULL DEFAULT 1200, divisionTier VARCHAR(32) NOT NULL DEFAULT 'BRONZE', wins INT NOT NULL DEFAULT 0, losses INT NOT NULL DEFAULT 0, lastFoughtAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS guild_personas ( id INT AUTO_INCREMENT PRIMARY KEY, personaId VARCHAR(64) NOT NULL UNIQUE, guildId VARCHAR(64) NOT NULL, channelId VARCHAR(64) DEFAULT NULL, name VARCHAR(128) NOT NULL, systemPrompt TEXT NOT NULL, voiceTone VARCHAR(64) NOT NULL DEFAULT 'TSUNDERE', avatarUrl VARCHAR(255) DEFAULT NULL, isActive BOOLEAN NOT NULL DEFAULT TRUE, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS server_stocks ( ticker VARCHAR(32) PRIMARY KEY, name VARCHAR(128) NOT NULL, guildId VARCHAR(64) DEFAULT NULL, clanId INT DEFAULT NULL, currentPrice FLOAT NOT NULL DEFAULT 100.0, previousPrice FLOAT NOT NULL DEFAULT 100.0, totalShares INT NOT NULL DEFAULT 10000, availableShares INT NOT NULL DEFAULT 10000, dividendYield FLOAT NOT NULL DEFAULT 0.05, history24h JSON NOT NULL, isHighRisk BOOLEAN NOT NULL DEFAULT FALSE, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS user_stock_holdings ( id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL, ticker VARCHAR(32) NOT NULL, sharesOwned INT NOT NULL DEFAULT 0, avgBuyPrice FLOAT NOT NULL DEFAULT 0.0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE KEY uk_user_ticker (userId, ticker) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
  },
  {
    id: "v34_add_voiceMinutes_to_user_leveling",
    description:
      "Tambah kolom voiceMinutes ke user_leveling untuk tracking Voice XP dan aktivitas voice",
    sql: "ALTER TABLE user_leveling ADD COLUMN voiceMinutes INT DEFAULT 0;",
    pgSql:
      'ALTER TABLE "user_leveling" ADD COLUMN IF NOT EXISTS "voiceMinutes" INTEGER DEFAULT 0;',
  },
  {
    id: "v35_create_user_portfolios",
    description:
      "Buat tabel user_portfolios untuk sistem Member Portfolio publik (Sprint 21)",
    sql: "CREATE TABLE IF NOT EXISTS user_portfolios (userId VARCHAR(191) NOT NULL PRIMARY KEY, isPublic TINYINT(1) NOT NULL DEFAULT 0, bio TEXT DEFAULT NULL, tagline VARCHAR(80) DEFAULT NULL, theme VARCHAR(20) NOT NULL DEFAULT 'default', accentColor VARCHAR(7) DEFAULT NULL, bgType VARCHAR(20) NOT NULL DEFAULT 'particles', bgValue VARCHAR(500) DEFAULT NULL, showcaseSections JSON DEFAULT NULL, pinnedCardId VARCHAR(191) DEFAULT NULL, socialLinks JSON DEFAULT NULL, customBadge VARCHAR(20) DEFAULT NULL, viewCount INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "user_portfolios" ("userId" VARCHAR(191) NOT NULL PRIMARY KEY, "isPublic" SMALLINT NOT NULL DEFAULT 0, "bio" TEXT DEFAULT NULL, "tagline" VARCHAR(80) DEFAULT NULL, "theme" VARCHAR(20) NOT NULL DEFAULT \'default\', "accentColor" VARCHAR(7) DEFAULT NULL, "bgType" VARCHAR(20) NOT NULL DEFAULT \'particles\', "bgValue" VARCHAR(500) DEFAULT NULL, "showcaseSections" JSON DEFAULT NULL, "pinnedCardId" VARCHAR(191) DEFAULT NULL, "socialLinks" JSON DEFAULT NULL, "customBadge" VARCHAR(20) DEFAULT NULL, "viewCount" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL);',
  },
  {
    id: "v36_create_season_passes",
    description:
      "Buat tabel season_progress untuk sistem Musim & Battle Pass 30-Hari",
    sql: "CREATE TABLE IF NOT EXISTS season_progress (id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL, seasonId INT NOT NULL DEFAULT 1, xp INT NOT NULL DEFAULT 0, level INT NOT NULL DEFAULT 1, isPremiumPass TINYINT(1) NOT NULL DEFAULT 0, claimedTiersFree JSON DEFAULT NULL, claimedTiersPremium JSON DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE KEY uk_user_season (userId, seasonId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "season_progress" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL, "seasonId" INTEGER NOT NULL DEFAULT 1, "xp" INTEGER NOT NULL DEFAULT 0, "level" INTEGER NOT NULL DEFAULT 1, "isPremiumPass" SMALLINT NOT NULL DEFAULT 0, "claimedTiersFree" JSON DEFAULT NULL, "claimedTiersPremium" JSON DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "uk_user_season" UNIQUE ("userId", "seasonId"));',
  },
  {
    id: "v37_create_user_greenhouses",
    description:
      "Buat tabel user_greenhouses untuk sistem Cyber-Agronomy & Hidroponik",
    sql: "CREATE TABLE IF NOT EXISTS user_greenhouses (id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL UNIQUE, gridLevel INT NOT NULL DEFAULT 1, slots JSON NOT NULL, totalHarvests INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_user_greenhouses_user (userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "user_greenhouses" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL UNIQUE, "gridLevel" INTEGER NOT NULL DEFAULT 1, "slots" JSON NOT NULL, "totalHarvests" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_user_greenhouses_user" ON "user_greenhouses" ("userId");',
  },
  {
    id: "v38_create_cross_server_caravans",
    description:
      "Buat tabel trade_caravans dan caravan_escorts untuk Karavan Dagang Lintas Server & PvP Ambush",
    sql: "CREATE TABLE IF NOT EXISTS trade_caravans (caravanId VARCHAR(64) NOT NULL PRIMARY KEY, guildId VARCHAR(64) NOT NULL, ownerClanId INT DEFAULT NULL, creatorUserId VARCHAR(191) NOT NULL, routeId VARCHAR(32) NOT NULL, cargo JSON NOT NULL, status VARCHAR(32) NOT NULL DEFAULT 'EN_ROUTE', departureTime DATETIME NOT NULL, estimatedArrival DATETIME NOT NULL, totalInvestment BIGINT NOT NULL DEFAULT 0, potentialYield BIGINT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_trade_caravans_guild (guildId), INDEX idx_trade_caravans_status (status)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; CREATE TABLE IF NOT EXISTS caravan_escorts (id INT AUTO_INCREMENT PRIMARY KEY, caravanId VARCHAR(64) NOT NULL, userId VARCHAR(191) NOT NULL, combatPower INT NOT NULL DEFAULT 100, profitSharePercent INT NOT NULL DEFAULT 10, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, UNIQUE KEY uk_caravan_user (caravanId, userId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "trade_caravans" ("caravanId" VARCHAR(64) NOT NULL PRIMARY KEY, "guildId" VARCHAR(64) NOT NULL, "ownerClanId" INTEGER DEFAULT NULL, "creatorUserId" VARCHAR(191) NOT NULL, "routeId" VARCHAR(32) NOT NULL, "cargo" JSON NOT NULL, "status" VARCHAR(32) NOT NULL DEFAULT \'EN_ROUTE\', "departureTime" TIMESTAMPTZ NOT NULL, "estimatedArrival" TIMESTAMPTZ NOT NULL, "totalInvestment" BIGINT NOT NULL DEFAULT 0, "potentialYield" BIGINT NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_trade_caravans_guild" ON "trade_caravans" ("guildId"); CREATE INDEX IF NOT EXISTS "idx_trade_caravans_status" ON "trade_caravans" ("status"); CREATE TABLE IF NOT EXISTS "caravan_escorts" ("id" SERIAL PRIMARY KEY, "caravanId" VARCHAR(64) NOT NULL, "userId" VARCHAR(191) NOT NULL, "combatPower" INTEGER NOT NULL DEFAULT 100, "profitSharePercent" INTEGER NOT NULL DEFAULT 10, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "uk_caravan_user" UNIQUE ("caravanId", "userId"));',
  },
  {
    id: "v39_create_community_dungeons",
    description:
      "Buat tabel community_dungeons untuk Custom Community Dungeon Maker & Creator Royalty",
    sql: "CREATE TABLE IF NOT EXISTS community_dungeons (dungeonId VARCHAR(64) NOT NULL PRIMARY KEY, creatorUserId VARCHAR(191) NOT NULL, guildId VARCHAR(64) NOT NULL, dungeonName VARCHAR(128) NOT NULL, theme VARCHAR(32) NOT NULL DEFAULT 'CYBER_VOID', roomsConfig JSON NOT NULL, entryFee BIGINT NOT NULL DEFAULT 100, vaultBalance BIGINT NOT NULL DEFAULT 0, ratingAverage FLOAT NOT NULL DEFAULT 5.0, totalPlays INT NOT NULL DEFAULT 0, totalClears INT NOT NULL DEFAULT 0, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_comm_dungeons_creator (creatorUserId), INDEX idx_comm_dungeons_guild (guildId)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "community_dungeons" ("dungeonId" VARCHAR(64) NOT NULL PRIMARY KEY, "creatorUserId" VARCHAR(191) NOT NULL, "guildId" VARCHAR(64) NOT NULL, "dungeonName" VARCHAR(128) NOT NULL, "theme" VARCHAR(32) NOT NULL DEFAULT \'CYBER_VOID\', "roomsConfig" JSON NOT NULL, "entryFee" BIGINT NOT NULL DEFAULT 100, "vaultBalance" BIGINT NOT NULL DEFAULT 0, "ratingAverage" DOUBLE PRECISION NOT NULL DEFAULT 5.0, "totalPlays" INTEGER NOT NULL DEFAULT 0, "totalClears" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_comm_dungeons_creator" ON "community_dungeons" ("creatorUserId"); CREATE INDEX IF NOT EXISTS "idx_comm_dungeons_guild" ON "community_dungeons" ("guildId");',
  },
  {
    id: "v40_create_semantic_memories_table",
    description:
      "Buat tabel semantic_memories untuk Living AI Semantic Vector Memory & Server RAG",
    sql: "CREATE TABLE IF NOT EXISTS semantic_memories (id INT AUTO_INCREMENT PRIMARY KEY, userId VARCHAR(191) NOT NULL, guildId VARCHAR(64) DEFAULT NULL, memoryType VARCHAR(32) NOT NULL DEFAULT 'USER_FACT', content TEXT NOT NULL, embedding TEXT DEFAULT NULL, metadata JSON DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX idx_semantic_memories_user (userId), INDEX idx_semantic_memories_guild (guildId), INDEX idx_semantic_memories_type (memoryType)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "semantic_memories" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL, "guildId" VARCHAR(64) DEFAULT NULL, "memoryType" VARCHAR(32) NOT NULL DEFAULT \'USER_FACT\', "content" TEXT NOT NULL, "embedding" TEXT DEFAULT NULL, "metadata" JSONB DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_semantic_memories_user" ON "semantic_memories" ("userId"); CREATE INDEX IF NOT EXISTS "idx_semantic_memories_guild" ON "semantic_memories" ("guildId"); CREATE INDEX IF NOT EXISTS "idx_semantic_memories_type" ON "semantic_memories" ("memoryType");',
  },
  {
    id: "v41_create_server_treasuries_and_currency_v2",
    description:
      "Buat tabel server_treasuries dan tambah kolom lotteryTickets, lastNoviceAidClaimAt di UserSurvivals serta infrastructurePoints di clan_territories",
    sql: "CREATE TABLE IF NOT EXISTS server_treasuries (id INT AUTO_INCREMENT PRIMARY KEY, lotteryJackpot BIGINT NOT NULL DEFAULT 0, noviceAidPool BIGINT NOT NULL DEFAULT 0, wanderingMerchantPool BIGINT NOT NULL DEFAULT 0, lastLotteryDrawAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4; ALTER TABLE UserSurvivals ADD COLUMN lotteryTickets INT NOT NULL DEFAULT 0, ADD COLUMN lastNoviceAidClaimAt DATETIME DEFAULT NULL; ALTER TABLE clan_territories ADD COLUMN infrastructurePoints INT NOT NULL DEFAULT 0;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "server_treasuries" ("id" SERIAL PRIMARY KEY, "lotteryJackpot" BIGINT NOT NULL DEFAULT 0, "noviceAidPool" BIGINT NOT NULL DEFAULT 0, "wanderingMerchantPool" BIGINT NOT NULL DEFAULT 0, "lastLotteryDrawAt" TIMESTAMPTZ DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "lotteryTickets" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "lastNoviceAidClaimAt" TIMESTAMPTZ DEFAULT NULL; ALTER TABLE "clan_territories" ADD COLUMN IF NOT EXISTS "infrastructurePoints" INTEGER NOT NULL DEFAULT 0;',
  },
  {
    id: "v42_create_lottery_winners_ledger",
    description:
      "Buat tabel lottery_winners untuk mencatat riwayat pemenang undian mingguan Astral Lottery",
    sql: "CREATE TABLE IF NOT EXISTS lottery_winners (id INT AUTO_INCREMENT PRIMARY KEY, winnerUserId VARCHAR(191) NOT NULL, prizeAmount BIGINT NOT NULL DEFAULT 0, ticketsHeld INT NOT NULL DEFAULT 1, drawnAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "lottery_winners" ("id" SERIAL PRIMARY KEY, "winnerUserId" VARCHAR(191) NOT NULL, "prizeAmount" BIGINT NOT NULL DEFAULT 0, "ticketsHeld" INTEGER NOT NULL DEFAULT 1, "drawnAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_lottery_winners_user" ON "lottery_winners" ("winnerUserId"); CREATE INDEX IF NOT EXISTS "idx_lottery_winners_drawn" ON "lottery_winners" ("drawnAt");',
  },
  {
    id: "v43_add_buyout_to_market_auctions",
    description:
      "Tambah kolom buyoutPrice ke market_auctions untuk fitur beli instan",
    sql: "ALTER TABLE market_auctions ADD COLUMN buyoutPrice INT DEFAULT NULL;",
    pgSql:
      'ALTER TABLE "market_auctions" ADD COLUMN IF NOT EXISTS "buyoutPrice" INTEGER DEFAULT NULL;',
  },
  {
    id: "v44_add_paranoid_deleted_at_to_critical_tables",
    description:
      "Tambah kolom deletedAt untuk Sequelize paranoid soft-delete architecture pada tabel-tabel krusial",
    sql: "ALTER TABLE user_profiles ADD COLUMN deletedAt DATETIME DEFAULT NULL; ALTER TABLE guild_settings ADD COLUMN deletedAt DATETIME DEFAULT NULL; ALTER TABLE UserSurvivals ADD COLUMN deletedAt DATETIME DEFAULT NULL; ALTER TABLE trade_caravans ADD COLUMN deletedAt DATETIME DEFAULT NULL; ALTER TABLE market_auctions ADD COLUMN deletedAt DATETIME DEFAULT NULL;",
    pgSql:
      'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL; ALTER TABLE "guild_settings" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL; ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL; ALTER TABLE "trade_caravans" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL; ALTER TABLE "market_auctions" ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMPTZ DEFAULT NULL;',
  },
  {
    id: "v45_repair_corrupt_vitals_dead_end",
    description:
      "Perbaiki dan pulihkan data vitals (HP, hunger, thirst, stamina) pemain yang korup atau bernilai 0 ke kondisi aman",
    sql: "UPDATE UserSurvivals SET hp = 100 WHERE hp IS NULL OR hp <= 0; UPDATE UserSurvivals SET hunger = 100 WHERE hunger IS NULL OR hunger <= 0; UPDATE UserSurvivals SET thirst = 100 WHERE thirst IS NULL OR thirst <= 0; UPDATE UserSurvivals SET stamina = 100 WHERE stamina IS NULL OR stamina <= 0;",
    pgSql:
      'UPDATE "UserSurvivals" SET "hp" = 100 WHERE "hp" IS NULL OR "hp" <= 0; UPDATE "UserSurvivals" SET "hunger" = 100 WHERE "hunger" IS NULL OR "hunger" <= 0; UPDATE "UserSurvivals" SET "thirst" = 100 WHERE "thirst" IS NULL OR "thirst" <= 0; UPDATE "UserSurvivals" SET "stamina" = 100 WHERE "stamina" IS NULL OR "stamina" <= 0;',
  },
  {
    id: "v46_add_premium_tier_to_user_profiles",
    description:
      "Tambah kolom premium_tier ke user_profiles untuk multi-rail VIP tiers",
    sql: "ALTER TABLE user_profiles ADD COLUMN premium_tier VARCHAR(32) DEFAULT 'none';",
    pgSql:
      'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "premium_tier" VARCHAR(32) DEFAULT \'none\';',
  },
  {
    id: "v47_rename_currencies_to_slice_of_life",
    description:
      "Perbarui nama kolom mata uang ke era Slice of Life: sukamajuCoins, scholarshipVouchers, dan pratamaDollars",
    sql: "ALTER TABLE UserSurvivals ADD COLUMN sukamajuCoins INT DEFAULT 500; ALTER TABLE UserSurvivals ADD COLUMN scholarshipVouchers INT DEFAULT 0; ALTER TABLE user_profiles ADD COLUMN pratamaDollars INT DEFAULT 0;",
    pgSql:
      'ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "sukamajuCoins" INTEGER DEFAULT 500; ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "scholarshipVouchers" INTEGER DEFAULT 0; ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "pratamaDollars" INTEGER DEFAULT 0; DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'UserSurvivals\' AND column_name = \'starFragments\') THEN EXECUTE \'UPDATE "UserSurvivals" SET "sukamajuCoins" = COALESCE("starFragments", 500) WHERE "sukamajuCoins" IS NULL\'; END IF; IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'UserSurvivals\' AND column_name = \'coupons\') THEN EXECUTE \'UPDATE "UserSurvivals" SET "scholarshipVouchers" = COALESCE("coupons", 0) WHERE "scholarshipVouchers" IS NULL\'; END IF; IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = \'user_profiles\' AND column_name = \'economy_wallet\') THEN EXECUTE \'UPDATE "user_profiles" SET "pratamaDollars" = COALESCE("economy_wallet", 0) WHERE "pratamaDollars" IS NULL\'; END IF; END $$;',
  },
  {
    id: "v48_add_adisha_diamonds",
    description:
      "Tambah kolom adishaDiamonds ke UserSurvivals untuk mata uang premium Adisha Diamond",
    sql: "ALTER TABLE UserSurvivals ADD COLUMN adishaDiamonds INT DEFAULT 0;",
    pgSql:
      'ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "adishaDiamonds" INTEGER DEFAULT 0;',
  },
  {
    id: "v49_add_medali_permainan",
    description:
      "Tambah kolom medaliPermainan ke user_profiles untuk Medali Permainan (MP)",
    sql: "ALTER TABLE user_profiles ADD COLUMN medaliPermainan INT DEFAULT 100;",
    pgSql:
      'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "medaliPermainan" INTEGER DEFAULT 100;',
  },
  {
    id: "v50_create_story_progress_and_user_npcs",
    description:
      "Buat tabel user_npcs, story_progress, dan kolom storyProgress serta roamStats pada UserSurvivals",
    sql: "CREATE TABLE IF NOT EXISTS user_npcs (userId VARCHAR(191) NOT NULL, npcId VARCHAR(191) NOT NULL, affection INT DEFAULT 0, relationshipLevel INT DEFAULT 0, lastInteraction DATETIME DEFAULT NULL, dailyGifts INT DEFAULT 0, PRIMARY KEY (userId, npcId)); CREATE TABLE IF NOT EXISTS story_progress (userId VARCHAR(191) NOT NULL PRIMARY KEY, currentArc INT DEFAULT 1, currentChapter INT DEFAULT 1, alignment VARCHAR(32) DEFAULT 'neutral', unlockedLore JSON DEFAULT NULL, completedScenes JSON DEFAULT NULL, flags JSON DEFAULT NULL, choices JSON DEFAULT NULL, unlockedBackstories JSON DEFAULT NULL, createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, updatedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP); ALTER TABLE UserSurvivals ADD COLUMN storyProgress JSON DEFAULT NULL; ALTER TABLE UserSurvivals ADD COLUMN roamStats JSON DEFAULT NULL;",
    pgSql:
      'CREATE TABLE IF NOT EXISTS "user_npcs" ("userId" VARCHAR(191) NOT NULL, "npcId" VARCHAR(191) NOT NULL, "affection" INTEGER DEFAULT 0, "relationshipLevel" INTEGER DEFAULT 0, "lastInteraction" TIMESTAMPTZ DEFAULT NULL, "dailyGifts" INTEGER DEFAULT 0, PRIMARY KEY ("userId", "npcId")); CREATE TABLE IF NOT EXISTS "story_progress" ("userId" VARCHAR(191) NOT NULL PRIMARY KEY, "currentArc" INTEGER DEFAULT 1, "currentChapter" INTEGER DEFAULT 1, "alignment" VARCHAR(32) DEFAULT \'neutral\', "unlockedLore" JSON DEFAULT NULL, "completedScenes" JSON DEFAULT NULL, "flags" JSON DEFAULT NULL, "choices" JSON DEFAULT NULL, "unlockedBackstories" JSON DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP); ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "storyProgress" JSON DEFAULT NULL; ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "roamStats" JSON DEFAULT NULL;',
  },
  {
    id: "v51_create_cache_write_journal",
    description: "Buat jurnal penulisan cache yang tahan proses berhenti",
    sql: "CREATE TABLE IF NOT EXISTS cache_write_journal (sequence BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, operationId VARCHAR(64) NOT NULL UNIQUE, userId VARCHAR(191) NOT NULL, modelKey VARCHAR(32) NOT NULL, payload JSON NOT NULL, applied BOOLEAN NOT NULL DEFAULT FALSE, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX cache_write_journal_pending (modelKey, userId, applied, sequence), INDEX cache_write_journal_recovery (applied, sequence));",
    pgSql:
      'DO $$ DECLARE seq_name text; BEGIN CREATE TABLE IF NOT EXISTS "cache_write_journal" ("sequence" BIGSERIAL PRIMARY KEY, "operationId" VARCHAR(64) NOT NULL UNIQUE, "userId" VARCHAR(191) NOT NULL, "modelKey" VARCHAR(32) NOT NULL, "payload" JSON NOT NULL, "applied" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); ALTER TABLE "cache_write_journal" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "cache_write_journal" FROM PUBLIC; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN REVOKE ALL ON TABLE "cache_write_journal" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN REVOKE ALL ON TABLE "cache_write_journal" FROM authenticated; END IF; seq_name := pg_get_serial_sequence(\'cache_write_journal\', \'sequence\'); IF seq_name IS NOT NULL THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM PUBLIC\', seq_name); IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM anon\', seq_name); END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM authenticated\', seq_name); END IF; END IF; CREATE INDEX IF NOT EXISTS "cache_write_journal_pending" ON "cache_write_journal" ("modelKey", "userId", "applied", "sequence"); CREATE INDEX IF NOT EXISTS "cache_write_journal_recovery" ON "cache_write_journal" ("applied", "sequence"); END $$;',
  },
  {
    id: "v52_create_business_operations",
    description: "Buat ledger hasil transaksi untuk idempotensi operasi bisnis",
    sql: "CREATE TABLE IF NOT EXISTS business_operations (operationId VARCHAR(64) NOT NULL PRIMARY KEY, fingerprint VARCHAR(64) NOT NULL, result JSON NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);",
    pgSql:
      'DO $$ BEGIN CREATE TABLE IF NOT EXISTS "business_operations" ("operationId" VARCHAR(64) PRIMARY KEY, "fingerprint" VARCHAR(64) NOT NULL, "result" JSON NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); ALTER TABLE "business_operations" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "business_operations" FROM PUBLIC; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN REVOKE ALL ON TABLE "business_operations" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN REVOKE ALL ON TABLE "business_operations" FROM authenticated; END IF; END $$;',
  },
  {
    id: "v53_create_economy_transfer_taxes",
    description: "Catat pajak transfer Pratama Dollar secara terpisah",
    sql: "CREATE TABLE IF NOT EXISTS economy_transfer_taxes (id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY, amount INT NOT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL);",
    pgSql:
      'DO $$ DECLARE seq_name text; BEGIN CREATE TABLE IF NOT EXISTS "economy_transfer_taxes" ("id" BIGSERIAL PRIMARY KEY, "amount" INTEGER NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); ALTER TABLE "economy_transfer_taxes" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "economy_transfer_taxes" FROM PUBLIC; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN REVOKE ALL ON TABLE "economy_transfer_taxes" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN REVOKE ALL ON TABLE "economy_transfer_taxes" FROM authenticated; END IF; seq_name := pg_get_serial_sequence(\'economy_transfer_taxes\', \'id\'); IF seq_name IS NOT NULL THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM PUBLIC\', seq_name); IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM anon\', seq_name); END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN EXECUTE format(\'REVOKE ALL ON SEQUENCE %s FROM authenticated\', seq_name); END IF; END IF; END $$;',
  },
  {
    id: "v54_create_economy_event_outbox",
    description: "Buat antrean event transfer yang tersimpan bersama transaksi",
    sql: "CREATE TABLE IF NOT EXISTS economy_event_outbox (eventId VARCHAR(64) NOT NULL PRIMARY KEY, payload JSON NOT NULL, dispatchedAt DATETIME DEFAULT NULL, createdAt DATETIME NOT NULL, updatedAt DATETIME NOT NULL, INDEX economy_event_outbox_pending (dispatchedAt, createdAt));",
    pgSql:
      'DO $$ BEGIN CREATE TABLE IF NOT EXISTS "economy_event_outbox" ("eventId" VARCHAR(64) PRIMARY KEY, "payload" JSON NOT NULL, "dispatchedAt" TIMESTAMPTZ DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); ALTER TABLE "economy_event_outbox" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "economy_event_outbox" FROM PUBLIC; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN REVOKE ALL ON TABLE "economy_event_outbox" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN REVOKE ALL ON TABLE "economy_event_outbox" FROM authenticated; END IF; CREATE INDEX IF NOT EXISTS "economy_event_outbox_pending" ON "economy_event_outbox" ("dispatchedAt", "createdAt"); END $$;',
  },
  {
    id: "v55_create_slice_of_life_progress_v1",
    description: "Buat penyimpanan terpisah progres cerita slice of life",
    sql: "CREATE TABLE IF NOT EXISTS slice_of_life_progress_v1 (userId VARCHAR(25) NOT NULL PRIMARY KEY, scene VARCHAR(100) NOT NULL, completed BOOLEAN NOT NULL DEFAULT FALSE, choices JSON NOT NULL, revision INT NOT NULL DEFAULT 0);",
    pgSql: 'DO $$ BEGIN CREATE TABLE IF NOT EXISTS "slice_of_life_progress_v1" ("userId" VARCHAR(25) PRIMARY KEY, "scene" VARCHAR(100) NOT NULL, "completed" BOOLEAN NOT NULL DEFAULT FALSE, "choices" JSON NOT NULL, "revision" INTEGER NOT NULL DEFAULT 0); ALTER TABLE "slice_of_life_progress_v1" ENABLE ROW LEVEL SECURITY; REVOKE ALL ON TABLE "slice_of_life_progress_v1" FROM PUBLIC; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'anon\') THEN REVOKE ALL ON TABLE "slice_of_life_progress_v1" FROM anon; END IF; IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = \'authenticated\') THEN REVOKE ALL ON TABLE "slice_of_life_progress_v1" FROM authenticated; END IF; END $$;',
  },
];

/**
 * Varian PostgreSQL untuk migrasi lama yang hanya punya SQL dialek MySQL.
 *
 * Produksi memakai Supabase/PostgreSQL, sementara entri `sql` di atas ditulis
 * sejak era MySQL (TINYINT, MODIFY COLUMN, ENGINE=InnoDB, AUTO_INCREMENT,
 * JSON_EXTRACT, dll.). Tanpa varian ini, `prestart` gagal total pada database
 * PostgreSQL baru sehingga bot tidak pernah menyala.
 *
 * Aturan translasi yang dipakai:
 *   - TINYINT(1)                -> SMALLINT
 *   - MODIFY COLUMN             -> ALTER COLUMN ... TYPE/SET DEFAULT/DROP NOT NULL
 *   - ENGINE=InnoDB/CHARSET     -> dihapus
 *   - INT AUTO_INCREMENT        -> SERIAL
 *   - FLOAT                     -> DOUBLE PRECISION
 *   - DATETIME                  -> TIMESTAMPTZ
 *   - UNIQUE KEY nama (kol)     -> CONSTRAINT nama UNIQUE (kol)
 *   - INDEX inline              -> CREATE INDEX terpisah
 *   - JSON_EXTRACT(k,'$.x')     -> k->>'x'
 *
 * Semua identifier camelCase dikutip eksplisit agar cocok dengan kolom yang
 * dibuat Sequelize (PostgreSQL melipat huruf kecil bila tidak dikutip).
 * Setiap ALTER ADD COLUMN memakai IF NOT EXISTS agar aman dijalankan ulang
 * setelah tabel dibuat oleh `sync()`.
 */
const PG_SQL_OVERRIDES = {
  v1_add_mannersPoint:
    'ALTER TABLE "user_leveling" ADD COLUMN IF NOT EXISTS "mannersPoint" INTEGER DEFAULT 100;',
  v2_add_dailyNotify:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "dailyNotify" SMALLINT DEFAULT 1;',
  v3_add_economy_deposit:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "economy_deposit" JSON DEFAULT NULL;',
  v4_add_economy_investments:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "economy_investments" JSON DEFAULT NULL;',
  v5_add_coupons:
    'ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "coupons" INTEGER NOT NULL DEFAULT 0;',
  // Migrasi DATA: pindahkan kupon dari JSON rpg_state ke kolom coupons.
  // Guard memakai cast ::jsonb karena tipe `json` tidak punya operator `?`.
  // Idempoten secara nilai: baris tanpa kunci 'coupons' tidak tersentuh.
  v6_move_coupons_to_column:
    "UPDATE \"UserSurvivals\" SET coupons = coupons + CAST(rpg_state->>'coupons' AS INTEGER), rpg_state = rpg_state - 'coupons' WHERE rpg_state IS NOT NULL AND (rpg_state::jsonb -> 'coupons') IS NOT NULL AND jsonb_typeof(rpg_state::jsonb -> 'coupons') = 'number';",
  v7_add_index_user_leveling:
    'CREATE INDEX IF NOT EXISTS idx_user_leveling_guild_user ON "user_leveling" ("guildId", "userId");',
  v8_add_index_user_warns:
    'CREATE INDEX IF NOT EXISTS idx_user_warns_guild_user ON "user_warns" ("guildId", "userId");',
  v9_add_index_user_friends:
    'CREATE INDEX IF NOT EXISTS idx_user_friends_user1 ON "UserFriends" ("user1Id");',
  v10_add_index_user_friends_2:
    'CREATE INDEX IF NOT EXISTS idx_user_friends_user2 ON "UserFriends" ("user2Id");',
  v11_add_index_user_cosmetics:
    'CREATE INDEX IF NOT EXISTS idx_user_cosmetics_userId ON "user_cosmetics" ("userId");',
  v12_add_index_user_pets:
    'CREATE INDEX IF NOT EXISTS idx_user_pets_userId ON "UserPets" ("userId");',
  v13_add_reputation:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "reputation" INTEGER DEFAULT 0;',
  v14_make_language_nullable:
    'ALTER TABLE "user_profiles" ALTER COLUMN "language" DROP NOT NULL; ALTER TABLE "user_profiles" ALTER COLUMN "language" SET DEFAULT NULL;',
  v15_add_aiPersona:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "aiPersona" JSON DEFAULT NULL;',
  v16_add_activeBanners:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "activeBanners" JSON DEFAULT NULL;',
  v17_add_role_leases:
    'CREATE TABLE IF NOT EXISTS "role_leases" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL, "guildId" VARCHAR(191) NOT NULL, "roleId" VARCHAR(191) NOT NULL, "expiresAt" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "idx_role_leases_unique" UNIQUE ("guildId", "userId", "roleId")); CREATE INDEX IF NOT EXISTS "idx_role_leases_expiresAt" ON "role_leases" ("expiresAt");',
  v18_giveaway_participants:
    'ALTER TABLE "giveaways" ADD COLUMN IF NOT EXISTS "requirements" JSON DEFAULT NULL, ADD COLUMN IF NOT EXISTS "participants" JSON DEFAULT NULL, ADD COLUMN IF NOT EXISTS "winners" JSON DEFAULT NULL;',
  v19_add_clan_columns:
    'ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "clanId" INTEGER DEFAULT NULL;',
  v20_add_clan_quests:
    'ALTER TABLE "GuildClans" ADD COLUMN IF NOT EXISTS "questsState" JSON DEFAULT NULL;',
  v21_create_duel_records:
    'CREATE TABLE IF NOT EXISTS "duel_records" ("userId" VARCHAR(191) NOT NULL PRIMARY KEY, "mmr" INTEGER NOT NULL DEFAULT 1000, "matchesPlayed" INTEGER NOT NULL DEFAULT 0, "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0, "kills" INTEGER NOT NULL DEFAULT 0, "deaths" INTEGER NOT NULL DEFAULT 0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL);',
  v22_add_notification_prefs:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "notification_prefs" JSON DEFAULT NULL;',
  v23_upgrade_user_pets:
    'ALTER TABLE "UserPets" ADD COLUMN IF NOT EXISTS "mood" VARCHAR(255) DEFAULT \'happy\', ADD COLUMN IF NOT EXISTS "evolutionStage" INTEGER DEFAULT 1, ADD COLUMN IF NOT EXISTS "passiveSkill" VARCHAR(255) DEFAULT NULL;',
  v24_add_world_boss_and_clan_territory:
    'CREATE TABLE IF NOT EXISTS "world_bosses" ("id" SERIAL PRIMARY KEY, "bossId" VARCHAR(191) NOT NULL UNIQUE, "name" VARCHAR(255) NOT NULL, "title" VARCHAR(255) NOT NULL DEFAULT \'Ancient Calamity\', "element" VARCHAR(64) NOT NULL DEFAULT \'DARK\', "maxHp" BIGINT NOT NULL DEFAULT 1000000, "currentHp" BIGINT NOT NULL DEFAULT 1000000, "baseAttack" INTEGER NOT NULL DEFAULT 150, "defense" INTEGER NOT NULL DEFAULT 50, "status" VARCHAR(64) NOT NULL DEFAULT \'ACTIVE\', "damageLeaderboard" JSON NOT NULL, "rewardsPool" JSON NOT NULL, "spawnTime" TIMESTAMPTZ NOT NULL, "endTime" TIMESTAMPTZ NOT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE TABLE IF NOT EXISTS "clan_territories" ("id" SERIAL PRIMARY KEY, "territoryId" VARCHAR(191) NOT NULL UNIQUE, "name" VARCHAR(255) NOT NULL, "clanId" INTEGER DEFAULT NULL, "controlPoints" INTEGER NOT NULL DEFAULT 0, "taxYield" INTEGER NOT NULL DEFAULT 1000, "buffEffect" VARCHAR(128) NOT NULL DEFAULT \'EXTRA_GOLD_10\', "contestedAt" TIMESTAMPTZ DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL);',
  v25_upgrade_user_cards_system:
    'ALTER TABLE "user_cards" ADD COLUMN IF NOT EXISTS "cardCode" VARCHAR(32) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "characterName" VARCHAR(255) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "seriesName" VARCHAR(255) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "printNumber" INTEGER NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS "quality" VARCHAR(32) NOT NULL DEFAULT \'GOOD\', ADD COLUMN IF NOT EXISTS "frame" VARCHAR(64) NOT NULL DEFAULT \'DEFAULT\', ADD COLUMN IF NOT EXISTS "dyeColor" VARCHAR(32) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "imageUrl" TEXT DEFAULT NULL, ADD COLUMN IF NOT EXISTS "isLocked" BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS "burnValue" INTEGER DEFAULT 100;',
  v26_create_user_card_decks:
    'CREATE TABLE IF NOT EXISTS "user_card_decks" ("userId" VARCHAR(32) NOT NULL PRIMARY KEY, "activeDeck" JSON NOT NULL, "towerFloor" INTEGER NOT NULL DEFAULT 1, "highestFloor" INTEGER NOT NULL DEFAULT 1, "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0, "eloRating" INTEGER NOT NULL DEFAULT 1000, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_user_card_decks_elo" ON "user_card_decks" ("eloRating");',
  v27_create_minecraft_links:
    'CREATE TABLE IF NOT EXISTS "minecraft_links" ("userId" VARCHAR(32) NOT NULL PRIMARY KEY, "mcUsername" VARCHAR(64) NOT NULL, "mcUuid" VARCHAR(64) DEFAULT NULL, "isVerified" BOOLEAN DEFAULT FALSE, "verificationCode" VARCHAR(16) DEFAULT NULL, "totalSyncRewards" INTEGER DEFAULT 0, "lastSyncedAt" TIMESTAMPTZ DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_minecraft_links_mcUsername" ON "minecraft_links" ("mcUsername");',
  v28_create_prediction_markets_and_bets:
    'CREATE TABLE IF NOT EXISTS "prediction_markets" ("marketId" VARCHAR(64) NOT NULL PRIMARY KEY, "guildId" VARCHAR(32) NOT NULL, "creatorId" VARCHAR(32) NOT NULL, "title" VARCHAR(255) NOT NULL, "description" TEXT DEFAULT NULL, "category" VARCHAR(32) NOT NULL DEFAULT \'COMMUNITY\', "options" JSON NOT NULL, "totalPool" BIGINT NOT NULL DEFAULT 0, "status" VARCHAR(32) NOT NULL DEFAULT \'OPEN\', "winningOptionId" INTEGER DEFAULT NULL, "lockTime" TIMESTAMPTZ NOT NULL, "resolveTime" TIMESTAMPTZ DEFAULT NULL, "houseFeePercent" INTEGER NOT NULL DEFAULT 5, "maxBetPerUser" INTEGER NOT NULL DEFAULT 10000, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_prediction_markets_guildId" ON "prediction_markets" ("guildId"); CREATE INDEX IF NOT EXISTS "idx_prediction_markets_status" ON "prediction_markets" ("status"); CREATE TABLE IF NOT EXISTS "prediction_bets" ("betId" VARCHAR(64) NOT NULL PRIMARY KEY, "marketId" VARCHAR(64) NOT NULL, "guildId" VARCHAR(32) NOT NULL, "userId" VARCHAR(32) NOT NULL, "username" VARCHAR(128) NOT NULL DEFAULT \'Anonymous\', "optionId" INTEGER NOT NULL, "amount" BIGINT NOT NULL, "payout" BIGINT NOT NULL DEFAULT 0, "status" VARCHAR(32) NOT NULL DEFAULT \'PENDING\', "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE INDEX IF NOT EXISTS "idx_prediction_bets_marketId" ON "prediction_bets" ("marketId"); CREATE INDEX IF NOT EXISTS "idx_prediction_bets_userId" ON "prediction_bets" ("userId"); CREATE INDEX IF NOT EXISTS "idx_prediction_bets_guild_user" ON "prediction_bets" ("guildId", "userId");',
  v29_upgrade_world_boss_phases:
    'ALTER TABLE "world_bosses" ADD COLUMN IF NOT EXISTS "phase" INTEGER NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS "shieldHp" BIGINT NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "maxShieldHp" BIGINT NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "roleContributions" JSON DEFAULT NULL, ADD COLUMN IF NOT EXISTS "mvpUserId" VARCHAR(191) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "lastHitUserId" VARCHAR(191) DEFAULT NULL;',
  v30_create_user_cafes:
    'CREATE TABLE IF NOT EXISTS "user_cafes" ("userId" VARCHAR(32) NOT NULL PRIMARY KEY, "cafeName" VARCHAR(64) NOT NULL DEFAULT \'Cyber Maid Lounge\', "level" INTEGER NOT NULL DEFAULT 1, "reputation" INTEGER NOT NULL DEFAULT 0, "unlockedRecipes" JSON NOT NULL, "activeDishes" JSON NOT NULL, "theme" VARCHAR(32) NOT NULL DEFAULT \'CYBER_NEON\', "customersServed" INTEGER NOT NULL DEFAULT 0, "uncollectedRevenue" BIGINT NOT NULL DEFAULT 0, "lastCollectedAt" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL);',
  v31_upgrade_user_cards_fusion_inscription:
    'ALTER TABLE "user_cards" ADD COLUMN IF NOT EXISTS "isAwakened" BOOLEAN DEFAULT FALSE, ADD COLUMN IF NOT EXISTS "awakeningLevel" INTEGER DEFAULT 0, ADD COLUMN IF NOT EXISTS "inscription" VARCHAR(128) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "originalMinterId" VARCHAR(191) DEFAULT NULL;',
  v32_upgrade_territories_and_pets:
    'ALTER TABLE "clan_territories" ADD COLUMN IF NOT EXISTS "clanName" VARCHAR(128) DEFAULT NULL, ADD COLUMN IF NOT EXISTS "defenseLevel" INTEGER NOT NULL DEFAULT 1, ADD COLUMN IF NOT EXISTS "maxControlPoints" INTEGER NOT NULL DEFAULT 1000, ADD COLUMN IF NOT EXISTS "lastTaxClaimedAt" TIMESTAMPTZ DEFAULT NULL, ADD COLUMN IF NOT EXISTS "contributingClanIds" JSON DEFAULT NULL; ALTER TABLE "UserPets" ADD COLUMN IF NOT EXISTS "fusionCount" INTEGER NOT NULL DEFAULT 0, ADD COLUMN IF NOT EXISTS "cosmicAura" BOOLEAN NOT NULL DEFAULT FALSE, ADD COLUMN IF NOT EXISTS "habitatRoom" JSON DEFAULT NULL;',
  v33_create_sprint20_milestone_tables:
    'ALTER TABLE "GuildClans" ADD COLUMN IF NOT EXISTS "hallLayout" JSON DEFAULT NULL; CREATE TABLE IF NOT EXISTS "coliseum_teams" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL UNIQUE, "teamName" VARCHAR(128) NOT NULL DEFAULT \'Vanguard Squad\', "formation" JSON NOT NULL, "eloRating" INTEGER NOT NULL DEFAULT 1200, "divisionTier" VARCHAR(32) NOT NULL DEFAULT \'BRONZE\', "wins" INTEGER NOT NULL DEFAULT 0, "losses" INTEGER NOT NULL DEFAULT 0, "lastFoughtAt" TIMESTAMPTZ DEFAULT NULL, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE TABLE IF NOT EXISTS "guild_personas" ("id" SERIAL PRIMARY KEY, "personaId" VARCHAR(64) NOT NULL UNIQUE, "guildId" VARCHAR(64) NOT NULL, "channelId" VARCHAR(64) DEFAULT NULL, "name" VARCHAR(128) NOT NULL, "systemPrompt" TEXT NOT NULL, "voiceTone" VARCHAR(64) NOT NULL DEFAULT \'TSUNDERE\', "avatarUrl" VARCHAR(255) DEFAULT NULL, "isActive" BOOLEAN NOT NULL DEFAULT TRUE, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE TABLE IF NOT EXISTS "server_stocks" ("ticker" VARCHAR(32) PRIMARY KEY, "name" VARCHAR(128) NOT NULL, "guildId" VARCHAR(64) DEFAULT NULL, "clanId" INTEGER DEFAULT NULL, "currentPrice" DOUBLE PRECISION NOT NULL DEFAULT 100.0, "previousPrice" DOUBLE PRECISION NOT NULL DEFAULT 100.0, "totalShares" INTEGER NOT NULL DEFAULT 10000, "availableShares" INTEGER NOT NULL DEFAULT 10000, "dividendYield" DOUBLE PRECISION NOT NULL DEFAULT 0.05, "history24h" JSON NOT NULL, "isHighRisk" BOOLEAN NOT NULL DEFAULT FALSE, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL); CREATE TABLE IF NOT EXISTS "user_stock_holdings" ("id" SERIAL PRIMARY KEY, "userId" VARCHAR(191) NOT NULL, "ticker" VARCHAR(32) NOT NULL, "sharesOwned" INTEGER NOT NULL DEFAULT 0, "avgBuyPrice" DOUBLE PRECISION NOT NULL DEFAULT 0.0, "createdAt" TIMESTAMPTZ NOT NULL, "updatedAt" TIMESTAMPTZ NOT NULL, CONSTRAINT "uk_user_ticker" UNIQUE ("userId", "ticker"));',
  v48_add_adisha_diamonds:
    'ALTER TABLE "UserSurvivals" ADD COLUMN IF NOT EXISTS "adishaDiamonds" INTEGER DEFAULT 0;',
  v49_add_medali_permainan:
    'ALTER TABLE "user_profiles" ADD COLUMN IF NOT EXISTS "medaliPermainan" INTEGER DEFAULT 100;',
};

// Tempelkan override ke entri migrasi yang belum punya pgSql. Entri yang sudah
// mendefinisikan pgSql sendiri (mis. v34) tidak ditimpa.
for (const migration of MIGRATIONS) {
  if (!migration.pgSql && PG_SQL_OVERRIDES[migration.id]) {
    migration.pgSql = PG_SQL_OVERRIDES[migration.id];
  }
}

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

/**
 * Pecah string SQL multi-statement menjadi daftar statement tunggal.
 *
 * node-postgres menolak beberapa driver-level multi-command saat binding
 * dipakai, dan penanganan error per-statement jadi tidak mungkin kalau dua
 * ALTER digabung dalam satu panggilan. Pemecahan dilakukan pada titik koma
 * DI LUAR string terkutip (single maupun double quote) agar nilai default
 * seperti 'Cyber Maid Lounge' tidak ikut terpotong.
 *
 * @param {string} sql - SQL mentah yang mungkin berisi beberapa statement
 * @returns {string[]} Daftar statement non-kosong siap dieksekusi berurutan
 */
function splitStatements(sql) {
  const statements = [];
  let current = "";
  let quoteChar = null;
  let dollarQuote = null;
  let lineComment = false;
  let blockCommentDepth = 0;
  const input = String(sql || "");

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    const next = input[i + 1];
    if (lineComment) {
      current += char;
      if (char === "\n") lineComment = false;
      continue;
    }
    if (blockCommentDepth) {
      current += char;
      if (char === "/" && next === "*") {
        current += next;
        i++;
        blockCommentDepth++;
      } else if (char === "*" && next === "/") {
        current += next;
        i++;
        blockCommentDepth--;
      }
      continue;
    }
    if (dollarQuote) {
      if (input.startsWith(dollarQuote, i)) {
        current += dollarQuote;
        i += dollarQuote.length - 1;
        dollarQuote = null;
      } else current += char;
      continue;
    }
    if (quoteChar) {
      current += char;
      if (char === quoteChar && next === quoteChar) {
        current += next;
        i++;
      } else if (char === quoteChar) quoteChar = null;
      continue;
    }
    if (char === "-" && next === "-") {
      current += "--";
      i++;
      lineComment = true;
      continue;
    }
    if (char === "/" && next === "*") {
      current += "/*";
      i++;
      blockCommentDepth = 1;
      continue;
    }
    if (char === "$" && (i === 0 || !/[A-Za-z0-9_$]/.test(input[i - 1]))) {
      const delimiter = input
        .slice(i)
        .match(/^\$(?:[A-Za-z_][A-Za-z0-9_]*)?\$/)?.[0];
      if (delimiter) {
        dollarQuote = delimiter;
        current += delimiter;
        i += delimiter.length - 1;
        continue;
      }
    }
    if (char === "'" || char === '"') {
      quoteChar = char;
      current += char;
      continue;
    }
    if (char === ";") {
      const trimmed = current.trim();
      if (trimmed) statements.push(trimmed);
      current = "";
      continue;
    }
    current += char;
  }

  const tail = current.trim();
  if (tail) statements.push(tail);
  return statements;
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

/** Jangan mencatat migrasi jurnal bila tabel yang sudah ada tidak lengkap. */
async function verifyJournalSchema(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("cache_write_journal");
  const required = [
    "sequence",
    "operationId",
    "userId",
    "modelKey",
    "payload",
    "applied",
    "createdAt",
    "updatedAt",
  ];
  if (required.some((name) => !columns[name]) || !columns.sequence.primaryKey)
    throw new Error("Skema cache_write_journal tidak lengkap");
  const sequenceType = String(columns.sequence.type || "");
  if (!/\b(?:BIGINT|INTEGER|INT)\b/i.test(sequenceType))
    throw new Error("Tipe sequence jurnal tidak sesuai");
  if (
    sequelize.options.dialect === "sqlite" &&
    sequenceType.toUpperCase() !== "INTEGER"
  )
    throw new Error("Sequence SQLite harus INTEGER PRIMARY KEY");
  if (sequelize.options.dialect === "mysql" && !columns.sequence.autoIncrement)
    throw new Error("Sequence MySQL harus auto increment");
  if (
    required
      .slice(1)
      .some(
        (name) => columns[name].allowNull !== false || columns[name].primaryKey,
      )
  )
    throw new Error("Batasan kolom jurnal tidak sesuai");
  if (
    !/json/i.test(String(columns.payload.type || "")) ||
    !/(bool|tinyint|integer)/i.test(String(columns.applied.type || ""))
  )
    throw new Error("Tipe kolom jurnal tidak sesuai");
  const indexes = await queryInterface.showIndex("cache_write_journal");
  const matches = (index, fields) => {
    const names = (index.fields || []).map(
      (field) => field.attribute || field.name,
    );
    return (
      names.length === fields.length &&
      names.every((name, i) => name === fields[i])
    );
  };
  if (
    !indexes.some(
      (index) =>
        index.unique &&
        !index.where &&
        !/\bWHERE\b/i.test(index.definition || "") &&
        matches(index, ["operationId"]),
    )
  )
    throw new Error("Kunci unik operationId jurnal tidak ada");
  if (
    !indexes.some((index) =>
      matches(index, ["modelKey", "userId", "applied", "sequence"]),
    ) ||
    !indexes.some((index) => matches(index, ["applied", "sequence"]))
  )
    throw new Error("Indeks pemulihan jurnal tidak lengkap");
  if (sequelize.options.dialect === "postgres") {
    const [rows] = await sequelize.query(
      "SELECT c.relrowsecurity AS enabled, row_security_active(c.oid) AS active, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy, (has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'UPDATE')) AS table_access, has_sequence_privilege(pg_get_serial_sequence(c.oid::regclass::text, 'sequence'), 'USAGE') AS sequence_access, EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_access, EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT') OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))) AS exposed_access, EXISTS (SELECT 1 FROM pg_class sc, pg_roles r WHERE sc.oid = to_regclass(pg_get_serial_sequence(c.oid::regclass::text, 'sequence')) AND r.rolname IN ('anon','authenticated') AND has_sequence_privilege(r.oid, sc.oid, 'USAGE')) AS exposed_seq_access FROM pg_class c WHERE c.oid = to_regclass('cache_write_journal')",
    );
    if (
      !rows?.[0]?.enabled ||
      rows[0].active ||
      rows[0].has_policy ||
      !rows[0].table_access ||
      !rows[0].sequence_access ||
      rows[0].public_access ||
      rows[0].exposed_access ||
      rows[0].exposed_seq_access
    )
      throw new Error("RLS atau peran database jurnal tidak sesuai");
  }
}

/** Verifikasi ledger sebelum migrasi dicatat selesai. */
async function verifyBusinessOperationSchema(sequelize) {
  const columns = await sequelize
    .getQueryInterface()
    .describeTable("business_operations");
  const names = [
    "operationId",
    "fingerprint",
    "result",
    "createdAt",
    "updatedAt",
  ];
  if (names.some((name) => !columns[name]) || !columns.operationId.primaryKey)
    throw new Error("Skema business_operations tidak lengkap");
  if (
    names
      .slice(1)
      .some(
        (name) => columns[name].allowNull !== false || columns[name].primaryKey,
      ) ||
    !/json/i.test(String(columns.result.type || ""))
  )
    throw new Error("Batasan business_operations tidak sesuai");
  if (sequelize.options.dialect === "postgres") {
    const [rows] = await sequelize.query(
      "SELECT c.relrowsecurity AS enabled, row_security_active(c.oid) AS active, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy, (has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT')) AS table_access, EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_access, EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT') OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))) AS exposed_access FROM pg_class c WHERE c.oid = to_regclass('business_operations')",
    );
    if (
      !rows?.[0]?.enabled ||
      rows[0].active ||
      rows[0].has_policy ||
      !rows[0].table_access ||
      rows[0].public_access ||
      rows[0].exposed_access
    )
      throw new Error(
        "RLS atau peran database business_operations tidak sesuai",
      );
  }
}

/** Verifikasi bentuk dan akses backend sebelum mencatat migrasi cerita. */
async function verifySliceOfLifeSchema(sequelize) {
  const columns = await sequelize.getQueryInterface().describeTable("slice_of_life_progress_v1");
  if (!["userId", "scene", "completed", "choices", "revision"].every((name) => columns[name]) ||
      !columns.userId.primaryKey || ["scene", "completed", "choices", "revision"].some((name) => columns[name].allowNull !== false)) {
    throw new Error("Skema slice_of_life_progress_v1 tidak sesuai");
  }
  if (sequelize.options.dialect === "postgres") {
    const [rows] = await sequelize.query("SELECT c.relrowsecurity AS enabled, row_security_active(c.oid) AS active, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy, (has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'UPDATE')) AS table_access, EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_access, EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT') OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))) AS exposed_access FROM pg_class c WHERE c.oid = to_regclass('slice_of_life_progress_v1')");
    if (!rows?.[0]?.enabled || rows[0].active || rows[0].has_policy || !rows[0].table_access || rows[0].public_access || rows[0].exposed_access) throw new Error("RLS atau peran database slice_of_life_progress_v1 tidak sesuai");
  }
}
/** Pastikan ledger pajak dan akses peran migrasi tersedia sebelum dicatat. */
async function verifyTransferTaxSchema(sequelize) {
  const columns = await sequelize
    .getQueryInterface()
    .describeTable("economy_transfer_taxes");
  if (
    !["id", "amount", "createdAt", "updatedAt"].every(
      (name) => columns[name],
    ) ||
    !columns.id.primaryKey ||
    columns.amount.allowNull !== false ||
    !/\b(?:INTEGER|INT)\b/i.test(String(columns.amount.type || ""))
  )
    throw new Error("Skema economy_transfer_taxes tidak sesuai");
  if (sequelize.options.dialect === "postgres") {
    const [rows] = await sequelize.query(
      "SELECT c.relrowsecurity AS enabled, row_security_active(c.oid) AS active, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy, has_table_privilege(c.oid, 'INSERT') AS table_access, has_sequence_privilege(pg_get_serial_sequence(c.oid::regclass::text, 'id'), 'USAGE') AS sequence_access, EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_access, EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT') OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))) AS exposed_access, EXISTS (SELECT 1 FROM pg_class sc, pg_roles r WHERE sc.oid = to_regclass(pg_get_serial_sequence(c.oid::regclass::text, 'id')) AND r.rolname IN ('anon','authenticated') AND has_sequence_privilege(r.oid, sc.oid, 'USAGE')) AS exposed_seq_access FROM pg_class c WHERE c.oid = to_regclass('economy_transfer_taxes')",
    );
    if (
      !rows?.[0]?.enabled ||
      rows[0].active ||
      rows[0].has_policy ||
      !rows[0].table_access ||
      !rows[0].sequence_access ||
      rows[0].public_access ||
      rows[0].exposed_access ||
      rows[0].exposed_seq_access
    )
      throw new Error(
        "RLS atau peran database economy_transfer_taxes tidak sesuai",
      );
  }
}

async function verifyEconomyOutboxSchema(sequelize) {
  const queryInterface = sequelize.getQueryInterface();
  const columns = await queryInterface.describeTable("economy_event_outbox");
  if (
    !["eventId", "payload", "dispatchedAt", "createdAt", "updatedAt"].every(
      (name) => columns[name],
    ) ||
    !columns.eventId.primaryKey ||
    columns.payload.allowNull !== false ||
    !/json/i.test(String(columns.payload.type || ""))
  )
    throw new Error("Skema economy_event_outbox tidak sesuai");
  const indexes = await queryInterface.showIndex("economy_event_outbox");
  if (
    !indexes.some(
      (index) =>
        (index.fields || [])
          .map((field) => field.attribute || field.name)
          .join(",") === "dispatchedAt,createdAt",
    )
  )
    throw new Error("Indeks economy_event_outbox tidak sesuai");
  if (sequelize.options.dialect === "postgres") {
    const [rows] = await sequelize.query(
      "SELECT c.relrowsecurity AS enabled, row_security_active(c.oid) AS active, EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid) AS has_policy, (has_table_privilege(c.oid, 'SELECT') AND has_table_privilege(c.oid, 'INSERT') AND has_table_privilege(c.oid, 'UPDATE')) AS table_access, EXISTS (SELECT 1 FROM aclexplode(COALESCE(c.relacl, acldefault('r', c.relowner))) a WHERE a.grantee = 0 AND a.privilege_type IN ('SELECT','INSERT','UPDATE','DELETE')) AS public_access, EXISTS (SELECT 1 FROM pg_roles r WHERE r.rolname IN ('anon','authenticated') AND (has_table_privilege(r.oid, c.oid, 'SELECT') OR has_table_privilege(r.oid, c.oid, 'INSERT') OR has_table_privilege(r.oid, c.oid, 'UPDATE') OR has_table_privilege(r.oid, c.oid, 'DELETE'))) AS exposed_access FROM pg_class c WHERE c.oid = to_regclass('economy_event_outbox')",
    );
    if (
      !rows?.[0]?.enabled ||
      rows[0].active ||
      rows[0].has_policy ||
      !rows[0].table_access ||
      rows[0].public_access ||
      rows[0].exposed_access
    )
      throw new Error(
        "RLS atau peran database economy_event_outbox tidak sesuai",
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
async function runMigrations(sequelize, options = {}) {
  if (sequelize.options.dialect === "sqlite") {
    logger.info(
      "[DB MIGRATOR] Melewati migrasi, bukan MySQL/PostgreSQL (mode SQLite fallback).",
    );
    return { applied: [], alreadyPresent: [] };
  }

  const onlyIds = options.onlyIds ? new Set(options.onlyIds) : null;
  const targetMigrations = onlyIds
    ? MIGRATIONS.filter((migration) => onlyIds.has(migration.id))
    : MIGRATIONS;

  await ensureLedger(sequelize);
  const done = await loadAppliedIds(sequelize);
  const pending = targetMigrations.filter(
    (migration) => !done.has(migration.id),
  );

  if (pending.length === 0) {
    logger.success(
      `[DB MIGRATOR] Tidak ada migrasi tertunda (${targetMigrations.length} sudah tercatat).`,
    );
    return { applied: [], alreadyPresent: [] };
  }

  logger.info(
    `[DB MIGRATOR] ${pending.length} migrasi tertunda dari total ${targetMigrations.length}.`,
  );

  const applied = [];
  const alreadyPresent = [];
  const isPostgres = sequelize.options.dialect === "postgres";

  for (const migration of pending) {
    const querySql =
      isPostgres && migration.pgSql ? migration.pgSql : migration.sql;
    try {
      if (querySql) {
        // Eksekusi per-statement agar error bisa dilokalisasi dan multi-
        // statement (v14, v24, v28, v32, v33) tetap aman di PostgreSQL.
        for (const statement of splitStatements(querySql)) {
          await sequelize.query(statement);
        }
      }
      if (migration.id === "v51_create_cache_write_journal")
        await verifyJournalSchema(sequelize);
      if (migration.id === "v52_create_business_operations")
        await verifyBusinessOperationSchema(sequelize);
      if (migration.id === "v53_create_economy_transfer_taxes")
        await verifyTransferTaxSchema(sequelize);
      if (migration.id === "v55_create_slice_of_life_progress_v1") await verifySliceOfLifeSchema(sequelize);
      if (migration.id === "v54_create_economy_event_outbox")
        await verifyEconomyOutboxSchema(sequelize);
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
      throw new SystemError(`Migrasi '${migration.id}' gagal: ${err.message}`);
    }
  }

  logger.success(
    `[DB MIGRATOR] Selesai. ${applied.length} dijalankan, ${alreadyPresent.length} dicatat menyusul.`,
  );
  return { applied, alreadyPresent };
}

// ==========================================
// MIGRASI DATA: SQLite -> Database Utama (Fallback Recovery)
// ==========================================

// Jumlah baris per statement upsert. Nilai ini menyeimbangkan kecepatan dengan
// batas parameter PostgreSQL (65535 parameter per statement). 500 baris x
// ~40 kolom = 20.000 parameter, masih jauh di bawah batas.
const SYNC_BATCH_SIZE = 500;

// Nama file fallback memakai path relatif terhadap CWD, sama seperti aslinya.
const FALLBACK_FILE = "./naura_fallback.sqlite";

/**
 * Membaca satu tabel dari file SQLite fallback.
 *
 * @param {object} database - Koneksi DatabaseSync yang sudah dibuka.
 * @param {string} tableName - Nama tabel.
 * @returns {object[]} Baris yang dibaca.
 */
function readFallbackTable(database, tableName) {
  const stmt = database.prepare(`SELECT * FROM ${tableName}`);
  return stmt.all();
}

/**
 * Memindahkan data fallback SQLite ke database utama.
 *
 * Dua aturan keselamatan yang ditegakkan di sini:
 *
 * 1. File fallback TIDAK PERNAH dihapus. Versi lama memanggil
 *    `fs.unlinkSync` di blok `finally` tanpa syarat, padahal galat per-tabel
 *    hanya dicatat lewat logger.warn. Akibatnya file terhapus meski separuh
 *    tabel gagal tersalin, dan tidak ada sumber recovery yang tersisa. Sekarang
 *    file hanya DI-RENAME menjadi `.synced` setelah semua tabel berhasil, dan
 *    tetap utuh bila ada tabel yang gagal supaya boot berikutnya mencoba lagi.
 *
 * 2. Penulisan memakai `upsert` bertahap, bukan `findOrCreate` per-baris.
 *    Versi lama mengirim satu query per baris, sehingga 10.000 pemain berarti
 *    10.000 query yang menahan connection pool.
 *
 * Catatan: `updateOnDuplicate` sengaja mengecualikan primary key serta kolom
 * waktu. Tanpa itu, sinkronisasi akan menimpa nilai `createdAt` milik pemain.
 *
 * @param {import("sequelize").Sequelize} targetSequelize - Instance tujuan.
 * @returns {Promise<{ok: boolean, moved: number, failedTables: string[], skipped: string[]}>}
 *   Ringkasan hasil sinkronisasi. `ok` hanya true bila tidak ada tabel gagal.
 */
async function syncFallbackToMySQL(targetSequelize) {
  if (!fs.existsSync(FALLBACK_FILE)) {
    return {
      ok: true,
      moved: 0,
      failedTables: [],
      skipped: [],
      reason: "no_file",
    };
  }

  logger.info(
    "[DB MIGRATOR] Mendeteksi file SQLite lokal. Memulai proses pemindahan data ke database utama...",
  );

  let database;
  const failedTables = [];
  const skipped = [];
  let moved = 0;
  let fatalError = null;

  try {
    // Gunakan native sqlite dari Node.js (v22+)
    const { DatabaseSync } = require("node:sqlite");
    database = new DatabaseSync(FALLBACK_FILE);

    const models = Object.keys(targetSequelize.models);

    for (const modelName of models) {
      const Model = targetSequelize.models[modelName];

      let rows;
      try {
        rows = readFallbackTable(database, Model.tableName);
      } catch (tableErr) {
        // Tabel yang tidak ada di fallback memang wajar, bukan kegagalan.
        logger.db(
          `[DB MIGRATOR] Tabel ${Model.tableName} tidak ada di fallback, dilewati.`,
        );
        skipped.push(Model.tableName);
        continue;
      }

      if (!rows || rows.length === 0) {
        skipped.push(Model.tableName);
        continue;
      }

      const pk = Model.primaryKeyAttributes?.[0] || "id";
      const updateFields = Object.keys(rows[0]).filter(
        (k) => ![pk, "createdAt", "updatedAt"].includes(k),
      );

      try {
        const bulkOptions =
          updateFields.length > 0
            ? { updateOnDuplicate: updateFields }
            : { ignoreDuplicates: true };

        for (let i = 0; i < rows.length; i += SYNC_BATCH_SIZE) {
          const batch = rows.slice(i, i + SYNC_BATCH_SIZE);
          if (typeof Model.bulkCreate === "function") {
            await Model.bulkCreate(batch, bulkOptions);
          } else {
            await Model.upsert(batch, bulkOptions);
          }
        }
        moved += rows.length;
        logger.db(
          `[DB MIGRATOR] ${rows.length} baris dipindahkan ke ${Model.tableName}.`,
        );
      } catch (tableErr) {
        // Dicatat dan DITERUSKAN ke tabel berikutnya, tapi nama tabelnya
        // disimpan supaya file fallback tidak dianggap selesai tersinkron.
        logger.warn(
          `[DB MIGRATOR] Tabel ${Model.tableName} gagal disinkronkan: ${tableErr.message}`,
        );
        failedTables.push(Model.tableName);
      }
    }
  } catch (e) {
    fatalError = e.message;
    logger.error("[DB MIGRATOR ERROR] Gagal memindahkan data:", e.message);
  } finally {
    if (database) {
      try {
        database.close();
      } catch (closeError) {
        logger.warn(
          `[DB MIGRATOR] Gagal menutup file SQLite fallback: ${closeError.message}`,
        );
      }
    }
  }

  const ok = failedTables.length === 0 && fatalError === null;

  if (ok) {
    // Ber successes sepihak TIDAK menghapus file. Hanya ditandai, supaya
    // operator masih bisa memeriksa atau memulihkan secara manual.
    try {
      fs.renameSync(FALLBACK_FILE, `${FALLBACK_FILE}.synced`);
      logger.success(
        "[DB MIGRATOR] Pemindahan data selesai. File fallback ditandai sudah tersinkron (.synced), isinya tetap disimpan.",
      );
    } catch (renameError) {
      logger.warn(
        `[DB MIGRATOR] Gagal menandai file fallback sudah tersinkron: ${renameError.message}`,
      );
    }
  } else {
    // Ada tabel yang gagal. File wajib utuh agar sinkronisasi dicoba lagi
    // pada boot berikutnya.
    logger.error(
      `[DB MIGRATOR] Sinkronisasi BELUM lengkap (${failedTables.length} tabel gagal). File fallback dipertahankan agar dapat dicoba lagi.`,
    );
  }

  return { ok, moved, failedTables, skipped, error: fatalError };
}

/**
 * Cabut hak akses residual PUBLIC, anon, dan authenticated pada tabel/sequence
 * runtime terisolasi (v51-v55) secara idempoten.
 *
 * @param {import('sequelize').Sequelize} sequelize
 */
async function remediateStagingTableGrants(sequelize) {
  if (!sequelize || sequelize.options?.dialect !== "postgres") {
    return { remediated: false };
  }

  const sql = `
    DO $$
    DECLARE
      tbl text;
      seq_name text;
    BEGIN
      FOREACH tbl IN ARRAY ARRAY[
        'cache_write_journal',
        'business_operations',
        'economy_transfer_taxes',
        'economy_event_outbox',
        'slice_of_life_progress_v1'
      ] LOOP
        IF to_regclass(format('public.%I', tbl)) IS NOT NULL THEN
          EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', tbl);
          EXECUTE format('REVOKE ALL ON TABLE public.%I FROM PUBLIC', tbl);
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon', tbl);
          END IF;
          IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
            EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated', tbl);
          END IF;
        END IF;
      END LOOP;

      seq_name := pg_get_serial_sequence('cache_write_journal', 'sequence');
      IF seq_name IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', seq_name);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', seq_name);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM authenticated', seq_name);
        END IF;
      END IF;

      seq_name := pg_get_serial_sequence('economy_transfer_taxes', 'id');
      IF seq_name IS NOT NULL THEN
        EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', seq_name);
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM anon', seq_name);
        END IF;
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
          EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM authenticated', seq_name);
        END IF;
      END IF;
    END $$;
  `;

  await sequelize.query(sql);
  return { remediated: true };
}

module.exports = {
  runMigrations,
  verifyJournalSchema,
  verifyBusinessOperationSchema,
  verifyTransferTaxSchema,
  verifyEconomyOutboxSchema,
  verifySliceOfLifeSchema,
  remediateStagingTableGrants,
  syncFallbackToMySQL,
  getPendingMigrations,
  MIGRATIONS,
  LEDGER_TABLE,
  splitStatements,
};
