"use strict";

const { SlashCommandBuilder, ButtonStyle } = require("discord.js");
const { buildInteractiveHubPayload } = require("../../src/utils/hubMenuHelper");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("🎉 Buka Hub Hiburan interaktif Naura: omikuji, bola ajaib, dadu, meme dan kutipan"),

  async execute(interaction) {
    const payload = buildInteractiveHubPayload({
      title: "🎉 Naura Fun and Casual Hub",
      authorName: "Naura Entertainment Hub",
      description: [
        "Hai hai! Selamat datang di **Pusat Hiburan Naura**! ✨",
        "Lagi bosan atau butuh hiburan santai? Coba ramal harimu dengan Omikuji, tanyakan sesuatu pada bola ajaib, atau lempar dadu hoki!",
        "",
        "💡 *Pilih salah satu tombol cepat di bawah atau buka menu dropdown untuk melihat semua permainan seru.*",
      ].join("\n"),
      accentColorHex: "#F59E0B",
      quickButtons: [
        { id: "fortune", label: "Omikuji Hoki", emoji: "🌸", style: ButtonStyle.Success },
        { id: "8ball", label: "Bola Ajaib", emoji: "🎱", style: ButtonStyle.Primary },
        { id: "dice", label: "Lempar Dadu", emoji: "🎲", style: ButtonStyle.Secondary },
      ],
      selectOptions: [
        { value: "fortune", label: "Ramalan Omikuji", emoji: "🌸", description: "Cek keberuntungan harian dan buff berkah RPG" },
        { value: "8ball", label: "Magic 8-Ball", emoji: "🎱", description: "Tanyakan apa saja pada bola ajaib Naura" },
        { value: "dice", label: "Lempar Dadu", emoji: "🎲", description: "Lempar dadu keberuntungan 6 sisi" },
        { value: "coin", label: "Lempar Koin", emoji: "🪙", description: "Tentukan pilihan dengan lemparan koin (Heads / Tails)" },
        { value: "meme", label: "Meme Acak", emoji: "😂", description: "Ambil meme kocak dari internet untuk menghibur harimu" },
        { value: "quote", label: "Kutipan Bijak", emoji: "📖", description: "Kata mutiara dan inspirasi penuh makna" },
        { value: "ship", label: "Kalkulator Cinta", emoji: "💘", description: "Ukur persentase kecocokanmu dengan seseorang" },
      ],
      category: "fun",
      userId: interaction.user.id,
      lang: interaction.localeLang,
    });

    return interaction.reply(payload);
  },
};
