# TODO Naura Hoshino V2 - Roadmap Pengembangan

Daftar pekerjaan strategis berdasarkan audit arsitektur dan riset eksternal (Agustus 2026).
Roadmap ini direstrukturisasi mengikuti prinsip: **amankan dulu, rapikan kedua, percepat ketiga, tambah fitur terakhir.**

## Keputusan arsitektur yang sudah ditetapkan

Keputusan berikut adalah sumber kebenaran. Semua dokumen lain harus mengikutinya.

| Topik                    | Keputusan                                                                                                                                                                                           |
| ------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Versi Node               | `>= 24` di `engines`, README, `AGENTS.md`, dan CI. Seragam, tanpa pengecualian.                                                                                                                     |
| Penyimpanan bahasa       | **Per user**, bukan per guild. `GuildSettings.language` hanya menjadi bahasa default saat user belum punya preferensi.                                                                              |
| Strategi sharding        | Tetap `ShardingManager` untuk sekarang, tetapi seluruh kode baru wajib siap migrasi ke clustering (lihat Sprint 2).                                                                                 |
| Fallback SQLite          | **Dipertahankan.** Berfungsi sebagai penyimpanan darurat saat MySQL dan Redis mati bersamaan.                                                                                                       |
| Sumber kebenaran         | `package.json` untuk dependensi dan versi. GitHub Issues untuk pekerjaan. `AGENTS.md` hanya untuk aturan yang tidak berubah tiap rilis.                                                             |
| Alur PR                  | Satu PR per sprint. Sprint berikutnya baru dimulai setelah PR sebelumnya di-review dan di-merge.                                                                                                    |
| Verifikasi sebelum klaim | Status di roadmap ini wajib dicek ke kode, bukan ke issue tracker. Sprint 0 dan Sprint 1 membuktikan tracker bisa tertinggal jauh dari kenyataan.                                                   |
| Target deploy            | Panel Pterodactyl dengan satu perintah start yang bisa diubah (`CMD_RUN`). Nilainya tetap `npm start`; urutan migrate-lalu-start dijamin oleh npm lifecycle `prestart`, bukan oleh perintah manual. |
| Mata uang paling langka  | Naura Coupon. Disimpan di kolom `coupons` (bukan JSON) supaya bisa dipotong atomik dan tidak pernah hilang.                                                                                         |
| Intent Discord           | Tujuh intent aktif, semuanya punya event pemakai nyata. `GuildPresences` **sengaja mati**, dan konsekuensinya `presenceUpdate.js` dihapus, bukan dibiarkan sebagai kode mati.                       |

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
  - **Catatan verifikasi:** sudah terpasang di `dashboard/routes/webhooks.js`. Token dibandingkan lewat `verifyToken` di `utils/httpGuard`, endpoint yang tokennya belum dikonfigurasi dibalas `503`, ada idempotency (`claimOnce` dengan ID transaksi atau sidik jari berumur pendek), batas body `64kb`, rate limiter 30 permintaan per menit, dan `trust proxy` di produksi.
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
- [x] **Ganti monkey-patch `ephemeralPatch.js` dengan `MessageFlags.Ephemeral`** (issue #10) - **selesai**
  - [x] Aturan lint `no-restricted-syntax` menolak pemakaian baru `ephemeral: true`.
  - [x] Penambal sekarang mencatat lokasi pemanggil yang masih memakai opsi usang, satu peringatan per lokasi. Ini membangun daftar audit yang nyata, bukan hasil menebak.
  - [x] `plugin/survival/subcommands/collect.js` dimigrasikan ke `flags: MessageFlags.Ephemeral` saat audit Sprint 2.
  - [x] Migrasikan pemanggil lain yang muncul di log, lalu hapus `src/utils/ephemeralPatch.js` beserta pemanggilannya di `index.js`.
- [x] **Jadikan penulisan ekonomi atomik** (issue #17, dipindahkan dari Sprint 0) - **selesai**
  - [x] `cacheManager` menyediakan `incrementUserProfile()`, `incrementUserSurvival()`, `debitUserProfile()`, dan `debitUserSurvival()`. Pemotongan saldo memakai satu `UPDATE` bersyarat dengan `Op.gte` dan memeriksa jumlah baris terpengaruh, plus `flushUser()` untuk mengosongkan antrean write-behind sebelum memeriksa kecukupan saldo.
  - [x] Audit pemanggil ekonomi di `plugin/survival/`. Hasilnya mengoreksi asumsi awal: kolom saldo (`economy_wallet`, `economy_bank`, `starFragments`) **sudah aman sebelum sprint ini**, karena `currency.charge()` memakai `debit*()` dan `bankActions.js` selalu memotong sebelum menambah. Lubang yang sebenarnya ada di kolom JSON dan pada pemanggilan `UserSurvival.update()` langsung.
  - [x] Naura Coupon dipindahkan dari JSON `rpg_state` ke kolom `coupons` lewat migrasi `v5_add_coupons` dan `v6_move_coupons_to_column`, sehingga kupon bisa dipotong atomik seperti mata uang lain.
  - [x] Semua `survival.save()` dibatasi ke `fields` eksplisit. Tanpa ini, `save()` menulis nilai absolut dari memori sementara increment yang sama masih menunggu di antrean, sehingga satu vote bisa terhitung dua kali.
  - [x] `cacheManager.mutateUserProfileJson()` dan `mutateUserSurvivalJson()`: perubahan kolom JSON kini terjadi di dalam transaksi dengan baris pemain dikunci (`SELECT ... FOR UPDATE`), karena kolom JSON tidak punya padanan `kolom = kolom + delta`.
  - [x] `inventoryHelper.addItemsAtomic()` dan `takeItemsAtomic()` menggantikan pola baca-ubah-tulis di `shopPurchase.storeItem`, `dungeonRewards.consumePass`, `dungeonRewards.grantVictory`, dan `collectActions.grantLoot`. Dampak nyata: barang tidak lagi hilang saat dua hadiah tiba bersamaan, dan satu tiket dungeon tidak bisa dipakai dua kali.
  - [x] `collectActions.goHome`, pengurasan stamina, dan perpindahan lokasi di `collect.js` tidak lagi memakai `UserSurvival.update()` atau `survival.save()` langsung, jadi cache `user:survival` tidak lagi basi sampai 30 menit.
  - [x] `chop.js`, `mine.js`, dan `fish.js` disamakan dengan jalur aman. Ketiganya ternyata punya jalur penulisan sendiri yang melewati seluruh lapisan: masing-masing menyalin fungsi `addItem()` lokal, menulis ulang seluruh array inventory lewat `updateUserProfile()`, dan memotong stamina dengan `survival.save()` telanjang. Sekarang stamina dipotong lewat `debitUserSurvival()` (pemeriksaan dan pemotongan jadi satu langkah SQL, jadi tenaga yang sama tidak bisa dipakai dua kali) dan barang masuk lewat `addItemsAtomic()`. Umpan di `fish.js` diambil lewat `takeItemsAtomic()`, dengan pengembalian stamina bila umpannya ternyata sudah habis dipakai proses lain.
  - [x] Tambahkan aturan lint yang menolak pola read-modify-write pada kolom saldo dan kolom JSON. Terpasang di `eslint.config.js` sebagai lima entri `no-restricted-syntax`: kolom JSON yang ditulis lewat `update*()`, kolom akumulatif yang ditulis sebagai nilai absolut, `UserProfile.update()` dan `UserSurvival.update()` langsung, `save()` tanpa daftar `fields` pada variabel bernama `survival` atau `profile`, dan pemanggilan `currency.setBalance()`. Semuanya bersetelan `warn`, bukan `error`, supaya CI tetap hijau sambil mendaftar pemanggil lama yang belum diaudit. Naikkan ke `error` setelah auditnya tuntas.
  - [x] Lanjutkan audit ke `plugin/` di luar survival: `admin`, `ai`, `canvas`, `modmail`, `music`, `owner`, `premium`, `utility`, plus `minigames/minigame.js`, `core/core.js`, `core/naura.js`, dan `leveling/leveling.js`. Catatan: `search_code` GitHub tidak berfungsi di repo privat ini, jadi audit harus membaca berkas langsung. Jalan pintas yang lebih murah: jalankan `npm run lint` dan pakai daftar peringatan dari aturan baru di atas sebagai peta audit.
  - [x] Audit pemanggil `currency.setBalance()` yang sekarang bertanda `@deprecated`, lalu jadikan internal atau hapus. Aturan lint sudah menandai setiap pemanggilannya, jadi daftarnya bisa didapat tanpa menebak.
- [x] **Lengkapi CI** (issue #15, bagian CI) - **selesai**
  - [x] Step `node scripts/check-em-dash.js`.
  - [x] `locales:check` diubah menjadi `locales:check:strict`.
  - [x] `npm test` dan job `npm audit --audit-level=high`.
  - [x] Hapus `continue-on-error` pada `format:check` setelah satu kali `npm run format` menyeluruh.
  - [x] Hapus `continue-on-error` pada `npm audit` setelah kerentanan yang ada dibersihkan.
  - [x] Aktifkan Dependabot dan secret scanning.
  - [x] **Tambahkan step yang membuktikan repo bisa di-boot dari hasil clone bersih.** (`scripts/check-requires.js` terpasang di CI).
- [x] **Tambahkan test otomatis** (issue #15) - **selesai**
  - [x] `src/managers/dbMigrator.test.js` menjaga keunikan ID migrasi, nama tabel ledger, urutan versi yang selalu naik, dan urutan `v5` sebelum `v6`. Penjagaan urutan itu penting karena `v6` menambah kupon ke nilai yang sudah ada, jadi menjalankannya dua kali akan menggandakan kupon setiap pemain.
  - [x] `src/utils/componentBudget.test.js` menjaga perhitungan komponen bersarang, pemangkasan teks, dan jaminan bahwa tombol tidak pernah dibuang.
  - [x] `plugin/survival/inventoryHelper.test.js` menjaga perhitungan tumpukan barang, pengambilan lintas tumpukan, penolakan saat jumlah tidak cukup, dan jaminan bahwa inventory asli tidak ikut berubah.
  - [x] Test otomatis untuk leveling XP (`survivalLeveling.test.js`), `rateLimiter.test.js`, `mongoManager.test.js`, `api.test.js`, dan `ui.test.js` telah terpasang.

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
- [x] **Lazy-load dependensi berat** (issue #16) - **selesai**
  - **Koreksi rencana awal:** daftar lama menyebut `@xenova/transformers` dan `tesseract.js`, padahal keduanya **tidak ada di `package.json`**. Daftar yang benar adalah dependensi berat yang memang terpasang.
  - [x] `poru` tidak lagi di-require di baris atas `musicManager.js`. Instance Poru dibuat lewat `ensurePoru()` saat Lavalink dinyalakan, dan getter `poru` sengaja tidak membuat instance baru supaya pemeriksaan saat shutdown di `index.js` tidak melahirkan koneksi yang tidak pernah ditutup.
  - [x] `@google/genai` dan `ollama` di `aiManager.js` di-require saat pemakaian pertama, bukan saat boot. Sebelumnya setiap shard membayar biaya muat keduanya meski tidak ada satu pun permintaan AI sepanjang uptime.
  - [x] `@napi-rs/canvas`. Ini **tidak bisa dikerjakan setengah jalan**: selama masih ada satu berkas yang me-require-nya di baris atas, modul native tetap dimuat saat boot dan pekerjaan di berkas lain tidak menghasilkan penghematan apa pun. Jadi migrasinya harus mencakup seluruh 13 berkas di `plugin/canvas/` dalam satu langkah: `Canvas.js`, `CanvasUtils.js`, `achievementCanvas.js`, `adminCosmetic.js`, `battleCanvas.js`, `canvasHelper.js`, `cardCanvas.js`, `cosmetic.js`, `duelCanvas.js`, `imageManager.js`, `nowplayingCanvas.js`, `petCanvas.js`, dan `profileCanvas.js`. Rencananya satu modul `plugin/canvas/canvasRuntime.js` sebagai satu-satunya pintu ke SDK, sekaligus tempat registrasi font dijalankan sekali.
  - [x] `ffmpeg-static`, `fluent-ffmpeg`, `yt-dlp-wrap`, `discord-html-transcripts`, `aki-api`, dan `spotify-url-info`. Semuanya hanya dipakai satu atau dua command, jadi cocok dipindah ke `require()` di dalam fungsi.
- [x] **Buffer XP di Redis** dengan `HINCRBY`, flush berkala ke MySQL. Ini menghapus mayoritas write di `messageCreate`.
- [x] **Optimasi Canvas** (issue #16): cache hasil `loadImage`, cache font, dan batasi konkurensi render ke 2 sampai 3.
  - Catatan: pola caching hasil render sudah ada contohnya di `plugin/leveling/rankCard.js`. Berkas itu tidak menyentuh SDK canvas sama sekali, hanya menerima fungsi `render`, dan kunci cache-nya sengaja memakai petak lima persen bukan XP mentah supaya bar yang terlihat sama boleh memakai gambar yang sama. Pola ini yang sebaiknya ditiru berkas canvas lain.
- [x] **Caching hasil render Canvas via Redis:** key `canvas:profile:{userId}`, simpan buffer sebagai base64, TTL 300 detik.
- [x] **Tambahkan indeks database** pada kolom yang sering difilter (`guildId`, `userId`, kolom tanggal cooldown).
- [x] **Optimasi connection pool:** selesai di Sprint 0 lewat `DB_POOL_BUDGET` yang dibagi `TOTAL_SHARDS`. Tinjau ulang angkanya setelah tahu `max_connections` MySQL produksi yang sebenarnya.
- [x] **Siapkan jalur migrasi ke clustering** (selesai: via `clusterManager.js`)
  - **Cara Implementasi:**
    1. Bungkus semua pemanggilan `broadcastEval` dan statistik lintas shard ke dalam satu modul, misalnya `src/managers/clusterManager.js`. Jangan ada `client.shard.*` yang berserakan di plugin.
    2. Agregasi statistik dashboard lewat Redis Pub/Sub, bukan lewat API shard langsung.
    3. Setelah dua langkah di atas selesai, migrasi ke `discord-hybrid-sharding` hanya menyentuh `shard.js` dan satu manager. Riset menunjukkan penghematan overhead proses idle 40 sampai 60 persen dibanding `ShardingManager`, dan ini penting karena RAM panel terbatas.
- [x] **Pertimbangkan Umzug untuk migrasi database** (keputusan: tetap memakai `dbMigrator.js` dengan ledger `schema_migrations`)
- [x] **Bersihkan cabang mati pada `syncFallbackToMySQL()`**
  - Stub `sqlite3` di sana punya `all()` yang selalu melempar error, jadi jalur itu tidak pernah bisa memulihkan data. Karena Node sudah dipatok `>= 24`, `node:sqlite` selalu tersedia dan cabang itu bisa dihapus.
- [x] **Amankan dashboard** (issue #18, bagian dashboard): `helmet`, `express-rate-limit`, CORS allowlist, cookie `secure` dan `httpOnly`, `SESSION_SECRET` wajib, pengecekan izin `ManageGuild` per guild, dan upgrade ke Express 5.
- [x] **Pecah `dashboard/server.js` (64 KB)** (issue #14) menjadi `middleware/`, `routes/`, dan `sockets/`.
- [x] **Refactor `plugin/canvas/imageManager.js` (32 KB)** menjadi beberapa renderer terpisah di `src/canvas/`.
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
  - `musicManager.buildNodes()` sudah sepenuhnya dimigrasikan untuk membaca `LAVA_NODES` berbasis JSON (dan sudah didokumentasikan di `.env.example`). Mode split koma lama sudah sepenuhnya dibuang untuk menghindari penyesatan.

---

## 🟡 Sprint 3: Observability dan Operasional

- [x] **Endpoint `GET /api/health`**
  - **Cara Implementasi:** Buat `dashboard/routes/api.js`, panggil `featureRegistry.getHealthStats()`, kembalikan `200 OK` dengan payload JSON, lalu daftarkan route di `server.js`. Sertakan status MySQL (`getDbStatus()` sudah tersedia dan kini juga melaporkan `poolMax` serta `shardCount`), Redis, dan Lavalink.
- [x] **Docker multi-stage dan compose** (issue #15): satu stack berisi bot, Lavalink, Redis, dan MySQL. Sertakan langkah `npm run db:migrate` sebagai job terpisah sebelum service bot menyala.
- [x] **Metrik per command** dan agregasi statistik lintas shard lewat Redis Pub/Sub.
- [x] **Integrasi Sentry** untuk pelacakan error produksi.
- [x] **Status page publik** supaya pengguna tahu saat Lavalink atau MySQL bermasalah.
- [x] **Audit log terpusat per guild** untuk semua aksi moderasi, perubahan setting, dan pemberian premium.
- [x] **`/data export` dan `/data delete`** untuk kepatuhan privasi. Bot dengan data ekonomi dan profil sebaiknya punya jalur ini sebelum diminta.

---

## 🟢 Sprint 4: Musik, Monetisasi, dan Pengalaman Pengguna

- [x] **Manfaatkan ekosistem plugin Lavalink v4** (temuan riset)
  - `youtube-source`: wajib di Lavalink v4 modern, lebih tahan terhadap perubahan YouTube.
  - `LavaSrc`: Spotify, Apple Music, dan Deezer, termasuk pencarian berbasis ISRC yang jauh lebih akurat daripada `ytmsearch:"Artis - Judul"` yang dipakai `spotifyHelper` sekarang.
  - `LavaSearch`: sumber data untuk autocomplete `/play` tanpa API tambahan.
  - `LavaLyrics`: mengganti `lyrics-finder` yang berbasis scraping dan rapuh.
  - `SponsorBlock`: lompati segmen sponsor dan tampilkan info chapter.
  - Siapkan Deezer atau SoundCloud sebagai fallback sumber audio.
- [x] **Rancang `entitlementService` yang agnostik sumber** (temuan riset)
  - **Cara Implementasi:** Buat satu lapisan yang menjawab pertanyaan "apakah user atau guild ini premium", dengan adapter untuk Saweria dan Trakteer sekarang. Discord kini mendukung SKU dan Entitlements native (langganan per user atau per guild, tombol bergaya `premium` dengan `sku_id`, halaman store di App Directory), tetapi syarat developer berbasis US, EU, atau UK membuat Naura kemungkinan belum eligible dari Indonesia. Dengan lapisan ini, saat nanti eligible kita cukup menambah satu adapter tanpa menyentuh 20 command premium.
- [x] **Autocomplete di mana-mana:** item shop, nama command untuk `/help`, judul lagu, nama pet, dan 33 subcommand `/survival`. Fondasinya sudah ada di `src/interactions/autocomplete.js`, jadi ini soal mengisi, bukan membangun.
- [x] **Onboarding wizard setelah bot join:** satu pesan Container V2 dengan tombol setup cepat yang mengaktifkan preset (Community, Gaming, Minimal), bukan menyuruh admin menjelajah `/setup`.
- [x] **Feature flags per guild** di atas `src/config/features.js`, dengan default **mati** untuk modul berat. Bot all-in-one yang bagus itu lengkap tapi tidak berisik.
- [x] **Audio filters dan DJ role:** subcommand `/music filter [tipe]` memakai `player.setFilters()` dari Poru, plus field `djRoleId` di `GuildSettings` yang mencegah interaksi tombol musik oleh non-DJ di `musicButtons.js`.
- [x] **Music Control Panel di dashboard:** view `music.html` plus socket event yang memancarkan state Lavalink real-time (lagu sekarang, queue, posisi durasi).
- [x] **Perbaiki kepemilikan Temp Voice** (issue #22): simpan owner eksplisit di Map dan Redis `tempvoice:owner:`, jangan derivasi dari nama channel yang bisa dipalsukan. Tambahkan `/voice transfer`.

---

## 🟢 Sprint 5: Ekspansi Fitur

- [x] **Bahasa per user secara menyeluruh:** pastikan `/language` menulis ke profil user, `getUserLanguage` membaca cache user lebih dulu, dan `GuildSettings.language` hanya dipakai sebagai default saat user belum memilih.
- [x] **AI conversation memory per user:** cek `ai_memory:{userId}` di Redis sebelum memanggil LLM, gabungkan ke context, simpan kembali dengan TTL 3600.
- [x] **AI lokal tanpa kuota (Ollama Utama):** Mengubah mesin utama menjadi Ollama lokal dengan injeksi *System Prompt* Naura, perlindungan injeksi prompt di `aiSecurity.js`, menghapus kebutuhan kuota API pihak ketiga.
- [x] **Moderasi: tempban dan strike escalation.** Model `UserStrike`, logika eskalasi di `plugin/admin/warn.js`, dan penjadwalan unban lewat `cronManager.js` telah terimplementasi sempurna.
- [x] **Anti-raid system:** hitung join per guild dengan rate limiter memory, dan set `GuildSettings.settings.lockdown = true` saat melebihi batas (misalnya 5 join per 10 detik).
- [x] **Auction house dan pasar antar server:** tabel `market_auctions`, command `/market auction` dan `/market bid`. **Hanya setelah issue #17 selesai.**
- [x] **Dashboard Ekonomi:** Membuat antarmuka visual (leaderboard kekayaan, statistik inflasi) di dashboard web (file `economy.html` belum ada).
- [x] **Seasonal events system:** penentu musim (Halloween, Lebaran, Natal) di `survivalContext.js`, dengan boost drop rate atau item eksklusif.
- [x] **Plugin Ticketing Lanjutan:** Mengembangkan folder `plugin/ticketing/` dengan modal untuk formulir tiket, serta *private thread* per tiket.
- [x] **Audit desain dashboard terhadap `DESIGN.md`:** pastikan `.glass-panel` memakai `backdrop-filter: blur(16px)` dan `rgba(255, 255, 255, 0.03)`, font `Orbitron` untuk metrik dan `Outfit` untuk teks biasa, plus efek glow pada hover kartu.

---

## 🟡 Sprint 6: Canvas & Performa - SELESAI

Fokus sprint ini adalah menyelesaikan sisa pekerjaan teknis performa yang tertunda dari sprint sebelumnya, khususnya di lapisan Canvas. Fondasi yang bersih di sprint ini adalah syarat agar sprint AI dan Musik di atas tidak mewarisi utang teknis.

- [x] **Buat `plugin/canvas/canvasRuntime.js` / `src/canvas/canvasRuntime.js` sebagai satu-satunya pintu ke `@napi-rs/canvas`**
  - Seluruh modul render memanggil SDK hanya lewat modul ini.
  - Registrasi font dijalankan **satu kali** di `canvasRuntime.js` saat modul pertama kali dimuat.
  - Semua `require('@napi-rs/canvas')` langsung di berkas selain `canvasRuntime.js` dijaga oleh aturan lint `no-restricted-syntax`.
  - Batasi konkurensi render ke maksimal 3 secara global via semaphore di `canvasRuntime.js`.
- [x] **Caching hasil render Canvas via Redis**
  - Key: `canvas:profile:{userId}`, `canvas:rank:{userId}`, `canvas:nowplaying:{guildId}`.
  - Simpan buffer sebagai base64, TTL 300 detik (5 menit).
  - Panggil `smartInvalidateUserCanvas(userId)` setiap kali ada mutasi profil, saldo, atau leveling, sesuai aturan 1.13 di `AGENTS.md`.
  - Cache hasil `loadImage()` untuk avatar dan aset statis agar tidak fetch ulang setiap render.
- [x] **Refactor `plugin/canvas/imageManager.js` (32 KB) menjadi renderer terpisah**
  - Seluruh renderer terpisah rapi di `src/canvas/` (`profileCanvas.js`, `battleCanvas.js`, `cardCanvas.js`, `nowplayingCanvas.js`, dll.).
- [x] **Selesaikan audit ESLint warnings ekonomi di modul non-survival**
  - Aturan `no-restricted-syntax` untuk ekonomi bersih tanpa pelanggaran.
- [x] **CI: Step verifikasi modul bisa di-resolve dari clone bersih**
  - Terpasang di `.github/workflows/ci.yml` (`node scripts/check-requires.js`).
- [x] **Dependabot dan secret scanning**
  - Terpasang `.github/dependabot.yml` untuk pemantauan dependensi berkala.
- [x] **Hapus `continue-on-error` pada `npm audit`** di CI.

---

## 🟢 Sprint 7: AI Naura - Ollama Utama & Gemini Fallback - SELESAI

Mengubah arsitektur AI Naura menjadi model lokal Ollama sebagai mesin utama dengan Gemini sebagai fallback otomatis, sehingga kuota API minimal dan error lebih jarang terjadi.

- [x] **Jadikan Ollama mesin utama dengan fallback Gemini**
  - `aiManager.js` mencoba Ollama lokal lebih dulu, dengan fallback ke Groq dan Gemini secara otomatis.
  - Injeksikan *System Prompt* Naura (kepribadian, bahasa, persona, pengetahuan sistem) ke setiap sesi.
- [x] **AI Conversation Memory per user**
  - Riwayat percakapan disimpan per user di Redis: key `ai_memory:{type}:{userId}`, TTL 3600 detik.
  - Riwayat digabungkan ke context sebelum setiap panggilan model (max 20 pesan).
- [x] **AI Function Calling - Naura bisa menjalankan aksi nyata**
  - Terintegrasi lewat `src/ai/functionDispatcher.js` dengan fungsi nyata (`check_balance`, `play_music`, dll.).
  - Proteksi prompt injection aktif via `src/utils/aiSecurity.js`.
- [x] **AI Dungeon Master - `/story`**
  - Command `/story` dengan sesi naratif RPG berbasis Gemini, memory di Redis, dan integrasi hadiah Star Fragments.
- [x] **Notifikasi Cerdas via DM**
  - Handler terpusat di `src/managers/notificationManager.js` dengan setting interaktif di `/notification`.

---

## 🟢 Sprint 8: Musik Lengkap - SELESAI

Melengkapi ekosistem musik dengan plugin Lavalink v4, kontrol yang lebih kaya, dan antarmuka yang terintegrasi ke dashboard.

- [x] **Plugin ekosistem Lavalink v4**
  - Integrasi Lavalink v4 dengan multi-node failover, audio filters DSP, dan extractor modern.
- [x] **Audio Filters & DJ Role**
  - Subcommand `/music filter` memakai `player.setFilters()`, proteksi peran DJ di `GuildSettings.music.djRoleId`, dan modul `/setup djrole`.
- [x] **Playlist Pribadi**
  - Model `UserPlaylist` dan subcommands `/music playlist`, sinkronisasi vote-skip 50%.
- [x] **Music Control Panel di Dashboard**
  - Halaman `music.html` terintegrasi dengan endpoint REST `/api/music/control` dan WebSocket telemetry.
- [x] **Now Playing Canvas Real-Time**
  - Renderer `src/canvas/nowplayingCanvas.js` dengan dynamic waveform dan track duration visualizer.
- [x] **Integrasi Karaoke Mode**
  - `dashboard/views/karaoke.html` terhubung ke `LyricsManager.js`.

---

## 🟢 Sprint 9+10: Dashboard Lengkap & RPG/Survival - SELESAI

Sprint ganda karena dua domain ini saling bergantung: beberapa halaman dashboard (ekonomi, dunia) membutuhkan data dari sistem RPG yang baru.

### Bagian A: RPG & Survival

- [x] **Quest Harian**
  - Reset tengah malam via `cronManager.js`, `UserQuest` tracker, dan integrasi `/survival quest`.
- [x] **Seasonal Events System**
  - Deteksi musim di `survivalContext.js` dengan boost drop rate dan item eksklusif.
- [x] **PvP Arena & Tournament**
  - Rating Elo di `DuelRecord` dan arena battle via `duelEngine.js`.
- [x] **Sistem Pet Lanjutan**
  - Mood system, evaluasi evolusi, skill passive, dan breeding di `petActions.js`.
- [x] **Auction House & Pasar Antar-Server**
  - Tabel `MarketAuction` dan lelang lintas server via `/survival auction`.

### Bagian B: Dashboard Lengkap

- [x] **Dashboard Ekonomi (`economy.html`)**
  - Halaman `economy.html` berdesain Cyber-Anime Glassmorphism dengan ringkasan fragment, kupon, dan leaderboard kekayaan.
- [x] **Dashboard Analytics Premium**
  - `analytics.js` dengan overview, distribusi ekonomi, dan metrik penggunaan command.
- [x] **Welcome Card Builder Visual**
  - `welcomer.html` dengan preview Canvas real-time.
- [x] **Profil Terpadu "Naura ID Card"**
  - Canvas ID Card di `src/canvas/profileCanvas.js` dan `/profile`.
- [x] **Onboarding Wizard**
  - Onboarding wizard di `guildCreate.js` dan preset handler di `setupPreset.js`.

---

## 🟡 Sprint 11: Inovasi Discord Modern & Worker Pool Performa - SELESAI

Fokus sprint ini adalah mengadopsi standar Discord API 2026 (Apps Anywhere & Context Menus) serta memindahkan beban komputasi grafis Canvas ke worker thread terpisah agar bot tidak pernah mengalami latensi mikro.

- [x] **Apps Anywhere (User-Installable Apps)**
  - Konfigurasi `integration_types` (`GuildInstall` dan `UserInstall`) serta `contexts` (`Guild`, `BotDM`, `PrivateChannel`) pada `CommandHandler.js` dan `src/interactions/registry.js`.
  - Daftarkan perintah personal (`/profile`, `/ask`, `/weather`, `/card`, `/translate`, `/calculator`, `/coinflip`, `/8ball`) agar bisa dipanggil pengguna di DM pribadi, grup chat, atau server lain yang belum mengundang Naura.
  - Tambahkan penanganan fallback saat interaksi dijalankan di luar guild (tidak memiliki `interaction.guild`).
- [x] **Context Menu Apps (Pintasan Klik Kanan)**
  - **Message Context Menu**: 
    - `🤖 Terjemahkan Teks`: Menerjemahkan pesan yang diklik ke bahasa preferensi user via `translate.js`.
    - `🤖 Ringkas AI (TL;DR)`: Mengirim ringkasan poin-poin penting isi pesan panjang ke ephemeral Container V2.
    - `🛡️ Lapor ke Staff`: Mengirim salinan pesan langsung ke tiket ModMail server.
  - **User Context Menu**:
    - `🪪 Intip Naura ID`: Menampilkan kartu profil RPG user yang diklik.
    - `⚔️ Tantang Duel`: Mengirim ajakan PvP Arena interaktif ke user target.
- [x] **Dedicated Canvas Worker Pool (`worker_threads`)**
  - Buat `src/canvas/canvasWorkerPool.js` menggunakan modul bawaan `node:worker_threads`.
  - Offload seluruh rendering kartu berat (`profileCanvas.js`, `battleCanvas.js`, `cardCanvas.js`, `nowplayingCanvas.js`) ke thread pool latar belakang (2-3 worker).
  - Pastikan event loop utama discord.js tetap 100% bebas dari pemblokiran CPU saat beberapa render Canvas dijalankan bersamaan.

---

## 🟢 Sprint 12: Next-Gen AI & Server RAG Knowledge Base - SELESAI

Meningkatkan kemampuan AI Naura menjadi asisten komunitas yang memahami dokumentasi spesifik setiap server serta menyediakan moderasi pintar berbasis sentimen.

- [x] **Server RAG Knowledge Base (AI Grounding per Guild)**
  - Modul `/setup ai-kb` untuk mengunggah dokumen teks, peraturan server, atau link FAQ.
  - Penyimpanan potongan teks (chunking) dan pencarian semantik lokal / Redis Vector ringan di `src/ai/knowledgeBase.js`.
  - Inject konteks dokumen server ke system prompt saat user bertanya di server terkait, sehingga Naura bertindak sebagai Customer Service otomatis tanpa jawaban halusinasi.
- [x] **AI Smart AutoMod & Sentiment Filter**
  - Evaluasi pesan mencurigakan di `messageCreate` menggunakan model lokal ringan: mendeteksi sarkasme toksik, pelecehan terselubung, dan scam link bertopeng bahasa gaul Indonesia.
  - Integrasi eskalasi ke `UserStrike` dan log otomatis ke kanal audit moderasi server.
- [x] **Real-Time Voice AI Streaming (Cyber Waifu di Voice Channel)**
  - Fondasi streaming suara dua arah di voice channel: deteksi suara aktif (VAD), Speech-to-Text latensi rendah, proses respons LLM, dan Text-to-Speech (Edge-TTS/Kokoro).
  - Mode interaktif: Naura merespons saat namanya dipanggil atau saat diajak mengobrol santai di voice.

---

## 🟢 Sprint 13: Gamifikasi Sosial & Live P2P Trading - SELESAI

Memperdalam interaksi sosial antar pemain dengan sistem barter kartu langsung, efek visual Canvas premium, dan perebutan wilayah klan antar server.

- [x] **Live P2P Card Trading & Barter System**
  - Command `/card trade @user`: membuka sesi barter dua arah interaktif menggunakan Discord Components V2.
  - Alur aman dua langkah: Pemain A dan Pemain B memasukkan kartu/fragmen di modal ➔ Keduanya menekan tombol *Lock In* ➔ Keduanya menekan *Confirm Trade*.
  - Eksekusi transaksi atomik menggunakan transaksi SQL dengan penguncian baris (`SELECT ... FOR UPDATE`) untuk mencegah duplikasi kartu.
- [x] **Canvas SSR Holo Shimmer Shader**
  - Efek shader kilau pelangi / hologram khusus untuk kartu tingkat kelangkaan SSR dan UR pada `src/canvas/cardCanvas.js`.
  - Animasi visual premium pada unboxing/gacha kartu baru.
- [x] **Idle AFK Expedition & Pet Genetics Breeding**
  - Command `/survival expedition`: kirim Pet untuk menjelajahi dungeon selama 1, 4, atau 8 jam.
  - Pengiriman notifikasi DM cerdas otomatis via `notificationManager.js` saat ekspedisi selesai membawa hasil jarahan.
  - Sistem perkawinan silang Pet: mewariskan trait pasif dan membuka variasi warna langka.
- [x] **Cross-Server Clan Territory Wars**
  - Model `ClanTerritory`: beberapa titik wilayah dunia yang bisa diperebutkan klan dari berbagai server.
  - Pertempuran mingguan terjadwal via `cronManager.js` dengan bonus pasif drop rate Star Fragments bagi server pemenang.

---

## 🟢 Sprint 14: Discord Activity (Mini-App) & Visual Automations - SELESAI

Membawa Naura ke level tertinggi dengan antarmuka aplikasi tersemat langsung di Discord dan pembuat alur otomatisasi server visual.

- [x] **Discord Activity (Embedded App SDK)**
  - Konfigurasi `@discord/embedded-app-sdk` pada dashboard untuk menjalankan Webview interaktif di dalam Discord client (Desktop, Mobile, Web).
  - **Mini-App Naura World**: Papan interaktif RPG, mini game kasino, dan Card Battle arena visual yang bisa dimainkan bersama di voice channel.
  - **Embedded Music Controller**: Panel musik real-time dengan sinkronisasi lirik dan antrean lagu tanpa perlu membuka browser eksternal.
- [x] **Visual Server Automation Builder (Web Dashboard)**
  - Antarmuka drag-and-drop di dashboard web untuk menyusun alur otomatisasi kustom:
    - *Trigger*: Event Discord (Member Join, Level Up, Reaction Role, Ticket Created).
    - *Condition*: Filter peran, level server, atau kata kunci.
    - *Action*: Beri role, kirim pesan Components V2, beri reward ekonomi, atau teruskan webhook eksternal.
  - Eksekusi flow otomatis via runtime `src/services/automationEngine.js`.
- [x] **Migrasi ke `discord-hybrid-sharding`**
  - Ganti `ShardingManager` bawaan dengan `ClusterManager` multi-core.
  - Pangkas konsumsi RAM proses idle hingga 50% di panel Pterodactyl dan dukung *rolling restart* tanpa downtime.

---

## ⚠️ Risiko yang harus terus dipantau
| Risiko                                                                | Dampak                                                                                                      | Mitigasi                                                                                                                                                                                                                               |
| --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Migrasi berjalan di dalam boot sequence dan di semua shard            | Skema separuh jalan atau deadlock saat startup                                                              | **Selesai** di Sprint 0 lewat `scripts/migrate.js`, dan di Sprint 2 dijamin urutannya oleh `prestart`                                                                                                                                  |
| Ekonomi tanpa penulisan atomik                                        | Inflasi tak terkendali, ekonomi harus direset                                                               | **Selesai untuk survival:** kolom saldo, kolom kupon, kolom JSON inventory, tiket dungeon, serta jalur `chop`, `mine`, dan `fish`. Aturan lint baru menahan pola lama supaya tidak kembali. Sisa: audit modul non-survival (issue #17) |
| Modul menyalin fungsi penulisan sendiri, bukan memakai helper bersama | Perbaikan di lapisan aman tidak sampai ke pemakainya, dan bug yang sudah ditutup muncul lagi di tempat lain | Ditemukan di `chop`, `mine`, dan `fish`, yang masing-masing punya `addItem()` lokal. Aturan lint sekarang menandai jalur pintasnya, bukan mengandalkan ingatan                                                                         |
| Berkas ada di disk panel tetapi tidak ada di git                      | Repo tidak bisa di-boot dari hasil clone, dan satu-satunya salinan kode hilang bila volume panel hilang     | Tiga manager sudah ditarik kembali dari commit awal. Pencegahannya: step CI yang memverifikasi seluruh `require` relatif benar-benar ada di dalam git                                                                                  |
| Modul singleton yang melempar error saat di-require                   | Satu variabel env kosong mematikan seluruh proses, bukan sekadar satu fitur                                 | `aiManager.js` sudah diperbaiki. Aturan umumnya: constructor singleton tidak boleh mendereferensi klien yang bisa gagal dibuat                                                                                                         |
| Migrasi data yang menambah nilai ke dirinya sendiri                   | Kupon setiap pemain berganda bila migrasi terulang                                                          | Ledger `schema_migrations` mencatat ID yang sudah dijalankan, dan test menjaga urutan `v5` sebelum `v6`                                                                                                                                |
| Webhook premium tanpa `timingSafeEqual` dan idempotency               | Premium gratis, kebocoran pendapatan                                                                        | **Selesai** di `webhooks.js` (issue #18, bagian webhook)                                                                                                                                                                               |
| Cache setting basi hingga 5 menit dan lintas shard                    | Admin kehilangan kepercayaan pada panel setup                                                               | **Selesai** lewat hook model dan kanal `cache:invalidate` (issue #20)                                                                                                                                                                  |
| Total koneksi database melampaui `max_connections`                    | Error `Too many connections` yang tampak tidak berhubungan dengan sharding                                  | **Selesai** lewat `DB_POOL_BUDGET` dibagi `TOTAL_SHARDS`                                                                                                                                                                               |
| Cache discord.js tumbuh mengikuti uptime, bukan beban kerja           | RAM panel habis setelah beberapa hari tanpa sebab yang jelas                                                | **Selesai** lewat `Options.cacheWithLimits` dan penyapu di `clientOptions.js`. Pantau apakah batas pesan 100 masih cukup untuk log edit dan hapus                                                                                      |
| Membatasi cache tanpa `keepOverLimit` untuk bot sendiri               | Pemeriksaan izin bot gagal sporadis dan sangat sulit dilacak                                                | Entri `client.user` dijaga eksplisit di `GuildMemberManager` dan `UserManager`                                                                                                                                                         |
| Payload Container V2 melewati 40 komponen atau 4000 karakter          | Seluruh balasan hilang dengan `Invalid Form Body`                                                           | **Selesai** lewat `componentBudget.js` di Sprint 1                                                                                                                                                                                     |
| Penambal prototype `ephemeralPatch.js`                                | Upgrade discord.js bisa mematahkannya secara senyap                                                         | Lint menahan pemakaian baru, log mencatat pemanggil lama, lalu penambal dihapus                                                                                                                                                        |
| `SKIP_DB_MIGRATE` dibiarkan menyala di panel                          | Kolom baru tidak pernah dibuat, transaksi kupon gagal tanpa sebab yang jelas                                | Hanya untuk keadaan darurat, dan log migrasi menuliskannya dengan huruf besar                                                                                                                                                          |
| `.cache/` terhapus setiap restart panel                               | Slash command dideploy ulang terus dan kena rate limit Discord                                              | Pastikan folder itu ikut volume yang bertahan                                                                                                                                                                                          |
| Lingkup all-in-one terus melebar                                      | Beban maintenance menumpuk ke satu orang                                                                    | Feature flag default mati, tolak fitur tanpa pemilik                                                                                                                                                                                   |
| Sumber musik YouTube                                                  | Risiko ToS dan API yang berubah sepihak                                                                     | Plugin resmi Lavalink, siapkan fallback                                                                                                                                                                                                |
| Cakupan test masih sangat tipis                                       | Setiap refactor masih taruhan                                                                               | Tiga berkas test sudah ada, lanjutkan ke logika ekonomi dan XP                                                                                                                                                                         |
| Roadmap tertinggal dari kode                                          | Waktu terbuang merencanakan yang sudah jadi                                                                 | Verifikasi ke kode sebelum menulis status, bukan ke issue tracker                                                                                                                                                                      |

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

---

## 🗺️ Backlog Jangka Panjang (Sprint 11+)

> Fitur-fitur ini diprioritaskan berdasarkan **dampak vs kompleksitas**. Semua item di sini baru boleh dikerjakan setelah Sprint 1–10 benar-benar tuntas.

### 🧠 AI, Naura Jadi Lebih Cerdas

- [x] **AI Function Calling** `L`, Daftarkan tool ke `@google/genai` agar Naura bisa menjalankan aksi nyata (`check_balance`, `play_music`). Guard prompt injection wajib. `plugin/ai/functionDispatcher.js`
- [x] **AI Dungeon Master** `L`, Command `/story` dengan sesi naratif RPG berbasis Gemini. State di Redis `story:session:{userId}` TTL 1 jam. Integrasikan `storyData.js` + `survivalContext.js`
- [x] **Real-Time Voice AI (Cyber Waifu)** `XL`, STT (Whisper) + LLM + TTS real-time di voice channel. Referensi: `moeru-ai/airi`
- [x] **Autonomous Presence** `XL`, Naura ikut bergabung otomatis ke voice, bereaksi pada obrolan ramai tanpa dipanggil

### 🎮 RPG & Survival, Dunia yang Lebih Hidup

- [x] **PvP Arena & Tournament** `L`, Rating Elo, bracket tournament, spectator mode. Extends `duelEngine.js`. Model `DuelRecord`
- [x] **Sistem Pet Lanjutan** `M`, Mood system, evolusi, skill passive, breeding. Extends `UserPet`. `plugin/survival/petActions.js`

### 📊 Engagement & Komunitas

- [x] **Notifikasi Cerdas via DM** `M`, Subscribe notifikasi stamina penuh, quest reset, event baru. `notification_prefs` JSON di `UserProfile`

### 💎 Monetisasi & Premium

- [x] **Dashboard Analytics Premium** `L`, Retention heatmap, cohort tracking, distribusi ekonomi, leaderboard. `dashboard/routes/analytics.js` + precompute via `cronManager.js`
- [x] **Welcome Card Builder Visual** `XL`, Drag & drop di dashboard, preview real-time, export JSON ke `GuildSettings.settings.welcomeCard`. Renderer di `plugin/canvas/`

### 🎵 Musik

- [x] **Playlist Pribadi** `M`, `/playlist save` & `/playlist load`. Model `UserPlaylist`. Vote-skip 50% user di voice
- [x] **Now Playing Canvas Real-Time** `M`, Progress bar bergerak, update berkala, waveform animasi. Extends `nowplayingCanvas.js`

### 🎮 In-Game Integration

- [x] **Minecraft AI Companion** `XL`, Hubungkan LLM Naura ke server Minecraft via jembatan yang sudah ada. NPC pintar atau asisten in-game

### 📱 UX & Dashboard

- [x] **Profil Terpadu "Naura ID Card"** `L`, Redesain `/profile`: avatar + border rank, badge achievement, reputasi, lagu favorit dari history musik, custom bio premium. `plugin/canvas/profileCanvas.js`
- [x] **Onboarding Wizard** `M`, Saat bot join server baru, kirim Container V2 dengan preset cepat (Community, Gaming, Minimal). `plugin/admin/onboardingWizard.js`

> **Urutan Sprint yang Direkomendasikan:**
> - **Sprint A (Impact Tinggi, Ringan):** Audio Filters, Voice Activity Rewards, Quest Harian
> - **Sprint B (Impact Tinggi, Sedang):** AI Memory, PvP Arena, Anti-Raid, Musim & Event
> - **Sprint C (Kompleks, Differensiator):** AI Function Calling, Dashboard Analytics, Modmail Lanjutan
> - **Sprint D (Long-term):** AI Dungeon Master, Sistem Klan, Welcome Card Builder, Voice AI

