"use strict";

/** Ubah milidetik uptime menjadi teks singkat yang ramah dibaca. */
function formatUptime(ms) {
  if (!ms || ms < 60000) return "Baru saja mulai";

  let totalSeconds = ms / 1000;
  const days = Math.floor(totalSeconds / 86400);
  totalSeconds %= 86400;
  const hours = Math.floor(totalSeconds / 3600);
  totalSeconds %= 3600;
  const minutes = Math.floor(totalSeconds / 60);

  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

/** Ringkasan pemakaian RAM host untuk kartu statistik. */
function formatMemory(os) {
  const total = os.totalmem();
  const used = total - os.freemem();
  return {
    usedBytes: used,
    totalBytes: total,
    usedGb: (used / 1024 / 1024 / 1024).toFixed(2),
    totalGb: (total / 1024 / 1024 / 1024).toFixed(2),
    percent: total > 0 ? Math.round((used / total) * 100) : 0,
  };
}

module.exports = { formatUptime, formatMemory };
