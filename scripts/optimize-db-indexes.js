"use strict";

/**
 * @file optimize-db-indexes.js
 * @description Script untuk mengoptimasi index PostgreSQL guna meningkatkan performa query
 * 
 * Cara penggunaan:
 *   node scripts/optimize-db-indexes.js
 * 
 * Note: Script ini aman dijalankan di production karena menggunakan CREATE INDEX CONCURRENTLY
 */

const { logger } = require("../src/managers/logger");

// Daftar index yang direkomendasikan berdasarkan analisis query pattern
const RECOMMENDED_INDEXES = [
  // User Profile Indexes
  {
    name: "idx_userprofile_userid",
    table: '"UserProfiles"',
    column: '"userId"',
    type: "btree",
    description: "Primary lookup for user profile queries",
  },
  {
    name: "idx_userprofile_pratama_dollars",
    table: '"UserProfiles"',
    column: '"pratamaDollars"',
    type: "btree",
    description: "Economy leaderboard and balance queries",
  },
  
  // User Survival Indexes
  {
    name: "idx_usersurvival_userid",
    table: '"UserSurvivals"',
    column: '"userId"',
    type: "btree",
    description: "Primary lookup for survival data",
  },
  {
    name: "idx_usersurvival_location",
    table: '"UserSurvivals"',
    column: '"currentLocation"',
    type: "btree",
    description: "Location-based queries and roam system",
  },
  {
    name: "idx_usersurvival_level",
    table: '"UserSurvivals"',
    column: '"level"',
    type: "btree",
    description: "Level-based matchmaking and leaderboards",
  },
  
  // Guild Settings Indexes
  {
    name: "idx_guildsettings_guildid",
    table: '"GuildSettings"',
    column: '"guildId"',
    type: "btree",
    description: "Guild configuration lookups",
  },
  
  // Economy Transaction Indexes
  {
    name: "idx_economy_transactions_userid",
    table: '"EconomyTransactions"',
    column: '"userId"',
    type: "btree",
    description: "Transaction history queries",
  },
  {
    name: "idx_economy_transactions_timestamp",
    table: '"EconomyTransactions"',
    column: '"createdAt"',
    type: "btree",
    description: "Time-range transaction reports",
  },
  
  // Inventory Indexes
  {
    name: "idx_userinventory_userid",
    table: '"UserInventories"',
    column: '"userId"',
    type: "btree",
    description: "Inventory lookups",
  },
  
  // Clan/Territory Indexes
  {
    name: "idx_clanmemberships_userid",
    table: '"ClanMemberships"',
    column: '"userId"',
    type: "btree",
    description: "Clan membership queries",
  },
  {
    name: "idx_clanterritories_clanid",
    table: '"ClanTerritories"',
    column: '"clanId"',
    type: "btree",
    description: "Territory ownership queries",
  },
];

async function optimizeIndexes() {
  logger.info("[DB Optimizer] Starting database index optimization...");
  
  try {
    const { sequelize } = require("../src/managers/dbManager");
    
    // Test connection
    await sequelize.authenticate();
    logger.info("[DB Optimizer] Database connection established");
    
    let created = 0;
    let skipped = 0;
    let failed = 0;
    
    for (const index of RECOMMENDED_INDEXES) {
      try {
        // Check if index already exists
        const [existingIndex] = await sequelize.query(`
          SELECT indexname 
          FROM pg_indexes 
          WHERE tablename = ${sequelize.escape(index.table.replace(/"/g, ''))}
            AND indexname = ${sequelize.escape(index.name)}
        `);
        
        if (existingIndex.length > 0) {
          logger.info(`[DB Optimizer] ✓ Index ${index.name} already exists, skipping`);
          skipped++;
          continue;
        }
        
        // Create index concurrently (non-blocking)
        const createQuery = `
          CREATE INDEX CONCURRENTLY ${index.name} 
          ON ${index.table} USING ${index.type} (${index.column})
        `;
        
        logger.info(`[DB Optimizer] Creating index: ${index.name} on ${index.table}(${index.column})`);
        await sequelize.query(createQuery);
        
        logger.info(`[DB Optimizer] ✓ Successfully created ${index.name}`);
        created++;
        
      } catch (error) {
        logger.error(`[DB Optimizer] ✗ Failed to create ${index.name}:`, error.message);
        failed++;
      }
    }
    
    // Summary
    logger.info("=".repeat(60));
    logger.info("[DB Optimizer] OPTIMIZATION COMPLETE");
    logger.info(`  Created: ${created} indexes`);
    logger.info(`  Skipped: ${skipped} indexes (already exist)`);
    logger.info(`  Failed:  ${failed} indexes`);
    logger.info("=".repeat(60));
    
    if (created > 0) {
      logger.info("[DB Optimizer] ⚠️  Note: Run ANALYZE on tables to update statistics");
      logger.info("[DB Optimizer] Suggested command:");
      logger.info("  ANALYZE \"UserProfiles\";");
      logger.info("  ANALYZE \"UserSurvivals\";");
      logger.info("  ANALYZE \"GuildSettings\";");
    }
    
    process.exit(0);
    
  } catch (error) {
    logger.error("[DB Optimizer] Fatal error:", error);
    process.exit(1);
  }
}

// Run optimization
optimizeIndexes();
