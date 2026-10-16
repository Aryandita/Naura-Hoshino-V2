"use strict";

/**
 * Format durasi milidetik ke string pembacaan manusia (mm:ss atau hh:mm:ss).
 * @param {number} ms - Durasi dalam milidetik.
 * @returns {string} String waktu terformat.
 */
const formatDuration = (ms) => {
  if (!ms || isNaN(ms) || ms < 0) return "0:00";
  if (ms >= 8640000000) return "🔴 LIVE";

  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const paddedSeconds = seconds < 10 ? `0${seconds}` : `${seconds}`;

  if (hours > 0) {
    const paddedMinutes = minutes < 10 ? `0${minutes}` : `${minutes}`;
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${minutes}:${paddedSeconds}`;
};

/**
 * Mengurai string timestamp ke satuan milidetik.
 * Mendukung format:
 * - Menit:Detik (cth: "1:30", "01:30")
 * - Jam:Menit:Detik (cth: "01:02:03", "1:15:30")
 * - Detik murni (cth: "90", 90)
 * - Durasi berlabel (cth: "1m30s", "45s", "1h2m3s")
 *
 * @param {string|number} input - Nilai timestamp yang akan diparsing.
 * @returns {number|null} Milidetik hasil parsing atau null jika tidak valid.
 */
const parseTimestampToMs = (input) => {
  if (input === null || input === undefined) return null;

  if (typeof input === "number") {
    if (isNaN(input) || input < 0 || !isFinite(input)) return null;
    return Math.round(input * 1000);
  }

  if (typeof input !== "string") return null;

  const trimmed = input.trim();
  if (!trimmed) return null;

  // 1. Format Colon-Separated (mm:ss atau hh:mm:ss)
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":");
    if (parts.length === 2) {
      const [minStr, secStr] = parts;
      if (!/^\d+$/.test(minStr) || !/^\d+$/.test(secStr)) return null;
      const m = parseInt(minStr, 10);
      const s = parseInt(secStr, 10);
      if (s < 0 || s >= 60 || m < 0) return null;
      return (m * 60 + s) * 1000;
    }

    if (parts.length === 3) {
      const [hrStr, minStr, secStr] = parts;
      if (
        !/^\d+$/.test(hrStr) ||
        !/^\d+$/.test(minStr) ||
        !/^\d+$/.test(secStr)
      ) {
        return null;
      }
      const h = parseInt(hrStr, 10);
      const m = parseInt(minStr, 10);
      const s = parseInt(secStr, 10);
      if (s < 0 || s >= 60 || m < 0 || m >= 60 || h < 0) return null;
      return (h * 3600 + m * 60 + s) * 1000;
    }

    return null;
  }

  // 2. Format Durasi dengan Label Satuan (cth: 1h2m3s, 1m30s, 45s)
  const unitMatch = trimmed.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/i);
  if (
    unitMatch &&
    (unitMatch[1] !== undefined ||
      unitMatch[2] !== undefined ||
      unitMatch[3] !== undefined)
  ) {
    const h = parseInt(unitMatch[1] || "0", 10);
    const m = parseInt(unitMatch[2] || "0", 10);
    const s = parseInt(unitMatch[3] || "0", 10);
    return (h * 3600 + m * 60 + s) * 1000;
  }

  // 3. Format Angka Detik Murni (cth: "90", "120.5")
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const parsed = parseFloat(trimmed);
    if (isNaN(parsed) || parsed < 0) return null;
    return Math.round(parsed * 1000);
  }

  return null;
};

/**
 * Membatasi nilai target seek agar selalu berada di rentang [0, trackLength].
 * @param {number} targetMs - Target posisi dalam milidetik.
 * @param {number} trackLength - Panjang total lagu dalam milidetik.
 * @returns {number} Posisi clamped dalam milidetik.
 */
const clampSeekPosition = (targetMs, trackLength) => {
  const maxLen = Math.max(0, Number(trackLength) || 0);
  const target = Math.max(0, Number(targetMs) || 0);
  return Math.min(target, maxLen);
};

module.exports = {
  formatDuration,
  parseTimestampToMs,
  clampSeekPosition,
};
