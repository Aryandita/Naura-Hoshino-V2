---
name: bm-plan
description: "Structured phased planning workflow adapted from Buildomator. Use to plan complex features, milestones, and phases with clear architectural decisions, dependency ordering, and verification criteria."
user-invocable: true
---

# Buildomator Phase Planning (Naura Hoshino V2)

Keterampilan perencanaan terstruktur berbasis fase dari Buildomator untuk memecah inisiatif besar menjadi rencana yang terukur, dapat diverifikasi, dan hemat token konteks.

---

## 🧭 Alur Kerja 3 Tahap (Plan -> Execute -> Verify)

```text
┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
│  1. PLAN PHASE  │ ───► │2. EXECUTE PHASE │ ───► │ 3. VERIFY WORK  │
│ (bm-plan / PRD) │      │ (Atomic Chunks) │      │(bm-drift & QA)  │
└─────────────────┘      └─────────────────┘      └─────────────────┘
```

---

## 📋 Langkah 1: Perencanaan Fase (`plan-phase`)

Saat merencanakan fase baru:
1. **Identifikasi Kebutuhan Inti**: Apa tujuan utama fase ini?
2. **Catat Keputusan Desain (Architectural Decisions)**:
   - Beri tag `(D-01)`, `(D-02)` pada keputusan arsitektur (misal: "D-01: Menggunakan Redis hash untuk cache state per guild").
3. **Petakan Kebutuhan Fungsional (Requirement IDs)**:
   - Beri tag `REQ-01`, `REQ-02` yang harus tercakup dalam rencana.
4. **Urutkan Rencana (Plan Ordering)**:
   - Rencana 1: Fondasi data & skema.
   - Rencana 2: Core service & kalkulator murni.
   - Rencana 3: Interaksi UI (Components V2).
   - Rencana 4: Verifikasi & integrasi testing.

---

## ⚡ Langkah 2: Eksekusi Terfokus (`execute-phase`)

- Kerjakan satu rencana per satu giliran/iterasi.
- Hindari memuat seluruh file proyek sekaligus; hanya baca file yang relevan dengan tugas aktif.
- Perbarui `.planning/HANDOFF.json` jika sesi terhenti atau berpindah tugas.

---

## 🔍 Langkah 3: Verifikasi Ketat (`verify-work`)

Sebelum menandai fase selesai, jalankan:
1. `npm run verify:drift` (pemeriksaan kepatuhan konvensi dan drift kode).
2. `npm run test:requires` (integritas modul require).
3. `npm run lint` (standar penulisan kode).
4. `npm test` (unit test suite).
