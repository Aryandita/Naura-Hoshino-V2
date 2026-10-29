# 🎯 Managers Layer - Pengendali Stateful & Infrastruktur

> Direktori ini berisi **manager modules** yang mengelola state aplikasi, koneksi database, caching, lifecycle bot, dan infrastruktur inti. Managers bersifat stateful dan biasanya diinisialisasi sekali saat startup.

## 📋 Daftar Managers

### 💾 Data & Caching
| File | Deskripsi |
|------|-----------|
| `cacheManager.js` | **Inti sistem cache** - Write-behind cache, atomic operations, JSON mutation |
| `dbManager.js` | PostgreSQL/Supabase connection pool & query interface |
| `mongoManager.js` | MongoDB connection & document operations |
| `redisManager.js` | Redis cache, pub/sub, distributed mutex locks |
| `supabaseManager.js` | Supabase-specific client wrapper |
| `cacheInvalidator.js` | Cache invalidation strategies & TTL management |
| `dbSeeder.js` | Database seeding for development/testing |

### 🔄 Migration & Schema
| File | Deskripsi |
|------|-----------|
| `dbMigrator.js` | **Database migration runner** - 46+ versioned migrations |

### 🎵 Audio Infrastructure
| File | Deskripsi |
|------|-----------|
| `musicManager.js` | Music playback queue, player state, 24/7 mode |
| `lavalinkClusterManager.js` | Lavalink v4 cluster failover & node management |
| `aiDjManager.js` | AI DJ persona, Fish Audio greeting, voice streaming |
| `voiceManager.js` | Voice channel join/leave lifecycle |

### 🤖 AI & Intelligence
| File | Deskripsi |
|------|-----------|
| `aiManager.js` | AI ensemble orchestration, model routing, context management |

### 🔧 Bot Lifecycle & Infrastructure
| File | Deskripsi |
|------|-----------|
| `CommandHandler.js` | Slash command loading, registration, dispatch |
| `cronManager.js` | Scheduled task execution & cron job management |
| `lifecycleManager.js` | Bot startup/shutdown lifecycle hooks |
| `clusterManager.js` | Multi-process sharding coordination |
| `errorHandler.js` | Global error catching & graceful degradation |
| `eventLoader.js` | Discord event listener registration |
| `logger.js` | Structured logging (console + file) |
| `logWriter.js` | Async log file writer with rotation |
| `metricsManager.js` | Performance metrics collection & reporting |
| `trafficMonitor.js` | Rate limit & traffic monitoring |

### 🎮 Feature Managers
| File | Deskripsi |
|------|-----------|
| `giveawayManager.js` | Giveaway lifecycle (create, draw, end) |
| `ticketManager.js` | Support ticket system |
| `languageManager.js` | i18n localization loading & switching |
| `guildSettingsService.js` | Per-guild settings persistence |
| `tempVoiceRegistry.js` | Temporary voice channel registry |
| `rssManager.js` | RSS feed polling & notification |
| `notificationManager.js` | Notification dispatch coordination |
| `backupManager.js` | Automated data backup scheduling |

### Subdirectory: `lavalink/`
Berisi konfigurasi fallback node Lavalink dan helper untuk cluster audio.

## 🏗️ Pola Arsitektur

### 1. Singleton Lifecycle
Managers diinisialisasi sekali dan diregistrasi di Service Container:
```javascript
// Di container.js
container.register('cacheManager', new CacheManager());
container.register('dbManager', new DbManager());

// Akses dari mana saja
const cache = container.resolve('cacheManager');
```

### 2. Write-Behind Cache Pattern
`cacheManager` menulis ke Redis/memory terlebih dahulu, lalu flush ke PostgreSQL secara berkala:
```javascript
// Instant write to cache
await cacheManager.incrementUserProfile(userId, { pratamaDollars: 100 });

// Background flush every 5 seconds to PostgreSQL
// (handled internally by cacheManager)
```

### 3. Atomic Operations
Semua mutasi saldo/inventory **wajib** melalui metode atomik:
```javascript
// Numerik - aman dari race condition
await cacheManager.incrementUserSurvival(userId, { sukamajuCoins: 50 });
await cacheManager.debitUserProfile(userId, { pratamaDollars: 100 });

// JSON fields - SELECT FOR UPDATE under the hood
await cacheManager.mutateUserProfileJson(userId, 'inventory', (inv) => {
  return [...inv, newItem];
});
```

### 4. Database Migration Versioning
Migrasi database bernomor urut dan tercatat di `schema_migrations`:
```javascript
// Di dbMigrator.js
async function v42_add_new_column(sequelize) {
  await sequelize.query('ALTER TABLE ...');
}
```

### 5. Graceful Shutdown
`lifecycleManager` memastikan cleanup saat bot berhenti:
- Flush pending cache writes
- Close DB connections
- Disconnect Lavalink nodes
- Save persistent state

## 🔗 Navigasi Terkait

- **Services (Stateless):** [`src/services/`](../services/README.md)
- **Service Container:** `src/core/container.js`
- **Event Bus:** `src/core/eventBus.js`
- **Models:** `src/models/`
- **Config:** `src/config/env.js`, `src/config/database.js`
- **Domain Contracts:** `src/domain/contracts/`
- **Rules:** [`RULES.md`](../../RULES.md) Bagian 1 (Transaksi Atomik) & Bagian 4 (Database)
- **AGENTS.md:** [`AGENTS.md`](../../AGENTS.md) Bagian 4.2 (SOP Menambah Kolom/Skema)

## ⚠️ Peringatan Kritis

1. **Jangan `ALTER TABLE` manual** - selalu buat migrasi baru di `dbMigrator.js`
2. **Jangan `row.save()` tanpa `fields`** - risiko overwrite kolom lain
3. **Jangan akses `global.client`** - gunakan `container.resolve('client')`
4. **Jangan bypass cacheManager** untuk mutasi saldo - risiko duplikasi
5. **Jangan hardcode config** - baca dari `src/config/` modules
6. **Jangan lupa flush** - pastikan cache tertulis sebelum shutdown

## 📊 Dependency Flow

```
Plugin/Command -> Manager -> Database/Cache/External API
                    |
              Service Container
                    |
              Event Bus (decoupled)
```

---

*Dokumentasi ini ditujukan untuk developer junior. Untuk detail arsitektur IoC dan event-driven, baca [`AGENTS.md`](../../AGENTS.md) Bagian 3.9 dan [`DESIGN.md`](../../DESIGN.md).*
