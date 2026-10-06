"use strict";

const CardBattleEngine = require("./cardBattleEngine");
const { ValidationError } = require("../errors/DomainError");

const ELEMENTAL_COMBOS = {
  "FIRE+LIGHT": { name: "Supernova Flare", bonusDmg: 250, effect: "TRUE_DAMAGE", desc: "Ledakan kosmik yang menembus seluruh pertahanan lawan!" },
  "LIGHT+FIRE": { name: "Supernova Flare", bonusDmg: 250, effect: "TRUE_DAMAGE", desc: "Ledakan kosmik yang menembus seluruh pertahanan lawan!" },
  "WATER+LIGHT": { name: "Electro-Charged Surge", bonusDmg: 180, effect: "STUN_CHANCE", desc: "Sengatan arus air bermuatan listrik yang mengacaukan ritme musuh." },
  "LIGHT+WATER": { name: "Electro-Charged Surge", bonusDmg: 180, effect: "STUN_CHANCE", desc: "Sengatan arus air bermuatan listrik yang mengacaukan ritme musuh." },
  "FIRE+NATURE": { name: "Inferno Wildfire", bonusDmg: 220, effect: "BURN_DOT", desc: "Kobaran api hutan abadi yang membakar lawan." },
  "NATURE+FIRE": { name: "Inferno Wildfire", bonusDmg: 220, effect: "BURN_DOT", desc: "Kobaran api hutan abadi yang membakar lawan." },
  "WATER+NATURE": { name: "Bloom Revitalization", bonusDmg: 120, effect: "HEAL_SELF", desc: "Pemekaran spora alam yang memulihkan HP petarung." },
  "NATURE+WATER": { name: "Bloom Revitalization", bonusDmg: 120, effect: "HEAL_SELF", desc: "Pemekaran spora alam yang memulihkan HP petarung." },
  "DARK+FIRE": { name: "Abyssal Corrosion", bonusDmg: 200, effect: "DEF_SHRED", desc: "Karat kegelapan yang mengikis pertahanan lawan sebesar 40%." },
  "FIRE+DARK": { name: "Abyssal Corrosion", bonusDmg: 200, effect: "DEF_SHRED", desc: "Karat kegelapan yang mengikis pertahanan lawan sebesar 40%." },
  "DARK+LIGHT": { name: "Cosmic Eclipse", bonusDmg: 300, effect: "CRIT_BOOST", desc: "Penyatuan cahaya dan kegelapan menghasilkan dentuman kosmik masif!" },
  "LIGHT+DARK": { name: "Cosmic Eclipse", bonusDmg: 300, effect: "CRIT_BOOST", desc: "Penyatuan cahaya dan kegelapan menghasilkan dentuman kosmik masif!" },
};

const RANK_TIERS = [
  { name: "Cosmic Master", minElo: 2600, icon: "🌌", color: "#FF77EE" },
  { name: "Diamond", minElo: 2200, icon: "💎", color: "#55FFFF" },
  { name: "Platinum", minElo: 1800, icon: "💠", color: "#55FF55" },
  { name: "Gold", minElo: 1400, icon: "🥇", color: "#FFFF55" },
  { name: "Silver", minElo: 1000, icon: "🥈", color: "#AAAAAA" },
  { name: "Bronze", minElo: 0, icon: "🥉", color: "#AA7744" },
];

class CardBattleV2Engine {
  /**
   * Membuat state pertarungan awal antara dua petarung.
   * @param {Object} p1Data - { userId, username, card }
   * @param {Object} p2Data - { userId, username, card }
   * @returns {Object} Initial battle state
   */
  static initializeBattle(p1Data, p2Data) {
    const p1Card = CardBattleEngine.computeCardStats(p1Data.card);
    const p2Card = CardBattleEngine.computeCardStats(p2Data.card);

    // Initial battle stats
    const p1Fighter = {
      userId: p1Data.userId,
      username: p1Data.username,
      card: p1Card,
      currentHp: p1Card.maxHp,
      maxHp: p1Card.maxHp,
      shield: 0,
      energy: 2,
      maxEnergy: 10,
      comboHistory: [],
      statusEffects: [],
    };

    const p2Fighter = {
      userId: p2Data.userId,
      username: p2Data.username,
      card: p2Card,
      currentHp: p2Card.maxHp,
      maxHp: p2Card.maxHp,
      shield: 0,
      energy: 2,
      maxEnergy: 10,
      comboHistory: [],
      statusEffects: [],
    };

    // Petarung dengan speed lebih tinggi menyerang lebih dulu
    const firstTurnUserId = p1Card.spd >= p2Card.spd ? p1Data.userId : p2Data.userId;

    return {
      id: `battle_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      turn: 1,
      activeUserId: firstTurnUserId,
      fighters: {
        [p1Data.userId]: p1Fighter,
        [p2Data.userId]: p2Fighter,
      },
      combatLogs: [
        `Pertarungan dimulai! ${p1Card.spd >= p2Card.spd ? p1Data.username : p2Data.username} mengambil giliran pertama karena kecepatan lebih unggul (${Math.max(p1Card.spd, p2Card.spd)} vs ${Math.min(p1Card.spd, p2Card.spd)} SPD)!`
      ],
      isFinished: false,
      winnerUserId: null,
    };
  }

  /**
   * Mengeksekusi satu aksi dalam pertarungan giliran.
   * @param {Object} battleState - State pertarungan saat ini
   * @param {string} userId - ID pengguna yang mengambil giliran
   * @param {string} action - 'ATTACK' | 'SKILL' | 'GUARD' | 'BURST'
   * @returns {Object} Updated battle state
   */
  static processAction(battleState, userId, action) {
    if (battleState.isFinished) {
      throw new ValidationError("Pertarungan ini sudah berakhir.");
    }

    if (battleState.activeUserId !== userId) {
      throw new ValidationError("Bukan giliran Anda untuk melangkah.");
    }

    const attacker = battleState.fighters[userId];
    const opponentId = Object.keys(battleState.fighters).find((id) => id !== userId);
    const defender = battleState.fighters[opponentId];

    let actionLog = "";
    let damage = 0;
    let isCrit = false;

    // Reset temporary shield yang tersisa dari giliran sebelumnya milik penyerang
    attacker.shield = 0;

    switch (action) {
      case "GUARD": {
        // Guard menambah shield 35% Def + 15% Max HP dan memberikan 2 Energy
        const shieldGained = Math.round(attacker.card.def * 0.35 + attacker.maxHp * 0.15);
        attacker.shield = shieldGained;
        attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 2);
        actionLog = `🛡️ **${attacker.username}** mengambil posisi siaga bertahan! Memasang perisai **+${shieldGained} Shield** dan memulihkan **+2 Energy**!`;
        attacker.comboHistory.push("GUARD");
        break;
      }

      case "SKILL": {
        const cost = attacker.card.skill.energyCost || 3;
        if (attacker.energy < cost) {
          throw new ValidationError(`Energi tidak cukup untuk Skill! Butuh ${cost} Energy, Anda hanya punya ${attacker.energy}.`);
        }
        attacker.energy -= cost;

        const elMult = CardBattleEngine.getElementMultiplier(attacker.card.skill.element, defender.card.element);
        let rawDmg = attacker.card.atk * (attacker.card.skill.dmgMult || 2.2) - defender.card.def * 0.35;
        rawDmg = Math.max(80, rawDmg) * elMult;

        if (Math.random() < attacker.card.critRate) {
          rawDmg *= 1.5;
          isCrit = true;
        }

        damage = Math.round(rawDmg);
        const damageResult = this.applyDamageWithShield(defender, damage);

        actionLog = `⚡ **${attacker.username}** melepaskan skill **${attacker.card.skill.name}**! Menyebabkan **${damageResult.hpDamage}** DMG ${damageResult.shieldAbsorbed > 0 ? `(${damageResult.shieldAbsorbed} diserap perisai)` : ""} ${isCrit ? "💥 CRITICAL!" : ""}!`;

        // Evaluasi elemental combo dengan aksi sebelumnya
        const comboKey = `${attacker.card.element}+${defender.card.element}`;
        const combo = ELEMENTAL_COMBOS[comboKey];
        if (combo) {
          const comboDmgResult = this.applyDamageWithShield(defender, combo.bonusDmg);
          actionLog += `\n✨ **Combo Reaksi: ${combo.name}!** Menyebabkan tambahan **${comboDmgResult.hpDamage}** True DMG!`;
        }

        attacker.comboHistory.push(attacker.card.skill.element);
        break;
      }

      case "BURST": {
        const burstCost = 5;
        if (attacker.energy < burstCost) {
          throw new ValidationError(`Energi tidak cukup untuk Ultimate Burst! Butuh ${burstCost} Energy, Anda hanya punya ${attacker.energy}.`);
        }
        attacker.energy -= burstCost;

        const elMult = CardBattleEngine.getElementMultiplier(attacker.card.element, defender.card.element);
        let rawDmg = attacker.card.atk * 3.5 - defender.card.def * 0.2;
        rawDmg = Math.max(200, rawDmg) * elMult;

        damage = Math.round(rawDmg * 1.3);
        const damageResult = this.applyDamageWithShield(defender, damage);

        actionLog = `🌌 **${attacker.username}** MEMICU AWAKENING ULTIMATE BURST! Aura kosmik meledak dan menghancurkan pertahanan musuh sebesar **${damageResult.hpDamage}** DMG ${damageResult.shieldAbsorbed > 0 ? `(${damageResult.shieldAbsorbed} perisai hancur)` : ""}!`;
        attacker.comboHistory.push("BURST");
        break;
      }

      case "ATTACK":
      default: {
        // Serangan biasa menambah +1 Energy
        attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 1);

        const elMult = CardBattleEngine.getElementMultiplier(attacker.card.element, defender.card.element);
        let rawDmg = attacker.card.atk - defender.card.def * 0.45;
        rawDmg = Math.max(50, rawDmg) * elMult;

        if (Math.random() < attacker.card.critRate) {
          rawDmg *= 1.5;
          isCrit = true;
        }

        damage = Math.round(rawDmg);
        const damageResult = this.applyDamageWithShield(defender, damage);

        actionLog = `⚔️ **${attacker.username}** menyerang dengan pukulan ${attacker.card.elementEmoji} sebesar **${damageResult.hpDamage}** DMG ${damageResult.shieldAbsorbed > 0 ? `(${damageResult.shieldAbsorbed} tertahan perisai)` : ""} ${isCrit ? "💥 CRITICAL!" : ""}!`;
        attacker.comboHistory.push(attacker.card.element);
        break;
      }
    }

    battleState.combatLogs.push(actionLog);

    // Cek apakah defender tumbang
    if (defender.currentHp <= 0) {
      defender.currentHp = 0;
      battleState.isFinished = true;
      battleState.winnerUserId = userId;
      battleState.combatLogs.push(`🏆 **${attacker.username}** berhasil menumbangkan **${defender.username}** dan memenangkan duel!`);
      return battleState;
    }

    // Ganti giliran ke defender
    battleState.activeUserId = opponentId;
    battleState.turn += 1;

    // Setiap awal giliran baru, petarung yang giliran mendapatkan regenerasi +1 Energy secara pasif
    defender.energy = Math.min(defender.maxEnergy, defender.energy + 1);

    return battleState;
  }

  /**
   * Menghitung penyerapan shield terhadap damage yang masuk.
   * @param {Object} target - Petarung target
   * @param {number} rawDamage - Total damage sebelum shield
   * @returns {Object} { hpDamage, shieldAbsorbed }
   */
  static applyDamageWithShield(target, rawDamage) {
    let shieldAbsorbed = 0;
    let hpDamage = rawDamage;

    if (target.shield > 0) {
      if (target.shield >= rawDamage) {
        shieldAbsorbed = rawDamage;
        target.shield -= rawDamage;
        hpDamage = 0;
      } else {
        shieldAbsorbed = target.shield;
        hpDamage = rawDamage - target.shield;
        target.shield = 0;
      }
    }

    target.currentHp = Math.max(0, target.currentHp - hpDamage);
    return { hpDamage, shieldAbsorbed };
  }

  /**
   * Menghitung penyesuaian rating Elo pasca pertempuran.
   * @param {number} winnerElo - Elo pemenang
   * @param {number} loserElo - Elo yang kalah
   * @param {number} kFactor - Konstanta bobot (default: 32)
   * @returns {Object} { winnerNewElo, loserNewElo, winnerDelta, loserDelta }
   */
  static calculateElo(winnerElo, loserElo, kFactor = 32) {
    const expectedWinner = 1 / (1 + Math.pow(10, (loserElo - winnerElo) / 400));
    const expectedLoser = 1 / (1 + Math.pow(10, (winnerElo - loserElo) / 400));

    const winnerDelta = Math.max(10, Math.round(kFactor * (1 - expectedWinner)));
    const loserDelta = Math.max(8, Math.round(kFactor * expectedLoser));

    return {
      winnerNewElo: winnerElo + winnerDelta,
      loserNewElo: Math.max(0, loserElo - loserDelta),
      winnerDelta,
      loserDelta,
    };
  }

  /**
   * Menentukan Tier Divisi berdasarkan skor Elo.
   * @param {number} elo - Nilai Elo pengguna
   * @returns {Object} Tier rank metadata
   */
  static getRankTier(elo) {
    const validElo = Math.max(0, Number(elo) || 0);
    return RANK_TIERS.find((t) => validElo >= t.minElo) || RANK_TIERS[RANK_TIERS.length - 1];
  }
}

module.exports = CardBattleV2Engine;
