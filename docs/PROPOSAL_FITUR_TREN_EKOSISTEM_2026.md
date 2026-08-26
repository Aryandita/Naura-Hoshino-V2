# 🌐 PROPOSAL FITUR TREN EKOSISTEM BOT DISCORD 2026

## _Kurasi Ide Global & Pemetaan Implementasi ke Arsitektur Naura Hoshino V2_

> **Dokumen:** Proposal Fitur Berbasis Tren Ekosistem Bot Discord  
> **Target Bot:** Naura Hoshino V2 (Engine 2.1.0 · Node.js ≥ 24 · Discord.js v14)  
> **Metode:** Kurasi pola fitur terbukti dari bot populer (Mudae, Karuta, Dank Memer, Epic RPG, Tarkov-bot, MEE6, ProBot) dan tren industri game live-service (battle pass, streak, wrapped), dipetakan ke infrastruktur yang sudah ada.  
> **Catatan:** Dokumen ini melengkapi `PROPOSAL_FITUR_INOVATIF_NAURA_V2.md` (fitur orisinil). Fokus dokumen ini adalah fitur **terbukti pasar** yang meniru pola sukses global.

---

## 📑 DAFTAR ISI

1. [Ringkasan Eksekutif](#1-ringkasan-eksekutif)
2. [Matriks Prioritas](#2-matriks-prioritas)
3. [Detail Fitur Survival RPG](#3-detail-fitur-survival-rpg)
   - [F1: Seasonal Battle Pass "Naura Wilds Pass"](#f1-seasonal-battle-pass-naura-wilds-pass)
   - [F2: Streak Harian Eskalatif](#f2-streak-harian-eskalatif)
   - [F3: Territory War antar Klan](#f3-territory-war-antar-klan)
   - [F4: Crafting Tree & Gear Progression](#f4-crafting-tree--gear-progression)
4. [Detail Fitur Musik](#4-detail-fitur-musik)
   - [F5: Naura Wrapped](#f5-naura-wrapped)
   - [F6: Listening Party Kolaboratif](#f6-listening-party-kolaboratif)
5. [Detail Fitur AI](#5-detail-fitur-ai)
   - [F7: AI Dungeon Master Kampanye Multi-Sesi](#f7-ai-dungeon-master-kampanye-multi-sesi)
   - [F8: AI NPC Memory Per-User](#f8-ai-npc-memory-per-user)
6. [Detail Fitur Dashboard & Komunitas](#6-detail-fitur-dashboard--komunitas)
   - [F9: Profil Publik Shareable (OG Image)](#f9-profil-publik-shareable-og-image)
   - [F10: Referral & Vote Rewards Expansion](#f10-referral--vote-rewards-expansion)
7. [Detail Peningkatan Teknis](#7-detail-peningkatan-teknis)
   - [F11: Migrasi discord-hybrid-sharding](#f11-migrasi-discord-hybrid-sharding)
   - [F12: OpenTelemetry Observability](#f12-opentelemetry-observability)
8. [Roadmap Sprint yang Disarankan](#8-roadmap-sprint-yang-disarankan)

---

## 1. RINGKASAN EKSEKUTIF

Naura Hoshino V2 sudah memiliki fondasi teknis yang jarang dimiliki bot komunitas: polyglot persistence dengan penulisan atomik, Canvas worker pool, AI function calling dengan memori persisten, dan design system sub-brand Naura Wilds.

Yang paling menguntungkan dari kurasi ini: **sebagian besar ide tidak butuh infrastruktur baru**, melainkan membangun di atas aset yang sudah ada:

| Aset Existing                                                     | Ide yang Memanfaatkannya         |
| :---------------------------------------------------------------- | :------------------------------- |
| Loop mata uang 3 arah (NSF/Coin/Coupon) + grinding atomik         | F1 Battle Pass, F4 Crafting Tree |
| Sistem season (`survivalContext.js`: Ramadhan, Kemerdekaan, dll.) | F1 Battle Pass                   |
| `MusicAnalytics` + Canvas worker pool                             | F5 Naura Wrapped                 |
| Poru/Lavalink + antrean per-guild                                 | F6 Listening Party               |
| `AIMemory`, function calling, `AiChatHistory` (MongoDB)           | F7 AI DM, F8 NPC Memory          |
| Kartu profil Canvas + dashboard Express                           | F9 OG Image                      |
| Webhook vote Top.gg + idempotency                                 | F10 Referral                     |
| Aturan sharding 1.11 + Redis Pub/Sub                              | F11 Hybrid Sharding, F12 OTel    |

---

## 2. MATRIKS PRIORITAS

| ID  | Fitur                | Dampak Retensi     | Effort       | Ketergantungan Infra           | Prioritas |
| :-- | :------------------- | :----------------- | :----------- | :----------------------------- | :-------- |
| F4  | Crafting Tree & Gear | Tinggi             | Sedang       | Tidak ada (items.js sudah ada) | ⭐⭐⭐    |
| F1  | Battle Pass Musiman  | Sangat Tinggi      | Sedang-Besar | Model baru + migrasi v19       | ⭐⭐⭐    |
| F2  | Streak Harian        | Tinggi             | Kecil        | Kolom JSON rpg_state           | ⭐⭐⭐    |
| F8  | AI NPC Memory        | Tinggi             | Kecil-Sedang | MongoDB sudah ada              | ⭐⭐      |
| F9  | Profil OG Shareable  | Tinggi (viral)     | Sedang       | Dashboard + canvas             | ⭐⭐      |
| F5  | Naura Wrapped        | Tinggi (musiman)   | Sedang       | MusicAnalytics + canvas        | ⭐⭐      |
| F3  | Territory War Klan   | Tinggi (komunitas) | Besar        | GuildClan + engine baru        | ⭐⭐      |
| F10 | Referral & Vote+     | Sedang             | Kecil        | Webhook idempoten sudah ada    | ⭐        |
| F6  | Listening Party      | Sedang             | Sedang       | Poru events                    | ⭐        |
| F7  | AI DM Kampanye       | Sedang-Tinggi      | Besar        | AIMemory + StoryProgress       | ⭐        |
| F11 | Hybrid Sharding      | Teknis             | Sedang       | Rencana Sprint 2 lama          | ⭐        |
| F12 | OpenTelemetry        | Teknis             | Sedang       | Health check Sprint 3          | ⭐        |

---

## 3. DETAIL FITUR SURVIVAL RPG

### F1: SEASONAL BATTLE PASS "NAURA WILDS PASS"

**Inspirasi:** Fortnite/Genshin Impact battle pass; di ekosistem Discord mirip pola season token Dank Memer.

**Konsep:** Setiap musim dalam game (Ramadhan, Kemerdekaan, Ulang Tahun Naura, Tahun Baru, Lebaran) membuka pass berisi 30 tier reward. Tier naik lewat XP pass yang didapat dari aktivitas survival apa pun (kerja, eksplorasi, dungeon, quest).

```
[ 🌿 NAURA WILDS PASS - Musim Ramadhan ]
─────────────────────────────────────────
Tier 12/30  ▰▰▰▰▰▰▱▱▱▱  1.240 / 1.500 XP
─────────────────────────────────────────
[Tier 13] 🎁 Hadiah Gratis: 500 NSF
[Tier 13] 💎 Hadiah Premium: Frame Profil "Ketupat Emas"
[ ▶ Klaim Tier 12 ]  [ 💎 Belum punya Pass Premium? ]
```

**Model Monetisasi (3 jalur pembelian):**

Pass Premium TIDAK terikat pada status VIP, sehingga pemain gratis pun bisa membelinya. Ada tiga jalur:

| Jalur                 | Isi                                                                              | Cara Bayar                                                                        | Catatan                                                                              |
| :-------------------- | :------------------------------------------------------------------------------- | :-------------------------------------------------------------------------------- | :----------------------------------------------------------------------------------- |
| **Pass Standalone**   | Track premium 30 tier saja, tanpa VIP                                            | Coupon (langka) atau donasi Saweria/Trakteer                                      | Untuk pemain yang hanya tertarik reward survival                                     |
| **Bundle VIP + Pass** | Premium VIP penuh + Pass Premium musim berjalan                                  | Donasi Saweria/Trakteer dengan harga diskon (~20% lebih murah dari beli terpisah) | Anchoring Effect: harga bundle selalu ditampilkan berdampingan dengan harga terpisah |
| **VIP Eksisting**     | Pemilik premium aktif otomatis dapat diskon Pass (misal 50%), bukan gratis penuh | Coupon atau donasi                                                                | Menjaga nilai langka Coupon dan menghindari devaluasi VIP                            |

Semua pemberian Pass lewat jalur donasi wajib idempoten dan tercatat di audit log (aturan keamanan 1.5), karena webhook Saweria/Trakteer bisa mengirim retry.

**Pemetaan teknis:**

- Model baru `SeasonPassProgress` (Sequelize): `userId`, `seasonId`, `tierXp`, `hasPremiumPass`, `passSource` (`coupon` / `donation` / `bundle`), `claimedFree[]`, `claimedPremium[]`.
- Migrasi `v19_add_season_pass` via `dbMigrator.js` (wajib, aturan 1.7).
- Pembelian Pass Standalone: debit Coupon atomik via `debitUserSurvival(userId, "coupons", harga)`; bila gagal berarti kupon kurang.
- Pembelian via donasi: webhook Saweria/Trakteer menulis `hasPremiumPass = true` + `passSource = "donation"`, dengan idempotency key per transaksi donasi.
- Bundle VIP: satu webhook memicu dua pemberian (premium voucher + pass) dalam satu audit log entry; bila salah satu gagal, keduanya dibatalkan agar tidak ada pembayaran setengah jalan.
- Reward premium dikunci tier tertentu; klaim tier premium memvalidasi `hasPremiumPass` lebih dulu.
- UI container memakai token Naura Wilds (`survivalUIHelper.js`) sesuai aturan AGENTS.md 1.3 no.20.
- Cron reset musim di `cronManager.js`, sinkron dengan `getCurrentSeason()`; `hasPremiumPass` ikut reset tiap musim baru.

**Risiko:** Penulisan progres harus atomik (increment kolom `tierXp`, bukan read-modify-write) agar double-click tombol klaim tidak menduplikasi hadiah. Klaim tier = transaksi: tandai claimed dulu di JSON via `mutateUserSurvivalJson()`, baru beri hadiah. Pembelian ganda (user sudah punya pass lalu webhook retry masuk) harus ditolak oleh cek idempotency, bukan memberi durasi ekstra diam-diam.

---

### F2: STREAK HARIAN ESKALATIF

**Inspirasi:** Duolingo streak, daily login Hoyoverse; di Discord mirip sistem daily MEE6 dengan multiplier.

**Konsep:** `/survival daily` memberi hadiah yang naik tiap hari berturut-turut (hari 1: 100 NSF, hari 7: 1.000 NSF + item langka). Bolong satu hari mereset ke 1. Item "Streak Freeze" (beli dengan Coupon) melindungi satu hari bolong.

**Pemetaan teknis:**

- Simpan di `rpg_state`: `{ daily_streak: { count, lastClaim, freezes } }` via `mutateUserSurvivalJson()`.
- Hadiah lewat `currency.reward(currency.FRAGMENT, ...)` agar buff klan otomatis.
- UI progress bar memakai Goal Gradient Effect (aturan UX AGENTS.md): tampilkan "tinggal X hari lagi menuju hadiah mingguan!".

**Effort:** Kecil. Satu subcommand + helper. Kandidat sprint cepat.

---

### F3: TERRITORY WAR ANTAR KLAN

**Inspirasi:** Guild wars Epic RPG, territory control game strategi; pola yang membuat bot RPG komunitas bertahan bertahun-tahun.

**Konsep:** Peta wilayah (desa, hutan, tambang, laut, pantai, sawah, gunung, kota) dapat dikuasai klan lewat pertempuran terjadwal. Klan pemilik wilayah memberi buff pasif ke seluruh anggota (+10% NSF di hutan, +15% hasil tambang, diskon pajak Pak Anif, dll.).

**Pemetaan teknis:**

- `territoryWarEngine.js` dan `GuildClan` sudah ada sebagai fondasi.
- Model tambahan `TerritoryOwnership`: `guildId`, `territoryKey`, `clanId`, `capturedAt`, `defenseScore`.
- Pertempuran terjadwal via cron; log serangan maksimal 5 baris per respons (aturan panel pertarungan Naura Wilds).
- Buff integrasi titik masuknya di `currency.reward()` (sudah membaca clanId) dan tabel harga toko.

**Risiko:** Effort besar; sebaiknya pecah dua sprint (ownership + buff dulu, pertempuran belakangan).

---

### F4: CRAFTING TREE & GEAR PROGRESSION

**Inspirasi:** Minecraft tech tree, crafting Stardew Valley; di bot: sistem forge Dank Memer yang terbukti sangat adiktif.

**Konsep:** Hasil grinding (wood, fiber, iron_ore, silver_ore, diamond) menjadi bahan rantai crafting multi-tier:

```
Kayu (grind hutan)
  └─> Papan Kayu x3 ──> Perbaikan Rumah Tier 2
Batu + Bijih Besi
  └─> Bar Besi ──> Beliung Baja (booster kerja x1.5 permanen)
Bar Besi + Bar Perak
  └─> Bar Mistel ──> Cincin Tunangan (prasyarat marry tanpa beli)
```

**Nilai strategis:** Menutup loop ekonomi. Saat ini item grinding berhenti sebagai bahan mati; crafting memberi tujuan jangka panjang dan alasan grind lokasi spesifik. Juga menciptakan sink NSF alami (biaya tempa).

**Pemetaan teknis:**

- Data resep di `src/config/survival/recipes.js` (stateless config, aturan direktori).
- Engine `craftingEngine.js` di `src/survival/engines/`: validasi resep, konsumsi bahan via `takeItemsAtomic()`, produksi hasil via `addItemsAtomic()`. Urutan wajib: hasil diberikan dulu, bahan dipotong kemudian? TIDAK, untuk crafting urutan aman adalah: potong bahan dulu dalam SATU transaksi mutator JSON yang sama (keduanya di inventory), sehingga tidak mungkin duplikasi.
- Subcommand `/survival craft <item>` dengan select menu resep yang tersedia (hanya tampilkan yang bahannya cukup: Smart Defaults).
- Alat hasil craft yang bersifat booster kerja terintegrasi dengan tabel `BOOSTERS` di work.js.

**Catatan penting konsistensi:** Karena bahan dan hasil sama-sama ada di kolom `inventory` (JSON), seluruh operasi wajib dalam satu panggilan `mutateUserProfileJson()` tunggal, bukan take lalu add terpisah.

---

## 4. DETAIL FITUR MUSIK

### F5: NAURA WRAPPED

**Inspirasi:** Spotify Wrapped, fenomena viral tahunan; versi bot: rekap statistik personal.

**Konsep:** Setiap awal tahun (atau on-demand `/wrapped`), bot me-render kartu Canvas berisi: top 5 artis, top lagu, total menit dengar, genre favorit, dan "pendengar paling setia" (peringkat server). Kartu dibagikan sebagai image attachment yang bisa di-repost.

**Pemetaan teknis:**

- Data sudah terkumpul di MusicAnalytics (track listening stats ke DB).
- Agregasi tahunan via query SQL GROUP BY; hasil di-cache Redis `cache:wrapped:*` TTL 24 jam.
- Render via `canvasWorkerPool.js` dengan gaya Cyber-Anime Glassmorphism (DESIGN.md), dispose buffer wajib.
- Tombol share memicu repost ke channel aktif.

**Timing peluncuran:** Desember/Januari untuk efek viral maksimal.

---

### F6: LISTENING PARTY KOLABORATIF

**Inspirasi:** Spotify Jam / watch parties; di Discord: fitur queue bersama Karaoke-bot.

**Konsep:** Saat musik diputar, semua anggota voice channel bisa menambahkan lagu lewat tombol di panel Now Playing tanpa command, plus vote skip (50%+ suara). Panel menampilkan avatar kontributor tiap track.

**Pemetaan teknis:**

- Tombol pada `MusicUIManager` panel: customId `queue_add_prompt` membuka modal input judul.
- Vote skip: simpan voter di Map per guild dengan cleanup TTL (aturan memory safety 1.9, wajib `.unref()`).
- Rate limit penambahan antrean per user via `rateLimiter.js`.

---

## 5. DETAIL FITUR AI

### F7: AI DUNGEON MASTER KAMPANYE MULTI-SESI

**Inspirasi:** AI Dungeon, pola campaign D&D; kelanjutan natural dari AI Dungeon Master V2 (Sprint 16).

**Konsep:** Kampanye cerita berkelanjutan yang mengingat keputusan pemain lintas sesi. Checkpoint cerita bisa disimpan dan dilanjutkan kapan saja; akhir kampanye menghasilkan "epilog personal" yang bisa dibagikan.

**Pemetaan teknis:**

- `StoryProgress` model sudah ada (`chapterId`, `flags`) untuk state kampanye.
- `AIMemory.extractAndSave()` non-blocking untuk memori jangka panjang (aturan 1.3 no.19).
- Function calling tools baru di `functionDispatcher.js`: `save_story_checkpoint`, `roll_dice`, `grant_loot` (skema OBJECT valid).

---

### F8: AI NPC MEMORY PER-USER

**Inspirasi:** Replika/character.ai persistent memory; diferensiasi langsung vs bot RPG kompetitor yang NPC-nya statis.

**Konsep:** NPC survival mengingat interaksi spesifik pemain. Contoh: setelah pemain memberi apel 3 kali, Bagas menyapanya dengan "Kamu lagi bawa apel nggak? Hehe." Memori disimpan ringkas (maks 5 fakta per NPC per user) agar prompt tetap murah.

**Pemetaan teknis:**

- Ekstraksi fakta non-blocking via Gemini setelah interaksi afeksi (gift/greet), ditulis async ke MongoDB (aturan 1.7.2 non-blocking logging).
- Skema Mongo baru `NpcMemory`: indeks komposit `(userId, npcId)` (aturan indeks efisien).
- Prompt sapaan NPC (`composeGreeting` di npc.js) menyuntik fakta-fakta tersebut sebagai konteks.
- Budget prompt: maksimal 200 token memori per sapaan.

**Effort:** Kecil-Sedang. Kandidat sprint cepat dengan dampak "wow" tinggi.

---

## 6. DETAIL FITUR DASHBOARD & KOMUNITAS

### F9: PROFIL PUBLIK SHAREABLE (OG IMAGE)

**Inspirasi:** Pola viral bot leveling modern (contoh: mee6.xyz/i/:id); link yang dibagikan otomatis menampilkan kartu profil.

**Konsep:** Halaman publik `/u/:userId` di dashboard yang me-render meta tag Open Graph berisi gambar kartu profil Canvas. Ketika link dibagikan ke chat Discord mana pun, Discord menampilkan kartu level/rank sebagai preview embed otomatis.

**Pemetaan teknis:**

- Route publik baru di `dashboard/routes/public.js` (tanpa auth, hanya data publik: nama, level, badge).
- Endpoint `/og/:userId.png` me-render kartu via canvas worker pool, cache Redis `canvas:og:*` TTL 1 jam + invalidasi `smartInvalidateUserCanvas(userId)` (aturan 1.3 no.13).
- Opt-in privacy: user bisa mematikan lewat `/privacy og off`; default render data minimal.

**Dampak:** Setiap share adalah iklan gratis bot. Pola ini terbukti menjadi saluran pertumbuhan organik terbesar bot leveling.

---

### F10: REFERRAL & VOTE REWARDS EXPANSION

**Inspirasi:** Program referral top.gg dan bot monetisasi umum.

**Konsep:**

1. Link undangan personal per user; kedua pihak dapat bonus saat invite bergabung dan mencapai level 5.
2. Vote Top.gg saat ini memberi reward tunggal; diperluas jadi streak vote (vote 7 hari berturut-turut = Coupon).

**Pemetaan teknis:**

- Webhook vote sudah idempoten (aturan 1.5); streak vote cukup ditambah di handler webhook yang sama.
- Referral butuh model `Referral`: `referrerId`, `inviteeId`, `rewardedAt`, dengan audit log pemberian reward (wajib, aturan keamanan).

---

## 7. DETAIL PENINGKATAN TEKNIS

### F11: MIGRASI DISCORD-HYBRID-SHARDING

Sudah direncanakan sejak Sprint 2 (aturan 1.11 AGENTS.md). Manfaat: mengurangi overhead proses idle, satu proses bisa memuat beberapa shard, kompatibel dengan ShardingManager API sehingga migrasi bertahap. Prasyarat kode sudah dijaga: komunikasi lintas shard terpusat, state penting di Redis, pekerjaan sekali-jalan dijaga single-execution.

### F12: OPENTELEMETRY OBSERVABILITY

Melengkapi health check Sprint 3. Tracing distribusi untuk alur kritis: interaction → cacheManager → DB, dan pipeline Lavalink. Ekspor ke self-hosted collector agar tidak menambah dependensi SaaS. Mulai dari instrumentasi manual di `cacheManager.js` dan `dbManager.js` saja (dampak terbesar, effort paling kecil).

---

## 8. ROADMAP SPRINT YANG DISARANKAN

| Sprint     | Isi                                                                   | Alasan Urutan                                               |
| :--------- | :-------------------------------------------------------------------- | :---------------------------------------------------------- |
| Sprint 17  | F2 Streak Harian + F8 AI NPC Memory                                   | Effort kecil, dampak cepat, tanpa migrasi skema besar       |
| Sprint 18  | F4 Crafting Tree & Gear Progression                                   | Menutup loop ekonomi; prasyarat battle pass (sumber XP)     |
| Sprint 19  | F1 Battle Pass Musiman                                                | Butuh crafting/streak sebagai aktivitas penghasil XP pass   |
| Sprint 20  | F9 Profil OG Shareable                                                | Saluran pertumbuhan; siap dipakai mempromosikan battle pass |
| Sprint 21  | F5 Naura Wrapped                                                      | Timing akhir tahun                                          |
| Sprint 22+ | F3 Territory War, F6 Listening Party, F7 AI DM Kampanye, F10 Referral | Sesuai kapasitas                                            |
| Paralel    | F11 Hybrid Sharding, F12 OTel                                         | Kerja teknis jangka panjang                                 |

> **Prinsip urutan:** setiap sprint harus meninggalkan loop gameplay yang lebih utuh dari sebelumnya. Streak memberi alasan datang harian, crafting memberi tujuan jangka panjang bagi hasil grinding, battle pass membungkus keduanya dalam siklus musim, dan OG profile mengubah semuanya menjadi mesin pertumbuhan organik.

---

_Dokumen ini adalah proposal kurasi, bukan kontrak implementasi. Setiap fitur yang masuk sprint wajib mengikuti aturan AGENTS.md (atomik 1.8, caching 1.10, desain Naura Wilds 1.3 no.20, migrasi bernomor 1.7) dan dicatat di TODO.md serta GitHub Issues._
