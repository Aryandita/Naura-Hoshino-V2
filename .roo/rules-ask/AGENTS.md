# Project Documentation Rules (Non-Obvious Only)

## Hierarki sumber kebenaran

- `package.json` mengalahkan tabel dependensi/versi di `AGENTS.md`; `src/config/env.js` mengalahkan tabel environment. Bila dokumen bertentangan dengan file, file yang benar.
- Prioritas kerja aktif: `TODO.md` (sprint) dan GitHub Issues. Sprint 0-16 sudah tuntas.
- Token visual & design system: `DESIGN.md` (termasuk sub-brand survival Naura Wilds).

## Diskrepansi dokumen yang sudah diketahui

- Peta direktori di AGENTS.md 2.2 menyebut kamus bahasa di `language/` root; lokasi aktual adalah `assets/language/id.json` dan `assets/language/en.json`.
- `prestart` di `package.json` juga menjalankan build dashboard-v2, bukan hanya `scripts/migrate.js`.
- CI (`.github/workflows/ci.yml`) menjalankan: format:check, lint, test, locales:check:strict, check-requires, npm audit. Script `check-em-dash` ada tapi belum masuk CI meski AGENTS.md 1.4 mengklaim sebaliknya.

## Konteks organisasi kode

- `plugin/` hanya router command; logika sesungguhnya di `src/<domain>/helpers`, `src/survival/engines`, `src/managers`, atau `src/services`. Mencari implementasi fitur di plugin hampir selalu salah tempat.
- Proposal fitur dan rencana implementasi ada di `docs/` serta `implementation_plan*.md` di root.
- Dashboard aktif adalah `dashboard-v2/` (punya scripts sendiri via `--prefix`); `dashboard/` lama masih ada.
