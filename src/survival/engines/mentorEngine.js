"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const MENTOR_MIN_LEVEL = 30;
const MAX_APPRENTICES = 5;
const GRADUATION_LEVEL = 20;

class MentorEngine {
  static async registerMentor(userId) {
    try {
      const profile = await cacheManager.getUserProfile(userId);
      const level = profile?.leveling_level || 0;

      if (level < MENTOR_MIN_LEVEL) {
        return { ok: false, reason: "LEVEL_TOO_LOW", requiredLevel: MENTOR_MIN_LEVEL };
      }

      const existing = await cacheManager.getUserSurvival(userId);
      if (existing?.mentorStatus === "active") {
        return { ok: false, reason: "ALREADY_MENTOR" };
      }

      await cacheManager.updateUserSurvival(userId, { mentorStatus: "active", apprentices: [], teachingPoints: 0 });
      logger.info(`[MentorEngine] ${userId} registered as mentor`);
      return { ok: true };
    } catch (error) {
      logger.error(`[MentorEngine] Register error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async assignApprentice(mentorId, apprenticeId) {
    try {
      if (mentorId === apprenticeId) return { ok: false, reason: "SELF_ASSIGN" };

      const mentorData = await cacheManager.getUserSurvival(mentorId);
      if (!mentorData || mentorData.mentorStatus !== "active") {
        return { ok: false, reason: "NOT_A_MENTOR" };
      }

      const apprentices = mentorData.apprentices || [];
      if (apprentices.length >= MAX_APPRENTICES) {
        return { ok: false, reason: "MAX_APPRENTICES_REACHED" };
      }

      if (apprentices.includes(apprenticeId)) {
        return { ok: false, reason: "ALREADY_APPRENTICE" };
      }

      apprentices.push(apprenticeId);
      await cacheManager.updateUserSurvival(mentorId, { apprentices });
      await cacheManager.updateUserSurvival(apprenticeId, { currentMentor: mentorId });

      logger.info(`[MentorEngine] ${mentorId} took ${apprenticeId} as apprentice`);
      return { ok: true, totalApprentices: apprentices.length };
    } catch (error) {
      logger.error(`[MentorEngine] Assign error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async checkGraduation(apprenticeId) {
    try {
      const profile = await cacheManager.getUserProfile(apprenticeId);
      const level = profile?.leveling_level || 0;

      if (level < GRADUATION_LEVEL) {
        return { graduated: false, currentLevel: level, requiredLevel: GRADUATION_LEVEL };
      }

      const survival = await cacheManager.getUserSurvival(apprenticeId);
      const mentorId = survival?.currentMentor;

      if (mentorId) {
        const mentorData = await cacheManager.getUserSurvival(mentorId);
        if (mentorData) {
          const apprentices = (mentorData.apprentices || []).filter((id) => id !== apprenticeId);
          const newPoints = (mentorData.teachingPoints || 0) + 50;
          await cacheManager.updateUserSurvival(mentorId, { apprentices, teachingPoints: newPoints });
        }
        await cacheManager.updateUserSurvival(apprenticeId, { currentMentor: null, graduationDate: Date.now() });
      }

      logger.info(`[MentorEngine] ${apprenticeId} graduated at level ${level}`);
      return { graduated: true, mentorId, rewardPoints: 50 };
    } catch (error) {
      logger.error(`[MentorEngine] Graduation error:`, error);
      return { graduated: false };
    }
  }

  static async getMentorStatus(userId) {
    try {
      const data = await cacheManager.getUserSurvival(userId);
      return {
        isMentor: data?.mentorStatus === "active",
        apprentices: data?.apprentices || [],
        teachingPoints: data?.teachingPoints || 0,
        currentMentor: data?.currentMentor || null,
      };
    } catch (error) {
      return { isMentor: false, apprentices: [], teachingPoints: 0, currentMentor: null };
    }
  }
}

module.exports = { MentorEngine, MENTOR_MIN_LEVEL, GRADUATION_LEVEL, MAX_APPRENTICES };
