---
version: 1.0.0-naura-os
name: Naura Hoshino OS
description: Antarmuka sistem kontrol Naura OS dengan tema cyber-anime yang ditambatkan pada kanvas gelap pekat bernuansa luar angkasa. Brand ini tidak mengandalkan elemen datar tradisional, energinya berasal dari efek glassmorphism (panel kaca transparan), pendaran neon (neon glows) bernuansa pink dan ungu pastel, serta tipografi futuristik Orbitron untuk data real-time. Antarmuka terasa dinamis, sangat responsif, dan mencerminkan presisi sistem bot Discord modern tanpa kehilangan estetika ramah dari karakter Naura.

colors:
  primary: "#FFB6C1"
  primary-glow: "rgba(255, 182, 193, 0.8)"
  ink: "#ffffff"
  body: "#9ca3af"
  body-strong: "#d1d5db"
  muted: "#6b7280"
  hairline: "rgba(255, 182, 193, 0.15)"
  hairline-strong: "rgba(255, 182, 193, 0.3)"
  canvas: "#0b0c10"
  surface-glass: "rgba(255, 255, 255, 0.03)"
  surface-glass-hover: "rgba(255, 255, 255, 0.05)"
  surface-elevated: "rgba(0, 0, 0, 0.4)"
  on-primary: "#0b0c10"
  on-dark: "#ffffff"
  accent-pink: "#f9a8d4"
  accent-purple: "#c084fc"
  accent-blue: "#93c5fd"
  accent-green: "#86efac"
  premium-gold: "#FFD700"
  discord-blurple: "#5865F2"
  discord-blurple-hover: "#4752C4"

typography:
  display-xl:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 1px
  display-lg:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.5px
  display-md:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  display-sm:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0
  title-lg:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  title-md:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  label-uppercase:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 1.5px
  body-md:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 300
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 14px
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 12px
    fontWeight: 300
    lineHeight: 1.4
    letterSpacing: 0.5px
  button:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.5px
  nav-link:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0

rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  full: 9999px

spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px

components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
    height: 48px
  button-discord:
    backgroundColor: "{colors.discord-blurple}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: 12px 24px
    height: 48px
  sidebar-nav:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    width: 256px
  top-header:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.on-dark}"
    height: 80px
  telemetry-card:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.on-dark}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.xl}"
    padding: 24px
    border: "1px solid {colors.hairline}"
  module-status-card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-md}"
    rounded: "{rounded.lg}"
    padding: 20px
  economy-vault-badge:
    backgroundColor: "rgba(0, 0, 0, 0.4)"
    textColor: "{colors.body-strong}"
    typography: "{typography.body-sm}"
    rounded: "{rounded.full}"
    padding: 8px 16px
  premium-alert-embed:
    backgroundColor: "{colors.canvas}"
    borderColor: "{colors.premium-gold}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.md}"
---

## Overview

Permukaan visual Naura Hoshino adalah kanvas gelap intergalaksi (`{colors.canvas}`, #000c10) yang dipadukan dengan gradien radial halus. Berbeda dengan antarmuka solid tradisional, sistem ini sangat bergantung pada **Glassmorphism**, panel-panel semi-transparan yang membiarkan latar belakang tembus pandang dengan efek blur tebal. Identitas *brand* disampaikan melalui tipografi bercahaya (*text-glow*), indikator status neon, dan batas (*borders*) pastel yang merespons interaksi kursor pengguna.

**Elemen Kunci:**
- Kanvas bertekstur gelap (`{colors.canvas}`) dengan pencahayaan radial *pink* dan *purple* statis di sudut halaman.
- Tipografi hibrida: **Orbitron** secara eksklusif untuk angka telemetri, nama bot, dan metrik sistem. **Outfit** untuk antarmuka pengguna yang ramah, bersih, dan mudah dibaca (body text, menu, tombol).
- Efek pendaran (`text-glow`) pada *headline* utama menggunakan turunan warna `{colors.primary-glow}` untuk memberikan nuansa "Sistem Aktif" layaknya hologram *cybernetic*.
- Sudut melengkung yang sangat organik. Hampir semua kartu memiliki *border-radius* tinggi (`{rounded.xl}` atau `{rounded.xxl}`) untuk melembutkan tampilan sistem yang sangat teknis.
- Pengkategorian warna fungsional: *Pink* untuk Latensi, *Purple* untuk Jaringan Server, *Blue* untuk Pengguna, dan *Green* untuk *Uptime* / Status Aktif. 

## Colors

### Brand & Accent
- **Primary / Pink Pastel** (`{colors.primary}`, #FFB6C1): Identitas inti Naura. Digunakan pada *border* antarmuka kaca, efek cahaya teks, dan pendaran ikon utama.
- **Premium Gold** (`{colors.premium-gold}`, #FFD700): Eksklusif digunakan untuk sistem monetisasi, tanda terima donasi Saweria, *trial VIP* Top.gg, dan sinkronisasi `economy_wallet`.
- **Discord Blurple** (`{colors.discord-blurple}`, #5865F2): Khusus digunakan pada tombol otentikasi OAuth2 dan tautan keluar menuju platform Discord.

### Telemetry Accents
- **Accent Pink** (`{colors.accent-pink}`): Metrik inti, ping, latensi API.
- **Accent Purple** (`{colors.accent-purple}`): Skala jaringan (Guild Networks), modul Vault.
- **Accent Blue** (`{colors.accent-blue}`): Demografi pengguna, ruang obrolan (*private rooms*).
- **Accent Green** (`{colors.accent-green}`): *System Uptime*, modul audio Lavalink yang sedang memutar musik.

### Surface & Depth
- **Canvas** (`{colors.canvas}`, #0b0c10): Latar belakang terdalam. Hitam dengan sedikit saturasi biru tua/ungu untuk mencegah kontras buta warna.
- **Surface Glass** (`{colors.surface-glass}`, rgba(255,255,255,0.03)): Bahan bangunan utama untuk panel dasbor. Digabungkan dengan filter `blur(16px)` di CSS.
- **Surface Elevated** (`{colors.surface-elevated}`, rgba(0,0,0,0.4)): Latar belakang solid gelap untuk elemen bersarang di dalam panel kaca (seperti *card* status modul aktif).

### Hairlines & Borders
- **Hairline** (`{colors.hairline}`, rgba(255,182,193,0.15)): Garis tepi default untuk semua panel kaca untuk memberikan ilusi ketebalan layar.

## Typography

### Font Family
**Orbitron** bertindak sebagai "suara mesin" (angka latensi, total server, nama sistem). **Outfit** bertindak sebagai "suara asisten" (deskripsi, tombol navigasi, petunjuk). Keduanya disajikan via Google Fonts. 

### Hierarchy

| Token | Size | Weight | Line Height | Letter Spacing | Use |
|---|---|---|---|---|---|
| `{typography.display-xl}` | 48px | 700 (Bold) | 1.1 | 1px | Angka metrik utama (Ping, Server, Users) dalam Orbitron |
| `{typography.title-lg}` | 24px | 700 (Bold) | 1.3 | 0 | Judul bagian ("Real-time Telemetry") dalam Outfit |
| `{typography.title-md}` | 18px | 500 (Medium)| 1.4 | 0 | Nama modul ("Audio Core", "Economy Vault") |
| `{typography.label-uppercase}` | 12px | 700 (Bold) | 1.3 | 1.5px | Indikator *badge* ("Verified Network", status "Active") |
| `{typography.body-md}` | 16px | 300 (Light) | 1.6 | 0 | Teks paragraf utama, deskripsi panel |
| `{typography.nav-link}` | 16px | 500 (Medium)| 1.4 | 0 | Tautan *Sidebar* (System Overview, Audio Settings) |

### Principles
Tipografi telemetri selalu berada dalam status *glow* jika menyangkut informasi esensial. Warna *font* tidak selalu murni putih; teks sekunder menggunakan `{colors.body}` (#9ca3af) untuk menghindari kelelahan mata pengguna saat memantau dasbor dalam kondisi gelap.

## Layout

### Spacing System
- **Grid Telemetri:** Grid 4-kolom (`grid-cols-4`) di *desktop*, menyusut menjadi 2-kolom di tablet, dan 1-kolom di *mobile*.
- **Padding internal Panel:** Seragam pada `{spacing.lg}` (24px) untuk panel utama, memberikan ruang napas (*breathing room*) antara batas kaca dan konten data.

### Container & Sidebar
- Dasbor menggunakan pendekatan tata letak `flex h-screen` (mengisi penuh layar tanpa *scrolling* badan utama).
- **Sidebar Kiri:** Lebar statis 256px (`w-64`), berisi navigasi modul. Relatif pada layar besar, namun menjadi absolut dengan *slide-transition* pada seluler.
- **Header Atas:** Tinggi statis 80px, berisi Avatar bot, status inti (*Core Online*), dan lencana sinkronisasi `economy_wallet`.

## Elevation & Depth

| Level | Treatment | Use |
|---|---|---|
| Flat | Latar belakang murni, tanpa efek | Kanvas utama |
| Glass Panel | `backdrop-filter: blur(16px)` + `border 1px` pastel | Struktur panel utama, navigasi samping, *header* |
| Inner Card | `background: rgba(0,0,0,0.4)` + `border` putih tipis | Modul aktif di dalam panel utama |
| Glow Effect | `text-shadow: 0 0 10px rgba(255, 182, 193, 0.6)` | Teks nama bot, ikon pendaran aksen |

Sistem ini tidak menggunakan bayangan abu-abu solid (*drop shadows* klasik). Kedalaman diciptakan dari seberapa buram konten latar belakang yang ditutupi oleh panel kaca (Glassmorphism). Saat digulir, gradien latar belakang akan terlihat bergerak di bawah panel.

## Shapes

### Border Radius Scale

| Token | Value | Use |
|---|---|---|
| `{rounded.none}` | 0px | Tidak direkomendasikan dalam sistem Naura. |
| `{rounded.sm}` | 6px | Elemen interaktif kecil, *badge* status aktif hijau. |
| `{rounded.lg}` | 12px | Tombol otentikasi Discord, menu *sidebar* saat *hover*. |
| `{rounded.xl}` | 16px | Kartu Modul aktif dalam antarmuka bersarang. |
| `{rounded.xxl}` | 24px | *Container* telemetri utama. Menciptakan ilusi "gelembung kaca". |
| `{rounded.full}` | 9999px | Avatar bot profil bulat, *badge* dompet ekonomi *global*. |

Bentuk secara keseluruhan harus terasa ergonomis, ramah, dan sangat *fluid*. Sudut tajam dihilangkan untuk memberikan kesan bahwa ini adalah asisten, bukan dasbor *server* militer kuno.

## Components

### Navigation & Layout Containers

**`sidebar-nav`**, Panel kaca di sisi kiri (`w-64`) dengan garis tepi kanan tipis `{colors.hairline}`. Memuat *header* tulisan "NAURA OS" dengan teks gradien. Tautan navigasi (`<nav>`) merespons saat di-*hover* dengan mengubah latar belakang dari transparan menjadi `rgba(255,255,255,0.05)`. Di bagian bawah, tombol OAuth2 Discord selalu menetap.

**`top-header`**, Bertindak sebagai atap dasbor. Memiliki tombol menu *hamburger* pada ukuran seluler. Memuat cincin *pink* bercahaya di sekitar avatar bot. Menampilkan indikator denyut animasi (*animate-pulse*) berwarna hijau untuk menandakan bahwa Websocket Node.js aktif tersambung.

### Telemetry & Data Representation

**`telemetry-card`**, Struktur *glassmorphism* untuk menampilkan angka *real-time*. Dilengkapi pita warna tebal di sisi kiri (`border-l-4`) yang mendefinisikan jenis data (Pink untuk Ping, Purple untuk Server). Sebuah ikon FontAwesome raksasa ditempatkan di sudut kanan bawah dengan opasitas sangat rendah (5%) yang membesar perlahan ketika kursor mengarah pada kartu (*group-hover:scale-110*).

**`module-status-card`**, Panel solid hitam/transparan yang bersarang di dalam panel antarmuka utama. Digunakan untuk merinci fitur-fitur seperti sistem musik Lavalink, Private Voice Rooms, dan Economy Vault yang terikat pada struktur data `economy_wallet`. Dilengkapi *badge* status dengan pinggiran hijau yang bersinar kecil.

### Integrations & Webhooks

**`premium-alert-embed`**, Meskipun dirender via Discord API alih-alih HTML (via *userObj.send*), struktur desain integrasi Webhook Saweria dan Top.gg menggunakan identitas Naura. Embed menggunakan *hex color* `#FFD700` (Emas Premium) dengan judul tebal dan parameter temporal yang presisi (menggunakan sinkronisasi cap waktu bawaan `<t:UNIX:R>`).

## Do's and Don'ts

### Do
- Gunakan arsitektur warna **Glassmorphism** dengan paduan *backdrop-filter*. Biarkan latar belakang gradien terlihat samar di baliknya.
- Pasangkan angka metrik (*stats*) secara konsisten dengan **Orbitron**, dan pastikan teks penjelas/paragraf menggunakan **Outfit**.
- Sediakan animasi interaktif halus seperti *pulse* pada lencana "Online" atau transisi transparan pada penunjuk tetikus untuk menghidupkan elemen UI.
- Satukan penyebutan mata uang ekonomi internal di bawah nomenklatur `economy_wallet` pada seluruh visual matriks dasbor agar seragam dengan fungsi subkomando *backend*.
- Berikan jarak navigasi yang leluasa (`{spacing.md}` ke atas) agar elemen tidak terlihat bertabrakan satu sama lain di ukuran seluler.

### Don't
- Dilarang keras menempatkan warna solid pekat (*opaque*) sebagai latar belakang kartu telemetri utama. Itu akan menghancurkan estetika dasar *glassmorphism*.
- Jangan menggunakan *font* bertipe serif (Times New Roman, Garamond) pada dasbor Naura OS; ini akan merusak identitas *cybernetic* & masa depannya.
- Jangan terapkan radius `0px` pada pinggiran kartu. Estetika Naura ditandai dengan fluiditas layar, minimal `{rounded.lg}`.
- Jangan gabungkan logika antarmuka Webhook secara terpisah dari *port* pendengar Express utama untuk memelihara skalabilitas *Naura OS*.

## Responsive Behavior

### Breakpoints & Collapsing Strategy

| Name | Width | Key Changes |
|---|---|---|
| Mobile | < 768px | Navigasi samping ditutup di luar layar (`-translate-x-full`); tombol *hamburger* dimunculkan; semua grid telemetri berubah menjadi susunan vertikal `grid-cols-1`. |
| Tablet | 768–1024px | Matriks kartu telemetri beralih menjadi 2 kolom (`grid-cols-2`). Cukup ruang untuk bernapas tanpa membuat elemen terjepit. |
| Desktop | > 1024px | *Sidebar* terkunci dalam posisi terbuka (relatif tanpa tumpang tindih); seluruh baris metrik menggunakan susunan 4 kolom (`grid-cols-4`). Lencana dompet global di *header* mulai dimunculkan. |

### Transisi Modul
Saat navigasi *hamburger* ditekan pada *mobile*, sistem CSS mengeksekusi kelas utilitas `transform` yang digabungkan dengan durasi transisi `300ms` dan pengaturan kurva kemudahan (*ease-in-out*), menciptakan pergerakan menu luncur modern yang menutupi *z-index* lapisan layar utama dengan anggun.