# 🦖 PANDUAN DEPLOYMENT PTERODACTYL PANEL, NAURA HOSHINO V2

> **Versi Ekosistem:** 2.3.0 · **Target Environment:** Pterodactyl Panel Only · **Runtime:** Node.js >= 24

Dokumen ini disusun khusus untuk deployment Naura Hoshino V2 pada **Pterodactyl Panel**. Bot dirancang untuk berjalan secara native menggunakan lifecycle script NPM (`prestart` -> `start`) tanpa memerlukan skrip wrapper eksternal.

---

## 📋 1. Kebutuhan Server & Egg Pterodactyl

Pastikan server Pterodactyl Anda memenuhi konfigurasi berikut:

| Pengaturan | Nilai / Spesifikasi | Keterangan |
| :--- | :--- | :--- |
| **Pterodactyl Egg** | Generic NodeJS / DiscordJS | Menggunakan runtime JavaScript resmi |
| **Docker Image** | `ghcr.io/parkervcp/yolks:nodejs_24` | Wajib Node.js versi 24 ke atas |
| **Startup Command** | `npm start` *(Rekomendasi)* atau `node shard.js` | Menjalankan Sharding Manager otomatis |
| **RAM Alokasi** | Minimal 1024 MB (1 GB), Rekomendasi 2048 MB (2 GB) | Untuk canvas worker pool, dashboard, dan audio cluster |
| **Storage Alokasi** | Minimal 1500 MB (1.5 GB) | Menyimpan aset visual, model 3D Avatar, dan dependensi |

---

## 🚀 2. Langkah-Langkah Deployment

### Langkah 1: Unggah & Ekstrak Berkas Arsip
1. Buka server bot Anda di **Pterodactyl Panel**.
2. Masuk ke tab **File Manager**.
3. Pastikan direktori root server bersih (`/home/container/`).
4. Unggah berkas `Naura_Hoshino_V2_Deploy_Package.zip` ke panel.
5. Klik ikon titik tiga pada berkas zip lalu pilih **Unarchive** (Ekstrak).
6. Berkas-berkas utama seperti `package.json`, `shard.js`, `index.js`, dan direktori `src/` akan langsung berada di root `/home/container/`.
7. Anda dapat menghapus berkas zip setelah proses ekstrak selesai untuk menghemat storage.

### Langkah 2: Konfigurasi File Lingkungan (.env)
1. Di File Manager, cari file `.env`:
   - Jika belum ada, buat salinan dari `.env.example` lalu ubah namanya menjadi `.env`.
2. Buka dan edit file `.env` di editor panel Pterodactyl:
   - **Kredensial Discord:**
     - `DISCORD_TOKEN`: Token bot Discord
     - `CLIENT_ID`: Application ID bot Discord
     - `OWNER_IDS`: ID akun Discord Owner
   - **Database Supabase (PostgreSQL):**
     - `DATABASE_URL` atau `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`, `DB_PORT`, `DB_SSL=true`
   - **MongoDB Atlas:**
     - `MONGODB_URI`: URI koneksi MongoDB Atlas
   - **Redis (Opsional):**
     - `REDIS_URL`: URL Redis server (kosongkan jika menggunakan memori fallback bawaan)
   - **Audio Lavalink v4:**
     - `LAVALINK_HOST`, `LAVALINK_PORT`, `LAVALINK_PASSWORD`
   - **Web Dashboard Port:**
     - `DASHBOARD_PORT`: Sesuaikan dengan port yang dialokasikan oleh panel Pterodactyl pada tab **Network / Allocations**.
3. Simpan perubahan file `.env`.

### Langkah 3: Konfigurasi Startup di Panel
1. Buka tab **Startup** di menu panel sebelah kiri.
2. Periksa kolom **Startup Command**:
   ```bash
   npm start
   ```
3. Pastikan kolom **Docker Image** memilih tag **NodeJS 24** (`ghcr.io/parkervcp/yolks:nodejs_24`).

### Langkah 4: Menyalakan Bot (Console)
1. Buka tab **Console** di panel Pterodactyl.
2. Klik tombol **Start** hijau.
3. Node package manager akan secara otomatis:
   - Menjalankan hook `prestart`:
     - Memeriksa build dashboard terintegrasi (`ensure-build.js`)
     - Menjalankan migrasi skema database relasional otomatis (`migrate.js`)
     - Melakukan pemanasan awal cache sistem (`warmup-cache.js`)
   - Meluncurkan Sharding Manager (`shard.js`) yang membagi beban bot ke shard-shard gateway Discord.
4. Bot akan online dan siap menerima interaksi pengguna.

---

## 🩺 3. Operasi Darurat dari Pterodactyl

- **Diagnostik Kesehatan 6 Pilar:** Kirim DM langsung ke bot Discord lalu ketik `/owner doctor`.
- **Flush Cache / Lepas Lock Darurat:** Klik tombol interaktif `[🧹 Flush Cache]` atau `[🔓 Lepas Deadlock]` pada kartu diagnostik di DM Owner.
- **Karantina Server Terhadap Serbuan Bot:** Jalankan `/moderation panic aksi:enable` di channel server yang bersangkutan.
- **Restart Cepat:** Gunakan tombol **Restart** pada panel Pterodactyl kapan saja. State antrean musik dan cache akan dipulihkan secara otomatis.
