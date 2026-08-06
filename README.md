<div align="center">

# 🌸 Naura Hoshino V2

**Bot Discord serbaguna berbasis `discord.js` v14** — UI Canvas modern, ekonomi & survival, musik Lavalink, AI berlapis, dan Web Dashboard realtime.

[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2020.6.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![MySQL](https://img.shields.io/badge/MySQL-8.x-4479A1?style=for-the-badge&logo=mysql&logoColor=white)](https://www.mysql.com)
[![Redis](https://img.shields.io/badge/Redis-opsional-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
[![Lavalink](https://img.shields.io/badge/Lavalink-v4-FF6B6B?style=for-the-badge&logo=musicbrainz&logoColor=white)](https://lavalink.dev)
[![License](https://img.shields.io/badge/License-ISC-8A2BE2?style=for-the-badge)](LICENSE)

![Status](https://img.shields.io/badge/Status-Pengembangan%20Aktif-FF69B4?style=flat-square)
![Bahasa](https://img.shields.io/badge/Bahasa-ID%20%7C%20EN-00B4D8?style=flat-square)
![Sharding](https://img.shields.io/badge/Sharding-Aktif-2ECC71?style=flat-square)
![Dashboard](https://img.shields.io/badge/Dashboard-Express%20%2B%20Socket.io-F39C12?style=flat-square)

</div>

> [!NOTE]
> Proyek ini masih dalam pengembangan aktif. Beberapa modul sedang dirapikan — lihat [`TODO.md`](TODO.md) dan tab **Issues** untuk daftar pekerjaan yang sedang berjalan.

---

## 📖 Daftar Isi

| | | |
|---|---|---|
| [✨ Fitur](#-fitur) | [🧩 Kebutuhan Sistem](#-kebutuhan-sistem) | [🚀 Instalasi](#-instalasi) |
| [📜 Script](#-script-yang-tersedia) | [🔐 Konfigurasi Environment](#-konfigurasi-environment) | [🗂️ Struktur Proyek](#️-struktur-proyek) |
| [🌍 Sistem Bilingual](#-sistem-bilingual) | [🎭 Ekspresi Naura](#-ekspresi-naura) | [📄 Lisensi](#-lisensi) |

---

## ✨ Fitur

<table>
<tr>
<td width="33%" valign="top">

### 🎮 Survival & Ekonomi
Dunia RPG dengan mata uang berlapis, bank & deposito, investasi, crafting, dungeon, NPC, quest, dan achievement.

</td>
<td width="33%" valign="top">

### 🎵 Musik
Pemutar berbasis **Lavalink v4** dengan antrean, kontrol tombol, mode 24/7, dan panel kendali dari dashboard.

</td>
<td width="33%" valign="top">

### 🤖 AI Berlapis
Rantai **Verba → Gemini → Ollama**. Persona bisa disesuaikan per server, lengkap dengan pengetahuan khusus server.

</td>
</tr>
<tr>
<td valign="top">

### 🎨 Canvas & UI
Kartu profil, welcomer yang bisa diatur posisinya, dan **Components V2** untuk tampilan pesan modern.

</td>
<td valign="top">

### 🛡️ Moderasi
Automod, antinuke, warn bertingkat, sticky roles, ModMail, dan tiket dukungan.

</td>
<td valign="top">

### 📊 Web Dashboard
Pengaturan server, leaderboard, dan statistik realtime lewat **Socket.io**, dengan login OAuth2 Discord.

</td>
</tr>
<tr>
<td valign="top">

### 🌍 Bilingual
Bahasa Indonesia & Inggris, tersimpan per pengguna dan berlaku di seluruh ekosistem.

</td>
<td valign="top">

### ⛏️ Integrasi Minecraft
Jembatan obrolan dua arah lewat RCON dan pemantauan status server.

</td>
<td valign="top">

### 🎉 Sosial & Hiburan
Leveling, giveaway, minigame, global chat, starboard, QOTD, dan pemberitahuan ulang tahun.

</td>
</tr>
</table>

---

## 🧩 Kebutuhan Sistem

| | Komponen | Versi | Keterangan |
|:-:|---|:-:|---|
| 🟢 | **Node.js** | `>= 20.6.0` | Wajib — kode memakai `process.loadEnvFile()` |
| 🐬 | **MySQL** | `8.x` | Basis data utama (ada fallback SQLite) |
| 🔴 | **Redis** | opsional | Cache & Pub/Sub. Dilewati bila `REDIS_URL` kosong |
| 🎧 | **Lavalink** | `v4` | Hanya untuk fitur musik |
| 🎬 | **FFmpeg** | terbaru | Sudah tersedia lewat `ffmpeg-static` |

> [!WARNING]
> Beberapa dependensi bersifat *native* (`@napi-rs/canvas`, `sqlite3`, `libsodium-wrappers`). Di Linux kamu kemungkinan perlu memasang `build-essential` dan `python3` lebih dulu.

---

## 🚀 Instalasi

```bash
git clone https://github.com/Aryandita/Naura-Hoshino-V2.git
cd Naura-Hoshino-V2
npm install
cp .env.example .env   # lalu isi nilainya
npm start
```

---

## 📜 Script yang Tersedia

| Perintah | Fungsi |
|---|---|
| 🚀 `npm start` | Menjalankan bot lewat ShardingManager (`shard.js`) — **cara produksi** |
| 🔄 `npm run dev` | Sama seperti di atas, dengan auto-restart `--watch` |
| 📤 `npm run deploy` | Memaksa registrasi ulang slash command |
| 📦 `npm run install-start` | Pasang dependensi lalu langsung jalankan |
| 🔍 `npm run lint` | Menjalankan ESLint |
| 🔧 `npm run lint:fix` | ESLint dengan perbaikan otomatis |
| 💅 `npm run format` | Merapikan format dengan Prettier |
| 👀 `npm run format:check` | Memeriksa format tanpa mengubah berkas |
| 🌐 `npm run locales:check` | Audit paritas kunci bahasa ID vs EN |
| 🚨 `npm run locales:check:strict` | Sama, tetapi gagal bila ada kunci yang hilang |

Slash command dideploy otomatis saat boot oleh **shard utama saja**. Gunakan `--no-deploy` untuk melewatinya.

---

## 🔐 Konfigurasi Environment

Nama variabel di bawah ini adalah yang benar-benar dibaca oleh [`src/config/env.js`](src/config/env.js).

### 🔴 Wajib

Bot berhenti sebelum shard di-spawn bila salah satu di bawah ini kosong.

| Variabel | Keterangan |
|---|---|
| `DISCORD_TOKEN` | Token bot dari Discord Developer Portal |
| `CLIENT_ID` | Application ID bot |
| `MYSQL_USER` | Username database |
| `MYSQL_DATABASE` | Nama database |

<details>
<summary><b>💬 Discord</b></summary>

| Variabel | Default | Keterangan |
|---|---|---|
| `PREFIX` | `n!` | Prefix perintah teks |
| `GUILD_ID` | — | Server untuk deploy command instan saat pengembangan |
| `OWNER_IDS` | — | Daftar ID owner, dipisah koma |
| `STAFF_GUILD_ID` | — | Server staf untuk ModMail |
| `MODMAIL_CATEGORY_ID` | — | Kategori channel ModMail |

</details>

<details>
<summary><b>🗄️ Database & Cache</b></summary>

| Variabel | Default | Keterangan |
|---|---|---|
| `MYSQL_HOST` | `127.0.0.1` | Host database |
| `MYSQL_PORT` | `3306` | Port database |
| `MYSQL_PASSWORD` | — | Password database |
| `REDIS_URL` | — | Cache & Pub/Sub. Redis dilewati bila kosong |

</details>

<details>
<summary><b>🎧 Musik (Lavalink)</b></summary>

| Variabel | Default |
|---|---|
| `LAVALINK_HOST` | `localhost` |
| `LAVALINK_PORT` | `2333` |
| `LAVALINK_PASSWORD` | `youshallnotpass` |
| `LAVALINK_SECURE` | `false` |

</details>

<details>
<summary><b>🤖 AI</b></summary>

| Variabel | Default | Keterangan |
|---|---|---|
| `GEMINI_API_KEY` | — | Penyedia AI utama |
| `VERBA_API_KEY` | — | Persona AI |
| `VERBA_SLUG_OWNER` | — | Slug persona untuk owner |
| `VERBA_SLUG_PREMIUM` | — | Slug persona untuk pengguna premium |
| `VERBA_SLUG_GENERAL` | — | Slug persona umum |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Fallback AI lokal |
| `OLLAMA_MODEL` | `llama3.1` | Model Ollama |
| `FOOOCUS_BASE_URL` | `http://localhost:7865` | Generasi gambar lokal |

</details>

<details>
<summary><b>🌐 Dashboard & Webhook</b></summary>

| Variabel | Default | Keterangan |
|---|---|---|
| `PORT` / `SERVER_PORT` / `DASHBOARD_PORT` | `3070` | Port dashboard (urutan prioritas) |
| `WEBHOOK_PORT` | `3071` | Port penerima webhook |
| `SESSION_SECRET` | — | 🔴 **Wajib di produksi.** Dashboard menolak menyala tanpa ini |
| `DISCORD_CALLBACK_URL` | — | Callback OAuth2 |
| `DASHBOARD_ORIGIN` | — | Daftar origin yang boleh mengakses lintas domain |
| `OWNER_EVAL_ENABLED` | `false` | Endpoint `eval` owner. Biarkan mati kecuali sedang debugging |
| `ERROR_WEBHOOK_URL` | — | Webhook laporan error |
| `WEBHOOK_AUTH_SAWERIA` | — | Token webhook Saweria |
| `WEBHOOK_AUTH_TRAKTEER` | — | Token webhook Trakteer |
| `WEBHOOK_AUTH_VOTE` | — | Token webhook Top.gg |

> [!CAUTION]
> Endpoint webhook **menolak seluruh permintaan (503)** selama token yang bersangkutan belum diisi. Ini disengaja: endpoint donasi memberi premium berdasarkan ID Discord di dalam pesan donasi, jadi membiarkannya terbuka sama dengan membagikan premium gratis.

</details>

<details>
<summary><b>🛠️ Media & Metadata</b></summary>

| Variabel | Default | Keterangan |
|---|---|---|
| `FFMPEG_PATH` | — | Isi hanya bila host menyediakan binary FFmpeg sendiri |
| `BOT_VERSION` | `1.2.0` | Ditampilkan di perintah info |
| `ENGINE_VERSION` | `1.1.0` | Ditampilkan di perintah info |
| `PARTNERSHIP` | `Belum ada kolaborasi` | Teks kolaborasi di embed info |

</details>

---

## 🗂️ Struktur Proyek

```
.
├─ 📄 index.js               # Proses bot (satu per shard)
├─ 📄 shard.js               # ShardingManager, titik masuk produksi
├─ 🖼️ assets/                # Gambar, font, aset Canvas
│  └─ Naura_Expression/      # 15 ekspresi Naura untuk embed
├─ 🌍 language/              # Kamus bahasa utama (id.json, en.json)
├─ 🧩 plugin/                # Perintah, dikelompokkan per kategori
│  └─ <kategori>/locales/    # Kamus bahasa khusus plugin
├─ 🔧 scripts/               # Perkakas pemeliharaan
└─ 📂 src/
   ├─ ⚙️  config/            # env.js, ui.js, konfigurasi statis
   ├─ 🌐 dashboard/          # Web Dashboard (Express + Socket.io)
   │  ├─ middleware/         # Penjaga login, owner, izin Kelola Server
   │  ├─ routes/             # public, user, guild, owner, webhooks
   │  ├─ sockets/            # Statistik & kendali musik realtime
   │  └─ utils/              # Format, hadiah vote, penjaga HTTP
   ├─ 📡 events/             # Event listener Discord
   ├─ 🧠 managers/           # Database, cache, cron, bahasa, logger, dll
   ├─ 🗃️  models/            # Model Sequelize
   └─ 🛠️  utils/             # Builder embed/container dan helper
```

---

## 🌍 Sistem Bilingual

Naura mendukung **Bahasa Indonesia** dan **Inggris**. Pilihan bahasa disimpan pada kolom `language` di tabel `user_profiles` dan berlaku di seluruh ekosistem.

```js
const lang = require('./src/managers/languageManager');

await lang.setUserLanguage(userId, 'en');       // simpan pilihan
const text = await lang.translate(userId, 'help.title');
const sync = lang.translateSync('en', 'greeting', { name: 'Ryaa' });
```

Kamus utama berada di `language/`, sedangkan kamus khusus plugin di `plugin/<kategori>/locales/`. **Kamus utama menang** bila ada kunci yang bentrok. Jalankan `npm run locales:check` untuk melihat kunci yang belum diterjemahkan.

---

## 🎭 Ekspresi Naura

```js
const naura = require('./src/utils/nauraExpression');

const { embed, files } = naura.decorate(myEmbed, 'success');
await interaction.reply({ embeds: [embed], files });
```

| Mood | | Mood | | Mood | | Mood |
|---|---|---|---|---|---|---|
| ✅ `success` | | ❌ `error` | | ⚠️ `warning` | | ℹ️ `info` |
| ⏳ `loading` | | 🎉 `levelup` | | 🎵 `music` | | 📖 `help` |

Daftar lengkapnya ada di [`src/utils/nauraExpression.js`](src/utils/nauraExpression.js).

---

## 📄 Lisensi

<div align="center">

**ISC** © 2026 Aryandita Praftian — lihat berkas [`LICENSE`](LICENSE)

Dibuat dengan 💜 untuk komunitas Discord Indonesia

</div>
