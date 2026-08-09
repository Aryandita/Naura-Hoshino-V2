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
| Target deploy | Panel Pterodactyl dengan satu perintah start yang bisa diubah (`CMD_RUN`). Nilainya tetap `npm start`; urutan migrate-lalu-start dijamin oleh npm lifecycle `prestart`, bukan oleh perintah manual. |
| Mata uang paling langka | Naura Coupon. Disimpan di kolom `coupons` (bukan JSON) supaya bisa dipotong atomik dan tidak pernah hilang. |
| Intent Discord | Tujuh intent aktif, semuanya punya event pemakai nyata. `GuildPresences` **sengaja mati**, dan konsekuensinya `presenceUpdate.js` dihapus, bukan dibiarkan sebagai kode mati. |

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
  - [x] Tabel script terbaru sudah masuk README dan `AGENTS.md`, termasuk `prestart`, `start:no-migrate`, dan `db:migrate`, beserta bagian khusus prosedur deploy di panel Pterodactyl.
- [x] **Pecah `interactionCreate.js`** (issue #19)
  - **Catatan verifikasi:** sudah terpasang di `main`. Berkasnya kini 4,7 KB (dari 43 KB), dengan `src/interactions/` berisi `registry.js`, `safeExecute.js`, `autocomplete.js`, serta folder `buttons/`, `modals/`, `selects/`, dan `shared/`.
  - [x] Aturan lint `max-lines: 400` dipasang untuk `interactionCreate.js` dan seluruh `src/interactions/`, supaya berkas router tidak menggembung lagi.
- [x] **Handler `isAutocomplete()` dan penanganan error interaksi** (issue #21)
  - **Catatan verifikasi:** sudah terpasang lewat `src/interactions/autocomplete.js` dan `safeExecute.js`.
- [x] **Deploy slash command berbasis hash** (issue #11)
  - **Catatan verifikasi:** sudah terpasang di `CommandHandler.deploy()`. Tanda tangan SHA-256 mencakup `clientId`, `guildId`, dan daftar command, disimpan di `.cache/commands-deploy.json`. Berkas dipilih, bukan Redis, karena `load()` berjalan sebelum `redisManager.connect()`. Penanda sengaja tidak ditulis saat deploy gagal.
  - **Catatan operasional:** folder `.cache/` wajib ikut bertahan antar restart di panel. Bila terhapus tiap boot, slash command akan dideploy ulang terus dan kena rate limit Discord tanpa alasan yang jelas.
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
  - [x] `plugin/survival/subcommands/collect.js` dimigrasikan ke `flags: MessageFlags.Ephemeral` saat audit Sprint 2.
  - [ ] Migrasikan pemanggil lain yang muncul di log, lalu hapus `src/utils/ephemeralPatch.js` beserta pemanggilannya di `index.js`.
- [ ] **Jadikan penulisan ekonomi atomik** (issue #17, dipindahkan dari Sprint 0) - **inti selesai di Sprint 2**
  - [x] `cacheManager` menyediakan `incrementUserProfile()`, `incrementUserSurvival()`, `debitUserProfile()`, dan `debitUserSurvival()`. Pemotongan saldo memakai satu `UPDATE` bersyarat dengan `Op.gte` dan memeriksa jumlah baris terpengaruh, plus `flushUser()` untuk mengosongkan antrean write-behind sebelum memeriksa kecukupan saldo.
  - [x] Audit pemanggil ekonomi di `plugin/survival/`. Hasilnya mengoreksi asumsi awal: kolom saldo (`economy_wallet`, `economy_bank`, `starFragments`) **sudah aman sebelum sprint ini**, karena `currency.charge()` memakai `debit*()` dan `bankActions.js` selalu memotong sebelum menambah. Lubang yang sebenarnya ada di kolom JSON dan pada pemanggilan `UserSurvival.update()` langsung.
  - [x] Naura Coupon dipindahkan dari JSON `rpg_state` ke kolom `coupons` lewat migrasi `v5_add_coupons` dan `v6_move_coupons_to_column`, sehingga kupon bisa dipotong atomik seperti mata uang lain.
  - [x] Semua `survival.save()` dibatasi ke `fields` eksplisit. Tanpa ini, `save()` menulis nilai absolut dari memori sementara increment yang sama masih menunggu di antrean, sehingga satu vote bisa terhitung dua kali.
  - [x] `cacheManager.mutateUserProfileJson()` dan `mutateUserSurvivalJson()`: perubahan kolom JSON kini terjadi di dalam transaksi dengan baris pemain dikunci (`SELECT ... FOR UPDATE`), karena kolom JSON tidak punya padanan `kolom = kolom + delta`.
  - [x] `inventoryHelper.addItemsAtomic()` dan `takeItemsAtomic()` menggantikan pola baca-ubah-tulis di `shopPurchase.storeItem`, `dungeonRewards.consumePass`, `dungeonRewards.grantVictory`, dan `collectActions.grantLoot`. Dampak nyata: barang tidak lagi hilang saat dua hadiah tiba bersamaan, dan satu tiket dungeon tidak bisa dipakai dua kali.
  - [x] `collectActions.goHome`, pengurasan stamina, dan perpindahan lokasi di `collect.js` tidak lagi memakai `UserSurvival.update()` atau `survival.save()` langsung, jadi cache `user:survival` tidak lagi basi sampai 30 menit.
  - [x] `chop.js`, `mine.js`, dan `fish.js` disamakan dengan jalur aman. Ketiganya ternyata punya jalur penulisan sendiri yang melewati seluruh lapisan: masing-masing menyalin fungsi `addItem()` lokal, menulis ulang seluruh array inventory lewat `updateUserProfile()`, dan memotong stamina dengan `survival.save()` telanjang. Sekarang stamina dipotong lewat `debitUserSurvival()` (pemeriksaan dan pemotongan jadi satu langkah SQL, jadi tenaga yang sama tidak bisa dipakai dua kali) dan barang masuk lewat `addItemsAtomic()`. Umpan di `fish.js` diambil lewat `takeItemsAtomic()`, dengan pengembalian stamina bila umpannya ternyata sudah habis dipakai proses lain.
  - [x] Tambahkan aturan lint yang menolak pola read-modify-write pada kolom saldo dan kolom JSON. Terpasang di `eslint.config.js` sebagai lima entri `no-restricted-syntax`: kolom JSON yang ditulis lewat `update*()`, kolom akumulatif yang ditulis sebagai nilai absolut, `UserProfile.update()` dan `UserSurvival.update()` langsung, `save()` tanpa daftar `fields` pada variabel bernama `survival` atau `profile`, dan pemanggilan `currency.setBalance()`. Semuanya bersetelan `warn`, bukan `error`, supaya CI tetap hijau sambil mendaftar pemanggil lama yang belum diaudit. Naikkan ke `error` setelah auditnya tuntas.
  - [ ] Lanjutkan audit ke `plugin/` di luar survival: `admin`, `ai`, `canvas`, `modmail`, `music`, `owner`, `premium`, `utility`, plus `minigames/minigame.js`, `core/core.js`, `core/naura.js`, dan `leveling/leveling.js`. Catatan: `search_code` GitHub tidak berfungsi di repo privat ini, jadi audit harus membaca berkas langsung. Jalan pintas yang lebih murah: jalankan `npm run lint` dan pakai daftar peringatan dari aturan baru di atas sebagai peta audit.
  - [ ] Audit pemanggil `currency.setBalance()` yang sekarang bertanda `@deprecated`, lalu jadikan internal atau hapus. Aturan lint sudah menandai setiap pemanggilannya, jadi daftarnya bisa didapat tanpa menebak.
- [ ] **Lengkapi CI** (issue #15, bagian CI) - **sebagian selesai**
  - [x] Step `node scripts/check-em-dash.js`.
  - [x] `locales:check` diubah menjadi `locales:check:strict`.
  - [x] `npm test` dan job `npm audit --audit-level=high`.
  - [ ] Hapus `continue-on-error` pada `format:check` setelah satu kali `npm run format` menyeluruh.
  - [ ] Hapus `continue-on-error` pada `npm audit` setelah kerentanan yang ada dibersihkan.
  - [ ] Aktifkan Dependabot dan secret scanning.
  - [ ] **Tambahkan step yang membuktikan repo bisa di-boot dari hasil clone bersih.** Cukup `node -e "require('./index.js')"` tidak bisa dipakai karena akan benar-benar login, jadi pakai pemeriksaan resolusi modul: telusuri seluruh `require` relatif di `index.js`, `shard.js`, `src/`, dan `plugin/`, lalu pastikan setiap targetnya benar-benar ada di dalam git. Ini yang akan menangkap kasus berkas hilang seperti di bawah sebelum sampai ke produksi.
- [ ] **Tambahkan test otomatis** (issue #15) - **berjalan**
  - [x] `src/managers/dbMigrator.test.js` menjaga keunikan ID migrasi, nama tabel ledger, urutan versi yang selalu naik, dan urutan `v5` sebelum `v6`. Penjagaan urutan itu penting karena `v6` menambah kupon ke nilai yang sudah ada, jadi menjalankannya dua kali akan menggandakan kupon setiap pemain.
  - [x] `src/utils/componentBudget.test.js` menjaga perhitungan komponen bersarang, pemangkasan teks, dan jaminan bahwa tombol tidak pernah dibuang.
  - [x] `plugin/survival/inventoryHelper.test.js` menjaga perhitungan tumpukan barang, pengambilan lintas tumpukan, penolakan saat jumlah tidak cukup, dan jaminan bahwa inventory asli tidak ikut berubah.
  - [ ] Lanjutkan ke logika murni yang paling mahal bila salah: rumus XP dan level, kalkulasi ekonomi, `RateLimiter`, dan parser durasi.

---

## 🔴 Perbaikan darurat: tiga manager hilang dari git (Sprint 2)

Ditemukan saat menyiapkan pekerjaan performa, dan sifatnya P0 karena membuat repo tidak bisa dipakai orang lain.

- [x] **`src/managers/musicManager.js`, `dbSeeder.js`, dan `aiManager.js` tidak ada di `main`, padahal `index.js` me-require dua di antaranya di baris atas.**
  - Akibatnya `node index.js` mati dengan `MODULE_NOT_FOUND` sebelum sempat login, sehingga hasil `git clone` mustahil di-boot. Bot di panel tetap hidup karena `git pull` tidak menghapus berkas lokal yang tidak terlacak git, jadi satu-satunya salinan berkas itu ada di disk panel dan akan ikut hilang bila volumenya hilang.
  - Ketiganya ditarik kembali dari commit awal `b7dbfd3`.
  - **Pelajaran:** status "berjalan di panel" bukan bukti "ada di git". Karena itu pemeriksaan resolusi modul ditambahkan ke daftar CI di atas.
- [x] **`src/events/presenceUpdate.js` dihapus.** Intent `GuildPresences` tidak aktif, jadi berkas itu tidak pernah terpanggil sama sekali.
- [x] **Bug boot di `aiManager.js` diperbaiki sekalian.** Constructor-nya menjalankan `this.model = this.genAI.models` tanpa penjagaan. Bila `GEMINI_API_KEY` kosong, `this.genAI` bernilai `undefined` dan baris itu melempar `TypeError`. Karena berkas ini mengekspor instance (`module.exports = new AIManager()`), kegagalannya terjadi saat require dan mematikan seluruh proses, bukan sekadar mematikan fitur AI. Sekarang Gemini diakses lewat `getGenAI()` yang mengembalikan `null` dengan sopan, dan Verba serta Ollama tetap jalan.
- [x] **Timer `setInterval` pembersih sesi AI diberi `unref()`.** Tanpa itu proses menolak mati saat shutdown sampai watchdog memaksanya keluar, dan ini melanggar aturan 1.9 di `AGENTS.md`.

---

## 🟡 Sprint 2: Performa, Biaya Hosting, dan Kesiapan Skala

- [x] **Deploy di panel Pterodactyl tanpa perintah tambahan** (temuan operasional)
  - Perintah startup luar di panel terkunci dan hanya variabel `CMD_RUN` yang bisa diubah, lalu nilainya dijalankan dengan awalan `/usr/local/bin/`. Artinya token pertamanya wajib biner di folder itu (`npm`, `node`, `npx`) dan perangkaian shell tidak bisa diandalkan.
  - Solusinya: urutan pindah ke dalam `package.json`. `prestart` menjalankan `node scripts/migrate.js`, jadi `npm start` mustahil menyala di atas skema separuh jalan. Migrasi yang gagal keluar dengan kode 1 dan npm membatalkan `start`.
  - `SKIP_DB_MIGRATE=1` dan `npm run start:no-migrate` tersedia sebagai pintu darurat. Keduanya tidak boleh menjadi pengaturan tetap, karena kolom baru tidak akan pernah dibuat.
  - Syarat lain: image panel wajib Node 24 atau lebih baru, dan `.cache/` harus bertahan antar restart.
- [x] **Batasi cache discord.js dan audit intents**
  - Batas cache dipusatkan di `src/config/clientOptions.js` lewat `Options.cacheWithLimits`, disebar di atas `Options.DefaultMakeCacheSettings`. Penyebaran itu wajib, karena `cacheWithLimits` tidak menggabungkan nilai bawaan sendiri dan manager yang tidak disebut akan kembali tanpa batas.
  - Pesan dibatasi 100 per channel dengan penyapu umur 30 menit, member 200 per guild, user 500, dan tujuh manager yang tidak pernah dibaca dari cache diset 0. Nilai 0 tidak mematikan fitur karena `fetch()` tetap menembak REST API.
  - `GuildMemberManager` dan `UserManager` memakai `keepOverLimit` untuk entri bot sendiri. Tanpa itu `client.user` bisa tergusur dan pemeriksaan izin bot sendiri gagal secara sporadis, yang termasuk bug paling sulit dilacak.
  - Member dan user **tidak** disapu berdasarkan umur, hanya dibatasi ukurannya, karena menyapu member berisiko membuang member yang sedang berada di voice channel dan itu merusak pelacakan temp voice.
  - `ReactionUserManager` sengaja dibiarkan tanpa batas sampai handler reaksi diaudit apakah membaca `reaction.users.cache`. Memutus referensi reaksi bisa memecahkan paginasi menu yang bergantung pada cache Discord.
  - Audit intent hasilnya nol pengurangan: ketujuh intent punya event pemakai nyata, jadi alasannya didokumentasikan di kode. Temuan kebalikannya justru `GuildPresences` yang mati sementara `presenceUpdate.js` masih ada, dan berkas itu sudah dihapus.
- [ ] **Lazy-load dependensi berat** (issue #16) - **sebagian selesai**
  - **Koreksi rencana awal:** daftar lama menyebut `@xenova/transformers` dan `tesseract.js`, padahal keduanya **tidak ada di `package.json`**. Daftar yang benar adalah dependensi berat yang memang terpasang.
  - [x] `poru` tidak lagi di-require di baris atas `musicManager.js`. Instance Poru dibuat lewat `ensurePoru()` saat Lavalink dinyalakan, dan getter `poru` sengaja tidak membuat instance baru supaya pemeriksaan saat shutdown di `index.js` tidak melahirkan koneksi yang tidak pernah ditutup.
  - [x] `@google/genai` dan `ollama` di `aiManager.js` di-require saat pemakaian pertama, bukan saat boot. Sebelumnya setiap shard membayar biaya muat keduanya meski tidak ada satu pun permintaan AI sepanjang uptime.
  - [ ] `@napi-rs/canvas`. Ini **tidak bisa dikerjakan setengah jalan**: selama masih ada satu berkas yang me-require-nya di baris atas, modul native tetap dimuat saat boot dan pekerjaan di berkas lain tidak menghasilkan penghematan apa pun. Jadi migrasinya harus mencakup seluruh 13 berkas di `plugin/canvas/` dalam satu langkah: `Canvas.js`, `CanvasUtils.js`, `achievementCanvas.js`, `adminCosmetic.js`, `battleCanvas.js`, `canvasHelper.js`, `cardCanvas.js`, `cosmetic.js`, `duelCanvas.js`, `imageManager.js`, `nowplayingCanvas.js`, `petCanvas.js`, dan `profileCanvas.js`. Rencananya satu modul `plugin/canvas/canvasRuntime.js` sebagai satu-satunya pintu ke SDK, sekaligus tempat registrasi font dijalankan sekali.
  - [ ] `ffmpeg-static`, `fluent-ffmpeg`, `yt-dlp-wrap`, `discord-html-transcripts`, `aki-api`, dan `spotify-url-info`. Semuanya hanya dipakai satu atau dua command, jadi cocok dipindah ke `require()` di dalam fungsi.
- [ ] **Buffer XP di Redis** dengan `HINCRBY`, flush berkala ke MySQL. Ini menghapus mayoritas write di `messageCreate`.
- [ ] **Optimasi Canvas** (issue #16): cache hasil `loadImage`, cache font, dan batasi konkurensi render ke 2 sampai 3.
  - Catatan: pola caching hasil render sudah ada contohnya di `plugin/leveling/rankCard.js`. Berkas itu tidak menyentuh SDK canvas sama sekali, hanya menerima fungsi `render`, dan kunci cache-nya sengaja memakai petak lima persen bukan XP mentah supaya bar yang terlihat sama boleh memakai gambar yang sama. Pola ini yang sebaiknya ditiru berkas canvas lain.
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
- [x] **Bersihkan cabang mati pada `syncFallbackToMySQL()`**
  - Stub `sqlite3` di sana punya `all()` yang selalu melempar error, jadi jalur itu tidak pernah bisa memulihkan data. Karena Node sudah dipatok `>= 24`, `node:sqlite` selalu tersedia dan cabang itu bisa dihapus.
- [x] **Amankan dashboard** (issue #18, bagian dashboard): `helmet`, `express-rate-limit`, CORS allowlist, cookie `secure` dan `httpOnly`, `SESSION_SECRET` wajib, pengecekan izin `ManageGuild` per guild, dan upgrade ke Express 5.
- [x] **Pecah `src/dashboard/server.js` (64 KB)** (issue #14) menjadi `middleware/`, `routes/`, dan `sockets/`.
- [ ] **Refactor `plugin/canvas/imageManager.js` (32 KB)** menjadi beberapa renderer terpisah. Kerjakan bersamaan dengan migrasi `canvasRuntime.js` di atas supaya berkas besar itu tidak dibongkar dua kali.
- [x] **Tinjau `voiceStateUpdate.js` (23 KB) dan `ready.js` (18,6 KB)**
  - Dua berkas ini sekarang menjadi yang terbesar di `src/events/` setelah `interactionCreate.js` dipecah. Pola yang sama (registry plus handler kecil) layak diterapkan di sini.
- [x] **Bersihkan dependensi ganda dan usang**
  - `node-fetch` dan `isomorphic-unfetch`: hapus, Node 24 sudah punya `fetch` global.
  - `dotenv`: hapus, gunakan `process.loadEnvFile()` bawaan Node.
  - `express-basic-auth`: hapus, cukup satu model autentikasi (sesi Discord OAuth).
  - `sqlite3`: **tetap dipertahankan** sebagai fallback darurat, tetapi pertimbangkan pindah ke `better-sqlite3` agar tidak perlu native build saat instalasi.
  - `@discordjs/voice` dan `libsodium-wrappers`: hapus bila tidak ada TTS atau voice di luar Lavalink.
  - `yt-dlp-wrap`: lepaskan dari jalur musik. Lavalink sudah menangani sumber audio, dan ini menambah risiko ToS serta biaya build.
- [x] **Perbaiki dukungan multi node Lavalink yang sudah mati diam-diam**
  - `musicManager.buildNodes()` masih memisah `LAVA_HOST`, `LAVA_PORT`, `LAVA_PASS`, dan `LAVA_SECURE` dengan koma, tetapi `src/config/env.js` sudah menormalkan `LAVA_PORT` dengan `parseInt` dan `LAVA_SECURE` menjadi boolean. Jadi selama nilainya lewat `env.js`, isi koma hanya berdampak pada host dan password. Putuskan: dukung penuh multi node lewat satu variabel JSON, atau buang sisa pemisah koma itu supaya tidak menyesatkan.

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
| Migrasi berjalan di dalam boot sequence dan di semua shard | Skema separuh jalan atau deadlock saat startup | **Selesai** di Sprint 0 lewat `scripts/migrate.js`, dan di Sprint 2 dijamin urutannya oleh `prestart` |
| Ekonomi tanpa penulisan atomik | Inflasi tak terkendali, ekonomi harus direset | **Selesai untuk survival:** kolom saldo, kolom kupon, kolom JSON inventory, tiket dungeon, serta jalur `chop`, `mine`, dan `fish`. Aturan lint baru menahan pola lama supaya tidak kembali. Sisa: audit modul non-survival (issue #17) |
| Modul menyalin fungsi penulisan sendiri, bukan memakai helper bersama | Perbaikan di lapisan aman tidak sampai ke pemakainya, dan bug yang sudah ditutup muncul lagi di tempat lain | Ditemukan di `chop`, `mine`, dan `fish`, yang masing-masing punya `addItem()` lokal. Aturan lint sekarang menandai jalur pintasnya, bukan mengandalkan ingatan |
| Berkas ada di disk panel tetapi tidak ada di git | Repo tidak bisa di-boot dari hasil clone, dan satu-satunya salinan kode hilang bila volume panel hilang | Tiga manager sudah ditarik kembali dari commit awal. Pencegahannya: step CI yang memverifikasi seluruh `require` relatif benar-benar ada di dalam git |
| Modul singleton yang melempar error saat di-require | Satu variabel env kosong mematikan seluruh proses, bukan sekadar satu fitur | `aiManager.js` sudah diperbaiki. Aturan umumnya: constructor singleton tidak boleh mendereferensi klien yang bisa gagal dibuat |
| Migrasi data yang menambah nilai ke dirinya sendiri | Kupon setiap pemain berganda bila migrasi terulang | Ledger `schema_migrations` mencatat ID yang sudah dijalankan, dan test menjaga urutan `v5` sebelum `v6` |
| Webhook premium tanpa `timingSafeEqual` dan idempotency | Premium gratis, kebocoran pendapatan | **Selesai** di `webhooks.js` (issue #18, bagian webhook) |
| Cache setting basi hingga 5 menit dan lintas shard | Admin kehilangan kepercayaan pada panel setup | **Selesai** lewat hook model dan kanal `cache:invalidate` (issue #20) |
| Total koneksi database melampaui `max_connections` | Error `Too many connections` yang tampak tidak berhubungan dengan sharding | **Selesai** lewat `DB_POOL_BUDGET` dibagi `TOTAL_SHARDS` |
| Cache discord.js tumbuh mengikuti uptime, bukan beban kerja | RAM panel habis setelah beberapa hari tanpa sebab yang jelas | **Selesai** lewat `Options.cacheWithLimits` dan penyapu di `clientOptions.js`. Pantau apakah batas pesan 100 masih cukup untuk log edit dan hapus |
| Membatasi cache tanpa `keepOverLimit` untuk bot sendiri | Pemeriksaan izin bot gagal sporadis dan sangat sulit dilacak | Entri `client.user` dijaga eksplisit di `GuildMemberManager` dan `UserManager` |
| Payload Container V2 melewati 40 komponen atau 4000 karakter | Seluruh balasan hilang dengan `Invalid Form Body` | **Selesai** lewat `componentBudget.js` di Sprint 1 |
| Penambal prototype `ephemeralPatch.js` | Upgrade discord.js bisa mematahkannya secara senyap | Lint menahan pemakaian baru, log mencatat pemanggil lama, lalu penambal dihapus |
| `SKIP_DB_MIGRATE` dibiarkan menyala di panel | Kolom baru tidak pernah dibuat, transaksi kupon gagal tanpa sebab yang jelas | Hanya untuk keadaan darurat, dan log migrasi menuliskannya dengan huruf besar |
| `.cache/` terhapus setiap restart panel | Slash command dideploy ulang terus dan kena rate limit Discord | Pastikan folder itu ikut volume yang bertahan |
| Lingkup all-in-one terus melebar | Beban maintenance menumpuk ke satu orang | Feature flag default mati, tolak fitur tanpa pemilik |
| Sumber musik YouTube | Risiko ToS dan API yang berubah sepihak | Plugin resmi Lavalink, siapkan fallback |
| Cakupan test masih sangat tipis | Setiap refactor masih taruhan | Tiga berkas test sudah ada, lanjutkan ke logika ekonomi dan XP |
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
