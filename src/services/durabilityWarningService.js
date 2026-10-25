"use strict";

const { logger } = require("../managers/logger");
const cacheManager = require("../managers/cacheManager");

const DURABILITY_WARNING_THRESHOLD = 20;
const DURABILITY_CRITICAL_THRESHOLD = 10;
const WARNING_COOLDOWN_MS = 3600000;

class DurabilityWarningService {
  constructor() {
    this.warningTimestamps = new Map();
  }

  /**
   * Memeriksa semua equipment pemain dan kirim warning jika durability rendah
   * @param {string} userId
   * @returns {Promise<{ warnings: Array, criticalItems: Array }>}
   */
  async checkAndWarn(userId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      if (!profile) return { warnings: [], criticalItems: [] };

      const { safeParseInventory } = require("../survival/engines/inventoryHelper");
      const inventory = safeParseInventory(profile.inventory);

      const warnings = [];
      const criticalItems = [];
      const now = Date.now();

      for (const item of inventory) {
        if (!item || item.durability === undefined) continue;

        const dur = Number(item.durability);
        const maxDur = Number(item.maxDurability || 100);
        const percent = maxDur > 0 ? Math.round((dur / maxDur) * 100) : dur;

        if (percent <= DURABILITY_CRITICAL_THRESHOLD) {
          criticalItems.push({ ...item, durabilityPercent: percent });
        } else if (percent <= DURABILITY_WARNING_THRESHOLD) {
          warnings.push({ ...item, durabilityPercent: percent });
        }
      }

      const shouldNotify = this._shouldSendWarning(userId, now);
      if (shouldNotify && (warnings.length > 0 || criticalItems.length > 0)) {
        this.warningTimestamps.set(userId, now);
        logger.info(`[DurabilityWarning] User ${userId}: ${warnings.length} warnings, ${criticalItems.length} critical`);
      }

      return { warnings, criticalItems, shouldNotify };
    } catch (error) {
      logger.error(`[DurabilityWarning] Error checking for user ${userId}:`, error);
      return { warnings: [], criticalItems: [], shouldNotify: false };
    }
  }

  /**
   * Membangun pesan notifikasi Components V2 untuk durability warning
   * @param {Array} warnings
   * @param {Array} criticalItems
   * @returns {object}
   */
  static buildWarningMessage(warnings, criticalItems) {
    const lines = [];

    if (criticalItems.length > 0) {
      lines.push("**CRITICAL - Segera Perbaiki!**");
      for (const item of criticalItems.slice(0, 5)) {
        lines.push(`- ${item.name || item.id}: ${item.durabilityPercent}% durability`);
      }
    }

    if (warnings.length > 0) {
      lines.push("\n**WARNING - Durability Rendah**");
      for (const item of warnings.slice(0, 5)) {
        lines.push(`- ${item.name || item.id}: ${item.durabilityPercent}% durability`);
      }
    }

    const color = criticalItems.length > 0 ? 0xFF0000 : 0xFFA500;

    return {
      title: "Durability Equipment Warning",
      description: lines.join("\n"),
      color,
      footer: "Gunakan /survival repair untuk memperbaiki equipment",
    };
  }

  _shouldSendWarning(userId, now) {
    const lastWarning = this.warningTimestamps.get(userId) || 0;
    return now - lastWarning >= WARNING_COOLDOWN_MS;
  }
}

module.exports = { DurabilityWarningService, DURABILITY_WARNING_THRESHOLD, DURABILITY_CRITICAL_THRESHOLD };
