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

| Topik                    | Keputusan                                                                                                                        |
| ------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| **Format Versi**         | Standar X.Y.Z: X = Era Keseluruhan (2), Y = Major Update (3), Z = Minor Update (0). Rilis aktif saat ini: **v2.3.0**.            |
| **Versi Node**           | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian.                                                  |
| **Penyimpanan Bahasa**   | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi.           |
| **Strategi Sharding**    | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering.                               |
| **Polyglot Persistence** | Supabase (PostgreSQL 41 migrasi), Redis untuk cache & Pub/Sub, MongoDB untuk audit log/transkrip, SQLite untuk fallback darurat. |
| **Worker Threads**       | Dedicated Canvas Worker Pool (`worker_threads`) untuk rendering grafis agar event loop bot tetap non-blocking.                   |
| **Sumber Kebenaran**     | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` untuk aturan governance.                   |
| **Alur PR**              | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge.                                 |
| **Target Deploy**        | Panel Pterodactyl dengan perintah `npm start`; urutan migrasi dijamin oleh lifecycle `prestart`.                                 |
| **Mata Uang Langka**     | Naura Coupon disimpan di kolom `UserSurvival.coupons` (bukan JSON) agar dapat didebit secara atomik.                             |
| **Komponen UI Discord**  | Respons command wajib Discord Components V2 (`buildContainerV2()`) dengan struktur 5-lapisan.                                    |

---

# 🚀 DAFTAR TUGAS AKTIF BERDASARKAN PRIORITAS

---

## 🚨 1. KATEGORI: KRITIS (Perlu Perbaikan Langsung / Segera)

> **Kriteria:** Mempengaruhi integritas data, keamanan saldo/ekonomi, stabilitas koneksi WebSocket, dan pencegahan eksploitasi sistem.

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
  - Mengimplementasikan Voice Activity Detection (VAD) dan _barge-in capability_ di mana bot langsung menghentikan pemutaran audio Fish Audio saat pengguna menyela pembicaraan di voice channel.
  - File: [`src/services/voiceCompanionService.js`](src/services/voiceCompanionService.js), [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/config/env.js`](src/config/env.js).

- [x] **[PERFORMA] Total Canvas Worker Offloading (Zero Event-Loop Blocking)**
  - Mendaftarkan seluruh sisa renderer Canvas (`renderRoomCanvas`, `drawChronicleNewspaper`, `drawAstralOmikuji`, `drawAstralAtmosphereCard`, `drawDuel`, `drawAchievementCard`, `generateWrappedCard`, `drawCardBattleArena`, `drawStockMarket`) ke `src/canvas/canvasWorker.js`.
  - Mengalihkan eksekusi di plugin terkait ke `canvasWorkerPool.execute()` agar event loop bot 100% non-blocking saat merender visual grafis berat.
  - File: [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`src/canvas/canvasWorkerPool.js`](src/canvas/canvasWorkerPool.js), [`plugin/utility/room.js`](plugin/utility/room.js), [`plugin/naura/naura.js`](plugin/naura/naura.js), [`plugin/utility/stock.js`](plugin/utility/stock.js).
- [x] **[KEAMANAN & INTEGRITAS] Trade Caravan Escort & Ambush Atomic Mutex**
  - Mengamankan transaksi pendaftaran pengawal (_escort_) dan penyergapan (_ambush_) karavan dagang menggunakan Redis Distributed Mutex (`cacheManager.withLock`) dan Sequelize transaction row locking (`SELECT FOR UPDATE`) untuk mencegah race condition atau double payout.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`src/models/TradeCaravan.js`](src/models/TradeCaravan.js), [`src/models/CaravanEscort.js`](src/models/CaravanEscort.js).

- [x] **[BUG] Inkonsistensi Fallback String Versi (`v2.1.0` vs `v2.2.0`)**
  - Standarisasi fallback string `BOT_VERSION` dan `ENGINE_VERSION` di `src/config/env.js`, `src/config/ui.js`, `src/config/ui/palette.js`, `src/utils/bootScreen.js`, `src/managers/errorHandler.js`, dan `src/config/ui.test.js` menjadi `"2.2.0"`.
  - File: [`src/config/env.js`](src/config/env.js), [`src/config/ui.js`](src/config/ui.js), [`src/config/ui/palette.js`](src/config/ui/palette.js).
- [x] **[KEAMANAN] Pengamanan Endpoint Soundboard API (`POST /api/soundboard/play`)**
  - Menambahkan validasi autentikasi / keanggotaan guild dan rate limiter pada endpoint API soundboard di `dashboard/routes/api.js` untuk mencegah eksekusi tanpa izin (_soundboard bombing_).
  - File: [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[BUG] Pemulihan Lagu Pasca Soundboard (_Audio Resume Position Lost_)**
  - Perbaikan pada `src/music/poru_events/trackStart.js` dan `trackEnd.js` agar `player.seekTo(resumePosition)` dieksekusi dengan benar pada trek lagu utama yang diinterupsi oleh pemutaran efek suara soundboard.
  - File: [`src/music/poru_events/trackStart.js`](src/music/poru_events/trackStart.js), [`src/music/poru_events/trackEnd.js`](src/music/poru_events/trackEnd.js), [`src/services/soundboardService.js`](src/services/soundboardService.js).
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

- [x] **[FITUR BARU] Interactive Family Parenting & Apprentice System (`UserChild.js` & `/survival family`)**
  - Menghubungkan model Sequelize `UserChild.js` pasca Parenthood Event: status vital anak (`happiness`, `hunger`, `level`, `xp`), interaksi harian memberi makan (`feed`), membimbing belajar (`teach`), dan tahapan pertumbuhan (Toddler -> Anak -> Murid Magang).
  - Menerapkan _Family Trade Apprentice Perks_ di mana anak yang beranjak remaja dapat membantu mata pencaharian pemain sesuai bakat sang ibu (panen sayur otomatis bersama Ningsih, bonus mutiara laut bersama Tari, reparasi diskon bersama Bagas, dan racikan jamu bersama Bidan Sari).
  - File: [`src/survival/engines/familyEngine.js`](src/survival/engines/familyEngine.js), [`src/models/UserChild.js`](src/models/UserChild.js), [`plugin/survival/subcommands/family.js`](plugin/survival/subcommands/family.js) (NEW).
- [x] **[FITUR BARU] Ancient Relic Tower Sieges & Dynamic Territory Control (`territoryWarEngine.js` Phase 2 / `/clan siege`)**
  - Mengembangkan sistem perebutan Menara Relik Kuno (_Ancient Relic Towers_) antar federasi klan menjadi perang wilayah GvG terjadwal mingguan.
  - Aliansi pengontrol menara berhak mengklaim dividen kas aliansi harian dan mengaktifkan status buff regional pasif untuk seluruh anggota klan (Tower of Vitality: +15% HP, Tower of Greed: +10% NSF yield). Dilengkapi visual perang di Web Dashboard war room.
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
  - Mengizinkan petualang merekrut anggota klan sebagai pengawal berbayar untuk meminimalkan risiko perjalanan, serta fitur penyergapan (_PvP caravan ambush_) oleh klan rival di rute antariksa.
  - File: [`src/services/tradeEngine.js`](src/services/tradeEngine.js), [`plugin/survival/subcommands/caravan.js`](plugin/survival/subcommands/caravan.js).
- [x] **[GAMEPLAY & AI] Living Town Square NPC Affinity & Friendship Progression (`UserNPC.js`)**
  - Menghubungkan dialog sapaan harian di `src/survival/engines/townEngine.js` dengan model Sequelize `UserNPC`.
  - Interaksi sapaan warga kota meningkatkan poin affection, meningkatkan relationship level (Kenalan -> Teman -> Sahabat), dan membuka diskon belanja serta hadiah khusus dari warga kota.
  - File: [`src/survival/engines/townEngine.js`](src/survival/engines/townEngine.js), [`src/models/UserNPC.js`](src/models/UserNPC.js).

- [x] **[PERFORMA] Delegasi Render Ransel Inventaris ke Dedicated Canvas Worker Pool**
  - Mendaftarkan task `renderInventory` di `src/canvas/canvasWorker.js` dan mengalihkan pemanggilan `generateInventoryBackpackImage` di `plugin/survival/subcommands/inventory.js` ke `canvasWorkerPool.execute()` agar rendering grafis inventaris tidak memblokir event loop Discord Gateway.
  - File: [`src/canvas/canvasWorker.js`](src/canvas/canvasWorker.js), [`plugin/survival/subcommands/inventory.js`](plugin/survival/subcommands/inventory.js).
- [x] **[LOGIKA & UX] Sinkronisasi State Interaksi Tombol Subsidi Pemula di Dompet**
  - Memperbarui payload kontainer di `plugin/survival/subcommands/wallet.js` saat tombol `wallet_claim_novice` ditekan agar status tombol langsung dinonaktifkan (_disabled: true_) dan angka saldo diperbarui secara instan tanpa memicu error double claim.
  - File: [`plugin/survival/subcommands/wallet.js`](plugin/survival/subcommands/wallet.js).
- [x] **[ANTI-EXPLOIT] Cooldown Proteksi Sapaan Warga Alun-Alun Kota (`townEngine.js`)**
  - Menerapkan batasan per-user atau cooldown di Redis (`town:greet:${userId}`) pada `talkToTownNpc` di `src/survival/engines/townEngine.js` untuk mencegah eksploitasi perolehan Star Fragments berulang dalam durasi menu aktif.
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

- [x] **[FITUR BARU] Dynamic World Weather & Seasonal Natural Hazards (`worldWeatherEngine.js` & `/survival status`)**
  - Menambahkan siklus cuaca dunia yang berotasi setiap 6 jam: Hujan Lebat (bonus panen kebun +30%, konsumsi stamina hutan +20%), Badai Petir (resiko sambaran di tambang terbuka, keausan alat +25%), Kabut Pasir Gurun Khul'Khas (peluang menemukan reruntuhan langka x2), dan Terik Matahari (kehausan berkurang 2x lebih cepat).
  - Menampilkan status cuaca aktif pada kartu profil petualang `/survival status`, visual canvas banner cuaca, dan telemetri Web Dashboard.
  - File: [`src/survival/engines/worldWeatherEngine.js`](src/survival/engines/worldWeatherEngine.js) (NEW), [`src/survival/data/worldMapData.js`](src/survival/data/worldMapData.js), [`plugin/survival/subcommands/info.js`](plugin/survival/subcommands/info.js), [`dashboard/routes/api.js`](dashboard/routes/api.js).
- [x] **[FITUR BARU] Guild Caravan Raids & Clan Escort Contracts Hub (`/clan caravan` & `/caravan escort`)**
  - Membuka papan bursa kontrak pengawalan berbayar (_Mercenary Escort Board_) di mana petualang independen dapat disewa oleh klan untuk mengawal konvoi dagang antariksa dengan dana jaminan escrow aman.
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
  - Menghitung kisaran harga wajar secara otomatis saat petualang menjual barang di `/survival auction create` berdasarkan rerata transaksi sukses 7 hari terakhir, serta mendukung fitur harga beli instan (_buyout price_).
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
  - Diperbaiki: Dibangun modul `cooldownRushHelper.js` dan interaksi tombol `rush.js` yang memungkinkan pemain membayar 1 Naura Coupon untuk melewati cooldown aktif secara atomik.
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

- [x] **[FITUR BARU] AI Dynamic Radio Host & Voice Track Announcements (`aiDjManager.js` / `/music radio`)**
  - Menghidupkan kepribadian penyiar radio cerdas pada AI Smart DJ: Naura menyapa nama pendengar di voice channel, menceritakan trivia musisi lagu berikutnya, dan meredupkan volume musik (_audio ducking_ ke 15%) saat berbicara sebelum menaikkan kembali ke 100%.
  - File: [`src/services/fishAudioService.js`](src/services/fishAudioService.js), [`src/managers/musicManager.js`](src/managers/musicManager.js), [`plugin/music/music.js`](plugin/music/music.js).
- [x] **[AUDIO] Smart Duplicate Track Detection in Guild Queues (`/music duplicates on/off`)**
  - Menambahkan filter pencegahan duplikasi lagu dalam rentang 5 antrean terakhir pemutaran untuk menjaga variasi musik di channel suara server.
  - File: [`src/managers/musicManager.js`](src/managers/musicManager.js), [`plugin/music/music.js`](plugin/music/music.js).
- [x] **[DASHBOARD] Service Worker PWA Caching untuk Dashboard Assets (`dashboard/public/sw.js`)**
  - Menerapkan Service Worker Cache-First untuk file 3D avatar berukuran besar (`.glb`/`.vrm`) dan efek audio soundboard agar kecepatan muat halaman Web Dashboard instan (<1 detik).
  - File: [`dashboard/public/sw.js`](dashboard/public/sw.js) (NEW), [`dashboard/src/pages/index.html`](dashboard/src/pages/index.html).
- [x] **[MONITORING] Automated Staff Security Webhook for Velocity of Money Spikes (`economyGuardEngine.js`)**
  - Pengiriman notifikasi darurat langsung via webhook Discord ke ruang staf admin saat terdeteksi anomali perputaran mata uang (_Velocity of Money_) yang mengindikasikan eksploitasi transfer alt account.
  - File: [`src/services/economyGuardEngine.js`](src/services/economyGuardEngine.js), [`src/services/webhookDispatcher.js`](src/services/webhookDispatcher.js).

- [x] **[AI COMPANION] Expressive 3D Mascot Lip-Sync & Viseme Synchronization**
  - Sinkronisasi bentuk mulut (viseme morph targets A, I, U, E, O) pada avatar 3D Three.js Naura di Web Dashboard dan Discord Activity saat memutar ucapan suara Fish Audio TTS.
  - File: [`dashboard/src/components/NauraViewer/viewer3d.js`](dashboard/src/components/NauraViewer/viewer3d.js), [`dashboard/src/components/NauraViewer/animations.js`](dashboard/src/components/NauraViewer/animations.js).
- [x] **[CROSS-PLATFORM] Real-Time WebSocket Caravan Ambush Alerts via Web Push**
  - Notifikasi Web Push API di browser dashboard saat karavan dagang antariksa pemain sedang disergap oleh klan rival di galaksi.
  - File: [`dashboard/server.js`](dashboard/server.js), [`dashboard/routes/api.js`](dashboard/routes/api.js), [`src/services/tradeEngine.js`](src/services/tradeEngine.js).
- [x] **[DEVOPS & WORKFLOW] Automated Git Commit & Push on Every Task Update (Zero-Lag GitHub Sync)**
  - Menyusun SOP baku dan script otomasi (`scripts/git-sync.js` / `npm run sync:github`) yang secara instan mengeksekusi `git add`, `git commit` dengan pesan semantik rapi (_Conventional Commits_), dan `git push origin main` setiap kali ada pembaruan kode yang telah lulus seluruh 5 gerbang QA Gate.
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
  - Integrasi perayaan harian di `cronManager.js` dengan custom canvas birthday card 800x450, dikirim personal via DM lengkap dengan kado atomik (1.000 NSF, 3 Kupon, 1 Kue Tart) dan disiarkan ke announcement channel server.

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
- [x] Fitur "Rush" cooldown survival berbasis Naura Coupon dengan modal konfirmasi dan unit test terverifikasi.
- [x] Select Menu interaktif filter kategori dan pengurutan inventaris backpack Canvas.
- [x] Implementasi kustomisasi tema dan upgrade fasilitas Guild Hall (`hallLayout` v33) pada `/clan hall`.
- [x] Verifikasi stabilitas test suite: **246 passing tests (100%)**, 0 error lint, dan 0 pelanggaran em dash.

### 💎 Sprint 27: Currency V2 Closed-Loop, AI Ensemble Router, Lavalink Cluster, Soundboard & 3D Mascot (v2.2.0 Milestone)

- [x] **Currency V2 One-Way Bridge & Dynamic Spread**: Penukaran NSF ke Coin sah, Coin ke NSF dibatasi (`one_way_restricted`), fee transaksi progresif (`currency.js`, `currencyV2.test.js`).
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
  - Eliminasi bug akumulasi rotasi leher/tulang (_compounding quaternion multiplication_) dengan rest-quaternion caching.
  - Penghematan daya baterai & GPU: Three.js dan Audio Spectrum Visualizer di-pause saat diminimalkan atau saat membuka tab selain 3D.
  - Floating orb bobbing animation `@keyframes nv-floating-bob` dan kurva transisi fisika pegas `cubic-bezier(0.34, 1.56, 0.64, 1)`.
  - Header & mini trigger dapat digeser (_draggable_) via Pointer Events dengan pembatasan batas layar (_viewport clamping_).
  - Sinkronisasi energi spektrum audio real-time langsung ke pendaran Astral Halo Three.js.
  - Siklus interaksi klik avatar 3D interaktif (_Wave, StarPose, BlowKiss, AstralCast, Cheers, Thinking, Shy_) dengan pendaran partikel dan status mood.
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
  - Dukungan interaksi sentuh alami: cubit untuk zoom (_pinch-to-zoom_) dan dua jari untuk rotasi (_two-finger rotation_) pada perangkat mobile dan tablet.
- [x] **[RPG & EKONOMI] Dynamic Seasonal Battle Pass & Star Path Milestones (`src/survival/engines/seasonPassEngine.js`, `/survival pass`)**:
  - Progresi level musiman (Tier 1-50, Jalur Gratis & Jalur Premium) dengan klaim hadiah atomik (NSF, Kupon, Blueprints, Aksesoris) via `cacheManager`.
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

Berdasarkan analisis pasar bot dan platform developer Discord terkini (2025 - 2026), terdapat pergeseran paradigma dari bot berbasis skrip statis menjadi ekosistem aplikasi terintegrasi (_Agentic AI & Embedded Experiences_). Berikut adalah peta tren utama dan arah adopsinya pada Naura Hoshino:

### 1. Discord Embedded App SDK & Discord Activities

- **Tren Platform:** Pengguna Discord kini lebih menyukai pengalaman _in-client_ yang langsung berjalan di dalam voice channel atau text channel (iframe Discord Activities) tanpa harus membuka browser terpisah (seperti _Watch Together_, _Putt Party_, atau _Gartic Phone_).
- **Adopsi Naura:** Mengintegrasikan `@discord/embedded-app-sdk` agar Web Dashboard dan 3D Mascot Viewer dapat diluncurkan langsung dari command `/activity` sebagai mini-game atau interactive companion di dalam Discord.

### 2. Native Discord Monetization & Entitlements API

- **Tren Platform:** Standar monetisasi bot beralih dari tautan luar (Patreon/PayPal) ke **Discord Premium App Subscriptions (SKUs & Entitlements API)**. Discord menangani checkout lokal via Stripe, mendistribusikan event gateway `ENTITLEMENT_CREATE` / `ENTITLEMENT_UPDATE`, dan mendukung langganan berbasis Server (_Guild Subscription_) maupun Pengguna (_User Subscription_).
- **Adopsi Naura:** Menghubungkan paket Star Pass, status VIP/VVIP, dan Coupon Pack ke Discord SKUs resmi dengan validasi entitlement real-time.

### 3. Agentic AI & Duplex Voice Companions (Real-Time Audio)

- **Tren Platform:** Bot beralih dari interaksi tanya-jawab kaku ke agen AI percakapan yang memiliki memori semantik jangka panjang (vector memory RAG), mampu mengobrol suara dua arah secara langsung (_Duplex Voice Chat via WebRTC + VAD_), dan memiliki kepribadian anime yang kohesif.
- **Adopsi Naura:** Ekspansi AI Ensemble Router dan Fish Audio TTS menuju sesi voice channel interaktif dua arah (`/naura join-voice`).

### 4. Deep Social Gamification & All-in-One Virtual Economy

- **Tren Platform:** Komunitas Discord menuntut bot "All-in-One" berkemampuan tinggi (seperti OwO, Dank Memer, Tatsu, VibeBot) yang menggabungkan RPG pet virtual, battle pass musiman, pasar komoditas bebas, dan perang wilayah klan tanpa perlu mengundang belasan bot berbeda.
- **Adopsi Naura:** Pemantapan ekosistem Naura Wilds, Closed-Loop Currency V2, Battle Pass, Pasar Komoditas Dinamis, dan Guild Federation.

### 5. Komponen UI Modern (Discord Components V2 & Media Attachments)

- **Tren Platform:** Format embed tradisional mulai ditinggalkan dan digantikan oleh Container modern (Discord Components V2), Section terpisah, Accessory thumbnail, dan tata letak responsif bertingkat.
- **Adopsi Naura:** Standarisasi 5-lapisan `NauraContainerBuilder` yang sudah diadopsi secara penuh di seluruh modul.

### 6. Full-Duplex WebRTC Voice Agent & Sub-300ms Pipelines (2026)

- **Tren Platform:** Transisi dari bot push-to-talk sekuensial menuju agen suara full-duplex berbasis WebRTC dengan latensi ultra-rendah (<300ms) dan kapabilitas _barge-in_ (interupsi alami saat user memotong ucapan bot).
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
  - Event mingguan perebutan menara relik kuno (_Ancient Relic Towers_) antar federasi klan lintas-server berbasis kapling tanah `landEngine.js`.
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
    1. **Desa Sukamaju:** Distrik awal terpadu menyatukan pemukiman warga, ladang kebun Ningsih, pesisir dermaga nelayan Mang Ujang & Tari, hutan rimba satwa, dan gua pertambangan bijih. Mata uang: Naura Star Fragments (NSF).
    2. **Kota Pratama:** Megapolitan modern pusat ekonomi, bursa kerja, RS Pratama, balai lelang, dan Bank Sentral Pratama untuk penukaran 1.000 NSF -> 1 NC (Naura Coin).
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

## ⚠️ Risiko yang Harus Terus Dipantau

| Risiko                                            | Dampak                                               | Mitigasi                                                                                         |
| ------------------------------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| **Ekonomi tanpa penulisan atomik**                | Inflasi tak terkendali, duplikasi saldo/barang       | Pola `debit*` / `increment*` bersyarat dan transaksi `SELECT FOR UPDATE` pada kolom JSON.        |
| **Race condition transaksi multi-node**           | Duplikasi dispatch caravan atau mutasi state paralel | Redis Distributed Mutex (`cacheManager.withLock` / `redisLockHelper.js`) dengan lease TTL.       |
| **Race condition WebSocket saat audio buffering** | Bot terputus dari voice channel (error 4006)         | Delay prefetch 1500ms di `trackStart.js` dan proteksi `VoiceManager` terhadap Poru player aktif. |
| **Beban komputasi Canvas memblokir Event Loop**   | Bot mengalami freeze / chat lag                      | Seluruh render grafis didelegasikan ke `canvasWorkerPool.js` berbasis Worker Threads.            |
| **Pelanggaran karakter em dash**                  | Gagal validasi CI / inkonsistensi teks               | Diperiksa otomatis oleh script `scripts/check-em-dash.js`.                                       |
| **Single-point-of-failure node eksternal**        | Fitur audio/AI mati saat penyedia pihak ketiga down  | Sistem dual failover: Lavalink multi-node fallback dan Gemini auto-failover ke Groq.             |
| **Ketergantungan aset luar pada dbSeeder**        | Canvas Assets default hilang jika host luar mati     | Menggunakan aset gambar lokal mandiri di `assets/images/canvas/` (100% tuntas).                  |
| **Versi Node tidak konsisten**                    | CI/CD gagal atau bot mati diam-diam di Node 22       | Selaraskan `package.json engines` dengan keputusan arsitektur Node >= 24.                        |
