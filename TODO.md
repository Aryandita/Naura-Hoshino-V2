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
| **Versi Node**           | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian.                                                             |
| **Penyimpanan Bahasa**   | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi.                      |
| **Strategi Sharding**    | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering.                                          |
| **Polyglot Persistence** | Supabase (PostgreSQL) untuk data relasional, Redis untuk cache & Pub/Sub, MongoDB untuk audit log/transkrip, SQLite untuk fallback darurat. |
| **Worker Threads**       | Dedicated Canvas Worker Pool (`worker_threads`) untuk rendering grafis agar event loop bot tetap non-blocking.                              |
| **Sumber Kebenaran**     | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` untuk aturan governance.                              |
| **Alur PR**              | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge.                                            |
| **Target Deploy**        | Panel Pterodactyl dengan perintah `npm start`; urutan migrasi dijamin oleh lifecycle `prestart`.                                            |
| **Mata Uang Langka**     | Naura Coupon disimpan di kolom `UserSurvival.coupons` (bukan JSON) agar dapat didebit secara atomik.                                        |
| **Komponen UI Discord**  | Respons command wajib Discord Components V2 (`buildContainerV2()`) dengan struktur 5-lapisan.                                               |

---

# 🚀 DAFTAR TUGAS AKTIF BERDASARKAN PRIORITAS

---

## 🚨 1. KATEGORI: KRITIS (Perlu Perbaikan Langsung / Segera)

> **Kriteria:** Mempengaruhi integritas data, keamanan saldo/ekonomi, stabilitas koneksi WebSocket, dan pencegahan eksploitasi sistem.

- [x] **Algorithmic Anti-Inflation Circuit Breaker & Economy Guard**
  - Layanan `src/services/economyGuardEngine.js` untuk memantau kecepatan sirkulasi mata uang (_Velocity of Money_) dan mendeteksi anomali transfer saldo antar akun alt (`/pay` abuse).
  - Dynamic Market Tax (pajak pasar dinamis 3% s.d. 12%) yang menyesuaikan secara otomatis berdasarkan total suplai Star Fragments aktif di server untuk menjaga stabilitas moneter.
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

---

## 🔥 2. KATEGORI: TINGGI (Prioritas Kedua setelah Kritis)

> **Kriteria:** Fitur arsitektur inti, pengalaman pengguna utama, visualisasi sistem, dan retensi musiman.

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
- [ ] **3D Interactive Model Ecosystem & Virtual Mascot Integration (`Naura Hoshino 3D.glb`)**
  - Implementasi 3D Web Canvas Viewer di Web Dashboard (`portfolio.html`, `world.html`) menggunakan Three.js / `<model-viewer>` dengan rotasi 360°, pencahayaan neon Cyberpunk, dan animasi floating/breathing prosedural.
  - Integrasi efek ekspresi interaktif (mouse look-at tracking, partikel mood emote ❤️/✨/💧/⚡/💤, dan reactive lighting sesuai status emosi AI).
  - Persiapan pipeline auto-rigging cloud (Mixamo/AccuRig) dan blendshapes untuk kedipan mata otomatis serta lip-sync bicara real-time di Discord Activity / Web.
- [x] **Discord-Hybrid-Sharding 2.0 Multi-Core Cluster Engine**
  - Menggantikan `ShardingManager` bawaan dengan `ClusterManager` (`discord-hybrid-sharding`) berbasis multi-core process/worker threads.
  - Mengurangi pemakaian RAM proses idle hingga 40-50% di panel hosting dan mendukung _zero-downtime rolling restart_ saat deploy produksi.
- [x] **[PENINGKATAN] Migrasi `dbSeeder.js` Canvas Assets ke URL Lokal/CDN Resmi**
  - Diperbaiki: Diganti dengan aset gambar lokal beresolusi tinggi di `assets/images/canvas/` (100% offline-ready tanpa bergantung pada hosting luar).
  - File: [`src/managers/dbSeeder.js`](src/managers/dbSeeder.js), [`src/managers/dbManager.js`](src/managers/dbManager.js).
- [x] **[PENINGKATAN] `SeasonEngine` Belum Integrasi Season XP ke Aksi Survival**
  - Diperbaiki: `seasonEngine.addSeasonXp()` diintegrasikan secara terpadu ke dungeon victory (`dungeonRewards.js`), hidroponik harvest (`greenhouseEngine.js`), perakitan/peleburan/upgrade alat (`craftActions.js`), dan memancing (`fish.js`).
  - File: [`src/services/seasonEngine.js`](src/services/seasonEngine.js), [`src/survival/engines/dungeonRewards.js`](src/survival/engines/dungeonRewards.js), [`src/survival/engines/greenhouseEngine.js`](src/survival/engines/greenhouseEngine.js), [`src/survival/helpers/craftActions.js`](src/survival/helpers/craftActions.js), [`plugin/survival/subcommands/fish.js`](plugin/survival/subcommands/fish.js).
- [ ] **[PENINGKATAN] `worldBossEngine.js` Cache TTL Terlalu Pendek (30 detik)**
  - Cache Redis World Boss aktif di-set dengan TTL hanya 30 detik (`redisManager.setCache(BOSS_CACHE_KEY, ..., 30)`). Ini berarti setiap 30 detik ada query database tambahan meski boss tidak berubah.
  - **Peningkatan:** Naikkan TTL ke 60-120 detik dan gunakan invalidasi cache saat state boss berubah (damage diterima, fase berubah, atau boss mati), bukan TTL murni.
  - File: [`src/survival/engines/worldBossEngine.js`](src/survival/engines/worldBossEngine.js) baris 31.
- [ ] **[PENINGKATAN] Tambah `AutomationEngine` Trigger Baru**
  - `AutomationEngine` saat ini hanya mendukung 4 trigger: `MEMBER_JOIN`, `LEVEL_UP`, `REACTION_ADD`, `TICKET_CREATE`.
  - **Peningkatan:** Tambahkan trigger `SURVIVAL_LEVEL_UP`, `QUEST_COMPLETE`, `BOSS_KILLED`, dan `SEASON_TIER_UP` agar automasi server bisa bereaksi terhadap event gameplay RPG secara otomatis.
  - File: [`src/services/automationEngine.js`](src/services/automationEngine.js).
- [x] **[BUG] Dua Sistem Notifikasi Tumpang Tindih (Dead Code)**
  - Diperbaiki: Seluruh template dan alur pengiriman diunifikasi ke `src/managers/notificationManager.js`. Cron scheduler terhubung untuk mengirim `idle_revenue`, `stock_alert`, dan `vote_reminder`.
  - File: [`src/managers/cronManager.js`](src/managers/cronManager.js), [`src/managers/notificationManager.js`](src/managers/notificationManager.js).

---

## ⚡ 3. KATEGORI: NORMAL (Prioritas Standar)

> **Kriteria:** Fitur reguler yang memperkaya ekosistem komunitas dan gameplay RPG. Dapat dikerjakan kapan pun tanpa mengganggu operasional bot.

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
- [ ] **[PENINGKATAN] Sistem Crafting: Validasi Resep Berlapis**
  - Sistem crafting saat ini memvalidasi bahan mentah, tetapi tidak memvalidasi apakah pemain memiliki level crafting/stat yang cukup untuk menggunakan resep tier tinggi.
  - **Peningkatan:** Tambahkan field `reqLevel` (level minimum pemain) dan `reqStat` (misalnya INT minimum untuk resep alkimia) ke entri resep di `craftHelpers.js`, dan validasi ini di subcommand craft.
- [ ] **[PENINGKATAN] Dungeon Quest Tracker Untuk Item-Specific Drop**
  - Quest "kumpulkan X item dari dungeon" di `questGenerator.js` hanya melacak jumlah run dungeon, bukan jumlah item spesifik yang di-drop.
  - **Peningkatan:** Tambahkan tipe quest `collect_specific_item` dengan tracking akumulatif dari drop tabel `FLOOR_LOOT` dan `BOSS_LOOT` agar quest terasa lebih bermakna dan tertarget.
- [ ] **[PENINGKATAN] Dashboard V2: Halaman Survival Map Interaktif (`/survival-map`)**
  - Endpoint `/api/survival/map-data` dan halaman peta SVG interaktif 6 simpul wilayah sudah direncanakan (Sprint 23) tetapi belum diverifikasi apakah sudah terimplementasi penuh di `dashboard-v2`.
  - **Verifikasi & Selesaikan:** Pastikan halaman `survival-map.html` terhubung ke data real-time kepadatan petualang dan status world event aktif.
- [ ] **[PENINGKATAN] Riwayat Transaksi Ekonomi untuk User (`/history`)**
  - Tidak ada command yang memungkinkan user melihat riwayat `pay`, `deposit`, `invest`, atau drop dungeon mereka sendiri.
  - **Peningkatan:** Buat command `/history` (atau subcommand `/survival economy history`) yang menampilkan 10 transaksi terakhir dari MongoDB `CommandAuditLog` yang sudah ada.
- [ ] **[PENINGKATAN] Papan Peringkat World Boss Persisten (Leaderboard All-Time)**
  - `worldBossEngine.js` hanya mencatat `damageLeaderboard` untuk satu sesi boss saja. Setelah boss mati, data diarsipkan tetapi tidak ada papan leaderboard all-time yang bisa dilihat user.
  - **Peningkatan:** Simpan kontribusi tertinggi ke kolom `UserSurvival` (atau MongoDB document) setelah boss defeated, dan buat command `/boss leaderboard` untuk menampilkannya.
- [ ] **[PENINGKATAN] Cooldown Survival: Tambah Sistem "Rush" Berbayar Kupon**
  - Saat ini, cooldown survival (kerja, kumpul, dll.) bersifat tetap dan hanya bisa dikurangi dengan stat atau item tertentu.
  - **Peningkatan:** Tambahkan opsi "Rush" di setiap subcommand survival yang memungkinkan pemain membayar 1 Naura Coupon untuk melewati cooldown aktif, dengan konfirmasi UI interaktif.
- [ ] **[PENINGKATAN] Inventaris Canvas: Integrasi Filter & Sort**
  - Canvas inventaris (`src/canvas/inventoryCanvas.js`) menampilkan item dalam urutan tetap. Tidak ada cara untuk filter by kategori atau sort by tier/kuantitas.
  - **Peningkatan:** Tambahkan Select Menu di bawah canvas inventaris dengan opsi filter (`Semua`, `Senjata`, `Armor`, `Konsumabel`, `Material`) dan sort (`Tier Tertinggi`, `Jumlah Terbanyak`).
- [ ] **[PENINGKATAN] Sistem Guild Hall: Implementasi `hallLayout` dari v33**
  - Kolom `hallLayout` sudah ditambahkan ke `GuildClans` di migrasi v33, tetapi belum ada subcommand atau UI untuk menggunakannya secara interaktif.
  - **Peningkatan:** Buat subcommand `/clan hall` (`view`, `upgrade`, `customize`) yang merender tata letak ruangan klan dan memungkinkan pemimpin klan melakukan upgrade fasilitas.

---

## ✨ 4. KATEGORI: OPTIONAL (Prioritas Opsional)

> **Kriteria:** Penambahan estetika, kosmetik, dan eksplorasi fitur eksperimental jangka panjang. Tidak berpengaruh pada kestabilan bot jika dilewati.

- [x] **Dynamic Relic Socketing & Gem Enchanting (`/survival forge gem`)**
- [ ] **Guild Soundboard Cloud & Live Soundpad**
  - Fitur Soundboard Web Dashboard bertenaga WebSocket (Socket.IO) untuk memicu pemutaran sound effect instan ke Voice Channel bot dengan latensi nol.
- [ ] **Global Guild Federation Hub & Hall of Fame**
  - Jaringan aliansi guild antar server dengan papan peringkat global terpadu dan event penaklukan bos aliansi bersama.
- [ ] **Autonomous NPC Living City Simulation**
  - Kota NPC otonom di mana karakter NPC (Bagas, Luna, Kuro, Sakura) memiliki jadwal harian sendiri, berbelanja di pasar lelang, dan merespons pemain dengan memori dinamis.
- [ ] **AI Video / Dynamic Motion Banner Generator**
  - Rendering video loop MP4 / WebP terkompresi untuk banner profil dan kartu kelulusan season pass bertenaga AI.
- [ ] **Cross-Model Ensemble Router**
  - Router cerdas yang otomatis memilih LLM terbaik (Gemini 2.0 Flash untuk kecepatan, Groq LLaMA 3.3 untuk penalaran taktis, Ollama lokal untuk offline) berdasarkan beban latensi server.
- [ ] **Metaverse Land & Guild Castles (`/land`)**
  - Sistem kepemilikan kapling tanah virtual per guild untuk pembangunan istana klan, menara pertahanan, dan fasilitas riset teknologi bersama.
- [ ] **Collaborative Live Jam Room (Synthesizer & Drum Machine)**
  - Aktivitas Discord Webview untuk membuat aransemen musik mini 8-bit / Lo-fi secara real-time bersama anggota voice channel.
- [ ] **Lossless Hi-Fi Audio Node Federation**
  - Jaringan node Lavalink FLAC/Opus berkualitas tinggi dengan auto-balancing geografis untuk audio tanpa kompresi.
- [ ] **Zero-Knowledge Privacy Vaults & Community Bounty Board**
  - Enkripsi end-to-end untuk catatan rahasia/tiket sensitif dan papan pengumuman tugas server berbasis hadiah Star Fragments.
- [ ] **[OPSIONAL] Item Preview Canvas di Shop & Crafting**
  - Saat ini tampilan item di `/survival shop` dan `/survival craft` berbasis teks saja (nama + emoji + harga).
  - **Peningkatan:** Tampilkan thumbnail gambar item (dari `assets/items/<id>.png`) sebagai attachment preview kecil di container saat user memilih item di select menu shop/crafting.
- [ ] **[OPSIONAL] Generator Lagu Tanda Tangan AI (`/music signature`)**
  - Command `/music signature` yang menganalisis statistik musik user (genre favorit, suasana, track terbanyak diputar) lalu menghasilkan deskripsi "lagu tanda tangan" personal menggunakan Gemini AI.
- [ ] **[OPSIONAL] Pembuatan Kartu Ucapan Ulang Tahun Otomatis**
  - Integrasi `cronManager.js` yang sudah memiliki data `UserBirthday` dengan canvas generator kartu ucapan ulang tahun bergaya Naura Wilds yang dikirim via DM pada tanggal ulang tahun user.

---

## 📜 ARSIP PEKERJAAN SELESAI (Sprint 0 s.d. Sprint 22)

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
- [x] Pemindahan Naura Coupon ke kolom tabel `UserSurvival.coupons`.
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

</details>

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
