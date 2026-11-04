# Project Documentation Rules (Non-Obvious Only)

## Hierarki sumber kebenaran

- `package.json` mengalahkan tabel dependensi/versi di `AGENTS.md` (versi resmi: 2.5.0); `src/config/env.js` mengalahkan tabel environment. Bila dokumen bertentangan dengan file, file yang benar.
- Prioritas kerja aktif: `TODO.md` (sprint) dan GitHub Issues. Sprint 0-35 sudah tuntas.
- Token visual & design system: `DESIGN.md` (termasuk arsitektur 3 Pilar: THEME_NAURA, THEME_SURVIVAL, THEME_DASHBOARD).

## Diskrepansi dokumen yang sudah diketahui & diperbarui

- Lokasi kamus bahasa resmi adalah `assets/language/id.json`, `en.json`, `es.json`, dan `ja.json`.
- `prestart` di `package.json` menjalankan `scripts/ensure-build.js`, `scripts/migrate.js`, dan `scripts/warmup-cache.js`.
- CI (`.github/workflows/ci.yml`) dan QA gate (`npm run qa`) menjalankan 9 tahap: format:check, lint, check-em-dash, locales:check:strict, check-requires, check-inline-scripts, check-secrets, verify-drift, dan test suites.

## Konteks organisasi kode

- `plugin/` hanya router command; logika sesungguhnya di `src/<domain>/contracts`, `src/survival/engines`, `src/managers`, atau `src/services`. Mencari implementasi fitur di plugin hampir selalu salah tempat.
- Dashboard aktif berada di `dashboard/` (Vite MPA + Express API) dan sub-dashboard di `dashboard/mobile/`. Build dashboard menggunakan `npm run build` atau `npm run dashboard:build`.
