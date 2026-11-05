const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
  AttachmentBuilder,
} = require("discord.js");
const axios = require("axios");
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
const {
  getOrCreateBreaker,
  CircuitBreakerOpenError,
} = require("../../src/utils/circuitBreaker");
const { ApiResponseCache } = require("../../src/utils/apiResponseCache");

const imdbBreaker = getOrCreateBreaker("movie-imdb", {
  failureThreshold: 3,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 2,
});

const omdbBreaker = getOrCreateBreaker("movie-omdb", {
  failureThreshold: 3,
  resetTimeout: 300000,
  halfOpenMaxAttempts: 2,
});

const wikiBreaker = getOrCreateBreaker("movie-wikipedia", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const tvmazeBreaker = getOrCreateBreaker("movie-tvmaze", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const movieCache = new ApiResponseCache({ ttl: 900000, maxSize: 150 });

/**
 * Normalisasi string teks untuk perbandingan relevansi judul
 */
function normalizeText(str) {
  if (!str) return "";
  return String(str)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Menghitung skor relevansi item film terhadap query dan target tahun
 */
function calculateMovieRelevance(item, query, targetYear) {
  const qNorm = normalizeText(query);
  const qTokens = qNorm.split(" ").filter(Boolean);
  const titleNorm = normalizeText(item.l || item.title || "");

  let score = 0;

  // 1. Kesesuaian Judul
  if (titleNorm === qNorm) {
    score += 100;
  } else if (
    titleNorm.startsWith(qNorm + " ") ||
    titleNorm.startsWith(qNorm + ":")
  ) {
    const extraLen = Math.min(25, (titleNorm.length - qNorm.length) * 0.4);
    score += Math.max(50, 75 - extraLen);
  } else {
    const titleTokens = titleNorm.split(" ").filter(Boolean);
    const allTokensPresent =
      qTokens.length > 0 && qTokens.every((tok) => titleTokens.includes(tok));
    if (allTokensPresent) {
      const extraTokens = titleTokens.length - qTokens.length;
      score += Math.max(35, 60 - extraTokens * 3);
    } else if (titleNorm.includes(qNorm)) {
      score += 30;
    }
  }

  // 2. Klasifikasi Tipe Entitas (Prioritaskan Film)
  const qid = (item.qid || "").toLowerCase();
  const qType = (item.q || "").toLowerCase();
  if (qid === "movie" || qType === "feature") {
    score += 50;
  } else if (qid === "tvmovie" || qType.includes("tv movie")) {
    score += 40;
  } else if (qid.includes("tv") || qType.includes("tv")) {
    score += 15;
  } else if (qid === "short" || qType.includes("short")) {
    score += 10;
  } else {
    score += 5;
  }

  // 3. Kesesuaian Tahun Rilis
  const itemYear = Number(item.y || item.year) || null;
  if (targetYear && itemYear) {
    if (itemYear === Number(targetYear)) {
      score += 80;
    } else if (Math.abs(itemYear - Number(targetYear)) === 1) {
      score += 30;
    } else {
      score -= 20;
    }
  } else if (itemYear && itemYear <= new Date().getFullYear() + 1) {
    score += 10;
  }

  // 4. Bonus Peringkat Popularitas IMDb (rank lebih rendah = lebih populer)
  if (item.rank && item.rank > 0) {
    score += Math.max(0, Math.min(20, (500000 - item.rank) / 25000));
  }

  // 5. Ketersediaan Poster Gambar
  if (item.i?.imageUrl || item.posterURL || item.posterUrl) {
    score += 5;
  }

  return score;
}

/**
 * Mengambil ringkasan artikel dari Wikipedia Summary API untuk melengkapi sinopsis
 */
async function fetchWikiSummary(title, year) {
  return wikiBreaker.execute(async () => {
    const cleanTitle = title.trim();
    const attempts = [
      cleanTitle,
      year ? `${cleanTitle} (${year} film)` : null,
      `${cleanTitle} (film)`,
    ].filter(Boolean);

    for (const page of attempts) {
      try {
        const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page.replace(/\s+/g, "_"))}`;
        const res = await axios.get(url, {
          timeout: 4000,
          headers: {
            Accept: "application/json",
            "User-Agent": "NauraHoshinoBot/2.5 (Discord Utility Bot)",
          },
        });
        const data = res.data;
        if (data && data.type !== "disambiguation" && data.extract) {
          let director = "IMDb / Wikipedia";
          if (
            data.description &&
            /by\s+([A-Z][a-zA-Z\s]+)/i.test(data.description)
          ) {
            const match = data.description.match(/by\s+([A-Z][a-zA-Z\s]+)/i);
            if (match) director = match[1].trim();
          }
          return {
            extract: data.extract,
            description: data.description || null,
            director,
          };
        }
      } catch {
        // Lanjutkan ke kandidat nama berikutnya
      }
    }
    return null;
  });
}

/**
 * Fetch film dari IMDb Suggestions API (Publik & Gratis) dengan Relevance Scoring
 */
async function fetchFromIMDb(query, year) {
  return imdbBreaker.execute(async () => {
    const cleanQuery = query.toLowerCase().trim();
    const url = `https://v3.sg.media-imdb.com/suggestion/x/${encodeURIComponent(cleanQuery)}.json`;

    const res = await axios.get(url, {
      timeout: 5000,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) NauraHoshino/2.5",
      },
    });

    const data = res.data;
    if (!data || !Array.isArray(data.d) || data.d.length === 0) {
      return null;
    }

    // Filter entitas judul film/media saja (id diawali 'tt', abaikan aktor 'nm')
    const titlesOnly = data.d.filter(
      (item) => item.id && item.id.startsWith("tt"),
    );
    if (titlesOnly.length === 0) return null;

    // Hitung skor relevansi dan urutkan
    const scored = titlesOnly.map((item) => ({
      item,
      score: calculateMovieRelevance(item, query, year),
    }));

    scored.sort((a, b) => b.score - a.score);

    const topScored = scored.slice(0, 5).map((s) => s.item);

    // Ekstraksi data lengkap
    const enrichedList = await Promise.all(
      topScored.map(async (d) => {
        const titleLabel = d.l || "Judul Film";
        const releaseYear = d.y ? String(d.y) : "N/A";
        const imdbId = d.id;
        const imdbUrl = imdbId ? `https://www.imdb.com/title/${imdbId}` : null;

        let posterUrl = null;
        if (d.i?.imageUrl) {
          // Format resolusi tinggi dengan menghapus parameter kompresi gambar
          posterUrl = d.i.imageUrl.replace(/\._V1_.*\.jpg$/i, "._V1_.jpg");
        }

        const actors = d.s || "N/A";

        // Coba peroleh sinopsis dan sutradara dari Wikipedia
        let synopsis =
          "Informasi detail dan ulasan lengkap tersedia di halaman resmi IMDb.";
        let genreDesc =
          d.q === "feature" || d.qid === "movie"
            ? "Film Bioskop"
            : d.q || "Film";
        let director = "IMDb Registry";

        try {
          const wikiData = await fetchWikiSummary(titleLabel, d.y);
          if (wikiData) {
            if (wikiData.extract) synopsis = wikiData.extract;
            if (wikiData.description) genreDesc = wikiData.description;
            if (wikiData.director) director = wikiData.director;
          }
        } catch {
          // Fallback ke deskripsi default jika wiki tidak tersedia
        }

        if (
          synopsis ===
            "Informasi detail dan ulasan lengkap tersedia di halaman resmi IMDb." &&
          actors !== "N/A"
        ) {
          synopsis = `Film yang dibintangi oleh ${actors}. Metadata, jadwal tayang, dan ulasan lengkap dapat dilihat langsung di IMDb.`;
        }

        const rankText = d.rank ? `#${d.rank.toLocaleString("id-ID")}` : "N/A";
        const rating = d.rank
          ? `${ui.getEmoji("star") || "⭐"} **IMDb** ✦ Popularitas ${rankText}`
          : `${ui.getEmoji("star") || "⭐"} **IMDb Registry**`;

        return {
          title: `${titleLabel} (${releaseYear})`,
          rawTitle: titleLabel,
          year: releaseYear,
          synopsis,
          overview: synopsis,
          genres: genreDesc,
          director,
          actors,
          actorsList:
            actors !== "N/A" ? actors.split(",").map((s) => s.trim()) : [],
          rating,
          rawRating: d.rank ? String(d.rank) : null,
          runtime: "Durasi Standar",
          awards: "IMDb Official Selection",
          url: imdbUrl,
          posterURL: posterUrl,
          posterUrl: posterUrl,
          type:
            d.qid === "movie" || d.q === "feature" ? "movie" : d.qid || "movie",
          sourceName: "IMDb Registry",
        };
      }),
    );

    return enrichedList.length > 0 ? enrichedList : null;
  });
}

/**
 * Fetch film dari OMDB API sebagai fallback opsional jika OMDB_API_KEY disetel
 */
async function fetchFromOMDB(query, year) {
  const apiKey =
    env.OMDB_API_KEY ||
    (typeof process !== "undefined" && process.env?.OMDB_API_KEY);
  if (!apiKey || apiKey === "YOUR_OMDB_API_KEY_HERE") return null;

  return omdbBreaker.execute(async () => {
    let searchUrl = `https://www.omdbapi.com/?apikey=${apiKey}&s=${encodeURIComponent(query)}`;
    if (year) searchUrl += `&y=${year}`;

    const searchRes = await axios.get(searchUrl, { timeout: 5000 });
    if (
      !searchRes.data ||
      searchRes.data.Response === "False" ||
      !searchRes.data.Search
    ) {
      return null;
    }

    // Urutkan item berdasarkan kesesuaian judul
    const rawItems = searchRes.data.Search;
    const scoredItems = rawItems.map((item) => ({
      item,
      score: calculateMovieRelevance(
        { l: item.Title, y: item.Year, qid: item.Type, posterURL: item.Poster },
        query,
        year,
      ),
    }));
    scoredItems.sort((a, b) => b.score - a.score);

    const items = scoredItems.slice(0, 5).map((s) => s.item);
    const detailPromises = items.map(async (item) => {
      try {
        const detailRes = await axios.get(
          `https://www.omdbapi.com/?apikey=${apiKey}&i=${item.imdbID}&plot=full`,
          { timeout: 5000 },
        );
        const m = detailRes.data;
        const poster = m.Poster && m.Poster !== "N/A" ? m.Poster : null;
        const releaseYear = m.Year || item.Year || "N/A";
        const cleanSynopsis =
          m.Plot && m.Plot !== "N/A" ? m.Plot : "Tidak ada sinopsis.";

        return {
          title: `${m.Title} (${releaseYear})`,
          rawTitle: m.Title,
          year: releaseYear,
          synopsis: cleanSynopsis,
          overview: cleanSynopsis,
          genres: m.Genre || "N/A",
          director: m.Director || "N/A",
          actors: m.Actors || "N/A",
          actorsList:
            m.Actors && m.Actors !== "N/A"
              ? m.Actors.split(",").map((s) => s.trim())
              : [],
          rating:
            m.imdbRating && m.imdbRating !== "N/A"
              ? `${ui.getEmoji("star") || "⭐"} **${m.imdbRating}** / 10`
              : "N/A",
          rawRating:
            m.imdbRating && m.imdbRating !== "N/A" ? m.imdbRating : null,
          runtime: m.Runtime || "N/A",
          awards: m.Awards && m.Awards !== "N/A" ? m.Awards : "Tidak ada",
          url: m.imdbID ? `https://www.imdb.com/title/${m.imdbID}` : null,
          posterURL: poster,
          posterUrl: poster,
          type: "movie",
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
 * Fetch film dari Wikipedia Summary API dengan Circuit Breaker
 */
async function fetchFromWikipedia(query) {
  return wikiBreaker.execute(async () => {
    const res = await axios.get(
      `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(query.replace(/\s+/g, "_"))}`,
      { timeout: 5000 },
    );

    const data = res.data;
    if (!data || data.type === "disambiguation" || !data.extract) return null;

    const poster = data.thumbnail?.source || null;
    return [
      {
        title: data.title,
        rawTitle: data.title,
        year: "N/A",
        synopsis: data.extract,
        overview: data.extract,
        genres: data.description || "General Media",
        director: "Wikipedia Archives",
        actors: "Encyclopedia Entry",
        actorsList: [],
        rating: "N/A",
        rawRating: null,
        runtime: "N/A",
        awards: "Information Archive",
        url: data.content_urls?.desktop?.page || null,
        posterURL: poster,
        posterUrl: poster,
        type: "movie",
        sourceName: "Wikipedia Media Archive",
      },
    ];
  });
}

/**
 * Fetch serial dari TVMaze Public API sebagai cadangan serial TV
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
        ? String(new Date(show.premiered).getFullYear())
        : "N/A";
      const ratingScore = show.rating?.average
        ? `${ui.getEmoji("star") || "⭐"} **${show.rating.average}** / 10`
        : "N/A";
      const poster = show.image?.medium || show.image?.original || null;

      return {
        title: `${show.name} (${year})`,
        rawTitle: show.name,
        year,
        synopsis: cleanSummary,
        overview: cleanSummary,
        genres:
          show.genres && show.genres.length > 0
            ? show.genres.join(", ")
            : "N/A",
        director: show.network?.name || show.webChannel?.name || "TV Network",
        actors: show.type || "Television Show",
        actorsList: [show.type || "Television Show"],
        rating: ratingScore,
        rawRating: show.rating?.average ? String(show.rating.average) : null,
        runtime: show.runtime
          ? `${show.runtime} Menit`
          : show.averageRuntime
            ? `${show.averageRuntime} Menit`
            : "N/A",
        awards: show.status || "N/A",
        url: show.url || null,
        posterURL: poster,
        posterUrl: poster,
        type: "tvSeries",
        sourceName: "TVMaze Public Registry",
      };
    });
  });
}

/**
 * Pencarian film waterfall dengan IMDb Suggestions sebagai mesin utama,
 * diikuti fallback bertingkat (OMDb -> Wikipedia -> TVMaze).
 */
async function searchMovieWaterfall(query, year) {
  const cacheKey = `${query.toLowerCase().trim()}:${year || "any"}`;

  const cached = movieCache.get("movie", { key: cacheKey });
  if (cached) {
    logger.debug(`[Movie] Cache hit for "${query}" (${year || "any year"})`);
    return cached;
  }

  const providers = [
    { fn: () => fetchFromIMDb(query, year), name: "IMDb Suggestions" },
    { fn: () => fetchFromOMDB(query, year), name: "OMDB Fallback" },
    { fn: () => fetchFromWikipedia(query), name: "Wikipedia Fallback" },
    { fn: () => fetchFromTVMaze(query), name: "TVMaze Fallback" },
  ];

  for (const provider of providers) {
    try {
      const result = await provider.fn();
      if (result && result.length > 0) {
        logger.info(
          `[Movie] Provider ${provider.name} berhasil menghasilkan data.`,
        );
        movieCache.set("movie", { key: cacheKey }, result);
        return result;
      }
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        logger.warn(`[Movie] ${provider.name} circuit OPEN`);
      } else {
        logger.debug(`[Movie] ${provider.name} failed: ${err.message}`);
      }
    }
  }

  logger.debug(
    `[Movie] Seluruh provider pencarian film tidak menemukan hasil untuk "${query}"`,
  );
  return null;
}

/**
 * Kontrak Antarmuka Publik: searchMovie(query, year)
 * Mengembalikan objek metadata film tunggal berrelevansi tertinggi
 */
async function searchMovie(query, year = null) {
  const list = await searchMovieWaterfall(query, year);
  if (!list || list.length === 0) return null;
  const best = list[0];
  return {
    title: best.rawTitle || best.title,
    year: best.year,
    posterUrl: best.posterUrl || best.posterURL,
    posterURL: best.posterURL || best.posterUrl,
    type: best.type || "movie",
    overview: best.overview || best.synopsis,
    synopsis: best.synopsis || best.overview,
    actors:
      Array.isArray(best.actorsList) && best.actorsList.length > 0
        ? best.actorsList
        : best.actors && best.actors !== "N/A"
          ? best.actors.split(",").map((s) => s.trim())
          : [],
    rating: best.rawRating || best.rating || "N/A",
    url: best.url,
    director: best.director,
    genres: best.genres,
    sourceName: best.sourceName,
  };
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("movie")
    .setDescription(
      "Cari informasi film atau serial TV dari database IMDb, Wikipedia, & OMDb.",
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
          description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, Naura sudah mencari di database IMDb dan Wikipedia tapi tidak menemukan **"${query}"**${year ? ` (${year})` : ""}.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba periksa ejaan judulnya atau gunakan tahun yang berbeda, ya!*`,
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
            rawRating: item.rawRating,
            runtime: item.runtime,
            genres: item.genres,
            director: item.director,
            actors: item.actors,
            synopsis: item.synopsis,
            sourceName: item.sourceName,
            botAvatarURL: interaction.client.user.displayAvatarURL({
              size: 64,
              extension: "png",
            }),
          });
          if (buffer) {
            cardCache.set(idx, buffer);
            return buffer;
          }
        } catch (err) {
          logger.warn(
            "[Movie] Canvas showcase error: " + (err?.message || err),
          );
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
          const disabledPayload = disableContainerV2(
            buildPayload(currentIndex, true, null),
          );
          interaction.editReply(disabledPayload).catch(() => {});
        }
      });
    } catch (error) {
      logger.error("[Movie Error]", error);
      const isCircuitOpen = error instanceof CircuitBreakerOpenError;
      const errPayload = buildErrorContainerV2({
        interaction,
        title: isCircuitOpen
          ? "Server Database Sedang Istirahat"
          : "Gagal Mengambil Data Film",
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

  calculateMovieRelevance,
  fetchFromIMDb,
  searchMovieWaterfall,
  searchMovie,
};
