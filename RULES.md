# 📜 NAURA HOSHINO, Repository Governance & Architecture Rules

> **Versi:** 2.1.0 · **Engine:** 2.1.0 · **Runtime:** Node.js ≥ 24 · **Framework:** discord.js v14  
> **Pentalogi Dokumentasi:** [`README.md`](README.md) (Portal) · [`PRD.md`](PRD.md) (Produk) · [`DESIGN.md`](DESIGN.md) (Desain) · [`RULES.md`](RULES.md) (Teknis) · [`AGENTS.md`](AGENTS.md) (SOP Agen AI)

> [!IMPORTANT]
> **Sumber Kebenaran & Ekosistem Tata Kelola:**
> - [`PRD.md`](PRD.md): Sumber kebenaran untuk visi produk, persona pengguna, dan spesifikasi fungsional 6 pilar (*What & Why*).
> - [`DESIGN.md`](DESIGN.md): Sumber kebenaran untuk token warna, tema glassmorphism, dan standar antarmuka UI (*Look & Feel*).
> - [`RULES.md`](RULES.md) (Dokumen ini): Sumber kebenaran untuk arsitektur teknis, hukum rekayasa kode, dan standar keamanan (*How & Governance*).
> - [`AGENTS.md`](AGENTS.md): Sumber kebenaran untuk navigasi repositori, alur eksekusi, dan SOP agen AI (*Workflow & Navigation*).
> - [`README.md`](README.md): Sumber kebenaran untuk gambaran umum publik dan panduan instalasi (*Portal & Quickstart*).
> - `package.json`: Sumber kebenaran versi dan daftar dependensi. `src/config/env.js`: Sumber kebenaran variabel environment. `TODO.md`: Sumber kebenaran prioritas sprint.

---

## ⚡ Quick Reference Aturan Wajib

| Topik                   | Aturan Pokok                                                                              | Referensi / Lokasi |
| ----------------------- | ----------------------------------------------------------------------------------------- | ------------------ |
| **Gaya Kode**           | CommonJS, indentasi 4 spasi, semicolon wajib, tanpa em dash (`\u2014`)                    | Bagian 1.1         |
| **Commit & Branch**     | `<emoji> <tipe>: <deskripsi singkat>`, branch `main` (prod), `dev`, `feature/*`           | Bagian 1.2         |
| **Keamanan**            | Jangan pernah commit `.env`, timingSafeEqual untuk webhook, batasi eval                   | Bagian 1.3         |
| **UI Discord**          | Wajib Components V2 via `buildContainerV2()` struktur 5-lapisan, flags `32768`            | Bagian 1.4         |
| **Desain Survival**     | Sub-brand Naura Wilds, token warna dari `src/utils/survivalUIHelper.js`                   | Bagian 1.5         |
| **Tulis Data User**     | HANYA via `cacheManager` (increment/debit/mutateJson), bukan model langsung               | Bagian 1.6         |
| **Tulis GuildSettings** | HANYA via `guildSettingsService.updateGuildSetting()`                                     | Bagian 1.8         |
| **Render Canvas**       | HANYA via `src/canvas/canvasRuntime.js` -> `canvasWorkerPool.js` (Worker Threads)         | Bagian 1.9         |
| **Polyglot DB**         | Supabase (PostgreSQL relasional), MongoDB (dokumen/log), Redis (cache), SQLite (fallback) | Bagian 1.7         |
| **Migrasi Skema**       | Eksklusif di `dbMigrator.js` bernomor + ledger; DILARANG ALTER TABLE di tempat lain       | Bagian 1.7.1       |
| **Pterodactyl Panel**   | `CMD_RUN` tetap `npm start`, migrasi via `prestart` di `package.json`                     | Bagian 3.1         |
| **Senior Laws**         | 7 Coding Laws of Senior Developer (Clean Architecture & Flat Flow)                        | Bagian 2.1         |

---

# 🏛️ BAGIAN 1, Aturan & Tata Kelola Pokok (Governance)

## 1.1 Bahasa & Konvensi Kode

| Aturan                   | Penjelasan                                                                                                                     |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| **Bahasa Kode**          | JavaScript (CommonJS `require` / `module.exports`). Tidak menggunakan TypeScript atau ESM pada bot runtime.                    |
| **Dynamic Import**       | `await import()` diizinkan dan dianjurkan untuk lazy-load dependensi berat atau library ESM-only (seperti Three.js addons).    |
| **Bahasa Komentar**      | Bahasa Indonesia untuk komentar inline, docstring, dan pesan log. Bahasa Inggris untuk nama variabel, fungsi, dan kelas.       |
| **Indentasi**            | 4 spasi seragam sesuai konfigurasi Prettier repo.                                                                              |
| **Linting & Formatting** | ESLint v10 + Prettier v3. Seluruh commit wajib bebas error linter (`npm run lint`).                                            |
| **Testing**              | Runner bawaan Node (`node:test`) colocated dengan source (`*.test.js`). Tidak menambah framework testing eksternal.            |
| **Semicolons**           | Wajib digunakan di setiap akhir statement.                                                                                     |
| **String Literal**       | Single quotes (`'...'`) untuk string statis, backticks (`` `...` ``) untuk template string.                                    |
| **Em Dash Terlarang**    | Karakter em dash (`\u2014`) dilarang di seluruh repo termasuk kamus i18n (`check-em-dash.js`). Gunakan tanda hubung `-` biasa. |

## 1.2 Aturan Penamaan & Struktur Berkas

| Elemen                 | Pola                          | Contoh                                             |
| ---------------------- | ----------------------------- | -------------------------------------------------- |
| File command/plugin    | `kebab-case.js`               | `steal-emoji.js`, `warn.js`                        |
| File manager/utility   | `camelCase.js`                | `cronManager.js`, `bootScreen.js`                  |
| File model (Sequelize) | `PascalCase.js`               | `UserProfile.js`, `GuildSettings.js`               |
| File model (Mongoose)  | `PascalCase.js`               | `AiChatHistory.js`, `CommandAuditLog.js`           |
| File builder/utility   | `PascalCase.js`               | `NauraContainerBuilder.js`, `NauraEmbedBuilder.js` |
| Variabel & fungsi      | `camelCase`                   | `cleanEnv()`, `buildContainerV2()`                 |
| Kelas & model          | `PascalCase`                  | `CommandHandler`, `MusicManager`                   |
| Konstanta global       | `UPPER_SNAKE_CASE`            | `OWNER_IDS`, `LAVA_HOST`                           |
| Event handler files    | `camelCase.js` (nama event)   | `messageCreate.js`, `voiceStateUpdate.js`          |
| File unit test         | `<nama>.test.js` bersebelahan | `rateLimiter.test.js`, `inventoryHelper.test.js`   |

## 1.3 Aturan Keamanan & Integritas Sistem

> [!CAUTION]
> Pelanggaran aturan keamanan bisa menyebabkan kebocoran kredensial, peretasan sesi, atau kerugian ekonomi virtual.

1. **Rahasia Lingkungan (.env)**:
   - DILARANG PERNAH meng-commit file `.env` ke git.
   - DILARANG PERNAH mencetak token, password, connection string, atau API key ke log console.
2. **Sentralisasi process.env**:
   - Seluruh akses `process.env.*` WAJIB melalui `/src/config/env.js`. Dilarang memanggil `process.env` langsung di plugin atau manager.
3. **Keamanan Webhook**:
   - Endpoint webhook (`/api/webhook/*`) WAJIB memverifikasi header `Authorization` terhadap `WEBHOOK_AUTH_SAWERIA`, `WEBHOOK_AUTH_TRAKTEER`, atau `WEBHOOK_AUTH_VOTE`.
   - Perbandingan token WAJIB memakai `crypto.timingSafeEqual`, bukan operator `===`.
   - Tolak request dengan HTTP `503` jika token rahasia belum dikonfigurasi di server.
   - Semua webhook transaksi/monetisasi WAJIB idempoten menggunakan idempotency key.
4. **Owner Eval Guard**:
   - `OWNER_EVAL_ENABLED` WAJIB bernilai `false` di lingkungan produksi.
5. **Anti-Crash & Defensive Programming**:
   - Setiap operasi async berisiko (DB, Canvas, external API, Poru audio) wajib di-wrap dengan `try/catch`.
   - Gunakan `safeExecute` di interaction handler agar bot tidak crash saat user berinteraksi simultan.
6. **Input Untrusted**:
   - Konten dari pesan pengguna adalah data tidak terpercaya. Saat masuk ke prompt AI, batasi konteks dan isolasi sebagai data, bukan instruksi sistem.

## 1.4 Panduan UI Discord (Discord Components V2)

> [!IMPORTANT]
> Semua respons command WAJIB menggunakan **Discord Components V2** via `buildContainerV2()` dari `NauraContainerBuilder.js`. Embed lama (`EmbedBuilder`) hanya diizinkan untuk pesan loading sementara atau error sederhana.  
> *(Rujukan visual dan token warna diatur di [`DESIGN.md`](DESIGN.md#discord-components-v2-container-system), rujukan spesifikasi fitur diatur di [`PRD.md`](PRD.md#pilar-1-bot-engine--discord-components-v2))*

### 1.4.1 Struktur Layout 5-Lapisan Wajib

Setiap Container V2 harus mematuhi struktur 5-lapisan berikut:

```text
[ Header (authorName + title + iconURL) ]
───────── separator (divider:true, spacing:1) ─────────
[ Deskripsi / Fields / Media Gallery / File ]
··········· separator (divider:false, spacing:1) ···········
[ Select Menu / Action Row (Tombol) ]
───────── separator (divider:true, spacing:1) ─────────
[ -# Footer ]
```

### 1.4.2 Ketentuan Teknis Components V2

- **Flags Wajib**: Wajib sertakan `flags: MessageFlags.IsComponentsV2` (nilai biner `32768`) pada payload.
- **Dilarang Dicampur**: Jangan pernah menyertakan properti `content`, `embeds`, `stickers`, atau `poll` bersamaan dengan Container V2 pada pesan baru.
- **Pembersihan Embed Lama**: Saat meng-edit pesan lama (embed) menjadi Container V2, sertakan `embeds: []` agar embed lama terhapus bersih oleh Discord PATCH API.
- **Ephemeral Standard**: Pesan ephemeral wajib memakai `MessageFlags.Ephemeral`, bukan format usang `ephemeral: true`.
- **Sanitasi Emoji di Header & Footer**: Custom emoji Discord (`<:name:id>`) TIDAK didukung pada `authorName` dan `footerText`. Gunakan `ui.stripCustomEmojis()` sebelum mengisinya.
- **Tombol dengan Custom Emoji**: Parsing emoji tombol via `ui.parseEmoji(ui.getEmoji('nama'))` untuk menghasilkan objek `{ id, name, animated }` yang valid.
- **Batas Payload**: Maksimal 40 komponen per pesan dan total teks aman di bawah 3.500 karakter. `src/utils/componentBudget.js` memotong isi berlebih secara otomatis tanpa mengorbankan tombol atau footer.

## 1.5 Panduan Desain Survival RPG (Naura Wilds)

> [!IMPORTANT]
> Sistem survival mengusung sub-brand **Naura Wilds** dengan gaya visual **Hybrid Nature-Tech**: fondasi Cyber-Anime Glassmorphism dipadukan dengan palet earth-tone.  
> *(Rujukan palet visual lengkap di [`DESIGN.md`](DESIGN.md#naura-wilds-survival-sub-brand), rujukan aturan gameplay di [`PRD.md`](PRD.md#pilar-5-survival-rpg-naura-wilds))*

- **Sumber Token**: Semua warna survival (emerald, moss, amber, bark, river, danger) wajib bersumber dari `src/utils/survivalUIHelper.js`.
- **Panel Khusus**: Panel survival memakai tinted glass hijau (`surface-glass-wilds`) dengan hairline hijau.
- **Bar Vital Otomatis**: Bar HP/Stamina/Hunger wajib menggunakan `buildVitalsBar()`:
  - `moss` (> 50% sehat)
  - `amber` (20% - 50% waspada)
  - `danger` (< 20% kritis)
- **Skala Rarity**: Pill rarity item, gacha, crafting, dan drop dungeon wajib memakai `getRarityColor()`:
  - Common: Abu-abu
  - Uncommon: Emerald
  - Rare: Biru
  - Epic: Ungu
  - Legendary: Gold
  - Mythic: Pink
- **Panel Pertarungan**: Dungeon, duel, world boss, dan coliseum memakai aksen `wilds-danger` (`#F87171`) dengan batas log maksimal 5 baris.
- **Footer Survival**: Seluruh respons modul survival wajib memakai `ui.getFooter('survival')`.

## 1.6 Konsistensi Data Ekonomi & Transaksi Atomik

> [!CAUTION]
> Kesalahan transaksi ekonomi (race condition, double spend) adalah bug paling merusak. Dilarang melakukan pola read-modify-write!  
> *(Spesifikasi mata uang NSF, NC, dan kupon diatur di [`PRD.md`](PRD.md#pilar-4-polyglot-database--arsitektur-atomik) dan [`PRD.md`](PRD.md#pilar-5-survival-rpg-naura-wilds))*

### 1.6.1 Nilai Numerik Saldo

- **DILARANG Read-Modify-Write**: Jangan membaca saldo lalu menulis ulang hasilnya (`balance = balance + 100`).
- **Gunakan Operasi Atomik**:
  - Menambah: `incrementUserProfile(userId, delta)` atau `incrementUserSurvival(userId, delta)`.
  - Mengurangi: `debitUserProfile(userId, amount)` atau `debitUserSurvival(userId, amount)`.
- **Validasi Debit**: Fungsi debit mengembalikan false / 0 rows jika saldo tidak mencukupi (menggunakan klausa `Op.gte`).
- **Mata Uang Langka**: Naura Coupons disimpan di kolom numerik `UserSurvival.coupons`, bukan di dalam JSON `rpg_state`.

### 1.6.2 Kolom JSON & Inventory

- **Mutasi JSON**: Kolom JSON (`inventory`, `rpg_state`, `cooldowns`, `economy_deposit`) WAJIB diubah melalui `cacheManager.mutateUserProfileJson()` atau `mutateUserSurvivalJson()` yang mengunci baris dengan `SELECT ... FOR UPDATE`.
- **Helper Inventory**: Gunakan `addItemsAtomic(userId, items)` dan `takeItemsAtomic(userId, requests)` di `plugin/survival/inventoryHelper.js`.
- **Penyimpanan Eksplisit**: Jika memanggil `row.save()`, WAJIB menyertakan opsi fields (contoh: `await row.save({ fields: ['rpg_state'] })`) agar tidak menimpa kolom saldo numerik yang sedang mengantre flush.
- **Urutan Transaksi**: Simpan item/hadiah terlebih dahulu sebelum memotong biaya/energi untuk mencegah pemain kehilangan aset saat terjadi error penulisan.

## 1.7 Arsitektur Polyglot Database

### 1.7.1 Supabase & PostgreSQL (Relasional & Transaksional)

- **ALTER TABLE Terisolasi**: DILARANG menjalankan perintah `ALTER TABLE` di dalam `dbManager.js`. Semua migrasi struktur skema harus berada di `src/managers/dbMigrator.js` dengan versi bernomor dan tercatat di tabel `schema_migrations`.
- **Aturan Sync**: Produksi memakai `sync({ alter: false })`. Development memakai `sync({ alter: { drop: false } })`.
- **Pool Sizing**: Batas koneksi `DB_POOL_BUDGET` dibagi merata ke setiap shard agar tidak melebihi kapasitas PostgreSQL pooler.

### 1.7.2 MongoDB (Dokumen Terdistribusi & Log Skala Besar)

- Semua skema dokumen Mongoose wajib berada di `src/models/mongo/`.
- Penulisan log (`AiChatHistory`, `CommandAuditLog`, `TicketTranscript`) wajib dieksekusi secara asynchronous non-blocking agar tidak menunda respons Discord.
- Seluruh koneksi dikelola secara tersentralisasi via `mongoManager.js`.

### 1.7.3 Redis (Cache Cepat, Lock, & Pub/Sub)

- Semua key wajib memiliki namespace yang jelas: `cache:*`, `canvas:*`, `ratelimit:*`, `session:*`.
- Setiap key wajib memiliki TTL (Time to Live).
- Pembersihan cache lintas proses/shard wajib disiarkan melalui Pub/Sub channel `cache:invalidate`.

### 1.7.4 SQLite (Penyimpanan Darurat Offline)

- Menggunakan modul bawaan `node:sqlite` di Node 24.
- Dipakai secara otomatis jika Supabase dan Redis tidak dapat dijangkau. Data darurat disinkronkan kembali saat koneksi cloud pulih via `syncFallbackToMySQL()`.

## 1.8 Caching & Akses Pengaturan Server

- **GuildSettings Cache**: `GuildSettings.findOne()` WAJIB melalui `cacheManager.getGuildSettings(guildId)` dengan TTL minimal 5 menit.
- **Tulis GuildSettings**: Seluruh modifikasi konfigurasi server WAJIB melalui `guildSettingsService.updateGuildSetting()` untuk menjamin cache di semua shard terinvalidasi.
- **UserProfile Cache**: Selalu gunakan `cacheManager.getUserProfile(userId)`.
- **Dilarang Query DB di Dalam Loop**: Gunakan operator `Op.in` untuk mengambil data batch.

## 1.9 Canvas Memory Safety & Worker Threads

- Render Canvas berat wajib didelegasikan ke `src/canvas/canvasWorkerPool.js` berbasis `node:worker_threads`.
- Buffer gambar setelah proses render wajib di-dispose untuk mencegah memory leak.
- Konkurensi render dibatasi maksimal 2-3 proses secara simultan.
- Cache hasil visual Canvas disimpan di Redis (`canvas:*`) dan diinvalidasi saat profil/level bermutasi melalui `smartInvalidateUserCanvas(userId)`.

## 1.10 Standar Commit & Branching Git

- **Branching**:
  - `main`: Branch produksi, wajib selalu stabil dan hijau.
  - `dev`: Branch integrasi pengembangan.
  - `feature/<nama>`: Branch fitur atau sprint baru.
- **Format Pesan Commit**: `<emoji> <tipe>: <deskripsi singkat>`
  - Contoh: `✨ feat: integrate Fish Audio AI DJ companion`
  - Tipe resmi: `feat`, `fix`, `refactor`, `docs`, `style`, `perf`, `chore`, `test`, `ci`.
- **Satu PR Per Sprint**: Seluruh commit dikumpulkan dan direview dalam satu PR sprint sebelum digabung ke `main`.
- **CI Wajib Hijau**: Linting, pengecekan em dash, paritas bahasa, dan test suite wajib 100% lulus sebelum merge.

---

# 📐 BAGIAN 2, Standar Clean Architecture

## 2.1 The 7 Coding Laws of Senior Developer

Semua penulisan kode baru dan refaktorisasi wajib menerapkan 7 hukum arsitektur berikut:

1. **Law 1: Keep the main path easy to follow (Guard Clauses)**
   - Hindari nested if-else yang dalam (_arrow anti-pattern_).
   - Gunakan early return di awal fungsi untuk menangani edge case, pengecekan izin, cooldown, dan validasi gagal.
   - Happy path harus berada di indentasi terluar.

2. **Law 2: Name things by meaning (Domain Naming)**
   - Dilarang memakai nama variabel generik: `data`, `res`, `result`, `obj`, `temp`, `val`.
   - Gunakan nama eksplisit yang mencerminkan makna dan unit: `memberExperiencePoints`, `pendingTradeOffer`, `targetChannelId`.

3. **Law 3: Keep external systems behind a boundary (Adapters)**
   - Format data eksternal (Discord raw interactions, third-party API, database rows) tidak boleh bocor ke logika bisnis.
   - Bungkus sistem eksternal di folder `src/adapters/` (`interactionBoundaryAdapter.js`, `paymentBoundaryAdapter.js`).

4. **Law 4: Make invalid states harder to represent (State Enums)**
   - Dilarang memakai status string bebas yang rawan typo (`'done'`, `'fin'`).
   - Gunakan enum terpusat di `src/domain/DomainStates.js` dan validator transisi `canTransitionState()`.

5. **Law 5: Separate decisions from actions (Pure Engines vs I/O)**
   - Pisahkan logika perhitungan murni (_Pure Calculations_) dari operasi I/O dan mutasi state (_Side-Effects_).
   - Fungsi di `src/domain/decisions/` harus deterministik tanpa menyentuh database atau Discord API.

6. **Law 6: Make errors useful (Structured Domain Errors)**
   - Dilarang melempar `new Error('pesan')` biasa.
   - Gunakan `DomainError` dari `src/errors/DomainError.js` yang memuat `code`, `userMessage`, dan `context` diagnostik.

7. **Law 7: Keep changes focused (Single Responsibility)**
   - Satu berkas, satu tanggung jawab terisolasi. Hindari _god object_.

---

# 🚀 BAGIAN 3, Deployment & Konfigurasi Lingkungan

## 3.1 Panel Pterodactyl

- Variabel eksekusi terkunci: `CMD_RUN = npm start`.
- Token pertama wajib binary `/usr/local/bin/npm` atau `node`.
- Urutan restart dijamin otomatis:
  ```text
  npm start ──► prestart (node scripts/migrate.js) ──► start (node shard.js)
  ```
- Dilarang memindahkan script migrasi ke kolom panel. Jika migrasi gagal, proses berhenti sebelum bot online demi integritas database.

## 3.2 Daftar Migrasi Skema Bernomor

| ID Migrasi                      | Fungsi                                      |
| ------------------------------- | ------------------------------------------- |
| `v1_add_mannersPoint`           | Kolom poin sopan santun user                |
| `v2_add_dailyNotify`            | Kolom pengingat daily claim                 |
| `v3_add_economy_deposit`        | Kolom JSON deposito bank                    |
| `v4_add_economy_investments`    | Kolom JSON portofolio investasi pasar       |
| `v5_add_coupons`                | Kolom kupon numerik di `UserSurvivals`      |
| `v6_move_coupons_to_column`     | Migrasi data nilai kupon dari JSON ke kolom |
| `v7_add_user_strikes`           | Model `UserStrike` riwayat peringatan       |
| `v8_add_sticky_roles`           | Model `StickyRole` saat member rejoin       |
| `v9_add_role_lease`             | Model `RoleLease` sewa role berdurasi       |
| `v10_add_social_alert`          | Model `SocialAlert` RSS feed                |
| `v11_add_market_auction`        | Model `MarketAuction` lelang lintas server  |
| `v12_add_user_npc`              | Model `UserNPC` afeksi relasi karakter      |
| `v13_add_story_progress`        | Model `StoryProgress` cerita RPG            |
| `v14_add_user_achievement`      | Model `UserAchievement` milestone           |
| `v15_add_user_birthday`         | Model `UserBirthday` timezone               |
| `v16_add_user_cosmetic`         | Model `UserCosmetic` skin koleksi           |
| `v17_add_user_farm`             | Model `UserFarm` siklus panen               |
| `v18_add_giveaway_participants` | Kolom peserta dan pemenang giveaway         |

---

## 🔗 Peta Hubungan Dokumen Ekosistem (Pentalogi Dokumentasi)

Seluruh kontributor dan agen AI wajib memahami posisi dokumen ini dalam ekosistem tata kelola repositori:

| Dokumen | Sumber Kebenaran (*Source of Truth*) | Pertanyaan Utama yang Dijawab |
| :--- | :--- | :--- |
| [`README.md`](README.md) | **Portal & Instalasi Publik** | "Bagaimana cara memasang, menjalankan, dan memahami arsitektur dasar bot?" |
| [`PRD.md`](PRD.md) | **Kebutuhan Produk & Personas** | "Fitur apa yang sedang dibangun, mengapa dibuat, untuk siapa, dan prioritasnya apa?" |
| [`DESIGN.md`](DESIGN.md) | **Bahasa Desain & UI Tokens** | "Bagaimana aturan warna, glassmorphism, 3D avatar viewer, dan Components V2?" |
| [`RULES.md`](RULES.md) | **Konstitusi & Standar Teknis** | "Bagaimana aturan hukum kode, batas transaksi atomik DB, keamanan, dan anti-crash?" |
| [`AGENTS.md`](AGENTS.md) | **Navigasi & SOP AI Agent** | "Di mana letak file-nya, bagaimana alur data interaksi ke database, dan apa checklist QA?" |
| [`TODO.md`](TODO.md) | **Roadmap & Sprint Backlog** | "Pekerjaan apa yang sedang berlangsung dan apa prioritas berikutnya?" |
