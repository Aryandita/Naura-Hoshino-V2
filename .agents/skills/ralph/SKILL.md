---
name: ralph
description: "Convert PRDs to prd.json format for the Ralph autonomous agent system. Use when you have an existing PRD and need to convert it to Ralph's JSON format. Triggers on: convert this prd, turn this into ralph format, create prd.json from this, ralph json."
user-invocable: true
---

# Ralph PRD Converter (Naura Hoshino V2)

Mengonversi dokumen PRD markdown (dari `tasks/prd-*.md` atau teks) ke format `prd.json` untuk eksekusi tugas otonom iterasi demi iterasi.

---

## 🎯 Format Output `scripts/ralph/prd.json`

```json
{
  "project": "Naura Hoshino V2",
  "branchName": "ralph/nama-fitur-kebab-case",
  "description": "Deskripsi fitur dari PRD",
  "userStories": [
    {
      "id": "US-001",
      "title": "Migrasi database dan skema model baru",
      "description": "Sebagai developer, saya ingin membuat tabel baru agar data persisten tersimpan dengan aman.",
      "acceptanceCriteria": [
        "Migrasi bernomor baru terdaftar di src/managers/dbMigrator.js",
        "Model Sequelize terdefinisi di src/models/",
        "npm run test:requires lolos tanpa broken module"
      ],
      "priority": 1,
      "passes": false,
      "notes": ""
    }
  ]
}
```

---

## ⚖️ Aturan Emas Ukuran Story (Story Sizing)

**Satu story WAJIB dapat diselesaikan dalam 1 iterasi konteks LLM.**

Ralph mengeksekusi satu story per iterasi dengan konteks bersih. Jika story terlalu besar, model akan mengalami *context overflow* dan menghasilkan kode rusak.

### Contoh Ukuran yang Tepat:
- Menambahkan kolom/tabel database dan fungsi migrasi.
- Menambahkan satu service helper di `src/services/`.
- Menambahkan satu router slash command atau subcommand di `plugin/`.
- Menambahkan entri terjemahan di `assets/language/id.json` dan `en.json`.
- Menulis unit test untuk modul tertentu.

### Contoh yang Terlalu Besar (Wajib Dipecah):
- *"Buat seluruh sistem minigame baru"* -> Pecah menjadi:
  1. US-001: Skema database & migrasi.
  2. US-002: Service engine & rumus probabilitas (pure logic).
  3. US-003: Slash command router & Components V2 builder.
  4. US-004: Button interaction handler.
  5. US-005: Paritas bahasa & QA test.

---

## ⛓️ Urutan Dependensi (Dependencies First)

Stories dieksekusi berurutan berdasarkan nilai `priority`. Story awal tidak boleh bergantung pada story berikutnya:

1. **Prioritas 1: Database & Migrasi** (Skema Sequelize / Mongoose di `src/models/` & `dbMigrator.js`).
2. **Prioritas 2: Core Domain & Services** (Logika murni di `src/services/` atau `src/survival/`).
3. **Prioritas 3: Interaction & UI** (Slash command, handler tombol, `NauraContainerBuilder.js`).
4. **Prioritas 4: Lokalisasi & Bantuan** (`id.json`, `en.json`, dan `src/core/helpView.js`).
5. **Prioritas 5: Verifikasi QA Gate** (`npm run qa` berstatus 100% hijau).

---

## ✅ Kriteria Penerimaan (Acceptance Criteria)

Kriteria penerimaan harus dapat diverifikasi secara objektif, bukan sekadar opini abstrak.
- Bagus: `"Tombol Beli memotong saldo via cacheManager.incrementUserSurvival dengan nilai negatif."`
- Bagus: `"npm run test:requires dan npm run lint lolos dengan exit code 0."`
- Buruk: `"Tampilannya terlihat keren dan tidak ada bug."`
