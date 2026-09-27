"use strict";

/**
 * Menghitung jarak Levenshtein antara dua string
 * @param {string} a
 * @param {string} b
 * @returns {number}
 */
function levenshteinDistance(a, b) {
  if (!a || !b) return (a || b || "").length;
  const matrix = [];

  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1,     // insertion
          matrix[i - 1][j] + 1,     // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Mencari perintah terdekat berdasarkan salah ketik (typo)
 * @param {string} query
 * @param {string[]} commandList
 * @param {number} [maxDistance=2]
 * @returns {{ name: string, distance: number } | null}
 */
function findClosestCommand(query, commandList, maxDistance = 2) {
  if (!query || !Array.isArray(commandList) || commandList.length === 0) return null;
  const cleanQuery = query.toLowerCase().trim();

  let closest = null;
  let minDistance = Infinity;

  for (const cmd of commandList) {
    const cleanCmd = cmd.toLowerCase().trim();
    if (cleanCmd === cleanQuery) return { name: cmd, distance: 0 };

    const dist = levenshteinDistance(cleanQuery, cleanCmd);
    if (dist < minDistance && dist <= maxDistance) {
      minDistance = dist;
      closest = cmd;
    }
  }

  return closest ? { name: closest, distance: minDistance } : null;
}

module.exports = {
  levenshteinDistance,
  findClosestCommand,
};
