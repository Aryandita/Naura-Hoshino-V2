# Project Coding Rules (Non-Obvious Only)

Aturan lengkap ada di `AGENTS.md` root. Di bawah hanya pola yang tidak bisa ditebak tanpa membaca kode.

## Aturan yang di-enforce ESLint (`eslint.config.js`)

- `@napi-rs/canvas` HANYA boleh di-require di `src/canvas/canvasRuntime.js`. Semua render lain wajib lewat gateway itu. File pengecualian: `canvasRuntime.js`, `cacheManager.js`, `dbMigrator.js`, `dbSeeder.js`.
- `updateUserProfile()` / `updateUserSurvival()` dengan properti kolom JSON (`inventory`, `rpg_state`, `cooldowns`, dll.) atau kolom counter (`economy_wallet`, `coupons`, `starFragments`, dll.) langsung ditandai. Wajib `mutate*Json()` / `increment*()` / `debit*()`.
- `save()` telanjang pada variabel bernama `survival`, `profile`, `userSurvival`, `userProfile`, atau `row` ditandai. Wajib `save({ fields: [...] })`.
- `currency.setBalance()` usang: pakai `charge()` / `reward()` / `increment*()`.
- `ephemeral: true` ditandai: pakai `flags: MessageFlags.Ephemeral`.
- `src/events/interactionCreate.js` dan `src/interactions/**` dibatasi 400 baris (max-lines). Logika berat taruh di helper/engine.
- Mayoritas aturan restricted-syntax sengaja disetel `warn` (bukan `error`) karena pemanggil lama belum selesai diaudit. Jangan naikkan ke `error` tanpa audit.

## Konvensi yang tidak kelihatan dari struktur

- Test colocated dengan source: `<nama>.test.js` bersebelahan file yang diuji, memakai `node:test` + `node:assert/strict`. Jalankan satu test: `node --test src/utils/rateLimiter.test.js`.
- Em dash dilarang di seluruh repo termasuk kamus bahasa (dicek `scripts/check-em-dash.js`).
- Komentar dan log dalam Bahasa Indonesia; nama variabel/fungsi/kelas dalam Inggris.
- Emoji UI wajib terdaftar di `src/config/ui.js`; akses via `ui.getEmoji()` + `ui.parseEmoji()`, jangan hardcode.
- Warna survival wajib dari `src/utils/survivalUIHelper.js`; footer via `ui.getFooter('core'|'utility'|'survival'|'music')`.
- `prestart` saat ini juga menjalankan `dashboard:build` sebelum migrasi (lihat `package.json`; dokumen AGENTS.md belum mencerminkannya).
