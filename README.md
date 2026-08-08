<div align="center">

# 🌸 Naura Hoshino V2

**Bot Discord serbaguna berbasis `discord.js` v14**
Menghadirkan UI Canvas modern, ekosistem Survival & Ekonomi interaktif, pemutar musik Lavalink, kecerdasan AI berlapis, dan Web Dashboard realtime yang elegan.

<br />

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2020.6.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Redis](https://img.shields.io/badge/Redis-opsional-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Lavalink](https://img.shields.io/badge/Lavalink-v4-FF6B6B?style=for-the-badge&logo=musicbrainz&logoColor=white)](https://lavalink.dev)
[![License](https://img.shields.io/badge/License-ISC-8A2BE2?style=for-the-badge)](LICENSE)

<br />

![Status](https://img.shields.io/badge/Status-Pengembangan%20Aktif-FF69B4?style=flat-square)
![Bahasa](https://img.shields.io/badge/Bahasa-ID%20%7C%20EN-00B4D8?style=flat-square)
![Sharding](https://img.shields.io/badge/Sharding-Aktif-2ECC71?style=flat-square)
![Dashboard](https://img.shields.io/badge/Dashboard-Express%20%2B%20Socket.io-F39C12?style=flat-square)

</div>

<br />

> [!NOTE]
> Proyek ini masih dalam pengembangan aktif. Beberapa modul sedang dirapikan, lihat [`TODO.md`](TODO.md) dan tab **Issues** untuk daftar pekerjaan yang sedang berjalan.

---

## 📖 Daftar Isi

<details>
<summary>👉 Klik untuk melihat Daftar Isi</summary>

- [✨ Fitur Unggulan](#-fitur-unggulan)
- [🧩 Kebutuhan Sistem](#-kebutuhan-sistem)
- [🚀 Instalasi & Menjalankan Bot](#-instalasi--menjalankan-bot)
- [📜 Script NPM yang Tersedia](#-script-npm-yang-tersedia)
- [🔐 Konfigurasi Environment](#-konfigurasi-environment)
- [🗂️ Struktur Proyek](#-struktur-proyek)
- [🌍 Sistem Bilingual](#-sistem-bilingual)
- [🎭 Ekspresi Naura](#-ekspresi-naura)
- [📄 Lisensi](#-lisensi)
</details>

---

## ✨ Fitur Unggulan

<div align="center">
<table>
  <tr>
    <td width="33%" align="center">
      <h3>🎮 Survival & Ekonomi</h3>
      <p>Dunia RPG dengan mata uang berlapis, bank & deposito, investasi, crafting, dungeon, NPC, quest, hingga pencapaian (achievement).</p>
    </td>
    <td width="33%" align="center">
      <h3>🎵 Pemutar Musik</h3>
      <p>Audio jernih berbasis <strong>Lavalink v4</strong>. Dilengkapi antrean, kontrol interaktif 24/7, dan panel musik langsung dari web dashboard.</p>
    </td>
    <td width="33%" align="center">
      <h3>🤖 AI Multi-Lapis</h3>
      <p>Integrasi canggih via <strong>Verba → Gemini → Ollama</strong>. Sesuaikan persona Naura khusus untuk servermu beserta pengetahuan khususnya!</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>🎨 UI Canvas Modern</h3>
      <p>Hadir dengan kartu profil artistik, banner <i>welcome</i> fleksibel, dan menggunakan <strong>Components V2</strong> untuk layout pesan interaktif.</p>
    </td>
    <td align="center">
      <h3>🛡️ Sistem Moderasi</h3>
      <p>Automod proaktif, perlindungan Anti-Nuke, teguran (warn) bertingkat, <i>Sticky Roles</i>, ModMail, hingga sistem tiket lengkap.</p>
    </td>
    <td align="center">
      <h3>📊 Web Dashboard</h3>
      <p>Pantau server, leaderboard, dan statistik realtime dengan kekuatan <strong>Socket.io</strong>, didukung login OAuth2 Discord yang aman.</p>
    </td>
  </tr>
  <tr>
    <td align="center">
      <h3>🌍 Mode Bilingual</h3>
      <p>Mendukung Bahasa <strong>Indonesia & Inggris</strong>. Tersimpan secara personal per-pengguna untuk kenyamanan maksimal.</p>
    </td>
    <td align="center">
      <h3>⛏️ Integrasi Minecraft</h3>
      <p>Bangun jembatan komunikasi antara Discord dan server Minecraft kamu via RCON, lengkap dengan pemantauan status server.</p>
    </td>
    <td align="center">
      <h3>🎉 Interaksi & Sosial</h3>
      <p>Meriahkan servermu dengan Leveling, Giveaway, Minigames, Global Chat, Starboard, Quote of the Day (QOTD), hingga notif Ulang Tahun!</p>
    </td>
  </tr>
</table>
</div>

---

## 🧩 Kebutuhan Sistem

| Status | Komponen | Versi Minimal | Keterangan |
|:---:|---|:---:|---|
| 🟢 | **Node.js** | `>= 20.6.0` | Sangat wajib. Naura menggunakan fitur `process.loadEnvFile()`. |
| 🐬 | **MySQL** | `8.x` | Basis data utama untuk performa maksimal (SQLite tersedia sebagai fallback). |
| 🔴 | **Redis** | *Opsional* | Untuk sistem Cache & Pub/Sub. (Akan dilewati otomatis jika `REDIS_URL` kosong). |
| 🎧 | **Lavalink** | `v4` | Wajib di-setup jika ingin menggunakan seluruh modul Musik. |
| 🎬 | **FFmpeg** | *Terbaru* | Modul ini sudah tersedia otomatis lewat paket `ffmpeg-static`. |

> [!WARNING]
> Beberapa dependensi bersifat *native* seperti (`@napi-rs/canvas`, `sqlite3`, `libsodium-wrappers`). Jika kamu menjalankan bot ini di **Linux**, kemungkinan besar kamu perlu memasang `build-essential` dan `python3` terlebih dahulu.

---

## 🚀 Instalasi & Menjalankan Bot

Siap untuk menjalankan Naura Hoshino? Ikuti langkah mudah di bawah ini!

```bash
# 1. Kloning Repositori
git clone https://github.com/Aryandita/Naura-Hoshino-V2.git

# 2. Masuk ke direktori
cd Naura-Hoshino-V2

# 3. Install seluruh modul dan dependensi
npm install

# 4. Salin file konfigurasi environment
cp .env.example .env

# 5. Buka file .env dan isi variabel yang dibutuhkan (lihat panduan di bawah)
# 6. Jalankan bot!
npm start
```

---

## 📜 Script NPM yang Tersedia

Untuk mempermudah manajemen, kami telah menyediakan beberapa perintah praktis. Jalankan menggunakan terminal pilihanmu:

| Perintah | Deskripsi Fungsi |
|---|---|
| 🚀 `npm start` | Menjalankan bot via `shard.js` (ShardingManager). **Gunakan perintah ini untuk Produksi.** |
| 🔄 `npm run dev` | Menjalankan bot dengan auto-restart via `--watch`. Sangat pas untuk *development*. |
| 📤 `npm run deploy` | Memaksa bot untuk melakukan registrasi ulang seluruh *Slash Command*. |
| 📦 `npm run install-start`| Kombinasi instan: Pasang dependensi dan langsung nyalakan bot. |
| 🔍 `npm run lint` | Melakukan pengecekan kode dengan ESLint. |
| 🔧 `npm run lint:fix` | Mengecek sekaligus mencoba memperbaiki isu kode secara otomatis (ESLint fix). |
| 💅 `npm run format` | Merapikan estetika struktur kode dengan Prettier. |
| 👀 `npm run format:check` | Memeriksa format kode (hanya laporan, tanpa modifikasi). |
| 🌐 `npm run locales:check` | Audit sinkronisasi / paritas kunci bahasa ID vs EN. |
| 🚨 `npm run locales:check:strict` | Sama seperti audit locales biasa, namun proses digagalkan jika ada kunci yang hilang. |

*(Catatan: Slash command akan ter-deploy otomatis saat bot pertama hidup. Hanya shard utama yang melakukan ini. Gunakan `--no-deploy` untuk skip.)*

### Pengecekan Gaya Tulisan
Kami sangat menjaga standar kualitas tulisan. Teks tidak boleh terkesan kaku seperti robot!

```bash
node scripts/check-em-dash.js          # Mencari dan melaporkan simbol em-dash (-) yang tersisa
node scripts/check-em-dash.js --fix    # Memperbaiki secara otomatis dan memberikan report
```

---

## 🔐 Konfigurasi Environment

Semua kredensial dan pengaturan penting disimpan di `.env` (berdasarkan [`src/config/env.js`](src/config/env.js)).
**Pastikan kamu mengisi semua variabel WAJIB sebelum menjalankan bot, atau bot akan menolak untuk menyala!**

### 🔴 Wajib Diisi (Core)
| Variabel | Deskripsi |
|---|---|
| `DISCORD_TOKEN` | Token bot rahasia milikmu dari Discord Developer Portal |
| `CLIENT_ID` | Application ID dari bot kamu |
| `MYSQL_USER` | Username untuk akses ke Database MySQL |
| `MYSQL_DATABASE` | Nama skema database yang akan dipakai |

<details>
<summary><b>💬 Discord Settings</b> (Klik untuk membuka)</summary>

| Variabel | Default | Deskripsi |
|---|---|---|
| `PREFIX` | `n!` | Prefix klasik untuk menjalankan command teks |
| `GUILD_ID` | - | ID Server khusus untuk deploy slash command instan (saat masa uji coba/dev) |
| `OWNER_IDS` | - | Daftar ID owner yang dipisahkan oleh koma (contoh: `1234,5678`) |
| `STAFF_GUILD_ID` | - | ID Server utama bagi para staf untuk mengurus ModMail |
| `MODMAIL_CATEGORY_ID` | - | Kategori khusus di server staf untuk menampung tiket ModMail |
</details>

<details>
<summary><b>🗄️ Database & Cache Settings</b> (Klik untuk membuka)</summary>

| Variabel | Default | Deskripsi |
|---|---|---|
| `MYSQL_HOST` | `127.0.0.1` | Host tujuan Database MySQL |
| `MYSQL_PORT` | `3306` | Port tujuan Database |
| `MYSQL_PASSWORD` | - | Password untuk user MySQL kamu |
| `REDIS_URL` | - | *Opsional*. URL koneksi Redis. Biarkan kosong untuk mematikan Cache/PubSub eksternal. |
</details>

<details>
<summary><b>🎧 Lavalink / Music Settings</b> (Klik untuk membuka)</summary>

| Variabel | Default |
|---|---|
| `LAVALINK_HOST` | `localhost` |
| `LAVALINK_PORT` | `2333` |
| `LAVALINK_PASSWORD` | `youshallnotpass` |
| `LAVALINK_SECURE` | `false` |
</details>

<details>
<summary><b>🤖 AI Configuration</b> (Klik untuk membuka)</summary>

| Variabel | Default | Deskripsi |
|---|---|---|
| `GEMINI_API_KEY` | - | API Key utama untuk Google Gemini |
| `VERBA_API_KEY` | - | API Key untuk sistem Persona Naura |
| `VERBA_SLUG_OWNER` | - | Persona khusus saat merespon Owner bot |
| `VERBA_SLUG_PREMIUM` | - | Persona khusus saat merespon User Premium |
| `VERBA_SLUG_GENERAL` | - | Persona umum sehari-hari |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Fallback URL jika AI lokal dipakai |
| `OLLAMA_MODEL` | `llama3.1` | Model yang akan digunakan oleh Ollama |
| `FOOOCUS_BASE_URL` | `http://localhost:7865` | Server endpoint untuk generasi gambar lokal |
</details>

<details>
<summary><b>🌐 Dashboard & Webhook Endpoint</b> (Klik untuk membuka)</summary>

| Variabel | Default | Deskripsi |
|---|---|---|
| `PORT` / `DASHBOARD_PORT`| `3070` | Port aktif untuk Dashboard Web |
| `WEBHOOK_PORT` | `3071` | Port terpisah khusus webhook donasi/vote |
| `SESSION_SECRET` | - | 🔴 **WAJIB DI PRODUKSI!** Dashboard akan menolak akses tanpa secret ini! |
| `DISCORD_CALLBACK_URL` | - | URL untuk callback autentikasi OAuth2 |
| `DASHBOARD_ORIGIN` | - | Origin yang di-whitelist untuk perlindungan CORS lintas domain |
| `OWNER_EVAL_ENABLED` | `false` | Membuka rute eksekusi `eval` Owner. Nyalakan hanya saat sangat perlu (Debugging). |
| `ERROR_WEBHOOK_URL` | - | Discord Webhook URL agar bot bisa melaporkan error krusial |
| `WEBHOOK_AUTH_SAWERIA` | - | Password/Token webhook Saweria |
| `WEBHOOK_AUTH_TRAKTEER`| - | Password/Token webhook Trakteer |
| `WEBHOOK_AUTH_VOTE` | - | Password/Token webhook vote Top.gg |

> [!CAUTION]
> Endpoint webhook **akan memblokir semua request (503)** jika token belum diatur. Hal ini bertujuan sebagai pengaman ekstra. Jika modul donasi terekspos tanpa auth, pihak tidak bertanggung jawab berpotensi men-suntik request palsu untuk mendapatkan role Premium secara gratis!
</details>

<details>
<summary><b>🛠️ Media & Metadata Information</b> (Klik untuk membuka)</summary>

| Variabel | Default | Deskripsi |
|---|---|---|
| `FFMPEG_PATH` | - | Kosongkan saja jika kamu ingin menggunakan modul `ffmpeg-static`. Isi jika server punya *binary* khusus. |
| `BOT_VERSION` | `1.2.0` | Versi yang terpampang pada command /info |
| `ENGINE_VERSION`| `1.1.0` | Versi engine yang ditandai pada footer Naura |
| `PARTNERSHIP` | `Belum ada kolaborasi` | Label nama server/komunitas yang sedang bekerja sama (ditampilkan di profil) |
</details>

---

## 🗂️ Struktur Proyek

Bagi kamu yang ingin ikut mengembangkan atau memodifikasi, berikut peta singkat direktori inti:

```plaintext
Naura-Hoshino-V2/
├─ 📄 index.js               # Inti utama proses bot (berjalan satu per shard)
├─ 📄 shard.js               # Pengelola titik masuk produksi (ShardingManager)
├─ 🖼️ assets/                # Kumpulan font, gambar, serta aset UI Canvas
│  └─ Naura_Expression/      # Folder rahasia 15+ Ekspresi Wajah Naura
├─ 🌍 language/              # Sistem lokalisasi & kamus utama (id.json, en.json)
├─ 🧩 plugin/                # Semua fungsi command, rapi terbagi dalam sub-kategori
│  └─ <kategori>/locales/    # Terjemahan khusus untuk setiap sub-plugin
├─ 🔧 scripts/               # Alat-alat kecil utilitas pemeliharaan sistem
└─ 📂 src/
   ├─ ⚙️ config/             # Pengaturan statis, konstanta UI & validasi ENV
   ├─ 🌐 dashboard/          # Markas Express + Socket.io Web Dashboard
   │  ├─ middleware/         # Algoritma penjaga gawang Auth, Izin, & Owner
   │  ├─ routes/             # Kumpulan endpoint (public, user, guild, owner)
   │  ├─ sockets/            # Kendali real-time & sinkronisasi data live
   │  └─ utils/              # Pengelola batas akses (rate limiter) & pemformatan
   ├─ 📡 events/             # Pendengar event (Listener) inti dari Discord
   ├─ 🎛️ interactions/      # Penanganan Button, Select Menu, hingga Modal UI
   ├─ 🧠 managers/           # Otak pusat (Database, Cache, Cronjob, Logger, dsb)
   ├─ 🗃️ models/             # Kerangka Tabel Sequelize
   └─ 🛠️ utils/              # Builder Component V2 canggih dan asisten bantuan lainnya
```

---

## 🌍 Sistem Bilingual

Kami merancang Naura agar mudah dimengerti dari Sabang sampai Merauke, hingga tingkat Internasional. Bahasa (**Indonesia (ID)** & **English (EN)**) dipilih lalu disimpan pada tabel personal `user_profiles`.

```javascript
const lang = require('./src/managers/languageManager');

// Simpan pilihan preferensi si pengguna
await lang.setUserLanguage(userId, 'en');       

// Dapatkan terjemahan khusus untuk UI pengguna
const text = await lang.translate(userId, 'help.title');
const sync = lang.translateSync('en', 'greeting', { name: 'Ryaa' });
```

Tidak perlu pusing! Kamus inti berada di folder `language/`, sementara kata-kata unik diletakkan di `plugin/<nama-plugin>/locales/`. **Kamus inti selalu memiliki hak istimewa (prioritas).** Kamu bisa cek kelengkapan bahasa dengan perintah: `npm run locales:check`.

---

## 🎭 Ekspresi Naura

Naura tidak kaku! Ia dapat memancarkan perasaannya lewat embed khusus.

```javascript
const naura = require('./src/utils/nauraExpression');

// Naura senang karena interaksi sukses!
const { embed, files } = naura.decorate(myEmbed, 'success');
await interaction.reply({ embeds: [embed], files });
```

**Kumpulan Mood Utama:**
| | | | | | | | |
|:---:|---|:---:|---|:---:|---|:---:|---|
| ✅ | **`success`** | ❌ | **`error`** | ⚠️ | **`warning`** | ℹ️ | **`info`** |
| ⏳ | **`loading`** | 🎉 | **`levelup`** | 🎵 | **`music`** | 📖 | **`help`** |

> Cek referensi lengkap seluruh ekspresi emosi di berkas [`src/utils/nauraExpression.js`](src/utils/nauraExpression.js)

---

## 📄 Lisensi

<div align="center">

**ISC License** © 2026 Aryandita Praftian.
Lihat berkas lisensi penuh di **[`LICENSE`](LICENSE)**.

*Dibuat penuh dengan cinta (💜) untuk para kreator & komunitas Discord Indonesia!*

</div>
