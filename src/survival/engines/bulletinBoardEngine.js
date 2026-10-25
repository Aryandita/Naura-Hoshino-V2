"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const MAX_BULLETINS = 30;

class BulletinBoardEngine {
  static async postBulletin(guildId, bulletin) {
    try {
      const key = `bulletin_board:${guildId}`;
      const existing = await redisManager.lrange(key, 0, -1);
      if (existing && existing.length >= MAX_BULLETINS) {
        return { ok: false, reason: "BOARD_FULL" };
      }

      const entry = {
        id: `bull_${Date.now()}`,
        guildId,
        authorId: bulletin.authorId,
        authorName: bulletin.authorName || "Anonim",
        type: bulletin.type || "general",
        title: (bulletin.title || "").substring(0, 80),
        content: (bulletin.content || "").substring(0, 500),
        createdAt: Date.now(),
      };

      await redisManager.lpush(key, JSON.stringify(entry));
      logger.info(`[BulletinBoard] Posted in ${guildId}: "${entry.title}"`);
      return { ok: true, id: entry.id };
    } catch (error) {
      logger.error(`[BulletinBoard] Post error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async getBulletins(guildId, options = {}) {
    try {
      const key = `bulletin_board:${guildId}`;
      const rawList = await redisManager.lrange(key, 0, -1);
      let bulletins = rawList.map((r) => JSON.parse(r)).filter(Boolean);

      if (options.type) bulletins = bulletins.filter((b) => b.type === options.type);

      const page = Math.max(1, options.page || 1);
      const limit = Math.min(20, options.limit || 10);
      const start = (page - 1) * limit;

      return { bulletins: bulletins.slice(start, start + limit), total: bulletins.length };
    } catch (error) {
      logger.error(`[BulletinBoard] Get error:`, error);
      return { bulletins: [], total: 0 };
    }
  }

  static async deleteBulletin(guildId, bulletinId, requesterId) {
    try {
      const key = `bulletin_board:${guildId}`;
      const rawList = await redisManager.lrange(key, 0, -1);
      const filtered = rawList.filter((raw) => {
        const b = JSON.parse(raw);
        return b.id !== bulletinId || b.authorId !== requesterId;
      });

      await redisManager.del(key);
      for (const item of filtered.reverse()) {
        await redisManager.lpush(key, item);
      }
      return { ok: true };
    } catch (error) {
      logger.error(`[BulletinBoard] Delete error:`, error);
      return { ok: false };
    }
  }
}

module.exports = { BulletinBoardEngine, MAX_BULLETINS };
