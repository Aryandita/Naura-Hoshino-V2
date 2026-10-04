---
name: bm-handoff
description: "Preserve session continuity across context compacts, session boundaries, or agent turn limits using .planning/HANDOFF.json. Trigger with /handoff or resume-work."
user-invocable: true
---

# Buildomator Session Continuity & Handoff Protocol

Protokol kontinuitas sesi dari Buildomator untuk mencatat keadaan pekerjaan aktif ke file `.planning/HANDOFF.json`. Memastikan agen AI maupun developer dapat melanjutkan pekerjaan tanpa kehilangan konteks saat berpindah sesi, berganti model, atau setelah pemadatan konteks (*context compaction*).

---

## 📦 Struktur `.planning/HANDOFF.json`

```json
{
  "timestamp": "2026-10-04T22:15:00Z",
  "phase": "Phase 2: Survival Fishing System",
  "activePlan": "Plan 02: Pure Domain Logic & Probability Engine",
  "lastCompletedTask": "US-001: Skema database dan kolom status pancing",
  "recentDecisions": [
    "D-01: Menggunakan kolom fishing_rod dan fishing_xp pada UserSurvival.js",
    "D-02: Mutasi saldo dan XP selalu melalui cacheManager"
  ],
  "uncommittedFiles": [
    "src/survival/fishingEngine.js",
    "src/survival/fishingEngine.test.js"
  ],
  "nextAction": "Jalankan node --test src/survival/fishingEngine.test.js untuk memverifikasi test",
  "resumptionHint": "Fokus pada US-002. Engine logika murni sudah ditulis, lanjutkan penyelesaian unit test hingga 100% hijau."
}
```

---

## 🔄 Alur Operasional

### 1. Menulis Handoff (Sebelum Sesi Berakhir / Berpindah Tugas)
Sebelum mengakhiri turn atau saat tugas besar dijeda:
- Periksa file yang telah diubah dengan `git status`.
- Tulis ringkasan progres, keputusan arsitektur, dan satu aksi berikutnya ke `.planning/HANDOFF.json`.

### 2. Membaca Handoff (Saat Sesi Baru Dimulai)
Ketika agen memulai sesi baru pada proyek:
- Periksa apakah file `.planning/HANDOFF.json` ada.
- Jika ada, baca state tersebut dan tawarkan untuk melanjutkan `nextAction` secara instan tanpa perlu bertanya ulang dari nol.
- Hapus atau bersihkan handoff setelah fase berhasil diselesaikan.
