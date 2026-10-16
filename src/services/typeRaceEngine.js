"use strict";

/**
 * TypeRace Engine - Pure Logic for TypeRacer Minigame
 *
 * Provides:
 * - Curated bilingual quotes bank (ID & EN, 50-300 chars, easy/medium/hard)
 * - Standard WPM formula: Math.round(((characterCount / 5) / (elapsedSeconds / 60)))
 * - Levenshtein-based accuracy: Math.max(0, Math.round((1 - (distance / targetLength)) * 100))
 * - Time limit validation & reward calculation
 */

const { levenshteinDistance } = require("../utils/levenshteinSuggest");

const QUOTES_BANK = {
  id: {
    easy: [
      "Teknologi berkembang pesat setiap hari untuk membantu kehidupan manusia.",
      "Masa depan yang cerah dimulai dari langkah kecil dan disiplin belajar.",
      "Kreativitas tanpa batas membuka jalan menuju berbagai inovasi hebat.",
      "Kecepatan dan ketelitian adalah kunci utama dalam menyelesaikan tugas.",
      "Bintang malam bersinar terang menemani perjalanan para petualang muda.",
    ],
    medium: [
      "Di tengah rimba belantara Naura Wilds, para penjelajah mengumpulkan Star Fragments untuk bertahan hidup dari dinginnya malam.",
      "Keberanian sejati bukanlah tentang ketiadaan rasa takut, melainkan tentang kemampuan melangkah maju meskipun ketakutan itu ada.",
      "Setiap baris kode yang ditulis dengan rapi mencerminkan dedikasi seorang pengembang terhadap kualitas perangkat lunak.",
      "Dunia digital menghubungkan jutaan pikiran kreatif dari seluruh penjuru bumi untuk berkolaborasi mewujudkan ide besar.",
      "Angin malam berbisik pelan di antara pepohonan neon, menyalakan lentera harapan bagi para musafir yang sedang beristirahat.",
    ],
    hard: [
      "Dalam arsitektur sistem terdistribusi modern, konsistensi data dan ketahanan terhadap kegagalan jaringan merupakan dua tantangan terberat yang harus dihadapi oleh setiap insinyur perangkat lunak profesional.",
      "Petualangan di Naura Wilds menuntut ketelitian dalam mengelola sumber daya, kecepatan reaksi saat bahaya mengintai, serta kebijaksanaan dalam memilih strategi bersama rekan satu tim.",
      "Perjalanan ribuan mil selalu diawali dengan satu kayuhan langkah pertama yang penuh keyakinan, menembus rintangan badai dan kabut tebal hingga akhirnya fajar kejayaan menyingsing di cakrawala.",
      "Kecerdasan buatan dan intuisi manusia berpadu harmonis menciptakan terobosan baru dalam sains, seni, dan penjelajahan luar angkasa tanpa batas.",
    ],
  },
  en: {
    easy: [
      "Fast fingers and sharp focus are the keys to victory in the arena.",
      "Small daily improvements over time lead to stunning long-term results.",
      "The starry night illuminates the path for brave explorers everywhere.",
      "Code is poetry written with logic to solve real-world problems.",
      "Practice makes progress and patience turns dreams into reality.",
    ],
    medium: [
      "Deep inside the cybernetic wilderness of Naura Wilds, travelers gather glowing fragments to power their neon shelters.",
      "True craftsmanship lies in the details that most people never notice, yet everyone instinctively feels.",
      "Artificial intelligence and human creativity combine to unlock brand new horizons of scientific discovery.",
      "The quiet moments before dawn remind us that every new sunrise brings fresh opportunities to shine.",
      "Distributed systems require relentless vigilance, robust error handling, and crystal clear interfaces.",
    ],
    hard: [
      "Building high-performance software requires an unyielding commitment to simplicity, architectural discipline, and comprehensive automated verification across all layers of the stack.",
      "In the neon-lit heart of the metropolis, digital shadows dance across glass towers as autonomous agents coordinate real-time operations across global quantum networks.",
      "The true test of a developer is not how quickly they can produce new code, but how thoroughly they consider edge cases, concurrency hazards, and system resilience.",
    ],
  },
};

/**
 * Gets a random quote from the quotes bank
 * @param {'easy'|'medium'|'hard'} [difficulty='medium']
 * @param {'id'|'en'} [lang='id']
 * @returns {{quote: string, difficulty: string, lang: string, length: number}}
 */
function getRandomQuote(difficulty = "medium", lang = "id") {
  const selectedLang = QUOTES_BANK[lang] ? lang : "id";
  const list = QUOTES_BANK[selectedLang][difficulty] || QUOTES_BANK[selectedLang].medium;
  const quote = list[Math.floor(Math.random() * list.length)];
  return {
    quote,
    difficulty,
    lang: selectedLang,
    length: quote.length,
  };
}

/**
 * Calculates Words Per Minute (WPM)
 * Standard formula: (characters / 5) / minutes
 * @param {number} characterCount
 * @param {number} elapsedSeconds
 * @returns {number}
 */
function calculateWPM(characterCount, elapsedSeconds) {
  if (!characterCount || characterCount <= 0) return 0;
  const safeSeconds = Math.max(1, elapsedSeconds);
  const minutes = safeSeconds / 60;
  const words = characterCount / 5;
  return Math.round(words / minutes);
}

/**
 * Calculates typing accuracy percentage using Levenshtein distance
 * @param {string} target
 * @param {string} typed
 * @returns {number} 0 - 100
 */
function calculateAccuracy(target, typed) {
  if (!target || typeof target !== "string") return 0;
  if (!typed || typeof typed !== "string") return 0;

  const cleanTarget = target.trim();
  const cleanTyped = typed.trim();
  const targetLength = cleanTarget.length;

  if (targetLength === 0) return 0;

  const distance = levenshteinDistance(cleanTarget, cleanTyped);
  return Math.max(0, Math.round((1 - (distance / targetLength)) * 100));
}

/**
 * Calculates Net WPM (Gross WPM scaled by accuracy percentage)
 * @param {number} grossWPM
 * @param {number} accuracy
 * @returns {number}
 */
function calculateNetWPM(grossWPM, accuracy) {
  if (!grossWPM || grossWPM <= 0) return 0;
  if (!accuracy || accuracy <= 0) return 0;
  return Math.round(grossWPM * (accuracy / 100));
}

/**
 * Validates whether the attempt is within time limits
 * @param {number} elapsedSeconds
 * @param {number} [maxSeconds=90]
 * @returns {boolean}
 */
function isWithinTimeLimit(elapsedSeconds, maxSeconds = 90) {
  return elapsedSeconds > 0 && elapsedSeconds <= maxSeconds;
}

/**
 * Calculates reward in NSF based on WPM, accuracy, difficulty, and optional bet
 * Requires min 85% accuracy for rewards
 * @param {Object} options
 * @param {number} options.wpm
 * @param {number} options.accuracy
 * @param {string} [options.difficulty='medium']
 * @param {number} [options.bet=0]
 * @param {boolean} [options.isPremium=false]
 * @returns {{success: boolean, payout: number, rewardNsf: number, reason: string}}
 */
function calculateReward({
  wpm,
  accuracy,
  difficulty = "medium",
  bet = 0,
  isPremium = false,
}) {
  if (accuracy < 85) {
    return {
      success: false,
      payout: 0,
      rewardNsf: 0,
      reason: "Akurasi di bawah 85% (syarat minimal akurasi adalah 85%)",
    };
  }

  const diffMultiplier =
    difficulty === "hard" ? 2.0 : difficulty === "medium" ? 1.5 : 1.0;
  const baseSpeedNsf = Math.round(wpm * 1.5);
  const accuracyBonus = Math.round(((accuracy - 85) / 15) * 50);
  let baseReward = Math.max(25, Math.round((baseSpeedNsf + accuracyBonus) * diffMultiplier));

  if (isPremium) {
    baseReward = Math.round(baseReward * 1.5);
  }

  let payout = 0;
  if (bet > 0) {
    if (accuracy >= 90 && wpm >= 35) {
      const winMultiplier = isPremium ? 2.5 : 2.0;
      payout = Math.round(bet * winMultiplier);
    } else {
      payout = 0;
    }
  } else {
    payout = baseReward;
  }

  return {
    success: true,
    payout,
    rewardNsf: baseReward,
    reason: "Sukses menyelesaikan balapan ketik!",
  };
}

const raceSessions = new Map();

/**
 * Saves a race session in memory
 * @param {string} raceId
 * @param {Object} data
 */
function saveRaceSession(raceId, data) {
  raceSessions.set(raceId, {
    ...data,
    savedAt: Date.now(),
  });

  const timer = setTimeout(() => {
    raceSessions.delete(raceId);
  }, 10 * 60 * 1000);
  if (typeof timer.unref === "function") {
    timer.unref();
  }
}

/**
 * Gets a race session by raceId
 * @param {string} raceId
 * @returns {Object|null}
 */
function getRaceSession(raceId) {
  return raceSessions.get(raceId) || null;
}

/**
 * Marks race session startedAt timestamp
 * @param {string} raceId
 * @returns {Object|null}
 */
function startRaceSession(raceId) {
  const session = raceSessions.get(raceId);
  if (session) {
    session.startedAt = Date.now();
  }
  return session;
}

/**
 * Deletes a race session
 * @param {string} raceId
 */
function deleteRaceSession(raceId) {
  raceSessions.delete(raceId);
}

module.exports = {
  QUOTES_BANK,
  getRandomQuote,
  calculateWPM,
  calculateAccuracy,
  calculateNetWPM,
  isWithinTimeLimit,
  calculateReward,
  saveRaceSession,
  getRaceSession,
  startRaceSession,
  deleteRaceSession,
};
