"use strict";

const redisManager = require("../managers/redisManager");

/**
 * Dataset 22 Kartu Arkana Mayor (Major Arcana) dengan filosofi kosmik,
 * arketipe, elemen, dan buff gameplay Naura Wilds (24 Jam).
 */
const MAJOR_ARCANA_CARDS = [
  {
    id: "the_fool",
    number: 0,
    name: "The Fool",
    title: "Sang Pengelana Kosmik",
    archetype: "Awal Baru & Potensi Murni",
    element: "Udara / Uranus",
    emoji: "🎒",
    uprightMeaning: "Awal baru yang penuh keberanian, rasa ingin tahu yang tak terbatas, dan petualangan segar.",
    reversedMeaning: "Kecerobohan atau keraguan melangkah maju ke dalam misteri yang belum terpetakan.",
    buff: { id: "wanderer_stride", name: "Langkah Petualang", type: "exp_boost", bonusPercent: 20, durationHours: 24, description: "Bonus +20% EXP Petualangan selama 24 jam" },
    reversedBuff: { id: "risk_ward", name: "Penjaga Langkah", type: "stamina_regen", bonusPercent: 15, durationHours: 24, description: "Bonus +15% Regenerasi Stamina dari kehati-hatian" },
  },
  {
    id: "the_magician",
    number: 1,
    name: "The Magician",
    title: "Sang Alkemis Bintang",
    archetype: "Manifestasi & Penguasaan",
    element: "Merkurius / Api",
    emoji: "🪄",
    uprightMeaning: "Kekuatan kreasi murni, konsentrasi tekad, dan kemampuan mengubah potensi menjadi kenyataan.",
    reversedMeaning: "Potensi tersembunyi yang belum terasah atau manipulasi energi yang kurang terarah.",
    buff: { id: "alchemist_craft", name: "Keahlian Alkemis", type: "crit_craft", bonusPercent: 25, durationHours: 24, description: "Bonus +25% Peluang Keberhasilan Crafting Kritis" },
    reversedBuff: { id: "stamina_efficiency", name: "Konsentrasi Hemat", type: "stamina_efficiency", bonusPercent: 20, durationHours: 24, description: "Efisiensi Stamina: konsumsi stamina berkurang 20%" },
  },
  {
    id: "the_high_priestess",
    number: 2,
    name: "The High Priestess",
    title: "Sang Penjaga Misteri",
    archetype: "Intuisi & Misteri Batin",
    element: "Air / Bulan",
    emoji: "🌙",
    uprightMeaning: "Intuisi tajam, rahasia batiniah, dan pemahaman mendalam tanpa perlu terucap kata.",
    reversedMeaning: "Mengabaikan bisikan suara hati atau terjebak dalam rahasia yang menyesakkan.",
    buff: { id: "mystic_insight", name: "Wawasan Mistis", type: "luck_boost", bonusPercent: 25, durationHours: 24, description: "Bonus +25% Keberuntungan Drop Langka & Rahasia" },
    reversedBuff: { id: "inner_clarity", name: "Keheningan Batin", type: "exp_boost", bonusPercent: 15, durationHours: 24, description: "Bonus +15% EXP dari kejernihan pikiran" },
  },
  {
    id: "the_empress",
    number: 3,
    name: "The Empress",
    title: "Bunda Kelimpahan",
    archetype: "Kesuburan & Kelimpahan Alam",
    element: "Bumi / Venus",
    emoji: "🌸",
    uprightMeaning: "Kesuburan alam, panen melimpah ruah, kehangatan empati, dan cinta kasih kosmik.",
    reversedMeaning: "Kelalaian dalam merawat potensi diri atau rasa haus materi yang berlebihan.",
    buff: { id: "abundant_harvest", name: "Berkah Kelimpahan", type: "harvest_yield", bonusPercent: 30, durationHours: 24, description: "Bonus +30% Hasil Panen Kebun Hidroponik" },
    reversedBuff: { id: "gentle_nourish", name: "Nutrisi Lembut", type: "stamina_regen", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Pemulihan Stamina Saat Istirahat" },
  },
  {
    id: "the_emperor",
    number: 4,
    name: "The Emperor",
    title: "Sang Pelindung Wilayah",
    archetype: "Otoritas, Struktur & Kontrol",
    element: "Api / Aries",
    emoji: "👑",
    uprightMeaning: "Stabilitas kokoh, kepemimpinan bijak, ketertiban hukum, dan ketahanan tak tergoyahkan.",
    reversedMeaning: "Kekakuan aturan atau keraguan dalam mengambil tanggung jawab kepemimpinan.",
    buff: { id: "iron_command", name: "Wibawa Pemimpin", type: "tax_discount", bonusPercent: 25, durationHours: 24, description: "Diskon 25% Pajak Transaksi Pasar & Toko" },
    reversedBuff: { id: "resilient_guard", name: "Ketahanan Perisai", type: "dungeon_shield", bonusPercent: 15, durationHours: 24, description: "Pertahanan Tambahan +15% di Dungeon" },
  },
  {
    id: "the_hierophant",
    number: 5,
    name: "The Hierophant",
    title: "Guru Tradisi Astral",
    archetype: "Kebijaksanaan & Tradisi",
    element: "Bumi / Taurus",
    emoji: "📜",
    uprightMeaning: "Kebijaksanaan tradisi, pembelajaran nilai-nilai luhur, dan bimbingan mentor sejati.",
    reversedMeaning: "Keterikatan dogma lama yang mengekang atau kebutuhan untuk menemukan jalan sendiri.",
    buff: { id: "astral_wisdom", name: "Bimbingan Leluhur", type: "exp_boost", bonusPercent: 20, durationHours: 24, description: "Bonus +20% EXP Belajar & Eksplorasi" },
    reversedBuff: { id: "sacred_blessing", name: "Restu Batin", type: "all_buffs", bonusPercent: 10, durationHours: 24, description: "Penguatan +10% Efektivitas Semua Buff Aktif" },
  },
  {
    id: "the_lovers",
    number: 6,
    name: "The Lovers",
    title: "Dua Takdir Selaras",
    archetype: "Harmoni, Ikatan & Pilihan",
    element: "Udara / Gemini",
    emoji: "💖",
    uprightMeaning: "Harmoni hubungan, pilihan dari lubuk hati, kemitraan erat, dan penyatuan visi hidup.",
    reversedMeaning: "Konflik batin dalam memilih arah atau ketidakselarasan komunikasi antar mitra.",
    buff: { id: "soul_resonance", name: "Resonansi Jiwa", type: "friendship_bonus", bonusPercent: 30, durationHours: 24, description: "Bonus +30% Poin Hubungan dan Afeksi Teman/NPC" },
    reversedBuff: { id: "coop_harmony", name: "Harmoni Kerjasama", type: "luck_boost", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Keberuntungan Drop Saat Bermain Bersama" },
  },
  {
    id: "the_chariot",
    number: 7,
    name: "The Chariot",
    title: "Kereta Penakluk Badai",
    archetype: "Tekad Kuat & Kemenangan",
    element: "Air / Cancer",
    emoji: "⚡",
    uprightMeaning: "Kemenangan melalui tekad baja, fokus mengatasi rintangan, dan momentum gerak maju.",
    reversedMeaning: "Kehilangan kendali arah atau dorongan agresif yang perlu diredam dengan ketenangan.",
    buff: { id: "unstoppable_drive", name: "Laju Kemenangan", type: "dungeon_atk", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Serangan Tempur Lawan Monster & Boss" },
    reversedBuff: { id: "swift_travel", name: "Laju Gesit", type: "stamina_efficiency", bonusPercent: 25, durationHours: 24, description: "Penghematan 25% Biaya Stamina Perjalanan" },
  },
  {
    id: "strength",
    number: 8,
    name: "Strength",
    title: "Kelembutan yang Menjinakkan",
    archetype: "Keberanian Batin & Kasih Sayang",
    element: "Api / Leo",
    emoji: "🦁",
    uprightMeaning: "Kekuatan sejati yang lahir dari kesabaran, pengendalian emosi, dan keteguhan welas asih.",
    reversedMeaning: "Keraguan pada kekuatan diri sendiri atau gejolak kemarahan sesaat.",
    buff: { id: "inner_fortitude", name: "Keteguhan Kalbu", type: "dungeon_atk", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Daya Serang Dungeon & Coliseum" },
    reversedBuff: { id: "patient_shield", name: "Perisai Kesabaran", type: "hp_shield", bonusPercent: 25, durationHours: 24, description: "Pelindung Tambahan +25 Ketahanan Vitalitas" },
  },
  {
    id: "the_hermit",
    number: 9,
    name: "The Hermit",
    title: "Pencari Cahaya Sejati",
    archetype: "Pencarian Kebenaran & Introspeksi",
    element: "Bumi / Virgo",
    emoji: "🏮",
    uprightMeaning: "Kontemplasi sunyi, introspeksi menemukan jati diri, dan lentera penerang jalan setapak.",
    reversedMeaning: "Isolasi yang terlalu menutup diri atau keengganan mendengarkan keheningan batin.",
    buff: { id: "hermit_lantern", name: "Lentera Sunyi", type: "mining_luck", bonusPercent: 25, durationHours: 24, description: "Bonus +25% Hasil Tambang Bijih & Kristal" },
    reversedBuff: { id: "quiet_reflection", name: "Meditasi Batin", type: "stamina_regen", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Pemulihan Stamina Saat Offline" },
  },
  {
    id: "wheel_of_fortune",
    number: 10,
    name: "Wheel of Fortune",
    title: "Roda Takdir Kosmik",
    archetype: "Perputaran Siklus & Keberuntungan",
    element: "Api / Jupiter",
    emoji: "🎡",
    uprightMeaning: "Putaran takdir yang menguntungkan, takdir baik, titik balik kehidupan, dan siklus rezeki.",
    reversedMeaning: "Perubahan tak terduga yang menuntut adaptasi cepat dan ketabahan hati.",
    buff: { id: "fortune_turn", name: "Keberuntungan Bintang", type: "nsf_boost", bonusPercent: 35, durationHours: 24, description: "Bonus +35% Perolehan Star Fragments (NSF)" },
    reversedBuff: { id: "karma_rebound", name: "Pembalikan Takdir", type: "luck_boost", bonusPercent: 20, durationHours: 24, description: "Jaminan Pembalikan Keberuntungan Setelah Gagal" },
  },
  {
    id: "justice",
    number: 11,
    name: "Justice",
    title: "Timbangan Kebenaran",
    archetype: "Keseimbangan Karma & Kejujuran",
    element: "Udara / Libra",
    emoji: "⚖️",
    uprightMeaning: "Kejujuran mutlak, keputusan yang adil, sebab-akibat karma, dan integritas tak ternilai.",
    reversedMeaning: "Ketidakadilan yang dirasakan atau keengganan menerima konsekuensi tindakan.",
    buff: { id: "karmic_balance", name: "Keseimbangan Karma", type: "nsf_boost", bonusPercent: 20, durationHours: 24, description: "Bebas Biaya Transaksi Escrow Pasar & +20% NSF" },
    reversedBuff: { id: "fair_valuation", name: "Taksiran Adil", type: "gold_boost", bonusPercent: 15, durationHours: 24, description: "Bonus +15% Nilai Jual Barang Bekas" },
  },
  {
    id: "the_hanged_man",
    number: 12,
    name: "The Hanged Man",
    title: "Sang Pengubah Sudut Pandang",
    archetype: "Pengorbanan & Sudut Pandang Baru",
    element: "Air / Neptunus",
    emoji: "🧘",
    uprightMeaning: "Melihat dunia dari perspektif terbalik, jeda sejenak untuk pencerahan, dan kerelaan.",
    reversedMeaning: "Penundaan tanpa tujuan atau keengganan melepaskan hal-hal yang telah usang.",
    buff: { id: "zen_perspective", name: "Kedalaman Persepsi", type: "exp_boost", bonusPercent: 30, durationHours: 24, description: "Bonus +30% Hasil Menunggu & Aktivitas Santai" },
    reversedBuff: { id: "open_enlightenment", name: "Pencerahan Baru", type: "stamina_efficiency", bonusPercent: 20, durationHours: 24, description: "Diskon 20% Biaya Stamina Aktivitas Baru" },
  },
  {
    id: "death",
    number: 13,
    name: "Death",
    title: "Transformasi Kelahiran Baru",
    archetype: "Transformasi Abadi",
    element: "Air / Scorpio",
    emoji: "🦋",
    uprightMeaning: "Akhir dari satu babak lama yang membuka pintu gerbang kelahiran kembali yang jauh lebih agung.",
    reversedMeaning: "Ketakutan melepaskan masa lalu atau resistensi terhadap transformasi alami.",
    buff: { id: "rebirth_surge", name: "Loncatan Transformasi", type: "luck_boost", bonusPercent: 30, durationHours: 24, description: "Bonus +30% Peluang Drop Monster Elit" },
    reversedBuff: { id: "natural_renewal", name: "Pembaruan Alami", type: "stamina_regen", bonusPercent: 25, durationHours: 24, description: "Pembaruan Energi Cepat: +25% Regenerasi Stamina" },
  },
  {
    id: "temperance",
    number: 14,
    name: "Temperance",
    title: "Penyelarasan Tirta Kosmik",
    archetype: "Harmoni Alkimia & Moderasi",
    element: "Api / Sagitarius",
    emoji: "🕊️",
    uprightMeaning: "Keseimbangan elemen, keselarasan emosi, pemulihan luka batin, dan moderasi hidup.",
    reversedMeaning: "Ketidakseimbangan ritme hidup atau tergesa-gesa memaksakan hasil.",
    buff: { id: "tranquil_flow", name: "Aliran Harmonis", type: "all_buffs", bonusPercent: 15, durationHours: 24, description: "Aura Seimbang: +15% EXP dan +15% Koin" },
    reversedBuff: { id: "potion_potency", name: "Resonansi Ramuan", type: "consumable_boost", bonusPercent: 30, durationHours: 24, description: "Efek Konsumsi Makanan & Ramuan Naik +30%" },
  },
  {
    id: "the_devil",
    number: 15,
    name: "The Devil",
    title: "Cermin Ilusi Bayangan",
    archetype: "Belenggu Material & Pelepasan",
    element: "Bumi / Capricorn",
    emoji: "🔥",
    uprightMeaning: "Mengenali ikatan belenggu nafsu, ambisi duniawi yang membara, dan melepaskan rantai ilusi.",
    reversedMeaning: "Kesadaran untuk memutus kecanduan dan membebaskan diri menuju kemerdekaan jiwa.",
    buff: { id: "shadow_drive", name: "Ambisi Membara", type: "gold_boost", bonusPercent: 40, durationHours: 24, description: "Peluang Pendapatan Tinggi: +40% Koin Aktivitas" },
    reversedBuff: { id: "unshackled_spirit", name: "Pelepasan Beban", type: "stamina_regen", bonusPercent: 20, durationHours: 24, description: "Bebas Tekanan: +20% Pemulihan Stamina" },
  },
  {
    id: "the_tower",
    number: 16,
    name: "The Tower",
    title: "Runtuhnya Tembok Kepalsuan",
    archetype: "Pembebasan Tiba-Tiba & Terobosan",
    element: "Api / Mars",
    emoji: "⚡",
    uprightMeaning: "Kejutan yang meruntuhkan fondasi rapuh untuk membangun kembali di atas batu karang sejati.",
    reversedMeaning: "Menghindari krisis yang tak terelakkan atau pemulihan setelah badai berlalu.",
    buff: { id: "tower_breakthrough", name: "Terobosan Badai", type: "dungeon_atk", bonusPercent: 30, durationHours: 24, description: "Terobosan Serangan: Garansi Critical Hit Pertama Tiap Pertarungan" },
    reversedBuff: { id: "safe_landing", name: "Pendaratan Selamat", type: "durability_shield", bonusPercent: 25, durationHours: 24, description: "Perlindungan Perkakas: Durabilitas Alat Berkurang 25% Lebih Lambat" },
  },
  {
    id: "the_star",
    number: 17,
    name: "The Star",
    title: "Bintang Pengharapan Abadi",
    archetype: "Harapan, Inspirasi & Berkah Kosmik",
    element: "Udara / Aquarius",
    emoji: "⭐",
    uprightMeaning: "Harapan murni yang menyala dalam kegelapan, ketenangan spiritual, inspirasi, dan berkah langit.",
    reversedMeaning: "Kehilangan asa sementara atau rasa putus asa yang butuh dihangatkan kembali.",
    buff: { id: "star_guidance", name: "Cahaya Pengharapan", type: "stardust_boost", bonusPercent: 40, durationHours: 24, description: "Bonus +40% Perolehan Stardust & Star Fragments" },
    reversedBuff: { id: "comforting_glow", name: "Sinaran Penyejuk", type: "stamina_regen", bonusPercent: 25, durationHours: 24, description: "Pemulihan Lembut: Stamina & Vital Terisi Bertahap" },
  },
  {
    id: "the_moon",
    number: 18,
    name: "The Moon",
    title: "Misteri Samudra Malam",
    archetype: "Misteri, Ilusi & Intuisi Tajam",
    element: "Air / Pisces",
    emoji: "🔮",
    uprightMeaning: "Alam mimpi, imajinasi liar, navigasi menembus kabut ilusi, dan koneksi bawah sadar.",
    reversedMeaning: "Kecemasan yang tak berdasar tersingkap, kenyataan tampak semakin jelas.",
    buff: { id: "lunar_tide", name: "Pasang Purnama", type: "fishing_luck", bonusPercent: 30, durationHours: 24, description: "Bonus +30% Hasil Memancing & Penangkapan Ikan Legendaris" },
    reversedBuff: { id: "night_vision", name: "Penglihatan Malam", type: "luck_boost", bonusPercent: 20, durationHours: 24, description: "Bonus +20% Menghindari Kejutan Bahaya Malam Hari" },
  },
  {
    id: "the_sun",
    number: 19,
    name: "The Sun",
    title: "Surya Kejayaan Kosmik",
    archetype: "Vitalitas, Sukses & Kegembiraan",
    element: "Api / Matahari",
    emoji: "☀️",
    uprightMeaning: "Kegembiraan murni, kejayaan yang bersinar terang, vitalitas melimpah, dan sukses gemilang.",
    reversedMeaning: "Awan kelabu sesaat yang menutupi mentari atau optimisme yang perlu realistis.",
    buff: { id: "solar_radiance", name: "Sinar Kejayaan", type: "all_buffs", bonusPercent: 25, durationHours: 24, description: "Pancaran Penuh: +25% Semua Pendapatan Koin, EXP, dan Hasil Alam" },
    reversedBuff: { id: "warm_vitality", name: "Hangat Mentari", type: "stamina_regen", bonusPercent: 30, durationHours: 24, description: "Vitalitas Prima: Stamina Pulih Lebih Cepat +30%" },
  },
  {
    id: "judgement",
    number: 20,
    name: "Judgement",
    title: "Sangkakala Kebangkitan",
    archetype: "Kebangkitan & Panggilan Takdir",
    element: "Api / Pluto",
    emoji: "🎺",
    uprightMeaning: "Panggilan jiwa sejati, keputusan menentukan masa depan, pengampunan, dan kebangkitan diri.",
    reversedMeaning: "Menilai diri sendiri secara berlebihan atau ragu menjawab panggilan nurani.",
    buff: { id: "awakening_call", name: "Panggilan Bangkit", type: "exp_boost", bonusPercent: 30, durationHours: 24, description: "Bonus +30% EXP Leveling Discord & Survival" },
    reversedBuff: { id: "inner_absolve", name: "Ketenangan Nurani", type: "tax_discount", bonusPercent: 20, durationHours: 24, description: "Keringanan Biaya Denda & Pajak 20%" },
  },
  {
    id: "the_world",
    number: 21,
    name: "The World",
    title: "Kesempurnaan Semesta",
    archetype: "Pencapaian Tertinggi & Keutuhan",
    element: "Bumi / Saturnus",
    emoji: "🌍",
    uprightMeaning: "Kelengkapan siklus, pencapaian tertinggi, rasa utuh, dan keharmonisan bersama seluruh jagat raya.",
    reversedMeaning: "Satu langkah terakhir menuju tuntas atau tugas tertunda yang butuh diselesaikan.",
    buff: { id: "cosmic_wholeness", name: "Keutuhan Semesta", type: "all_buffs", bonusPercent: 20, durationHours: 24, description: "Berkah Paripurna: +20% EXP, Koin, dan Keberuntungan Universal" },
    reversedBuff: { id: "steady_mastery", name: "Penyelesaian Tekun", type: "stamina_efficiency", bonusPercent: 30, durationHours: 24, description: "Diskon 30% Biaya Stamina Seluruh Aktivitas" },
  },
];

const COOLDOWN_SECONDS = 24 * 60 * 60; // 24 jam antar penarikan tebaran tarot

class TarotEngine {
  constructor() {
    this.cards = MAJOR_ARCANA_CARDS;
    this.cooldownSeconds = COOLDOWN_SECONDS;
  }

  /**
   * Mengambil seluruh dataset kartu Major Arcana.
   * @returns {Array<object>}
   */
  getMajorArcanaDeck() {
    return [...this.cards];
  }

  /**
   * Mengacak array menggunakan algoritma Fisher-Yates dengan opsi custom RNG.
   * @param {Array} arr
   * @param {Function} [rng=Math.random]
   * @returns {Array}
   */
  shuffleArray(arr, rng = Math.random) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
  }

  /**
   * Menarik 3 kartu Tarot Astral (Past, Present, Future).
   * @param {string} userId - Discord user ID
   * @param {object} [options]
   * @param {boolean} [options.bypassCooldown=false]
   * @param {Function} [options.rng] - Custom random generator (0..1) untuk testing deterministik
   * @returns {Promise<object>}
   */
  async drawThreeCardSpread(userId, options = {}) {
    const rng = typeof options.rng === "function" ? options.rng : Math.random;
    const cacheKey = `tarot:cooldown:${userId}`;
    const buffKey = `tarot:buff:${userId}`;

    if (!options.bypassCooldown) {
      if (redisManager && redisManager.isReady) {
        try {
          const ttl = await redisManager.client.ttl(cacheKey);
          if (ttl > 0) {
            const activeBuff = await this.getActiveTarotBuff(userId);
            return {
              canDraw: false,
              remainingSeconds: ttl,
              activeBuff,
              message: `Bintang-bintang masih memulihkan energinya untukmu. Kamu dapat menarik tebaran tarot berikutnya dalam <t:${Math.floor(Date.now() / 1000) + ttl}:R>.`,
            };
          }
        } catch (_) {}
      }

      // Fallback periksa rpg_state jika redis offline
      const existingBuff = await this.getActiveTarotBuff(userId);
      if (existingBuff && existingBuff.expiresAt && Date.now() < existingBuff.expiresAt) {
        const remainingSeconds = Math.max(1, Math.floor((existingBuff.expiresAt - Date.now()) / 1000));
        return {
          canDraw: false,
          remainingSeconds,
          activeBuff: existingBuff,
          message: `Bintang-bintang masih memulihkan energinya untukmu. Kamu dapat menarik tebaran tarot berikutnya dalam <t:${Math.floor(Date.now() / 1000) + remainingSeconds}:R>.`,
        };
      }
    }

    // Acak dan ambil 3 kartu unik tanpa pengembalian (without replacement)
    const shuffled = this.shuffleArray(this.cards, rng);
    const selected = shuffled.slice(0, 3);

    const positions = [
      { key: "past", label: "Masa Lalu (Past)", role: "Akar fondasi peristiwa dan pengalaman yang telah membentukmu." },
      { key: "present", label: "Masa Kini (Present)", role: "Energi utama dan situasi nyata yang sedang kamu hadapi saat ini." },
      { key: "future", label: "Masa Depan (Future)", role: "Potensi hasil dan arah manifestasi takdir yang menunggumu di cakrawala." },
    ];

    const spreadCards = selected.map((card, idx) => {
      // ~35% kemungkinan kartu terbalik (Reversed)
      const isReversed = rng() < 0.35;
      return {
        position: positions[idx],
        card: {
          id: card.id,
          number: card.number,
          name: card.name,
          title: card.title,
          archetype: card.archetype,
          element: card.element,
          emoji: card.emoji,
        },
        isReversed,
        orientation: isReversed ? "Terbalik (Reversed)" : "Tegak (Upright)",
        meaning: isReversed ? card.reversedMeaning : card.uprightMeaning,
        buff: isReversed ? (card.reversedBuff || card.buff) : card.buff,
      };
    });

    // Buff ditentukan oleh kartu masa depan (Slot 3) sebagai manifestasi takdir
    const futureCard = spreadCards[2];
    const sourceBuff = futureCard.buff;
    const appliedBuff = {
      id: sourceBuff.id,
      name: sourceBuff.name,
      type: sourceBuff.type,
      bonusPercent: sourceBuff.bonusPercent,
      durationHours: 24,
      description: sourceBuff.description,
      cardId: futureCard.card.id,
      cardName: futureCard.card.name,
      cardTitle: futureCard.card.title,
      isReversed: futureCard.isReversed,
      activatedAt: Date.now(),
      expiresAt: Date.now() + 24 * 60 * 60 * 1000,
    };

    // Simpan ke UserSurvival.rpg_state secara atomik (24 Jam)
    try {
      const cacheManager = require("../managers/cacheManager");
      if (typeof cacheManager.mutateUserSurvivalJson === "function") {
        await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
          const nextState = state && typeof state === "object" ? { ...state } : {};
          nextState.tarot_reading = {
            drawnAt: new Date().toISOString(),
            cards: spreadCards,
            activeBuff: appliedBuff,
            expiresAt: appliedBuff.expiresAt,
          };
          nextState.tarot_buff = appliedBuff;
          return nextState;
        });
      }
    } catch (_) {}

    // Simpan cooldown dan buff aktif di Redis
    if (redisManager && redisManager.isReady) {
      try {
        await redisManager.client.set(cacheKey, "1", "EX", this.cooldownSeconds);
        await redisManager.setCache(buffKey, JSON.stringify(appliedBuff), this.cooldownSeconds);
      } catch (_) {}
    }

    return {
      canDraw: true,
      userId,
      drawnAt: new Date().toISOString(),
      cards: spreadCards,
      activeBuff: appliedBuff,
      summaryAdvice: this.generateSpreadAdvice(spreadCards),
    };
  }

  /**
   * Alias untuk drawThreeCardSpread
   */
  async drawSpread(userId, options = {}) {
    return this.drawThreeCardSpread(userId, options);
  }

  /**
   * Menghasilkan kesimpulan rangkuman ramalan berdasarkan ketiga kartu secara deterministik.
   * @param {Array<object>} cards
   * @returns {string}
   */
  generateSpreadAdvice(cards) {
    if (!Array.isArray(cards) || cards.length < 3) {
      return "Bintang-bintang membimbing langkahmu dengan ketenangan dan kebijaksanaan kosmik.";
    }
    const [past, present, future] = cards;
    return `Dari fondasi **${past.card.title}** (${past.orientation}), kini kamu berada di fase **${present.card.title}** (${present.orientation}). Tataplah cakrawala dengan keyakinan, karena takdir membimbingmu menuju **${future.card.title}** (${future.orientation})!`;
  }

  /**
   * Membaca buff tarot aktif pengguna (memeriksa Redis dan fallback database).
   * @param {string} userId
   * @returns {Promise<object|null>}
   */
  async getActiveTarotBuff(userId) {
    if (!userId) return null;

    // 1. Coba dari Redis
    if (redisManager && redisManager.isReady) {
      const buffKey = `tarot:buff:${userId}`;
      try {
        const raw = await redisManager.getCache(buffKey);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed.expiresAt && Date.now() < parsed.expiresAt) {
            return parsed;
          }
        }
      } catch (_) {}
    }

    // 2. Fallback baca dari UserSurvival.rpg_state
    try {
      const cacheManager = require("../managers/cacheManager");
      const survival = await cacheManager.getUserSurvival(userId);
      const buff = survival?.rpg_state?.tarot_buff;
      if (buff && buff.expiresAt && Date.now() < buff.expiresAt) {
        return buff;
      }
    } catch (_) {}

    return null;
  }
}

const tarotEngine = new TarotEngine();

// Backward compatibility exports
tarotEngine.TarotEngine = TarotEngine;
tarotEngine.MAJOR_ARCANA_CARDS = MAJOR_ARCANA_CARDS;
tarotEngine.COOLDOWN_SECONDS = COOLDOWN_SECONDS;

module.exports = tarotEngine;
