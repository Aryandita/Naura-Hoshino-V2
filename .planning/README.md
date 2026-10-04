# Directory .planning/ (Buildomator Architecture)

Folder ini digunakan oleh workflow **Buildomator** dan **Ralph** untuk mengelola perencanaan fase, dokumentasi keputusan arsitektur, dan kontinuitas sesi antar giliran AI.

## Struktur Berkas:
- `HANDOFF.json`: Berkas aktif penanda status sesi saat ini (dibuat otomatis sebelum sesi berakhir atau berpindah tugas).
- `HANDOFF.json.example`: Contoh format handoff sesi.
- `phases/`: Berkas perencanaan fase (`phase-01-*.md`).
- `decisions/`: Catatan keputusan desain arsitektur (`(D-01)`, `(D-02)`).
