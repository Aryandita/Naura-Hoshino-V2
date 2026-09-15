"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
} = require("discord.js");

const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

const CHAPTERS = {
  intro: {
    label: "Panduan Awal & Tri-Vital",
    emoji: "🌟",
    description: "Dasar kelangsungan hidup, indikator vital, dan perjalanan",
    content: [
      "### 🌟 Bab 1: Memulai Petualangan di Naura Wilds",
      "Selamat datang di dunia petualangan **Naura Wilds**! Berikut dasar-dasar yang perlu kamu ketahui:",
      "",
      "**1. Indikator Tri-Vital (Kondisi Fisik):**",
      "• **Health (Darah):** Nyawa karaktermu. Jangan biarkan habis akibat serangan monster atau kelaparan ekstrem!",
      "• **Hunger (Lapar):** Berkurang saat kamu beraktivitas. Pulihkan dengan `/survival consume` memakan makanan seperti apel, ikan bakar, atau hidangan kafe.",
      "• **Stamina (Energi):** Digunakan saat menebang pohon, menambang, memancing, atau menjelajah dungeon. Pulihkan dengan tidur di kasur via `/survival rest`.",
      "",
      "**2. Perpindahan Wilayah (Traveling):**",
      "• Gunakan `/survival travel <lokasi>` untuk berpindah antara: `Desa`, `Hutan`, `Tambang`, `Laut`, `Kota`, `Kampus`, dan `Taman`.",
      "• Berbagai aktivitas hanya dapat dilakukan di wilayah tertentu (contoh: Memancing di Laut, Bank di Kota).",
    ].join("\n"),
  },
  gather: {
    label: "Pengumpulan & Perakitan Alat",
    emoji: "⛏️",
    description: "Menebang, menambang, memancing, dan merakit perlengkapan",
    content: [
      "### ⛏️ Bab 2: Pengumpulan Sumber Daya & Crafting",
      "",
      "**1. Ekstraksi Bahan Alam:**",
      "• **/survival gather chop:** Menebang pohon di Hutan untuk mendapatkan berbagai jenis kayu.",
      "• **/survival gather mine:** Menambang batu, bijih tembaga, titanium, dan kristal kosmik di Tambang.",
      "• **/survival gather fish:** Memancing di Laut dangkal atau Samudra dalam untuk koleksi Vivarium.",
      "• **/survival gather collect:** Mencari herba liar, bahan pangan, dan serat alami.",
      "",
      "**2. Meja Perakitan (Crafting Workshop):**",
      "• Gunakan `/survival craft` untuk mengolah bahan mentah menjadi kapak, beliung, pancingan, pedang, dan armor bertingkat.",
      "• Semakin tinggi Tier perlengkapanmu, semakin cepat kamu mengumpulkan bahan langka!",
      "• Perhatikan durabilitas alat! Perbaiki peralatanmu di bengkel sebelum rusak parah.",
    ].join("\n"),
  },
  economy: {
    label: "Sistem Moneter & Dompet",
    emoji: "💰",
    description: "Mata uang NSF, Coin, Kupon, kurs dinamis, dan Undian Astral",
    content: [
      "### 💰 Bab 3: Tiga Pilar Mata Uang & Sirkulasi Tertutup",
      "",
      "**1. Karakteristik Mata Uang:**",
      "• **Naura Star Fragments (NSF):** Mata uang alam liar untuk belanja di desa, kafe, perbaikan alat, dan riset klan.",
      "• **Naura Coin (NC):** Mata uang peradaban kota untuk pasar saham, reksa dana, dan kasino server.",
      "• **Naura Coupon:** Mata uang prestise langka untuk peningkatan Battle Pass dan kosmetik eksklusif.",
      "",
      "**2. Kebijakan One-Way Bridge di Central Bank:**",
      "• Kamu dapat menjual hasil panen dan jarahan alam (NSF) ke mata uang kota (Coin) di `/survival bank`.",
      "• Penukaran Coin kembali ke NSF dilarang demi menjaga keadilan tantangan petualangan.",
      "",
      "**3. Sistem Daur Ulang Komunitas 100%:**",
      "• Setiap biaya perbaikan dan administrasi bank dialirkan kembali untuk membangun fasilitas sektor wilayah, mendanai subsidi harian petualang pemula (Lv 1 - 10), dan jackpot mingguan **Astral Lottery**!",
      "• Cek saldo dan kuota undianmu kapan saja melalui `/survival wallet`.",
    ].join("\n"),
  },
  combat: {
    label: "Dungeon & Celestial Abyss Raid",
    emoji: "⚔️",
    description: "Pertarungan monster, dungeon prosedural, dan drop pool",
    content: [
      "### ⚔️ Bab 4: Pertempuran, Dungeon, & Celestial Abyss",
      "",
      "**1. Ekspedisi Dungeon Standar:**",
      "• Masuk ke dungeon melalui `/survival dungeon` untuk menguji kekuatan tempurmu melawan monster gua.",
      "• Dapatkan bahan craft langka, relik permata, dan XP musiman.",
      "",
      "**2. Co-Op The Neo-Abyss Celestial Raid:**",
      "• Jelajahi dungeon raid prosedural bertingkat bersama rekan servermu via `/survival activity abyss`.",
      "• Pilih rute ruangan: Pertarungan, Ruang Harta, Istirahat, atau Event Misterius.",
      "• Kalahkan bos lantai untuk mengklaim drop pool legendaris!",
      "",
      "**3. World Boss Raid:**",
      "• Ikuti penaklukan World Boss raksasa secara berkala untuk memperebutkan papan peringkat kerusakan (*Damage Leaderboard*) all-time.",
    ].join("\n"),
  },
  lifestyle: {
    label: "Kehidupan, Rumah & Klan",
    emoji: "🏡",
    description: "Hidroponik greenhouse, kafe maid, klan, dan territory war",
    content: [
      "### 🏡 Bab 5: Gaya Hidup, Sosial, & Aliansi Klan",
      "",
      "**1. Cyber-Agronomy Greenhouse:**",
      "• Kelola lahan hidroponik di `/survival farm` untuk menanam benih kosmik dan memanen bahan makanan kafe.",
      "",
      "**2. Hewan Peliharaan (Pet Companion):**",
      "• Jinakkan hewan liar dan rawat di `/survival pet` agar dapat membantumu mencari barang dalam ekspedisi idle.",
      "",
      "**3. Sistem Klan & Perang Wilayah:**",
      "• Bentuk atau bergabung dengan klan via `/clan`.",
      "• Taklukkan 5 sektor strategis di Territory War untuk mendapatkan pendapatan pajak wilayah dan buff pasif seluruh anggota klan!",
    ].join("\n"),
  },
};

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    const selectMenu = new StringSelectMenuBuilder()
      .setCustomId("guide_chapter_select")
      .setPlaceholder("📖 Pilih Bab Panduan yang ingin dipelajari...")
      .addOptions(
        Object.entries(CHAPTERS).map(([key, ch]) => ({
          label: ch.label,
          description: ch.description,
          value: key,
          emoji: ch.emoji,
        })),
      );

    const row = new ActionRowBuilder().addComponents(selectMenu);

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Hoshino \u2022 Survival Academy",
      title: "📖 Panduan Lengkap Naura Wilds RPG",
      iconURL: user.displayAvatarURL(),
      description: CHAPTERS.intro.content,
      buttonsRow: row,
      footerText: "Pilih menu dropdown di atas untuk membaca bab panduan lainnya.",
    });

    const reply = await interaction.editReply(payload);
    if (!reply) return;

    const collector = reply.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: 120000,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "guide_chapter_select") {
        const selectedKey = i.values[0];
        const chapter = CHAPTERS[selectedKey] || CHAPTERS.intro;

        const updatedPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: "Naura Hoshino \u2022 Survival Academy",
          title: `📖 Panduan Naura Wilds: ${chapter.label}`,
          iconURL: user.displayAvatarURL(),
          description: chapter.content,
          buttonsRow: row,
          footerText: "Pilih menu dropdown di atas untuk membaca bab panduan lainnya.",
        });

        await i.update(updatedPayload);
      }
    });
  },
};
