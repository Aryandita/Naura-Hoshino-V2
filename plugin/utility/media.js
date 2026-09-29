"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cmdAnime = require("./anime");
const cmdMovie = require("./movie");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("media")
    .setDescription("🎬 Pusat informasi media hiburan: pencarian anime dan katalog film/series.")
    .addSubcommand((sub) =>
      sub
        .setName("anime")
        .setDescription("🔍 Cari informasi anime (MyAnimeList / Jikan).")
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Judul anime yang dicari")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("movie")
        .setDescription("🎬 Cari informasi film atau serial (OMDB/IMDb).")
        .addStringOption((opt) =>
          opt
            .setName("judul")
            .setDescription("Judul film atau series yang dicari")
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("tahun")
            .setDescription("Tahun rilis film (opsional)")
            .setRequired(false)
            .setMinValue(1900)
            .setMaxValue(2100),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "anime":
        return cmdAnime.execute(interaction, client);
      case "movie":
        return cmdMovie.execute(interaction, client);
      default:
        return interaction.reply({
          content: "Subcommand tidak dikenali.",
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};
