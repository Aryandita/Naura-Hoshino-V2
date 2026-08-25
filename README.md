<div align="center">

# 🌸 Naura Hoshino V2

**Bot Discord serbaguna berbasis `discord.js` v14**
Menghadirkan UI Canvas modern, ekosistem Survival & Ekonomi interaktif, pemutar musik Lavalink, kecerdasan AI berlapis, dan Web Dashboard realtime yang elegan.

<br />

[![Versi](https://img.shields.io/badge/Versi-2.1.0-FFB6C1?style=for-the-badge)](package.json)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D%2024.0.0-339933?style=for-the-badge&logo=node.js&logoColor=white)](https://nodejs.org)
[![discord.js](https://img.shields.io/badge/discord.js-v14-5865F2?style=for-the-badge&logo=discord&logoColor=white)](https://discord.js.org)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?style=for-the-badge&logo=supabase&logoColor=white)](https://supabase.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas%20%7C%20Local-47A248?style=for-the-badge&logo=mongodb&logoColor=white)](https://www.mongodb.com)
[![Redis](https://img.shields.io/badge/Redis-Cache%20%26%20PubSub-DC382D?style=for-the-badge&logo=redis&logoColor=white)](https://redis.io)
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
> Proyek ini beroperasi pada arsitektur **Polyglot Multi-Database** dengan Supabase PostgreSQL, MongoDB, Redis, dan fallback SQLite darurat. Seluruh roadmap fitur **Sprint 0 hingga Sprint 14** telah diimplementasikan dan diverifikasi oleh pengujian otomatis TestSprite QA Suite.

### 📌 Versi & Sumber Kebenaran

| Item                |        Nilai        | Sumber kebenaran                            |
| ------------------- | :-----------------: | ------------------------------------------- |
| Versi Bot           |       `2.1.0`       | [`package.json`](package.json)              |
| Versi Engine        |       `2.1.0`       | [`package.json`](package.json)              |
| Runtime minimum     | Node.js `>= 24.0.0` | `engines` di [`package.json`](package.json) |
| Aturan & arsitektur |          -          | [`AGENTS.md`](AGENTS.md)                    |
| Prioritas pekerjaan |          -          | [`TODO.md`](TODO.md) + Issues               |
| Design token & UI   |          -          | [`DESIGN.md`](DESIGN.md)                    |

> Bila angka pada README ini berbeda dengan `package.json`, maka `package.json` yang benar dan README wajib diperbarui. Aturan pengembangan lengkap ada di [`AGENTS.md`](AGENTS.md), jadi README hanya memuat ringkasannya.

---

## 📖 Daftar Isi

<details>
<summary>👉 Klik untuk melihat Daftar Isi</summary>

- [✨ Fitur Unggulan](#-fitur-unggulan)
- [🧩 Kebutuhan Sistem](#-kebutuhan-sistem)
- [🚀 Instalasi & Menjalankan Bot](#-instalasi--menjalankan-bot)
- [🐦 Deploy di Panel Pterodactyl](#-deploy-di-panel-pterodactyl)
- [📜 Script NPM yang Tersedia](#-script-npm-yang-tersedia)
- [🔐 Konfigurasi Environment](#-konfigurasi-environment)
- [🗂️ Struktur Proyek](#-struktur-proyek)
- [🌍 Sistem Bilingual](#-sistem-bilingual)
- [🎭 Ekspresi Naura](#-ekspresi-naura)
- [🤝 Kontribusi](#-kontribusi)
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

| Status | Komponen         | Versi Minimal | Keterangan                                                                                                              |
| :----: | ---------------- | :-----------: | ----------------------------------------------------------------------------------------------------------------------- |
|   🟢   | **Node.js**      |  `>= 24.0.0`  | Sangat wajib. Naura memakai `process.loadEnvFile()`, `fetch` global, `node:sqlite`, dan test runner bawaan `node:test`. |
|   ⚡   | **Supabase (PG)**|  `PostgreSQL` | Basis data cloud relasional & transaksional utama (SQLite dipakai sebagai penyimpanan darurat).                         |
|   🍃   | **MongoDB**      |  `>= 7.x`     | Basis data dokumen untuk audit log, transkrip tiket, dan riwayat chat AI bervolume besar.                               |
|   🔴   | **Redis**        |  _Opsional_   | Untuk sistem Cache & Pub/Sub. (Akan dilewati otomatis jika `REDIS_URL` kosong).                                         |
|   🎧   | **Lavalink**     |     `v4`      | Wajib di-setup jika ingin menggunakan seluruh modul Musik.                                                              |
|   🎬   | **FFmpeg**       |   _Terbaru_   | Modul ini sudah tersedia otomatis lewat paket `ffmpeg-static`.                                                          |

> [!WARNING]
> Beberapa dependensi bersifat _native_ seperti (`@napi-rs/canvas`, `sqlite3`, `libsodium-wrappers`). Jika kamu menjalankan bot ini di **Linux**, kemungkinan besar kamu perlu memasang `build-essential` dan `python3` terlebih dahulu.

> [!NOTE]
> **Kenapa Node 24 dan bukan versi lebih rendah?** Selain `process.loadEnvFile()`, Naura mengandalkan `fetch` global (sehingga `node-fetch` bisa dilepas), `node:sqlite` bawaan untuk penyimpanan darurat, dan `node --test` sebagai test runner tanpa dependensi tambahan. Menyeragamkan satu versi juga menghilangkan celah bug yang hanya muncul di salah satu environment.

> [!TIP]
> **SQLite bukan sekadar pilihan pengembangan.** Saat Supabase dan Redis mati bersamaan, data ditulis sementara ke `naura_fallback.sqlite`, lalu disinkronkan kembali ke database cloud saat pulih. Jangan hapus dependensi `sqlite3`.

---

## 🚀 Instalasi & Menjalankan Bot

Siap untuk menjalankan Naura Hoshino? Ikuti langkah mudah di bawah ini!

```bash
# 1. Kloning Repositori
git clone https://github.com/Aryandita/Naura-Hoshino-V2.git

# 2. Masuk ke direktori
cd Naura-Hoshino-V2

# 3. Pastikan versi Node sudah sesuai (harus >= 24)
node -v

# 4. Install seluruh modul dan dependensi
npm install

# 5. Salin file konfigurasi environment
cp .env.example .env

# 6. Buka file .env dan isi variabel yang dibutuhkan (lihat panduan di bawah)

# 7. Nyalakan bot. Migrasi skema database berjalan otomatis lebih dulu.
npm start
```

> [!IMPORTANT]
> **Migrasi selalu jalan sebelum bot menyala, dan itu dijamin oleh npm, bukan oleh urutan perintah manual.** Script `prestart` di `package.json` menjalankan `node scripts/migrate.js` setiap kali `npm start` dipanggil. Bila migrasi gagal, prosesnya keluar dengan kode 1 dan `start` **tidak pernah dieksekusi**, sehingga bot tidak mungkin berjalan di atas skema separuh jalan.
>
> Urutan lengkapnya: `npm start` → `prestart` (`scripts/migrate.js`) → `start` (`node shard.js`).

> [!TIP]
> **Butuh menjalankan migrasi sendiri?** Pakai `npm run db:migrate`. Perintah itu memanggil script yang sama, jadi aman dijalankan berulang kali karena migrasi yang sudah pernah sukses dicatat di tabel `schema_migrations`.

> [!CAUTION]
> **Pintu darurat, bukan pengaturan harian.** Bila kamu perlu menyalakan bot tanpa memeriksa skema (misal database sedang di-maintenance dan kamu hanya ingin bot online), pakai `SKIP_DB_MIGRATE=1` atau `npm run start:no-migrate`. Jangan pernah meninggalkan `SKIP_DB_MIGRATE` menyala secara permanen, karena migrasi baru akan terus dilewati secara diam-diam dan bot berjalan di atas skema lama.

---

## 🐦 Deploy di Panel Pterodactyl

Panel Pterodactyl mengunci perintah luar dan hanya menyisakan satu variabel yang bisa kamu ubah, yaitu `CMD_RUN`. Perintah luar yang terkunci itu kira-kira begini:

```bash
if [[ -d .git ]] && [[ {{AUTO_UPDATE}} == "1" ]]; then git pull; fi;
if [ -f /home/container/package.json ]; then /usr/local/bin/npm install; fi;
/usr/local/bin/${CMD_RUN}
```

Karena `CMD_RUN` selalu diawali `/usr/local/bin/`, token pertamanya **wajib** berupa binary yang ada di folder itu (`npm`, `node`, atau `npx`). Rangkaian perintah dengan `&&` juga tidak bisa diandalkan di sana.

### Konfigurasi yang dipakai

| Kolom panel   | Nilai                                                         |
| ------------- | ------------------------------------------------------------- |
| `CMD_RUN`     | `npm start`                                                   |
| Docker image  | Node **24** atau lebih baru                                   |
| `AUTO_UPDATE` | `1` bila kamu ingin panel menarik commit terbaru saat restart |

Itu saja. Tidak ada perintah tambahan yang perlu kamu tulis, karena urutan migrasi sudah pindah ke dalam `package.json` lewat `prestart`.

### Yang terjadi setiap kali kamu menekan Restart

1. `git pull` menarik commit terbaru (bila `AUTO_UPDATE=1`).
2. `npm install` menyesuaikan dependensi.
3. `prestart` menjalankan `scripts/migrate.js`, memeriksa dan menerapkan migrasi yang belum jalan.
4. `start` menjalankan `node shard.js` dan bot menyala.

> [!WARNING]
> **Tiga hal yang paling sering menggagalkan restart di panel:**
>
> 1. **Docker image masih Node di bawah 24.** Bot akan menolak jalan. Periksa lewat tab Startup, bukan lewat `package.json`.
> 2. **`git pull` gagal diam-diam karena ada perubahan lokal.** Bila kamu pernah mengedit file langsung dari File Manager panel (termasuk `package-lock.json` yang berubah karena `npm install`), `git pull` akan berhenti dan bot tetap jalan memakai kode lama. Selalu baca log restart.
> 3. **Folder `.cache/` terhapus.** Folder itu menyimpan tanda tangan slash command (`.cache/commands-deploy.json`). Bila hilang, seluruh slash command akan di-deploy ulang saat boot berikutnya. Tidak berbahaya, hanya memakan rate limit Discord tanpa perlu.

> [!NOTE]
> **Slash command tidak perlu di-deploy manual.** Shard utama (`SHARD_ID` `0`) mendeploy otomatis saat definisi command berubah, dibandingkan lewat tanda tangan SHA-256 yang tersimpan di `.cache/commands-deploy.json`. `npm run deploy` hanya alat paksa bila kamu ingin mendeploy segera.

---

## 📜 Script NPM yang Tersedia

Untuk mempermudah manajemen, kami telah menyediakan beberapa perintah praktis. Jalankan menggunakan terminal pilihanmu:

| Perintah                          | Deskripsi Fungsi                                                                                                                                                                          |
| --------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🚀 `npm start`                    | Menjalankan bot via `shard.js` (ShardingManager). **Gunakan perintah ini untuk Produksi.** Migrasi database berjalan otomatis lebih dulu lewat `prestart`.                                |
| 🗃️ `npm run prestart`             | Dipanggil otomatis oleh npm sebelum `start`. Menjalankan `scripts/migrate.js` dan menggagalkan `start` bila migrasi error. Jarang perlu dijalankan manual.                                |
| 🗃️ `npm run db:migrate`           | Menjalankan migrasi skema database secara terpisah lewat `scripts/migrate.js`. Keluar dengan kode 1 bila gagal, dan migrasi yang sudah pernah jalan dicatat di tabel `schema_migrations`. |
| 🆘 `npm run start:no-migrate`     | Menyalakan bot **tanpa** memeriksa skema. Pintu darurat saja, jangan dijadikan kebiasaan.                                                                                                 |
| 🔄 `npm run dev`                  | Menjalankan bot dengan auto-restart via `--watch`. Sangat pas untuk _development_.                                                                                                        |
| 📤 `npm run deploy`               | Memaksa bot untuk melakukan registrasi ulang seluruh _Slash Command_.                                                                                                                     |
| 📦 `npm run install-start`        | Kombinasi instan: Pasang dependensi dan langsung nyalakan bot (termasuk migrasi).                                                                                                         |
| 🧪 `npm test`                     | Menjalankan seluruh test memakai runner bawaan Node (`node --test`).                                                                                                                      |
| 🔍 `npm run lint`                 | Melakukan pengecekan kode dengan ESLint.                                                                                                                                                  |
| 🔧 `npm run lint:fix`             | Mengecek sekaligus mencoba memperbaiki isu kode secara otomatis (ESLint fix).                                                                                                             |
| 💅 `npm run format`               | Merapikan estetika struktur kode dengan Prettier.                                                                                                                                         |
| 👀 `npm run format:check`         | Memeriksa format kode (hanya laporan, tanpa modifikasi).                                                                                                                                  |
| 🎨 `npm run build:css`            | Membangun berkas CSS dashboard.                                                                                                                                                           |
| 🌐 `npm run locales:check`        | Audit sinkronisasi / paritas kunci bahasa ID vs EN.                                                                                                                                       |
| 🚨 `npm run locales:check:strict` | Sama seperti audit locales biasa, namun proses digagalkan jika ada kunci yang hilang.                                                                                                     |

_(Catatan: Slash command akan ter-deploy otomatis saat bot pertama hidup. Hanya shard utama yang melakukan ini, dan deploy dilewati bila tanda tangan command tidak berubah. Gunakan `--no-deploy` untuk skip, atau `npm run deploy` untuk memaksa.)_

### Pemeriksaan Otomatis di CI

Setiap push dan pull request diperiksa oleh GitHub Actions memakai **Node 24**:

| Pemeriksaan      | Perintah                        |          Status           |
| ---------------- | ------------------------------- | :-----------------------: |
| Linting          | `npm run lint`                  |        Wajib lulus        |
| Gaya tulisan     | `node scripts/check-em-dash.js` |        Wajib lulus        |
| Paritas bahasa   | `npm run locales:check:strict`  |        Wajib lulus        |
| Test             | `npm test`                      |        Wajib lulus        |
| Format           | `npm run format:check`          | Sementara belum memblokir |
| Audit dependensi | `npm audit --audit-level=high`  | Sementara belum memblokir |

### Pengecekan Gaya Tulisan

Kami sangat menjaga standar kualitas tulisan. Teks tidak boleh terkesan kaku seperti robot, dan em dash dilarang di seluruh repo termasuk kamus bahasa.

```bash
node scripts/check-em-dash.js          # Mencari dan melaporkan simbol em-dash yang tersisa
node scripts/check-em-dash.js --fix    # Memperbaiki secara otomatis dan memberikan report
```

---

## 🔐 Konfigurasi Environment

Semua kredensial dan pengaturan penting disimpan di `.env` (berdasarkan [`src/config/env.js`](src/config/env.js)).
**Pastikan kamu mengisi semua variabel WAJIB sebelum menjalankan bot, atau bot akan menolak untuk menyala!**

> [!NOTE]
> `src/config/env.js` adalah satu-satunya sumber kebenaran untuk nama variabel dan nilai default. Seluruh akses `process.env` wajib melewati file itu, jangan pernah dibaca langsung dari modul lain.

### 🔴 Wajib Diisi (Core)

| Variabel         | Deskripsi                                               |
| ---------------- | ------------------------------------------------------- |
| `DISCORD_TOKEN`  | Token bot rahasia milikmu dari Discord Developer Portal |
| `CLIENT_ID`      | Application ID dari bot kamu                            |

<details>
<summary><b>💬 Discord Settings</b> (Klik untuk membuka)</summary>

| Variabel              | Default | Deskripsi                                                                   |
| --------------------- | ------- | --------------------------------------------------------------------------- |
| `PREFIX`              | `n!`    | Prefix klasik untuk menjalankan command teks                                |
| `GUILD_ID`            | -       | ID Server khusus untuk deploy slash command instan (saat masa uji coba/dev) |
| `OWNER_IDS`           | -       | Daftar ID owner yang dipisahkan oleh koma (contoh: `1234,5678`)             |
| `STAFF_GUILD_ID`      | -       | ID Server utama bagi para staf untuk mengurus ModMail                       |
| `MODMAIL_CATEGORY_ID` | -       | Kategori khusus di server staf untuk menampung tiket ModMail                |

</details>

<details>
<summary><b>🗄️ Database & Cache Settings</b> (Klik untuk membuka)</summary>

| Variabel              | Default                                         | Deskripsi                                                                                                                   |
| --------------------- | ----------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `SUPABASE_URL`        | `https://ceqkjzvrxyifxzgxtkig.supabase.co`      | URL REST/API endpoint project Supabase kamu                                                                                 |
| `SUPABASE_KEY`        | `sb_publishable_...`                            | Anon / Publishable key project Supabase                                                                                     |
| `SUPABASE_PROJECT_ID` | `ceqkjzvrxyifxzgxtkig`                          | Project ID unik Supabase                                                                                                    |
| `DATABASE_URL`        | -                                               | URI koneksi PostgreSQL direct / transaction pooler                                                                          |
| `DB_HOST`             | `db.ceqkjzvrxyifxzgxtkig.supabase.co`           | Host database PostgreSQL / Supabase                                                                                         |
| `DB_PORT`             | `5432`                                          | Port database PostgreSQL (5432) atau Session Pooler (6543)                                                                  |
| `DB_USER`             | `postgres`                                      | Username database                                                                                                           |
| `DB_PASSWORD`         | -                                               | Password database PostgreSQL / Supabase                                                                                     |
| `DB_NAME`             | `postgres`                                      | Nama database                                                                                                               |
| `DB_SSL`              | `true`                                          | Mengaktifkan enkripsi SSL koneksi database cloud                                                                            |
| `MONGO_URI`           | `mongodb://127.0.0.1:27017/naura_hoshino`       | Connection string MongoDB untuk riwayat AI Chat, transkrip tiket, dan audit log                                             |
| `REDIS_URL`           | -                                               | _Opsional_. URL koneksi Redis. Biarkan kosong untuk mematikan Cache/PubSub eksternal.                                       |
| `DB_POOL_BUDGET`      | `80`                                            | Total koneksi database untuk **seluruh** shard, lalu dibagi jumlah shard.                                                   |
| `DB_POOL_MAX`         | -                                               | Penimpa manual `pool.max` per proses. Isi hanya bila kamu tahu pasti kapasitas database.                                    |
| `SKIP_DB_MIGRATE`     | -                                               | Pintu darurat. Isi `1`, `true`, atau `yes` untuk melewati migrasi saat boot. Jangan dibiarkan menyala permanen.             |

> [!NOTE]
> Bila kredensial database cloud tidak terisi atau gagal terhubung, bot otomatis beralih ke penyimpanan darurat SQLite (`naura_fallback.sqlite`). Di dalam kode nilai-nilai ini diakses melalui `src/config/env.js`.

> [!WARNING]
> `pool.max` bersifat **per proses**, bukan per bot. Dua shard dengan `pool.max: 100` akan meminta 200 koneksi. Karena itu Naura memakai anggaran total (`DB_POOL_BUDGET`) yang dibagi jumlah shard agar tetap dalam kuota pooler.

</details>

<details>
<summary><b>🎧 Lavalink / Music Settings</b> (Klik untuk membuka)</summary>

| Variabel            | Default           |
| ------------------- | ----------------- |
| `LAVALINK_HOST`     | `localhost`       |
| `LAVALINK_PORT`     | `2333`            |
| `LAVALINK_PASSWORD` | `youshallnotpass` |
| `LAVALINK_SECURE`   | `false`           |

**Link Spotify & LavaSrc.** Node Lavalink lokal (service `lavalink` di `docker-compose.yml`) sudah dikonfigurasi dengan plugin **LavaSrc** + **youtube-source** lewat `docker/lavalink/application.yml`, sehingga link Spotify (`open.spotify.com/track|album|playlist|artist`) dimainkan secara native. Kredensial `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` wajib diisi di `.env` agar plugin bisa mencari dan mirror berbasis ISRC. Untuk menyalakan node: `docker compose up -d lavalink`. Bila node yang dipakai TIDAK punya LavaSrc, bot otomatis jatuh ke translasi manual (`src/music/spotifyResolver.js`: Web API Spotify → `ytsearch` ISRC/judul).

| Variabel                       | Default |
| ------------------------------ | ------- |
| `SPOTIFY_CLIENT_ID`            | -       |
| `SPOTIFY_CLIENT_SECRET`        | -       |
| `SPOTIFY_MARKET`               | `ID`    |
| `SPOTIFY_MAX_PLAYLIST_TRACKS`  | `100`   |

</details>

<details>
<summary><b>🤖 AI Configuration</b> (Klik untuk membuka)</summary>

| Variabel             | Default                  | Deskripsi                                   |
| -------------------- | ------------------------ | ------------------------------------------- |
| `GEMINI_API_KEY`     | -                        | API Key utama untuk Google Gemini           |
| `VERBA_API_KEY`      | -                        | API Key untuk sistem Persona Naura          |
| `VERBA_SLUG_OWNER`   | -                        | Persona khusus saat merespon Owner bot      |
| `VERBA_SLUG_PREMIUM` | -                        | Persona khusus saat merespon User Premium   |
| `VERBA_SLUG_GENERAL` | -                        | Persona umum sehari-hari                    |
| `OLLAMA_BASE_URL`    | `http://localhost:11434` | Fallback URL jika AI lokal dipakai          |
| `OLLAMA_MODEL`       | `llama3.1`               | Model yang akan digunakan oleh Ollama       |
| `FOOOCUS_BASE_URL`   | `http://localhost:7865`  | Server endpoint untuk generasi gambar lokal |

</details>

<details>
<summary><b>🌐 Dashboard & Webhook Endpoint</b> (Klik untuk membuka)</summary>

| Variabel                  | Default | Deskripsi                                                                         |
| ------------------------- | ------- | --------------------------------------------------------------------------------- |
| `PORT` / `DASHBOARD_PORT` | `3070`  | Port aktif untuk Dashboard Web                                                    |
| `WEBHOOK_PORT`            | `3071`  | Port terpisah khusus webhook donasi/vote                                          |
| `SESSION_SECRET`          | -       | 🔴 **WAJIB DI PRODUKSI!** Dashboard akan menolak akses tanpa secret ini!          |
| `DISCORD_CLIENT_SECRET`   | -       | OAuth2 client secret dari Developer Portal                                        |
| `DISCORD_CALLBACK_URL`    | -       | URL untuk callback autentikasi OAuth2                                             |
| `DASHBOARD_ORIGIN`        | -       | Origin yang di-whitelist untuk perlindungan CORS lintas domain                    |
| `OWNER_EVAL_ENABLED`      | `false` | Membuka rute eksekusi `eval` Owner. Nyalakan hanya saat sangat perlu (Debugging). |
| `ERROR_WEBHOOK_URL`       | -       | Discord Webhook URL agar bot bisa melaporkan error krusial                        |
| `WEBHOOK_AUTH_SAWERIA`    | -       | Password/Token webhook Saweria                                                    |
| `WEBHOOK_AUTH_TRAKTEER`   | -       | Password/Token webhook Trakteer                                                   |
| `WEBHOOK_AUTH_VOTE`       | -       | Password/Token webhook vote Top.gg                                                |

> [!CAUTION]
> Endpoint webhook **akan memblokir semua request (503)** jika token belum diatur. Hal ini bertujuan sebagai pengaman ekstra. Jika modul donasi terekspos tanpa auth, pihak tidak bertanggung jawab berpotensi men-suntik request palsu untuk mendapatkan role Premium secara gratis!

</details>

<details>
<summary><b>🛠️ Media & Metadata Information</b> (Klik untuk membuka)</summary>

| Variabel         | Default                | Deskripsi                                                                                                |
| ---------------- | ---------------------- | -------------------------------------------------------------------------------------------------------- |
| `FFMPEG_PATH`    | -                      | Kosongkan saja jika kamu ingin menggunakan modul `ffmpeg-static`. Isi jika server punya _binary_ khusus. |
| `BOT_VERSION`    | `2.0.0`                | Versi yang terpampang pada command /info                                                                 |
| `ENGINE_VERSION` | `2.0.0`                | Versi engine yang ditandai pada footer Naura                                                             |
| `PARTNERSHIP`    | `Belum ada kolaborasi` | Label nama server/komunitas yang sedang bekerja sama (ditampilkan di profil)                             |

</details>

---

## 🗂️ Struktur Proyek

Bagi kamu yang ingin ikut mengembangkan atau memodifikasi, berikut peta singkat direktori inti:

```plaintext
Naura-Hoshino-V2/
├─ 📄 index.js               # Inti utama proses bot (berjalan satu per shard)
├─ 📄 shard.js               # Pengelola titik masuk produksi (ShardingManager)
├─ 📘 AGENTS.md              # Aturan pengembangan, arsitektur, & konvensi wajib
├─ 🗂️ TODO.md                # Prioritas sprint yang sedang berjalan
├─ 🎨 DESIGN.md              # Design token & panduan visual
├─ 🖼️ assets/                # Kumpulan font, gambar, serta aset UI Canvas
│  ├─ language/              # Sistem lokalisasi kamus terpadu (id.json, en.json)
│  └─ Naura_Expression/      # Folder rahasia 15+ Ekspresi Wajah Naura
├─ 🧩 plugin/                # Semua fungsi command, rapi terbagi dalam sub-kategori
├─ 🔧 scripts/               # Alat-alat kecil utilitas pemeliharaan sistem
│  └─ migrate.js             # Runner migrasi database (dipanggil prestart)
└─ 📂 src/
   ├─ ⚙️ config/             # Pengaturan statis, konstanta UI & validasi ENV
   ├─ 🎨 canvas/             # Seluruh visual renderer Canvas (Worker Thread Pool)
   ├─ 🌐 dashboard/          # Markas Express + Socket.io Web Dashboard
   ├─ 📡 events/             # Pendengar event (Listener) inti dari Discord
   ├─ 🎛️ interactions/      # Registry Button, Select Menu, Modal, & Autocomplete
   ├─ 🧠 managers/           # Otak pusat (Database, Cache, Cronjob, Logger, dsb)
   ├─ 🗃️ models/             # Kerangka Tabel Sequelize & Dokumen Mongoose
   └─ 🛠️ utils/              # Builder Component V2 canggih dan asisten bantuan lainnya
```

---

## 🌍 Sistem Bilingual

Kami merancang Naura agar mudah dimengerti dari Sabang sampai Merauke, hingga tingkat Internasional. Bahasa (**Indonesia (ID)** & **English (EN)**) dipilih lalu disimpan pada tabel personal `user_profiles`.

> [!IMPORTANT]
> **Bahasa bersifat personal, bukan per server.** Dua orang di server yang sama bisa memakai bahasa berbeda. `GuildSettings.language` hanya menjadi **default** bagi user yang belum pernah memilih bahasa. Urutan resolusinya: preferensi user → default guild → `id`.

```javascript
const lang = require("./src/managers/languageManager");

// Simpan pilihan preferensi si pengguna
await lang.setUserLanguage(userId, "en");

// Dapatkan terjemahan khusus untuk UI pengguna
const text = await lang.translate(userId, "help.title");
const sync = lang.translateSync("en", "greeting", { name: "Ryaa" });
```

Seluruh kamus terpadu diletakkan di `assets/language/id.json` dan `assets/language/en.json` agar pemuatan instan dan audit paritas selalu 100% lengkap. Kamu bisa cek kelengkapan bahasa dengan perintah: `npm run locales:check:strict`.

---

## 🎭 Ekspresi Naura

Naura tidak kaku! Ia dapat memancarkan perasaannya lewat embed khusus.

```javascript
const naura = require("./src/utils/nauraExpression");

// Naura senang karena interaksi sukses!
const { embed, files } = naura.decorate(myEmbed, "success");
await interaction.reply({ embeds: [embed], files });
```

**Kumpulan Mood Utama:**
| | | | | | | | |
|:---:|---|:---:|---|:---:|---|:---:|---|
| ✅ | **`success`** | ❌ | **`error`** | ⚠️ | **`warning`** | ℹ️ | **`info`** |
| ⏳ | **`loading`** | 🎉 | **`levelup`** | 🎵 | **`music`** | 📖 | **`help`** |

> Cek referensi lengkap seluruh ekspresi emosi di berkas [`src/utils/nauraExpression.js`](src/utils/nauraExpression.js)

> [!NOTE]
> **Batas Components V2 dijaga otomatis.** `buildContainerV2()` melewati `src/utils/componentBudget.js` sebelum payload dikirim, jadi respons yang kelewat panjang dipangkas beserta catatan, bukan ditolak Discord dengan `Invalid Form Body`. Tombol dan footer tidak pernah dikorbankan.

---

## 🤝 Kontribusi

Sebelum menulis kode, **baca [`AGENTS.md`](AGENTS.md) lebih dulu.** File itu memuat seluruh aturan yang mengikat, dan ringkasannya:

- **Branch**: `main` untuk produksi, `dev` untuk pengembangan, `feature/<nama>` untuk pekerjaan baru.
- **Commit**: format `<emoji> <tipe>: <deskripsi singkat>`, contoh `✨ feat: tambah command /weather`. Tipe yang dipakai: `feat`, `fix`, `refactor`, `docs`, `style`, `perf`, `chore`, `test`, `ci`.
- **Satu PR per sprint**, dan setiap PR menyebut nomor issue yang dikerjakan.
- **Gaya kode**: CommonJS, indentasi 4 spasi, semicolon wajib, komentar Bahasa Indonesia, tanpa em dash.
- **UI**: semua respons memakai Components V2 lewat `buildContainerV2()` dengan struktur 5 lapisan dan footer wajib.
- **Nilai ekonomi wajib atomik.** Jangan pernah membaca saldo lalu menuliskannya kembali. Pakai `incrementUserProfile()` / `incrementUserSurvival()` untuk menambah, dan `debitUserProfile()` / `debitUserSurvival()` untuk mengurangi.
- **Kolom JSON juga wajib atomik.** Inventory, `rpg_state`, dan kawan-kawannya hanya boleh diubah lewat `cacheManager.mutateUserProfileJson()` / `mutateUserSurvivalJson()`, atau lewat helper siap pakai `addItemsAtomic()` / `takeItemsAtomic()` di `plugin/survival/inventoryHelper.js`.
- **`row.save()` wajib menyebut `fields`.** Menyimpan seluruh baris akan menimpa kolom saldo yang sedang menunggu increment atomik, dan itu pernah menyebabkan bug kupon dobel.
- **Migrasi database**: berjalan otomatis lewat `prestart` sebelum `npm start`, dan migrasi baru hanya ditambahkan di `src/managers/dbMigrator.js`.
- **`ephemeral: true` sudah dilarang.** Pakai `flags: MessageFlags.Ephemeral`, lint akan memperingatkan pemakaian baru.
- **CI harus hijau** (lint, em dash, paritas bahasa, test) sebelum merge.

---

## 📄 Lisensi

<div align="center">

**ISC License** © 2026 Aryandita Praftian.
Lihat berkas lisensi penuh di **[`LICENSE`](LICENSE)**.

_Dibuat penuh dengan cinta (💜) untuk para kreator & komunitas Discord Indonesia!_

</div>
