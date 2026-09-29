"use strict";

const { SlashCommandBuilder, ButtonStyle } = require("discord.js");
const { buildInteractiveHubPayload } = require("../../src/utils/hubMenuHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tool")
    .setDescription("🛠️ Buka Kotak Perkakas Praktis Naura: kalkulator, QR, password, warna dan pemendek URL"),

  async execute(interaction) {
    const payload = buildInteractiveHubPayload({
      title: "🛠️ Naura Utility and Tools Suite",
      authorName: "Naura Perkakas Harian",
      description: [
        "Selamat datang di **Kotak Perkakas Naura**! 🔧",
        "Gunakan berbagai alat bantu praktis untuk kebutuhan harianmu di Discord, mulai dari berhitung cepat, membuat QR code, sampai memendekkan tautan.",
        "",
        "💡 *Klik tombol pintas atau pilih utilitas dari menu dropdown di bawah.*",
      ].join("\n"),
      accentColorHex: "#00CED1",
      quickButtons: [
        { id: "calc", label: "Kalkulator", emoji: "🧮", style: ButtonStyle.Primary },
        { id: "qr", label: "Buat QR", emoji: "📱", style: ButtonStyle.Success },
        { id: "password", label: "Acak Password", emoji: "🔐", style: ButtonStyle.Secondary },
      ],
      selectOptions: [
        { value: "calc", label: "Kalkulator Interaktif", emoji: "🧮", description: "Buka kalkulator tombol Discord untuk berhitung cepat" },
        { value: "qr", label: "Generator Kode QR", emoji: "📱", description: "Ubah teks atau tautan web menjadi gambar kode QR" },
        { value: "password", label: "Generator Password", emoji: "🔐", description: "Hasilkan kombinasi kata sandi acak yang kuat & aman" },
        { value: "color", label: "Inspektur Warna Hex", emoji: "🎨", description: "Lihat visual preview dan info kode warna HEX" },
        { value: "shorten", label: "Pemendek Tautan URL", emoji: "🔗", description: "Ringkas tautan web yang panjang menjadi URL pendek" },
        { value: "download", label: "Pengunduh Media", emoji: "📥", description: "Unduh konten video dan foto dari platform sosial" },
      ],
      category: "tool",
      userId: interaction.user.id,
      lang: interaction.localeLang,
    });

    return interaction.reply(payload);
  },
};
