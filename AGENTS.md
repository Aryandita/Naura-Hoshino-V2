# 🤖 PANDUAN KERJA & ORIENTASI AGENT AI, NAURA HOSHINO V2

> **Target:** AI Coding Assistants (Antigravity, Roo Code, Claude, Copilot, & Developer Manusia)  
> **Versi Ekosistem:** 2.1.0 · **Engine:** 2.1.0 · **Runtime:** Node.js ≥ 24 · **Framework:** discord.js v14

> [!IMPORTANT]
> **Aturan Wajib & Tata Kelola:** Seluruh aturan hukum kode, konvensi penamaan, standar keamanan, layout Components V2, dan ketentuan atomisitas database berada di [`RULES.md`](RULES.md). Dokumen ini berfokus pada **cara agen memahami arsitektur proyek, peta navigasi cepat, kompetensi/skill yang diperlukan, dan prosedur eksekusi tugas**.

---

## 🧭 1. Mental Model Ekosistem Naura Hoshino V2

Sebagai agen AI, bayangkan Naura Hoshino V2 sebagai platform terintegrasi dengan **6 Pilar Utama**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAURA HOSHINO V2 ECOSYSTEM                          │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ 1. BOT ENGINE (discord.js)   │ 2. WEB DASHBOARD V2 (Vite)   │ 3. AUDIO & DJ │
│ • Sharding & Event Router    │ • Self-contained MPA         │ • Poru v5     │
│ • Components V2 (5 Lapisan)  │ • 3D Avatar (Three.js PBR)   │ • Lavalink v4 │
│ • 55+ Slash Command Plugins  │ • Socket.IO Telemetri        │ • Fish Audio  │
├──────────────────────────────┼──────────────────────────────┼───────────────┤
│ 4. POLYGLOT DATABASE         │ 5. SURVIVAL RPG (Naura Wilds)│ 6. LIVING AI  │
│ • Supabase PG (Relasional)   │ • Transaksi Atomik Saldo     │ • Gemini 2.0  │
│ • MongoDB (Dokumen & Log)    │ • Helper Inventory Terkunci  │ • Server RAG  │
│ • Redis (Cache & Pub/Sub)    │ • Vitals, Dungeon, Gacha     │ • Voice Agent │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

Setiap pilar memiliki batas tanggung jawab (*boundary*) yang jelas. Modul UI tidak boleh mengeksekusi query database mentah, command handler hanya merutekan perintah, dan mutasi saldo selalu melalui manajer atomik.

---

## 🗺️ 2. Peta Navigasi Cepat Direktori

Gunakan tabel ini untuk menemukan lokasi kode dan memahami batasan modifikasi:

| Direktori | Tanggung Jawab & Isi | Batasan Agen (*Do's & Don'ts*) |
| --- | --- | --- |
| [`src/config/`](file:///d:/Naura%20Hoshino%20V2/src/config/) | Konfigurasi stateless (`env.js`, `ui.js`, `database.js`). | **HANYA** baca via modul ini. Jangan memanggil `process.env` langsung di tempat lain. |
| [`src/managers/`](file:///d:/Naura%20Hoshino%20V2/src/managers/) | Pengendali inti & stateful (`cacheManager.js`, `dbManager.js`, `redisManager.js`, `musicManager.js`, `aiDjManager.js`). | Modifikasi di sini jika berhubungan dengan state, caching, atau integrasi service luar. |
| [`src/models/`](file:///d:/Naura%20Hoshino%20V2/src/models/) | Skema Sequelize (PostgreSQL) dan Mongoose (`models/mongo/`). | Tambah model di sini. DILARANG `ALTER TABLE` di sini (wajib di `dbMigrator.js`). |
| [`src/services/`](file:///d:/Naura%20Hoshino%20V2/src/services/) | Engine komputasi latar (`fishAudioService.js`, `automationEngine.js`, `radioService.js`). | Tempatkan integrasi API pihak ketiga (TTS, webhook, automation) di folder ini. |
| [`src/canvas/`](file:///d:/Naura%20Hoshino%20V2/src/canvas/) | Generator gambar kartu profil & leveling berbasis worker threads. | Wajib melalui `canvasWorkerPool.js` agar tidak memblokir event loop Discord. |
| [`src/utils/`](file:///d:/Naura%20Hoshino%20V2/src/utils/) | Helper murni stateless (`NauraContainerBuilder.js`, `survivalUIHelper.js`, `uxHelper.js`). | Dilarang menyimpan state di sini. Helper harus deterministik dan reusable. |
| [`src/interactions/`](file:///d:/Naura%20Hoshino%20V2/src/interactions/) | Handler tombol, select menu, modal, autocomplete, dan context menu. | Wrap selalu dengan `safeExecute` dan tangani interaksi secara defensif. |
| [`plugin/`](file:///d:/Naura%20Hoshino%20V2/plugin/) | Subcommand dan router slash command (`core`, `music`, `admin`, `survival`). | **HANYA** untuk validasi input dan pemanggilan service/manager. Dilarang query DB mentah. |
| [`dashboard-v2/`](file:///d:/Naura%20Hoshino%20V2/dashboard-v2/) | Frontend web Vite MPA (`src/pages/`, `src/components/`, `public/models/`). | Komponen 3D Three.js berada di `src/components/NauraHeroViewer/` dan `NauraViewer/`. |
| [`scripts/`](file:///d:/Naura%20Hoshino%20V2/scripts/) | Script CLI pemeliharaan (`migrate.js`, `validate-locales.js`, `verify_dashboard_3d.js`). | Script uji mandiri & runner migrasi prestart. |

---

## 🛠️ 3. Skill & Kompetensi yang Dibutuhkan Agen AI

Saat menangani kode Naura Hoshino V2, agen AI diharapkan menguasai kemampuan teknis berikut:

### 3.1 Node.js 24 & Arsitektur CommonJS
- Kode bot ditulis dalam CommonJS (`require` dan `module.exports`).
- Untuk library yang hanya mendistribusikan format ESM (seperti Three.js addons), gunakan dynamic import asynchronous:
  ```javascript
  const { GLTFLoader } = await import('three/addons/loaders/GLTFLoader.js');
  ```
- Di skrip Node.js baru, akses API global browser seperti `WebSocket`, `FormData`, atau `Blob` wajib diawali dengan `globalThis.` agar tidak memicu error linter `no-undef`.

### 3.2 Discord Components V2 Layout Engineering
- Mampu menyusun respons interaktif menggunakan `buildContainerV2()` dari [`NauraContainerBuilder.js`](file:///d:/Naura%20Hoshino%20V2/src/utils/NauraContainerBuilder.js).
- Memahami struktur 5-lapisan Discord: Header -> Separator Garis -> Konten/Fields -> Separator Titik/Tombol -> Footer.
- Menggunakan `MessageFlags.IsComponentsV2` (nilai `32768`) dan `MessageFlags.Ephemeral`.
- Mengetahui bahwa custom emoji Discord dilarang di `authorName` dan `footerText` (wajib sanitasi via `ui.stripCustomEmojis()`).

### 3.3 Polyglot Database & Atomic Concurrency
- Menguasai Sequelize v6 untuk PostgreSQL/Supabase dan Mongoose v9 untuk MongoDB.
- Mampu membedakan kapan menggunakan relasional vs dokumen log vs in-memory cache Redis.
- **Wajib paham transaksi atomik**:
  - Saldo numerik: Gunakan `incrementUserProfile` / `debitUserProfile`.
  - JSON inventory: Gunakan `cacheManager.mutateUserProfileJson` atau `addItemsAtomic` / `takeItemsAtomic`.
  - Jangan pernah memanggil `row.save()` tanpa filter `fields: ['col']`.

### 3.4 Audio Engine & Fish Audio TTS Streaming
- Memahami alur Poru v5 pada node Lavalink v4.
- Menguasai pemanggilan Fish Audio API endpoint `/v1/tts` dengan model `s1` atau `tts-1`.
- Mampu mengalirkan audio radio/voice snippet intro sebelum musik dimainkan (`aiDjManager.js`).

### 3.5 WebGL, Three.js & Model 3D Avatar (GLTF/VRM)
- Memahami struktur file `.glb` dan `.vrm` (chunk biner glTF 2.0).
- Memahami konfigurasi Three.js PBR: `roughness`, `metalness`, `ACESFilmicToneMapping`, dan pengaturan `side: THREE.DoubleSide`.
- Mampu menjalankan verifikasi visual tanpa antarmuka grafis menggunakan Headless Chrome CDP (`scripts/verify_dashboard_3d.js`).

### 3.6 Lokalisasi & Standardisasi Gaya Teks
- Menjaga paritas 100% antara [`assets/language/id.json`](file:///d:/Naura%20Hoshino%20V2/assets/language/id.json) dan [`assets/language/en.json`](file:///d:/Naura%20Hoshino%20V2/assets/language/en.json).
- Menghindari penggunaan em dash (`\u2014`) pada semua teks dan string kamus.

---

## 📋 4. Standar Prosedur Operasional (SOP) Agen AI

### 4.1 Menambah Fitur atau Command Baru
1. Buat router slash command di [`plugin/<kategori>/<nama-command>.js`](file:///d:/Naura%20Hoshino%20V2/plugin/).
2. Daftarkan kunci terjemahan di `assets/language/id.json` dan `en.json` (pastikan sinkron).
3. Bungkus seluruh logika interaksi dalam `try/catch` defensif.
4. Bangun UI respons menggunakan `buildContainerV2()`.
5. Uji sintaks require: `npm run test:requires`.
6. Uji paritas bahasa: `npm run locales:check:strict`.

### 4.2 Menambah Kolom atau Skema Database Baru
1. Definisikan model di [`src/models/<ModelName>.js`](file:///d:/Naura%20Hoshino%20V2/src/models/).
2. Buat fungsi migrasi bernomor baru di [`src/managers/dbMigrator.js`](file:///d:/Naura%20Hoshino%20V2/src/managers/dbMigrator.js) (misal: `v19_add_new_feature`).
3. Catat migrasi di tabel `schema_migrations` agar tidak dieksekusi ganda.
4. Hubungkan akses baca/tulis ke [`src/managers/cacheManager.js`](file:///d:/Naura%20Hoshino%20V2/src/managers/cacheManager.js).

### 4.3 Checklist Validasi Kualitas Sebelum Melaporkan Selesai (QA Gate)
Sebelum meminta user mengonfirmasi atau melakukan commit, jalankan urutan ini:

```powershell
# 1. Pengecekan linter dan standar kode
npm run lint

# 2. Pengecekan larangan simbol em-dash
node scripts/check-em-dash.js

# 3. Pengecekan paritas kamus bahasa ID & EN
npm run locales:check:strict

# 4. Pengecekan integritas resolusi internal require
npm run test:requires

# 5. Menjalankan automated test suite
npm test
```

Semua 5 tahapan di atas WAJIB berstatus hijau (0 error).

---

## ⚠️ 5. Jebakan Kritis (*Fatal Gotchas*) yang Sering Terjadi

1. **Memanggil `process.env.XXX` langsung:**
   *Akibat:* Crash di lingkungan panel atau lint warning. Selalu impor `{ env }` dari `src/config/env.js`.
2. **Read-Modify-Write Saldo:**
   *Akibat:* Duplikasi saldo pemain saat double click tombol interaksi. Selalu gunakan `cacheManager.increment*` atau `debit*`.
3. **Menggunakan `ephemeral: true`:**
   *Akibat:* Warning lint dan inkonsistensi Discord v14. Selalu gunakan `flags: MessageFlags.Ephemeral`.
4. **Hardcode warna Hex di Modul Survival:**
   *Akibat:* Melanggar identitas sub-brand Naura Wilds. Selalu ambil token dari `survivalUIHelper.js`.
5. **Menyimpan `.env` ke Git:**
   *Akibat:* Kebocoran token kritis. File `.env` dilarang disentuh oleh `git add`.
6. **Menghapus Folder `.cache/`:**
   *Akibat:* Memicu deploy ulang seluruh slash command ke Discord API dan menghabiskan rate limit bot saat restart.

---

## 🔗 6. Dokumen Pendukung Terkait

- **Konstitusi & Aturan Hukum:** [`RULES.md`](RULES.md)
- **Panduan Desain & Token Visual:** [`DESIGN.md`](DESIGN.md)
- **Roadmap & Prioritas Sprint:** [`TODO.md`](TODO.md)
- **Ringkasan Publik & Instalasi:** [`README.md`](README.md)
