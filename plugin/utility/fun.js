"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cmd8ball = require("./8ball");
const cmdCoinflip = require("./coinflip");
const cmdDiceroll = require("./diceroll");
const cmdFortune = require("./fortune");
const cmdQuote = require("./quote");
const cmdMeme = require("./meme");
const cmdShip = require("./ship");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fun")
    .setDescription("🎉 Hiburan kasual, omikuji, meme, dadu, dan permainan teks seru.")
    .addSubcommand((sub) =>
      sub
        .setName("8ball")
        .setDescription("🎱 Tanyakan sesuatu pada bola ajaib.")
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan Yes/No kamu")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("coinflip").setDescription("🪙 Lempar koin (Heads / Tails)."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("diceroll")
        .setDescription("🎲 Lempar dadu (pilih jumlah sisi).")
        .addIntegerOption((opt) =>
          opt
            .setName("sisi")
            .setDescription("Jumlah sisi dadu (contoh: 6, 20)")
            .setRequired(false)
            .setMinValue(2)
            .setMaxValue(100),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("fortune")
        .setDescription("🌸 Ramalan Omikuji harian, berkah hoki & buff RPG."),
    )
    .addSubcommand((sub) =>
      sub.setName("quote").setDescription("📖 Dapatkan kutipan inspirasional acak."),
    )
    .addSubcommand((sub) =>
      sub.setName("meme").setDescription("😂 Ambil meme acak dari internet."),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ship")
        .setDescription("💘 Cek persentase kecocokan cinta dengan seseorang.")
        .addUserOption((opt) =>
          opt
            .setName("user")
            .setDescription("Pilih pasangan yang ingin di-ship")
            .setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "8ball":
        return cmd8ball.execute(interaction, client);
      case "coinflip":
        return cmdCoinflip.execute(interaction, client);
      case "diceroll":
        return cmdDiceroll.execute(interaction, client);
      case "fortune":
        return cmdFortune.execute(interaction, client);
      case "quote":
        return cmdQuote.execute(interaction, client);
      case "meme":
        return cmdMeme.execute(interaction, client);
      case "ship":
        return cmdShip.execute(interaction, client);
      default:
        return interaction.reply({
          content: "Subcommand tidak dikenali.",
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};
