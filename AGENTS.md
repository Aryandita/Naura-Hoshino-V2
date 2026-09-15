# 🤖 PANDUAN KERJA & ORIENTASI AGENT AI, NAURA HOSHINO V2

> **Target:** AI Coding Assistants (Antigravity, Roo Code, Claude, Copilot, & Developer Manusia)  
> **Versi Ekosistem:** 2.3.0 · **Engine:** 2.3.0 · **Runtime:** Node.js ≥ 24 · **Framework:** discord.js v14  
> **Pentalogi Dokumentasi:** [`README.md`](README.md) (Portal) · [`PRD.md`](PRD.md) (Produk) · [`DESIGN.md`](DESIGN.md) (Desain) · [`RULES.md`](RULES.md) (Teknis) · [`AGENTS.md`](AGENTS.md) (SOP Agen AI)

> [!IMPORTANT]
> **Aturan Wajib & Tata Kelola:** Seluruh aturan hukum kode, konvensi penamaan, standar keamanan, layout Components V2, dan ketentuan atomisitas database berada di [`RULES.md`](RULES.md). Spesifikasi fungsional dan kebutuhan pengguna berada di [`PRD.md`](PRD.md), dan standar visual berada di [`DESIGN.md`](DESIGN.md). Dokumen ini berfokus pada **cara agen memahami arsitektur proyek, peta navigasi cepat, kompetensi/skill yang diperlukan, dan prosedur eksekusi tugas**.

---

## 🧭 1. Mental Model Ekosistem Naura Hoshino V2 (v2.3.0)

Sebagai agen AI, bayangkan Naura Hoshino V2 sebagai platform terintegrasi dengan **6 Pilar Utama**:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                         NAURA HOSHINO V2 ECOSYSTEM                          │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ 1. BOT ENGINE (discord.js)   │ 2. WEB DASHBOARD V2 (Vite)   │ 3. AUDIO & DJ │
│ • Sharding & Event Router    │ • Self-contained MPA         │ • Lavalink Cluster Manager    │
│ • Components V2 (5 Lapisan)  │ • 3D Mascot (Three.js/VRM)   │ • Poru v5 & Failover Nodes    │
│ • 55+ Slash Command Plugins  │ • Web Soundboard Studio      │ • Fish Audio AI DJ Companion  │
├──────────────────────────────┼──────────────────────────────┼───────────────┤
│ 4. POLYGLOT DATABASE         │ 5. SURVIVAL RPG (Naura Wilds)│ 6. LIVING AI  │
│ • Supabase PG (41 Migrasi)   │ • Currency V2 Closed-Loop    │ • AI Ensemble (Gemini/Groq)   │
│ • MongoDB (Dokumen & Log)    │ • ServerTreasury & Vitals    │ • Semantic Vector Memory      │
│ • Redis (Cache, Mutex Lock)  │ • Durability & Town Square   │ • Server RAG & Voice Agent    │
└──────────────────────────────┴──────────────────────────────┴───────────────┘
```

Setiap pilar memiliki batas tanggung jawab (_boundary_) yang jelas. Modul UI tidak boleh mengeksekusi query database mentah, command handler hanya merutekan perintah, dan mutasi saldo selalu melalui manajer atomik.

---

## 🗺️ 2. Peta Navigasi Cepat Direktori

Gunakan tabel ini untuk menemukan lokasi kode dan memahami batasan modifikasi:

| Direktori                                                                | Tanggung Jawab & Isi                                                                                                    | Batasan Agen (_Do's & Don'ts_)                                                            |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`src/config/`](file:///d:/Naura%20Hoshino%20V2/src/config/)             | Konfigurasi stateless (`env.js`, `ui.js`, `database.js`, `lavalink-fallbacks.json`).                                    | **HANYA** baca via modul ini. Jangan memanggil `process.env` langsung di tempat lain.     |
| [`src/managers/`](file:///d:/Naura%20Hoshino%20V2/src/managers/)         | Pengendali inti & stateful (`cacheManager.js`, `dbManager.js`, `lavalinkClusterManager.js`, `musicManager.js`).       | Modifikasi di sini jika berhubungan dengan state, caching, atau integrasi service luar.   |
| [`src/models/`](file:///d:/Naura%20Hoshino%20V2/src/models/)             | Skema Sequelize (`ServerTreasury.js`, `UserProfile.js`) dan Mongoose (`models/mongo/`).                                 | Tambah model di sini. DILARANG `ALTER TABLE` di sini (wajib di `dbMigrator.js`).          |
| [`src/services/`](file:///d:/Naura%20Hoshino%20V2/src/services/)         | Engine komputasi latar (`soundboardService.js`, `fishAudioService.js`, `economyGuardEngine.js`, `seasonEngine.js`).     | Tempatkan integrasi API pihak ketiga (TTS, webhook, automation) di folder ini.            |
| [`src/ai/`](file:///d:/Naura%20Hoshino%20V2/src/ai/)                     | Engine kecerdasan AI (`aiEnsembleRouter.js`, `semanticMemoryService.js`, `aiMemory.js`, `tribunalEngine.js`).          | Wajib menyertakan penanganan failover dan circuit breaker rate limit (HTTP 429).          |
| [`src/survival/`](file:///d:/Naura%20Hoshino%20V2/src/survival/)         | Core logika Naura Wilds (`currency.js`, `recyclingPoolEngine.js`, `durabilityEngine.js`, `townEngine.js`).             | Wajib deterministik dan transaksi saldo terhubung ke `cacheManager` atau `ServerTreasury`.|
| [`src/canvas/`](file:///d:/Naura%20Hoshino%20V2/src/canvas/)             | Generator gambar kartu profil, item, kartu ulang tahun, & leveling berbasis worker threads.                            | Wajib melalui `canvasWorkerPool.js` agar tidak memblokir event loop Discord.              |
| [`src/utils/`](file:///d:/Naura%20Hoshino%20V2/src/utils/)               | Helper murni stateless (`NauraContainerBuilder.js`, `survivalUIHelper.js`, `uxHelper.js`).                              | Dilarang menyimpan state di sini. Helper harus deterministik dan reusable.                |
| [`src/interactions/`](file:///d:/Naura%20Hoshino%20V2/src/interactions/) | Handler tombol, select menu, modal, autocomplete, dan context menu.                                                     | Wrap selalu dengan `safeExecute` dan tangani interaksi secara defensif.                   |
| [`plugin/`](file:///d:/Naura%20Hoshino%20V2/plugin/)                     | Subcommand dan router slash command (`core`, `music`, `admin`, `survival`, `naura`).                                    | **HANYA** untuk validasi input dan pemanggilan service/manager. Dilarang query DB mentah. |
| [`dashboard/`](file:///d:/Naura%20Hoshino%20V2/dashboard/)               | Web Dashboard terintegrasi (Express backend & Vite MPA frontend).                                                       | Komponen 3D Three.js di `src/components/NauraHeroViewer/` dan `NauraViewer/`.             |
| [`scripts/`](file:///d:/Naura%20Hoshino%20V2/scripts/)                   | Script CLI pemeliharaan (`migrate.js`, `validate-locales.js`, `verify_dashboard_3d.js`, `check-em-dash.js`).           | Script uji mandiri & runner migrasi prestart.                                             |

---

## 🛠️ 3. Skill & Kompetensi yang Dibutuhkan Agen AI

Saat menangani kode Naura Hoshino V2, agen AI diharapkan menguasai kemampuan teknis berikut:

### 3.1 Node.js 24 & Arsitektur CommonJS

- Kode bot ditulis dalam CommonJS (`require` dan `module.exports`).
- Untuk library yang hanya mendistribusikan format ESM (seperti Three.js addons), gunakan dynamic import asynchronous:
  ```javascript
  const { GLTFLoader } = await import("three/addons/loaders/GLTFLoader.js");
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

### 3.7 Tata Kelola Penomoran Versi (X.Y.Z)

Seluruh perubahan versi ekosistem wajib mematuhi skema semantik tiga tingkat:
- **`X` (Versi Keseluruhan / Generasi Era):** Ditentukan oleh owner proyek (saat ini bernilai `2` untuk era Naura Hoshino V2). Agen AI dilarang mengubah angka X tanpa instruksi eksplisit pengguna.
- **`Y` (Major Update):** Dinaikkan saat terjadi rilis arsitektur besar, penambahan pilar baru, pembaruan moneter besar (seperti Currency V2 Closed-Loop), integrasi AI Ensemble, atau kluster audio Lavalink.
- **`Z` (Minor Update):** Dinaikkan saat merilis perbaikan bug (bugfix), optimasi performa, balancing RPG/ekonomi, atau penyesuaian stabilitas berkala.

### 3.8 AI Ensemble Router & Circuit Breaker Logic

- Memahami arsitektur pemetaan tugas cerdas pada `src/ai/aiEnsembleRouter.js`:
  - `GENERAL_CONVERSATION`, `FAST_RESPONSE`, `VISION_MULTIMODAL` dipetakan ke Gemini 2.5 Flash.
  - `TACTICAL_REASONING`, `TRIBUNAL_VERDICT` dipetakan ke Groq LLaMA 3.3.
  - `OFFLINE_FALLBACK` dipetakan ke Ollama lokal.
- Menguasai penanganan status Circuit Breaker (`CLOSED` -> `OPEN` -> `HALF-OPEN`) saat API pihak ketiga mengalami error kuota 429 atau downtime.

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
2. Buat fungsi migrasi bernomor baru di [`src/managers/dbMigrator.js`](file:///d:/Naura%20Hoshino%20V2/src/managers/dbMigrator.js) (misal: `v42_add_new_feature`).
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

# 5. Menjalankan automated test suite (254 tests wajib 100% hijau)
npm test
```

Semua 5 tahapan di atas WAJIB berstatus hijau (0 error).

---

## ⚠️ 5. Jebakan Kritis (_Fatal Gotchas_) yang Sering Terjadi

1. **Memanggil `process.env.XXX` langsung:**
   _Akibat:_ Crash di lingkungan panel atau lint warning. Selalu impor `{ env }` dari `src/config/env.js`.
2. **Read-Modify-Write Saldo:**
   _Akibat:_ Duplikasi saldo pemain saat double click tombol interaksi. Selalu gunakan `cacheManager.increment*` atau `debit*`.
3. **Menggunakan `ephemeral: true`:**
   _Akibat:_ Warning lint dan inkonsistensi Discord v14. Selalu gunakan `flags: MessageFlags.Ephemeral`.
4. **Hardcode warna Hex di Modul Survival:**
   _Akibat:_ Melanggar identitas sub-brand Naura Wilds. Selalu ambil token dari `survivalUIHelper.js`.
5. **Menyimpan `.env` ke Git:**
   _Akibat:_ Kebocoran token kritis. File `.env` dilarang disentuh oleh `git add`.
6. **Menghapus Folder `.cache/`:**
   _Akibat:_ Memicu deploy ulang seluruh slash command ke Discord API dan menghabiskan rate limit bot saat restart.

---

## 🧭 7. Panduan Membaca & Memahami Kode bagi Developer (Keterbacaan & Navigasi)

Jika di kemudian hari kamu kembali ke repositori ini dan lupa bagaimana fitur-fiturnya terhubung, gunakan ringkasan alur berikut sebagai panduan mental:

### 7.1 Diagram Alur Eksekusi (Dari Discord ke Database)

```text
[ Pengguna Discord Mengetik Command / Mengklik Tombol ]
                         │
                         ▼
        [ Discord Gateway WebSocket ]
                         │
                         ▼
  [ src/events/interactionCreate.js ] (Router Pusat)
   ├── Is Autocomplete? ──► [ src/interactions/autocomplete.js ]
   ├── Is Button/Select? ──► [ src/interactions/safeExecute.js ] ──► [ buttons/ / selects/ ]
   └── Is Slash Command? ──► [ CommandHandler.js ]
                                   │
                                   ▼
                   [ plugin/<kategori>/<command>.js ]
                                   │
                    ┌──────────────┴──────────────┐
                    ▼                             ▼
        [ Kalkulasi Murni & Aturan ]    [ Transaksi Data & State ]
        (src/domain/decisions/)          (src/managers/cacheManager.js)
        - Hitung XP / Level              - decrement / increment atomik
        - Validasi kecukupan biaya       - mutateJson (SELECT FOR UPDATE)
                    │                             │
                    └──────────────┬──────────────┘
                                   │
                                   ▼
         [ Render UI Respons: src/utils/NauraContainerBuilder.js ]
             (Discord Components V2: Header -> Body -> Tombol -> Footer)
                                   │
                                   ▼
                 [ interaction.reply(payload) ]
```

### 7.2 Glosarium Konsep & Terminologi Domain

| Istilah                        | Arti & Tanggung Jawab                                                                                                 | Lokasi Kode Kunci                                                                    |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| **NSF (Naura Star Fragments)** | Mata uang umum survival untuk belanja barang biasa, makan di kafe, dan upgrade perlengkapan.                          | `UserSurvival.starFragments` via `cacheManager.incrementUserSurvival`                |
| **NC (Naura Coins)**           | Mata uang ekonomi global server (dompet & bank) untuk transfer pemain dan pasar saham.                                | `UserProfile.economy_wallet`, `economy_bank` via `cacheManager.incrementUserProfile` |
| **Naura Coupon**               | Mata uang langka/premium survival untuk upgrade Battle Pass dan gacha khusus.                                         | Kolom numerik `UserSurvival.coupons`                                                 |
| **Components V2**              | Format pesan modern Discord berbasis Container 5-lapisan (bukan embed tradisional).                                   | `src/utils/NauraContainerBuilder.js`                                                 |
| **Write-Behind Cache**         | Sistem penulisan bertahap di mana data diubah di Redis/memori secara instan lalu di-flush ke Postgres setiap 5 detik. | `src/managers/cacheManager.js`                                                       |
| **Naura Wilds**                | Sub-brand sistem survival hybrid cyberpunk-nature dengan bar vital 3-warna (moss, amber, danger).                     | `src/utils/survivalUIHelper.js`                                                      |

### 7.3 Standar Dokumentasi Mandiri (Self-Documenting Code)

Saat menambahkan fungsi atau modul baru:

1. **Gunakan JSDoc berbahasa Indonesia** di setiap fungsi publik yang menjelaskan `@param`, `@returns`, dan kemungkinan gagal.
2. **Pisahkan Logika Murni (Law 5)**: Rumus hitungan matematika harus berada di fungsi tanpa side-effects agar tidak memerlukan mock database saat di-test.
3. **Gunakan Guard Clauses (Law 1)**: Letakkan pengecekan error/izin di baris pertama dengan `return` awal agar alur utama (_happy path_) tetap berada di indentasi terluar dan mudah dibaca secara cepat.

---

## 🔗 8. Dokumen Pendukung Terkait (Pentalogi Dokumentasi)

Seluruh agen AI dan kontributor wajib merujuk pada pilar dokumentasi yang tepat sesuai dengan ranah tugasnya:

| Dokumen | Sumber Kebenaran (*Source of Truth*) | Kapan Agen Wajib Membacanya? |
| :--- | :--- | :--- |
| [`README.md`](README.md) | **Portal & Instalasi Publik** | Saat butuh gambaran arsitektur umum, dependensi runtime, atau langkah setup lokal. |
| [`PRD.md`](PRD.md) | **Kebutuhan Produk & Personas** | Saat merancang fitur baru, memahami *what & why*, target persona, dan prioritas MoSCoW. |
| [`DESIGN.md`](DESIGN.md) | **Bahasa Desain & UI Tokens** | Saat membuat tampilan UI bot (Components V2), web dashboard, token warna, atau model 3D. |
| [`RULES.md`](RULES.md) | **Konstitusi & Standar Teknis** | Sebelum menulis kode: patuhi transaksi atomik DB, larangan em-dash, dan anti-crash. |
| [`AGENTS.md`](AGENTS.md) | **Navigasi & SOP AI Agent** | Untuk memetakan direktori file, alur eksekusi, dan menjalankan checklist QA sebelum commit. |
| [`TODO.md`](TODO.md) | **Roadmap & Sprint Backlog** | Untuk melihat status tugas yang sedang dikerjakan dan backlog sprint berikutnya. |
| [`.agents/skills/naura-dev/SKILL.md`](.agents/skills/naura-dev/SKILL.md) | **Workspace Skill Naura Dev** | Prosedur cepat eksekusi subagent untuk development bot. |

