"use strict";

const TimeCapsule = require("../models/mongo/TimeCapsule");
const { logger } = require("../managers/logger");

class CapsuleService {
  /**
   * Mengubur Kapsul Waktu baru
   */
  async buryCapsule(
    guildId,
    authorId,
    authorName,
    title,
    message,
    durationMonths = 1,
  ) {
    const code = `cps-${Math.random().toString(36).substring(2, 7)}`;
    const now = new Date();
    const unlockDate = new Date(
      now.getTime() + durationMonths * 30 * 24 * 60 * 60 * 1000,
    );

    const capsule = new TimeCapsule({
      capsuleCode: code,
      guildId,
      authorId,
      authorName,
      title: title.trim().slice(0, 100),
      message: message.trim().slice(0, 1000),
      buryDate: now,
      unlockDate,
      isUnlocked: false,
      participants: [
        {
          userId: authorId,
          username: authorName,
          note: "Pencipta Kapsul",
          timestamp: now,
        },
      ],
    });

    await capsule.save();
    logger.info(
      `[CapsuleService] Kapsul Waktu ${code} ("${title}") dikubur oleh ${authorName} untuk dibuka pada ${unlockDate.toISOString()}`,
    );
    return capsule;
  }

  /**
   * Dapatkan daftar kapsul di server
   */
  async listGuildCapsules(guildId) {
    return await TimeCapsule.find({ guildId })
      .sort({ unlockDate: 1 })
      .limit(10);
  }

  /**
   * Buka kapsul waktu (jika sudah jatuh tempo)
   */
  async openCapsule(guildId, capsuleCode, requesterName) {
    const capsule = await TimeCapsule.findOne({ guildId, capsuleCode });
    if (!capsule) return { success: false, reason: "NOT_FOUND" };

    const now = new Date();
    if (now < capsule.unlockDate && !capsule.isUnlocked) {
      return {
        success: false,
        reason: "LOCKED",
        unlockDate: capsule.unlockDate,
        capsule,
      };
    }

    if (!capsule.isUnlocked) {
      capsule.isUnlocked = true;
      capsule.unlockedAt = now;
      capsule.aiNostalgiaSummary = `Kapsul kenangan "${capsule.title}" yang dikubur oleh ${capsule.authorName} telah melintasi waktu dan kembali dibuka dengan penuh kehangatan di hadapan ${requesterName} dan seluruh kawan server!`;
      await capsule.save();
    }

    return {
      success: true,
      capsule,
    };
  }
}

module.exports = new CapsuleService();
