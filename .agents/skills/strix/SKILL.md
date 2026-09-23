---
name: strix-security-audit
description: "AI-driven penetration testing, vulnerability triage, and false-positive validation based on the Strix framework. Use for security auditing Express, Supabase, Redis, MongoDB, and Discord bot architectures."
disable-model-invocation: true
license: Apache-2.0
metadata:
  tags: "Security, Penetration Testing, Vulnerability Triage, False Positive Elimination, OWASP"
  category: "security"
---

# Strix Security Audit & False-Positive Validation Skill

Metodologi audit keamanan otomatis dan triase kerentanan berbasis kerangka kerja Strix (Open-Source AI Penetration Testing).

## 🎯 Prinsip Utama Strix (Proof-of-Concept vs False Positive)

Alat analisis statis konvensional (SAST) sering kali menghasilkan banyak peringatan palsu (_false positives_). Strix berfokus pada **verifikasi berbasis bukti (Proof of Concept)**:

1. **Bukan hanya pola teks:** Jangan simpulkan kode rentan hanya karena melihat kata kunci seperti `eval`, `query`, atau `exec`. Telusuri apakah input berasal dari pengguna tak terpercaya (_untrusted user input_).
2. **Telusuri Rantai Aliran Data (Taint Analysis):**
   `User Input (Interaction/HTTP Request) -> Sanitization / Guard Clause -> Database Query / Command Execution`.
   Jika ada guard clause, tipe data dicek ketat, atau ORM menggunakan parameter binding, maka temuan tersebut adalah **False Positive**.
3. **Validasi Atomisitas:** Untuk sistem keuangan atau game (seperti NC/NSF di Naura Wilds), audit harus memverifikasi apakah ada celah _Race Condition_ atau _Double Spending_ saat interaksi diklik bersamaan.

---

## 🛡️ Matriks Pemeriksaan Keamanan Spesifik Stack

### 1. Web Dashboard & API (Express.js)

- **Autentikasi & Otorisasi:**
  - Pastikan endpoint privat dilindungi oleh middleware sesi/JWT yang valid.
  - Validasi _Broken Object Level Authorization_ (BOLA/IDOR): pastikan pengguna tidak bisa mengubah guild/profil milik pengguna lain hanya dengan mengganti parameter `guildId` atau `userId`.
- **CORS & Headers Keamanan:**
  - Pastikan origin CORS dibatasi atau dikonfigurasi dengan benar di `dashboard/server.js`.
  - Pastikan _rate limiting_ aktif pada endpoint sensitif (seperti login atau API command trigger).

### 2. Database SQL (Sequelize & Supabase PostgreSQL)

- **SQL Injection (SQLi):**
  - Periksa apakah ada konkatenasi string langsung pada raw query (`sequelize.query("SELECT ... WHERE id = " + input)`).
  - **Verifikasi Aman:** Jika query menggunakan Sequelize parameterized binding (`replacements`, `bind`, atau model methods `findOne({ where: ... })`), maka terverifikasi **AMAN**.

### 3. Database Dokumen (MongoDB & Mongoose)

- **NoSQL Injection:**
  - Pastikan input objek JSON mentah dari request body tidak langsung dioper ke query filter seperti `User.find(req.body)` yang dapat disusupi operator `$gt`, `$ne`, atau `$where`.
  - **Verifikasi Aman:** Jika input disanitasi menjadi tipe primitif (`String(input)`) atau difilter dengan skema ketat Mongoose, maka terverifikasi **AMAN**.

### 4. Cache & Distributed Lock (Redis)

- **SSRF & Command Injection:**
  - Pastikan kunci Redis tidak dibangun dari input eksternal tanpa validasi karakter pemisah (`:` atau `\r\n`).
  - Pastikan lock mutex (`redisLockHelper`) memiliki mekanisme auto-expiry (TTL) dan token ownership check untuk mencegah _deadlock_.

### 5. Rahasia & Kredensial (.env & API Keys)

- **Pencegahan Kebocoran:**
  - Pastikan file `.env` terdaftar di `.gitignore` dan tidak pernah di-commit ke Git.
  - Pastikan endpoint publik (seperti status API atau telemetry) tidak membocorkan `process.env.TOKEN` atau database URL.

---

## 🔍 Prosedur Eksekusi Triase

Saat melakukan audit pada file atau fitur baru:

1. **Identifikasi Titik Masuk (Entrypoints):** Periksa handler interaksi slash command, tombol Discord, dan route Express.
2. **Telusuri Sanitasi Data:** Evaluasi apakah parameter divalidasi dengan `typeof`, schema parser, atau guard clause.
3. **Uji Kasus Ekstrem:** Evaluasi input tak terduga (string sangat panjang, null byte, unicode formatting, SQL payload klasik).
4. **Buat Rekomendasi Remediasi:** Jika ditemukan kerentanan nyata, berikan perbaikan langsung (_patch_) dengan memisahkan logika ke dalam fungsi deterministik yang aman.
