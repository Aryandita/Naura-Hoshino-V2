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
const ui = require("../../src/config/ui");
const env = require("../../src/config/env");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
  disableContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const axios = require("axios");
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");
const { ApiResponseCache } = require("../../src/utils/apiResponseCache");

const omdbBreaker = getOrCreateBreaker("movie-omdb", {
  failureThreshold: 3,
  resetTimeout: 300000,
  halfOpenMaxAttempts: 2,
});

const tvmazeBreaker = getOrCreateBreaker("movie-tvmaze", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const wikiBreaker = getOrCreateBreaker("movie-wikipedia", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const movieCache = new ApiResponseCache({ ttl: 900000, maxSize: 150 });

/**
 * Fetch film dari OMDB API (IMDb) dengan Circuit Breaker
 */
async function fetchFromOMDB(query, year) {
  const apiKey = env.OMDB_API_KEY;
  if (!apiKey || apiKey === "YOUR_OMDB_API_KEY_HERE") return null;

  return omdbBreaker.execute(async () => {
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
  });
}

/**
 * Fetch film/serial dari TVMaze Public API dengan Circuit Breaker
 */
async function fetchFromTVMaze(query) {
  return tvmazeBreaker.execute(async () => {
    const res = await axios.get(
      `https://api.tvmaze.com/search/shows?q=${encodeURIComponent(query)}`,
      { timeout: 5000 },
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
  });
}

/**
 * Fetch film dari Wikipedia Summary API dengan Circuit Breaker
 */
async function fetchFromWikipedia(query) {
  return wikiBreaker.execute(async () => {
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
  });
}

/**
 * Parallel race pencarian film dengan Cache & Circuit Breaker
 * Mencoba semua provider secara paralel, ambil yang tercepat berhasil.
 */
async function searchMovieWaterfall(query, year) {
  const cacheKey = `${query.toLowerCase().trim()}:${year || "any"}`;
  
  const cached = movieCache.get("movie", { key: cacheKey });
  if (cached) {
    logger.debug(`[Movie] Cache hit for "${query}" (${year || "any year"})`);
    return cached;
  }

  const wrapFetch = async (fn, name, ...args) => {
    try {
      const result = await fn(...args);
      if (result && result.length > 0) {
        logger.info(`[Movie] ${name} berhasil (parallel race)`);
        return result;
      }
      throw new Error(`${name}: no results`);
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        logger.warn(`[Movie] ${name} circuit OPEN`);
      } else {
        logger.debug(`[Movie] ${name} failed: ${err.message}`);
      }
      throw err;
    }
  };

  try {
    const result = await Promise.any([
      wrapFetch(fetchFromOMDB, "OMDB", query, year),
      wrapFetch(fetchFromTVMaze, "TVMaze", query),
      wrapFetch(fetchFromWikipedia, "Wikipedia", query),
    ]);
    
    if (result && result.length > 0) {
      movieCache.set("movie", { key: cacheKey }, result);
      return result;
    }
  } catch {
    logger.debug(`[Movie] All parallel fetches failed, returning null`);
  }

  return null;
}

module.exports = {
  isSubcommand: true,
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
    const query = interaction.options.getString("judul");
    const year = interaction.options.getInteger("tahun");

    const loadingPayload = buildLoadingContainerV2({
      interaction,
      authorName: "Naura Movie Intelligence",
      title: "Mencari Film...",
      description: `${ui.getEmoji("loading") || "⏳"} ${ui.getEmoji("naura_thinking") || "🤔"} *Naura sedang mencari "${query}"${year ? ` (${year})` : ""} di database film global...*`,
      expression: "thinking",
      withBanner: true,
      footerText: ui.getFooter("utility"),
    });
    await interaction.deferReply();
    await interaction.editReply(loadingPayload);

    try {
      const results = await searchMovieWaterfall(query, year);

      if (!results || results.length === 0) {
        const emptyPayload = buildErrorContainerV2({
          interaction,
          title: "Film Tidak Ditemukan",
          description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, Naura sudah mencari di IMDb, TVMaze, dan Wikipedia tapi tidak menemukan **"${query}"**${year ? ` (${year})` : ""}.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba periksa ejaan judulnya atau gunakan tahun yang berbeda, ya!*`,
          expression: "akward",
          withBanner: true,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(emptyPayload);
      }

      const cardCache = new Map();

      async function renderCardForIndex(idx) {
        if (cardCache.has(idx)) return cardCache.get(idx);
        const item = results[idx];
        if (!item) return null;
        try {
          const buffer = await canvasWorkerPool.execute("renderMovieCard", {
            title: item.title,
            posterURL: item.posterURL,
            rating: item.rating,
            runtime: item.runtime,
            genres: item.genres,
            director: item.director,
            actors: item.actors,
            synopsis: item.synopsis,
            sourceName: item.sourceName,
          });
          if (buffer) {
            cardCache.set(idx, buffer);
            return buffer;
          }
        } catch (err) {
          logger.warn("[Movie] Canvas showcase error: " + (err?.message || err));
        }
        return null;
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

      const buildPayload = (index, disabledButtons = false, buffer = null) => {
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

        const attachment = buffer
          ? new AttachmentBuilder(buffer, { name: "movie-spotlight.png" })
          : null;

        return buildContainerV2({
          interaction,
          accentColorHex: "#F5C518",
          authorName: `${movieData.sourceName} (Hasil ${index + 1}/${results.length})`,
          title: movieData.title,
          iconURL: movieData.posterURL || interaction.user.displayAvatarURL(),
          description: `${cleanSynopsis}\n\n> ${ui.getEmoji("naura_happy") || "🎬"} *Naura menemukan ${results.length} hasil untuk pencarianmu!*`,
          fields,
          mediaAttachmentNames: attachment ? ["movie-spotlight.png"] : [],
          files: attachment ? [attachment] : [],
          buttonsRow: buildButtonsRow(index, movieData, disabledButtons),
          footerText: ui.getFooter("utility"),
        });
      };

      const initialBuffer = await renderCardForIndex(currentIndex);
      const initialPayload = buildPayload(currentIndex, false, initialBuffer);
      const message = await interaction.editReply(initialPayload);

      const collector = message.createMessageComponentCollector({
        componentType: ComponentType.Button,
        time: 120000,
      });

      collector.on("collect", async (i) => {
        if (i.user.id !== interaction.user.id) {
          const errPayload = buildErrorContainerV2({
            interaction: i,
            title: "Akses Ditolak",
            description:
              "Gunakan perintah `/movie` untuk mencari film Anda sendiri!",
            footerText: ui.getFooter("utility"),
          });
          return i.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        if (i.customId === "movie_prev") {
          currentIndex = Math.max(0, currentIndex - 1);
        } else if (i.customId === "movie_next") {
          currentIndex = Math.min(results.length - 1, currentIndex + 1);
        }

        const currentBuf = await renderCardForIndex(currentIndex);
        const nextPayload = buildPayload(currentIndex, false, currentBuf);
        await i.update(nextPayload);
      });

      collector.on("end", (_collected, reason) => {
        if (reason === "time") {
          const disabledPayload = disableContainerV2(buildPayload(currentIndex, true, null));
          interaction.editReply(disabledPayload).catch(() => {});
        }
      });
    } catch (error) {
      logger.error("[Movie Error]", error);
      const isCircuitOpen = error instanceof CircuitBreakerOpenError;
      const errPayload = buildErrorContainerV2({
        interaction,
        title: isCircuitOpen ? "Server Database Sedang Istirahat" : "Gagal Mengambil Data Film",
        description: isCircuitOpen
          ? `${ui.getEmoji("naura_sleepy") || "😴"} Server database film sedang terlalu sibuk dan butuh istirahat sebentar. Coba lagi dalam 1-2 menit ya, Naura tungguin!`
          : `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, terjadi kesalahan saat mencari informasi film. Jaringan mungkin sedang tidak stabil.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi beberapa saat lagi, Naura yakin akan berhasil!*`,
        expression: isCircuitOpen ? "sleepy" : "cry",
        withBanner: true,
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
