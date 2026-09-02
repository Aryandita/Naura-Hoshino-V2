# TODO Naura Hoshino V2 - Roadmap & Task Management

Daftar pekerjaan strategis berdasarkan audit arsitektur, kebutuhan sistem, dan riset eksternal (2026).
Roadmap ini disusun dan diurutkan secara ketat mengikuti **4 Kategori Prioritas**:

1. 🚨 **KRITIS** (Perlu perbaikan langsung/segera: keamanan data, integritas moneter, stabilitas koneksi inti).
2. 🔥 **TINGGI** (Prioritas kedua setelah Kritis: fitur arsitektur vital, retensi pengguna utama, performa skala besar).
3. ⚡ **NORMAL** (Prioritas standar: fitur ekspansi reguler, bisa dikerjakan kapan pun tanpa mengganggu operasi bot).
4. ✨ **OPTIONAL** (Prioritas opsional: kosmetik, eksperimen inovasi lanjutan, tidak berpengaruh jika dilewati).

---

## 📌 Keputusan Arsitektur yang Sudah Ditetapkan

Keputusan berikut adalah sumber kebenaran. Semua dokumen lain harus mengikutinya.

| Topik | Keputusan |
|---|---|
| **Versi Node** | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian. |
| **Penyimpanan Bahasa** | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi. |
| **Strategi Sharding** | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering. |
| **Polyglot Persistence** | Supabase (PostgreSQL) untuk data relasional, Redis untuk cache & Pub/Sub, MongoDB untuk audit log/transkrip, SQLite untuk fallback darurat. |
| **Worker Threads** | Dedicated Canvas Worker Pool (`worker_threads`) untuk rendering grafis agar event loop bot tetap non-blocking. |
| **Sumber Kebenaran** | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` untuk aturan governance. |
| **Alur PR** | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge. |
| **Target Deploy** | Panel Pterodactyl dengan perintah `npm start`; urutan migrasi dijamin oleh lifecycle `prestart`. |
| **Mata Uang Langka** | Naura Coupon disimpan di kolom `UserSurvival.coupons` (bukan JSON) agar dapat didebit secara atomik. |
| **Komponen UI Discord** | Respons command wajib Discord Components V2 (`buildContainerV2()`) dengan struktur 5-lapisan. |

---

# 🚀 DAFTAR TUGAS AKTIF BERDASARKAN PRIORITAS

---

## 🚨 1. KATEGORI: KRITIS (Perlu Perbaikan Langsung / Segera)

> **Kriteria:** Mempengaruhi integritas data, keamanan saldo/ekonomi, stabilitas koneksi WebSocket, dan pencegahan eksploitasi sistem.

- [x] **Algorithmic Anti-Inflation Circuit Breaker & Economy Guard**
  - Layanan `src/services/economyGuardEngine.js` untuk memantau kecepatan sirkulasi mata uang (*Velocity of Money*) dan mendeteksi anomali transfer saldo antar akun alt (`/pay` abuse).
  - Dynamic Market Tax (pajak pasar dinamis 3% s.d. 12%) yang menyesuaikan secara otomatis berdasarkan total suplai Star Fragments aktif di server untuk menjaga stabilitas moneter.
  - Integrasi pencatatan audit log otomatis ke MongoDB saat terjadi lonjakan transaksi mencurigakan.
  - Unit test `src/services/economyGuardEngine.test.js` lulus 100%.
- [x] **Audio Guard & WebSocket Conflict Hardening**
  - Validasi ketat pada `trackStart.js` (prefetch delay 1500ms dan safety check `player.destroyed`) untuk memastikan tidak terjadi konflik session ID antara Poru dan Discord Voice WebSocket.
  - Evaluasi berkala status failover multi-node Lavalink (`musicManager.getPreferredNode`) agar bot tidak pernah terputus di tengah pemutaran musik.
- [x] **Polyglot Persistence Reconnection & Failover Watchdog**
  - Memastikan transisi otomatis ke SQLite fallback saat koneksi internet cloud Supabase terputus, dan pemulihan data kembali (*data reconciliation*) saat koneksi pulih tanpa terjadinya duplikasi saldo atau kupon.

---

## 🔥 2. KATEGORI: TINGGI (Prioritas Kedua setelah Kritis)

> **Kriteria:** Fitur arsitektur inti, pengalaman pengguna utama, visualisasi sistem, dan retensi musiman.

- [x] **Live Interactive System Topology & Architecture Visualizer (`/system` / `/topology` / `topology.html`)**
  - **Konsep:** Diadaptasi dari model visualisasi *System Design* modern (seperti KodeKloud / Cloudcraft) untuk memberikan visibilitas penuh terhadap arsitektur terdistribusi Naura Hoshino.
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
  - Mengurangi pemakaian RAM proses idle hingga 40-50% di panel hosting dan mendukung *zero-downtime rolling restart* saat deploy produksi.

---

## ⚡ 3. KATEGORI: NORMAL (Prioritas Standar)

> **Kriteria:** Fitur reguler yang memperkaya ekosistem komunitas dan gameplay RPG. Dapat dikerjakan kapan pun tanpa mengganggu operasional bot.

- [x] **Cyber-Agronomy & Hydroponic Greenhouse (`/survival farm`)**
  - Model Sequelize `UserGreenhouse.js` dengan migrasi `v37_create_user_greenhouses`: `userId`, `gridLevel`, `slots` (JSON: benih, kelembaban, waktu tanam, pupuk), dan `totalHarvests`.
  - Katalog benih kosmik `src/survival/data/cropSeeds.js` (Astral Strawberry, Cyber Mint, Void Coffee Bean, Neon Melons, Sakura Grain) dengan waktu tumbuh dinamis (1j s.d. 12j).
  - Layanan `src/survival/engines/greenhouseEngine.js`: konsumsi pupuk hasil crafting, penyiraman air otomatis/manual, dan integrasi pasokan bahan baku Kafe (`/survival life cafe`).
  - Renderer Canvas `src/canvas/greenhouseCanvas.js` bertenaga Worker Thread untuk visualisasi lahan hidroponik 2.5D.
  - Subcommand `plugin/survival/subcommands/farm.js` (`plant`, `water`, `harvest`, `status`, `shop`) dan unit test `src/survival/engines/greenhouseEngine.test.js`.
- [x] **Galactic Trade Caravan & Commodity Exchange (`/survival caravan`)**
  - Engine bursa komoditas berfluktuasi `src/services/tradeEngine.js` dengan multi-rute ekspedisi antariksa, debit koin modal atomik, dan penyimpanan state perjalanan di Redis (`caravan:active:${userId}`).
  - Model Sequelize `TradeCaravan.js` dan `CaravanEscort.js` dengan migrasi `v38_create_cross_server_caravans` untuk penugasan pengawal klan bersenjata dan serangan penjarahan PvP (*PvP Ambush Raid*).
  - Subcommand `plugin/survival/subcommands/caravan.js` (`market`, `dispatch`, `status`, `claim`) berbasis 5-lapisan Container V2 dan proteksi risiko penjarahan (*Ambush Protection*).
- [x] **Custom Community Dungeon Maker (`/dungeon maker`)**
  - Model Sequelize `CommunityDungeon.js` dengan migrasi `v39_create_community_dungeons`: `dungeonId`, `creatorUserId`, `guildId`, `dungeonName`, `theme`, `roomsConfig` (JSON layout 5-10 ruangan, teka-teki, monster), `entryFee`, `vaultBalance`, `ratingAverage`.
  - Engine `src/survival/engines/customDungeonEngine.js` dengan brankas royalti kreator 5%, sistem payout kemenangan 2x tiket, dan rating bintang dinamis.
  - Subcommand `plugin/survival/subcommands/customDungeon.js` (`create`, `browse`, `play`, `rate`, `withdraw`) dan unit test `customDungeonEngine.test.js`.
- [x] **AI Virtual Tribunal Court (`/court` / `/tribunal`)**
  - Sistem persidangan komunitas interaktif berbasis AI Gemini (`src/ai/tribunalEngine.js`) untuk menyelesaikan sengketa antar member secara adil dan menghibur.
  - Simulasi 3 Juri AI: Hakim Agung Vespera (Netral/Bijaksana), Jaksa Penuntut Cyber-Fang (Keras/Agresif), dan Pembela Lyra (Tsundere).
  - Evaluasi transkrip bukti perkara, penerbitan vonis interaktif, command `plugin/utility/court.js`, dan unit test `tribunalEngine.test.js`.
- [x] **Discord Activity Mini-App ("Naura World 2.0")**
  - Integrasi `@discord/embedded-app-sdk` pada `dashboard-v2` (`src/pages/activity.html`) untuk menjalankan aplikasi web interaktif langsung di jendela Voice/Text Channel Discord.
  - Antarmuka modular untuk TCG Card Battle Mini-App dan Live Music Controller.
- [x] **Web Canvas & Container V2 Visual WYSIWYG Builder**
  - Studio visual drag-and-drop di Web Dashboard (`dashboard-v2/src/pages/builder.html` & `/builder`).
  - Pembuat layout Discord Components V2 5-layer interaktif dengan kalkulasi budget komponen real-time (`componentBudget.js`) dan salin payload instan.
- [x] **OpenTelemetry & Prometheus/Grafana Distributed Tracing**
  - Layanan `src/services/telemetryMetrics.js` untuk memantau performa interaksi Discord, latensi Lavalink, kueri database, dan hit rate cache Redis.
  - Endpoint `/metrics` standar Prometheus di `dashboard/server.js` untuk integrasi pemantauan server di Grafana dan unit test `telemetryMetrics.test.js`.
- [x] **Audit & Pembersihan Repositori Menyeluruh (File Duplikat & Dead Code)**
  - Pemindaian komprehensif ke seluruh direktori repositori: resolusi modul bersih di `scripts/check-requires.js`, 0 pelanggaran em dash di `scripts/check-em-dash.js`, dan kompilasi Vite MPA sinkron.
- [x] **Rombak Total Sistem Survival Naura Wilds & Dual-Layer RPG (Sprint 23)**
  - **Dual-Layer Stat System & Path Synergy (`/survival rpg skill`):** Pemisahan jelas antara atribut kehidupan dunia biasa (Life Stats: STR, AGI, INT, LCK, Bonus HP melalui Stat Points level up) dengan spesialisasi pertarungan dungeon/PvP (Combat Paths: Warrior, Mage, Assassin, Ranger) dengan buff resonansi sinergi +15% s.d. +25% efektivitas.
  - **Otomatisasi Vital Depletion & Penjagaan Offline:** Siklus decay periodik 30-menit di `cronManager.js` dengan jendela pemain aktif 4 jam untuk mencegah penalti pemain offline, serta sentralisasi perhitungan HP tunggal lewat `leveling.calculateMaxHp()`.
  - **Pelacakan Progres Quest & 15 Achievement Baru:** Pelacakan otomatis `achievementTracker.js` (Penyintas Veteran, Legenda Hidup, Ascended God, Pionir Seabad, Master Barista, Dewa Tempa, Janji Suci Abadi, dll.) serta pengkaitan progres quest ke aksi craft, farm harvest, cafe serve, pet feed, npc gift, heist, dan travel.
  - **Altar Tempa & Enchantment Permata Kosmik (`/survival life enchant`):** Fitur penyematan permata kosmik (Crimson Blood Gem, Starlight Sapphire, Nebula Emerald, Void Amethyst) ke socket gear dengan pemotongan atomik `takeItemsAtomic()` dan buff permanen di dungeon/PvP.
  - **World Event Engine Musiman:** Engine otomatis `worldEventEngine.js` untuk festival nasional dan musiman (HUT RI, Ultah Naura, Festival Panen, Badai Salju Frostsnow) dengan pelipatgandaan drop rate dan item eksklusif.
  - **Peta Dunia Interaktif Web Dashboard V2 (`/survival-map`):** Peta wilayah terdistribusi SVG interaktif 6 simpul dengan telemetri cuaca, waktu dunia in-game, dan sensor kepadatan petualang real-time via `/api/survival/map-data`.
  - **Standarisasi UI/UX Naura Wilds:** Pembaruan antarmuka `/survival profile info` dengan palet emerald, visualisasi bar vital 3-tingkat warna (*moss/amber/danger*), status Path Synergy, dan tombol navigasi aksi cepat.

---

## ✨ 4. KATEGORI: OPTIONAL (Prioritas Opsional)

> **Kriteria:** Penambahan estetika, kosmetik, dan eksplorasi fitur eksperimental jangka panjang. Tidak berpengaruh pada kestabilan bot jika dilewati.

- [x] **Dynamic Relic Socketing & Gem Enchanting (`/survival forge gem`)**
  - Layanan `src/services/gemSocketEngine.js` untuk soket permata kosmik (`cosmic_sockets`) pada kartu dan gear RPG di bengkel tempa untuk efek skill pasif kustom (Crimson Blood Gem, Starlight Sapphire, Nebula Emerald, Void Amethyst) dan unit test `gemSocketEngine.test.js`.
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

</details>

---

## ⚠️ Risiko yang Harus Terus Dipantau

| Risiko | Dampak | Mitigasi |
|---|---|---|
| **Ekonomi tanpa penulisan atomik** | Inflasi tak terkendali, duplikasi saldo/barang | Pola `debit*` / `increment*` bersyarat dan transaksi `SELECT FOR UPDATE` pada kolom JSON. |
| **Race condition WebSocket saat audio buffering** | Bot terputus dari voice channel (error 4006) | Delay prefetch 1500ms di `trackStart.js` dan proteksi `VoiceManager` terhadap Poru player aktif. |
| **Beban komputasi Canvas memblokir Event Loop** | Bot mengalami freeze / chat lag | Seluruh render grafis didelegasikan ke `canvasWorkerPool.js` berbasis Worker Threads. |
| **Pelanggaran karakter em dash** | Gagal validasi CI / inkonsistensi teks | Diperiksa otomatis oleh script `scripts/check-em-dash.js`. |
| **Single-point-of-failure node eksternal** | Fitur audio/AI mati saat penyedia pihak ketiga down | Sistem dual failover: Lavalink multi-node fallback dan Gemini auto-failover ke Groq. |
