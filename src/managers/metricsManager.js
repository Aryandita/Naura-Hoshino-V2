"use strict";

const redisManager = require("./redisManager");

class MetricsManager {
  /**
   * Catat pemakaian slash command ke Redis (tersentralisasi).
   * @param {string} commandName Nama command
   */
  logCommand(commandName) {
    try {
      if (redisManager.client?.isReady) {
        redisManager.client.hincrby("metrics:commands", commandName, 1);
        redisManager.client.hincrby("metrics:commands", "total", 1);
      }
    } catch {}
  }

  /**
   * Catat pemakaian komponen (tombol, select, modal) ke Redis.
   * @param {string} componentName Nama komponen
   */
  logComponent(componentName) {
    try {
      if (redisManager.client?.isReady) {
        redisManager.client.hincrby(
          "metrics:components",
          componentName || "unknown",
          1,
        );
        redisManager.client.hincrby("metrics:components", "total", 1);
      }
    } catch {}
  }

  /**
   * Ambil data metrik saat ini.
   */
  async getMetrics() {
    if (!redisManager.client?.isReady) return null;

    try {
      const [commands, components] = await Promise.all([
        redisManager.client.hgetall("metrics:commands"),
        redisManager.client.hgetall("metrics:components"),
      ]);
      return { commands, components };
    } catch {
      return null;
    }
  }
}

module.exports = new MetricsManager();
