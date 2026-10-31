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
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const {
  buildContainerV2,
  buildErrorContainerV2,
  buildLoadingContainerV2,
  disableContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const { getOrCreateBreaker, CircuitBreakerOpenError } = require("../../src/utils/circuitBreaker");
const { ApiResponseCache } = require("../../src/utils/apiResponseCache");

const jikanBreaker = getOrCreateBreaker("anime-jikan", {
  failureThreshold: 3,
  resetTimeout: 120000,
  halfOpenMaxAttempts: 2,
});

const anilistBreaker = getOrCreateBreaker("anime-anilist", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const kitsuBreaker = getOrCreateBreaker("anime-kitsu", {
  failureThreshold: 5,
  resetTimeout: 60000,
  halfOpenMaxAttempts: 3,
});

const animeCache = new ApiResponseCache({ ttl: 300000, maxSize: 200 });

/**
 * Normalisasi status anime agar ramah pengguna dan bebas underscore
 */
function normalizeAnimeStatus(raw) {
  if (!raw || raw === "N/A") return "N/A";
  const clean = String(raw).replace(/_/g, " ").trim();
  const upper = clean.toUpperCase();
  if (
    upper.includes("NOT YET") ||
    upper.includes("BELUM") ||
    upper.includes("TO BE AIRED") ||
    upper.includes("UNRELEASED") ||
    upper.includes("UPCOMING") ||
    upper.includes("TBA")
  ) {
    return "Belum Rilis";
  }
  if (upper.includes("FINISH") || upper.includes("SELESAI") || upper.includes("TAMAT")) {
    return "Selesai";
  }
  if (upper.includes("RELEAS") || upper.includes("AIRING") || upper.includes("TAYANG")) {
    return "Sedang Tayang";
  }
  if (upper.includes("CANCEL") || upper.includes("DIBATALKAN") || upper.includes("BATAL")) {
    return "Dibatalkan";
  }
  if (upper.includes("HIATUS")) {
    return "Hiatus";
  }
  return clean.split(" ").map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" ");
}


/**
 * Fetch anime dari Jikan (MyAnimeList) dengan Circuit Breaker
 */
async function fetchFromJikan(query) {
  return jikanBreaker.execute(async () => {
    const response = await axios.get(
      `https://api.jikan.moe/v4/anime?q=${encodeURIComponent(query)}&limit=5`,
      { timeout: 5000 },
    );

    if (
      !response.data ||
      !response.data.data ||
      response.data.data.length === 0
    ) {
      return null;
    }

    return response.data.data.map((item) => ({
      title: item.title_english || item.title,
      titleJapanese: item.title_japanese || "",
      synopsis: item.synopsis || "Tidak ada sinopsis.",
      genres:
        item.genres && item.genres.length > 0
          ? item.genres.map((g) => g.name).join(", ")
          : "Anime",
      score: item.score
        ? `${ui.getEmoji("star") || "⭐"} **${item.score}** / 10`
        : "N/A",
      rawScore: item.score || "8.5",
      type: item.type || "TV",
      episodes: item.episodes ? `${item.episodes} Ep` : "Unknown",
      status: normalizeAnimeStatus(item.status),
      ageRating: item.rating || "N/A",
      url: item.url || null,
      posterURL:
        item.images?.jpg?.large_image_url ||
        item.images?.webp?.large_image_url ||
        item.images?.jpg?.image_url ||
        null,
      studio:
        item.studios && item.studios.length > 0
          ? item.studios.map((s) => s.name).join(", ")
          : "N/A",
      seasonYear:
        item.season && item.year
          ? `${item.season.toUpperCase()} ${item.year}`
          : item.year
            ? String(item.year)
            : "N/A",
      sourceName: "MyAnimeList",
    }));
  });
}

/**
 * Fetch anime dari AniList (GraphQL) dengan Circuit Breaker
 */
async function fetchFromAniList(query) {
  return anilistBreaker.execute(async () => {
    const graphqlQuery = `
      query ($search: String) {
        Page(page: 1, perPage: 5) {
          media(search: $search, type: ANIME, sort: SEARCH_MATCH) {
            id
            title {
              romaji
              english
              native
            }
            description(asHtml: false)
            averageScore
            format
            episodes
            status
            genres
            siteUrl
            coverImage {
              extraLarge
              large
            }
            studios(isMain: true) {
              nodes {
                name
              }
            }
            season
            seasonYear
          }
        }
      }
    `;

    const response = await axios.post(
      "https://graphql.anilist.co",
      {
        query: graphqlQuery,
        variables: { search: query },
      },
      {
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        timeout: 5000,
      },
    );

    const mediaList = response.data?.data?.Page?.media;
    if (!mediaList || mediaList.length === 0) return null;

    return mediaList.map((item) => {
      const rawSynopsis = (item.description || "Tidak ada sinopsis.").replace(
        /<[^>]*>?/gm,
        "",
      );
      const scoreVal = item.averageScore
        ? (item.averageScore / 10).toFixed(1)
        : null;
      return {
        title: item.title.english || item.title.romaji,
        titleJapanese: item.title.native || "",
        synopsis: rawSynopsis,
        genres:
          item.genres && item.genres.length > 0 ? item.genres.join(", ") : "Anime",
        score: scoreVal
          ? `${ui.getEmoji("star") || "⭐"} **${scoreVal}** / 10`
          : "N/A",
        rawScore: scoreVal || "8.5",
        type: item.format || "TV",
        episodes: item.episodes ? `${item.episodes} Ep` : "Unknown",
        status: normalizeAnimeStatus(item.status),
        ageRating: "General",
        url: item.siteUrl || `https://anilist.co/anime/${item.id}`,
        posterURL: item.coverImage?.extraLarge || item.coverImage?.large || null,
        studio: item.studios?.nodes?.[0]?.name || "N/A",
        seasonYear:
          item.season && item.seasonYear
            ? `${item.season} ${item.seasonYear}`
            : item.seasonYear
              ? String(item.seasonYear)
              : "N/A",
        sourceName: "AniList",
      };
    });
  });
}

/**
 * Fetch anime dari Kitsu.io (REST) dengan Circuit Breaker
 */
async function fetchFromKitsu(query) {
  return kitsuBreaker.execute(async () => {
    const response = await axios.get(
      `https://kitsu.io/api/edge/anime?filter[text]=${encodeURIComponent(query)}&page[limit]=5`,
      { timeout: 5000 },
    );

    const data = response.data?.data;
    if (!data || data.length === 0) return null;

    return data.map((item) => {
      const attr = item.attributes;
      const scoreVal = attr.averageRating
        ? (parseFloat(attr.averageRating) / 10).toFixed(1)
        : null;
      return {
        title: attr.titles?.en || attr.titles?.en_jp || attr.canonicalTitle,
        titleJapanese: attr.titles?.ja_jp || "",
        synopsis: attr.synopsis || "Tidak ada sinopsis.",
        genres: "Anime",
        score: scoreVal
          ? `${ui.getEmoji("star") || "⭐"} **${scoreVal}** / 10`
          : "N/A",
        rawScore: scoreVal || "8.5",
        type: (attr.subtype || "TV").toUpperCase(),
        episodes: attr.episodeCount ? `${attr.episodeCount} Ep` : "Unknown",
        status: normalizeAnimeStatus(attr.status),
        ageRating: attr.ageRatingGuide || attr.ageRating || "N/A",
        url: `https://kitsu.io/anime/${item.id}`,
        posterURL:
          attr.posterImage?.large ||
          attr.posterImage?.original ||
          attr.posterImage?.medium ||
          null,
        studio: "Kitsu Registry",
        seasonYear: attr.startDate
          ? String(new Date(attr.startDate).getFullYear())
          : "N/A",
        sourceName: "Kitsu",
      };
    });
  });
}

/**
 * Parallel race pencarian anime dengan Cache & Circuit Breaker
 * Mencoba semua provider secara paralel, ambil yang tercepat berhasil.
 * Fallback ke waterfall jika semua gagal bersamaan.
 */
async function searchAnimeWaterfall(query) {
  const cacheKey = query.toLowerCase().trim();
  
  const cached = animeCache.get("anime", { query: cacheKey });
  if (cached) {
    logger.debug(`[Anime] Cache hit for "${query}"`);
    return cached;
  }

  const wrapFetch = async (fn, name) => {
    try {
      const result = await fn(query);
      if (result && result.length > 0) {
        logger.info(`[Anime] ${name} berhasil (parallel race)`);
        return result;
      }
      throw new Error(`${name}: no results`);
    } catch (err) {
      if (err instanceof CircuitBreakerOpenError) {
        logger.warn(`[Anime] ${name} circuit OPEN`);
      } else {
        logger.debug(`[Anime] ${name} failed: ${err.message}`);
      }
      throw err;
    }
  };

  try {
    const result = await Promise.any([
      wrapFetch(fetchFromJikan, "Jikan"),
      wrapFetch(fetchFromAniList, "AniList"),
      wrapFetch(fetchFromKitsu, "Kitsu"),
    ]);
    
    if (result && result.length > 0) {
      animeCache.set("anime", { query: cacheKey }, result);
      return result;
    }
  } catch {
    logger.debug(`[Anime] All parallel fetches failed, returning null`);
  }

  return null;
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("anime")
    .setDescription(
      "🔍 Cari informasi detail anime dari Multi-Database (MAL, AniList, Kitsu).",
    )
    .addStringOption((opt) =>
      opt
        .setName("judul")
        .setDescription("Judul anime yang ingin dicari")
        .setRequired(true),
    ),

  async execute(interaction) {
    const loadingPayload = buildLoadingContainerV2({
      interaction,
      authorName: "Naura Anime Intelligence",
      title: "Mencari Anime...",
      description: `${ui.getEmoji("loading") || "⏳"} ${ui.getEmoji("naura_thinking") || "🤔"} *Naura sedang mencari anime "${interaction.options.getString("judul")}" di database global...*`,
      expression: "thinking",
      withBanner: true,
      footerText: ui.getFooter("utility"),
    });
    await interaction.deferReply();
    await interaction.editReply(loadingPayload);

    const query = interaction.options.getString("judul");

    try {
      const results = await searchAnimeWaterfall(query);

      if (!results || results.length === 0) {
        const emptyPayload = buildErrorContainerV2({
          interaction,
          title: "Anime Tidak Ditemukan",
          description: `${ui.getEmoji("naura_akward") || "😅"} Maaf ya, Naura sudah mencari di MyAnimeList, AniList, dan Kitsu tapi tidak menemukan anime **"${query}"**.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba periksa ejaan judulnya atau gunakan judul bahasa Inggris/Jepang yang lebih umum, ya!*`,
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
          const buffer = await canvasWorkerPool.execute("renderAnimeCard", {
            title: item.title,
            titleJapanese: item.titleJapanese,
            posterURL: item.posterURL,
            score: item.rawScore || item.score,
            type: item.type,
            episodes: item.episodes,
            status: item.status,
            genres: item.genres,
            studio: item.studio,
            seasonYear: item.seasonYear,
            synopsis: item.synopsis,
            sourceName: item.sourceName,
            botAvatarURL: interaction.client.user.displayAvatarURL({ size: 64, extension: "png" }),
          });
          if (buffer) {
            cardCache.set(idx, buffer);
            return buffer;
          }
        } catch (err) {
          logger.warn("[Anime] Canvas spotlight error: " + (err?.message || err));
        }
        return null;
      }

      let currentIndex = 0;

      const buildButtonsRow = (index, disabledAll = false) => {
        const anime = results[index];
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("anime_prev")
            .setLabel("« Sebelumnya")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index === 0),
          new ButtonBuilder()
            .setCustomId("anime_page_indicator")
            .setLabel(`${index + 1} / ${results.length}`)
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("anime_next")
            .setLabel("Lanjut »")
            .setStyle(ButtonStyle.Primary)
            .setDisabled(disabledAll || index === results.length - 1),
        );

        if (anime.url) {
          row.addComponents(
            new ButtonBuilder()
              .setLabel(`Buka di ${anime.sourceName}`)
              .setStyle(ButtonStyle.Link)
              .setURL(anime.url),
          );
        }

        return row;
      };

      const buildPayload = (index, disabledButtons = false, buffer = null) => {
        const anime = results[index];
        const japaneseTitle = anime.titleJapanese
          ? `\n*${anime.titleJapanese}*`
          : "";
        const cleanSynopsis =
          anime.synopsis.length > 800
            ? `${anime.synopsis.substring(0, 797)}...`
            : anime.synopsis;

        const fields = [
          {
            name: `${ui.getEmoji("anime_rating") || "⭐"} Skor Rating`,
            value: anime.score,
          },
          {
            name: `${ui.getEmoji("anime_type") || "📺"} Tipe`,
            value: anime.type,
          },
          {
            name: `${ui.getEmoji("anime_episodes") || "📼"} Episode`,
            value: anime.episodes,
          },
          {
            name: `${ui.getEmoji("anime_status") || "⌛"} Status`,
            value: anime.status,
          },
          {
            name: `${ui.getEmoji("anime_genres") || "🎭"} Genre`,
            value: anime.genres,
          },
          {
            name: `${ui.getEmoji("anime_age_rating") || "🔞"} Batasan Umur`,
            value: anime.ageRating,
          },
        ];

        const attachment = buffer
          ? new AttachmentBuilder(buffer, { name: "anime-spotlight.png" })
          : null;

        return buildContainerV2({
          interaction,
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: `${anime.sourceName} Intelligence (Hasil ${index + 1}/${results.length})`,
          title: anime.title,
          description: `${japaneseTitle}\n\n${cleanSynopsis}\n\n> ${ui.getEmoji("naura_happy") || "✨"} *Naura menemukan ${results.length} hasil untuk pencarianmu!*`,
          fields,
          mediaAttachmentNames: attachment ? ["anime-spotlight.png"] : [],
          files: attachment ? [attachment] : [],
          buttonsRow: buildButtonsRow(index, disabledButtons),
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
              "Ketik `/anime` untuk mencari anime favoritmu sendiri!",
            footerText: ui.getFooter("utility"),
          });
          return i.reply({ ...errPayload, flags: MessageFlags.Ephemeral });
        }

        if (i.customId === "anime_prev") {
          currentIndex = Math.max(0, currentIndex - 1);
        } else if (i.customId === "anime_next") {
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
      logger.error("[Anime Search Error]", error);
      const isCircuitOpen = error instanceof CircuitBreakerOpenError;
      const errPayload = buildErrorContainerV2({
        interaction,
        title: isCircuitOpen ? "Server Database Sedang Istirahat" : "Gagal Koneksi",
        description: isCircuitOpen
          ? `${ui.getEmoji("naura_sleepy") || "😴"} Server database anime sedang terlalu sibuk dan butuh istirahat sebentar. Coba lagi dalam 1-2 menit ya, Naura tungguin!`
          : `${ui.getEmoji("naura_cry") || "😢"} Maaf ya, terjadi kegagalan saat menghubungkan ke database Anime. Jaringan mungkin sedang tidak stabil.\n\n${ui.getEmoji("sparkle") || "✨"} *Coba lagi beberapa saat lagi, Naura yakin akan berhasil!*`,
        expression: isCircuitOpen ? "sleepy" : "cry",
        withBanner: true,
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
