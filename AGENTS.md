# Panduan Agen OpenCode - Naura Hoshino V2

Panduan ini berisi jebakan dan sumber kebenaran yang mudah terlewat. Untuk kebutuhan produk baca `PRD.md`, aturan teknis baca `RULES.md`, desain UI baca `DESIGN.md`, dan backlog baca `TODO.md`.

## Runtime dan entrypoint

- Gunakan Node.js `>=24` dan CommonJS untuk bot/server Node (`require`, `module.exports`). Frontend Vite di `dashboard/src` dan `dashboard/mobile/src` adalah ESM.
- Entry point produksi adalah `shard.js`; `index.js` membuat client per shard, memuat command/event, mendaftarkan service container, dan menjalankan dashboard hanya pada shard utama.
- Konfigurasi environment hanya dibaca melalui `src/config/env.js`. Jangan menambah `process.env.*` di modul lain.
- Jangan mengubah versi di tempat lain secara manual. `package.json` adalah SSOT versi; jalankan pemeriksaan paritas setelah perubahan versi.
- Jangan menjalankan `npm start` atau `npm run dev` di working tree deployment dengan `AUTO_UPDATE=1`: `scripts/ensure-build.js` dapat melakukan fetch dan `git checkout -f -B`.

## Perintah kerja

```bash
npm ci                         # instalasi reproducible
npm run dev                    # ensure-build lalu bot dengan node --watch
npm start                      # ensure-build, migrasi, warmup cache, lalu shard bot
npm run start:no-migrate       # hanya bila melewati migrasi memang disengaja
npm run db:migrate             # migrasi satu proses sebelum menjalankan shard
npm run build                  # generate token CSS, build dashboard dan mobile
npm run dashboard:dev          # build CSS lalu Vite dashboard
npm run dashboard:build        # build dashboard production
npm run mobile:build           # build mobile dashboard
```

- `npm start` menjalankan `prestart`: `ensure-build.js`, `scripts/migrate.js`, lalu `scripts/warmup-cache.js`.
- Migrasi skema bernomor berada di `src/managers/dbMigrator.js`, saat ini sampai v50. Tambahkan migrasi di bagian bawah daftar dan lengkapi `sql` serta `pgSql` untuk setiap migrasi baru. Jangan memakai `ALTER TABLE` di model.
- `SKIP_DB_MIGRATE=1` adalah pintu darurat untuk boot di atas skema lama, bukan konfigurasi normal.

## Verifikasi

```bash
npm run lint
npm run format:check
node scripts/check-em-dash.js
npm run locales:check:strict
npm run test:requires
npm run test:inline-scripts
npm run test:secrets
npm run verify:drift
npm test
npm run qa
```

- `npm run qa` menjalankan 9 tahap secara berurutan: lint, em dash, locale, versi, require graph, inline script, secret scan, drift, lalu seluruh test.
- Untuk satu test Node: `node --test --test-timeout=60000 path/to/file.test.js`.
- Untuk test dashboard Vitest: `npx vitest run dashboard/tests/path/to/file.test.js`. Konfigurasi Vitest hanya mencakup `dashboard/tests` dan memakai `jsdom`.
- Untuk satu Playwright test: `npx playwright test path/to/file.spec.js`.
- CI memakai Node 24, `npm ci`, `npm run format:check`, `npm run lint`, `npm test`, locale check, require check, dan `npm audit --audit-level=high`.
- Jangan menyatakan QA hijau jika salah satu tahap gagal atau timeout; laporkan tahap dan perintah yang gagal.

## Batas arsitektur

- `plugin/` hanya memvalidasi input dan memanggil service/manager/contract. Jangan melakukan query database mentah di command.
- `src/core/` berisi `container.js` dan `eventBus.js`; gunakan `container.resolve(...)` dan `eventBus.broadcast(...)` untuk komunikasi lintas service/shard. Jangan memakai `global.client` atau monkey-patching `client.dashboardIo`.
- Akses lintas domain gunakan contract di `src/domain/contracts/` (`economyContract`, `survivalContract`, `musicContract`). Return publik contract harus immutable.
- `src/services/` menangani integrasi eksternal dan pekerjaan background; `src/managers/` menangani stateful resource seperti cache, database, musik, dan Lavalink.
- `dashboard/` adalah Express API plus frontend Vite MPA. Route dashboard tidak boleh mengakses model dengan cara yang melewati authorization dan cache policy.
- `src/interactions/registry.js` memetakan button/select/modal berdasarkan exact ID atau prefix. Tambahkan handler di folder interaksi yang sesuai, bukan rantai routing baru di `interactionCreate.js`.

## Data dan transaksi

- Saldo atau counter numerik wajib memakai `cacheManager.incrementUserProfile`, `incrementUserSurvival`, `debitUserProfile`, atau `debitUserSurvival`. Jangan memakai pola read-modify-write atau `update*` dengan nilai saldo absolut.
- Mutasi JSON (`inventory`, `rpg_state`, cooldown, playlist, dan sejenisnya) wajib memakai `mutate*Json`, `addItemsAtomic`, atau `takeItemsAtomic`.
- Jangan memanggil `UserProfile.update()` atau `UserSurvival.update()` langsung. Jangan memanggil `row.save()` tanpa `fields: [...]` yang eksplisit.
- Untuk pembayaran yang menggabungkan debit dan aksi lanjutan, gunakan `executeAtomicPayment()` dari `src/utils/transactionHelper.js`; aksi harus dapat di-rollback secara kompensasi.
- Gunakan lock per user/guild untuk operasi yang dapat dipanggil paralel. Jangan menganggap cache write-behind 5 detik sebagai transaksi database penuh.
- Data produksi harus berasal dari database/cache nyata. Fallback guest, SQLite, atau data demo hanya boleh aktif secara kondisional ketika layanan utama memang tidak tersedia.

## Discord UI dan interaksi

- Respons baru gunakan `buildContainerV2()` dari `src/utils/NauraContainerBuilder.js` dengan `MessageFlags.IsComponentsV2`; respons ephemeral gunakan `MessageFlags.Ephemeral`, bukan `ephemeral: true`.
- Jangan mencampur `content` atau `embeds` dengan payload Components V2 baru. Attachment `attachment://name` wajib memiliki file yang sama di `files`.
- Custom emoji harus disanitasi dari `authorName` dan footer; custom ID button/select/modal dalam satu pesan harus unik.
- Saat button survival meneruskan aksi ke subcommand, gunakan `adaptSurvivalInteraction(...)` dan guard status reply/defer yang sudah ada.
- Saat berpindah halaman, hentikan collector lama dengan alasan `navigated`. Saat timeout, pertahankan halaman aktif dan hanya nonaktifkan tombol.
- Batasi root slash command pada 25 opsi. Audit struktur command setelah `.toJSON()`, bukan dari properti builder internal.
- `src/interactions/safeExecute.js` harus menjadi jalur penanganan error interaksi; jangan membiarkan exception async keluar tanpa balasan defensif.

## Rendering, AI, audio, dan UI web

- Canvas hanya melalui `src/canvas/canvasRuntime.js` dan `canvasWorkerPool.js`; jangan `require('@napi-rs/canvas')` langsung dari renderer/handler.
- Kalkulasi domain seperti ekonomi, vital, combat, dan leveling harus pure function bila memungkinkan agar dapat diuji tanpa database.
- AI menerima konten pengguna sebagai data tidak tepercaya. Pertahankan routing, timeout, circuit breaker, dan fallback provider di `src/ai/aiEnsembleRouter.js`.
- Perubahan audio harus mempertimbangkan Poru/Lavalink cluster, node fallback, dan migrasi player.
- Warna lintas Discord, Canvas, dan web ambil dari `src/config/tokens/designTokens.js`; warna survival ambil dari helper survival, bukan hex baru di plugin.
- Perubahan token perlu diikuti `npm run tokens:generate` atau `npm run build`. Jangan mengedit hasil generated tanpa memperbaiki sumber token.

## Locale, secret, dan file lokal

- Jika menambah teks, perbarui `assets/language/id.json` dan `assets/language/en.json`, lalu jalankan strict locale check. Repository juga memuat `es.json` dan `ja.json`, jadi jangan menghapus key yang sudah ada.
- Karakter em dash (`\u2014`) dilarang di source, dokumentasi, dan locale.
- Jangan membaca, mencetak, atau commit token/API key. `.env` tidak boleh disentuh untuk commit; gunakan `.env.example` untuk perubahan konfigurasi yang terdokumentasi.
- Jangan menghapus `.cache/`; cache deploy command mencegah deploy slash command berulang ke Discord API.
- Periksa `git status` sebelum mengedit dan pertahankan perubahan user yang sudah ada.

## Selesai bekerja

- Jalankan verifikasi paling sempit yang relevan, lalu `npm run qa` bila waktunya memungkinkan.
- Jika test penuh terlalu lama atau gagal karena service eksternal, laporkan perintah, tahap, dan alasan sebenarnya; jangan mengganti hasil dengan mock atau menghapus test.
- Untuk UI/copy, gunakan skill lokal yang relevan dari `.agents/skills` dan ikuti `DESIGN.md`; jangan menambahkan pola visual generik atau data telemetry fiktif.
