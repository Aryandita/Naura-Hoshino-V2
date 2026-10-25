"use strict";

const ModerationAppeal = require("../models/ModerationAppeal");
const { logger } = require("../managers/logger");

class AppealService {
  async createAppeal(guildId, userId, moderatorId, actionType, reason, appealText) {
    try {
      const existingPending = await ModerationAppeal.findOne({
        where: { guildId, userId, status: "pending" },
      });

      if (existingPending) {
        return { success: false, error: "Kamu sudah memiliki banding yang menunggu review." };
      }

      const appeal = await ModerationAppeal.create({
        guildId,
        userId,
        moderatorId,
        actionType,
        reason,
        appealText,
        status: "pending",
      });

      logger.info(`[Appeal] New appeal created: ID ${appeal.id} by user ${userId} in guild ${guildId}`);
      return { success: true, appeal };
    } catch (err) {
      logger.error("[Appeal] Failed to create appeal:", err);
      return { success: false, error: "Gagal membuat banding." };
    }
  }

  async getPendingAppeals(guildId) {
    try {
      return await ModerationAppeal.findAll({
        where: { guildId, status: "pending" },
        order: [["createdAt", "ASC"]],
      });
    } catch (err) {
      logger.error("[Appeal] Failed to fetch pending appeals:", err);
      return [];
    }
  }

  async getUserAppeals(userId, guildId = null) {
    try {
      const where = { userId };
      if (guildId) where.guildId = guildId;
      
      return await ModerationAppeal.findAll({
        where,
        order: [["createdAt", "DESC"]],
        limit: 10,
      });
    } catch (err) {
      logger.error("[Appeal] Failed to fetch user appeals:", err);
      return [];
    }
  }

  async resolveAppeal(appealId, reviewerId, status, reviewNote = null) {
    try {
      const appeal = await ModerationAppeal.findByPk(appealId);
      if (!appeal) {
        return { success: false, error: "Banding tidak ditemukan." };
      }

      if (appeal.status !== "pending") {
        return { success: false, error: "Banding ini sudah diproses." };
      }

      appeal.status = status;
      appeal.reviewerId = reviewerId;
      appeal.reviewNote = reviewNote;
      appeal.resolvedAt = new Date();
      await appeal.save();

      logger.info(`[Appeal] Appeal ${appealId} resolved as ${status} by ${reviewerId}`);
      return { success: true, appeal };
    } catch (err) {
      logger.error("[Appeal] Failed to resolve appeal:", err);
      return { success: false, error: "Gagal memproses banding." };
    }
  }

  async getAppealById(appealId) {
    try {
      return await ModerationAppeal.findByPk(appealId);
    } catch (err) {
      logger.error("[Appeal] Failed to fetch appeal:", err);
      return null;
    }
  }
}

module.exports = new AppealService();
