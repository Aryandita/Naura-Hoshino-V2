// Lokasi: src/domain/decisions/levelingDecisions.js
// Implementasi Law 5: Separate decisions from actions & Law 2: Name things by meaning
// Mesin kalkulasi murni (pure function) untuk leveling & perolehan experience tanpa I/O.

"use strict";

/**
 * Menghitung total XP yang dibutuhkan untuk naik dari suatu level ke level berikutnya
 * @param {number} level Level saat ini (bilangan bulat positif)
 * @returns {number}
 */
function calculateRequiredXpForNextLevel(level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  return Math.floor(5 * Math.pow(safeLevel, 2) + 50 * safeLevel + 100);
}

/**
 * Mengevaluasi keputusan penambahan XP dan kenaikan level secara deterministik
 * @param {{
 *   currentXp: number,
 *   currentLevel: number,
 *   gainedXp: number,
 *   maxLevel?: number
 * }} params
 * @returns {{
 *   resultingXp: number,
 *   resultingLevel: number,
 *   levelsGained: number,
 *   didLevelUp: boolean,
 *   skillPointsEarned: number,
 *   rewardCoins: number,
 *   unlockedTitle: string|null
 * }}
 */
function evaluateExperienceGain({
  currentXp,
  currentLevel,
  gainedXp,
  maxLevel = 1000,
}) {
  const safeCurrentXp = Math.max(0, Math.floor(Number(currentXp) || 0));
  let evaluatedLevel = Math.max(1, Math.floor(Number(currentLevel) || 1));
  const safeGainedXp = Math.max(0, Math.floor(Number(gainedXp) || 0));

  let accumulatedXp = safeCurrentXp + safeGainedXp;
  let levelsGained = 0;
  let skillPointsEarned = 0;
  let rewardCoins = 0;

  while (evaluatedLevel < maxLevel) {
    const requiredXp = calculateRequiredXpForNextLevel(evaluatedLevel);
    if (accumulatedXp < requiredXp) {
      break;
    }
    accumulatedXp -= requiredXp;
    evaluatedLevel += 1;
    levelsGained += 1;
    skillPointsEarned += 2;
    rewardCoins += evaluatedLevel * 50;
  }

  let unlockedTitle = null;
  if (evaluatedLevel >= 100) unlockedTitle = "Legenda Abadi";
  else if (evaluatedLevel >= 50) unlockedTitle = "Pahlawan Senior";
  else if (evaluatedLevel >= 25) unlockedTitle = "Petualang Tangguh";
  else if (evaluatedLevel >= 10) unlockedTitle = "Pengembara Berbakat";

  return Object.freeze({
    resultingXp: accumulatedXp,
    resultingLevel: evaluatedLevel,
    levelsGained,
    didLevelUp: levelsGained > 0,
    skillPointsEarned,
    rewardCoins,
    unlockedTitle,
  });
}

/**
 * Menghitung batas maksimum atribut pemain berdasarkan level
 * @param {'health'|'stamina'|'defense'} statKind
 * @param {number} level
 * @returns {number}
 */
function calculateStatCap(statKind, level) {
  const safeLevel = Math.max(1, Math.floor(Number(level) || 1));
  switch (statKind) {
    case "health":
      return 100 + (safeLevel - 1) * 10;
    case "stamina":
      return 100 + (safeLevel - 1) * 5;
    case "defense":
      return 10 + Math.floor((safeLevel - 1) * 1.5);
    default:
      return 100;
  }
}

module.exports = {
  calculateRequiredXpForNextLevel,
  evaluateExperienceGain,
  calculateStatCap,
};
