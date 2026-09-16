"use strict";

const UserNPC = require("../../models/UserNPC");
const npcs = require("../data/npcs");

const RELATIONSHIP_TITLES = [
  "Kenalan",
  "Teman",
  "Sahabat",
  "Sahabat Karib / Pacar",
  "Pasangan Hidup",
];

/**
 * Mengambil data hubungan dan afeksi pemain terhadap seorang NPC
 * @param {string} userId
 * @param {string} npcId
 * @returns {Promise<{ affection: number, level: number, title: string, isMarried: boolean }>}
 */
async function getNpcRelationship(userId, npcId) {
  try {
    const bond = await UserNPC.findOne({ where: { userId, npcId } });
    if (!bond) {
      return { affection: 0, level: 0, title: RELATIONSHIP_TITLES[0], isMarried: false };
    }
    const level = Math.max(0, Math.min(4, bond.relationshipLevel || 0));
    return {
      affection: bond.affection || 0,
      level,
      title: RELATIONSHIP_TITLES[level],
      isMarried: level === 4,
    };
  } catch (_) {
    return { affection: 0, level: 0, title: RELATIONSHIP_TITLES[0], isMarried: false };
  }
}

/**
 * Menghitung diskon harga toko atau jasa berdasarkan kedekatan dengan NPC pengelola
 * @param {string} userId
 * @param {string} npcId
 * @param {number} basePrice
 * @returns {Promise<{ discountedPrice: number, discountPercent: number, savedAmount: number }>}
 */
async function calculateDiscount(userId, npcId, basePrice) {
  const price = Math.max(0, Number(basePrice) || 0);
  if (price === 0) {
    return { discountedPrice: 0, discountPercent: 0, savedAmount: 0 };
  }

  const { level } = await getNpcRelationship(userId, npcId);
  let discountPercent = 0;

  if (level === 1) discountPercent = 10;
  else if (level === 2) discountPercent = 15;
  else if (level === 3) discountPercent = 20;
  else if (level >= 4) discountPercent = 25;

  const savedAmount = Math.floor((price * discountPercent) / 100);
  const discountedPrice = Math.max(1, price - savedAmount);

  return { discountedPrice, discountPercent, savedAmount };
}

/**
 * Menerapkan bonus pasif relasi untuk berbagai sistem survival
 * @param {string} userId
 * @param {string} bonusType - Tipe bonus (misal: 'durability_loss', 'mining_ore', 'exp_gain', dll.)
 * @param {number} currentValue
 * @returns {Promise<number>}
 */
async function applyPassiveBonus(userId, bonusType, currentValue) {
  const val = Number(currentValue) || 0;
  try {
    const bonds = await UserNPC.findAll({ where: { userId } });
    if (!bonds || bonds.length === 0) return val;

    const bondMap = new Map(bonds.map((b) => [b.npcId, b.relationshipLevel || 0]));

    switch (bonusType) {
      case "durability_loss": {
        // Bagas: Sahabat (-15%), Karib/Pasangan (-25% keausan)
        const bagasLvl = bondMap.get("bagas") || 0;
        if (bagasLvl >= 3) return Math.max(0.1, val * 0.75);
        if (bagasLvl >= 2) return Math.max(0.1, val * 0.85);
        return val;
      }

      case "mining_ore": {
        // Kang Jajang & Kang Deden: Teman (+10%), Sahabat (+20% hasil tambang)
        const jajangLvl = bondMap.get("kang_jajang") || 0;
        const dedenLvl = bondMap.get("kang_deden") || 0;
        const maxMiningLvl = Math.max(jajangLvl, dedenLvl);
        if (maxMiningLvl >= 2) return Math.round(val * 1.2);
        if (maxMiningLvl >= 1) return Math.round(val * 1.1);
        return val;
      }

      case "fishing_luck": {
        // Tari & Mang Ujang: Teman (+10%), Sahabat/Pasangan (+25% peluang ikan langka)
        const tariLvl = bondMap.get("tari") || 0;
        const ujangLvl = bondMap.get("mang_ujang") || 0;
        const maxSeaLvl = Math.max(tariLvl, ujangLvl);
        if (maxSeaLvl >= 3) return val + 0.25;
        if (maxSeaLvl >= 1) return val + 0.1;
        return val;
      }

      case "exp_gain": {
        // Wulan & Bu Ratna: Teman (+10%), Sahabat (+15%), Pasangan Wulan (+25% EXP)
        const wulanLvl = bondMap.get("wulan") || 0;
        const ratnaLvl = bondMap.get("bu_ratna") || 0;
        if (wulanLvl >= 4) return Math.round(val * 1.25);
        if (wulanLvl >= 2 || ratnaLvl >= 2) return Math.round(val * 1.15);
        if (wulanLvl >= 1 || ratnaLvl >= 1) return Math.round(val * 1.1);
        return val;
      }

      case "stamina_cost": {
        // Laras: Teman (-10%), Sahabat (-15%), Pasangan (-20% konsumsi stamina)
        const larasLvl = bondMap.get("laras") || 0;
        if (larasLvl >= 4) return Math.max(1, Math.round(val * 0.8));
        if (larasLvl >= 2) return Math.max(1, Math.round(val * 0.85));
        if (larasLvl >= 1) return Math.max(1, Math.round(val * 0.9));
        return val;
      }

      case "bandit_chance": {
        // Mayor Lucy: Teman (-30%), Sahabat (-70% risiko sergapan bandit)
        const lucyLvl = bondMap.get("mayor_lucy") || 0;
        if (lucyLvl >= 2) return val * 0.3;
        if (lucyLvl >= 1) return val * 0.7;
        return val;
      }

      default:
        return val;
    }
  } catch (_) {
    return val;
  }
}

/**
 * Mengambil ringkasan seluruh keuntungan persahabatan aktif milik pemain
 * @param {string} userId
 * @returns {Promise<Array<{ npcName: string, levelTitle: string, perkDesc: string, emoji: string }>>}
 */
async function getUserActivePerksSummary(userId) {
  try {
    const bonds = await UserNPC.findAll({ where: { userId } });
    if (!bonds || bonds.length === 0) return [];

    const list = [];
    for (const bond of bonds) {
      const level = bond.relationshipLevel || 0;
      if (level < 1) continue;

      const npc = npcs[bond.npcId];
      if (!npc) continue;

      let perkDesc = "Diskon 10% toko & sapaan hangat";
      let emoji = "🤝";

      if (bond.npcId === "bagas") {
        perkDesc = level >= 3 ? "Durability Guard (-25% aus) & Diskon Tempa 20%" : "Diskon Tempa 10%";
        emoji = "🔨";
      } else if (bond.npcId === "ningsih") {
        perkDesc = level >= 4 ? "Bekal Salad Sehat & Panen Kebun Cepat" : "Diskon Bibit & Panen Bonus";
        emoji = "🌱";
      } else if (bond.npcId === "bidan_sari") {
        perkDesc = level >= 4 ? "Blessing of Sari (Auto-Revive 1x/hari) & Obat Gratis" : "Diskon Biaya Medis 50%";
        emoji = "💊";
      } else if (bond.npcId === "wulan") {
        perkDesc = level >= 4 ? "Arsip Hikmah (+25% EXP Riset) & Teh Fokus" : "Bonus +15% EXP Belajar";
        emoji = "📚";
      } else if (bond.npcId === "laras") {
        perkDesc = level >= 4 ? "Kopi Cinta (-20% Konsumsi Stamina)" : "Diskon Kafe & Stamina Booster";
        emoji = "☕";
      } else if (bond.npcId === "tari") {
        perkDesc = level >= 4 ? "Bonus 2x Mutiara Laut & Selam Bebas Biaya" : "+20% Peluang Ikan Langka";
        emoji = "🌊";
      } else if (bond.npcId === "kang_jajang" || bond.npcId === "kang_deden") {
        perkDesc = "+15% Hasil Ekskavasi Bijih Tambang";
        emoji = "⛏️";
      } else if (bond.npcId === "mayor_lucy") {
        perkDesc = "-70% Risiko Sergapan Bandit Jalanan";
        emoji = "🛡️";
      }

      list.push({
        npcName: npc.name,
        levelTitle: RELATIONSHIP_TITLES[level],
        perkDesc,
        emoji,
      });
    }

    return list;
  } catch (_) {
    return [];
  }
}

module.exports = {
  RELATIONSHIP_TITLES,
  getNpcRelationship,
  calculateDiscount,
  applyPassiveBonus,
  getUserActivePerksSummary,
};
