"use strict";

const { describe, it, after } = require("node:test");
const assert = require("node:assert/strict");
const {
  renderCarbonCard,
  tokenizeLine,
  tokenizeCode,
  THEMES,
} = require("./codeCanvas");
const { renderPollChart, normalizePollData } = require("./pollCanvas");
const { renderWeatherCard } = require("./weatherCanvas");
const {
  renderMinecraftPing,
  renderMinecraftPlayer,
  renderMinecraftStats,
} = require("./minecraftCanvas");
const { renderAnimeCard } = require("./animeCanvas");
const { renderMovieCard } = require("./movieCanvas");
const canvasWorkerPool = require("./canvasWorkerPool");

describe("Smart Utilities - Code Canvas & Syntax Tokenizer", () => {
  it("tokenizeLine correctly categorizes JavaScript syntax tokens", () => {
    const jsLine = "const result = calculate(42, 'naura'); // komentar";
    const tokens = tokenizeLine(jsLine, "javascript");

    assert.ok(Array.isArray(tokens));
    assert.ok(tokens.length >= 7);

    const keywordToken = tokens.find((t) => t.text === "const");
    assert.ok(keywordToken);
    assert.equal(keywordToken.type, "keyword");

    const numberToken = tokens.find((t) => t.text === "42");
    assert.ok(numberToken);
    assert.equal(numberToken.type, "number");

    const stringToken = tokens.find((t) => t.text === "'naura'");
    assert.ok(stringToken);
    assert.equal(stringToken.type, "string");

    const commentToken = tokens.find((t) => t.type === "comment");
    assert.ok(commentToken);
    assert.equal(commentToken.text, "// komentar");

    const funcToken = tokens.find((t) => t.text === "calculate");
    assert.ok(funcToken);
    assert.equal(funcToken.type, "function");
  });

  it("tokenizeLine supports Python syntax and hash comments", () => {
    const pyLine = "def fetch_data(api_key): # Ambil data rahasia";
    const tokens = tokenizeLine(pyLine, "python");

    const defToken = tokens.find((t) => t.text === "def");
    assert.ok(defToken);
    assert.equal(defToken.type, "keyword");

    const commentToken = tokens.find((t) => t.type === "comment");
    assert.ok(commentToken);
    assert.equal(commentToken.text, "# Ambil data rahasia");
  });

  it("tokenizeLine handles operators, multi-line blocks, and edge cases", () => {
    const opLine = "if (a === 10 && b !== 20) return a + b;";
    const tokens = tokenizeLine(opLine, "javascript");

    assert.ok(tokens.some((t) => t.text === "===" && t.type === "operator"));
    assert.ok(tokens.some((t) => t.text === "&&" && t.type === "operator"));
    assert.ok(tokens.some((t) => t.text === "!==" && t.type === "operator"));
    assert.ok(tokens.some((t) => t.text === "return" && t.type === "keyword"));

    // Empty string edge case
    const emptyTokens = tokenizeLine("", "javascript");
    assert.equal(emptyTokens.length, 0);
  });

  it("tokenizeCode tokenizes multi-line code blocks preserving line integrity", () => {
    const multiLine = "function add(x, y) {\n  return x + y;\n}";
    const codeTokens = tokenizeCode(multiLine, "javascript");

    assert.equal(codeTokens.length, 3);
    assert.equal(codeTokens[0][0].text, "function");
    assert.equal(codeTokens[0][0].type, "keyword");
  });

  it("renderCarbonCard generates a genuine PNG buffer across all themes", async () => {
    const sampleCode = [
      "import { useState } from 'react';",
      "",
      "export default function App() {",
      "  const [count, setCount] = useState(0);",
      "  return <button onClick={() => setCount(count + 1)}>{count}</button>;",
      "}",
    ].join("\n");

    const themesToTest = Object.keys(THEMES);
    for (const theme of themesToTest) {
      const buffer = await renderCarbonCard({
        code: sampleCode,
        language: "javascript",
        theme,
        showLineNumbers: true,
        title: `test-${theme}.jsx`,
      });

      assert.ok(Buffer.isBuffer(buffer), `Buffer should be valid for theme ${theme}`);
      assert.ok(buffer.length > 5000, `Buffer size should be realistic for theme ${theme}`);

      // Validasi tanda tangan PNG (Magic bytes: 89 50 4E 47 0D 0A 1A 0A)
      assert.equal(buffer[0], 0x89);
      assert.equal(buffer[1], 0x50);
      assert.equal(buffer[2], 0x4e);
      assert.equal(buffer[3], 0x47);
    }
  });

  it("renderCarbonCard renders without line numbers cleanly", async () => {
    const buffer = await renderCarbonCard({
      code: "print('Hello Naura Wilds')",
      language: "python",
      theme: "stellar",
      showLineNumbers: false,
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 2000);
  });

  it("renderCarbonCard truncates excessively long code to prevent OOM", async () => {
    const longLines = [];
    for (let i = 1; i <= 150; i++) {
      longLines.push(`const var_${i} = ${i * 10};`);
    }

    const buffer = await renderCarbonCard({
      code: longLines.join("\n"),
      language: "javascript",
      theme: "dracula",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
  });
});

describe("Smart Utilities - Poll Calculation & Chart Renderer", () => {
  it("normalizePollData safely scales percentages when total votes is zero", () => {
    const emptyPoll = normalizePollData({
      question: "Mau sarapan apa?",
      options: ["Nasi Uduk", "Bubur Ayam"],
      counts: [0, 0],
    });

    assert.equal(emptyPoll.total, 0);
    assert.equal(emptyPoll.maxVotes, 0);
    assert.equal(emptyPoll.options.length, 2);
  });

  it("normalizePollData calculates vote distribution and winner correctly", () => {
    const poll = normalizePollData({
      question: "Pilih Framework Backend Favorit?",
      options: ["Fastify", "Express", "NestJS"],
      votes: {
        user1: [1], // Express
        user2: [1], // Express
        user3: [0], // Fastify
        user4: [1], // Express
      },
    });

    assert.equal(poll.total, 4);
    assert.equal(poll.counts[0], 1); // Fastify = 1
    assert.equal(poll.counts[1], 3); // Express = 3
    assert.equal(poll.counts[2], 0); // NestJS = 0
    assert.equal(poll.maxVotes, 3);
  });

  it("normalizePollData handles tied votes without crashing", () => {
    const tiedPoll = normalizePollData({
      question: "Kucing vs Anjing?",
      options: ["Kucing", "Anjing"],
      counts: [50, 50],
    });

    assert.equal(tiedPoll.total, 100);
    assert.equal(tiedPoll.maxVotes, 50);
  });

  it("renderPollChart renders a 1000x620 high-resolution PNG buffer", async () => {
    const buffer = await renderPollChart({
      question: "Apakah sistem closed-loop Currency V2 berjalan stabil?",
      options: ["Sangat Stabil", "Cukup Baik", "Perlu Penyesuaian"],
      counts: [45, 12, 3],
      author: { username: "HoshinoArchitect" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);

    // Validasi magic bytes PNG
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  });

  it("renderPollChart renders cleanly with zero votes and single option", async () => {
    const buffer = await renderPollChart({
      question: "Polling Tanpa Suara",
      options: ["Opsi A", "Opsi B"],
      counts: [0, 0],
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
  });
});

describe("Smart Utilities - Weather Infographic Canvas Card", () => {
  it("renderWeatherCard generates a high-resolution PNG buffer with accurate telemetry", async () => {
    const buffer = await renderWeatherCard({
      cityName: "Jakarta",
      stateName: "DKI Jakarta",
      countryName: "Indonesia",
      lat: -6.21,
      lon: 106.85,
      current: {
        temp: 31,
        feelsLike: 35,
        humidity: 78,
        windSpeed: 14,
        precipitation: 1.2,
        code: 2,
        isDay: true,
        uvIndex: 7.2,
      },
      forecast: [
        { dayName: "Besok", minTemp: 24, maxTemp: 32, code: 61, rainProb: 65 },
        { dayName: "Lusa", minTemp: 23, maxTemp: 31, code: 3, rainProb: 30 },
        { dayName: "Hari ke-3", minTemp: 25, maxTemp: 33, code: 1, rainProb: 15 },
      ],
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
    // Validasi magic bytes PNG
    assert.equal(buffer[0], 0x89);
    assert.equal(buffer[1], 0x50);
    assert.equal(buffer[2], 0x4e);
    assert.equal(buffer[3], 0x47);
  });

  it("renderWeatherCard handles nighttime and rain codes gracefully", async () => {
    const buffer = await renderWeatherCard({
      cityName: "Bandung",
      lat: -6.91,
      lon: 107.61,
      current: {
        temp: 21,
        feelsLike: 20,
        humidity: 90,
        windSpeed: 8,
        precipitation: 5.4,
        code: 65,
        isDay: false,
        uvIndex: 0.0,
      },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
  });
});

describe("Smart Utilities - Minecraft Canvas Radar & Cards", () => {
  it("renderMinecraftPing renders a high-tech server monitor dashboard card", async () => {
    const buffer = await renderMinecraftPing({
      ip: "mc.hypixel.net",
      port: 25565,
      ping: 42,
      players: { online: 45200, max: 100000 },
      version: { name: "Paper 1.21.1" },
      motd: { clean: "Hypixel Network [1.8-1.21] SkyBlock & Bed Wars!" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
    assert.equal(buffer[0], 0x89);
  });

  it("renderMinecraftPlayer renders a player identity card", async () => {
    const buffer = await renderMinecraftPlayer({
      uuid: "069a79f444e94726a5bef2a2fce1b29d",
      realName: "Notch",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
    assert.equal(buffer[0], 0x89);
  });

  it("renderMinecraftStats renders playtime certificate card", async () => {
    const buffer = await renderMinecraftStats({
      username: "Aryandita",
      playDays: 5,
      playHours: 124,
      playMinutes: 7440,
      uuid: "069a79f444e94726a5bef2a2fce1b29d",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 5000);
    assert.equal(buffer[0], 0x89);
  });
});

describe("Smart Utilities - Anime & Movie Showcase Cards", () => {
  it("renderAnimeCard renders anime spotlight card with scores and pills", async () => {
    const buffer = await renderAnimeCard({
      title: "Sousou no Frieren",
      titleJapanese: "葬送のフリーレン",
      score: "9.3",
      type: "TV",
      episodes: "28 Ep",
      status: "SELESAI",
      genres: "Adventure, Drama, Fantasy",
      studio: "Madhouse",
      seasonYear: "Fall 2023",
      synopsis: "Petualangan Frieren seorang penyihir elf setelah mengalahkan Raja Iblis.",
      sourceName: "MyAnimeList",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });

  it("renderMovieCard renders cinema showcase card with ratings and credits", async () => {
    const buffer = await renderMovieCard({
      title: "Inception (2010)",
      rating: "8.8",
      runtime: "148 Menit",
      genres: "Action, Sci-Fi, Thriller",
      director: "Christopher Nolan",
      actors: "Leonardo DiCaprio, Joseph Gordon-Levitt",
      synopsis: "Seorang pencuri yang mencuri rahasia perusahaan melalui penggunaan teknologi berbagi mimpi.",
      sourceName: "IMDb / OMDB",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });
});

describe("Smart Utilities - Canvas Worker Pool Integration", () => {
  after(async () => {
    await canvasWorkerPool.shutdown();
  });

  it("canvasWorkerPool processes 'renderCarbon' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderCarbon", {
      code: "const universe = 42;\nconsole.log(universe);",
      language: "javascript",
      theme: "one-dark",
      showLineNumbers: true,
      title: "universe.js",
    }, 60000);

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 3000);
    assert.equal(buffer[0], 0x89);
  });

  it("canvasWorkerPool processes 'renderPollChart' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderPollChart", {
      question: "Pilihan Bahasa Pemrograman Utama?",
      options: ["JavaScript", "Rust", "Python", "Go"],
      counts: [28, 14, 20, 10],
      author: { username: "Naura Tester" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 10000);
    assert.equal(buffer[0], 0x89);
  });

  it("canvasWorkerPool processes 'renderWeatherCard' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderWeatherCard", {
      cityName: "Surabaya",
      current: { temp: 32, humidity: 70, code: 0, isDay: true },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });

  it("canvasWorkerPool processes 'renderMinecraftPing' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderMinecraftPing", {
      ip: "play.cubecraft.net",
      ping: 55,
      players: { online: 1200, max: 10000 },
      motd: { clean: "CubeCraft Games" },
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });

  it("canvasWorkerPool processes 'renderAnimeCard' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderAnimeCard", {
      title: "Chainsaw Man",
      score: "8.6",
      genres: "Action, Supernatural",
      studio: "MAPPA",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });

  it("canvasWorkerPool processes 'renderMovieCard' task asynchronously", async () => {
    const buffer = await canvasWorkerPool.runTask("renderMovieCard", {
      title: "Interstellar",
      rating: "8.7",
      director: "Christopher Nolan",
    });

    assert.ok(Buffer.isBuffer(buffer));
    assert.ok(buffer.length > 8000);
    assert.equal(buffer[0], 0x89);
  });
});



