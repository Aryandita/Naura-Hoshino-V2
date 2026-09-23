"use strict";

const ui = require("../../config/ui");

/**
 * Saga Naura Wilds: Resonansi Inti Astral (4-Act Main Campaign Saga)
 * Mengintegrasikan seluruh 25+ NPC autentik ke dalam alur objektif utama petualang.
 */
const storyData = [
  // ==========================================
  // ACT I: FAJAR DI LEMBAH PERMATA (Desa Sukamaju)
  // ==========================================
  {
    arc: 1,
    arcName: "Fajar di Lembah Permata",
    reqLevel: 1,
    region: "desa_sukamaju",
    chapters: [
      {
        chapter: 1,
        title: "Kebangkitan di Tepi Sawah",
        background: "desa",
        speakerNpcId: "kades_tirto",
        narrative:
          "Kamu tersadar di pematang sawah Desa Sukamaju tanpa ingatan masa lalu, hanya sebuah serpihan batu kristal yang berdenyut hangat di telapak tanganmu. Seorang gadis berpakaian cerah dan pria paruh baya berwibawa menyambutmu dengan cemas.",
        dialogue: [
          {
            speaker: "Naura",
            text: "{player}! Syukurlah kamu sudah sadar! Tadi kamu tergeletak pingsan di tepi sawah, membuatku khawatir sekali.",
          },
          {
            speaker: "Pak Kades Tirto",
            text: "Tenang dulu, anak muda. Tarik napas perlahan. Kamu berada di Desa Sukamaju, lembah permata yang damai. Batu di genggamanmu itu... bukan batu biasa.",
          },
          {
            speaker: "{player}",
            text: "Batu ini... aku tidak ingat siapa diriku, tapi aku bisa merasakan denyut energi hangat mengalir melaluinya.",
          },
          {
            speaker: "Pak Kades Tirto",
            text: "Itu adalah serpihan Inti Astral. Untuk bertahan hidup di alam bebas, kamu butuh tempat bernaung dan alat kerja dasar. Mulailah dengan mengumpulkan kayu bakar di pinggir desa.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "wood",
          reqAmount: 5,
          btnLabel: "Kumpulkan 5 Kayu",
          get btnEmoji() {
            return ui.getEmoji("wood") || "🪵";
          },
          failMsg:
            'Pak Kades Tirto: "Kayu yang kamu bawa masih kurang, anak muda. Tebanglah beberapa batang kayu lagi di tepian desa."',
        },
        reward: { item: "wooden_axe", amount: 1, exp: 50, starFragments: 100 },
        nextArc: 1,
        nextChapter: 2,
      },
      {
        chapter: 2,
        title: "Api Tempaan Logam Pertama",
        background: "desa",
        speakerNpcId: "bagas",
        narrative:
          "Kapak kayumu mulai retak setelah beberapa kali digunakan. Pak Kades menyarankanmu menemui Bagas di Bengkel Tempa Desa Sukamaju untuk memahami cara merawat ketahanan barang.",
        dialogue: [
          {
            speaker: "Bagas",
            text: "Oi! Jadi kamu pendatang baru yang ditemukan pingsan itu? Lihat alat kayumu, rapuh sekali! Sekali hantam batu keras langsung patah!",
          },
          {
            speaker: "{player}",
            text: "Kapak ini memang terasa hampir hancur. Bisakah kamu mengajariku cara memperbaikinya?",
          },
          {
            speaker: "Bagas",
            text: "Tentu saja! Di duniaku, setiap alat punya durabilitas. Kalau tidak dirawat di paron tempa, alatmu bakal hancur selamanya. Bawa beberapa bijih besi dari kaki bukit, biar kuajari cara menempa logam sejati!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "iron_ore",
          reqAmount: 3,
          btnLabel: "Serahkan 3 Iron Ore",
          get btnEmoji() {
            return ui.getEmoji("iron_ore") || ui.getEmoji("mining") || "⛏️";
          },
          failMsg:
            'Bagas: "Bijih besimu belum cukup, kawan! Ambil beliungmu dan gali urat besi di celah bebatuan bukit!"',
        },
        reward: {
          item: "iron_pickaxe",
          amount: 1,
          exp: 100,
          starFragments: 150,
        },
        nextArc: 1,
        nextChapter: 3,
      },
      {
        chapter: 3,
        title: "Esensi Hayati & Kebun Botani",
        background: "desa",
        speakerNpcId: "ningsih",
        narrative:
          "Seusai menempa, tubuhmu mulai letih, lapar, dan haus. Naura membimbingmu menuju kebun botani Ningsih dan balai pengobatan Bidan Sari untuk memahami 4 pilar vitalitas tubuh.",
        dialogue: [
          {
            speaker: "Ningsih",
            text: "Halo! Wah, wajahmu pucat sekali... berkebun dan menambang seharian pasti menguras banyak energi ya? Ini, makan buah segar dari kebunku dulu.",
          },
          {
            speaker: "Bidan Sari",
            text: "Duh sayang, jangan memaksakan diri sampai dehidrasi begitu. Tubuh seorang petualang butuh nutrisi teratur: Kesehatan, Stamina, Kelaparan, dan Kehausan wajib dijaga!",
          },
          {
            speaker: "{player}",
            text: "Terima kasih banyak, Ningsih, Bidan Sari. Rasa lelahku berangsur hilang setelah menikmati hasil panen segar ini.",
          },
          {
            speaker: "Bidan Sari",
            text: "Simpan ramuan herbal ini di tasmu. Kapan pun kamu terluka di alam liar, balutkan segera sebelum lukamu memburuk.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "apple",
          reqAmount: 2,
          btnLabel: "Konsumsi 2 Apel Segar",
          get btnEmoji() {
            return "🍎";
          },
          failMsg:
            'Bidan Sari: "Kamu belum makan buahnya, sayang. Segarkan energimu dulu sebelum kita lanjut bercerita."',
        },
        reward: { item: "bandage", amount: 3, exp: 150, starFragments: 200 },
        nextArc: 1,
        nextChapter: 4,
      },
      {
        chapter: 4,
        title: "Penjaga Gerbang & Sahabat Liar",
        background: "desa",
        speakerNpcId: "gatot",
        narrative:
          "Kekuatan fisikmu telah pulih. Sebelum diizinkan menjelajah ke luar batas desa, kamu harus menghadap Gatot sang penjaga gua dan Ki Prawiro sang pawang satwa liar.",
        dialogue: [
          {
            speaker: "Gatot",
            text: "Berhenti. Siapa pun yang ingin melangkah keluar dari Lembah Sukamaju harus membuktikan ketangguhan jiwanya di hadapanku.",
          },
          {
            speaker: "Ki Prawiro",
            text: "Tenang Gatot, anak muda ini memiliki aura yang selaras dengan alam. Hewan-hewan hutan pun tidak menolak kehadirannya.",
          },
          {
            speaker: "{player}",
            text: "Aku siap diuji, Gatot. Aku ingin mencari tahu asal-usul pecahan kristal astral ini.",
          },
          {
            speaker: "Gatot",
            text: "Bagus! Masuklah ke dalam dungeon pemula lantai satu. Kalahkan monster pertama dan buktikan kamu layak memegang Travel Pass!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "stone",
          reqAmount: 10,
          btnLabel: "Kumpulkan 10 Batu Dungeon",
          get btnEmoji() {
            return "🪨";
          },
          failMsg:
            'Gatot: "Kamu belum menuntaskan latihan di mulut gua! Kumpulkan pecahan batu dungeon untuk membuktikan ketangguhanmu!"',
        },
        reward: {
          item: "travel_pass",
          amount: 1,
          exp: 250,
          starFragments: 300,
        },
        nextArc: 2,
        nextChapter: 1,
      },
    ],
  },

  // ==========================================
  // ACT II: KABUT PURBA & RAHASIA TAMBANG GELAP
  // ==========================================
  {
    arc: 2,
    arcName: "Jalan Menuju Kota Pratama",
    reqLevel: 2,
    region: "desa_sukamaju",
    chapters: [
      {
        chapter: 1,
        title: "Nyanyian Ombak & Karang Aether",
        background: "laut",
        speakerNpcId: "mang_ujang",
        narrative:
          "Dengan Travel Pass di tangan, kamu menuju pesisir dermaga nelayan Desa Sukamaju. Mang Ujang dan Tari menemukan fenomena aneh di terumbu karang.",
        dialogue: [
          {
            speaker: "Mang Ujang",
            text: "Lihat ke arah palung laut itu, kawan. Ombak pasang hari ini membawa pecahan karang yang bersinar ungu tak wajar.",
          },
          {
            speaker: "Tari",
            text: "Aku baru saja menyelam ke dasar terumbu karang, {player}! Ada retakan energi yang membuat ikan-ikan laut gelisah. Dan pecahan kristalmu bereaksi terhadapnya!",
          },
          {
            speaker: "{player}",
            text: "Kristal ini bergetar... seolah memanggil sumber energi yang sama di kejauhan.",
          },
          {
            speaker: "Mang Ujang",
            text: "Ambillah ikan tangkapan segar ini sebagai bekal perjalananmu menuju pedalaman hutan purba.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "raw_fish",
          reqAmount: 3,
          btnLabel: "Serahkan 3 Ikan Laut",
          get btnEmoji() {
            return "🐟";
          },
          failMsg:
            'Mang Ujang: "Tangkapan ikanmu belum cukup untuk perbekalan jalan jauh. Pancinglah beberapa ikan lagi di dermaga!"',
        },
        reward: {
          item: "cooked_fish",
          amount: 5,
          exp: 300,
          starFragments: 350,
        },
        nextArc: 2,
        nextChapter: 2,
      },
      {
        chapter: 2,
        title: "Pertapa Lembah Mistis",
        background: "hutan",
        speakerNpcId: "ki_ageng_joyo",
        narrative:
          "Melangkah jauh ke dalam hutan pinus purba, kamu menemukan gubuk pohon Ki Ageng Joyo. Sang tabib mistis menyambutmu seolah sudah menantikan kedatanganmu.",
        dialogue: [
          {
            speaker: "Ki Ageng Joyo",
            text: "Hehehe... angin barat telah membisikkan langkah kakimu, wahai pembawa pecahan Inti Astral.",
          },
          {
            speaker: "Naura",
            text: "Ki Ageng Joyo, apakah kakek tahu rahasia di balik kristal yang dipegang {player}?",
          },
          {
            speaker: "Ki Ageng Joyo",
            text: "Dunia kita sedang mengalami disonansi dimensi. Kabut racun dari retakan Abyss mulai merembes. Minumlah ramuan penawar ini agar tubuhmu kebal dari hawa hitam.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "herbal_leaf",
          reqAmount: 5,
          btnLabel: "Kumpulkan 5 Daun Herbal Hutan",
          get btnEmoji() {
            return "🌿";
          },
          failMsg:
            'Ki Ageng Joyo: "Bahan racikan ramuan penawarmu masih kurang, anak muda. Petiklah daun herbal liar di sela akar pinus."',
        },
        reward: {
          item: "antidote_potion",
          amount: 2,
          exp: 400,
          starFragments: 400,
        },
        nextArc: 2,
        nextChapter: 3,
      },
      {
        chapter: 3,
        title: "Bisikan Lorong Gelap Tambang",
        background: "tambang",
        speakerNpcId: "gaston",
        narrative:
          "Kamu menuruni terowongan galian tambang terdalam. Di sana, Kang Jajang dan Kang Deden berbisik cemas sementara seorang pria misterius bertopi bundar memperingatkanmu.",
        dialogue: [
          {
            speaker: "Kang Jajang",
            text: "A-Ampun! Bebatuan tambang di sektor bawah tiba-tiba berubah jadi hitam legam dan berdengung aneh!",
          },
          {
            speaker: "Kang Deden",
            text: "Beliung bajaku bahkan mental saat menghantam urat kristal itu. Sepertinya ada kebocoran dari bawah sana.",
          },
          {
            speaker: "Gaston",
            text: "Psst... anak muda, jangan terlalu dekat ke jurang itu kalau nyawamu masih sayang. Tapi kalau kamu butuh barang langka untuk menembus perbatasan, aku punya apa yang kamu mau.",
          },
          {
            speaker: "{player}",
            text: "Siapa kamu? Dan apa yang terjadi di terowongan ini?",
          },
          {
            speaker: "Gaston",
            text: "Namaku Gaston. Sebut saja aku mitra dagang jalan pintas. Amankan beberapa keping logam murni untukku, maka kuberikan jalur rahasia melewati pos penjaga.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "copper_ore",
          reqAmount: 5,
          btnLabel: "Barter 5 Copper Ore",
          get btnEmoji() {
            return "🪙";
          },
          failMsg:
            'Gaston: "Bijih tembaga yang kamu bawa belum pas hitungannya, sobat. Bisnis adalah bisnis!"',
        },
        reward: {
          item: "stealth_cloak",
          amount: 1,
          exp: 500,
          starFragments: 450,
        },
        nextArc: 2,
        nextChapter: 4,
      },
      {
        chapter: 4,
        title: "Barikade Pos Perbatasan",
        background: "desa",
        speakerNpcId: "mayor_lucy",
        narrative:
          "Di gerbang perbatasan antara Desa Sukamaju dan akses jalan menuju Kota Pratama, Mayor Lucy memimpin pertahanan garnisun militer dari serbuan monster bayangan.",
        dialogue: [
          {
            speaker: "Mayor Lucy",
            text: "Pasukan, tahan barikade! Jangan biarkan monster bayangan mendekati permukiman warga!",
          },
          {
            speaker: "{player}",
            text: "Mayor Lucy! Biarkan aku dan Naura membantu menahan barisan sayap kiri!",
          },
          {
            speaker: "Mayor Lucy",
            text: "Nyali yang luar biasa! Tapi di medan pertempuran, keberanian tanpa persenjataan kokoh sama saja bunuh diri. Tunjukkan padaku bahwa kamu mampu bertahan!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "iron_ore",
          reqAmount: 10,
          btnLabel: "Perkuat Barikade Besi (10 Iron Ore)",
          get btnEmoji() {
            return "🛡️";
          },
          failMsg:
            'Mayor Lucy: "Material penguat benteng masih kurang! Pasukan perbatasan butuh pasokan besi sekarang juga!"',
        },
        reward: {
          item: "caravan_ticket",
          amount: 1,
          exp: 600,
          starFragments: 500,
        },
        nextArc: 3,
        nextChapter: 1,
      },
    ],
  },

  // ==========================================
  // ACT III: METROPOLIS KOTA PRATAMA & RAHASIA DESA KHUL'KHAS
  // ==========================================
  {
    arc: 3,
    arcName: "Pusaran Kota Pratama & Misteri Khul'Khas",
    reqLevel: 5,
    region: "kota_pratama",
    chapters: [
      {
        chapter: 1,
        title: "Gerbang Kota Pratama & Iringan Karavan",
        background: "kota",
        speakerNpcId: "pak_damar",
        narrative:
          "Menumpang karavan dagang Pak Damar, kamu akhirnya tiba di gerbang megah Kota Pratama. Bripka Agus memeriksa dokumen dan izin masuk kota metropolitan berteknologi tinggi.",
        dialogue: [
          {
            speaker: "Pak Damar",
            text: "Selamat datang di Kota Pratama, kota metropolitan tempat perputaran jutaan Naura Coin dan kemajuan teknologi dimensi!",
          },
          {
            speaker: "Bripka Agus",
            text: "Selamat siang. Tunjukkan berkas identitas dan tiket karavan Anda. Akhir-akhir ini banyak penyelundupan barang terlarang dari perbatasan.",
          },
          {
            speaker: "{player}",
            text: "Ini berkas dan tiket karavan resmiku, Pak Polisi. Kami datang dengan niat baik.",
          },
          {
            speaker: "Bripka Agus",
            text: "Semua dokumen sah. Selamat datang di Kota Pratama! Kamu bisa menukarkan Naura Star Fragments milikmu di Bank Sentral Pratama untuk mendapatkan Naura Coin.",
          },
        ],
        challenge: {
          type: "coin",
          reqAmount: 1000,
          btnLabel: "Konfirmasi Saldo (1,000 NSF)",
          get btnEmoji() {
            return "⭐";
          },
          failMsg:
            'Bripka Agus: "Anda perlu menunjukkan kecukupan saldo survival awal untuk jaminan izin tinggal di Kota Pratama."',
        },
        reward: {
          item: "city_resident_id",
          amount: 1,
          exp: 700,
          nauraCoins: 2500,
        },
        nextArc: 3,
        nextChapter: 2,
      },
      {
        chapter: 2,
        title: "Secangkir Ketenangan di Kafe Laras",
        background: "kota",
        speakerNpcId: "laras",
        narrative:
          "Hiruk-pikuk kota membuat kepalamu penat. Kamu melangkah masuk ke Neo-Cyber Kafe Laras yang tenang dengan alunan musik santai dan aroma seduhan kopi espresso.",
        dialogue: [
          {
            speaker: "Laras",
            text: "Selamat datang di Kafe Laras. Duduklah di sudut dekat jendela itu, petualang. Wajahmu terlihat membawa beban misteri yang berat.",
          },
          {
            speaker: "{player}",
            text: "Terima kasih, Laras. Suasana di kafenya sungguh membuat hati tenang setelah hiruk-pikuk jalan raya.",
          },
          {
            speaker: "Laras",
            text: "Ini secangkir espresso racikan khususku. Minumlah selagi hangat. Oh iya, kalau kamu mencari informasi kuno, temui Wulan di perpustakaan kota. Dia tahu rahasia yang tak tercatat di arsip umum.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "water_flask",
          reqAmount: 1,
          btnLabel: "Nikmati Seduhan Kopi",
          get btnEmoji() {
            return "☕";
          },
          failMsg:
            'Laras: "Nikmati minumanmu dulu dengan tenang, sayang. Petualangan besar butuh pikiran yang jernih."',
        },
        reward: {
          item: "laras_special_blend",
          amount: 2,
          exp: 800,
          nauraCoins: 3000,
        },
        nextArc: 3,
        nextChapter: 3,
      },
      {
        chapter: 3,
        title: "Arsip Terlarang & Teori Dimensi",
        background: "academy",
        speakerNpcId: "wulan",
        narrative:
          "Di perpustakaan megah Kota Pratama, Wulan sang pustakawati dan Prof. Habibie meneliti pecahan batu kristalmu di bawah mikroskop resonansi kosmik.",
        dialogue: [
          {
            speaker: "Wulan",
            text: "L-Luar biasa... pecahan kristal ini bukan berasal dari bumi ini. Getarannya persis seperti naskah kuno yang kusembunyikan di rak terlarang.",
          },
          {
            speaker: "Prof. Habibie",
            text: "Secara kalkulasi kuantum, benda ini adalah Astral Core! Benda pemersatu yang menstabilkan dua kutub dimensi. Jika intinya pecah total, jurang Abyss akan menelan dunia kita!",
          },
          {
            speaker: "{player}",
            text: "Lalu di mana pecahan inti yang lain berada, Profesor?",
          },
          {
            speaker: "Wulan",
            text: "Catatan nomad menyebutkan sebuah wilayah rahasia di luar peta resmi... Desa Khul'Khas. Kamu harus mencari altar leluhur di sana.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "ancient_relic_shard",
          reqAmount: 1,
          btnLabel: "Tunjukkan Pecahan Relik Purba",
          get btnEmoji() {
            return "💎";
          },
          failMsg:
            'Wulan: "Kita butuh setidaknya satu kepingan pecahan relik purba untuk mengkalibrasi arah kompas astral menuju Khul\'Khas."',
        },
        reward: {
          item: "khulkhas_secret_map",
          amount: 1,
          exp: 1000,
          nauraCoins: 5000,
        },
        nextArc: 3,
        nextChapter: 4,
      },
      {
        chapter: 4,
        title: "Pasar Bawah Tanah & Jejak Gurun Khul'Khas",
        background: "kota",
        speakerNpcId: "mbak_rini",
        narrative:
          "Sebelum berangkat ke Khul'Khas, kamu menghadiri balai lelang eksklusif Mbak Rini dan menelusuri transaksi pasar gelap yang diaudit ketat oleh petugas pajak Pak Anif.",
        dialogue: [
          {
            speaker: "Mbak Rini",
            text: "Uhh, lihat siapa yang datang ke balai lelangku... petualang pemberani yang sedang naik daun di Kota Pratama. Mau mencari perlengkapan ekspedisi gurun, sayang?",
          },
          {
            speaker: "Pak Anif",
            text: "Seluruh komoditas berharga tinggi wajib dicatat secara resmi. Pajak kota harus ditegakkan demi pembiayaan benteng pertahanan!",
          },
          {
            speaker: "{player}",
            text: "Mbak Rini, aku butuh kompas astral dan perbekalan untuk menembus badai kabut menuju Desa Khul'Khas.",
          },
          {
            speaker: "Mbak Rini",
            text: "Khul'Khas? Wilayah terlarang para nomad mistis itu? Hehe, untuk pria seistimewa dirimu, tentu saja kuberikan kompas terbaik dari brankas pribadiku.",
          },
        ],
        challenge: {
          type: "coin",
          reqAmount: 5000,
          btnLabel: "Beli Perlengkapan Ekspedisi (5,000 NC)",
          get btnEmoji() {
            return "🪙";
          },
          failMsg:
            'Mbak Rini: "Uangmu belum cukup untuk memborong kompas eksklusif ini, ganteng. Kumpulkan lagi koinmu di bursa kerja kota!"',
        },
        reward: {
          item: "astral_compass",
          amount: 1,
          exp: 1200,
          nauraCoins: 5000,
        },
        nextArc: 4,
        nextChapter: 1,
      },
    ],
  },

  // ==========================================
  // ACT IV: KONVERGENSI ASTRAL DI ISTANA DRAKEN
  // ==========================================
  {
    arc: 4,
    arcName: "Konvergensi Astral di Istana Draken",
    reqLevel: 10,
    region: "istana_draken",
    chapters: [
      {
        chapter: 1,
        title: "Maklumat Bupati Rahmat & Mobilisasi Warga",
        background: "kota",
        speakerNpcId: "bupati_rahmat",
        narrative:
          "Langit di atas Kota Pratama berubah merah temaram. Suara sirene meraung keras saat Bupati Rahmat mengumumkan status darurat tertinggi di hadapan seluruh rakyat.",
        dialogue: [
          {
            speaker: "Bupati Rahmat",
            text: "Rakyatku sekalian! Jurang dimensi di Istana Draken telah terbuka lebar! Pasukan iblis Abyss mulai bergerak menuju perbatasan kota!",
          },
          {
            speaker: "{player}",
            text: "Bupati Rahmat, aku telah menyatukan pecahan kompas dan memetakan jalan masuk menuju sarang utama di Istana Draken!",
          },
          {
            speaker: "Bupati Rahmat",
            text: "Luar biasa! Atas nama pemerintahan Kota Pratama dan aliansi seluruh warga, kami menyerahkan komando ekspedisi penentu ini ke tanganmu!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "diamond",
          reqAmount: 1,
          btnLabel: "Persembahkan 1 Diamond Murni",
          get btnEmoji() {
            return "💎";
          },
          failMsg:
            'Bupati Rahmat: "Kita butuh satu Diamond murni berkilau untuk mengaktifkan medan pelindung kota sebelum kamu berangkat!"',
        },
        reward: {
          item: "commander_insignia",
          amount: 1,
          exp: 1500,
          coupons: 50,
        },
        nextArc: 4,
        nextChapter: 2,
      },
      {
        chapter: 2,
        title: "Penebusan Aliansi Warga",
        background: "desa",
        speakerNpcId: "kades_tirto",
        narrative:
          "Sebelum menembus gerbang Istana Draken, seluruh penduduk Desa Sukamaju dan Kota Pratama berkumpul memberikan bekal terbaik mereka untuk mengawal perjuanganmu.",
        dialogue: [
          {
            speaker: "Bagas",
            text: "Pegang pedang baja tempaan terbaikku ini, kawan! Tebas setiap iblis yang menghalangi jalanmu!",
          },
          {
            speaker: "Bidan Sari & Ningsih",
            text: "Kami telah mengemas ratusan salep herbal dan buah segar untuk menjaga vitalitasmu di dalam labirin maut.",
          },
          {
            speaker: "Gaston & Tari",
            text: "Jalur rahasia bawah air dan terowongan tikus sudah kami amankan untuk rute evakuasi darurat!",
          },
          {
            speaker: "Naura",
            text: "{player}... apa pun yang terjadi di dalam Istana Draken nanti, aku akan selalu ada di sisimu. Mari kita selesaikan ini bersama!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "bandage",
          reqAmount: 5,
          btnLabel: "Amankan 5 Perban Tempur",
          get btnEmoji() {
            return "🩹";
          },
          failMsg:
            'Bidan Sari: "Pastikan ranselmu memuat perban cadangan yang cukup sebelum melangkah ke wilayah iblis!"',
        },
        reward: { item: "alliance_elixir", amount: 3, exp: 2000, coupons: 100 },
        nextArc: 4,
        nextChapter: 3,
      },
      {
        chapter: 3,
        title: "Menembus Gerbang Iblis Istana Draken",
        background: "draken",
        speakerNpcId: "gargoyle_malakor",
        narrative:
          "Berdiri di hadapan Gerbang Neraka Istana Draken, hawa dingin jurang kehampaan terasa menusuk tulang. Sosok raksasa bertaring batu menghadang jalanmu.",
        dialogue: [
          {
            speaker: "Gargoyle Malakor",
            text: "GRAAARGH! Manusia fana pembawa pecahan cahaya... beraninya kamu menginjakkan kaki di tanah terkutuk Istana Draken!",
          },
          {
            speaker: "{player}",
            text: "Minggir, Malakor! Kehancuran dimensi yang dipicu istana ini harus diakhiri hari ini juga!",
          },
          {
            speaker: "Gargoyle Malakor",
            text: "Jika kamu ingin mencapai takhta Penguasa Abyss di puncak lantai dungeon, kalahkan dulu para penjaga gerbang ini!",
          },
        ],
        challenge: {
          type: "item",
          reqId: "iron_pickaxe",
          reqAmount: 1,
          btnLabel: "Hancurkan Segel Gerbang Batu",
          get btnEmoji() {
            return "⚔️";
          },
          failMsg:
            'Gargoyle Malakor: "Peralatanmu terlalu rapuh untuk memecahkan segel gerbang besi hitam Draken!"',
        },
        reward: { item: "draken_key", amount: 1, exp: 3000, coupons: 200 },
        nextArc: 4,
        nextChapter: 4,
      },
      {
        chapter: 4,
        title: "Harmoni Baru Dua Dimensi",
        background: "draken",
        speakerNpcId: "naura",
        narrative:
          "Di singgasana tertinggi Istana Draken, inti Astral Core yang utuh beresonansi sempurna. Ledakan cahaya putih menyelimuti seluruh semesta, menyucikan kegelapan dan mengembalikan kedamaian abadi.",
        dialogue: [
          {
            speaker: "Naura",
            text: "{player}, lihat! Pecahan kristal kita telah menyatu kembali... energi hangat ini mengalir ke seluruh tanah Desa Sukamaju dan Kota Pratama!",
          },
          {
            speaker: "{player}",
            text: "Semuanya telah selesai, Naura. Dunia kita aman... dan kita berhasil melakukannya bersama seluruh warga.",
          },
          {
            speaker: "Naura",
            text: "Kamu adalah pahlawan terhebat yang pernah kukenal! Terima kasih telah membimbingku dan menjaga dunia ini dengan penuh cinta.",
          },
        ],
        challenge: {
          type: "item",
          reqId: "diamond",
          reqAmount: 1,
          btnLabel: "Satukan Inti Astral Sejati",
          get btnEmoji() {
            return "✨";
          },
          failMsg:
            'Naura: "Pegang erat pecahan kristalmu, {player}! Bersama-sama kita satukan energi ini!"',
        },
        reward: {
          item: "astral_champion_trophy",
          amount: 1,
          exp: 5000,
          coupons: 500,
          title: "Legenda Naura Wilds",
        },
        nextArc: -1,
        nextChapter: -1,
      },
    ],
  },
];

module.exports = storyData;
