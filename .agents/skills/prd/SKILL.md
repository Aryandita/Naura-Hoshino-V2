---
name: prd
description: "Generate a Product Requirements Document (PRD) for a new feature. Use when planning a feature, starting a new project, or when asked to create a PRD. Triggers on: create a prd, write prd for, plan this feature, requirements for, spec out."
user-invocable: true
---

# PRD Generator (Naura Hoshino V2)

Buat Product Requirements Document (PRD) yang terperinci, terstruktur, dan siap dieksekusi secara otonom oleh loop agent (Ralph) maupun developer.

---

## 🎯 Tugas Utama

1. Menerima deskripsi fitur dari pengguna.
2. Mengajukan 3-5 pertanyaan klarifikasi esensial dengan opsi berhuruf (A, B, C, D).
3. Menyusun PRD terstruktur berdasarkan jawaban pengguna dan konvensi Naura Hoshino V2.
4. Menyimpan output ke `tasks/prd-[nama-fitur].md`.

> [!IMPORTANT]
> Jangan langsung mulai mengimplementasikan kode. Fokus selesaikan PRD terlebih dahulu.

---

## Langkah 1: Pertanyaan Klarifikasi Esensial

Ajukan hanya pertanyaan penting jika deskripsi awal masih ambigu. Fokus pada:
- **Tujuan Utama & Nilai Produk**: Masalah apa yang diselesaikan?
- **Domain Ekosistem**: Apakah fitur ini Bot Command (Slash/Components V2), Survival RPG (Naura Wilds), Web Dashboard (Vite/3D), Audio, atau Living AI?
- **Batasan Ruang Lingkup**: Apa yang TIDAK boleh dikerjakan (Non-Goals)?
- **Kriteria Keberhasilan**: Apa tolok ukur fitur ini selesai?

### Format Pertanyaan (Wajib Indentasi Opsi):

```text
1. Apa domain utama dari fitur ini?
   A. Bot Command / Components V2 UI
   B. Survival RPG (Naura Wilds / Ekonomi)
   C. Web Dashboard & 3D Viewer
   D. Living AI / Audio DJ

2. Bagaimana skala implementasinya?
   A. MVP ringkas (fungsional minimal)
   B. Fitur lengkap dengan data persisten DB
   C. Hanya backend / service logic
   D. Hanya antarmuka Discord UI

3. Bagaimana penanganan datanya?
   A. Menggunakan skema DB Postgres/Supabase baru (perlu migrasi)
   B. Menggunakan model yang sudah ada
   C. In-memory / cache Redis saja
   D. Stateless (tanpa DB)
```

Format ini mempermudah pengguna merespons cepat, misalnya: `1A, 2B, 3A`.

---

## Langkah 2: Struktur Dokumen PRD

Simpan dokumen ke `tasks/prd-[nama-fitur].md` dengan format berikut:

```markdown
# PRD: [Nama Fitur]

## 1. Ringkasan & Latar Belakang
Penjelasan singkat mengenai fitur, kebutuhan pengguna, dan masalah yang diselesaikan.

## 2. Sasaran Utama (Goals)
- Sasaran 1 (terukur)
- Sasaran 2 (terukur)

## 3. User Stories (Atomic & Verifiable)

### US-001: [Judul Story]
**Deskripsi:** Sebagai [pengguna/developer], saya ingin [fitur] agar [tujuan].
**Domain:** [Bot / Survival / Dashboard / Database]
**Kriteria Penerimaan (Acceptance Criteria):**
- [ ] Kriteria spesifik yang dapat diverifikasi
- [ ] Validasi error input ditangani secara defensif
- [ ] Lolos lint dan QA: `npm run lint` & `npm run test:requires`

### US-002: [Judul Story]
...

## 4. Kebutuhan Fungsional (Functional Requirements)
- FR-1: Sistem harus memvalidasi...
- FR-2: Ketika pengguna menekan tombol X, bot merespons dengan...

## 5. Kebutuhan Teknis & Batasan Arsitektur
- Mengikuti aturan `RULES.md` (transaksi atomik, no em-dash, Components V2).
- Penanganan status database via `cacheManager.js`.

## 6. Non-Goals (Di Luar Ruang Lingkup)
- Hal-hal yang sengaja tidak dicakup pada rilis ini.
```

---

## Langkah 3: Konversi ke Format Ralph

Setelah PRD disetujui, gunakan skill `/ralph` untuk mengonversi `tasks/prd-[nama-fitur].md` menjadi `scripts/ralph/prd.json` agar siap dieksekusi secara berurutan.
