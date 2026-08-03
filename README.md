# Naura Hoshino V.2

Bot Discord multifungsi berbasis `discord.js` v14 dengan UI Canvas modern, sistem ekonomi & survival, pemutar musik Lavalink, integrasi AI, dan Web Dashboard.

> **Status:** pengembangan aktif. Beberapa modul masih dirapikan; lihat `TODO.md`.

---

## Kebutuhan Sistem

| Komponen | Versi | Keterangan |
| --- | --- | --- |
| Node.js | **>= 20.6.0** | Wajib, karena kode memakai `process.loadEnvFile()` |
| MySQL | 8.x | Basis data utama (ada fallback SQLite) |
| Redis | opsional | Caching; dilewati bila `REDIS_URL` kosong |
| Lavalink | v4 | Hanya untuk fitur musik |
| FFmpeg | terbaru | Sudah tersedia lewat `ffmpeg-static` |

Beberapa dependensi bersifat native (`@napi-rs/canvas`, `sqlite3`, `libsodium-wrappers`) sehingga pada Linux mungkin perlu `build-essential` dan `python3`.

---

## Instalasi

```bash
git clone https://github.com/Aryandita/Naura-Hoshino-V.2.git
cd Naura-Hoshino-V.2
npm install
cp .env.example .env   # lalu isi nilainya
npm start
```

### Script yang tersedia

| Perintah | Fungsi |
| --- | --- |
| `npm start` | Menjalankan bot lewat ShardingManager (`shard.js`) — **cara produksi** |
| `npm run dev` | Sama seperti di atas, dengan auto-restart `--watch` |
| `npm run deploy` | Memaksa registrasi ulang slash command |
| `npm run lint` | Menjalankan ESLint |
| `npm run lint:fix` | ESLint dengan perbaikan otomatis |
| `npm run format` | Merapikan format dengan Prettier |
| `npm run locales:check` | Audit paritas kunci bahasa ID vs EN |

Slash command dideploy otomatis saat boot oleh **shard utama saja**. Gunakan `--no-deploy` untuk melewatinya.

---

## Konfigurasi Environment

Nama variabel di bawah ini adalah yang benar-benar dibaca oleh `src/config/env.js`.

### Wajib

| Variabel | Keterangan |
| --- | --- |
| `DISCORD_TOKEN` | Token bot dari Discord Developer Portal |
| `CLIENT_ID` | Application ID bot |
| `MYSQL_USER` | Username database |
| `MYSQL_DATABASE` | Nama database |

Bot berhenti sebelum shard di-spawn bila salah satu di atas kosong.

### Discord

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PREFIX` | `n!` | Prefix perintah teks |
| `GUILD_ID` | — | Server untuk deploy command instan saat pengembangan |
| `OWNER_IDS` | — | Daftar ID owner, dipisah koma |
| `STAFF_GUILD_ID` | — | Server staf untuk ModMail |
| `MODMAIL_CATEGORY_ID` | — | Kategori channel ModMail |

### Database & Cache

| Variabel | Default |
| --- | --- |
| `MYSQL_HOST` | `127.0.0.1` |
| `MYSQL_PORT` | `3306` |
| `MYSQL_PASSWORD` | — |
| `REDIS_URL` | — (Redis dilewati bila kosong) |

### Musik (Lavalink)

| Variabel | Default |
| --- | --- |
| `LAVALINK_HOST` | `localhost` |
| `LAVALINK_PORT` | `2333` |
| `LAVALINK_PASSWORD` | `youshallnotpass` |
| `LAVALINK_SECURE` | `false` |

### AI

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `GEMINI_API_KEY` | — | Penyedia AI utama |
| `VERBA_API_KEY` | — | Persona AI |
| `VERBA_SLUG_OWNER` / `VERBA_SLUG_PREMIUM` / `VERBA_SLUG_GENERAL` | — | Slug persona per tingkatan |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Fallback AI lokal |
| `OLLAMA_MODEL` | `llama3.1` | Model Ollama |
| `FOOOCUS_BASE_URL` | `http://localhost:7865` | Generasi gambar lokal |

### Dashboard & Webhook

| Variabel | Default | Keterangan |
| --- | --- | --- |
| `PORT` / `SERVER_PORT` / `DASHBOARD_PORT` | `3070` | Port dashboard (urutan prioritas) |
| `WEBHOOK_PORT` | `3071` | Port penerima webhook |
| `SESSION_SECRET` | — | **Wajib diisi di produksi** |
| `DISCORD_CALLBACK_URL` | — | Callback OAuth2 |
| `ERROR_WEBHOOK_URL` | — | Webhook laporan error |
| `WEBHOOK_AUTH_SAWERIA` | — | Token webhook Saweria |
| `WEBHOOK_AUTH_VOTE` | — | Token webhook Top.gg |

### Metadata

| Variabel | Default |
| --- | --- |
| `BOT_VERSION` | `1.2.0` |
| `ENGINE_VERSION` | `1.1.0` |
| `PARTNERSHIP` | `Belum ada kolaborasi` |

---

## Struktur Proyek

```
.
├─ index.js               # Proses bot (satu per shard)
├─ shard.js               # ShardingManager, titik masuk produksi
├─ assets/                # Gambar, font, aset Canvas
│  └─ Naura_Expression/   # 15 ekspresi Naura untuk embed
├─ language/              # Kamus bahasa utama (id.json, en.json)
├─ plugin/                # Perintah, dikelompokkan per kategori
│  └─ <kategori>/locales/ # Kamus bahasa khusus plugin
├─ scripts/               # Perkakas pemeliharaan
└─ src/
   ├─ config/             # env.js, ui.js, konfigurasi statis
   ├─ dashboard/          # Web Dashboard (Express)
   ├─ events/             # Event listener Discord
   ├─ managers/           # Database, cache, cron, bahasa, logger, dll
   ├─ models/             # Model Sequelize
   └─ utils/              # Builder embed/container dan helper
```

---

## Sistem Bilingual

Naura mendukung Bahasa Indonesia dan Inggris. Pilihan bahasa disimpan pada kolom `language` di tabel `user_profiles` dan berlaku di seluruh ekosistem.

```js
const lang = require('./src/managers/languageManager');

await lang.setUserLanguage(userId, 'en');       // simpan pilihan
const text = await lang.translate(userId, 'help.title');
const sync = lang.translateSync('en', 'greeting', { name: 'Ryaa' });
```

Kamus utama berada di `language/`, sedangkan kamus khusus plugin di `plugin/<kategori>/locales/`. Kamus utama menang bila ada kunci yang bentrok. Jalankan `npm run locales:check` untuk melihat kunci yang belum diterjemahkan.

---

## Ekspresi Naura

```js
const naura = require('./src/utils/nauraExpression');

const { embed, files } = naura.decorate(myEmbed, 'success');
await interaction.reply({ embeds: [embed], files });
```

Mood yang tersedia antara lain `success`, `error`, `warning`, `info`, `loading`, `levelup`, `music`, dan `help`. Daftar lengkapnya ada di `src/utils/nauraExpression.js`.

---

## Lisensi

ISC © 2026 Aryandita Praftian. Lihat berkas `LICENSE`.
