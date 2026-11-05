"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const movie = require("../plugin/utility/movie");
const anime = require("../plugin/utility/anime");

test("Movie Search - calculateMovieRelevance prioritizes exact title match", () => {
  const query = "cars 2";
  const itemExact = {
    id: "tt1216475",
    l: "Cars 2",
    y: 2011,
    qid: "movie",
    q: "feature",
    rank: 3860,
    s: "Owen Wilson, Larry the Cable Guy",
  };
  const itemPartial = {
    id: "tt3450200",
    l: "Little Women, Big Cars 2",
    y: 2012,
    qid: "movie",
    q: "feature",
    rank: 264567,
  };
  const itemGame = {
    id: "tt1984130",
    l: "Cars 2: The Video Game",
    y: 2011,
    qid: "videoGame",
    q: "video game",
    rank: 135234,
  };
  const itemTvShow = {
    id: "tt1990423",
    l: "Counting Cars",
    y: 2012,
    qid: "tvSeries",
    q: "TV series",
    rank: 15000,
  };

  const scoreExact = movie.calculateMovieRelevance(itemExact, query);
  const scorePartial = movie.calculateMovieRelevance(itemPartial, query);
  const scoreGame = movie.calculateMovieRelevance(itemGame, query);
  const scoreTvShow = movie.calculateMovieRelevance(itemTvShow, query);

  assert.ok(
    scoreExact > scorePartial,
    "Exact title match should score higher than substring match",
  );
  assert.ok(
    scoreExact > scoreGame,
    "Movie entity should score higher than video game entity",
  );
  assert.ok(
    scoreExact > scoreTvShow,
    "Movie entity should score higher than unrelated TV show",
  );
  assert.ok(
    scoreExact >= 150,
    "Exact movie match should exceed threshold score 150",
  );
});

test("Movie Search - calculateMovieRelevance applies year target weighting", () => {
  const query = "avatar";
  const item2009 = {
    id: "tt0499549",
    l: "Avatar",
    y: 2009,
    qid: "movie",
    q: "feature",
    rank: 500,
  };
  const item2022 = {
    id: "tt1630029",
    l: "Avatar: The Way of Water",
    y: 2022,
    qid: "movie",
    q: "feature",
    rank: 150,
  };

  const scoreDefault2009 = movie.calculateMovieRelevance(item2009, query, null);
  const scoreDefault2022 = movie.calculateMovieRelevance(item2022, query, null);
  assert.ok(
    scoreDefault2009 > scoreDefault2022,
    "Without year specified, exact title Avatar (2009) should rank first",
  );

  const scoreYearTarget2009 = movie.calculateMovieRelevance(
    item2009,
    query,
    2022,
  );
  const scoreYearTarget2022 = movie.calculateMovieRelevance(
    item2022,
    query,
    2022,
  );
  assert.ok(
    scoreYearTarget2022 > scoreYearTarget2009,
    "With year=2022 specified, Avatar (2022) should rank higher than Avatar (2009)",
  );
});

test("Movie Search - searchMovie contract compliance and Cars 2 resolution", async () => {
  const result = await movie.searchMovie("cars 2");
  assert.ok(result, "searchMovie('cars 2') must return a result");
  assert.equal(typeof result.title, "string", "Result title must be a string");
  assert.ok(
    result.title.toLowerCase().includes("cars 2"),
    "Result title must contain 'Cars 2'",
  );
  assert.equal(result.year, "2011", "Cars 2 release year must be 2011");
  assert.equal(result.type, "movie", "Entity type must be 'movie'");
  assert.ok(result.posterUrl, "Must provide posterUrl");
  assert.ok(
    result.posterURL,
    "Must provide posterURL for canvas compatibility",
  );
  assert.ok(
    result.url && result.url.includes("imdb.com"),
    "Must provide official IMDb URL",
  );
  assert.ok(Array.isArray(result.actors), "Actors must be an array");
  assert.ok(
    result.actors.some((a) => a.toLowerCase().includes("owen wilson")),
    "Actors must include Owen Wilson",
  );
  assert.ok(
    typeof result.overview === "string" && result.overview.length > 0,
    "Overview/synopsis must be non-empty string",
  );
});

test("Anime Search - calculateAnimeRelevance prioritizes exact title over sequels and spinoffs", () => {
  const naruto = {
    title: "Naruto",
    titleEnglish: "Naruto",
    titleRomaji: "Naruto",
    titleJapanese: "ナルト",
    score: "8.0",
    type: "TV",
  };
  const narutoShippuden = {
    title: "Naruto: Shippuuden",
    titleEnglish: "Naruto: Shippuden",
    titleRomaji: "Naruto: Shippuuden",
    titleJapanese: "ナルト- 疾風伝",
    score: "8.2",
    type: "TV",
  };
  const narutoMovie = {
    title: "Naruto: Shippuuden Movie 4 - The Lost Tower",
    titleEnglish: "Naruto the Movie: The Lost Tower",
    titleRomaji: "Naruto: Shippuuden Movie 4 - The Lost Tower",
    titleJapanese: "劇場版NARUTO-ナルト- 疾風伝 ザ・ロストタワー",
    score: "7.4",
    type: "MOVIE",
  };
  const unrelatedShow = {
    title: "HeatGuy J Special",
    titleEnglish: "HeatGuy J Special",
    score: "6.0",
    type: "SPECIAL",
  };

  const resNaruto = anime.calculateAnimeRelevance(naruto, "Naruto");
  const resShippuden = anime.calculateAnimeRelevance(narutoShippuden, "Naruto");
  const resMovie = anime.calculateAnimeRelevance(narutoMovie, "Naruto");
  const resUnrelated = anime.calculateAnimeRelevance(unrelatedShow, "Naruto");

  assert.equal(
    resNaruto.bestTitleScore,
    100,
    "Exact title Naruto must receive bestTitleScore=100",
  );
  assert.ok(
    resNaruto.relevanceScore > resShippuden.relevanceScore,
    "Naruto must score higher than Naruto: Shippuuden",
  );
  assert.ok(
    resNaruto.relevanceScore > resMovie.relevanceScore,
    "Naruto must score higher than spinoff movie",
  );
  assert.ok(
    resUnrelated.bestTitleScore < 20,
    "Unrelated show must have low title score (< 20)",
  );
});

test("Anime Search - rankAnimeResults filters unrelated entries and sorts by relevance", () => {
  const items = [
    { title: "Naruto: Shippuuden", score: "8.2", type: "TV" },
    { title: "HeatGuy J Special", score: "6.0", type: "SPECIAL" },
    { title: "Naruto", score: "8.0", type: "TV" },
    { title: "Ragna Crimson", score: "7.0", type: "TV" },
  ];

  const ranked = anime.rankAnimeResults(items, "Naruto", 5);
  assert.ok(ranked.length >= 2, "Must return ranked list");
  assert.equal(
    ranked[0].title,
    "Naruto",
    "Exact match 'Naruto' must be placed at index 0",
  );
  assert.equal(
    ranked[1].title,
    "Naruto: Shippuuden",
    "Sequel must be placed below exact match",
  );
  assert.ok(
    !ranked.some((x) => x.title === "HeatGuy J Special"),
    "Unrelated show must be filtered out",
  );
  assert.ok(
    !ranked.some((x) => x.title === "Ragna Crimson"),
    "Unrelated show must be filtered out",
  );
});

test("Anime Search - matches both English and Romaji titles accurately", () => {
  const aot = {
    title: "Attack on Titan",
    titleEnglish: "Attack on Titan",
    titleRomaji: "Shingeki no Kyojin",
    titleJapanese: "進撃の巨人",
    score: "8.5",
    type: "TV",
  };
  const aotSeason2 = {
    title: "Attack on Titan Season 2",
    titleEnglish: "Attack on Titan Season 2",
    titleRomaji: "Shingeki no Kyojin Season 2",
    score: "8.4",
    type: "TV",
  };

  const englishQuery = anime.rankAnimeResults(
    [aotSeason2, aot],
    "Attack on Titan",
  );
  assert.equal(
    englishQuery[0].title,
    "Attack on Titan",
    "English exact title match must be ranked first",
  );

  const romajiQuery = anime.rankAnimeResults(
    [aotSeason2, aot],
    "Shingeki no Kyojin",
  );
  assert.equal(
    romajiQuery[0].title,
    "Attack on Titan",
    "Romaji exact title match must be ranked first",
  );
});

test("Anime Search - searchAnime contract compliance", async () => {
  const result = await anime.searchAnime("Naruto");
  assert.ok(result, "searchAnime('Naruto') must return a result");
  assert.ok(typeof result.title === "string", "Title must be a string");
  assert.ok(
    result.title.toLowerCase().includes("naruto"),
    "Title must contain Naruto",
  );
  assert.ok(result.url, "Must contain media URL");
  assert.ok(result.posterURL || result.posterUrl, "Must contain poster URL");
  assert.ok(result.genres, "Must contain genres");
});
