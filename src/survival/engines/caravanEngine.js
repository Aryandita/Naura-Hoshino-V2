"use strict";

const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const MERCENARY_ROSTER = {
  rookie: {
    id: "rookie",
    name: "Penjaga Pemula",
    cost: 150,
    defenseBonus: 120,
    ambushMitigation: 12,
  },
  veteran: {
    id: "veteran",
    name: "Tentara Bayaran Veteran",
    cost: 400,
    defenseBonus: 280,
    ambushMitigation: 25,
  },
  elite_cyber: {
    id: "elite_cyber",
    name: "Pengawal Elit Cybernetic",
    cost: 900,
    defenseBonus: 650,
    ambushMitigation: 45,
  },
};

const EXPEDITION_MODES = {
  standard: {
    id: "standard",
    name: "Rute Standar Orbit",
    riskPercent: 15,
    profitMultiplier: 1.35,
  },
  high_risk_heist: {
    id: "high_risk_heist",
    name: "Smuggler Run (High-Risk Heist)",
    riskPercent: 50,
    profitMultiplier: 2.5,
  },
  void_chasm: {
    id: "void_chasm",
    name: "Void Chasm (Extreme High-Reward)",
    riskPercent: 75,
    profitMultiplier: 4.2,
  },
};

class CaravanEngine {
  /**
   * Mengambil katalog tentara bayaran
   * @returns {object}
   */
  static getMercenaryRoster() {
    return MERCENARY_ROSTER;
  }

  /**
   * Mengambil seluruh mode rute ekspedisi karavan
   * @returns {object}
   */
  static getExpeditionModes() {
    return EXPEDITION_MODES;
  }

  /**
   * Hitung risiko akhir perjalanan karavan setelah mitigasi pengawal
   * @param {string} modeKey
   * @param {string|null} mercenaryKey
   * @returns {{baseRisk: number, finalRisk: number, mitigation: number, multiplier: number}}
   */
  static calculateCaravanRisk(modeKey = "standard", mercenaryKey = null) {
    const mode = EXPEDITION_MODES[modeKey] || EXPEDITION_MODES.standard;
    const merc = mercenaryKey ? MERCENARY_ROSTER[mercenaryKey] : null;

    const baseRisk = mode.riskPercent;
    const mitigation = merc ? merc.ambushMitigation : 0;
    const finalRisk = Math.max(5, baseRisk - mitigation);

    return {
      baseRisk,
      finalRisk,
      mitigation,
      multiplier: mode.profitMultiplier,
    };
  }

  /**
   * Sewa tentara bayaran untuk karavan secara atomik
   * @param {string} userId
   * @param {string} mercenaryKey
   * @returns {Promise<{success: boolean, mercenary?: object, reason?: string, currentNsf?: number}>}
   */
  static async hireMercenary(userId, mercenaryKey) {
    const merc = MERCENARY_ROSTER[mercenaryKey];
    if (!merc) {
      return { success: false, reason: "INVALID_MERCENARY" };
    }

    const surv = await cacheManager.getUserSurvival(userId);
    const curNsf = surv ? Number(surv.starFragments || 0) : 0;

    if (curNsf < merc.cost) {
      return {
        success: false,
        reason: "INSUFFICIENT_FUNDS",
        required: merc.cost,
        currentNsf: curNsf,
      };
    }

    await cacheManager.debitUserSurvival(userId, "starFragments", merc.cost);
    logger.info(
      `[CaravanEngine] User ${userId} menyewa tentara bayaran ${merc.name} seharga ${merc.cost} SC`,
    );

    return {
      success: true,
      mercenary: merc,
    };
  }

  /**
   * Resolusi pertempuran ambush raid terhadap karavan
   * @param {object} params
   * @param {string} params.modeKey
   * @param {string|null} params.mercenaryKey
   * @param {number} [params.customRoll]
   * @returns {{survived: boolean, wasAmbushed: boolean, lootLossPercent: number, defenseScore: number}}
   */
  static resolveAmbush({ modeKey = "standard", mercenaryKey = null, customRoll = null }) {
    const risk = this.calculateCaravanRisk(modeKey, mercenaryKey);
    const merc = mercenaryKey ? MERCENARY_ROSTER[mercenaryKey] : null;
    const defenseScore = 100 + (merc ? merc.defenseBonus : 0);

    const roll = customRoll !== null ? customRoll : Math.random() * 100;
    const wasAmbushed = roll < risk.finalRisk;

    if (!wasAmbushed) {
      return {
        survived: true,
        wasAmbushed: false,
        lootLossPercent: 0,
        defenseScore,
      };
    }

    const defenseRoll = Math.random() * defenseScore;
    const survived = defenseRoll >= 80;
    const lootLossPercent = survived ? 25 : 70;

    return {
      survived,
      wasAmbushed: true,
      lootLossPercent,
      defenseScore,
    };
  }

  /**
   * Hitung perolehan total NSF hasil ekspedisi karavan
   * @param {number} investedNsf
   * @param {string} modeKey
   * @param {object} ambushResult
   * @returns {{grossProfit: number, netPayout: number, penalty: number}}
   */
  static calculatePayout(investedNsf, modeKey, ambushResult) {
    const mode = EXPEDITION_MODES[modeKey] || EXPEDITION_MODES.standard;
    const initialExpected = Math.floor(investedNsf * mode.profitMultiplier);

    let penalty = 0;
    if (ambushResult.wasAmbushed) {
      penalty = Math.floor(initialExpected * (ambushResult.lootLossPercent / 100));
    }

    const netPayout = Math.max(0, initialExpected - penalty);

    return {
      grossProfit: initialExpected,
      netPayout,
      penalty,
    };
  }
}

module.exports = CaravanEngine;
