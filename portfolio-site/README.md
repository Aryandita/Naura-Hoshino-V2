# 🌟 Aryandita Personal Portfolio (Standalone Static Site)

Paket portofolio mandiri (independen) dari **I Gede Aryandita Praftian (Arya)** - *Front Office & Hospitality Specialist*. Berisi seluruh aset statis siap pakai tanpa dependensi runtime Node.js atau backend, sehingga dapat dijalankan langsung di server **Nginx**, **Apache**, **Docker**, atau platform static hosting (Cloudflare Pages, Vercel, GitHub Pages).

---

## 📁 Struktur Berkas

```
portfolio-site/
├── index.html           # Halaman utama portofolio Bento-Grid
├── nginx.conf           # Konfigurasi Nginx siap pakai
├── README.md            # Panduan instalasi dan deployment
└── assets/
    └── owner_photo.jpeg # Foto profil asli
```

---

## 🚀 Panduan Deployment ke Nginx Server (VPS / Linux)

### 1. Salin Folder ke Server Web
Upload seluruh isi folder `portfolio-site/` ke direktori web server (misal: `/var/www/portfolio-site`):

```bash
# Buat folder target di server
sudo mkdir -p /var/www/portfolio-site

# Salin semua file dari lokal ke server (via SCP / Rsync / Git)
scp -r portfolio-site/* user@ip-server-kamu:/var/www/portfolio-site/

# Berikan hak akses pembacaan untuk Nginx
sudo chown -R www-data:www-data /var/www/portfolio-site
sudo chmod -R 755 /var/www/portfolio-site
```

### 2. Pasang Konfigurasi Nginx
Salin berkas `nginx.conf` ke folder konfigurasi Nginx:

```bash
sudo cp /var/www/portfolio-site/nginx.conf /etc/nginx/sites-available/portfolio.conf
sudo ln -s /etc/nginx/sites-available/portfolio.conf /etc/nginx/sites-enabled/
```

> **Catatan:** Buka `/etc/nginx/sites-available/portfolio.conf` dan ubah `server_name` sesuai dengan domain atau alamat IP server kamu.

### 3. Uji & Restart Nginx
```bash
sudo nginx -t
sudo systemctl reload nginx
```

---

## 🐳 Alternatif: Jalankan Cepat dengan Docker

Jika server kamu menggunakan Docker, cukup jalankan satu baris perintah berikut di dalam direktori `portfolio-site/`:

```bash
docker run -d -p 8080:80 \
  -v $(pwd):/usr/share/nginx/html:ro \
  --name aryandita-portfolio \
  nginx:alpine
```

Buka `http://localhost:8080` untuk melihat portofolio yang berjalan di dalam container Nginx!

---

## ☁️ Alternatif: Gratis via Static Hosting (Zero-Config)

- **Cloudflare Pages / Vercel / Netlify:** Cukup drag & drop folder `portfolio-site` atau arahkan repository ke folder ini.
- **GitHub Pages:** Upload isi folder ini ke repository GitHub dan aktifkan GitHub Pages pada branch `main`.

---

© 2026 I Gede Aryandita Praftian. All rights reserved.
