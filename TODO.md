# TODO Naura Hoshino V2 - Roadmap Pengembangan

Daftar pekerjaan strategis berdasarkan audit arsitektur dan riset eksternal (Agustus 2026).
Roadmap ini direstrukturisasi mengikuti prinsip: **amankan dulu, rapikan kedua, percepat ketiga, tambah fitur terakhir.**

## Keputusan arsitektur yang sudah ditetapkan

Keputusan berikut adalah sumber kebenaran. Semua dokumen lain harus mengikutinya.

| Topik | Keputusan |
| --- | --- |
| Versi Node | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian. |
| Penyimpanan bahasa | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi. |
| Strategi sharding | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering (lihat Sprint 2). |
| Fallback SQLite | **Dipertahankan.** Berfungsi sebagai penyimpanan darurat saat MySQL dan Redis mati bersamaan. |
| Sumber kebenaran | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` hanya untuk aturan yang tidak berubah tiap rilis. |
| Alur PR | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge. |
| Verifikasi sebelum klaim | Status di roadmap ini wajib dicek ke kode, bukan ke issue tracker. Sprint 0 dan Sprint 1 membuktikan tracker bisa tertinggal jauh dari kenyataan. |

## Legenda

- 🔴 P0: berpotensi merugikan pengguna atau merusak data. Tidak boleh ditunda.
- 🟠 P1: menghambat kecepatan pengembangan atau merusak pengalaman pengguna.
- 🟡 P2: peningkatan performa dan biaya hosting.
- 🟢 P3: fitur dan ekspansi.

---

## 🔴 Sprint 0: Hardening - SELESAI (PR #45, #46)

Verifikasi kode menunjukkan tiga dari empat pekerjaan sudah terpasang di `main` sebelum sprint ini dimulai. Yang tersisa hanya audit pemanggil ekonomi, yang dipindahkan ke Sprint 1.

- [x] **Pisahkan migrasi database dari boot sequence**
  - **Catatan verifikasi:** `dbManager.js` sudah aman di produksi. `NODE_ENV === 'production'` memakai `sync({ alter: false })` dan development memakai `sync({ alter: { drop: false } })`, jadi kekhawatiran awal soal `alter: true` di produksi **tidak terbukti**.
  - **Yang dikerjakan:**
    1. `runMigrations()` dan `syncFallbackToMySQL()` dikeluarkan dari jalur boot produksi. Migrasi kini dijalankan lewat `npm run db:migrate` (`scripts/migrate.js`) yang keluar dengan kode 1 bila gagal, sehingga deploy berhenti sebelum bot menyala. Di development, migrasi tetap otomatis agar alur harian tidak bertambah panjang.
    2. Migrasi dan pemindahan data fallback dijaga hanya untuk proses utama, jadi beberapa shard tidak ber-ALTER bersamaan.
    3. `dbMigrator.js` sekarang punya ledger `schema_migrations`. Sebelumnya setiap migrasi dijalankan ulang tiap boot dan hanya "berhasil" karena MySQL menolaknya dengan error kolom duplikat. Error tak terduga sekarang dilempar, bukan ditelan.
    4. Interval health-check database diberi `unref()`, supaya script pendek seperti `db:migrate` dan `npm test` bisa berakhir sendiri.
- [x] **Invalidasi cache `GuildSettings` di semua jalur tulis** (issue #20)
  - **Catatan verifikasi:** sudah terpasang di `main`. `guildSettingsService.updateGuildSetting()` menjadi jalur tulis, hook `afterCreate` / `afterUpdate` / `afterDestroy` / `afterUpsert` / `afterBulkUpdate` / `afterBulkDestroy` pada model memanggil `cacheInvalidator.invalidateGuild()`, dan kanal Redis Pub/Sub `cache:invalidate` menyegarkan state di memori tiap shard lewat `initSubscriber()` yang dipasang di `index.js`.
  - **Sisa:** tutup issue #20 setelah satu kali uji manual ubah setting di dashboard, lalu cek shard lain langsung ikut berubah.
- [x] **Amankan webhook donasi dan vote** (issue #18, bagian webhook saja)
  - **Catatan verifikasi:** sudah terpasang di `src/dashboard/routes/webhooks.js`. Token dibandingkan lewat `verifyToken` di `utils/httpGuard`, endpoint yang tokennya belum dikonfigurasi dibalas `503`, ada idempotency (`claimOnce` dengan ID transaksi atau sidik jari berumur pendek), batas body `64kb`, rate limiter 30 permintaan per menit, dan `trust proxy` di produksi.
  - **Sisa:** bagian dashboard dari issue #18 (helmet, CORS allowlist, cookie flag, izin `ManageGuild`) tetap di Sprint 2.
- [x] **Perbaiki `env.SHARD_ID` yang tidak pernah terisi** (temuan baru saat verifikasi)
  - `index.js` menentukan shard utama lewat `env.SHARD_ID`, tetapi kunci itu tidak pernah didefinisikan di `src/config/env.js`. Akibatnya setiap shard menganggap dirinya shard utama, lalu sama-sama deploy slash command dan membuka port dashboard sampai shard kedua mati dengan `EADDRINUSE`. `env.js` sekarang membaca `SHARDS` dari ShardingManager dan menyediakan `TOTAL_SHARDS`.
- [x] **Buat pool database sadar jumlah shard** (temuan riset)
  - `pool.max: 100` bersifat per proses, jadi dua shard saja sudah meminta 200 koneksi sementara `max_connections` MySQL biasanya 151. Sekarang ada `DB_POOL_BUDGET` (anggaran total, default 80) yang dibagi `TOTAL_SHARDS`, dengan `DB_POOL_MAX` sebagai penimpa manual.

---

## 🟠 Sprint 1: Fondasi Developer Experience

Sama seperti Sprint 0, verifikasi kode menunjukkan sebagian besar sprint ini **sudah terpasang di `main`**. Yang tersisa dikerjakan di sprint ini.

- [x] **Selaraskan seluruh dokumen dengan keputusan arsitektur di atas**
  - `engines.node`, README, `AGENTS.md`, dan CI sudah seragam di Node 24 dan versi 2.0.0. Bahasa per user sudah ditulis eksplisit. Tabel versi dan dependensi **dipertahankan** sesuai keputusan, hanya isinya yang diperbarui.
  - [ ] Tambahkan `npm run db:migrate` ke tabel script di README dan `AGENTS.md`, beserta urutan deploy yang benar (migrate dulu, baru start).
- [x] **Pecah `interactionCreate.js`** (issue #19)
  - **Catatan verifikasi:** sudah terpasang di `main`. Berkasnya kini 4,7 KB (dari 43 KB), dengan `src/interactions/` berisi `registry.js`, `safeExecute.js`, `autocomplete.js`, serta folder `buttons/`, `modals/`, `selects/`, dan `shared/`.
  - [x] Aturan lint `max-lines: 400` dipasang untuk `interactionCreate.js` dan seluruh `src/interactions/`, supaya berkas router tidak menggembung lagi.
- [x] **Handler `isAutocomplete()` dan penanganan error interaksi** (issue #21)
  - **Catatan verifikasi:** sudah terpasang lewat `src/interactions/autocomplete.js` dan `safeExecute.js`.
- [x] **Deploy slash command berbasis hash** (issue #11)
  - **Catatan verifikasi:** sudah terpasang di `CommandHandler.deploy()`. Tanda tangan SHA-256 mencakup `clientId`, `guildId`, dan daftar command, disimpan di `.cache/commands-deploy.json`. Berkas dipilih, bukan Redis, karena `load()` berjalan sebelum `redisManager.connect()`. Penanda sengaja tidak ditulis saat deploy gagal.
- [x] **Pisahkan `client.aliases` dari `client.commands`** (issue #12)
  - **Catatan verifikasi:** sudah terpasang, termasuk deteksi bentrok alias terhadap nama command asli dan terhadap alias lain, serta pendaftaran alias yang ditunda sampai semua command dimuat.
- [x] **Perbaiki `return console.log(...)` di `CommandHandler`** (issue #9)
  - **Catatan verifikasi:** sudah terpasang. `load()` dan `deploy()` sudah terpisah dan `deploy()` mengembalikan boolean.
- [x] **Pasang pengaman batas Components V2 di `NauraContainerBuilder.js`** (temuan riset)
  - `src/utils/componentBudget.js` menghitung komponen secara rekursif (termasuk isi section, gallery, action row, dan accessory) serta total panjang teks, lalu memangkas field berlebih dan menyisipkan catatan pemotongan. Header, gambar, tombol, dan footer tidak pernah dikorbankan, karena membuang tombol berarti membuang satu-satunya jalan pengguna melanjutkan alur.
  - Deskripsi dipangkas di 3000 karakter dan nilai field di 1000 karakter sebelum perakitan.
  - Bila payload masih terlalu berat setelah pemangkasan, builder mencatat error dengan angka komponen dan karakter yang sebenarnya, jadi pemanggil yang salah ukuran bisa dilacak tanpa menebak.
- [ ] **Ganti monkey-patch `ephemeralPatch.js` dengan `MessageFlags.Ephemeral`** (issue #10) - **sebagian**
  - [x] Aturan lint `no-restricted-syntax` menolak pemakaian baru `ephemeral: true`.
  - [x] Penambal sekarang mencatat lokasi pemanggil yang masih memakai opsi usang, satu peringatan per lokasi. Ini membangun daftar audit yang nyata, bukan hasil menebak.
  - [ ] Migrasikan pemanggil yang muncul di log, lalu hapus `src/utils/ephemeralPatch.js` beserta pemanggilannya di `index.js`.
- [ ] **Jadikan penulisan ekonomi atomik** (issue #17, dipindahkan dari Sprint 0) - **fondasi selesai**
  - [x] `cacheManager` sudah menyediakan `incrementUserProfile()`, `incrementUserSurvival()`, `debitUserProfile()`, dan `debitUserSurvival()`. Pemotongan saldo memakai satu `UPDATE` bersyarat dengan `Op.gte` dan memeriksa jumlah baris terpengaruh, plus `flushUser()` untuk mengosongkan antrean write-behind sebelum memeriksa kecukupan saldo.
  - [ ] Audit seluruh pemanggil di `plugin/` yang masih membaca lalu menulis nilai absolut (pola `profile.economy_wallet - harga` diikuti `updateUserProfile`). Ganti ke `debit*()` atau `increment*()`.
  - [ ] Tambahkan aturan lint atau test yang menolak pola read-modify-write pada kolom saldo.
- [ ] **Lengkapi CI** (issue #15, bagian CI) - **sebagian selesai**
  - [x] Step `node scripts/check-em-dash.js`.
  - [x] `locales:check` diubah menjadi `locales:check:strict`.
  - [x] `npm test` dan job `npm audit --audit-level=high`.
  - [ ] Hapus `continue-on-error` pada `format:check` setelah satu kali `npm run format` menyeluruh.
  - [ ] Hapus `continue-on-error` pada `npm audit` setelah kerentanan yang ada dibersihkan.
  - [ ] Aktifkan Dependabot dan secret scanning.
- [ ] **Tambahkan test otomatis** (issue #15) - **berjalan**
  - [x] `src/managers/dbMigrator.test.js` menjaga keunikan ID migrasi dan nama tabel ledger.
  - [x] `src/utils/componentBudget.test.js` menjaga perhitungan komponen bersarang, pemangkasan teks, dan jaminan bahwa tombol tidak pernah dibuang.
  - [ ] Lanjutkan ke logika murni yang paling mahal bila salah: rumus XP dan level, kalkulasi ekonomi, `RateLimiter`, dan parser durasi.

---

## 🟡 Sprint 2: Performa, Biaya Hosting, dan Kesiapan Skala

- [ ] **Lazy-load dependensi berat** (issue #16)
  - **Cara Implementasi:** Pindahkan `@xenova/transformers`, `tesseract.js`, `yt-dlp-wrap`, dan `ffmpeg-static` ke `await import()` di dalam fungsi yang memakainya, bukan di top-level `require`.
- [ ] **Batasi cache discord.js** dengan `Options.cacheWithLimits`, dan audit intents. Matikan `GuildPresences` bila tidak benar-benar dipakai.
- [ ] **Buffer XP di Redis** dengan `HINCRBY`, flush berkala ke MySQL. Ini menghapus mayoritas write di `messageCreate`.
- [ ] **Optimasi Canvas** (issue #16): cache hasil `loadImage`, cache font, dan batasi konkurensi render ke 2 sampai 3.
- [ ] **Caching hasil render Canvas via Redis:** key `canvas:profile:{userId}`, simpan buffer sebagai base64, TTL 300 detik.
- [ ] **Tambahkan indeks database** pada kolom yang sering difilter (`guildId`, `userId`, kolom tanggal cooldown).
- [x] **Optimasi connection pool:** selesai di Sprint 0 lewat `DB_POOL_BUDGET` yang dibagi `TOTAL_SHARDS`. Tinjau ulang angkanya setelah tahu `max_connections` MySQL produksi yang sebenarnya.
- [ ] **Siapkan jalur migrasi ke clustering** (keputusan: siapkan sekarang, migrasi nanti)
  - **Cara Implementasi:**
    1. Bungkus semua pemanggilan `broadcastEval` dan statistik lintas shard ke dalam satu modul, misalnya `src/managers/clusterManager.js`. Jangan ada `client.shard.*` yang berserakan di plugin.
    2. Agregasi statistik dashboard lewat Redis Pub/Sub, bukan lewat API shard langsung.
    3. Setelah dua langkah di atas selesai, migrasi ke `discord-hybrid-sharding` hanya menyentuh `shard.js` dan satu manager. Riset menunjukkan penghematan overhead proses idle 40 sampai 60 persen dibanding `ShardingManager`, dan ini penting karena RAM panel terbatas.
- [ ] **Pertimbangkan Umzug untuk migrasi database** (temuan riset)
  - `dbMigrator.js` sekarang sudah punya ledger dan gagal dengan keras, jadi urgensinya turun. Umzug tetap menarik untuk rollback dan migrasi berbasis file, bukan array di dalam kode.
- [ ] **Bersihkan cabang mati pada `syncFallbackToMySQL()`**
  - Stub `sqlite3` di sana punya `all()` yang selalu melempar error, jadi jalur itu tidak pernah bisa memulihkan data. Karena Node sudah dipatok `>= 24`, `node:sqlite` selalu tersedia dan cabang itu bisa dihapus.
- [ ] **Amankan dashboard** (issue #18, bagian dashboard): `helmet`, `express-rate-limit`, CORS allowlist, cookie `secure` dan `httpOnly`, `SESSION_SECRET` wajib, pengecekan izin `ManageGuild` per guild, dan upgrade ke Express 5.
- [ ] **Pecah `src/dashboard/server.js` (64 KB)** (issue #14) menjadi `middleware/`, `routes/`, dan `sockets/`.
- [ ] **Refactor `imageManager.js` (32 KB)** menjadi `src/utils/canvas/profileRenderer.js`, `levelCardRenderer.js`, dan seterusnya.
- [ ] **Tinjau `voiceStateUpdate.js` (23 KB) dan `ready.js` (18,6 KB)**
  - Dua berkas ini sekarang menjadi yang terbesar di `src/events/` setelah `interactionCreate.js` dipecah. Pola yang sama (registry plus handler kecil) layak diterapkan di sini.
- [ ] **Bersihkan dependensi ganda dan usang**
  - `node-fetch` dan `isomorphic-unfetch`: hapus, Node 24 sudah punya `fetch` global.
  - `dotenv`: hapus, gunakan `process.loadEnvFile()` bawaan Node.
  - `express-basic-auth`: hapus, cukup satu model autentikasi (sesi Discord OAuth).
  - `sqlite3`: **tetap dipertahankan** sebagai fallback darurat, tetapi pertimbangkan pindah ke `better-sqlite3` agar tidak perlu native build saat instalasi.
  - `@discordjs/voice` dan `libsodium-wrappers`: hapus bila tidak ada TTS atau voice di luar Lavalink.
  - `yt-dlp-wrap`: lepaskan dari jalur musik. Lavalink sudah menangani sumber audio, dan ini menambah risiko ToS serta biaya build.

---

## 🟡 Sprint 3: Observability dan Operasional

- [ ] **Endpoint `GET /api/health`**
  - **Cara Implementasi:** Buat `src/dashboard/routes/api.js`, panggil `featureRegistry.getHealthStats()`, kembalikan `200 OK` dengan payload JSON, lalu daftarkan route di `server.js`. Sertakan status MySQL (`getDbStatus()` sudah tersedia dan kini juga melaporkan `poolMax` serta `shardCount`), Redis, dan Lavalink.
- [ ] **Docker multi-stage dan compose** (issue #15): satu stack berisi bot, Lavalink, Redis, dan MySQL. Sertakan langkah `npm run db:migrate` sebagai job terpisah sebelum service bot menyala.
- [ ] **Metrik per command** dan agregasi statistik lintas shard lewat Redis Pub/Sub.
- [ ] **Integrasi Sentry** untuk pelacakan error produksi.
- [ ] **Status page publik** supaya pengguna tahu saat Lavalink atau MySQL bermasalah.
- [ ] **Audit log terpusat per guild** untuk semua aksi moderasi, perubahan setting, dan pemberian premium.
- [ ] **`/data export` dan `/data delete`** untuk kepatuhan privasi. Bot dengan data ekonomi dan profil sebaiknya punya jalur ini sebelum diminta.

---

## 🟢 Sprint 4: Musik, Monetisasi, dan Pengalaman Pengguna

- [ ] **Manfaatkan ekosistem plugin Lavalink v4** (temuan riset)
  - `youtube-source`: wajib di Lavalink v4 modern, lebih tahan terhadap perubahan YouTube.
  - `LavaSrc`: Spotify, Apple Music, dan Deezer, termasuk pencarian berbasis ISRC yang jauh lebih akurat daripada `ytmsearch:"Artis - Judul"` yang dipakai `spotifyHelper` sekarang.
  - `LavaSearch`: sumber data untuk autocomplete `/play` tanpa API tambahan.
  - `LavaLyrics`: mengganti `lyrics-finder` yang berbasis scraping dan rapuh.
  - `SponsorBlock`: lompati segmen sponsor dan tampilkan info chapter.
  - Siapkan Deezer atau SoundCloud sebagai fallback sumber audio.
- [ ] **Rancang `entitlementService` yang agnostik sumber** (temuan riset)
  - **Cara Implementasi:** Buat satu lapisan yang menjawab pertanyaan "apakah user atau guild ini premium", dengan adapter untuk Saweria dan Trakteer sekarang. Discord kini mendukung SKU dan Entitlements native (langganan per user atau per guild, tombol bergaya `premium` dengan `sku_id`, halaman store di App Directory), tetapi syarat developer berbasis US, EU, atau UK membuat Naura kemungkinan belum eligible dari Indonesia. Dengan lapisan ini, saat nanti eligible kita cukup menambah satu adapter tanpa menyentuh 20 command premium.
- [ ] **Autocomplete di mana-mana:** item shop, nama command untuk `/help`, judul lagu, nama pet, dan 33 subcommand `/survival`. Fondasinya sudah ada di `src/interactions/autocomplete.js`, jadi ini soal mengisi, bukan membangun.
- [ ] **Onboarding wizard setelah bot join:** satu pesan Container V2 dengan tombol setup cepat yang mengaktifkan preset (Community, Gaming, Minimal), bukan menyuruh admin menjelajah `/setup`.
- [ ] **Feature flags per guild** di atas `src/config/features.js`, dengan default **mati** untuk modul berat. Bot all-in-one yang bagus itu lengkap tapi tidak berisik.
- [ ] **Audio filters dan DJ role:** subcommand `/music filter [tipe]` memakai `player.setFilters()` dari Poru, plus field `djRoleId` di `GuildSettings` yang mencegah interaksi tombol musik oleh non-DJ di `musicButtons.js`.
- [ ] **Music Control Panel di dashboard:** view `music.html` plus socket event yang memancarkan state Lavalink real-time (lagu sekarang, queue, posisi durasi).
- [ ] **Perbaiki kepemilikan Temp Voice** (issue #22): simpan owner eksplisit di Map dan Redis `tempvoice:owner:`, jangan derivasi dari nama channel yang bisa dipalsukan. Tambahkan `/voice transfer`.

---

## 🟢 Sprint 5: Ekspansi Fitur

- [ ] **Bahasa per user secara menyeluruh:** pastikan `/language` menulis ke profil user, `getUserLanguage` membaca cache user lebih dulu, dan `GuildSettings.language` hanya dipakai sebagai default saat user belum memilih.
- [ ] **AI conversation memory per user:** cek `ai_memory:{userId}` di Redis sebelum memanggil LLM, gabungkan ke context, simpan kembali dengan TTL 3600.
- [ ] **AI function calling:** daftarkan tool seperti `check_balance`, `get_user_info`, dan `play_music` ke SDK `@google/genai`. Wajib disertai kuota token per user, guard prompt injection dari konten server, dan pemfilteran output.
- [ ] **Moderasi: tempban dan strike escalation.** Model `UserStrike`, logika eskalasi di `plugin/admin/warn.js`, dan penjadwalan unban lewat `cronManager.js`.
- [ ] **Anti-raid system:** hitung join per guild dengan rate limiter memory, dan set `GuildSettings.settings.lockdown = true` saat melebihi batas (misalnya 5 join per 10 detik).
- [ ] **Auction house dan pasar antar server:** tabel `market_auctions`, command `/market auction` dan `/market bid`. **Hanya setelah issue #17 selesai.**
- [ ] **Halaman ekonomi di dashboard:** klasemen kekayaan dan statistik inflasi server.
- [ ] **Seasonal events system:** penentu musim (Halloween, Lebaran, Natal) di `survivalContext.js`, dengan boost drop rate atau item eksklusif.
- [ ] **Welcome card visual builder** di dashboard: editor drag and drop berbasis Canvas HTML5 yang mengekspor JSON config ke `GuildSettings`. Pembeda nyata dibanding bot lain.
- [ ] **Plugin ticketing lanjutan:** folder `plugin/ticketing/`, modal untuk formulir tiket, private thread per tiket.
- [ ] **Audit desain dashboard terhadap `DESIGN.md`:** pastikan `.glass-panel` memakai `backdrop-filter: blur(16px)` dan `rgba(255, 255, 255, 0.03)`, font `Orbitron` untuk metrik dan `Outfit` untuk teks biasa, plus efek glow pada hover kartu.

---

## ⚠️ Risiko yang harus terus dipantau

| Risiko | Dampak | Mitigasi |
| --- | --- | --- |
| Migrasi berjalan di dalam boot sequence dan di semua shard | Skema separuh jalan atau deadlock saat startup | **Selesai** di Sprint 0 lewat `npm run db:migrate` dan penjagaan proses utama |
| Ekonomi tanpa penulisan atomik | Inflasi tak terkendali, ekonomi harus direset | Fondasi selesai. Sisa: audit pemanggil di `plugin/` (issue #17) |
| Webhook premium tanpa `timingSafeEqual` dan idempotency | Premium gratis, kebocoran pendapatan | **Selesai** di `webhooks.js` (issue #18, bagian webhook) |
| Cache setting basi hingga 5 menit dan lintas shard | Admin kehilangan kepercayaan pada panel setup | **Selesai** lewat hook model dan kanal `cache:invalidate` (issue #20) |
| Total koneksi database melampaui `max_connections` | Error `Too many connections` yang tampak tidak berhubungan dengan sharding | **Selesai** lewat `DB_POOL_BUDGET` dibagi `TOTAL_SHARDS` |
| Payload Container V2 melewati 40 komponen atau 4000 karakter | Seluruh balasan hilang dengan `Invalid Form Body` | **Selesai** lewat `componentBudget.js` di Sprint 1 |
| Penambal prototype `ephemeralPatch.js` | Upgrade discord.js bisa mematahkannya secara senyap | Lint menahan pemakaian baru, log mencatat pemanggil lama, lalu penambal dihapus |
| Lingkup all-in-one terus melebar | Beban maintenance menumpuk ke satu orang | Feature flag default mati, tolak fitur tanpa pemilik |
| Sumber musik YouTube | Risiko ToS dan API yang berubah sepihak | Plugin resmi Lavalink, siapkan fallback |
| Cakupan test masih sangat tipis | Setiap refactor masih taruhan | Dua berkas test sudah ada, lanjutkan ke logika ekonomi dan XP |
| Roadmap tertinggal dari kode | Waktu terbuang merencanakan yang sudah jadi | Verifikasi ke kode sebelum menulis status, bukan ke issue tracker |

---

## 📜 Arsip Selesai (Versi 1.2.0 - Core Engine)

<details>
<summary>Klik untuk melihat daftar pekerjaan yang sudah selesai</summary>

- [x] Selaraskan nama variabel environment di README dengan `src/config/env.js`
- [x] Hentikan `process.exit(1)` saat `env.js` di-import
- [x] Deploy slash command hanya oleh shard utama
- [x] Perbaiki `npm run deploy` agar flag `--deploy` dihormati
- [x] Pusatkan `NODE_ENV` lewat `src/config/env.js`
- [x] Pastikan semua migration schema hanya berada di `src/managers/dbMigrator.js`
- [x] Arahkan update settings dari `messageCreate` lewat `guildSettingsService`
- [x] Migrasikan respons komponen kedaluwarsa ke Container V2
- [x] Tambahkan `nauraText` helper untuk copywriting persona Naura bilingual
- [x] Tambahkan fondasi `src/config/features.js` untuk feature registry
- [x] Ganti query panas `GuildSettings.findOne()` dengan cache terpusat
- [x] Cache bahasa per user agar tidak query database di setiap balasan
- [x] Helper `src/utils/nauraExpression.js` terintegrasi ke Container Builder
- [x] Survival: Rapikan 33 subcommand
- [x] Bersihkan sisa em dash pada kamus bahasa

</details>
