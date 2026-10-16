"use strict";

const formatDuration = (ms) => {
  if (!ms || isNaN(ms)) return "0:00";
  if (ms >= 8640000000) return "🔴 LIVE";
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}:${seconds < 10 ? "0" : ""}${seconds}`;
};

module.exports = {
  formatDuration,
};
