# Panduan & Daftar Inventaris Emoji Kustom Naura Hoshino

Dokumen ini memuat panduan artistik dan daftar 67 emoji kustom Naura Hoshino (17 ekspresi wajah Naura + 50 kategori fitur bot) yang disiapkan untuk digambar sendiri dan diunggah ke server Discord.

---

## 1. Spesifikasi Teknis Pembuatan Aset

| Properti | Format Statis | Format Animasi |
| :--- | :--- | :--- |
| **Dimensi Kanvas** | 128 x 128 piksel | 128 x 128 piksel |
| **Format File** | `.png` (RGB + Alpha 32-bit) | `.gif` (Palet teroptimasi, loop infinite) |
| **Batas Ukuran File** | < 256 KB (rekomendasi < 128 KB) | < 256 KB (syarat Discord Nitro/Server Emoji) |
| **Latar Belakang** | Transparan 100% (Alpha Channel) | Transparan 100% |
| **Padding / Margin** | 4-6px dari batas kanvas (agar tidak terpotong) | 4-6px dari batas kanvas |
| **Frame Rate (GIF)** | - | 12 - 20 FPS (durasi loop 1.0 - 2.5 detik) |

### Karakteristik Visual Naura Hoshino
- **Rambut**: Twin-tail panjang berwarna soft sakura pink (`#f472b6` hingga `#ec4899`), dengan highlight putih/lavender.
- **Mata**: Toska cerah / cyan kristal (`#06b6d4` / `#22d3ee`) dengan pantulan bintang atau binar lembut di pupil.
- **Aksesoris Kepala**: Cat-ear cyber headphone putih dengan aksen strip cyan/toska yang menyala lembut.
- **Pakaian**: Cyber hoodie oversized warna putih bersih (`#ffffff` / `#f1f5f9`), tali hoodie toska, dengan aksen panel kode/data digital toska (`#06b6d4`).
- **Gaya Gambar**: Chibi anime ekspresif, garis outline tegas (dark navy/charcoal `#0f172a`, bukan hitam mati), warna cerah, dan bayangan sel-shading bersih.

---

## 2. Kategori 1: Ekspresi Wajah Naura (17 Item)

Ekspresi wajah karakter Naura Hoshino digunakan dalam dialog bot, AI companion, reaksi pesan, dan feedback interaksi.

| No | Nama Discord | Tipe | Emotikon Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 1 | `naura_happy` | GIF | 😊 | Senyum ceria lebar, mata menyipit bahagia berbentuk bulan sabit terbalik, pipi merona merah muda hangat, binar bintang di sekitar kepala. |
| 2 | `naura_thinking` | GIF | 🤔 | Ujung jari telunjuk menyentuh dagu, mata melirik ke kanan atas, alis bertaut penasaran, gelembung pikiran kecil berkedip di atas kepala. |
| 3 | `naura_cry` | GIF | 😭 | Menangis terisak tersedu-sedu, aliran air mata anime mengalir dari kedua sudut mata, mulut gemetar melengkung ke bawah, mata berkilau basah. |
| 4 | `naura_angry` | GIF | 😡 | Pout merengut kesal, alis menukik tajam, pipi menggembung merah, stiker urat kemarahan merah berdenyut di pelipis kanan. |
| 5 | `naura_shy` | PNG | 😳 | Wajah merona merah padam hingga ke telinga, kedua ujung jari telunjuk saling bertemu dan mengetuk malu-malu di depan dada, pandangan melirik ke bawah. |
| 6 | `naura_sleepy` | GIF | 😴 | Kelopak mata sayu terkantuk-kantuk, mulut menguap kecil dengan tangan menutup bibir, balon gelembung tidur "Zzz" mengapung dan pecah perlahan. |
| 7 | `naura_shocked` | PNG | 😲 | Mata bulat membesar dengan pupil mengecil, mulut terbuka membentuk huruf "O", garis-garis kejut vertikal biru di dahi. |
| 8 | `naura_eat` | PNG | 😋 | Kedua pipi menggembung penuh mengunyah kue/biskuit bintang, mata tertutup menikmati rasa enak, remah-remah biskuit di sudut bibir. |
| 9 | `naura_cheers` | GIF | 🥂 | Mengedipkan satu mata ceria, mengangkat gelas jus/sparkler mini ke udara merayakan pencapaian, kembang api confetti meledak lembut di latar. |
| 10 | `naura_chirping` | GIF | 🎵 | Mulut terbuka menyanyi riang, nada balok musik warna-warni melayang keluar dari dekat bibir, headphone berkedip mengikuti irama. |
| 11 | `naura_annoy` | PNG | 😜 | Menjulurkan lidah (akanbe) sambil menarik kelopak mata bawah dengan satu jari, pose usil dan menggoda yang menggemaskan. |
| 12 | `naura_blow_kiss` | GIF | 😘 | Mengedipkan mata manis sambil meniup ciuman, hati bercahaya pink melayang keluar dari telapak tangannya menuju ke arah penonton. |
| 13 | `naura_akward` | PNG | 😅 | Senyum miring kaku canggung, sebutir tetesan keringat anime besar (sweatdrop) menetes di dahi samping, mata melirik ragu. |
| 14 | `naura_confused` | PNG | 🤨 | Kepala dimiringkan 25 derajat ke kiri, tanda tanya besar warna toska mengambang di samping kepala, tatapan bingung dan polos. |
| 15 | `naura_hmph` | PNG | 😤 | Kepala menoleh menyamping membuang muka, kedua mata tertutup bangga dengan alis terangkat, hembusan napas kecil keluar dari hidung. |
| 16 | `naura_impressed` | PNG | 🤩 | Kedua mata berubah menjadi bintang emas berkilauan penuh kekaguman, kedua tangan ditangkupkan di depan dada, rona wajah penuh antusiasme. |
| 17 | `naura_read` | PNG | 📚 | Memakai kacamata baca bulat retro, kedua tangan memegang buku panduan bersampul bintang, mata fokus membaca dengan serius. |

---

## 3. Kategori 2: Modul & Fitur Naura OS (50 Item)

Digunakan untuk navigasi menu embed Discord Components V2, status sistem, tombol reaksi, dan transaksi ekonomi.

### A. Inti Sistem & Metrik (8 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 18 | `naura_core` | PNG | 🔮 | Chibi Naura memeluk orb inti cyber bercahaya violet-toska di dadanya dengan senyum lembut. |
| 19 | `naura_ping` | GIF | 📶 | Naura memakai bando antena radar mini dengan gelombang sinyal hijau berkedip, memegang stopwatch futuristik. |
| 20 | `naura_uptime` | PNG | ⏳ | Naura duduk bersandar santai di samping jam pasir cyber raksasa dengan butiran pasir kristal bercahaya. |
| 21 | `naura_cpu` | PNG | 💻 | Naura mengangkat microchip prosesor berhias sirkuit digital toska bercahaya neon. |
| 22 | `naura_ram` | PNG | 💾 | Naura memeluk modul stick RAM komputer berkilau emas dengan ekspresi bangga. |
| 23 | `naura_shard` | PNG | 💎 | Naura melakukan juggling 3 kristal cluster bercahaya warna pink, cyan, dan violet. |
| 24 | `naura_lang` | PNG | 🌐 | Naura memegang dua balon teks bahasa bergambar bendera ID dan EN dengan senyum ramah. |
| 25 | `naura_donate` | GIF | ☕ | Naura memegang cangkir kopi Saweria dengan kepulan uap berbentuk hati dan koin emas jatuh ke samping cangkir. |

### B. Kecerdasan Buatan & AI Companion (6 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 26 | `ai_sparkle` | GIF | ✨ | Ujung-ujung jari tangan Naura memancarkan binar sihir neural berkilauan emas dan toska. |
| 27 | `ai_thinking` | PNG | 🧠 | Naura menopang pipi dengan latar belakang pola diagram jaringan saraf tiruan (neural net) holografis. |
| 28 | `ai_vision` | PNG | 👁️ | Naura mengenakan kacamata visor holografis semi-transparan dengan antarmuka HUD scanner toska. |
| 29 | `ai_voice` | PNG | 🎙️ | Naura berbicara merdu di depan mikrofon kondenser studio melayang dengan gelombang suara audio neon. |
| 30 | `ai_openrouter` | PNG | 🔀 | Naura mengarahkan kabel serat optik berpendar di atas switchboard multi-model AI. |
| 31 | `ai_vip_fast` | GIF | ⚡ | Naura mengenakan kacamata kecepatan turbo dengan mahkota kilat berdenyut cepat. |

### C. Game & Retro Arcade (9 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 32 | `arcade_hub` | PNG | 🕹️ | Naura berdiri di samping mesin dingdong mini retro dengan joystick merah menyala. |
| 33 | `arcade_dice` | GIF | 🎲 | Naura melempar sepasang dadu kubus 3D berpendar angka 6 keberuntungan. |
| 34 | `arcade_card` | PNG | 🃏 | Naura memamerkan kipas kartu remi (Ace of Spades & Hearts) sambil mengedipkan sebelah mata. |
| 35 | `arcade_duel` | PNG | ⚔️ | Naura mengenakan ikat kepala petarung dengan pose silang pedang kayu latihan. |
| 36 | `arcade_target` | PNG | 🎯 | Naura membidik anak panah mainan tepat di tengah sasaran bullseye target warna-warni. |
| 37 | `edu_math` | PNG | 📐 | Naura mengenakan kacamata guru sambil menunjuk papan tulis kecil bertuliskan rumus matematika ceria. |
| 38 | `edu_map` | PNG | 🗺️ | Naura membuka gulungan peta harta karun pulau petualangan dengan kompas jarum berputar. |
| 39 | `edu_flag` | PNG | 🚩 | Naura mengibarkan bendera semaphore mini dengan penuh semangat. |
| 40 | `edu_word` | PNG | 📖 | Naura memegang balok kayu huruf alfabet menyusun kata teka-teki silang. |

### D. Sistem Ekonomi & Moneter (6 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 41 | `eco_cash` | GIF | 🪙 | Naura melemparkan koin emas Naura Coin (NC) berlogo bintang yang berputar berkilauan di udara. |
| 42 | `eco_bank` | PNG | 🏦 | Naura berdiri gagah di depan pintu brankas baja bank dengan roda kemudi emas. |
| 43 | `eco_shop` | PNG | 🏪 | Naura memakai celemek pedagang ramah di balik meja etalase toko bertenda garis putih-pink. |
| 44 | `eco_work` | PNG | 💼 | Naura memakai helm proyek kuning memegang papan catatan audit kerja harian. |
| 45 | `eco_heist` | PNG | 🕵️ | Naura mengenakan tudung kucing ninja gelap berjalan mengendap-endap membawa karung berlogo koin. |
| 46 | `eco_trade` | PNG | 🤝 | Naura menyodorkan kotak hadiah berpita merah muda dengan kedua tangan untuk barter bersahabat. |

### E. Moderasi & Keamanan Guild (7 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 47 | `mod_shield` | PNG | 🛡️ | Naura memasang tameng perisai pelindung cyber heksagon biru transparan menjaga server. |
| 48 | `mod_warn` | GIF | ⚠️ | Naura mengangkat rambu peringatan segitiga kuning dengan tanda seru berkedip waspada. |
| 49 | `mod_mute` | PNG | 🔇 | Naura meletakkan jari telunjuk di depan bibir memberi isyarat diam dengan gembok tertutup di sampingnya. |
| 50 | `mod_kick` | PNG | 👢 | Naura melakukan tendangan salto karate dinamis ke arah luar kanvas. |
| 51 | `mod_ban` | GIF | 🔨 | Naura mengangkat palu vonis hakim raksasa dengan kilat ungu siap diketokkan. |
| 52 | `mod_lock` | PNG | 🔒 | Naura memutar kunci emas mengunci gembok gerbang keamanan channel. |
| 53 | `mod_ticket` | PNG | 🎫 | Naura menyerahkan amplop surat bantuan berstempel stiker kelinci resmi OSIS. |

### F. Musik, Audio & DJ Lavalink (6 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 54 | `music_play` | GIF | ▶️ | Naura menyentuh tombol play segitiga hijau neon yang memancarkan riak gelombang suara. |
| 55 | `music_pause` | PNG | ⏸️ | Naura mengangkat kedua telapak tangan ke depan tanda jeda tenang dengan dua garis neon vertikal. |
| 56 | `music_skip` | PNG | ⏭️ | Naura mengibaskan tangan ke depan dengan jejak anak panah ganda berkecepatan tinggi. |
| 57 | `music_queue` | PNG | 📑 | Naura membaca lembaran daftar putar lagu tersusun rapi dengan hiasan kunci G musik. |
| 58 | `music_bass` | GIF | 🔊 | Naura bergoyang riang di depan speaker subwoofer dentuman bass yang bergetar bertenaga. |
| 59 | `music_disc` | GIF | 💿 | Naura bergaya sebagai DJ profesional memutar piringan hitam vinyl berputar di atas turntable. |

### G. Utilitas, Minecraft & Media (8 Item)
| No | Nama Discord | Tipe | Fallback | Panduan Visual & Pose Wajah Naura |
| :-: | :--- | :-: | :-: | :--- |
| 60 | `mc_pickaxe` | PNG | ⛏️ | Naura memanggul beliung berlian piksel (diamond pickaxe) di pundaknya dengan senyum petualang. |
| 61 | `mc_steve` | PNG | 🧱 | Naura berdiri berdampingan bersama balok figur Steve dengan jempol teracung. |
| 62 | `mc_ping` | PNG | 📡 | Naura memantau antena radar parabola satelit sinyal server Minecraft. |
| 63 | `weather_sun` | PNG | ☀️ | Naura memakai topi pantai jerami dan kacamata hitam di bawah sinar matahari cerah hangat. |
| 64 | `weather_rain` | GIF | 🌧️ | Naura memegang payung bening bergambar bintang di bawah rintik hujan digital. |
| 65 | `media_anime` | PNG | 🍿 | Naura memangku mangkuk popcorn dengan mata berbinar-binar menonton anime favorit. |
| 66 | `media_movie` | PNG | 🎬 | Naura memegang papan clapperboard sutradara film siap memulai syuting. |
| 67 | `dl_cobalt` | GIF | ⚡ | Naura memegang kilat petir biru kobalt melesat mengunduh file media berkecepatan tinggi. |

---

## 4. Alur Integrasi ke Discord & Bot

Setelah kamu selesai menggambar aset emoji:

1. **Unggah ke Discord Server**:
   - Buka `Server Settings` > `Emoji` > `Upload Emoji`.
   - Unggah file gambar statis (`.png`) atau animasi (`.gif`).
   - Beri nama emoji persis sesuai kolom **Nama Discord** di tabel atas (misal: `naura_happy`, `eco_cash`).

2. **Dapatkan ID Emoji dari Discord**:
   - Di Discord chat, ketikkan backslash sebelum nama emoji: `\:naura_happy:` lalu tekan Enter.
   - Discord akan membalas dengan format:
     - Statis: `<:naura_happy:123456789012345678>`
     - Animasi: `<a:naura_happy:123456789012345678>`
   - Salin string ID tersebut.

3. **Tempelkan ke Konfigurasi Bot**:
   - Buka file [src/config/ui/customEmojis.js](file:///d:/Naura%20Hoshino%20V2/src/config/ui/customEmojis.js).
   - Isi ID emoji pada masing-masing key:
   ```javascript
   naura_happy: '<a:naura_happy:ID_KAMU_DISINI>',
   eco_cash: '<a:eco_cash:ID_KAMU_DISINI>',
   ```
   - Bot Naura secara otomatis akan menggunakan emoji kustom resolusi tinggi ini di seluruh plugin, embed, dan button interaktif!

