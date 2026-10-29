# 🎨 NAURA HOSHINO V2 - CUSTOM EMOJI DESIGN SYSTEM

> **Versi:** 1.0.0 | **Tanggal:** 28 Oktober 2026  
> **Tema:** Cyberpunk-Nature Fusion | **Style:** Anime-Inspired Glassmorphism  
> **Target Platform:** Discord (Components V2 & Legacy Embeds)

---

## 📋 DAFTAR ISI

1. [Design Philosophy](#1-design-philosophy)
2. [Technical Specifications](#2-technical-specifications)
3. [Color Palette](#3-color-palette)
4. [Shape Language](#4-shape-language)
5. [Animation Guidelines](#5-animation-guidelines)
6. [Emoji Categories & Designs](#6-emoji-categories--designs)
7. [Detailed Example Descriptions](#7-detailed-example-descriptions)
8. [Naming Convention](#8-naming-convention)
9. [Implementation Guide](#9-implementation-guide)
10. [Asset Organization](#10-asset-organization)

---

## 1. DESIGN PHILOSOPHY

### 1.1 Core Principles

Custom emoji Naura Hoshino V2 adalah perpanjangan visual dari kepribadian bot: **hangat, ceria, suportif, namun tetap futuristik**. Setiap emoji harus mencerminkan keseimbangan antara teknologi cyberpunk dan kehangatan organik alam.

**Prinsip Utama:**

- **Warmth First:** Emoji harus terasa ramah dan approachable, bukan dingin atau mengintimidasi
- **Cyberpunk-Nature Balance:** Unsur neon/glow dipadukan dengan bentuk organik yang lembut
- **Clarity at Small Size:** Harus tetap terbaca jelas di ukuran 32x32px (ukuran render Discord)
- **Consistent Personality:** Semua emoji membawa "jiwa" Naura - ceria, caring, dan supportive
- **Cultural Sensitivity:** Menghindari simbol yang ambigu atau ofensif di berbagai budaya

### 1.2 Visual Language

**Bahasa Visual Naura:**

- **Soft Glow:** Aura cahaya lembut di sekitar elemen utama (cyan/pink)
- **Glassmorphism:** Efek transparansi dan blur pada lapisan sekunder
- **Anime Expression:** Mata besar, ekspresi wajah yang jelas dan mudah dibaca
- **Organic Curves:** Tidak ada sudut tajam; semua garis melengkung natural
- **Neon Accents:** Highlight tipis berwarna neon untuk sentuhan cyberpunk
- **Particle Effects:** Sparkle, bintang kecil, atau partikel cahaya untuk kesan magis

### 1.3 Do's and Don'ts

#### ✅ DO's

- Gunakan gradient halus untuk kedalaman (misal: pink tua → pink muda)
- Tambahkan glow effect tipis (1-2px blur) di sekitar siluet utama
- Pastikan kontras tinggi antara foreground dan background
- Test di dark mode DAN light mode Discord
- Gunakan easing function untuk animasi yang natural
- Sisakan padding 8-12px di sekeliling emoji (safe zone)
- Buat variasi ekspresi yang konsisten (mata, mulut, blush)

#### ❌ DON'Ts

- Jangan gunakan outline hitam tebal (terlalu kartun Barat)
- Hindari detail rumit yang hilang di ukuran kecil
- Jangan pakai teks atau huruf dalam emoji (kecuali simbol universal)
- Dilarang menggunakan warna murni #FF00FF atau #00FF00 (terlalu harsh)
- Jangan buat animasi >3 detik (file size dan distraksi)
- Hindari shadow drop yang keras (gunakan soft glow)
- Jangan campur style (misal: pixel art + vector dalam satu set)

---

## 2. TECHNICAL SPECIFICATIONS

### 2.1 Static Emoji (PNG)

| Parameter | Spesifikasi |
|-----------|-------------|
| Format | PNG-24 (RGB + Alpha Channel) |
| Ukuran Canvas | 128 x 128 pixels |
| Safe Zone | 108 x 108 pixels (padding 10px tiap sisi) |
| File Size | Maksimal 256 KB |
| Color Profile | sRGB IEC61966-2.1 |
| Bit Depth | 8-bit per channel (24-bit total + 8-bit alpha) |
| Compression | Lossless (PNG Optimize / oxipng level 3-5) |
| Metadata | Strip semua EXIF/IPTC kecuali copyright |

### 2.2 Animated Emoji (GIF/APNG)

| Parameter | Spesifikasi |
|-----------|-------------|
| Format | GIF89a atau APNG (prefer APNG jika support) |
| Ukuran Canvas | 128 x 128 pixels |
| Frame Rate | 10-15 FPS (standar: 12 FPS) |
| Durasi Loop | 1-3 detik (ideal: 1.5-2s) |
| Max Frames | 30 frames (untuk 2s @ 15 FPS) |
| File Size | Maksimal 512 KB (target: <400 KB) |
| Loop Count | Infinite (looping seamless) |
| Dithering | Adaptive dithering untuk gradient halus |
| Transparency | Binary alpha (GIF) atau full alpha (APNG) |

### 2.3 Optimization Pipeline

```bash
# Static PNG optimization
oxipng --opt-level 4 --strip safe --alpha input.png --out output.png

# GIF optimization
gifsicle --optimize=3 --colors 128 --dither=floyd-steinberg input.gif -o output.gif

# APNG optimization
apngopt input.apng output.apng
```

### 2.4 Export Checklist

- [ ] Canvas 128x128px dengan safe zone 108x108px
- [ ] Background transparent (alpha channel aktif)
- [ ] Tidak ada layer tersembunyi atau artifacts
- [ ] Color profile sRGB embedded
- [ ] File size sesuai batas (256KB static / 512KB animated)
- [ ] Test render di Discord preview
- [ ] Nama file mengikuti naming convention
- [ ] Metadata copyright tertanam (opsional)

---

## 3. COLOR PALETTE

### 3.1 Primary Colors (Naura Core Identity)

| Name | Hex Code | RGB | Usage |
|------|----------|-----|-------|
| **Naura Pink** | `#FFB6C1` | 255, 182, 193 | Base skin tone, primary warmth, cheeks |
| **Cyber Cyan** | `#00FFFF` | 0, 255, 255 | Glow effects, eye highlights, tech accents |
| **Dream Purple** | `#C084FC` | 192, 132, 252 | Secondary glow, magic effects, gradients |
| **Nature Green** | `#22C55E` | 34, 197, 94 | Success states, nature elements, healing |

### 3.2 Secondary Colors (Supporting Palette)

| Name | Hex Code | RGB | Usage |
|------|----------|-----|-------|
| **Soft Rose** | `#FFC0CB` | 255, 192, 203 | Lighter pink variant, highlights |
| **Deep Magenta** | `#FF69B4` | 255, 105, 180 | Emphasis, love/hearts, blush intense |
| **Sky Blue** | `#87CEEB` | 135, 206, 235 | Calm states, info badges, water |
| **Warm Amber** | `#FFD700` | 255, 215, 0 | Rewards, coins, achievements, stars |
| **Alert Red** | `#FF6B6B` | 255, 107, 107 | Errors, warnings, damage, danger |
| **Neutral Gray** | `#9CA3AF` | 156, 163, 175 | Disabled states, text secondary |

### 3.3 Gradient Presets

```css
/* Naura Skin Gradient */
gradient-skin: linear-gradient(135deg, #FFB6C1 0%, #FFC0CB 100%);

/* Cyber Glow Gradient */
gradient-cyber: radial-gradient(circle, #00FFFF 0%, rgba(0, 255, 255, 0) 70%);

/* Magic Aura Gradient */
gradient-magic: radial-gradient(circle, #C084FC 0%, rgba(192, 132, 252, 0) 70%);

/* Nature Vitality Gradient */
gradient-nature: linear-gradient(135deg, #22C55E 0%, #4ADE80 100%);

/* Warmth Blush Gradient */
gradient-blush: radial-gradient(circle, #FF69B4 0%, rgba(255, 105, 180, 0.3) 60%);
```

### 3.4 Shadow & Glow Colors

| Type | Color | Opacity | Blur Radius | Usage |
|------|-------|---------|-------------|-------|
| Soft Glow Cyan | `#00FFFF` | 40% | 4-6px | Outer glow utama |
| Soft Glow Pink | `#FFB6C1` | 30% | 3-5px | Secondary warmth glow |
| Inner Shadow | `#000000` | 15% | 2px | Depth pada convex surfaces |
| Drop Shadow | `#1F2937` | 25% | 3px | Subtle elevation |
| Highlight | `#FFFFFF` | 60% | 1px | Specular reflection |

### 3.5 Accessibility Contrast Ratios

Semua kombinasi warna foreground/background harus memenuhi **WCAG AA** (minimal 4.5:1 untuk teks/simbol penting):

- ✅ White (#FFFFFF) on Deep Magenta (#FF69B4): 4.8:1
- ✅ Black (#000000) on Naura Pink (#FFB6C1): 5.2:1
- ✅ White (#FFFFFF) on Dream Purple (#C084FC): 4.6:1
- ⚠️ Cyber Cyan (#00FFFF) on White: 1.7:1 (gunakan outline/shadow)

---

## 4. SHAPE LANGUAGE

### 4.1 Corner Radius Standards

| Element Type | Corner Radius | Notes |
|--------------|---------------|-------|
| Face/Head Shape | 40-50% (circular) | Selalu circular atau oval lembut |
| Body/Limb Shapes | 12-16px | Rounded rectangle feel |
| UI Elements (buttons) | 8-12px | Consistent dengan Components V2 |
| Icons/Symbols | 4-8px | Slightly rounded corners |
| Particles/Sparkles | 50% (circular) | Always perfectly round |
| Weapons/Tools | 6-10px | Softer edges for safety feel |

### 4.2 Stroke Width Guidelines

| Context | Stroke Width | Color | Notes |
|---------|--------------|-------|-------|
| Main Silhouette | 0px (no stroke) | N/A | Gunakan fill + glow saja |
| Internal Details | 1-2px | Darker shade of fill | Definisi fitur wajah/tubuh |
| Glow Outline | 0px (blur only) | Glow color | Soft outer glow via filter |
| Accent Lines | 1px | Neon cyan/pink | Tech details, circuit patterns |
| Separators | 1px | Semi-transparent white | Layer division |

### 4.3 Silhouette Rules

**Rule of Readability:** Siluet emoji harus bisa dikenali hanya dari bentuk hitam-putih tanpa warna atau detail internal.

**Guidelines:**

- **Single Focal Point:** Satu elemen dominan yang mengambil 60-70% canvas
- **Negative Space:** Minimal 20% area kosong untuk "breathing room"
- **Avoid Tangents:** Jangan biarkan elemen menyentuh edge canvas atau elemen lain secara awkward
- **Balance Asymmetry:** Jika tidak simetris, pastikan visual weight tetap seimbang
- **Test Thumbnail:** Zoom out ke 32x32px - masih terbaca?

### 4.4 Proportion System (Face-Based Emoji)

```
Head Diameter: 80-90px (62-70% of canvas)
Eye Size: 18-22px diameter each (20-25% of head)
Eye Spacing: 24-28px apart (center-to-center)
Mouth Width: 20-30px (25-35% of head width)
Cheek Blush: 12-16px diameter, positioned below eyes
Accessory Space: Top 20px for hats/hair/bows
```

### 4.5 Organic vs Geometric Balance

**Natura Hoshino Style = 70% Organic + 30% Geometric**

- **Organic (70%):** Curves, flowing lines, natural shapes, soft gradients
- **Geometric (30%):** Circuit patterns, hex grids, straight accent lines, tech symbols

Contoh penerapan:
- Wajah bulat organik + aksen garis sirkuit tipis di pipi
- Daun natural dengan vein pattern berbentuk grid geometris
- Potion bottle organic shape + label dengan border tech-style

---

## 5. ANIMATION GUIDELINES

### 5.1 Frame Rate & Timing

| Animation Type | FPS | Duration | Frames | Use Case |
|----------------|-----|----------|--------|----------|
| Blink | 12 | 0.3s | 3-4 | Eye blink cycle |
| Bounce | 12 | 0.8s | 9-10 | Happy/excited reaction |
| Wave | 10 | 1.5s | 15 | Greeting gesture |
| Pulse/Glow | 12 | 2.0s | 24 | Idle breathing effect |
| Spin | 15 | 1.0s | 15 | Loading indicator |
| Particle Burst | 15 | 0.6s | 9 | Sparkle/magic effect |
| Float | 10 | 3.0s | 30 | Gentle hovering motion |

### 5.2 Easing Functions

Gunakan easing untuk gerakan natural (hindari linear kecuali spin kontinu):

```javascript
// Ease Out Quad (decelerate) - untuk masuk posisi
easeOutQuad(t) { return t * (2 - t); }

// Ease In Out Sine (smooth) - untuk loop seamless
easeInOutSine(t) { return -(Math.cos(Math.PI * t) - 1) / 2; }

// Elastic Out (bounce) - untuk playful reactions
elasticOut(t) {
  const p = 0.3;
  return Math.pow(2, -10 * t) * Math.sin((t - p / 4) * (2 * Math.PI) / p) + 1;
}

// Spring (overshoot) - untuk squishy feel
spring(t) { return 1 - Math.cos(t * 4.5 * Math.PI) * Math.exp(-t * 6); }
```

### 5.3 Motion Principles

**1. Anticipation (Persiapan)**
- Sebelum bergerak, beri sedikit gerakan berlawanan arah
- Contoh: Sebelum lompat ke atas, squish ke bawah 1-2 frame

**2. Follow Through (Ikutan)**
- Bagian sekunder (rambut, aksesoris) bergerak sedikit terlambat
- Contoh: Kepala berhenti, rambut masih bergerak 2-3 frame lagi

**3. Squash & Stretch (Kelenturan)**
- Saat bergerak cepat, stretch vertikal/horizontal
- Saat impact/bounce, squash sebentar sebelum kembali normal
- Jaga volume konstan (stretch Y = squash X)

**4. Arcs (Gerakan Melengkung)**
- Gerakan natural mengikuti lintasan melengkung, bukan lurus
- Contoh: Tangan melambai membentuk arc, bukan garis lurus

**5. Timing & Spacing**
- Cepat di tengah gerakan, lambat di awal/akhir (ease in/out)
- More frames = slower, fewer frames = faster
- Hold 2-3 frame di pose ekstrem untuk emphasis

### 5.4 Loop Seamlessness

Untuk animasi looping sempurna:

1. **First Frame = Last Frame** (atau mirror untuk ping-pong)
2. **Velocity Matching:** Kecepatan di frame terakhir sama dengan frame pertama
3. **No Pop:** Transisi mulus tanpa lompatan mendadak
4. **Phase Offset:** Untuk multi-part animation, offset timing agar tidak sync sempurna (lebih natural)

**Testing Checklist:**
- [ ] Loop terlihat seamless setelah 5+ siklus
- [ ] Tidak ada visible "reset" moment
- [ ] Motion blur konsisten (jika digunakan)
- [ ] Glow/particle effects tidak flicker saat loop reset

### 5.5 Performance Budget

| Metric | Target | Hard Limit |
|--------|--------|------------|
| File Size (animated) | <400 KB | 512 KB |
| Frame Count | 15-20 | 30 |
| Color Count (GIF) | 128 | 256 |
| Canvas Size | 128x128 | 128x128 |
| Render Time (Discord) | <16ms/frame | 33ms/frame |

---

## 6. EMOJI CATEGORIES & DESIGNS

### A. Status & Reactions (20 Emojis)

Ekspresi emosi dan reaksi dasar Naura. Semua emoji kategori ini menggunakan base wajah Naura yang konsisten.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_happy | GIF | Senyum lebar, mata berbinar, sparkle |
| 2 | naura_sad | GIF | Mata berkaca-kaca, mulut turun, rain effect |
| 3 | naura_angry | GIF | Alis menukik, pipi merah, steam puff |
| 4 | naura_surprised | GIF | Mata besar, mulut O, exclamation mark |
| 5 | naura_love | GIF | Heart eyes, floating hearts, pink aura |
| 6 | naura_thinking | GIF | Mata ke atas, tangan di dagu, thought bubble |
| 7 | naura_wink | GIF | Satu mata tertutup, lidah keluar sedikit |
| 8 | naura_cry | GIF | Air mata mengalir, bibir gemetar |
| 9 | naura_laugh | GIF | Mata tertutup, mulut terbuka lebar, shake |
| 10 | naura_shy | GIF | Pipi merah, jari bertemu, gaze down |
| 11 | naura_excited | GIF | Lompat-lompat, bintang di mata, confetti |
| 12 | naura_sleepy | GIF | Mata setengah tertutup, Zzz particles |
| 13 | naura_confused | GIF | Kepala miring, question mark, spiral eyes |
| 14 | naura_proud | GIF | Dada membusung, smirk, golden aura |
| 15 | naura_scared | GIF | Mata mengecil, mulut bergelombang, sweat drop |
| 16 | naura_determined | GIF | Mata menyala, alis tegas, fire aura |
| 17 | naura_relaxed | GIF | Mata tertutup senyum, flower petals, sigh |
| 18 | naura_embarrassed | GIF | Wajah merah total, tangan nutup muka |
| 19 | naura_curious | GIF | Satu alis naik, kepala tilt, magnifying glass |
| 20 | naura_celebrate | GIF | Party hat, confetti burst, wide grin |

### B. Actions & Commands (15 Emojis)

Ikon aksi terkait musik, playback, dan command bot.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_play | GIF | Triangle play button dengan pulse glow |
| 2 | naura_pause | GIF | Two bars dengan fade effect |
| 3 | naura_skip | GIF | Double arrow kanan dengan speed lines |
| 4 | naura_stop | GIF | Square dengan shrink animation |
| 5 | naura_volume_up | GIF | Speaker dengan expanding waves |
| 6 | naura_volume_down | GIF | Speaker dengan contracting waves |
| 7 | naura_queue | PNG | Stack lines dengan number badge |
| 8 | naura_shuffle | GIF | Crossed arrows dengan sparkle trail |
| 9 | naura_repeat | GIF | Circular arrows dengan rotation |
| 10 | naura_lyrics | PNG | Music note dengan text lines |
| 11 | naura_radio | GIF | Radio tower dengan signal waves |
| 12 | naura_mic | PNG | Microphone dengan sound wave |
| 13 | naura_headphones | PNG | Headphones dengan music notes |
| 14 | naura_equalizer | GIF | Bars bergerak naik-turun |
| 15 | naura_disc | GIF | Vinyl disc spinning |

### C. RPG & Survival (20 Emojis)

Item dan status untuk Naura Wilds survival system.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_sword | PNG | Pedang kristal cyan dengan glow |
| 2 | naura_shield | PNG | Perisai bundar dengan emblem daun |
| 3 | naura_potion_hp | GIF | Botol merah dengan heart bubbles |
| 4 | naura_potion_mp | GIF | Botol biru dengan star bubbles |
| 5 | naura_coin_sc | GIF | Koin emas SC dengan shine effect |
| 6 | naura_coin_pd | GIF | Koin perak PD dengan hologram |
| 7 | naura_gem_vb | GIF | Permata ungu VB dengan inner glow |
| 8 | naura_diamond_ba | GIF | Berlian rainbow BA dengan prismatic |
| 9 | naura_heart_full | GIF | Heart merah penuh dengan pulse |
| 10 | naura_heart_half | PNG | Heart setengah untuk low HP |
| 11 | naura_energy | GIF | Lightning bolt kuning dengan zap |
| 12 | naura_food | PNG | Bento box dengan steam |
| 13 | naura_water | GIF | Tetesan air dengan ripple |
| 14 | naura_fire | GIF | Api unggun dengan flicker |
| 15 | naura_tree | PNG | Pohon cyber dengan neon veins |
| 16 | naura_pickaxe | PNG | Pickaxe dengan durability bar |
| 17 | naura_backpack | PNG | Tas inventory dengan pockets |
| 18 | naura_map | PNG | Peta lipat dengan marker |
| 19 | naura_treasure | GIF | Chest tertutup dengan sparkle |
| 20 | naura_level_up | GIF | Arrow naik dengan star burst |

### D. System & UI (15 Emojis)

Indikator sistem, notifikasi, dan feedback UI.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_settings | GIF | Gear icon dengan rotation |
| 2 | naura_info | PNG | Circle i dengan soft glow |
| 3 | naura_warning | GIF | Triangle ! dengan pulse yellow |
| 4 | naura_error | GIF | Circle X dengan shake red |
| 5 | naura_success | GIF | Checkmark dengan green burst |
| 6 | naura_loading | GIF | Spinner dengan cyan trail |
| 7 | naura_lock | PNG | Padlock tertutup dengan keyhole |
| 8 | naura_unlock | GIF | Padlock terbuka dengan click |
| 9 | naura_search | PNG | Magnifying glass dengan lens flare |
| 10 | naura_menu | PNG | Hamburger menu dengan dots |
| 11 | naura_close | PNG | X mark dengan fade |
| 12 | naura_back | PNG | Arrow kiri dengan slide |
| 13 | naura_next | PNG | Arrow kanan dengan slide |
| 14 | naura_refresh | GIF | Circular arrow dengan spin |
| 15 | naura_notification | GIF | Bell dengan ring vibration |

### E. Social & Community (10 Emojis)

Interaksi sosial, reward, dan komunitas.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_handshake | GIF | Dua tangan bersalaman dengan glow |
| 2 | naura_gift | GIF | Kotak hadiah dengan ribbon unwrap |
| 3 | naura_trophy | GIF | Piala emas dengan shine |
| 4 | naura_star | GIF | Bintang 5 sudut dengan twinkle |
| 5 | naura_crown | GIF | Mahkota raja dengan jewels |
| 6 | naura_medal | PNG | Medali dengan ribbon |
| 7 | naura_thumbs_up | GIF | Jempol dengan approve glow |
| 8 | naura_clap | GIF | Tangan tepuk dengan particles |
| 9 | naura_wave_hello | GIF | Tangan melambai dengan trail |
| 10 | naura_vip_badge | GIF | Badge VIP dengan holographic |

### F. Special Naura Signatures (10 Emojis)

Emoji eksklusif yang menjadi signature Naura Hoshino.

| No | Name | Type | Description Brief |
|----|------|------|-------------------|
| 1 | naura_smile | GIF | Signature warm smile dengan heart |
| 2 | naura_wave | GIF | Greeting wave dengan sparkle trail |
| 3 | naura_sparkle | GIF | Full sparkle burst khas Naura |
| 4 | naura_magic_cast | GIF | Tangan casting spell dengan circle |
| 5 | naura_heart_hands | GIF | Dua tangan membentuk heart |
| 6 | naura_peace_sign | GIF | Peace sign dengan wink |
| 7 | naura_finger_heart | GIF | Korean finger heart dengan glow |
| 8 | naura_salute | GIF | Hormat dengan respect aura |
| 9 | naura_hug | GIF | Open arms hug dengan warmth |
| 10 | naura_kiss | GIF | Blow kiss dengan floating heart |

---

## 7. DETAILED EXAMPLE DESCRIPTIONS

### Example 1: naura_happy

```yaml
Emoji Name: naura_happy
Category: Status & Reactions
Type: GIF (animated)
Shape: Circular face dengan soft rounded features, diameter 85px
Eyes: Large anime-style eyes (22px each) dengan cyan glow highlights, white sparkle dots
Mouth: Wide cheerful smile (28px width) showing warmth, slight teeth hint
Colors:
  Face: "#FFB6C1 → #FFC0CB gradient (top to bottom)"
  Eyes: "#00FFFF iris + white sparkle (3 dots per eye)"
  Cheeks: "Pink blush circles (#FF69B4 @ 40% opacity, 14px diameter)"
  Glow: "Cyan aura outer glow (#00FFFF @ 30%, 6px blur)"
  Sparkles: "White/Yellow stars (#FFFFFF/#FFD700) floating around"
Animation:
  Frames 1-3: "Eyes blink (open → half → closed → half → open)"
  Frames 4-6: "Head slight tilt right + left cheek sparkle appears"
  Frames 7-9: "Return to center + right cheek sparkle"
  Frames 10-12: "Idle happy expression with gentle bounce"
  Loop: "1.5s seamless, ease-in-out timing"
Technical:
  Canvas: "128x128px"
  Frames: "12 frames @ 12 FPS"
  Target Size: "<400 KB"
  Optimization: "Adaptive dithering, 128 colors max"
Safe Zone: "All elements within 108x108px center area"
Fallback Text: ":naura_happy:" or "😊"
```

### Example 2: naura_sad

```yaml
Emoji Name: naura_sad
Category: Status & Reactions
Type: GIF (animated)
Shape: Circular face tilted slightly downward, diameter 85px
Eyes: Large eyes dengan tear shimmer, eyebrows angled up (sad angle)
Mouth: Small downturned curve (15px width), trembling effect
Colors:
  Face: "#FFB6C1 → #FFA0B0 gradient (slightly desaturated)"
  Eyes: "#00FFFF iris dimmed 20% + tear highlight (#87CEEB)"
  Tears: "#87CEEB droplets with transparency"
  Glow: "Blue-tinted aura (#87CEEB @ 20%, 4px blur)"
  Rain: "Light blue streaks falling in background"
Animation:
  Frames 1-4: "Tear forms in left eye, grows"
  Frames 5-8: "Tear falls down cheek, new tear forms right eye"
  Frames 9-12: "Right tear falls, mouth trembles slightly"
  Frames 13-15: "Both eyes shimmer, gentle rain in background"
  Loop: "2.0s seamless, slow melancholic timing"
Technical:
  Canvas: "128x128px"
  Frames: "15 frames @ 10 FPS"
  Target Size: "<450 KB"
  Optimization: "Reduce rain particles if too large"
Safe Zone: "Rain effect can extend to edges, face in center 100px"
Fallback Text: ":naura_sad:" or "😢"
```

### Example 3: naura_play

```yaml
Emoji Name: naura_play
Category: Actions & Commands
Type: GIF (animated)
Shape: Rounded triangle (play symbol) dalam circle container
Symbol: Right-pointing triangle dengan rounded corners (radius 8px)
Colors:
  Background: "Transparent"
  Triangle: "#00FFFF solid fill"
  Glow: "Cyan pulse (#00FFFF @ 50%, expands 4px → 8px → 4px)"
  Container: "Thin circle outline (#C084FC @ 60%, 2px stroke)"
  Accent: "Small sparkle at triangle tip (#FFFFFF)"
Animation:
  Frames 1-6: "Triangle scales 1.0 → 1.1 → 1.0 (pulse)"
  Frames 7-12: "Glow expands outward then contracts"
  Frames 13-18: "Sparkle at tip blinks twice"
  Loop: "1.5s seamless, energetic rhythm"
Technical:
  Canvas: "128x128px"
  Symbol Size: "60x70px triangle in 90px circle"
  Frames: "18 frames @ 12 FPS"
  Target Size: "<300 KB"
  Optimization: "Simple shape, minimal colors"
Safe Zone: "Circle container touches safe zone edge (108px)"
Fallback Text: ":naura_play:" or "▶️"
```

### Example 4: naura_sword

```yaml
Emoji Name: naura_sword
Category: RPG & Survival
Type: PNG (static)
Shape: Crystal sword diagonal orientation (45° angle)
Blade: "Sharp crystalline blade dengan facet reflections"
Handle: "Wrapped grip dengan small gem pommel"
Colors:
  Blade: "#00FFFF → #FFFFFF gradient (base to tip)"
  Edge Glow: "#C084FC @ 40% along blade edge"
  Handle: "#4B5563 dark gray wrap"
  Gem: "#FF69B4 round gemstone di pommel"
  Shine: "White specular highlight along blade center"
Effects:
  Outer Glow: "Cyan aura (#00FFFF @ 30%, 5px blur)"
  Sparkles: "3 small stars near blade tip (#FFFFFF)"
  Reflection: "Diagonal light streak across blade"
Technical:
  Canvas: "128x128px"
  Sword Size: "90px length, 20px width blade"
  Orientation: "Bottom-left to top-right diagonal"
  Target Size: "<200 KB"
  Optimization: "Vector-based, clean edges"
Safe Zone: "Sword fits within 100x100px rotated area"
Fallback Text: ":naura_sword:" or "⚔️"
```

### Example 5: naura_coin_sc

```yaml
Emoji Name: naura_coin_sc
Category: RPG & Survival
Type: GIF (animated)
Shape: Circular coin dengan embossed "SC" text
Face: "Front-facing coin dengan slight 3D perspective"
Rim: "Raised edge dengan milled texture"
Colors:
  Base: "#FFD700 gold metallic"
  Highlight: "#FFF7CC light gold reflection"
  Shadow: "#B8860B darker gold depth"
  Text: "#8B6914 embossed SC letters"
  Shine: "White streak moving across surface"
Animation:
  Frames 1-5: "Coin rotates Y-axis 0° → 15° → 0°"
  Frames 6-10: "Shine streak moves left to right"
  Frames 11-15: "Subtle bounce + sparkle emit"
  Loop: "1.2s seamless, shiny attractive feel"
Technical:
  Canvas: "128x128px"
  Coin Size: "80px diameter, 8px thickness illusion"
  Frames: "15 frames @ 12 FPS"
  Target Size: "<350 KB"
  Optimization: "Limit rotation to avoid morphing artifacts"
Safe Zone: "Coin centered, 24px padding all sides"
Fallback Text: ":naura_coin_sc:" or "🪙"
```

### Example 6: naura_success

```yaml
Emoji Name: naura_success
Category: System & UI
Type: GIF (animated)
Shape: Circle container dengan checkmark inside
Checkmark: "Bold tick mark dengan rounded ends"
Colors:
  Circle: "#22C55E green fill"
  Checkmark: "#FFFFFF white bold stroke (6px)"
  Burst: "Green rays (#22C55E @ 60%) radiating outward"
  Particles: "Small confetti squares (multi-color) exploding"
  Glow: "Green aura (#22C55E @ 40%, 6px blur)"
Animation:
  Frames 1-3: "Circle scales in from 0 → 1.1 → 1.0"
  Frames 4-6: "Checkmark draws itself (stroke animation)"
  Frames 7-10: "Burst rays expand outward"
  Frames 11-15: "Confetti particles explode and fade"
  Loop: "1.5s with 0.5s hold at end before restart"
Technical:
  Canvas: "128x128px"
  Circle Size: "70px diameter"
  Checkmark: "40x30px, 6px stroke width"
  Frames: "15 frames @ 12 FPS"
  Target Size: "<400 KB"
Safe Zone: "Burst can extend to edge, circle in center 90px"
Fallback Text: ":naura_success:" or "✅"
```

### Example 7: naura_loading

```yaml
Emoji Name: naura_loading
Category: System & UI
Type: GIF (animated)
Shape: Circular spinner dengan segmented trail
Segments: "8 rounded rectangles arranged in circle"
Colors:
  Active Segment: "#00FFFF bright cyan"
  Trail Segments: "#00FFFF @ decreasing opacity (80%, 60%, 40%, 20%)"
  Inactive: "#374151 dark gray @ 30%"
  Center: "Optional small Naura face peeking (cute factor)"
  Glow: "Cyan bloom around active segment"
Animation:
  Continuous: "Rotation clockwise 360° per loop"
  Easing: "Linear (constant speed for loading indicator)"
  Trail: "Active segment leaves fading trail behind"
  Optional: "Center face blinks every 2 rotations"
  Loop: "1.0s per rotation, infinite seamless"
Technical:
  Canvas: "128x128px"
  Spinner Size: "80px outer diameter, 50px inner"
  Segments: "8 segments, each 15x8px rounded rect"
  Frames: "12 frames @ 12 FPS (30° per frame)"
  Target Size: "<300 KB"
Safe Zone: "Spinner within 100px circle, padding 14px"
Fallback Text: ":naura_loading:" or "⏳"
```

### Example 8: naura_sparkle

```yaml
Emoji Name: naura_sparkle
Category: Special Naura Signatures
Type: GIF (animated)
Shape: Multi-pointed star burst explosion
Stars: "Central large star + 6 smaller orbiting stars"
Particles: "12 tiny dots radiating outward"
Colors:
  Central Star: "#FFFFFF core → #00FFFF edges"
  Orbiting Stars: "#C084FC purple dengan white centers"
  Particles: "Mix of #FFB6C1, #00FFFF, #FFD700"
  Glow: "Multi-color aura blending all colors"
  Trails: "Motion blur streaks behind moving stars"
Animation:
  Frames 1-5: "Central star expands from center"
  Frames 6-10: "Orbiting stars spiral outward"
  Frames 11-15: "Particles burst and fade"
  Frames 16-20: "Reset with twinkle anticipation"
  Loop: "1.8s seamless, magical explosive feel"
Technical:
  Canvas: "128x128px"
  Central Star: "40px diameter at peak"
  Spread: "Full canvas utilization (safe zone max)"
  Frames: "20 frames @ 12 FPS"
  Target Size: "<480 KB"
  Optimization: "Use particle reuse to limit unique frames"
Safe Zone: "Can use full 128px but keep core in 100px"
Fallback Text: ":naura_sparkle:" or "✨"
```

### Example 9: naura_trophy

```yaml
Emoji Name: naura_trophy
Category: Social & Community
Type: GIF (animated)
Shape: Classic trophy cup dengan two handles
Cup: "Wide bowl narrowing to stem, flared base"
Details: "Engraved star emblem on front, ribbon streamers"
Colors:
  Cup: "#FFD700 gold metallic gradient"
  Highlights: "#FFF7CC specular reflections"
  Shadows: "#B8860B depth in curves"
  Star Emblem: "#FFFFFF embossed star"
  Ribbons: "#FF69B4 pink streamers flowing"
  Base: "#4B5563 dark pedestal"
Animation:
  Frames 1-5: "Trophy tilts left 5° then right 5°"
  Frames 6-10: "Shine sweeps across cup surface"
  Frames 11-15: "Ribbons flutter gently"
  Frames 16-18: "Star emblem pulses with glow"
  Loop: "2.0s seamless, proud celebratory feel"
Technical:
  Canvas: "128x128px"
  Trophy Size: "70px height, 60px width including handles"
  Frames: "18 frames @ 10 FPS"
  Target Size: "<450 KB"
Safe Zone: "Trophy centered, ribbons can flow to edge"
Fallback Text: ":naura_trophy:" or "🏆"
```

### Example 10: naura_magic_cast

```yaml
Emoji Name: naura_magic_cast
Category: Special Naura Signatures
Type: GIF (animated)
Shape: Hand dengan magic circle muncul di telapak
Hand: "Open palm facing viewer, fingers spread"
Magic Circle: "Geometric rune circle rotating above palm"
Colors:
  Hand: "#FFB6C1 skin tone dengan soft shading"
  Magic Circle: "#C084FC purple lines glowing"
  Runes: "#00FFFF cyan symbols di circle"
  Particles: "Sparkles rising from circle (#FFFFFF)"
  Aura: "Purple-pink blend glow around hand"
  Energy Lines: "Flowing lines connecting fingertips"
Animation:
  Frames 1-5: "Hand opens, circle begins forming"
  Frames 6-12: "Circle fully formed, starts rotating"
  Frames 13-18: "Particles rise, runes glow brighter"
  Frames 19-24: "Energy pulses, circle spins faster"
  Loop: "2.5s seamless, mystical building energy"
Technical:
  Canvas: "128x128px"
  Hand Size: "60px width, 70px height"
  Circle: "50px diameter, 10px above palm"
  Frames: "24 frames @ 12 FPS"
  Target Size: "<500 KB"
  Optimization: "Reuse particle assets, optimize rune detail"
Safe Zone: "Hand in lower center, circle in upper center"
Fallback Text: ":naura_magic_cast:" or "🪄"
```

---

## 8. NAMING CONVENTION

### 8.1 Format Standard

```
naura_{category}_{name}[_{variant}]
```

**Komponen:**

- `naura`: Prefix wajib (brand identity)
- `{category}`: Kategori emoji (lihat tabel di bawah)
- `{name}`: Nama deskriptif singkat (snake_case)
- `{variant}`: Opsional untuk varian (misal: `_alt`, `_v2`, `_dark`)

### 8.2 Category Codes

| Category | Code | Example |
|----------|------|---------|
| Status & Reactions | `status` | `naura_status_happy` |
| Actions & Commands | `action` | `naura_action_play` |
| RPG & Survival | `rpg` | `naura_rpg_sword` |
| System & UI | `system` | `naura_system_loading` |
| Social & Community | `social` | `naura_social_trophy` |
| Special Signatures | `special` | `naura_special_sparkle` |

**Catatan:** Untuk simplicity, prefix category boleh dihilangkan jika nama sudah unik:
- ✅ `naura_happy` (boleh, karena happy unik)
- ✅ `naura_status_happy` (juga boleh, lebih eksplisit)
- ❌ `happy_naura` (salah urutan)
- ❌ `nauraHappy` (harus snake_case)

### 8.3 Naming Best Practices

**DO:**
- Gunakan kata benda/kata sifat bahasa Inggris yang umum
- Maksimal 3 kata setelah prefix (misal: `naura_potion_hp_large`)
- Gunakan singkatan standar jika perlu (`hp`, `mp`, `sc`, `pd`, `vb`, `ba`)
- Konsisten antar kategori (jangan `sword` di satu tempat, `blade` di tempat lain)

**DON'T:**
- Jangan gunakan angka kecuali untuk versi (`_v2`, bukan `_2`)
- Hindari kata terlalu panjang (`celebration` → `celebrate`)
- Jangan pakai spasi atau karakter khusus selain underscore
- Jangan duplikasi nama meskipun beda kategori

### 8.4 Versioning

Jika emoji perlu direvisi tanpa menghapus versi lama:

```
naura_happy          # Versi original
naura_happy_v2       # Revisi pertama
naura_happy_v3       # Revisi kedua
```

Atau untuk varian kontekstual:

```
naura_happy          # Default
naura_happy_dark     # Dark mode variant
naura_happy_small    # Optimized untuk small size
```

---

## 9. IMPLEMENTATION GUIDE

### 9.1 Upload ke Discord Server

**Via Discord UI:**

1. Buka Server Settings → Emoji
2. Klik "Upload Emoji"
3. Pilih file PNG/GIF yang sudah dioptimasi
4. Beri nama sesuai naming convention (tanpa ekstensi)
5. Assign roles yang boleh menggunakan (opsional)
6. Save

**Via Discord API (Bot):**

```javascript
const { AttachmentBuilder } = require('discord.js');

// Upload emoji via guild.emojis.create()
async function uploadEmoji(guild, filePath, name) {
  try {
    const emoji = await guild.emojis.create({
      attachment: filePath,
      name: name,
      reason: 'Naura Emoji Design System v1.0'
    });
    console.log(`Uploaded: ${emoji.name} (${emoji.id})`);
    return emoji;
  } catch (error) {
    console.error(`Failed to upload ${name}:`, error);
    throw error;
  }
}

// Batch upload
const emojis = [
  { path: './assets/emojis/naura_happy.gif', name: 'naura_happy' },
  { path: './assets/emojis/naura_sad.gif', name: 'naura_sad' },
  // ... more emojis
];

for (const emoji of emojis) {
  await uploadEmoji(guild, emoji.path, emoji.name);
  await new Promise(r => setTimeout(r, 1000)); // Rate limit respect
}
```

### 9.2 Reference dalam Code

**Dalam Slash Command Response:**

```javascript
// Static emoji
const emoji = client.emojis.cache.find(e => e.name === 'naura_success');
await interaction.reply({
  content: `${emoji} Operasi berhasil!`
});

// Dalam embed/components
const container = buildContainerV2()
  .addHeader({
    title: `${client.emojis.cache.find(e => e.name === 'naura_trophy')} Achievement Unlocked!`,
    color: '#FFD700'
  })
  .build();
```

**Dalam Localization Files:**

```json
// assets/language/id.json
{
  "emoji": {
    "happy": "<:naura_happy:123456789012345678>",
    "sad": "<:naura_sad:123456789012345679>",
    "success": "<:naura_success:123456789012345680>"
  }
}
```

**Helper Function:**

```javascript
// src/utils/emojiHelper.js
const emojiCache = new Map();

function getEmoji(name) {
  if (emojiCache.has(name)) return emojiCache.get(name);
  
  const emoji = client.emojis.cache.find(e => e.name === name);
  if (emoji) {
    emojiCache.set(name, emoji.toString());
    return emoji.toString();
  }
  
  // Fallback ke Unicode jika custom emoji tidak ditemukan
  const fallbacks = {
    'naura_happy': '😊',
    'naura_sad': '😢',
    'naura_success': '✅',
    'naura_error': '❌',
    'naura_loading': '⏳'
  };
  
  return fallbacks[name] || '❔';
}

module.exports = { getEmoji };
```

### 9.3 Fallback Strategy

**Tier 1: Custom Emoji (Preferred)**
- Gunakan custom emoji jika tersedia di server
- Cache emoji ID untuk performa

**Tier 2: Unicode Emoji (Fallback)**
- Jika custom emoji tidak ditemukan (bot belum upload, server berbeda)
- Gunakan Unicode emoji yang paling mendekati
- Daftar mapping di `emojiFallbacks.json`

**Tier 3: Text Representation (Last Resort)**
- Jika Unicode juga tidak support (edge case)
- Gunakan text dalam bracket: `[HAPPY]`, `[SUCCESS]`
- Log warning untuk tracking missing assets

**Implementation:**

```javascript
function resolveEmoji(name, guild) {
  // Tier 1: Custom emoji di guild ini
  const customEmoji = guild.emojis.cache.find(e => e.name === name);
  if (customEmoji) return customEmoji.toString();
  
  // Tier 2: Unicode fallback
  const unicodeMap = require('../config/emojiFallbacks.json');
  if (unicodeMap[name]) return unicodeMap[name];
  
  // Tier 3: Text placeholder
  logger.warn(`Emoji ${name} not found, using text fallback`);
  return `[${name.toUpperCase()}]`;
}
```

### 9.4 Testing & Validation

**Pre-Upload Checklist:**

- [ ] File size sesuai limit (256KB/512KB)
- [ ] Dimensions exact 128x128px
- [ ] Transparent background (no white box)
- [ ] Animasi loop seamless (test 10 cycles)
- [ ] Terbaca jelas di 32x32px thumbnail
- [ ] Nama file valid (lowercase, underscore, no spaces)
- [ ] Color profile sRGB
- [ ] Tidak ada metadata sensitif

**Post-Upload Testing:**

```javascript
// Test script: scripts/test-emojis.js
async function testEmojis() {
  const expectedEmojis = [
    'naura_happy', 'naura_sad', 'naura_play', 
    'naura_sword', 'naura_success', 'naura_sparkle'
  ];
  
  for (const name of expectedEmojis) {
    const emoji = client.emojis.cache.find(e => e.name === name);
    if (!emoji) {
      console.error(`❌ Missing: ${name}`);
    } else {
      console.log(`✅ Found: ${name} (${emoji.id})`);
    }
  }
}
```

---

## 10. ASSET ORGANIZATION

### 10.1 Folder Structure

```
assets/
└── emojis/
    ├── source/                    # Master files (PSD/AI/SVG)
    │   ├── status/
    │   │   ├── naura_happy.psd
    │   │   ├── naura_sad.psd
    │   │   └── ...
    │   ├── action/
    │   │   ├── naura_play.ai
    │   │   └── ...
    │   ├── rpg/
    │   │   ├── naura_sword.svg
    │   │   └── ...
    │   ├── system/
    │   ├── social/
    │   └── special/
    │
    ├── export/                    # Optimized PNG/GIF ready to upload
    │   ├── static/
    │   │   ├── naura_sword.png
    │   │   ├── naura_info.png
    │   │   └── ...
    │   └── animated/
    │       ├── naura_happy.gif
    │       ├── naura_play.gif
    │       └── ...
    │
    ├── spritesheets/              # Sprite sheets untuk web dashboard
    │   ├── emoji_sheet_32.png     # 32x32 grid
    │   ├── emoji_sheet_64.png     # 64x64 grid
    │   └── emoji_manifest.json    # Metadata positions
    │
    └── docs/                      # Documentation & guidelines
        ├── NAURA_EMOJI_DESIGN_SYSTEM.md  # This file
        ├── emoji_checklist.md
        └── changelog.md
```

### 10.2 File Naming Rules

**Source Files:**
```
{category}/{name}.{format}
Example: status/naura_happy.psd
```

**Export Files:**
```
static/{name}.png
animated/{name}.gif
Example: export/static/naura_sword.png
         export/animated/naura_happy.gif
```

**Sprite Sheets:**
```
emoji_sheet_{size}.png
emoji_manifest.json
```

### 10.3 Version Control (Git)

**.gitignore Recommendations:**

```gitignore
# Ignore temporary/working files
assets/emojis/source/**/*.tmp
assets/emojis/export/**/*.bak

# Keep source and export files
# assets/emojis/source/**/*  <- TRACKED
# assets/emojis/export/**/*  <- TRACKED
```

**Commit Message Format:**

```
🎨 [Emoji] Add naura_happy animated emoji

⚙️ [System Update]
- Added naura_happy.gif to export/animated/
- Updated emoji manifest with new entry

🔧 [Minor Update]
- Optimized file size to 380KB (target <400KB)
- Tested loop seamlessness (10 cycles verified)
```

### 10.4 Asset Metadata Manifest

**File: `assets/emojis/spritesheets/emoji_manifest.json`**

```json
{
  "version": "1.0.0",
  "generated": "2026-10-28T10:00:00Z",
  "emojis": [
    {
      "name": "naura_happy",
      "category": "status",
      "type": "animated",
      "file": "export/animated/naura_happy.gif",
      "size": "128x128",
      "frames": 12,
      "fps": 12,
      "duration": "1.5s",
      "filesize": "380KB",
      "tags": ["happy", "smile", "cheerful", "positive"],
      "fallback": "😊",
      "discordId": null
    },
    {
      "name": "naura_sword",
      "category": "rpg",
      "type": "static",
      "file": "export/static/naura_sword.png",
      "size": "128x128",
      "filesize": "180KB",
      "tags": ["weapon", "rpg", "combat", "crystal"],
      "fallback": "⚔️",
      "discordId": null
    }
  ],
  "spritesheets": {
    "32": {
      "file": "emoji_sheet_32.png",
      "columns": 16,
      "rows": 6,
      "cellSize": 32
    },
    "64": {
      "file": "emoji_sheet_64.png",
      "columns": 8,
      "rows": 12,
      "cellSize": 64
    }
  }
}
```

### 10.5 Backup & Recovery

**Backup Strategy:**

1. **Source Files:** Commit ke Git (master PSD/AI/SVG)
2. **Export Files:** Commit ke Git (optimized PNG/GIF)
3. **Cloud Backup:** Sync folder `assets/emojis/` ke cloud storage mingguan
4. **Discord Backup:** Catat emoji ID di manifest setelah upload

**Recovery Procedure:**

Jika emoji hilang dari Discord server:

1. Ambil file dari `assets/emojis/export/`
2. Re-upload via Discord UI atau bot script
3. Update `discordId` di manifest
4. Clear emoji cache di bot: `emojiCache.clear()`
5. Restart bot jika perlu

---

## 📝 CHANGELOG

### v1.0.0 (2026-10-28)

- Initial release Naura Emoji Design System
- Defined 90 emoji specifications across 6 categories
- Established color palette, shape language, animation guidelines
- Created 10 detailed example descriptions
- Set up asset organization structure
- Documented implementation guide dan fallback strategy

---

## 🎯 NEXT STEPS

1. **Priority 1:** Create 10 signature emojis (Category F)
2. **Priority 2:** Create 20 status/reaction emojis (Category A)
3. **Priority 3:** Create 15 action/command emojis (Category B)
4. **Priority 4:** Create 20 RPG/survival emojis (Category C)
5. **Priority 5:** Create 15 system/UI emojis (Category D)
6. **Priority 6:** Create 10 social/community emojis (Category E)

**Estimasi Timeline:**

- Design Phase: 2-3 minggu (dengan 1 designer dedicated)
- Production Phase: 4-6 minggu (batch production)
- Testing & Optimization: 1 minggu
- Upload & Integration: 2-3 hari

---

## 💬 CONTACT & FEEDBACK

Untuk pertanyaan, saran, atau kontribusi terkait emoji design system:

- **GitHub Issues:** Tag dengan label `emoji-design`
- **Discord Channel:** #emoji-design-discussion
- **Design Review:** Schedule weekly review dengan tim

---

**Document Maintained By:** Naura Hoshino V2 Development Team  
**Last Updated:** 28 Oktober 2026  
**License:** Internal Use Only - Naura Hoshino V2 Project

---

*"Setiap emoji adalah senyuman kecil dari Naura untuk pengguna."* ✨
