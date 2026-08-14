"use strict";

const CardEngine = require("./cardEngine");

const ELEMENT_MULTIPLIERS = {
  FIRE: { NATURE: 1.5, WATER: 0.75, FIRE: 1.0, LIGHT: 1.0, DARK: 1.0 },
  NATURE: { WATER: 1.5, FIRE: 0.75, NATURE: 1.0, LIGHT: 1.0, DARK: 1.0 },
  WATER: { FIRE: 1.5, NATURE: 0.75, WATER: 1.0, LIGHT: 1.0, DARK: 1.0 },
  LIGHT: { DARK: 1.5, LIGHT: 1.0, FIRE: 1.0, WATER: 1.0, NATURE: 1.0 },
  DARK: { LIGHT: 1.5, DARK: 1.0, FIRE: 1.0, WATER: 1.0, NATURE: 1.0 },
};

const ELEMENT_EMOJIS = {
  FIRE: "🔥",
  WATER: "💧",
  NATURE: "🌿",
  LIGHT: "⚡",
  DARK: "🌑",
};

// Base stats by card rarity
const RARITY_BASE_STATS = {
  COMMON: { hp: 1000, atk: 200, def: 100, spd: 100 },
  RARE: { hp: 1400, atk: 300, def: 160, spd: 130 },
  EPIC: { hp: 1800, atk: 420, def: 230, spd: 170 },
  LEGENDARY: { hp: 2400, atk: 550, def: 300, spd: 210 },
  MYTHIC: { hp: 3000, atk: 680, def: 380, spd: 250 },
};

const QUALITY_MULTIPLIERS = {
  GEM_MINT: { statMult: 1.5, critRate: 0.25 },
  EXCELLENT: { statMult: 1.25, critRate: 0.15 },
  GOOD: { statMult: 1.0, critRate: 0.08 },
  POOR: { statMult: 0.8, critRate: 0.02 },
};

// Skill roster for Anime Characters
const CHARACTER_SKILLS = {
  hutao: {
    name: "Ghost Purge",
    element: "FIRE",
    dmgMult: 2.5,
    energyCost: 3,
    lifesteal: 0.25,
    desc: "Serangan api roh mematikan dengan pemulihan HP sebesar 25% dari damage.",
  },
  rem: {
    name: "Morningstar Crush",
    element: "WATER",
    dmgMult: 2.2,
    energyCost: 2,
    defBreak: 0.3,
    desc: "Hantaman bola berduri yang menghancurkan 30% pertahanan musuh.",
  },
  saber: {
    name: "Excalibur Burst",
    element: "LIGHT",
    dmgMult: 3.0,
    energyCost: 4,
    ignoreDef: 0.5,
    desc: "Tebasan pedang cahaya legendaris yang menembus 50% defense lawan.",
  },
  gojo: {
    name: "Infinite Void",
    element: "DARK",
    dmgMult: 2.0,
    energyCost: 3,
    stun: true,
    desc: "Membuka domain tak terbatas yang memberikan stun pada lawan selama 1 giliran.",
  },
  megumin: {
    name: "Explosion Magic",
    element: "FIRE",
    dmgMult: 4.0,
    energyCost: 4,
    selfHpLoss: 0.2,
    desc: "Sihir ledakan pamungkas dengan damage 400% (mengorbankan 20% HP sendiri).",
  },
  kafka: {
    name: "Twilight Web",
    element: "DARK",
    dmgMult: 1.8,
    energyCost: 2,
    dotDmg: 0.3,
    desc: "Jeratan benang beracun yang memberikan damage berkelanjutan selama 2 ronde.",
  },
  raiden: {
    name: "Musou no Hitotachi",
    element: "LIGHT",
    dmgMult: 3.2,
    energyCost: 3,
    critBonus: 0.5,
    desc: "Tebasan petir abadi dengan bonus +50% peluang critical hit.",
  },
  mikasa: {
    name: "Blade Dance",
    element: "NATURE",
    dmgMult: 2.4,
    energyCost: 2,
    desc: "Serangan pedang ganda berturut-turut yang menebas celah pertahanan musuh.",
  },
  frieren: {
    name: "Zoltraak Soul Pierce",
    element: "LIGHT",
    dmgMult: 2.8,
    energyCost: 3,
    desc: "Sihir pemusnah sihir murni yang melumpuhkan pelindung magis musuh.",
  },
};

const DEFAULT_SKILL = {
  name: "Chakra Burst",
  element: "NATURE",
  dmgMult: 2.0,
  energyCost: 2,
  desc: "Pelepasan energi murni terpusat yang menghantam lawan.",
};

class CardBattleEngine {
  /**
   * Menghitung efektivitas elemen antar dua kartu.
   */
  static getElementMultiplier(attElement, defElement) {
    const elMap = ELEMENT_MULTIPLIERS[attElement] || {};
    return elMap[defElement] || 1.0;
  }

  /**
   * Menghitung total statistik sebuah kartu berdasarkan rarity, printNumber, dan quality.
   */
  static computeCardStats(card) {
    const catalog = CardEngine.getCatalog();
    const searchName = (card.characterName || "").toLowerCase();
    const meta = catalog.find(
      (c) =>
        (c.name && c.name.toLowerCase().includes(searchName)) ||
        (c.id && c.id.toLowerCase() === searchName) ||
        (searchName && c.name && searchName.includes(c.name.toLowerCase())),
    ) || {
      rarity: "COMMON",
      element: "NATURE",
    };

    const base = RARITY_BASE_STATS[meta.rarity] || RARITY_BASE_STATS.COMMON;
    const qualityInfo =
      QUALITY_MULTIPLIERS[card.quality] || QUALITY_MULTIPLIERS.GOOD;

    // Serial Print Multiplier (Low print is stronger)
    let printBonus = 1.0;
    if (card.printNumber === 1) printBonus = 1.2;
    else if (card.printNumber <= 10) printBonus = 1.1;
    else if (card.printNumber <= 100) printBonus = 1.05;

    const totalHp = Math.round(base.hp * qualityInfo.statMult * printBonus);
    const totalAtk = Math.round(base.atk * qualityInfo.statMult * printBonus);
    const totalDef = Math.round(base.def * qualityInfo.statMult * printBonus);
    const totalSpd = Math.round(base.spd * qualityInfo.statMult * printBonus);

    const charKey = (card.characterName || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const skill = CHARACTER_SKILLS[charKey] || DEFAULT_SKILL;

    return {
      cardCode: card.cardCode || "NRA-CARD",
      characterName: card.characterName || "Hero",
      seriesName: card.seriesName || "Anime",
      element: meta.element || "FIRE",
      elementEmoji: ELEMENT_EMOJIS[meta.element || "FIRE"] || "✨",
      quality: card.quality || "GOOD",
      printNumber: card.printNumber || 1,
      maxHp: totalHp,
      currentHp: totalHp,
      atk: totalAtk,
      def: totalDef,
      spd: totalSpd,
      critRate: qualityInfo.critRate,
      energy: 1,
      maxEnergy: 5,
      skill,
      imageUrl: card.imageUrl,
    };
  }

  /**
   * Menghitung hasil satu aksi turn-based dalam pertempuran.
   */
  static executeTurn(attacker, defender, actionType = "ATTACK") {
    let log = "";
    let damageDealt = 0;
    let isCrit = false;

    // Regen 1 energy per turn
    if (attacker.energy < attacker.maxEnergy) attacker.energy += 1;

    if (
      actionType === "SKILL" &&
      attacker.energy >= attacker.skill.energyCost
    ) {
      attacker.energy -= attacker.skill.energyCost;
      const elMult = this.getElementMultiplier(
        attacker.skill.element,
        defender.element,
      );
      let effectiveDef = defender.def;
      if (attacker.skill.ignoreDef)
        effectiveDef *= 1 - attacker.skill.ignoreDef;

      let rawDmg = attacker.atk * attacker.skill.dmgMult - effectiveDef * 0.5;
      rawDmg = Math.max(50, rawDmg) * elMult;

      if (Math.random() < attacker.critRate + (attacker.skill.critBonus || 0)) {
        rawDmg *= 1.5;
        isCrit = true;
      }

      damageDealt = Math.round(rawDmg);
      defender.currentHp = Math.max(0, defender.currentHp - damageDealt);

      if (attacker.skill.lifesteal) {
        const heal = Math.round(damageDealt * attacker.skill.lifesteal);
        attacker.currentHp = Math.min(
          attacker.maxHp,
          attacker.currentHp + heal,
        );
        log = `${attacker.characterName} melepaskan Ultimate **${attacker.skill.name}**! Menyebabkan **${damageDealt}** DMG ${isCrit ? "(💥 CRITICAL!)" : ""} dan menyerap **+${heal}** HP!`;
      } else {
        log = `${attacker.characterName} melepaskan Ultimate **${attacker.skill.name}**! Menyebabkan **${damageDealt}** DMG ${isCrit ? "(💥 CRITICAL!)" : ""}!`;
      }
    } else if (actionType === "DEFEND") {
      attacker.def = Math.round(attacker.def * 1.5);
      attacker.energy = Math.min(attacker.maxEnergy, attacker.energy + 1);
      log = `${attacker.characterName} mengambil posisi bertahan (🛡️ Defense +50% & +1 Energy)!`;
    } else {
      // Normal Attack
      const elMult = this.getElementMultiplier(
        attacker.element,
        defender.element,
      );
      let rawDmg = attacker.atk - defender.def * 0.4;
      rawDmg = Math.max(30, rawDmg) * elMult;

      if (Math.random() < attacker.critRate) {
        rawDmg *= 1.5;
        isCrit = true;
      }

      damageDealt = Math.round(rawDmg);
      defender.currentHp = Math.max(0, defender.currentHp - damageDealt);
      log = `${attacker.characterName} menyerang ${defender.characterName} dengan ${attacker.elementEmoji} serangan biasa sebesar **${damageDealt}** DMG ${isCrit ? "(💥 CRITICAL!)" : ""}!`;
    }

    return {
      damageDealt,
      isCrit,
      log,
      isDefenderFainted: defender.currentHp <= 0,
    };
  }

  /**
   * Menghasilkan monster musuh untuk Tower of Babel berdasarkan nomor lantai.
   */
  static getTowerMonster(floor) {
    const isBoss = floor % 10 === 0;
    const elements = ["FIRE", "WATER", "NATURE", "LIGHT", "DARK"];
    const element = elements[floor % elements.length];

    const baseHp = isBoss ? 3000 + floor * 250 : 800 + floor * 120;
    const baseAtk = isBoss ? 400 + floor * 30 : 150 + floor * 15;
    const baseDef = isBoss ? 200 + floor * 20 : 80 + floor * 10;

    const bossNames = [
      "Slime Sovereign",
      "Flame Drake",
      "Leviathan Hatchling",
      "Shadow Lord",
      "Thunder Titan",
      "Abyss Dragon",
      "Celestial Valkyrie",
      "Chrono Guardian",
      "Apex Behemoth",
      "Void Arbiter",
    ];

    const name = isBoss
      ? bossNames[(floor / 10 - 1) % bossNames.length]
      : `Tower Monster Lt.${floor}`;

    return {
      cardCode: `TOWER-F${floor}`,
      characterName: name,
      seriesName: "Tower of Babel",
      element,
      elementEmoji: ELEMENT_EMOJIS[element],
      quality: isBoss ? "GEM_MINT" : "GOOD",
      printNumber: floor,
      maxHp: baseHp,
      currentHp: baseHp,
      atk: baseAtk,
      def: baseDef,
      spd: 100 + floor * 2,
      critRate: isBoss ? 0.2 : 0.05,
      energy: 1,
      maxEnergy: 5,
      skill: {
        name: isBoss ? "Abyssal Ruin" : "Dark Surge",
        element,
        dmgMult: isBoss ? 2.5 : 1.8,
        energyCost: 3,
        desc: "Hantaman kutukan tower yang menghancurkan jiwa lawan.",
      },
    };
  }
}

module.exports = CardBattleEngine;
