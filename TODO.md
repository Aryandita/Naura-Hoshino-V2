# TODO Naura Hoshino V2 - Roadmap & Task Management

Daftar pekerjaan strategis berdasarkan audit arsitektur, kebutuhan sistem, dan riset eksternal (2026).
Roadmap ini disusun dan diurutkan secara ketat mengikuti **4 Kategori Prioritas**:

1. 🚨 **KRITIS** (Perlu perbaikan langsung/segera: keamanan data, integritas moneter, stabilitas koneksi inti).
2. 🔥 **TINGGI** (Prioritas kedua setelah Kritis: fitur arsitektur vital, retensi pengguna utama, performa skala besar)
3. ⚡ **NORMAL** (Prioritas standar: fitur ekspansi reguler, bisa dikerjakan kapan pun tanpa mengganggu operasi bot)
4. ✨ **OPTIONAL** (Prioritas opsional: kosmetik, eksperimen inovasi lanjutan, tidak berpengaruh jika dilewati)

---

## 📌 Keputusan Arsitektur yang Sudah Ditetapkan

Keputusan berikut adalah sumber kebenaran. Semua dokumen lain harus mengikutinya.

| Topik                    | Keputusan                                                                                                                                   |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **Format Versi**         | Standar X.Y.Z: X = Era Keseluruhan (2), Y = Major Update (4), Z = Minor Update (0). Rilis aktif saat ini: **v2.4.0** (SSOT di `package.json`). |
| **Versi Node**           | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian.                                                             |
| **Penyimpanan Bahasa**   | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi.                      |
| **Strategi Sharding**    | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering.                                          |
| **Polyglot Persistence** | Supabase (PostgreSQL 46 migrasi), Redis untuk cache & Pub/Sub, MongoDB untuk audit log/transkrip, SQLite untuk fallback darurat.            |
| **Worker Threads**       | Dedicated Canvas Worker Pool (`worker_threads`) untuk rendering grafis agar event loop bot tetap non-blocking.                              |
| **Sumber Kebenaran**     | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` untuk aturan governance.                              |
| **Alur PR**              | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge.                                            |
| **Target Deploy**        | Panel Pterodactyl dengan perintah `npm start`; urutan migrasi dijamin oleh lifecycle `prestart`.                                            |
| **Mata Uang Langka**     | Voucher Beasiswa (VB) disimpan di kolom `UserSurvival.scholarshipVouchers` (bukan JSON) agar dapat didebit secara atomik.                                        |
| **Komponen UI Discord**  | Respons command wajib Discord Components V2 (`buildContainerV2()`) dengan struktur 5-lapisan.                                               |

---

# 🚀 DAFTAR TUGAS AKTIF BERDASARKAN PRIORITAS

---

## 🚨 1. KATEGORI: KRITIS (Perlu Perbaikan Langsung / Segera)

> **Kriteria:** Mempengaruhi integritas data, keamanan saldo/ekonomi, stabilitas koneksi WebSocket, dan pencegahan eksploitasi sistem.

- [x] **[SURVIVAL ADISHA WORLD MAP V2: KAMPUS UNIVERSITAS DRAKEN, KAWASAN TAMBANG RAKSASA, DEALER KENDARAAN & RESTRIKSI MOTOR] Peta Interaktif Web Dashboard, Navigasi Roam Berbasis Wilayah & Kendaraan, Dealer Motor 7 Wilayah dengan Buff Permanen/Temporer, dan Aturan Penjualan Motor (Refund 70%)**
  - Mengimplementasikan peta interaktif Dunia Adisha dan ekosistem dealer kendaraan V2 di bot engine dan web dashboard:
  - **Pilar A (Pembaruan Geografi Adisha & Kampus Draken)**: Mengubah Istana Draken menjadi `Kampus Universitas Draken` (`kampus_draken`) sebagai pusat riset astral, perpustakaan kuno, lab hextech, dan beasiswa VB, dengan mempertahankan alias backward-compatible `istana_draken`.
  - **Pilar B (Kawasan Mandiri Tambang Raksasa & Restriksi Kendaraan)**: Menambahkan kawasan ke-7 `Tambang Raksasa` (`tambang_raksasa`) sebagai wilayah eksplorasi mandiri (bukan sub-lokasi) dengan proteksi akses `requiresVehicle: true`, yang hanya bisa dijelajahi jika pemain telah memiliki kendaraan bermotor.
  - **Pilar C (Dealer Motor & Ekosistem Kendaraan V2)**: Menambahkan showroom dealer motor di seluruh 7 kawasan (`dealer_sukamaju`, `dealer_pratama`, `dealer_khulkhas`, `dealer_dhamhai`, `dealer_lauhthan`, `dealer_draken`, `dealer_tambang`) dengan 7 motor unik (`ADISHA_VEHICLES`), diskon stamina roam (25%-50%), stat boost permanen, dan buff temporer eksklusif.
  - **Pilar D (Aturan Kepemilikan 1 Kendaraan & Jual Motor 70%)**: Membatasi kepemilikan pemain menjadi tepat 1 kendaraan aktif. Endpoint jual motor (`POST /api/survival/world/vehicle/sell`) mengembalikan 70% dari harga asli dalam mata uang pembelian aslinya (SC/PD/VB) secara atomik sebelum pemain dapat membeli kendaraan baru.
  - **Pilar E (Peta Interaktif Web Dashboard & HUD Kendaraan)**: Halaman `dashboard/src/pages/adisha-map.html` dengan visual SVG kontur wilayah, HUD status motor aktif, drawer detail lokasi dengan syarat kerja/roam, modal konfirmasi penjualan motor, dan showroom dealer kendaraan responsif.
  - File: [`src/survival/data/adishaWorldData.js`](src/survival/data/adishaWorldData.js), [`dashboard/routes/survival.js`](dashboard/routes/survival.js), [`dashboard/src/pages/adisha-map.html`](dashboard/src/pages/adisha-map.html), [`TODO.md`](TODO.md).

- [x] **[SURVIVAL NAURA WILDS V2 CLOSED-LOOP CURRENCY MIGRATION, DYNAMIC VISUAL BACKGROUNDS & ZERO DEAD-END CARDS] Universal Visual Background Integration (Desa, Kota, Hutan, Tambang, Laut, Park, Academy), Closed-Loop Currency Standardization (Sukamaju Koin SC, Pratama Dollar PD, Voucher Beasiswa VB), Full 5-Layer Components V2 Action Rows, and Zero Dead-End Interconnection**
  - Mengaudit, memperbarui, dan menyambungkan 58 subcommand survival (`plugin/survival/subcommands/`) dan core engine (`src/survival/`) ke standar visual dinamis dan moneter V2 Closed-Loop:
  - **Pilar A (Penyelarasan Moneter V2 Closed-Loop)**: Mengeliminasi total seluruh residu nama mata uang lama (`Star Fragment`/`NSF`, `Naura Coin`/`NC`, `Naura Coupon`/`Kupon`) di seluruh kartu, log, kalkulasi perbankan, kas klan, pasar, lelang, karavan, sayembara buronan, event, farm, dan ekspedisi menjadi mata uang resmi (`Sukamaju Koin (SC)`, `Pratama Dollar (PD)`, `Voucher Beasiswa (VB)`). Memperbarui One-Way Bridge di `bank.js` dan sinkronisasi log transaksi atomik.
  - **Pilar B (Visual Background Dinamis & Fallback Canvas)**: Menggantikan banner statis repetitif dengan sistem latar dinamis adaptif 4 waktu (pagi, siang, sore, malam) dan 7 wilayah (`desa`, `kota`, `hutan`, `tambang`, `laut`, `park`, `academy`) via `survivalUI.getSurvivalBackground()`. Menghubungkan top banner dinamis pada `market.js`, `bankViews.js`, `collect.js`, `dungeon.js` (danger card latar tambang malam), serta memasang visual fallback wilayah otomatis pada `inventory.js` dan `info.js` saat worker canvas timeout atau gagal.
  - **Pilar C (Zero Dead-End Cards & Interkoneksi Navigasi)**: Mengeliminasi kartu buntu di seluruh alur bermain survival dengan menyematkan `buttonsRow` terpadu (`survivalUI.buildSurvivalActionRow("town"|"combat"|"gathering", userId)`) pada kartu klan, peta dominasi wilayah (`conquest.js`), hasil raid (`federation.js`), event reward claim, papan buronan kosong/menang/kalah (`bounty.js`), panen/penyiraman/mutasi kebun (`farm.js`), abyss wager, pasar desa (`market.js`), filter ransel (`inventory.js`), dan profil lengkap (`info.js`).
  - **Pilar D (Kompatibilitas Discord Components V2 & QA Guard)**: Memastikan penggunaan `MessageFlags.Ephemeral` murni (tanpa `flags: 64`), pembersihan duplikasi ID komponen, 100% bebas karakter em-dash (`\u2014`), serta kepatuhan 5-lapisan Components V2.
  - File: [`plugin/survival/subcommands/bank.js`](plugin/survival/subcommands/bank.js), [`src/survival/helpers/bankViews.js`](src/survival/helpers/bankViews.js), [`plugin/survival/subcommands/clan.js`](plugin/survival/subcommands/clan.js), [`plugin/survival/subcommands/conquest.js`](plugin/survival/subcommands/conquest.js), [`plugin/survival/subcommands/federation.js`](plugin/survival/subcommands/federation.js), [`plugin/survival/subcommands/family.js`](plugin/survival/subcommands/family.js), [`plugin/survival/subcommands/event.js`](plugin/survival/subcommands/event.js), [`plugin/survival/subcommands/duel.js`](plugin/survival/subcommands/duel.js), [`plugin/survival/subcommands/class.js`](plugin/survival/subcommands/class.js), [`plugin/survival/subcommands/auction.js`](plugin/survival/subcommands/auction.js), [`plugin/survival/subcommands/caravan.js`](plugin/survival/subcommands/caravan.js), [`src/survival/engines/caravanEngine.js`](src/survival/engines/caravanEngine.js), [`plugin/survival/subcommands/bounty.js`](plugin/survival/subcommands/bounty.js), [`src/survival/engines/outlawBountyEngine.js`](src/survival/engines/outlawBountyEngine.js), [`src/survival/engines/petBattleEngine.js`](src/survival/engines/petBattleEngine.js), [`src/survival/engines/worldBossEngine.js`](src/survival/engines/worldBossEngine.js), [`src/survival/data/cafeRecipes.js`](src/survival/data/cafeRecipes.js), [`src/survival/data/worldMapData.js`](src/survival/data/worldMapData.js), [`src/survival/data/storyData.js`](src/survival/data/storyData.js), [`plugin/survival/subcommands/abyss.js`](plugin/survival/subcommands/abyss.js), [`plugin/survival/subcommands/cafe.js`](plugin/survival/subcommands/cafe.js), [`plugin/survival/subcommands/farm.js`](plugin/survival/subcommands/farm.js), [`plugin/survival/subcommands/market.js`](plugin/survival/subcommands/market.js), [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js), [`plugin/survival/subcommands/dungeon.js`](plugin/survival/subcommands/dungeon.js), [`plugin/survival/subcommands/collect.js`](plugin/survival/subcommands/collect.js), [`src/utils/survivalUIHelper.js`](src/utils/survivalUIHelper.js), [`TODO.md`](TODO.md).

- [x] **[SURVIVAL NAURA WILDS OVERHAUL: VISUAL NOVEL STORY ENGINE, ROAM SYSTEM, MIGRATION V50 & ZERO LINT QA] Dual-Persistence StoryProgress & UserNPCs, Pure Atomic Date Tickets, Discord Components V2 Multi-Branching VN Renderer, and Universal Roam Navigation**
  - Mengaudit, memperbaiki, memodernisasi, dan memvalidasi ekosistem Naura Wilds (`plugin/survival/` & `src/survival/`) secara menyeluruh:
  - **Pilar A (Skema Database & Migrasi v50)**: Pembuatan migrasi `v50_create_story_progress_and_user_npcs` di `src/managers/dbMigrator.js` yang kompatibel dengan PostgreSQL Supabase dan MySQL; pembuatan tabel relasional `story_progress` (kolom JSON: `completedScenes`, `flags`, `choices`, `unlockedBackstories`) dan `user_npcs` (afeksi, level relasi, status kencan); penambahan kolom JSON `storyProgress` dan `roamStats` di model `UserSurvival.js` serta `StoryProgress.js`.
  - **Pilar B (Story Engine & Visual Novel Multi-Branching)**: Implementasi pemuatan chapter dinamis dari `src/survival/data/story/` (`prologue.js`); eksekusi pilihan percabangan `makeChoice` dengan evaluasi efek afeksi NPC real-time (`UserNPC`), tracking status scene selesai (`markSceneCompleted`), conditional flags (`setStoryFlag`), dan rekaman keputusan (`recordChoice`) dengan sinkronisasi ganda `cacheManager` + model database; perbaikan bug deferral ganda pada `/survival story start` dan penanganan in-game hour aman.
  - **Pilar C (Visual Novel Renderer Components V2 & Story Backstory Reader)**: Penyusunan ulang tampilan Visual Novel interaktif di `src/survival/engines/visualNovelRenderer.js` dengan standar 5-lapisan Discord Components V2 (`buildContainerV2`); pemetaan lampiran visual resmi (`topBannerAttachmentName`, `iconURL`); dukungan multi-format dialog (speaker array dan single text); perenderan tombol pilihan interaktif bergaya visual novel dengan button collector terkelola (`createManagedCollector`); antarmuka pembaca lore `/survival story backstory` dengan select menu NPC dan fallback status terkunci.
  - **Pilar D (Roam Engine & Perbaikan Alur Kencan / Pekerjaan)**: Penyelarasan event pertemuan pertama (`firstMeet`) antara `roamEngine.js` dan `npc.js` (`first_encounter` & `vn_scene`); eliminasi read-modify-write tiket kencan di `npcActions.js` dengan helper atomik `takeItemsAtomic`; integrasi tombol pilihan first encounter dengan transisi langsung ke profil NPC; eliminasi kartu buntu (*zero dead-end cards*) pada `/survival roam` dengan tombol kembali ke dashboard survival (`roam_back_survival`) dan baris tombol aksi kontekstual `survivalUI.buildSurvivalActionRow()`; resolusi bug TDZ `ReferenceError` pada `advanceTime` di `travel.js`.
  - **Pilar E (Zero-Tolerance Linting & 100% QA Gate)**: Pembersihan sisa warning dan error linter pada `roam.js`, `story.js`, `visualNovelRenderer.js`, `setting.js`, dan `generate-roam-assets.js` hingga **0 errors, 0 warnings** pada `npm run lint`; 0 karakter em-dash; 100% paritas kamus bahasa ID/EN (484 kunci sinkron); 100% resolusi internal require (4.465 method calls); 3 unit test suite baru (`test/survivalRoamEngine.test.js`, `test/survivalStoryEngine.test.js`, `test/survivalVisualNovelRenderer.test.js`) 100% hijau; dan seluruh 868 unit tests di repositori lulus hijau (100% pass).
  - File: [`src/managers/dbMigrator.js`](src/managers/dbMigrator.js), [`src/models/UserSurvival.js`](src/models/UserSurvival.js), [`src/models/StoryProgress.js`](src/models/StoryProgress.js), [`src/models/UserNPC.js`](src/models/UserNPC.js), [`src/survival/engines/storyEngine.js`](src/survival/engines/storyEngine.js), [`src/survival/engines/visualNovelRenderer.js`](src/survival/engines/visualNovelRenderer.js), [`src/survival/engines/roamEngine.js`](src/survival/engines/roamEngine.js), [`src/survival/helpers/npcActions.js`](src/survival/helpers/npcActions.js), [`plugin/survival/subcommands/story.js`](plugin/survival/subcommands/story.js), [`plugin/survival/subcommands/roam.js`](plugin/survival/subcommands/roam.js), [`plugin/survival/subcommands/npc.js`](plugin/survival/subcommands/npc.js), [`plugin/survival/subcommands/travel.js`](plugin/survival/subcommands/travel.js), [`test/survivalRoamEngine.test.js`](test/survivalRoamEngine.test.js), [`test/survivalStoryEngine.test.js`](test/survivalStoryEngine.test.js), [`test/survivalVisualNovelRenderer.test.js`](test/survivalVisualNovelRenderer.test.js), [`TODO.md`](TODO.md).

- [x] **[INISIATIF PEMBELAJARAN /LEARN, REAL-TIME DUPLEX VOICE AI, PWA DASHBOARD, TCG CARD BATTLER & SELF-HEALING LAVALINK] Fish Audio TTS Duplex Voice Session, Standalone PWA & Push Notifications, Turn-Based PvP Card Duel, Lavalink Anomaly Migration & Predictive Shard Autoscaler**
  - Mengeksekusi inisiatif pembelajaran arsitektur dan ekspansi ekosistem secara simultan berbasis `/learn`, `/boost`, `/antislop`, `/code-simplification`, dan `/code-review-and-quality`:
  - **Pilar A (/learn Persistensi Aturan & Fatal Gotchas)**: Integrasi Gotchas 13-16 ke `AGENTS.md` Bagian 5 dan `RULES.md` Bagian 1.4.4 (batas 25 subcommands Discord API, serialisasi `.toJSON()` sebelum parsing options, konvensi impor objek langsung `src/config/env.js`, dan preservasi active page state pada collector timeout Components V2).
  - **Pilar B (Real-Time Duplex Voice AI Agent & Fish Audio TTS)**: Layanan sesi suara interaktif dua arah di Discord Voice Channel (`src/ai/duplexVoiceAgent.js`) dengan deteksi aktivitas suara (VAD), pemrosesan dialog Gemini AI, barge-in / interupsi instan, sintesis ucapan Fish Audio TTS (`fishAudioService.generateSpeech`), dan telemetri latensi.
  - **Pilar C (PWA Mobile Dashboard & Push Notifications)**: Implementasi Web App Manifest PWA (`dashboard/public/manifest.json`), service worker offline caching & background sync (`dashboard/public/sw.js`), standarisasi mobile viewport `100dvh` anti-glitch, dan bottom navigation drawer terintegrasi.
  - **Pilar D (Cross-Platform TCG Card Battler PvP Arena)**: Engine pertempuran kartu turn-based 5-deck (`src/services/cardBattleEngine.js`) dengan kalkulasi sinergi elemen (Api, Air, Alam, Cahaya, Gelap), damage formula deterministik, tactical bot AI, dan subcommand Discord `/card battle` berbasis Components V2.
  - **Pilar E (Self-Healing Lavalink Cluster & Shard Autoscaler)**: Health probe background berkala di `src/managers/lavalinkClusterManager.js`, deteksi lonjakan latensi & packet drop rate > 5%, migrasi zero-downtime pemutar lagu antar-node secara transparan, serta `evaluateShardHealth` predictive autoscaler.
  - **Pilar F (Kualitas & Verifikasi QA Gate)**: 941 automated unit tests lolos (100% hijau), 0 ESLint errors/warnings, 0 em-dash, 100% paritas kamus bahasa ID/EN (365 kunci), dan zero drift.
  - File: [`AGENTS.md`](AGENTS.md), [`RULES.md`](RULES.md), [`src/ai/duplexVoiceAgent.js`](src/ai/duplexVoiceAgent.js), [`src/ai/duplexVoiceAgent.test.js`](src/ai/duplexVoiceAgent.test.js), [`dashboard/public/manifest.json`](dashboard/public/manifest.json), [`dashboard/public/sw.js`](dashboard/public/sw.js), [`dashboard/src/css/style.css`](dashboard/src/css/style.css), [`src/services/cardBattleEngine.js`](src/services/cardBattleEngine.js), [`src/services/cardBattleEngine.test.js`](src/services/cardBattleEngine.test.js), [`plugin/card/card.js`](plugin/card/card.js), [`src/managers/lavalinkClusterManager.js`](src/managers/lavalinkClusterManager.js), [`src/music/lavalinkSelfHealing.test.js`](src/music/lavalinkSelfHealing.test.js), [`TODO.md`](TODO.md).

- [x] **[MODERNISASI /CORE HELP & AUDIT HIGIENITAS ANTISLOP] Dynamic Self-Registration Introspection, Quick-Start Bento, Resolusi Blocker Kritis Discord API (Music Limit <=25, Env Leak & Bentrok /fun), Dekomposisi Modular core.js, dan Verifikasi Master QA Gate**
  - Mengaudit, merekayasa ulang, dan memverifikasi sistem panduan `/core help` serta higienitas kode repository secara menyeluruh berbasis `/plan`, `/boost`, `/antislop`, `/antislop-code`, `/antislop-copywriting`, `/code-simplification`, dan `/code-review-and-quality`:
  - **Dynamic Command Registry & Introspection (`src/services/commandRegistry.js`)**: Introspeksi otomatis seluruh slash command langsung dari `client.commands` saat boot; pemetaan rekursif root, subcommands, dan subcommand groups ke dalam 13 kategori publik; isolasi kategori owner; caching in-memory berlatensi O(1); pencarian cepat detail command dan penanganan typo cerdas berbasis Levenshtein.
  - **UI /core help Ramah Pemula (`src/core/helpView.js`)**: Onboarding zero-friction (deteksi bahasa otomatis); Beranda Quick-Start Bento 5 perintah esensial; kartu detail command berformat sintaksis, parameter, dan contoh via `/core help command:<name>`; dropdown kategori dinamis dengan banner resmi; navigasi 5-tombol terkelola (`interactionPipeline`) dengan pagination multi-halaman pada kategori utility (49 perintah).
  - **Resolusi Blocker Kritis Runtime**: Restrukturisasi `plugin/music/music.js` dari 27 menjadi 24 subcommands (di bawah batas keras 25 Discord API) via konsolidasi subcommand `save` ke dalam `playlist` dan opsi audio; eliminasi kebocoran `process.env` di `entitlementService.js`; perbaikan bug destructuring `env` di `economyGuardEngine.js` dan proteksi self-reference di `src/config/env.js`; perluasan ignore pattern pada `CommandHandler.js` agar file test/helper tidak ter-load; konsolidasi perintah `/fun` ke dalam Interactive Hub Launcher terpadu.
  - **Dekomposisi Modular `plugin/core/core.js`**: Pemecahan file monolitik 1.259 baris menjadi subcommands modular di `plugin/core/subcommands/` (`ping.js`, `stats.js`, `info.js`, `about.js`, `partner.js`, `help.js`, `language.js`) dan perampingan router utama menjadi < 90 baris.
  - **Audit Antislop Code & Copywriting**: Pembersihan 353+ komentar banner dekoratif berlebih; pembersihan dead locale keys; verifikasi 0 em-dash (`\u2014`); 100% paritas kamus ID/EN (365 kunci); dan kelulusan 100% Master QA Gate (924+ unit tests hijau).
  - File: [`src/services/commandRegistry.js`](src/services/commandRegistry.js), [`src/services/commandRegistry.test.js`](src/services/commandRegistry.test.js), [`src/core/helpView.js`](src/core/helpView.js), [`src/core/helpView.test.js`](src/core/helpView.test.js), [`plugin/core/core.js`](plugin/core/core.js), [`plugin/core/subcommands/`](plugin/core/subcommands/), [`plugin/music/music.js`](plugin/music/music.js), [`plugin/utility/fun.js`](plugin/utility/fun.js), [`src/services/entitlementService.js`](src/services/entitlementService.js), [`src/services/economyGuardEngine.js`](src/services/economyGuardEngine.js), [`src/config/env.js`](src/config/env.js), [`src/managers/CommandHandler.js`](src/managers/CommandHandler.js), [`assets/language/id.json`](assets/language/id.json), [`assets/language/en.json`](assets/language/en.json), [`TODO.md`](TODO.md).

- [x] **[TEAMWORK PARALLEL SPRINT: PAKET FITUR PREMIUM & USER ENGAGEMENT] Dual-Rail Ingestion (Saweria/Trakteer QRIS & Discord Subscriptions), Taste of Premium Loop, Living AI Persona & Voice DJ Exclusives, Canvas Social Flex & Guild Patron 24/7**
  - Mengaudit, merekayasa, dan memverifikasi paket fitur Premium dan User Engagement Naura Hoshino V2 secara menyeluruh berbasis `/plan`, `/teamwork-preview`, `/code-simplification`, `/ponytail`, `/antislop-ui`, `/antislop-copywriting`, `/security-and-hardening`, dan `/code-review-and-quality`:
  - **Milestone M1 (Dual-Rail Payment Ingestion & Webhook Adapter)**: Pembangunan endpoint webhook donasi QRIS terverifikasi HMAC SHA-256 constant-time (`crypto.timingSafeEqual`) untuk Saweria dan Trakteer di `dashboard/routes/donationWebhooks.js`; ekstraksi Discord Snowflake 17-20 digit via regex (`\b\d{17,20}\b`); sinkronisasi Discord Native App Subscriptions SKU di `src/services/entitlementService.js`; mutasi penambahan durasi langganan atomik dan penerbitan voucher via transaksi database Sequelize berjaminan idempotency (`claimOnce`); migrasi skema database `v46_add_premium_tier_to_user_profiles` dengan kolom `premium_tier` di `UserProfile.js`.
  - **Milestone M2 (Taste of Premium & Habituation Loop)**: Pemberian status VIP Starter 12 jam otomatis pada setiap vote Top.gg di `dashboard/utils/voteRewards.js` & `src/services/voteService.js`; logika event akhir pekan *Weekend Astral Surge* (kupon ganda dan peluang drop voucher trial langganan 1-hari ke inventaris); layanan `src/services/premiumReminderService.js` untuk pengingat masa berlaku cerdas melalui pesan DM ramah khas Naura 24 jam sebelum kedaluwarsa dengan tombol interaktif 1-klik perpanjang dan anti-spam idempotensi.
  - **Milestone M3 (Living AI Persona & Voice DJ Exclusives)**: Kuota turn chat AI tanpa batas (UNLIMITED) untuk Owner dan member VIP Tier 2 ke atas di `src/ai/aiEnsembleRouter.js` dengan suite persona cerdas (`tsundere`, `kuudere`, `gamer`, `butler`, `default`) dan preferensi tersimpan di `src/ai/aiMemory.js`; integrasi fitur *Signature Audio Greeting* berdurasi 3-5 detik via `src/services/fishAudioService.js` dan `src/managers/aiDjManager.js` saat memutar lagu di Voice Channel dengan toggle konfigurasi pengguna.
  - **Milestone M4 (Canvas Social Flex & Guild-Wide Patron Perks)**: Peningkatan grafis kartu profil di `src/canvas/profileCanvas.js` dan dedicated worker `src/canvas/workers/profileWorker.js` dengan bingkai neon hologram multi-warna, taburan efek kilau bintang 4-sudut (star sparkles), dan stempel VIP emas ("✦ VIP ELITE ✦"); implementasi mode standby 24/7 (`stay24_7`) di `src/managers/musicManager.js`, `src/managers/lavalinkClusterManager.js`, dan event `src/music/poru_events/queueEnd.js` agar bot tetap siaga di Voice Channel tanpa batas waktu untuk server tier Guild Patron (Tier 3); perluasan slot custom soundboard Web Studio hingga 50 slot di `src/services/soundboardService.js` dan `plugin/music/soundboard.js`.
  - **Milestone M5 (Kualitas & Verifikasi Penuh QA Gate)**: 100% kelulusan Master QA Gate (0 ESLint error/warning, 0 em-dash, 100% paritas kamus dwibahasa ID/EN, require graph integritas penuh, dan 94+ unit tests baru hijau).
  - File: [`dashboard/routes/donationWebhooks.js`](dashboard/routes/donationWebhooks.js), [`dashboard/routes/donationWebhooks.test.js`](dashboard/routes/donationWebhooks.test.js), [`dashboard/routes/webhooks.js`](dashboard/routes/webhooks.js), [`dashboard/server.js`](dashboard/server.js), [`dashboard/utils/voteRewards.js`](dashboard/utils/voteRewards.js), [`src/services/voteService.js`](src/services/voteService.js), [`src/services/voteService.test.js`](src/services/voteService.test.js), [`src/services/premiumReminderService.js`](src/services/premiumReminderService.js), [`src/services/premiumReminderService.test.js`](src/services/premiumReminderService.test.js), [`src/services/entitlementService.js`](src/services/entitlementService.js), [`src/services/entitlementService.test.js`](src/services/entitlementService.test.js), [`tests/adversarial/m1_stress.test.js`](tests/adversarial/m1_stress.test.js), [`src/ai/aiEnsembleRouter.js`](src/ai/aiEnsembleRouter.js), [`src/ai/aiEnsembleRouter.test.js`](src/ai/aiEnsembleRouter.test.js), [`src/ai/aiMemory.js`](src/ai/aiMemory.js), [`src/ai/aiMemory.test.js`](src/ai/aiMemory.test.js), [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/managers/aiDjManager.js`](src/managers/aiDjManager.js), [`src/managers/aiDjManager.test.js`](src/managers/aiDjManager.test.js), [`src/canvas/profileCanvas.js`](src/canvas/profileCanvas.js), [`src/canvas/workers/profileWorker.js`](src/canvas/workers/profileWorker.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`src/managers/lavalinkClusterManager.js`](src/managers/lavalinkClusterManager.js), [`src/music/poru_events/queueEnd.js`](src/music/poru_events/queueEnd.js), [`src/services/soundboardService.js`](src/services/soundboardService.js), [`plugin/music/soundboard.js`](plugin/music/soundboard.js), [`tests/m4_canvas_patron.test.js`](tests/m4_canvas_patron.test.js), [`TODO.md`](TODO.md).

- [x] **[TEAMWORK PARALLEL SPRINT: MODULARISASI, SIMPLIFIKASI /PONYTAIL, HARMONISASI UI/UX, & HARDENING STRIX] Lightweight Service Container, Two-Tier EventBus, Acyclic Domain Contracts, Interaction Pipeline, SSOT Design Tokens, dan Strix Security Hardening**
  - Mengaudit, merekayasa, menyederhanakan, dan mengamankan fondasi arsitektur Naura Hoshino V2 secara menyeluruh berbasis `/teamwork-preview`, `/code-simplification`, `/ponytail`, `/antislop-ui`, `/antislop-copywriting`, `/design-taste-frontend`, dan `/security-and-hardening`:
  - **Milestone R1 (Modularisasi & Service Registry)**: Pembangunan Lightweight Service Container (`src/core/container.js`) dan Two-Tier Mediator EventBus (`src/core/eventBus.js`) in-memory + Redis Pub/Sub; Composition Root terpadu di `index.js` dan `dashboard/server.js`; eliminasi tuntas monkey-patching `global.client` dan `client.dashboardIo`; pemutusan circular dependency require pada `lavalinkClusterManager`, `fishAudioService`, dan `canvasRuntime`; penyediaan 3 Public Domain Contracts terisolasi berprinsip asiklik (`economyContract.js`, `survivalContract.js`, `musicContract.js`) dengan return frozen.
  - **Milestone R2 (Simplifikasi /ponytail)**: Konsolidasi boilerplate repetitif Discord Interaction Pipeline (`src/utils/interactionPipeline.js`: managed collector, auto-cleanup, navigation guard); utilitas transaksi deklaratif atomik (`src/utils/transactionHelper.js`: executeAtomicPayment dengan compensatory rollback); modul bersama frontend Web Dashboard (`dashboard/public/js/shared-dashboard.js`).
  - **Milestone R3 (Harmonisasi UI/UX & SSOT Design Tokens)**: Single Source of Truth Design Tokens (`src/config/tokens/designTokens.js`) yang menyatukan Hex, Discord Int, RGB String, dan CSS Var antara bot dan web dashboard; tombol navigasi silang `[ 🌐 Buka di Dashboard ]` (`buildDashboardLinkButton()`); integrasi Live Activity Feed real-time via WebSocket.
  - **Milestone R4 (Strix Security Hardening)**: Validasi regex Snowflake Discord (`/^\d{17,20}$/`) pada middleware otorisasi `requireGuildManager`; proteksi otorisasi penutupan tiket `ticket_close` (khusus pemilik tiket atau staf pengelola); pertahanan berlapis terhadap percobaan AI prompt injection dan manipulasi persona di `src/ai/aiHelper.js`.
  - **Milestone R5 (Dokumentasi Pentalogi)**: Penyelarasan komprehensif `RULES.md`, `AGENTS.md`, `DESIGN.md`, dan `TODO.md` agar arsitektur baru terdokumentasi rapi, transparan, dan mudah dipahami.
  - File: [`src/core/container.js`](src/core/container.js), [`src/core/eventBus.js`](src/core/eventBus.js), [`src/domain/contracts/economyContract.js`](src/domain/contracts/economyContract.js), [`src/domain/contracts/survivalContract.js`](src/domain/contracts/survivalContract.js), [`src/domain/contracts/musicContract.js`](src/domain/contracts/musicContract.js), [`src/utils/interactionPipeline.js`](src/utils/interactionPipeline.js), [`src/utils/transactionHelper.js`](src/utils/transactionHelper.js), [`src/config/tokens/designTokens.js`](src/config/tokens/designTokens.js), [`dashboard/public/js/shared-dashboard.js`](dashboard/public/js/shared-dashboard.js), [`dashboard/middleware/auth.js`](dashboard/middleware/auth.js), [`src/interactions/buttons/ticketClose.js`](src/interactions/buttons/ticketClose.js), [`src/ai/aiHelper.js`](src/ai/aiHelper.js), [`RULES.md`](RULES.md), [`AGENTS.md`](AGENTS.md), [`DESIGN.md`](DESIGN.md), [`TODO.md`](TODO.md).

- [x] **[TEAMWORK PARALLEL SPRINT: 5 INOVASI KONTEMPORER] Music Playlist Overhaul, 1 Pet Setia & Satwa Dunia Nyata Anti-Slop, Fun Plugin & Canvas Affinity Social, Daily Interactive Hub & Streak Shield, dan Modernisasi AFK System Components V2**
  - Mengaudit, merekayasa, dan memverifikasi 5 pilar fitur baru Naura Hoshino V2 secara serempak berbasis `/teamwork-preview`, `/i-have-adhd/ponytail`, `/code-simplification`, `/antislop-code`, `/antislop-ui`, `/antislop-copywriting`, `/code-review-and-quality`, dan `/strix-security-audit`:
  - **Pilar 1 (Music Playlist Overhaul)**: Modifikasi `plugin/music/subcommands/playlistEngine.js` dan router `plugin/music/music.js` dengan fungsionalitas hapus playlist (`/music delete` / `deleteplaylist`), penyimpanan antrean aktif ke playlist (`/music save` / `save_queue`), kalkulasi durasi total pemutaran lagu format `hh:mm:ss` pada `/music myplaylist`, serta bypass verifikasi voice channel untuk manajemen playlist.
  - **Pilar 2 (1 Pet Setia & Satwa Dunia Nyata Anti-Slop)**: Pembatasan ketat 1 sahabat pet setia per pemain di `plugin/survival/subcommands/pet.js`; klasifikasi 6 tier kelangkaan (`Common` s/d `Mythic`) berbasis satwa dunia nyata asli (`REAL_WORLD_SPECIES`: Kucing Kampung, Elang Jawa, Harimau Sumatera, Gajah Sumatera Putih, dsb.) via `src/survival/helpers/petRarity.js`; katalog 9 item eksklusif foraging pet berbasis benda geologi & alamiah nyata (`obsidian_stone`, `damar_resin`, `wild_honeycomb`, `peacock_feather`, `swallow_nest`, dsb.) dengan deskripsi manusiawi anti AI slop; mutasi inventaris atomik via `addItemsAtomic`.
  - **Pilar 3 (Fun Commands & Canvas Social Affinity)**: Pemisahan bersih modul hiburan murni dari minigame berisiko di `plugin/fun/fun.js` (`/fun affinity`, `/fun ship`, `/fun tod`, `/fun 8ball`, `/fun coinflip`); generator kartu grafis Canvas dual-avatar resolusi 960x540 (`src/canvas/affinityCanvas.js`) via Worker Pool; integrasi menu bantuan `src/core/helpView.js` dan 100% paritas kamus dwibahasa ID/EN (356 kunci sinkron).
  - **Pilar 4 (Daily Interactive Hub & Streak Shield)**: Transformasi `plugin/utility/daily.js` menjadi hub interaktif Discord Components V2 dengan tombol aksi (`[Klaim Hadiah]`, `[Misi Harian]`, `[Pelindung Streak]`) dan checklist visual status; item Jimat Pelindung Streak (`streak_shield`) di `items_catalog.js` untuk menyelamatkan streak harian yang terlewat > 48 jam secara atomik via `takeItemsAtomic`.
  - **Pilar 5 (Modernisasi AFK System & Mention Digest)**: Migrasi menyeluruh `src/events/messageCreate/afk.js` ke Discord Components V2 (`buildContainerV2`); pencatatan mention atomik `mutateUserProfileJson(mentioned.id, 'afk_mentions', ...)` hingga 10 pesan lengkap dengan timestamp Discord & jump URL; penyajian laporan Mention Digest terstruktur dan pemulihan nickname tanpa duplikasi prefix `[AFK]`.
  - **Kualitas & Verifikasi Penuh**: 678 automated unit tests hijau termasuk `tests/new_pillars_v2_3.test.js`, 0 ESLint errors/warnings, 0 em-dash, 100% paritas kamus dwibahasa (356 keys), dan kepatuhan penuh aturan transaksi atomik repositori.
  - File: [`plugin/music/subcommands/playlistEngine.js`](plugin/music/subcommands/playlistEngine.js), [`plugin/music/music.js`](plugin/music/music.js), [`src/survival/helpers/petRarity.js`](src/survival/helpers/petRarity.js), [`src/survival/data/items_catalog.js`](src/survival/data/items_catalog.js), [`plugin/survival/subcommands/pet.js`](plugin/survival/subcommands/pet.js), [`plugin/fun/fun.js`](plugin/fun/fun.js), [`src/canvas/affinityCanvas.js`](src/canvas/affinityCanvas.js), [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`src/core/helpView.js`](src/core/helpView.js), [`assets/language/id.json`](assets/language/id.json), [`assets/language/en.json`](assets/language/en.json), [`plugin/utility/daily.js`](plugin/utility/daily.js), [`src/events/messageCreate/afk.js`](src/events/messageCreate/afk.js), [`plugin/utility/afk.js`](plugin/utility/afk.js), [`tests/new_pillars_v2_3.test.js`](tests/new_pillars_v2_3.test.js), [`TODO.md`](TODO.md).

- [x] **[TEAMWORK PARALLEL SPRINT: 5 PILAR EKSPANSI - MUSIK, MINIGAMES, DASHBOARD, AUTOMOD & UTILITY] Remote Player & Sleep/Seek, Blackjack & TypeRace Arcade, Soundboard & Automod Studios, Phishing Shield & Ghost Ping Tracker, Canvas Carbon Code & Visual Poll Chart**
  - Mengaudit, mengembangkan, dan memverifikasi 5 pilar inovasi baru Naura Hoshino V2 secara paralel berbasis `/teamwork-preview`, `/i-have-adhd/ponytail`, `/code-simplification`, `/antislop-code`, `/antislop-ui`, `/antislop-copywriting`, `/code-review-and-quality`, dan `/strix-security-audit`:
  - **Pilar 1 (Musik Lanjutan)**: `/music seek <timestamp>` presisi format (`mm:ss`, `hh:mm:ss`, detik), `/music sleep <menit>` dengan graceful fade-out volume 15 detik sebelum auto-disconnect, dan Web Remote Player (`dashboard/public/player.html`) tema Stellar Cyberpunk berdaya Socket.IO live sync.
  - **Pilar 2 (Arcade Minigames)**: `/minigame blackjack` (`src/services/blackjackEngine.js`) kartu 52-standar, shuffle Fisher-Yates, split, double down, dealer stand 17, soft/hard Ace, payout 3:2, dan taruhan SC atomik; `/minigame typerace` (`src/services/typeRaceEngine.js`) kompetisi ketik WPM interaktif via Discord Modal dan kalkulasi akurasi Levenshtein.
  - **Pilar 3 (Web Dashboard Studios)**: Web Soundboard Studio (`dashboard/public/soundboard.html`) 100% WebSocket real-time dengan 15 SFX preset dan Canvas spectrum visualizer; Visual Automod Studio (`dashboard/public/automod.html`) konfigurasi aturan filter kata, spam, slider mention, dan matriks hukuman.
  - **Pilar 4 (Automod Proaktif)**: Phishing Shield (`src/automod/phishingShield.js`) deteksi typosquatting link Nitro jebakan leksikal berlatensi < 0.2ms tanpa false positive; Ghost Ping Tracker (`src/automod/ghostPingTracker.js`) pelacakan mention yang dihapus cepat dalam < 5 detik dengan buffer TTL 60s.
  - **Pilar 5 (Utilitas Pintar)**: `/carbon` & `/codeview` (`src/canvas/codeCanvas.js`) render cuplikan kode menjadi kartu visual macOS editor 9 bahasa dan 4 tema warna; Visual Poll Chart (`src/canvas/pollCanvas.js`) kartu diagram batang Canvas beresolusi tinggi (1000x620) dengan ekspor tombol interaktif.
  - **Kualitas & Sertifikasi Penuh**: 100% kelulusan Master QA Gate (678 unit tests hijau), 0 ESLint warning/error, 0 em-dash, 100% paritas kamus bahasa ID/EN (353 kunci), E2E suite lulus 79/79 skenario, dan adversarial stress testing 31/31 skenario lulus.
  - File: [`plugin/music/subcommands/playbackControls.js`](plugin/music/subcommands/playbackControls.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`dashboard/public/player.html`](dashboard/public/player.html), [`src/services/blackjackEngine.js`](src/services/blackjackEngine.js), [`plugin/minigames/subcommands/blackjack.js`](plugin/minigames/subcommands/blackjack.js), [`src/services/typeRaceEngine.js`](src/services/typeRaceEngine.js), [`plugin/minigames/subcommands/typerace.js`](plugin/minigames/subcommands/typerace.js), [`dashboard/public/soundboard.html`](dashboard/public/soundboard.html), [`dashboard/public/automod.html`](dashboard/public/automod.html), [`src/automod/phishingShield.js`](src/automod/phishingShield.js), [`src/automod/ghostPingTracker.js`](src/automod/ghostPingTracker.js), [`src/canvas/codeCanvas.js`](src/canvas/codeCanvas.js), [`plugin/utility/carbon.js`](plugin/utility/carbon.js), [`src/canvas/pollCanvas.js`](src/canvas/pollCanvas.js), [`plugin/utility/poll.js`](plugin/utility/poll.js), [`TODO.md`](TODO.md).

- [x] **[TEAMWORK OVERHAUL: STRIX SECURITY, ANTI-SLOP, CRON SIMPLIFICATION & FRESH PILARS] Astral Tarot Spread 2.0, Cyber-Agronomy Farming Drone, Dashboard Radar API, and Complete Catch-Block Remediation**
  - Mengaudit dan menyempurnakan ekosistem repository berdasarkan skill `/teamwork-preview`, `/i-have-adhd/ponytail`, `/code-simplification`, `/antislop-code`, `/antislop-ui`, `/antislop-copywriting`, `/code-review-and-quality`, dan `/strix-security-audit`:
  - **Fase 1 (Simplifikasi & Fondasi Anti-Bloat)**: Refactor deklaratif `src/managers/cronManager.js` dengan `runGuardedCronJob` untuk memangkas boilerplate mutex dan try-catch di seluruh 25+ cron schedule; perbaikan resiliensi failover model Groq/AI; remediasi catch blocks kosong dengan logging terstruktur (`logger.debug`/`warn`/`error`) di 100+ modul tanpa swallowing error.
  - **Fase 2 (Fitur Baru Fresh)**:
    - *Astral Tarot Spread 2.0* (`src/services/tarotEngine.js`, `plugin/utility/tarot.js` via `/astral spread`): 22 kartu Arkana Mayor lengkap dengan polaritas tegak/terbalik, tebaran 3 kartu (Past, Present, Future), sintesis bimbingan semesta, dan 24 jam gameplay buff aktif atomik (`rpg_state`).
    - *Autonomous Farming Drone Engine* (`src/survival/engines/farmingDroneEngine.js`): Drone perkebunan 3-tingkat otomatis merawat petak tanaman greenhouse (auto-water, auto-harvest dengan bonus panen +18%, manajemen baterai, dan perbaikan biaya ServerTreasury).
    - *Live Server Radar* (`dashboard/routes/api/telemetry.js`): Endpoint `GET /api/radar` untuk telemetri real-time status World Boss, Cuaca Astral, dan pergerakan bursa saham.
  - **Fase 3 (Pembersihan Anti-Slop & Paritas UI/Copywriting)**: Eliminasi komentar generik AI slop, naturalisasi suara Naura tanpa klise korporat, 100% paritas kamus dwibahasa (314 kunci sinkron di `id.json` & `en.json`), dan 0 karakter em-dash (`\u2014`) di seluruh kode produksi.
  - **Fase 4 (Strix Security Audit)**: Penutupan auth bypass `?preview=1` pada seluruh endpoint mutasi POST Express, validasi ketat regex Discord Snowflake (`/^\d{17,20}$/`) untuk mencegah IDOR/BOLA, sanitasi injection AI persona prompt, dan pencegahan eksploitasi arbitrase mata uang.
  - **100% Kelulusan Master QA Gate**: 593/593 automated unit tests lolos, 0 ESLint errors/warnings, 0 em-dash, 3.906 require calls terverifikasi, dan 31 inline scripts valid.
  - File: [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/services/tarotEngine.js`](src/services/tarotEngine.js), [`plugin/utility/tarot.js`](plugin/utility/tarot.js), [`plugin/utility/astral.js`](plugin/utility/astral.js), [`src/survival/engines/farmingDroneEngine.js`](src/survival/engines/farmingDroneEngine.js), [`dashboard/middleware/auth.js`](dashboard/middleware/auth.js), [`dashboard/routes/user.js`](dashboard/routes/user.js), [`assets/language/id.json`](assets/language/id.json), [`assets/language/en.json`](assets/language/en.json), [`TODO.md`](TODO.md).

- [x] **[PERFORMA, QA GATE & AI RESILIENCE] 24x Require Check Speedup, Elimination of Node 24 DEP0190, Full QA Test Parity, and Groq Decommissioned Models Resilience**
  - Mengaudit dan menyempurnakan ekosistem repository berdasarkan skill `naura-dev`, `bm-drift`, `code-review-and-quality`, `code-simplification`, dan `security-and-hardening`:
  - **Optimasi Performa 24x pada `scripts/check-requires.js`**: Menambahkan pre-check leksikal instan (`criticalKeys.some(k => rawContent.includes(k))`) sebelum pembersihan komentar (`stripComments`). Memangkas waktu verifikasi 3.877 metode lintas modul dari **129,26 detik** menjadi hanya **5,40 detik** (~24x lebih cepat).
  - **Eliminasi Deprecation Warning Node 24 (`DEP0190`) di `scripts/qa-gate.js`**: Menggantikan eksekusi `spawn(actualCmd, args, { shell: isWindows })` dengan pemanggilan langsung binary `process.execPath` (Node native) tanpa opsi shell, menghilangkan peringatan keamanan `DEP0190` di Node >= 24.
  - **Paritas Penuh Test Suite QA Gate**: Menyelaraskan langkah 6 di `scripts/qa-gate.js` agar mencakup seluruh direktori pengujian (`src/**/*.test.js`, `dashboard/**/*.test.js`, `plugin/**/*.test.js`), menguji total 574/574 unit test secara komprehensif.
  - **Resiliensi Model Groq di `src/ai/aiEnsembleRouter.js`**: Mengeliminasi model yang telah dipensiunkan oleh provider Groq (`mixtral-8x7b-32768` dan `gemma2-9b-it` yang memicu error HTTP 400) dan memperbarui daftar kandidat failover dengan model aktif generasi terbaru (`llama-3.2-3b-preview`, `llama-3.2-1b-preview`, `llama3-70b-8192`).
  - **Verifikasi Nol Drift (`scripts/verify-drift.js`)**: Memastikan repositori 100% patuh terhadap konvensi `RULES.md`, bebas dari kebocoran `process.env` di luar config, bebas `ephemeral: true`, bebas karakter em dash, dan bebas phantom scaffolding.
  - File: [`scripts/check-requires.js`](scripts/check-requires.js), [`scripts/qa-gate.js`](scripts/qa-gate.js), [`src/ai/aiEnsembleRouter.js`](src/ai/aiEnsembleRouter.js), [`TODO.md`](TODO.md).

- [x] **[MUSIC RESOLVER, SECURITY AUDIT & CODE REVIEW QUALITY] Spotify Smart Two-Tier Fallback, Soundboard & OAuth Hardening, and Music & Survival UX Enhancements**
  - Mengaudit dan menyelaraskan seluruh repository berbasis `/strix-security-audit` dan `/code-review-and-quality` sesuai standar `RULES.md` dan `AGENTS.md`.
  - Mengembangkan **Spotify Smart Two-Tier Fallback Resolver** di `src/music/spotifyResolver.js`:
    - Memverifikasi Spotify Web API client credentials aktif; menangani pembatasan Spotify Web API 2024 (HTTP 403 pada `/playlists/{id}/tracks` dan `/artists/{id}/top-tracks` untuk flow client credentials) dengan mekanisme fallback otomatis ke scraper `spotify-url-info` dan fallback artis cerdas (`/artists/{id}` + pencarian katalog).
    - Memperkaya metadata trek dengan `artworkUrl` (cover album resolusi tinggi) dan durasi trek.
    - Mengintegrasikan caching multi-tier (Redis & Memori, TTL 12 jam) dengan namespace `cache:spotify:res:...`.
    - Mengoptimalkan resolusi trek playlist melalui pemrosesan batch paralel (`Promise.all` per 5 trek) untuk mencegah timeout Poru/Lavalink.
    - Menghubungkan resolver Spotify ke command `/music import`, select menu rekomendasi lagu di `src/music/musicButtons.js`, dan AI Agent `playMusic` di `src/ai/functionDispatcher.js`.
  - Memperbaiki bug dan meningkatkan UI/UX Music System di `plugin/music/music.js`:
    - Mengeliminasi dead code pada subcommand DJ: menyatukan logika duplikat `subcommand === "dj"` sehingga `aiDjManager.setDjEnabled(guild.id, true)` dan `player.aiDjEnabled` aktif serentak dengan telemetri kesiapan Fish Audio TTS.
    - Merombak antarmuka `/music queue` dengan menampilkan lagu yang sedang diputar (`Now Playing`), total trek dalam antrean, estimasi total durasi antrean (`totalQueueMs`), dan informasi halaman yang bersih.
  - Meningkatkan UI/UX Naura Wilds di `plugin/survival/subcommands/info.js`:
    - Mengintegrasikan `survivalUI.buildSurvivalHUD` di kartu `/survival info` untuk visibilitas instan status vital petualang (HP, Stamina, Lapar, Haus).
  - Remediasi Celah Keamanan & Konsistensi State (`/strix-security-audit`):
    - `dashboard/server.js`: Menutup celah Open Redirect pada endpoint OAuth2 login callback dengan validasi ketat `sanitizeRedirectUrl` terhadap query parameter `returnTo` dan `redirect`.
    - `plugin/music/soundboard.js`: Mencegah Prototype Pollution pada custom soundboard keys (`__proto__`, `constructor`, `prototype`, dan regex `/^[a-z0-9_-]{1,32}$/`), serta validasi ketat skema URL audio (`http:` dan `https:`).
    - `dashboard/routes/owner.js`: Mengganti mutasi raw Sequelize `user.save()` dan `survival.save()` dengan `cacheManager.updateUserProfile` dan `cacheManager.updateUserSurvival` untuk mencegah desinkronisasi cache Redis dan Write-Behind Queue.
  - Memverifikasi 100% kelulusan seluruh 6 tahapan Master QA Gate: 0 error linter, 0 em-dash, 100% paritas bahasa ID/EN (274 kunci sinkron), 100% resolusi require internal, 100% sintaks script inline dashboard, dan 522/522 automated unit test lulus hijau (0 error).
  - File: [`src/music/spotifyResolver.js`](src/music/spotifyResolver.js), [`plugin/music/music.js`](plugin/music/music.js), [`src/music/musicButtons.js`](src/music/musicButtons.js), [`src/ai/functionDispatcher.js`](src/ai/functionDispatcher.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js), [`dashboard/server.js`](dashboard/server.js), [`plugin/music/soundboard.js`](plugin/music/soundboard.js), [`dashboard/routes/owner.js`](dashboard/routes/owner.js).

- [x] **[SURVIVAL & BUTTON INTERACTIONS] Standardisasi Siklus Interaksi Tombol Discord, Universal Subcommand Adapter, dan Eliminasi Dead-End Cards**
  - Mengaudit dan menstandarisasi siklus hidup interaksi tombol Discord (khususnya seluruh tombol di ekosistem Naura Wilds / `/survival`) guna mengeliminasi inkonsistensi perilaku, crash runtime, dan kartu buntu.
  - Membangun **Universal Survival Interaction Adapter (`adaptSurvivalInteraction`)** di `src/survival/helpers/survivalContext.js`:
    - Secara transparan mengalihkan `interaction.reply(...)` ke `interaction.editReply(...)` saat interaksi telah berstatus `deferred` atau `replied`, mencegah `DiscordAPIError[40060]: Interaction has already been acknowledged`.
    - Memasang emulasi objek `interaction.options` lengkap (`getSubcommand()`, `getString()`, `getInteger()`, `getBoolean()`, dll.) dengan default dari `PREFIX_OPTION_DEFAULTS` sehingga subcommand tidak melempar `TypeError`.
    - Memproteksi respons kartu utama: respons ephemeral via tombol otomatis dialihkan ke `interaction.followUp({ flags: MessageFlags.Ephemeral })` dan dilarang memanggil `deleteReply()` pada `ButtonInteraction`.
  - Menerapkan **Pembersihan Collector Lintas-Layar (Collector Navigation Suppression)**:
    - Menyediakan registry collector terpusat dengan `registerMessageCollector` dan `stopMessageCollector(msgId, "navigated")`.
    - Membungkus `createMessageComponentCollector` via `wrapMessageWithCollectorRegistry` agar listener `collector.on("end")` otomatis menekan penghapusan komponen saat navigasi, mencegah tombol layar baru terhapus oleh timeout 60s layar lama.
  - Merombak router tombol dinamis di `src/interactions/buttons/survivalCta.js`:
    - Mendukung eksekusi seluruh 55 subcommand survival secara dinamis melalui tombol CTA, prefix action (`survival_act_`, `info_cta_`, `dungeon_cta_`, `empty_cta_`).
    - Menghadirkan guard onboarding terintegrasi: jika pemain baru menekan tombol aksi sebelum memiliki profil, bot otomatis menampilkan ajakan klaim starter pack tanpa crash.
  - Mengeliminasi seluruh **Kartu Buntu (No Dead-End Cards)** di antarmuka survival:
    - Menyertakan baris tombol navigasi kontekstual (`buttonsRow: [survivalUI.buildSurvivalActionRow(...)]`) pada kartu akhir (`onboardingSelect.js`, `onboardingButton.js`, `start.js`, `inventory.js`, `forge.js`, `skill.js`, `bankViews.js`, `pass.js`, `house.js`, `rebirth.js`, `pet.js`, `raid.js`, `siege.js`).
  - Menulis test suite otomatis di `src/survival/engines/survivalInteractionGuard.test.js` untuk menguji adapter, isolasi ephemeral, dan penekanan collector.
  - Mendokumentasikan aturan teknis baru ke dalam `RULES.md` (§1.4.2), `AGENTS.md` (§5 fatal gotchas No. 8, 11, 12), dan `.agents/skills/naura-dev/SKILL.md` (§2.4).
  - Memverifikasi kelulusan penuh seluruh 6 tahapan Master QA Gate: 0 error lint, 0 em-dash, 100% paritas bahasa ID/EN, 100% resolusi require, 100% validasi inline scripts, dan 522/522 automated unit tests lulus hijau.
  - File: [`src/survival/helpers/survivalContext.js`](src/survival/helpers/survivalContext.js), [`src/interactions/buttons/survivalCta.js`](src/interactions/buttons/survivalCta.js), [`src/survival/engines/survivalInteractionGuard.test.js`](src/survival/engines/survivalInteractionGuard.test.js), [`src/survival/helpers/bankViews.js`](src/survival/helpers/bankViews.js), [`src/interactions/selects/onboardingSelect.js`](src/interactions/selects/onboardingSelect.js), [`src/interactions/buttons/onboardingButton.js`](src/interactions/buttons/onboardingButton.js), [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js), [`plugin/survival/subcommands/forge.js`](plugin/survival/subcommands/forge.js), [`plugin/survival/subcommands/dungeon.js`](plugin/survival/subcommands/dungeon.js), [`plugin/survival/subcommands/start.js`](plugin/survival/subcommands/start.js), [`plugin/survival/subcommands/skill.js`](plugin/survival/subcommands/skill.js), [`plugin/survival/subcommands/pass.js`](plugin/survival/subcommands/pass.js), [`plugin/survival/subcommands/house.js`](plugin/survival/subcommands/house.js), [`plugin/survival/subcommands/rebirth.js`](plugin/survival/subcommands/rebirth.js), [`plugin/survival/subcommands/pet.js`](plugin/survival/subcommands/pet.js), [`plugin/survival/subcommands/raid.js`](plugin/survival/subcommands/raid.js), [`plugin/survival/subcommands/siege.js`](plugin/survival/subcommands/siege.js), [`RULES.md`](RULES.md), [`AGENTS.md`](AGENTS.md), [`.agents/skills/naura-dev/SKILL.md`](.agents/skills/naura-dev/SKILL.md).

- [x] **[INTERACTIONS & BUTTONS RECOVERY] Audit Menyeluruh Interaksi, Zero-Orphaned Components, dan Universal Safe Deferral Engine**
  - Mengaudit 100% komponen interaktif Discord bot (103 customId dan seluruh message collector) guna menuntaskan kendala respons tepat waktu, stale component, dan galat `InteractionAlreadyReplied` / `Unknown interaction`.
  - Membangun 5 modul penangan tombol dan modal baru yang sebelumnya berstatus yatim (*orphaned components*):
    - `src/interactions/buttons/reactionRole.js`: Penanganan toggle role interaktif permanen (`role_assign_`) dengan validasi otorisasi dan umpan balik ephemeral.
    - `src/interactions/buttons/globalChatFriend.js`: Tombol tambah teman lintas server (`gchat_add_`) langsung terhubung ke database `UserFriend` dengan sistem streak persahabatan.
    - `src/interactions/buttons/pvpDuel.js`: Penanganan tantangan duel user context menu (`pvp_accept_` dan `pvp_decline_`) dengan resolusi power combat dan reward SC.
    - `src/interactions/buttons/predictBet.js` & `src/interactions/modals/predictBetModal.js`: Integrasi tombol pasang prediksi (`pred_bet_`) ke Discord Modal interaktif (`pred_modal_bet_`) dengan validasi nominal dan eksekusi `predictionEngine.placeBet`.
    - `src/interactions/modals/reportMessage.js`: Penanganan modal laporan pesan staff (`report_msg_`) dari context menu pesan dengan penerusan langsung ke channel log moderator.
  - Memasang **Universal Safe Deferral Wrapper (`wrapInteractionSafe`)** di `src/events/interactionCreate.js` yang secara otomatis mengalihkan `interaction.reply` dan `interaction.update` ke `editReply` / `followUp` bila interaksi telah di-defer atau terbalas, mengeliminasi crash runtime `DiscordjsError [InteractionAlreadyReplied]` di seluruh bot.
  - Mengoptimasi timer watchdog stale component menjadi 2.650ms agar collector lokal memiliki waktu cukup untuk menyelesaikan query database atau render canvas tanpa terpotong prematur.
  - Menambahkan pengujian otomatis unit test `src/interactions/interactionsSafety.test.js` dan memvalidasi kelulusan 100% QA Gate (518 unit test passed, 0 error linter, 0 em-dash, 100% paritas bahasa ID/EN).
  - File: [`src/events/interactionCreate.js`](src/events/interactionCreate.js), [`src/interactions/buttons/reactionRole.js`](src/interactions/buttons/reactionRole.js), [`src/interactions/buttons/globalChatFriend.js`](src/interactions/buttons/globalChatFriend.js), [`src/interactions/buttons/pvpDuel.js`](src/interactions/buttons/pvpDuel.js), [`src/interactions/buttons/predictBet.js`](src/interactions/buttons/predictBet.js), [`src/interactions/modals/predictBetModal.js`](src/interactions/modals/predictBetModal.js), [`src/interactions/modals/reportMessage.js`](src/interactions/modals/reportMessage.js), [`plugin/admin/warn.js`](plugin/admin/warn.js), [`plugin/minigames/minigame.js`](plugin/minigames/minigame.js), [`scripts/audit_all_interactions.js`](scripts/audit_all_interactions.js), [`src/interactions/interactionsSafety.test.js`](src/interactions/interactionsSafety.test.js).

- [x] **[SECURITY AUDIT & MOBILE DASHBOARD V2] Strix Security Audit Remediation & Mobile Web Dashboard Feature Parity**
  - Mengaudit seluruh direktori `dashboard/` menggunakan framework `/strix-security-audit` dan mereparasi celah keamanan:
    - Melindungi endpoint pemeliharaan server `POST /api/admin/flush-cache` dan `POST /api/admin/backup` dengan otorisasi ketat `requireOwner`.
    - Mencegah eksploitasi infinite token farming pada mini-game arcade dengan rate limit cooldown server-side (20s) dan batas klaim harian (500 SC/hari) di `POST /api/arcade/claim`.
    - Menutup celah SSRF (Server-Side Request Forgery) pada `GET/POST /survival/farm/webhook` menggunakan validasi ketat anti-SSRF `isSafeWebhookUrl()` dan otorisasi login Discord.
    - Menutup celah pengambilalihan voice channel (Voice Channel Hijacking) pada `POST /soundboard/play` dengan validasi keanggotaan guild pengguna dan login Discord.
    - Mengamankan mutasi saldo pada `POST /territory/contribute` dengan verifikasi debit atomik dan login pengguna.
    - Mengamankan `POST /caravan/ambush-alert` dan `POST /territory/claim` dari manipulasi pihak luar dan spoofing identitas klan.
    - Menutup celah IDOR (BOLA) dan kebocoran transkrip tiket pada `GET /api/tickets`, `GET /api/tickets/:ticketId`, `POST /api/tickets/:ticketId/reply`, dan `POST /api/tickets/:ticketId/close` dengan fungsi pembatas peran `canAccessTicket`.
    - Mengamankan endpoint `GET /api/inventory` agar tidak mengizinkan tamu tanpa login menginspeksi tas pemain lain.
  - Memperkaya Web Dashboard Mobile (`dashboard/mobile/`) dengan kesetaraan fitur terhadap dashboard utama:
    - Menghadirkan komponen **Apps Drawer Bottom Sheet** (`appsDrawer.js`) pada navigasi mobile untuk akses cepat 16 modul bot.
    - Membangun 4 halaman mobile baru: `inventory.html` (Ransel pemain, durability bar & filter bento), `clan.html` (Sindikat klan, teritori & donasi energi), `marketplace.html` (Bursa komoditas & lelang komunitas), dan `arcade.html` (Mini-game HTML5 Canvas 60 FPS Cyber Star Catcher).
    - Memperbarui `dashboard/mobile/vite.config.mjs` dan routing Express di `dashboard/server.js`.
  - Memvalidasi seluruh QA Gate: 6/6 tahapan 100% hijau (503 unit test passed, 0 error linter, 0 em-dash, 100% paritas kamus ID/EN).
  - File: [`dashboard/routes/api.js`](dashboard/routes/api.js), [`dashboard/routes/survival.js`](dashboard/routes/survival.js), [`dashboard/routes/tickets.js`](dashboard/routes/tickets.js), [`dashboard/routes/user.js`](dashboard/routes/user.js), [`dashboard/server.js`](dashboard/server.js), [`dashboard/mobile/vite.config.mjs`](dashboard/mobile/vite.config.mjs), [`dashboard/mobile/src/js/components/appsDrawer.js`](dashboard/mobile/src/js/components/appsDrawer.js), [`dashboard/mobile/src/js/components/bottomNav.js`](dashboard/mobile/src/js/components/bottomNav.js), [`dashboard/mobile/src/js/components/toaster.js`](dashboard/mobile/src/js/components/toaster.js), [`dashboard/mobile/src/pages/inventory.html`](dashboard/mobile/src/pages/inventory.html), [`dashboard/mobile/src/pages/clan.html`](dashboard/mobile/src/pages/clan.html), [`dashboard/mobile/src/pages/marketplace.html`](dashboard/mobile/src/pages/marketplace.html), [`dashboard/mobile/src/pages/arcade.html`](dashboard/mobile/src/pages/arcade.html).

- [x] **[WEB DASHBOARD & ACCESSIBILITY] Dynamic Data Refactoring, Universal Page Navigation, and Zero-Hardcoded State Audit**
  - Mengaudit seluruh 29 halaman web dashboard Naura OS, menyingkirkan baris mock/placeholder statis dan menyambungkannya ke database backend live.
  - Membangun 6 endpoint RESTful baru di Express backend: `GET /api/inventory` (inventaris tas petualang, tools, daya tahan dan kapasitas), `GET /api/clan/info` (sindikat klan, vault, dan daftar anggota nyata dari Discord API), `GET /api/marketplace/items` (balai lelang aktif dari `MarketAuction`), `POST /api/arcade/claim` & `GET /api/arcade/leaderboard` (mini games arcade dengan reward mutasi atomik SC & skor tertinggi), serta `POST /api/admin/flush-cache` & `POST /api/admin/backup` (pemeliharaan arsitektur dan paksa flush cache).
  - Merombak arsitektur navigasi global `sharedNav.js`: mendaftarkan seluruh 28 rute pada `ROUTE_GROUPS`, menginjeksi sticky header `.shared-top-nav` dengan quick-links lengkap (`Dashboard`, `Profil`, `Ransel`, `Dunia`, `Klan`, `Pasar`, `Arcade`, `Musik`, `Settings`, `Admin`), user avatar chip dari `/api/me`, drawer mobile nav di bagian bawah layar, dan reconciler tautan sidebar dinamis.
  - Menyelaraskan navigasi sidebar desktop statis pada `index.html` dengan tautan langsung ke `/clan`, `/marketplace`, `/inventory`, `/arcade`, dan `/admin`.
  - Memverifikasi 100% kelulusan QA Gate (503 unit test lulus, 0 error linter, 0 em-dash, 100% paritas bahasa ID/EN, dan 29/29 halaman merespons HTTP 200).
  - File: [`dashboard/routes/api.js`](dashboard/routes/api.js), [`dashboard/routes/user.js`](dashboard/routes/user.js), [`dashboard/src/js/sharedNav.js`](dashboard/src/js/sharedNav.js), [`dashboard/dist/src/js/sharedNav.js`](dashboard/dist/src/js/sharedNav.js), [`dashboard/src/css/stellar.css`](dashboard/src/css/stellar.css), [`dashboard/src/pages/index.html`](dashboard/src/pages/index.html), [`dashboard/src/pages/inventory.html`](dashboard/src/pages/inventory.html), [`dashboard/src/pages/clan.html`](dashboard/src/pages/clan.html), [`dashboard/src/pages/marketplace.html`](dashboard/src/pages/marketplace.html), [`dashboard/src/pages/arcade.html`](dashboard/src/pages/arcade.html), [`dashboard/src/pages/admin.html`](dashboard/src/pages/admin.html), [`dashboard/src/pages/economy.html`](dashboard/src/pages/economy.html), [`dashboard/src/pages/war-room.html`](dashboard/src/pages/war-room.html), [`dashboard/src/pages/lounge.html`](dashboard/src/pages/lounge.html).

- [x] **[WEB DASHBOARD & SECURITY] Pemeriksaan Mendalam Dashboard, Eliminasi Pengalihan Paksa & Official Anti-Scam Trust Banner Engine**
  - Mencegah pengalihan paksa (`302 redirect`) saat pengguna atau pengunjung mengakses halaman yang berkaitan dengan data user/server, menghilangkan kecurigaan phising/scam dengan menyajikan Mode Pratinjau Terbuka yang aman dan transparan (`dashboard/middleware/auth.js`).
  - Mengimplementasikan `renderUserDataTrustBanner(isAuthenticated)` pada `dashboard/src/js/authManager.js` dengan 3 lencana resmi ("DASHBOARD RESMI NAURA", "DISCORD OAUTH2 OFFICIAL", "MODE PRATINJAU TERBUKA"), judul informatif, 3 poin jaminan keamanan (kata sandi tidak pernah diminta, izin baca publik terbatas, divalidasi langsung domain resmi `discord.com`), dan 3 tombol aksi sukarela.
  - Memasang atribut `data-user-data-page="true"` dan menyelaraskan integrasi pada 9 halaman data: `/profile`, `/inventory`, `/settings`, `/automations`, `/welcomer`, `/tickets`, `/music`, `/admin`, dan `/portfolio/me`.
  - Halaman kreator publik (`/portfolio`) dibebaskan dari desakan banner login untuk akses publik terbuka.
  - Memvalidasi tampilan visual melalui headless Chrome CDP capture (`scripts/audit_dashboard_pages.js`) dengan hasil 100% halaman menyajikan HTTP 200 tanpa redirect paksa, serta mempertahankan kelulusan penuh 6/6 QA Gate (503 unit tests, 0 em-dash, paritas kamus bahasa 100%).
  - File: [`dashboard/middleware/auth.js`](dashboard/middleware/auth.js), [`dashboard/server.js`](dashboard/server.js), [`dashboard/src/js/authManager.js`](dashboard/src/js/authManager.js), [`dashboard/src/js/sharedNav.js`](dashboard/src/js/sharedNav.js), [`dashboard/src/pages/profile.html`](dashboard/src/pages/profile.html), [`dashboard/src/pages/inventory.html`](dashboard/src/pages/inventory.html), [`dashboard/src/pages/settings.html`](dashboard/src/pages/settings.html), [`dashboard/src/pages/automations.html`](dashboard/src/pages/automations.html), [`dashboard/src/pages/welcomer.html`](dashboard/src/pages/welcomer.html), [`dashboard/src/pages/tickets.html`](dashboard/src/pages/tickets.html), [`dashboard/src/pages/music.html`](dashboard/src/pages/music.html), [`dashboard/src/pages/admin.html`](dashboard/src/pages/admin.html), [`scripts/audit_dashboard_pages.js`](scripts/audit_dashboard_pages.js).

- [x] **[AI-DJ & MUSIC] AI DJ Text Fallback Engine Opsi C (Hybrid) & Zero-AI Genre Heuristic Classifier**
  - Mengimplementasikan klasifikasi genre dan tema musik tanpa ketergantungan model AI eksternal (`src/music/genreClassifier.js`), mencakup 9 kategori: Lofi/Chill, Anime/Vocaloid, Rock/Metal, EDM/Dance, K-Pop, Akustik/Melankolis, Gaming OST, Marathon Stream, dan Pop Default.
  - Menghadirkan naskah penyiar radio tematik anti-slop, On-Air Speech Bubble di panel pemutar utama (`MusicUIManager`), dan kartu siaran radio `buildContainerV2` tersendiri bertema **Naura Radio FM 99.4 MHz** untuk permintaan manual.
  - Audio ducking volume hanya aktif bila suara Fish Audio benar-benar diputar, menjaga volume musik tetap stabil saat mode teks fallback.
  - File: [`src/music/genreClassifier.js`](src/music/genreClassifier.js), [`src/music/genreClassifier.test.js`](src/music/genreClassifier.test.js), [`src/managers/aiDjManager.js`](src/managers/aiDjManager.js), [`src/managers/aiDjManager.test.js`](src/managers/aiDjManager.test.js), [`src/music/MusicUIManager.js`](src/music/MusicUIManager.js).

- [x] **[UTILITY & SURVIVAL] Universal Message Cleaner & 3 SC Garbage Collection Reward Engine**
  - Menambahkan tombol interaksi `🧹 Bersihkan (+3 SC)` pada Discord Components V2 sebelum baris footer dengan proteksi anti-farming (Daily Cap 30 SC per hari & Cooldown 10 detik).
  - Mutasi saldo kebersihan 3 SC diproses secara atomik via `cacheManager.incrementUserSurvival`.
  - Mengimplementasikan sistem timer auto-delete universal dengan visualisasi hitung mundur Discord dinamis `<t:TIMESTAMP:R>` dan pengecualian mutlak pada log owner/admin, pengingat (*reminder*), dan penundaan timer pada pesan interaktif berbasis input pengguna.
  - File: [`src/utils/messageCleaner.js`](src/utils/messageCleaner.js), [`src/utils/messageCleaner.test.js`](src/utils/messageCleaner.test.js), [`src/interactions/buttons/messageCleanup.js`](src/interactions/buttons/messageCleanup.js), [`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js), [`src/utils/NauraContainerBuilder.test.js`](src/utils/NauraContainerBuilder.test.js).

- [x] **[WEB DASHBOARD & REALTIME] Web Dashboard Dynamic Guild Sync & Tactical War Room Real-Time Engine**
  - Menghilangkan parameter statis `guildId: "sandbox"` pada Web Soundboard Studio (`soundboard.html`), menyambungkannya secara dinamis ke sesi guild aktif pengguna dari `window.authManager` / localStorage.
  - Mengintegrasikan Tactical War Room (`war-room.html`) ke backend endpoint langsung `GET /api/realtime/territories` dan `POST /api/territory/contribute` dengan polling otomatis 30 detik untuk kontribusi energi klan yang adil.
  - File: [`dashboard/src/pages/soundboard.html`](dashboard/src/pages/soundboard.html), [`dashboard/routes/api.js`](dashboard/routes/api.js), [`dashboard/src/pages/war-room.html`](dashboard/src/pages/war-room.html).

- [x] **[CO-OP GAMEPLAY] The Celestial Raid 2.0 Engine (Multiplayer Party 2-4 Players)**
  - Menghadirkan engine dungeon kooperatif berbasis giliran (turn-based) tanpa ketergantungan API AI dengan 3 peran sinergis: Guardian (Shield/Tank), Vanguard (Combo DPS), dan Apothecary (Heal/Support).
  - Mekanik bos kosmik bertingkat (Astral Leviathan, Void Monarch, Nebula Chimera) dengan fase amarah (Enrage Phase) setelah 8 giliran dan pembagian hadiah SC serta VB secara atomik dan merata.
  - File: [`src/survival/engines/celestialRaidEngine.js`](src/survival/engines/celestialRaidEngine.js), [`src/survival/engines/celestialRaidEngine.test.js`](src/survival/engines/celestialRaidEngine.test.js), [`plugin/survival/subcommands/raid.js`](plugin/survival/subcommands/raid.js).

- [x] **[AI DORMANT ARTIFACTS] Pengarsipan Modul AI Dormant ke pending_plugin/**
  - Mengarsipkan konsep AI berat yang berisiko menghabiskan kuota free-tier ke dalam direktori `pending_plugin/` untuk kesiapan masa depan.
  - Modul tersimpan: AI Chat Function Calling (`ai_chat_function_calling/`) dan AI Server Lore RAG (`ai_server_lore/`).
  - File: [`pending_plugin/ai_chat_function_calling/`](pending_plugin/ai_chat_function_calling/), [`pending_plugin/ai_server_lore/`](pending_plugin/ai_server_lore/), [`pending_plugin/README.md`](pending_plugin/README.md).

- [x] **[BUG - SHOP_UNFURLED_MEDIA_REFERENCED_ATTACHMENT_NOT_FOUND] Pencegahan DiscordAPIError 50035 Accessory Attachment Hilang & Shop Buy Payload Guard**
  - Mengatasi galat fatal Discord API saat pemain membeli barang di toko survival:
    `DiscordAPIError[50035]: Invalid Form Body components[0].components[0].accessory.media.url[UNFURLED_MEDIA_ITEM_REFERENCED_ATTACHMENT_NOT_FOUND]: The referenced attachment ("attachment://shopkeeper.jpeg") was not found`.
  - **Akar Masalah (Root Cause):** Pada [`plugin/survival/subcommands/shop.js`](plugin/survival/subcommands/shop.js) di dalam fungsi `processBuy`, objek balasan `successPayload` mendefinisikan `iconURL: ctx.art.iconURL || user.displayAvatarURL()` yang bernilai `attachment://shopkeeper.jpeg`, namun tidak menyertakan array lampiran file `files: buyArt.files`. Akibatnya, Discord REST API menolak form body karena komponen accessory mereferensikan attachment yang tidak disertakan dalam multipart upload pesan tindak lanjut (*follow-up*).
  - **Solusi & Mitigasi Dua Lapis:**
    1. **Lapisan Fitur Toko ([`plugin/survival/subcommands/shop.js`](plugin/survival/subcommands/shop.js)):** Memastikan `processBuy` selalu mengambil potret NPC via `portraitOf(ctx.person)` dan melampirkan berkasnya secara eksplisit pada `files: buyArt.files` sehingga potret penjual tampil sempurna di pesan konfirmasi pembelian.
    2. **Lapisan Komponen Inti ([`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js)):** Menambahkan fungsi helper `isAttachmentPresent(ref, filesList)` dan validasi defensif sebelum merakit payload. Jika `headerIconURL`, `topBannerAttachmentName`, `bannerAttachmentName`, `mediaAttachmentNames`, atau `fileAttachmentNames` merujuk ke skema `attachment://` tetapi berkas fisiknya tidak ada di array `files`, builder akan otomatis mengabaikan accessory/banner tersebut dan mencatat peringatan di logger, mengeliminasi risiko crash `DiscordAPIError[50035]` di seluruh interaksi bot.
  - File: [`plugin/survival/subcommands/shop.js`](plugin/survival/subcommands/shop.js), [`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js), [`src/utils/NauraContainerBuilder.test.js`](src/utils/NauraContainerBuilder.test.js).

- [x] **[BUG - INVENTORY_COMPONENT_CUSTOM_ID_DUPLICATED] Eliminasi Duplikasi Komponen Tombol Ransel & Canvas Worker Execute Fallback**
  - Mengatasi galat fatal Discord API saat pemain membuka ransel survival melalui tombol CTA profil (`info_cta_inventory`):
    `DiscordAPIError[50035]: Invalid Form Body components[2].components[0..3].custom_id[COMPONENT_CUSTOM_ID_DUPLICATED]: Component custom id cannot be duplicated`
    serta peringatan rendering: `⚠️ WARNING [SURVIVAL INVENTORY CANVAS ERROR] canvasWorkerPool.execute is not a function`.
  - **Akar Masalah (Root Cause):**
    1. **Duplikasi Custom ID (`inventory.js`):** Objek `buttonsRow` berisi 4 tombol aksi cepat (`inv_cta_consume`, `inv_cta_craft`, `inv_cta_shop`, `inv_cta_info`) dimasukkan dua kali: pertama ke dalam `buildContainerV2({ buttonsRow })`, lalu digabungkan kembali di tingkat luar pesan pada `interaction.editReply({ components: [...payload.components, selectRow, buttonsRow] })`. Hal ini menyebabkan Discord menolak pesan karena tombol memiliki `custom_id` kembar di `components[0]` dan `components[2]`.
    2. **Ketiadaan Method Execute (`canvasWorkerPool.js`):** Modul `canvasWorkerPool` hanya mendefinisikan `runTask()`, sehingga pemanggilan polimorfik `canvasWorkerPool.execute(...)` memicu `TypeError: not a function`.
  - **Solusi & Mitigasi Tiga Lapis:**
    1. **Lapisan Komando Ransel ([`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js)):** Menyatukan `selectRow` dan `buttonsRow` langsung ke dalam `buttonsRow: [selectRow, buttonsRow]` pada `buildContainerV2`, serta menghapus array gabungan manual di `interaction.editReply(payload)` dan `i.update(updatePayload)`.
    2. **Lapisan Komponen Inti ([`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js)):** Menerapkan pelacakan `seenCustomIds` otomatis di dalam perakitan `rowsArray` serta mengekspor fungsi `sanitizeComponentCustomIds(components)` untuk membersihkan duplikasi `custom_id` di seluruh pohon komponen Discord Components V2.
    3. **Lapisan Rendering Pool ([`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js)):** Menambahkan alias `execute(taskOrOptions, payload, timeoutMs)` dan getter `isReady` / `workerCount` agar kompatibel dengan pemanggilan objek maupun string task.
  - File: [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js), [`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js), [`src/utils/NauraContainerBuilder.test.js`](src/utils/NauraContainerBuilder.test.js), [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js).

- [x] **[BUG - SURVIVAL_INTERACTION_NOT_REPLIED] Pencegahan DiscordjsError InteractionNotReplied pada Navigasi Subcommand Bekal & Ransel**
  - Mengatasi galat fatal saat pemain menekan tombol aksi cepat bekal/konsumsi (`inv_cta_consume`) di antarmuka ransel:
    `DiscordjsError [InteractionNotReplied]: The reply to this interaction has not been sent or deferred. at ButtonInteraction.editReply (/home/container/node_modules/discord.js/src/structures/interfaces/InteractionResponses.js:246:48) at Object.execute (/home/container/plugin/survival/subcommands/consume.js:127:40)`.
  - **Akar Masalah (Root Cause):** Pada [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js) di dalam penangkap pesan komponen `collector.on("collect")`, saat tombol CTA navigasi (`inv_cta_consume`, `inv_cta_craft`, `inv_cta_shop`, `inv_cta_info`) ditekan, objek `ButtonInteraction` langsung diteruskan ke method `.execute(i)` milik subcommand target tanpa dipanggil `await i.deferUpdate()`. Karena status interaksi masih belum berstatus deferred maupun replied, pemanggilan `interaction.editReply(...)` di subcommand target langsung memicu galat runtime Discord.js.
  - **Solusi & Mitigasi Tiga Lapis:**
    1. **Lapisan Penangkap Event Ransel ([`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js)):** Menambahkan `await i.deferUpdate().catch(() => {})` dan `collector.stop()` saat tombol CTA navigasi ditekan agar interaksi ter-defer secara instan dan collector lama berhenti saat berganti menu.
    2. **Lapisan Pertahanan Subcommand ([`plugin/survival/subcommands/consume.js`](plugin/survival/subcommands/consume.js), [`craft.js`](plugin/survival/subcommands/craft.js), [`shop.js`](plugin/survival/subcommands/shop.js), [`info.js`](plugin/survival/subcommands/info.js), [`inventory.js`](plugin/survival/subcommands/inventory.js)):** Menerapkan pengecekan defensif `if (!interaction.deferred && !interaction.replied)` pada awal fungsi `execute()` yang secara cerdas mendeteksi ketersediaan `deferUpdate()` untuk interaksi komponen atau `deferReply()` untuk perintah slash, serta membungkus eksekusi `consume.js` dengan `try/catch` defensif.
    3. **Pengujian Unit Otomatis ([`src/survival/engines/survivalInteractionGuard.test.js`](src/survival/engines/survivalInteractionGuard.test.js)):** Membuat test suite baru yang membuktikan bahwa pemanggilan dengan ButtonInteraction yang belum di-defer, ChatInputCommandInteraction yang belum di-defer, maupun interaksi yang sudah di-defer ditangani secara aman dan terisolasi tanpa memicu error ganda.
  - File: [`plugin/survival/subcommands/consume.js`](plugin/survival/subcommands/consume.js), [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js), [`plugin/survival/subcommands/craft.js`](plugin/survival/subcommands/craft.js), [`plugin/survival/subcommands/shop.js`](plugin/survival/subcommands/shop.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js), [`src/survival/engines/survivalInteractionGuard.test.js`](src/survival/engines/survivalInteractionGuard.test.js).

- [x] **[BUG - APPLICATION_COMMAND_TOO_LARGE] Pengecilan & Pemecahan Payload Slash Command Melebihi Batas Discord API (8000 Bytes)**
  - Mengatasi galat deploy `DiscordAPIError[50035]: Invalid Form Body 43[APPLICATION_COMMAND_TOO_LARGE]: Command exceeds maximum size (8000)`.
  - Memecah command raksasa `/survival` (13.422 bytes) menjadi dua command modular terpisah: `/survival` (eksplorasi & kelangsungan hidup) dan `/rpg` (sistem RPG, perkumpulan klan, crafting & dungeon).
  - Mengintegrasikan modul `commandOptimizer.js` untuk memangkas deskripsi subcommand panjang menjadi ringkas dan padat.
  - Menambahkan pre-flight check payload size di `CommandHandler.deploy()` dan pelacak galat per-command `error.rawError.errors`.
  - File: [`plugin/survival/survival.js`](plugin/survival/survival.js), [`plugin/survival/rpg.js`](plugin/survival/rpg.js), [`src/utils/commandOptimizer.js`](src/utils/commandOptimizer.js), [`src/managers/CommandHandler.js`](src/managers/CommandHandler.js).
- [x] **[BUG - APPLICATION_COMMANDS_LIMIT_REACHED] Arsitektur Hub Menu Interaktif Components V2 & Pemangkasan Batas 100 Command Discord API**
  - Mengatasi galat deploy `DiscordAPIError[30032]: Maximum number of application commands reached (100)` saat bot restart (sebelumnya terdapat 121 commands aktif).
  - Mentransformasikan 4 kategori perintah besar (`/minigame`, `/fun`, `/tool`, `/ai`) menjadi **Hub Menu Interaktif berbasis Discord Components V2** (`src/utils/hubMenuHelper.js`). Setiap hub menggunakan sistem navigasi *Hybrid* (Quick Action Buttons untuk 2-3 fitur terpopuler + StringSelectMenu dropdown untuk katalog lengkap fitur) serta pop-up Discord Modal untuk penangkapan input teks.
  - Dilengkapi fitur keamanan *User Ownership Guard* dan pencegahan interupsi: tombol dan dropdown dikunci khusus untuk pengguna pemanggil dengan balasan anti-slop ramah khas Naura (`validateHubOwner`).
  - Mengonsolidasikan sub-modul AI (`vision`, `voice`, `story-mode`, `persona`, `sensei`, `mystery`) dan utilitas berpasangan (`bug` ke `report`, `userinfo` dan `banner` ke `profile`, `vote` ke `poll`, `lang` ke `language`), berhasil memangkas total command aktif dari 121 menjadi **84 commands** (78 slash commands + 6 context menus), menyisakan 16 slot cadangan yang sangat aman.
  - File: [`src/utils/hubMenuHelper.js`](src/utils/hubMenuHelper.js), [`src/interactions/buttons/hubButtons.js`](src/interactions/buttons/hubButtons.js), [`src/interactions/selects/hubSelects.js`](src/interactions/selects/hubSelects.js), [`src/interactions/modals/hubModals.js`](src/interactions/modals/hubModals.js), [`plugin/minigames/minigame.js`](plugin/minigames/minigame.js), [`plugin/utility/fun.js`](plugin/utility/fun.js), [`plugin/utility/tool.js`](plugin/utility/tool.js), [`plugin/ai/ai.js`](plugin/ai/ai.js).
- [x] **[BUG - SURVIVAL_PAYLOAD_WARNING] Optimasi Ukuran Payload Command /survival (< 7000 Bytes)**
  - Mengatasi warning deploy `⚠️ WARNING [DEPLOY WARNING] Command "/survival" (index #45) berukuran 7271 bytes mendekati batas maksimal 8000 bytes`.
  - Mengonfigurasi `optimizeCommandBuilder` dengan `keepChoicesLimit: 0` dan `maxDescLength: 38` pada data builder `/survival`, mengalihkan opsi statis besar ke autocomplete dinamis tanpa mengurangi fungsionalitas game.
  - Memangkas ukuran payload JSON `/survival` dari 7.271 bytes menjadi 6.776 bytes (bebas dari warning threshold $\ge 7000$ bytes).
  - File: [`src/survival/helpers/commandOptimizer.js`](src/survival/helpers/commandOptimizer.js), [`src/survival/data/survivalData.js`](src/survival/data/survivalData.js).
- [x] **[BUG - VITAL_DEAD_END_HOSPITAL_RESCUE] Sistem Penyelamatan Rumah Sakit / Klinik Darurat saat HP 0 & Pembayaran Anti-Minus**
  - Mengatasi kondisi jalan buntu (*dead end*) saat pemain menyentuh HP 0 atau seluruh status fisik drop ke angka 0.
  - Mengotomatiskan evakuasi ke Rumah Sakit Umum Pratama jika lokasi berada di Kota, atau ke Klinik Darurat jika berada di Wilayah Pedesaan/Wilds.
  - Memulihkan status vital darurat pemain ke HP 25 (min 25% max HP), Lapar 30, Haus 30, dan Stamina 30.
  - Menerapkan pemotongan biaya perawatan proporsional dan aman anti-minus (*clamped*): jika di Kota memotong 50 PD dari `UserProfile.pratamaDollars`, sedangkan jika di Desa memotong 500 SC dari `UserSurvival.sukamajuCoins`.
  - File: [`src/survival/helpers/survivalVitals.js`](src/survival/helpers/survivalVitals.js), [`src/survival/helpers/survivalTime.js`](src/survival/helpers/survivalTime.js), [`src/survival/helpers/survivalVitals.test.js`](src/survival/helpers/survivalVitals.test.js).
- [x] **[BUG - MUSIC_INVALID_ARRAY_LENGTH] Pemulihan Batas Subcommand & Separasi Radio Host (`plugin/music/music.js`)**
  - Mengatasi galat fatal `💥 ERROR [COMMANDS] Gagal memuat file command music.js: Invalid Array length`.
  - Discord API membatasi maksimal 25 options/subcommands per root command, sedangkan `music.js` sebelumnya memuat 26 subcommands.
  - Memisahkan subcommand `radio` menjadi command tersendiri [`plugin/music/radio.js`](plugin/music/radio.js) sehingga `music.js` kembali ke batas aman 24 subcommands tanpa mengurangi fungsionalitas audio bot.
  - File: [`plugin/music/music.js`](plugin/music/music.js), [`plugin/music/radio.js`](plugin/music/radio.js).

- [x] **[BUG - PROFILE_SIDEBAR_LEADERBOARD_DESYNC] Sinkronisasi Akun Discord Sesi Web & Leaderboard Realtime Database**
  - Mengatasi display profil sidebar (pojok kiri bawah) yang tetap berstatus "Guest" dengan avatar default Naura meskipun pengguna telah berhasil login melalui Discord OAuth.
  - Mengintegrasikan fungsi `initServerSync()` pada `authManager.js` yang menyinkronkan data profil dari endpoint `/api/me` (nama akun, avatar CDN Discord, peran server, saldo PD dompet & bank, SC, dan VB survival).
  - Memperbaiki tombol login modal Discord (`btnDiscordDirect`) agar mengarahkan pengguna secara langsung ke endpoint OAuth2 resmi `/auth/discord`.
  - Memperbaiki ketidaksesuaian ID elemen kontainer di `leaderboard.html` (`lbList` vs `leaderboardList`), merestrukturisasi fungsi `updatePodium()` agar merender juara top 3 secara dinamis berbasis data aktif, serta membersihkan seluruh data hardcoded statis.
  - Memperbarui endpoint `/api/realtime/leaderboard` di `dashboard/routes/api.js` untuk membaca akumulasi kekayaan murni `(economy_wallet + economy_bank)`, menyelesaikan nama pengguna & avatar Discord secara asinkron via `resolveDiscordUser`, dan mengeliminasi array mock fallback.
  - File: [`dashboard/src/js/authManager.js`](dashboard/src/js/authManager.js), [`dashboard/src/pages/leaderboard.html`](dashboard/src/pages/leaderboard.html), [`dashboard/routes/api.js`](dashboard/routes/api.js).

- [x] **[3D KINEMATICS] Integrasi RigProfile & GLTF Humanoid Bone/Morph Adapter (`naura_animasi_fix.zip`)**
  - Mengintegrasikan modul jembatan `core/rigProfile.js` (`buildHumanoidBones`, `GlbExpressionRig`) untuk memetakan nama bone GLB (`RightArm`, `LeftArm`) ke format humanoid, mengonversi morph targets (`Happy`, `Thinking`, `Sad`, `Angry`, `Blink`, `Talk`), serta menyelaraskan sumbu rotasi rig (+X facing).
  - Memperbarui 10 sequence keyframe gerak agar pose lengan, kepala, dan ekspresi terkonvergensi mulus pada model `Naura_Hoshino_3D_NEW.glb`.
  - File: [`dashboard/src/components/NauraViewer/animations/core/rigProfile.js`](dashboard/src/components/NauraViewer/animations/core/rigProfile.js), [`dashboard/src/components/NauraViewer/animations/parts/`](dashboard/src/components/NauraViewer/animations/parts/), [`dashboard/src/components/NauraViewer/animations/sequences/`](dashboard/src/components/NauraViewer/animations/sequences/), [`dashboard/src/components/NauraHeroViewer/hero3d.js`](dashboard/src/components/NauraHeroViewer/hero3d.js).
- [x] **[BUG] Perbaikan Logika Validasi Alur Perjalanan ke Desa Asal (`plugin/survival/subcommands/travel.js`)**
  - Memperbaiki kondisi pembatasan perjalanan di mana `normalizedTarget` yang bernilai `"desa_sukamaju"` selalu lolos dari evaluasi `normalizedTarget !== "desa"`, sehingga petualang pemula tanpa rumah/kendaraan tidak sengaja terblokir saat hendak pulang ke desa pemula (`err_sys_67`).
  - Menyelaraskan evaluasi menjadi `normalizedTarget !== "desa_sukamaju" && normalizedTarget !== "desa"`.
  - File: [`plugin/survival/subcommands/travel.js`](plugin/survival/subcommands/travel.js).
- [x] **[AI RUNTIME] Sinkronisasi Default Model & Dynamic Model Fallback Chain (`geminiClient.js` & `aiEnsembleRouter.js`)**
  - Menyelaraskan `DEFAULT_MODEL` pada `geminiClient.js` agar membaca `env.GEMINI_MODEL || "gemini-2.5-flash"` dan tidak lagi mengabaikan konfigurasi environment.
  - Memperluas rantai fallback Groq pada `_callGroq` dengan array model aktif (`GROQ_FALLBACK_MODELS = ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "llama-3.2-3b-preview"]`) guna mencegah error HTTP 404 saat model lama dipensiunkan oleh provider.
  - File: [`src/ai/geminiClient.js`](src/ai/geminiClient.js), [`src/ai/aiEnsembleRouter.js`](src/ai/aiEnsembleRouter.js), [`src/config/env.js`](src/config/env.js).
- [x] **[AUDIO CLUSTER] Auto-Recover Stalled Lavalink WebSocket Sessions via Heartbeat Ping Watchdog (`lavalinkClusterManager.js`)**
  - Menerapkan active heartbeat probe (interval 15 detik) dengan toleransi 3 kali timeout untuk mendeteksi silent freeze koneksi WebSocket Lavalink ke Discord Gateway dan memicu migrasi player otomatis ke node cadangan tanpa menunggu error disconnect fatal.
  - File: [`src/managers/lavalinkClusterManager.js`](src/managers/lavalinkClusterManager.js), [`src/music/poru_events/nodeError.js`](src/music/poru_events/nodeError.js).
- [x] **[KEAMANAN & MUTEX] Multi-Key Distributed Lock Helper Anti-Deadlock (`cacheManager.withMultiLock`)**
  - Menyediakan utilitas penguncian Redis multi-kunci dengan pengurutan leksikografis kunci sebelum akuisisi lock untuk menjamin transaksi barter kartu (`/card trade`), taruhan duel PvP, dan transfer brankas lelang bebas dari risiko deadlock terdistribusi.
  - File: [`src/managers/cacheManager.js`](src/managers/cacheManager.js), [`src/survival/helpers/redisLockHelper.js`](src/survival/helpers/redisLockHelper.js).

- [x] **[VOICE WEBRTC] Full-Duplex Audio Pipeline with Barge-In Capability (`VoiceCompanionService` Phase 2)**
  - Menggantikan alur sekuensial push-and-wait dengan pipeline WebRTC real-time berlatensi rendah (<300ms) pada Discord Voice Gateway.
  - Mengimplementasikan Voice Activity Detection (VAD) dan *barge-in capability* di mana bot langsung menghentikan pemutaran audio Fish Audio saat pengguna menyela pembicaraan di voice channel.
  - File: [`src/services/voiceCompanionService.js`](src/services/voiceCompanionService.js), [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/config/env.js`](src/config/env.js).

- [x] **[PERFORMA] Total Canvas Worker Offloading (Zero Event-Loop Blocking)**
  - Mendaftarkan seluruh sisa renderer Canvas (`renderRoomCanvas`, `drawChronicleNewspaper`, `drawAstralOmikuji`, `drawAstralAtmosphereCard`, `drawDuel`, `drawAchievementCard`, `generateWrappedCard`, `drawCardBattleArena`, `drawStockMarket`) ke `src/canvas/canvasWorker.js`.
  - Mengalihkan eksekusi di plugin terkait ke `canvasWorkerPool.execute()` agar event loop bot 100% non-blocking saat merender visual grafis berat.
  - File: [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js), [`plugin/utility/room.js`](plugin/utility/room.js), [`plugin/naura/naura.js`](plugin/naura/naura.js), [`plugin/utility/stock.js`](plugin/utility/stock.js).
- [x] **[KEAMANAN & INTEGRITAS] Trade Caravan Escort & Ambush Atomic Mutex**
  - Mengamankan transaksi pendaftaran pengawal (*escort*) dan penyergapan (*ambush*) karavan dagang menggunakan Redis Distributed Mutex (`cacheManager.withLock`) dan Sequelize transaction row locking (`SELECT FOR UPDATE`) untuk mencegah race condition atau double payout.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`src/models/TradeCaravan.js`](src/models/TradeCaravan.js), [`src/models/CaravanEscort.js`](src/models/CaravanEscort.js).

- [x] **[BUG] Inkonsistensi Fallback String Versi (`v2.1.0` vs `v2.2.0`)**
  - Standarisasi fallback string `BOT_VERSION` dan `ENGINE_VERSION` di `src/config/env.js`, `src/config/ui.js`, `src/config/ui/palette.js`, `src/utils/bootScreen.js`, `src/managers/errorHandler.js`, dan `src/config/ui.test.js` menjadi `"2.2.0"`.
  - File: [`src/config/env.js`](src/config/env.js), [`src/config/ui.js`](src/config/ui.js), [`src/config/ui/palette.js`](src/config/ui/palette.js).
- [x] **[KEAMANAN] Pengamanan Endpoint Soundboard API (`POST /api/soundboard/play`)**
  - Menambahkan validasi autentikasi / keanggotaan guild dan rate limiter pada endpoint API soundboard di `dashboard/routes/api.js` untuk mencegah eksekusi tanpa izin (*soundboard bombing*).
  - File: [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[BUG] Pemulihan Lagu Pasca Soundboard (*Audio Resume Position Lost*)**
  - Perbaikan pada `src/music/poru_events/trackStart.js` dan `trackEnd.js` agar `player.seekTo(resumePosition)` dieksekusi dengan benar pada trek lagu utama yang diinterupsi oleh pemutaran efek suara soundboard.
  - File: [`src/music/poru_events/trackStart.js`](src/music/poru_events/trackStart.js), [`src/music/poru_events/trackEnd.js`](src/music/poru_events/trackEnd.js), [`src/services/soundboardService.js`](src/services/soundboardService.js).
- [x] **Algorithmic Anti-Inflation Circuit Breaker & Economy Guard**
  - Layanan `src/services/economyGuardEngine.js` untuk memantau kecepatan sirkulasi mata uang (_Velocity of Money_) dan mendeteksi anomali transfer saldo antar akun alt (`/pay` abuse).
  - Dynamic Market Tax (pajak pasar dinamis 3% s.d. 12%) yang menyesuaikan secara otomatis berdasarkan total suplai Sukamaju Koin aktif di server untuk menjaga stabilitas moneter.
  - Integrasi pencatatan audit log otomatis ke MongoDB saat terjadi lonjakan transaksi mencurigakan.
  - Unit test `src/services/economyGuardEngine.test.js` lulus 100%.
- [x] **Audio Guard & WebSocket Conflict Hardening**
  - Validasi ketat pada `trackStart.js` (prefetch delay 1500ms dan safety check `player.destroyed`) untuk memastikan tidak terjadi konflik session ID antara Poru dan Discord Voice WebSocket.
  - Evaluasi berkala status failover multi-node Lavalink (`musicManager.getPreferredNode`) agar bot tidak pernah terputus di tengah pemutaran musik.
- [x] **Polyglot Persistence Reconnection & Failover Watchdog**
  - Memastikan transisi otomatis ke SQLite fallback saat koneksi internet cloud Supabase terputus, dan pemulihan data kembali (_data reconciliation_) saat koneksi pulih tanpa terjadinya duplikasi saldo atau kupon.
- [x] **[BUG] Inkonsistensi `engines.node` di `package.json` vs AGENTS.md**
  - Diperbaiki: `package.json` diselaraskan ke `"node": ">=24.0.0"`.
- [x] **[VERIFIKASI] Bulan Event di `worldEventEngine.js`**
  - Terverifikasi benar: JavaScript `Date.getMonth()` adalah 0-indexed (Agustus = 7, Juni = 5, September = 8, Desember = 11).
- [x] **[BUG] Akses `process.env` Langsung di `plugin/minigames/akinator.js`**
  - Diperbaiki: Dihapus mutasi destruktif `delete process.env.NODE_EXTRA_CA_CERTS`.
- [x] **[BUG] Akses `process.env` Langsung di `dashboard/middleware/auth.js`**
  - Diperbaiki: Menggunakan `const env = require("../../src/config/env");` dan `getOwnerIds()` berbasis array string bersih tanpa memanggil `process.env` langsung.
  - File: [`dashboard/middleware/auth.js`](dashboard/middleware/auth.js).
- [x] **[BUG] Residu `EmbedBuilder` dan Standarisasi Components V2 di Plugin**
  - Diperbaiki: Seluruh sisa import `EmbedBuilder` di `profile.js`, `minecraft.js`, `alert.js`, `hangman.js`, `minesweeper.js` telah dibersihkan. `plugin/admin/voicemod.js` telah dimigrasikan penuh ke `buildContainerV2()`.
- [x] **[KEAMANAN] SeasonEngine Tidak Memakai Atomik Debit untuk Upgrade Premium**
  - Diperbaiki: `seasonEngine.upgradeToPremium()` kini menggunakan `cacheManager.debitUserSurvival(userId, "coupons", 5)` dengan pengecekan hasil pemotongan dan unit test terverifikasi 100%.
  - File: [`src/services/seasonEngine.js`](src/services/seasonEngine.js) & [`src/services/seasonEngine.test.js`](src/services/seasonEngine.test.js).
- [x] **[KEAMANAN] Proteksi Rate Limiter pada Perintah Awalan Prefix (`handlePrefixCommand`)**
  - Diperbaiki: Ditambahkan `RateLimiter.isRateLimited(message.author.id, "prefix_cmd", 5, 5)` di `src/events/messageCreate/prefixCommand.js` agar perintah prefix (`n!<command>`) tidak dapat di-spam melewati batas gateway Discord.
  - File: [`src/events/messageCreate/prefixCommand.js`](src/events/messageCreate/prefixCommand.js).
- [x] **[KEAMANAN] Proteksi Rate Limiter pada Global Chat Relay (`handleGlobalChat`)**
  - Diperbaiki: Ditambahkan cooldown 3 detik per pengguna menggunakan `RateLimiter.isRateLimited(message.author.id, "global_chat", 1, 3)` di `globalChat.js` sebelum memanggil fungsi relay broadcast.
  - File: [`src/events/messageCreate/globalChat.js`](src/events/messageCreate/globalChat.js).
- [x] **[KEAMANAN] Integrasi Penuh Economy Guard Circuit Breaker ke Transaksi Server**
  - Diperbaiki: Evaluasi `economyGuard.evaluateTransaction` diintegrasikan penuh ke `plugin/survival/subcommands/trade.js` dan `plugin/survival/subcommands/auction.js` lengkap dengan pemotongan Dynamic Market Tax (3% s.d. 12%) pada saat klaim lelang.
  - File: [`src/services/economyGuardEngine.js`](src/services/economyGuardEngine.js), [`plugin/survival/subcommands/trade.js`](plugin/survival/subcommands/trade.js), [`plugin/survival/subcommands/auction.js`](plugin/survival/subcommands/auction.js).

---

## 🔥 2. KATEGORI: TINGGI (Prioritas Kedua setelah Kritis)

> **Kriteria:** Fitur arsitektur inti, pengalaman pengguna utama, visualisasi sistem, dan retensi musiman.

- [x] **[CODE QUALITY & SIMPLIFICATION] Refactoring & Code Review Menyeluruh (5 Batch Sprint)**
  - Mengaudit dan menyederhanakan kode dari 754 file JavaScript untuk meningkatkan keterbacaan, menghilangkan kompleksitas berlebih (Chesterton's Fence), dan mematuhi pentalogi aturan teknis.
  - [x] **Batch 1**: Simplifikasi `cronManager.js` (Pola mutex `withMutex()`, migrasi `require("sequelize").Op` inline ke destructuring atas, eliminasi dead cron job, dan deduplikasi helper `setNotifFlag`).
  - [x] **Batch 2**: Standardisasi logging pada `aiManager.js` (Mengonversi pemanggilan `console.log` ANSI escape menjadi `logger.warn` resmi, merapikan guard condition).
  - [x] **Batch 3**: Simplifikasi `cacheManager.js` (Menghapus nested try-catch redundan pada `cloneJson` berbasis Node 24 native `structuredClone`).
  - [x] **Batch 4**: Dokumentasi Section Divider pada Subcommand Router Monolitik (`minigame.js`, `music.js`, `setup.js`).
  - [x] **Batch 5**: Sweep Komentar & Dead Code Seluruh Repo (Pembersihan raw `console.log` yang tersisa di modul inti seperti `musicManager.js`, `rssManager.js`, `voiceManager.js`, standardisasi ke logger resmi).
  - File: [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/managers/aiManager.js`](src/managers/aiManager.js), [`src/managers/cacheManager.js`](src/managers/cacheManager.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`src/managers/rssManager.js`](src/managers/rssManager.js), [`src/managers/voiceManager.js`](src/managers/voiceManager.js), [`plugin/minigames/minigame.js`](plugin/minigames/minigame.js), [`plugin/music/music.js`](plugin/music/music.js), [`plugin/admin/setup.js`](plugin/admin/setup.js).


- [x] **[BUG - DUPLICATE_COMMAND_BOUNTY] Proteksi Cross-Platform Folder Subcommands & Duplikasi Command `/bounty`**
  - Mengatasi peringatan `⚠️ WARNING [COMMANDS] Duplikat command "/bounty" pada file bounty.js. File dilewati`.
  - Di lingkungan Linux/container Pterodactyl, pemindaian file sempat memuat file `plugin/survival/subcommands/bounty.js` sebagai root command karena memiliki properti `name: "bounty"` dan `execute()`, sehingga bentrok dengan `plugin/utility/bounty.js`.
  - Menambahkan penanda eksplisit `isSubcommand: true` pada `plugin/survival/subcommands/bounty.js` serta filter ketat `normalizedPath.includes("/subcommands/")` dan `command.isSubcommand` di `CommandHandler.js` untuk mencegah file subcommand termuat sebagai root command di seluruh sistem operasi.
  - File: [`plugin/survival/subcommands/bounty.js`](plugin/survival/subcommands/bounty.js), [`src/managers/CommandHandler.js`](src/managers/CommandHandler.js).

- [x] **[FITUR BARU] Interactive Family Parenting & Apprentice System (`UserChild.js` & `/survival family`)**
  - Menghubungkan model Sequelize `UserChild.js` pasca Parenthood Event: status vital anak (`happiness`, `hunger`, `level`, `xp`), interaksi harian memberi makan (`feed`), membimbing belajar (`teach`), dan tahapan pertumbuhan (Toddler -> Anak -> Murid Magang).
  - Menerapkan *Family Trade Apprentice Perks* di mana anak yang beranjak remaja dapat membantu mata pencaharian pemain sesuai bakat sang ibu (panen sayur otomatis bersama Ningsih, bonus mutiara laut bersama Tari, reparasi diskon bersama Bagas, dan racikan jamu bersama Bidan Sari).
  - File: [`src/survival/engines/familyEngine.js`](src/survival/engines/familyEngine.js), [`src/models/UserChild.js`](src/models/UserChild.js), [`plugin/survival/subcommands/family.js`](plugin/survival/subcommands/family.js) (NEW).
- [x] **[FITUR BARU] Ancient Relic Tower Sieges & Dynamic Territory Control (`territoryWarEngine.js` Phase 2 / `/clan siege`)**
  - Mengembangkan sistem perebutan Menara Relik Kuno (*Ancient Relic Towers*) antar federasi klan menjadi perang wilayah GvG terjadwal mingguan.
  - Aliansi pengontrol menara berhak mengklaim dividen kas aliansi harian dan mengaktifkan status buff regional pasif untuk seluruh anggota klan (Tower of Vitality: +15% HP, Tower of Greed: +10% SC yield). Dilengkapi visual perang di Web Dashboard war room.
  - File: [`src/survival/engines/territoryWarEngine.js`](src/survival/engines/territoryWarEngine.js), [`src/survival/engines/guildFederationEngine.js`](src/survival/engines/guildFederationEngine.js), [`plugin/survival/subcommands/siege.js`](plugin/survival/subcommands/siege.js) (NEW), [`dashboard/src/pages/war-room.html`](dashboard/src/pages/war-room.html).
- [x] **[PERFORMA] WebP Streaming Compression & Memory Pooling on Canvas Worker (`canvasWorkerPool.js`)**
  - Mengonversi keluaran renderer grafis berat (ransel inventaris, koran chronicle mingguan, kamar cyber-pod) dari format PNG mentah ke WebP kompresi adaptif (kualitas 90% lossless).
  - Memangkas ukuran buffer gambar hingga 40-60%, menghemat kuota payload gateway, dan mempercepat respons interaksi Discord.
  - File: [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js), [`src/canvas/inventoryCanvas.js`](src/canvas/inventoryCanvas.js).
- [x] **[AGENTIC AI] Structured Output & Strict JSON Schema Enforcement pada AI Function Dispatcher (`functionDispatcher.js`)**
  - Mengintegrasikan deklarasi function calling resmi berbasis JSON Schema (@google/genai structured outputs) pada AI Ensemble dan Voice Companion.
  - Menghilangkan halusinasi parameter numerik atau nama item pada giliran perintah suara dan chat bebas.
  - File: [`src/ai/functionDispatcher.js`](src/ai/functionDispatcher.js), [`src/ai/geminiClient.js`](src/ai/geminiClient.js), [`src/services/voiceCompanionService.js`](src/services/voiceCompanionService.js).
- [x] **[3D KINEMATICS] Eliminasi Duplikasi Kontroler Ekstremitas Tubuh (`arms.js` vs `leftArm`/`rightArm`)**
  - Menyelesaikan ambiguitas registrasi kontroler ekstremitas di mana `arms.js` dan `leftArm.js`/`rightArm.js` berpotensi memperebutkan transformasi bone yang sama pada render loop Three.js.
  - Menstandarisasi hierarki kontroler independen per sisi tubuh dengan delegasi fallback aman.
  - File: [`dashboard/src/components/NauraViewer/animations/parts/`](dashboard/src/components/NauraViewer/animations/parts/), [`dashboard/src/components/NauraViewer/animations/core/controller.js`](dashboard/src/components/NauraViewer/animations/core/controller.js).
- [x] **[LIVING AI] Semantic Memory Auto-Pruning & Vector De-duplication (`semanticMemoryService.js`)**
  - Menerapkan pemangkasan memori vektor berkala: menggabungkan memori semantik dengan cosine similarity > 0.92 dan menghapus entri usang agar pencarian RAG tetap berada di bawah 5ms serta tabel `semantic_memories` tetap ramping.
  - File: [`src/ai/semanticMemoryService.js`](src/ai/semanticMemoryService.js), [`src/managers/cronManager.js`](src/managers/cronManager.js).

- [x] **[AGENTIC AI] Voice Function Calling & Autonomous In-Game Action Dispatcher**
  - Menghubungkan giliran obrolan suara di Voice Channel langsung ke `functionDispatcher.js` dan model AI Ensemble Router (Gemini 2.5 Flash / Groq).
  - Memungkinkan pengguna menjalankan aksi in-game dan administrasi server via suara langsung (memutar lagu, mengecek saldo, panen hidroponik, cek omikuji, atau info pasar saham).
  - File: [`src/services/voiceCompanionService.js`](src/services/voiceCompanionService.js), [`src/ai/functionDispatcher.js`](src/ai/functionDispatcher.js), [`src/ai/aiEnsembleRouter.js`](src/ai/aiEnsembleRouter.js).
- [x] **[DISCORD ACTIVITY] Social SDK Friends Radar & Co-Op Party Matchmaking (`relationships.read`)**
  - Mengintegrasikan scope Discord Social SDK `relationships.read` via API `getRelationships()` pada Embedded Activity Web Dashboard.
  - Menyediakan fitur Friends Radar dan pembentukan party co-op dungeon instan (The Neo-Abyss) bersama teman satu server dalam 1 klik tanpa input ID manual.
  - File: [`dashboard/src/pages/activity.html`](dashboard/src/pages/activity.html), [`dashboard/routes/api.js`](dashboard/routes/api.js), [`src/config/discordActivityManifest.json`](src/config/discordActivityManifest.json).

- [x] **[FITUR UTAMA] Global Guild Federation Hub (`/clan federation` & `/federation`)**
  - Mengintegrasikan mesin aliansi klan `src/survival/engines/guildFederationEngine.js` ke antarmuka Discord Components V2 lima lapisan.
  - Menyediakan subcommands: `create` (pendirian aliansi), `join` (bergabung ke aliansi klan), `info` (status federasi & brankas aliansi), `boss` (Alliance Raid Boss "Celestial Chrono-Wyrm"), dan `halloffame` (papan peringkat prestise global).
  - File: [`src/survival/engines/guildFederationEngine.js`](src/survival/engines/guildFederationEngine.js), [`plugin/survival/subcommands/federation.js`](plugin/survival/subcommands/federation.js), [`plugin/survival/subcommands/clan.js`](plugin/survival/subcommands/clan.js).
- [x] **[FITUR UTAMA] Cross-Server Caravan Trade Cartel & PvP Intercept (`/survival caravan`)**
  - Mengintegrasikan tabel PostgreSQL `trade_caravans` dan `caravan_escorts` (migrasi v38).
  - Mengizinkan petualang merekrut anggota klan sebagai pengawal berbayar untuk meminimalkan risiko perjalanan, serta fitur penyergapan (*PvP caravan ambush*) oleh klan rival di rute antariksa.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`plugin/survival/subcommands/caravan.js`](plugin/survival/subcommands/caravan.js).
- [x] **[GAMEPLAY & AI] Living Town Square NPC Affinity & Friendship Progression (`UserNPC.js`)**
  - Menghubungkan dialog sapaan harian di `src/survival/engines/townEngine.js` dengan model Sequelize `UserNPC`.
  - Interaksi sapaan warga kota meningkatkan poin affection, meningkatkan relationship level (Kenalan -> Teman -> Sahabat), dan membuka diskon belanja serta hadiah khusus dari warga kota.
  - File: [`src/survival/engines/townEngine.js`](src/survival/engines/townEngine.js), [`src/models/UserNPC.js`](src/models/UserNPC.js).

- [x] **[PERFORMA] Delegasi Render Ransel Inventaris ke Dedicated Canvas Worker Pool**
  - Mendaftarkan task `renderInventory` di `src/canvas/canvasWorker.js` dan mengalihkan pemanggilan `generateInventoryBackpackImage` di `plugin/survival/subcommands/inventory.js` ke `canvasWorkerPool.execute()` agar rendering grafis inventaris tidak memblokir event loop Discord Gateway.
  - File: [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js).
- [x] **[LOGIKA & UX] Sinkronisasi State Interaksi Tombol Subsidi Pemula di Dompet**
  - Memperbarui payload kontainer di `plugin/survival/subcommands/wallet.js` saat tombol `wallet_claim_novice` ditekan agar status tombol langsung dinonaktifkan (*disabled: true*) dan angka saldo diperbarui secara instan tanpa memicu error double claim.
  - File: [`plugin/survival/subcommands/wallet.js`](plugin/survival/subcommands/wallet.js).
- [x] **[ANTI-EXPLOIT] Cooldown Proteksi Sapaan Warga Alun-Alun Kota (`townEngine.js`)**
  - Menerapkan batasan per-user atau cooldown di Redis (`town:greet:${userId}`) pada `talkToTownNpc` di `src/survival/engines/townEngine.js` untuk mencegah eksploitasi perolehan Sukamaju Koin berulang dalam durasi menu aktif.
  - File: [`src/survival/engines/townEngine.js`](src/survival/engines/townEngine.js), [`plugin/survival/subcommands/town.js`](plugin/survival/subcommands/town.js).
- [x] **🏆 Pemenang Astral Lottery Ledger & Notifikasi Publik (`v42_create_lottery_winners_ledger`)**
  - Menambahkan pencatatan riwayat pemenang undian mingguan di database PostgreSQL (`recyclingPoolEngine.js`) dan siaran otomatis hasil undian ke announcement channel server / DM pemenang.
  - File: [`src/survival/engines/recyclingPoolEngine.js`](src/survival/engines/recyclingPoolEngine.js), [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/managers/dbMigrator.js`](src/managers/dbMigrator.js).
- [x] **Live Interactive System Topology & Architecture Visualizer (`/system` / `/topology` / `topology.html`)**
  - **Konsep:** Diadaptasi dari model visualisasi _System Design_ modern (seperti KodeKloud / Cloudcraft) untuk memberikan visibilitas penuh terhadap arsitektur terdistribusi Naura Hoshino.
  - **Halaman Web Dashboard:** Halaman baru di `dashboard-v2/src/pages/topology.html` dengan rute `/topology` dan `/system` serta endpoint telemetri `/api/topology/status`.
  - **Live Multi-Tier Architecture Canvas:** Ingress & Gateway, Processing & Compute, Polyglot Persistence, Audio Streaming Cluster, dan AI Intelligence Orchestration.
  - **Live Node Inspector Drawer & KodeKloud Chaos Failure Simulator:** Tombol interaktif pengujian failover Supabase, Lavalink, dan AI LLM.
- [x] **Seasonal Battle Pass "Naura Wilds Pass" (30 Tiers)**
  - Model Sequelize `SeasonProgress.js` dan engine `src/services/seasonEngine.js` dengan sistem hadiah 30 Tier (Free & Premium tracks).
  - Subcommand `plugin/survival/subcommands/pass.js` (`view`, `claim`, `buy`) berbasis 5-lapisan Container V2 dan button handlers `src/interactions/buttons/pass.js`.
  - Unit test `src/services/seasonEngine.test.js` terverifikasi.
- [x] **Real-Time Duplex Voice Companion & AI Smart DJ (`/voice companion`, `/music dj`)**
  - Mode AI Smart DJ (`/music dj on/off/status`) di `plugin/music/music.js` dengan integrasi kurasi lagu dan radio host otomatis.
- [x] **3D Interactive Model Ecosystem & Virtual Mascot Integration (`Naura Hoshino 3D.glb`)**
  - Implementasi 3D Web Canvas Viewer di Web Dashboard (`portfolio.html`, `world.html`) menggunakan Three.js dengan rotasi 360°, pencahayaan neon Cyberpunk, dan animasi floating/breathing prosedural.
  - Komponen terpadu `NauraHeroViewer` dan `NauraViewer` (`viewer3d.js`, `animations.js`, `particles.js`, `loader.js`).
  - Efek ekspresi interaktif (mouse look-at tracking, partikel mood emote, dan reactive lighting sesuai status emosi AI).
  - Terverifikasi otomatis via Headless Chrome CDP (`scripts/verify_dashboard_3d.js`) dengan hasil uji gerak (Idle, Wave, Thinking, Cheers) 100% tuntas.
- [x] **Clan Territory War Engine & Dynamic Control Math (`territoryWarEngine.js`, `ClanTerritory.js`)**
  - Sistem perebutan 5 sektor wilayah antar klan dengan formula attack/defense damage, cooldown perang 2 jam, dan kalkulasi kontrol persentase (Unit test terverifikasi 100%).
  - File: [`src/survival/engines/territoryWarEngine.js`](src/survival/engines/territoryWarEngine.js), [`src/models/ClanTerritory.js`](src/models/ClanTerritory.js).
- [x] **Hoshino Astral Sanctuary & Server Mood Weather System (`astralService.js`, `plugin/utility/astral.js`)**
  - Sistem ramalan Omikuji tarot digital bertenaga Canvas, evaluasi sentimen cuaca astral 24 jam per guild (Aurora of Fortune, Cosmic Storm, Starlit Serenity, Eclipse of Shadows), dan buff gameplay (Unit test terverifikasi 100%).
  - File: [`src/services/astralService.js`](src/services/astralService.js), [`plugin/utility/astral.js`](plugin/utility/astral.js).
- [x] **Co-Op The Neo-Abyss Celestial Raid Engine (`abyssEngine.js`, `/survival activity abyss`)**
  - Sistem ekspedisi dungeon raid prosedural multi-floor dengan pilihan room dinamis (Combat, Event, Treasure, Rest), status resolve, dan drop pool atomik (Unit test terverifikasi 100%).
  - File: [`src/survival/engines/abyssEngine.js`](src/survival/engines/abyssEngine.js), [`plugin/survival/subcommands/abyss.js`](plugin/survival/subcommands/abyss.js).
- [x] **Naura Living Room & Chibi Cyber-Pod Decorator (`UserRoom.js`, `plugin/utility/room.js`)**
  - Kamar virtual pemain berbasis dokumen MongoDB Atlas dengan penataan furnitur, pajangan kartu hologram, buku tamu komunitas, dan skor kenyamanan interaktif.
  - File: [`src/models/mongo/UserRoom.js`](src/models/mongo/UserRoom.js), [`plugin/utility/room.js`](plugin/utility/room.js).
- [x] **Server Chronicle & Community Memory Time-Capsule (`serverChronicleEngine.js`, `TimeCapsule.js`, `plugin/utility/chronicle.js`)**
  - Perekaman riwayat keaktifan obrolan server dan sistem kapsul waktu pesan komunitas tersimpan di MongoDB yang dapat disegel dan dibuka pada tanggal masa depan.
  - File: [`src/ai/serverChronicleEngine.js`](src/ai/serverChronicleEngine.js), [`src/models/mongo/TimeCapsule.js`](src/models/mongo/TimeCapsule.js), [`plugin/utility/chronicle.js`](plugin/utility/chronicle.js).
- [x] **Anime Card Awakening, Hologram Foil & Deck Builder (`UserCard.js`, `UserCardDeck.js`, `plugin/card/card.js`)**
  - Koleksi kartu anime gacha dengan sistem awakening grade, frame foil kosmik, dan manajemen deck duel strategi.
  - File: [`src/models/UserCard.js`](src/models/UserCard.js), [`src/models/UserCardDeck.js`](src/models/UserCardDeck.js), [`plugin/card/card.js`](plugin/card/card.js).
- [x] **Pari-Mutuel Prediction Market & Betting System (`predictionEngine.js`, `PredictionMarket.js`, `plugin/utility/predict.js`)**
  - Bursa taruhan prediksi server dengan penghitungan rasio odds dinamis, validasi saldo atomik, dan pembagian jackpot otomatis (Unit test terverifikasi 100%).
  - File: [`src/services/predictionEngine.js`](src/services/predictionEngine.js), [`src/models/PredictionMarket.js`](src/models/PredictionMarket.js), [`plugin/utility/predict.js`](plugin/utility/predict.js).
- [x] **[RATE LIMIT] Proteksi Rate Limiter pada Context Menu Commands (`interactionCreate.js`)**
  - Diperbaiki: Ditambahkan pemeriksaan `rateLimiter.isRateLimited(interaction.user.id, "ctx_" + interaction.commandName, 4, 10)` di blok `interaction.isContextMenuCommand()` dengan pesan ephemeral informatif.
  - File: [`src/events/interactionCreate.js`](src/events/interactionCreate.js).
- [x] **[RATE LIMIT] Rate Limiter pada Event Socket.IO `music_control` (`dashboard/sockets/index.js`)**
  - Diperbaiki: Dipasang `RateLimiter.isRateLimited(socket.id, "socket_music_ctrl", 3, 2)` di handler `music_control` dengan emit error acknowledgement bila melebihi batas.
  - File: [`dashboard/sockets/index.js`](dashboard/sockets/index.js).
- [x] **Discord-Hybrid-Sharding 2.0 Multi-Core Cluster Engine**
  - Menggantikan `ShardingManager` bawaan dengan `ClusterManager` (`discord-hybrid-sharding`) berbasis multi-core process/worker threads.
  - Mengurangi pemakaian RAM proses idle hingga 40-50% di panel hosting dan mendukung _zero-downtime rolling restart_ saat deploy produksi.
- [x] **[PENINGKATAN] Migrasi `dbSeeder.js` Canvas Assets ke URL Lokal/CDN Resmi**
  - Diperbaiki: Diganti dengan aset gambar lokal beresolusi tinggi di `assets/images/canvas/` (100% offline-ready tanpa bergantung pada hosting luar).
  - File: [`src/managers/dbSeeder.js`](src/managers/dbSeeder.js), [`src/managers/dbManager.js`](src/managers/dbManager.js).
- [x] **[PENINGKATAN] `SeasonEngine` Belum Integrasi Season XP ke Aksi Survival**
  - Diperbaiki: `seasonEngine.addSeasonXp()` diintegrasikan secara terpadu ke dungeon victory (`dungeonRewards.js`), hidroponik harvest (`greenhouseEngine.js`), perakitan/peleburan/upgrade alat (`craftActions.js`), dan memancing (`fish.js`).
  - File: [`src/services/seasonEngine.js`](src/services/seasonEngine.js), [`src/survival/engines/dungeonRewards.js`](src/survival/engines/dungeonRewards.js), [`src/survival/engines/greenhouseEngine.js`](src/survival/engines/greenhouseEngine.js), [`src/survival/helpers/craftActions.js`](src/survival/helpers/craftActions.js), [`plugin/survival/subcommands/fish.js`](plugin/survival/subcommands/fish.js).
- [x] **[PENINGKATAN] `worldBossEngine.js` Cache TTL Terlalu Pendek (30 detik)**
  - Diperbaiki: Dinaikkan TTL ke 120 detik (`BOSS_CACHE_TTL = 120`) dan diterapkan invalidasi cache aktif saat boss spawn atau pemain melakukan aksi damage/heal/fase.
  - File: [`src/survival/engines/worldBossEngine.js`](src/survival/engines/worldBossEngine.js).
- [x] **[PENINGKATAN] Tambah `AutomationEngine` Trigger Baru**
  - Diperbaiki: Ditambahkan trigger `SURVIVAL_LEVEL_UP`, `QUEST_COMPLETE`, `BOSS_KILLED`, dan `SEASON_TIER_UP`, dukungan kondisi `MIN_TIER`, serta aksi atomik `REWARD_CURRENCY`.
  - File: [`src/services/automationEngine.js`](src/services/automationEngine.js).
- [x] **[BUG] Dua Sistem Notifikasi Tumpang Tindih (Dead Code)**
  - Diperbaiki: Seluruh template dan alur pengiriman diunifikasi ke `src/managers/notificationManager.js`. Cron scheduler terhubung untuk mengirim `idle_revenue`, `stock_alert`, dan `vote_reminder`.
  - File: [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/managers/notificationManager.js`](src/managers/notificationManager.js).

---

## ⚡ 3. KATEGORI: NORMAL (Prioritas Standar)

> **Kriteria:** Fitur reguler yang memperkaya ekosistem komunitas dan gameplay RPG. Dapat dikerjakan kapan pun tanpa mengganggu operasional bot.

- [x] **[BUG - SURVIVAL_ZERO_VITALS_DEAD_END] Auto-Healing & Safe Fallback Vitals Status Fisik 0 pada Profil Survival**
  - Mendiagnosis dan menangani anomali status fisik (Health/Hunger/Thirst) bernilai 0 di database yang menyebabkan pengguna tidak dapat beraktivitas (dead-end).
  - Menambahkan sanitasi pemulihan pada pemuatan profil survival: jika seluruh status vital bernilai 0, sistem otomatis mereset status ke batas aman minimal (HP 50, Thirst 50, Hunger 50) dengan notifikasi pemulihan.
  - File: [`src/survival/helpers/survivalProfileHelper.js`](src/survival/helpers/survivalProfileHelper.js), [`plugin/survival/subcommands/status.js`](plugin/survival/subcommands/status.js).

- [x] **[FITUR BARU] Dynamic World Weather & Seasonal Natural Hazards (`worldWeatherEngine.js` & `/survival status`)**
  - Menambahkan siklus cuaca dunia yang berotasi setiap 6 jam: Hujan Lebat (bonus panen kebun +30%, konsumsi stamina hutan +20%), Badai Petir (resiko sambaran di tambang terbuka, keausan alat +25%), Kabut Pasir Gurun Khul'Khas (peluang menemukan reruntuhan langka x2), dan Terik Matahari (kehausan berkurang 2x lebih cepat).
  - Menampilkan status cuaca aktif pada kartu profil petualang `/survival status`, visual canvas banner cuaca, dan telemetri Web Dashboard.
  - File: [`src/survival/engines/worldWeatherEngine.js`](src/survival/engines/worldWeatherEngine.js) (NEW), [`src/survival/data/worldMapData.js`](src/survival/data/worldMapData.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[FITUR BARU] Guild Caravan Raids & Clan Escort Contracts Hub (`/clan caravan` & `/caravan escort`)**
  - Membuka papan bursa kontrak pengawalan berbayar (*Mercenary Escort Board*) di mana petualang independen dapat disewa oleh klan untuk mengawal konvoi dagang antariksa dengan dana jaminan escrow aman.
  - Menambahkan opsi pembentukan konvoi dagang gabungan multi-pemain dengan pooling modal dan pembagian dividen laba bersama.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`plugin/survival/subcommands/caravan.js`](plugin/survival/subcommands/caravan.js), [`plugin/survival/subcommands/clan.js`](plugin/survival/subcommands/clan.js).
- [x] **[FITUR BARU] Pet Breeding, Evolution & Cosmic Fusion Engine (`UserPet.js` & `/survival pet breed`)**
  - Mengaktifkan fitur perkawinan silang peliharaan di Pet Habitat: dua pet afeksi maksimal (Affection >= 100) dapat dikawinkan untuk mewariskan bakat pasif hibrida.
  - Menambahkan mekanisme evolusi bertingkat hingga Tahap 3 (Cosmic Celestial Companion) dengan aura kosmik berpendar (`cosmicAura: true`) pada kartu identitas profil Canvas.
  - File: [`src/survival/engines/petHabitatEngine.js`](src/survival/engines/petHabitatEngine.js), [`src/models/UserPet.js`](src/models/UserPet.js), [`plugin/survival/subcommands/pet.js`](plugin/survival/subcommands/pet.js), [`src/canvas/petHabitatCanvas.js`](src/canvas/petHabitatCanvas.js).
- [x] **[RPG & FORGE] Durability Repair Batching & Auto-Salvage All Damaged Tools (`/survival forge salvage all`)**
  - Menambahkan opsi pembongkaran massal perlengkapan rusak (durabilitas 0) menjadi Kristal Kosmik dan batangan logam mentah dalam satu kali klik / interaksi atomik.
  - File: [`src/survival/engines/durabilityEngine.js`](src/survival/engines/durabilityEngine.js), [`plugin/survival/subcommands/forge.js`](plugin/survival/subcommands/forge.js).
- [x] **[DASHBOARD V2] Web Dashboard Token Refresh & Auto-Reconnection Interceptor (`auth-manager.js`)**
  - Memasang handler fetch terpadu di sisi browser dashboard untuk menangani respons HTTP 401, merefresh token Discord OAuth di latar belakang, dan mencegah hilangnya formulir pengaturan saat sesi login berakhir.
  - File: [`dashboard/public/js/auth-manager.js`](dashboard/public/js/auth-manager.js), [`dashboard/routes/auth.js`](dashboard/routes/auth.js).
- [x] **[EKONOMI] Dynamic Auction House Buyout & Real-Time Price Recommendation (`auction.js`)**
  - Menghitung kisaran harga wajar secara otomatis saat petualang menjual barang di `/survival auction create` berdasarkan rerata transaksi sukses 7 hari terakhir, serta mendukung fitur harga beli instan (*buyout price*).
  - File: [`src/models/MarketAuction.js`](src/models/MarketAuction.js), [`plugin/survival/subcommands/auction.js`](plugin/survival/subcommands/auction.js), [`src/services/economyGuardEngine.js`](src/services/economyGuardEngine.js).
- [x] **[PERFORMA] Canvas Worker Memory Leak Guard & Context Recycle Loop (`canvasWorkerPool.js`)**
  - Memasang siklus daur ulang otomatis worker thread setelah menyelesaikan 500 tugas rendering, serta pelepasan referensi konteks kanvas (`ctx = null`) untuk kestabilan memori proses bot pada server 24/7.
  - File: [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js), [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js).

- [x] **[AUDIO CLUSTER] Multi-Region Dynamic Latency Ping Routing (Lavalink Geo-Federation)**
  - Menambahkan probe ping periodik (setiap 30 detik) di `lavalinkClusterManager.js` untuk mengukur RTT (Round-Trip Time) ke masing-masing node Lavalink.
  - Secara otomatis merutekan koneksi voice channel guild ke node audio dengan latensi terendah sesuai region geografis server Discord.
  - File: [`src/managers/lavalinkClusterManager.js`](src/managers/lavalinkClusterManager.js), [`src/managers/musicManager.js`](src/managers/musicManager.js).
- [x] **[CANVAS & MEDIA] High-Fidelity 2K Canvas Visuals & Multiline Slash Command Interactions**
  - Mengoptimalkan renderer Canvas (`itemCardCanvas.js`, `roomCanvas.js`, `inventoryCanvas.js`) untuk memanfaatkan batas upload baru Discord 20 MiB dengan opsi rendering resolusi ultra-tajam (2K / WebP lossless).
  - Memperbarui modal dan command builder (`/story`, `/dungeon maker`, `/chronicle`) dengan multiline string options.
  - File: [`src/canvas/roomCanvas.js`](src/canvas/roomCanvas.js), [`src/canvas/itemCardCanvas.js`](src/canvas/itemCardCanvas.js), [`plugin/ai/story-mode.js`](plugin/ai/story-mode.js), [`plugin/utility/dungeonMaker.js`](plugin/utility/dungeonMaker.js).
- [x] **[METAVERSE & RPG] Spatial Voice Proximity for Metaverse Land (`/land` & Activity)**
  - Fitur audio spasial 3D berbasis koordinat grid tanah virtual (8x8) di `landEngine.js` saat diakses via Discord Activity Webview, sehingga volume suara pemain ter-attenuate secara alami berdasarkan jarak ubin avatar.
  - File: [`src/survival/engines/landEngine.js`](src/survival/engines/landEngine.js), [`dashboard/src/pages/activity.html`](dashboard/src/pages/activity.html).

- [x] **[DASHBOARD V2] Live Galactic Caravan Radar & Federation Hall of Fame Integration**
  - Menambahkan panel visual pemantauan karavan antariksa aktif yang sedang meluncur dan papan peringkat aliansi federasi pada Web Dashboard.
  - File: [`dashboard/src/pages/economy.html`](dashboard/src/pages/economy.html), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[OPTIMISASI] Redis Auto-Reconnection & Resilient Memory Lock Watchdog**
  - Penguatan penanganan koneksi Redis dengan exponential backoff dan otomatis fallback ke in-memory token bucket/mutex tanpa unhandled rejection saat network hiccup.
  - File: [`src/managers/redisManager.js`](src/managers/redisManager.js), [`src/survival/helpers/redisLockHelper.js`](src/survival/helpers/redisLockHelper.js).
- [x] **[GAMEPLAY BALANCE] Dynamic Commodity Market Events (Supply/Demand Macro Shocks)**
  - Pemicu fluktuasi harga pasar komoditas otomatis berdasarkan event dunia aktif (misal: Badai Kosmik menaikkan harga Kristal Kosmik +40%, Festival Panen memicu surplus Kayu Jati Emas).
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`src/survival/engines/worldEventEngine.js`](src/survival/engines/worldEventEngine.js).

- [x] **🔎 Omni-Search & Interactive Command Palette (`/search` / `/quick`)**
  - Fitur pencarian terpadu dengan autocomplete fuzzy matching untuk item, resep, dungeon floor, FAQ server, dan command survival.
  - File: `plugin/utility/search.js`, `src/utils/autocompleteHelper.js`.
- [x] **🎚️ Seamless Crossfade & Smart Beatmatching Lavalink Audio**
  - Transisi fade-in/fade-out 3 s.d. 5 detik antar trek musik di antrean voice channel tanpa jeda hening.
  - File: [`src/music/poru_events/trackStart.js`](src/music/poru_events/trackStart.js), `src/music/poru_events/autoplayUtils.js`.
- [x] **🧳 Kemunculan Pedagang Pengembara Alun-Alun Kota (Wandering Merchant)**
  - Kemunculan NPC pedagang musiman yang dibiayai oleh `wanderingMerchantPool` dari kas daur ulang Currency V2 dengan katalog relik langka.
  - File: [`src/survival/engines/townEngine.js`](src/survival/engines/townEngine.js), [`plugin/survival/subcommands/town.js`](plugin/survival/subcommands/town.js).
- [x] **🔨 Sistem Daur Ulang Perlengkapan Rusak (`/survival forge salvage`)**
  - Mengizinkan pemain mendaur ulang perlengkapan dengan durabilitas 0 menjadi material mentah dan kristal kosmik.
  - File: [`src/survival/engines/durabilityEngine.js`](src/survival/engines/durabilityEngine.js), `plugin/survival/subcommands/forge.js`.
- [x] **📡 Live Survival Leaderboard Broadcast via Redis Pub/Sub**
  - Penyebaran pembaruan posisi papan peringkat petualang secara instan ke Web Dashboard tanpa perlu reload halaman.
  - File: [`src/managers/cacheManager.js`](src/managers/cacheManager.js), [`dashboard/sockets/index.js`](dashboard/sockets/index.js).
- [x] **Cyber-Agronomy & Hydroponic Greenhouse (`/survival farm`)**
- [x] **Galactic Trade Caravan & Commodity Exchange (`/survival caravan`)**
- [x] **Custom Community Dungeon Maker (`/dungeon maker`)**
- [x] **AI Virtual Tribunal Court (`/court` / `/tribunal`)**
- [x] **Discord Activity Mini-App ("Naura World 2.0")**
- [x] **Web Canvas & Container V2 Visual WYSIWYG Builder**
- [x] **OpenTelemetry & Prometheus/Grafana Distributed Tracing**
- [x] **Audit & Pembersihan Repositori Menyeluruh (File Duplikat & Dead Code)**
- [x] **Rombak Total Sistem Survival Naura Wilds & Dual-Layer RPG (Sprint 23)**
- [x] **[PENINGKATAN] Notifikasi Survival Cron: Integrasi `vote_reminder`, `idle_revenue`, & `stock_alert`**
  - Diperbaiki: Cron job otomatis berjalan berkala (idle revenue tiap 2 jam, stock alert tiap 4 jam, vote reminder tiap 2 jam) dan membersihkan flag sent harian saat rollover atau saat hadiah diklaim.
  - File: [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/survival/engines/cafeEngine.js`](src/survival/engines/cafeEngine.js), [`dashboard/utils/voteRewards.js`](dashboard/utils/voteRewards.js).
- [x] **[PENINGKATAN] Sistem Crafting: Validasi Resep Berlapis**
  - Diperbaiki: Ditambahkan konfigurasi `reqLevel` dan `reqStat` pada `craftingRecipes.js`, divalidasi secara ketat di `craftActions.js`, dan dihubungkan ke UI respons `craft.js`.
  - File: [`src/survival/data/craftingRecipes.js`](src/survival/data/craftingRecipes.js), [`src/survival/helpers/craftActions.js`](src/survival/helpers/craftActions.js), [`plugin/survival/subcommands/craft.js`](plugin/survival/subcommands/craft.js).
- [x] **[PENINGKATAN] Dungeon Quest Tracker Untuk Item-Specific Drop**
  - Diperbaiki: Ditambahkan generator quest `collect_specific_item` di `questGenerator.js` dan pelacakan drop akumulatif dari `FLOOR_LOOT` / `BOSS_LOOT` di `dungeonRewards.js`.
  - File: [`src/survival/engines/questGenerator.js`](src/survival/engines/questGenerator.js), [`src/survival/engines/dungeonRewards.js`](src/survival/engines/dungeonRewards.js).
- [x] **[PENINGKATAN] Dashboard V2: Halaman Survival Map Interaktif (`/survival-map`)**
  - Diperbaiki: Halaman `dashboard/src/pages/survival-map.html` terpasang penuh dengan layout node interaktif, terdaftar di Vite multi-page config, dan rute server Express `/survival-map` aktif.
  - File: [`dashboard/src/pages/survival-map.html`](dashboard/src/pages/survival-map.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **Deep-Sea Holographic Vivarium & Aquarium Revenue Engine (`vivariumEngine.js`, `vivariumCanvas.js`)**
  - Ekosistem pemeliharaan ikan laut dalam dengan klaim pendapatan tiket per jam, visualisasi Canvas akuarium holografis, dan penempatan spesies bertingkat (Unit test terverifikasi 100%).
  - File: [`src/survival/engines/vivariumEngine.js`](src/survival/engines/vivariumEngine.js), [`src/canvas/vivariumCanvas.js`](src/canvas/vivariumCanvas.js), [`plugin/survival/subcommands/fish.js`](plugin/survival/subcommands/fish.js).
- [x] **Coliseum Team PvP & Elo Adjustment Math (`ColiseumTeam.js`, `src/survival/engines/coliseumEngine.js`)**
  - Sistem pembentukan tim coliseum petualang dan formula penyesuaian rating Elo kompetitif antar petualang (Unit test terverifikasi 100%).
  - File: [`src/models/ColiseumTeam.js`](src/models/ColiseumTeam.js), [`src/survival/engines/coliseumEngine.js`](src/survival/engines/coliseumEngine.js).
- [x] **[RATE LIMIT] Standarisasi Namespace Key Redis `ratelimit:*` & In-Memory Fallback AI**
  - Diperbaiki: Diselaraskan format key ke `ratelimit:ai:${userId}` di `aiHelper.js` dan disediakan fallback ke memory token bucket via `RateLimiter.consume()` saat Redis offline.
  - File: [`src/ai/aiHelper.js`](src/ai/aiHelper.js).
- [x] **[RATE LIMIT] Request Rate Limiting & Concurrency Guard pada Fish Audio TTS API (`fishAudioService.js`)**
  - Diperbaiki: Diterapkan bounded semaphore queue (maksimal 2 request simultan) dan rate limiter 6 request / 10 detik (`RateLimiter.isRateLimited`) untuk mencegah lonjakan HTTP 429.
  - File: [`src/services/fishAudioService.js`](src/services/fishAudioService.js).
- [x] **[PERFORMA] Bounded Task Queue & Per-User Concurrency Guard pada Canvas Worker Pool (`canvasWorkerPool.js`)**
  - Diperbaiki: Dibatasi kapasitas antrean render maksimum 25 tugas (`maxQueueLength = 25`) dan kuota per user maksimal 2 tugas simultan (`userTasks`) agar event loop dan memori worker tetap stabil.
  - File: [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js).
- [x] **[PENINGKATAN] Riwayat Transaksi Ekonomi untuk User (`/history`)**
  - Diperbaiki: Dibuat subcommand `/survival economy history` dan slash command `/history` yang menampilkan 10 riwayat transaksi/aktivitas terakhir dari MongoDB `CommandAuditLog`.
  - File: [`plugin/survival/subcommands/history.js`](plugin/survival/subcommands/history.js), [`plugin/utility/history.js`](plugin/utility/history.js), [`src/survival/helpers/survivalGroups.js`](src/survival/helpers/survivalGroups.js).
- [x] **[PENINGKATAN] Papan Peringkat World Boss Persisten (Leaderboard All-Time)**
  - Diperbaiki: Diterapkan akumulasi skor kerusakan pemain ke sorted set Redis persisten `boss:leaderboard:alltime` saat boss tumbang, serta perintah `/survival raid aksi:leaderboard` untuk menampilkannya.
  - File: [`src/survival/engines/worldBossEngine.js`](src/survival/engines/worldBossEngine.js), [`plugin/survival/subcommands/raid.js`](plugin/survival/subcommands/raid.js).
- [x] **[PENINGKATAN] Cooldown Survival: Tambah Sistem "Rush" Berbayar Kupon**
  - Diperbaiki: Dibangun modul `cooldownRushHelper.js` dan interaksi tombol `rush.js` yang memungkinkan pemain membayar 1 Voucher Beasiswa (VB) untuk melewati cooldown aktif secara atomik.
  - File: [`src/survival/helpers/cooldownRushHelper.js`](src/survival/helpers/cooldownRushHelper.js), [`src/interactions/buttons/rush.js`](src/interactions/buttons/rush.js), [`src/survival/helpers/cooldownRushHelper.test.js`](src/survival/helpers/cooldownRushHelper.test.js).
- [x] **[PENINGKATAN] Inventaris Canvas: Integrasi Filter & Sort**
  - Diperbaiki: Ditambahkan Select Menu interaktif di bawah visualisasi backpack inventaris dengan opsi filter (Semua, Senjata, Armor, Konsumabel, Material) dan sort (Tier Tertinggi, Jumlah Terbanyak).
  - File: [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js).
- [x] **[PENINGKATAN] Sistem Guild Hall: Implementasi `hallLayout` dari v33**
  - Diperbaiki: Diimplementasikan fungsi `customizeTheme` dan `upgradeFacility` di `guildHallEngine.js` serta opsi interaktif `theme` dan `upgrade` di subcommand `/clan hall`.
  - File: [`src/survival/engines/guildHallEngine.js`](src/survival/engines/guildHallEngine.js), [`plugin/survival/subcommands/clan.js`](plugin/survival/subcommands/clan.js), [`src/survival/helpers/survivalGroupsRpg.js`](src/survival/helpers/survivalGroupsRpg.js).

---

## ✨ 4. KATEGORI: OPTIONAL (Prioritas Opsional)

> **Kriteria:** Penambahan estetika, kosmetik, dan eksplorasi fitur eksperimental jangka panjang. Tidak berpengaruh pada kestabilan bot jika dilewati.

- [x] **[BUG - EMBED_FOOTER_VERSION_MISMATCH] Sinkronisasi Versi Realistis Footer Embed & Anti-Slop Format**
  - Memperbaiki inkonsistensi versi hardcoded pada footer embed dan Components V2 di seluruh plugin dan helper.
  - Mengintegrasikan helper `ui.formatFooter()` dan konstanta versi resmi bot (`BOT_VERSION` v2.3.0) serta membersihkan format footer dari redundansi teks generik (anti-slop).
  - File: [`src/config/ui.js`](src/config/ui.js), [`src/utils/NauraContainerBuilder.js`](src/utils/NauraContainerBuilder.js).

- [x] **[FITUR BARU] AI Dynamic Radio Host & Voice Track Announcements (`aiDjManager.js` / `/music radio`)**
  - Menghidupkan kepribadian penyiar radio cerdas pada AI Smart DJ: Naura menyapa nama pendengar di voice channel, menceritakan trivia musisi lagu berikutnya, dan meredupkan volume musik (*audio ducking* ke 15%) saat berbicara sebelum menaikkan kembali ke 100%.
  - File: [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`plugin/music/music.js`](plugin/music/music.js).
- [x] **[AUDIO] Smart Duplicate Track Detection in Guild Queues (`/music duplicates on/off`)**
  - Menambahkan filter pencegahan duplikasi lagu dalam rentang 5 antrean terakhir pemutaran untuk menjaga variasi musik di channel suara server.
  - File: [`src/managers/musicManager.js`](src/managers/musicManager.js), [`plugin/music/music.js`](plugin/music/music.js).
- [x] **[DASHBOARD] Service Worker PWA Caching untuk Dashboard Assets (`dashboard/public/sw.js`)**
  - Menerapkan Service Worker Cache-First untuk file 3D avatar berukuran besar (`.glb`/`.vrm`) dan efek audio soundboard agar kecepatan muat halaman Web Dashboard instan (<1 detik).
  - File: [`dashboard/public/sw.js`](dashboard/public/sw.js) (NEW), [`dashboard/src/pages/index.html`](dashboard/src/pages/index.html).
- [x] **[MONITORING] Automated Staff Security Webhook for Velocity of Money Spikes (`economyGuardEngine.js`)**
  - Pengiriman notifikasi darurat langsung via webhook Discord ke ruang staf admin saat terdeteksi anomali perputaran mata uang (*Velocity of Money*) yang mengindikasikan eksploitasi transfer alt account.
  - File: [`src/services/economyGuardEngine.js`](src/services/economyGuardEngine.js), [`src/services/webhookDispatcher.js`](src/services/webhookDispatcher.js).

- [x] **[AI COMPANION] Expressive 3D Mascot Lip-Sync & Viseme Synchronization**
  - Sinkronisasi bentuk mulut (viseme morph targets A, I, U, E, O) pada avatar 3D Three.js Naura di Web Dashboard dan Discord Activity saat memutar ucapan suara Fish Audio TTS.
  - File: [`dashboard/src/components/NauraViewer/viewer3d.js`](dashboard/src/components/NauraViewer/viewer3d.js), [`dashboard/src/components/NauraViewer/animations.js`](dashboard/src/components/NauraViewer/animations.js).
- [x] **[CROSS-PLATFORM] Real-Time WebSocket Caravan Ambush Alerts via Web Push**
  - Notifikasi Web Push API di browser dashboard saat karavan dagang antariksa pemain sedang disergap oleh klan rival di galaksi.
  - File: [`dashboard/server.js`](dashboard/server.js), [`dashboard/routes/api.js`](dashboard/routes/api.js), [`src/services/tradeEngine.js`](src/services/tradeEngine.js).
- [x] **[DEVOPS & WORKFLOW] Automated Git Commit & Push on Every Task Update (Zero-Lag GitHub Sync)**
  - Menyusun SOP baku dan script otomasi (`scripts/git-sync.js` / `npm run sync:github`) yang secara instan mengeksekusi `git add`, `git commit` dengan pesan semantik rapi (*Conventional Commits*), dan `git push origin main` setiap kali ada pembaruan kode yang telah lulus seluruh 5 gerbang QA Gate.
  - Memastikan seluruh progress tercatat rapi di repositori GitHub secara seketika tanpa ada pekerjaan yang tertinggal di staging lokal.
  - File: [`scripts/git-sync.js`](scripts/git-sync.js), [`package.json`](package.json), [`AGENTS.md`](AGENTS.md), [`TODO.md`](TODO.md).

- [x] **[VISUAL] Chibi 2.5D Room Decorator Live Placement Canvas Preview**
  - Pratinjau visual penataan furnitur kamar cyber-pod 2.5D secara dinamis dengan grid penempatan sebelum disimpan ke MongoDB `UserRoom`.
  - File: [`src/canvas/roomCanvas.js`](src/canvas/roomCanvas.js), [`plugin/utility/room.js`](plugin/utility/room.js).
- [x] **[AI AUDIO] AI DJ Intermezzo Broadcast for Federation Raid Victories**
  - Pengumuman suara otomatis Fish Audio TTS saat aliansi federasi berhasil menumbangkan Celestial Chrono-Wyrm, disiarkan ke seluruh voice channel yang sedang memutar musik.
  - File: [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/survival/engines/guildFederationEngine.js`](src/survival/engines/guildFederationEngine.js).

- [x] **👗 Interactive 3D Mascot Wardrobe & Skin Selector (Web Dashboard)**
  - Pemilihan kostum 3D model Naura (Cyberpunk, Maid, Casual, Adventurer) dan animasi gerak interaktif di Web Dashboard Three.js viewer.
  - File: `dashboard/src/components/NauraViewer/viewer3d.js`, `dashboard/src/pages/world.html`.
- [x] **📈 Live Audio Spectrogram & Equalizer Waveform**
  - Visualisasi grafik gelombang frekuensi real-time pada `music.html` dan `soundboard.html`.
  - File: `dashboard/src/pages/music.html`, `dashboard/src/pages/soundboard.html`.
- [x] **🧠 Nightly AI Memory Reflection & Synthesis Engine**
  - Layanan latar malam hari di mana Living AI mensintesis interaksi harian pengguna dan memperbarui Semantic Vector Memory.
  - File: `src/ai/semanticMemoryService.js`, [`src/managers/cronManager.js`](src/managers/cronManager.js).
- [x] **🎨 AI Dynamic Story Scene Visualizer**
  - Generator ilustrasi adegan RPG otomatis bertenaga Canvas untuk mendampingi alur cerita AI Dungeon Master di `/story`.
  - File: `src/canvas/canvasWorker.js`, `plugin/ai/story-mode.js`.
- [x] **🗣️ Living Town Residents with Generative Dialogue**
  - Integrasi respons NPC Alun-Alun Kota ke model Gemini 2.5 Flash yang dinamis mengikuti cuaca dan reputasi pemain.
  - File: [`src/survival/engines/townEngine.js`](src/survival/engines/townEngine.js), [`src/ai/aiEnsembleRouter.js`](src/ai/aiEnsembleRouter.js).
- [x] **Dynamic Relic Socketing & Gem Enchanting (`/survival forge gem`)**
- [x] **Guild Soundboard Cloud & Live Soundpad**
  - Fitur Soundboard Web Dashboard bertenaga WebSocket (Socket.IO) & Poru player audio overlay untuk memicu pemutaran sound effect instan ke Voice Channel bot (`/soundboard`, `src/services/soundboardService.js`, `dashboard/src/pages/soundboard.html`).
- [x] **Global Guild Federation Hub & Hall of Fame**
  - Jaringan aliansi guild antar server dengan papan peringkat global terpadu dan event penaklukan bos aliansi bersama (`src/survival/engines/guildFederationEngine.js`, `src/survival/engines/guildFederationEngine.test.js`).
- [x] **Autonomous NPC Living City Simulation (`/survival town`)**
  - Alun-Alun Kota (Town Square) dinamis dengan jadwal harian NPC (pagi, siang, malam, dini hari), event kota musiman, dan dialog sapaan warga berhadiah buff (`src/survival/engines/townEngine.js`, `plugin/survival/subcommands/town.js`).
- [x] **AI Video / Dynamic Motion Banner Generator**
  - Rendering video loop MP4 / WebP terkompresi untuk banner profil dan kartu kelulusan season pass bertenaga AI (`src/canvas/dynamicBannerEngine.js`, `plugin/utility/banner.js`, `src/canvas/dynamicBannerEngine.test.js`).
- [x] **Cross-Model Ensemble Router (`src/ai/aiEnsembleRouter.js`)**
  - Router cerdas yang otomatis memilih LLM terbaik (Gemini 2.5 Flash untuk kecepatan & multimodal, Groq LLaMA 3.3 untuk penalaran taktis, Ollama lokal untuk offline) berdasarkan beban latensi server dan status Circuit Breaker.
  - Integrasi failover mulus pada `/court` (Tribunal Court), `/story` (RPG Story Mode), dan telemetri multi-tier Web Dashboard (`/api/topology/status`). Unit test terverifikasi 100%.
- [x] **Metaverse Land & Guild Castles (`/land`)**
  - Sistem kepemilikan kapling tanah virtual per guild untuk pembangunan istana klan, menara pertahanan, dan fasilitas riset teknologi bersama (`src/survival/engines/landEngine.js`, `plugin/utility/land.js`, `src/survival/engines/landEngine.test.js`).
- [x] **Collaborative Live Jam Room (Synthesizer & Drum Machine)**
  - Aktivitas Discord Webview untuk membuat aransemen musik mini 8-bit / Lo-fi secara real-time bersama anggota voice channel (`dashboard/src/pages/jam.html`, `dashboard/sockets/index.js`, `plugin/utility/jam.js`).
- [x] **Lossless Hi-Fi Audio Node Federation**
  - Jaringan node Lavalink FLAC/Opus berkualitas tinggi dengan auto-balancing geografis untuk audio tanpa kompresi (`src/managers/lavalinkClusterManager.js`, `plugin/music/music.js`, `src/music/lavalinkClusterManager.test.js`).
- [x] **Zero-Knowledge Privacy Vaults & Community Bounty Board**
  - Enkripsi end-to-end untuk catatan rahasia/tiket sensitif dan papan pengumuman tugas server berbasis hadiah Star Fragments (`src/services/bountyVaultEngine.js`, `plugin/utility/bounty.js`, `src/services/bountyVaultEngine.test.js`).
- [x] **[OPSIONAL] Item Visual Inspector & Hologram Card Canvas (`/survival shop inspect`)**
  - Visual inspector kartu holografis RPG 640x360 bertema Naura Wilds lengkap dengan tier rarity, svg icon, dan stat metrics (`src/canvas/itemCardCanvas.js`, `plugin/survival/subcommands/shop.js`).
- [x] **[OPSIONAL] AI Music Aura & Signature Personality Card (`/music aura`)**
  - Analisis selera musik bertenaga Gemini AI yang merangkai persona resonansi kosmik serta kartu kanvas visual glassmorphism 800x450 (`src/services/musicAuraService.js`, `src/canvas/musicAuraCanvas.js`, `plugin/music/music.js`).
- [x] **[OPSIONAL] Pembuatan Kartu Ucapan Ulang Tahun Otomatis & Kado Atomik**
  - Integrasi perayaan harian di `cronManager.js` dengan custom canvas birthday card 800x450, dikirim personal via DM lengkap dengan kado atomik (1.000 SC, 3 VB, 1 Kue Tart) dan disiarkan ke announcement channel server.

---

## 📜 ARSIP PEKERJAAN SELESAI (Sprint 0 s.d. Sprint 27)

<details>
<summary>Klik untuk melihat daftar lengkap pekerjaan yang telah tuntas</summary>

### 🔴 Sprint 0: Hardening

- [x] Pisahkan migrasi database dari boot sequence (`scripts/migrate.js` & ledger `schema_migrations`).
- [x] Invalidasi cache `GuildSettings` di semua jalur tulis via Redis Pub/Sub `cache:invalidate`.
- [x] Amankan webhook donasi dan vote dengan `crypto.timingSafeEqual`, batas body, dan idempotency key.
- [x] Perbaiki `env.SHARD_ID` dan alokasi `DB_POOL_BUDGET` sadar jumlah shard.

### 🟠 Sprint 1: Fondasi Developer Experience & Data Atomicity

- [x] Pecah `interactionCreate.js` menjadi registry modular di `src/interactions/`.
- [x] Handler `isAutocomplete()` terpadu dan penanganan error aman (`safeExecute.js`).
- [x] Deploy slash command berbasis SHA-256 hash (`CommandHandler.deploy()`).
- [x] Pisahkan `client.aliases` dari `client.commands` dengan deteksi konflik nama.
- [x] Pengaman batas Discord Components V2 (`componentBudget.js`) mencegah error `Invalid Form Body`.
- [x] Migrasi `ephemeral: true` ke `flags: MessageFlags.Ephemeral`.
- [x] Penulisan ekonomi & inventory atomik (`increment*`, `debit*`, `mutateUser*Json`, `addItemsAtomic`, `takeItemsAtomic`).
- [x] Pemindahan Voucher Beasiswa ke kolom tabel `UserSurvival.scholarshipVouchers`.
- [x] Penguatan CI: `check-em-dash.js`, `locales:check:strict`, `check-requires.js`, dan test suite lengkap.

### 🟡 Sprint 2: Performa & Kesiapan Skala

- [x] Startup Pterodactyl terjamin via npm lifecycle `prestart`.
- [x] Pembatasan cache Discord.js (`clientOptions.js`) dengan `keepOverLimit` untuk bot sendiri.
- [x] Lazy-loading dependensi berat (`@google/genai`, `poru`, Canvas renderer).
- [x] Penyangga XP di Redis (`HINCRBY`) dengan flush berkala ke database.
- [x] Pemecahan `dashboard/server.js` menjadi middleware, routes, dan socket handlers.

### 🟡 Sprint 3: Observability & Operasional

- [x] Endpoint kesehatan `GET /api/health` dengan pelaporan status database dan cache.
- [x] Docker multi-stage compose stack terintegrasi.
- [x] Integrasi Sentry Error Tracking & Performance Profiling.
- [x] Audit log terpusat per guild dan rute kepatuhan privasi data.

### 🟢 Sprint 4 - 8: Audio, AI & Ekspansi Fitur

- [x] Ekosistem Lavalink v4 multi-node dengan failover otomatis dan filter DSP.
- [x] Bahasa per user independen dari bahasa default server.
- [x] AI Memory per user dan integrasi function calling terpusat (`functionDispatcher.js`).
- [x] AI Dungeon Master (`/story`) dan notifikasi cerdas via DM.
- [x] Sistem kepemilikan Temp Voice berbasis Redis (`tempvoice:owner:`).

### 🟢 Sprint 9 - 20: Advanced RPG, Mini-Apps & Canvas Worker Pool

- [x] Quest harian, event musiman, PvP Elo Arena, dan Auction House.
- [x] Dedicated Canvas Worker Pool (`canvasWorkerPool.js`) berbasis `node:worker_threads`.
- [x] Apps Anywhere (User-Installable Apps) dan Context Menu Apps.
- [x] Server RAG Knowledge Base (`/faq`, `/setup ai-kb`) dan AI sentiment auto-moderation.
- [x] Guild Clan Castle, Raid Coliseum, AI Multi-Persona Studio (`/persona`), Deep-Sea Cyber-Fishing, dan Server Stock Exchange (`/stock`).

### 🌸 Sprint 21: 3D Interactive Web Portfolio

- [x] Model `UserPortfolio.js`, REST API `/api/portfolio/me`, dan 3D model viewer Three.js (`portfolio.html`).
- [x] Dynamic Open Graph tags generator untuk preview media sosial.

### 🌟 Sprint 22: Audio Guard, Autocomplete UX & Full Dashboard V2 Migration

- [x] Ekosistem musik terpadu (`/music wrapped`, `/music party`, `/naura` companion).
- [x] Perbaikan root cause auto-disconnect Lavalink (delay prefetch 1500ms di `trackStart.js` & smart preferred node).
- [x] Modul shared `src/utils/autocompleteHelper.js` dengan fuzzy matching, in-memory debounce, dan smart empty states di seluruh plugin.
- [x] Migrasi penuh web dashboard: kompilasi Tailwind v4 + Vite MPA ke `dashboard-v2/dist` dan sinkronisasi seluruh 14 views.
- [x] Verifikasi akhir: **170/170 unit tests passing (100%)**, 0 error lint, dan 0 pelanggaran em dash.

### 🌿 Sprint 23: Naura Wilds RPG, Visualisasi Inventaris & Audit Repository

- [x] Penyetaraan matriks 150 item (5 Kategori x 6 Tier x 5 Item) dengan gambar SVG per item di `assets/items/`.
- [x] Canvas visualisasi inventaris Open Adventurer's Backpack (`src/canvas/inventoryCanvas.js`) dengan grid adaptif dan latar kulit terbuka.
- [x] Subcommand `/survival inventory` diperbarui: menampilkan gambar item dengan label "Nama x Jumlah" dan tombol paginasi.
- [x] Rombak total UI survival: bar vital 3-warna (moss/amber/danger), status Path Synergy, World Event banner.
- [x] World Event Engine Musiman: HUT RI, Ulang Tahun Naura, Festival Panen, Badai Salju Frostsnow.
- [x] Audit menyeluruh repository dan pembaruan komprehensif TODO.md (Sprint 23 Audit Scan).

### ⚡ Sprint 24: Distributed Concurrency, Living AI Vector Memory & Discord Activity Mini-App

- [x] Unifikasi sistem notifikasi dan integrasi cron scheduler untuk `idle_revenue`, `stock_alert`, dan `vote_reminder`.
- [x] Season XP terintegrasi penuh ke aksi survival organik: dungeon, greenhouse, craft, smelt, tool upgrade, dan fish.
- [x] Migrasi aset Canvas default ke direktori lokal `assets/images/canvas/` (100% offline-ready) dan pembaruan `dbSeeder.js`.
- [x] Redis Distributed Mutex Lock (`redisLockHelper.js`) dengan proteksi fallback in-memory dan integrasi `TradeEngine.dispatchCaravan()`.
- [x] Living AI Semantic Vector Memory (migrasi PostgreSQL `v40_create_semantic_memories_table`, model `SemanticMemory.js`, engine `semanticMemoryService.js`, integrasi `aiMemory.js`).
- [x] Discord Activity Mini-App OAuth2 exchange token (`/api/discord/token`) dan slash command `/activity` (`launch`, `info`).
- [x] Penambahan unit test suite baru hingga mencapai **230 passing tests (100%)**, 0 lint errors, dan 0 pelanggaran em dash.

### 🌌 Sprint 25: Masterpiece Blueprint, 3D Mascot & Rate Limiter Audit (2026)

- [x] Integrasi 3D Interactive Mascot Naura (`Naura Hoshino 3D.glb`) di Web Dashboard dengan Three.js, pencahayaan Cyberpunk, animasi prosedural, dan verifikasi otomatis via Headless Chrome CDP (`verify_dashboard_3d.js`).
- [x] Hoshino Astral Sanctuary & Server Mood Weather System (`astralService.js`, `/astral`) dengan ramalan Omikuji tarot digital bertenaga Canvas dan evaluasi sentimen guild 24 jam.
- [x] Clan Territory War Engine (`territoryWarEngine.js`, `ClanTerritory.js`) dengan simulasi perebutan 5 sektor wilayah dan formula kontrol persentase.
- [x] Co-Op The Neo-Abyss Celestial Raid Engine (`abyssEngine.js`, `/survival activity abyss`) dengan dungeon raid prosedural bertingkat.
- [x] Naura Living Room & Chibi Cyber-Pod Decorator (`UserRoom.js`, `/room`) dengan penataan furnitur berbasis dokumen MongoDB Atlas.
- [x] Server Chronicle & Community Memory Time-Capsule (`serverChronicleEngine.js`, `TimeCapsule.js`, `/chronicle`) untuk perekaman memori komunitas masa depan.
- [x] Pari-Mutuel Prediction Market & Betting System (`predictionEngine.js`, `PredictionMarket.js`, `/predict`) dengan rasio odds dinamis.
- [x] Deep-Sea Holographic Vivarium & Aquarium Revenue Engine (`vivariumEngine.js`, `vivariumCanvas.js`) dengan kalkulasi pendapatan tiket per jam.
- [x] Verifikasi Halaman Peta Interaktif Naura Wilds (`dashboard/src/pages/survival-map.html`) terhubung ke rute server Express `/survival-map`.
- [x] Audit komprehensif rate limiter ekosistem dan penyusunan roadmap mitigasi celah laju request (Prefix Command, Global Chat, Context Menu, Socket.IO).
- [x] Verifikasi stabilitas test suite: **245 passing tests (100%)**, 0 error lint, dan 0 pelanggaran em dash.

### 🛡️ Sprint 26: Complete Hardening, Rate Limiting & Ecosystem Maturity (2026)

- [x] Proteksi Rate Limiter pada Perintah Awalan Prefix (`handlePrefixCommand` via `RateLimiter.isRateLimited`).
- [x] Cooldown Relay Global Chat (`handleGlobalChat` batas 3 detik per user).
- [x] Integrasi Economy Guard Circuit Breaker & Dynamic Market Tax pada Trade & Auction House.
- [x] Rate Limiter Context Menu Commands (`interactionCreate.js` 4 req / 10 detik).
- [x] Rate Limiter Socket.IO `music_control` pada Web Dashboard (3 req / 2 detik).
- [x] World Boss Cache TTL ditingkatkan ke 120 detik dengan invalidasi aktif pada state changes.
- [x] AutomationEngine diperluas dengan 4 trigger RPG baru: `SURVIVAL_LEVEL_UP`, `QUEST_COMPLETE`, `BOSS_KILLED`, `SEASON_TIER_UP`.
- [x] Standarisasi namespace key Redis AI `ratelimit:ai:*` dan fallback memory rate limiter.
- [x] Fish Audio TTS Request Limiter (maks 6 req / 10 detik) dan Semaphore Concurrency Guard (maks 2 paralel).
- [x] Canvas Worker Pool Bounded Queue (maks 25 task) dan batas konkurensi 2 task per user.
- [x] Validasi resep crafting bertingkat (`reqLevel` & `reqStat`) dengan pesan gagal ramah pemain.
- [x] Pelacakan item spesifik pada dungeon drop quest tracker (`collect_specific_item`).
- [x] Riwayat audit transaksi ekonomi pemain via slash command `/history` dan `/survival economy history`.
- [x] Papan peringkat World Boss All-Time persisten (`boss:leaderboard:alltime`) dan menu `/survival raid leaderboard`.
- [x] Fitur "Rush" cooldown survival berbasis Voucher Beasiswa (VB) dengan modal konfirmasi dan unit test terverifikasi.
- [x] Select Menu interaktif filter kategori dan pengurutan inventaris backpack Canvas.
- [x] Implementasi kustomisasi tema dan upgrade fasilitas Guild Hall (`hallLayout` v33) pada `/clan hall`.
- [x] Verifikasi stabilitas test suite: **246 passing tests (100%)**, 0 error lint, dan 0 pelanggaran em dash.

### 💎 Sprint 27: Currency V2 Closed-Loop, AI Ensemble Router, Lavalink Cluster, Soundboard & 3D Mascot (v2.2.0 Milestone)

- [x] **Currency V2 One-Way Bridge & Dynamic Spread**: Penukaran SC ke PD sah, PD ke SC dibatasi (`one_way_restricted`), fee transaksi progresif (`currency.js`, `currencyV2.test.js`).
- [x] **Closed-Loop 4-Channel Recycling Pool (`ServerTreasury.js` & `recyclingPoolEngine.js`)**: Alokasi otomatis 40% Kas Infrastruktur Klan, 25% Pool Undian Lotre, 20% Subsidi Pemula, 15% Merchant Incentive.
- [x] **Durability & Wear/Tear Surcharge Engine (`durabilityEngine.js`)**: Sistem ketahanan alat, aus tempur, dan biaya perbaikan dinamis.
- [x] **Cross-Model AI Ensemble Router (`aiEnsembleRouter.js`)**: Multi-LLM failover cerdas (Gemini 2.5 Flash, Groq LLaMA 3.3, Ollama) dengan Circuit Breaker otomatis (Unit test terverifikasi 100%).
- [x] **Lavalink Cluster Manager Multi-Tier (`lavalinkClusterManager.js`)**: Kluster audio bertingkat (Primary, Secondary, Fallback) dengan failover mulus tanpa disconnect sesi Discord.
- [x] **Web Soundboard Studio (`soundboardService.js`, `dashboard/src/pages/soundboard.html`)**: Audio pad interaktif via WebSocket real-time Socket.IO.
- [x] **Autonomous Town Square & Living City NPC Simulation (`townEngine.js`, `plugin/survival/subcommands/town.js`)**: Jadwal harian warga kota dan dialog interaktif berhadiah buff.
- [x] **Dynamic Canvas Visual Suite**: Visual Hologram Item Card 640x360 (`itemCardCanvas.js`), AI Music Aura 800x450 (`musicAuraCanvas.js`), Birthday Celebration Card 800x450 (`birthdayCanvas.js`), dan Backpack Canvas.
- [x] **Migrasi Skema Database Ke-41 (`v41_create_server_treasuries_and_currency_v2`)**: Penambahan tabel `server_treasuries`, kolom `lotteryTickets`, `lastNoviceAidClaimAt`, dan `infrastructurePoints`.
- [x] **Penyelarasan Standar Versi X.Y.Z**: Rilis resmi ekosistem dinaikkan ke **v2.2.0** serentak di seluruh pilar dokumentasi dan package.json.
- [x] **Verifikasi Akhir QA Gate**: **254 passing tests (100%)**, 0 error lint, paritas kamus 100% (263 kunci), dan 0 pelanggaran em dash.

### 🌟 Sprint 28: 3D Mascot Brand Identity, Interactive Animations & Floating Window Optimization (v2.2.0 Milestone)

- [x] **Astral Halo of Hoshino & Holographic Cyber Pedestal (`brand3d.js`)**: Visual 3D cincin ganda berlawanan arah, 4 permata bintang starlight berotasi mandiri, grid heksagonal berpendar, dan 8 berkas sinar vertikal.
- [x] **Dua Animasi Khas Prosedural Baru (`animations.js`)**: `AstralCast` (3.2s, pemanggilan konstelasi bintang & floating starlight) dan `StarPose` (2.6s, pose idol anime ceria dengan wink & star salute).
- [x] **Sistem Partikel Kustom GPU (`particles.js`)**: 3 jenis partikel kustom (Celestial Orb, 4-Point Star Fragment, Cyber Sakura Petal) berbasis custom GLSL shader dengan efek semburan `starShower` dan `burst`.
- [x] **Perbaikan Bug Switch Mode GLB (`hero3d.js`, `animations.js`)**: Destrukturisasi opsi parameter `playClip` dan auto-mapping skeletal GLTF humanoid, menghilangkan error `loop is not defined` dan kotak status "Model 3D Offline".
- [x] **Optimalisasi Jendela Mengambang (NAURA OS Floating Widget)**:
  - Eliminasi bug akumulasi rotasi leher/tulang (*compounding quaternion multiplication*) dengan rest-quaternion caching.
  - Penghematan daya baterai & GPU: Three.js dan Audio Spectrum Visualizer di-pause saat diminimalkan atau saat membuka tab selain 3D.
  - Floating orb bobbing animation `@keyframes nv-floating-bob` dan kurva transisi fisika pegas `cubic-bezier(0.34, 1.56, 0.64, 1)`.
  - Header & mini trigger dapat digeser (*draggable*) via Pointer Events dengan pembatasan batas layar (*viewport clamping*).
  - Sinkronisasi energi spektrum audio real-time langsung ke pendaran Astral Halo Three.js.
  - Siklus interaksi klik avatar 3D interaktif (*Wave, StarPose, BlowKiss, AstralCast, Cheers, Thinking, Shy*) dengan pendaran partikel dan status mood.
- [x] **Verifikasi Otomatis & QA Gate 100% Hijau**:
  - Script pengujian mandiri headless Chrome CDP `scripts/verify_floating_widget.js`.
  - Lolos seluruh 5 tahap QA Gate: `npm run lint` (0 error, 0 warning), `node scripts/check-em-dash.js` (bersih), `npm run locales:check:strict` (263 kunci sinkron), `npm run test:requires` (semua lokal resolved), `npm test` (**272 passing tests 100%**).

### 🚀 Sprint 29: Next-Gen Autonomous Systems, Dynamic Economy & 3D Interactive Ecosystem (v2.2.0 Milestone)

- [x] **[KRITIS] Auto-Acknowledge Interceptor Guard (`src/events/interactionCreate.js`)**:
  - Mencegah error timeout Discord API `Interaction Not Acknowledged (10062)` dengan interceptor otomatis 2.2 detik yang mengeksekusi `deferReply` secara defensif bila pemrosesan command/canvas berat belum selesai.
- [x] **[PERFORMA] Redis Cache Warming Lifecycle Script (`scripts/warmup-cache.js`)**:
  - Memuat konfigurasi guild aktif dan top 100 leaderboard ke Redis saat pra-mulai bot (`prestart`) sehingga waktu respons awal bot seketika (<10ms).
- [x] **[FITUR] 3D Wardrobe & Costume Customizer Studio (`dashboard/src/components/NauraViewer/wardrobeStudio.js`)**:
  - Studio kustomisasi tema shader dan material avatar 3D (Cyberpunk Neon, Gothic Maid, Pastel Casual, Adventurer Emerald) dengan persistensi preferensi user.
- [x] **[FITUR] Mobile Touch Gestures pada 3D Floating Mascot (`viewer3d.js`)**:
  - Dukungan interaksi sentuh alami: cubit untuk zoom (*pinch-to-zoom*) dan dua jari untuk rotasi (*two-finger rotation*) pada perangkat mobile dan tablet.
- [x] **[RPG & EKONOMI] Dynamic Seasonal Battle Pass & Star Path Milestones (`src/survival/engines/seasonPassEngine.js`, `/survival pass`)**:
  - Progresi level musiman (Tier 1-50, Jalur Gratis & Jalur Premium) dengan klaim hadiah atomik (SC, VB, Blueprints, Aksesoris) via `cacheManager`.
- [x] **[RPG & EKONOMI] Automated Dynamic Commodity Market Fluctuations (`src/survival/engines/commodityMarketEngine.js`)**:
  - Algoritma dinamis penawaran-permintaan untuk harga jual/beli ikan laut dalam, mineral langka, dan hasil panen dengan elastisitas harga terkalibrasi.
- [x] **[LIVING AI] Autonomous Server Chronicle Newspaper Generator (`src/ai/serverChronicleEngine.js`)**:
  - Engine perangkum mingguan peristiwa server (pemenang undian, klan teratas, duel kartu epik) menjadi narasi koran bergambar yang terbit berkala.
- [x] **[TEST & QA] Automated Test Suite Expansion & QA Gate**:
### 🚀 Sprint 30: Modular 3D Kinematics Subsystems & Unified Stellar Dashboard V2 (v2.3.0 Milestone)

- [x] **[3D KINEMATICS] Modular Sub-Sistem Direktori Animasi Independen (`dashboard/src/components/NauraViewer/animations/`)**:
  - Pemecahan arsitektur file raksasa `animations.js` (118KB) menjadi modul direktori terstruktur dengan pembagian organ tubuh mandiri:
    - `parts/eyes.js`: Pengendali arah pandang bola mata, VRM lookAt, micro-saccades, dan blendshapes pupil.
    - `parts/blink.js`: Pengendali kelopak mata, siklus kedipan alami single/double blink, dan interval acak.
    - `parts/hair.js`: Fisika pegas kuncir kuda (ponytail spring-damper) dengan isolasi dan koordinasi VRM SpringBoneManager.
    - `parts/head.js`: Kinematika rotasi kepala dan leher dengan batas fisiologis aman dan pelacakan kursor.
    - `parts/face.js`: Morfologi ekspresi emosi (Joy, Fun, Sorrow, Angry, Surprised) dan viseme bukaan mulut (A, I, U, E, O).
    - `parts/spine.js`: Artikulasi pinggul, tulang belakang, dada, dan siklus pernapasan otonom (~0.35 Hz).
    - `parts/arms.js`: Kinematika sendi bahu dan lengan kiri-kanan independen.
    - `parts/hands.js`: Artikulasi pergelangan tangan dan osilasi gelombang harmonik lambaian (Wave, Cheers).
    - `parts/legs.js`: Artikulasi paha, tungkai kaki, telapak, dan lonjakan riang.
  - Setiap sub-modul memiliki blok pelindung `try/catch` tersendiri sehingga kesalahan pada satu sendi tidak menghentikan bagian tubuh lain atau memutus render loop WebGL.
  - Pemisahan 10 sequence keyframe ke dalam folder `sequences/` (`idle.js`, `wave.js`, `thinking.js`, `dizzy.js`, `cheers.js`, `shy.js`, `sleepy.js`, `blowkiss.js`, `astralcast.js`, `starpose.js`).
  - Re-export modular di `dashboard/src/components/NauraViewer/animations.js` untuk paritas dan kompatibilitas 100% mundur.
- [x] **[DASHBOARD V2] Penetapan Desain `dashboard-preview` Sebagai Dashboard Utama**:
  - Sinkronisasi penuh 19 halaman HTML dari `dashboard-preview/src/pages/` ke `dashboard/src/pages/` dengan layout modern Stellar Glass OS.
  - Pemasangan sistem desain `stellar.css`, skrip helper (`shared-nav.js`, `auth-manager.js`), dan aset publik (soundboard audio & radar maps).
  - Penambahan rute Express statis `/src`, `/vendor`, `/node_modules`, dan redirect `/health` ke `/api/health` di `dashboard/server.js`.
  - Integrasi telemetri live status di `status.html` yang membaca `/api/health` dan data Socket.IO secara real-time.
- [x] **[QA & INTEGRITY] Verifikasi 0-Error dan Kepatuhan Aturan Ekosistem**:
  - `npm run lint`: 0 error, 0 warning (bersih).
  - `node scripts/check-em-dash.js`: 0 em dash di seluruh repositori.
  - `node scripts/validate-locales.js --strict`: 100% sinkron (263 kunci).
  - `node scripts/check-requires.js`: Semua require internal sukses.
  - `npm test`: **340 tests lulus 100% hijau** (0 gagal, 0 diskip).

</details>

---

## 🌐 5. Tren Terkini Ekosistem Discord (2025 - 2026) & Relevansi Arsitektur Naura

Berdasarkan analisis pasar bot dan platform developer Discord terkini (2025 - 2026), terdapat pergeseran paradigma dari bot berbasis skrip statis menjadi ekosistem aplikasi terintegrasi (*Agentic AI & Embedded Experiences*). Berikut adalah peta tren utama dan arah adopsinya pada Naura Hoshino:

### 1. Discord Embedded App SDK & Discord Activities
- **Tren Platform:** Pengguna Discord kini lebih menyukai pengalaman *in-client* yang langsung berjalan di dalam voice channel atau text channel (iframe Discord Activities) tanpa harus membuka browser terpisah (seperti *Watch Together*, *Putt Party*, atau *Gartic Phone*).
- **Adopsi Naura:** Mengintegrasikan `@discord/embedded-app-sdk` agar Web Dashboard dan 3D Mascot Viewer dapat diluncurkan langsung dari command `/activity` sebagai mini-game atau interactive companion di dalam Discord.

### 2. Native Discord Monetization & Entitlements API
- **Tren Platform:** Standar monetisasi bot beralih dari tautan luar (Patreon/PayPal) ke **Discord Premium App Subscriptions (SKUs & Entitlements API)**. Discord menangani checkout lokal via Stripe, mendistribusikan event gateway `ENTITLEMENT_CREATE` / `ENTITLEMENT_UPDATE`, dan mendukung langganan berbasis Server (*Guild Subscription*) maupun Pengguna (*User Subscription*).
- **Adopsi Naura:** Menghubungkan paket Star Pass, status VIP/VVIP, dan Coupon Pack ke Discord SKUs resmi dengan validasi entitlement real-time.

### 3. Agentic AI & Duplex Voice Companions (Real-Time Audio)
- **Tren Platform:** Bot beralih dari interaksi tanya-jawab kaku ke agen AI percakapan yang memiliki memori semantik jangka panjang (vector memory RAG), mampu mengobrol suara dua arah secara langsung (*Duplex Voice Chat via WebRTC + VAD*), dan memiliki kepribadian anime yang kohesif.
- **Adopsi Naura:** Ekspansi AI Ensemble Router dan Fish Audio TTS menuju sesi voice channel interaktif dua arah (`/naura join-voice`).

### 4. Deep Social Gamification & All-in-One Virtual Economy
- **Tren Platform:** Komunitas Discord menuntut bot "All-in-One" berkemampuan tinggi (seperti OwO, Dank Memer, Tatsu, VibeBot) yang menggabungkan RPG pet virtual, battle pass musiman, pasar komoditas bebas, dan perang wilayah klan tanpa perlu mengundang belasan bot berbeda.
- **Adopsi Naura:** Pemantapan ekosistem Naura Wilds, Closed-Loop Currency V2, Battle Pass, Pasar Komoditas Dinamis, dan Guild Federation.

### 5. Komponen UI Modern (Discord Components V2 & Media Attachments)
- **Tren Platform:** Format embed tradisional mulai ditinggalkan dan digantikan oleh Container modern (Discord Components V2), Section terpisah, Accessory thumbnail, dan tata letak responsif bertingkat.
- **Adopsi Naura:** Standarisasi 5-lapisan `NauraContainerBuilder` yang sudah diadopsi secara penuh di seluruh modul.

### 6. Full-Duplex WebRTC Voice Agent & Sub-300ms Pipelines (2026)
- **Tren Platform:** Transisi dari bot push-to-talk sekuensial menuju agen suara full-duplex berbasis WebRTC dengan latensi ultra-rendah (<300ms) dan kapabilitas *barge-in* (interupsi alami saat user memotong ucapan bot).
- **Adopsi Naura:** Mengintegrasikan Voice Activity Detection (VAD) Discord Voice Gateway dengan kontrol interupsi instan pada pemutaran Fish Audio TTS di `voiceCompanionService.js`.

### 7. Discord Social SDK & Direct Relationship Access (`relationships.read`)
- **Tren Platform:** Discord Social SDK membuka akses scope `relationships.read` untuk Embedded Activities tanpa perlu approval individual, memungkinkan aplikasi mengambil koneksi pertemanan pengguna secara langsung via `getRelationships()`.
- **Adopsi Naura:** Menghubungkan Friends Radar dan pembentukan party co-op dungeon instan (The Neo-Abyss) pada Activity Webview.

### 8. Plafon Ukuran Media 20 MiB & Multiline Slash Command Inputs
- **Tren Platform:** Discord menaikkan batas upload file default menjadi 20 MiB serta mendukung input multiline string pada command dan modal.
- **Adopsi Naura:** Peningkatan resolusi kartu Canvas inventaris dan RPG ke kualitas 2K tajam (WebP lossless) serta pengalaman formulir pembuatan dungeon/cerita yang lebih leluasa.

### 9. Zero-Lag Automated Continuous Git Sync & GitHub Version Control
- **Tren Platform:** Siklus rilis micro-updates pada platform bot modern membutuhkan sinkronisasi berkelanjutan ke GitHub tanpa jeda, memastikan integritas repositori remote selalu sejalan dengan status staging lokal.
- **Adopsi Naura:** Skrip otomasi `scripts/git-sync.js` (`npm run sync:github`) yang memvalidasi QA gate dan mengeksekusi commit semantik serta push ke remote GitHub seketika.

---

### 📜 Sprint 30: Discord Embedded Activity, Native Entitlements Monetization & Voice AI Agent (v2.2.0 Milestone Selesai)

- [x] **[FITUR] Discord Embedded Activity Launcher (`@discord/embedded-app-sdk`)**:
  - Mengonfigurasi manifest Discord Activity dan endpoint `/activity` agar Web Dashboard dan 3D Mascot Naura dapat dimainkan langsung di dalam Voice Channel Discord.
- [x] **[MONETISASI] Integrasi Discord Entitlements & Premium Subscriptions API**:
  - Menangani event gateway `ENTITLEMENT_CREATE`, `ENTITLEMENT_UPDATE`, dan `ENTITLEMENT_DELETE` untuk aktivasi otomatis Star Pass dan Naura Premium Tier tanpa intervensi manual.
- [x] **[LIVING AI] Duplex Voice Channel AI Companion (`/naura join-voice`)**:
  - Integrasi Voice Activity Detection (VAD) Discord Voice Gateway dengan Fish Audio Streaming TTS untuk obrolan suara dua arah langsung bersama Naura di voice channel.
- [x] **[RPG & CLAN] Cross-Server Federation War & Territory Siege (`GuildFederationEngine` Phase 2)**:
  - Event mingguan perebutan menara relik kuno (*Ancient Relic Towers*) antar federasi klan lintas-server berbasis kapling tanah `landEngine.js`.
- [x] **[PERFORMA] Hybrid Clustering Migration Evaluation (`discord-hybrid-sharding`)**:
  - Evaluasi migrasi arsitektur sharding menuju hybrid multi-cluster worker untuk memangkas pemakaian memori RAM hingga 45% di hosting panel Pterodactyl.
- [x] **[TEST & QA] Automated Test Suite Expansion & Parity Audit**:
  - Pembuatan unit test untuk Discord Entitlements Webhook Handler dan Federation War dengan target kelulusan >310 tests 100% hijau.

---

### 📜 Sprint 31: Next-Gen Full-Duplex Voice WebRTC, Social SDK Activities, Autonomous Agentic Actions & Zero-Lag GitHub CI/CD (v2.3.0 Milestone Selesai)

- [x] **[VOICE WEBRTC] Full-Duplex Audio Pipeline with Barge-In Capability (`VoiceCompanionService` Phase 2)**:
  - Menggantikan alur sekuensial push-and-wait dengan pipeline WebRTC real-time berlatensi rendah (<300ms) pada Discord Voice Gateway, lengkap dengan Voice Activity Detection (VAD) dan interupsi suara alami (barge-in).
- [x] **[AGENTIC AI] Voice Function Calling & Autonomous In-Game Action Dispatcher**:
  - Menghubungkan Voice Turn di Voice Channel ke `functionDispatcher.js` dan model AI Ensemble Router untuk eksekusi perintah suara in-game dan server admin secara mandiri.
- [x] **[DISCORD ACTIVITY] Social SDK Friends Radar & Co-Op Party Matchmaking (`relationships.read`)**:
  - Mengintegrasikan scope Discord Social SDK `relationships.read` via API `getRelationships()` pada Embedded Activity Web Dashboard untuk radar pertemanan dan party dungeon 1-klik.
- [x] **[AUDIO CLUSTER] Multi-Region Dynamic Latency Ping Routing (Lavalink Geo-Federation)**:
  - Probe ping periodik pada `lavalinkClusterManager.js` untuk merutekan voice connection guild ke node audio dengan latensi terendah sesuai region geografis server.
- [x] **[CANVAS & MEDIA] High-Fidelity 2K Canvas Visuals & Multiline Slash Command Interactions**:
  - Peningkatan kualitas kartu inventaris dan kamar ke resolusi 2K ultra-tajam memanfaatkan batas upload 20 MiB serta input multiline string pada command/modal.
- [x] **[METAVERSE & RPG] Spatial Voice Proximity for Metaverse Land (`/land` & Activity)**:
  - Audio spasial 3D berbasis koordinat kapling tanah virtual di `landEngine.js` saat diakses via Discord Activity Webview.
- [x] **[AI COMPANION] Expressive 3D Mascot Lip-Sync & Viseme Morph Target Synchronization**:
  - Sinkronisasi bentuk mulut viseme morph targets (A, I, U, E, O) avatar 3D Three.js Naura dengan audio stream Fish Audio TTS.
- [x] **[CROSS-PLATFORM] Real-Time WebSocket Caravan Ambush Alerts via Web Push**:
  - Pengiriman notifikasi Web Push API di browser dashboard saat karavan dagang antariksa pemain sedang disergap oleh klan lawan di galaksi.
- [x] **[DEVOPS & WORKFLOW] Automated Git Commit & Push on Every Task Update (Zero-Lag GitHub Sync)**:
  - Otomasi sinkronisasi commit Git dan push langsung ke branch remote GitHub (`origin/main`) setiap kali tugas diperbarui dan lulus 5 gerbang QA Gate.

---

### 📜 Sprint 32: Unified Storyline Campaign, 4 Official Regions World Map, Tangible NPC Perks & Romance Family Engine (v2.3.0 Milestone Selesai)

- [x] **[SURVIVAL & STORYLINE] Unified Main Campaign Objective Saga (4 Acts, 16 Chapters)**:
  - Mengintegrasikan jalan cerita epik langsung ke dalam siklus petualangan utama Naura Wilds (`/survival story`), menghubungkan narasi dengan objektif nyata pemain (Desa Sukamaju, Kota Pratama, Desa Khul'Khas, hingga Istana Draken).
  - Menampilkan Main Campaign Objective aktif langsung di profil petualang (`/survival info`).
- [x] **[WORLD MAP EXPANSION] 4 Official World Regions & Sub-Zone POIs**:
  - Merealisasikan 4 Wilayah Resmi di `src/survival/data/worldMapData.js`:
    1. **Desa Sukamaju:** Distrik awal terpadu menyatukan pemukiman warga, ladang kebun Ningsih, pesisir dermaga nelayan Mang Ujang & Tari, hutan rimba satwa, dan gua pertambangan bijih. Mata uang: Sukamaju Koin (SC).
    2. **Kota Pratama:** Megapolitan modern pusat ekonomi, bursa kerja, RS Pratama, balai lelang, dan Bank Sentral Pratama untuk penukaran 1.000 SC -> 1 PD (Pratama Dollar).
    3. **Desa Khul'Khas:** Wilayah tersembunyi beriklim gurun pasir dan kuil mistik kuno yang menuntut penjelajahan mandiri (self-exploration).
    4. **Istana Draken:** Benteng kegelapan multi-floor dungeon (Lantai 1-50+) dengan drop artefak Mythic dan penjaga gerbang Gargoyle Malakor.
  - Subcommand `/survival town` dan `/survival travel` diperbarui untuk navigasi antar 4 wilayah dan inspeksi titik fasilitas POI.
- [x] **[NPC ENGAGEMENT & PERKS] Tangible Friendship Perks & Gift Preference Scale**:
  - Setiap NPC memiliki keuntungan nyata bagi gameplay: diskon belanja 10% s.d. 25% (Mbak Siti), pengurangan keausan alat -25% (Bagas), bonus hasil tambang +20% (Kang Deden & Jajang), peluang ikan langka +25% (Tari), efisiensi stamina -20% (Laras), bonus EXP +25% (Wulan & Bu Ratna), dan pengurangan sergapan bandit -70% (Mayor Lucy).
  - Matriks preferensi hadiah 5-tingkat di `src/survival/data/npcGiftPreferences.js`: Disliked (-5 RP), Simple (+5 RP), Special (+10 RP), Loved (+15 RP), dan Mythic (+25 RP) dengan dialog reaksi personal.
- [x] **[ROMANCE & FAMILY] Strict Monogamy Marriage System & Parenthood Event**:
  - Membuka peluang pernikahan resmi di Level 4 untuk seluruh 10 NPC wanita romansa (`ningsih`, `bidan_sari`, `bu_ratna`, `tari`, `mbak_siti`, `laras`, `wulan`, `suster_maya`, `mbak_rini`, `shino_hoshino`).
  - **Aturan Ketat Monogami:** Pemain hanya dapat menikahi 1 wanita dalam alur cerita hidupnya; percobaan poligami ditolak otomatis dengan pesan penjelasan.
  - Rutinitas keluarga: sarapan buatan istri yang memulihkan HP/stamina setiap pagi (`claimDailySpouseBreakfast`) dan kelahiran momongan (`triggerParenthood`).
- [x] **[VISUAL CG & ALBUM] Strict Access-Controlled Gallery (`/survival gallery`)**:
  - Ilustrasi Visual CG untuk kencan romantis (`/survival date`), upacara pernikahan suci (`wedding_[npcId]`), dan kehangatan keluarga bersama anak (`family_[npcId]`).
  - Proteksi privasi album: pemain hanya dapat mengakses gambar CG yang sudah pernah dibuka dan didapatkan secara sah.
- [x] **[WEB DASHBOARD] Tactical Territory Radar 4-Region Switcher & Dynamic POI Inspector**:
  - Web Dashboard (`survival-map.html`) kini dilengkapi navigasi tab 4 Wilayah Dunia, rendering blip fasilitas POI interaktif dari endpoint API `/api/survival/world-pois`, kartu detail POI dengan potret avatar warga menetap, serta widget Active Main Campaign Objective.
- [x] **[TEST SUITE] Automated Unit Tests & 100% QA Gate Green**:
  - Penambahan 23 unit test baru (`npcGiftPreferences.test.js`, `familyEngine.test.js`, `npcPerksEngine.test.js`, `worldMapPoi.test.js`), menjadikan total 364 automated tests lulus 100% hijau.

---

### 🚀 Sprint 33: Interactive Family Parenting, 3D Kinematics RigProfile, Dynamic Weather & GvG Territory Siege (v2.3.0 Milestone Berjalan)

- [x] **[3D KINEMATICS] Integrasi RigProfile & GLTF Humanoid Bone/Morph Adapter (`naura_animasi_fix.zip`)**:
  - Mengintegrasikan modul `core/rigProfile.js` (`buildHumanoidBones`, `GlbExpressionRig`) dan 10 sequence hasil kalibrasi ke dalam `dashboard/src/components/NauraViewer/animations/` sehingga seluruh animasi procedural 3D berjalan presisi pada model GLB/VRM.
- [x] **[BUG] Perbaikan Logika Validasi Alur Perjalanan ke Desa Asal (`travel.js`)**:
  - Memperbaiki kondisi pembatasan perjalanan di `travel.js` agar petualang pemula tanpa rumah/kendaraan dapat kembali ke desa awal (`desa_sukamaju`) tanpa terhalang `err_sys_67`.
- [x] **[AI RUNTIME] Sinkronisasi Default Model & Dynamic Model Fallback Chain (`geminiClient.js` & `aiEnsembleRouter.js`)**:
  - Menyelaraskan default model ke `env.GEMINI_MODEL` dan memperluas rantai fallback Groq dengan array model dinamis untuk mencegah HTTP 404 saat rotasi model API.
- [x] **[AUDIO CLUSTER] Auto-Recover Stalled Lavalink WebSocket Sessions via Heartbeat Ping Watchdog (`lavalinkClusterManager.js`)**:
  - Heartbeat ping berkala 15 detik dengan timeout recovery otomatis pada sesi player Lavalink yang mengalami silent freeze.
- [x] **[KEAMANAN & MUTEX] Multi-Key Distributed Lock Helper Anti-Deadlock (`cacheManager.withMultiLock`)**:
  - Pengurutan leksikografis kunci Redis terdistribusi sebelum penguncian multi-user untuk mencegah deadlock pada transaksi barter dan duel.
- [x] **[FITUR BARU] Interactive Family Parenting & Apprentice System (`UserChild.js` & `/survival family`)**:
  - Sistem pengasuhan anak interaktif (status, makan, belajar, magang bakat ibu) terintegrasi penuh ke model `UserChild.js` dan antarmuka Components V2.
- [x] **[FITUR BARU] Ancient Relic Tower Sieges & Dynamic Territory Control (`territoryWarEngine.js` Phase 2 / `/clan siege`)**:
  - Pertempuran mingguan perebutan Menara Relik Kuno antar aliansi klan dengan dividen harian dan status buff pasif regional.
- [x] **[FITUR BARU] Dynamic World Weather & Seasonal Natural Hazards (`worldWeatherEngine.js` & `/survival status`)**:
  - Sistem cuaca dunia prosedural 6-jam dengan dampak gameplay nyata terhadap efisiensi bertani, menambang, dan menjelajah.
- [x] **[FITUR BARU] Guild Caravan Raids & Clan Escort Contracts Hub (`/clan caravan` & `/caravan escort`)**:
  - Papan kontrak pengawalan karavan dagang berbayar dan konvoi antar pemain dengan brankas escrow terjamin.
- [x] **[FITUR BARU] Pet Breeding, Evolution & Cosmic Fusion Engine (`UserPet.js` & `/survival pet breed`)**:
  - Perkawinan silang peliharaan untuk pewarisan sifat pasif dan jalur evolusi hingga Tahap 3 Cosmic Celestial Companion.
- [x] **[FITUR BARU] AI Dynamic Radio Host & Voice Track Announcements (`aiDjManager.js` / `/music radio`)**:
  - Fitur radio DJ interaktif bertenaga Fish Audio TTS dengan audio ducking otomatis saat Naura menyapa pendengar voice channel.
- [x] **[PERFORMA] WebP Streaming Compression & Memory Pooling on Canvas Worker (`canvasWorkerPool.js`)**:
  - Konversi hasil render Canvas berat ke WebP adaptif untuk kompresi ukuran file hingga 40-60% dan percepatan response gateway Discord.
- [x] **[PERFORMA] Canvas Worker Memory Leak Guard & Context Recycle Loop (`canvasWorkerPool.js`)**:
  - Daur ulang worker thread berkala setiap 500 tugas untuk stabilitas konsumsi RAM jangka panjang.
- [x] **[DASHBOARD V2] Web Dashboard Token Refresh & Auto-Reconnection Interceptor (`auth-manager.js`)**:
  - Auto-refresh token sesi OAuth Discord pada Web Dashboard tanpa memutus sesi input pengguna.
- [x] **[LIVING AI] Semantic Memory Auto-Pruning & Vector De-duplication (`semanticMemoryService.js`)**:
  - Pengelompokan dan de-duplikasi memori vektor berjarak dekat (>0.92 cosine similarity) untuk menjaga kecepatan query RAG <5ms.

---

### 🚀 Sprint 34: Backlog & Implementasi Roadmap Fitur Baru (Hasil Penyaringan 50 Fitur)

> **Konteks:** Hasil audit komprehensif terhadap 50 ide fitur ekosistem Naura Hoshino V2 (Node 24, v2.3.0) yang meminimalisir ketergantungan API AI free-tier, serta pemisahan blueprint modul AI ke folder cadangan `pending_plugin/`.

#### 🟢 A. Telah Terverifikasi Selesai di Repositori (18 Fitur)

- [x] **[SETUP BOT] Automated Server Setup Wizard & Guild Presets (#8)**
  - Wizard penyiapan server Discord otomatis berbasis Components V2, pembuatan channel/role otomatis, dan opsi preset gaming/komunitas.
  - File: [`plugin/admin/setup.js`](plugin/admin/setup.js), [`src/services/onboardingWizard.js`](src/services/onboardingWizard.js), [`src/interactions/selects/setupPreset.js`](src/interactions/selects/setupPreset.js).
- [x] **[DASHBOARD 3D] Interactive 3D Mascot Dressing Room & Wardrobe Studio (#11)**
  - Studio kustomisasi tema shader dan material avatar 3D Naura (Cyberpunk, Maid, Casual, Adventurer) dengan persistensi preferensi user.
  - File: [`dashboard/src/components/NauraViewer/wardrobeStudio.js`](dashboard/src/components/NauraViewer/wardrobeStudio.js), [`dashboard/src/components/NauraViewer/index.js`](dashboard/src/components/NauraViewer/index.js).
- [x] **[TELEMETRI] Live Server Status & Architecture Topology Widgets (#16 & #49)**
  - Panel visual telemetri real-time yang memantau latensi Lavalink, kesehatan Supabase/MongoDB, memori Redis, dan status uptime.
  - File: [`dashboard/src/pages/status.html`](dashboard/src/pages/status.html), [`dashboard/src/pages/topology.html`](dashboard/src/pages/topology.html), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[AUDIO STUDIO] Web Soundboard Studio Real-Time Sync (#21)**
  - Soundpad interaktif pada Web Dashboard yang memicu efek suara instan ke Voice Channel bot via WebSocket Socket.IO & Poru player audio overlay.
  - File: [`dashboard/src/pages/soundboard.html`](dashboard/src/pages/soundboard.html), [`src/services/soundboardService.js`](src/services/soundboardService.js).
- [x] **[AUDIO RADIO] 24/7 Lo-Fi Radio Mode & Broadcast Companion (#24)**
  - Pemutaran musik santai tanpa henti di Voice Channel (`/radio`) untuk menemani aktivitas grinding petualang.
  - File: [`plugin/music/radio.js`](plugin/music/radio.js), [`src/services/radioService.js`](src/services/radioService.js).
- [x] **[CANVAS AUDIO] "Now Playing" Dynamic Visualizer Card (#27)**
  - Generator gambar estetik pemutar lagu dengan album art, progress bar, dan tema visual kustom via Canvas Worker.
  - File: [`src/canvas/nowplayingCanvas.js`](src/canvas/nowplayingCanvas.js), [`plugin/music/music.js`](plugin/music/music.js).
- [x] **[EKONOMI] Dynamic Commodity & Stock Market Fluctuations (#28)**
  - Formula fluktuasi harga item dasar (hasil tambang, ikan laut dalam, panen) berdasarkan penawaran dan permintaan global.
  - File: [`src/survival/engines/commodityMarketEngine.js`](src/survival/engines/commodityMarketEngine.js), [`src/services/stockMarketEngine.js`](src/services/stockMarketEngine.js).
- [x] **[ESCROW] Smart Contract Bounties & Escrow Guarantee (#29)**
  - Sistem jaminan escrow aman untuk sayembara komunitas dan kontrak pengawalan karavan dagang antariksa.
  - File: [`src/services/bountyVaultEngine.js`](src/services/bountyVaultEngine.js), [`src/services/tradeEngine.js`](src/services/tradeEngine.js).
- [x] **[CROSS-SERVER] Cross-Server Caravan Cartel & Intercept (#3)**
  - Perjalanan karavan lintas server dengan sistem pengawalan berbayar dan penyergapan PvP terproteksi mutex.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`plugin/survival/subcommands/caravan.js`](plugin/survival/subcommands/caravan.js).
- [x] **[GVG SIEGE] Clan Territory War & Relic Tower Sieges (#37)**
  - Perang perebutan menara relik kuno antar klan dengan kontrol teritori 8x8 dan dividen kas aliansi harian.
  - File: [`src/survival/engines/territoryWarEngine.js`](src/survival/engines/territoryWarEngine.js), [`plugin/survival/subcommands/siege.js`](plugin/survival/subcommands/siege.js).
- [x] **[DUNGEON] Procedural The Neo-Abyss Dungeon Raids (#38)**
  - Ekspedisi dungeon multi-stage prosedural dengan room acak (Combat, Event, Rest, Treasure) dan drop pool atomik.
  - File: [`src/survival/engines/abyssEngine.js`](src/survival/engines/abyssEngine.js), [`plugin/survival/subcommands/abyss.js`](plugin/survival/subcommands/abyss.js).
- [x] **[PET RPG] Pet Breeding, Evolution & Cosmic Fusion Engine (#39)**
  - Perkawinan silang peliharaan untuk pewarisan sifat pasif dan evolusi hingga Tahap 3 Cosmic Companion.
  - File: [`src/survival/engines/petHabitatEngine.js`](src/survival/engines/petHabitatEngine.js), [`src/models/UserPet.js`](src/models/UserPet.js), [`plugin/survival/subcommands/pet.js`](plugin/survival/subcommands/pet.js).
- [x] **[CUACA DUNIA] Scripted Dynamic Weather & Seasonal Hazards (#40)**
  - Siklus cuaca dunia berotasi 6 jam dengan efek nyata terhadap efisiensi bertani, stamina, dan keausan alat.
  - File: [`src/survival/engines/worldWeatherEngine.js`](src/survival/engines/worldWeatherEngine.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js).
- [x] **[CRAFTING] Layered Crafting Blueprints & Stat Validation (#41)**
  - Validasi resep perakitan alat dengan syarat level, stat atribut, dan konsumsi blueprint item.
  - File: [`src/survival/data/craftingRecipes.js`](src/survival/data/craftingRecipes.js), [`src/survival/helpers/craftActions.js`](src/survival/helpers/craftActions.js).
- [x] **[MINIGAME] Fishing Minigame with Reaction QTE (#42)**
  - Sistem memancing interaktif dengan batas respon 2.5 detik untuk strike ikan langka.
  - File: [`plugin/survival/subcommands/fish.js`](plugin/survival/subcommands/fish.js).
- [x] **[HOUSING] Virtual Cyber-Pod Room & Furniture Decorator (#43)**
  - Kamar virtual pemain di MongoDB dengan penataan furnitur dan skor kenyamanan yang memberikan pasif buff.
  - File: [`src/models/mongo/UserRoom.js`](src/models/mongo/UserRoom.js), [`plugin/utility/room.js`](plugin/utility/room.js).
- [x] **[AFK REWARDS] Automated Offline Revenue & Progression Engine (#47)**
  - Kalkulasi pendapatan pasif kafe dan akuarium vivarium berbasis selisih timestamp secara atomik.
  - File: [`src/survival/engines/cafeEngine.js`](src/survival/engines/cafeEngine.js), [`src/survival/engines/vivariumEngine.js`](src/survival/engines/vivariumEngine.js), [`src/managers/cronManager.js`](src/managers/cronManager.js).
- [x] **[AI STASHING] Pembentukan Direktori Isolasi `pending_plugin/`**
  - Mengarsipkan 5 modul AI ke direktori `pending_plugin/` lengkap dengan `README.md` penjelas agar tidak memicu kuota API.
  - File: [`pending_plugin/README.md`](pending_plugin/README.md), [`pending_plugin/ai_rpg_villagers/autonomousNpcVillager.js`](pending_plugin/ai_rpg_villagers/autonomousNpcVillager.js), [`pending_plugin/ai_vision_loot/visionLootAppraiser.js`](pending_plugin/ai_vision_loot/visionLootAppraiser.js), [`pending_plugin/ai_storyteller/dreamWeaverStoryteller.js`](pending_plugin/ai_storyteller/dreamWeaverStoryteller.js), [`pending_plugin/ai_voice_clone/voiceCloneCompanion.js`](pending_plugin/ai_voice_clone/voiceCloneCompanion.js), [`pending_plugin/ai_radio_podcast/dailyChroniclePodcast.js`](pending_plugin/ai_radio_podcast/dailyChroniclePodcast.js).

---

#### 🟡 B. Implementasi Parsial (Perlu Penyempurnaan Visual / UI) (10 Fitur)

- [x] **[CANVAS UI] Customizable Profile Card Theme Palette Picker (#5)**
  - Menambahkan menu interaktif `/profile theme` atau tombol dropdown di Discord untuk memilih variasi palet warna profil Canvas (Neon Emerald, Cyber Pink, Midnight Gold).
  - File: [`src/canvas/profileCanvas.js`](src/canvas/profileCanvas.js), [`plugin/utility/profile.js`](plugin/utility/profile.js), [`src/interactions/selects/profileTheme.js`](src/interactions/selects/profileTheme.js).
- [x] **[RETENSI] Visual Daily Login Streak Calendar & Stamp Card (#6)**
  - Mengintegrasikan representasi visual kalender mingguan / bulanan (berbasis emoji atau Canvas stamp card) pada respons `/daily` untuk meningkatkan retensi login.
  - File: [`plugin/utility/daily.js`](plugin/utility/daily.js).
- [x] **[LOKALISASI] Quick Language Toggle Button on Discord UI (#9)**
  - Menambahkan tombol interaktif bendera (ID / EN) pada footer container profil atau bantuan sehingga bahasa respons dapat diubah instan dalam 1 klik tanpa mengetik `/lang`.
  - File: [`plugin/utility/lang.js`](plugin/utility/lang.js), [`src/interactions/buttons/langToggle.js`](src/interactions/buttons/langToggle.js).
- [x] **[DASHBOARD WEB] Town Square Live Multiplayer Avatar Radar (#12)**
  - Menampilkan posisi avatar pemain yang sedang online secara live di peta `survival-map.html` menggunakan event Socket.IO.
  - File: [`dashboard/src/pages/survival-map.html`](dashboard/src/pages/survival-map.html), [`dashboard/sockets/index.js`](dashboard/sockets/index.js).
- [x] **[PWA MOBILE] Full Progressive Web App Manifest & Install Prompt (#14)**
  - Menambahkan file `manifest.json`, icon splash screen, dan prompt "Install to Home Screen" di browser mobile pada Web Dashboard.
  - File: [`dashboard/public/manifest.json`](dashboard/public/manifest.json), [`dashboard/public/js/pwa-install.js`](dashboard/public/js/pwa-install.js), [`dashboard/src/pages/index.html`](dashboard/src/pages/index.html).
- [x] **[DASHBOARD WEB] Web-Based Guild Management Hub (#18)**
  - Halaman web khusus bagi ketua klan untuk mengelola daftar anggota, promosi jabatan, dan melihat riwayat kas klan secara visual.
  - File: [`dashboard/src/pages/clan.html`](dashboard/src/pages/clan.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **[DASHBOARD WEB] Interactive Web Marketplace & Auction House (#19)**
  - Antarmuka visual untuk melihat barang lelang aktif dan melakukan penawaran (bid/buyout) langsung melalui Web Dashboard.
  - File: [`dashboard/src/pages/marketplace.html`](dashboard/src/pages/marketplace.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **[AUDIO DJ] Collaborative DJ Queue Voting System (#22)**
  - Tombol polling interaktif di Discord bagi pendengar voice channel untuk memberikan suara pada lagu antrean berikutnya.
  - File: [`plugin/music/music.js`](plugin/music/music.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`src/interactions/buttons/voteSkip.js`](src/interactions/buttons/voteSkip.js).
- [x] **[AUDIO DSP] Interactive Audio Filter Control Panel Select Menu (#25)**
  - Antarmuka Select Menu interaktif di bawah pesan `/music filter` yang memungkinkan pergantian preset equalizer secara instan tanpa mengetik ulang command.
  - File: [`plugin/music/music.js`](plugin/music/music.js), [`src/music/audioFilters.js`](src/music/audioFilters.js), [`src/interactions/selects/musicFilter.js`](src/interactions/selects/musicFilter.js).
- [x] **[ADMIN ANALYTICS] Cross-Database Historical Growth Charts (#31)**
  - Menambahkan grafik visual pertumbuhan pengguna, ukuran dokumen MongoDB, dan throughput transaksi Supabase pada dashboard admin.
  - File: [`dashboard/src/pages/status.html`](dashboard/src/pages/status.html), [`dashboard/routes/api.js`](dashboard/routes/api.js).

---

#### 🟢 C. Roadmap Fitur Baru (22 Fitur Selesai 100%)

- [x] **[UX ONBOARDING] Interactive Player Onboarding Flow (#1)**: Panduan langkah demi langkah berbasis modal dan button container saat petualang pertama kali menjalankan perintah survival. File: [`src/survival/engines/playerOnboardingEngine.js`](src/survival/engines/playerOnboardingEngine.js), [`src/survival/engines/playerOnboardingEngine.test.js`](src/survival/engines/playerOnboardingEngine.test.js), [`src/interactions/selects/onboardingSelect.js`](src/interactions/selects/onboardingSelect.js), [`src/interactions/buttons/onboardingButton.js`](src/interactions/buttons/onboardingButton.js), [`plugin/survival/survival.js`](plugin/survival/survival.js).
- [x] **[BOT ENGINE] Context-Aware Smart Suggestions via Levenshtein Distance (#2)**: Algoritma pendeteksi salah ketik slash command atau prefix yang menyodorkan tombol aksi langsung untuk mengeksekusi perintah yang dimaksud. File: [`src/utils/levenshteinSuggest.js`](src/utils/levenshteinSuggest.js), [`src/events/messageCreate/prefixCommand.js`](src/events/messageCreate/prefixCommand.js).
- [x] **[DISCORD UI] Unified Dynamic Leaderboard with Multi-Category Pagination (#4)**: Command `/leaderboard` tunggal dengan Select Menu interaktif untuk berpindah kategori (Dompet, Bank, Level RPG, ELO Kartu) tanpa spam pesan. File: [`src/services/leaderboardService.js`](src/services/leaderboardService.js), [`plugin/utility/leaderboard.js`](plugin/utility/leaderboard.js), [`src/interactions/selects/leaderboardCategory.js`](src/interactions/selects/leaderboardCategory.js), [`src/interactions/buttons/leaderboardPagination.js`](src/interactions/buttons/leaderboardPagination.js).
- [x] **[INTEGRASI] Automated Discord Role-Syncing based on Survival Achievements (#7)**: Bot secara otomatis menyematkan role khusus server ketika pemain mencapai milestone level atau kekayaan tertentu. File: [`src/services/roleSyncService.js`](src/services/roleSyncService.js), [`plugin/admin/levelrole.js`](plugin/admin/levelrole.js), [`src/leveling/levelingEngine.js`](src/leveling/levelingEngine.js).
- [x] **[BOT ENGINE] Per-User Custom Command Aliases (#10)**: Fitur bagi petualang untuk mendaftarkan shortcut pribadi (misal `/f` untuk `/farm status`). File: [`src/services/aliasService.js`](src/services/aliasService.js), [`src/models/mongo/UserAlias.js`](src/models/mongo/UserAlias.js), [`plugin/utility/alias.js`](plugin/utility/alias.js), [`src/events/messageCreate/prefixCommand.js`](src/events/messageCreate/prefixCommand.js).
- [x] **[BOT REPORT] Direct-to-Owner Modal Report & Two-Way DM Desk (#51)**: Formulir laporan keluhan/bug pengguna via modal Discord dan attachment screenshot yang diteruskan langsung ke DM owner bot, dilengkapi tombol balas dua arah dan pelacak status tiket `/report status_id:<id>`. File: [`plugin/utility/report.js`](plugin/utility/report.js), [`src/services/reportService.js`](src/services/reportService.js), [`src/services/reportService.test.js`](src/services/reportService.test.js), [`src/models/mongo/UserReport.js`](src/models/mongo/UserReport.js), [`src/interactions/modals/userReport.js`](src/interactions/modals/userReport.js), [`src/interactions/buttons/reportOwnerButtons.js`](src/interactions/buttons/reportOwnerButtons.js), [`src/interactions/modals/ownerReplyReport.js`](src/interactions/modals/ownerReplyReport.js).
- [x] **[EMERGENCY OPS] Incident Response Desk, Key-Gated Code Runner & Anti-Raid Panic (#52)**: Alat mitigasi insiden operasional khusus DM Owner (`/owner doctor`, `/owner maintenance`, `/owner killswitch`, `/owner logs`, `/owner repair`, `/owner keygen`, `/owner keylist`, `/owner keyrevoke`), tombol diagnostik cepat (`incident_flush_cache`, `incident_release_locks`), mode karantina anti-serbuan raid server (`/moderation panic aksi:<enable|restore>`), dan runner kode publik terisolasi sandbox dengan verifikasi kunci akses pengembang (`/run code:<script> key:<key>`). File: [`plugin/admin/ownerOps.js`](plugin/admin/ownerOps.js), [`plugin/utility/runCode.js`](plugin/utility/runCode.js), [`plugin/admin/moderation.js`](plugin/admin/moderation.js), [`src/services/incidentService.js`](src/services/incidentService.js), [`src/services/sandboxService.js`](src/services/sandboxService.js), [`src/services/accessKeyService.js`](src/services/accessKeyService.js), [`src/models/mongo/DevAccessKey.js`](src/models/mongo/DevAccessKey.js), [`src/interactions/buttons/incidentButtons.js`](src/interactions/buttons/incidentButtons.js), [`src/events/interactionCreate.js`](src/events/interactionCreate.js).

##### 2. Kategori: Web Dashboard V2 (Front End)
- [x] **[MINIGAME] Web-Based Mini Games Arcade Connected to Bot Economy (#13)**: Mini-game HTML5 ringan di browser (fishing arcade, puzzle) yang memberikan hadiah SC/PD ke akun Discord pemain. File: [`dashboard/src/pages/arcade.html`](dashboard/src/pages/arcade.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **[WEB INVENTORY] Drag-and-Drop Visual Inventory Management (#15)**: Halaman web untuk mengatur tata letak dan menyortir isi ransel inventaris petualang dengan antarmuka seret-lepas. File: [`dashboard/src/pages/inventory.html`](dashboard/src/pages/inventory.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **[THEME] Dynamic Multi-Theme Switcher on Stellar Glass OS (#17)**: Pilihan tema tampilan dashboard (Stellar Dark, Cyber Neon, Emerald Nature, Light Horizon) berbasis CSS variables. File: [`dashboard/src/css/stellar.css`](dashboard/src/css/stellar.css), [`dashboard/public/js/theme-switcher.js`](dashboard/public/js/theme-switcher.js), [`dashboard/src/pages/index.html`](dashboard/src/pages/index.html).
- [x] **[3D / 2D] Virtual Achievement Showcase & Trophy Room (#20)**: Ruang pameran piala virtual di web dashboard untuk memajang medali dan gelar langka pemain. File: [`dashboard/src/pages/achievements.html`](dashboard/src/pages/achievements.html), [`dashboard/server.js`](dashboard/server.js).
- [x] **[ADMIN] Hidden Admin God Mode Web Panel (#50)**: Antarmuka terproteksi izin owner untuk inspeksi dan modifikasi saldo/inventaris pemain secara cepat tanpa query database mentah. File: [`dashboard/src/pages/admin.html`](dashboard/src/pages/admin.html), [`dashboard/server.js`](dashboard/server.js).

##### 3. Kategori: Audio Engine (Lavalink)
- [x] **[AUDIO QUEUE] Redis-Backed Lavalink Queue Persistence & Auto-Resume (#23)**: Penyimpanan state antrean lagu aktif di Redis agar musik dapat dilanjutkan otomatis setelah bot selesai restart/deploy. File: [`src/managers/musicManager.js`](src/managers/musicManager.js), [`src/managers/musicManager.test.js`](src/managers/musicManager.test.js), [`src/music/poru_events/trackStart.js`](src/music/poru_events/trackStart.js), [`src/music/poru_events/queueEnd.js`](src/music/poru_events/queueEnd.js).
- [x] **[AUDIO LYRICS] Interactive Lyrics Fetcher & Clean Discord Paginator (#26)**: Integrasi API lirik lagu eksternal (Lrclib/Genius) dengan tata letak pembalik halaman yang rapi dan penanda waktu. File: [`src/services/lyricsService.js`](src/services/lyricsService.js), [`plugin/music/music.js`](plugin/music/music.js).

##### 4. Kategori: Database & Backend Architecture
- [x] **[BACKUP] Automated Cloud Database Backup Cron Scheduler (#30)**: Cron job periodik yang membuat salinan dump basis data Supabase, MySQL, MongoDB, & SQLite lalu membersihkan backup lama secara otomatis. File: [`src/managers/backupManager.js`](src/managers/backupManager.js), [`src/managers/backupManager.test.js`](src/managers/backupManager.test.js), [`src/managers/cronManager.js`](src/managers/cronManager.js).
- [x] **[MONITORING] Write-Behind Cache Flush Metrics & Latency Monitor (#32)**: Kartu telemetri pemantau ukuran buffer antrean dan durasi flush Redis-ke-Postgres pada halaman admin. File: [`src/managers/cacheManager.js`](src/managers/cacheManager.js), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[MONITORING] Hourly Command Traffic & Rate Limit Spike Visualizer (#33)**: Grafik beban trafik perintah per jam untuk memantau aktivitas server dan potensi abuse. File: [`src/managers/trafficMonitor.js`](src/managers/trafficMonitor.js), [`src/managers/trafficMonitor.test.js`](src/managers/trafficMonitor.test.js), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[DATABASE] Sequelize Paranoid Soft-Delete Architecture (`deletedAt`) (#34)**: Penerapan kolom `deletedAt` pada model data krusial untuk mencegah kehilangan data akibat penghapusan tidak sengaja. File: [`src/managers/dbMigrator.js`](src/managers/dbMigrator.js), [`src/models/UserProfile.js`](src/models/UserProfile.js), [`src/models/GuildSettings.js`](src/models/GuildSettings.js), [`src/models/UserSurvival.js`](src/models/UserSurvival.js), [`src/models/TradeCaravan.js`](src/models/TradeCaravan.js), [`src/models/MarketAuction.js`](src/models/MarketAuction.js).
- [x] **[ADMIN] Distributed Mutex Deadlock & Lock Contention Viewer (#35)**: Tampilan visual di web admin untuk memantau tabrakan lock transaksi multi-user yang berhasil dicegah. File: [`src/utils/redisLockHelper.js`](src/utils/redisLockHelper.js), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[NOTIFIKASI] User-Defined Webhook Endpoints for Farming Alerts (#36)**: Pengaturan webhook pribadi agar pemain menerima notifikasi instan saat tanaman siap dipanen. File: [`src/services/farmNotificationWebhook.js`](src/services/farmNotificationWebhook.js), [`src/services/farmNotificationWebhook.test.js`](src/services/farmNotificationWebhook.test.js), [`plugin/survival/subcommands/farm.js`](plugin/survival/subcommands/farm.js), [`src/survival/helpers/survivalGroupsLife.js`](src/survival/helpers/survivalGroupsLife.js), [`src/managers/cronManager.js`](src/managers/cronManager.js).

##### 5. Kategori: Survival RPG (Naura Wilds)
- [x] **[PVP] Bounty Hunter & Wanted Outlaw Board (#44)**: Sistem perburuan buronan pemain berhadiah imbalan besar di Naura Wilds. File: [`src/survival/engines/outlawBountyEngine.js`](src/survival/engines/outlawBountyEngine.js), [`src/survival/engines/outlawBountyEngine.test.js`](src/survival/engines/outlawBountyEngine.test.js), [`plugin/survival/subcommands/bounty.js`](plugin/survival/subcommands/bounty.js).
- [x] **[RPG TALENTS] Branching Skill Trees & Specialization Talents (#45)**: Pilihan cabang keahlian (Petani Ahli, Pedagang Ulung, Pendekar Tempur) saat mencapai level 10 ke atas. File: [`src/survival/engines/skillTreeEngine.js`](src/survival/engines/skillTreeEngine.js), [`plugin/survival/subcommands/skill.js`](plugin/survival/subcommands/skill.js), [`plugin/survival/subcommands/class.js`](plugin/survival/subcommands/class.js).
- [x] **[AGRONOMI] Farming Crop Cross-Breeding & Hybrid Seeds (#46)**: Mekanik perkawinan silang benih tanaman berdampingan di greenhouse untuk menghasilkan varietas bibit unggul baru. File: [`src/survival/data/cropSeeds.js`](src/survival/data/cropSeeds.js), [`src/survival/engines/greenhouseEngine.js`](src/survival/engines/greenhouseEngine.js), [`src/survival/engines/greenhouseEngine.test.js`](src/survival/engines/greenhouseEngine.test.js), [`plugin/survival/subcommands/farm.js`](plugin/survival/subcommands/farm.js).
- [x] **[QOL] In-Discord Interactive Bug Reporter Modal with GitHub Sync (#48)**: Formulir modal Discord yang rapi bagi pemain untuk melaporkan bug, otomatis diformat dan diteruskan ke channel pengembang atau GitHub Issues. File: [`plugin/utility/bug.js`](plugin/utility/bug.js), [`src/interactions/modals/reportBug.js`](src/interactions/modals/reportBug.js).

##### 6. Kategori: Feature Enhancement Suite (7 Sprint Utilitas & Moderasi Selesai 100%)
- [x] **[SPRINT 1 - MODERASI & PERINGATAN] Konfirmasi Interaktif Bertingkat & Audit Tracking**:
  - Tombol konfirmasi interaktif bertingkat (`[Ya, Lanjutkan]` vs `[Batalkan]`) sebelum eksekusi hukuman destruktif (`/moderation kick`, `/moderation ban`, `/moderation timeout`).
  - Pembersihan pesan bertahap (`/moderation purge`) dengan visual progress dan eliminasi rate limit freeze.
  - Sistem sanksi `/warn` dengan konfirmasi pembersihan, visual badge keparahan tiga tingkat (`🟢`, `🟡`, `🔴`), dan indikator strike akumulasi.
  - Kategorisasi catatan moderator `/modnote` (`💳`, `⚙️`, `🚨`) serta siaran status lockdown kanal (`/moderation lockdown`) dengan timestamp dinamis Discord `<t:...:R>`.
  - File: [`plugin/admin/moderation.js`](plugin/admin/moderation.js), [`plugin/admin/warn.js`](plugin/admin/warn.js), [`plugin/admin/modnote.js`](plugin/admin/modnote.js), [`plugin/admin/lockdown.js`](plugin/admin/lockdown.js).
- [x] **[SPRINT 2 - ADMIN TOOLS] Dynamic Canvas Giveaway Banner & Setup Health Score**:
  - Banner grafis dynamic giveaway pada `/giveaway start` melalui `generateGiveawayBanner` dengan fallback aman.
  - Perluasan `/announce` dengan penerusan gambar lampiran, opsi pinning pesan otomatis, dan mention peran opsional.
  - Meteran konfigurasi server (`/setup status`) dengan kalkulasi skor kesehatan server 0-100% dan visual meter `▰▱`.
  - File: [`src/canvas/dynamicBannerEngine.js`](src/canvas/dynamicBannerEngine.js), [`plugin/admin/giveaway.js`](plugin/admin/giveaway.js), [`plugin/admin/announce.js`](plugin/admin/announce.js), [`plugin/admin/setup.js`](plugin/admin/setup.js).
- [x] **[SPRINT 3 - PROFIL & LEVELING] Bento Grid Stats & Atomic Reputation Podium**:
  - Tampilan kartu profil `/profile` modular dengan panel finansial (Cash, Bank, Total), reputasi, status pernikahan, dan tombol pintasan sosial.
  - Format metrik bento grid pada kartu peringkat `/rank` (Level, Kemajuan XP, Rank Server, Integritas).
  - Timeline siklus 7 hari streak pada `/daily` dengan penanda lootbox tonggak pencapaian dan perbaikan payload Components V2.
  - Transaksi atomik mutasi reputasi (`/reputation give`) via `cacheManager.incrementUserProfile` dan papan peringkat podium interaktif tiga besar (`🥇🥈🥉`).
  - File: [`plugin/utility/profile.js`](plugin/utility/profile.js), [`plugin/leveling/rank.js`](plugin/leveling/rank.js), [`plugin/utility/daily.js`](plugin/utility/daily.js), [`plugin/utility/reputation.js`](plugin/utility/reputation.js).
- [x] **[SPRINT 4 - UTILITAS SOSIAL] Realtime Polling ASCII Bars & Timed Productivity**:
  - Polling interaktif `/poll` dengan tombol bernomor (`1️⃣`-`4️⃣`), visual bar rasio suara ASCII real-time (`▰▱`), dan batas waktu penutupan akurat.
  - Notifikasi pengingat `/remind` dengan ringkasan timestamp dinamis dan daftar pengingat aktif yang terstruktur.
  - Kartu status `/afk` minimalis dengan mode senyap, format pencarian rekan tim `/lfg` dengan slot terstruktur dan tombol peran, serta sesi fokus `/pomodoro` dengan sanitasi `MessageFlags`.
  - File: [`plugin/utility/poll.js`](plugin/utility/poll.js), [`plugin/utility/remind.js`](plugin/utility/remind.js), [`plugin/utility/afk.js`](plugin/utility/afk.js), [`plugin/utility/lfg.js`](plugin/utility/lfg.js), [`plugin/utility/pomodoro.js`](plugin/utility/pomodoro.js).
- [x] **[SPRINT 5 - UTILITAS EKONOMI] Visual Market Odds & Total Portfolio Valuation**:
  - Kalkulasi valuasi total portofolio saham `/stock portfolio` dan indikator akumulasi profit/loss (`totalPL`, persentase, dan badge hijau/merah).
  - Tampilan prediksi pasar `/predict` dengan bar distribusi pool dua sisi (`▰▱`), rasio persentase, dan estimasi pengganda imbalan.
  - Penyelarasan format subtext markdown Discord (`-#`) pada layanan klasemen `leaderboardService.js`.
  - File: [`plugin/utility/stock.js`](plugin/utility/stock.js), [`plugin/utility/predict.js`](plugin/utility/predict.js), [`src/services/leaderboardService.js`](src/services/leaderboardService.js).
- [x] **[SPRINT 6 - UTILITAS TOOLS & FUN] Biome Buff Forecaster & Multi-Source Media Search**:
  - Kartu ramalan cuaca `/weather` dengan indikator dampak buff/debuff biome Naura Wilds.
  - Katalog pencarian global omni-search `/search` dan penerjemah multibahasa `/translate`.
  - Sistem pencarian anime `/anime` dan film `/movie` berbasis arsitektur multi-tier waterfall (Jikan/AniList/Kitsu & OMDB/TVMaze/Wikipedia) dengan navigasi halaman interaktif.
  - File: [`plugin/utility/weather.js`](plugin/utility/weather.js), [`plugin/utility/search.js`](plugin/utility/search.js), [`plugin/utility/translate.js`](plugin/utility/translate.js), [`plugin/utility/anime.js`](plugin/utility/anime.js), [`plugin/utility/movie.js`](plugin/utility/movie.js).
- [x] **[SPRINT 7 - CORE & QA GATE] Multi-Service Telemetry Diagnostics & 6/6 Green QA Gate**:
  - Telemetri diagnostik multi-layanan `/ping` (WebSocket Gateway, Lavalink, Supabase PG, Redis, dan MongoDB) dengan latensi terperinci.
  - Validasi ketat QA Gate (ESLint, No Em-Dash, Paritas Kamus Strict ID/EN, Require Integrity, Dashboard Inline Scripts, dan 483/483 Unit Tests Lolos 100%).
  - File: [`plugin/core/core.js`](plugin/core/core.js), [`src/managers/diagnosticsManager.js`](src/managers/diagnosticsManager.js).

---

## ⚠️ Risiko yang Harus Terus Dipantau

| Risiko                                            | Dampak                                                    | Mitigasi                                                                                         |
| ------------------------------------------------- | --------------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Ekonomi tanpa penulisan atomik**                | Inflasi tak terkendali, duplikasi saldo/barang            | Pola `debit*` / `increment*` bersyarat dan transaksi `SELECT FOR UPDATE` pada kolom JSON.        |
| **Race condition transaksi multi-node**           | Duplikasi dispatch caravan atau mutasi state paralel      | Redis Distributed Mutex (`cacheManager.withLock` / `redisLockHelper.js`) dengan lease TTL.       |
| **Race condition WebSocket saat audio buffering** | Bot terputus dari voice channel (error 4006)              | Delay prefetch 1500ms di `trackStart.js` dan proteksi `VoiceManager` terhadap Poru player aktif. |
| **Beban komputasi Canvas memblokir Event Loop**   | Bot mengalami freeze / chat lag                           | Seluruh render grafis didelegasikan ke `canvasWorkerPool.js` berbasis Worker Threads.            |
| **Pelanggaran karakter em dash**                  | Gagal validasi CI / inkonsistensi teks                    | Diperiksa otomatis oleh script `scripts/check-em-dash.js`.                                       |
| **Single-point-of-failure node eksternal**        | Fitur audio/AI mati saat penyedia pihak ketiga down       | Sistem dual failover: Lavalink multi-node fallback dan Gemini auto-failover ke Groq.             |
| **Ketergantungan aset luar pada dbSeeder**        | Canvas Assets default hilang jika host luar mati          | Menggunakan aset gambar lokal mandiri di `assets/images/canvas/` (100% tuntas).                  |
| **Versi Node tidak konsisten**                    | CI/CD gagal atau bot mati diam-diam di Node 22            | Selaraskan `package.json engines` dengan keputusan arsitektur Node >= 24.                        |
