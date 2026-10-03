"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyTrack, GENRES } = require("./genreClassifier");

test("genreClassifier: mendeteksi lagu Lofi / Chill", () => {
  const result = classifyTrack({
    title: "Cozy Coffee Shop - Chill Lofi Beats for Study",
    author: "Lofi Girl",
  });
  assert.equal(result.genre, GENRES.LOFI);
  assert.equal(result.emoji, "☕");
});

test("genreClassifier: mendeteksi lagu Anime / J-Pop / Vocaloid", () => {
  const result = classifyTrack({
    title: "Gurenge - Demon Slayer OP",
    author: "LiSA",
  });
  assert.equal(result.genre, GENRES.ANIME);
  assert.equal(result.emoji, "🌸");
});

test("genreClassifier: mendeteksi lagu Rock / Metal", () => {
  const result = classifyTrack({
    title: "In The End - Heavy Guitar Riff",
    author: "Linkin Park",
  });
  assert.equal(result.genre, GENRES.ROCK);
  assert.equal(result.emoji, "⚡");
});

test("genreClassifier: mendeteksi lagu EDM / Dance", () => {
  const result = classifyTrack({
    title: "Titanium Club Remix Bass Drop",
    author: "David Guetta",
  });
  assert.equal(result.genre, GENRES.EDM);
  assert.equal(result.emoji, "🎧");
});

test("genreClassifier: mendeteksi lagu K-Pop", () => {
  const result = classifyTrack({
    title: "Super Shy",
    author: "NewJeans",
  });
  assert.equal(result.genre, GENRES.KPOP);
  assert.equal(result.emoji, "💖");
});

test("genreClassifier: mendeteksi lagu Acoustic / Ballad", () => {
  const result = classifyTrack({
    title: "Someone Like You - Emotional Piano Acoustic",
    author: "Adele",
  });
  assert.equal(result.genre, GENRES.ACOUSTIC);
  assert.equal(result.emoji, "🎸");
});

test("genreClassifier: mendeteksi Gaming Soundtrack", () => {
  const result = classifyTrack({
    title: "Weight of the World - NieR Automata Game OST",
    author: "Keiichi Okabe",
  });
  assert.equal(result.genre, GENRES.GAMING);
  assert.equal(result.emoji, "🎮");
});

test("genreClassifier: mendeteksi Live Stream / Long Session", () => {
  const result = classifyTrack({
    title: "24/7 Deep Concentration Focus Music",
    author: "Study Lab",
    isStream: true,
  });
  assert.equal(result.genre, GENRES.STREAM);
  assert.equal(result.emoji, "📻");
});

test("genreClassifier: fallback ke POP_DEFAULT bila tanpa kata kunci", () => {
  const result = classifyTrack({
    title: "Simple Daydream",
    author: "John Doe",
  });
  assert.equal(result.genre, GENRES.POP_DEFAULT);
  assert.equal(result.emoji, "🎵");
});
