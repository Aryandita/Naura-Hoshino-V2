"use strict";

// src/arcade/arcadeEngine.js - Single unified engine (MP primary, NSF escrow only)
// Legacy root/trivia/roulette helpers retained for backward compat.

const arcadeContract = require("../domain/contracts/arcadeContract");
const { logger } = require("../managers/logger");

const ALL_GAMES = {
  blackjack: { label: "Blackjack 21", emoji: "\uD83C\uDCCF", desc: "Bermain kartu 21 melawan dealer Naura" },
  typerace: { label: "Type Race", emoji: "\u2318\uFE0F", desc: "Uji kecepatan mengetik WPM berbatas waktu" },
  tictactoe: { label: "Tic Tac Toe", emoji: "\u274C", desc: "Adu taktik 3x3 PvP atau lawan Bot" },
  rps: { label: "Batu Gunting Kertas", emoji: "\u2702\uFE0F", desc: "Adu insting klasik melawan AI atau teman" },
  trivia: { label: "Trivia", emoji: "\uD83E\uDDE0", desc: "Kuis pengetahuan umum dari berbagai topik" },
  math: { label: "Matematika Cepat", emoji: "\uD83E\uDDEE", desc: "Uji kecepatan berhitung di bawah tekanan waktu" },
  hangman: { label: "Hangman", emoji: "\uD83D\uDD24", desc: "Tebak kata huruf per huruf sebelum tali terpasang" },
  memory: { label: "Memory Match", emoji: "\uD83C\uDCC2", desc: "Cocokkan pasangan emoji yang tersembunyi" },
  wordle: { label: "Wordle", emoji: "\uD83D\uDCDD", desc: "Tebak kata 5 huruf dalam 6 kesempatan" },
  minesweeper: { label: "Minesweeper", emoji: "\uD83D\uDCA3", desc: "Bongkar papan ranjau klasik tanpa meledak" },
  akinator: { label: "Akinator AI", emoji: "\uD83E\uDE10", desc: "Tebak karakter yang sedang kamu pikirkan" },
  tod: { label: "Truth or Dare", emoji: "\uD83C\uDFAD", desc: "Permainan kejujuran dan tantangan seru" },
  tebakkata: { label: "Tebak Kata Anagram", emoji: "\uD83D\uDD20", desc: "Susun kembali huruf yang teracak menjadi kata benar" },
  tebakgambar: { label: "Tebak Gambar", emoji: "\uD83D\uDDBC\uFE0F", desc: "Tebak nama benda dari gambar yang ditampilkan" },
  duel: { label: "Duel PvP", emoji: "\u2694\uFE0F", desc: "Tantang pemain lain dalam pertarungan strategis" },
  tts: { label: "Teka Teki Silang Mini", emoji: "\uD83D\uDCDD", desc: "Isi kotak mendatar dan menurun" },
  edu_peta: { label: "Peta Adisha: Provinsi & Ibu Kota", emoji: "\uD83D\uDDFA\uFE0F", desc: "Edukasi IPS geografi provinsi Indonesia" },
  edu_belanja: { label: "Belanja Matematika", emoji: "\uD83D\uDED2", desc: "Aritmetika cerita dan kembalian" },
  edu_sukukata: { label: "Suku Kata Sprint", emoji: "\uD83D\uDCD6", desc: "Bahasa Indonesia EYD dan imbuhan" },
  edu_flagrush: { label: "Flag Rush: Ibu Kota Dunia", emoji: "\uD83C\uDF0D", desc: "Geografi dunia ibu kota negara" },
  leaderboard: { label: "Leaderboard", emoji: "\uD83C\uDFC6", desc: "Peringkat pemain" },
};

const GAME_CONFIG = {};
for (const key of Object.keys(ALL_GAMES)) {
  GAME_CONFIG[key] = { fee: 5, win: 25, draw: 5, loss: 0 };
}

const TRIVIA_BANK = [
  { q: "Siapakah karakter utama dari anime Sousou no Frieren?", options: ["Frieren", "Fern", "Stark", "Himmel"], answerIndex: 0, category: "Anime" },
  { q: "Apa nama teknik domain expansion milik Gojo Satoru?", options: ["Malevolent Shrine", "Infinite Void", "Chimera Shadow Garden", "Self-Embodiment of Perfection"], answerIndex: 1, category: "Anime" },
  { q: "Mata uang paling langka di ekosistem Naura Hoshino adalah?", options: ["Gold Coins", "Star Fragments", "Naura Coupon", "Diamond Ticket"], answerIndex: 2, category: "Naura Lore" },
  { q: "Siapa karakter archon berelemen Electro di Inazuma?", options: ["Venti", "Zhongli", "Nahida", "Raiden Shogun"], answerIndex: 3, category: "Gaming" },
  { q: "Apa nama senjata pedang legendaris yang digunakan oleh Saber di Fate Series?", options: ["Excalibur", "Enuma Elish", "Caliburn", "Gae Bolg"], answerIndex: 0, category: "Anime" },
  { q: "Berapa slot maksimal kartu dalam sebuah active deck di Naura Card TCG?", options: ["1 Kartu", "3 Kartu", "5 Kartu", "10 Kartu"], answerIndex: 1, category: "Naura Lore" },
];

class ArcadeEngine {
  static getRandomTrivia() { return TRIVIA_BANK[Math.floor(Math.random() * TRIVIA_BANK.length)]; }
  static generateRhythmSequence(length) {
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"];
    const emojiMap = { RED: "\uD83D\uDD34", BLUE: "\uD83D\uDD35", GREEN: "\uD83D\uDFE2", YELLOW: "\uD83D\uDFE1" };
    const seq = [];
    for (let i = 0; i < (length || 4); i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      seq.push({ color, emoji: emojiMap[color] });
    }
    return seq;
  }
  static spinRoulette(betChoice, betAmount) {
    const number = Math.floor(Math.random() * 37);
    let color = "BLACK";
    if (number === 0) color = "GREEN";
    else if ([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36].includes(number)) color = "RED";
    let isWon = false;
    let multiplier = 0;
    const choice = String(betChoice).toUpperCase();
    if (choice === color) { isWon = true; multiplier = color === "GREEN" ? 14 : 2; }
    else if (parseInt(choice, 10) === number) { isWon = true; multiplier = 35; }
    return { number, color, isWon, multiplier, payout: isWon ? betAmount * multiplier : 0 };
  }
  static async preGame(userId, gameType) {
    const config = GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe;
    const balance = await arcadeContract.getBalance(userId);
    if (balance < config.fee) return { ok: false, balance, reason: "INSUFFICIENT_MP", need: config.fee };
    const result = await arcadeContract.chargeGameFee(userId);
    if (!result.ok) return { ok: false, balance: result.balance, reason: result.reason };
    return { ok: true, balance: result.balance, fee: config.fee, gameId: null };
  }
  static async postGame(userId, gameType, result, gameId) {
    const config = GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe;
    let reward = 0;
    if (result === "win") { reward = config.win; await arcadeContract.rewardWin(userId); }
    else if (result === "draw") { reward = config.draw; await arcadeContract.rewardDraw(userId); }
    else if (result === "loss") { reward = config.loss; await arcadeContract.rewardLoss(userId); }
    else return { ok: false, balance: 0, reward: 0, reason: "INVALID_RESULT" };
    const balance = await arcadeContract.getBalance(userId);
    logger.info("[ArcadeEngine] User " + userId + " " + result + " di " + gameType + ": fee " + config.fee + ", reward " + reward + ", balance " + balance);
    return { ok: true, balance, reward, result };
  }
  static getConfig(gameType) { return GAME_CONFIG[gameType] || GAME_CONFIG.tictactoe; }
  static getAvailableGames() { return Object.keys(GAME_CONFIG); }
  static getAllGames() { return ALL_GAMES; }
}

ArcadeEngine.GAME_CONFIG = GAME_CONFIG;
ArcadeEngine.ALL_GAMES = ALL_GAMES;
module.exports = ArcadeEngine;
