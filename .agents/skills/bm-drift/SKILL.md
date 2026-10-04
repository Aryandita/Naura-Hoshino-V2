---
name: bm-drift
description: "Scan the codebase for architectural drift, duplicate logic, phantom scaffolding, and convention violations based on Buildomator VibeDrift. Trigger with /drift or verify-drift."
user-invocable: true
---

# Buildomator Code Drift & Convention Conformance Scanner

Skill ini memandu agen dan developer untuk mendeteksi degradasi arsitektur (*code drift*), fungsi hantu (*phantom scaffolding*), dan pelanggaran konvensi teknis pada repositori **Naura Hoshino V2**.

---

## 🛡️ Apa yang Diperiksa oleh Drift Scanner?

1. **Akses `process.env` Langsung (Env Leak)**:
   - Dilarang memanggil `process.env.XXX` langsung di luar `src/config/`.
   - Mengabaikan aturan ini dapat menyebabkan crash pada panel hosting atau lint failure.
2. **Penggunaan Bendera `ephemeral: true`**:
   - Dilarang menggunakan opsi lawas `ephemeral: true`. Wajib gunakan `flags: MessageFlags.Ephemeral`.
3. **Karakter Terlarang Em Dash (`\u2014`)**:
   - Menjaga teks tetap profesional dan bebas dari generator slop. Wajib gunakan minus biasa (`-`) atau koma.
4. **Scaffolding Hantu (Phantom Code)**:
   - Mendeteksi penanda `// TODO: implement`, stub kosong, atau placeholder tak berujung.
5. **Kepatuhan Konvensi `RULES.md`**:
   - Transaksi saldo atomik via `cacheManager.js`.
   - Respons UI Discord berbasis `NauraContainerBuilder.js`.

---

## 🚀 Cara Menjalankan Pemeriksaan

Jalankan perintah berikut di terminal:

```powershell
npm run verify:drift
# atau
node scripts/verify-drift.js
```

Jika terdeteksi error, perbaiki baris terkait sebelum melanjutkan commit atau membuka pull request.
