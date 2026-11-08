# Naura Hoshino V2 - Discord Custom Emoji Upload Checklist

Panduan komprehensif checklist unggah aset custom emoji Naura Hoshino V2 ke Discord untuk server owner dan bot developer.

Total Emojis: 67 items (50 category feature emojis + 17 canonical character expressions).
Format Aset: 128x128 HD, 1:1 square aspect ratio, RGBA PNG transparan terverifikasi audit alpha (< 256 KB), serta looping animated GIF untuk ekspresi dan aksi utama.

## Status Transparansi Final

- Audit alpha terakhir: 2026-11-08T03:14:12.845Z. Metode: piksel dengan alpha < 30 harus mencakup > 15% kanvas; latar checkerboard terbake pada art zip dihapus in-place memakai scripts/make-assets-transparent.js.
- 61 key berbasis art: original full-res transparan di assets/Naura_Expression/<key>.png (1264x1264) dan varian upload 128x128 di assets/emojis/naura_art_128/<key>.png, keduanya terverifikasi.
- 6 key tanpa art baru (naura_donate, ai_sparkle, naura_happy, naura_thinking, naura_cry, naura_shocked): static prosedural di assets/emojis/naura_custom/ terverifikasi transparan.
- Berkas opaque tersisa: tidak ada.
- GIF animasi tetap berasal dari set prosedural; audit pass ini hanya mencakup static PNG.
- Kolom **Upload 128** menunjuk static siap unggah yang diaudit; kolom **Transparansi** bernilai verified bila audit alpha lolos.

## Panduan Unggah ke Discord

### Opsi A: Discord Application Emojis (Rekomendasi untuk Bot)
Aset emoji dapat diunggah langsung ke Discord Developer Portal sehingga dapat digunakan oleh bot di semua server tanpa memakan slot server lokal:
1. Buka [Discord Developer Portal](https://discord.com/developers/applications).
2. Pilih aplikasi bot Naura Hoshino V2 Anda.
3. Buka tab **Emojis** di menu navigasi sebelah kiri.
4. Klik tombol **Upload Emoji**.
5. Pilih berkas sesuai kolom **Upload 128**: folder `assets/emojis/naura_art_128/` untuk key berbasis art, `assets/emojis/naura_custom/` untuk key prosedural.
6. Beri nama emoji sesuai kolom **Recommended Discord Name** (contoh: `naura_happy`, `ai_sparkle`).
7. Simpan dan perhatikan bahwa aplikasi bot memiliki kuota hingga 50 emoji statis dan 50 emoji animasi.

### Opsi B: Discord Server Emojis (Unggah ke Guild/Server)
Jika diunggah ke server Discord (guild):
1. Buka server Discord tempat bot beroperasi (pastikan memiliki izin *Manage Emojis and Stickers*).
2. Buka **Server Settings** -> **Emoji**.
3. Klik tombol **Upload Emoji**.
4. Unggah berkas PNG (untuk statis) atau berkas GIF (untuk animasi).
5. Beri nama emoji persis sesuai **Recommended Discord Name**.

### Cara Mendapatkan Tag Emoji ID Discord
Setelah emoji berhasil diunggah, dapatkan string ID Discord lengkap:
1. Di chat Discord, ketik backslash sebelum nama emoji, contoh: `\:naura_happy:` lalu kirim pesan.
2. Discord akan menampilkan tag lengkap:
   - Untuk emoji statis: `<:nama:ID_ANGKA>` (contoh: `<:naura_core:123456789012345678>`)
   - Untuk emoji animasi: `<a:nama:ID_ANGKA>` (contoh: `<a:naura_happy:123456789012345678>`)
3. Salin tag tersebut dan masukkan ke dalam file konfigurasi bot (`src/config/ui/customEmojis.template.js` atau `src/config/ui/customEmojis.js`).

## Checklist Inventaris Emoji (67 Items)

### 1. Core, Sistem & Navigasi (8 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `naura_core` | `naura_core` | `assets/emojis/naura_custom/naura_core.png` | `assets/emojis/naura_art_128/naura_core.png` | verified | Static PNG | 🔮 | Chibi Naura hugging glowing central cyber core orb |
| [ ] | `naura_ping` | `naura_ping` | `assets/emojis/naura_custom/naura_ping.gif` | `assets/emojis/naura_art_128/naura_ping.png` | verified | Animated GIF + Static PNG | 📶 | Chibi Naura with antenna headband holding radar stopwatch |
| [ ] | `naura_uptime` | `naura_uptime` | `assets/emojis/naura_custom/naura_uptime.png` | `assets/emojis/naura_art_128/naura_uptime.png` | verified | Static PNG | ⏳ | Chibi Naura sitting next to ticking hourglass/cyber-clock |
| [ ] | `naura_cpu` | `naura_cpu` | `assets/emojis/naura_custom/naura_cpu.png` | `assets/emojis/naura_art_128/naura_cpu.png` | verified | Static PNG | 💻 | Chibi Naura holding glowing cyber processor chip |
| [ ] | `naura_ram` | `naura_ram` | `assets/emojis/naura_custom/naura_ram.png` | `assets/emojis/naura_art_128/naura_ram.png` | verified | Static PNG | 💾 | Chibi Naura carrying memory RAM stick modules |
| [ ] | `naura_shard` | `naura_shard` | `assets/emojis/naura_custom/naura_shard.png` | `assets/emojis/naura_art_128/naura_shard.png` | verified | Static PNG | 💎 | Chibi Naura juggling glowing crystal cluster shards |
| [ ] | `naura_lang` | `naura_lang` | `assets/emojis/naura_custom/naura_lang.png` | `assets/emojis/naura_art_128/naura_lang.png` | verified | Static PNG | 🌐 | Chibi Naura holding bilingual ID/EN speech bubbles |
| [ ] | `naura_donate` | `naura_donate` | `assets/emojis/naura_custom/naura_donate.gif` | `assets/emojis/naura_custom/naura_donate.png` | verified | Animated GIF + Static PNG | ☕ | Chibi Naura holding Saweria coffee cup with coin sparkles |

### 2. AI Companion & Machine Learning (6 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `ai_sparkle` | `ai_sparkle` | `assets/emojis/naura_custom/ai_sparkle.gif` | `assets/emojis/naura_custom/ai_sparkle.png` | verified | Animated GIF + Static PNG | ✨ | Chibi Naura with neural magic sparkles around fingertips |
| [ ] | `ai_thinking` | `ai_thinking` | `assets/emojis/naura_custom/ai_thinking.png` | `assets/emojis/naura_art_128/ai_thinking.png` | verified | Static PNG | 🧠 | Chibi Naura resting cheek on hand with floating neural net |
| [ ] | `ai_vision` | `ai_vision` | `assets/emojis/naura_custom/ai_vision.png` | `assets/emojis/naura_art_128/ai_vision.png` | verified | Static PNG | 👁️ | Chibi Naura wearing futuristic holographic scanner visor |
| [ ] | `ai_voice` | `ai_voice` | `assets/emojis/naura_custom/ai_voice.png` | `assets/emojis/naura_art_128/ai_voice.png` | verified | Static PNG | 🎙️ | Chibi Naura speaking into floating cyber studio mic |
| [ ] | `ai_openrouter` | `ai_openrouter` | `assets/emojis/naura_custom/ai_openrouter.png` | `assets/emojis/naura_art_128/ai_openrouter.png` | verified | Static PNG | 🔀 | Chibi Naura routing glowing multi-model node switchboard |
| [ ] | `ai_vip_fast` | `ai_vip_fast` | `assets/emojis/naura_custom/ai_vip_fast.gif` | `assets/emojis/naura_art_128/ai_vip_fast.png` | verified | Animated GIF + Static PNG | ⚡ | Chibi Naura wearing speed goggles with lightning crown |

### 3. Arcade, Minigame & Edukasi (9 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `arcade_hub` | `arcade_hub` | `assets/emojis/naura_custom/arcade_hub.png` | `assets/emojis/naura_art_128/arcade_hub.png` | verified | Static PNG | 🕹️ | Chibi Naura holding mini retro arcade cabinet with joystick |
| [ ] | `arcade_dice` | `arcade_dice` | `assets/emojis/naura_custom/arcade_dice.gif` | `assets/emojis/naura_art_128/arcade_dice.png` | verified | Animated GIF + Static PNG | 🎲 | Chibi Naura tossing twin sparkling 3D dice |
| [ ] | `arcade_card` | `arcade_card` | `assets/emojis/naura_custom/arcade_card.png` | `assets/emojis/naura_art_128/arcade_card.png` | verified | Static PNG | 🃏 | Chibi Naura fanning playing cards with playful wink |
| [ ] | `arcade_duel` | `arcade_duel` | `assets/emojis/naura_custom/arcade_duel.png` | `assets/emojis/naura_art_128/arcade_duel.png` | verified | Static PNG | ⚔️ | Chibi Naura in fighting headband with twin wooden swords |
| [ ] | `arcade_target` | `arcade_target` | `assets/emojis/naura_custom/arcade_target.png` | `assets/emojis/naura_art_128/arcade_target.png` | verified | Static PNG | 🎯 | Chibi Naura aiming toy dart at colorful bullseye target |
| [ ] | `edu_math` | `edu_math` | `assets/emojis/naura_custom/edu_math.png` | `assets/emojis/naura_art_128/edu_math.png` | verified | Static PNG | 📐 | Chibi Naura solving arithmetic chalkboard with glasses |
| [ ] | `edu_map` | `edu_map` | `assets/emojis/naura_custom/edu_map.png` | `assets/emojis/naura_art_128/edu_map.png` | verified | Static PNG | 🗺️ | Chibi Naura holding explorer map with mini compass |
| [ ] | `edu_flag` | `edu_flag` | `assets/emojis/naura_custom/edu_flag.png` | `assets/emojis/naura_art_128/edu_flag.png` | verified | Static PNG | 🚩 | Chibi Naura waving country flags energetically |
| [ ] | `edu_word` | `edu_word` | `assets/emojis/naura_custom/edu_word.png` | `assets/emojis/naura_art_128/edu_word.png` | verified | Static PNG | 📖 | Chibi Naura holding syllable block/vocabulary scroll |

### 4. Ekonomi, Kas & Bisnis (6 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `eco_cash` | `eco_cash` | `assets/emojis/naura_custom/eco_cash.gif` | `assets/emojis/naura_art_128/eco_cash.png` | verified | Animated GIF + Static PNG | 🪙 | Chibi Naura tossing shiny golden Naura Coins (NC) |
| [ ] | `eco_bank` | `eco_bank` | `assets/emojis/naura_custom/eco_bank.png` | `assets/emojis/naura_art_128/eco_bank.png` | verified | Static PNG | 🏦 | Chibi Naura standing proudly in front of bank vault |
| [ ] | `eco_shop` | `eco_shop` | `assets/emojis/naura_custom/eco_shop.png` | `assets/emojis/naura_art_128/eco_shop.png` | verified | Static PNG | 🏪 | Chibi Naura wearing merchant apron behind market stall |
| [ ] | `eco_work` | `eco_work` | `assets/emojis/naura_custom/eco_work.png` | `assets/emojis/naura_art_128/eco_work.png` | verified | Static PNG | 💼 | Chibi Naura in hardhat/uniform holding work clipboard |
| [ ] | `eco_heist` | `eco_heist` | `assets/emojis/naura_custom/eco_heist.png` | `assets/emojis/naura_art_128/eco_heist.png` | verified | Static PNG | 🕵️ | Chibi Naura in stealth cat-ear hood tiptoeing with sack |
| [ ] | `eco_trade` | `eco_trade` | `assets/emojis/naura_custom/eco_trade.png` | `assets/emojis/naura_art_128/eco_trade.png` | verified | Static PNG | 🤝 | Chibi Naura exchanging wrapped gift/box with both hands |

### 5. Moderasi, Admin & Server (7 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `mod_shield` | `mod_shield` | `assets/emojis/naura_custom/mod_shield.png` | `assets/emojis/naura_art_128/mod_shield.png` | verified | Static PNG | 🛡️ | Chibi Naura holding guardian shield protecting chat |
| [ ] | `mod_warn` | `mod_warn` | `assets/emojis/naura_custom/mod_warn.gif` | `assets/emojis/naura_art_128/mod_warn.png` | verified | Animated GIF + Static PNG | ⚠️ | Chibi Naura holding yellow caution warning sign |
| [ ] | `mod_mute` | `mod_mute` | `assets/emojis/naura_custom/mod_mute.png` | `assets/emojis/naura_art_128/mod_mute.png` | verified | Static PNG | 🔇 | Chibi Naura placing finger on lips with mute padlock |
| [ ] | `mod_kick` | `mod_kick` | `assets/emojis/naura_custom/mod_kick.png` | `assets/emojis/naura_art_128/mod_kick.png` | verified | Static PNG | 👢 | Chibi Naura performing dynamic high martial arts kick |
| [ ] | `mod_ban` | `mod_ban` | `assets/emojis/naura_custom/mod_ban.gif` | `assets/emojis/naura_art_128/mod_ban.png` | verified | Animated GIF + Static PNG | 🔨 | Chibi Naura wielding heavy mythical ban hammer |
| [ ] | `mod_lock` | `mod_lock` | `assets/emojis/naura_custom/mod_lock.png` | `assets/emojis/naura_art_128/mod_lock.png` | verified | Static PNG | 🔒 | Chibi Naura holding golden key locking channel container |
| [ ] | `mod_ticket` | `mod_ticket` | `assets/emojis/naura_custom/mod_ticket.png` | `assets/emojis/naura_art_128/mod_ticket.png` | verified | Static PNG | 🎫 | Chibi Naura holding verified support ticket envelope |

### 6. Musik & Media (6 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `music_play` | `music_play` | `assets/emojis/naura_custom/music_play.gif` | `assets/emojis/naura_art_128/music_play.png` | verified | Animated GIF + Static PNG | ▶️ | Chibi Naura in headphones tapping glowing play triangle |
| [ ] | `music_pause` | `music_pause` | `assets/emojis/naura_custom/music_pause.png` | `assets/emojis/naura_art_128/music_pause.png` | verified | Static PNG | ⏸️ | Chibi Naura holding up two hands in calm pause sign |
| [ ] | `music_skip` | `music_skip` | `assets/emojis/naura_custom/music_skip.png` | `assets/emojis/naura_art_128/music_skip.png` | verified | Static PNG | ⏭️ | Chibi Naura swiping forward with speed-arrow trail |
| [ ] | `music_queue` | `music_queue` | `assets/emojis/naura_custom/music_queue.png` | `assets/emojis/naura_art_128/music_queue.png` | verified | Static PNG | 📑 | Chibi Naura holding organized playlist sheet with notes |
| [ ] | `music_bass` | `music_bass` | `assets/emojis/naura_custom/music_bass.gif` | `assets/emojis/naura_art_128/music_bass.png` | verified | Animated GIF + Static PNG | 🔊 | Chibi Naura grooving with thumping subwoofer speakers |
| [ ] | `music_disc` | `music_disc` | `assets/emojis/naura_custom/music_disc.gif` | `assets/emojis/naura_art_128/music_disc.png` | verified | Animated GIF + Static PNG | 💿 | Chibi Naura as DJ spinning vinyl record on turntable |

### 7. Utility & Pihak Ketiga (8 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `mc_pickaxe` | `mc_pickaxe` | `assets/emojis/naura_custom/mc_pickaxe.png` | `assets/emojis/naura_art_128/mc_pickaxe.png` | verified | Static PNG | ⛏️ | Chibi Naura holding iconic diamond pickaxe on shoulder |
| [ ] | `mc_steve` | `mc_steve` | `assets/emojis/naura_custom/mc_steve.png` | `assets/emojis/naura_art_128/mc_steve.png` | verified | Static PNG | 🧱 | Chibi Naura standing next to blocky Steve companion |
| [ ] | `mc_ping` | `mc_ping` | `assets/emojis/naura_custom/mc_ping.png` | `assets/emojis/naura_art_128/mc_ping.png` | verified | Static PNG | 📡 | Chibi Naura inspecting Minecraft server latency radar |
| [ ] | `weather_sun` | `weather_sun` | `assets/emojis/naura_custom/weather_sun.png` | `assets/emojis/naura_art_128/weather_sun.png` | verified | Static PNG | ☀️ | Chibi Naura in sunhat and sunglasses smiling in sunshine |
| [ ] | `weather_rain` | `weather_rain` | `assets/emojis/naura_custom/weather_rain.gif` | `assets/emojis/naura_art_128/weather_rain.png` | verified | Animated GIF + Static PNG | 🌧️ | Chibi Naura holding umbrella under cyber-rain drops |
| [ ] | `media_anime` | `media_anime` | `assets/emojis/naura_custom/media_anime.png` | `assets/emojis/naura_art_128/media_anime.png` | verified | Static PNG | 🍿 | Chibi Naura holding popcorn bowl with sparkling eyes |
| [ ] | `media_movie` | `media_movie` | `assets/emojis/naura_custom/media_movie.png` | `assets/emojis/naura_art_128/media_movie.png` | verified | Static PNG | 🎬 | Chibi Naura holding cinema director clapperboard |
| [ ] | `dl_cobalt` | `dl_cobalt` | `assets/emojis/naura_custom/dl_cobalt.gif` | `assets/emojis/naura_art_128/dl_cobalt.png` | verified | Animated GIF + Static PNG | ⚡ | Chibi Naura holding hyper-speed cobalt download bolt |

### 8. Core Character Expressions (17 Emojis)

| Status | Key | Recommended Discord Name | File Path | Upload 128 | Transparansi | Format | Fallback | Deskripsi |
|:------:|-----|--------------------------|-----------|------------|:----------:|:------:|:--------:|-----------|
| [ ] | `naura_happy` | `naura_happy` | `assets/emojis/naura_custom/naura_happy.gif` | `assets/emojis/naura_custom/naura_happy.png` | verified | Animated GIF + Static PNG | 😊 | Canonical joyful smile, sparkling eyes, warm blush |
| [ ] | `naura_thinking` | `naura_thinking` | `assets/emojis/naura_custom/naura_thinking.gif` | `assets/emojis/naura_custom/naura_thinking.png` | verified | Animated GIF + Static PNG | 🤔 | Pondering, fingertip on chin, looking upward |
| [ ] | `naura_cry` | `naura_cry` | `assets/emojis/naura_custom/naura_cry.gif` | `assets/emojis/naura_custom/naura_cry.png` | verified | Animated GIF + Static PNG | 😭 | Sobbing with flowing anime tears, quivering mouth |
| [ ] | `naura_angry` | `naura_angry` | `assets/emojis/naura_custom/naura_angry.gif` | `assets/emojis/naura_art_128/naura_angry.png` | verified | Animated GIF + Static PNG | 😡 | Fierce pout, eyebrows angled down, red temple vein |
| [ ] | `naura_shy` | `naura_shy` | `assets/emojis/naura_custom/naura_shy.png` | `assets/emojis/naura_art_128/naura_shy.png` | verified | Static PNG | 😳 | Blushing cheeks, index fingers tapping together |
| [ ] | `naura_sleepy` | `naura_sleepy` | `assets/emojis/naura_custom/naura_sleepy.gif` | `assets/emojis/naura_art_128/naura_sleepy.png` | verified | Animated GIF + Static PNG | 😴 | Heavy drooping eyelids, tiny yawn, floating Zzz |
| [ ] | `naura_shocked` | `naura_shocked` | `assets/emojis/naura_custom/naura_shocked.png` | `assets/emojis/naura_custom/naura_shocked.png` | verified | Static PNG | 😲 | Wide round eyes, mouth agape in O, surprise |
| [ ] | `naura_eat` | `naura_eat` | `assets/emojis/naura_custom/naura_eat.png` | `assets/emojis/naura_art_128/naura_eat.png` | verified | Static PNG | 😋 | Puffed cheeks munching snack with happy crumbs |
| [ ] | `naura_cheers` | `naura_cheers` | `assets/emojis/naura_custom/naura_cheers.gif` | `assets/emojis/naura_art_128/naura_cheers.png` | verified | Animated GIF + Static PNG | 🥂 | Triumphant wink, holding celebration toast/sparkler |
| [ ] | `naura_chirping` | `naura_chirping` | `assets/emojis/naura_custom/naura_chirping.gif` | `assets/emojis/naura_art_128/naura_chirping.png` | verified | Animated GIF + Static PNG | 🎵 | Singing happily with open mouth, musical notes |
| [ ] | `naura_annoy` | `naura_annoy` | `assets/emojis/naura_custom/naura_annoy.png` | `assets/emojis/naura_art_128/naura_annoy.png` | verified | Static PNG | 😜 | Teasing akanbe tongue-out wink with lower eyelid |
| [ ] | `naura_blow_kiss` | `naura_blow_kiss` | `assets/emojis/naura_custom/naura_blow_kiss.gif` | `assets/emojis/naura_art_128/naura_blow_kiss.png` | verified | Animated GIF + Static PNG | 😘 | Sweet wink blowing glowing floating heart from palm |
| [ ] | `naura_akward` | `naura_akward` | `assets/emojis/naura_custom/naura_akward.png` | `assets/emojis/naura_art_128/naura_akward.png` | verified | Static PNG | 😅 | Uneasy slanted smile, nervous sweatdrop on forehead |
| [ ] | `naura_confused` | `naura_confused` | `assets/emojis/naura_custom/naura_confused.png` | `assets/emojis/naura_art_128/naura_confused.png` | verified | Static PNG | 🤨 | Head tilted sideways, question mark, puzzled eyes |
| [ ] | `naura_hmph` | `naura_hmph` | `assets/emojis/naura_custom/naura_hmph.png` | `assets/emojis/naura_art_128/naura_hmph.png` | verified | Static PNG | 😤 | Head turned sideways, eyes closed, haughty pout |
| [ ] | `naura_impressed` | `naura_impressed` | `assets/emojis/naura_custom/naura_impressed.png` | `assets/emojis/naura_art_128/naura_impressed.png` | verified | Static PNG | 🤩 | Starry twinkling eyes, hands clasped, awe |
| [ ] | `naura_read` | `naura_read` | `assets/emojis/naura_custom/naura_read.png` | `assets/emojis/naura_art_128/naura_read.png` | verified | Static PNG | 📚 | Studying open guide book with circular glasses |

## Panduan Integrasi Kode Bot

1. Salin berkas template konfigurasi:
   ```bash
   cp src/config/ui/customEmojis.template.js src/config/ui/customEmojis.js
   ```
2. Buka `src/config/ui/customEmojis.js` dan ganti nilai slot `ID_PLACEHOLDER` dengan tag emoji Discord yang valid:
   ```javascript
   // Sebelum konfigurasi:
   naura_happy: "<a:naura_happy:ID_PLACEHOLDER>",
   // Setelah konfigurasi:
   naura_happy: "<a:naura_happy:135792468012345678>",
   ```
3. Bot secara otomatis mendukung fallback Unicode (`getCustomEmoji(key)`) selama ID belum diisi atau masih berupa placeholder.
4. Jalankan pengujian verifikasi:
   ```bash
   node --test test/m3ManifestConfig.test.js
   ```
