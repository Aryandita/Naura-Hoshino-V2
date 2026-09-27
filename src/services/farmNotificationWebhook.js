"use strict";

/**
 * @file farmNotificationWebhook.js
 * @description Layanan pengelolaan endpoint webhook pengguna untuk notifikasi panen tanaman greenhouse.
 */

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");
const webhookDispatcher = require("./webhookDispatcher");

// In-memory fallback untuk preferensi webhook bila Redis offline
const inMemoryWebhooks = new Map();
const inMemoryNotifiedSlots = new Set();

class FarmNotificationWebhook {
  /**
   * Daftarkan atau perbarui webhook URL untuk pengguna
   * @param {string} userId
   * @param {string} webhookUrl
   * @returns {Promise<{ success: boolean, message?: string }>}
   */
  async setWebhook(userId, webhookUrl) {
    if (!userId) return { success: false, message: "User ID tidak valid." };

    if (
      !webhookUrl ||
      typeof webhookUrl !== "string" ||
      (!webhookUrl.startsWith("http://") && !webhookUrl.startsWith("https://"))
    ) {
      return {
        success: false,
        message: "URL webhook tidak valid. Pastikan diawali http:// atau https://.",
      };
    }

    const key = `farm:webhook:${userId}`;
    if (redisManager && redisManager.isReady) {
      await redisManager.setCache(key, webhookUrl, 30 * 24 * 3600); // 30 hari
    }
    inMemoryWebhooks.set(userId, webhookUrl);

    logger.info(`[FarmWebhook] Webhook notifikasi disimpan untuk user ${userId}`);
    return { success: true };
  }

  /**
   * Ambil webhook URL aktif pengguna
   * @param {string} userId
   * @returns {Promise<string|null>}
   */
  async getWebhook(userId) {
    if (!userId) return null;
    const key = `farm:webhook:${userId}`;
    if (redisManager && redisManager.isReady) {
      const cached = await redisManager.getCache(key);
      if (cached) return cached;
    }
    return inMemoryWebhooks.get(userId) || null;
  }

  /**
   * Hapus webhook notifikasi pengguna
   * @param {string} userId
   * @returns {Promise<boolean>}
   */
  async deleteWebhook(userId) {
    if (!userId) return false;
    const key = `farm:webhook:${userId}`;
    if (redisManager && redisManager.isReady) {
      await redisManager.deleteCache(key);
    }
    inMemoryWebhooks.delete(userId);
    return true;
  }

  /**
   * Periksa kematangan tanaman dan kirim notifikasi jika ada yang siap dipanen
   * @param {string} userId
   * @param {object} greenhouseData
   * @returns {Promise<{ dispatched: boolean, readyCount: number }>}
   */
  async checkAndNotifyHarvest(userId, greenhouseData) {
    if (!userId || !greenhouseData || !Array.isArray(greenhouseData.slots)) {
      return { dispatched: false, readyCount: 0 };
    }

    const webhookUrl = await this.getWebhook(userId);
    if (!webhookUrl) {
      return { dispatched: false, readyCount: 0 };
    }

    const readyCrops = [];

    for (const slot of greenhouseData.slots) {
      if (slot && slot.cropState === "ready") {
        const slotKey = `${userId}:${slot.slotIndex}:${slot.plantedAt}`;
        // Periksa apakah slot ini sudah pernah dikirimkan notifikasinya
        if (!inMemoryNotifiedSlots.has(slotKey)) {
          readyCrops.push({
            slotIndex: slot.slotIndex,
            seedId: slot.seedId,
            seedName: slot.seedName,
            plantedAt: slot.plantedAt,
          });
          inMemoryNotifiedSlots.add(slotKey);
        }
      }
    }

    if (readyCrops.length === 0) {
      return { dispatched: false, readyCount: 0 };
    }

    const payload = {
      userId,
      event: "farm.harvest_ready",
      readyCount: readyCrops.length,
      crops: readyCrops,
      timestamp: new Date().toISOString(),
      message: `🌾 ${readyCrops.length} tanaman di greenhouse kamu telah matang dan siap dipanen!`,
    };

    const success = await webhookDispatcher.dispatch(
      webhookUrl,
      "farm.harvest_ready",
      payload,
    );

    return { dispatched: success, readyCount: readyCrops.length };
  }
}

const farmNotificationWebhook = new FarmNotificationWebhook();

module.exports = farmNotificationWebhook;
