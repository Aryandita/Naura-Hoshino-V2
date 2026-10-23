"use strict";

const { sequelize } = require("../../src/config/database");
const { logger } = require("../../src/managers/logger");

async function v47_add_dashboard_indexes() {
  const queryInterface = sequelize.getQueryInterface();
  const dialect = sequelize.getDialect();

  if (dialect === "sqlite") {
    logger.info("[Migration v47] Skipping index creation on SQLite (not needed for dev)");
    return;
  }

  logger.info("[Migration v47] Creating dashboard performance indexes...");

  const indexes = [
    {
      name: "idx_userprofile_economy_leaderboard",
      table: "UserProfiles",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_economy_leaderboard 
           ON "UserProfiles" ("pratamaDollars" DESC, "userId")`,
    },
    {
      name: "idx_userprofile_leveling_leaderboard",
      table: "UserProfiles",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_leveling_leaderboard
           ON "UserProfiles" ("level" DESC, "xp" DESC, "userId")`,
    },
    {
      name: "idx_usersurvival_survival_leaderboard",
      table: "UserSurvivals",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_survival_leaderboard
           ON "UserSurvivals" ("sukamajuCoins" DESC, "userId")`,
    },
    {
      name: "idx_userprofile_username_lower",
      table: "UserProfiles",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_username_lower
           ON "UserProfiles" (LOWER("username"))`,
    },
    {
      name: "idx_economy_transactions_from_created",
      table: "EconomyTransactions",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_economy_transactions_from_created
           ON "EconomyTransactions" ("fromUserId", "createdAt" DESC)`,
      skipIfNotExists: true,
    },
    {
      name: "idx_economy_transactions_to_created",
      table: "EconomyTransactions",
      sql: `CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_economy_transactions_to_created
           ON "EconomyTransactions" ("toUserId", "createdAt" DESC)`,
      skipIfNotExists: true,
    },
  ];

  for (const index of indexes) {
    try {
      const exists = await checkIndexExists(queryInterface, index.name);
      if (exists) {
        logger.info(`[Migration v47] Index ${index.name} already exists, skipping`);
        continue;
      }

      logger.info(`[Migration v47] Creating index ${index.name}...`);
      await sequelize.query(index.sql);
      logger.info(`[Migration v47] ✓ Created ${index.name}`);
    } catch (err) {
      if (index.skipIfNotExists && err.message.includes("already exists")) {
        logger.info(`[Migration v47] Index ${index.name} already exists`);
        continue;
      }
      logger.error(`[Migration v47] Failed to create ${index.name}: ${err.message}`);
    }
  }

  logger.info("[Migration v47] Dashboard indexes created successfully");
}

async function checkIndexExists(queryInterface, indexName) {
  try {
    const result = await sequelize.query(
      `SELECT 1 FROM pg_indexes WHERE indexname = :indexName LIMIT 1`,
      { replacements: { indexName }, type: sequelize.QueryTypes.SELECT }
    );
    return result.length > 0;
  } catch {
    return false;
  }
}

module.exports = v47_add_dashboard_indexes;

if (require.main === module) {
  v47_add_dashboard_indexes()
    .then(() => {
      logger.info("[Migration v47] Complete");
      process.exit(0);
    })
    .catch((err) => {
      logger.error("[Migration v47] Failed:", err);
      process.exit(1);
    });
}
