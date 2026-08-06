# Audit Repository Naura Hoshino

Dokumen ini menjelaskan audit awal yang dipakai untuk menjaga repository tetap mudah direview, mudah didebug, dan konsisten dengan `AGENTS.md`.

## Tujuan

Audit ini tidak mengubah kode. Audit hanya mencari pola yang perlu diperiksa manual sebelum perubahan besar dilakukan.

Fokus utama:

1. Environment harus lewat `src/config/env.js`.
2. Migration schema harus lewat `src/managers/dbMigrator.js`.
3. Query `GuildSettings` dan `UserProfile` yang sering dipakai harus lewat cache.
4. `Map` dan `Set` sementara harus punya cleanup TTL.
5. Output utama command perlu diarahkan ke Components V2.
6. Discord ID tidak boleh di-hardcode sembarangan.
7. Copywriting bot sebaiknya memakai emoji dari `src/config/ui.js`.

## Cara menjalankan

```bash
npm run audit
```

Mode ini menampilkan laporan tanpa menggagalkan proses.

```bash
npm run audit:strict
```

Mode strict akan keluar dengan kode gagal bila masih ada temuan `critical` atau `high`.

## Kategori severity

### Critical

Harus diprioritaskan sebelum fitur besar.

Contoh:

- `process.env` langsung di luar `src/config/env.js`.
- `ALTER TABLE` di luar `src/managers/dbMigrator.js`.

### High

Berpotensi berdampak langsung pada performa atau stabilitas.

Contoh:

- `GuildSettings.findOne()` langsung.
- `UserProfile.findByPk()` langsung.

### Medium

Perlu ditinjau saat refactor.

Contoh:

- `new Map()` atau `new Set()` tanpa cleanup TTL.
- `EmbedBuilder` pada response yang mungkin seharusnya Components V2.
- Discord snowflake hardcoded.

### Low

Kebersihan UX dan copywriting.

Contoh:

- Emoji unicode literal pada string user-facing.

## Catatan penting

Audit ini berbasis pola teks, jadi hasilnya bisa memiliki false positive.

Gunakan hasil audit sebagai daftar review, bukan sebagai vonis otomatis. Jika sebuah temuan memang aman, tambahkan komentar di sekitar kode atau sesuaikan allowlist di `scripts/audit-repo.js` dengan alasan yang jelas.

## Urutan review yang disarankan

1. Jalankan `npm run audit`.
2. Bereskan semua `critical`.
3. Bereskan atau dokumentasikan semua `high`.
4. Tinjau `medium` per modul.
5. Jalankan `npm run lint` dan `npm run locales:check`.
6. Jika sudah bersih untuk blocker, jalankan `npm run audit:strict`.
