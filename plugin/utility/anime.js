const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const axios = require("axios");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

/**
 * Fetch anime dari Jikan (MyAnimeList)
 */
async function fetchFromJikan(query) {
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
        : "N/A",
    score: item.score
      ? `${ui.getEmoji("star") || "⭐"} **${item.score}** / 10`
      : "N/A",
    type: item.type || "N/A",
    episodes: item.episodes ? `${item.episodes} Ep` : "Unknown",
    status: item.status || "N/A",
    ageRating: item.rating || "N/A",
    url: item.url || null,
    sourceName: "MyAnimeList",
  }));
}

/**
 * Fetch anime dari AniList (GraphQL)
 */
async function fetchFromAniList(query) {
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
        item.genres && item.genres.length > 0 ? item.genres.join(", ") : "N/A",
      score: scoreVal
        ? `${ui.getEmoji("star") || "⭐"} **${scoreVal}** / 10`
        : "N/A",
      type: item.format || "ANIME",
      episodes: item.episodes ? `${item.episodes} Ep` : "Unknown",
      status: item.status ? item.status.replace("_", " ") : "N/A",
      ageRating: "General",
      url: item.siteUrl || `https://anilist.co/anime/${item.id}`,
      sourceName: "AniList",
    };
  });
}

/**
 * Fetch anime dari Kitsu.io (REST)
 */
async function fetchFromKitsu(query) {
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
      type: (attr.subtype || "TV").toUpperCase(),
      episodes: attr.episodeCount ? `${attr.episodeCount} Ep` : "Unknown",
      status: (attr.status || "N/A").toUpperCase(),
      ageRating: attr.ageRatingGuide || attr.ageRating || "N/A",
      url: `https://kitsu.io/anime/${item.id}`,
      sourceName: "Kitsu",
    };
  });
}

/**
 * Cascade waterfall pencarian anime
 */
async function searchAnimeWaterfall(query) {
  try {
    const jikanResults = await fetchFromJikan(query);
    if (jikanResults && jikanResults.length > 0) return jikanResults;
  } catch (err) {
    logger.warn(
      `[Anime Search] Jikan API error (${err.message}), beralih ke AniList...`,
    );
  }

  try {
    const aniListResults = await fetchFromAniList(query);
    if (aniListResults && aniListResults.length > 0) return aniListResults;
  } catch (err) {
    logger.warn(
      `[Anime Search] AniList API error (${err.message}), beralih ke Kitsu...`,
    );
  }

  try {
    const kitsuResults = await fetchFromKitsu(query);
    if (kitsuResults && kitsuResults.length > 0) return kitsuResults;
  } catch (err) {
    logger.warn(`[Anime Search] Kitsu API error (${err.message}).`);
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
    await interaction.deferReply();

    const query = interaction.options.getString("judul");

    try {
      const results = await searchAnimeWaterfall(query);

      if (!results || results.length === 0) {
        const emptyPayload = buildErrorContainerV2({
          title: "Tidak Ditemukan",
          description: `${ui.getEmoji("error") || "❌"} Anime dengan judul **"${query}"** tidak ditemukan di MyAnimeList, AniList, maupun Kitsu.`,
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(emptyPayload);
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

      const buildPayload = (index, disabledButtons = false) => {
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

        return buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFB6C1",
          authorName: `${anime.sourceName} Intelligence (Hasil ${index + 1}/${results.length})`,
          title: anime.title,
          description: `${japaneseTitle}\n\n${cleanSynopsis}`,
          fields,
          buttonsRow: buildButtonsRow(index, disabledButtons),
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
            content: `${ui.getEmoji("cross")} Perintah ini dibuat oleh orang lain. Ketik \`/anime\` untuk mencari anime favoritmu sendiri!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (i.customId === "anime_prev") {
          currentIndex = Math.max(0, currentIndex - 1);
        } else if (i.customId === "anime_next") {
          currentIndex = Math.min(results.length - 1, currentIndex + 1);
        }

        await i.update(buildPayload(currentIndex));
      });

      collector.on("end", () => {
        interaction.editReply(buildPayload(currentIndex, true)).catch(() => {});
      });
    } catch (error) {
      logger.error("[Anime Search Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Koneksi",
        description: `${ui.getEmoji("error") || "❌"} Terjadi kegagalan saat menghubungkan ke database Anime. Coba lagi nanti.`,
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
