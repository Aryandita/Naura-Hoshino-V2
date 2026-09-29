"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cmdCalc = require("./calculator");
const cmdQr = require("./qr");
const cmdPassword = require("./password");
const cmdColor = require("./color");
const cmdShorten = require("./shorten");
const cmdDownloader = require("./downloader");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("tool")
    .setDescription("🛠️ Beragam perkakas praktis: kalkulator, QR, password, warna, URL shortener & unduhan media.")
    .addSubcommand((sub) =>
      sub.setName("calculator").setDescription("🧮 Buka kalkulator interaktif."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("qr")
        .setDescription("📱 Buat QR Code dari teks atau URL.")
        .addStringOption((opt) =>
          opt
            .setName("teks")
            .setDescription("Teks atau URL yang ingin diubah menjadi QR Code")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("password")
        .setDescription("🔑 Generate password acak yang kuat (Dikirim via DM).")
        .addIntegerOption((opt) =>
          opt
            .setName("panjang")
            .setDescription("Panjang password (8-32 karakter, default 16)")
            .setRequired(false)
            .setMinValue(8)
            .setMaxValue(32),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("color")
        .setDescription("🎨 Lihat informasi dan visual warna HEX.")
        .addStringOption((opt) =>
          opt
            .setName("hex")
            .setDescription("Kode warna HEX (contoh: #ff0000 atau ff0000)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("shorten")
        .setDescription("🔗 Pendekkan URL yang panjang (Powered by is.gd).")
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("URL panjang yang ingin dipendekkan (harus diawali http/https)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("download")
        .setDescription("📥 Unduh video & foto kualitas terbaik (YouTube, IG, TikTok, X, dll).")
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("Tautan video/foto yang ingin diunduh")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("format")
            .setDescription("Format unduhan (otomatis, mp3, mp4)")
            .setRequired(false)
            .addChoices(
              { name: "Otomatis (terbaik)", value: "auto" },
              { name: "MP4 Video", value: "mp4" },
              { name: "MP3 Audio", value: "mp3" },
            ),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "calculator":
        return cmdCalc.execute(interaction, client);
      case "qr":
        return cmdQr.execute(interaction, client);
      case "password":
        return cmdPassword.execute(interaction, client);
      case "color":
        return cmdColor.execute(interaction, client);
      case "shorten":
        return cmdShorten.execute(interaction, client);
      case "download":
        return cmdDownloader.execute(interaction, client);
      default:
        return interaction.reply({
          content: "Subcommand tidak dikenali.",
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};
