"use strict";

const { logger } = require("../managers/logger");
const redisManager = require("../managers/redisManager");

const AFK_TIMEOUT_MS = 300000;

class AfkDetectorService {
  constructor() {
    this.afkUsers = new Map();
    this.lastActivity = new Map();
  }

  /**
   * Mencatat aktivitas terakhir pengguna
   * @param {string} userId
   */
  recordActivity(userId) {
    this.lastActivity.set(userId, Date.now());
    if (this.afkUsers.has(userId)) {
      this.afkUsers.delete(userId);
      logger.info(`[AFK] User ${userId} returned from AFK`);
    }
  }

  /**
   * Set status AFK manual dengan pesan custom
   * @param {string} userId
   * @param {string} message
   */
  async setAfk(userId, message = "Sedang AFK") {
    const afkData = {
      userId,
      message: message.substring(0, 200),
      since: Date.now(),
    };
    this.afkUsers.set(userId, afkData);

    try {
      await redisManager.set(`afk:${userId}`, JSON.stringify(afkData), "EX", 86400);
    } catch (error) {
      logger.error(`[AFK] Redis set error for ${userId}:`, error);
    }

    logger.info(`[AFK] User ${userId} set AFK: ${message}`);
    return afkData;
  }

  /**
   * Hapus status AFK
   * @param {string} userId
   */
  async removeAfk(userId) {
    this.afkUsers.delete(userId);
    try {
      await redisManager.del(`afk:${userId}`);
    } catch (error) {
      logger.error(`[AFK] Redis del error for ${userId}:`, error);
    }
  }

  /**
   * Memeriksa apakah user sedang AFK
   * @param {string} userId
   * @returns {Promise<{ isAfk: boolean, message?: string, since?: number, duration?: string }>}
   */
  async checkAfk(userId) {
    let afkData = this.afkUsers.get(userId);

    if (!afkData) {
      try {
        const cached = await redisManager.get(`afk:${userId}`);
        if (cached) afkData = JSON.parse(cached);
      } catch (error) {
        logger.error(`[AFK] Redis get error for ${userId}:`, error);
      }
    }

    if (!afkData) {
      const lastActive = this.lastActivity.get(userId);
      if (lastActive && Date.now() - lastActive > AFK_TIMEOUT_MS) {
        return {
          isAfk: true,
          message: "Auto-AFK (tidak aktif 5 menit)",
          since: lastActive + AFK_TIMEOUT_MS,
          duration: this._formatDuration(Date.now() - lastActive - AFK_TIMEOUT_MS),
        };
      }
      return { isAfk: false };
    }

    return {
      isAfk: true,
      message: afkData.message,
      since: afkData.since,
      duration: this._formatDuration(Date.now() - afkData.since),
    };
  }

  /**
   * Generate auto-reply message saat user AFK di-mention
   * @param {string} userId
   * @returns {Promise<string|null>}
   */
  async getAutoReply(userId) {
    const status = await this.checkAfk(userId);
    if (!status.isAfk) return null;
    return `**${userId}** sedang AFK (${status.duration}): ${status.message}`;
  }

  _formatDuration(ms) {
    if (ms < 60000) return `${Math.floor(ms / 1000)}s`;
    if (ms < 3600000) return `${Math.floor(ms / 60000)}m`;
    return `${Math.floor(ms / 3600000)}h ${Math.floor((ms % 3600000) / 60000)}m`;
  }
}

module.exports = { AfkDetectorService, AFK_TIMEOUT_MS };
