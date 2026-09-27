"use strict";

/**
 * @file trafficMonitor.js
 * @description Pemantau lalu lintas perintah per jam dan visualisasi lonjakan batas laju (Rate Limit Spikes).
 */

class TrafficMonitor {
  constructor() {
    // Key format: 'YYYY-MM-DD-HH'
    this.hourlyBuckets = new Map();
    this.MAX_HOURS = 48; // Simpan data hingga 48 jam ke belakang
  }

  _getCurrentHourKey(timestamp = Date.now()) {
    const d = new Date(timestamp);
    const year = d.getUTCFullYear();
    const month = String(d.getUTCMonth() + 1).padStart(2, "0");
    const day = String(d.getUTCDate()).padStart(2, "0");
    const hour = String(d.getUTCHours()).padStart(2, "0");
    return `${year}-${month}-${day}-${hour}`;
  }

  _getBucket(hourKey) {
    if (!this.hourlyBuckets.has(hourKey)) {
      this.hourlyBuckets.set(hourKey, {
        hourKey,
        totalCommands: 0,
        rateLimitSpikes: 0,
        commands: {},
        users: new Set(),
      });
      this._pruneOldBuckets();
    }
    return this.hourlyBuckets.get(hourKey);
  }

  _pruneOldBuckets() {
    if (this.hourlyBuckets.size > this.MAX_HOURS) {
      const sortedKeys = Array.from(this.hourlyBuckets.keys()).sort();
      while (sortedKeys.length > this.MAX_HOURS) {
        const oldestKey = sortedKeys.shift();
        this.hourlyBuckets.delete(oldestKey);
      }
    }
  }

  /**
   * Catat pemanggilan perintah bot
   * @param {string} commandName
   * @param {string} [userId]
   */
  recordCommand(commandName, userId = null) {
    if (!commandName) return;
    const hourKey = this._getCurrentHourKey();
    const bucket = this._getBucket(hourKey);

    bucket.totalCommands++;
    bucket.commands[commandName] = (bucket.commands[commandName] || 0) + 1;
    if (userId) {
      bucket.users.add(userId);
    }
  }

  /**
   * Catat lonjakan pembatasan laju (rate limit hit)
   * @param {string} commandName
   * @param {string} [userId]
   */
  recordRateLimitSpike(commandName, userId = null) {
    const hourKey = this._getCurrentHourKey();
    const bucket = this._getBucket(hourKey);

    bucket.rateLimitSpikes++;
    if (userId) {
      bucket.users.add(userId);
    }
  }

  /**
   * Ambil data lalu lintas n jam terakhir
   * @param {number} [hours=24]
   * @returns {Array<object>}
   */
  getHourlyTraffic(hours = 24) {
    const result = [];
    const now = Date.now();
    const count = Math.min(hours, this.MAX_HOURS);

    for (let i = count - 1; i >= 0; i--) {
      const targetTime = now - i * 3600 * 1000;
      const hourKey = this._getCurrentHourKey(targetTime);
      const bucket = this.hourlyBuckets.get(hourKey);

      result.push({
        hour: hourKey,
        timestamp: targetTime,
        commands: bucket ? bucket.totalCommands : 0,
        rateLimitSpikes: bucket ? bucket.rateLimitSpikes : 0,
        uniqueUsers: bucket ? bucket.users.size : 0,
        topCommand: bucket ? this._getTopCommand(bucket.commands) : null,
      });
    }

    return result;
  }

  _getTopCommand(cmdMap) {
    if (!cmdMap || Object.keys(cmdMap).length === 0) return null;
    let topName = null;
    let topCount = 0;
    for (const [name, count] of Object.entries(cmdMap)) {
      if (count > topCount) {
        topCount = count;
        topName = name;
      }
    }
    return { name: topName, count: topCount };
  }

  /**
   * Ringkasan performa lalu lintas untuk dasbor admin
   */
  getSummary() {
    const hourlyData = this.getHourlyTraffic(24);
    let totalCommands24h = 0;
    let totalSpikes24h = 0;
    let peakCommands = 0;
    let peakHour = null;

    for (const h of hourlyData) {
      totalCommands24h += h.commands;
      totalSpikes24h += h.rateLimitSpikes;
      if (h.commands > peakCommands) {
        peakCommands = h.commands;
        peakHour = h.hour;
      }
    }

    return {
      totalCommands24h,
      totalSpikes24h,
      peakHour: peakHour || "N/A",
      peakCommands,
      hourlyData,
    };
  }
}

const trafficMonitor = new TrafficMonitor();

module.exports = trafficMonitor;
