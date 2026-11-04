# Changelog

All notable changes to Naura Hoshino V2 will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.5.0] - 2026-11-04

### 🚀 Added
- **Layered 3-Pillar Design System**:
  - Pilar 1: THEME_NAURA (Senja Ruang Ekskul) - Nuansa Cherry Blossom, hangat, dan ramah untuk persona inti Discord & profil.
  - Pilar 2: THEME_SURVIVAL (Jurnal Ekspedisi Dunia Adisha) - Nuansa petualangan Adisha, moss green, parchment, dan RPG lore.
  - Pilar 3: THEME_DASHBOARD (Studio Kontrol OSIS) - Matte deep slate, cyberpunk accents, dan glassmorphism terukur untuk monitoring.
  - Single Source of Truth tokens di `src/config/tokens/designTokens.js` dan CSS generation via `scripts/generate-css-tokens.js`.
- **Anti-Slop 3D Tactile Micro-Tilt**:
  - `tactileTilt.js` engine dengan rAF pooling, max 3.5 derajat rotasi, specular highlight matte, dan `prefers-reduced-motion` safety.
- **3-Pillar Dock Switcher & Navigation Filtering**:
  - Komponen navigasi dinamis dengan filter menu per pilar (Ekskul, Adisha, Kontrol) di `sharedNav.js`.
- **Lore Modernization**:
  - Penyelarasan nama dunia survival dari Sukamaju menjadi Adisha di seluruh dialog NPC, catalog, story scene, dan 4 bahasa locale (id, en, es, ja).

### 🛡️ Security & Performance
- **Strix Security Hardening**:
  - Guest sessions capped ke 500 entri dengan TTL 30 menit.
  - Cooldown 1 jam pada berkat NPC Kades Tirto (`lastKadesBlessingAt`) via atomic mutation.
  - One-time claim guard untuk starter kit Bagas dan pancing Mang Ujang.
  - Daily quest auto-recording hook pada aktivitas gathering (`/activity/gather`).
  - Open Graph meta tag XSS sanitization di route portfolio (`/u/:userId`).
  - Proteksi rute `/metrics` terhadap akses eksternal tanpa otorisasi.
  - Optimasi query agregasi database `/api/economy_stats` menggunakan SQL SUM langsung alih-alih full table scan.
  - Pembelian marketplace atomik (`POST /marketplace/buy`) dengan kompensasi rollback.
  - Rate limiting AI companion chat dan TTS (20 request/menit).
  - Socket.IO session user binding untuk mencegah ID spoofing.

---

## [2.4.0] - 2026-10-25

### 🚀 Added

#### New Commands
- **`/survival chronicle`** - Generate narasi sinematik dari peristiwa server
  - 5 gaya narasi: epic, mysterious, cheerful, dramatic, poetic
  - 6 tipe event: boss_defeat, festival, trade_milestone, dungeon_clear, clan_war, generic
  - Template-based narration tanpa AI API dependency
  
- **`/survival raidplan`** - Analisis komposisi party dan strategi raid optimal
  - Party composition analysis dengan role balance scoring
  - Strategy recommendations (formation, approach, risk level)
  - Battle phase planning dan callout system
  
- **`/economy analyze`** - Analisis tren ekonomi server dan rekomendasi balancing
  - Currency health assessment (SC/PD/VB/BA)
  - Inflasi/deflasi detection dengan alerts
  - Balancing recommendations (money sink/faucet)

#### Features
- **3D Animation Sequences** untuk NauraViewer dashboard
  - 9 animation modules: cafe, dance, nod, rpg, sit, social, turn, type, walk
  - Procedural animation system untuk Three.js/VRM avatar
  - Dynamic emotion-driven gesture system
  
- **E2E Test Suite** dengan Playwright
  - command.spec.js untuk slash command testing
  - login.spec.js untuk authentication flow
  - transaction.spec.js untuk economy operations
  - Page object models untuk maintainable tests
  
- **Multilingual Support Expansion**
  - Spanish (es.json) dengan full translation coverage
  - Japanese (ja.json) dengan full translation coverage
  - Expand dari 2 bahasa ke 4 bahasa (ID/EN/ES/JA)
  
- **29 New Survival Game Engines**
  - achievementEngine, alchemyEngine, bulletinBoardEngine
  - craftingMasteryEngine, franchiseEngine, guildDemocracyEngine
  - guildReputationEngine, guildTaxEngine, homeDecorationEngine
  - idempotencyGuard, insuranceLoanEngine, inventoryCapacityEngine
  - itemDecayEngine, lootTableEngine, mentorEngine
  - neighborhoodEngine, npcBackstoryEngine, npcScheduleEngine
  - petBreedingEngine, prophecyEngine, resourceRespawnEngine
  - roamEngine, secretSocietyEngine, storyEngine
  - talentShowEngine, tournamentBracketEngine, tradeEscrowEngine
  - treasureHuntEngine, visualNovelRenderer

#### Documentation
- REPOSITORY_STRUCTURE.md - Complete repository map for AI agents
- AUDIT_REPORT.md - Comprehensive repository health analysis
- IMPROVEMENT_PLAN.md - Executable action items and roadmap
- docs/3D_MODEL_SPECIFICATION.md - GLB/VRM standards
- docs/API_PROTECTION_GUIDE.md - Security best practices
- docs/ROAM_ASSET_PROMPTS.md - Asset generation prompts
- docs/ROAM_NPC_PORTRAIT_PROMPTS.md - NPC portrait prompts
- docs/STORY_INTEGRATION_GUIDE.md - Narrative system guide
- docs/T5-OPTIMIZATION-SUMMARY.md - Performance tuning
- docs/VISUAL_NOVEL_SYSTEM.md - Interactive storytelling
- docs/database-indexes.md - Query optimization guide

#### Scripts
- `scripts/optimize-db-indexes.js` - Database index optimization
- `scripts/clean-mojibake.js` - Character encoding cleanup
- `scripts/bake-animations-glb.js` - Animation baking utility
- `scripts/generate-roam-assets.js` - Roam asset generator
- `scripts/verify-baked-glb.js` - GLB verification tool

### 🔧 Fixed

#### Performance
- **Database Query Optimization**
  - Add timeout protection di cacheManager.getUserProfile
  - Implement fire-and-forget caching pattern
  - Create index optimization script (target: 1640ms → <200ms)
  
- **AI Service Reliability**
  - Update Groq model fallback chain (llama-3.2-3b-preview → llama-3.2-1b-preview)
  - Add channel validation guard di aiDjTrackService
  - Improve error handling dan graceful degradation

#### Code Quality
- Fix ESLint prefer-const warning di clean-mojibake.js
- Remove deprecated naura_animated.glb model file
- Standardize error handling across 47 survival subcommands
- Optimize Components V2 layout patterns

### ⚡ Optimized

#### Testing
- QA gate test timeout configuration (30s default)
- Add 18 unit tests untuk 3 new commands (100% coverage)
- Expand E2E test suite dengan Playwright
- Improve test execution speed (~400ms untuk unit tests)

#### Architecture
- Refactor plugin structure untuk better modularity
- Create dedicated economy plugin directory
- Improve service layer organization
- Enhance utility function reusability

### 📊 Metrics

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Uncommitted Files | 345 | 0 | ✅ 100% |
| Test Coverage | ~75% | ~85% | 📈 +10% |
| Unit Tests | 1204 | 1222 | ➕ +18 |
| E2E Tests | 4 specs | 6 specs | ➕ +50% |
| Languages | 2 (ID/EN) | 4 (ID/EN/ES/JA) | 🌐 +100% |
| Survival Engines | 16 | 45 | 🎮 +181% |
| Documentation Files | 8 | 18 | 📚 +125% |

### 🔒 Security
- No security vulnerabilities detected
- All webhook signatures validated
- SQL injection prevention maintained
- XSS protection active

### 🐛 Known Issues
- Database query time masih tinggi (1640ms) - requires index optimization script execution
- Beberapa E2E tests perlu expansion untuk full coverage
- AI model monitoring endpoint belum implemented

### 📝 Migration Notes
- Run `node scripts/optimize-db-indexes.js` untuk database performance improvement
- Update `.env` jika menggunakan Groq API (model changed)
- Clear Redis cache setelah deployment untuk ensure fresh data

---

## [2.3.0] - Previous Release

See [git history](https://github.com/Aryandita/Naura-Hoshino-V2/commits/main) for details.

---

## Version History

- **2.4.0** - Feature expansion & quality improvements (2026-10-25)
- **2.3.x** - Previous iterations

---

*This changelog is automatically updated with each release.*
