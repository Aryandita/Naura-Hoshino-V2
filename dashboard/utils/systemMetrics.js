"use strict";

let lastCpuUsage = process.cpuUsage();
let lastCpuTime = Date.now();
let lastLoopTime = Date.now();
let measuredLag = 2;

// Watchdog event loop lag
const lagInterval = setInterval(() => {
  const now = Date.now();
  measuredLag = Math.max(1, now - lastLoopTime - 1000);
  lastLoopTime = now;
}, 1000);
if (lagInterval.unref) lagInterval.unref();

function getCpuPercent() {
  const now = Date.now();
  const elapsedMs = Math.max(1, now - lastCpuTime);
  const diff = process.cpuUsage(lastCpuUsage);
  lastCpuTime = now;
  lastCpuUsage = process.cpuUsage();
  const totalMicros = diff.user + diff.system;
  // Rasio penggunaan terhadap durasi waktu (1 CPU core = elapsedMs * 1000 µs)
  const percent = Math.min(100, Math.max(1, Math.round((totalMicros / (elapsedMs * 1000)) * 100)));
  return percent;
}

const toMB = (bytes) => Math.round(bytes / 1048576);

function getRamUsageMB() {
  return toMB(process.memoryUsage().rss);
}

function getEventLoopLag() {
  return measuredLag;
}

function getSystemMetrics() {
  const mem = process.memoryUsage();
  return {
    cpuPercent: getCpuPercent(),
    ramUsageMB: toMB(mem.rss),
    heapUsedMB: toMB(mem.heapUsed),
    eventLoopLag: measuredLag,
  };
}

module.exports = {
  getCpuPercent,
  getRamUsageMB,
  getEventLoopLag,
  getSystemMetrics,
};
