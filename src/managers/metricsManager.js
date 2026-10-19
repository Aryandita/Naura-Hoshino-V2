"use strict";
const { logger } = require("./logger");

const redisManager = require("./redisManager");

class MetricsManager {
  /**
   * Catat pemakaian slash command ke Redis (tersentralisasi).
   * @param {string} commandName Nama command
   */
  logCommand(commandName) {
    try {
      if (redisManager.isReady) {
        redisManager.hIncrBy("metrics:commands", commandName, 1);
        redisManager.hIncrBy("metrics:commands", "total", 1);
      }
    } catch (err) {
      logger.warn("[metricsManager:logCommand] Operasi cache Redis gagal: " + (err?.message || err));
    }
  }

  /**
   * Catat pemakaian komponen (tombol, select, modal) ke Redis.
   * @param {string} componentName Nama komponen
   */
  logComponent(componentName) {
    try {
      if (redisManager.isReady) {
        redisManager.hIncrBy(
          "metrics:components",
          componentName || "unknown",
          1,
        );
        redisManager.hIncrBy("metrics:components", "total", 1);
      }
    } catch (err) {
      logger.warn("[metricsManager:logComponent] Operasi cache Redis gagal: " + (err?.message || err));
    }
  }

  /**
   * Ambil data metrik saat ini.
   */
  async getMetrics() {
    if (!redisManager.isReady) return null;

    try {
      const [commands, components] = await Promise.all([
        redisManager.hGetAll("metrics:commands"),
        redisManager.hGetAll("metrics:components"),
      ]);
      return { commands, components };
    } catch {
      return null;
    }
  }
}

module.exports = new MetricsManager();
