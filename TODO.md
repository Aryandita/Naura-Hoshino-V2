# TODO — Naura Hoshino V.2

Daftar pekerjaan yang masih terbuka. Centang bila sudah selesai.

---

## 🔥 Prioritas Tinggi

- [x] Selaraskan nama variabel environment di README dengan `src/config/env.js`
- [x] Hentikan `process.exit(1)` saat `env.js` di-import (mencegah respawn loop)
- [x] Deploy slash command hanya oleh shard utama
- [x] Perbaiki `npm run deploy` agar flag `--deploy` benar-benar dihormati
- [x] Perbaiki versi `sqlite3` yang tidak ada di registry
- [x] Guard `translateSync()` terhadap kode bahasa `undefined`
- [ ] Jalankan dashboard hanya di satu proses dan verifikasi tidak ada `EADDRINUSE`
- [ ] Isi `SESSION_SECRET` di produksi dan verifikasi tanda tangan webhook Saweria/Top.gg

## 🧹 Kebersihan Kode

- [ ] Pilih satu SDK Gemini: `@google/genai` **atau** `@google/generative-ai`
- [ ] Pilih satu penjadwal: `cron` **atau** `node-cron`
- [ ] Hapus atau aktifkan `src/managers/EventHandler.js` yang tidak terpakai
- [ ] Ganti monkey-patch `ephemeral` di `index.js` dengan `flags` di tiap pemanggilan
- [ ] Pecah `src/dashboard/server.js` (64 KB) menjadi beberapa router
- [ ] Pecah `plugin/core/core.js` (39 KB) dan `src/config/ui.js` (30 KB)
- [ ] Bereskan seluruh peringatan `npm run lint`

## 🌐 Bilingual (ID / EN)

- [x] Cache bahasa per user agar tidak query database di setiap balasan
- [x] Dukungan kunci bersarang (`help.title`) pada kamus
- [x] Gabungkan kamus milik plugin ke kamus utama
- [x] Script audit paritas kunci (`npm run locales:check`)
- [ ] Pemilih bahasa saat pertama kali membuka `/help`
- [ ] Ganti seluruh teks yang masih ditulis langsung (hardcode) dengan kunci kamus
- [ ] Lengkapi `language/en.json` sampai sepadan dengan `id.json`
- [ ] Aktifkan `npm run locales:check:strict` di CI setelah semua kunci sepadan

## 🎨 Ekspresi Naura

- [x] Helper `src/utils/nauraExpression.js`
- [ ] Integrasikan ke `NauraEmbedBuilder.js` dan `NauraContainerBuilder.js`
- [ ] Terapkan ekspresi pada pesan sukses, error, dan cooldown
- [ ] Pertimbangkan konversi aset ke WebP untuk menghemat bandwidth

## 🧩 Plugin

- [ ] `survival` — rapikan 33 subcommand, satukan helper yang berulang
- [ ] `core` — rombak menu `/help` beserta pemilih bahasa
- [ ] `music` — tinjau penanganan error Lavalink
- [ ] `ai` — rapikan rantai fallback penyedia AI
- [ ] `canvas` & `leveling` — optimalkan rendering dan cache
- [ ] `admin` & `utility` — audit izin dan konsistensi respons

---

## 📘 Referensi: Components V2

Catatan penting yang perlu diingat saat menyentuh UI.

**Flag:** `IS_COMPONENTS_V2` = `1 << 15` = `32768`. Maksimum 40 komponen per pesan.

**Tipe komponen:** `1` ActionRow, `2` Button, `9` Section, `10` TextDisplay, `11` Thumbnail, `12` MediaGallery, `14` Separator, `17` Container.

**Jebakan yang pernah terjadi:** saat mengedit pesan loading yang sebelumnya memakai embed, `PATCH` milik Discord tidak menghapus embed lama sehingga bentrok dengan flag Components V2. Payload wajib menyertakan `embeds: []` dan `content: null` secara eksplisit. Sudah diterapkan di `buildContainerV2()` (dipakai `ping`, `stats`, `info`, `about`) dan tiga titik edit pada alur `help`.
