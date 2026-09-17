"use strict";

/**
 * Data Struktur Peta Dunia & Sub-Zona (POIs) Naura Wilds
 * 4 Wilayah Resmi:
 * 1. Desa Sukamaju (Pemukiman, Tambang, Hutan, Pantai) - Mata uang: NSF
 * 2. Kota Pratama (Pusat Megapolitan & Ekonomi NC) - Mata uang: NC & Konversi NSF
 * 3. Desa Khul'Khas (Wilayah Mistis Tersembunyi - Self Exploration)
 * 4. Istana Draken (Benteng Kegelapan & Multi-Floor Dungeon)
 */

const REGIONS = {
  desa_sukamaju: {
    id: "desa_sukamaju",
    aliases: ["desa", "village", "sukamaju", "desa_pemula"],
    name: "Desa Sukamaju",
    title: "Lembah Permata & Ekosistem Awal Terpadu",
    primaryCurrency: "NSF (Naura Star Fragments)",
    currencyCode: "starFragments",
    themeColor: "#10B981",
    description:
      "Desa asri yang menyatukan kawasan pemukiman warga, ladang kebun, pesisir pantai nelayan, hutan pinus pedalaman, dan gua pertambangan bijih.",
    pois: [
      {
        id: "balai_desa",
        name: "Balai Desa Sukamaju",
        category: "government",
        residentNpcIds: ["kades_tirto"],
        operatingHours: { start: 6, end: 22 },
        coordinates: { x: 50, y: 50 },
        icon: "fa-solid fa-landmark",
        emoji: "🏛️",
        atmosphere:
          "Balai pertemuan bernuansa kayu jati dengan papan pengumuman sayembara warga dan aroma teh hangat.",
        facilities: ["papan_sayembara", "registrasi_warga", "wejang_kades"],
      },
      {
        id: "bengkel_bagas",
        name: "Bengkel Tempa Bagas",
        category: "workshop",
        residentNpcIds: ["bagas"],
        operatingHours: { start: 6, end: 20 },
        coordinates: { x: 38, y: 44 },
        icon: "fa-solid fa-hammer",
        emoji: "🔨",
        atmosphere:
          "Hawa panas berhembus dari tungku perapian, beradu dengan denting logam paron yang dipukul bertalu-talu.",
        facilities: ["reparasi_durability", "forge_senjata", "upgrade_peralatan"],
      },
      {
        id: "kebun_ningsih",
        name: "Kebun Botani & Rumah Kaca Ningsih",
        category: "agriculture",
        residentNpcIds: ["ningsih"],
        operatingHours: { start: 6, end: 18 },
        coordinates: { x: 62, y: 38 },
        icon: "fa-solid fa-seedling",
        emoji: "🌱",
        atmosphere:
          "Hamparan petak sawah dan bunga warna-warni yang semerbak di bawah siraman air embun pagi.",
        facilities: ["beli_bibit", "pupuk_organik", "panen_sayur"],
      },
      {
        id: "klinik_sari",
        name: "Klinik Pengobatan Bidan Sari",
        category: "medical",
        residentNpcIds: ["bidan_sari"],
        operatingHours: { start: 0, end: 24 }, // Buka 24 jam untuk darurat
        coordinates: { x: 44, y: 58 },
        icon: "fa-solid fa-heart-pulse",
        emoji: "💊",
        atmosphere:
          "Klinik bersih beraroma minyak kayu putih dan lavender, tempat warga memulihkan stamina dan mengobati luka.",
        facilities: ["rawat_darurat", "beli_salep", "perban_medis"],
      },
      {
        id: "sekolah_desa",
        name: "Sekolah Dasar Sukamaju",
        category: "education",
        residentNpcIds: ["bu_ratna", "budi", "siti"],
        operatingHours: { start: 7, end: 14 },
        coordinates: { x: 56, y: 62 },
        icon: "fa-solid fa-graduation-cap",
        emoji: "🏫",
        atmosphere:
          "Gedung sekolah sederhana dengan suara tawa riang anak-anak berlarian di halaman berumput hijau.",
        facilities: ["baca_buku_dasar", "rumor_anak_desa", "jimat_keberuntungan"],
      },
      {
        id: "dermaga_ujang",
        name: "Pesisir & Dermaga Nelayan Mang Ujang",
        category: "coastal",
        residentNpcIds: ["mang_ujang", "tari"],
        operatingHours: { start: 5, end: 21 },
        coordinates: { x: 80, y: 75 },
        icon: "fa-solid fa-anchor",
        emoji: "⚓",
        atmosphere:
          "Deru debur ombak pantai selatan dan deretan perahu kayu bercadik yang bersandar rapi di dermaga.",
        facilities: ["sewa_perahu", "umpan_pancing", "selam_mutiara"],
      },
      {
        id: "padepokan_satwa",
        name: "Padepokan Satwa & Hutan Sukamaju",
        category: "wilderness",
        residentNpcIds: ["ki_prawiro", "ki_ageng_joyo"],
        operatingHours: { start: 6, end: 19 },
        coordinates: { x: 22, y: 28 },
        icon: "fa-solid fa-paw",
        emoji: "🐾",
        atmosphere:
          "Kicau burung hutan dan rimbunnya pohon pinus purba tempat satwa liar berlindung dengan damai.",
        facilities: ["jinakkan_hewan", "ramuan_herbal_hutan", "pakan_pet"],
      },
      {
        id: "tambang_sukamaju",
        name: "Terowongan Tambang Gua Bijih",
        category: "mining",
        residentNpcIds: ["kang_jajang", "kang_deden", "gaston"],
        operatingHours: { start: 6, end: 23 },
        coordinates: { x: 18, y: 68 },
        icon: "fa-solid fa-mountain",
        emoji: "⛏️",
        atmosphere:
          "Lorong galian batu berdebu dengan gemerlap urat mineral tembaga, besi murni, dan lorong rahasia penyelundup.",
        facilities: ["ekskavasi_bijih", "teknik_pecah_batu", "barter_gaston"],
      },
      {
        id: "gerbang_dungeon",
        name: "Pos Penjaga Gua Dungeon Gatot",
        category: "combat",
        residentNpcIds: ["gatot"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 12, y: 82 },
        icon: "fa-solid fa-dungeon",
        emoji: "🛡️",
        atmosphere:
          "Pintu masuk celah batu yang gelap dan berhawa dingin menusuk, dijaga ketat oleh pendekar berotot baja.",
        facilities: ["masuk_dungeon_pemula", "uji_ketahanan", "asah_pedang"],
      },
      {
        id: "warung_jamu",
        name: "Lapak Jamu Gendong Mbak Siti",
        category: "beverage",
        residentNpcIds: ["mbak_siti"],
        operatingHours: { start: 6, end: 17 },
        coordinates: { x: 48, y: 35 },
        icon: "fa-solid fa-mortar-pestle",
        emoji: "🍵",
        atmosphere:
          "Aroma kunyit asam dan beras kencur segar yang menyegarkan badan sehabis bekerja seharian.",
        facilities: ["minum_jamu_segar", "kekebalan_penyakit", "obrolan_hangat"],
      },
      {
        id: "butik_luna",
        name: "Butik Gacha & Kosmetik Luna",
        category: "boutique",
        residentNpcIds: ["luna_gacha"],
        operatingHours: { start: 8, end: 22 },
        coordinates: { x: 68, y: 52 },
        icon: "fa-solid fa-wand-magic-sparkles",
        emoji: "✨",
        atmosphere:
          "Kios warna-warni yang dipenuhi etalase pakaian modis, aksesoris kosmetik berkilau, dan mesin gacha berputar.",
        facilities: ["tarik_gacha", "katalog_kosmetik", "tukar_kupon"],
      },
    ],
    items: [
      { name: "Kayu Pinus Sukamaju", emoji: "🌲", rarity: "Biasa" },
      { name: "Bijih Tembaga Mentah", emoji: "⛏️", rarity: "Biasa" },
      { name: "Ikan Mas Telaga", emoji: "🐟", rarity: "Biasa" },
      { name: "Beras Pandan Wangi", emoji: "🌾", rarity: "Biasa" },
      { name: "Sayur Bayam Segar", emoji: "🌿", rarity: "Biasa" },
      { name: "Jamu Beras Kencur", emoji: "🍵", rarity: "Tidak Biasa" },
      { name: "Cangkul Besi Tempa", emoji: "⛏️", rarity: "Tidak Biasa" },
      { name: "Pancing Bambu Ujang", emoji: "🎣", rarity: "Tidak Biasa" },
      { name: "Salep Binahong Sari", emoji: "🧪", rarity: "Langka" },
      { name: "Surat Rekomendasi Kades", emoji: "📜", rarity: "Langka" },
    ],
  },

  kota_pratama: {
    id: "kota_pratama",
    aliases: ["kota", "city", "pratama", "naura_city", "naura city"],
    name: "Kota Pratama",
    title: "Metropolis Neo-Cyber & Pusat Ekonomi Naura Coin",
    primaryCurrency: "NC (Naura Coin) & Konversi NSF",
    currencyCode: "economy_wallet",
    themeColor: "#38BDF8",
    description:
      "Kota metropolitan modern berteknologi tinggi dengan gedung pencakar langit megah, bursa kerja berpenghasilan Naura Coin, dan pusat 50-60% intrik alur cerita.",
    pois: [
      {
        id: "balai_kota_pratama",
        name: "Gedung Balai Kota Pratama",
        category: "government",
        residentNpcIds: ["bupati_rahmat"],
        operatingHours: { start: 8, end: 17 },
        coordinates: { x: 50, y: 40 },
        icon: "fa-solid fa-building-columns",
        emoji: "🏛️",
        atmosphere:
          "Gedung marmer megah dengan pilar-pilar tinggi, ruang sidang paripurna, dan pusat komando darurat kota.",
        facilities: ["maklumat_kota", "izin_properti", "aliansi_antar_wilayah"],
      },
      {
        id: "bank_sentral_pratama",
        name: "Bank Sentral Pratama & Bursa Valuta",
        category: "finance",
        residentNpcIds: ["pak_damar", "pak_anif"],
        operatingHours: { start: 8, end: 18 },
        coordinates: { x: 42, y: 52 },
        icon: "fa-solid fa-vault",
        emoji: "🏦",
        atmosphere:
          "Aula perbankan berteknologi tinggi tempat penukaran resmi Naura Star Fragments (NSF) ke Naura Coin (NC).",
        facilities: ["konversi_nsf_ke_nc", "deposito_bunga", "audit_keuangan"],
      },
      {
        id: "bursa_kerja",
        name: "Menara Bursa Karir & Perkantoran",
        category: "employment",
        residentNpcIds: ["bupati_rahmat"],
        operatingHours: { start: 8, end: 20 },
        coordinates: { x: 58, y: 48 },
        icon: "fa-solid fa-briefcase",
        emoji: "💼",
        atmosphere:
          "Pusat lowongan kerja resmi bagi petualang untuk mengumpulkan Naura Coin (NC) lewat berbagai profesi.",
        facilities: ["ambil_pekerjaan_nc", "klaim_gaji_harian", "jenjang_karir"],
      },
      {
        id: "kafe_laras",
        name: "Neo-Cyber Kafe Laras",
        category: "beverage",
        residentNpcIds: ["laras"],
        operatingHours: { start: 7, end: 23 },
        coordinates: { x: 36, y: 64 },
        icon: "fa-solid fa-mug-hot",
        emoji: "☕",
        atmosphere:
          "Suasana santai dengan pencahayaan neon temaram, alunan musik lofi, dan aroma kopi seduh murni yang menenangkan.",
        facilities: ["kopi_hemat_stamina", "menu_sarapan_kafe", "tukar_rumor_kota"],
      },
      {
        id: "perpustakaan_wulan",
        name: "Perpustakaan & Arsip Pustaka Kuno Wulan",
        category: "education",
        residentNpcIds: ["wulan", "prof_habibie"],
        operatingHours: { start: 8, end: 20 },
        coordinates: { x: 65, y: 32 },
        icon: "fa-solid fa-book-open",
        emoji: "📚",
        atmosphere:
          "Rak-rak buku kayu mahoni menjulang tinggi dengan jutaan manuskrip kuno, diagram dimensi, dan lentera meja yang damai.",
        facilities: ["riset_blueprint", "baca_sejarah_astral", "kencan_pustaka"],
      },
      {
        id: "rs_pratama",
        name: "Rumah Sakit Sentral Pratama",
        category: "medical",
        residentNpcIds: ["dokter_wira", "suster_maya"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 72, y: 60 },
        icon: "fa-solid fa-hospital",
        emoji: "🏥",
        atmosphere:
          "Peralatan medis mutakhir dan ruang rawat intensif dengan staf medis berdedikasi tinggi.",
        facilities: ["detox_racun_akut", "perawatan_spesialis", "injeksi_vitalitas"],
      },
      {
        id: "balai_lelang_rini",
        name: "Balai Lelang Mewah & Pasar Modal Mbak Rini",
        category: "commercial",
        residentNpcIds: ["mbak_rini", "pak_anif"],
        operatingHours: { start: 10, end: 22 },
        coordinates: { x: 28, y: 46 },
        icon: "fa-solid fa-gavel",
        emoji: "🏷️",
        atmosphere:
          "Karpet beludru merah dan lampu gantung kristal tempat para jutawan menawar relik dan komoditas langka.",
        facilities: ["ikut_lelang_eksklusif", "jual_barang_antik", "investasi_dividen"],
      },
      {
        id: "polsek_pratama",
        name: "Pos Komando Kepolisian Sektor 1",
        category: "security",
        residentNpcIds: ["bripka_agus", "pak_yanto"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 48, y: 72 },
        icon: "fa-solid fa-shield-halved",
        emoji: "👮",
        atmosphere:
          "Pusat patroli dengan monitor pemantau kota dan sirine patroli yang siap mengamankan ketertiban umum.",
        facilities: ["lapor_kejahatan", "bounty_bandit", "surat_kelakuan_baik"],
      },
      {
        id: "spbu_otomotif",
        name: "SPBU & Bengkel Otomotif Asep",
        category: "automotive",
        residentNpcIds: ["asep"],
        operatingHours: { start: 6, end: 22 },
        coordinates: { x: 82, y: 45 },
        icon: "fa-solid fa-gas-pump",
        emoji: "⛽",
        atmosphere:
          "Deru mesin kendaraan bermotor dan aroma bensin di mana para petualang menyervis sepeda motor atau kendaraan mereka.",
        facilities: ["isi_bensin_kendaraan", "servis_motor", "tips_otomotif"],
      },
      {
        id: "butik_shino",
        name: "Cyber Lounge Shino Hoshino",
        category: "lounge",
        residentNpcIds: ["shino_hoshino"],
        operatingHours: { start: 10, end: 23 },
        coordinates: { x: 34, y: 32 },
        icon: "fa-solid fa-headset",
        emoji: "🎧",
        atmosphere:
          "Tempat nongkrong kekinian bernuansa neon pastel dengan minuman kekinian dan gadget canggih terkini.",
        facilities: ["gadget_modern", "kupon_kosmik", "obrolan_santai_shino"],
      },
    ],
    items: [
      { name: "Kopi Espresso Neon Laras", emoji: "☕", rarity: "Tidak Biasa" },
      { name: "Microchip Aether Modern", emoji: "💾", rarity: "Langka" },
      { name: "Buku Teori Astral Wulan", emoji: "📚", rarity: "Langka" },
      { name: "Vaksin Imunitas Dokter Wira", emoji: "💉", rarity: "Epik" },
      { name: "Tiket Lelang Gelap Mbak Rini", emoji: "🎟️", rarity: "Epik" },
      { name: "Kacamata Cyber Shino", emoji: "👓", rarity: "Langka" },
      { name: "Obligasi Pasar Modal NC", emoji: "📊", rarity: "Epik" },
      { name: "Baterai Sel Energi Bersih", emoji: "🔋", rarity: "Tidak Biasa" },
      { name: "Kartu Akses Menara Karir", emoji: "💳", rarity: "Tidak Biasa" },
      { name: "Drone Pengintai Miniatur", emoji: "🛸", rarity: "Legendaris" },
    ],
  },

  desa_khulkhas: {
    id: "desa_khulkhas",
    aliases: ["khulkhas", "desa_khulkhas", "salju_khulkhas", "tanah_salju", "salju"],
    name: "Desa Khul'Khas",
    title: "Wilayah Pegunungan Salju Abadi & Altar Kristal Es",
    primaryCurrency: "Kristal Es Salju & NSF Langka",
    currencyCode: "starFragments",
    themeColor: "#38BDF8",
    description:
      "Pemukiman tersembunyi di pegunungan salju abadi dan lembah gletser timur laut. Rumah kayu beratap salju tebal, Altar Kristal Es, dan mata air hangat pemulih stamina di tengah badai es.",
    pois: [
      {
        id: "altar_astral",
        name: "Altar Kristal Es Khul'Khas (The Frozen Shrine)",
        category: "mystery",
        residentNpcIds: ["syeikh_malik", "lama_norbu", "elsa_frost"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 35 },
        icon: "fa-solid fa-snowflake",
        emoji: "❄️",
        atmosphere:
          "Monolit kristal es purba bertatahkan aksara berpendar yang berdenyut selaras dengan detak jantung Astral Core di tengah hembusan badai salju.",
        facilities: ["resonansi_kristal_es", "meditasi_salju", "buka_segel_es_purba"],
      },
      {
        id: "bazaar_nomad",
        name: "Pondok Hangat & Pasar Salju Khul'Khas",
        category: "commercial",
        residentNpcIds: ["syeikh_malik", "boris_es", "fatimah_salju"],
        operatingHours: { start: 16, end: 6 }, // Pasar salju malam
        coordinates: { x: 35, y: 55 },
        icon: "fa-solid fa-campground",
        emoji: "🛖",
        atmosphere:
          "Pondok kayu hangat di tengah hamparan salju, tempat para pengembara bertransaksi mantel tebal, kristal salju, dan rempah penghangat tubuh.",
        facilities: ["barter_kristal_salju", "beli_mantel_penahan_badai", "ramalan_musim_dingin"],
      },
      {
        id: "mata_air_kabut",
        name: "Mata Air Hangat Lembah Salju",
        category: "sanctuary",
        residentNpcIds: ["fatimah_salju"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 68, y: 65 },
        icon: "fa-solid fa-droplet",
        emoji: "♨️",
        atmosphere:
          "Kolam pemandian air hangat alami yang mengepulkan uap putih suci diapit tebing gletser bersalju, menyembuhkan radang beku dan memulihkan vitalitas penuh.",
        facilities: ["sembuhkan_radang_beku", "pemulihan_vitalitas_penuh", "berkah_alam_salju"],
      },
      {
        id: "pondok_alkimia_khulkhas",
        name: "Pondok Alkimia Es & Bengkel Tempa Dingin",
        category: "workshop",
        residentNpcIds: ["syeikh_malik", "pandai_es_tarek", "elsa_frost"],
        operatingHours: { start: 6, end: 22 },
        coordinates: { x: 22, y: 70 },
        icon: "fa-solid fa-flask-vial",
        emoji: "🧪",
        atmosphere:
          "Gubuk terpencil tempat penyulingan es murni bersanding dengan paron tempa Tarek yang menempa senjata kristal beku tanpa melelehkannya.",
        facilities: ["sintesis_elixir_es", "forge_senjata_es", "racik_bunga_salju_abadi"],
      },
    ],
    items: [
      { name: "Kristal Es Abadi Khul'Khas", emoji: "❄️", rarity: "Legendaris" },
      { name: "Mantel Bulu Serigala Salju", emoji: "🧥", rarity: "Langka" },
      { name: "Dendeng Beruang Kutub", emoji: "🥩", rarity: "Langka" },
      { name: "Tetesan Air Mata Gletser", emoji: "💧", rarity: "Epik" },
      { name: "Teh Hangat Rempah Salju", emoji: "☕", rarity: "Tidak Biasa" },
      { name: "Belati Beku Gletser", emoji: "🗡️", rarity: "Langka" },
      { name: "Batu Api Magma Portabel", emoji: "🔥", rarity: "Biasa" },
      { name: "Taring Serigala Gletser", emoji: "🦷", rarity: "Tidak Biasa" },
      { name: "Salep Minyak Lemak Kutub", emoji: "🧴", rarity: "Tidak Biasa" },
      { name: "Buku Resep Sup Hangat Malik", emoji: "📜", rarity: "Langka" },
    ],
  },

  hutan_dha_mhai: {
    id: "hutan_dha_mhai",
    aliases: ["dha_mhai", "hutan_dha_mhai", "rimba_dha_mhai", "hutan_barat", "hutan_kuno"],
    name: "Hutan Dha Mhai",
    title: "Kanopi Purba & Sanctuary Pohon Penjaga Rimba",
    primaryCurrency: "NSF & Resin Damar Mistik",
    currencyCode: "starFragments",
    themeColor: "#8B5CF6",
    description:
      "Hutan belantara purba di barat laut yang diselimuti kanopi raksasa dan kabut ungu mistik. Tempat bersemayam flora spora berpendar, sarang ratu lebah rimba, dan petapa penjaga alam.",
    pois: [
      {
        id: "gerbang_akar_dha_mhai",
        name: "Gerbang Akar Purba Dha Mhai",
        category: "sanctuary",
        residentNpcIds: ["dara_rimba", "raden_bram"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 25, y: 30 },
        icon: "fa-solid fa-tree",
        emoji: "🌳",
        atmosphere:
          "Lengkungan akar gantung dari pepohonan raksasa berusia ribuan tahun yang memancarkan aroma kayu damar wangi dan tetesan embun sejuk.",
        facilities: ["penjaga_gerbang_rimba", "berkah_penjaga_alam", "daftar_sayembara_hutan"],
      },
      {
        id: "sarang_lebah_rimba",
        name: "Sarang Ratu Lebah Raksasa",
        category: "hunting",
        residentNpcIds: ["pak_wojo"],
        operatingHours: { start: 6, end: 18 },
        coordinates: { x: 60, y: 40 },
        icon: "fa-solid fa-bugs",
        emoji: "🐝",
        atmosphere:
          "Dahan kanopi tinggi tempat koloni lebah rimba membangun sarang madu emas bercahaya, dijaga oleh lebah pejuang bertubuh gempal.",
        facilities: ["panen_madu_rimba", "buru_ratu_lebah", "perangkap_binatang_buas"],
      },
      {
        id: "pondok_penyadap_damar",
        name: "Pondok Damar Kakek Danu",
        category: "gathering",
        residentNpcIds: ["kakek_danu"],
        operatingHours: { start: 5, end: 19 },
        coordinates: { x: 40, y: 65 },
        icon: "fa-solid fa-campground",
        emoji: "🪵",
        atmosphere:
          "Pondok kayu sederhana berselimut lumut tempat Kakek Danu mengumpulkan getah resin damar wangi kristal bernilai tinggi.",
        facilities: ["tukar_getah_damar", "beli_kayu_akar_gelap", "cerita_pohon_tertua"],
      },
      {
        id: "lab_alkimis_embun",
        name: "Laboratorium Herbal & Rumah Kaca Embun",
        category: "workshop",
        residentNpcIds: ["embun_puri"],
        operatingHours: { start: 7, end: 22 },
        coordinates: { x: 75, y: 60 },
        icon: "fa-solid fa-flask",
        emoji: "🧪",
        atmosphere:
          "Rumah kaca beratap anyaman bambu dengan deretan toples spora jamur violet berpendar dan aroma seduhan teh herbal pemulih stamina.",
        facilities: ["racik_eliksir_embun", "seduh_teh_rimba", "penawar_racun_spora"],
      },
      {
        id: "altar_sumpah_rimba",
        name: "Altar Sumpah Penjaga Rimba",
        category: "mystery",
        residentNpcIds: ["raden_bram", "dara_rimba"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 80 },
        icon: "fa-solid fa-shield-heart",
        emoji: "🛡️",
        atmosphere:
          "Batu monolit purba berselimut lumut di bawah naungan pohon tertua Dha Mhai, menganugerahkan berkat perlindungan bagi mereka yang menghormati alam.",
        facilities: ["sumpah_penjaga_hutan", "buff_pertahanan_rimba", "meditasi_kanopi"],
      },
    ],
    items: [
      { name: "Resin Damar Purba Dha Mhai", emoji: "🧪", rarity: "Epik" },
      { name: "Madu Ratu Lebah Rimba", emoji: "🍯", rarity: "Langka" },
      { name: "Kayu Akar Gelap Dha Mhai", emoji: "🪵", rarity: "Tidak Biasa" },
      { name: "Jamur Spora Violet", emoji: "🍄", rarity: "Biasa" },
      { name: "Taring Babi Hutan Purba", emoji: "🐗", rarity: "Tidak Biasa" },
      { name: "Busur Akar Penjaga Rimba", emoji: "🏹", rarity: "Langka" },
      { name: "Jubah Daun Rimba", emoji: "🍃", rarity: "Langka" },
      { name: "Eliksir Embun Purba", emoji: "🧪", rarity: "Epik" },
      { name: "Kristal Spora Aether", emoji: "💎", rarity: "Epik" },
      { name: "Resep Teh Herbal Rimba Dha Mhai", emoji: "📜", rarity: "Langka" },
    ],
  },

  desa_lauh_than: {
    id: "desa_lauh_than",
    aliases: ["lauh_than", "desa_lauh_than", "dermaga_lauh_than", "pelabuhan_selatan", "pesisir_selatan"],
    name: "Desa Lauh Than",
    title: "Pesisir Samudra Selatan & Dermaga Ekspedisi Bawah Laut",
    primaryCurrency: "NSF & Koin Nelayan Laut Dalam",
    currencyCode: "starFragments",
    themeColor: "#0EA5E9",
    description:
      "Desa maritim tropis di pesisir selatan benua Aetheria dengan jajaran dermaga perahu kayu bercadik, pasar ikan asap rempah, dan gerbang menuju ekspedisi palung bawah laut.",
    pois: [
      {
        id: "dermaga_agung_lauh_than",
        name: "Dermaga Agung Lauh Than",
        category: "coastal",
        residentNpcIds: ["kapten_reza"],
        operatingHours: { start: 4, end: 22 },
        coordinates: { x: 50, y: 70 },
        icon: "fa-solid fa-anchor",
        emoji: "⚓",
        atmosphere:
          "Dermaga kayu jati ulin yang menjulang ke perairan biru jernih tempat bersandarnya kapal layar cadik dan perahu selam mini bertenaga Aether.",
        facilities: ["sewa_kapal_selam", "ekspedisi_samudra", "periksa_kondisi_cuaca_laut"],
      },
      {
        id: "balai_adat_nyai_bahari",
        name: "Balai Adat Samudra Nyai Bahari",
        category: "sanctuary",
        residentNpcIds: ["nyai_bahari"],
        operatingHours: { start: 6, end: 20 },
        coordinates: { x: 30, y: 50 },
        icon: "fa-solid fa-hands-holding-circle",
        emoji: "🧿",
        atmosphere:
          "Pendopo panggung beralas tikar pandan berhias kerang mutiara, tempat Nyai Bahari memimpin doa keselamatan laut dan merajut jimat ombak.",
        facilities: ["ritual_larung_laut", "beli_jimat_penolak_ombak", "berkah_dewi_samudra"],
      },
      {
        id: "pasar_ikan_rempah",
        name: "Pasar Ikan Asap & Kedai Mbok Darmi",
        category: "commercial",
        residentNpcIds: ["mbok_darmi"],
        operatingHours: { start: 6, end: 22 },
        coordinates: { x: 65, y: 55 },
        icon: "fa-solid fa-utensils",
        emoji: "🍲",
        atmosphere:
          "Aroma sedap ikan bakar bumbu rempah kelapa menyeruak di antara keriuhan tawar-menawar hasil tangkapan nelayan pesisir.",
        facilities: ["santap_ikan_bakar_rempah", "jual_hasil_pancing_laut", "beli_ransum_pelaut"],
      },
      {
        id: "pos_patroli_maritim",
        name: "Pos Patroli Keamanan Samudra",
        category: "security",
        residentNpcIds: ["laksamana_bayu"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 20, y: 65 },
        icon: "fa-solid fa-shield",
        emoji: "🛡️",
        atmosphere:
          "Menara pantau kayu berteleskop kuningan dengan teropong jarak jauh yang mengawasi pergerakan monster laut dan bajak laut liar.",
        facilities: ["lapor_ancaman_leviathan", "sayembara_monster_laut", "asuransi_kapal"],
      },
      {
        id: "gerbang_palung_bawah_laut",
        name: "Gerbang Palung Bawah Laut (Zone Portal)",
        category: "mystery",
        residentNpcIds: ["doro_penyelam", "kapten_reza"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 90 },
        icon: "fa-solid fa-water",
        emoji: "🤿",
        atmosphere:
          "Tepian tubir karang curam tempat arus laut dalam mengalir menuju palung samudra purba. Portal gerbang penyelaman bawah laut terdalam.",
        facilities: ["selam_palung_bebas", "buka_gerbang_portal_laut", "tukar_mutiara_hitam"],
      },
    ],
    items: [
      { name: "Mutiara Palung Hitam", emoji: "🦪", rarity: "Legendaris" },
      { name: "Ikan Naga Abyssal", emoji: "🐟", rarity: "Epik" },
      { name: "Jangkar Tempa Laut Selatan", emoji: "⚓", rarity: "Langka" },
      { name: "Rumput Laut Emas Pesisir", emoji: "🌿", rarity: "Biasa" },
      { name: "Sisik Predator Karang", emoji: "🛡️", rarity: "Tidak Biasa" },
      { name: "Trisula Karang Lauh Than", emoji: "🔱", rarity: "Langka" },
      { name: "Jimat Penolak Ombak", emoji: "🧿", rarity: "Epik" },
      { name: "Ikan Bakar Rempah Pesisir", emoji: "🍲", rarity: "Tidak Biasa" },
      { name: "Tabung Selam Aether Portabel", emoji: "🤿", rarity: "Epik" },
      { name: "Peta Rute Palung Bawah Laut", emoji: "🗺️", rarity: "Langka" },
    ],
  },

  istana_draken: {
    id: "istana_draken",
    aliases: ["draken", "istana_draken", "kastil_draken", "dungeon_draken"],
    name: "Istana Draken",
    title: "Benteng Kegelapan & Multi-Floor Dungeon Iblis",
    primaryCurrency: "Permata Terkutuk & Hadiah Mythic",
    currencyCode: "coupons",
    themeColor: "#EF4444",
    description:
      "Kastil iblis purba yang diselimuti kabut jurang The Neo-Abyss. Menampung labirin dungeon bertingkat tinggi (Lantai 1 - 50+) dengan hadiah kelas Mythic.",
    pois: [
      {
        id: "gerbang_draken",
        name: "Gerbang Neraka Draken",
        category: "combat",
        residentNpcIds: ["gargoyle_malakor"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 80 },
        icon: "fa-solid fa-skull",
        emoji: "🚪",
        atmosphere:
          "Pintu gerbang besi hitam bertabur tengkorak menyala dengan patung gargoyle batu yang siap menghabisi penyusup.",
        facilities: ["tantangan_gargoyle", "periksa_kelayakan_tim", "masuk_istana"],
      },
      {
        id: "labirin_bertingkat",
        name: "Labirin Bawah Tanah Bertingkat (Lantai 1 - 50+)",
        category: "dungeon",
        residentNpcIds: ["gargoyle_malakor"],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 50 },
        icon: "fa-solid fa-stairs",
        emoji: "🏰",
        atmosphere:
          "Lorong labirin berliku yang semakin dalam semakin berbahaya, dipenuhi iblis bayangan dan jebakan maut.",
        facilities: ["ekspedisi_lantai_bertingkat", "checkpoint_tangga", "boss_lantai_10"],
      },
      {
        id: "singgasana_draken",
        name: "Singgasana Penguasa Iblis Draken",
        category: "boss",
        residentNpcIds: [],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 50, y: 20 },
        icon: "fa-solid fa-crown",
        emoji: "👑",
        atmosphere:
          "Ruang aula beratap kubah hancur tempat World Boss Penguasa Draken menunggu para penantang terkuat.",
        facilities: ["raid_boss_draken", "klaim_air_mata_naga", "harmoni_abyss"],
      },
      {
        id: "khazanah_terkutuk",
        name: "Ruang Khazanah Terkutuk",
        category: "treasure",
        residentNpcIds: [],
        operatingHours: { start: 0, end: 24 },
        coordinates: { x: 75, y: 35 },
        icon: "fa-solid fa-gem",
        emoji: "💎",
        atmosphere:
          "Peti-peti perhiasan emas berlapis aura hitam tempat Hadiah Mythic dan senjata terkutuk terkunci rapi.",
        facilities: ["buka_peti_mythic", "tukar_permata_jiwa", "senjata_terkutuk"],
      },
    ],
    items: [
      { name: "Permata Terkutuk Draken", emoji: "💎", rarity: "Mythic" },
      { name: "Tanduk Iblis Malakor", emoji: "👿", rarity: "Epik" },
      { name: "Batu Lahar Vulkanik", emoji: "🌋", rarity: "Langka" },
      { name: "Pedang Api Kawah Hitam", emoji: "🗡️", rarity: "Legendaris" },
      { name: "Mahkota Abu Abyss", emoji: "👑", rarity: "Mythic" },
      { name: "Eliksir Darah Monster Kawah", emoji: "🧪", rarity: "Epik" },
      { name: "Rantai Besi Jiwa Gelap", emoji: "⛓️", rarity: "Langka" },
      { name: "Pecahan Jiwa Draken Purba", emoji: "🔮", rarity: "Mythic" },
      { name: "Tameng Tulang Gargoyle", emoji: "🛡️", rarity: "Legendaris" },
      { name: "Gulungan Sihir Kiamat Abyss", emoji: "📜", rarity: "Mythic" },
    ],
  },
};

/**
 * Mendapatkan data region berdasarkan nama atau alias
 * @param {string} key
 * @returns {object|null}
 */
function getRegion(key) {
  if (!key) return REGIONS.desa_sukamaju;
  const lower = String(key).toLowerCase().trim();

  for (const reg of Object.values(REGIONS)) {
    if (reg.id === lower) return reg;
    if (reg.aliases?.includes(lower)) return reg;
  }

  return null;
}

/**
 * Mendapatkan seluruh POI untuk region tertentu
 * @param {string} regionKey
 * @returns {Array<object>}
 */
function getPoisForRegion(regionKey) {
  const reg = getRegion(regionKey);
  return reg ? reg.pois : [];
}

/**
 * Mendapatkan detail POI tertentu
 * @param {string} poiId
 * @returns {object|null}
 */
function getPoiById(poiId) {
  const lower = String(poiId).toLowerCase().trim();
  for (const reg of Object.values(REGIONS)) {
    const found = reg.pois.find((p) => p.id === lower);
    if (found) return { ...found, regionId: reg.id, regionName: reg.name };
  }
  return null;
}

module.exports = {
  REGIONS,
  getRegion,
  getPoisForRegion,
  getPoiById,
};
