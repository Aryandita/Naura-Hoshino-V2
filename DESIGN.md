---
version: 1.1.0-naura-os
name: Naura Hoshino OS
description: Antarmuka sistem kontrol Naura OS dengan tema cyber-anime yang ditambatkan pada kanvas gelap pekat bernuansa luar angkasa. Brand ini tidak mengandalkan elemen datar tradisional, energinya berasal dari efek glassmorphism (panel kaca transparan), pendaran neon (neon glows) bernuansa pink dan ungu pastel, serta tipografi futuristik Orbitron untuk data real-time. Antarmuka terasa dinamis, sangat responsif, dan mencerminkan presisi sistem bot Discord modern tanpa kehilangan estetika ramah dari karakter Naura. Sejak versi 1.1.0, brand ini memiliki sub-brand resmi bernama Naura Wilds yang membungkus seluruh antarmuka sistem Survival RPG dengan lapisan palet earth-tone (emerald, amber, moss) di atas fondasi glassmorphism yang sama.

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

  # --- Naura Wilds (Survival Sub-Brand) ---
  wilds-emerald: "#86EFAC"
  wilds-moss: "#34D399"
  wilds-amber: "#FBBF24"
  wilds-bark: "#92400E"
  wilds-river: "#7DD3FC"
  wilds-danger: "#F87171"
  surface-glass-wilds: "rgba(134, 239, 172, 0.06)"
  hairline-wilds: "rgba(134, 239, 172, 0.2)"

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
  bottom-nav-mobile:
    backgroundColor: "{colors.surface-glass}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.muted}"
    activeTextColor: "{colors.primary}"
    activeIndicatorColor: "{colors.primary-glow}"
    height: 64px
    rounded: "{rounded.xxl}"
    padding: 8px 16px
  empty-state-card:
    backgroundColor: "{colors.surface-glass}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.body-strong}"
    rounded: "{rounded.xl}"
    padding: 24px
  timeline-step-indicator:
    activeColor: "{colors.primary}"
    completedColor: "{colors.accent-green}"
    inactiveColor: "{colors.muted}"
    lineColor: "{colors.hairline-strong}"
  numeric-quick-chip:
    backgroundColor: "{colors.surface-glass-hover}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.primary}"
    rounded: "{rounded.md}"
    padding: 6px 12px
    height: 32px

  # --- Naura Wilds (Survival Sub-Brand) ---
  wilds-hud-container:
    backgroundColor: "{colors.surface-glass-wilds}"
    borderColor: "{colors.hairline-wilds}"
    textColor: "{colors.on-dark}"
    accentColor: "{colors.wilds-emerald}"
    rounded: "{rounded.xxl}"
    padding: 24px
  wilds-status-vital-card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.body-strong}"
    healthyColor: "{colors.wilds-moss}"
    warningColor: "{colors.wilds-amber}"
    criticalColor: "{colors.wilds-danger}"
    rounded: "{rounded.lg}"
    padding: 12px
  wilds-inventory-item-card:
    backgroundColor: "{colors.surface-glass-wilds}"
    borderColor: "{colors.hairline-wilds}"
    textColor: "{colors.body-strong}"
    rarityPillRounded: "{rounded.full}"
    rounded: "{rounded.xl}"
    padding: 16px
  wilds-quest-timeline:
    activeColor: "{colors.wilds-emerald}"
    completedColor: "{colors.accent-green}"
    lockedColor: "{colors.muted}"
    lineColor: "{colors.hairline-wilds}"
  wilds-battle-panel:
    backgroundColor: "{colors.surface-elevated}"
    borderColor: "{colors.wilds-danger}"
    textColor: "{colors.on-dark}"
    rounded: "{rounded.xl}"
    padding: 20px
---

## Overview

Permukaan visual Naura Hoshino adalah kanvas gelap intergalaksi (`{colors.canvas}`, #000c10) yang dipadukan dengan gradien radial halus. Berbeda dengan antarmuka solid tradisional, sistem ini sangat bergantung pada **Glassmorphism**, panel-panel semi-transparan yang membiarkan latar belakang tembus pandang dengan efek blur tebal. Identitas _brand_ disampaikan melalui tipografi bercahaya (_text-glow_), indikator status neon, dan batas (_borders_) pastel yang merespons interaksi kursor pengguna.

**Elemen Kunci:**

- Kanvas bertekstur gelap (`{colors.canvas}`) dengan pencahayaan radial _pink_ dan _purple_ statis di sudut halaman.
- Tipografi hibrida: **Orbitron** secara eksklusif untuk angka telemetri, nama bot, dan metrik sistem. **Outfit** untuk antarmuka pengguna yang ramah, bersih, dan mudah dibaca (body text, menu, tombol).
- Efek pendaran (`text-glow`) pada _headline_ utama menggunakan turunan warna `{colors.primary-glow}` untuk memberikan nuansa "Sistem Aktif" layaknya hologram _cybernetic_.
- Sudut melengkung yang sangat organik. Hampir semua kartu memiliki _border-radius_ tinggi (`{rounded.xl}` atau `{rounded.xxl}`) untuk melembutkan tampilan sistem yang sangat teknis.
- Pengkategorian warna fungsional: _Pink_ untuk Latensi, _Purple_ untuk Jaringan Server, _Blue_ untuk Pengguna, dan _Green_ untuk _Uptime_ / Status Aktif.

## Colors

### Brand & Accent

- **Primary / Pink Pastel** (`{colors.primary}`, #FFB6C1): Identitas inti Naura. Digunakan pada _border_ antarmuka kaca, efek cahaya teks, dan pendaran ikon utama.
- **Premium Gold** (`{colors.premium-gold}`, #FFD700): Eksklusif digunakan untuk sistem monetisasi, tanda terima donasi Saweria, _trial VIP_ Top.gg, dan sinkronisasi `economy_wallet`.
- **Discord Blurple** (`{colors.discord-blurple}`, #5865F2): Khusus digunakan pada tombol otentikasi OAuth2 dan tautan keluar menuju platform Discord.

### Telemetry Accents

- **Accent Pink** (`{colors.accent-pink}`): Metrik inti, ping, latensi API.
- **Accent Purple** (`{colors.accent-purple}`): Skala jaringan (Guild Networks), modul Vault.
- **Accent Blue** (`{colors.accent-blue}`): Demografi pengguna, ruang obrolan (_private rooms_).
- **Accent Green** (`{colors.accent-green}`): _System Uptime_, modul audio Lavalink yang sedang memutar musik.

### Surface & Depth

- **Canvas** (`{colors.canvas}`, #0b0c10): Latar belakang terdalam. Hitam dengan sedikit saturasi biru tua/ungu untuk mencegah kontras buta warna.
- **Surface Glass** (`{colors.surface-glass}`, rgba(255,255,255,0.03)): Bahan bangunan utama untuk panel dasbor. Digabungkan dengan filter `blur(16px)` di CSS.
- **Surface Elevated** (`{colors.surface-elevated}`, rgba(0,0,0,0.4)): Latar belakang solid gelap untuk elemen bersarang di dalam panel kaca (seperti _card_ status modul aktif).

### Hairlines & Borders

- **Hairline** (`{colors.hairline}`, rgba(255,182,193,0.15)): Garis tepi default untuk semua panel kaca untuk memberikan ilusi ketebalan layar.

## Typography

### Font Family

**Orbitron** bertindak sebagai "suara mesin" (angka latensi, total server, nama sistem). **Outfit** bertindak sebagai "suara asisten" (deskripsi, tombol navigasi, petunjuk). Keduanya disajikan via Google Fonts.

### Hierarchy

| Token                          | Size | Weight       | Line Height | Letter Spacing | Use                                                     |
| ------------------------------ | ---- | ------------ | ----------- | -------------- | ------------------------------------------------------- |
| `{typography.display-xl}`      | 48px | 700 (Bold)   | 1.1         | 1px            | Angka metrik utama (Ping, Server, Users) dalam Orbitron |
| `{typography.title-lg}`        | 24px | 700 (Bold)   | 1.3         | 0              | Judul bagian ("Real-time Telemetry") dalam Outfit       |
| `{typography.title-md}`        | 18px | 500 (Medium) | 1.4         | 0              | Nama modul ("Audio Core", "Economy Vault")              |
| `{typography.label-uppercase}` | 12px | 700 (Bold)   | 1.3         | 1.5px          | Indikator _badge_ ("Verified Network", status "Active") |
| `{typography.body-md}`         | 16px | 300 (Light)  | 1.6         | 0              | Teks paragraf utama, deskripsi panel                    |
| `{typography.nav-link}`        | 16px | 500 (Medium) | 1.4         | 0              | Tautan _Sidebar_ (System Overview, Audio Settings)      |

### Principles

Tipografi telemetri selalu berada dalam status _glow_ jika menyangkut informasi esensial. Warna _font_ tidak selalu murni putih; teks sekunder menggunakan `{colors.body}` (#9ca3af) untuk menghindari kelelahan mata pengguna saat memantau dasbor dalam kondisi gelap.

## Layout

### Spacing System

- **Grid Telemetri:** Grid 4-kolom (`grid-cols-4`) di _desktop_, menyusut menjadi 2-kolom di tablet, dan 1-kolom di _mobile_.
- **Padding internal Panel:** Seragam pada `{spacing.lg}` (24px) untuk panel utama, memberikan ruang napas (_breathing room_) antara batas kaca dan konten data.

### Container & Sidebar

- Dasbor menggunakan pendekatan tata letak `flex h-screen` (mengisi penuh layar tanpa _scrolling_ badan utama).
- **Sidebar Kiri:** Lebar statis 256px (`w-64`), berisi navigasi modul. Relatif pada layar besar, namun menjadi absolut dengan _slide-transition_ pada seluler.
- **Header Atas:** Tinggi statis 80px, berisi Avatar bot, status inti (_Core Online_), dan lencana sinkronisasi `economy_wallet`.

## Elevation & Depth

| Level       | Treatment                                            | Use                                              |
| ----------- | ---------------------------------------------------- | ------------------------------------------------ |
| Flat        | Latar belakang murni, tanpa efek                     | Kanvas utama                                     |
| Glass Panel | `backdrop-filter: blur(16px)` + `border 1px` pastel  | Struktur panel utama, navigasi samping, _header_ |
| Inner Card  | `background: rgba(0,0,0,0.4)` + `border` putih tipis | Modul aktif di dalam panel utama                 |
| Glow Effect | `text-shadow: 0 0 10px rgba(255, 182, 193, 0.6)`     | Teks nama bot, ikon pendaran aksen               |

Sistem ini tidak menggunakan bayangan abu-abu solid (_drop shadows_ klasik). Kedalaman diciptakan dari seberapa buram konten latar belakang yang ditutupi oleh panel kaca (Glassmorphism). Saat digulir, gradien latar belakang akan terlihat bergerak di bawah panel.

## Shapes

### Border Radius Scale

| Token            | Value  | Use                                                              |
| ---------------- | ------ | ---------------------------------------------------------------- |
| `{rounded.none}` | 0px    | Tidak direkomendasikan dalam sistem Naura.                       |
| `{rounded.sm}`   | 6px    | Elemen interaktif kecil, _badge_ status aktif hijau.             |
| `{rounded.lg}`   | 12px   | Tombol otentikasi Discord, menu _sidebar_ saat _hover_.          |
| `{rounded.xl}`   | 16px   | Kartu Modul aktif dalam antarmuka bersarang.                     |
| `{rounded.xxl}`  | 24px   | _Container_ telemetri utama. Menciptakan ilusi "gelembung kaca". |
| `{rounded.full}` | 9999px | Avatar bot profil bulat, _badge_ dompet ekonomi _global_.        |

Bentuk secara keseluruhan harus terasa ergonomis, ramah, dan sangat _fluid_. Sudut tajam dihilangkan untuk memberikan kesan bahwa ini adalah asisten, bukan dasbor _server_ militer kuno.

## Components

### Navigation & Layout Containers

**`sidebar-nav`**, Panel kaca di sisi kiri (`w-64`) dengan garis tepi kanan tipis `{colors.hairline}`. Memuat _header_ tulisan "NAURA OS" dengan teks gradien. Tautan navigasi (`<nav>`) merespons saat di-_hover_ dengan mengubah latar belakang dari transparan menjadi `rgba(255,255,255,0.05)`. Di bagian bawah, tombol OAuth2 Discord selalu menetap.

**`top-header`**, Bertindak sebagai atap dasbor. Memiliki tombol menu _hamburger_ pada ukuran seluler. Memuat cincin _pink_ bercahaya di sekitar avatar bot. Menampilkan indikator denyut animasi (_animate-pulse_) berwarna hijau untuk menandakan bahwa Websocket Node.js aktif tersambung.

### Telemetry & Data Representation

**`telemetry-card`**, Struktur _glassmorphism_ untuk menampilkan angka _real-time_. Dilengkapi pita warna tebal di sisi kiri (`border-l-4`) yang mendefinisikan jenis data (Pink untuk Ping, Purple untuk Server). Sebuah ikon FontAwesome raksasa ditempatkan di sudut kanan bawah dengan opasitas sangat rendah (5%) yang membesar perlahan ketika kursor mengarah pada kartu (_group-hover:scale-110_).

**`module-status-card`**, Panel solid hitam/transparan yang bersarang di dalam panel antarmuka utama. Digunakan untuk merinci fitur-fitur seperti sistem musik Lavalink, Private Voice Rooms, dan Economy Vault yang terikat pada struktur data `economy_wallet`. Dilengkapi _badge_ status dengan pinggiran hijau yang bersinar kecil.

### Integrations & Webhooks

**`premium-alert-embed`**, Meskipun dirender via Discord API alih-alih HTML (via _userObj.send_), struktur desain integrasi Webhook Saweria dan Top.gg menggunakan identitas Naura. Embed menggunakan _hex color_ `#FFD700` (Emas Premium) dengan judul tebal dan parameter temporal yang presisi (menggunakan sinkronisasi cap waktu bawaan `<t:UNIX:R>`).

## Do's and Don'ts

### Do

- Gunakan arsitektur warna **Glassmorphism** dengan paduan _backdrop-filter_. Biarkan latar belakang gradien terlihat samar di baliknya.
- Pasangkan angka metrik (_stats_) secara konsisten dengan **Orbitron**, dan pastikan teks penjelas/paragraf menggunakan **Outfit**.
- Sediakan animasi interaktif halus seperti _pulse_ pada lencana "Online" atau transisi transparan pada penunjuk tetikus untuk menghidupkan elemen UI.
- Satukan penyebutan mata uang ekonomi internal di bawah nomenklatur `economy_wallet` pada seluruh visual matriks dasbor agar seragam dengan fungsi subkomando _backend_.
- Berikan jarak navigasi yang leluasa (`{spacing.md}` ke atas) agar elemen tidak terlihat bertabrakan satu sama lain di ukuran seluler.

### Don't

- Dilarang keras menempatkan warna solid pekat (_opaque_) sebagai latar belakang kartu telemetri utama. Itu akan menghancurkan estetika dasar _glassmorphism_.
- Jangan menggunakan _font_ bertipe serif (Times New Roman, Garamond) pada dasbor Naura OS; ini akan merusak identitas _cybernetic_ & masa depannya.
- Jangan terapkan radius `0px` pada pinggiran kartu. Estetika Naura ditandai dengan fluiditas layar, minimal `{rounded.lg}`.
- Jangan gabungkan logika antarmuka Webhook secara terpisah dari _port_ pendengar Express utama untuk memelihara skalabilitas _Naura OS_.

## Responsive Behavior

### Breakpoints & Collapsing Strategy

| Name    | Width      | Key Changes                                                                                                                                                                                    |
| ------- | ---------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Mobile  | < 768px    | Navigasi samping ditutup di luar layar (`-translate-x-full`); tombol _hamburger_ dimunculkan; semua grid telemetri berubah menjadi susunan vertikal `grid-cols-1`.                             |
| Tablet  | 768–1024px | Matriks kartu telemetri beralih menjadi 2 kolom (`grid-cols-2`). Cukup ruang untuk bernapas tanpa membuat elemen terjepit.                                                                     |
| Desktop | > 1024px   | _Sidebar_ terkunci dalam posisi terbuka (relatif tanpa tumpang tindih); seluruh baris metrik menggunakan susunan 4 kolom (`grid-cols-4`). Lencana dompet global di _header_ mulai dimunculkan. |

### Transisi Modul

Saat navigasi _hamburger_ ditekan pada _mobile_, sistem CSS mengeksekusi kelas utilitas `transform` yang digabungkan dengan durasi transisi `300ms` dan pengaturan kurva kemudahan (_ease-in-out_), menciptakan pergerakan menu luncur modern yang menutupi _z-index_ lapisan layar utama dengan anggun.

---

## Dashboard V2: Arsitektur Aset & Build Mandiri

Dashboard V2 (`dashboard-v2/`, frontend Vite MPA yang dilayani Express di subpath `/v2`) kini **mandiri dari dashboard lama**: seluruh CSS, ikon, dan utilitas UI dibundel sendiri, tanpa Tailwind CDN maupun aset statis dari `dashboard/public`.

### Sumber Token & Entry CSS Tunggal

| Berkas                           | Peran                                                                                                                      |
| -------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `dashboard-v2/src/css/input.css` | Satu-satunya entry CSS. Urutan import wajib: Google Fonts -> `tailwindcss` -> Font Awesome -> `style.css` -> `tokens.css`. |
| `src/css/style.css`              | Gaya dasar glassmorphism warisan (salinan mandiri dari dashboard lama).                                                    |
| `src/css/tokens.css`             | Override warna agar selaras `src/config/ui.js`; muat SETELAH style.css.                                                    |

- **Tailwind v4 via CLI, bukan plugin Vite.** Plugin `@tailwindcss/vite` bertabrakan dengan `<style>` inline di halaman MPA ini; build memakai `@tailwindcss/cli` (`npm run build:css`) menghasilkan `public/vendor/tailwind-built.css`.
- **Theme token v4** didefinisikan di blok `@theme` input.css: `--font-cyber` (Orbitron), `--font-outfit`, `--color-primary`, `--color-accent-pink/purple/cyan/emerald`, `--color-premium-gold`, `--color-dark-*`. Class yang sah: `font-cyber`, `text-primary`, `border-accent-pink`, `bg-dark-card`, dst.
- **Font Awesome self-host** lewat package `@fortawesome/fontawesome-free` yang di-import di input.css; webfont ikut dibundel Vite. Dilarang memakai CDN font-awesome lagi.
- **Socket.IO client** dimuat dari `public/vendor/socket.io.min.js` (salinan UMD dari package `socket.io` server agar versi selalu cocok). Jangan ganti ke CDN.
- **Chart.js** dibundel sebagai dependency dan diekspos ke script inline warisan lewat `src/lib/chart-shim.js` (`window.Chart`). Semua pemakaian wajib tetap di-guard `typeof Chart !== 'undefined'`.
- **naura-ui.js versi global** untuk script inline halaman ada di `public/vendor/naura-ui.js`; berkas `src/naura-ui.js` yang ESM hanya untuk komponen `NauraViewer`.

### Aturan Halaman Baru

1. Tambahkan entry HTML baru ke `rollupOptions.input` di `dashboard-v2/vite.config.js`.
2. Head minimal: satu `<link rel="stylesheet" href="/vendor/tailwind-built.css">`, `<script src="/vendor/socket.io.min.js">` bila perlu realtime, `<script src="/vendor/naura-ui.js">`, dan minimal satu `<script type="module">`.
3. Dilarang menyisipkan CDN eksternal baru (Tailwind, Font Awesome, Chart.js); gunakan dependency bundler atau vendor lokal.
4. Build produksi WAJIB lewat `npm run dashboard:build` (wrapper `scripts/build-dashboard-v2.js`) karena path proyek mengandung spasi dan memicu bug `html-inline-proxy` Vite; wrapper menyalin sumber ke folder build tanpa spasi di `%TEMP%` sebelum menjalankan Vite.

---

## UX Psychology & Emotional Persona Guidelines

Sistem antarmuka Naura Hoshino V2 memadukan estetika Cyber-Anime Glassmorphism dengan **6 Prinsip Psikologi UX** untuk menciptakan interaksi yang adiktif, intuitif, dan bermakna secara emosional.

### 1. Decision Fatigue & Smart Defaults (Hick's Law)

- **Rekomendasi Cerdas:** Setiap kali menyajikan daftar pilihan (menu atau tombol), tandai opsi terbaik dengan lencana `⭐ Rekomendasi Naura` menggunakan gaya Primary Pink Glow.
- **Progressive Disclosure:** Tampilkan maksimal 3 sampai 4 aksi vital di tampilan utama. Fitur lanjutan atau opsi tambahan disembunyikan dalam sub-menu kontekstual.

### 2. Goal Gradient Effect (Artificial Head Start)

- **Momentum Awal:** Onboarding, quest pemula, dan level progress tidak pernah dimulai dari 0%. Berikan dorongan awal (misal: Starter Kit langsung terisi 20%).
- **Kawaii Progress Bar:** Gunakan visual progress `[▰▰▰▱▱▱▱] 40%` yang disertai pesan penyemangat dinamis menyebut nama pengguna:
  > _"Tinggal 60 XP lagi lho! Semangat ya, Kak {displayName}~ ✨"_

### 3. Reciprocity (The Gift / Value-First Principle)

- **Instant Delight:** Berikan kegembiraan atau fungsi instan pada interaksi pertama (rekomendasi lagu, bonus sambutan, ramalan harian) sebelum meminta input atau konfigurasi lanjutan.
- **Surprise Care Gifts:** Hadiah kejutan kecil secara berkala saat pengguna berinteraksi aktif dengan Naura.

### 4. The IKEA Effect & Endowment Effect (Personalization)

- **Kepemilikan Emosional:** Berikan kebebasan kustomisasi kartu profil (warna aksen, background canvas, gelar kustom, nama virtual pet, dan preferensi persona AI).
- **Apresiasi Personal:** Naura selalu memberikan apresiasi hangat saat pengguna mengubah tampilan atau menyelesaikan karya:
  > _"Wah, selera Kak {displayName} bagus banget! Kartu profilmu sekarang jadi makin estetik~ 💕"_

### 5. Anchoring & Contrast Effect (Visual Hierarchy)

- **Hierarki Aksi Kontras:** Maksimal 1 tombol Primary (Pink/Blurple) per baris aksi (`ActionRow`). Tombol sekunder memakai warna netral, dan tombol destruktif memakai merah kontras.
- **Price Anchoring di Shop:** Tampilkan perbandingan nilai secara transparan, menonjolkan keuntungan bundle hemat (`[HEMAT 25%]`).

### 6. Peak-End Rule & Expressive Persona Feedback

- **Respons Dinamis & Ramah:** Respon error, cooldown, atau rate-limit disampaikan dengan gaya anime yang ekspresif dan peduli (tsundere/kuudere ceria), bukan teks terminal kaku:
  > _"B-Bukan karena aku cerewet ya, Kak {displayName}... tapi istirahat dulu sebentar sebelum coba lagi! 🌸"_
- **Penyebutan Nama Personal:** Hindari kata panggilan kaku atau generik seperti "Master". Selalu gunakan `{displayName}` atau `{username}` pengguna agar interaksi terasa dekat, hangat, dan nyata.

---

## 🎨 UI/UX Masterclass & Design System Guidelines

Sistem antarmuka Naura Hoshino V2 mengintegrasikan 4 pilar teknik desain kelas industri (_UXpeak Design Masterclass_) yang dipadukan dengan estetika **Cyber-Anime Glassmorphism** dan **Psikologi UX**:

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                NAURA UI/UX MASTERCLASS FRAMEWORK                          │
├───────────────────────────────┬───────────────────────────────────────────────────────────┤
│ Pilar 1: Visual & Depth       │ Tinted Soft Shadows, Visual Cues & Information Priority   │
│ Pilar 2: Interaction & Flow   │ Selectable Cards, Low Interaction Cost & Active Empty State│
│ Pilar 3: Ergonomics & Timeline│ Context-Aware Numeric Inputs & Visual Step Timelines      │
│ Pilar 4: Mobile & Navigation  │ Floating Glass Bottom Nav, Thumb Zone & State Clarity     │
└───────────────────────────────┴───────────────────────────────────────────────────────────┘
```

---

### 🌟 Pilar 1: Visual Depth, Tinted Soft Shadows & Hierarchy

#### 1. Tinted Soft Shadows (Canvas & Glass Surfaces)

- **Aturan Utama:** Jangan pernah menggunakan bayangan hitam pekat (_pure opaque black drop shadows_ `rgba(0, 0, 0, 0.8)`).
- **Solusi Tinted Shadow:** Pada kanvas gelap luar angkasa (`#0B0C10`), gunakan bayangan lembut ber-radius difus besar yang di-_tint_ mengikuti warna latar dan pendaran aksen:
  - `box-shadow: 0 16px 32px -8px rgba(11, 12, 16, 0.7), 0 0 20px 2px rgba(255, 182, 193, 0.15)`
  - Pada Canvas Worker (`@napi-rs/canvas`): render bayangan ambient berlapis lembut sebelum menggambar panel kaca.

#### 2. Prioritas Informasi (Information Scannability)

- **Visual Cues:** Gunakan variasi _scale_, _weight_, warna aksen, dan ikon penjelas agar mata pengguna langsung tertuju pada data terpenting tanpa harus membaca seluruh teks.
- **Standar Tipografi:**
  - **Data & Angka Inti:** Orbitron (Bold 700, 24-48px) dengan efek _text-glow_.
  - **Label & Konteks:** Outfit (Medium 500 / Light 300, 12-16px) dengan warna _muted_ `#9CA3AF`.

#### 3. Asset & Imagery Quality

- Avatar, item sprite, dan banner wajib memiliki resolusi tajam, rasio aspek konsisten (1:1 untuk badge/avatar, 16:9 untuk banner), dan dipadukan dengan _inner hairline_ lembut `{colors.hairline}`.

---

### ⚡ Pilar 2: Efisiensi Interaksi & Ergonomi Layar

#### 1. Selectable Cards vs Plain Text Lists

- Hindari menyajikan informasi panjang dalam bentuk blok teks polos atau tabel ASCII yang membosankan.
- Bungkus opsi, status modul, dan item toko dalam bentuk **Selectable Cards** yang memuat:
  - Ikon kustom dari `ui.getEmoji()`.
  - Label judul tebal dan deskripsi ringkas 1 baris.
  - Status badge pill (`[Aktif]`, `[Level 5]`, `[500 Koin]`).

#### 2. Reducing Interaction Cost & Progressive Disclosure

- **1-Click Direct Exposure:** Tampilkan aksi dengan frekuensi tinggi (misal: panen, klaim harian, refresh) secara langsung di tampilan utama tanpa menyembunyikannya di dalam sub-menu berlapis.
- **Progressive Disclosure:** Hanya 3 sampai 4 opsi primer yang ditampilkan di layar utama; parameter lanjutan diletakkan pada tombol "Opsi Lanjutan" atau modal.

#### 3. Active Empty States as Growth Opportunities

- **Prinsip:** Layar kosong (inventori kosong, riwayat kosong, belum ada tiket) **bukanlah jalan buntu**, melainkan peluang untuk mengarahkan pengguna ke aksi berikutnya.
- **Standar Empty State Naura:**
  1. Tampilkan ekspresi persona Naura yang bersahabat (_Confused_ / _Encouraging_).
  2. Berikan pesan copywriting hangat yang memanggil nama pengguna (`{displayName}`).
  3. Sediakan tombol _Call-to-Action_ (CTA) instan:
     - _Contoh Inventori Kosong:_ `[🌾 Mulai Bertani]` `[🛒 Kunjungi Toko]` `[🎁 Klaim Starter]`
     - _Contoh Antrean Musik Kosong:_ `[🎵 Putar Rekomendasi Naura]` `[📻 Radio Anime]`

---

### 🛠️ Pilar 3: Pola Input Ergonomis, Timelines & Ritme Kategori

#### 1. Context-Aware Numeric Input Patterns

- **One-Time / Infrequent Setup (Onboarding/Config):** Gunakan slider visual atau select-menu dengan opsi terstruktur.
- **Frequent / Repeated Transactions (Bank, Transfer, Barter, Tempa):**
  - Sediakan **Quick-Preset Chips** berupa tombol kalkulasi cepat: `[10%]`, `[25%]`, `[50%]`, `[Semua / MAX]`, `[+100]`, `[+1K]`.
  - Hindari memaksa pengguna mengetik nominal angka panjang secara manual jika bisa diselesaikan dalam 1 klik.

#### 2. Visual Step Timelines & Human Connection

- Proses multi-langkah (`/setup`, `/ticket`, `/barter`, `/giveaway`) wajib divisualisasikan dengan linimasa horizontal terstruktur:
  `[1️⃣ Form Input] ──▶ [2️⃣ Konfirmasi Partner] ──▶ [3️⃣ Transaksi Selesai]`
- **Humanized Touchpoints:** Tampilkan avatar rekan transaksi, badge verifikasi keamanan, dan pesan penenang dari Naura di setiap fase aktif untuk membangun rasa percaya (_trust_).

#### 3. Categorical Color-Coding System

Setiap modul di Naura Hoshino memiliki aksen warna terstandarisasi untuk memudahkan pemindaian visual (_visual scanning rhythm_):

- **Core, Social & Identity:** Soft Primary Pink (`#FFB6C1`)
- **Music, Voice & Audio:** Sky Blue (`#93C5FD` / `#8A2BE2`)
- **Economy, Shop & VIP:** Rich Gold (`#FFD700`)
- **Survival RPG, Quest & Crafting:** Fresh Emerald Green (`#86EFAC`)
- **Admin, Governance & Setup:** Futuristic Purple (`#C084FC`)
- **Security, Softban & Emergency:** Vivid Ruby Red (`#F87171`)

---

### 📱 Pilar 4: Mobile Bottom Navigation Bar & Thumb Zone

#### 1. Thumb Zone Ergonomics

- Pada antarmuka Web Dashboard seluler dan Discord Mobile Client, letakkan tombol kontrol utama dan navigasi di area sepertiga bawah layar (_Natural Thumb Zone_).

#### 2. Floating Glass Bottom Navigation Bar

- **Spesifikasi Teknis:**
  - Komponen: `{components.bottom-nav-mobile}`
  - Posisi: `fixed bottom-4 inset-x-4 z-50` (mengambang di atas konten dengan margin 16px).
  - Material: `backdrop-filter: blur(16px)` dengan latar `rgba(11, 12, 16, 0.85)` dan border tipis `{colors.hairline}`.
  - Tinggi & Touch Area: Minimal 64px dengan area sentuh ikon minimal `48px x 48px`.
- **State Clarity:**
  - **Tab Aktif:** Ikon menyala warna `{colors.primary}` dengan _neon pill glow_ di latar belakang dan label teks tegas.
  - **Tab Inaktif:** Ikon warna `{colors.muted}` (#6B7280) tanpa pendaran.
  - **Micro-Interactions:** Transisi _spring animation_ halus (durasi 200ms) saat kursor menyentuh atau pengguna berpindah tab.
- **Navigasi Inti:**
  1. `[🏠 Beranda]` - Overview status & telemetri
  2. `[⚙️ Modul]` - Pengaturan server & bot
  3. `[📊 Rank]` - Leaderboard & level
  4. `[💎 VIP]` - Premium & monetisasi
  5. `[👤 Profil]` - Akun & kartu petualang

---

---

# 🌿 Survival RPG Design System - Naura Wilds

> **Sub-brand:** Naura Wilds · **Versi:** 1.0.0 · **Sumber kebenaran token:** `src/utils/survivalUIHelper.js`

Naura Wilds adalah sub-brand resmi untuk seluruh antarmuka sistem Survival RPG (`/survival`, `/gacha`, dungeon, coliseum, clan, pet, farming, crafting, cafe, bank, dan modul terkait di `plugin/survival/` serta `src/survival/`). Pendekatannya adalah **Hybrid Nature-Tech**: fondasi visual tetap Cyber-Anime Glassmorphism (kanvas gelap, panel kaca, tipografi Orbitron/Outfit), tetapi lapisan survival diberi identitas earth-tone tersendiri sehingga pemain langsung mengenali bahwa mereka sedang berada di "dunia liar" Naura tanpa merasa pindah aplikasi.

## Identitas Visual Hybrid Nature-Tech

- Material dasar tetap glassmorphism, namun panel survival memakai _tinted glass_ hijau (`{colors.surface-glass-wilds}`) dengan garis tepi `{colors.hairline-wilds}`.
- Latar belakang survival menambahkan cahaya radial hijau lumut yang samar di sudut bawah kanvas, berdampingan dengan pencahayaan pink/purple utama.
- Ikonografi memadukan emoji alam dan petualangan (🌿🌾🐟⛏️⚔️🐾) dengan ikon futuristik; seluruh emoji wajib terdaftar terpusat di `src/config/ui/`.
- Angka vital (HP, Stamina, Hunger, Damage, XP) tetap memakai **Orbitron** dengan efek glow halus. Narasi cerita, deskripsi quest, dan dialog NPC memakai **Outfit**.
- Struktur Container V2 tetap wajib mengikuti struktur 5-lapisan global; Naura Wilds hanya mengganti material warna, bukan anatomi layout.

## Palet Earth-Tone Survival

| Token                 | Hex                      | Fungsi                                                                     |
| --------------------- | ------------------------ | -------------------------------------------------------------------------- |
| `wilds-emerald`       | `#86EFAC`                | Aksen utama survival, border panel kaca, glow judul, tab aktif             |
| `wilds-moss`          | `#34D399`                | Bar vital sehat (HP/Stamina penuh), status panen siap, progres quest       |
| `wilds-amber`         | `#FBBF24`                | Peringatan stamina rendah, energi, reward harian, harvest mendekati matang |
| `wilds-bark`          | `#92400E`                | Crafting, kayu/material mentah, tema workshop dan tempa                    |
| `wilds-river`         | `#7DD3FC`                | Fishing, deep sea, vivarium, elemen air                                    |
| `wilds-danger`        | `#F87171`                | Dungeon, world boss, duel, coliseum, HP kritis                             |
| `surface-glass-wilds` | `rgba(134,239,172,0.06)` | Panel kaca bertint hijau untuk container survival                          |
| `hairline-wilds`      | `rgba(134,239,172,0.2)`  | Garis tepi panel survival                                                  |

Warna global lainnya (`premium-gold`, `accent-blue`, `discord-blurple`) tetap berlaku sesuai fungsinya masing-masing; Naura Wilds tidak menimpa token global, hanya menambah lapisan domain.

## Skala Rarity Item

Digunakan secara konsisten untuk inventory, gacha, shop, crafting blueprint, dan drop dungeon:

| Rarity    | Hex       | Pill Badge                         |
| --------- | --------- | ---------------------------------- |
| Common    | `#9CA3AF` | Abu netral, tanpa glow             |
| Uncommon  | `#86EFAC` | Hijau emerald lembut               |
| Rare      | `#93C5FD` | Biru langit                        |
| Epic      | `#C084FC` | Ungu futuristik                    |
| Legendary | `#FFD700` | Emas premium dengan glow tipis     |
| Mythic    | `#F9A8D4` | Pink mitos dengan shimmer gradient |

## Komponen Wajib Survival

Semua komponen di bawah tetap tunduk pada struktur 5-lapisan Components V2 dan batas payload (aturan 1.12 AGENTS.md):

- **`wilds-hud-container`**: Container induk setiap respons survival. Header memuat nama lokasi/aktivitas + jam dunia (`survivalTime`), disusul strip vitals ringkas (HP/Stamina/Hunger) tepat di bawah separator pertama.
- **`wilds-status-vital-card`**: Kartu bar `[▰▰▰▱▱]` per stat vital. Warna bar otomatis: moss saat sehat (>50%), amber saat waspada (20-50%), danger saat kritis (<20%). Angka memakai Orbitron.
- **`wilds-inventory-item-card`**: Selectable card item berisi ikon emoji, nama tebal, deskripsi 1 baris, jumlah, dan pill rarity bulat (`{rounded.full}`) sesuai skala rarity.
- **`wilds-quest-timeline`**: Linimasa horizontal quest multi-langkah `[1️⃣] ──▶ [2️⃣] ──▶ [3️⃣]`; langkah aktif menyala emerald, selesai hijau, terkunci muted.
- **`wilds-battle-panel`**: Panel pertarungan (dungeon/duel/boss/coliseum) dengan border danger, log serangan ringkas maksimal 5 baris, dan tombol aksi tempur di blok interaksi.
- **Empty State Wilds**: Layar kosong (inventori kosong, ladang kosong, belum ada pet) wajib menampilkan ekspresi persona Naura yang memanggil `{displayName}` plus CTA instan, contoh: `[🌾 Mulai Bertani]` `[🛒 Kunjungi Toko]` `[🎁 Klaim Starter]`.

## Aturan Canvas Survival

- Kartu visual survival (status pet, hasil panen, kartu dungeon, render boss) dirender via `canvasWorkerPool.js`, bukan di event loop utama.
- Dispose buffer setelah render, cache hasil di Redis namespace `canvas:*`, dan wajib terhubung ke `smartInvalidateUserCanvas(userId)` pada setiap mutasi data survival.
- Rounded minimum `{rounded.lg}` (12px), bayangan ambient tinted hijau (bukan hitam pekat), dan palet strictly dari tabel earth-tone di atas.

## Do's and Don'ts Naura Wilds

### Do

- Gunakan `survivalUIHelper.js` sebagai satu-satunya sumber token warna dan helper bar vital; jangan hardcode hex survival di plugin.
- Pasangkan setiap angka vital dengan warna threshold yang benar (moss/amber/danger) agar pemain bisa memindai kondisi dalam sekali glance.
- Manfaatkan Goal Gradient Effect untuk XP quest dan progres panen: progress bar kawaii + pesan penyemangat yang menyebut `{displayName}`.
- Gunakan footer `ui.getFooter('survival')` untuk seluruh respons survival.

### Don't

- Jangan menimpa warna primary pink global dengan emerald; emerald hanya hidup di dalam domain survival.
- Jangan membuat panel survival dengan latar solid pekat; tetap gunakan tinted glass agar konsisten dengan glassmorphism.
- Jangan menampilkan log pertarungan lebih dari 5 baris; riwayat lengkap diserahkan ke subcommand khusus atau transcript.
- Jangan menggunakan emoji yang belum terdaftar di `src/config/ui/`.

---

## 🧠 UX Psychology & Emotional Persona Guidelines

Sistem antarmuka Naura Hoshino V2 memadukan estetika Cyber-Anime Glassmorphism dengan **6 Prinsip Psikologi UX** untuk menciptakan interaksi yang adiktif, intuitif, dan bermakna secara emosional.

### 1. Decision Fatigue & Smart Defaults (Hick's Law)

- **Rekomendasi Cerdas:** Setiap kali menyajikan daftar pilihan (menu atau tombol), tandai opsi terbaik dengan lencana `⭐ Rekomendasi Naura` menggunakan gaya Primary Pink Glow.
- **Progressive Disclosure:** Tampilkan maksimal 3 sampai 4 aksi vital di tampilan utama. Fitur lanjutan atau opsi tambahan disembunyikan dalam sub-menu kontekstual.

### 2. Goal Gradient Effect (Artificial Head Start)

- **Momentum Awal:** Onboarding, quest pemula, dan level progress tidak pernah dimulai dari 0%. Berikan dorongan awal (misal: Starter Kit langsung terisi 20%).
- **Kawaii Progress Bar:** Gunakan visual progress `[▰▰▰▱▱▱▱] 40%` yang disertai pesan penyemangat dinamis menyebut nama pengguna:
  > _"Tinggal 60 XP lagi lho! Semangat ya, Kak {displayName}~ ✨"_

### 3. Reciprocity (The Gift / Value-First Principle)

- **Instant Delight:** Berikan kegembiraan atau fungsi instan pada interaksi pertama (rekomendasi lagu, bonus sambutan, ramalan harian) sebelum meminta input atau konfigurasi lanjutan.
- **Surprise Care Gifts:** Hadiah kejutan kecil secara berkala saat pengguna berinteraksi aktif dengan Naura.

### 4. The IKEA Effect & Endowment Effect (Personalization)

- **Kepemilikan Emosional:** Berikan kebebasan kustomisasi kartu profil (warna aksen, background canvas, gelar kustom, nama virtual pet, dan preferensi persona AI).
- **Apresiasi Personal:** Naura selalu memberikan apresiasi hangat saat pengguna mengubah tampilan atau menyelesaikan karya:
  > _"Wah, selera Kak {displayName} bagus banget! Kartu profilmu sekarang jadi makin estetik~ 💕"_

### 5. Anchoring & Contrast Effect (Visual Hierarchy)

- **Hierarki Aksi Kontras:** Maksimal 1 tombol Primary (Pink/Blurple) per baris aksi (`ActionRow`). Tombol sekunder memakai warna netral, dan tombol destruktif memakai merah kontras.
- **Price Anchoring di Shop:** Tampilkan perbandingan nilai secara transparan, menonjolkan keuntungan bundle hemat (`[HEMAT 25%]`).

### 6. Peak-End Rule & Expressive Persona Feedback

- **Respons Dinamis & Ramah:** Respon error, cooldown, atau rate-limit disampaikan dengan gaya anime yang ekspresif dan peduli (tsundere/kuudere ceria), bukan teks terminal kaku:
  > _"B-Bukan karena aku cerewet ya, Kak {displayName}... tapi istirahat dulu sebentar sebelum coba lagi! 🌸"_
- **Penyebutan Nama Personal:** Hindari kata panggilan kaku atau generik seperti "Master". Selalu gunakan `{displayName}` atau `{username}` pengguna agar interaksi terasa dekat, hangat, dan nyata.
