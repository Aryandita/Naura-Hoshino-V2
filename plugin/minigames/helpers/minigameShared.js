"use strict";

const fs = require("node:fs");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, AttachmentBuilder } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

const rewards = {
  pemula: { coin: 50, score: 10, time: 20000, color: "#00FF00" },
  lanjut: { coin: 150, score: 30, time: 15000, color: "#00FFFF" },
  master: { coin: 300, score: 50, time: 10000, color: "#FF00FF" },
  grandmaster: { coin: 1000, score: 100, time: 15000, color: "#FFD700" },
};

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

const wordleWords = [
  "MOBIL", "MOTOR", "LAMPU", "BUNGA", "PINTU", "KAPAL", "PESAN", "SURAT",
  "BULAN", "KASUR", "LEMAR", "HUTAN", "POHON", "PASIR", "SINGA", "MACAN",
  "ELANG", "BEBEK", "KATAK", "BADAK", "KAMAR", "KASIR", "PAGAR",
];

const anagramDB = {
  mudah: [
    "PINTU", "MEJA", "KASUR", "MOBIL", "MOTOR", "BOTOL", "KIPAS", "KAPAL",
    "BUKU", "PENA", "SABUN", "AYAM", "SAPI", "KUDA",
  ],
  sulit: [
    "ASTRONOT", "KOMPUTER", "TELEVISI", "MIKROSKOP", "HELIKOPTER",
    "METEOROLOGI", "KONSTITUSI", "UNIVERSITAS",
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
      "> 3. Pemain yang berhasil membuat garis lurus pertama adalah pemenangnya!",
    tip: "Kuasai kotak tengah grid terlebih dahulu untuk membuka peluang menang terbesar!",
  },
  wordle: {
    title: "Wordle 5 Huruf",
    emoji: "🟩",
    description:
      "Tebak kata rahasia 5 huruf dalam 6 kesempatan!\n\n" +
      "**Arti Warna Kotak:**\n" +
      "> 🟩 Hijau: Huruf tepat di posisi yang benar\n" +
      "> 🟨 Kuning: Huruf ada di dalam kata tapi posisinya salah\n" +
      "> ⬛ Abu-abu: Huruf tidak ada di dalam kata",
    tip: "Gunakan kata pertama yang mengandung banyak vokal (A, I, U, E, O)!",
  },
  akinator: {
    title: "Akinator AI Tebak Karakter",
    emoji: "🧞",
    description:
      "Pikirkan satu karakter anime, game, atau tokoh nyata, dan biarkan Naura menebaknya!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Simpan satu nama tokoh di pikiranmu.\n" +
      "> 2. Jawab serangkaian pertanyaan dari Naura dengan jujur.\n" +
      "> 3. Naura akan menebak siapa tokoh yang kamu maksud!",
    tip: "Jawablah dengan yakin sesuai fakta karakter tersebut agar tebakan Naura akurat!",
  },
  hangman: {
    title: "Hangman Klasik",
    emoji: "🪢",
    description:
      "Tebak huruf demi huruf untuk melengkapi kata rahasia!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Tebak huruf yang ada pada kata rahasia.\n" +
      "> 2. Setiap tebakan salah akan menambah satu bagian tali gantungan.\n" +
      "> 3. Lengkapi seluruh kata sebelum kesempatan habis!",
    tip: "Tebak huruf vokal terlebih dahulu sebelum mencoba konsonan langka!",
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
  blackjack: {
    title: "Blackjack 21 Kasino",
    emoji: "🃏",
    description:
      "Tantang dealer Naura dalam permainan kartu Blackjack 21 standar!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pasang taruhan Star Fragments (NSF) dan dapatkan 2 kartu awal.\n" +
      "> 2. Pilih **Hit** untuk menambah kartu, **Stand** untuk bertahan, **Double** untuk menggandakan taruhan, atau **Split** jika kartumu kembar.\n" +
      "> 3. Dapatkan nilai sedekat mungkin dengan 21 tanpa melebihi 21 (Bust)!\n" +
      "> 4. Dealer wajib stand pada semua nilai 17 (Hard & Soft). Natural Blackjack membayar 3:2!",
    tip: "Perhatikan kartu terbuka dealer! Jika kartu dealer bernilai 4, 5, atau 6, dealer memiliki risiko bust yang tinggi.",
  },
  typerace: {
    title: "TypeRacer Kecepatan Ketik",
    emoji: "⌨️",
    description:
      "Uji kecepatan jari dan ketelitian mengetikmu dalam arena TypeRacer!\n\n" +
      "**Cara Bermain:**\n" +
      "> 1. Pilih tingkat kesulitan (Mudah, Sedang, Sulit) dan pasang taruhan opsional.\n" +
      "> 2. Baca teks kutipan target yang diberikan.\n" +
      "> 3. Tekan tombol **Mulai Ketik 🏁** untuk membuka jendela modal input.\n" +
      "> 4. Ketik teks secepat dan seakurat mungkin sebelum batas waktu 90 detik habis!",
    tip: "Akurasi minimal 85% wajib dipenuhi agar kecepatan WPM menghasilkan hadiah Star Fragments!",
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
        (i.customId === `mg_intro_start_${interaction.user.id}` ||
          i.customId === `mg_intro_cancel_${interaction.user.id}`),
      time: 60000,
    });

    if (confirmation.customId === `mg_intro_cancel_${interaction.user.id}`) {
      await confirmation.update({
        content: "❌ Permainan dibatalkan. Panggil Naura lagi jika kamu sudah siap bermain ya!",
        embeds: [],
        components: [],
      });
      return;
    }

    await confirmation.deferUpdate();
    return onStart();
  } catch (e) {
    await interaction
      .editReply({
        content: "⏳ Waktu konfirmasi habis. Permainan dibatalkan otomatis.",
        embeds: [],
        components: [],
      })
      .catch(() => {});
  }
}

module.exports = {
  rewards,
  triviaDBFallback,
  generateMath,
  wordleWords,
  anagramDB,
  tebakGambarDB,
  ttsDB,
  MINIGAME_INFOS,
  showMinigameIntro,
};
