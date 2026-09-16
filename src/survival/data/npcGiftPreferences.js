"use strict";

/**
 * Tabel Preferensi Hadiah NPC Naura Wilds
 * Skala Relationship Points (RP):
 * - Disliked (Tidak Disukai) : -5 RP
 * - Simple   (Sederhana)      : +5 RP
 * - Special  (Spesial)        : +10 RP
 * - Loved    (Istimewa)       : +15 RP
 * - Mythic   (Hadiah Mythic)  : +25 RP (Drop langka Istana Draken & Desa Khul'Khas)
 */

const GIFT_TIERS = {
  DISLIKED: { rp: -5, label: "Tidak Disukai", key: "disliked" },
  SIMPLE: { rp: 5, label: "Sederhana", key: "simple" },
  SPECIAL: { rp: 10, label: "Spesial", key: "special" },
  LOVED: { rp: 15, label: "Istimewa", key: "loved" },
  MYTHIC: { rp: 25, label: "Mythic", key: "mythic" },
};

// Item mythic global yang disukai seluruh NPC karena kelangkaannya yang luar biasa
const GLOBAL_MYTHIC_ITEMS = [
  "draken_dragon_tear",
  "khulkhas_crystal_rose",
  "eternal_soul_gem",
  "astral_core_fragment",
  "celestial_elixir",
  "ancient_relic_shard",
];

// Item sampah / kotor yang dibenci sebagian besar NPC biasa
const COMMON_TRASH_ITEMS = [
  "trash",
  "dirty_stone",
  "rotten_bone",
  "stale_coffee",
  "broken_glass",
  "mud_clod",
];

const PREFERENCES = {
  // === DESA SUKAMAJU ===
  kades_tirto: {
    disliked: ["trash", "mud_clod", "stale_coffee"],
    simple: ["wood", "tea_leaf", "bread"],
    special: ["fine_tobacco", "coffee_beans", "rice_sack"],
    loved: ["ancient_chronicle", "village_heritage_seal", "premium_batik"],
    quotes: {
      disliked: "Waduh, anak muda... apa maksudmu memberikanku barang kotor seperti ini?",
      simple: "Terima kasih banyak, pemberian sederhana ini sudah cukup menghangatkan hati orang tua sepertiku.",
      special: "Wah, ini tembakau dan kopi yang sangat nikmat! Pas sekali untuk menemani jaga malam di balai desa.",
      loved: "Luar biasa! Dokumen sejarah desa ini sungguh tak ternilai harganya. Kamu sungguh warga teladan!",
      mythic: "Demi leluhur! Energi murni dari relik ini... kamu telah membawa keajaiban besar bagi Desa Sukamaju!",
    },
  },
  bagas: {
    disliked: ["wood", "flower", "perfume", "trash"],
    simple: ["coal", "stone", "copper_ore"],
    special: ["iron_ore", "steel_ingot", "blacksmith_oil"],
    loved: ["mithril_ingot", "titanium_hammer", "volcanic_core"],
    quotes: {
      disliked: "Hah?! Bunga dan ranting rapuh begini mau buat apa di bengkel tempa? Jangan bercanda!",
      simple: "Lumayan lah, bisa buat bahan bakar tungku perapian hari ini.",
      special: "Nah, ini baru barang bagus! Besi baja berkilau ini bakal kuubah jadi bilah tertajam!",
      loved: "MITHRIL?! Sungguh kamu memberikan ini padaku?! Tanganku sampai gemetar ingin segera memukul paron!",
      mythic: "Gila! Inti relik purba ini memancarkan panas yang sempurna! Senjata terbaik dalam hidupku akan lahir dari sini!",
    },
  },
  ningsih: {
    disliked: ["coal", "iron_ore", "axe", "trash", "dirty_stone"],
    simple: ["wild_flower", "water_flask", "apple"],
    special: ["sunflower_bouquet", "organic_fertilizer", "strawberry_basket"],
    loved: ["celestial_seed", "moonlight_orchid", "golden_watering_can"],
    quotes: {
      disliked: "Ih... kotor sekali. Kenapa kamu membawakanku batu berdebu dan sampah begini?",
      simple: "Wah, terima kasih! Bunga liar ini lucu sekali, akan kutanam di pot kecil.",
      special: "Buket bunga matahari yang cerah! Harumnya manis sekali, membuat semangat berkebunku berkobar!",
      loved: "Benih bunga surgawi?! Aku hanya pernah membacanya di buku dongeng... terima kasih banyak, ini sangat berharga!",
      mythic: "Bunga kristal legendaris ini... kelopaknya berkilau tanpa layu! Hatiku berbunga-bunga, kamu sangat istimewa bagiku!",
    },
  },
  bidan_sari: {
    disliked: ["weapon", "monster_claw", "poison", "trash"],
    simple: ["clean_bandage", "fresh_water", "honey"],
    special: ["medicinal_herb", "aloe_vera_salve", "chamomile_tea"],
    loved: ["miracle_ginseng", "vitality_crystal", "sanctuary_tincture"],
    quotes: {
      disliked: "Jangan letakkan benda tajam dan kotor ini di klinik! Bisa memicu infeksi pada pasien!",
      simple: "Terima kasih ya. Perban bersih selalu sangat dibutuhkan di klinik desa.",
      special: "Ramuan herbal dan salep lidah buaya yang harum! Ini sangat berkhasiat meredakan memar warga.",
      loved: "Ginseng ajaib seratus tahun?! Dengan ini, aku bisa meracik obat penawar untuk penyakit paling parah sekalipun!",
      mythic: "Energi murni yang menyucikan... bahkan luka terberat pun langsung pulih! Terima kasih telah melindungi klinik ini!",
    },
  },
  bu_ratna: {
    disliked: ["broken_pencil", "mud_clod", "trash"],
    simple: ["chalk", "notebook", "apple"],
    special: ["fountain_pen", "history_novel", "world_globe"],
    loved: ["encyclopedia_antica", "scholar_glasses", "ancient_poetry"],
    quotes: {
      disliked: "Sebagai orang terpelajar, kita harus menjaga kebersihan lingkungan. Simpan ini di tempat sampah ya.",
      simple: "Terima kasih atas perhatianmu. Buku catatan ini sangat berguna untuk materi pelajaran esok hari.",
      special: "Pena bertinta emas dan novel sejarah yang indah. Kamu punya selera sastra yang sangat bagus.",
      loved: "Ensiklopedia kuno yang lengkap! Ini adalah khazanah ilmu pengetahuan yang akan kuajarkan pada anak-anak desa.",
      mythic: "Pengetahuan kosmik yang tersimpan di dalam artefak ini sungguh melampaui batas buku pelajaran mana pun! Luar biasa!",
    },
  },
  budi: {
    disliked: ["vegetables", "medicine", "textbook"],
    simple: ["candy", "slingshot_ammo", "smooth_pebble"],
    special: ["wooden_slingshot", "chocolate_bar", "beetle_in_jar"],
    loved: ["golden_slingshot", "treasure_map_fragment", "rare_stag_beetle"],
    quotes: {
      disliked: "Heeeh! Gamau sayur pahit atau buku pelajaran! Nggak asyik!",
      simple: "Wah permen manis! Makasih ya Kak, nanti kalau ketemu ranting bagus kukabari!",
      special: "Kumbang capit besar dan cokelat lezat! Kakak memang yang paling keren di seluruh desa!",
      loved: "Peta harta karun sungguhan?! Ayo kita berburu harta karun rahasia di pinggir hutan, Kak!",
      mythic: "Batu bintang bercahaya?! Waaah, ini mainan paling sakti di dunia! Aku bakal jadi kapten petualang terhebat!",
    },
  },
  siti: {
    disliked: ["slimy_worm", "broken_toy", "trash"],
    simple: ["ribbon", "wild_flower", "cookie"],
    special: ["wooden_doll", "colored_crayons", "strawberry_milk"],
    loved: ["porcelain_music_box", "flowery_hairpin", "fairy_tale_book"],
    quotes: {
      disliked: "Iiiih geliiii! Jauhkan ulat dan barang kotor itu dariku!",
      simple: "Bunganya cantik sekali... terima kasih banyak ya Kakak baik.",
      special: "Boneka kayu yang imut dan susu stroberi segar! Siti suka banget!",
      loved: "Kotak musik porselen dengan alunan nada lembut... Siti akan menjaganya baik-baik di samping tempat tidur.",
      mythic: "Kelopak kristal bersinar yang hangat... Siti merasa seperti putri di negeri dongeng!",
    },
  },
  mang_ujang: {
    disliked: ["meat", "fire_crystal", "trash"],
    simple: ["earthworm", "seaweed", "dry_bread"],
    special: ["luminous_lure", "braided_fishing_line", "tuna_fillet"],
    loved: ["legendary_hook", "deep_sea_trench_map", "ancient_pearl"],
    quotes: {
      disliked: "Buat apa bawa bara panas ke atas perahu kayu? Mau kapalku terbakar ya?",
      simple: "Umpan cacing tanah yang lincah! Lumayan buat mancing ikan tawes di muara sungai.",
      special: "Umpan pancing bercahaya ini sangat disukai ikan laut dalam saat malam hari! Mantap!",
      loved: "Mata pancing legendaris dari tanduk naga laut! Ikan monster laut selatan pun pasti bisa kukait!",
      mythic: "Mutiara purba samudera raya! Air laut seolah bernyanyi saat menyentuhnya... tangkapan terakbar seumur hidup!",
    },
  },
  tari: {
    disliked: ["heavy_armor", "dusty_stone", "trash"],
    simple: ["seashell", "coconut_water", "dried_fish"],
    special: ["diving_goggles", "coral_necklace", "sea_turtle_shell"],
    loved: ["black_abyss_pearl", "mermaid_scale", "aqua_ring"],
    quotes: {
      disliked: "Baju besi berat begini bikin orang tenggelam di laut tahu! Nggak mau!",
      simple: "Segar! Air kelapa muda pas banget diminum sehabis menyelam ke dasar terumbu karang.",
      special: "Kalung karang laut yang keren! Kamu tahu persis apa yang kusukai dari birunya lautan bebas.",
      loved: "Mutiara hitam palung laut?! Gila, ini langka banget! Ayo berenang dan menyelam bersamaku sekarang!",
      mythic: "Sisik naga laut abadi! Energi ombak bergelora di sekitarnya... kamu penyelam dan pasangan petualang terbaikku!",
    },
  },
  kang_jajang: {
    disliked: ["flower", "perfume", "water_flask"],
    simple: ["pickaxe_handle", "bread", "stone"],
    special: ["gold_nugget", "dynamite", "energy_drink"],
    loved: ["diamond", "flawless_emerald", "adamantine_pickaxe"],
    quotes: {
      disliked: "Wewangian begini langsung hilang kena debu tambang, bro. Nggak guna di bawah tanah.",
      simple: "Gagang beliung cadangan, lumayan buat jaga-jaga kalau alatku patah menghantam batu keras.",
      special: "Sebongkah emas murni dan minuman penambah stamina! Kerjaku di terowongan bakal ngebut hari ini!",
      loved: "BERLIAN KILAU PENUH?! Rezeki nomplok! Mataku sampai silau melihat kemilau murni ini!",
      mythic: "Kristal resonansi inti bumi! Urat tambang terdalam pun tunduk pada energi dahsyat ini!",
    },
  },
  kang_deden: {
    disliked: ["trash", "mud_clod", "broken_tool"],
    simple: ["torch", "bandage", "hard_bread"],
    special: ["heavy_sledgehammer", "silver_ore", "mining_helmet"],
    loved: ["ruby_cluster", "seismic_sensor", "hardened_carbide_drill"],
    quotes: {
      disliked: "Peralatan rongsokan jangan dibawa ke area tambang, bahaya memicu longsor!",
      simple: "Obor cadangan dan roti keras, teman setia waktu terjebak di lorong gelap.",
      special: "Palu godam berat dan helm pengaman kokoh! Menambang jadi jauh lebih aman dan bertenaga.",
      loved: "Bongkahan rubi merah menyala! Jam terbang puluhan tahunku di tambang terbayar lunas dengan hadiah ini!",
      mythic: "Mata bor karbida berdaya kristal kosmik! Batu granit terkeras pun bakal hancur jadi remahan!",
    },
  },
  ki_prawiro: {
    disliked: ["animal_cage", "whip", "trash"],
    simple: ["raw_meat", "bird_seed", "forest_berry"],
    special: ["beast_flute", "taming_pouch", "honeycomb"],
    loved: ["dragon_kin_horn", "phoenix_feather", "sacred_collar"],
    quotes: {
      disliked: "Kandang besi dan cambuk adalah penghinaan bagi jiwa satwa bebas! Singkirkan dari pandanganku!",
      simple: "Biji-bijian hutan yang segar, burung-burung liar di dahan pasti senang menikmatinya.",
      special: "Seruling pemanggil satwa liar dengan nada merdu... hewan-hewan buas pun akan tenang mendengarnya.",
      loved: "Bulu burung phoenix abadi! Kehangatan alaminya mampu menjinakkan monster paling ganas sekalipun.",
      mythic: "Tanduk ras naga purba! Jiwa para raja rimba bersujud dengan takzim di hadapan karismamu!",
    },
  },
  gatot: {
    disliked: ["sweet_candy", "makeup", "trash"],
    simple: ["protein_bar", "bandage", "whetstone"],
    special: ["battle_axe", "stout_shield", "monster_core"],
    loved: ["dragon_slayer_blade", "titan_armor_plate", "champion_belt"],
    quotes: {
      disliked: "Permen manis dan kosmetik bukan urusan penjaga gerbang gua! Jangan buang waktuku.",
      simple: "Batu asah untuk menajamkan mata pedang. Berguna untuk persiapan patroli dungeon.",
      special: "Inti monster padat dan perisai baja tebal! Nyalimu lumayan juga bisa mengamankan barang ini.",
      loved: "Bilah pedang pembantai naga! Darah petarungku mendidih melihat senjata sejati seperti ini!",
      mythic: "Inti teror purba yang tersegel! Kamu telah membuktikan dirimu layak menjadi pahlawan terkuat dungeon!",
    },
  },
  mbak_siti: {
    disliked: ["chemicals", "stale_drink", "trash"],
    simple: ["ginger", "turmeric", "fresh_milk"],
    special: ["wild_honey", "clay_pitcher", "lemongrass_bundle"],
    loved: ["royal_jelly", "golden_curcuma", "traditional_batik_selendang"],
    quotes: {
      disliked: "Waduh Mas/Mbak, jamu itu harus alami, jangan dicampur bahan kimia aneh begini ya.",
      simple: "Matur nuwun sanget, jahe dan kunyit segar ini pas sekali untuk racikan jamu beras kencur esok pagi.",
      special: "Madu hutan murni dan kendi tanah liat yang sejuk! Jamu racikanku dijamin tambah mantap dan berkhasiat!",
      loved: "Royal jelly lebah ratu dan selendang batik halus! Manis sekali perhatianmu, hatiku jadi adem ayem...",
      mythic: "Temulawak emas mustika yang mekar seabad sekali! Stamina dan daya tahan tubuh takkan pernah surut!",
    },
  },

  // === KOTA PRATAMA ===
  laras: {
    disliked: ["instant_coffee", "bitter_water", "trash"],
    simple: ["coffee_beans", "cinnamon_stick", "fresh_milk"],
    special: ["espresso_blend", "dark_chocolate", "caramel_syrup"],
    loved: ["luwak_coffee_reserve", "artisan_coffee_machine", "music_box"],
    quotes: {
      disliked: "Kopi saset instan berpengawet begini? Maaf, kafenya mengutamakan cita rasa seduhan murni.",
      simple: "Biji kopi segar dan batang kayu manis! Wanginya pas untuk menu seduhan pagi di kafe.",
      special: "Espresso roast blend dan dark chocolate murni! Pasangan yang sempurna untuk menemani obrolan senja.",
      loved: "Biji kopi luwak cadangan khusus dan kotak musik klasik... kamu tahu betul cara membuat hatiku luluh.",
      mythic: "Biji kopi surga dari pohon kosmik! Setiap tegukannya mengalirkan ketenangan batin yang tiada tara!",
    },
  },
  wulan: {
    disliked: ["burned_paper", "loud_horn", "trash"],
    simple: ["blank_notebook", "quill_pen", "bookmark"],
    special: ["vintage_novel", "scented_candle", "historical_map"],
    loved: ["lost_astral_codex", "antique_reading_glasses", "silk_bookmark"],
    quotes: {
      disliked: "Jangan merusak kertas atau membawa barang kotor ke dalam perpustakaan... buku-buku ini rapuh.",
      simple: "Pembatas buku dan buku catatan polos... terima kasih, aku selalu butuh tempat mencatat ide baru.",
      special: "Novel klasik edisi pertama dan lilin aromaterapi! Membaca di bawah temaram lilin ini sungguh menenangkan...",
      loved: "Kodeks Astral Kuno yang hilang?! Tanganku gemetar... ini naskah berharga yang kucari bertahun-tahun! Terima kasih, sayang...",
      mythic: "Manuskrip penciptaan dimensi yang utuh! Seluruh rahasia dunia kini terbuka untuk kita pelajari bersama selamanya!",
    },
  },
  suster_maya: {
    disliked: ["junk_food", "germ_vial", "trash"],
    simple: ["disinfectant", "cotton_swab", "fruit_basket"],
    special: ["stethoscope", "vitamin_complex", "thermal_flask"],
    loved: ["nano_healing_injector", "pure_aloe_elixir", "warm_cardigan"],
    quotes: {
      disliked: "Makanan berminyak dan barang kotor begini dilarang keras di ruang perawatan! Bawa keluar!",
      simple: "Kapas dan cairan disinfektan. Hmph, setidaknya kamu peduli dengan kebersihan dasar rumah sakit.",
      special: "Termos hangat dan suplemen vitamin lengkap... b-bukan berarti aku senang ya, tapi ini memang membantu saat shift malam.",
      loved: "Injektor medis nano dan kardigan rajut hangat... kamu selalu tahu saat aku kedinginan dan kelelahan. Terima kasih ya...",
      mythic: "Elixir suci yang menyembuhkan segala racun tanpa residu! Kamu adalah keajaiban medis terbesar dalam hidupku!",
    },
  },
  mbak_rini: {
    disliked: ["fake_coin", "counterfeit_gem", "trash"],
    simple: ["silver_coin", "ledger_book", "silk_cloth"],
    special: ["rare_gemstone", "vintage_wine", "auction_gavel"],
    loved: ["diamond_necklace", "black_market_ledger", "golden_bullion"],
    quotes: {
      disliked: "Barang tiruan murah begini berani kamu bawa ke balai lelangku? Jangan menguji kesabaranku, sayang.",
      simple: "Koin perak dan buku kas baru. Sederhana, tapi dalam bisnis, setiap keping berharga.",
      special: "Batu permata langka dan anggur antik! Pilihan yang sangat berkelas, kamu tahu cara memanjakan seleraku.",
      loved: "Kalung berlian murni dan sebatang emas batangan! Kamu bukan cuma mitra bisnis terbaik, tapi pemilik sejati hatiku...",
      mythic: "Batu intan bintang berdimensi sembilan! Nilainya sanggup membeli seluruh distrik perkotaan! Kamu sungguh pria luar biasa!",
    },
  },
  shino_hoshino: {
    disliked: ["boring_stone", "dusty_relic", "trash"],
    simple: ["boba_tea", "cute_sticker", "trendy_snack"],
    special: ["smartphone_gadget", "cyber_earphone", "designer_handbag"],
    loved: ["quantum_hologram_projector", "naura_limited_plushie", "celestial_coupon"],
    quotes: {
      disliked: "Iih batu berdebu begini gak aesthetic banget deh! Ga mau simpan di kamarku!",
      simple: "Boba milk tea manis! Asyik, pas banget diminum sambil scrolling timeline sosmed!",
      special: "Earphone nirkabel cyber dan tas desainer modis! Keren banget, Kakak memang tahu gaya masa kini!",
      loved: "Boneka Naura limited edition dan proyektor hologram! Lucu banget, gemas! Kakak yang terbaik sedunia!",
      mythic: "Kupon kosmik berdaya dimensi tak terbatas! Kita bisa belanja sepuasnya melintasi galaksi bersama!",
    },
  },
  bupati_rahmat: {
    disliked: ["contraband", "tax_evasion_paper", "trash"],
    simple: ["newspaper", "black_coffee", "fountain_pen"],
    special: ["city_blueprint", "fine_watch", "governance_medal"],
    loved: ["charter_of_alliance", "executive_fountain_pen", "golden_seal"],
    quotes: {
      disliked: "Barang selundupan ilegal?! Petugas, amankan orang ini! Pemerintahan Kota Pratama tidak mentolerir kecurangan!",
      simple: "Koran harian dan kopi hitam pekat. Cukup untuk mengawali rapat paripurna pagi ini.",
      special: "Cetak biru tata kota dan jam tangan elegan. Sikap visioner seperti inilah yang kita butuhkan di Kota Pratama.",
      loved: "Piagam aliansi antar-wilayah dengan segel emas murni! Kamu telah menyatukan desa dan kota menjadi satu kekuatan besar!",
      mythic: "Mahkota kedaulatan dimensi! Simbol kepemimpinan tertinggi yang akan menyejahterakan seluruh rakyat kita!",
    },
  },
  bripka_agus: {
    disliked: ["illegal_goods", "lockpick", "trash"],
    simple: ["black_coffee", "fried_tofu", "flashlight"],
    special: ["handcuffs", "tactical_vest", "patrol_whistle"],
    loved: ["police_honor_badge", "night_vision_goggles", "custom_revolver_holster"],
    quotes: {
      disliked: "Bawa obeng pembobol dan barang mencurigakan? Mau ikut saya ke kantor polisi untuk diperiksa?",
      simple: "Kopi hitam dan tahu goreng hangat. Nikmat sekali untuk teman ronda malam keliling pos sektor.",
      special: "Rompi taktis anti-peluru dan peluit patroli baru. Perlengkapan dinasku jadi makin lengkap dan siap siaga!",
      loved: "Lencana kehormatan kepolisian tingkat tinggi! Suatu kebanggaan luar biasa mengawal kota bersama petualang sepertimu!",
      mythic: "Alat pemindai kejahatan berfrekuensi kuantum! Tidak akan ada lagi kejahatan yang lolos dari radar keadilan kita!",
    },
  },
  pak_damar: {
    disliked: ["broken_wheel", "counterfeit_coin", "trash"],
    simple: ["dry_ration", "sturdy_rope", "compass"],
    special: ["caravan_camel_bell", "spices_pouch", "silk_roll"],
    loved: ["intercity_merchant_license", "golden_abacus", "exotic_spice_crate"],
    quotes: {
      disliked: "Roda gerobak pecah begini mau dijual padaku? Jangan buang waktu pedagang keliling, sobat.",
      simple: "Tali tambang kokoh dan kompas. Barang wajib sebelum karavan dagang menembus badai gurun.",
      special: "Kantung rempah-rempah eksotis dan kain sutra halus! Laku keras kalau kujual ke pasar perkotaan!",
      loved: "Sempoa emas dan lisensi dagang antar-dimensi! Bersamamu, karavan ini akan menguasai jalur perdagangan dunia!",
      mythic: "Peti harta karun relik saudagar legenda! Keuntungan tanpa batas seumur hidup ada di genggaman kita!",
    },
  },
  prof_habibie: {
    disliked: ["broken_gear", "unscientific_superstition", "trash"],
    simple: ["empty_vial", "graph_paper", "lens"],
    special: ["quantum_battery", "oscillator", "astronomy_prism"],
    loved: ["antimatter_capsule", "dimension_theory_thesis", "tachyon_core"],
    quotes: {
      disliked: "Ini cuma rongsokan tanpa nilai riset! Jangan mengotori laboratorium fisika dengan sampah.",
      simple: "Kertas grafik dan tabung kaca bersih. Berguna untuk mencatat perhitungan kalkulus presisi.",
      special: "Prisma astronomi dan baterai kuantum berdaya stabil! Eksperimen gelombang dimensi kita menunjukkan lonjakan positif!",
      loved: "Kapsul materi gelap dan tesis dimensi terlengkap! Teori relativitas baru telah terbukti lewat temuanmu, anak muda!",
      mythic: "Inti tachyon murni yang menembus kecepatan cahaya! Kita baru saja menulis ulang hukum alam semesta!",
    },
  },
  ki_ageng_joyo: {
    disliked: ["synthetic_pills", "plastic", "trash"],
    simple: ["forest_root", "spring_water", "mushroom"],
    special: ["spirit_herb", "mystic_incense", "alchemical_cauldron"],
    loved: ["mandragora_root", "astral_dewdrop", "philosopher_stone_fragment"],
    quotes: {
      disliked: "Bahan sintetis buatan pabrik hanya akan merusak keseimbangan cakra alamiah tubuh. Buang jauh-jauh.",
      simple: "Akar pohon hutan dan air mata air segar. Alam menyediakan segalanya bagi mereka yang bersyukur.",
      special: "Kemenyan dupa mistis dan kuali perunggu alkimia. Asapnya wangi dan menenangkan roh-roh penjaga hutan.",
      loved: "Akar mandragora bernyawa dan embun astral murni! Ramuan keabadian yang tersembunyi berabad-abad kini bisa diracik!",
      mythic: "Pecahan batu bertuah para dewa! Harmoni semesta bergetar di telapak tangan ini... kamu diberkati alam, muridku!",
    },
  },
  gaston: {
    disliked: ["police_badge", "customs_paper", "trash"],
    simple: ["cigarette", "dark_cloth", "iron_file"],
    special: ["lockpick_set", "smuggled_rum", "unmarked_gold_bar"],
    loved: ["black_market_masterkey", "contraband_manifest", "shadow_cloak"],
    quotes: {
      disliked: "Lencana polisi?! Kamu intel mau jebak aku ya? Simpan atau kita berdua bakal bermasalah!",
      simple: "Sebatang rokok dan kain hitam penyamaran. Lumayan buat menenangkan saraf sebelum beroperasi malam.",
      special: "Rum selundupan kelas atas dan set kunci pembobol presisi. Hehe, kamu memang punya bakat di dunia hitam, sobat.",
      loved: "Kunci master pasar gelap dan jubah bayangan! Pintu mana pun di dunia bawah tanah sekarang bisa kutembus!",
      mythic: "Mata uang bayangan kuno yang tak terlacak sindikat mana pun! Bersamamu, kita adalah raja penyelundup sejati!",
    },
  },
  mayor_lucy: {
    disliked: ["rusty_blade", "white_flag", "trash"],
    simple: ["ration_pack", "military_canteen", "gun_oil"],
    special: ["tactical_binoculars", "combat_knife", "recon_drone"],
    loved: ["officer_saber", "high_command_medal", "border_defense_cannon"],
    quotes: {
      disliked: "Bendera putih tanda menyerah?! Pasukan perbatasan tidak kenal kata mundur! Singkirkan kain itu!",
      simple: "Ransum militer kaleng dan minyak pelumas senjata. Kebutuhan pokok setiap prajurit di garis depan.",
      special: "Teropong bidik taktis dan pisau komando baja hitam! Pengawasan pos perbatasan jadi jauh lebih tajam.",
      loved: "Pedang perwira berukir kehormatan dan medali komando tinggi! Hormat senjata untuk sekutu terbaik garis depan!",
      mythic: "Meriam pertahanan berdaya tembak inti surya! Tidak akan ada satu pun monster Abyss yang mampu menembus batas ini!",
    },
  },
};

/**
 * Menilai kategori dan efek Relationship Points (RP) dari hadiah yang diberikan
 * @param {string} npcId - ID NPC penerima
 * @param {string} itemId - ID Item yang diberikan
 * @returns {{ tier: string, rp: number, quote: string, label: string }}
 */
function evaluateGift(npcId, itemId) {
  const normNpc = String(npcId || "").toLowerCase();
  const normItem = String(itemId || "").toLowerCase();

  // 1. Cek Hadiah Mythic Global
  if (GLOBAL_MYTHIC_ITEMS.includes(normItem)) {
    const quote =
      PREFERENCES[normNpc]?.quotes?.mythic ||
      "Luar biasa! Energi murni dari benda legendaris ini sungguh tak ternilai harganya!";
    return {
      tier: GIFT_TIERS.MYTHIC.key,
      rp: GIFT_TIERS.MYTHIC.rp,
      quote,
      label: GIFT_TIERS.MYTHIC.label,
    };
  }

  // 2. Cek Sampah Umum jika tidak terdaftar khusus
  if (COMMON_TRASH_ITEMS.includes(normItem)) {
    const quote =
      PREFERENCES[normNpc]?.quotes?.disliked ||
      "Ugh... barang kotor seperti ini kenapa diberikan padaku?";
    return {
      tier: GIFT_TIERS.DISLIKED.key,
      rp: GIFT_TIERS.DISLIKED.rp,
      quote,
      label: GIFT_TIERS.DISLIKED.label,
    };
  }

  const pref = PREFERENCES[normNpc];
  if (!pref) {
    // Fallback netral untuk NPC yang belum memiliki preferensi detail
    return {
      tier: GIFT_TIERS.SIMPLE.key,
      rp: GIFT_TIERS.SIMPLE.rp,
      quote: "Terima kasih atas pemberianmu yang baik hati ini.",
      label: GIFT_TIERS.SIMPLE.label,
    };
  }

  // 3. Cek Spesifik Disliked
  if (pref.disliked?.includes(normItem)) {
    return {
      tier: GIFT_TIERS.DISLIKED.key,
      rp: GIFT_TIERS.DISLIKED.rp,
      quote: pref.quotes?.disliked || "Aku tidak menyukai barang seperti ini.",
      label: GIFT_TIERS.DISLIKED.label,
    };
  }

  // 4. Cek Spesifik Loved
  if (pref.loved?.includes(normItem)) {
    return {
      tier: GIFT_TIERS.LOVED.key,
      rp: GIFT_TIERS.LOVED.rp,
      quote: pref.quotes?.loved || "Ini luar biasa! Aku sangat menyukainya!",
      label: GIFT_TIERS.LOVED.label,
    };
  }

  // 5. Cek Spesifik Special
  if (pref.special?.includes(normItem)) {
    return {
      tier: GIFT_TIERS.SPECIAL.key,
      rp: GIFT_TIERS.SPECIAL.rp,
      quote: pref.quotes?.special || "Hadiah yang sangat indah, terima kasih banyak!",
      label: GIFT_TIERS.SPECIAL.label,
    };
  }

  // 6. Cek Spesifik Simple
  if (pref.simple?.includes(normItem)) {
    return {
      tier: GIFT_TIERS.SIMPLE.key,
      rp: GIFT_TIERS.SIMPLE.rp,
      quote: pref.quotes?.simple || "Pemberian yang sederhana namun manis, terima kasih.",
      label: GIFT_TIERS.SIMPLE.label,
    };
  }

  // 7. Default Simple untuk barang inventaris wajar lainnya
  return {
    tier: GIFT_TIERS.SIMPLE.key,
    rp: GIFT_TIERS.SIMPLE.rp,
    quote: pref.quotes?.simple || "Terima kasih atas pemberianmu.",
    label: GIFT_TIERS.SIMPLE.label,
  };
}

module.exports = {
  GIFT_TIERS,
  GLOBAL_MYTHIC_ITEMS,
  COMMON_TRASH_ITEMS,
  PREFERENCES,
  evaluateGift,
};
