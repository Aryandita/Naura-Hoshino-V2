# Panduan Integrasi Server Minecraft & Skript Naura Hoshino V2

Dokumentasi ini ditujukan bagi administrator server Minecraft (Paper, Purpur, Spigot, Fabric) untuk menghubungkan server game dengan bot Discord Naura Hoshino V2. Melalui integrasi ini, pemain dapat menautkan akun Minecraft ke Discord secara langsung di dalam server menggunakan perintah `/naura link <kode>`, mendapatkan reward Star Fragments, dan menyinkronkan data pemain ke database bot.

---

## 1. Arsitektur & Alur Kerja

```
[Pemain di Discord]
   │  Menjalankan: /minecraft link username:PlayerName
   ▼
[Bot Naura Hoshino]
   │  Membuat 6-digit kode verifikasi acak (misal: 361462)
   │  Menyimpan kode sementara di Redis & database PostgreSQL (masa aktif 15 menit)
   ▼
[Pemain di Server Minecraft]
   │  Masuk ke server Minecraft dan menjalankan: /naura link 361462
   ▼
[Skript Server Minecraft (naura_link.sk)]
   │  Mengirim HTTP POST request ke endpoint API Bot Naura (/api/minecraft/verify)
   ▼
[Bot Naura Hoshino API]
   │  Mencocokkan kode verifikasi
   │  Mengubah status tautan akun menjadi terverifikasi (isVerified = true)
   │  Menambahkan bonus +500 Star Fragments ke akun Discord pemain
   │  Mengirim pesan konfirmasi langsung (DM) ke akun Discord pemain
   ▼
[Server Minecraft]
   Memberikan efek suara level-up dan pesan sukses kepada pemain
```

---

## 2. Persyaratan Server

Sebelum memasang skrip, pastikan server Minecraft Anda memenuhi persyaratan berikut:
1. Server Minecraft berbasis Bukkit: **Paper**, **Purpur**, atau **Spigot** (Versi 1.16 sampai 1.21+).
2. Plugin **Skript** versi 2.6 atau yang lebih baru terpasang di folder `plugins/`.
3. Add-on Skript pendukung HTTP (pilih salah satu):
   * **SkQuery** (Metode paling populer dan direkomendasikan).
   * **skript-reflect** (Metode tanpa add-on HTTP eksternal, langsung memanggil Java HTTP).
   * **ReqREST** atau **skript-json**.
4. Port HTTP bot Naura (default: `3000`) dapat diakses dari server Minecraft Anda (lihat Bagian 4).

---

## 3. Langkah Instalasi Berkas Skript

1. Unduh berkas skrip dari repositori di:
   ```text
   assets/minecraft/naura_link.sk
   ```
2. Letakkan berkas tersebut ke dalam direktori server Minecraft Anda:
   ```text
   plugins/Skript/scripts/naura_link.sk
   ```
3. Buka berkas `naura_link.sk` menggunakan editor teks (VSCode, Notepad++, atau nano) dan sesuaikan opsi `api_url`:
   ```yaml
   options:
       # Ganti dengan domain publik atau IP publik VPS bot Anda
       api_url: "http://ip-bot-anda:3000/api/minecraft/verify"
   ```
   *Jika bot dan server Minecraft berada di satu VPS yang sama, Anda dapat menggunakan:*
   ```yaml
   options:
       api_url: "http://127.0.0.1:3000/api/minecraft/verify"
   ```
4. Di dalam konsol server atau in-game (sebagai OP), jalankan perintah reload:
   ```bash
   sk reload naura_link.sk
   ```
   Jika berhasil, Anda akan melihat pesan: `[Skript] Loaded 1 script: naura_link.sk`.

---

## 4. Konfigurasi Jaringan & Port Firewall

Bot Naura Hoshino secara default menjalankan dashboard dan API publik pada port `3000` (atau port yang disetel di variabel lingkungan `DASHBOARD_PORT`).

### Memastikan Port Terbuka
Jika server Minecraft berada di mesin atau hosting yang berbeda dengan bot:
* Buka port `3000` di firewall VPS bot (UFW):
  ```bash
  sudo ufw allow 3000/tcp
  sudo ufw reload
  ```
* Jika menggunakan reverse proxy NGINX di server bot:
  ```nginx
  location /api/minecraft/ {
      proxy_pass http://127.0.0.1:3000/api/minecraft/;
      proxy_set_header Host $host;
      proxy_set_header X-Real-IP $remote_addr;
      proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }
  ```
  Maka `api_url` di `naura_link.sk` dapat diubah menjadi:
  `https://domain-bot-anda.com/api/minecraft/verify`

---

## 5. Pengaturan Izin Pemain (Permissions)

Perintah `/naura link` membutuhkan permission node `naura.use`.

### Menggunakan LuckPerms (Rekomendasi)
Berikan izin ke grup `default` (semua pemain) dengan menjalankan perintah berikut di konsol server:
```bash
lp group default permission set naura.use true
```

---

## 6. Uji Coba & Alur Penggunaan Pemain

1. Pemain membuka Discord dan mengetik perintah:
   ```text
   /minecraft link username:Steve
   ```
   Bot akan membalas dengan kartu verifikasi yang berisi kode 6-digit (misalnya: `849102`).
2. Pemain masuk ke server Minecraft dengan akun `Steve` dan mengetik:
   ```text
   /naura link 849102
   ```
3. Server Minecraft akan membalas dengan pesan hijau:
   `[Naura] Sukses! Akun Minecraft Anda berhasil ditautkan ke Discord!`
   `+500 Star Fragments telah ditambahkan ke akun Discord Anda!`
4. Bot di Discord secara otomatis mengirimkan pesan konfirmasi DM kepada pemain.

---

## 7. Alternatif Skript (Java Reflection / Tanpa Add-on)

Jika server Anda tidak memasang SkQuery dan hanya memiliki `skript-reflect`, Anda dapat menggunakan template berikut:

```yaml
import:
    java.net.URL
    java.net.HttpURLConnection
    java.io.OutputStreamWriter
    java.io.BufferedReader
    java.io.InputStreamReader

options:
    api_url: "http://localhost:3000/api/minecraft/verify"

command /naura [<text>] [<text>]:
    permission: naura.use
    trigger:
        if arg-1 is "link":
            if arg-2 is not set:
                send "&c[Naura] Masukkan kode verifikasi 6 digit! Contoh: /naura link 123456" to player
                stop
            
            set {_code} to arg-2
            set {_name} to name of player
            set {_uuid} to uuid of player
            
            send "&e[Naura] Memverifikasi tautan akun ke Discord..." to player
            
            set {_url} to new URL("{@api_url}")
            set {_conn} to {_url}.openConnection()
            {_conn}.setRequestMethod("POST")
            {_conn}.setRequestProperty("Content-Type", "application/json")
            {_conn}.setDoOutput(true)
            {_conn}.setConnectTimeout(5000)
            {_conn}.setReadTimeout(5000)
            
            set {_json} to "{""code"": ""%{_code}%"", ""username"": ""%{_name}%"", ""uuid"": ""%{_uuid}%""}"
            set {_writer} to new OutputStreamWriter({_conn}.getOutputStream(), "UTF-8")
            {_writer}.write({_json})
            {_writer}.flush()
            {_writer}.close()
            
            set {_status} to {_conn}.getResponseCode()
            if {_status} is 200:
                send "&a&l[Naura] Berhasil! Akun Minecraft Anda terhubung ke Discord!" to player
                send "&6+500 Star Fragments telah ditambahkan ke akun Discord Anda!" to player
                play sound "entity.player.levelup" with volume 1 and pitch 1 to player
            else:
                send "&c[Naura] Kode verifikasi salah atau sudah kadaluarsa (15 menit)." to player
```

---

## 8. Verifikasi Alternatif & Penanganan Manual Admin

Jika pemain mengalami kendala teknis dalam server Minecraft, Naura menyediakan dua jalur verifikasi darurat:

1. **Verifikasi Langsung dari Discord:**
   Pemain dapat langsung memverifikasi kodenya melalui slash command Discord:
   ```text
   /minecraft verify code:849102
   ```
2. **Override Manual oleh Admin Server:**
   Admin Discord (dengan permission administrator bot) dapat menautkan akun secara manual tanpa membutuhkan kode dari in-game:
   ```text
   /minecraft admin-verify user:@Pemain username:Steve
   ```

---

## 9. Troubleshooting & FAQ

* **Pertanyaan: Pemain mendapat pesan `Gagal memverifikasi kode. Pastikan kode benar atau belum kadaluarsa`.**
  * Solusi: Kode verifikasi hanya berlaku selama 15 menit. Jika sudah lewat, minta pemain menjalankan ulang `/minecraft link` di Discord untuk mendapatkan kode baru.
* **Pertanyaan: Skript mengalami error saat reload `can't understand this condition/effect`.**
  * Solusi: Server Anda belum terpasang add-on HTTP seperti SkQuery. Anda bisa memasang plugin SkQuery atau memakai skrip berbasis `skript-reflect` pada Bagian 7.
* **Pertanyaan: Request gagal dengan pesan connection refused.**
  * Solusi: Periksa kembali apakah bot Naura Hoshino sedang menyala dan apakah port dashboard bot terbuka serta dapat diakses dari IP server Minecraft Anda.
