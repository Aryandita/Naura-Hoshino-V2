"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const DEFAULT_RESPAWN_TIMES = {
  mining_node: 1800000,
  forest_node: 1200000,
  fishing_spot: 900000,
  herb_patch: 600000,
  rare_node: 7200000,
};

class ResourceRespawnEngine {
  /**
   * Menandai node sebagai habis dan memulai timer respawn
   * @param {string} guildId
   * @param {string} nodeId
   * @param {string} nodeType
   * @returns {Promise<{ ok: boolean, respawnAt: number }>}
   */
  static async depleteNode(guildId, nodeId, nodeType) {
    try {
      const respawnTime = DEFAULT_RESPAWN_TIMES[nodeType] || DEFAULT_RESPAWN_TIMES.mining_node;
      const respawnAt = Date.now() + respawnTime;

      const key = `resource_node:${guildId}:${nodeId}`;
      const data = {
        nodeId,
        nodeType,
        depletedAt: Date.now(),
        respawnAt,
        status: "depleted",
      };

      await redisManager.set(key, JSON.stringify(data), "EX", Math.ceil(respawnTime / 1000) + 300);

      logger.info(`[ResourceRespawn] Node ${nodeId} (${nodeType}) depleted, respawns at ${new Date(respawnAt).toISOString()}`);
      return { ok: true, respawnAt };
    } catch (error) {
      logger.error(`[ResourceRespawn] Deplete error for node ${nodeId}:`, error);
      return { ok: false, respawnAt: 0 };
    }
  }

  /**
   * Memeriksa status node resource
   * @param {string} guildId
   * @param {string} nodeId
   * @returns {Promise<{ available: boolean, respawnIn?: string, nodeType?: string }>}
   */
  static async checkNodeStatus(guildId, nodeId) {
    try {
      const key = `resource_node:${guildId}:${nodeId}`;
      const raw = await redisManager.get(key);

      if (!raw) {
        return { available: true };
      }

      const data = JSON.parse(raw);
      const now = Date.now();

      if (now >= data.respawnAt) {
        await redisManager.del(key);
        return { available: true };
      }

      return {
        available: false,
        respawnIn: this._formatTimeRemaining(data.respawnAt - now),
        respawnAt: data.respawnAt,
        nodeType: data.nodeType,
      };
    } catch (error) {
      logger.error(`[ResourceRespawn] Check error for node ${nodeId}:`, error);
      return { available: true };
    }
  }

  /**
   * Mendapatkan semua node yang siap di-respawn (untuk notifikasi)
   * @param {string} guildId
   * @param {Array<string>} nodeIds
   * @returns {Promise<Array>}
   */
  static async getReadyNodes(guildId, nodeIds = []) {
    try {
      const readyNodes = [];
      const now = Date.now();

      for (const nodeId of nodeIds) {
        const key = `resource_node:${guildId}:${nodeId}`;
        const raw = await redisManager.get(key);

        if (!raw) {
          readyNodes.push({ nodeId, status: "available" });
          continue;
        }

        const data = JSON.parse(raw);
        if (now >= data.respawnAt) {
          await redisManager.del(key);
          readyNodes.push({ nodeId, status: "just_respawned", nodeType: data.nodeType });
        } else {
          readyNodes.push({
            nodeId,
            status: "depleted",
            respawnIn: this._formatTimeRemaining(data.respawnAt - now),
            nodeType: data.nodeType,
          });
        }
      }

      return readyNodes;
    } catch (error) {
      logger.error(`[ResourceRespawn] GetReady error for guild ${guildId}:`, error);
      return [];
    }
  }

  static _formatTimeRemaining(ms) {
    if (ms <= 0) return "Ready";
    const minutes = Math.ceil(ms / 60000);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h ${minutes % 60}m`;
  }

  static getRespawnTimes() {
    return { ...DEFAULT_RESPAWN_TIMES };
  }
}

module.exports = { ResourceRespawnEngine, DEFAULT_RESPAWN_TIMES };
