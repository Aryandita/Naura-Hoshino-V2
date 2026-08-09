# 🌸 PLAN.md — Rencana Penambahan Fitur Naura Hoshino V2

> **Dibuat:** 2026-08-09 · **Versi Target:** 2.1.0+
> **Referensi Sprint Aktif:** Sprint 2 di `TODO.md` harus selesai sebelum fitur baru dari kategori P3/P4 di sini dikerjakan.
> **Riset:** Berdasarkan tren bot Discord 2025–2026 (AI agents, gacha, voice rewards, social graph, modular architecture) dan audit arsitektur proyek saat ini.

---

## Cara Membaca Dokumen Ini

| Simbol | Arti |
|---|---|
| 🔥 **HOT** | Sedang viral di komunitas Discord, potensi engagement tinggi |
| 🧠 **AI** | Memanfaatkan infrastruktur AI yang sudah ada di `aiManager.js` |
| 🎮 **RPG** | Memperluas ekosistem survival yang sudah ada |
| 🛡️ **INFRA** | Memperkuat fondasi teknis |
| 💎 **PREMIUM** | Fitur monetisasi / differensiasi premium |
| 📊 **DATA** | Memanfaatkan data yang sudah terkumpul untuk insight |

Setiap fitur ditulis dengan:
- **Deskripsi** — apa yang dilakukan
- **Mengapa sekarang** — relevansi tren 2026 dan gap yang teridentifikasi di kode
- **Integrasi dengan kode yang ada** — file mana yang terdampak / jadi titik masuk
- **Kompleksitas** — estimasi kasar (S / M / L / XL)

---

## 🧠 Kategori 1: AI — Naura Jadi Lebih Cerdas

### 1.1 🔥🧠 AI Memory Jangka Panjang per User

**Deskripsi:**
Saat ini `aiManager.js` memproses setiap pesan secara stateless — Naura tidak "mengingat" percakapan sebelumnya kecuali dari sesi yang sama. Fitur ini menyimpan ringkasan percakapan setiap user di Redis dengan key `ai:memory:{userId}`, diambil saat user bicara lagi, lalu dikompres otomatis saat mendekati batas token.

**Mengapa sekarang:**
Tren 2026 menyebut *"persistent brains"* sebagai standar baru bot AI. User yang merasa "dikenal" oleh bot jauh lebih aktif kembali. Infrastruktur Redis sudah tersedia.

**Integrasi:**
- `plugin/ai/` → tambah `aiMemory.js` sebagai helper
- `src/managers/aiManager.js` → tambah `getMemoryContext(userId)` dan `appendMemory(userId, summary)`
- Redis key: `ai:memory:{userId}` (TTL 7 hari, diperbarui setiap sesi)
- Model Sequelize opsional `AiMemory` bila ingin persistensi permanen

**Kompleksitas:** M

---

### 1.2 🧠 AI Function Calling — Naura Bisa "Bertindak"

**Deskripsi:**
Mendaftarkan tool ke SDK `@google/genai` sehingga Naura bisa menjalankan aksi nyata saat user memintanya lewat chat natural. Contoh:
- "Naura, cek saldo aku" → panggil `check_balance(userId)`
- "Naura, mainkan lagu lofi" → panggil `play_music(query)`
- "Naura, beri aku info cuaca Bandung" → panggil `get_weather(city)`

**Mengapa sekarang:**
Function calling adalah inti pergeseran dari "chatbot" ke "autonomous agent" — tren #1 di ekosistem Discord 2026.

**Integrasi:**
- `src/managers/aiManager.js` → tambah `defineTools()` dan `handleToolCall(toolName, args, context)`
- `plugin/ai/` → `aiTools.js` berisi definisi skema JSON setiap tool
- WAJIB: guard prompt injection (konten server = input tidak terpercaya, sudah ada di `AGENTS.md` aturan 1.5)
- Kuota token per user via `cacheManager`

**Kompleksitas:** L

---

### 1.3 🧠💎 AI Dungeon Master — Mode Cerita Interaktif

**Deskripsi:**
Command baru `/story` yang memulai sesi narasi RPG berbasis teks menggunakan Gemini sebagai DM. Naura menceritakan skenario, user memilih aksi lewat tombol atau ketik bebas, dan hasilnya mempengaruhi `rpg_state` (XP, item drop kecil). Sesi tersimpan di Redis dengan TTL 1 jam.

**Mengapa sekarang:**
`storyData.js` sudah ada di `plugin/survival/` — fondasi naratif tersedia. Menggabungkan AI + RPG survival adalah differensiasi yang belum umum di bot lain.

**Integrasi:**
- `plugin/ai/story-mode.js` (file baru)
- `plugin/survival/storyData.js` sebagai seed world-building
- `plugin/survival/survivalContext.js` untuk konteks lokasi dan cuaca
- Redis: `story:session:{userId}` (TTL 3600 detik)

**Kompleksitas:** L

---

## 🎮 Kategori 2: RPG & Survival — Dunia yang Lebih Hidup

### 2.1 🔥🎮 Sistem Gacha — Peti Harta & Banner Event

**Deskripsi:**
Command `/gacha roll` dan `/gacha banner` memungkinkan user menggunakan Naura Coupon atau mata uang untuk menarik item/kartu acak dengan sistem pity (jaminan SSR setelah N roll). Mendukung:
- **Banner standar** — item survival biasa dengan rate berbeda
- **Banner event musiman** — item eksklusif yang hanya muncul saat event Halloween, Lebaran, dll.
- **Pity system** — counter tersimpan di `rpg_state`, dijamin atomik via `mutateUserSurvivalJson()`

**Mengapa sekarang:**
Gacha adalah salah satu fitur paling terbukti mendorong retensi harian. `items_coupon.js` sudah ada, artinya design item sudah ada. `seasonal events system` juga ada di Sprint 5 TODO — gacha dan seasonal bisa dikerjakan bersama.

**Integrasi:**
- `plugin/survival/gacha.js` (file baru) + `plugin/survival/gachaBanners.js`
- `plugin/survival/items_coupon.js` — tambah properti `rarity` dan `bannerPool`
- `cacheManager.mutateUserSurvivalJson()` untuk update pity counter atomik
- Canvas card reveal via `plugin/canvas/` (animasi flip kartu)

**Kompleksitas:** M

---

### 2.2 🎮 Sistem Guild / Klan Antar Server

**Deskripsi:**
User bisa membuat atau bergabung ke **Guild** (bukan Discord Guild, melainkan klan in-game). Guild punya:
- Nama, lambang (emoji), dan deskripsi
- Bank guild bersama (sumbang koin → dana operasional)
- Quest guild mingguan yang harus diselesaikan bersama
- Papan peringkat guild global
- Buff kolektif saat seluruh anggota aktif di minggu itu

**Mengapa sekarang:**
"Guilds & Collaboration" adalah fitur trending 2026 karena mendorong social play. `duelEngine.js` dan `dungeonCombat.js` sudah ada — tinggal menambah lapisan guild di atasnya.

**Integrasi:**
- Model baru `PlayerGuild` (Sequelize) + tabel `guild_members`
- `plugin/survival/guildManager.js` (file baru)
- Kolom `guildId` di `UserSurvival`
- Dashboard: halaman guild di `src/dashboard/`

**Kompleksitas:** XL

---

### 2.3 🔥🎮 PvP Arena — Duel Terjadwal & Tournament

**Deskripsi:**
Memperluas `duelEngine.js` yang sudah ada menjadi sistem arena penuh:
- **Ranked duel** dengan rating Elo yang tersimpan di database
- **Tournament bracket** — admin bisa buat turnamen, bot otomatis atur jadwal dan bracket
- **Spectator mode** — user lain bisa melihat duel yang sedang berjalan lewat pesan live-update
- **Prize pool** dari sumbangan peserta + bonus guild

**Mengapa sekarang:**
`duelEngine.js` sudah ada tapi berdiri sendiri. Menambahkan progression (rating Elo) mengubahnya dari fitur satu kali pakai menjadi loop retention yang kuat.

**Integrasi:**
- `plugin/survival/duelEngine.js` → tambah rating Elo dan history
- `plugin/survival/arena.js` (file baru) untuk tournament logic
- Model baru `DuelRecord` untuk history dan leaderboard
- `cronManager.js` untuk jadwal tournament otomatis

**Kompleksitas:** L

---

### 2.4 🎮 Sistem Pet — Evolusi, Mood & Breeding

**Deskripsi:**
`petCanvas.js` sudah ada di `plugin/canvas/`. Fitur ini menambah kedalaman:
- **Mood system** — pet punya `mood` (happy/hungry/bored) yang berubah berdasarkan interaksi
- **Evolusi** — pet bisa berevolusi ke tahap berikutnya setelah mencapai level tertentu
- **Skill pet** — tier tinggi memberikan passive buff ke survival user (misal: pet anjing +10% drop rate)
- **Breeding** — dua pet bisa dikawinkan untuk menghasilkan pet baru dengan sifat campuran

**Mengapa sekarang:**
Pet adalah fitur "attachment" terkuat dalam ekonomi bot — user yang punya pet yang dirawat jauh lebih susah churn.

**Integrasi:**
- `plugin/canvas/petCanvas.js` → tambah state visual mood dan evolusi
- Model `UserPet` atau kolom JSON `pet_data` di `UserSurvival`
- `plugin/survival/petActions.js` (file baru)

**Kompleksitas:** M

---

### 2.5 🎮 Musim & Event Terjadwal (Seasonal Engine)

**Deskripsi:**
`survivalContext.js` sudah ada. Tambahkan `SeasonEngine` yang:
- Menentukan musim aktif (Lebaran, Halloween, Natal, Anniversary bot)
- Mengubah drop rate, cuaca, dan NPC dialog secara global
- Menambah item eksklusif musiman di shop dan gacha
- Menyiarkan notifikasi start/end event ke channel yang didaftarkan admin

**Mengapa sekarang:**
Seasonal events = alasan untuk kembali bermain. Ini juga satu-satunya alasan user yang sudah lama idle untuk "cek ulang" server.

**Integrasi:**
- `plugin/survival/survivalContext.js` → tambah `getActiveSeason()`
- `src/managers/cronManager.js` → trigger season transitions
- `GuildSettings.settings.eventChannelId` untuk notifikasi
- Gacha seasonal banner (lihat 2.1)

**Kompleksitas:** M

---

## 📊 Kategori 3: Engagement & Komunitas

### 3.1 🔥📊 Voice Activity Rewards

**Deskripsi:**
Melacak waktu yang dihabiskan user di voice channel dan memberikan XP + koin berdasarkan durasi aktif. Tambahkan:
- XP bonus per menit di voice (bisa dibedakan per channel)
- Hadiah milestone (badge "Talkative", "Karaoke Star")
- Admin bisa set multiplier per voice channel
- Anti-abuse: deteksi AFK (muted + deafen = tidak dihitung)

**Mengapa sekarang:**
User yang aktif di voice adalah yang paling loyal. Tren 2026 menunjukkan voice rewards mendorong retensi jauh lebih baik dari text-only XP.

**Integrasi:**
- `src/events/voiceStateUpdate.js` → tambah tracking masuk/keluar
- `src/managers/cronManager.js` → flush XP voice ke database berkala
- Redis: `voice:active:{guildId}:{userId}` menyimpan timestamp join

**Kompleksitas:** M

---

### 3.2 🔥 Sistem Reputasi & "Thanks" Sosial

**Deskripsi:**
Command `/rep give @user` dan deteksi otomatis "thanks @user" di chat untuk memberikan poin reputasi. Fitur ini membuat grafik sosial server terlihat — siapa yang paling membantu. Ditampilkan di:
- `/profile` user
- Leaderboard reputasi server
- Badge khusus di welcome card

**Mengapa sekarang:**
"Social graph" adalah tren 2026 — server yang punya sistem reputasi mengalami peningkatan interaksi 30–40% karena user merasa kontribusinya diakui.

**Integrasi:**
- Kolom `reputation` di `UserProfile`
- `plugin/utility/reputation.js` (file baru)
- `src/events/messageCreate.js` → deteksi pola "thanks @mention"
- `plugin/canvas/` → badge reputasi di kartu profil

**Kompleksitas:** S

---

### 3.3 📊 Sistem Quest Harian & Mingguan

**Deskripsi:**
`questGenerator.js` sudah ada. Tambahkan:
- **Quest harian:** 3 quest random per hari (reset jam 00:00 WIB)
- **Quest mingguan:** 1 quest besar dengan hadiah premium
- **Quest guild:** quest kolaboratif yang membutuhkan kontribusi semua anggota
- Notifikasi DM opsional saat quest baru tersedia

**Mengapa sekarang:**
Quest harian adalah "alasan untuk kembali" yang paling sederhana dan paling terbukti efektif dalam game design.

**Integrasi:**
- `plugin/survival/questGenerator.js` → tambah schedule dan kategori
- `src/managers/cronManager.js` → reset quest harian/mingguan
- Redis: `quest:daily:{userId}` dan `quest:weekly:{userId}`
- Model `UserQuest` atau kolom JSON di `UserSurvival`

**Kompleksitas:** M

---

### 3.4 🔥 Polling & Voting Interaktif dengan Analitik

**Deskripsi:**
Command `/poll create` yang jauh lebih canggih dari poll Discord biasa:
- Multi-pilihan dengan tombol interaktif (bukan reaction)
- Batas waktu vote dengan countdown visual
- Hasil real-time (update embed setiap ada vote baru)
- Analitik pasca-vote: breakdown per role, per waktu vote masuk
- Poll berulang (admin bisa jadwalkan poll mingguan otomatis)

**Mengapa sekarang:**
Poll interaktif mendorong partisipasi pasif menjadi aktif. Dengan hasil analitik, admin bisa mengambil keputusan berbasis data.

**Integrasi:**
- `plugin/utility/poll.js` (file baru)
- `src/interactions/buttons/` → handler vote button
- `src/managers/cronManager.js` untuk auto-close dan poll terjadwal
- Model `PollRecord` untuk menyimpan hasil

**Kompleksitas:** M

---

### 3.5 💎 Sistem Langganan Role — Role Sewa Berbayar

**Deskripsi:**
Admin bisa membuat role yang bisa "disewa" user untuk durasi tertentu menggunakan koin/coupon. Bot otomatis mencabut role saat masa sewa habis. Contoh use case:
- Role "VIP Chat" (7 hari = 500 koin)
- Role "Warna Custom" (30 hari = 100 coupon)
- Role "Early Access" untuk akses channel khusus

**Mengapa sekarang:**
Sewa role adalah versi micro-economy yang memberikan pendapatan koin yang mensirkulasi ekonomi server.

**Integrasi:**
- Model `RoleLease` dengan kolom `userId`, `roleId`, `guildId`, `expiresAt`
- `plugin/admin/role-shop.js` (file baru)
- `src/managers/cronManager.js` → pengecekan dan pencabutan role expired
- `currency.js` untuk pemotongan koin atomik

**Kompleksitas:** M

---

## 💎 Kategori 4: Monetisasi & Premium

### 4.1 💎 Dashboard Premium — Analytics Server

**Deskripsi:**
Halaman dashboard khusus premium yang menampilkan:
- **Retention heatmap** — hari dan jam mana anggota paling aktif
- **Cohort tracking** — berapa persen member baru yang masih aktif setelah 7/30 hari
- **Ekonomi inflasi** — total koin beredar, distribusi kekayaan, barang paling banyak dibeli
- **Leaderboard interaktif** — filter per minggu/bulan/all-time

**Mengapa sekarang:**
Data ini sudah ada di database — tinggal divisualisasikan. Analytics adalah salah satu alasan terkuat admin server untuk berlangganan premium.

**Integrasi:**
- `src/dashboard/routes/analytics.js` (file baru)
- `src/dashboard/views/analytics.html` (file baru)
- Agregasi data lewat `cronManager.js` (precompute stats harian)
- Redis untuk cache hasil agregasi

**Kompleksitas:** L

---

### 4.2 💎 Custom AI Persona per Server (Premium)

**Deskripsi:**
Server premium bisa mengkustomisasi kepribadian Naura:
- Nama panggilan berbeda per server
- System prompt tambahan (misal: "di server ini, kamu adalah asisten gaming bernama 'Pixel'")
- Warna embed kustom
- Avatar Naura kustom di container header

**Mengapa sekarang:**
Personalisasi adalah nilai jual premium yang paling mudah dipahami user — mereka merasa "memiliki" botnya.

**Integrasi:**
- `GuildSettings.settings.aiPersona` (objek JSON baru)
- `src/managers/aiManager.js` → inject persona ke system prompt
- Dashboard: form editor persona

**Kompleksitas:** S

---

### 4.3 💎 Welcome Card Builder Visual (Drag & Drop)

**Deskripsi:**
Editor drag-and-drop di dashboard untuk membuat welcome card kustom. Admin bisa:
- Pilih layout (portrait / landscape / banner)
- Atur posisi avatar, nama, teks selamat datang
- Pilih background gradient atau upload gambar
- Preview real-time
- Export ke JSON config yang disimpan di `GuildSettings`

**Mengapa sekarang:**
Sudah ada di Sprint 5 TODO. `plugin/canvas/` sudah punya infrastruktur render. Dashboard builder akan menjadi pembeda nyata vs bot lain.

**Integrasi:**
- `src/dashboard/views/welcome-builder.html` (file baru)
- `GuildSettings.settings.welcomeCard` (JSON config)
- `plugin/canvas/` → renderer yang membaca config JSON

**Kompleksitas:** XL

---

## 🛡️ Kategori 5: Moderasi & Keamanan Lanjutan

### 5.1 🛡️🔥 Anti-Raid Otomatis

**Deskripsi:**
Implementasi detail fitur yang sudah ada di Sprint 5 TODO:
- Rate counter join per guild di Redis (sliding window 10 detik)
- Saat melebihi threshold (misal 5 join/10 detik): aktifkan lockdown otomatis
- Lockdown mode: hentikan sementara akses ke channel publik via role override
- DM ke server owner + log di audit channel
- Auto-unlock setelah 10 menit, atau manual lewat `/admin unlock`

**Integrasi:**
- `src/events/guildMemberAdd.js` → tambah rate checking
- `plugin/admin/raid-guard.js` (file baru)
- Redis: `raid:joins:{guildId}` (sliding window)
- `GuildSettings.settings.lockdown` flag

**Kompleksitas:** M

---

### 5.2 🛡️ Modmail Lanjutan — Thread Privat + Form Tiket

**Deskripsi:**
`plugin/modmail/` sudah ada. Tingkatkan ke:
- Modal Discord saat user buka tiket (isi kategori, prioritas, deskripsi)
- Private thread per tiket (bukan channel terpisah)
- Tag status tiket: Open / In Progress / Resolved
- Rating kepuasan (1–5 bintang) setelah tiket ditutup
- Export transcript otomatis ke channel log

**Mengapa sekarang:**
Private thread adalah fitur Discord terbaru yang belum dimanfaatkan banyak bot. Modmail yang baik mengurangi PM spam ke admin.

**Integrasi:**
- `plugin/modmail/` → refactor dengan private thread
- `src/interactions/modals/` → form pembukaan tiket
- `plugin/modmail/transcriptExporter.js` (file baru)

**Kompleksitas:** L

---

### 5.3 🛡️ Sistem Strike & Eskalasi Otomatis

**Deskripsi:**
Sudah ada di Sprint 5 TODO. Detail implementasi:
- Model `UserStrike` dengan kolom `userId`, `guildId`, `reason`, `moderatorId`, `expiresAt`
- Escalation ladder: 1 strike = warn, 2 = timeout 1 jam, 3 = tempban 24 jam, 4 = ban permanen
- Admin bisa kustomisasi threshold per guild
- Strike otomatis expire setelah N hari
- `/strike list @user` untuk melihat riwayat

**Integrasi:**
- Model `UserStrike` baru + migrasi `v7_add_user_strikes`
- `plugin/admin/warn.js` → integrasikan dengan strike system
- `src/managers/cronManager.js` → unban otomatis dan expire strike

**Kompleksitas:** M

---

## 🎵 Kategori 6: Musik — Ekosistem Lavalink Penuh

### 6.1 🎵 Audio Filters & Equalizer

**Deskripsi:**
Sudah ada di Sprint 4 TODO. Command `/music filter` dengan preset:
- `bassboost`, `nightcore`, `vaporwave`, `karaoke`, `8d`
- EQ custom (slider 1–10 untuk bass/mid/treble)
- DJ Role: hanya user dengan role tertentu bisa ganti filter

**Integrasi:**
- `plugin/music/musicFilters.js` (file baru)
- `plugin/music/musicButtons.js` → tambah tombol filter
- `GuildSettings.settings.djRoleId`

**Kompleksitas:** S

---

### 6.2 🎵 Playlist Pribadi & Queue Management Lanjutan

**Deskripsi:**
- Simpan playlist pribadi di database (`/playlist save`, `/playlist load`)
- Shuffle, loop track, loop queue
- Vote-skip: butuh 50% user di voice untuk skip
- `/music autoplay` — Lavalink pilih lagu berikutnya otomatis berdasarkan genre
- History 10 lagu terakhir per guild

**Integrasi:**
- Model `UserPlaylist` + `PlaylistTrack`
- `plugin/music/playlistManager.js` (file baru)
- Redis: `music:history:{guildId}`

**Kompleksitas:** M

---

### 6.3 🎵 Now Playing Canvas Real-Time

**Deskripsi:**
`nowplayingCanvas.js` sudah ada. Tambahkan update real-time:
- Progress bar yang bergerak setiap N detik (edit pesan berkala)
- Waveform animasi sederhana (visual sinusoidal)
- Thumbnail album dari metadata Lavalink
- Tombol skip/pause/loop langsung di bawah canvas

**Integrasi:**
- `plugin/canvas/nowplayingCanvas.js` → tambah progress bar dinamis
- `src/managers/musicManager.js` → emit event progress
- `src/interactions/buttons/musicButtons.js`

**Kompleksitas:** M

---

## 📱 Kategori 7: UX & Dashboard

### 7.1 📱 Notifikasi Cerdas via DM

**Deskripsi:**
User bisa subscribe ke notifikasi spesifik:
- "Ingatkan aku saat stamina penuh" → DM saat stamina recovery
- "Ingatkan aku saat quest harian reset"
- "Ingatkan aku saat ada event musiman baru"
- Setting via `/notify` command dengan toggle on/off

**Integrasi:**
- Kolom `notification_prefs` di `UserProfile` (JSON)
- `src/managers/cronManager.js` → check dan kirim DM
- Redis: `notify:stamina:{userId}` dengan TTL = waktu recovery

**Kompleksitas:** M

---

### 7.2 📱 Profil Terpadu — "Naura ID Card"

**Deskripsi:**
Redesain `/profile` menjadi ID Card visual yang menampilkan semua aspek user dalam satu canvas:
- Avatar + border frame berdasarkan rank/badge
- Stats survival (level, HP, STR, dll.)
- Badge koleksi (achievement unlocked)
- Reputasi dan rank di server
- Lagu favorit (dari history musik)
- Custom bio dan warna tema (premium)

**Mengapa sekarang:**
Profile card yang bagus = konten yang dibagikan user ke luar Discord = free marketing.

**Integrasi:**
- `plugin/canvas/profileCanvas.js` → redesain penuh
- `plugin/canvas/achievementCanvas.js` → badge strip
- `src/utils/NauraContainerBuilder.js` → embed profil teks

**Kompleksitas:** L

---

### 7.3 📱🛡️ Onboarding Wizard untuk Server Baru

**Deskripsi:**
Sudah ada di Sprint 4 TODO. Saat bot join server baru, kirim satu pesan Container V2 interaktif ke channel pertama yang bisa ditulis. Preset yang tersedia:
- **Community Server** — Welcome, Leveling, Modmail aktif
- **Gaming Server** — Survival, Music, Temp Voice aktif
- **Minimal** — hanya Moderasi dasar aktif
- **Custom** — pilih sendiri modul per modul

**Integrasi:**
- `src/events/guildCreate.js` → trigger onboarding
- `plugin/admin/onboardingWizard.js` (file baru)
- `plugin/survival/onboardingHelper.js` sudah ada — extend untuk guild-level
- `src/config/features.js` → toggle modul

**Kompleksitas:** M

---

## 🗺️ Urutan Pengerjaan yang Direkomendasikan

Berdasarkan **dampak vs kompleksitas** dan ketergantungan antar fitur:

```
Sprint A — Impact Tinggi, Kompleksitas Rendah (mulai dari sini):
  - 3.2  Sistem Reputasi & Thanks (S)
  - 6.1  Audio Filters & DJ Role (S)
  - 4.2  Custom AI Persona (S)

Sprint B — Impact Tinggi, Kompleksitas Sedang:
  - 1.1  AI Memory Jangka Panjang (M)
  - 2.1  Sistem Gacha (M)
  - 2.5  Musim & Event Terjadwal (M)
  - 3.1  Voice Activity Rewards (M)
  - 3.3  Quest Harian & Mingguan (M)
  - 5.1  Anti-Raid Otomatis (M)
  - 5.3  Sistem Strike & Eskalasi (M)

Sprint C — Kompleksitas Tinggi, Dampak Tinggi:
  - 1.2  AI Function Calling (L)
  - 2.3  PvP Arena & Tournament (L)
  - 4.1  Dashboard Analytics (L)
  - 5.2  Modmail Lanjutan (L)

Sprint D — Long-term, Differensiator Utama:
  - 1.3  AI Dungeon Master (L)
  - 2.2  Sistem Guild / Klan (XL)
  - 4.3  Welcome Card Builder (XL)
```

---

## ⚠️ Prasyarat Wajib Sebelum Mulai

> **PENTING — Jangan mulai fitur baru sebelum ini selesai:**

1. **Sprint 2 `TODO.md` harus tuntas** — terutama lazy-load `@napi-rs/canvas` dan audit ekonomi non-survival (issue #17). Tanpa ini, penambahan fitur canvas baru akan memperburuk cold-start time.
2. **`ephemeralPatch.js` harus dihapus** (issue #10) — penambal prototype yang masih ada adalah bom waktu saat upgrade discord.js.
3. **Test coverage ekonomi** harus ada sebelum fitur gacha dan guild bank ditambahkan — fitur baru yang menyentuh ekonomi tanpa test coverage = hutang teknis berbahaya.

---

## 📚 Referensi Riset

| Sumber | Topik |
|---|---|
| Tren bot Discord 2026 | AI agents, function calling, gacha retention, voice rewards |
| Dank Memer & UnbelievaBoat | Pola desain ekonomi bot terbukti |
| Arcane Bot | Voice XP dan reward system |
| LavaSrc & LavaLyrics | Ekosistem plugin Lavalink v4 |
| Discord Developer Docs 2026 | SKU/Entitlements, UI Components, Social SDK |
| `TODO.md` proyek ini | Sprint aktif dan risiko yang sedang dipantau |
| `AGENTS.md` proyek ini | Aturan arsitektur yang tidak boleh dilanggar |
