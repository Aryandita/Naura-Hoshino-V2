"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const SOCIETIES = [
  { id: "shadow_order", name: "Ordo Bayangan", theme: "stealth", minLevel: 25 },
  { id: "starlight_circle", name: "Lingkaran Cahaya Bintang", theme: "magic", minLevel: 30 },
  { id: "iron_pact", name: "Pakta Besi", theme: "combat", minLevel: 20 },
];

class SecretSocietyEngine {
  static async checkEligibility(userId, societyId) {
    try {
      const society = SOCIETIES.find((s) => s.id === societyId);
      if (!society) return { eligible: false, reason: "SOCIETY_NOT_FOUND" };

      const profile = await cacheManager.getUserProfile(userId);
      const level = profile?.leveling_level || 0;

      if (level < society.minLevel) {
        return { eligible: false, reason: "LEVEL_TOO_LOW", requiredLevel: society.minLevel };
      }

      const survival = await cacheManager.getUserSurvival(userId);
      const societies = survival?.secretSocieties || [];
      if (societies.includes(societyId)) {
        return { eligible: false, reason: "ALREADY_MEMBER" };
      }

      return { eligible: true, society };
    } catch (error) {
      return { eligible: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async initiateMember(userId, societyId) {
    try {
      const check = await this.checkEligibility(userId, societyId);
      if (!check.eligible) return { ok: false, reason: check.reason };

      const survival = await cacheManager.getUserSurvival(userId);
      const societies = survival?.secretSocieties || [];
      societies.push(societyId);

      await cacheManager.updateUserSurvival(userId, { secretSocieties: societies });
      logger.info(`[SecretSociety] ${userId} initiated into ${societyId}`);
      return { ok: true, society: check.society };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static getHiddenQuestClues(societyId) {
    const clues = {
      shadow_order: [
        "Cari bayangan yang bergerak sendiri di perpustakaan tua.",
        "Bisikan di lorong gelap membawa pesan terenkripsi.",
        "Kunci perak hanya muncul saat bulan purnama.",
      ],
      starlight_circle: [
        "Konstelasi Orion menunjuk ke lokasi ritual tersembunyi.",
        "Kristal bintang bersinar hanya di hadapan anggota terpilih.",
        "Manuskrip kuno menyebutkan pintu gerbang dimensi lain.",
      ],
      iron_pact: [
        "Pedang tertancap di batu hanya bisa ditarik oleh yang layak.",
        "Arena bawah tanah menyimpan rahasia para juara terdahulu.",
        "Tanda besi di dinding menandai jalur rahasia.",
      ],
    };
    return clues[societyId] || [];
  }

  static getSocieties() {
    return [...SOCIETIES];
  }
}

module.exports = { SecretSocietyEngine, SOCIETIES };
