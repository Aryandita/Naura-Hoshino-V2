const ui = require("../config/ui");

/**
 * Converts milliseconds to a human-readable time string.
 * @param {number} ms - The number of milliseconds.
 * @returns {string} A string like '1d 2h 3m 4s' or 'Baru saja mulai ✨'.
 */
function msToTime(ms) {
  if (ms < 1000) {
    return `Baru saja mulai ${ui.getEmoji("sparkles") || "✨"}`;
  }

  const s = Math.floor(ms / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  if (seconds > 0 || parts.length === 0) parts.push(`${seconds}s`);

  return parts.join(" ");
}

module.exports = { msToTime };
