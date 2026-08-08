# TODO Naura Hoshino V2 — Roadmap Pengembangan

Daftar pekerjaan strategis berdasarkan evaluasi arsitektur. Pekerjaan dibagi menjadi beberapa sprint (tahapan) berdasarkan prioritas.

---

## 🔴 Sprint 1: Fundamental & Kritis (Minggu Ini)

Fokus pada kestabilan pipeline, monitoring, dan sinkronisasi desain awal.

- [ ] **Setup GitHub Actions CI secara menyeluruh**
  - **Cara Implementasi:**
    1. Buka `.github/workflows/ci.yml`.
    2. Tambahkan step untuk mengeksekusi `node scripts/check-em-dash.js`.
    3. Ubah `npm run locales:check` menjadi `npm run locales:check:strict` agar pipeline gagal jika ada kunci bahasa yang tertinggal.
- [ ] **Audit Desain Dashboard vs `DESIGN.md`**
  - **Cara Implementasi:**
    1. Buka `src/dashboard/public/css/style.css` dan pastikan implementasi `.glass-panel` menggunakan `backdrop-filter: blur(16px)` dan background color `rgba(255, 255, 255, 0.03)` sesuai `DESIGN.md`.
    2. Pastikan font utama diubah: metrik/angka menggunakan `Orbitron`, teks biasa menggunakan `Outfit`.
    3. Tambahkan efek pendar (glow) pada hover state kartu-kartu di dashboard.
- [ ] **Tambahkan API Health Check External**
  - **Cara Implementasi:**
    1. Buat file route baru `src/dashboard/routes/api.js`.
    2. Daftarkan endpoint `GET /api/health`.
    3. Panggil `featureRegistry.getHealthStats()` dari registry yang sudah ada dan kembalikan status `200 OK` dengan payload JSON. Daftarkan route ini di `server.js`.

---

## 🟠 Sprint 2: UI Real-time & Interaksi (2-4 Minggu)

Membangun modul dashboard baru dan meningkatkan "nyawa" AI Naura.

- [ ] **Halaman Music Control Panel (`music.html`) di Dashboard**
  - **Cara Implementasi:**
    1. Buat view `src/dashboard/views/music.html`.
    2. Buat socket event di `src/dashboard/sockets/` untuk memancarkan (emit) state Lavalink secara real-time (lagu sekarang, queue, posisi durasi).
    3. Di frontend, listen socket event tersebut dan update progress bar menggunakan vanilla JS / Tailwind.
- [ ] **Implementasi AI Conversation Memory per-User**
  - **Cara Implementasi:**
    1. Buka `src/managers/aiManager.js`.
    2. Sebelum memanggil LLM API, cek `redisManager` untuk kunci `ai_memory:{userId}`.
    3. Jika ada, gabungkan history tersebut ke dalam context. Setelah response diterima, push response baru ke array dan simpan kembali ke Redis dengan `TTL 3600` (1 jam).
- [ ] **Sistem Moderasi: Tempban & Strike Escalation**
  - **Cara Implementasi:**
    1. Buat model `UserStrike` atau modifikasi `UserWarn`.
    2. Di `plugin/admin/warn.js`, tambahkan logika pengecekan total peringatan.
    3. Jika total mencapai 3, jalankan `interaction.guild.members.ban(userId)` dan jadwalkan unban menggunakan agenda/cron (`src/managers/cronManager.js`).

---

## 🟡 Sprint 3: Fitur Lanjutan & Optimasi (1-2 Bulan)

Fokus pada fitur-fitur yang menambah nilai hiburan dan optimalisasi beban server.

- [ ] **Audio Filters & DJ Role Sistem Musik**
  - **Cara Implementasi:**
    1. Tambahkan subcommand `/music filter [tipe]`.
    2. Gunakan `player.setFilters()` dari Poru (Lavalink wrapper) untuk mengaplikasikan Nightcore, BassBoost, dll.
    3. Tambahkan field `djRoleId` di `GuildSettings`. Jika di-set, cegah interaksi tombol (skip, stop) oleh user tanpa role tersebut di `musicButtons.js`.
- [ ] **Halaman Ekonomi (`economy.html`) & Auction House**
  - **Cara Implementasi:**
    1. Buat `economy.html` menampilkan tabel klasemen kekayaan dan statistik inflasi server.
    2. Untuk Auction, buat tabel `market_auctions`. Tambahkan command `/market auction [item] [harga]` dan `/market bid`.
- [ ] **Anti-Raid System**
  - **Cara Implementasi:**
    1. Di `guildMemberAdd.js`, gunakan Rate Limiter memory untuk menghitung jumlah join per guild.
    2. Jika melebihi batas (contoh: 5 joins per 10 detik), set flag `GuildSettings.settings.lockdown = true` dan nonaktifkan channel verifikasi.
- [ ] **Optimasi: Caching Canvas Image via Redis**
  - **Cara Implementasi:**
    1. Di `imageManager.js` (atau setelah dipecah jadi `canvasManager.js`), sebelum memanggil `@napi-rs/canvas`, cek Redis dengan key `canvas:profile:{userId}`.
    2. Simpan hasil buffer render gambar ke Redis sebagai base64 string dengan TTL 300 detik (5 menit).
- [ ] **Refactor `imageManager.js`**
  - **Cara Implementasi:** Pecah file 32KB ini. Pindahkan fungsi-fungsi spesifik ke file terpisah seperti `src/utils/canvas/profileRenderer.js` dan `src/utils/canvas/levelCardRenderer.js`.

---

## 🟢 Sprint 4: Ekspansi & Visibilitas (2-3 Bulan)

Mengukuhkan posisi Naura sebagai bot papan atas.

- [ ] **Seasonal Events System**
  - **Cara Implementasi:**
    1. Di `survivalContext.js`, tambahkan fungsi penentu musim (Halloween, Lebaran, Natal) berdasarkan tanggal.
    2. Berikan boost drop rate atau spawn rate item eksklusif berdasarkan event aktif.
- [ ] **Dashboard: Welcome Card Visual Builder**
  - **Cara Implementasi:**
    1. Buat halaman web interaktif menggunakan Canvas HTML5.
    2. Izinkan admin menggeser elemen (drag-drop teks, warna overlay) dan mengekspor JSON config yang akan disimpan ke tabel `GuildSettings`.
- [ ] **Plugin Ticketing Lanjutan**
  - **Cara Implementasi:**
    1. Buat folder `plugin/ticketing/`.
    2. Gunakan Discord Modal V2 untuk formulir pembuatan tiket, lalu buat private thread channel per-tiket.
- [ ] **AI Function Calling Lanjutan**
  - **Cara Implementasi:** Konfigurasi SDK `@google/genai` untuk menerima `tools`. Daftarkan tool seperti `check_balance` atau `get_user_info`, arahkan ke fungsi internal bot.

---

## 📜 Arsip Selesai (Versi 1.2.0 - Core Engine)

<details>
<summary>Klik untuk melihat daftar pekerjaan yang sudah selesai</summary>

- [x] Selaraskan nama variabel environment di README dengan `src/config/env.js`
- [x] Hentikan `process.exit(1)` saat `env.js` di-import
- [x] Deploy slash command hanya oleh shard utama
- [x] Perbaiki `npm run deploy` agar flag `--deploy` dihormati
- [x] Pusatkan `NODE_ENV` lewat `src/config/env.js`
- [x] Pastikan semua migration schema hanya berada di `src/managers/dbMigrator.js`
- [x] Arahkan update settings dari `messageCreate` lewat `guildSettingsService`
- [x] Migrasikan respons komponen kedaluwarsa ke Container V2
- [x] Tambahkan `nauraText` helper untuk copywriting persona Naura bilingual
- [x] Tambahkan fondasi `src/config/features.js` untuk feature registry
- [x] Ganti query panas `GuildSettings.findOne()` dengan cache terpusat
- [x] Cache bahasa per user agar tidak query database di setiap balasan
- [x] Helper `src/utils/nauraExpression.js` terintegrasi ke Container Builder
- [x] Survival: Rapikan 33 subcommand
- [x] Bersihkan sisa em dash pada kamus bahasa

</details>
