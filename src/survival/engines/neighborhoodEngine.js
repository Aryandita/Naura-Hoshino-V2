"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");
const redisManager = require("../../managers/redisManager");

const MAX_NEIGHBORS = 8;
const PROJECT_TYPES = ["bridge", "garden", "market_stall", "watchtower", "well"];

class NeighborhoodEngine {
  static async joinNeighborhood(userId, neighborhoodId) {
    try {
      const key = `neighborhood:${neighborhoodId}:members`;
      const members = await redisManager.lrange(key, 0, -1);

      if (members && members.length >= 20) return { ok: false, reason: "NEIGHBORHOOD_FULL" };

      await redisManager.lpush(key, userId);
      await cacheManager.updateUserSurvival(userId, { neighborhoodId });

      logger.info(`[Neighborhood] ${userId} joined ${neighborhoodId}`);
      return { ok: true, memberCount: (members?.length || 0) + 1 };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async proposeProject(neighborhoodId, proposerId, projectType) {
    try {
      if (!PROJECT_TYPES.includes(projectType)) return { ok: false, reason: "INVALID_PROJECT_TYPE" };

      const projectId = `proj_${Date.now()}`;
      const project = {
        id: projectId,
        neighborhoodId,
        proposerId,
        type: projectType,
        contributions: {},
        totalContributed: 0,
        goalAmount: 5000,
        status: "active",
        createdAt: Date.now(),
      };

      await redisManager.set(`community_project:${projectId}`, JSON.stringify(project), "EX", 604800);
      logger.info(`[CommunityProject] ${proposerId} proposed ${projectType} in ${neighborhoodId}`);
      return { ok: true, projectId };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async contributeToProject(projectId, userId, amount) {
    try {
      const raw = await redisManager.get(`community_project:${projectId}`);
      if (!raw) return { ok: false, reason: "PROJECT_NOT_FOUND" };

      const project = JSON.parse(raw);
      if (project.status !== "active") return { ok: false, reason: "PROJECT_INACTIVE" };

      project.contributions[userId] = (project.contributions[userId] || 0) + amount;
      project.totalContributed += amount;

      if (project.totalContributed >= project.goalAmount) {
        project.status = "completed";
        logger.info(`[CommunityProject] Project ${projectId} completed!`);
      }

      await redisManager.set(`community_project:${projectId}`, JSON.stringify(project), "EX", 604800);
      return { ok: true, contributed: amount, total: project.totalContributed, completed: project.status === "completed" };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }
}

module.exports = { NeighborhoodEngine, MAX_NEIGHBORS, PROJECT_TYPES };
