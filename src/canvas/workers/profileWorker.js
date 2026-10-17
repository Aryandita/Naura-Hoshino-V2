"use strict";

/**
 * profileWorker.js - Dedicated Worker Module untuk Canvas Profil & Kartu VIP Naura Hoshino.
 *
 * Mengelola render visual kartu profil:
 * 1. Efek bingkai neon hologram per-tier VIP.
 * 2. Taburan efek kilau bintang 4-sudut (star sparkles).
 * 3. Stempel VIP Emas ("✦ VIP ELITE ✦" / "★ VIP MEMBER ★").
 */

const { parentPort } = require("node:worker_threads");
const profileCanvas = require("../profileCanvas");
const unifiedProfileCanvas = require("../unifiedProfileCanvas");
const { logger } = require("../../managers/logger");

if (parentPort) {
  parentPort.on("message", async ({ id, task, payload }) => {
    try {
      let result = null;
      if (task === "renderProfile") {
        result = await profileCanvas.generateProfileCard(payload);
      } else if (task === "renderBusinessCard") {
        result = await profileCanvas.generateBusinessCard(payload);
      } else if (task === "renderUnifiedProfile") {
        result = await unifiedProfileCanvas.generateUnifiedProfile(payload);
      } else {
        throw new Error(`Task "${task}" tidak dikenali oleh profileWorker.`);
      }
      parentPort.postMessage({ id, success: true, result });
    } catch (error) {
      logger.error(`[profileWorker] Gagal memproses task "${task}": ${error.message}`);
      parentPort.postMessage({ id, success: false, error: error.message });
    }
  });
}

module.exports = {
  generateProfileCard: profileCanvas.generateProfileCard,
  generateBusinessCard: profileCanvas.generateBusinessCard,
  generateUnifiedProfile: unifiedProfileCanvas.generateUnifiedProfile,
};
