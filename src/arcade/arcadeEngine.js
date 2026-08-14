"use strict";

const TRIVIA_BANK = [
  {
    q: "Siapakah karakter utama dari anime Sousou no Frieren?",
    options: ["Frieren", "Fern", "Stark", "Himmel"],
    answerIndex: 0,
    category: "Anime",
  },
  {
    q: "Apa nama teknik domain expansion milik Gojo Satoru?",
    options: ["Malevolent Shrine", "Infinite Void", "Chimera Shadow Garden", "Self-Embodiment of Perfection"],
    answerIndex: 1,
    category: "Anime",
  },
  {
    q: "Mata uang paling langka di ekosistem Naura Hoshino adalah?",
    options: ["Gold Coins", "Star Fragments", "Naura Coupon", "Diamond Ticket"],
    answerIndex: 2,
    category: "Naura Lore",
  },
  {
    q: "Siapa karakter archon berelemen Electro di Inazuma (Genshin Impact)?",
    options: ["Venti", "Zhongli", "Nahida", "Raiden Shogun"],
    answerIndex: 3,
    category: "Gaming",
  },
  {
    q: "Apa nama senjata pedang legendaris yang digunakan oleh Saber di Fate Series?",
    options: ["Excalibur", "Enuma Elish", "Caliburn", "Gae Bolg"],
    answerIndex: 0,
    category: "Anime",
  },
  {
    q: "Berapa slot maksimal kartu dalam sebuah active deck di Naura Card TCG?",
    options: ["1 Kartu", "3 Kartu", "5 Kartu", "10 Kartu"],
    answerIndex: 1,
    category: "Naura Lore",
  },
];

class ArcadeEngine {
  /**
   * Mengambil pertanyaan trivia acak.
   */
  static getRandomTrivia() {
    return TRIVIA_BANK[Math.floor(Math.random() * TRIVIA_BANK.length)];
  }

  /**
   * Menghasilkan pola urutan warna acak untuk permainan Rhythm Tap.
   */
  static generateRhythmSequence(length = 4) {
    const colors = ["RED", "BLUE", "GREEN", "YELLOW"];
    const emojiMap = { RED: "🔴", BLUE: "🔵", GREEN: "🟢", YELLOW: "🟡" };
    const seq = [];
    for (let i = 0; i < length; i++) {
      const color = colors[Math.floor(Math.random() * colors.length)];
      seq.push({ color, emoji: emojiMap[color] });
    }
    return seq;
  }

  /**
   * Menghitung hasil putaran Cyber Roulette.
   */
  static spinRoulette(betChoice, betAmount) {
    const number = Math.floor(Math.random() * 37); // 0 to 36
    let color = "BLACK";
    if (number === 0) color = "GREEN";
    else if ([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36].includes(number)) {
      color = "RED";
    }

    let isWon = false;
    let multiplier = 0;

    const choice = betChoice.toUpperCase();
    if (choice === color) {
      isWon = true;
      multiplier = color === "GREEN" ? 14 : 2;
    } else if (parseInt(choice, 10) === number) {
      isWon = true;
      multiplier = 35;
    }

    const payout = isWon ? betAmount * multiplier : 0;

    return {
      number,
      color,
      isWon,
      multiplier,
      payout,
    };
  }
}

module.exports = ArcadeEngine;
