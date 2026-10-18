"use strict";

/**
 * cardBattleEngine.js - Cross-Platform TCG Card Battler (PvP Arena & 5-Card Deck System).
 *
 * Mengelola:
 *   1. 5-Card Deck Builder: Validasi deck 5-kartu, power score, dan elemental synergy resonance.
 *   2. Formula Kerusakan Deterministik (Deterministic Damage Formula):
 *      - Efektivitas Elemen: FIRE, WATER, NATURE, LIGHT, DARK.
 *      - Scaling ATK, DEF, SPD, Critical Hit, Guard Stance, dan Energy.
 *   3. Turn-based PvP/PvE Battle Arena State Machine.
 *   4. Status Effects: Burn, Stun, DefBreak, Shield Absorption.
 */

const { ValidationError } = require("../errors/DomainError");

const DEFAULT_CATALOG = [
  { id: "hutao", name: "Hu Tao", series: "Genshin Impact", rarity: "SECRET_MYTHIC", element: "FIRE" },
  { id: "saber", name: "Saber", series: "Fate/stay night", rarity: "SECRET_MYTHIC", element: "LIGHT" },
  { id: "gojo", name: "Gojo Satoru", series: "Jujutsu Kaisen", rarity: "SECRET_MYTHIC", element: "DARK" },
  { id: "rem", name: "Rem", series: "Re:Zero", rarity: "ULTRA_RARE", element: "WATER" },
  { id: "mikasa", name: "Mikasa Ackerman", series: "Attack on Titan", rarity: "ULTRA_RARE", element: "NATURE" },
  { id: "megumin", name: "Megumin", series: "KonoSuba", rarity: "ULTRA_RARE", element: "FIRE" },
  { id: "frieren", name: "Frieren", series: "Sousou no Frieren", rarity: "SECRET_MYTHIC", element: "LIGHT" },
  { id: "raiden", name: "Raiden Shogun", series: "Genshin Impact", rarity: "SECRET_MYTHIC", element: "LIGHT" },
  { id: "anya", name: "Anya Forger", series: "Spy x Family", rarity: "RARE", element: "NATURE" },
  { id: "yor", name: "Yor Forger", series: "Spy x Family", rarity: "ULTRA_RARE", element: "DARK" },
  { id: "fern", name: "Fern", series: "Sousou no Frieren", rarity: "ULTRA_RARE", element: "LIGHT" },
  { id: "aqua", name: "Aqua", series: "KonoSuba", rarity: "RARE", element: "WATER" },
  { id: "emilia", name: "Emilia", series: "Re:Zero", rarity: "ULTRA_RARE", element: "WATER" },
];

function getCatalog() {
  return DEFAULT_CATALOG;
}

const ELEMENTS = Object.freeze({
  FIRE: "FIRE",
  WATER: "WATER",
  NATURE: "NATURE",
  LIGHT: "LIGHT",
  DARK: "DARK",
});

const ELEMENT_MULTIPLIERS = Object.freeze({
  FIRE: { NATURE: 1.5, WATER: 0.75, FIRE: 1.0, LIGHT: 1.0, DARK: 1.0 },
  NATURE: { WATER: 1.5, FIRE: 0.75, NATURE: 1.0, LIGHT: 1.0, DARK: 1.0 },
  WATER: { FIRE: 1.5, NATURE: 0.75, WATER: 1.0, LIGHT: 1.0, DARK: 1.0 },
  LIGHT: { DARK: 1.5, LIGHT: 1.0, FIRE: 1.0, WATER: 1.0, NATURE: 1.0 },
  DARK: { LIGHT: 1.5, DARK: 1.0, FIRE: 1.0, WATER: 1.0, NATURE: 1.0 },
});

const ELEMENT_EMOJIS = Object.freeze({
  FIRE: "🔥",
  WATER: "💧",
  NATURE: "🌿",
  LIGHT: "⚡",
  DARK: "🌑",
});

const ACTIONS = Object.freeze({
  ATTACK: "ATTACK",
  SKILL: "SKILL",
  GUARD: "GUARD",
  BURST: "BURST",
  FORFEIT: "FORFEIT",
});

const BATTLE_STATES = Object.freeze({
  PENDING: "PENDING",
  IN_PROGRESS: "IN_PROGRESS",
  FINISHED: "FINISHED",
});

const RARITY_BASE_STATS = Object.freeze({
  COMMON: { hp: 1000, atk: 200, def: 100, spd: 100 },
  RARE: { hp: 1400, atk: 300, def: 160, spd: 130 },
  ULTRA_RARE: { hp: 1800, atk: 420, def: 230, spd: 170 },
  EPIC: { hp: 1800, atk: 420, def: 230, spd: 170 },
  LEGENDARY: { hp: 2400, atk: 550, def: 300, spd: 210 },
  MYTHIC: { hp: 3000, atk: 680, def: 380, spd: 250 },
  SECRET_MYTHIC: { hp: 3000, atk: 680, def: 380, spd: 250 },
});

const QUALITY_MULTIPLIERS = Object.freeze({
  GEM_MINT: { statMult: 1.5, critRate: 0.25 },
  EXCELLENT: { statMult: 1.25, critRate: 0.15 },
  GOOD: { statMult: 1.0, critRate: 0.08 },
  POOR: { statMult: 0.8, critRate: 0.02 },
});

const CHARACTER_SKILLS = Object.freeze({
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
});

const DEFAULT_SKILL = Object.freeze({
  name: "Chakra Burst",
  element: "NATURE",
  dmgMult: 2.0,
  energyCost: 2,
  desc: "Pelepasan energi murni terpusat yang menghantam lawan.",
});

class CardBattleEngine {
  /**
   * Menghitung efektivitas elemen antar dua kartu.
   * @param {string} attElement
   * @param {string} defElement
   * @returns {number}
   */
  static getElementMultiplier(attElement, defElement) {
    const elMap = ELEMENT_MULTIPLIERS[attElement] || {};
    return elMap[defElement] || 1.0;
  }

  /**
   * Menghitung statistik kartu berdasarkan rarity, printNumber, dan quality.
   * @param {Object} card
   * @returns {Object}
   */
  static computeCardStats(card) {
    if (!card) {
      throw new ValidationError("Data kartu tidak boleh kosong.");
    }

    const catalog = getCatalog();
    const searchName = (card.characterName || "").toLowerCase();
    const meta = catalog.find(
      (c) =>
        (c.name && c.name.toLowerCase().includes(searchName)) ||
        (c.id && c.id.toLowerCase() === searchName) ||
        (searchName && c.name && searchName.includes(c.name.toLowerCase())),
    ) || {
      rarity: card.rarity || "COMMON",
      element: card.element || "FIRE",
    };

    const rarity = (meta.rarity || card.rarity || "COMMON").toUpperCase();
    const base = RARITY_BASE_STATS[rarity] || RARITY_BASE_STATS.COMMON;
    const qualityInfo = QUALITY_MULTIPLIERS[card.quality] || QUALITY_MULTIPLIERS.GOOD;

    let printBonus = 1.0;
    const printNum = Number(card.printNumber) || 1;
    if (printNum === 1) printBonus = 1.2;
    else if (printNum <= 10) printBonus = 1.1;
    else if (printNum <= 100) printBonus = 1.05;

    const totalHp = Math.round(base.hp * qualityInfo.statMult * printBonus);
    const totalAtk = Math.round(base.atk * qualityInfo.statMult * printBonus);
    const totalDef = Math.round(base.def * qualityInfo.statMult * printBonus);
    const totalSpd = Math.round(base.spd * qualityInfo.statMult * printBonus);

    const element = (meta.element || card.element || "FIRE").toUpperCase();

    const charKey = (card.characterName || "")
      .toLowerCase()
      .replace(/[^a-z]/g, "");
    const skill = CHARACTER_SKILLS[charKey] || DEFAULT_SKILL;

    return {
      cardCode: card.cardCode || "NRA-CARD",
      characterName: card.characterName || "Hero",
      seriesName: card.seriesName || "Anime",
      element,
      elementEmoji: ELEMENT_EMOJIS[element] || "✨",
      quality: card.quality || "GOOD",
      rarity,
      printNumber: printNum,
      maxHp: totalHp,
      currentHp: totalHp,
      atk: totalAtk,
      def: totalDef,
      spd: totalSpd,
      critRate: qualityInfo.critRate,
      energy: 2,
      maxEnergy: 10,
      shield: 0,
      skill,
      imageUrl: card.imageUrl || null,
    };
  }

  /**
   * Validasi struktur 5-Card Deck untuk PvP Arena.
   * @param {Array<Object>} cards - Array 5 kartu
   * @returns {Object} Validated deck summary
   */
  static validateDeck5(cards) {
    if (!Array.isArray(cards)) {
      throw new ValidationError("Deck kartu harus berupa array.");
    }

    if (cards.length !== 5) {
      throw new ValidationError(`Deck harus memiliki tepat 5 kartu (diberikan: ${cards.length}).`);
    }

    // Periksa keunikan dan batas duplikasi karakter (maksimal 2 kartu dari karakter yang sama)
    const charCount = new Map();
    const computedCards = [];

    for (let i = 0; i < cards.length; i++) {
      const card = cards[i];
      if (!card || (!card.characterName && !card.cardCode)) {
        throw new ValidationError(`Kartu pada slot ${i + 1} tidak valid.`);
      }
      const charName = (card.characterName || card.cardCode).toLowerCase();
      const count = (charCount.get(charName) || 0) + 1;
      if (count > 2) {
        throw new ValidationError(
          `Karakter "${card.characterName || card.cardCode}" tidak boleh digunakan lebih dari 2 kali dalam 1 deck.`,
        );
      }
      charCount.set(charName, count);
      computedCards.push(this.computeCardStats(card));
    }

    const synergies = this.getDeckElementalSynergies(computedCards);
    const deckPower = this.calculateDeckPower(computedCards, synergies);

    return {
      valid: true,
      cards: computedCards,
      synergies,
      deckPower,
      totalHp: computedCards.reduce((sum, c) => sum + c.maxHp, 0),
      averageAtk: Math.round(computedCards.reduce((sum, c) => sum + c.atk, 0) / 5),
      averageDef: Math.round(computedCards.reduce((sum, c) => sum + c.def, 0) / 5),
      teamSpd: Math.round(computedCards.reduce((sum, c) => sum + c.spd, 0) / 5),
    };
  }

  /**
   * Hitung sinergi elemen pada 5-Card Deck.
   * @param {Array<Object>} cards
   * @returns {Array<Object>} List of active elemental synergies
   */
  static getDeckElementalSynergies(cards) {
    const counts = {};
    for (const c of cards) {
      const el = c.element || "FIRE";
      counts[el] = (counts[el] || 0) + 1;
    }

    const synergies = [];
    const distinctCount = Object.keys(counts).length;

    // Sinergi Khusus: 5 Elemen Unik (Cosmic Quintet)
    if (distinctCount === 5) {
      synergies.push({
        id: "cosmic_quintet",
        name: "🌌 Cosmic Quintet Resonance",
        bonusAtkPct: 0.15,
        bonusDefPct: 0.15,
        bonusHpPct: 0.15,
        desc: "5 elemen berbeda bersatu: +15% ke seluruh atribut deck!",
      });
    }

    // Sinergi Elemen Spesifik (Monoelement / Duo)
    if (counts.FIRE >= 2) {
      synergies.push({
        id: "fire_resonance",
        name: "🔥 Blazing Fury",
        bonusAtkPct: 0.12 * Math.floor(counts.FIRE / 2),
        desc: `Resonansi Api (${counts.FIRE} kartu): +${12 * Math.floor(counts.FIRE / 2)}% ATK tim.`,
      });
    }
    if (counts.WATER >= 2) {
      synergies.push({
        id: "water_resonance",
        name: "💧 Ocean Aegis",
        bonusHpPct: 0.15 * Math.floor(counts.WATER / 2),
        desc: `Resonansi Air (${counts.WATER} kartu): +${15 * Math.floor(counts.WATER / 2)}% Max HP tim.`,
      });
    }
    if (counts.NATURE >= 2) {
      synergies.push({
        id: "nature_resonance",
        name: "🌿 Ironwood Shell",
        bonusDefPct: 0.14 * Math.floor(counts.NATURE / 2),
        desc: `Resonansi Alam (${counts.NATURE} kartu): +${14 * Math.floor(counts.NATURE / 2)}% DEF tim.`,
      });
    }
    if (counts.LIGHT >= 2) {
      synergies.push({
        id: "light_resonance",
        name: "⚡ Zephyr Blitz",
        bonusSpdPct: 0.15 * Math.floor(counts.LIGHT / 2),
        desc: `Resonansi Petir (${counts.LIGHT} kartu): +${15 * Math.floor(counts.LIGHT / 2)}% SPD tim.`,
      });
    }
    if (counts.DARK >= 2) {
      synergies.push({
        id: "dark_resonance",
        name: "🌑 Abyssal Lethality",
        bonusCritPct: 0.10 * Math.floor(counts.DARK / 2),
        desc: `Resonansi Kegelapan (${counts.DARK} kartu): +${10 * Math.floor(counts.DARK / 2)}% Crit Rate tim.`,
      });
    }

    return synergies;
  }

  /**
   * Menghitung total skor kekuatan (Deck Power)
   * @param {Array<Object>} cards
   * @param {Array<Object>} [synergies=[]]
   * @returns {number}
   */
  static calculateDeckPower(cards, synergies = []) {
    let rawPower = 0;
    for (const c of cards) {
      rawPower += Math.round(c.maxHp * 0.4 + c.atk * 1.5 + c.def * 1.0 + c.spd * 0.8);
    }
    let synergyMultiplier = 1.0;
    for (const s of synergies) {
      synergyMultiplier += (s.bonusAtkPct || 0) + (s.bonusDefPct || 0) + (s.bonusHpPct || 0);
    }
    return Math.round(rawPower * synergyMultiplier);
  }

  /**
   * Formula Kerusakan Deterministik (Deterministic Damage Formula).
   *
   * @param {Object} attacker - Karakter penyerang
   * @param {Object} defender - Karakter bertahan
   * @param {string} actionType - 'ATTACK' | 'SKILL' | 'GUARD' | 'BURST'
   * @param {Object} [options={}]
   * @param {boolean} [options.forceCrit] - Penentu deterministic critical hit
   * @param {boolean} [options.isGuarding] - Status pertahanan defender saat ini
   * @returns {Object}
   */
  static calculateDamage(attacker, defender, actionType = ACTIONS.ATTACK, options = {}) {
    const elementMult = this.getElementMultiplier(attacker.element, defender.element);

    let actionMult = 1.0;
    let energyCost = 0;
    let ignoresDefPct = 0;

    switch (actionType) {
      case ACTIONS.SKILL:
        actionMult = 2.2;
        energyCost = 3;
        break;
      case ACTIONS.BURST:
        actionMult = 3.5;
        energyCost = 5;
        ignoresDefPct = 0.3; // Burst menembus 30% DEF
        break;
      case ACTIONS.GUARD:
        actionMult = 0.5;
        energyCost = 0;
        break;
      case ACTIONS.ATTACK:
      default:
        actionMult = 1.0;
        energyCost = 0;
        break;
    }

    // Cek critical hit
    const isCrit = options.forceCrit !== undefined ? Boolean(options.forceCrit) : (Math.random() < (attacker.critRate || 0.1));
    const critMult = isCrit ? 1.6 : 1.0;

    // Efek pertahanan (Guard mengurangi damage yang diterima)
    const isGuarding = Boolean(options.isGuarding || defender.isGuarding);
    const effectiveDef = defender.def * (1 - ignoresDefPct) * (isGuarding ? 1.8 : 1.0);

    // Formula deterministik: Atk berskala dikurangi porsi Def
    const baseDamage = attacker.atk * actionMult * critMult;
    const mitigation = effectiveDef * 0.45;
    let netDamage = Math.max(25, Math.round((baseDamage - mitigation) * elementMult));

    // Serap kerusakan lewat shield jika ada
    let absorbed = 0;
    if (defender.shield && defender.shield > 0) {
      absorbed = Math.min(defender.shield, netDamage);
      netDamage -= absorbed;
    }

    return {
      actionType,
      damage: netDamage,
      rawDamage: Math.round(baseDamage * elementMult),
      elementMultiplier: elementMult,
      isSuperEffective: elementMult > 1.0,
      isResisted: elementMult < 1.0,
      isCrit,
      absorbedByShield: absorbed,
      energyCost,
    };
  }

  /**
   * Membuat state pertarungan awal antara dua pengguna.
   * @param {Object} p1 - { userId, username, card | deck }
   * @param {Object} p2 - { userId, username, card | deck }
   * @param {Object} [options={}]
   * @returns {Object} Initial battle state
   */
  static createBattle(p1, p2, options = {}) {
    if (!p1?.userId || !p2?.userId) {
      throw new ValidationError("Data pemain 1 dan pemain 2 wajib memiliki userId.");
    }

    const p1Card = p1.deck ? this.validateDeck5(p1.deck).cards[0] : this.computeCardStats(p1.card);
    const p2Card = p2.deck ? this.validateDeck5(p2.deck).cards[0] : this.computeCardStats(p2.card);

    const firstTurnUserId = p1Card.spd >= p2Card.spd ? p1.userId : p2.userId;

    return {
      battleId: `battle_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      bet: Number(options.bet) || 0,
      isPvE: Boolean(options.isPvE),
      state: BATTLE_STATES.IN_PROGRESS,
      turnNumber: 1,
      activeUserId: firstTurnUserId,
      combatLogs: [
        `Pertarungan TCG dimulai! ${p1Card.spd >= p2Card.spd ? p1.username : p2.username} bergerak lebih dulu karena keunggulan SPD (${Math.max(p1Card.spd, p2Card.spd)} vs ${Math.min(p1Card.spd, p2Card.spd)})!`,
      ],
      fighters: {
        [p1.userId]: {
          userId: p1.userId,
          username: p1.username,
          card: p1Card,
          currentHp: p1Card.maxHp,
          maxHp: p1Card.maxHp,
          shield: 0,
          energy: 2,
          isGuarding: false,
        },
        [p2.userId]: {
          userId: p2.userId,
          username: p2.username,
          card: p2Card,
          currentHp: p2Card.maxHp,
          maxHp: p2Card.maxHp,
          shield: 0,
          energy: 2,
          isGuarding: false,
        },
      },
      winnerUserId: null,
      loserUserId: null,
    };
  }

  /**
   * Memproses satu aksi giliran petarung dalam arena.
   * @param {Object} battleState
   * @param {string} userId
   * @param {string} actionType - 'ATTACK' | 'SKILL' | 'GUARD' | 'BURST' | 'FORFEIT'
   * @param {Object} [options={}]
   * @returns {Object} Updated battleState
   */
  static processTurn(battleState, userId, actionType = ACTIONS.ATTACK, options = {}) {
    if (battleState.state === BATTLE_STATES.FINISHED) {
      throw new ValidationError("Pertarungan ini sudah berakhir.");
    }

    const opponentId = Object.keys(battleState.fighters).find((id) => id !== userId);
    const attacker = battleState.fighters[userId];
    const defender = battleState.fighters[opponentId];

    if (!attacker || !defender) {
      throw new ValidationError("Peserta pertarungan tidak valid.");
    }

    if (actionType === ACTIONS.FORFEIT) {
      battleState.state = BATTLE_STATES.FINISHED;
      battleState.winnerUserId = opponentId;
      battleState.loserUserId = userId;
      battleState.combatLogs.push(
        `🏳️ ${attacker.username} menyatakan menyerah (Forfeit)! ${defender.username} keluar sebagai pemenang!`,
      );
      return battleState;
    }

    if (battleState.activeUserId !== userId) {
      throw new ValidationError("Bukan giliran Anda untuk melangkah.");
    }

    // Reset status guard giliran sebelumnya
    attacker.isGuarding = false;

    // Eksekusi Guard
    if (actionType === ACTIONS.GUARD) {
      attacker.isGuarding = true;
      attacker.shield += Math.round(attacker.card.def * 0.8);
      attacker.energy = Math.min(attacker.card.maxEnergy, attacker.energy + 2);
      battleState.combatLogs.push(
        `🛡️ ${attacker.username} mengambil sikap bertahan (Guard)! Memasang perisai +${Math.round(attacker.card.def * 0.8)} dan memulihkan 2 Energy!`,
      );
    } else {
      // Validasi biaya energi untuk SKILL dan BURST
      let requiredEnergy = 0;
      if (actionType === ACTIONS.SKILL) requiredEnergy = 3;
      if (actionType === ACTIONS.BURST) requiredEnergy = 5;

      if (attacker.energy < requiredEnergy) {
        throw new ValidationError(`Energi tidak mencukupi untuk ${actionType} (Dibutuhkan: ${requiredEnergy}, Tersedia: ${attacker.energy}).`);
      }

      attacker.energy -= requiredEnergy;

      const calc = this.calculateDamage(attacker.card, defender.card, actionType, {
        isGuarding: defender.isGuarding,
        forceCrit: options.forceCrit,
      });

      // Kurangi shield terlebih dahulu jika ada
      if (calc.absorbedByShield > 0) {
        defender.shield = Math.max(0, defender.shield - calc.absorbedByShield);
      }

      // Terapkan damage ke HP
      defender.currentHp = Math.max(0, defender.currentHp - calc.damage);

      // Energy regen per giliran menyerang (+1)
      attacker.energy = Math.min(attacker.card.maxEnergy, attacker.energy + 1);

      // Log rincian tempur
      let logText = `⚔️ ${attacker.username} melancarkan **${actionType}**! Menghasilkan **${calc.damage} DMG** ke ${defender.username}`;
      if (calc.isCrit) logText += " (💥 CRITICAL HIT!)";
      if (calc.isSuperEffective) logText += " (🔥 Efektif!)";
      if (calc.isResisted) logText += " (🛡️ Lemah/Tertahan)";
      if (calc.absorbedByShield > 0) logText += ` [${calc.absorbedByShield} terserap perisai]`;

      battleState.combatLogs.push(logText);
    }

    // Cek kekalahan
    if (defender.currentHp <= 0) {
      battleState.state = BATTLE_STATES.FINISHED;
      battleState.winnerUserId = userId;
      battleState.loserUserId = opponentId;
      battleState.combatLogs.push(
        `🏆 ${defender.username} telah tumbang! **${attacker.username} memenangkan duel!**`,
      );
      return battleState;
    }

    // Pindahkan giliran ke lawan
    battleState.turnNumber++;
    battleState.activeUserId = opponentId;

    return battleState;
  }

  /**
   * Resolusi giliran AI secara cerdas dan deterministik.
   * @param {Object} battleState
   * @param {string} aiUserId
   * @returns {Object} Updated battleState
   */
  static resolveAiTurn(battleState, aiUserId) {
    const aiFighter = battleState.fighters[aiUserId];
    if (!aiFighter || battleState.activeUserId !== aiUserId) return battleState;

    let chosenAction = ACTIONS.ATTACK;

    // AI Tactical Logic:
    // 1. Jika HP kritis (< 25%) dan punya shield kosong -> Guard
    if (aiFighter.currentHp < aiFighter.maxHp * 0.25 && aiFighter.shield === 0) {
      chosenAction = ACTIONS.GUARD;
    } else if (aiFighter.energy >= 5) {
      // 2. Jika energi penuh -> Lakukan Burst
      chosenAction = ACTIONS.BURST;
    } else if (aiFighter.energy >= 3) {
      // 3. Jika energi cukup untuk skill -> Gunakan skill
      chosenAction = ACTIONS.SKILL;
    } else {
      // 4. Standar serangan biasa
      chosenAction = ACTIONS.ATTACK;
    }

    return this.processTurn(battleState, aiUserId, chosenAction);
  }

  /**
   * Menghasilkan monster penjaga Tower of Babel.
   * @param {number} floor
   * @returns {Object}
   */
  static getTowerMonster(floor = 1) {
    const legacy = require("../card/cardBattleEngine");
    return legacy.getTowerMonster(floor);
  }

  /**
   * Menghasilkan ringkasan duel kartu setelah pertempuran usai.
   * @param {Object} battleState
   * @returns {Object}
   */
  static getBattleSummary(battleState) {
    if (battleState.state !== BATTLE_STATES.FINISHED) {
      return { isFinished: false };
    }

    const winner = battleState.fighters[battleState.winnerUserId];
    const loser = battleState.fighters[battleState.loserUserId];
    const bet = battleState.bet || 0;

    return {
      isFinished: true,
      battleId: battleState.battleId,
      totalTurns: battleState.turnNumber,
      winner: {
        userId: winner.userId,
        username: winner.username,
        remainingHp: winner.currentHp,
        maxHp: winner.maxHp,
        earnedBet: bet * 2,
        eloDelta: 25,
      },
      loser: {
        userId: loser.userId,
        username: loser.username,
        remainingHp: 0,
        maxHp: loser.maxHp,
        lostBet: bet,
        eloDelta: -20,
      },
      combatLogs: battleState.combatLogs,
    };
  }
}

// Instance and module exports
const cardBattleEngine = new CardBattleEngine();
cardBattleEngine.CardBattleEngine = CardBattleEngine;
cardBattleEngine.ELEMENTS = ELEMENTS;
cardBattleEngine.ELEMENT_MULTIPLIERS = ELEMENT_MULTIPLIERS;
cardBattleEngine.ELEMENT_EMOJIS = ELEMENT_EMOJIS;
cardBattleEngine.ACTIONS = ACTIONS;
cardBattleEngine.BATTLE_STATES = BATTLE_STATES;
cardBattleEngine.RARITY_BASE_STATS = RARITY_BASE_STATS;
cardBattleEngine.CHARACTER_SKILLS = CHARACTER_SKILLS;
cardBattleEngine.DEFAULT_SKILL = DEFAULT_SKILL;

module.exports = cardBattleEngine;
