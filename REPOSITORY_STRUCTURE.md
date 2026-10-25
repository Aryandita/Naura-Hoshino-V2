# 📁 Struktur Repositori Naura Hoshino V2

> **Panduan Lengkap untuk AI Agent** - Dokumen ini menjelaskan arsitektur, organisasi kode, dan alur data ekosistem Naura Hoshino V2 secara detail agar AI agent dapat memahami dan menavigasi repositori dengan efektif.

**Versi:** 2.4.0  
**Runtime:** Node.js ≥ 24.0.0  
**Framework:** discord.js v14  

---

## 🎯 Ringkasan Ekosistem

Naura Hoshino V2 adalah platform Discord multifungsi dengan 6 pilar utama:

1. **Bot Engine** - ShardingManager & Event Router dengan Components V2
2. **Web Dashboard** - MPA mandiri (Vite + Tailwind) dengan avatar 3D Three.js/VRM
3. **Audio & DJ** - Lavalink v4 Cluster Manager dengan Fish Audio AI DJ Companion
4. **Polyglot Database** - Supabase PostgreSQL, MongoDB, Redis, SQLite fallback
5. **Survival RPG** - Naura Wilds dengan Currency V2 Closed-Loop
6. **Living AI** - AI Ensemble (Gemini/Groq/Ollama) dengan Semantic Vector Memory

---

## 🗂️ Peta Direktori Lengkap

### Root Directory (`/`)

```
Naura-Hoshino-V2/
├── shard.js                    # Entry point ShardingManager
├── index.js                    # Bot client instance per-shard
├── package.json                # SSOT versi ekosistem & dependensi
├── docker-compose.yml          # Konfigurasi Docker stack
├── Dockerfile                  # Container image definition
├── playwright.config.js        # Konfigurasi E2E testing
├── vitest.config.js            # Konfigurasi unit testing
├── eslint.config.js            # Konfigurasi linter ESLint v10
│
├── 📄 Dokumentasi (Pentalogi)
│   ├── README.md               # Portal & instalasi publik
│   ├── PRD.md                  # Product Requirements Document
│   ├── DESIGN.md               # Design tokens & visual style guide
│   ├── RULES.md                # Konstitusi & aturan arsitektur wajib
│   ├── AGENTS.md               # Panduan teknis & SOP AI Agent
│   ├── TODO.md                 # Roadmap & sprint backlog
│   ├── SECURITY.md             # Kebijakan keamanan & pelaporan
│   └── DEPLOY_GUIDE.md         # Panduan deployment
│
├── 📂 src/                     # Core engine bot (lihat detail di bawah)
├── 📂 plugin/                  # Slash command router per kategori
├── 📂 dashboard/               # Web Dashboard interaktif
├── 📂 assets/                  # Aset grafis, audio, font, 3D model
├── 📂 scripts/                 # Script CLI pemeliharaan & otomatisasi
├── 📂 test/                    # Test suite global
├── 📂 tests/                   # Test tambahan
├── 📂 docs/                    # Dokumentasi tambahan
├── 📂 tools/                   # Tool development
├── 📂 devtools/                # Developer utilities
├── 📂 android/                 # Android mobile app wrapper
├── 📂 docker/                  # Docker configuration files
├── 📂 backups/                 # Backup database & config
├── 📂 logs/                    # Log runtime aplikasi
├── 📂 scratch/                 # File sementara/testing
├── 📂 tasks/                   # Task definitions
├── 📂 pending_plugin/          # Plugin dalam pengembangan
│
├── 📂 .agents/                 # Konfigurasi AI agents & skills
├── 📂 .github/                 # GitHub workflows & CI/CD
├── 📂 .kilo/                   # Kilo IDE configuration
├── 📂 .planning/               # Planning & handoff files
├── 📂 .playwright-mcp/         # Playwright MCP config
├── 📂 .roo/                    # Roo Code configuration
└── 📂 .vscode/                 # VS Code settings
```

---

## 🔧 Detail Direktori Inti

### 1. `src/` - Core Engine Bot

Direktori utama yang berisi seluruh logika inti bot Discord.

#### `src/core/` - Service Container & Event System
```
core/
├── container.js                # IoC Service Container (dependency injection)
├── eventBus.js                 # EventBus mediator (pub/sub decoupling)
└── helpView.js                 # Menu bantuan Components V2
```
**Tanggung Jawab:**
- Menyediakan service registry untuk dependency injection
- Memfasilitasi komunikasi antar modul via event-driven architecture
- **Larangan:** Tidak boleh mengimpor modul plugin/domain langsung

#### `src/managers/` - Stateful Controllers (44 files)
```
managers/
├── cacheManager.js             # Write-behind cache dengan Redis + Postgres flush
├── dbManager.js                # Database connection manager
├── dbMigrator.js               # Migrasi skema bernomor (v1-v46+)
├── lavalinkClusterManager.js   # Multi-node Lavalink cluster dengan failover
├── musicManager.js             # Music playback controller
├── aiDjManager.js              # Fish Audio AI DJ companion
├── voiceManager.js             # Voice channel management
├── CommandHandler.js           # Slash command router pusat
├── languageManager.js          # Bilingual system (ID/EN)
├── ticketManager.js            # Ticket system dengan transkrip HTML
├── redisManager.js             # Redis distributed mutex & pub/sub
├── mongoManager.js             # MongoDB document operations
├── supabaseManager.js          # Supabase PostgreSQL operations
├── backupManager.js            # Automated backup system
├── cronManager.js              # Scheduled task manager
├── errorHandler.js             # Global error handling
├── logger.js                   # Structured logging
├── metricsManager.js           # Telemetry & metrics collection
├── notificationManager.js      # Notification dispatcher
└── ... (24 managers lainnya)
```
**Kunci:**
- Semua operasi stateful melalui manajer ini
- Transaksi atomik untuk saldo: `incrementUserProfile`, `debitUserProfile`
- JSON inventory: `cacheManager.mutateUserProfileJson`

#### `src/services/` - Background Engines (99 files)
```
services/
├── fishAudioService.js         # Fish Audio TTS API integration
├── soundboardService.js        # Web Soundboard Studio engine
├── entitlementService.js       # Premium subscription sync
├── voteService.js              # Top.gg vote rewards
├── premiumReminderService.js   # Smart premium expiry reminders
├── stockMarketEngine.js        # Server stock market simulation
├── blackjackEngine.js          # Blackjack game logic
├── cardBattleEngine.js         # Card battle system
├── territoryWarEngine.js       # Clan territory warfare
├── seasonEngine.js             # Seasonal progression system
├── tradeEngine.js              # Player trading system
├── predictionEngine.js         # Betting/prediction markets
├── economyGuardEngine.js       # Anti-exploit economy protection
├── automationEngine.js         # Workflow automation
├── webhookDispatcher.js        # External webhook delivery
├── webPushService.js           # Browser push notifications
├── voiceCompanionService.js    # Voice AI companion
├── leaderboardService.js       # Dynamic leaderboard rotation
└── ... (79 services lainnya)
```
**Pola:**
- Engine komputasi latar tanpa state persisten
- Integrasi API pihak ketiga (Fish Audio, Top.gg, dll.)
- Game mechanics dan business logic murni

#### `src/ai/` - Artificial Intelligence Suite (28 files)
```
ai/
├── aiEnsembleRouter.js         # Multi-LLM task router (Gemini/Groq/Ollama)
├── semanticMemoryService.js    # Vector semantic memory
├── aiMemory.js                 # Conversation memory manager
├── tribunalEngine.js           # AI moderation tribunal
├── duplexVoiceAgent.js         # Full-duplex voice AI dengan barge-in
├── voiceAgent.js               # Voice interaction handler
├── personaEngine.js            # Persona suite (default/tsundere/kuudere/gamer/butler)
├── functionDispatcher.js       # AI function calling dispatcher
├── geminiClient.js             # Google Gemini API client
├── knowledgeBase.js            # Server RAG knowledge base
├── serverChronicleEngine.js    # Server history chronicler
├── mysteryEngine.js            # Mystery/detective game AI
├── vibeMonitor.js              # Server sentiment analysis
├── documentParser.js           # Document ingestion for RAG
└── aiHelper.js                 # AI utility functions
```
**Fitur Unggulan:**
- Circuit breaker untuk rate limiting (HTTP 429)
- Failover cascade: Gemini → Groq → Ollama
- Semantic vector memory untuk konteks percakapan

#### `src/survival/` - Naura Wilds RPG System
```
survival/
├── engines/
│   ├── currency.js             # Currency V2 closed-loop (SC/PD/VB/BA)
│   ├── recyclingPoolEngine.js  # Recycling pool mechanics
│   ├── durabilityEngine.js     # Item durability system
│   └── townEngine.js           # Town Square simulation
├── helpers/
│   └── survivalUIHelper.js     # Naura Wilds UI tokens (moss/amber/danger)
├── services/
│   └── ...                     # Survival-specific services
└── data/
    └── ...                     # Game data & configurations
```
**Konsep Kunci:**
- 4 mata uang: SC (Sukamaju Koin), PD (Pratama Dollar), VB (Voucher Beasiswa), BA (Berlian Adisha)
- Sistem durability untuk tools/weapons
- Town Square dengan otonomi player-driven economy

#### `src/models/` - Database Schemas (55 models)
```
models/
├── UserProfile.js              # User economy profile (PD balance)
├── UserSurvival.js             # Survival stats (SC/VB/BA, vitals)
├── ServerTreasury.js           # Server-level treasury
├── GuildSettings.js            # Per-guild configuration
├── UserLeveling.js             # XP & level progression
├── UserInventory.js            # Item inventory (JSON)
├── UserCard.js / UserCardDeck.js # Trading card system
├── UserPet.js                  # Pet companions
├── UserFarm.js / UserGreenhouse.js # Farming system
├── GuildClan.js / ClanTerritory.js # Clan system
├── MarketAuction.js            # Auction house
├── ServerStock.js / UserStockHolding.js # Stock market
├── PredictionMarket.js / PredictionBet.js # Betting system
├── ModMail.js / ModerationAppeal.js # Moderation
├── SemanticMemory.js           # AI vector memories
├── mongo/                      # MongoDB schemas
│   ├── AuditLog.js
│   ├── Transcript.js
│   └── ChatHistory.js
└── ... (35 models lainnya)
```
**Aturan Penting:**
- DILARANG `ALTER TABLE` di sini - gunakan `dbMigrator.js`
- Selalu hubungkan ke `cacheManager` untuk akses baca/tulis
- Gunakan transaksi atomik untuk mutasi saldo

#### `src/utils/` - Stateless Helpers (52 files)
```
utils/
├── NauraContainerBuilder.js    # Components V2 builder (5-lapisan)
├── survivalUIHelper.js         # Naura Wilds color tokens
├── uxHelper.js                 # UX pattern helpers
├── transactionHelper.js        # Atomic payment execution
├── interactionPipeline.js      # Button/modal collector manager
├── componentBudget.js          # Component size budget tracker
├── circuitBreaker.js           # Circuit breaker pattern
├── rateLimiter.js              # Rate limiting utilities
├── redisLockHelper.js          # Distributed lock helper
├── autocompleteHelper.js       # Autocomplete handler
├── commandHelper.js            # Command utilities
├── modLogHelper.js             # Moderation logging
├── translateHelper.js          # Translation utilities
├── time.js                     # Time formatting
├── nauraText.js                # Text utilities
├── nauraExpression.js          # Expression parser
└── ... (34 utils lainnya)
```
**Prinsip:**
- Helper harus deterministik dan reusable
- Dilarang menyimpan state di sini
- Wrap interaksi dengan `safeExecute`

#### `src/interactions/` - Interaction Handlers
```
interactions/
├── safeExecute.js              # Defensive interaction wrapper
├── autocomplete.js             # Autocomplete handler
├── registry.js                 # Interaction registry
├── buttons/                    # Button interaction handlers
├── selects/                    # Select menu handlers
├── modals/                     # Modal form handlers
├── contextMenus/               # Context menu handlers
└── shared/                     # Shared interaction utilities
```
**Wajib:**
- Selalu wrap dengan `safeExecute` untuk error handling
- Tangani interaksi secara defensif
- Hindari duplikasi custom_id dalam pesan yang sama

#### `src/events/` - Discord Event Listeners (25 events)
```
events/
├── interactionCreate.js        # Router pusat interaksi
├── messageCreate.js            # Message handler
├── ready.js                    # Bot ready event
├── guildCreate.js              # Guild join handler
├── guildMemberAdd.js           # Member join handler
├── voiceStateUpdate.js         # Voice state changes
├── entitlementCreate/Update/Delete.js # Premium subscription events
├── channelCreate/Delete/Update.js # Channel lifecycle
├── roleCreate/Delete.js        # Role lifecycle
├── messageReactionAdd/Remove.js # Reaction handling
└── ... (subdirectories dengan handler spesifik)
```

#### `src/config/` - Configuration
```
config/
├── env.js                      # Environment variables (SSOT)
├── ui.js                       # UI constants
├── database.js                 # Database configuration
├── tokens/
│   └── designTokens.js         # Design tokens (warna, spacing)
└── lavalink-fallbacks.json     # Lavalink fallback nodes
```
**ATURAN KERAS:**
- **HANYA** baca config via modul ini
- Jangan panggil `process.env` langsung di tempat lain
- Design tokens adalah single source of truth untuk warna

#### Subdirektori Lainnya di `src/`
```
src/
├── adapters/                   # External service adapters
├── arcade/                     # Arcade game system
├── automod/                    # Auto-moderation logic
├── canvas/                     # Canvas worker pool (profile cards, etc.)
├── card/                       # Trading card game
├── domain/                     # Pure domain calculations
│   └── contracts/              # Public domain contracts
├── downloader/                 # Media downloader
├── errors/                     # Custom error classes
├── leveling/                   # Leveling system
├── modmail/                    # ModMail system
├── music/                      # Poru Lavalink handlers
└── premium/                    # Premium features
```

---

### 2. `plugin/` - Slash Command Routers (15 categories)

```
plugin/
├── core/                       # Core commands (/help, /ping, /invite)
├── admin/                      # Administration (/settings, /modlog)
├── ai/                         # AI commands (/naura, /ai-chat)
├── music/                      # Music commands (/play, /queue, /soundboard)
├── survival/                   # Survival RPG (/survival, /town, /craft)
├── naura/                      # Naura-specific (/persona, /voice-companion)
├── arcade/                     # Arcade games (/blackjack, /slots)
├── card/                       # Card game (/card-battle, /deck)
├── fun/                        # Fun commands (/meme, /joke)
├── leveling/                   # Leveling (/rank, /leaderboard)
├── minigames/                  # Minigames (/trivia, /type-race)
├── modmail/                    # ModMail (/ticket, /report)
├── owner/                      # Owner-only (/eval, /reload)
├── premium/                    # Premium features (/premium, /redeem)
└── utility/                    # Utilities (/remind, /translate)
```

**Aturan Plugin:**
- **HANYA** untuk validasi input dan pemanggilan service/manager
- Dilarang query DB mentah di plugin
- Bungkus logika dalam `try/catch` defensif
- Bangun UI dengan `buildContainerV2()`
- Daftarkan terjemahan di `assets/language/id.json` & `en.json`

---

### 3. `dashboard/` - Web Dashboard Interaktif

```
dashboard/
├── server.js                   # Express backend entry point
├── vite.config.mjs             # Vite build configuration
├── openapi.yaml                # API documentation
│
├── routes/                     # API routes
│   ├── api/
│   │   ├── realtime/           # Realtime telemetry endpoints
│   │   ├── economy/            # Economy data endpoints
│   │   ├── stats/              # Statistics endpoints
│   │   └── health              # Health check
│   ├── auth/                   # Authentication routes
│   └── donationWebhooks.js     # Saweria/Trakteer webhook ingestion
│
├── middleware/                 # Express middleware
│   ├── auth.js                 # Authentication middleware
│   └── rateLimit.js            # Rate limiting
│
├── services/                   # Backend services
│   └── socketService.js        # Socket.IO realtime service
│
├── sockets/                    # Socket.IO event handlers
│
├── src/                        # Frontend source (MPA)
│   ├── pages/                  # HTML pages
│   │   ├── index.html          # Dashboard overview
│   │   ├── lounge.html         # Social lounge
│   │   ├── activity.html       # Activity feed
│   │   ├── inventory.html      # Inventory management
│   │   ├── models.html         # 3D model viewer
│   │   └── config.html         # Configuration
│   ├── components/             # Reusable components
│   │   ├── NauraHeroViewer/    # 3D mascot viewer (Three.js/VRM)
│   │   └── NauraViewer/        # Alternative 3D viewer
│   ├── css/                    # Stylesheets
│   │   └── input.css           # Tailwind CSS input
│   ├── js/                     # JavaScript modules
│   └── lib/                    # Utility libraries
│
├── public/                     # Static assets
├── mobile/                     # Mobile-responsive bottom nav
├── dist/                       # Build output
└── tests/                      # Dashboard tests
```

**Teknologi Stack:**
- **Backend:** Express v5 + Socket.IO
- **Frontend:** Vite MPA (Multi-Page Application) + Tailwind CSS v4
- **3D Graphics:** Three.js PBR + @pixiv/three-vrm (SpringBones, mouse look-at)
- **Realtime:** Socket.IO untuk telemetri live

**Fitur Dashboard:**
- Avatar 3D anime interaktif dengan lip-sync
- Telemetri realtime (user count, economy stats)
- Web Soundboard Studio
- Model 3D viewer dengan VRM support
- Donation webhook ingestion (Saweria/Trakteer QRIS)

---

### 4. `assets/` - Resource Assets

```
assets/
├── language/
│   ├── id.json                 # Bahasa Indonesia dictionary
│   └── en.json                 # English dictionary
├── fonts/                      # Custom fonts
├── images/                     # Static images
├── items/                      # Item icons
├── audio/                      # Sound effects & TTS
├── music/                      # Music assets
├── maps/                       # Survival RPG maps
├── 3D Model Naura/             # 3D mascot models (.glb, .vrm)
├── Naura_Expression/           # Facial expression textures
├── naura_gallery/              # Gallery assets
├── survival/                   # Survival RPG assets
├── economy/                    # Economy UI assets
├── dashboard/                  # Dashboard assets
├── general/                    # General purpose assets
└── core/                       # Core bot assets
```

**Lokalisasi:**
- Paritas 100% antara `id.json` dan `en.json` wajib dijaga
- Validasi dengan: `npm run locales:check:strict`
- Hindari em dash (`\u2014`) di semua teks

---

### 5. `scripts/` - Maintenance & Automation Scripts (54 scripts)

```
scripts/
├── migrate.js                  # Database migration runner
├── qa-gate.js                  # Run all 6 QA gates
├── check-em-dash.js            # Check for forbidden em dash
├── check-requires.js           # Verify require() integrity
├── check-inline-scripts.js     # Validate inline <script> syntax
├── validate-locales.js         # Check locale parity ID vs EN
├── verify_dashboard_3d.js      # Headless Chrome 3D verification
├── verify_hero_runtime.js      # Hero component runtime check
├── verify-drift.js             # Architectural drift scanner
│
├── build-dashboard.js          # Build dashboard for production
├── build-apk.js                # Build Android APK
├── generate-css-tokens.js      # Generate CSS from design tokens
├── generate-default-canvas-assets.js # Generate default canvas assets
│
├── start-dashboard.js          # Start dashboard dev server
├── preview-3d.js               # Preview 3D models
├── capture_dashboard_preview.js # Capture dashboard screenshots
│
├── warmup-cache.js             # Warmup Redis cache
├── inspect-db.js               # Database inspection tool
├── test-services.js            # Service integration tests
├── view-logs.js                # Log viewer utility
│
├── auto-update.js              # Auto-pull git updates
├── git-sync.js                 # GitHub sync utility
├── create-clean-backup.js      # Create clean backup
│
├── grant_premium.js            # Grant premium manually
├── heal_user.js                # Heal corrupted user data
│
├── ralph/                      # Ralph autonomous agent system
│   └── ralph.js
│
├── migrations/                 # Versioned migration files
│   ├── v001_initial_schema.js
│   ├── v002_add_economy.js
│   └── ... (hingga v46+)
│
└── maintenance/                # Maintenance utilities
```

**Script Penting untuk QA:**
```bash
npm run qa  # Menjalankan 6 tahap QA Gate berurutan:
# 1. npm run lint
# 2. node scripts/check-em-dash.js
# 3. npm run locales:check:strict
# 4. npm run test:requires
# 5. npm run test:inline-scripts
# 6. npm test
```

---

## 🔄 Alur Eksekusi Sistem

### 1. Startup Flow
```
npm start
  ↓
[prestart] ensure-build.js → migrate.js → warmup-cache.js
  ↓
shard.js (ShardingManager spawn)
  ↓
index.js (per-shard client)
  ↓
[src/core/container.js] Initialize services
  ↓
[src/managers/eventLoader.js] Load event listeners
  ↓
[src/managers/CommandHandler.js] Register slash commands
  ↓
[src/events/ready.js] Bot online
```

### 2. Command Execution Flow
```
User mengetik /command
  ↓
[Discord Gateway WebSocket]
  ↓
[src/events/interactionCreate.js] Router pusat
  ↓
Is Slash Command? → [CommandHandler.js]
  ↓
[plugin/<kategori>/<command>.js] Validasi input
  ↓
┌─────────────────────┬─────────────────────┐
↓                     ↓                     ↓
[Kalkulasi Murni]   [Transaksi Data]    [Render UI]
src/domain/         cacheManager        NauraContainerBuilder
                                        ↓
                              [interaction.reply()]
```

### 3. Audio Playback Flow
```
/play command
  ↓
[plugin/music/play.js]
  ↓
[musicManager.js] Search & queue track
  ↓
[lavalinkClusterManager.js] Select optimal node
  ↓
[Poru v5] Connect to Lavalink v4
  ↓
[aiDjManager.js] Optional Fish Audio TTS intro
  ↓
Stream audio to voice channel
```

### 4. Database Transaction Flow (Atomic)
```
User action requiring balance change
  ↓
[plugin/command.js] Validate sufficiency
  ↓
[cacheManager.incrementUserProfile/debitUserProfile]
  ↓
[Redis] Write-behind cache update (instant)
  ↓
[Background flush every 5s] → [PostgreSQL] Persist
  ↓
Return success/failure to user
```

---

## 🏗️ Arsitektur Patterns

### 1. Service Container (IoC)
```javascript
// src/core/container.js
const container = {
  client: Discord.Client,
  economyContract: EconomyContract,
  cacheManager: CacheManager,
  // ...
};

// Usage
const cacheManager = container.resolve('cacheManager');
```

### 2. Event-Driven Decoupling
```javascript
// Emit local event
eventBus.emit('system:log', payload);

// Broadcast cross-shard
eventBus.broadcast('event:name', payload);
```

### 3. Circuit Breaker (AI Services)
```
CLOSED (normal) → [Error 429] → OPEN (reject requests)
                                      ↓
                               [Timeout expires]
                                      ↓
                              HALF-OPEN (test request)
                                      ↓
                          [Success] → CLOSED
                          [Fail] → OPEN
```

### 4. Components V2 Builder (5-Layer)
```javascript
buildContainerV2()
  .addHeader(title, icon)
  .addSeparatorLine()
  .addContent(fields)
  .addSeparatorDot()
  .addActionRow(buttons)
  .addFooter(text)
  .build();
```

---

## ⚠️ Fatal Gotchas (Jebakan Kritis)

1. **Jangan panggil `process.env.XXX` langsung** - Selalu impor dari `src/config/env.js`
2. **Read-Modify-Write saldo** - Selalu gunakan `cacheManager.increment*` atau `debit*`
3. **Jangan gunakan `ephemeral: true`** - Gunakan `flags: MessageFlags.Ephemeral`
4. **Jangan hardcode warna hex** - Ambil dari `designTokens.js` atau `survivalUIHelper.js`
5. **Jangan simpan `.env` ke Git** - File `.env` dilarang disentuh `git add`
6. **Jangan hapus folder `.cache/`** - Memicu deploy ulang semua slash command
7. **Attachment `attachment://` wajib ada di `files: []`** - Atau error UNFURLED_MEDIA_ITEM
8. **Wrap ButtonInteraction dengan `adaptSurvivalInteraction`** - Sebelum forward ke subcommand
9. **Jangan duplikasi custom_id** - Dalam pesan yang sama
10. **Mutasi parsial UserSurvival** - Gunakan patch object, bukan whole object update
11. **Jangan deleteReply pada ephemeral button response** - Hanya pada chat input command
12. **Stop collector lama dengan alasan `navigated`** - Saat berpindah layar UI
13. **Maksimal 25 subcommands per root command** - Discord API limit
14. **Serialisasi `.toJSON()` sebelum inspeksi options** - Builder internal ≠ REST payload
15. **Konvensi impor env**: `const env = require("../../config/env.js")` (objek langsung)
16. **Jangan reset active page state saat collector timeout** - Cukup disable buttons

---

## 🧪 Testing Strategy

### Unit Tests
```bash
npm test                    # Run all unit tests (node:test)
npm run test:watch         # Watch mode (vitest)
npm run test:coverage      # Coverage report
```

### E2E Tests
```bash
npm run test:e2e           # Playwright E2E
npm run test:e2e:ui        # Playwright UI mode
npm run test:visual        # Visual regression
```

### Integration Tests
```bash
npm run test:requires      # Require integrity
npm run test:inline-scripts # Inline script syntax
npm run test:services      # Service integration
```

### QA Gate (Wajib Sebelum Commit)
```bash
npm run qa                 # All 6 gates sequential
```

---

## 📦 Dependensi Utama

| Kategori | Package | Fungsi |
|----------|---------|--------|
| **Discord** | discord.js v14 | Bot framework |
| **Audio** | poru v5, @discordjs/voice | Lavalink client |
| **Database** | @supabase/supabase-js, mongoose, redis | Polyglot persistence |
| **AI** | @google/genai, axios | Gemini/Groq/Fish Audio |
| **Canvas** | @napi-rs/canvas | Image generation |
| **3D** | three, @pixiv/three-vrm | Dashboard 3D mascot |
| **Web** | express v5, socket.io, vite | Dashboard stack |
| **Testing** | vitest, playwright | Test frameworks |
| **Monitoring** | @sentry/node | Error tracking |

---

## 🔐 Security Best Practices

1. **Environment Variables**: Semua kredensial di `.env`, diakses via `src/config/env.js`
2. **SQL Injection**: Selalu gunakan parameterized queries (Sequelize/Mongoose ORM)
3. **Input Validation**: Sanitasi semua input Discord di plugin layer
4. **Rate Limiting**: Circuit breaker untuk API eksternal, rate limiter untuk endpoint
5. **Atomic Transactions**: Proteksi race condition dengan distributed lock Redis
6. **Webhook Verification**: HMAC SHA-256 constant-time untuk donation webhooks
7. **Secret Detection**: `npm run test:secrets` untuk deteksi kebocoran

---

## 📚 Referensi Dokumen

| Dokumen | Lokasi | Kapan Dibaca |
|---------|--------|--------------|
| README.md | `/README.md` | Setup & gambaran umum |
| PRD.md | `/PRD.md` | Merancang fitur baru |
| DESIGN.md | `/DESIGN.md` | Membuat UI/visual |
| RULES.md | `/RULES.md` | Sebelum menulis kode |
| AGENTS.md | `/AGENTS.md` | SOP AI Agent |
| TODO.md | `/TODO.md` | Backlog & prioritas |
| SECURITY.md | `/SECURITY.md` | Pelaporan vulnerability |

---

## 🎓 Kompetensi yang Dibutuhkan AI Agent

Untuk bekerja efektif di repositori ini, AI agent perlu menguasai:

1. **Node.js 24+ & CommonJS** - `require/module.exports`, dynamic import untuk ESM
2. **Discord.js v14 & Components V2** - Layout 5-lapisan, MessageFlags
3. **Polyglot Database** - Sequelize (PostgreSQL), Mongoose (MongoDB), Redis
4. **Transaksi Atomik** - Increment/debit patterns, distributed locks
5. **Audio Engineering** - Poru v5, Lavalink v4, Fish Audio TTS streaming
6. **Three.js & VRM** - PBR rendering, SpringBones, GLTF/GLB structure
7. **Localization** - Bilingual parity, em dash prohibition
8. **Semantic Versioning** - X.Y.Z versioning scheme
9. **AI Ensemble** - Multi-LLM routing, circuit breaker, failover
10. **Event-Driven Architecture** - Service container, EventBus pub/sub

---

## 🛠️ Quick Reference Commands

```bash
# Development
npm run dev                  # Auto-reload development
npm start                    # Production start with migration

# Testing
npm test                     # Unit tests
npm run qa                   # Full QA gate
npm run test:e2e             # E2E tests

# Code Quality
npm run lint                 # ESLint check
npm run lint:fix             # Auto-fix lint issues
npm run format               # Prettier format

# Database
npm run db:migrate           # Manual migration
npm run db:inspect           # Inspect database

# Dashboard
npm run dashboard:dev        # Dev server
npm run dashboard:build      # Production build

# Utilities
npm run logs                 # View logs
npm run logs:tail            # Follow logs
npm run verify:drift         # Check architectural drift
```

---

## 📞 Support & Resources

- **GitHub Issues**: https://github.com/Aryandita/Naura-Hoshino-V2/issues
- **Documentation**: Lihat folder `/docs` untuk panduan tambahan
- **Skills**: Cek `.agents/skills/` untuk specialized workflows
- **Kilo Config**: `.kilo/` untuk IDE configuration

---

**Dokumen ini dibuat untuk membantu AI agent memahami struktur dan arsitektur repositori Naura Hoshino V2 secara komprehensif.**

*Last Updated: 2026-10-25*  
*Version: 2.4.0*
