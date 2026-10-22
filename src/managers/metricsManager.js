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
   * Catat error per kategori ke Redis hash metrics:errors.
   * Aman saat Redis offline (tidak melempar).
   * @param {string} category Nama singkat kategori error
   */
  logError(category) {
    try {
      if (redisManager.isReady) {
        redisManager.hIncrBy("metrics:errors", category, 1);
        redisManager.hIncrBy("metrics:errors", "total", 1);
      }
    } catch (err) {
      logger.warn("[metricsManager:logError] Operasi cache Redis gagal: " + (err?.message || err));
    }
  }

  /**
   * Ambil snapshot health proses dan Redis (data nyata dari Node API).
   * @returns {{ uptime: number, memory: { rss: number, heapUsed: number, heapTotal: number, usagePercent: number }, pid: number, redis: { connected: boolean } }}
   */
  getHealthSnapshot() {
    const mem = process.memoryUsage();
    const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
    const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
    const usagePct = heapTotalMB > 0 ? Math.round((heapUsedMB / heapTotalMB) * 100) : 0;
    return {
      uptime: process.uptime(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        usagePercent: usagePct,
      },
      pid: process.pid,
      redis: {
        connected: Boolean(redisManager.isReady),
      },
    };
  }

  /**
   * Ambil data metrik saat ini.
   * @returns {Promise<{ commands: object, components: object, errors: object } | null>}
   */
  async getMetrics() {
    if (!redisManager.isReady) return null;

    try {
      const [commands, components, errors] = await Promise.all([
        redisManager.hGetAll("metrics:commands"),
        redisManager.hGetAll("metrics:components"),
        redisManager.hGetAll("metrics:errors"),
      ]);
      return { commands, components, errors };
    } catch {
      return null;
    }
  }
}

module.exports = new MetricsManager();

