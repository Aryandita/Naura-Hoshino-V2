# Audit Menyeluruh Naura Hoshino V2

**Tanggal audit:** 2026-11-02
**Commit baseline:** `9fe607f18d52a34f3a638e511657eb8c8ffb65a7` (`main`)
**Runtime:** Node `v24.20.0`, npm `11.19.0`
**Sifat audit:** read-only. Tidak ada kode yang diubah, tidak ada commit baru, tidak ada push.

---

## 1. Ringkasan Eksekutif

Repo ini jauh lebih sehat daripada rata-rata proyek sebesar ini: 2.843 file tracked, 1.137 file JS sumber, 207 file test, dan QA gate 9 tahap yang benar-benar berjalan. Lapisan yang biasanya paling sering bocor (webhook donasi, isolasi data pengguna, transcript traversal, soundboard) sudah dijaga dengan benar dan punya test regresi.

Tiga hal yang benar-benar perlu perhatian:

1. **Saldo survival ditulis ulang secara absolut dari route dashboard.** `dashboard/routes/survival.js` memakai pola baca-lalu-tulis (`updateUserSurvival(..., { sukamajuCoins: newBal })`). Ini persis pola yang dilarang RULES 1.6.1 dan bisa menghasilkan saldo ganda atau hilang saat dua request berjalan bersamaan.
2. **Enam route mutasi survival tidak punya guard otorisasi sama sekali.** Tidak ada `requireApiLogin`, tidak ada `requireSelfOrOwner`. Penjagaan hanya berupa `if (player.isLoggedIn)` di dalam handler.
3. **Header keamanan dashboard dilemahkan secara sengaja.** `contentSecurityPolicy: false` dan `frameguard: false` di `dashboard/server.js`, sementara `/node_modules` disajikan sebagai static publik.

Sisanya adalah kelas menengah: dependency dengan advisory high/critical, `eval` owner yang hanya dijaga flag env, HTTP polos di OMDb, dan 272 aset yang tidak direferensikan.

---

## 2. Baseline dan Hasil QA

| Item | Nilai |
| --- | --- |
| File tracked | 2.843 |
| File JS sumber (`src`, `plugin`, `dashboard`) | 1.137 |
| File test | 207 |
| Halaman dashboard (`dashboard/src/pages`) | 33 |
| Renderer canvas | 54 |
| File plugin JS | 236 |
| Subcommand survival | 62 |
| Aset PNG / SVG / MP3 / GIF | 440 / 336 / 207 / 97 |

QA gate (`npm run qa`):

| Tahap | Hasil |
| --- | --- |
| 1. ESLint | LOLOS, 0 error, 6 warning |
| 2. Em dash | LOLOS, bersih |
| 3. Paritas locale | LOLOS, 508 kunci sinkron |
| 4. Paritas versi SSOT | LOLOS, 22 pemeriksaan |
| 5. Resolusi require | LOLOS, 4.713 method tervalidasi |
| 6. Sintaks script inline | LOLOS, 38 script, 36 halaman |
| 7. Secret scan | LOLOS, tidak ada kredensial bocor |
| 8. Verifikasi drift arsitektur | **GAGAL**, 2 error `ENV_LEAK` di `src/managers/voiceManager.js:27` dan `:29` |
| 9. Test suite | Sedang berjalan saat laporan disusun; 1.347 penanda lulus, tidak ada kegagalan test yang teramati |

**QA gate tidak hijau.** Tahap 8 gagal karena `voiceManager.js` mengakses `process.env` langsung. Ini bukan regresi dari audit (tidak ada kode yang diubah), melainkan kondisi repo pada commit baseline. Temuan ini tercatat sebagai M-03 dan sekarang punya bukti gate resmi, bukan hanya hasil grep.

Dependency audit (`npm audit --omit=dev`): **1 critical, 8 high, 12 moderate**.

---

## 3. Temuan

Severity mengikuti dampak nyata, bukan kemudahan perbaikan. Status `Verified` berarti sudah dibaca langsung di kode.

### Critical

**C-01. Saldo survival ditulis absolut dari route dashboard (read-modify-write)**

- **File:** `dashboard/routes/survival.js:774-794` (toko), `:866-876` (beli kendaraan), `:898+` (jual kendaraan)
- **Status:** Verified
- **Bukti:** `const newBal = currentBal - item.price;` lalu `await cacheManager.updateUserSurvival(player.userId, patch)` dengan `patch.sukamajuCoins = newBal`.
- **Dampak:** Dua request bersamaan membaca saldo yang sama, keduanya lolos cek `currentBal < price`, keduanya menulis hasil akhir. Pemain bisa membeli dua barang dengan membayar satu, atau kehilangan saldo karena tulisan terakhir menimpa penambahan dari proses lain. Ini juga menimpa kolom vital lain dalam `patch` yang sama.
- **Melanggar:** RULES 1.6.1 (DILARANG read-modify-write), 1.6.2 (mutasi wajib atomik).
- **Reproduksi:** Login, buka `/adisha-map`, kirim dua `POST /api/survival/world/shop/buy` identik secara paralel dengan saldo yang hanya cukup untuk satu item. Amati `newBalance` pada kedua respons dan saldo akhir di database.
- **Perbaikan:** Ganti dengan `debitUserSurvival(userId, "sukamajuCoins", price)` yang mengembalikan `ok: false` bila saldo kurang, lalu pulihkan vital lewat `updateUserSurvival` patch terpisah. Untuk PD gunakan `debitUserProfile`.
- **Acceptance test:** Dua debit paralel pada saldo 100 dengan harga 80 harus menghasilkan tepat satu sukses dan satu gagal.

**C-02. Enam route mutasi survival tanpa guard otorisasi**

- **File:** `dashboard/routes/survival.js:389` (`/territory/claim`), `:586` (`/world/roam`), `:662` (`/world/work`), `:743` (`/world/shop/buy`), `:830` (`/world/vehicle/buy`), `:896` (`/world/vehicle/sell`)
- **Status:** Verified
- **Bukti:** `POST_ROUTES=6 GUARDED=0`. Handler memakai `resolvePlayerSurvivalState(req)` yang, ketika tidak login, jatuh ke `req.session.guestSurvival` (`:522-535`).
- **Dampak:** Route mutasi terbuka bagi siapa pun yang bisa membuat sesi. Saat ini dampaknya terbatas pada state guest di sesi sendiri, tetapi pola ini berbahaya: satu perubahan kecil pada resolver (misalnya menerima `userId` dari body) langsung mengubahnya menjadi IDOR penuh. Selain itu `/territory/claim` menulis klaim wilayah berdasarkan sesi tanpa otorisasi klan.
- **Melanggar:** RULES 1.3.7 (otorisasi ketat pada endpoint yang mengubah data), prinsip BOLA/IDOR di skill Strix.
- **Perbaikan:** Pasang `requireApiLogin` pada semua route mutasi, dan `requireSelfOrOwner` bila menerima `userId`. Pisahkan jalur guest ke endpoint demo eksplisit dengan rate limit.

### High

**H-01. CSP dan frameguard dimatikan, `/node_modules` disajikan publik**

- **File:** `dashboard/server.js:112-120` (`contentSecurityPolicy: false`, `frameguard: false`), `:205` (`webApp.use("/node_modules", express.static(...))`)
- **Status:** Verified
- **Dampak:** Tanpa CSP, satu celah XSS di halaman dashboard dapat mengeksekusi skrip apa pun, termasuk memanggil `/api/owner/*` dengan sesi korban. Tanpa frameguard, halaman bisa di-iframe untuk clickjacking. Menyajikan `node_modules` membuka permukaan file yang tidak perlu.
- **Catatan:** Komentar di kode menyebut CSP dimatikan karena masih ada skrip inline. Itu alasan yang sah untuk sekarang, tetapi bukan alasan untuk tidak punya rencana.
- **Perbaikan:** Aktifkan CSP bertahap dengan `script-src 'self' 'unsafe-inline'` sebagai langkah antara, lalu pindahkan skrip inline ke file. Aktifkan `frameguard: { action: "sameorigin" }`. Hapus route `/node_modules` dan ganti dengan bundle vendor yang eksplisit.

**H-02. `eval` owner hanya dijaga flag environment**

- **File:** `dashboard/routes/owner.js:195-236`
- **Status:** Verified
- **Bukti:** `router.use("/api/owner", requireOwner)` sudah benar (`:38`), dan `EVAL_ENABLED` mematikan endpoint secara default (`:27`, `:196`). Namun `let evaled = await eval(code)` (`:210`) mengeksekusi kode arbitrer di proses bot.
- **Dampak:** Bila `OWNER_EVAL_ENABLED=true` di produksi dan satu sesi owner bocor (cookie, XSS dari H-01, atau device yang tidak aman), penyerang mendapat eksekusi kode penuh, bukan hanya akses dashboard. Redaksi rahasia (`:214-229`) hanya menyaring output, bukan mencegah akses.
- **Perbaikan:** Kunci endpoint ke `NODE_ENV !== "production"`, atau ganti dengan allowlist perintah terbatas (flush cache, reload config, query statistik) yang tidak menerima kode bebas.

**H-03. Dependency dengan advisory high dan critical**

- **Status:** Verified via `npm audit --omit=dev`
- **Bukti:** `proxy-addr` critical (1.1.0-2.0.7); `@fastify/busboy`, `body-parser`, `brace-expansion`, `follow-redirects`, `officeparser`, `pdfjs-dist`, `source-map-js`, `undici` high.
- **Dampak:** `pdfjs-dist` (lewat `officeparser`) memiliki advisory eksekusi JavaScript saat membuka PDF berbahaya. Bila ada command yang memproses dokumen unggahan pengguna, ini jalur serangan nyata. `body-parser` dan `brace-expansion` adalah DoS.
- **Perbaikan:** Naikkan `officeparser` ke 8.4.1 (major, perlu uji ulang), `discord-html-transcripts` ke 3.3.0, dan tambahkan `overrides` untuk `proxy-addr`, `follow-redirects`, `brace-expansion`. Jangan pakai `npm audit fix --force`.

**H-04. OMDb dipanggil lewat HTTP polos**

- **File:** `plugin/utility/movie.js:52`, `:68`
- **Status:** Verified
- **Bukti:** `http://www.omdbapi.com/?apikey=${apiKey}&s=...`
- **Dampak:** API key terkirim tanpa enkripsi dan respons dapat diubah di jalur (MITM). Ini juga melanggar prinsip "HTTPS untuk semua komunikasi eksternal".
- **Perbaikan:** Ganti ke `https://www.omdbapi.com/` dan tambahkan test yang menolak skema `http:`.

**H-05. 272 aset tidak direferensikan**

- **Status:** Verified via `.perch/audit/asset-scan.js` (1.252 file aset diperiksa)
- **Bukti:** `ORPHAN_CANDIDATES=272`, termasuk `assets/dashboard/bg_pc_*.png`, `assets/items/*.jpg`, `assets/3D Model Naura/previews/*.png`, `assets/maps/*.jpg`.
- **Dampak:** Repo membengkak, waktu clone dan build naik, dan aset usang membingungkan kontributor tentang mana yang masih dipakai. Beberapa di antaranya tampak seperti aset produk yang seharusnya dipakai (banner item, peta).
- **Perbaikan:** Konfirmasi per kelompok: pakai, arsipkan ke folder `assets/_archive/`, atau hapus. Jangan hapus otomatis sebelum dikonfirmasi.

### Medium

**M-01. Referensi `attachment://` yang tidak selalu disertai file**

- **Bukti:** `ATTACHMENT_REFS=28`, termasuk `attachment://missing.png` dan `attachment://naura_...`.
- **Dampak:** Bila file tidak dilampirkan pada `files: []`, Discord mengembalikan `50035 UNFURLED_MEDIA_ITEM_REFERENCED_ATTACHMENT_NOT_FOUND`. Builder punya fallback defensif, tetapi nama seperti `missing.png` menandakan placeholder yang lolos ke produksi.
- **Perbaikan:** Audit 28 referensi, pastikan masing-masing punya `AttachmentBuilder` di array `files`, dan hapus placeholder.

**M-02. Empat pemanggil canvas melewati worker pool**

- **File:** `src/ai/serverChronicleEngine.js:270`, `src/interactions/buttons/cardBattle.js:16`, `src/interactions/buttons/cardClaim.js:5`, `src/survival/engines/dungeonRender.js:13`
- **Status:** Verified
- **Dampak:** Render berat berjalan di event loop utama dan bisa menahan respons Discord saat server ramai. Melanggar RULES 1.9.
- **Catatan penting:** `plugin/utility/weather.js`, `movie.js`, dan `minecraft.js` sudah benar memakai `canvasWorkerPool.execute(...)`. Jadi ini bukan masalah sistemik, hanya empat jalur yang tertinggal.
- **Perbaikan:** Pindahkan ke `canvasWorkerPool.execute("renderX", payload)` dan daftarkan task di `canvasWorker.js`.

**M-03. `process.env` dipakai langsung di luar `env.js`, MEMBUAT QA GATE GAGAL**

- **File:** `src/managers/voiceManager.js:27,29`, `dashboard/middleware/auth.js`, `dashboard/middleware/validation.js`
- **Status:** Verified, dan **dikonfirmasi oleh QA gate tahap 8** (`npm run qa` -> `8/9 Verifikasi Drift Arsitektur GAGAL dengan exit code 1`).
- **Bukti gate:**
  ```
  [ERROR] [ENV_LEAK] src\managers\voiceManager.js:27
  [ERROR] [ENV_LEAK] src\managers\voiceManager.js:29
  ```
- **Dampak:** Melanggar RULES 1.3.2. Untuk `voiceManager.js` khususnya, penulisan `process.env.FFMPEG_PATH` saat runtime membuat konfigurasi tidak lagi terpusat. Karena ini Hard Gate di QA, repo tidak bisa dinyatakan hijau sebelum diperbaiki.
- **Perbaikan:** Pindahkan pembacaan ke `env.js`; untuk `FFMPEG_PATH` yang di-set saat boot, jadikan nilai turunan di `env.js`.
- **Acceptance test:** `npm run qa` tahap 8 harus lolos dengan 0 error.

**M-04. 31 `EmbedBuilder` masih dipakai**

- **Status:** Verified, tersebar di `src/events/*`
- **Dampak:** RULES 1.4 mengizinkan embed hanya untuk loading sementara atau error sederhana. Beberapa pemakaian (misalnya `guildMemberAdd.js:94`, `channelUpdate.js:79`) adalah pesan fitur, bukan error.
- **Perbaikan:** Migrasikan pesan fitur ke `buildContainerV2`; sisakan embed hanya untuk kasus yang diizinkan.

**M-05. Drift dokumentasi pada jumlah migrasi**

- **Bukti:** `RULES.md:41` menyebut "46 migrasi", `RULES.md:466` berjudul "Ledger 46 Migrasi", tetapi tabelnya berisi v1 sampai v48. `PRD.md:182` menyebut "45 migrasi". `DASHBOARD_AUDIT.md` menyebut 46.
- **Dampak:** Dokumen tata kelola tidak lagi bisa dipakai sebagai sumber kebenaran jumlah migrasi. Ini melemahkan audit berikutnya.
- **Perbaikan:** Samakan ke jumlah aktual di `dbMigrator.js` dan perbarui ketiga dokumen.

**M-06. Drift path dokumentasi dashboard**

- **Bukti:** Dokumen menyebut `dashboard/src/pages/*.html` sebagai SSOT, dan itu benar (33 halaman). Namun beberapa dokumen audit lama merujuk struktur yang sudah tidak ada, dan `DASHBOARD_AUDIT.md` menyebut 28 halaman sementara aktual 33.
- **Perbaikan:** Perbarui dokumen audit lama atau tandai sebagai arsip.

**M-07. `RULES.md` menyebut 46 migrasi tetapi juga v47/v48**

- Lihat M-05; dicatat terpisah karena menyangkut isi tabel, bukan hanya angka di judul.

### Low

**L-01. `new Function` di kalkulator**

- **File:** `plugin/utility/calculator.js:35`, `:284`
- **Status:** Verified sebagai **aman**, bukan kerentanan.
- **Alasan:** Input difilter `SAFE_MATH_REGEX = /^[0-9+\-*/(). \t]+$/` (`:26`) dan `SAFE_EXPRESSION_REGEX = /^[0-9+\-*/(). ]+$/` (`:261`). Tidak ada huruf, sehingga tidak mungkin memanggil fungsi. Ini contoh baik triase false positive: pola berbahaya, taint terblokir.
- **Saran opsional:** Ganti dengan parser matematika deterministik agar tidak bergantung pada `new Function` sama sekali.

**L-02. Warning ESLint yang tersisa**

- 6 warning `no-unused-vars`. Tidak memblokir, tetapi menandakan kode mati.

**L-03. `checks` pada `package.json` tidak memuat `test:secrets` di `qa`**

- `npm run qa` menjalankan secret scan (terbukti di output), tetapi pastikan urutan tetap dipertahankan saat gate diubah.

---

## 4. Area yang Diaudit dan Lolos

Ini penting dicatat agar tidak ada kesan audit hanya mencari kesalahan.

| Area | Bukti |
| --- | --- |
| Webhook donasi Saweria/Trakteer | HMAC SHA-256 dengan `timingSafeEqual`, tolak 401 tanpa signature, tolak nominal 0, tolak Discord ID non-snowflake, idempotensi `claimOnce` teruji |
| Isolasi data pengguna | `requireSelfOrOwner` menolak 403 saat User A mengakses `?userId=` User B; ada test regresi |
| Transcript tiket | Traversal path ditolak 400, wajib login, tidak disajikan statis |
| Soundboard | `POST /api/music/control` dijaga `requireGuildManager`; `/api/music/:action` menolak 401 tanpa auth |
| Arcade claim | Cooldown 20 detik dan daily cap 500 NSF benar-benar diterapkan (`activity.js:1282-1318`) |
| Rate limit | Tiga lapis `rateLimit` di `server.js:295-330` |
| CORS | Allowlist `DASHBOARD_ORIGIN`, tolak origin asing di produksi |
| Session | `SESSION_SECRET` wajib; dashboard menolak start bila kosong di produksi |
| Secret scan | Bersih |
| Em dash | Bersih |
| Paritas locale | 508 kunci sinkron |
| Batas 25 subcommand | Command `survival` punya 10 opsi top-level setelah `.toJSON()`, payload 7.662 byte, di bawah batas |
| Command pihak ketiga | `weather`, `movie`, `minecraft` memakai circuit breaker, timeout 5 detik, cache, dan worker pool dengan benar |
| Canvas worker | 50 dari 54 renderer terhubung benar; 4 jalur tercatat di M-02 |

---

## 5. Prioritas Perbaikan

**Minggu ini (risiko uang dan data):**
1. C-01: ganti semua penulisan saldo absolut di `dashboard/routes/survival.js` dengan debit atomik.
2. C-02: pasang guard pada enam route mutasi survival.
3. H-01: aktifkan `frameguard`, hapus `/node_modules`, mulai CSP bertahap.

**Minggu ini juga (murah dan berdampak):**
4. H-04: ganti OMDb ke HTTPS.
5. H-02: kunci `eval` owner ke non-produksi.

**Sprint berikutnya:**
6. H-03: naikkan dependency berisiko, satu paket per commit.
7. M-02: pindahkan empat pemanggil canvas ke worker pool.
8. M-01: audit 28 referensi `attachment://`.
9. M-03, M-04: rapikan `process.env` dan migrasi embed.

**Housekeeping:**
10. H-05: putuskan 272 aset orphan.
11. M-05, M-06: sinkronkan dokumentasi migrasi dan dashboard.

---

## 6. Catatan Metodologi

- Setiap temuan `Verified` dibaca langsung dari kode pada commit baseline.
- Temuan yang bergantung pada perilaku runtime (misalnya race condition C-01) diberi langkah reproduksi, bukan diklaim sudah dieksploitasi.
- Tidak ada request yang dikirim ke layanan produksi selama audit.
- Dependency audit dijalankan terhadap lockfile yang ada, tanpa auto-fix.
- Skrip pemindai aset disimpan di `.perch/audit/asset-scan.js` agar hasilnya bisa direproduksi.
