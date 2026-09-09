<div align="center">

# 🌸 Naura Hoshino V2

**Bot Discord Multifungsi & AI Companion Berbasis `discord.js` v14**  
Menghadirkan UI Discord Components V2, Web Dashboard Interaktif dengan Avatar 3D (Three.js PBR & VRM), Pemutar Musik Lavalink v4 dengan Fish Audio AI DJ, Ekosistem Survival RPG Naura Wilds, dan Arsitektur Polyglot Database.

<br />

[![Versi](https://img.shields.io/badge/Versi-2.1.0-FFB6C1?style=for-the-badge)](package.json)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2024.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20Local-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Cache%20%26%20PubSub-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Lavalink](https://img.shields.io/badge/Lavalink-v4-FF6B6B?style=for-the-badge&logo=musicbrainz&logoColor=white)](https://lavalink.dev)
[![License](https://img.shields.io/badge/License-ISC-8A2BE2?style=for-the-badge)](LICENSE)

</div>

<br />

> [!NOTE]
> Proyek ini beroperasi di atas arsitektur **Polyglot Database** (Supabase PostgreSQL, MongoDB, Redis, dan fallback SQLite darurat). Seluruh milestone pengembangan hingga **Sprint 22** telah rampung, termasuk integrasi model 3D/VRM PBR HD di Web Dashboard V2, Fish Audio TTS AI DJ Companion, dan UI Discord Components V2 terstandarisasi.

### 📌 Referensi Dokumen & Sumber Kebenaran (Pentalogi Dokumentasi)

| Item                    |      Nilai / Berkas      | Keterangan                                                     |
| ----------------------- | :----------------------: | -------------------------------------------------------------- |
| **Versi Bot & Engine**  |         `2.1.0`          | [`package.json`](package.json)                                 |
| **Runtime Minimum**     |   Node.js `>= 24.0.0`    | `engines` di [`package.json`](package.json)                    |
| **Kebutuhan & Produk**  |   [`PRD.md`](PRD.md)     | Spesifikasi produk, persona pengguna, dan batasan 6 pilar      |
| **Token Visual & UI**   | [`DESIGN.md`](DESIGN.md) | Style guide Cyber-Anime Glassmorphism & Naura Wilds            |
| **Aturan & Konstitusi** |  [`RULES.md`](RULES.md)  | Aturan hukum, arsitektur, transaksi atomik, dan keamanan wajib |
| **Panduan AI Agent**    | [`AGENTS.md`](AGENTS.md) | Peta navigasi arsitektur, alur data interaksi, dan SOP agen    |
| **Roadmap Sprint**      |   [`TODO.md`](TODO.md)   | Prioritas fitur dan backlog pekerjaan                          |

---

## ✨ Fitur Unggulan

<div align="center">
<table>
  <tr>
    <td width="33%" align="center">
      <h3>🌸 Living AI Companion</h3>
      <p>Percakapan interaktif berbasis Gemini 2.0 dengan memori jangka panjang, RAG server knowledge, dan voice agent waifu (<code>/naura</code>).</p>
    </td>
    <td width="33%" align="center">
      <h3>🎵 Poru Music & AI DJ</h3>
      <p>Audio Lavalink v4 dengan Spotify ISRC resolver, 24/7 filter, serta penyiar radio anime interaktif bertenaga <strong>Fish Audio TTS</strong> (<code>/music dj</code>).</p>
    </td>
    <td width="33%" align="center">
      <h3>🌐 Web Dashboard & 3D</h3>
      <p>Dashboard MPA mandiri (Vite + Tailwind) dengan telemetri realtime Socket.IO dan avatar 3D anime interaktif (Three.js PBR 2K & VRM SpringBones).</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>🎮 Naura Wilds Survival</h3>
      <p>Dunia RPG & ekonomi berlapis dengan transaksi saldo atomik, inventory terkunci, 55+ sistem dungeon, gacha, crafting, dan virtual pet.</p>
    </td>
    <td align="center">
      <h3>💬 Discord Components V2</h3>
      <p>Tampilan pesan interaktif 5-lapisan modern menggunakan spesifikasi Discord Components V2 resmi, ramah mobile dan bebas embed usang.</p>
    </td>
    <td align="center">
      <h3>🛡️ Automod & Keamanan</h3>
      <p>Proteksi Anti-Nuke proaktif, Scammer Honeypot trap otomatis, ModMail thread pribadi, dan sistem tiket terintegrasi transkrip HTML.</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>🗄️ Polyglot Persistence</h3>
      <p>Pemisahan domain data transaksional (PostgreSQL), audit dokumen (MongoDB), cache cepat (Redis), dan fallback darurat (SQLite).</p>
    </td>
    <td align="center">
      <h3>🌍 Sistem Bilingual</h3>
      <p>Dukungan penuh Bahasa Indonesia dan English yang tersimpan secara personal per-pengguna dengan paritas kamus 100% konsisten.</p>
    </td>
    <td align="center">
      <h3>🎨 Dedicated Canvas Worker</h3>
      <p>Rendering kartu profil, level, dan statistik didelegasikan ke dedicated <code>worker_threads</code> pool agar event loop bot tetap responsif.</p>
    </td>
  </tr>
</table>
</div>

---

## 🧩 Kebutuhan Sistem

| Status | Komponen          | Versi Minimal | Keterangan                                                                                             |
| :----: | ----------------- | :-----------: | ------------------------------------------------------------------------------------------------------ |
|   🟢   | **Node.js**       |  `>= 24.0.0`  | Sangat wajib. Menggunakan `process.loadEnvFile()`, global `fetch`, dan test runner bawaan `node:test`. |
|   ⚡   | **Supabase (PG)** |  PostgreSQL   | Basis data transaksional dan relasional utama.                                                         |
|   🍃   | **MongoDB**       |   `>= 7.x`    | Basis data dokumen untuk audit log, transkrip tiket, dan riwayat chat AI.                              |
|   🔴   | **Redis**         |  _Opsional_   | Cache in-memory dan Pub/Sub invalidasi lintas shard.                                                   |
|   🎧   | **Lavalink**      |     `v4`      | Wajib untuk memutar audio musik berkualitas tinggi.                                                    |
|   🎬   | **FFmpeg**        |   _Terbaru_   | Otomatis tersedia melalui paket `ffmpeg-static`.                                                       |

---

## 🚀 Instalasi & Menjalankan Bot

Ikuti langkah mudah berikut untuk menjalankan bot di lingkungan lokal atau server:

```bash
# 1. Kloning repositori
git clone https://github.com/Aryandita/Naura-Hoshino-V2.git

# 2. Masuk ke direktori
cd Naura-Hoshino-V2

# 3. Pastikan Node.js versi 24 atau lebih tinggi
node -v

# 4. Pasang seluruh dependensi
npm install

# 5. Siapkan konfigurasi lingkungan
cp .env.example .env

# 6. Buka file .env dan lengkapi token Discord serta kredensial database

# 7. Jalankan bot (migrasi database berjalan otomatis sebelum bot menyala)
npm start
```

> [!TIP]
> Script `prestart` di `package.json` akan menjalankan `node scripts/migrate.js` secara otomatis sebelum proses bot dimulai. Jika migrasi skema gagal, bot tidak akan dijalankan untuk mencegah inkonsistensi database.

---

## 🐦 Deploy di Panel Pterodactyl

Untuk deployment di panel game/bot Pterodactyl:

| Kolom Panel   | Nilai          | Keterangan                                                       |
| ------------- | -------------- | ---------------------------------------------------------------- |
| `CMD_RUN`     | `npm start`    | Menjalankan build dashboard, migrasi skema, lalu ShardingManager |
| Docker Image  | Node.js **24** | Wajib menggunakan container image Node 24+                       |
| `AUTO_UPDATE` | `1`            | Mengaktifkan auto-pull git commit terbaru saat restart server    |

---

## 📜 Script NPM yang Tersedia

| Perintah                          | Deskripsi Fungsi                                                                  |
| --------------------------------- | --------------------------------------------------------------------------------- |
| 🚀 `npm start`                    | Menjalankan bot untuk produksi melalui `shard.js` (didahului `prestart` migrasi). |
| 🔄 `npm run dev`                  | Menjalankan bot dengan fitur auto-reload menggunakan `node --watch`.              |
| 🗃️ `npm run db:migrate`           | Menjalankan migrasi skema database Sequelize secara manual.                       |
| 🧪 `npm test`                     | Menjalankan automated test suite bawaan (`node:test`).                            |
| 🔍 `npm run lint`                 | Melakukan audit standar kode dengan ESLint v10.                                   |
| 🔧 `npm run lint:fix`             | Memperbaiki format kode yang menyimpang secara otomatis.                          |
| 🌐 `npm run locales:check:strict` | Memeriksa kelengkapan dan sinkronisasi kamus bahasa ID vs EN.                     |
| 🛡️ `npm run test:requires`        | Memverifikasi seluruh modul require internal dapat diselesaikan dengan benar.     |

---

## 🔐 Konfigurasi Environment Ringkas

Kredensial disimpan di file `.env` dan diakses melalui [`src/config/env.js`](src/config/env.js):

- **Core Discord**: `DISCORD_TOKEN`, `CLIENT_ID`, `PREFIX`, `OWNER_IDS`.
- **Database**: `DATABASE_URL` / `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `MONGO_URI`, `REDIS_URL`.
- **Audio & Musik**: `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`, `SPOTIFY_CLIENT_ID`, `SPOTIFY_CLIENT_SECRET`.
- **AI & TTS**: `GEMINI_API_KEY`, `FISH_AUDIO_API_KEY`, `FISH_AUDIO_VOICE_ID`, `AI_DJ_ENABLED`.
- **Web Dashboard**: `PORT` (default: 3070), `SESSION_SECRET`, `DISCORD_CLIENT_SECRET`, `DISCORD_CALLBACK_URL`.

---

## 🗂️ Struktur Direktori Inti

```text
Naura-Hoshino-V2/
├── shard.js                 # ShardingManager entry point
├── index.js                 # Bot client instance per-shard
├── PRD.md                   # Product Requirements Document (kebutuhan produk & personas)
├── RULES.md                 # Konstitusi & aturan arsitektur wajib
├── AGENTS.md                # Panduan teknis & SOP AI Agent
├── DESIGN.md                # Design tokens & visual style guide
├── TODO.md                  # Prioritas roadmap & sprint backlog
├── assets/                  # Aset grafis, font, 3D model, dan kamus i18n
├── dashboard/               # Web Dashboard interaktif (Express + Vite MPA + Three.js)
├── plugin/                  # Slash command router per kategori
├── scripts/                 # Utilitas migrasi & verifikasi otomatis
└── src/                     # Core engine bot
    ├── ai/                  # AI memory, RAG, dan function calling
    ├── canvas/              # Dedicated worker pool rendering grafis
    ├── config/              # Validasi env dan konfigurasi statis
    ├── domain/              # Pure calculations & state machines
    ├── managers/            # Pengendali database, cache, audio, dan DJ
    ├── models/              # Skema tabel Sequelize & Mongoose
    ├── music/               # Poru Lavalink event handlers
    ├── services/            # Engine latar, Fish Audio, automations
    └── utils/               # Discord Components V2 builder & helpers
```

---

## 🤝 Kontribusi & Tata Kelola

Sebelum mengirimkan kontribusi kode atau pull request, pahami **Pentalogi Dokumentasi**:

1. Pahami visi produk, batasan 6 pilar, dan persona pengguna di [`PRD.md`](PRD.md).
2. Terapkan standar token visual, estetika glassmorphism, dan komponen UI di [`DESIGN.md`](DESIGN.md).
3. Patuhi aturan hukum kode, transaksi atomik database, dan keamanan di [`RULES.md`](RULES.md).
4. Jika Anda adalah AI Agent, ikuti SOP, peta folder, dan alur eksekusi di [`AGENTS.md`](AGENTS.md).
5. Pastikan seluruh gate pengujian lolos:
   ```bash
   npm run lint
   node scripts/check-em-dash.js
   npm run locales:check:strict
   npm run test:requires
   npm test
   ```

---

## 📄 Lisensi

<div align="center">

**ISC License** © 2026 Aryandita Praftian.  
Lihat berkas lisensi lengkap di [`LICENSE`](LICENSE).

_Dibuat dengan dedikasi penuh untuk komunitas Discord Indonesia & Global._

</div>
