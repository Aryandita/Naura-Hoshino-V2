# 🛡️ Security Policy & Vulnerability Reporting, Naura Hoshino V2

> **Ekosistem:** Naura Hoshino V2 · **Versi Aktif:** 2.4.0 · **Framework:** discord.js v14 & Node.js ≥ 24  
> **Dokumentasi Terkait:** [`README.md`](README.md) (Portal) · [`PRD.md`](PRD.md) (Produk) · [`RULES.md`](RULES.md) (Aturan Teknis) · [`AGENTS.md`](AGENTS.md) (SOP Agen)

Kami menganggap keamanan ekosistem **Naura Hoshino V2**, integritas data pengguna, dan perlindungan aset virtual sebagai prioritas utama. Dokumen ini menjelaskan kebijakan dukungan versi, cara melaporkan kerentanan keamanan secara bertanggung jawab (*responsible disclosure*), serta cakupan arsitektur defensif yang diterapkan dalam repositori ini.

---

## 📦 1. Versi yang Didukung (Supported Versions)

Hanya versi rilis terbaru yang mendapatkan pembaruan keamanan, patch kerentanan, dan perbaikan stabilitas:

| Versi | Didukung | Status Siklus Hidup | Catatan Pemeliharaan |
| :---: | :---: | :--- | :--- |
| **`2.4.x`** | :white_check_mark: | **Aktif (Production)** | Menerima patch keamanan reguler dan pembaruan arsitektur |
| **`2.3.x`** | :white_check_mark: | **Extended Maintenance** | Menerima security patches berkala |
| **`2.2.x`** | :x: | **End of Life (EOL)** | Dukungan telah berakhir; disarankan migrasi ke v2.4.0 |
| **`< 2.2`** | :x: | **Tidak Didukung** | Versi warisan lama tanpa dukungan keamanan |

---

## 🚨 2. Cara Melaporkan Kerentanan (Reporting a Vulnerability)

> [!CAUTION]
> **JANGAN PERNAH** mempublikasikan informasi kerentanan keamanan melalui GitHub Public Issues, Pull Requests publik, forum komunitas, atau channel obrolan publik Discord sebelum patch perbaikan resmi dirilis.

Jika Anda menemukan celah keamanan (*security vulnerability*), silakan laporkan melalui jalur resmi dan privat berikut:

### Metode Utama: GitHub Private Vulnerability Reporting (Disarankan)
1. Buka tab [**Security**](https://github.com/Aryandita/Naura-Hoshino-V2/security) pada repositori Naura Hoshino V2.
2. Di panel navigasi sebelah kiri, pilih [**Advisories**](https://github.com/Aryandita/Naura-Hoshino-V2/security/advisories).
3. Klik tombol **"Report a vulnerability"** untuk membuka formulir pelaporan privat.
4. Lengkapi detail kerentanan sesuai format di bawah, lalu kirimkan laporan.

### Metode Alternatif: Kontak Privat Pengelola Proyek
Jika Anda tidak dapat mengakses fitur GitHub Advisories:
- **GitHub Direct Message / Notification:** Hubungi maintainer utama melalui profil GitHub [@Aryandita](https://github.com/Aryandita).
- **Discord:** Hubungi tim pengembang melalui Direct Message ke akun maintainer resmi pada server komunitas Discord resmi Naura Hoshino.

---

## 📝 3. Informasi yang Wajib Disertakan dalam Laporan

Untuk mempercepat proses validasi dan triase, sertakan informasi berikut secara jelas:

1. **Deskripsi Ringkas Kerentanan:** Penjelasan mengenai sifat kerentanan dan potensi dampak teknis atau bisnis (misalnya: *IDOR*, *SSRF*, *Atomic Race Condition*, *Token Leak*, atau *Injection*).
2. **Komponen yang Terdampak:** Sebutkan modul spesifik (contoh: Discord Bot Gateway, Web Dashboard Express API, Supabase Database, MongoDB Handler, Redis Cache Mutex, Lavalink Cluster Manager, atau AI Ensemble Router).
3. **Langkah-langkah Reproduksi (Step-by-Step):** Urutan tindakan yang sistematis dan terperinci agar tim kami dapat mereproduksi celah tersebut di lingkungan lokal.
4. **Bukti Konsep (Proof of Concept / PoC):** Cuplikan kode, payload pengujian, skrip pengujian minimal, atau screenshot/video yang membuktikan eksploitasi dapat dilakukan.
5. **Usulan Mitigasi (Opsional):** Jika Anda memiliki rekomendasi kode perbaikan atau patch pencegahan, silakan lampirkan.

---

## ⏱️ 4. Komitmen & Timeline Penanganan (Response SLA)

Tim pengembang Naura Hoshino V2 berkomitmen menerapkan transparansi dan koordinasi aktif selama proses mitigasi:

- **Konfirmasi Awal (24 s/d 48 Jam):** Tim kami akan mengonfirmasi penerimaan laporan dan memulai triase awal.
- **Validasi & Penilaian Bukti (3 s/d 5 Hari Kerja):** Kami memvalidasi PoC menggunakan metodologi berbasis bukti (mengeliminasi *false positives* sesuai standar pengujian Strix AI Penetration Testing).
- **Penyusunan Patch & Pengujian:** Perbaikan kode akan diuji menyeluruh terhadap seluruh master test suite (523 tests) untuk memastikan tidak terjadi regresi fungsional.
- **Penerbitan Patch & Pengakuan:** Setelah patch berhasil dirilis ke branch `main`, pengumuman keamanan (*Security Advisory*) akan dipublikasikan dan nama pelapor akan dicantumkan dalam daftar kredit/penghargaan (kecuali jika pelapor meminta tetap anonim).

---

## 🛡️ 5. Postur Keamanan & Arsitektur Defensif (In Scope)

Area arsitektur utama yang berada dalam cakupan pengawasan keamanan:

### A. Kerahasiaan Lingkungan & Manajemen Kredensial
- Seluruh variabel rahasia (`DISCORD_TOKEN`, kredensial Supabase/PostgreSQL, URI MongoDB, URL Redis, password Lavalink, Fish Audio API key, LLM keys Gemini/Groq) wajib diisolasi di file `.env`.
- File `.env` diproteksi ketat pada `.gitignore` dan dilarang masuk ke riwayat pelacakan Git.
- Akses variabel lingkungan dipusatkan melalui [`src/config/env.js`](src/config/env.js).
- Logging konsol secara ketat menyaring token, password, dan connection string sensitif.

### B. Integritas Webhook & Idempotensi Transaksi
- Endpoint webhook donasi dan pemungutan suara (`/api/webhook/*`) wajib memverifikasi header autentikasi menggunakan perbandingan *constant-time* `crypto.timingSafeEqual`.
- Transaksi ekonomi virtual dan pemberian hadiah dilindungi dengan *idempotency key* untuk mencegah serangan *replay*.

### C. Keamanan Web Dashboard & REST API
- Endpoint pemeliharaan server dan administrasi dilindungi oleh middleware otorisasi ketat `requireOwner`.
- Endpoint tiket dukungan dan data profil pengguna dilindungi dari celah BOLA/IDOR melalui middleware verifikasi kepemilikan data (`canAccessTicket`).
- Endpoint pengiriman URL luar (seperti webhook farm) divalidasi dengan `isSafeWebhookUrl()` untuk memitigasi risiko *Server-Side Request Forgery* (SSRF).
- Endpoint hadiah mini-game arcade (`POST /api/arcade/claim`) dilindungi *rate limiter* server-side dan batas perolehan harian (*daily hard cap*).

### D. Konsistensi Polyglot Database & Anti-Race Condition
- Mutasi saldo moneter (PD / SC) dan inventori JSON wajib dieksekusi secara atomik melalui [`cacheManager.js`](src/managers/cacheManager.js) menggunakan mekanisme *distributed mutex lock* Redis atau transaksi database relasional.
- Seluruh query database relasional Sequelize menggunakan *parameterized bindings* untuk mencegah SQL Injection.
- Seluruh query MongoDB/Mongoose disanitasi dari injeksi operator NoSQL.

### E. AI Ensemble & Pertahanan Prompt Injection
- Pesan obrolan pengguna Discord diperlakukan sebagai *untrusted data* dan diisolasi dari instruksi inti sistem prompt AI.
- Integrasi API pihak ketiga (Gemini, Groq) dilengkapi mekanisme *Circuit Breaker* untuk menangani *rate limit* (HTTP 429) dan gangguan koneksi secara aman.

---

## 🚫 6. Hal di Luar Cakupan (Out of Scope)

Kategori berikut berada di luar cakupan program pelaporan kerentanan:

1. Serangan *Denial of Service* (DoS / DDoS) terhadap infrastruktur pihak ketiga (misalnya Discord Gateway API, Cloudflare Network, Supabase Infrastructure, atau Groq API).
2. Serangan rekayasa sosial (*social engineering*, *phishing*) yang menargetkan pemilik server, administrator komunitas, atau pengguna bot.
3. Kerentanan yang memerlukan akses fisik langsung (*physical access*) atau akses root terminal ke mesin server/container hosting.
4. Laporan yang dihasilkan murni dari alat pemindai otomatis (*automated security scanners*) tanpa bukti konsep eksploitasi nyata (*verifiable proof of concept*).
5. Masalah spesifik antarmuka browser pengguna yang hanya terjadi pada browser usang yang sudah tidak didukung secara resmi oleh vendor.

---

## 🤝 7. Pedoman Pengungkapan Bertanggung Jawab (Responsible Disclosure)

Kami sangat menghargai kontribusi para peneliti keamanan independen yang membantu menjaga keamanan ekosistem Naura Hoshino V2. Kami meminta kerja sama Anda untuk:
- Memberikan waktu yang memadai kepada tim pengembang kami untuk memvalidasi dan merilis perbaikan sebelum mengungkap informasi ke publik.
- Tidak melakukan tindakan yang merusak integritas server, mengubah data pengguna lain, atau mengganggu ketersediaan layanan selama pengujian.
- Bertindak dengan niat baik (*good faith*) dan mematuhi etika pengujian keamanan internasional.
