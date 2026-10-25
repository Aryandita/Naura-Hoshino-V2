"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

class TalentShowEngine {
  static async createShow(guildId, organizerId, showName) {
    try {
      const showId = `show_${Date.now()}`;
      const show = {
        id: showId,
        guildId,
        organizerId,
        name: (showName || "Talent Show").substring(0, 50),
        performers: [],
        votes: {},
        status: "registration",
        createdAt: Date.now(),
      };

      await redisManager.set(`talent_show:${showId}`, JSON.stringify(show), "EX", 86400);
      logger.info(`[TalentShow] Created ${showId} in ${guildId}`);
      return { ok: true, showId };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async registerPerformer(showId, userId, performanceType) {
    try {
      const raw = await redisManager.get(`talent_show:${showId}`);
      if (!raw) return { ok: false, reason: "SHOW_NOT_FOUND" };

      const show = JSON.parse(raw);
      if (show.status !== "registration") return { ok: false, reason: "REGISTRATION_CLOSED" };
      if (show.performers.some((p) => p.userId === userId)) return { ok: false, reason: "ALREADY_REGISTERED" };

      show.performers.push({ userId, performanceType, score: 0, registeredAt: Date.now() });
      await redisManager.set(`talent_show:${showId}`, JSON.stringify(show), "EX", 86400);

      return { ok: true, performerCount: show.performers.length };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async voteForPerformer(showId, voterId, performerUserId, rating) {
    try {
      if (rating < 1 || rating > 10) return { ok: false, reason: "INVALID_RATING" };

      const raw = await redisManager.get(`talent_show:${showId}`);
      if (!raw) return { ok: false, reason: "SHOW_NOT_FOUND" };

      const show = JSON.parse(raw);
      if (show.status !== "live") return { ok: false, reason: "SHOW_NOT_LIVE" };

      const voteKey = `${voterId}:${performerUserId}`;
      if (show.votes[voteKey]) return { ok: false, reason: "ALREADY_VOTED_FOR_THIS_PERFORMER" };

      show.votes[voteKey] = rating;
      const performer = show.performers.find((p) => p.userId === performerUserId);
      if (performer) performer.score += rating;

      await redisManager.set(`talent_show:${showId}`, JSON.stringify(show), "EX", 86400);
      return { ok: true, newScore: performer?.score || 0 };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async getResults(showId) {
    try {
      const raw = await redisManager.get(`talent_show:${showId}`);
      if (!raw) return { ok: false, reason: "SHOW_NOT_FOUND" };

      const show = JSON.parse(raw);
      const ranked = [...show.performers].sort((a, b) => b.score - a.score);

      return { ok: true, rankings: ranked, totalVoters: Object.keys(show.votes).length };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }
}

module.exports = { TalentShowEngine };
