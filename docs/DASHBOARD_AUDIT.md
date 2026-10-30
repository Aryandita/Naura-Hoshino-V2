# Dashboard Audit Report - Naura Hoshino V2
**Generated:** 2026-10-23  
**Version:** 2.4.0  
**Auditor:** AI Assistant

---

## 1.1 Kode & Arsitektur - Mapping Lengkap

### Halaman MPA (28 halaman)
| Halaman | Route | Auth Required | Domain | Status |
|---------|-------|---------------|--------|--------|
| Dashboard Utama | `/` | No | Overview | ✅ Active |
| Live Status | `/status` | No | Telemetry | ✅ Active |
| Music Hub | `/music` | Yes | Audio | ✅ Active |
| Economy | `/economy` | No | Economy | ✅ Active |
| Leaderboard | `/leaderboard` | No | Social | ✅ Active |
| Feed | `/feed` | No | Activity | ✅ Active |
| World Map | `/world` | No | RPG | ✅ Active |
| Survival Map | `/survival-map` | No | RPG | ✅ Active |
| Inventory | `/inventory` | Yes | RPG | ✅ Active |
| Profile | `/profile` | Yes | User | ✅ Active |
| Settings | `/settings` | Yes | Config | ✅ Active |
| Welcomer | `/welcomer` | Yes | Config | ✅ Active |
| Builder | `/builder` | No | Config | ✅ Active |
| Automations | `/automations` | Yes | Config | ✅ Active |
| Tickets | `/tickets` | Yes | Support | ✅ Active |
| Admin | `/admin` | Yes | Owner | ✅ Active |
| Clan | `/clan` | No | Social | ⚠️ Partial |
| Marketplace | `/marketplace` | No | Economy | ⚠️ Partial |
| Portfolio | `/portfolio` | No | Social | ✅ Active |
| Topology | `/topology` | No | System | ✅ Active |
| Soundboard | `/soundboard` | No | Audio | ✅ Active |
| Jam Session | `/jam` | No | Audio | ✅ Active |
| Karaoke | `/karaoke` | No | Audio | ✅ Active |
| Lounge | `/lounge` | No | Social | ✅ Active |
| War Room | `/war-room` | No | RPG | ✅ Active |
| Treasury | `/treasury` | No | Economy | ✅ Active |
| Arcade | `/arcade` | No | RPG | ✅ Active |
| Achievements | `/achievements` | No | RPG | ✅ Active |
| Login | `/login` | No | Auth | ✅ Active |

### Route API (19 router files)
| Router | Endpoint Prefix | Deskripsi |
|--------|-----------------|-----------|
| `auth.js` | `/auth/*` | Status, refresh, reconnect session |
| `public.js` | `/api/*` | Stats, economy_stats, items, leaderboard, achievements, treasury |
| `user.js` | `/api/*` | Me, profile, inventory, language, persona |
| `guild.js` | `/api/guilds/*` | Manageable guilds, config, welcomer, minecraft bridge |
| `owner.js` | `/api/owner/*` | God Mode: stats, update_user, heal_user, eval |
| `api.js` | `/api/*` | Health detailed, telemetry, economy, music, activity, admin |
| `survival.js` | `/api/survival/*` | Profile, territory grid, relic towers, world boss |
| `ai.js` | `/api/ai/*` | AI chat, persona, memory |
| `analytics.js` | `/api/analytics/*` | Metrics, charts |
| `portfolio.js` | `/api/portfolio/*` | Portfolio CRUD |
| `tickets.js` | `/api/tickets/*` | Ticket management |
| `donationWebhooks.js` | `/webhook/*` | Saweria, Trakteer webhooks |
| `webhooks.js` | `/webhook/*` | Top.gg vote webhooks |
| `socialFeed.js` | `/api/feed/*` | Activity feed |
| `activity.js` | `/api/activity/*` | Chat, radar, world POIs |

### Komponen 3D
| Komponen | Lokasi | Fitur |
|----------|--------|-------|
| NauraHeroViewer | `dashboard/src/components/NauraHeroViewer/` | Hero 3D di dashboard utama, model VRM/GLB, animasi, particle |
| NauraViewer | `dashboard/src/components/NauraViewer/` | Floating widget multi-tab: Chat AI, Music Player, HUD Telemetry |
| Activity3DWorld | `dashboard/src/components/Activity/activity3dWorld.js` | 3D world untuk activity hub |

### Auth Flow
1. **Discord OAuth2** - `passport-discord` strategy, callback `/auth/discord/callback`
2. **Session** - Express-session dengan `naura.sid` cookie, 24h maxAge
3. **Supabase Auth** - Tab terpisah di modal login (belum terintegrasi penuh)
4. **Sandbox Mode** - 3 profil simulasi (Owner, VIP, Adventurer) untuk testing
5. **Trust Banner** - Anti-phishing banner untuk halaman data sensitif
6. **Auto-reconnect** - `/auth/refresh` & `/auth/reconnect` endpoints

---

## 1.2 Database Integration Audit

### Migrasi (46 migrasi di `dbMigrator.js`)
- **v1-v10:** Indeks & kolom dasar (mannersPoint, dailyNotify, economy_deposit, dll)
- **v11-v20:** Reputation, language, aiPersona, activeBanners, role_leases, giveaway, clan
- **v21-v30:** Duel records, notification_prefs, pet upgrade, world_boss, clan_territory, user_cards, card_decks, minecraft_links, prediction_markets
- **v31-v46:** World boss phases, user_cafes, cross_server_caravans, user_portfolios, season_passes, user_greenhouses, guild_personas, server_stocks, user_stock_holdings, coliseum_teams

### Models Sequelize (26 model)
| Model | Tabel | Deskripsi |
|-------|-------|-----------|
| UserProfile | `user_profiles` | Profil utama: economy, leveling, music, inventory, premium |
| UserSurvival | `UserSurvivals` | Survival RPG: vitals, stats, location, rpg_state, currency |
| GuildSettings | `guild_settings` | Konfigurasi per-server: prefix, modules, music, automod, AI |
| UserPet | `UserPets` | Sistem pet: mood, evolution, passiveSkill |
| UserNPC | `UserNPCs` | Bond dengan NPC |
| UserChild | `UserChildren` | Sistem anak/waris |
| UserFarm | `UserFarms` | Pertanian |
| CanvasAsset | `canvas_assets` | Aset gambar kartu profil |
| UserCosmetic | `user_cosmetics` | Kosmetik avatar |
| GameItem | `game_items` | Katalog item RPG |
| ... | ... | 16 model lainnya |

### Cache Manager (Write-Behind)
- **FLUSH_INTERVAL_MS:** 5000 (5 detik)
- **PROFILE_TTL:** 3600s (1 jam)
- **SURVIVAL_TTL:** 1800s (30 menit)
- **GUILD_TTL:** 300s (5 menit)

**Operasi Atomik:**
- `incrementUserProfile()` / `debitUserProfile()` - saldo numerik
- `mutateUserProfileJson()` - JSON (inventory, rpg_state, cooldowns)
- `incrementUserSurvival()` / `debitUserSurvival()` - survival stats
- `mutateUserSurvivalJson()` - survival JSON

### Redis Manager
- **Mode:** Redis Cluster / In-memory fallback
- **Pub/Sub:** `cluster:stats_update`, `leaderboard:live`
- **Lock:** Lua script untuk atomic release
- **Retry:** Exponential backoff (2s, 4s, 8s)

### MongoDB Manager
- **Models:** Log, analytics, chat history
- **Status:** ReadyState monitoring

---

## 1.3 Design System Audit

### Design Tokens (SSOT: `src/config/tokens/designTokens.js`)
| Kategori | Token | Hex | CSS Var |
|----------|-------|-----|---------|
| **BRAND** | primary | #FFC0CB | --naura-primary |
| | secondary | #F472B6 | --naura-secondary |
| | accent | #00FFFF | --naura-accent |
| **SURVIVAL** | emerald | #86EFAC | --wilds-emerald |
| | moss | #34D399 | --wilds-moss |
| | amber | #FBBF24 | --wilds-amber |
| **RARITY** | common-uncommon-rare-epic-legendary-mythic | 6 tier | --rarity-* |
| **STATUS** | online-idle-dnd-maintenance-syncing | 5 status | --status-* |
| **SYSTEMS** | economy-music-battle-rank-hub | 5 sistem | --system-* |
| **SEMANTIC** | success-error-warning-info-crafting-mining-fishing | 15+ | --semantic-* |

### CSS Architecture
```
tokens.css (270 lines) - CSS Custom Properties dari designTokens.js
  ├── 6 Tema: midnight, sakura, cyber-neon, emerald-nature, light-horizon, oled
  ├── Density modes: compact/comfortable/spacious
  ├── Motion: spring physics (--ease-spring, --ease-tactile)
  └── Fluid typography: clamp()
stellar.css (2692 lines) - Global styles + layout
  ├── App Shell, Sidebar, Header, Bento Grid
  ├── Components: Card, StatCard, Badge, Pill, UptimeBar
  └── Animations, Skeletons, Error/Empty states
components.css (1054 lines) - Reusable component styles
```

### 3D Viewer Integration
- **Three.js** + **@pixiv/three-vrm** untuk VRM/GLB
- **Web Workers** via `canvasWorkerPool.js` untuk offload rendering
- **Animation System:** 15+ sequences (idle, wave, thinking, starpose, sleepy, shy, dizzy, cheers, blowkiss, astralcast)
- **Particles:** Custom particle system
- **Model Switcher:** NEW VRM, VRM, GLB buttons

---

## 1.4 Auth & Session Audit

### Session Configuration
```javascript
session({
  name: 'naura.sid',
  secret: SESSION_SECRET (env atau crypto.randomBytes),
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
    maxAge: 24h
  }
})
```

### Security Features
- ✅ Helmet (CSP disabled for inline scripts)
- ✅ CORS dengan origin whitelist (`DASHBOARD_ORIGIN`)
- ✅ Rate limiting: API 300/min, Auth 20/min, Owner 30/min
- ✅ Constant-time HMAC verification untuk webhook
- ✅ Open redirect protection di OAuth callback
- ✅ Session destroy on logout

### Auth Middleware
| Middleware | Fungsi |
|------------|--------|
| `requireLogin` | Redirect ke `/login` jika unauthenticated |
| `requireApiLogin` | Return 401 JSON untuk API |
| `requireSelfOrOwner` | Validasi userId target = session user atau owner |
| `requireGuildManager` | Validasi permission `MANAGE_GUILD` di Discord |
| `requireOwner` | Validasi OWNER_IDS |
| `isOwner` | Helper check OWNER_IDS |

---

## 1.5 Baseline Testing - Gap Analysis

### Current Test Coverage
| Area | Status | Files |
|------|--------|-------|
| Unit Tests | ❌ None | - |
| Integration Tests | ⚠️ Partial | `routes/*.test.js` (3 files) |
| E2E Tests | ❌ None | - |
| Visual Regression | ❌ None | - |
| API Contract Tests | ❌ None | - |
| Load Tests | ❌ None | - |

### Required Test Infrastructure
```json
{
  "playwright": "E2E + Visual Regression",
  "vitest": "Unit + Integration",
  "k6": "Load Testing",
  "openapi-spec-validator": "API Contract"
}
```

### Test Scripts Needed
```json
{
  "test": "vitest run",
  "test:e2e": "playwright test",
  "test:visual": "playwright test --project=visual",
  "test:load": "k6 run load-test.js",
  "test:api": "vitest run tests/api"
}
```

---

## Summary: Critical Findings

| Priority | Issue | Impact |
|----------|-------|--------|
| 🔴 **Critical** | No automated testing | Regression risk high |
| 🔴 **Critical** | 5s write-behind cache | Stale data on dashboard |
| 🟡 **High** | Duplicate color tokens | `tokens.css` vs `designTokens.js` drift |
| 🟡 **High** | Inline styles in HTML | 50KB+ inline CSS in `index.html` |
| 🟡 **High** | No API versioning | Breaking changes risk |
| 🟢 **Medium** | Sandbox Supabase Auth not connected | Incomplete auth flow |
| 🟢 **Medium** | Mobile sub-app separate build | Code duplication |

---

## Next Steps (Phase 2)
1. **Design Token Sync** - Generate `tokens.css` from `designTokens.js` at build time
2. **Component Library** - Extract reusable Web Components
3. **API Contract** - OpenAPI 3.1 spec generation
4. **Test Infrastructure** - Playwright + Vitest setup
5. **Cache Invalidation** - Event-driven instead of time-based