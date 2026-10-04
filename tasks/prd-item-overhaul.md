# PRD: Perombakan Total Katalog Item Naura Wilds (v2.3.0)

## 1. Ringkasan & Latar Belakang
Sistem item pada Naura Wilds saat ini terfragmentasi di berbagai berkas (`items_catalog.js`, `items_static.js`, `items_extra.js`, `items_wooden.js`, `items_refined.js`, dll) dengan inkonsistensi skema atribut, harga yang tidak berimbang, dan sistem 6-tier yang kurang padat. 

Inisiatif ini merombak total sistem item menjadi satu katalog tunggal yang bersih, seimbang, dan terstandarisasi dengan 6 kategori terstruktur dan 5 tier RPG klasik.

---

## 2. Sasaran Utama (Goals)
1. **Unifikasi Katalog:** Menyatukan seluruh item ke dalam satu sumber kebenaran terpadu di `src/survival/data/items_catalog.js`.
2. **Penyederhanaan Tier:** Mengadopsi 5 Tier RPG standar (Common, Uncommon, Rare, Epic, Legendary).
3. **6 Kategori Baku:** Mengelompokkan item ke dalam `weapon`, `armor`, `tool`, `consumable`, `material`, dan `special`.
4. **Skema Atribut Modular:** Menstandarisasi stat tempur, durabilitas, efisiensi gathering, restorasi vital, dan tipe material.
5. **Smart Remap Inventaris:** Memastikan data pemain lama tidak rusak melalui fungsi pemetaan otomatis ID lama ke baru dan konversi koin NSF untuk item usang.
6. **Sinkronisasi Sistem Turunan:** Menyelaraskan resep crafting, stok toko, dan drop dungeon dengan ID katalog baru.
7. **Regenerasi Aset:** Memperbarui generator SVG vektor di `scripts/generateItemIcons.js`.

---

## 3. Keputusan Arsitektur Terpilih (Architectural Decisions)

- **(D-01) Struktur Kategori (6 Kategori):**
  - `weapon`: Perlengkapan tempur (pedang, busur, tombak, senjata sihir/energi).
  - `armor`: Pelindung tubuh (helm, jubah/zirah, perisai, aksesori tempur).
  - `tool`: Alat kerja gathering (beliung, kapak, pancing, cangkul/penyiram).
  - `consumable`: Makanan, minuman, dan ramuan obat pemulih vitalitas.
  - `material`: Kayu, bijih tambang, tanaman herbal, tetesan monster, dan ingot olahan.
  - `special`: Kupon gacha, kunci dungeon, tiket event, dan token reputasi.

- **(D-02) Sistem 5 Tier & Palet Warna Resmi:**
  - Tier 1: Common (`#9CA3AF`, Badge: I)
  - Tier 2: Uncommon (`#86EFAC`, Badge: II)
  - Tier 3: Rare (`#93C5FD`, Badge: III)
  - Tier 4: Epic (`#C084FC`, Badge: IV)
  - Tier 5: Legendary (`#FFD700`, Badge: V)

- **(D-03) Skema Atribut Modular:**
  - Senjata & Armor: `atk`, `def`, `critRate`, `speed`, `durability`, `maxDurability`.
  - Tools: `efficiency`, `yieldBonus`, `durability`, `maxDurability`, `toolType`.
  - Consumables: `hp`, `hunger`, `thirst`, `stamina`, `buffType`, `buffDuration`.
  - Materials: `refinedLevel`, `materialType`, `stackSize`.
  - Special: `usableType`, `value`.

- **(D-04) Smart Remap & Database Safety:**
  - Helper pemetaan `legacyItemResolver.js` menerjemahkan ID lama pemain secara runtime saat membuka inventaris.
  - Item usang yang dihapus otomatis dikonversi menjadi saldo koin NSF dengan pesan notifikasi ramah pengguna.

---

## 4. User Stories (Tahapan Eksekusi Atomic)

### US-001: Fondasi Skema & Katalog 5-Tier Terpadu
**Deskripsi:** Sebagai developer, saya ingin mendefinisikan 5 Tier dan menyusun katalog 6 kategori baru di `src/survival/data/items_catalog.js` agar sistem memiliki data master item yang bersih dan terstandarisasi.
**Kriteria Penerimaan:**
- [x] Tier 1 sampai 5 terdefinisi lengkap dengan warna dan label resmi.
- [x] Minimal 100 item terpadu terisi di 6 kategori dengan harga dan statistik seimbang.
- [x] `src/survival/data/items.js` memuat katalog baru sebagai basis utama.
- [x] `npm run test:requires` dan `node scripts/check-em-dash.js` lolos tanpa error.

### US-002: Smart Remap Helper & Migrasi Inventaris Lama
**Deskripsi:** Sebagai pemain lama, saya ingin inventaris saya tetap aman dan item lama secara otomatis dipetakan ke ID baru atau dikonversi menjadi koin NSF kompensasi.
**Kriteria Penerimaan:**
- [x] Modul `src/survival/helpers/legacyItemResolver.js` memetakan ID lama (wooden, extra, refined, static) ke ID katalog baru.
- [x] Integrasi ke fungsi pemuatan inventaris di `cacheManager.js` / `UserSurvival.js`.
- [x] Unit test konversi inventaris di `src/survival/helpers/legacyItemResolver.test.js` lolos 100%.

### US-003: Penyelarasan Resep Crafting & Cetak Biru (Blueprints)
**Deskripsi:** Sebagai pemain, saya ingin resep crafting di `craftingRecipes.js` dan `craftBlueprints.js` menggunakan bahan dan hasil dari katalog baru yang seimbang.
**Kriteria Penerimaan:**
- [x] Seluruh resep crafting mengacu pada ID material dan hasil dari katalog baru.
- [x] Rantai tier konsisten: Barang T1 butuh bahan T1, barang T2 butuh bahan T2, dst.
- [x] Tidak ada referensi resep ke ID item yang tidak terdaftar di katalog.
- [x] Unit test validasi resep lolos.

### US-004: Penyelarasan Stok Toko, Drop Dungeon, & Kafe
**Deskripsi:** Sebagai pemain, saya ingin toko kota, hadiah dungeon, dan menu kafe menjual serta memberikan barang-barang dari katalog baru.
**Kriteria Penerimaan:**
- [x] `shopStock.js` diperbarui dengan penawaran item katalog baru.
- [x] Drop item dungeon (`items_dungeon.js` / loot table) diselaraskan ke ID katalog baru.
- [x] Menu kafe (`cafeRecipes.js`) mengonsumsi bahan consumable/cooking baru.
- [x] Tidak ada referensi ID hantu pada seluruh file data survival.

### US-005: Regenerasi Aset Ikon Vektor SVG
**Deskripsi:** Sebagai pemain, saya ingin seluruh item baru memiliki ikon visual SVG vektor berkualitas tinggi di dashboard web dan Discord canvas.
**Kriteria Penerimaan:**
- [x] `scripts/generateItemIcons.js` diperbarui mendukung sistem 5-tier dan 6 kategori baru.
- [x] Script dieksekusi dan menghasilkan file `.svg` lengkap di `dashboard/public/items/` dan `assets/items/`.
- [x] Uji coba path aset tidak menghasilkan 404 atau broken asset.

### US-006: Verifikasi Penuh QA Gate & Pembersihan Drift
**Deskripsi:** Sebagai maintainer, saya ingin memastikan seluruh sistem berjalan 100% tanpa regresi, broken import, atau kode hantu.
**Kriteria Penerimaan:**
- [x] `npm run verify:drift` melaporkan 0 error.
- [x] `npm run locales:check:strict` lolos.
- [x] `npm run test:requires` lolos.
- [x] `npm test` menjalankan seluruh 510+ test dan berstatus 100% HIJAU.
- [x] `npm run qa` lulus secara penuh.

---

## 5. Non-Goals (Batasan Ruang Lingkup)
- Tidak menambahkan sistem equipment soket permata atau enchant acak pada rilis ini.
- Tidak merombak formula kalkulasi pertarungan dasar (combat engine), hanya statistik input item yang diselaraskan.
- Tidak menghapus mata uang NSF, NC, atau Kupon (tetap menggunakan sistem closed-loop Currency V2).
