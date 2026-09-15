# 📦 PRODUCT REQUIREMENTS DOCUMENT (PRD), NAURA HOSHINO V2

> **Versi Dokumen:** 2.2.0  
> **Status:** Active / Production-Ready  
> **Target Rilis:** Ekosistem Naura Hoshino 2026-2027  
> **Pentalogi Dokumentasi:** [`README.md`](README.md) (Portal) · [`PRD.md`](PRD.md) (Produk) · [`DESIGN.md`](DESIGN.md) (Desain) · [`RULES.md`](RULES.md) (Teknis) · [`AGENTS.md`](AGENTS.md) (SOP Agen AI)

---

## 📑 DAFTAR ISI

1. [Ringkasan Eksekutif & Visi Produk](#1-ringkasan-eksekutif--visi-produk)
2. [Problem Statement & Nilai Pembeda (Value Proposition)](#2-problem-statement--nilai-pembeda-value-proposition)
3. [Target Audiens & Persona Pengguna](#3-target-audiens--persona-pengguna)
4. [Core User Journeys & Gameplay Loops](#4-core-user-journeys--gameplay-loops)
5. [Spesifikasi Kebutuhan Fungsional (6 Pilar Utama)](#5-spesifikasi-kebutuhan-fungsional-6-pilar-utama)
   - [Pilar 1: Bot Engine & Discord Components V2](#pilar-1-bot-engine--discord-components-v2)
   - [Pilar 2: Web Dashboard V2 & 3D Avatar Viewer](#pilar-2-web-dashboard-v2--3d-avatar-viewer)
   - [Pilar 3: Audio & Virtual AI DJ Companion](#pilar-3-audio--virtual-ai-dj-companion)
   - [Pilar 4: Polyglot Database & Arsitektur Atomik](#pilar-4-polyglot-database--arsitektur-atomik)
   - [Pilar 5: Survival RPG (Naura Wilds)](#pilar-5-survival-rpg-naura-wilds)
   - [Pilar 6: Living AI & Server Memory Engine](#pilar-6-living-ai--server-memory-engine)
6. [Kebutuhan Non-Fungsional (Non-Functional Requirements / NFR)](#6-kebutuhan-non-fungsional-non-functional-requirements--nfr)
7. [Ruang Lingkup & Prioritas Fitur (MoSCoW Framework)](#7-ruang-lingkup--prioritas-fitur-moscow-framework)
8. [Metrik Keberhasilan Produk (Success Metrics & KPIs)](#8-metrik-keberhasilan-produk-success-metrics--kpis)
9. [Asumsi, Ketergantungan Eksternal, & Manajemen Risiko](#9-asumsi-ketergantungan-eksternal--manajemen-risiko)
10. [Peta Hubungan Dokumen Ekosistem (Pentalogi Dokumentasi)](#10-peta-hubungan-dokumen-ekosistem-pentalogi-dokumentasi)

---

## 1. Ringkasan Eksekutif & Visi Produk

### 1.1 Visi Produk (Product Vision)
**Naura Hoshino V2** adalah platform pendamping Discord (*Living AI Companion*) dan ekosistem gamifikasi generasi baru berbasis tema Cyber-Anime Kosmik. Naura bukan sekadar bot utilitas mekanis dengan respon statis, melainkan entitas virtual cerdas dengan kepribadian hidup (hangat, cerdas, sedikit *tsundere-kuudere*, dan mencintai galaksi serta musik) yang menyatukan obrolan komunitas, petualangan RPG bertahan hidup, siaran audio interaktif, dan visual 3D modern ke dalam satu ekosistem terpadu.

### 1.2 DNA & Ciri Khas Brand
- **Living Character DNA:** Selalu menyapa anggota server dengan nama personal (`{displayName}` atau `{username}`), menghindari sebutan generik seperti *Master*, serta memiliki memori kontekstual terhadap interaksi lampau.
- **Glassmorphism Visual Identity:** Antarmuka visual bot di Discord mengadopsi standar Discord Components V2 lima lapisan yang bersih, ramah layar ponsel, serta kartu profil Canvas berstandar 60fps-like tanpa memblokir sistem.
- **Polyglot Atomic Reliability:** Menjamin zero duplication glitch pada ekonomi dan inventaris pemain melalui arsitektur multi-database terisolasi.

### 1.3 Standar Penomoran Versi Produk (X.Y.Z)
Untuk memudahkan identifikasi rilis bagi pengguna dan developer, produk menggunakan sistem tiga tingkat terpadu:
- **`X` (Generasi / Era Naura):** Menandakan era besar produk (`2` untuk era Naura Hoshino V2).
- **`Y` (Major Update):** Menandakan pembaruan arsitektur besar, peluncuran pilar baru, pembaruan moneter Currency V2, atau integrasi AI Ensemble.
- **`Z` (Minor Update):** Menandakan peningkatan bertahap, optimasi performa, balance patch, atau perbaikan bug.

---

## 2. Problem Statement & Nilai Pembeda (Value Proposition)

### 2.1 Masalah di Lanskap Bot Discord Saat Ini
1. **Mekanika Kaku & Tanpa Jiwa:** Kebanyakan bot populer (ekonomi/moderasi) beroperasi seperti formulir teks kaku atau sekadar merespons embed persegi panjang tanpa konteks personal.
2. **Fragmentasi Server:** Pemilik server terpaksa memasang 5-8 bot berbeda (satu bot untuk musik, satu untuk ekonomi, satu untuk leveling, satu untuk moderasi, satu untuk AI) yang sering kali crash, bersaing prefix, dan memperlambat server.
3. **Eksploitasi Bug Ekonomi:** Rentan race condition pada transaksi koin virtual karena bot menggunakan pola baca-tulis database sederhana tanpa kunci atomik.
4. **Desain Usang:** Masih mengandalkan Discord Embed tradisional yang terpotong di perangkat mobile dan tidak memanfaatkan Discord Components V2.

### 2.2 Nilai Pembeda Naura Hoshino V2 (Competitive Moat)
- **All-in-One Cyber-Anime Ecosystem:** Menyatukan 6 pilar besar (Engine, Web 3D, Audio/DJ, Polyglot DB, Survival RPG, Living AI) dalam satu tata kelola terintegrasi.
- **AI DJ Voice Streaming:** Mampu membuat intro siaran radio kustom bersuara natural (Fish Audio TTS) sebelum lagu diputar, menyebut lagu yang diminta dan nama peminta secara real-time.
- **Survival Naura Wilds Berbasis Transaksi Atomik:** Memiliki gameplay survival orisinil dengan indikator vital 3-warna, inventaris terkunci (`SELECT FOR UPDATE`), dan sistem dungeon kooperatif.
- **Web Dashboard 3D Avatar Interaktif:** Dilengkapi viewer 3D Three.js PBR rendering di browser yang tersinkronisasi langsung dengan status bot di Discord.

---

## 3. Target Audiens & Persona Pengguna

Untuk memastikan setiap fitur dibangun dengan fokus yang tajam, produk ini dirancang berdasarkan empat persona utama:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                              TARGET PERSONAS                                │
├──────────────────────────────┬──────────────────────────────┬───────────────┤
│ 👑 THE COMMUNITY BUILDER     │ 🌸 THE SOCIAL EXPLORER       │ ⚔️ THE WILDS  │
│ (Server Owner & Admin)       │ (Casual Member & Anime Fan)  │    ADVENTURER │
│ Butuh: Retensi tinggi, aman, │ Butuh: Teman AI yang hangat, │ (RPG Grinder) │
│ dashboard mudah, no-crash.   │ musik jernih, profil estetik.│ Butuh: Balans,│
├──────────────────────────────┴──────────────────────────────┴───────────────┤
│ 🎧 THE SERVER DJ & AUDIOPHILE (Music Lover)                                 │
│ Butuh: Lavalink jernih, radio intro TTS, playlist fleksibel, tanpa lag.     │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Persona 1: The Community Builder (Server Owner / Admin)
- **Kebutuhan:** Meningkatkan aktivitas obrolan anggota server, moderasi otomatis anti-nuke yang aman, dan dashboard web untuk mengelola konfigurasi tanpa menyentuh command teks rumit.
- **Titik Sakit (*Pain Points*):** Lelah dengan bot yang sering offline atau ekonomi server yang rusak akibat eksploitasi bug duplikasi koin.

### Persona 2: The Social Explorer (Casual Member / Anime Enthusiast)
- **Kebutuhan:** Bot interaktif yang menyenangkan untuk diajak ngobrol, memiliki kepribadian ramah, kartu profil yang cantik untuk dipamerkan, serta game mini yang santai.
- **Titik Sakit (*Pain Points*):** Bosan dengan bot yang hanya menjawab pesan error atau jawaban kaku seperti mesin pencari.

### Persona 3: The Wilds Adventurer (RPG & Survival Grinder)
- **Kebutuhan:** Tantangan bertahan hidup, berburu monster, memasak, meningkatkan perlengkapan, menambang fragmen bintang, dan berkompetisi di leaderboard server secara adil.
- **Titik Sakit (*Pain Points*):** Game bot Discord yang terlalu pay-to-win atau data progres yang hilang saat bot restart.

### Persona 4: The Server DJ & Audiophile (Music Lover)
- **Kebutuhan:** Kualitas audio 24/7 tanpa patah-patah, filter audio (bassboost, nightcore), kemudahan memutar dari YouTube/Spotify, dan sentuhan unik siaran radio AI.
- **Titik Sakit (*Pain Points*):** Bot musik yang sering diblokir atau suara putus-putus saat server Discord ramai.

---

## 4. Core User Journeys & Gameplay Loops

### 4.1 Onboarding & First-Touch Experience
```text
[ Invite Naura ] ──► [ Deteksi Otomatis & Booting ] ──► [ Sapaan Personal di Channel Utama ]
                             │                                     │
                             ▼                                     ▼
                   [ Default Setup Guard ]              [ Tampilan Quick Guide V2 ]
                   (Bahasa ID/EN Otomatis)              (Tombol Setup / Profile)
```
1. Bot diundang ke server Discord.
2. Bot mendeteksi izin channel dan menyapa channel utama dengan pesan selamat datang menggunakan Discord Components V2.
3. Menampilkan tombol interaktif: Ubah Bahasa (ID/EN), Buka Dashboard Web, atau Mulai Petualangan `/survival start`.

### 4.2 Loop Inti Survival RPG (Naura Wilds Core Loop)
```text
┌────────────────────────────────────────────────────────┐
│               NAURA WILDS SURVIVAL LOOP                │
│                                                        │
│  ┌──────────────┐     Gather / Hunt     ┌───────────┐  │
│  │ Eksplorasi & │ ────────────────────► │ Sumber    │  │
│  │ Vital Health │                       │ Daya/Item │  │
│  └──────────────┘                       └─────┬─────┘  │
│         ▲                                     │        │
│         │ Recovery & Buffs                    │ Craft  │
│         │                                     ▼        │
│  ┌──────┴───────┐   Challenge Boss      ┌───────────┐  │
│  │ Prestise &   │ ◄──────────────────── │ Dapur /   │  │
│  │ Leaderboard  │                       │ Workshop  │  │
│  └──────────────┘                       └───────────┘  │
└────────────────────────────────────────────────────────┘
```
- **Fase 1 (Survival):** Menjaga tiga indikator vital (Health, Hunger, Energy) agar karakter tidak pingsan.
- **Fase 2 (Gathering & Exploration):** Melakukan gathering material alam, berburu binatang liar, atau menambang Naura Star Fragments (NSF).
- **Fase 3 (Crafting & Cooking):** Mengolah bahan mentah menjadi makanan pemulih atau perlengkapan tempur di workshop.
- **Fase 4 (Combat & Dungeons):** Menantang dungeon monster bersama rekan satu server dalam mode raid.
- **Fase 5 (Ekonomi & Sosial):** Menjual hasil jarahan di pasar server, mendonasikan ke kas guild, atau membeli kosmetik profil.

### 4.3 Loop Interaksi Living AI & Komunitas
1. Anggota server menyebut nama Naura atau membalas pesan bot di channel obrolan.
2. Bot menganalisis konteks kalimat, memanggil memori server terkait preferensi user, dan menyusun jawaban cerdas.
3. Jika interaksi melibatkan aksi dalam server (contoh: mengecek cuaca server, memeriksa saldo, memainkan musik), AI mengeksekusi *Function Calling* otomatis.

---

## 5. Spesifikasi Kebutuhan Fungsional (6 Pilar Utama)

### Pilar 1: Bot Engine & Discord Components V2
- **FR-1.1 (Arsitektur Sharding):** Engine bot wajib mendukung sharding mandiri (`shard.js`) untuk mendistribusikan beban guild besar secara merata.
- **FR-1.2 (Components V2 Mandiri):** Seluruh pesan interaksi wajib menggunakan layout kontainer 5-lapisan resmi:
  1. *Header Layer:* Judul, ikon, dan nama autor yang telah disanitasi dari custom emoji.
  2. *Separator Layer:* Pemisah garis tipis atas (`divider: true`).
  3. *Content Layer:* Deskripsi utama, ringkasan status, atau media gambar.
  4. *Interaction Layer:* Baris tombol aksi (*ActionRow*) atau menu pilihan (*SelectMenu*).
  5. *Footer Layer:* Catatan waktu dan watermark versi.
  *(Standar visual diatur di [`DESIGN.md`](DESIGN.md#discord-components-v2-container-system), implementasi builder wajib diatur di [`RULES.md`](RULES.md#14-panduan-ui-discord-discord-components-v2))*
- **FR-1.3 (Modular Command Plugins):** Seluruh 55+ perintah terbagi dalam plugin independen (`core`, `music`, `admin`, `survival`, `economy`, `ai`).
- **FR-1.4 (Bilingual Support):** Sistem bahasa dinamis (ID & EN) tersimpan per guild dan per user dengan paritas kamus 100%.
- **FR-1.5 (Multimodal & Context Menu Standard):** Mendukung interaksi klik kanan pesan (*Discord Context Menu*) dan slash command `/vision` untuk inspeksi visual cepat.

### Pilar 2: Web Dashboard V2 & 3D Avatar Viewer
- **FR-2.1 (Vite MPA Frontend):** Dashboard web berbasis Multi-Page Application (MPA) yang terisolasi dari bot client.
- **FR-2.2 (3D Interactive Mascot & VRM):** Menampilkan model 3D Naura Hoshino (`Naura Hoshino 3D.glb` dan `naura.vrm`) dengan Three.js berbasis material PBR (*Physically Based Rendering*), SpringBones physics, pencahayaan Cyberpunk, interaksi mouse look-at tracking, dan verifikasi otomatis via Headless Chrome CDP (`scripts/verify_dashboard_3d.js`).
- **FR-2.3 (Telemetri Real-Time):** Mengalirkan metrik penggunaan memori, CPU, status shard, dan kontrol guild aktif via Socket.IO.
- **FR-2.4 (Otentikasi Discord OAuth2):** Login aman admin untuk mengubah pengaturan bot tanpa memasukkan token.
- **FR-2.5 (Web Soundboard Studio):** Soundboard interaktif bertenaga WebSocket Socket.IO dan Poru audio overlay untuk memicu pemutaran sound effect instan ke Voice Channel bot (`/soundboard`).

### Pilar 3: Audio & Virtual AI DJ Companion
- **FR-3.1 (Lavalink v4 & Poru v5):** Menghubungkan client Discord ke node Lavalink v4 dengan dukungan resolusi trek YouTube, SoundCloud, dan Spotify.
- **FR-3.2 (AI DJ Voice Radio Intro):** Fitur orisinil di mana sebelum lagu berputar, Naura menghasilkan narasi radio pendek via Fish Audio TTS:
  - Menyapa pemohon lagu dengan nama personalnya.
  - Memberikan komentar singkat yang sesuai dengan genre lagu.
  - Memutarkan trek audio tanpa jeda yang mengganggu (*seamless bridge*).
- **FR-3.3 (Audio Filters & Presets):** Pilihan filter instan (8D, Bassboost, Nightcore, Vaporwave, Karaoke vocal remover).
- **FR-3.4 (Lavalink Cluster Manager Multi-Tier):** Pengendali kluster multi-node bertingkat (Tier 1 Primary, Tier 2 Secondary, Tier 3 Fallback) dengan failover otomatis, pemantauan latensi, dan Circuit Breaker karantina node offline.

### Pilar 4: Polyglot Database & Arsitektur Atomik
- **FR-4.1 (PostgreSQL / Supabase Relasional):** Tempat penyimpanan data keuangan, saldo dompet/bank, relasi guild, dan profil leveling.
- **FR-4.2 (Redis Fast Cache & Write-Behind):** Cache in-memory berkecepatan tinggi untuk membaca data profil secara instan dengan flush otomatis ke database setiap 5 detik.
- **FR-4.3 (MongoDB Atlas Vault):** Penyimpanan dokumen tidak terstruktur untuk transkrip tiket HTML, audit log moderasi, dan riwayat obrolan AI.
- **FR-4.4 (Transaksi Atomik & Locking):** Setiap mutasi saldo numerik wajib menggunakan method atomik (`incrementUserProfile` / `debitUserProfile`), dan mutasi inventaris JSON wajib melalui transaksi database dengan klausa penguncian baris (`SELECT FOR UPDATE`). *(Ketentuan hukum transaksi diatur di [`RULES.md`](RULES.md#16-aturan-transaksi-saldo--penulisan-data-user))*
- **FR-4.5 (Ledger 41 Migrasi Skema Terstandarisasi):** Penegakan ledger `schema_migrations` pada 41 migrasi PostgreSQL (`v1` hingga `v41`) yang terisolasi dari proses booting bot.

### Pilar 5: Survival RPG (Naura Wilds)
- **FR-5.1 (Sistem Tri-Vital):** Karakter memiliki tiga bar status utama:
  - *Health (Darah):* Berkurang saat diserang monster atau kelaparan ekstrem.
  - *Hunger (Rasa Lapar):* Berkurang seiring waktu aktivitas, dipulihkan melalui makanan.
  - *Energy (Energi):* Digunakan untuk berburu, memancing, atau menambang, dipulihkan dengan istirahat/tidur.
  *(Palet earth-tone diatur di [`DESIGN.md`](DESIGN.md#naura-wilds-survival-sub-brand), tata kelola diatur di [`RULES.md`](RULES.md#15-desain-sistem-survival-naura-wilds))*
- **FR-5.2 (Mata Uang Tri-Tier):**
  - *NSF (Naura Star Fragments):* Mata uang utama survival untuk belanja perbekalan, makanan di kafe, dan upgrade alat.
  - *NC (Naura Coins):* Mata uang ekonomi server global untuk transfer antar pemain dan pasar saham.
  - *Naura Coupon:* Mata uang langka/prestise untuk gacha kosmetik dan Battle Pass.
- **FR-5.3 (Dungeon Raids & Combat Engine):** Sistem dungeon berbasis instans dengan tingkat kesulitan bertingkat (Normal, Heroic, Celestial) yang mendukung pertarungan bersama anggota server.
- **FR-5.4 (Inventory Locking Helper):** Penambahan atau pengurangan item wajib melalui `addItemsAtomic` atau `takeItemsAtomic` untuk mencegah duplikasi item saat pemain menekan tombol secara berulang. *(Wajib mematuhi [`RULES.md`](RULES.md#16-aturan-transaksi-saldo--penulisan-data-user))*
- **FR-5.5 (Dynamic Sentiment Astral Weather):** Cuaca kosmik harian server dievaluasi secara dinamis dari sentimen obrolan publik via Gemini, memicu buff global pada jarahan dungeon (`cosmic_storm`) dan diskon kafe (`sakura_breeze`).
- **FR-5.6 (Currency V2 & Closed-Loop Recycling Pool):** One-Way Bridge restriction (NSF ke Coin sah, Coin ke NSF dibatasi), dynamic spread transaction fee, alokasi 100% kas server `ServerTreasury` (40% Infra, 25% Undian, 20% Subsidi, 15% Merchant), serta sistem keausan alat (`durabilityEngine.js`).
- **FR-5.7 (Town Square & Living City NPC Simulation):** Alun-alun kota dinamis dengan jadwal harian NPC (Bagas, Luna, Kuro, Sakura), dialog interaktif berhadiah buff, dan event musiman (`/survival town`).

### Pilar 6: Living AI & Server Memory Engine
- **FR-6.1 (Model Gemini 2.0 / 2.5):** Integrasi AI generasi terbaru dengan penanganan konteks panjang dan kemampuan penalaran multimodal.
- **FR-6.2 (Server RAG & Semantic Vector Memory):** Menyimpan memori semantik kontekstual pengguna via cosine similarity di PostgreSQL (`semantic_memories`) dan riwayat percakapan di MongoDB Atlas.
- **FR-6.3 (Function Calling Otomatis):** AI dapat membaca intensi pengguna dan memanggil fungsi bot secara mandiri (misal: "Naura, tolong putarkan lagu lofi" langsung memicu player musik).
- **FR-6.4 (Etika Panggilan Personal):** Naura wajib menggunakan nama pengguna asli dan dilarang menggunakan sapaan budak/tuan seperti *Master*.
- **FR-6.5 (Cyber-Eye Multimodal Vision):** Menganalisis tangkapan layar (game gear, kode error, meme) secara *ephemeral/in-memory* dengan model Gemini Flash adaptif tanpa menyimpan berkas di disk bot demi privasi pengguna.
- **FR-6.6 (Multi-Model AI Ensemble Router):** Router cerdas yang otomatis memilih LLM terbaik (Gemini 2.5 Flash untuk kecepatan/multimodal, Groq LLaMA 3.3 untuk penalaran taktis, Ollama untuk mode darurat) berbasis latensi dan Circuit Breaker otomatis.

---

## 6. Kebutuhan Non-Fungsional (Non-Functional Requirements / NFR)

| Kategori | Standar Spesifikasi | Mekanisme Penegakan |
| :--- | :--- | :--- |
| **Responsivitas Discord** | Interaksi tombol/slash command wajib direspons dalam < 3.0 detik. | Gunakan `deferReply()` pada operasi database atau canvas yang membutuhkan waktu komputasi. |
| **Non-Blocking Canvas** | Pembuatan kartu profil grafis dilarang memblokir Event Loop Node.js. | Wajib dieksekusi di `src/canvas/canvasWorkerPool.js` berbasis Node.js Worker Threads. |
| **Integritas Finansial** | Toleransi 0% terhadap duplikasi koin atau item akibat balapan thread (*race condition*). | Transaksi atomik database (`SELECT FOR UPDATE`), penulisan bertahap (*write-behind cache*), dan idempotency key. |
| **Keamanan Kredensial** | Bebas kebocoran token bot, string database, dan API key. | Sentralisasi konfigurasi di `src/config/env.js`. Larangan keras commit file `.env`. |
| **Keamanan Webhook** | Verifikasi otentikasi webhook donasi/vote. | Verifikasi token wajib memakai `crypto.timingSafeEqual` (anti timing attack). |
| **Standardisasi Gaya Teks** | Larangan karakter em dash (`\u2014`) pada seluruh kode dan kamus. | Verifikasi otomatis melalui `node scripts/check-em-dash.js`. |
| **Ketersediaan Layanan** | Target 99.9% bot uptime di panel Pterodactyl. | Error catching defensif di interaction handler (`safeExecute`) dan sharding restart mandiri. |

---

## 7. Ruang Lingkup & Prioritas Fitur (MoSCoW Framework)

Untuk menjamin kualitas dan stabilitas rilis, fitur diklasifikasikan ke dalam 4 kuadran prioritas:

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRIORITAS FITUR (MoSCoW)                          │
├──────────────────────────────────────┬──────────────────────────────────────┤
│ 🔴 MUST-HAVE (Wajib Ada di v2.2/2.3) │ 🟡 SHOULD-HAVE (Sangat Dianjurkan)   │
│ • Engine Discord Components V2       │ • Web Soundboard Studio              │
│ • Transaksi atomik saldo & item      │ • Town Square Living City NPC        │
│ • Currency V2 Closed-Loop Pool       │ • Co-Op The Neo-Abyss Celestial Raid │
│ • AI Ensemble Router & CircuitBreak  │ • Hologram Item Card & Music Aura    │
│ • Lavalink Cluster Manager MultiTier │ • Paritas kamus bilingual 100%       │
│ • 3D Mascot PBR & VRM Three.js       │ • Global Guild Federation Hub        │
│ • Total Canvas Worker Offloading     │ • Cross-Server Caravan Cartel PvP    │
├──────────────────────────────────────┼──────────────────────────────────────┤
│ 🟢 COULD-HAVE (Penyempurnaan Nanti)  │ ⚪ WON'T-HAVE (Di Luar Cakupan v2.2) │
│ • Chibi 2.5D Room Decorator Live Grid│ • Integrasi Blockchain / Web3 / NFT  │
│ • Galactic Caravan Live Radar Web    │ • Transaksi uang nyata antar pemain  │
│ • Voice Intermezzo Federation Raid   │ • Self-hosted LLM on-premise lokal   │
└──────────────────────────────────────┴──────────────────────────────────────┘
```

---

## 8. Metrik Keberhasilan Produk (Success Metrics & KPIs)

Keberhasilan Naura Hoshino V2 dievaluasi berdasarkan indikator kuantitatif berikut:

### 8.1 North Star Metric
- **Daily Active Server Interactions (DASI):** Total akumulasi interaksi anggota server dengan bot per hari (mencakup eksekusi slash command, klik tombol Components V2, request lagu, dan dialog chat dengan AI).

### 8.2 Metrik Keterlibatan & Retensi (Engagement & Retention)
- **Survival Session Duration:** Rata-rata waktu yang dihabiskan anggota server saat berpetualang di Naura Wilds per hari (target: > 15 menit per user aktif).
- **Voice Channel Stickiness:** Durasi bot aktif memutar musik di voice channel dengan pendengar aktif (target: > 45 menit per sesi).
- **AI Companionship Turn Count:** Rata-rata jumlah giliran obrolan (*chat turns*) dalam satu sesi percakapan dengan AI (target: > 5 percakapan berkelanjutan).

### 8.3 Metrik Kualitas Teknis (System Reliability)
- **Zero Balance Inconsistency:** 0 insiden saldo negatif palsu atau duplikasi item per 100.000 transaksi.
- **Latency Under Load:** P95 latensi respon slash command berada di bawah 250ms pada kondisi bot menangani 500+ guild serentak.
- **Clean Quality Gate:** 100% lolos seluruh checklist pengujian (`npm run lint`, `check-em-dash`, `test:requires`, `npm test`).

---

## 9. Asumsi, Ketergantungan Eksternal, & Manajemen Risiko

### 9.1 Ketergantungan Eksternal
1. **Discord API Gateway (v14):** Bergantung pada ketersediaan WebSocket Discord dan stabilitas dukungan Components V2.
2. **Google Gemini API:** Penyedia layanan inferensi AI untuk percakapan cerdas dan function calling.
3. **Fish Audio API:** Penyedia engine TTS sintetis untuk suara AI DJ dan respons suara.
4. **Supabase & MongoDB Atlas:** Layanan cloud database yang membutuhkan koneksi internet stabil dengan latensi rendah.

### 9.2 Manajemen Risiko & Rencana Mitigasi

| Potensi Risiko | Dampak | Rencana Mitigasi (Fallback Strategy) |
| :--- | :--- | :--- |
| **API Gemini Rate Limit / Timeout** | Chat AI terhenti sementara. | Fallback ke pesan ramah terprogram di kamus i18n lokal tanpa merusak bot. |
| **Koneksi Lavalink Node Terputus** | Musik berhenti berputar. | Auto-reconnect otomatis dengan reconnect exponential backoff di `musicManager.js`. |
| **Lonjakan Render Canvas Profil** | Event loop bot melambat. | Ditangani oleh Worker Threads pool dengan antrean task berbatas (*bounded queue*). |
| **Koneksi Postgres Terputus** | Data pemain berisiko tidak tersimpan. | Redis write-behind cache menahan mutasi data sementara sampai koneksi database pulih. |

---

## 10. Peta Hubungan Dokumen Ekosistem (Pentalogi Dokumentasi)

Sebagai pengembang atau agen AI yang berkontribusi pada repositori ini, posisikan dokumen ini dalam **Pentalogi Dokumentasi Naura Hoshino V2**:

```text
                       ┌─────────────────────────┐
                       │        README.md        │
                       │  "Gerbang & Pengenalan" │
                       │ (Portal, Instalasi, Aset)
                       └────────────┬────────────┘
                                    │
                       ┌────────────▼────────────┐
                       │         PRD.md          │
                       │  "Apa & Mengapa Dibuat" │
                       │(Visi, Personas, 6 Pilar)│
                       └────────────┬────────────┘
                                    │
                  ┌─────────────────┴─────────────────┐
                  ▼                                   ▼
   ┌─────────────────────────────┐     ┌─────────────────────────────┐
   │          DESIGN.md          │     │          RULES.md           │
   │  "Bagaimana tampilannya?"   │     │ "Bagaimana mengeksekusinya?"│
   │ (Tokens, Glassmorphism, UI) │     │ (Konstitusi Kode & Arsitek) │
   └─────────────────────────────┘     └─────────────────────────────┘
                  │                                   │
                  └─────────────────┬─────────────────┘
                                    ▼
                       ┌─────────────────────────┐
                       │        AGENTS.md        │
                       │ "Bagaimana agen bekerja"│
                       │  (Peta Folder & SOP QA) │
                       └─────────────────────────┘
```

| Dokumen | Sumber Kebenaran (*Source of Truth*) | Pertanyaan Utama yang Dijawab |
| :--- | :--- | :--- |
| [`README.md`](README.md) | **Portal & Instalasi Publik** | "Bagaimana cara memasang, mengonfigurasi env, dan melihat ringkasan fitur?" |
| [`PRD.md`](PRD.md) | **Kebutuhan Produk & Personas** | "Apa yang sedang dibangun, mengapa dibuat, untuk siapa, dan apa batasan prioritasnya?" |
| [`DESIGN.md`](DESIGN.md) | **Sistem Desain & Visual Tokens** | "Bagaimana aturan warna, glassmorphism, 3D avatar viewer, dan Components V2?" |
| [`RULES.md`](RULES.md) | **Konstitusi & Standar Teknis** | "Bagaimana hukum kode, transaksi atomik database, keamanan, dan anti-crash?" |
| [`AGENTS.md`](AGENTS.md) | **Navigasi & SOP AI Agent** | "Di mana letak file-nya, bagaimana alur data interaksi ke database, dan apa checklist QA?" |
| [`TODO.md`](TODO.md) | **Roadmap & Sprint Backlog** | "Pekerjaan apa yang sedang berlangsung dan apa prioritas berikutnya?" |
