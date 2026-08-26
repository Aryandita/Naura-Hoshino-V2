/* global rowInvite, rowGame, row, gameStartTime, difficulty */
const fs = require("node:fs");
const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const UserProfile = require("../../src/models/UserProfile");
const UserSurvival = require("../../src/models/UserSurvival");
const cacheManager = require("../../src/managers/cacheManager");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const geminiClient = require("../../src/ai/geminiClient");
const {
  getUserPremiumTier,
  getMinigameMultiplier,
} = require("../../src/premium/premiumHelper");

const triviaDBFallback = {
  pemula: [
    {
      q: "Apa ibukota negara Indonesia?",
      options: ["Jakarta", "Bandung", "Surabaya", "Medan"],
      a: "Jakarta",
    },
    {
      q: "Benda langit yang mengelilingi bumi adalah?",
      options: ["Matahari", "Bulan", "Bintang", "Mars"],
      a: "Bulan",
    },
  ],
  lanjut: [
    {
      q: "Siapa penemu bola lampu pijar?",
      options: [
        "Albert Einstein",
        "Thomas Edison",
        "Nikola Tesla",
        "Isaac Newton",
      ],
      a: "Thomas Edison",
    },
    {
      q: "Gunung tertinggi di Pulau Jawa adalah?",
      options: [
        "Gunung Merapi",
        "Gunung Bromo",
        "Gunung Semeru",
        "Gunung Rinjani",
      ],
      a: "Gunung Semeru",
    },
  ],
  master: [
    {
      q: "Tahun berapa VOC dibubarkan secara resmi?",
      options: ["1799", "1602", "1800", "1945"],
      a: "1799",
    },
    {
      q: "Gas apa yang paling banyak terdapat di atmosfer Bumi?",
      options: ["Oksigen", "Karbondioksida", "Nitrogen", "Hidrogen"],
      a: "Nitrogen",
    },
  ],
  grandmaster: [
    {
      q: "Siapa nama asli Kapitan Pattimura?",
      options: [
        "Thomas Matulessy",
        "Yohanis Matulessy",
        "Martha Tiahahu",
        "Anthony Matulessy",
      ],
      a: "Thomas Matulessy",
    },
    {
      q: "Berapa jumlah tulang pada tubuh manusia dewasa normal?",
      options: ["206", "208", "210", "212"],
      a: "206",
    },
  ],
};

function generateMath(difficulty) {
  let num1, num2, num3, question, answer;
  switch (difficulty) {
    case "pemula":
      num1 = Math.floor(Math.random() * 50) + 1;
      num2 = Math.floor(Math.random() * 50) + 1;
      if (Math.random() > 0.5) {
        question = `${num1} + ${num2}`;
        answer = num1 + num2;
      } else {
        question = `${num1} + ${num2} - ${Math.floor(num1 / 2)}`;
        answer = num1 + num2 - Math.floor(num1 / 2);
      }
      break;
    case "lanjut":
      num1 = Math.floor(Math.random() * 20) + 1;
      num2 = Math.floor(Math.random() * 15) + 1;
      question = `${num1} x ${num2}`;
      answer = num1 * num2;
      break;
    case "master":
      num1 = Math.floor(Math.random() * 20) + 10;
      num2 = Math.floor(Math.random() * 10) + 2;
      num3 = Math.floor(Math.random() * 50) + 10;
      question = `(${num1} x ${num2}) + ${num3}`;
      answer = num1 * num2 + num3;
      break;
    case "grandmaster":
      num1 = Math.floor(Math.random() * 50) + 20;
      num2 = Math.floor(Math.random() * 30) + 10;
      num3 = Math.floor(Math.random() * 100) + 50;
      question = `${num1} x ${num2} - ${num3} + 125`;
      answer = num1 * num2 - num3 + 125;
      break;
  }
  return { question, answer: answer.toString() };
}

const rewards = {
  pemula: { coin: 50, score: 10, time: 20000, color: "#00FF00" },
  lanjut: { coin: 150, score: 30, time: 15000, color: "#00FFFF" },
  master: { coin: 300, score: 50, time: 10000, color: "#FF00FF" },
  grandmaster: { coin: 1000, score: 100, time: 15000, color: "#FFD700" },
};

const wordleWords = [
  "MOBIL",
  "MOTOR",
  "LAMPU",
  "BUNGA",
  "PINTU",
  "KAPAL",
  "PESAN",
  "SURAT",
  "BULAN",
  "KASUR",
  "LEMAR",
  "HUTAN",
  "POHON",
  "PASIR",
  "SINGA",
  "MACAN",
  "ELANG",
  "BEBEK",
  "KATAK",
  "BADAK",
  "KAMAR",
  "KASIR",
  "PAGAR",
];

// ==========================================
// 📚 DATABASE MINI-GAMES BARU
// ==========================================
const anagramDB = {
  mudah: [
    "PINTU",
    "MEJA",
    "KASUR",
    "MOBIL",
    "MOTOR",
    "BOTOL",
    "KIPAS",
    "KAPAL",
    "BUKU",
    "PENA",
    "SABUN",
    "AYAM",
    "SAPI",
    "KUDA",
  ],
  sulit: [
    "ASTRONOT",
    "KOMPUTER",
    "TELEVISI",
    "MIKROSKOP",
    "HELIKOPTER",
    "METEOROLOGI",
    "KONSTITUSI",
    "UNIVERSITAS",
  ],
};

const tebakGambarDB = [
  {
    url: "https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    clue: "Hewan peliharaan yang mengeong",
    answer: "kucing",
  },
  {
    url: "https://images.unsplash.com/photo-1494976388531-d1058494cdd8?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    clue: "Kendaraan roda empat",
    answer: "mobil",
  },
  {
    url: "https://images.unsplash.com/photo-1496181133206-80ce9b88a853?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    clue: "Perangkat elektronik lipat untuk bekerja",
    answer: "laptop",
  },
  {
    url: "https://images.unsplash.com/photo-1549488344-1f9b8d2bd1f3?ixlib=rb-4.0.3&auto=format&fit=crop&w=500&q=60",
    clue: "Mamalia darat dengan leher paling panjang",
    answer: "jerapah",
  },
];

const ttsDB = [
  {
    clue: "**1 Mendatar:** Ibukota negara Jepang\n**1 Menurun:** Alat untuk menulis dengan tinta",
    answer: "tokyo pena",
    id: 1,
  },
  {
    clue: "**1 Mendatar:** Mamalia darat terbesar yang punya belalai\n**1 Menurun:** Buah berduri yang di dalamnya kuning dan wangi",
    answer: "gajah durian",
    id: 2,
  },
  {
    clue: "**1 Mendatar:** Planet merah di tata surya kita\n**1 Menurun:** Makanan pokok orang Indonesia",
    answer: "mars nasi",
    id: 3,
  },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("minigame")
    .setDescription("🎮 Mainkan berbagai macam kuis dan game asah otak Naura!")

    .addSubcommand((sub) =>
      sub
        .setName("math")
        .setDescription("Kuis Matematika Kecepatan.")
        .addStringOption((opt) =>
          opt
            .setName("kesulitan")
            .setDescription("Tingkat Kesulitan")
            .setRequired(true)
            .addChoices(
              { name: "🟢 Pemula", value: "pemula" },
              { name: "🔵 Tingkat Lanjut", value: "lanjut" },
              { name: "🟣 Master", value: "master" },
              { name: "🟡 GrandMaster", value: "grandmaster" },
            ),
        ),
    )

    .addSubcommand((sub) =>
      sub
        .setName("trivia")
        .setDescription("Kuis Pengetahuan Umum AI.")
        .addStringOption((opt) =>
          opt
            .setName("kesulitan")
            .setDescription("Tingkat Kesulitan")
            .setRequired(true)
            .addChoices(
              { name: "🟢 Pemula", value: "pemula" },
              { name: "🔵 Tingkat Lanjut", value: "lanjut" },
              { name: "🟣 Master", value: "master" },
              { name: "🟡 GrandMaster", value: "grandmaster" },
            ),
        ),
    )

    .addSubcommand((sub) =>
      sub
        .setName("rps")
        .setDescription("Batu Gunting Kertas PvP atau Lawan Bot.")
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah taruhan NSF (Star Fragments)")
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName("lawan")
            .setDescription("Pilih pemain untuk PvP (Kosongkan untuk AI)")
            .setRequired(false),
        ),
    )

    .addSubcommand((sub) =>
      sub
        .setName("tictactoe")
        .setDescription("Tic-Tac-Toe PvP atau Lawan Bot.")
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah taruhan NSF (Star Fragments)")
            .setRequired(true),
        )
        .addUserOption((opt) =>
          opt
            .setName("lawan")
            .setDescription("Pilih pemain untuk PvP (Kosongkan untuk AI)")
            .setRequired(false),
        ),
    )

    .addSubcommand((sub) =>
      sub
        .setName("wordle")
        .setDescription("Tebak kata rahasia 5 huruf (6 kesempatan).")
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah taruhan NSF (Star Fragments)")
            .setRequired(true),
        ),
    )

    // ==========================================
    // ✨ SUBCOMMAND BARU: DUEL REAL-TIME
    // ==========================================
    .addSubcommand((sub) =>
      sub
        .setName("duel")
        .setDescription(
          "⚔️ Tantang pemain lain dalam duel matematika real-time!",
        )
        .addUserOption((opt) =>
          opt
            .setName("lawan")
            .setDescription("Pilih pemain yang ingin ditantang")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("taruhan")
            .setDescription("Jumlah taruhan NSF (opsional)")
            .setRequired(false),
        ),
    )

    // ==========================================
    // 🧩 SUBCOMMAND BARU: ASAH OTAK
    // ==========================================
    .addSubcommand((sub) =>
      sub
        .setName("akinator")
        .setDescription(
          "🧞 Tebak karakter yang sedang kamu pikirkan bersama Akinator!",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("hangman")
        .setDescription("🔤 Mainkan game tebak kata klasik (Hangman)."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("memory")
        .setDescription("🎴 Mainkan game Memory Match mencocokkan emoji."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tebakkata")
        .setDescription("🔠 Tebak anagram kata yang diacak.")
        .addStringOption((opt) =>
          opt
            .setName("kesulitan")
            .setDescription("Tingkat Kesulitan")
            .setRequired(true)
            .addChoices(
              { name: "🟢 Mudah", value: "mudah" },
              { name: "🔴 Sulit", value: "sulit" },
            ),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tebakgambar")
        .setDescription("🖼️ Tebak objek apa yang ada di dalam gambar."),
    )
    .addSubcommand((sub) =>
      sub.setName("tts").setDescription("📝 Teka Teki Silang Mini."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tod")
        .setDescription("🎭 Mainkan game Truth or Dare bersama temanmu!")
        .addUserOption((opt) =>
          opt
            .setName("teman")
            .setDescription("Pilih teman bermain (opsional)")
            .setRequired(false),
        ),
    )

    // ==========================================
    // 🏆 PEMBARUAN LEADERBOARD
    // ==========================================
    .addSubcommand((sub) =>
      sub
        .setName("leaderboard")
        .setDescription("🏆 Papan Peringkat Minigame.")
        .addStringOption((opt) =>
          opt
            .setName("kategori")
            .setDescription("Kategori Peringkat")
            .setRequired(true)
            .addChoices(
              { name: "🧮 Matematika", value: "math" },
              { name: "🧠 Trivia", value: "trivia" },
              { name: "⚔️ Duel Master", value: "duel" },
            ),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    await runMinigameLogic(interaction);
  },

  async executePrefix(message, args, client) {
    if (!args || args.length === 0) {
      return ui.sendError(message, "err_sys_2");
    }

    const subcommandName = args.shift().toLowerCase();

    const mockInteraction = {
      client: client,
      user: message.author,
      member: message.member,
      guild: message.guild,
      channel: message.channel,
      options: {
        getSubcommand: () => subcommandName,
        getUser: () => message.mentions.users.first() || null,
        getString: (name) => args[0] || null,
        getInteger: (name) => parseInt(args[0]) || 0,
      },
      deferReply: async () => {},
      editReply: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.reply(msgPayload);
      },
      reply: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.reply(msgPayload);
      },
      followUp: async (payload) => {
        const msgPayload =
          typeof payload === "string"
            ? { content: payload, embeds: [], components: [], files: [] }
            : {
                content: null,
                embeds: [],
                components: [],
                files: [],
                ...payload,
              };
        delete msgPayload.ephemeral;
        return await message.channel.send(msgPayload);
      },
      fetchReply: async () => {
        // Simplified mock for fetchReply if needed
        const sentMsg = await message.reply({
          content: "⏳ Memproses minigame...",
        });
        return sentMsg;
      },
    };

    // Ganti fetchReply behavior untuk RPS dan wordle agar collector jalan di pesan yang sama
    let lastMsg = null;
    mockInteraction.editReply = async (payload) => {
      const msgPayload =
        typeof payload === "string"
          ? { content: payload, embeds: [], components: [], files: [] }
          : {
              content: null,
              embeds: [],
              components: [],
              files: [],
              ...payload,
            };
      delete msgPayload.ephemeral;
      if (lastMsg) return await lastMsg.edit(msgPayload);
      lastMsg = await message.reply(msgPayload);
      return lastMsg;
    };
    mockInteraction.fetchReply = async () => lastMsg;

    await runMinigameLogic(mockInteraction);
  },
};

const MINIGAME_INFOS = {
  math: {
    title: "Kuis Matematika Kecepatan",
    emoji: "🧮",
    description:
      "Uji seberapa cepat otakmu berhitung di bawah tekanan waktu!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Jawab soal hitungan yang Naura berikan secepat mungkin.\n" +
      "> 2. Semakin tinggi tingkat kesulitan, semakin besar hadiah NSF yang bisa kamu raih!\n" +
      "> 3. Hati-hati, jika waktu habis kamu dianggap salah lho ya~",
    tip: "Fokus dan jangan panik ya! Naura yakin kamu jago berhitung!",
  },
  trivia: {
    title: "Kuis Pengetahuan Umum AI",
    emoji: "🧠",
    description:
      "Tantang wawasan dan pengetahuanmu bersama AI Naura!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Naura akan memberikan pertanyaan pilihan ganda dari berbagai topik dunia.\n" +
      "> 2. Pilih salah satu tombol opsi jawaban yang menurutmu paling tepat.\n" +
      "> 3. Jawaban benar akan memberimu hadiah NSF dan tambahan XP!",
    tip: "Baca soalnya pelan-pelan yaa, jangan sampai terjebak opsi tipuan!",
  },
  rps: {
    title: "Batu Gunting Kertas",
    emoji: "✂️",
    description:
      "Permainan klasik adu insting dan keberuntungan!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pasang taruhan NSF dan pilih lawan bermain (AI Naura atau temanmu).\n" +
      "> 2. Pilih antara Batu 🪨, Gunting ✂️, atau Kertas 📄.\n" +
      "> 3. Pemenang berhak membawa pulang seluruh taruhan NSF!",
    tip: "Batu mengalahkan gunting, gunting memotong kertas, kertas membungkus batu!",
  },
  tictactoe: {
    title: "Tic-Tac-Toe Arena",
    emoji: "⭕",
    description:
      "Adu strategi kotak 3x3 klasik yang legendaris!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pilih kotak grid 3x3 secara bergantian dengan lawanmu.\n" +
      "> 2. Buat garis lurus 3 simbol (horizontal, vertikal, atau diagonal) untuk menang.\n" +
      "> 3. Waspadai dan kunci setiap langkah jebakan lawan!",
    tip: "Kuasai kotak tengah untuk peluang menang yang lebih tinggi!",
  },
  wordle: {
    title: "Tebak Kata 5 Huruf (Wordle)",
    emoji: "🟩",
    description:
      "Tebak kata rahasia misterius 5 huruf dalam 6 kesempatan!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Masukkan kata tebakan 5 huruf ke kolom pesan.\n" +
      "> 2. 🟩 **Hijau:** Huruf tepat dan posisi sudah benar.\n" +
      "> 3. 🟨 **Kuning:** Huruf ada di dalam kata tapi posisinya keliru.\n" +
      "> 4. ⬛ **Abu-abu:** Huruf tidak ada sama sekali di dalam kata.",
    tip: "Mulai dengan kata yang memiliki banyak huruf vokal seperti 'SUARA' atau 'MELON'!",
  },
  duel: {
    title: "Duel Matematika Real-Time",
    emoji: "⚔️",
    description:
      "Tantangan hitung cepat 1 lawan 1 langsung di server!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Tantang temanmu dengan taruhan NSF.\n" +
      "> 2. Siapa yang menjawab soal matematika dengan benar dan paling cepat akan menang!\n" +
      "> 3. Pemenang berhak atas seluruh saldo hadiah taruhan NSF!",
    tip: "Pastikan koneksimu stabil dan jemarimu siap mengetik cepat!",
  },
  akinator: {
    title: "Akinator Sang Cenayang",
    emoji: "🧞",
    description:
      "Pikirkan satu karakter, dan biarkan Jin Naura menebaknya!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pikirkan satu tokoh fiksi, artis, anime, atau tokoh dunia di kepalamu.\n" +
      "> 2. Jawab pertanyaan Naura dengan jujur (Ya, Tidak, Mungkin, dsb).\n" +
      "> 3. Lihat apakah Naura berhasil membaca pikiranmu!",
    tip: "Jangan ganti karakter di tengah jalan yaa, nanti Naura bingung~",
  },
  hangman: {
    title: "Hangman Tebak Huruf",
    emoji: "🔤",
    description:
      "Tebak huruf demi huruf sebelum kesempatanmu habis!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Tebak huruf yang menyusun kata rahasia misterius.\n" +
      "> 2. Setiap tebakan salah akan mengurangi nyawa/kesempatanmu.\n" +
      "> 3. Selesaikan seluruh kata sebelum boneka hangman tergantung lengkap!",
    tip: "Tebak huruf vokal utama (A, I, U, E, O) terlebih dahulu!",
  },
  memory: {
    title: "Memory Match Emoji",
    emoji: "🎴",
    description:
      "Uji daya ingat visualmu dengan mencocokkan pasangan kartu!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Buka dua kartu pada grid yang disediakan.\n" +
      "> 2. Ingat posisi simbol emoji yang muncul di balik kartu.\n" +
      "> 3. Cocokkan semua pasangan kartu secepat mungkin!",
    tip: "Konsentrasi penuh dan simpan koordinat kartu di memorimu!",
  },
  tebakkata: {
    title: "Tebak Kata Anagram",
    emoji: "🔠",
    description:
      "Susun huruf-huruf yang berantakan menjadi kata yang bermakna!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Perhatikan susunan huruf yang diacak oleh Naura.\n" +
      "> 2. Ketik kata asli yang benar sebelum batas waktu habis.\n" +
      "> 3. Raih hadiah NSF dan kebanggaan jika tebakanmu tepat!",
    tip: "Coba bunyikan rangkaian hurufnya di dalam hati untuk menemukan polanya!",
  },
  tebakgambar: {
    title: "Tebak Gambar Misteri",
    emoji: "🖼️",
    description:
      "Tebak objek atau makna tersembunyi dari gambar petunjuk!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Perhatikan gambar petunjuk yang Naura kirimkan.\n" +
      "> 2. Ketik jawaban tebakanmu di chat.\n" +
      "> 3. Siapa cepat dan tepat, dia yang menang!",
    tip: "Perhatikan detail-detail kecil pada gambar yaa!",
  },
  tts: {
    title: "Teka-Teki Silang Mini",
    emoji: "📝",
    description:
      "Isi kotak mendatar dan menurun dengan jawaban cerdasmu!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Baca petunjuk soal mendatar dan menurun.\n" +
      "> 2. Tuliskan jawaban yang sesuai dengan jumlah huruf.\n" +
      "> 3. Lengkapi semua kotak untuk menyelesaikan TTS!",
    tip: "Kerjakan petunjuk yang paling kamu yakin terlebih dahulu!",
  },
  tod: {
    title: "Truth or Dare Party",
    emoji: "🎭",
    description:
      "Game seru penguji kejujuran dan keberanian bersama teman!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pilih antara **Jujur (Truth)** atau **Tantangan (Dare)**.\n" +
      "> 2. Jawab pertanyaan rahasia atau lakukan tantangan seru dari Naura.\n" +
      "> 3. Bersenang-senanglah bersama teman-teman servermu!",
    tip: "Jangan curang ya, lakukan tantangan dengan penuh percaya diri!",
  },
};

async function showMinigameIntro(interaction, subcommand, onStart) {
  const info = MINIGAME_INFOS[subcommand];
  if (!info) return onStart();

  const bannerPath =
    ui.getBanner("minigame") ||
    "./assets/general/Minigame & Arcade Banner.jpeg";
  const bannerName = "minigame-banner.jpeg";
  const files = [];
  let bannerAttachmentName = null;

  if (fs.existsSync(bannerPath)) {
    files.push(new AttachmentBuilder(bannerPath, { name: bannerName }));
    bannerAttachmentName = bannerName;
  }

  const rowIntro = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`mg_intro_start_${interaction.user.id}`)
      .setLabel("Lanjutkan Bermain 🚀")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`mg_intro_cancel_${interaction.user.id}`)
      .setLabel("Batal")
      .setStyle(ButtonStyle.Secondary),
  );

  const introPayload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura Minigames & Arcade Hub",
    title: `${info.emoji} ${info.title}`,
    iconURL: interaction.user.displayAvatarURL(),
    expression: "cheers",
    description:
      `${info.description}\n\n` +
      `💡 **Tips Naura:** *${info.tip}*\n\n` +
      `Tekan tombol **Lanjutkan Bermain 🚀** di bawah jika kamu sudah siap!`,
    bannerAttachmentName,
    bannerPosition: "bottom",
    files,
    buttonsRow: rowIntro,
    footerText: ui.getFooter("core"),
  });

  const replyMsg = await interaction.editReply(introPayload);

  try {
    const confirmation = await replyMsg.awaitMessageComponent({
      filter: (i) =>
        i.user.id === interaction.user.id &&
        (i.customId.startsWith("mg_intro_start_") ||
          i.customId.startsWith("mg_intro_cancel_")),
      time: 60000,
    });

    if (confirmation.customId.startsWith("mg_intro_cancel_")) {
      const cancelPayload = buildContainerV2({
        title: "Bermain Dibatalkan",
        description:
          "Kamu membatalkan permainan. Kapan-kapan kita main bareng lagi yaa! 👋",
        footerText: ui.getFooter("core"),
      });
      return confirmation.update({
        ...cancelPayload,
        components: [],
        files: [],
      });
    }

    await confirmation.deferUpdate();
    return onStart();
  } catch (_) {
    return interaction
      .editReply({
        components: [],
      })
      .catch(() => {});
  }
}

async function runMinigameLogic(interaction) {
  const subcommand = interaction.options.getSubcommand();
  const user = interaction.user;

  // Memuat profil & survival
  const [profile] = await UserProfile.findOrCreate({
    where: { userId: user.id },
  });
  const [survival] = await UserSurvival.findOrCreate({
    where: { userId: user.id },
  });

  const premiumTier = getUserPremiumTier(profile);
  const nsfMultiplier = getMinigameMultiplier(premiumTier);

  const nsfEmoji = ui.getEmoji("nsf") || ui.getEmoji("star_fragment") || "⭐";
  const coinEmoji = `${nsfEmoji} NSF`;
  const errorEmoji = ui.emojis.error || "❌";
  const sendError = (msg) => {
    const errPayload = buildErrorContainerV2({
      title: "Gagal",
      description: `${errorEmoji} ${msg}`,
      footerText: ui.getFooter("core"),
    });
    return interaction.editReply(errPayload);
  };

  const executeGame = async () => {
    let gameStartTime = Date.now();
    // ==========================================
    // ⚔️ SISTEM DUEL MULTIPLAYER REAL-TIME
    // ==========================================
    if (subcommand === "duel") {
    const opponent = interaction.options.getUser("lawan");
    const taruhan = interaction.options.getInteger("taruhan") || 0;

    if (opponent.bot) return sendError("Kamu tidak bisa menantang mesin/bot!");
    if (opponent.id === user.id)
      return sendError("Kamu tidak bisa menantang dirimu sendiri!");

    const [opponentSurvival] = await UserSurvival.findOrCreate({
      where: { userId: opponent.id },
    });

    // Cek saldo taruhan NSF di database survival
    if (taruhan > 0) {
      const userNsf = Number(survival.starFragments || 0);
      const oppNsf = Number(opponentSurvival.starFragments || 0);
      if (userNsf < taruhan)
        return sendError(
          `Saldo Star Fragments (NSF) kamu tidak cukup untuk bertaruh sebesar **${taruhan.toLocaleString()}** ${coinEmoji}! (Saldo: ${userNsf.toLocaleString()} ${nsfEmoji})`,
        );
      if (oppNsf < taruhan)
        return sendError(
          `Saldo Star Fragments (NSF) <@${opponent.id}> tidak cukup untuk taruhan ini!`,
        );
    }

    const rowInvite = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duel_accept")
        .setLabel("Terima")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("duel_decline")
        .setLabel("Tolak")
        .setStyle(ButtonStyle.Danger),
    );
    const invitePayload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#00FFFF",
      title: `${ui.getEmoji("battle") || "⚔️"} TANTANGAN DUEL ${ui.getEmoji("battle") || "⚔️"}`,
      description: `<@${user.id}> menantang <@${opponent.id}> untuk duel matematika kecepatan!\n\n**Taruhan:** ${taruhan.toLocaleString()} ${coinEmoji}\n\nApakah kamu berani menerima tantangan ini?`,
      buttonsRow: rowInvite,
      footerText: "Tantangan ini akan kadaluarsa dalam 30 detik.",
    });

    const response = await interaction.editReply({
      content: `<@${opponent.id}>`,
      ...invitePayload,
      fetchReply: true,
    });

    const filter = (i) => i.user.id === opponent.id;
    const collectorInvite = response.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    collectorInvite.on("collect", async (i) => {
      if (i.customId === "duel_decline") {
        await i.update({
          content: `❌ <@${opponent.id}> menolak tantangan duel.`,
          embeds: [],
          components: [],
        });
        return collectorInvite.stop();
      }

      await i.deferUpdate();
      collectorInvite.stop();

      // MEMULAI GAME DUEL
      const num1 = Math.floor(Math.random() * 50) + 10;
      const num2 = Math.floor(Math.random() * 50) + 10;
      const answer = num1 + num2;

      const options = [
        answer,
        answer + Math.floor(Math.random() * 5) + 1,
        answer - Math.floor(Math.random() * 5) - 1,
        answer + 10,
      ].sort(() => Math.random() - 0.5);

      const rowGame = new ActionRowBuilder().addComponents(
        options.map((opt) =>
          new ButtonBuilder()
            .setCustomId(`duel_${opt}`)
            .setLabel(opt.toString())
            .setStyle(ButtonStyle.Primary),
        ),
      );

      const duelPayload = buildContainerV2({
        accentColorHex: "#FF0055",
        title: `${ui.getEmoji("battle") || "⚔️"} DUEL DIMULAI: SIAPA CEPAT DIA DAPAT!`,
        description: `Berapa hasil dari: **${num1} + ${num2}** ?\n\nSiapapun yang menekan jawaban benar lebih dulu akan menang!`,
        buttonsRow: rowGame,
        footerText: "Waktu menjawab: 15 detik",
      });

      await interaction.editReply({ content: null, ...duelPayload });

      const gameCollector = response.createMessageComponentCollector({
        filter: (gi) => gi.user.id === user.id || gi.user.id === opponent.id,
        time: 15000,
      });

      gameCollector.on("collect", async (gi) => {
        const chosen = parseInt(gi.customId.split("_")[1]);
        const winner = gi.user;
        const loser = winner.id === user.id ? opponent : user;

        if (chosen === answer) {
          gameCollector.stop("win");

          await cacheManager.incrementUserProfile(winner.id, {
            minigame_duelScore: 10,
          });

          if (taruhan > 0) {
            await cacheManager.incrementUserSurvival(
              winner.id,
              "starFragments",
              taruhan,
            );
            await cacheManager.debitUserSurvival(
              loser.id,
              "starFragments",
              taruhan,
            );
          }

          const winPayload = buildContainerV2({
            accentColorHex: "#22c55e",
            title: `${ui.getEmoji("trophy") || "🏆"} PEMENANG DUEL`,
            description: `Tembakan cepat dari <@${winner.id}> tepat sasaran!\n\n**Jawaban Benar:** ${answer}\n\n**Hadiah Pemenang:**\n> +10 Poin Duel\n> ${taruhan > 0 ? `+${taruhan.toLocaleString()} ${coinEmoji}` : "Tidak ada taruhan"}`,
            footerText: ui.getFooter("core"),
          });

          await gi.update(winPayload);
        } else {
          // Jika klik salah
          await ui.sendError(gi, "err_sys_4", true);
        }
      });

      gameCollector.on("end", (collected, reason) => {
        if (reason === "time") {
          interaction
            .editReply({
              content:
                `${ui.getEmoji("clock") || "⏰"} Pertandingan dibatalkan karena waktu habis, tidak ada yang menjawab.`,
              embeds: [],
              components: [],
            })
            .catch(() => {});
        }
      });
    });

    collectorInvite.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction
          .editReply({
            content: `${ui.getEmoji("clock") || "⏰"} <@${opponent.id}> terlalu lama merespons. Tantangan dibatalkan.`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }
    });

    return; // Selesaikan eksekusi agar tidak masuk ke logika lain
  }

  // ==========================================
  // 🧠 KUIS TRIVIA (INFINITY AI GENERATOR)
  // ==========================================
  else if (subcommand === "trivia") {
    const diff = interaction.options.getString("kesulitan");
    const conf = rewards[diff];
    let qData;

    try {
      const promptAI = `Buatkan 1 soal kuis trivia pengetahuan umum yang menarik, berbahasa Indonesia, secara acak dengan tingkat kesulitan: ${diff.toUpperCase()}. 
                Format balasan HARUS berupa JSON murni (tanpa tanda markdown \`\`\`json) dengan struktur persis seperti ini:
                {
                    "q": "Tulis pertanyaan di sini",
                    "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
                    "a": "Tulis jawaban yang benar di sini (harus sama persis dengan salah satu isi options)"
                }`;

      const rawText = await geminiClient.generate({
        model: "gemini-2.5-flash",
        parts: [{ text: promptAI }],
      });

      const jsonText = (rawText || "")
        .replace(/```json/gi, "")
        .replace(/```/gi, "")
        .trim();
      qData = JSON.parse(jsonText);

      if (
        !qData.q ||
        !qData.options ||
        !qData.a ||
        !qData.options.includes(qData.a)
      ) {
        throw new Error("Format JSON dari AI rusak");
      }
    } catch (error) {
      logger.error(
        "Gagal generate soal dari AI, memakai soal cadangan:",
        error,
      );
      const fallbackQuestions = triviaDBFallback[diff];
      qData =
        fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }

    const shuffledOptions = [...qData.options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(qData.a);

    const row = new ActionRowBuilder().addComponents(
      shuffledOptions.map((opt, index) =>
        new ButtonBuilder()
          .setCustomId(`trivia_${index}`)
          .setLabel(opt.length > 80 ? opt.substring(0, 77) + "..." : opt)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const payload = buildContainerV2({
      accentColorHex: conf.color,
      authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
      iconURL: user.displayAvatarURL(),
      title: qData.q,
      description: `⏳ Pilih jawaban yang benar di bawah! Waktu: **${conf.time / 1000} detik**.\n\n> 💰 Hadiah: **${conf.coin}** ${coinEmoji}\n> 🏆 Skor: **+${conf.score}** Poin`,
      buttonsRow: row,
      footerText: "Soal dibuat khusus oleh Naura AI",
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: conf.time,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_5", true);

      const selectedIndex = parseInt(i.customId.split("_")[1]);

      const newRow = new ActionRowBuilder().addComponents(
        shuffledOptions.map((opt, index) => {
          const btn = new ButtonBuilder()
            .setCustomId(`done_${index}`)
            .setLabel(opt)
            .setDisabled(true);
          if (index === correctIndex) btn.setStyle(ButtonStyle.Success);
          else if (index === selectedIndex) btn.setStyle(ButtonStyle.Danger);
          else btn.setStyle(ButtonStyle.Secondary);
          return btn;
        }),
      );

      if (selectedIndex === correctIndex) {
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        profile.minigame_triviaScore += conf.score;
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
        await profile.save({ fields: ["minigame_triviaScore"] });
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("celebrate") || "🎉"} JAWABAN TEPAT SEKALI!`,
          description: `Hebat! Jawabanmu **${qData.a}** adalah benar!\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}\n> 🏆 **Skor:** +${conf.score} Poin`,
          buttonsRow: newRow,
          footerText: ui.getFooter("core"),
        });

        await i.update(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} JAWABAN KURANG TEPAT`,
          description: `Sayang sekali! Jawaban yang benar adalah **${qData.a}**.\nTetap semangat dan coba lagi yaa!`,
          buttonsRow: newRow,
          footerText: ui.getFooter("core"),
        });

        await i.update(losePayload);
      }
      collector.stop("answered");
    });

    collector.on("end", (collected, reason) => {
      if (reason !== "answered") {
        const disabledRow = new ActionRowBuilder().addComponents(
          shuffledOptions.map((opt, index) =>
            new ButtonBuilder()
              .setCustomId(`exp_${index}`)
              .setLabel(opt)
              .setStyle(
                index === correctIndex
                  ? ButtonStyle.Success
                  : ButtonStyle.Secondary,
              )
              .setDisabled(true),
          ),
        );
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu berpikirmu telah habis!\nJawaban yang benar adalah **${qData.a}**.`,
          buttonsRow: disabledRow,
          footerText: ui.getFooter("core"),
        });

        interaction.editReply(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // 🧮 KUIS MATEMATIKA
  // ==========================================
  else if (subcommand === "math") {
    const diff = interaction.options.getString("kesulitan");
    const conf = rewards[diff];
    const mathData = generateMath(diff);

    const payload = buildContainerV2({
      accentColorHex: conf.color,
      authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
      iconURL: user.displayAvatarURL(),
      title: `Berapa hasil dari: **${mathData.question}** ?`,
      description: `⏳ Ketik jawabanmu di chat ini! Waktumu hanya **${conf.time / 1000} detik**.\n\n> 💰 Hadiah: **${conf.coin}** ${coinEmoji}\n> 🏆 Skor: **+${conf.score}** Poin`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);
    const gameStartTime = Date.now();

    const filter = (m) => m.author.id === user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: conf.time,
      max: 1,
    });

    collector.on("collect", async (m) => {
      if (String(m.content).replace(/\s+/g, "").trim() === String(mathData.answer)) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1500 && diff === "grandmaster") {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description: "Terdeteksi Auto-Typer / Selfbot. Kamu menjawab perhitungan rumit dalam waktu kurang dari 1.5 detik! Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        profile.minigame_mathScore += conf.score;
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
        await profile.save({ fields: ["minigame_mathScore"] });
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} HITUNGAN BENAR!`,
          description: `Luar biasa! Hasil hitungan dari **${mathData.question}** memang **${mathData.answer}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}\n> 🏆 **Skor:** +${conf.score} Poin Math`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} HITUNGAN SALAH`,
          description: `Jawabanmu belum tepat!\nHasil yang benar dari **${mathData.question}** adalah: **${mathData.answer}**`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu berhitung telah habis, <@${user.id}>!\nHasil yang benar adalah: **${mathData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // ✂️ BATU GUNTING KERTAS (RPS)
  // ==========================================
  else if (subcommand === "rps") {
    const taruhan = interaction.options.getInteger("taruhan");
    const opponent = interaction.options.getUser("lawan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan)
      return sendError(`Taruhan tidak valid atau saldo Star Fragments (NSF) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`);

    if (opponent && !opponent.bot && opponent.id !== user.id) {
      return interaction.editReply({
        content:
          "Fitur PvP RPS melawan pemain nyata sedang dalam pengembangan! Untuk sementara, silakan bermain melawan AI.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rps_batu")
        .setLabel("Batu 🪨")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_gunting")
        .setLabel("Gunting ✂️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_kertas")
        .setLabel("Kertas 📄")
        .setStyle(ButtonStyle.Primary),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#00FFFF",
      authorName: "Batu Gunting Kertas",
      iconURL: user.displayAvatarURL(),
      description: `Kamu mempertaruhkan **${taruhan.toLocaleString()}** ${coinEmoji}.\nSilakan pilih gerakanmu dalam **15 detik**!`,
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_6", true);

      const userChoice = i.customId.split("_")[1];
      const choices = ["batu", "gunting", "kertas"];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      let result = "";
      let color = "#FFD700";

      if (userChoice === botChoice) {
        result = `SERI! Kalian berdua memilih **${userChoice}**.\nTaruhan NSF dikembalikan.`;
        color = "#FFFF00";
      } else if (
        (userChoice === "batu" && botChoice === "gunting") ||
        (userChoice === "gunting" && botChoice === "kertas") ||
        (userChoice === "kertas" && botChoice === "batu")
      ) {
        const winNsf = profile.isPremium ? taruhan * 2 : taruhan;
        profile.minigame_rpsWin += 1;
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
        await profile.save({ fields: ["minigame_rpsWin"] });
        await cacheManager.incrementUserSurvival(user.id, "starFragments", winNsf);
        result = `MENANG! Bot memilih **${botChoice}**.\nKamu memenangkan **${(taruhan * 2).toLocaleString()}** ${coinEmoji}!`;
        color = "#00FF00";
      } else {
        await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
        result = `KALAH! Bot memilih **${botChoice}**.\nKamu kehilangan **${taruhan.toLocaleString()}** ${coinEmoji}.`;
        color = "#FF0000";
      }

      const resPayload = buildContainerV2({
        accentColorHex: color,
        title: `Pilihanmu: ${userChoice.toUpperCase()} | Pilihan Bot: ${botChoice.toUpperCase()}`,
        description: result,
        footerText: ui.getFooter("core"),
      });

      await i.update(resPayload);
      collector.stop();
    });

    collector.on("end", (collected) => {
      if (collected.size === 0)
        interaction.editReply({
          content: `⏰ Waktu memilih habis! Taruhan dibatalkan.`,
          embeds: [],
          components: [],
        });
    });
  }

  // ==========================================
  // ⭕ TIC-TAC-TOE (Lawan Bot AI)
  // ==========================================
  else if (subcommand === "tictactoe") {
    const taruhan = interaction.options.getInteger("taruhan");
    const opponent = interaction.options.getUser("lawan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan)
      return sendError(`Taruhan tidak valid atau saldo Star Fragments (NSF) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`);

    if (opponent && !opponent.bot && opponent.id !== user.id) {
      return interaction.editReply({
        content:
          "Fitur PvP Tic-Tac-Toe melawan pemain nyata sedang dalam pengembangan! Untuk sementara, silakan bermain melawan AI dengan mengosongkan argumen lawan.",
      });
    }

    const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const checkWin = (b) => {
      const wins = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
      ];
      for (const w of wins) {
        if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) return b[w[0]];
      }
      if (b.every((c) => c === "X" || c === "O")) return "DRAW";
      return null;
    };

    const buildBoardUI = (b, disabled = false) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          const idx = i * 3 + j;
          const val = b[idx];
          const btn = new ButtonBuilder()
            .setCustomId(`ttt_${idx}`)
            .setDisabled(disabled || val === "X" || val === "O");
          if (val === "X") btn.setLabel("❌").setStyle(ButtonStyle.Primary);
          else if (val === "O") btn.setLabel("⭕").setStyle(ButtonStyle.Danger);
          else btn.setLabel("➖").setStyle(ButtonStyle.Secondary);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      return rows;
    };

    const renderTtt = (desc, disabled = false) =>
      buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `${ui.getEmoji("arcade") || "🕹️"} Tic-Tac-Toe Minigame`,
        description: desc,
        buttonsRow: buildBoardUI(board, disabled),
        footerText: ui.getFooter("core"),
      });

    await interaction.editReply(
      renderTtt(
        `Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\nKamu adalah ❌. Lawan AI bot ⭕!`,
      ),
    );
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_7", true);

      const pos = parseInt(i.customId.split("_")[1]);
      board[pos] = "X";
      let status = checkWin(board);

      if (!status) {
        const emptySpots = board.filter((s) => s !== "X" && s !== "O");
        if (emptySpots.length > 0) {
          const botMove =
            emptySpots[Math.floor(Math.random() * emptySpots.length)];
          board[botMove] = "O";
          status = checkWin(board);
        }
      }

      if (status) {
        let msg = "";
        if (status === "X") {
          const winNsf = profile.isPremium ? taruhan * 2 : taruhan;
          profile.minigame_tttWin += 1;
          await profile.save({ fields: ["minigame_tttWin"] });
          await cacheManager.incrementUserSurvival(user.id, "starFragments", winNsf);
          msg = `${ui.getEmoji("trophy") || "🏆"} **KAMU MENANG!** Kamu mendapatkan **${(taruhan * 2).toLocaleString()}** ${coinEmoji}.`;
        } else if (status === "O") {
          await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
          msg = `${ui.getEmoji("skull") || "💀"} **KAMU KALAH!** Bot AI memenangkan taruhan **${taruhan.toLocaleString()}** ${coinEmoji}.`;
        } else {
          msg = `${ui.getEmoji("handshake") || "🤝"} **SERI!** Permainan imbang, taruhan NSF dikembalikan.`;
        }
        await i.update(renderTtt(msg, true));
        collector.stop();
      } else {
        await i.update(
          renderTtt(
            `Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\nGiliran berikutnya! Kamu ❌ vs AI ⭕.`,
          ),
        );
        collector.resetTimer();
      }
    });

    collector.on("end", async (collected) => {
      if (checkWin(board) === null) {
        await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
        await interaction
          .editReply(
            renderTtt(
              `⏰ **WAKTU HABIS!** Kamu dianggap WO dan kehilangan taruhan.`,
              true,
            ),
          )
          .catch(() => {});
      }
    });
  }

  // ==========================================
  // 🟩 WORDLE (Tebak Kata 5 Huruf)
  // ==========================================
  else if (subcommand === "wordle") {
    const taruhan = interaction.options.getInteger("taruhan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan)
      return sendError(`Taruhan tidak valid atau saldo Star Fragments (NSF) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`);

    const targetWord =
      wordleWords[Math.floor(Math.random() * wordleWords.length)];
    let attempts = 0;
    const maxAttempts = 6;
    const gridHistory = [];

    await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);

    const payload = buildContainerV2({
      accentColorHex: "#2b2d31",
      title: "🟩 🟨 ⬛ Naura Wordle (ID)",
      description: `Aku telah memikirkan **Kata 5 Huruf** (Bahasa Indonesia).\nKetik tebakanmu di chat ini!\n\n**Kesempatan:** ${maxAttempts - attempts}\n**Taruhan:** ${taruhan.toLocaleString()} ${coinEmoji} (Menang = 3x Lipat)`,
      footerText: "Ketik 5 huruf sekarang...",
    });

    await interaction.editReply(payload);

    const filter = (m) => m.author.id === user.id && m.content.length === 5;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (m) => {
      const guess = m.content.toUpperCase();
      attempts++;

      let resultRow = "";
      const targetArr = targetWord.split("");
      const guessArr = guess.split("");
      const statusArr = ["⬛", "⬛", "⬛", "⬛", "⬛"];

      for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
          statusArr[i] = "🟩";
          targetArr[i] = null;
          guessArr[i] = null;
        }
      }
      for (let i = 0; i < 5; i++) {
        if (guessArr[i] !== null && targetArr.includes(guessArr[i])) {
          statusArr[i] = "🟨";
          targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
      }

      resultRow = statusArr.join(" ");
      gridHistory.push(`\`${guess}\` | ${resultRow}`);

      if (guess === targetWord) {
        const winMultiplier = profile.isPremium ? 6 : 3;
        const winNsf = taruhan * winMultiplier;
        profile.minigame_wordleWin += 1;
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
        await profile.save({ fields: ["minigame_wordleWin"] });
        await cacheManager.incrementUserSurvival(user.id, "starFragments", winNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: `${ui.getEmoji("celebrate") || "🎉"} TEPAT SEKALI!`,
          description: `Target Kata: **${targetWord}**\n\n${gridHistory.join("\n")}\n\nKamu memenangkan **${winNsf.toLocaleString()}** ${coinEmoji}!`,
          footerText: ui.getFooter("core"),
        });

        await interaction.followUp(winPayload);
        collector.stop("win");
        return;
      }

      if (attempts >= maxAttempts) {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          title: `${ui.getEmoji("skull") || "💀"} KESEMPATAN HABIS!`,
          description: `Target Kata yang benar adalah: **${targetWord}**\n\n${gridHistory.join("\n")}\n\nKamu kehilangan taruhanmu.`,
          footerText: ui.getFooter("core"),
        });

        await interaction.followUp(losePayload);
        collector.stop("lose");
        return;
      }

      const updatePayload = buildContainerV2({
        accentColorHex: "#2b2d31",
        title: "🟩 🟨 ⬛ Naura Wordle",
        description: `**Riwayat Tebakan:**\n${gridHistory.join("\n")}\n\nSisa kesempatan: **${maxAttempts - attempts}**`,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(updatePayload);
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU MENEBAK HABIS!`,
          description: `Waktu bermain telah habis!\nTarget Kata yang benar adalah **${targetWord}**.`,
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // 🧞 AKINATOR
  // ==========================================
  else if (subcommand === "akinator") {
    let Aki;
    let aki;
    try {
      ({ Aki } = require("aki-api"));
      const region = "id";
      aki = new Aki({ region });
    } catch (err) {
      const errPayload = buildErrorContainerV2({
        title: "Akinator Sedang Pemeliharaan",
        description: "Modul Akinator sedang dalam perbaikan paket server. Silakan coba minigame seru lainnya dulu ya!",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    const loadingAki = buildContainerV2({
      accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
      title: `${ui.getEmoji("magic") || "🧞"} Akinator`,
      iconURL: "https://i.imgur.com/2U5K1r1.png",
      description:
        "Sedang memanggil Akinator dari lampu ajaib... Mohon tunggu.",
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(loadingAki);

    try {
      await aki.start();
    } catch (e) {
      const errPayload = buildErrorContainerV2({
        title: "Akinator Offline",
        description: "Akinator sedang tidur atau tidak merespons, coba lagi nanti ya.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    const buildAkiUI = () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aki_0")
          .setLabel("Ya")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("aki_1")
          .setLabel("Tidak")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("aki_2")
          .setLabel("Tidak Tahu")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("aki_3")
          .setLabel("Mungkin")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("aki_4")
          .setLabel("Mungkin Tidak")
          .setStyle(ButtonStyle.Primary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aki_back")
          .setLabel("Kembali")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(aki.currentStep === 0),
        new ButtonBuilder()
          .setCustomId("aki_stop")
          .setLabel("Berhenti")
          .setStyle(ButtonStyle.Danger),
      );

      return buildContainerV2({
        accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
        title: `${ui.getEmoji("magic") || "🧞"} Akinator (Pertanyaan ke-${aki.currentStep + 1})`,
        description:
          "**" +
          aki.question +
          "**\n\n*Progres: " +
          Math.round(aki.progress) +
          "%*",
        iconURL: "https://i.imgur.com/2U5K1r1.png",
        buttonsRow: [row, row2],
        footerText: ui.getFooter("core"),
      });
    };

    await interaction.editReply(buildAkiUI());
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 120000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_8", true);

      await i.deferUpdate();
      collector.resetTimer();

      try {
        if (i.customId === "aki_stop") {
          collector.stop("stopped");
          const errPayload = buildErrorContainerV2({
            title: "Akinator Dihentikan",
            description: "Permainan Akinator dihentikan.",
            footerText: ui.getFooter("core"),
          });
          return i.editReply({ ...errPayload, components: [] });
        }

        if (i.customId === "aki_back") {
          await aki.back();
        } else {
          const answerId = parseInt(i.customId.split("_")[1]);
          await aki.step(answerId);
        }

        if (aki.progress >= 85 || aki.currentStep >= 79) {
          await aki.win();
          const guess = aki.answers[0];

          if (!guess) {
            const errPayload = buildErrorContainerV2({
              title: "Akinator Menyerah",
              description:
                "Akinator menyerah! Dia tidak bisa menebak karaktermu.",
              footerText: ui.getFooter("core"),
            });
            return i.editReply({ ...errPayload, components: [] });
          }

          const winPayload = buildContainerV2({
            accentColorHex: "#22c55e",
            title: `${ui.getEmoji("magic") || "🧞"} Akinator Berhasil Menebak!`,
            description:
              "Saya yakin karakter yang kamu pikirkan adalah **" +
              guess.name +
              "**\n*" +
              guess.description +
              "*",
            footerText: "Akinator menebak pada percobaan ke-" + aki.currentStep,
          });

          collector.stop("win");
          return i.editReply({ ...winPayload, components: [] });
        }

        await i.editReply(buildAkiUI());
      } catch (e) {
        collector.stop("error");
        const errPayload = buildErrorContainerV2({
          title: "Koneksi Error",
          description: "Terjadi kesalahan koneksi ke server Akinator.",
          footerText: ui.getFooter("core"),
        });
        return i.editReply({ ...errPayload, components: [] });
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const errPayload = buildErrorContainerV2({
          title: "Waktu Habis",
          description:
            "Akinator bosan menunggu jawabanmu. Permainan dibatalkan.",
          footerText: ui.getFooter("core"),
        });
        interaction
          .editReply({ ...errPayload, components: [] })
          .catch(() => {});
      }
    });
  }

  // ==========================================
  // 🔤 HANGMAN
  // ==========================================
  else if (subcommand === "hangman") {
    const words = [
      "ASTRONOT",
      "KOMPUTER",
      "TELEVISI",
      "MIKROSKOP",
      "HELIKOPTER",
      "METEOROLOGI",
      "KONSTITUSI",
      "UNIVERSITAS",
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    const guessed = [];
    let wrongAttempts = 0;
    const maxAttempts = 6;

    const buildHangmanString = () => {
      let str = "";
      for (const char of word) {
        if (guessed.includes(char)) str += char + " ";
        else str += "_ ";
      }
      return str.trim();
    };

    const renderHangmanStage = (attempts) => {
      const stages = [
        "\n\n\n\n\n\n=========",
        "\n      |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n      |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n  |   |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n /|\\  |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n      |\n=========",
      ];
      return stages[attempts];
    };

    const payload = buildContainerV2({
      accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
      title: `${ui.getEmoji("desc") || "🔤"} Hangman`,
      description:
        "Ketik satu huruf untuk menebak kata berikut!\n\n**" +
        buildHangmanString() +
        "**\n\n```" +
        renderHangmanStage(wrongAttempts) +
        "```\n\nKesempatan tersisa: **" +
        (maxAttempts - wrongAttempts) +
        "**",
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);

    const filter = (m) =>
      m.author.id === user.id &&
      m.content.length === 1 &&
      /[a-zA-Z]/.test(m.content);
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (m) => {
      const char = m.content.toUpperCase();
      m.delete().catch(() => {});

      if (guessed.includes(char)) {
        return interaction.followUp({
          content: "Kamu sudah menebak huruf itu!",
          flags: MessageFlags.Ephemeral,
        });
      }

      guessed.push(char);

      if (!word.includes(char)) {
        wrongAttempts++;
      }

      const isWin = word.split("").every((c) => guessed.includes(c));

      if (isWin) {
        const rewardNsf = Math.floor(250 * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: `${ui.getEmoji("celebrate") || "🎉"} TEPAT SEKALI!`,
          description:
            "Kata yang benar adalah: **" +
            word +
            "**\n\nKamu berhasil menyelamatkannya!\nKamu mendapatkan **" +
            rewardNsf +
            "** " +
            coinEmoji +
            "!",
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(winPayload);
        collector.stop("win");
        return;
      }

      if (wrongAttempts >= maxAttempts) {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          title: `${ui.getEmoji("skull") || "💀"} GAME OVER`,
          description:
            "Kata yang benar adalah: **" +
            word +
            "**\n\n```" +
            renderHangmanStage(wrongAttempts) +
            "```",
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(losePayload);
        collector.stop("lose");
        return;
      }

      const updatePayload = buildContainerV2({
        accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
        title: `${ui.getEmoji("desc") || "🔤"} Hangman`,
        description:
          "Huruf tertebak: " +
          guessed.join(", ") +
          "\n\n**" +
          buildHangmanString() +
          "**\n\n```" +
          renderHangmanStage(wrongAttempts) +
          "```\n\nKesempatan tersisa: **" +
          (maxAttempts - wrongAttempts) +
          "**",
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(updatePayload);
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu bermain telah habis!\nKata yang benar adalah **${word}**.`,
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // 🎴 MEMORY MATCH
  // ==========================================
  else if (subcommand === "memory") {
    const emojis = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍒"];
    const board = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let flipped = [];
    const matched = [];
    let attempts = 0;

    const buildMemoryBoard = (disableAll = false) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 4; j++) {
          const idx = i * 4 + j;
          const isFlipped = flipped.includes(idx) || matched.includes(idx);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId("mem_" + idx)
              .setLabel(isFlipped ? board[idx] : "❓")
              .setStyle(
                matched.includes(idx)
                  ? ButtonStyle.Success
                  : isFlipped
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
              )
              .setDisabled(disableAll || isFlipped),
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const renderMemory = (desc, disabled = false) =>
      buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#00FFFF",
        title: `${ui.getEmoji("arcade") || "🎴"} Memory Match`,
        description: desc,
        buttonsRow: buildMemoryBoard(disabled),
        footerText: ui.getFooter("core"),
      });

    await interaction.editReply(
      renderMemory("Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**"),
    );
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_9", true);

      const idx = parseInt(i.customId.split("_")[1]);
      flipped.push(idx);

      if (flipped.length === 2) {
        attempts++;
        await i.update(
          renderMemory(
            "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
            true,
          ),
        );

        const [first, second] = flipped;
        if (board[first] === board[second]) {
          matched.push(first, second);
        }

        setTimeout(async () => {
          flipped = [];
          const isWin = matched.length === board.length;

          if (isWin) {
            const rewardNsf = profile.isPremium ? 500 : 250;
            await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
            await interaction.editReply(
              renderMemory(
                "Berhasil mencocokkan semua dalam **" +
                  attempts +
                  "** percobaan!\nKamu mendapat **" +
                  rewardNsf +
                  "** " +
                  coinEmoji +
                  "!",
                true,
              ),
            );
            collector.stop("win");
          } else {
            await interaction.editReply(
              renderMemory(
                "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
              ),
            );
          }
        }, 1000);
      } else {
        await i.update(
          renderMemory(
            "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
          ),
        );
      }
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: "Waktu untuk mencocokkan emoji telah habis! Silakan coba lagi kapan-kapan yaa! 👋",
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // 🔠 TEBAK KATA (ANAGRAM)
  // ==========================================
  else if (subcommand === "tebakkata") {
    const diff = interaction.options.getString("kesulitan");
    const words = anagramDB[diff];
    const targetWord = words[Math.floor(Math.random() * words.length)];

    let shuffledWord = targetWord;
    while (shuffledWord === targetWord) {
      shuffledWord = targetWord
        .split("")
        .sort(() => Math.random() - 0.5)
        .join(" ");
    }

    const conf = diff === "mudah" ? rewards.pemula : rewards.lanjut;
    const rewardCoin = Math.floor(conf.coin * 1.5);

    const tebakKataPayload = buildContainerV2({
      accentColorHex: conf.color,
      title: `🔠 Tebak Kata [${diff.toUpperCase()}]`,
      description: `Susun kembali huruf-huruf berikut menjadi kata yang benar:\n\n**${shuffledWord}**\n\n⏳ Ketik jawabanmu dalam waktu **${conf.time / 1000} detik**!\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(tebakKataPayload);
    const gameStartTime = Date.now();

    const filter1 = (m) => m.author.id === user.id;
    const collector1 = interaction.channel.createMessageCollector({
      filter: filter1,
      time: conf.time,
      max: 1,
    });

    collector1.on("collect", async (m) => {
      const userAns = String(m.content).replace(/\s+/g, "").trim().toUpperCase();
      const targetAns = String(targetWord).replace(/\s+/g, "").trim().toUpperCase();
      if (userAns === targetAns) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1000) {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector1.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} SUSUNAN KATA BENAR!`,
          description: `Pintar sekali! Kata yang tepat adalah **${targetWord}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} TEBAKAN SALAH`,
          description: `Kata yang benar adalah **${targetWord}**.\nCoba lagi di permainan berikutnya yaa!`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector1.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menyusun kata telah habis!\nKata yang benar adalah **${targetWord}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  } else if (subcommand === "tebakgambar") {
    const gameData =
      tebakGambarDB[Math.floor(Math.random() * tebakGambarDB.length)];
    const rewardCoin = 250;

    const tebakGambarPayload = buildContainerV2({
      accentColorHex: ui.getColor ? ui.getColor("primary") : "#00FFFF",
      title: `${ui.getEmoji("desc") || "🖼️"} Tebak Gambar Objek`,
      description: `Ketik apa objek yang ada pada gambar di atas!\n\n${ui.getEmoji("sparkle") || "💡"} **Klu:** ${gameData.clue}\n\n${ui.getEmoji("clock") || "⏳"} Waktu: **20 detik**\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(tebakGambarPayload);
    const gameStartTime = Date.now();

    const filter2 = (m) => m.author.id === user.id;
    const collector2 = interaction.channel.createMessageCollector({
      filter: filter2,
      time: 20000,
      max: 1,
    });

    collector2.on("collect", async (m) => {
      const userAns = String(m.content).replace(/\s+/g, "").trim().toLowerCase();
      const targetAns = String(gameData.answer).replace(/\s+/g, "").trim().toLowerCase();
      if (userAns === targetAns) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1000) {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector2.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} TEBAKAN OBJEK BENAR!`,
          description: `Hebat! Objek pada gambar tersebut memang **${gameData.answer}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} TEBAKAN SALAH`,
          description: `Bukan itu objeknya!\nJawaban yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector2.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menebak telah habis!\nObjek yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  } else if (subcommand === "tts") {
    const gameData = ttsDB[Math.floor(Math.random() * ttsDB.length)];
    const rewardCoin = 400;

    const ttsPayload = buildContainerV2({
      accentColorHex: "#FF00FF",
      title: `${ui.getEmoji("notes") || "📝"} Teka Teki Silang Mini`,
      description: `Jawablah kedua klu di bawah ini secara berurutan, pisahkan dengan **spasi**.\n*(Contoh jawaban: \`buku pensil\`)*\n\n${gameData.clue}\n\n${ui.getEmoji("clock") || "⏳"} Waktu: **25 detik**\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(ttsPayload);
    const gameStartTime = Date.now();

    const filter = (m) => m.author.id === user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 25000,
      max: 1,
    });

    collector.on("collect", async (m) => {
      const userAns = String(m.content).replace(/\s+/g, "").trim().toLowerCase();
      const targetAns = String(gameData.answer).replace(/\s+/g, "").trim().toLowerCase();
      if (userAns === targetAns) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1000) {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} JAWABAN TTS TEPAT!`,
          description: `Luar biasa! Kamu berhasil memecahkan TTS ini dengan sempurna.\n\n> 📝 **Kunci:** \`${gameData.answer}\`\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} JAWABAN TTS SALAH`,
          description: `Jawabanmu belum sesuai dengan kedua klu.\nJawaban yang tepat adalah: **${gameData.answer}**`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menyelesaikan TTS telah habis!\nJawaban yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  }

  // ==========================================
  // 🎭 SUBCOMMAND: TRUTH OR DARE
  // ==========================================
  else if (subcommand === "tod") {
    const opponent = interaction.options.getUser("teman");
    const initiator = interaction.user;
    let currentPlayer = initiator;

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("tod_truth")
        .setLabel("Truth (Jujur)")
        .setStyle(ButtonStyle.Success)
        .setEmoji(ui.getEmoji("tod_truth") || "📝"),
      new ButtonBuilder()
        .setCustomId("tod_dare")
        .setLabel("Dare (Tantangan)")
        .setStyle(ButtonStyle.Danger)
        .setEmoji(ui.getEmoji("tod_dare") || "😈"),
      new ButtonBuilder()
        .setCustomId("tod_spin")
        .setLabel("Putar Botol 🔄")
        .setStyle(ButtonStyle.Primary),
    );

    const todPayload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#FFB6C1",
      title: `${ui.getEmoji("setup_autorole") || "🎭"} TRUTH OR DARE ${ui.getEmoji("setup_autorole") || "🎭"}`,
      description: `Sekarang giliran <@${currentPlayer.id}> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?`,
      iconURL: currentPlayer.displayAvatarURL(),
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    const msg = await interaction.editReply({
      ...todPayload,
      fetchReply: true,
    });

    const collector = msg.createMessageComponentCollector({ time: 180000 });

    collector.on("collect", async (i) => {
      if (i.user.id !== currentPlayer.id) {
        return i.reply({
          content: `❌ Ini giliran <@${currentPlayer.id}> untuk memilih!`,
          flags: MessageFlags.Ephemeral,
        });
      }

      await i.deferUpdate();

      if (i.customId === "tod_spin") {
        let chosenUser = initiator;
        if (opponent) {
          chosenUser = currentPlayer.id === initiator.id ? opponent : initiator;
        } else {
          try {
            const members = await interaction.guild.members.fetch();
            const activeMembers = members.filter(
              (m) => !m.user.bot && m.user.id !== currentPlayer.id,
            );
            if (activeMembers.size > 0) {
              chosenUser = activeMembers.random().user;
            }
          } catch (e) {
            logger.error("[TOD SPIN ERROR]", e);
          }
        }

        currentPlayer = chosenUser;

        const spinPayload = buildContainerV2({
          accentColorHex: ui.colors.primary || "#FFB6C1",
          title: `${ui.getEmoji("trade") || "🔄"} BOTOL BERPUTAR... ${ui.getEmoji("trade") || "🔄"}`,
          description: `Botol menunjuk ke <@${currentPlayer.id}>!\n\nSekarang giliran <@${currentPlayer.id}> untuk memilih **Truth** atau **Dare**!`,
          iconURL: currentPlayer.displayAvatarURL(),
          buttonsRow: row,
          footerText: ui.getFooter("core"),
        });

        return i.editReply(spinPayload);
      }

      if (i.customId === "tod_truth" || i.customId === "tod_dare") {
        const isTruth = i.customId === "tod_truth";
        const actionText = isTruth ? "Truth (Pertanyaan)" : "Dare (Tantangan)";
        const actionEmoji = isTruth
          ? ui.getEmoji("tod_truth") || "📝"
          : ui.getEmoji("tod_dare") || "😈";

        const loadingPayload = buildContainerV2({
          accentColorHex: ui.colors.primary || "#FFB6C1",
          description: `${ui.getEmoji("loading") || "⏳"} Naura sedang mencari inspirasi ${actionText} yang menarik untukmu... ✨`,
          footerText: ui.getFooter("core"),
        });

        await i.editReply(loadingPayload);

        let promptAI = "";
        if (isTruth) {
          promptAI = `Buatkan 1 pertanyaan Truth (jujur) yang sangat memalukan, lucu, seru, dan menantang untuk dijawab di depan teman-teman. Jawab hanya berupa teks pertanyaan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
        } else {
          promptAI = `Buatkan 1 tantangan Dare (tantangan) yang lucu, konyol, menantang, aman, dan menghibur untuk dilakukan. Jawab hanya berupa teks tantangan dalam Bahasa Indonesia murni tanpa tambahan apa pun.`;
        }

        let generatedChallenge = "";
        try {
          const rawText = await geminiClient.generate({
            model: "gemini-2.5-flash",
            parts: [{ text: promptAI }],
          });
          generatedChallenge = (rawText || "").trim();
        } catch (err) {
          logger.error("[TOD GEMINI ERROR]", err);
          if (isTruth) {
            const fallbackTruths = [
              "Apa rahasia terbesar yang belum pernah kamu ceritakan kepada siapa pun di server ini?",
              "Kapan terakhir kali kamu menangis dan apa alasannya?",
              "Siapa orang yang paling kamu sukai diam-diam di server Discord ini?",
              "Apa hal terkonyol yang pernah kamu lakukan demi menarik perhatian seseorang?",
              "Jika kamu bisa bertukar tubuh dengan salah satu temanmu selama sehari, siapa yang akan kamu pilih dan mengapa?",
            ];
            generatedChallenge =
              fallbackTruths[Math.floor(Math.random() * fallbackTruths.length)];
          } else {
            const fallbackDares = [
              "Kirim voice note bernyanyi bagian chorus dari lagu favoritmu di chat umum saat ini juga!",
              "Ubah nickname Discord-mu menjadi 'Hamba Sahaya Naura' selama 24 jam ke depan!",
              "Gunakan foto profil badut lucu selama 3 hari berturut-turut!",
              "Kirim pesan cinta acak ke salah satu bot di server ini dan screenshot balasannya!",
              "Tirukan suara hewan (seperti kucing manja atau bebek) lewat voice note dan kirim ke grup!",
            ];
            generatedChallenge =
              fallbackDares[Math.floor(Math.random() * fallbackDares.length)];
          }
        }

        const doneRow = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("tod_done")
            .setLabel("Selesai")
            .setStyle(ButtonStyle.Success),
          new ButtonBuilder()
            .setCustomId("tod_next_turn")
            .setLabel("Giliran Baru")
            .setStyle(ButtonStyle.Primary),
        );

        const challengePayload = buildContainerV2({
          accentColorHex: isTruth ? "#2ecc71" : "#e74c3c",
          authorName: `Tantangan ${actionText} untuk ${currentPlayer.username}`,
          iconURL: currentPlayer.displayAvatarURL(),
          description: `### ${actionEmoji} ${actionText}\n\n> **${generatedChallenge}**`,
          buttonsRow: doneRow,
          footerText: "Klik tombol di bawah jika kamu sudah menyelesaikannya!",
        });

        await i.editReply(challengePayload);
      }
    });

    collector.on("collect", async (i) => {
      if (i.customId === "tod_done" || i.customId === "tod_next_turn") {
        if (i.user.id !== currentPlayer.id) {
          return i.reply({
            content: `${ui.getEmoji("error") || "❌"} Hanya pemain aktif yang bisa menekan tombol ini!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        await i.deferUpdate();

        if (i.customId === "tod_done") {
          const nextRow = new ActionRowBuilder().addComponents(
            new ButtonBuilder()
              .setCustomId("tod_next_turn")
              .setLabel("Main Lagi")
              .setStyle(ButtonStyle.Primary),
          );
          const donePayload = buildContainerV2({
            accentColorHex: "#2ecc71",
            title: `${ui.getEmoji("celebrate") || "🎉"} TANTANGAN SELESAI ${ui.getEmoji("celebrate") || "🎉"}`,
            description: `Hebat! <@${currentPlayer.id}> berhasil menyelesaikan tantangan mereka!\n\nApakah kalian ingin bermain lagi?`,
            buttonsRow: nextRow,
            footerText: ui.getFooter("core"),
          });
          await i.editReply(donePayload);
        } else if (i.customId === "tod_next_turn") {
          if (opponent) {
            currentPlayer =
              currentPlayer.id === initiator.id ? opponent : initiator;
          }

          const nextPayload = buildContainerV2({
            accentColorHex: ui.colors.primary || "#FFB6C1",
            title: `${ui.getEmoji("setup_autorole") || "🎭"} TRUTH OR DARE ${ui.getEmoji("setup_autorole") || "🎭"}`,
            description: `Sekarang giliran <@${currentPlayer.id}> untuk memilih!\n\nApakah kamu memilih **Truth** (Jujur) atau **Dare** (Tantangan)?`,
            iconURL: currentPlayer.displayAvatarURL(),
            buttonsRow: row,
            footerText: ui.getFooter("core"),
          });

          await i.editReply(nextPayload);
        }
      }
    });

    collector.on("end", () => {
      msg.edit({ components: [] }).catch(() => {});
    });
  }

  // ==========================================
  // 🏆 LEADERBOARD MINIGAMES (KINI MENDUKUNG DUEL)
  // ==========================================
  else if (subcommand === "leaderboard") {
    const category = interaction.options.getString("kategori");

    const isMath = category === "math";
    const isTrivia = category === "trivia";
    const isDuel = category === "duel";

    let title = "";
    if (isMath) title = `${ui.getEmoji("tools") || "🧮"} Top 10 GrandMaster Matematika`;
    else if (isTrivia) title = `${ui.getEmoji("intelligence") || "🧠"} Top 10 GrandMaster Trivia`;
    else if (isDuel) title = `${ui.getEmoji("battle") || "⚔️"} Top 10 Jawara Duel Naura`;

    const allUsers = await UserProfile.findAll();
    const sortedUsers = allUsers
      .filter((u) => {
        if (isMath) return u.minigame_mathScore > 0;
        if (isTrivia) return u.minigame_triviaScore > 0;
        if (isDuel) return u.minigame_duelScore > 0;
      })
      .sort((a, b) => {
        if (isMath) return b.minigame_mathScore - a.minigame_mathScore;
        if (isTrivia) return b.minigame_triviaScore - a.minigame_triviaScore;
        if (isDuel) return b.minigame_duelScore - a.minigame_duelScore;
      })
      .slice(0, 10);

    if (sortedUsers.length === 0)
      return sendError("Belum ada yang mencetak skor di kategori kuis ini.");

    let descString = `> Inilah daftar pemain kuis terbaik di server!\n\n`;
    sortedUsers.forEach((u, i) => {
      const medal = i === 0 ? (ui.getEmoji("badge_gold") || "🥇") : i === 1 ? (ui.getEmoji("badge_silver") || "🥈") : i === 2 ? (ui.getEmoji("badge_bronze") || "🥉") : "🏅";
      let score = 0;
      if (isMath) score = u.minigame_mathScore;
      else if (isTrivia) score = u.minigame_triviaScore;
      else if (isDuel) score = u.minigame_duelScore;

      descString += `${medal} **#${i + 1}** | <@${u.userId}>\n> ${ui.getEmoji("trophy") || "🏆"} Skor: **${score.toLocaleString()}** Poin\n\n`;
    });

    const {
      buildContainerV2,
    } = require("../../src/utils/NauraContainerBuilder");

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#00FFFF",
      authorName: "Naura Minigames Hall of Fame",
      title,
      iconURL: interaction.client.user.displayAvatarURL(),
      description: descString,
      footerText: ui.getFooter("core"),
    });

    return interaction.editReply(payload);
  }
};

  if (subcommand === "leaderboard") {
    return executeGame();
  }

  return showMinigameIntro(interaction, subcommand, executeGame);
}
