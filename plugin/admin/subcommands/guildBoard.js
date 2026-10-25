"use strict";

const { logger } = require("../../../src/managers/logger");
const redisManager = require("../../../src/managers/redisManager");

const MAX_ANNOUNCEMENTS = 20;
const DEFAULT_EXPIRY_MS = 604800000;

class GuildAnnouncementBoard {
  /**
   * Membuat pengumuman baru
   * @param {string} guildId
   * @param {object} announcement - { title, content, authorId, pinned, expiresAt }
   * @returns {Promise<{ ok: boolean, id?: string, reason?: string }>}
   */
  static async createAnnouncement(guildId, announcement) {
    try {
      const id = `ann_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const entry = {
        id,
        title: (announcement.title || "Pengumuman").substring(0, 100),
        content: (announcement.content || "").substring(0, 2000),
        authorId: announcement.authorId || null,
        pinned: announcement.pinned || false,
        createdAt: Date.now(),
        expiresAt: announcement.expiresAt || Date.now() + DEFAULT_EXPIRY_MS,
      };

      const key = `guild_announcements:${guildId}`;
      const existing = await this._getAnnouncements(guildId);

      if (existing.length >= MAX_ANNOUNCEMENTS) {
        const unpinned = existing.filter((a) => !a.pinned);
        if (unpinned.length > 0) {
          const oldest = unpinned[0];
          await this.deleteAnnouncement(guildId, oldest.id);
        } else {
          return { ok: false, reason: "BOARD_FULL_ALL_PINNED" };
        }
      }

      await redisManager.set(`${key}:${id}`, JSON.stringify(entry), "EX", Math.ceil((entry.expiresAt - Date.now()) / 1000));

      const indexKey = `${key}:index`;
      await redisManager.lpush(indexKey, id);

      logger.info(`[GuildBoard] Created announcement ${id} for guild ${guildId}`);
      return { ok: true, id };
    } catch (error) {
      logger.error(`[GuildBoard] Create error for guild ${guildId}:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Mendapatkan daftar pengumuman aktif
   * @param {string} guildId
   * @param {object} options - { page, limit, showExpired }
   * @returns {Promise<Array>}
   */
  static async getAnnouncements(guildId, options = {}) {
    try {
      const all = await this._getAnnouncements(guildId);
      const now = Date.now();

      const filtered = options.showExpired ? all : all.filter((a) => a.expiresAt > now);
      filtered.sort((a, b) => {
        if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
        return b.createdAt - a.createdAt;
      });

      const page = Math.max(1, options.page || 1);
      const limit = Math.min(20, Math.max(1, options.limit || 5));
      const start = (page - 1) * limit;

      return filtered.slice(start, start + limit);
    } catch (error) {
      logger.error(`[GuildBoard] Get error for guild ${guildId}:`, error);
      return [];
    }
  }

  /**
   * Hapus pengumuman
   * @param {string} guildId
   * @param {string} announcementId
   */
  static async deleteAnnouncement(guildId, announcementId) {
    try {
      const key = `guild_announcements:${guildId}:${announcementId}`;
      await redisManager.del(key);
      logger.info(`[GuildBoard] Deleted announcement ${announcementId} from guild ${guildId}`);
      return { ok: true };
    } catch (error) {
      logger.error(`[GuildBoard] Delete error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  /**
   * Toggle pin/unpin pengumuman
   * @param {string} guildId
   * @param {string} announcementId
   * @param {boolean} pinned
   */
  static async setPinned(guildId, announcementId, pinned) {
    try {
      const key = `guild_announcements:${guildId}:${announcementId}`;
      const raw = await redisManager.get(key);
      if (!raw) return { ok: false, reason: "NOT_FOUND" };

      const entry = JSON.parse(raw);
      entry.pinned = pinned;
      const ttl = Math.max(60, Math.ceil((entry.expiresAt - Date.now()) / 1000));
      await redisManager.set(key, JSON.stringify(entry), "EX", ttl);

      return { ok: true, pinned };
    } catch (error) {
      logger.error(`[GuildBoard] Pin error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async _getAnnouncements(guildId) {
    const indexKey = `guild_announcements:${guildId}:index`;
    try {
      const ids = await redisManager.lrange(indexKey, 0, -1);
      if (!ids || ids.length === 0) return [];

      const results = [];
      for (const id of ids) {
        const raw = await redisManager.get(`guild_announcements:${guildId}:${id}`);
        if (raw) results.push(JSON.parse(raw));
      }
      return results;
    } catch (error) {
      logger.error(`[GuildBoard] Fetch error for guild ${guildId}:`, error);
      return [];
    }
  }
}

module.exports = { GuildAnnouncementBoard, MAX_ANNOUNCEMENTS, DEFAULT_EXPIRY_MS };
