const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const env = require("../../src/config/env");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const axios = require("axios");

/**
 * Fetch film dari OMDB API (IMDb)
 */
async function fetchFromOMDB(query, year) {
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey || apiKey === "YOUR_OMDB_API_KEY_HERE") return null;

  let searchUrl = `http://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`;
  if (year) searchUrl += `&y=${year}`;

  const searchRes = await axios.get(searchUrl, { timeout: 5000 });
  if (
    !searchRes.data ||
    searchRes.data.Response === "False" ||
    !searchRes.data.Search
  ) {
    return null;
  }

  const items = searchRes.data.Search.slice(0, 5);
  const detailPromises = items.map(async (item) => {
    try {
      const detailRes = await axios.get(
        `http://www.omdbapi.com/?apikey=${apiKey}&i=${item.imdbID}&plot=full`,
        { timeout: 5000 },
      );
      const m = detailRes.data;
      return {
        title: `${m.Title} (${m.Year || item.Year})`,
        synopsis: m.Plot && m.Plot !== "N/A" ? m.Plot : "Tidak ada sinopsis.",
        genres: m.Genre || "N/A",
        director: m.Director || "N/A",
        actors: m.Actors || "N/A",
        rating:
          m.imdbRating && m.imdbRating !== "N/A"
            ? `${ui.getEmoji("star") || "⭐"} **${m.imdbRating}** / 10`
            : "N/A",
        runtime: m.Runtime || "N/A",
        awards: m.Awards && m.Awards !== "N/A" ? m.Awards : "Tidak ada",
        url: m.imdbID ? `https://www.imdb.com/title/${m.imdbID}` : null,
        posterURL: m.Poster && m.Poster !== "N/A" ? m.Poster : null,
        sourceName: "IMDb / OMDB",
      };
    } catch {
      return null;
    }
  });

  const resolved = (await Promise.all(detailPromises)).filter(Boolean);
  return resolved.length > 0 ? resolved : null;
}

/**
 * Fetch film/serial dari TVMaze Public API (Gratis, Tanpa API Key)
 */
async function fetchFromTVMaze(query) {
  const res = await axios.get(
    `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
    {
      timeout: 5000,
    },
  );

  if (!res.data || res.data.length === 0) return null;

  return res.data.slice(0, 5).map((entry) => {
    const show = entry.show;
    const cleanSummary = (show.summary || "Tidak ada sinopsis.").replace(
      /<[^>]*>?/gm,
      "",
    );
    const year = show.premiered
      ? new Date(show.premiered).getFullYear()
      : "N/A";
    const ratingScore = show.rating?.average
      ? `${ui.getEmoji("star") || "⭐"} **${show.rating.average}** / 10`
      : "N/A";

    return {
      title: `${show.name} (${year})`,
      synopsis: cleanSummary,
      genres:
        show.genres && show.genres.length > 0 ? show.genres.join(", ") : "N/A",
      director: show.network?.name || show.webChannel?.name || "TV Network",
      actors: show.type || "Television Show",
      rating: ratingScore,
      runtime: show.runtime
        ? `${show.runtime} Menit`
        : show.averageRuntime
          ? `${show.averageRuntime} Menit`
          : "N/A",
      awards: show.status || "N/A",
      url: show.url || null,
      posterURL: show.image?.medium || show.image?.original || null,
      sourceName: "TVMaze Public Registry",
    };
  });
}

/**
 * Fetch film dari Wikipedia Summary API (Fallback Ekstrem)
 */
async function fetchFromWikipedia(query) {
  const res = await axios.get(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query)}`,
    { timeout: 5000 },
  );

  const data = res.data;
  if (!data || data.type === "disambiguation" || !data.extract) return null;

  return [
    {
      title: data.title,
      synopsis: data.extract,
      genres: data.description || "General Media",
      director: "Wikipedia Archives",
      actors: "Encyclopedia Entry",
      rating: "N/A",
      runtime: "N/A",
      awards: "Information Archive",
      url: data.content_urls?.desktop?.page || null,
      posterURL: data.thumbnail?.source || null,
      sourceName: "Wikipedia Media Archive",
    },
  ];
}

/**
 * Cascade waterfall pencarian film
 */
async function searchMovieWaterfall(query, year) {
  try {
    const omdbResults = await fetchFromOMDB(query, year);
    if (omdbResults && omdbResults.length > 0) return omdbResults;
  } catch (err) {
    logger.warn(
      `[Movie Search] OMDB error (${err.message}), beralih ke TVMaze...`,
    );
  }

  try {
    const tvmazeResults = await fetchFromTVMaze(query);
    if (tvmazeResults && tvmazeResults.length > 0) return tvmazeResults;
  } catch (err) {
    logger.warn(
      `[Movie Search] TVMaze error (${err.message}), beralih ke Wikipedia...`,
    );
  }

  try {
    const wikiResults = await fetchFromWikipedia(query);
    if (wikiResults && wikiResults.length > 0) return wikiResults;
  } catch (err) {
    logger.warn(`[Movie Search] Wikipedia error (${err.message}).`);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("movie")
    .setDescription(
      "🎬 Cari informasi film atau serial TV dari database IMDb, TVMaze, & Wikipedia.",
    )
    .addStringOption((opt) =>
      opt
        .setName("judul")
        .setDescription("Judul film atau serial TV")
        .setRequired(true),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("tahun")
        .setDescription("Tahun rilis (opsional, untuk hasil lebih akurat)")
        .setRequired(false),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const query = interaction.options.getString("judul");
    const year = interaction.options.getInteger("tahun");

    try {
      const results = await searchMovieWaterfall(query, year);

      if (!results || results.length === 0) {
        const emptyPayload = buildErrorContainerV2({
          title: "Film Tidak Ditemukan",
          description: `${ui.getEmoji("cross") || "❌"} Informasi film atau serial **"${query}"** tidak ditemukan di IMDb, TVMaze, maupun Wikipedia.`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(emptyPayload);
      }

      let currentIndex = 0;

      const buildButtonsRow = (index, movieData, disabledAll = false) => {
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("movie_prev")
            .setLabel("« Sebelumnya")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index === 0),
          new ButtonBuilder()
            .setCustomId("movie_page_indicator")
            .setLabel(`${index + 1} / ${results.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("movie_next")
            .setLabel("Lanjut »")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index === results.length - 1),
        );

        if (movieData.url) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel(`Buka di ${movieData.sourceName}`)
              .setStyle(ButtonStyle.Link)
              .setURL(movieData.url),
          );
        }

        return row;
      };

      const buildPayload = (index, disabledButtons = false) => {
        const movieData = results[index];
        const cleanSynopsis =
          movieData.synopsis.length > 800
            ? `${movieData.synopsis.substring(0, 797)}...`
            : movieData.synopsis;

        const fields = [
          {
            name: `${ui.getEmoji("movie_genres") || "🎭"} Genre`,
            value: movieData.genres,
          },
          {
            name: `${ui.getEmoji("movie_director") || "🎬"} Sutradara / Studio`,
            value: movieData.director,
          },
          {
            name: `${ui.getEmoji("movie_actors") || "👥"} Pemeran / Tipe`,
            value: movieData.actors,
          },
          {
            name: `${ui.getEmoji("movie_rating") || "⭐"} Skor Rating`,
            value: movieData.rating,
          },
          {
            name: `${ui.getEmoji("movie_runtime") || "⏱️"} Durasi`,
            value: movieData.runtime,
          },
          {
            name: `${ui.getEmoji("movie_awards") || "🏆"} Status / Penghargaan`,
            value: movieData.awards,
          },
        ];

        return buildContainerV2({
          accentColorHex: "#F5C518",
          authorName: `${movieData.sourceName} (Hasil ${index + 1}/${results.length})`,
          title: movieData.title,
          iconURL: movieData.posterURL || interaction.user.displayAvatarURL(),
          description: cleanSynopsis,
          fields,
          buttonsRow: buildButtonsRow(index, movieData, disabledButtons),
          footerText: ui.getFooter("utility"),
        });
      };

      const message = await interaction.editReply(buildPayload(currentIndex));

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          return i.reply({
            content: `${ui.getEmoji("cross")} Gunakan perintah \`/movie\` untuk mencari film Anda sendiri!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (i.customId === "movie_prev") {
          currentIndex = Math.max(0, currentIndex - 1);
        } else if (i.customId === "movie_next") {
          currentIndex = Math.min(results.length - 1, currentIndex + 1);
        }

        await i.update(buildPayload(currentIndex));
      });

      collector.on("end", () => {
        interaction.editReply(buildPayload(currentIndex, true)).catch(() => {});
      });
    } catch (error) {
      logger.error("[Movie Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Mengambil Data Film",
        description: `${ui.getEmoji("cross") || "❌"} Terjadi kesalahan saat mencari informasi film. Coba lagi nanti.`,
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
