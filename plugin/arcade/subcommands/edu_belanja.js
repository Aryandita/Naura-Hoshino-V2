"use strict";
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

const EDU_PETA_BANK = [
  { q: "Apa ibu kota provinsi Jawa Barat?", options: ["Bandung", "Bekasi", "Bogor", "Cirebon"], a: "Bandung", topic: "Jawa Barat" },
  { q: "Apa ibu kota provinsi Jawa Timur?", options: ["Surabaya", "Malang", "Sidoarjo", "Kediri"], a: "Surabaya", topic: "Jawa Timur" },
  { q: "Apa ibu kota provinsi Sumatera Utara?", options: ["Medan", "Pematangsiantar", "Binjai", "Tebing Tinggi"], a: "Medan", topic: "Sumatera Utara" },
  { q: "Apa ibu kota provinsi Sulawesi Selatan?", options: ["Makassar", "Parepare", "Palopo", "Bone"], a: "Makassar", topic: "Sulawesi Selatan" },
  { q: "Apa ibu kota provinsi Kalimantan Timur?", options: ["Samarinda", "Balikpapan", "Bontang", "Tarakan"], a: "Samarinda", topic: "Kalimantan Timur" },
  { q: "Apa ibu kota provinsi Bali?", options: ["Denpasar", "Badung", "Gianyar", "Klungkung"], a: "Denpasar", topic: "Bali" },
  { q: "Provinsi mana yang berawalan nama kota dengan huruf J?", options: ["Jawa Barat", "Aceh", "Bali", "Maluku"], a: "Jawa Barat", topic: "Jawa Barat" },
  { q: "Apa ibu kota provinsi Nusa Tenggara Barat?", options: ["Mataram", "Bima", "Dompu", "Lombok Barat"], a: "Mataram", topic: "NTB" },
  { q: "Apa ibu kota provinsi DI Yogyakarta?", options: ["Yogyakarta", "Sleman", "Bantul", "Kulon Progo"], a: "Yogyakarta", topic: "DI Yogyakarta" },
  { q: "Apa ibu kota provinsi Papua?", options: ["Jayapura", "Merauke", "Timika", "Wamena"], a: "Jayapura", topic: "Papua" },
];

const EDU_BELANJA_BANK = [
  { q: "Budi membeli 3 buku seharga Rp5000 per buku. Ia membayar Rp20000. Berapa kembalian Budi?", options: ["Rp10000", "Rp5000", "Rp15000", "Rp2500"], a: "Rp5000", topic: "Kembalian" },
  { q: "Siti membeli 2 pensil Rp2000 dan 1 penghapus Rp1500. Total belanja Siti?", options: ["Rp5500", "Rp3500", "Rp4000", "Rp5000"], a: "Rp5500", topic: "Jumlah" },
  { q: "Harga 1 kg beras Rp12000. Jika membeli 2 kg dan membayar Rp30000, kembalian berapa?", options: ["Rp6000", "Rp10000", "Rp18000", "Rp12000"], a: "Rp6000", topic: "Kembalian" },
  { q: "Andi membeli 4 roti @ Rp3000. Jika membayar Rp15000, kembaliannya?", options: ["Rp3000", "Rp12000", "Rp8000", "Rp5000"], a: "Rp3000", topic: "Kembalian" },
  { q: "Detik membeli 5 permen @ Rp1000 dan 3 coklat @ Rp2000. Totalnya?", options: ["Rp11000", "Rp8000", "Rp6000", "Rp5000"], a: "Rp11000", topic: "Jumlah" },
  { q: "Harga tas Rp45000, dibayar Rp50000. Kembaliannya?", options: ["Rp5000", "Rp10000", "Rp4500", "Rp15000"], a: "Rp5000", topic: "Kembalian" },
  { q: "Ibu membeli 3 kg gula @ Rp15000/kg. Totalnya?", options: ["Rp45000", "Rp30000", "Rp15000", "Rp60000"], a: "Rp45000", topic: "Jumlah" },
  { q: "Kakak membeli buku Rp25000 dan pulpen Rp3000. Totalnya?", options: ["Rp28000", "Rp25000", "Rp23000", "Rp32000"], a: "Rp28000", topic: "Jumlah" },
  { q: "Harga baju Rp75000, membayar Rp100000. Kembaliannya?", options: ["Rp25000", "Rp75000", "Rp5000", "Rp30000"], a: "Rp25000", topic: "Kembalian" },
  { q: "Membeli 6 kelereng @ Rp500. Totalnya?", options: ["Rp3000", "Rp2500", "Rp3500", "Rp6000"], a: "Rp3000", topic: "Jumlah" },
];

const EDU_SUKUKATA_BANK = [
  { q: "Kata berimbuhan me- pada me+ tulis adalah?", options: ["Menulis", "Ditulis", "Tertulis", "Penulis"], a: "Menulis", topic: "Imbuhan" },
  { q: "Huruf kapital yang benar untuk nama kota: bandung menjadi?", options: ["Bandung", "bandung", "BANDUNG", "BaNdUnG"], a: "Bandung", topic: "Ejaan" },
  { q: "Kata tidak baku ber- pada ber+ lari adalah?", options: ["Berlari", "Berlarii", "Berrlari", "Berlary"], a: "Berlari", topic: "Imbuhan" },
  { q: "Tanda baca yang benar untuk penutup kalimat tanya adalah?", options: ["?", "!", ".", ":"], a: "?", topic: "Ejaan" },
  { q: "Penambahan -kan pada main adalah?", options: ["Mainkan", "Mermain", "Bermain", "Termain"], a: "Mainkan", topic: "Imbuhan" },
  { q: "Pilih kata yang baku: praktek atau praktik?", options: ["Praktik", "Praktek", "Praktekk", "PraKtek"], a: "Praktik", topic: "EYD" },
  { q: "Huruf vokal dalam Bahasa Indonesia adalah?", options: ["A I U E O", "B D F G H", "P T K Q X", "S R L N M"], a: "A I U E O", topic: "Ejaan" },
  { q: "Kata berawalan pe- pada pe+ tari adalah?", options: ["Penari", "Petari", "Betari", "Tari"], a: "Penari", topic: "Imbuhan" },
  { q: "Tanda titik digunakan setelah?", options: ["Angka, singkatan, akhir kalimat", "Kalimat tanya", "Seruan", "Penekanan"], a: "Angka, singkatan, akhir kalimat", topic: "Ejaan" },
  { q: "Kata yang salah penulisan hurufnya: apotek atau apoteck?", options: ["Apotek", "Apoteck", "Appotek", "Apotekk"], a: "Apotek", topic: "EYD" },
];

const EDU_FLAGRUSH_BANK = [
  { q: "Apa ibu kota Jepang?", options: ["Tokyo", "Osaka", "Kyoto", "Nagoya"], a: "Tokyo", country: "Jepang" },
  { q: "Apa ibu kota Korea Selatan?", options: ["Seoul", "Busan", "Incheon", "Daegu"], a: "Seoul", country: "Korea Selatan" },
  { q: "Apa ibu kota Perancis?", options: ["Paris", "Lyon", "Marseille", "Nice"], a: "Paris", country: "Perancis" },
  { q: "Apa ibu kota Inggris?", options: ["London", "Manchester", "Liverpool", "Birmingham"], a: "London", country: "Inggris" },
  { q: "Apa ibu kota Jerman?", options: ["Berlin", "Munich", "Hamburg", "Frankfurt"], a: "Berlin", country: "Jerman" },
  { q: "Apa ibu kota Australia?", options: ["Canberra", "Sydney", "Melbourne", "Perth"], a: "Canberra", country: "Australia" },
  { q: "Apa ibu kota Kanada?", options: ["Ottawa", "Toronto", "Vancouver", "Montreal"], a: "Ottawa", country: "Kanada" },
  { q: "Apa ibu kota Arab Saudi?", options: ["Riyadh", "Jeddah", "Mecca", "Dammam"], a: "Riyadh", country: "Arab Saudi" },
  { q: "Apa ibu kota India?", options: ["New Delhi", "Mumbai", "Kolkata", "Chennai"], a: "New Delhi", country: "India" },
  { q: "Apa ibu kota Tiongkok?", options: ["Beijing", "Shanghai", "Guangzhou", "Shenzhen"], a: "Beijing", country: "Tiongkok" },
];

const BANKS = { edu_peta: EDU_PETA_BANK, edu_belanja: EDU_BELANJA_BANK, edu_sukukata: EDU_SUKUKATA_BANK, edu_flagrush: EDU_FLAGRUSH_BANK };

module.exports = {
  BANKS,
  async execute(interaction, context) {
    const { user, sendError } = context;
    // Which edu game? try context.gameType or infer from interaction option game
    let gameType = context.gameType;
    if (!gameType) {
      try { gameType = interaction.options?.getString?.("game"); } catch (e) {}
    }
    if (!gameType || !BANKS[gameType]) gameType = "edu_peta";
    const bank = BANKS[gameType];
    const q = bank[Math.floor(Math.random() * bank.length)];
    const opts = [...q.options].sort(() => Math.random() - 0.5);
    const correct = q.a;
    const gameId = genGameId(gameType, user.id);
    setState(gameId, "WAITING_INPUT");
    let attemptsLeft = 3;
    let finished = false;
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    await interaction.editReply(buildContainerV2({ accentColorHex: "#10B981", authorName: "Mini Edukasi Naura", title: "Soal Edukasi: " + q.q, description: "Pilih jawaban yang benar! Opsi:\n" + opts.map((o, i) => (i + 1) + ". " + o).join("\n") + "\n\nKetik nomor (1-4) atau teks jawaban persis. Waktu 30 detik, 3 kesempatan.", footerText: ui.getFooter("core") }));
    const gameStartTime = Date.now();
    const collector = interaction.channel.createMessageCollector({ filter: (m) => m.author.id === user.id, time: 30000 });
    collector.on("collect", async (m) => {
      if (finished) return;
      attemptsLeft--;
      const raw = String(m.content).trim();
      const num = parseInt(raw, 10);
      let answer = raw;
      if (!isNaN(num) && num >= 1 && num <= opts.length) answer = opts[num - 1];
      if (answer.toLowerCase() === correct.toLowerCase()) {
        finished = true;
        setState(gameId, "FINISHED");
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, gameType, "win"));
        await m.reply(buildContainerV2({ accentColorHex: "#22c55e", authorName: "Mini Edukasi Naura", title: "Jawaban Benar!", description: "Hebat! Jawaban yang benar adalah **" + correct + "**. +25 MP Edukasi!", footerText: "Skor Edukasi tersimpan per topik." }));
        collector.stop("win");
        return;
      }
      if (attemptsLeft > 0) { await m.reply(buildContainerV2({ accentColorHex: "#f59e0b", title: "Belum Tepat", description: "Sisa kesempatan: **" + attemptsLeft + "**. Coba lagi!", footerText: ui.getFooter("core") })); return; }
      finished = true;
      setState(gameId, "FINISHED");
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, gameType, "loss"));
      await m.reply(buildContainerV2({ accentColorHex: "#ef4444", title: "Kesempatan Habis", description: "Jawaban yang benar adalah **" + correct + "**. Tetap belajar!", footerText: ui.getFooter("core") }));
      collector.stop("lose");
    });
    collector.on("end", async (collected) => {
      if (!finished && collected.size === 0) {
        setState(gameId, "EXPIRED");
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, gameType, "loss"));
        await interaction.editReply(buildContainerV2({ accentColorHex: "#f59e0b", title: "WAKTU HABIS!", description: "Jawaban yang benar adalah **" + correct + "**.", footerText: ui.getFooter("core") })).catch(() => {});
      }
    });
  },
};
