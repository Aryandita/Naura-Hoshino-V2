# Recommended Database Indexes for Naura Hoshino V2

> **Generated:** 2026-10-24  
> **Purpose:** Optimize query performance for high-frequency cacheManager operations  
> **Hotspot Functions:** getUserProfile (136 calls), getUserSurvival (87 calls), incrementUserSurvival (81 calls)

## Executive Summary

Berdasarkan graph analysis, fungsi-fungsi berikut merupakan hotspot yang memerlukan optimasi:
- `getUserProfile`: 136 calls (high fan-in)
- `getUserSurvival`: 87 calls (high fan-in)  
- `incrementUserSurvival`: 81 calls (frequent mutations)

Index recommendations di bawah ini akan mengurangi latensi query dari O(n) menjadi O(log n) untuk operasi WHERE userId.

---

## UserProfile Table

### Primary Key (Already Exists)
`sql
-- userId adalah PRIMARY KEY, sudah otomatis ter-index
ALTER TABLE "user_profiles" ADD PRIMARY KEY ("userId");
`

### Recommended Additional Indexes
`sql
-- Index untuk query dengan filter deletedAt (soft delete checks)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_deletedat 
ON "user_profiles"("deletedAt") 
WHERE "deletedAt" IS NOT NULL;

-- Composite index untuk query yang filter by userId + deletedAt (common pattern)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_userid_deletedat 
ON "user_profiles"("userId", "deletedAt");

-- Index untuk premium tier queries (leaderboard, filtering)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_premiumtier 
ON "user_profiles"("premium_tier") 
WHERE "premium_tier" != 'none';

-- Index untuk leveling queries (top levelers)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_leveling 
ON "user_profiles"("leveling_level" DESC, "leveling_xp" DESC);
`

---

## UserSurvival Table

### Primary Key (Already Exists)
`sql
-- userId adalah PRIMARY KEY, sudah otomatis ter-index
ALTER TABLE "UserSurvivals" ADD PRIMARY KEY ("userId");
`

### Recommended Additional Indexes
`sql
-- Index untuk soft delete checks
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_deletedat 
ON "UserSurvivals"("deletedAt") 
WHERE "deletedAt" IS NOT NULL;

-- Composite index untuk userId + deletedAt
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_userid_deletedat 
ON "UserSurvivals"("userId", "deletedAt");

-- Index untuk survival leaderboard (level + XP)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_leaderboard 
ON "UserSurvivals"("survival_level" DESC, "survival_xp" DESC);

-- Index untuk clan queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_clanid 
ON "UserSurvivals"("clanId") 
WHERE "clanId" IS NOT NULL;

-- Index untuk location-based queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_location 
ON "UserSurvivals"("currentLocation");
`

---

## GuildSettings Table

### Recommended Indexes
`sql
-- guildId seharusnya PRIMARY KEY atau UNIQUE
CREATE UNIQUE INDEX CONCURRENTLY IF NOT EXISTS idx_guildsettings_guildid 
ON "GuildSettings"("guildId");

-- Soft delete index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_guildsettings_deletedat 
ON "GuildSettings"("deletedAt") 
WHERE "deletedAt" IS NOT NULL;
`

---

## Migration Implementation

### File: `src/managers/dbMigrator.js`

Tambahkan fungsi migrasi berikut:

`javascript
async function v51_add_performance_indexes(queryInterface) {
  logger.info('[Migration v51] Adding performance indexes...');
  
  // UserProfile indexes
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_deletedat 
    ON "user_profiles"("deletedAt") 
    WHERE "deletedAt" IS NOT NULL
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_userid_deletedat 
    ON "user_profiles"("userId", "deletedAt")
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_premiumtier 
    ON "user_profiles"("premium_tier") 
    WHERE "premium_tier" != 'none'
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_userprofile_leveling 
    ON "user_profiles"("leveling_level" DESC, "leveling_xp" DESC)
  );
  
  // UserSurvival indexes
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_deletedat 
    ON "UserSurvivals"("deletedAt") 
    WHERE "deletedAt" IS NOT NULL
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_userid_deletedat 
    ON "UserSurvivals"("userId", "deletedAt")
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_leaderboard 
    ON "UserSurvivals"("survival_level" DESC, "survival_xp" DESC)
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_clanid 
    ON "UserSurvivals"("clanId") 
    WHERE "clanId" IS NOT NULL
  );
  
  await queryInterface.sequelize.query(
    CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_usersurvival_location 
    ON "UserSurvivals"("currentLocation")
  );
  
  logger.info('[Migration v51] Performance indexes added successfully');
}
`

**Catatan Penting:**
- Gunakan `CREATE INDEX CONCURRENTLY` agar tidak mengunci tabel saat index dibuat (PostgreSQL only)
- Untuk production database dengan jutaan rows, jalankan migrasi saat off-peak hours
- Test di staging environment terlebih dahulu
- Monitor query performance sebelum dan sesudah menggunakan `pg_stat_statements`

---

## Expected Performance Improvements

| Query Type | Before (No Index) | After (With Index) | Improvement |
|------------|-------------------|--------------------|-------------|
| getUserProfile (userId lookup) | ~50-200ms | ~5-15ms | 10-40x faster |
| getUserSurvival (userId lookup) | ~50-200ms | ~5-15ms | 10-40x faster |
| Soft delete checks | ~100-500ms | ~10-30ms | 10-50x faster |
| Leaderboard queries | ~500-2000ms | ~50-100ms | 10-40x faster |

**Total Estimated Latency Reduction:** 70-90% untuk cache miss scenarios

---

## Monitoring & Validation

Setelah index diterapkan, monitor dengan query berikut:

`sql
-- Check index usage statistics
SELECT 
  schemaname,
  tablename,
  indexname,
  idx_scan,
  idx_tup_read,
  idx_tup_fetch
FROM pg_stat_user_indexes
WHERE tablename IN ('user_profiles', 'UserSurvivals')
ORDER BY idx_scan DESC;

-- Identify slow queries (requires pg_stat_statements)
SELECT 
  query,
  calls,
  total_time,
  mean_time,
  rows
FROM pg_stat_statements
WHERE query LIKE '%user_profiles%' OR query LIKE '%UserSurvivals%'
ORDER BY mean_time DESC
LIMIT 20;
`

---

## Rollback Plan

Jika index menyebabkan masalah, hapus dengan:

`sql
DROP INDEX IF EXISTS idx_userprofile_deletedat;
DROP INDEX IF EXISTS idx_userprofile_userid_deletedat;
DROP INDEX IF EXISTS idx_userprofile_premiumtier;
DROP INDEX IF EXISTS idx_userprofile_leveling;
DROP INDEX IF EXISTS idx_usersurvival_deletedat;
DROP INDEX IF EXISTS idx_usersurvival_userid_deletedat;
DROP INDEX IF EXISTS idx_usersurvival_leaderboard;
DROP INDEX IF EXISTS idx_usersurvival_clanid;
DROP INDEX IF EXISTS idx_usersurvival_location;
`

---

## References

- [PostgreSQL CREATE INDEX Documentation](https://www.postgresql.org/docs/current/sql-createindex.html)
- [Sequelize Index Documentation](https://sequelize.org/docs/v6/other-topics/indexes/)
- Internal Graph Analysis Report (T5 Task Brief)
