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

## Legenda

- 🔴 P0: berpotensi merugikan pengguna atau merusak data. Tidak boleh ditunda.
- 🟠 P1: menghambat kecepatan pengembangan atau merusak pengalaman pengguna.
- 🟡 P2: peningkatan performa dan biaya hosting.
- 🟢 P3: fitur dan ekspansi.

---

## 🔴 Sprint 0: Hardening (kerjakan sebelum apa pun)

Empat pekerjaan ini menutup lubang yang bisa merusak data pengguna, ekonomi, atau pendapatan. Tidak ada fitur baru sampai sprint ini tuntas.

- [ ] **Hentikan `sequelize.sync({ alter: true })` di produksi** (temuan baru, belum ada issue)
  - **Cara Implementasi:**
    1. Di `src/managers/dbManager.js`, batasi `sync({ alter: true })` hanya untuk `NODE_ENV !== 'production'`.
    2. Di produksi, jalankan `sync()` tanpa opsi (aman, hanya membuat tabel yang belum ada), lalu serahkan seluruh perubahan kolom ke `dbMigrator.js`.
    3. Pisahkan migrasi dari boot sequence: buat script `npm run db:migrate` yang dijalankan sebelum bot menyala, bukan di dalam `connectToDatabase()`.
    4. Alasan: `alter: true` pada MySQL bisa menghapus atau mengubah kolom secara tak terduga. Ini satu-satunya jalur di proyek ini yang bisa menghilangkan data pengguna secara permanen, dan aturan 1.7 `AGENTS.md` sudah melarangnya.
- [ ] **Invalidasi cache `GuildSettings` di semua jalur tulis** (issue #20)
  - **Cara Implementasi:**
    1. Arahkan 13 handler setup berbasis tombol dan select menu ke `guildSettingsService.updateGuildSetting()`, jangan tulis model langsung.
    2. Pastikan `updateGuildSetting()` selalu memanggil `cacheManager.invalidateGuildSettings(guildId)`.
    3. Tambahkan channel Redis Pub/Sub `cache:invalidate` agar shard lain ikut membuang cache basi.
    4. Alasan: admin mengubah setting dan tidak terjadi apa-apa sampai 5 menit. Ini calon laporan bug nomor satu.
- [ ] **Jadikan penulisan ekonomi atomik** (issue #17)
  - **Cara Implementasi:**
    1. Migrasikan seluruh pemanggil ekonomi dan RPG ke `incrementUserProfile()` / `incrementUserSurvival()`.
    2. Untuk pengurangan saldo, gunakan penulisan bersyarat: `sequelize.literal` dengan syarat `Op.gte` pada jumlah yang dikurangi, lalu cek jumlah baris terpengaruh. Nol baris berarti saldo tidak cukup.
    3. Alasan: duplikasi uang lewat double-click adalah eksploit paling umum pada bot ekonomi, dan sekali ekonomi rusak tidak bisa dipulihkan tanpa reset.
- [ ] **Amankan webhook donasi dan vote** (issue #18, bagian webhook saja)
  - **Cara Implementasi:**
    1. Bandingkan token dengan `crypto.timingSafeEqual`, bukan `===`.
    2. Tolak request bila token belum dikonfigurasi di environment. Jangan pernah memberi akses saat konfigurasi kosong.
    3. Tambahkan idempotency key per transaksi agar retry dari Saweria, Trakteer, atau Top.gg tidak memberi premium dua kali.
    4. Batasi ukuran body dan catat setiap pemberian premium ke audit log.
    5. Alasan: endpoint ini memberi premium, jadi ini permukaan serangan yang bernilai uang.

---

## 🟠 Sprint 1: Fondasi Developer Experience

Setelah aman, kita buat repository ini nyaman dan aman untuk di-refactor.

- [ ] **Selaraskan seluruh dokumen dengan keputusan arsitektur di atas**
  - **Cara Implementasi:**
    1. Setel `engines.node` ke `>=24.0.0`, README, `AGENTS.md`, dan `node-version` di CI ke `24`.
    2. Samakan versi bot di `AGENTS.md` dengan `package.json` (`2.0.0`).
    3. Tulis eksplisit di `AGENTS.md` bahwa bahasa disimpan per user, dan `GuildSettings.language` hanya default guild.
    4. Hapus tabel daftar dependensi dan tabel versi dari `AGENTS.md` agar tidak pernah basi lagi. Arahkan pembaca ke `package.json`.
    5. Tulis eksplisit bahwa `await import()` diizinkan untuk lazy-load meski proyek memakai CommonJS.
- [ ] **Lengkapi CI** (issue #15, bagian CI)
  - **Cara Implementasi:**
    1. Tambahkan step `node scripts/check-em-dash.js`.
    2. Ubah `locales:check` menjadi `locales:check:strict` agar pipeline gagal saat ada kunci bahasa tertinggal.
    3. Tambahkan `npm test` dan `npm audit --audit-level=high`.
    4. Hapus `continue-on-error` pada `format:check` setelah satu kali `npm run format` menyeluruh.
    5. Aktifkan Dependabot dan secret scanning.
- [ ] **Tambahkan test otomatis pertama** (issue #15)
  - **Cara Implementasi:** Pakai `node:test` bawaan. Mulai dari logika murni yang paling mahal bila salah: rumus XP dan level, kalkulasi ekonomi, `RateLimiter`, dan parser durasi.
- [ ] **Pecah `interactionCreate.js` (43 KB)** (issue #19)
  - **Cara Implementasi:** Buat `src/interactions/` sebagai registry per tipe interaksi, tambahkan `safeExecute.js` untuk penanganan error terpusat, lalu tambahkan aturan lint `max-lines: 400`.
- [ ] **Tambahkan handler `isAutocomplete()` dan tutup celah error handling** (issue #21)
  - **Cara Implementasi:**
    1. Tambahkan cabang `isAutocomplete()` yang sebelumnya tidak ada sama sekali.
    2. Bungkus handler tombol, select menu, dan modal dengan try/catch.
    3. Sertakan `retryAfter` pada balasan rate limit.
    4. Ganti if-chain tanpa `return` menjadi early return, dan jangan panggil `getUserLanguage` di setiap interaksi (ambil dari cache).
- [ ] **Deploy slash command berbasis hash** (issue #11)
  - **Cara Implementasi:** Hitung SHA-1 dari definisi command, simpan ke `deploy:commands:hash` di Redis atau `.cache/commands.hash`, dan hanya deploy bila hash berubah.
- [ ] **Pisahkan `client.aliases` dari `client.commands`** (issue #12) dengan deteksi tabrakan nama saat load.
- [ ] **Ganti monkey-patch `ephemeralPatch.js` dengan `MessageFlags.Ephemeral`** (issue #10) dan tambahkan aturan lint `no-restricted-syntax` agar `ephemeral: true` tidak kembali.
- [ ] **Perbaiki `return console.log(...)` di `CommandHandler.load()`** (issue #9) yang membatalkan proses load secara diam-diam. Pisahkan `load()` dan `deploy()`.
- [ ] **Pasang pengaman batas Components V2 di `NauraContainerBuilder.js`** (temuan riset)
  - **Cara Implementasi:** Hitung jumlah komponen (maksimum 40, termasuk yang bersarang) dan total panjang teks sebelum payload dikirim, lalu potong atau pecah otomatis ke halaman. Lebih baik gagal di builder dengan pesan jelas daripada `Invalid Form Body` di produksi. Ini penting karena `AGENTS.md` mewajibkan struktur 5 lapisan di setiap respons.

---

## 🟡 Sprint 2: Performa, Biaya Hosting, dan Kesiapan Skala

- [ ] **Lazy-load dependensi berat** (issue #16)
  - **Cara Implementasi:** Pindahkan `@xenova/transformers`, `tesseract.js`, `yt-dlp-wrap`, dan `ffmpeg-static` ke `await import()` di dalam fungsi yang memakainya, bukan di top-level `require`.
- [ ] **Batasi cache discord.js** dengan `Options.cacheWithLimits`, dan audit intents. Matikan `GuildPresences` bila tidak benar-benar dipakai.
- [ ] **Buffer XP di Redis** dengan `HINCRBY`, flush berkala ke MySQL. Ini menghapus mayoritas write di `messageCreate`.
- [ ] **Optimasi Canvas** (issue #16): cache hasil `loadImage`, cache font, dan batasi konkurensi render ke 2 sampai 3.
- [ ] **Caching hasil render Canvas via Redis:** key `canvas:profile:{userId}`, simpan buffer sebagai base64, TTL 300 detik.
- [ ] **Tambahkan indeks database** pada kolom yang sering difilter (`guildId`, `userId`, kolom tanggal cooldown).
- [ ] **Siapkan jalur migrasi ke clustering** (keputusan: siapkan sekarang, migrasi nanti)
  - **Cara Implementasi:**
    1. Bungkus semua pemanggilan `broadcastEval` dan statistik lintas shard ke dalam satu modul, misalnya `src/managers/clusterManager.js`. Jangan ada `client.shard.*` yang berserakan di plugin.
    2. Agregasi statistik dashboard lewat Redis Pub/Sub, bukan lewat API shard langsung.
    3. Setelah dua langkah di atas selesai, migrasi ke `discord-hybrid-sharding` hanya menyentuh `shard.js` dan satu manager. Riset menunjukkan penghematan overhead proses idle 40 sampai 60 persen dibanding `ShardingManager`, dan ini penting karena RAM panel terbatas.
- [ ] **Adopsi Umzug untuk migrasi database** (temuan riset)
  - **Cara Implementasi:** Gantikan `dbMigrator.js` custom dengan Umzug: migrasi bernomor, tercatat di tabel meta, bisa rollback, dan berjalan sebagai langkah terpisah sebelum bot menyala. Ini memenuhi aturan 1.7 `AGENTS.md` secara struktural, bukan hanya secara konvensi.
- [ ] **Amankan dashboard** (issue #18, bagian dashboard): `helmet`, `express-rate-limit`, CORS allowlist, cookie `secure` dan `httpOnly`, `SESSION_SECRET` wajib, pengecekan izin `ManageGuild` per guild, dan upgrade ke Express 5.
- [ ] **Pecah `src/dashboard/server.js` (64 KB)** (issue #14) menjadi `middleware/`, `routes/`, dan `sockets/`.
- [ ] **Refactor `imageManager.js` (32 KB)** menjadi `src/utils/canvas/profileRenderer.js`, `levelCardRenderer.js`, dan seterusnya.
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
  - **Cara Implementasi:** Buat `src/dashboard/routes/api.js`, panggil `featureRegistry.getHealthStats()`, kembalikan `200 OK` dengan payload JSON, lalu daftarkan route di `server.js`. Sertakan status MySQL, Redis, dan Lavalink.
- [ ] **Docker multi-stage dan compose** (issue #15): satu stack berisi bot, Lavalink, Redis, dan MySQL.
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
- [ ] **Autocomplete di mana-mana:** item shop, nama command untuk `/help`, judul lagu, nama pet, dan 33 subcommand `/survival`. Ini upgrade UX termurah dengan dampak terluas.
- [ ] **Onboarding wizard setelah bot join:** satu pesan Container V2 dengan tombol setup cepat yang mengaktifkan preset (Community, Gaming, Minimal), bukan menyuruh admin menjelajah `/setup`.
- [ ] **Feature flags per guild** di atas `src/config/features.js`, dengan default **mati** untuk modul berat. Bot all-in-one yang bagus itu lengkap tapi tidak berisik.
- [ ] **Audio filters dan DJ role:** subcommand `/music filter [tipe]` memakai `player.setFilters()` dari Poru, plus field `djRoleId` di `GuildSettings` yang mencegah interaksi tombol musik oleh non-DJ di `musicButtons.js`.
- [ ] **Music Control Panel di dashboard:** view `music.html` plus socket event yang memancarkan state Lavalink real-time (lagu sekarang, queue, posisi durasi).
- [ ] **Perbaiki kepemilikan Temp Voice** (issue #22): simpan owner eksplisit di Map dan Redis `tempvoice:owner:`, jangan derivasi dari nama channel yang bisa dipalsukan. Tambahkan `/voice transfer`.

---

## 🟢 Sprint 5: Ekspansi Fitur

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
| `sync({ alter: true })` di produksi | Kehilangan data permanen | Sprint 0 |
| Ekonomi tanpa penulisan atomik | Inflasi tak terkendali, ekonomi harus direset | Sprint 0, issue #17 |
| Webhook premium tanpa `timingSafeEqual` dan idempotency | Premium gratis, kebocoran pendapatan | Sprint 0, issue #18 |
| Lingkup all-in-one terus melebar | Beban maintenance menumpuk ke satu orang | Feature flag default mati, tolak fitur tanpa pemilik |
| Sumber musik YouTube | Risiko ToS dan API yang berubah sepihak | Plugin resmi Lavalink, siapkan fallback |
| Nol test otomatis pada basis kode sebesar ini | Setiap refactor adalah taruhan | Sprint 1, mulai dari logika murni |

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
