"use strict";

const UserNPC = require("../../models/UserNPC");
const npcs = require("../data/npcs");

const ROMANCEABLE_FEMALES = [
  "ningsih",
  "bidan_sari",
  "bu_ratna",
  "tari",
  "mbak_siti",
  "laras",
  "wulan",
  "suster_maya",
  "mbak_rini",
  "shino_hoshino",
];

const SPOUSAL_DATA = {
  ningsih: {
    vow: "Di bawah langit biru dan hamparan bunga desa, aku berjanji akan selalu mekar dan merawatmu dengan segenap cintaku.",
    breakfast: "Salad Sayur Segar & Madu Bunga",
    restoreHp: 40,
    restoreHunger: 50,
    restoreThirst: 50,
    restoreStamina: 40,
    perkName: "Kehangatan Kebun Bunga",
    perkDesc: "Panen kebun 20% lebih cepat & sarapan sayur segar gratis setiap pagi.",
  },
  bidan_sari: {
    vow: "Dalam suka maupun duka, sehat maupun sakit, tanganku akan selalu ada untuk membalut lukamu dan merawat jiwamu.",
    breakfast: "Sup Ginseng Hangat & Jamu Pemulih",
    restoreHp: 75,
    restoreHunger: 40,
    restoreThirst: 40,
    restoreStamina: 50,
    perkName: "Blessing of Sari",
    perkDesc: "Auto-Revive 1x per hari saat HP menyentuh 0 di dungeon & pengobatan gratis.",
  },
  bu_ratna: {
    vow: "Cinta adalah pelajaran terindah yang tak pernah usai. Aku berjanji mendampingi setiap langkah petualangan hidupmu.",
    breakfast: "Roti Panggang Madu & Teh Melati",
    restoreHp: 30,
    restoreHunger: 45,
    restoreThirst: 45,
    restoreStamina: 40,
    perkName: "Pendidikan Teladan",
    perkDesc: "Bonus +20% Survival EXP permanen untuk seluruh kegiatan leveling.",
  },
  tari: {
    vow: "Sebagaimana ombak yang selalu kembali memeluk pantai, hatiku akan selalu berlabuh pada dirimu seorang.",
    breakfast: "Ikan Bakar Rempah & Air Kelapa Muda",
    restoreHp: 40,
    restoreHunger: 60,
    restoreThirst: 50,
    restoreStamina: 50,
    perkName: "Pesona Laut Dalam",
    perkDesc: "Bonus 2x lipat penemuan mutiara dan harta karun bawah laut.",
  },
  mbak_siti: {
    vow: "Mugi-mugi tresno kito langgeng salawase. Aku bakal setya ngancani lan nyiapake jamu paling enak kanggo sampeyan.",
    breakfast: "Jamu Beras Kencur & Nasi Liwet Gurih",
    restoreHp: 35,
    restoreHunger: 50,
    restoreThirst: 40,
    restoreStamina: 60,
    perkName: "Kebugaran Jamu Tradisional",
    perkDesc: "Kekebalan dari penyakit ringan & tambahan +60 stamina instan tiap pagi.",
  },
  laras: {
    vow: "Di setiap tegukan cangkir kopi dan irama senja, kafe ini dan seluruh hidupku seutuhnya adalah milikmu.",
    breakfast: "Espresso Dolce & Croissant Hangat",
    restoreHp: 30,
    restoreHunger: 40,
    restoreThirst: 40,
    restoreStamina: 70,
    perkName: "Racikan Cinta Kafe",
    perkDesc: "Penghematan konsumsi stamina seharian sebesar 20%.",
  },
  wulan: {
    vow: "Dari jutaan aksara dan lembaran buku peradaban, namamu adalah kisah paling indah yang akan kutulis selamanya.",
    breakfast: "Teh Herbal Pustaka & Biskuit Gandum",
    restoreHp: 35,
    restoreHunger: 40,
    restoreThirst: 45,
    restoreStamina: 50,
    perkName: "Arsip Hikmah Wulan",
    perkDesc: "Bonus +25% Survival EXP untuk seluruh kegiatan riset dan membaca buku.",
  },
  suster_maya: {
    vow: "B-Bukan berarti aku manja ya! Tapi... jangan pernah berani terluka lagi, karena sekarang kamu adalah tanggung jawab hatiku.",
    breakfast: "Bubur Nutrisi Spesial & Jus Jeruk Murni",
    restoreHp: 60,
    restoreHunger: 45,
    restoreThirst: 50,
    restoreStamina: 40,
    perkName: "Perawatan Intensif Maya",
    perkDesc: "Detoksifikasi racun otomatis & diskon perawatan medis rumah sakit 100%.",
  },
  mbak_rini: {
    vow: "Investasi paling berharga dalam hidupku bukanlah emas atau permata balai lelang, melainkan mempercayakan hatiku padamu.",
    breakfast: "Kaviar Panggang & Anggur Non-Alkoholik",
    restoreHp: 40,
    restoreHunger: 50,
    restoreThirst: 50,
    restoreStamina: 50,
    perkName: "Dividen Cinta Rini",
    perkDesc: "Bebas pajak penanganan lelang & dividen keuntungan pasar modal harian.",
  },
  shino_hoshino: {
    vow: "Yaaay! Mulai hari ini kita resmi jadi pasangan paling kompak sedunia! Ayo kita jelajahi seluruh galaksi bersama!",
    breakfast: "Pancake Strawberry & Boba Float",
    restoreHp: 35,
    restoreHunger: 50,
    restoreThirst: 50,
    restoreStamina: 50,
    perkName: "Sinergi Kosmik Shino",
    perkDesc: "Peningkatan perolehan Naura Coupon dan akses fitur gadget futuristik.",
  },
};

/**
 * Memeriksa apakah pemain sudah memiliki ikatan pernikahan dengan seseorang
 * @param {string} userId
 * @param {object} survival
 * @returns {Promise<{ isMarried: boolean, spouseId: string|null, spouseName: string|null }>}
 */
async function getMarriageStatus(userId, survival) {
  const state = (survival && survival.rpg_state) || {};
  let spouseId = state.married_to || null;

  if (!spouseId) {
    const bonds = await UserNPC.findAll({ where: { userId } }).catch(() => []);
    const marriedBond = bonds.find((b) => b.relationshipLevel >= 4);
    if (marriedBond) {
      spouseId = marriedBond.npcId;
    }
  }

  if (spouseId) {
    const npc = npcs[spouseId];
    return {
      isMarried: true,
      spouseId,
      spouseName: npc ? npc.name : spouseId,
    };
  }

  return { isMarried: false, spouseId: null, spouseName: null };
}

/**
 * Melakukan prosesi pernikahan dengan aturan KETAT SATU PASANGAN (MONOGAMI)
 * @param {string} userId
 * @param {object} survival
 * @param {string} targetNpcId
 * @returns {Promise<{ ok: boolean, reason?: string, spouseName?: string, vow?: string, cgId?: string }>}
 */
async function marryNpc(userId, survival, targetNpcId) {
  const normNpcId = String(targetNpcId || "").toLowerCase();

  // Validasi: NPC harus termasuk dalam karakter wanita romansa
  if (!ROMANCEABLE_FEMALES.includes(normNpcId)) {
    return { ok: false, reason: "not_romanceable" };
  }

  // ATURAN KETAT MONOGAMI: Periksa apakah pemain sudah menikah
  const currentStatus = await getMarriageStatus(userId, survival);
  if (currentStatus.isMarried) {
    return {
      ok: false,
      reason: "already_married",
      spouseName: currentStatus.spouseName,
    };
  }

  // Validasi: Pemain harus memiliki ikatan afeksi yang cukup (minimal level 3 atau afeksi >= 300)
  const [bond] = await UserNPC.findOrCreate({
    where: { userId, npcId: normNpcId },
    defaults: { affection: 0, relationshipLevel: 0 },
  });

  if ((bond.affection || 0) < 300 && (bond.relationshipLevel || 0) < 3) {
    return { ok: false, reason: "affection_too_low" };
  }

  // Sahkan pernikahan
  bond.relationshipLevel = 4;
  bond.affection = Math.max(500, (bond.affection || 0) + 100);
  bond.lastInteraction = new Date();
  await bond.save({
    fields: ["relationshipLevel", "affection", "lastInteraction"],
  });

  const state = (survival && survival.rpg_state) || {};
  const unlockedCgs = Array.isArray(state.unlocked_cgs) ? [...state.unlocked_cgs] : [];
  const weddingCgId = `wedding_${normNpcId}`;

  if (!unlockedCgs.includes(weddingCgId)) {
    unlockedCgs.push(weddingCgId);
  }

  const updatedState = {
    ...state,
    married_to: normNpcId,
    married_at: new Date().toISOString(),
    unlocked_cgs: unlockedCgs,
  };

  survival.rpg_state = updatedState;
  if (typeof survival.changed === "function") survival.changed("rpg_state", true);
  if (typeof survival.save === "function") {
    await survival.save({ fields: ["rpg_state"] });
  }

  const npc = npcs[normNpcId];
  const spouseInfo = SPOUSAL_DATA[normNpcId] || {};

  return {
    ok: true,
    spouseName: npc ? npc.name : normNpcId,
    vow: spouseInfo.vow || "Aku berjanji akan selalu setia mendampingi setiap petualanganmu.",
    cgId: weddingCgId,
  };
}

/**
 * Memicu event memiliki anak/keluarga bahagia (Parenthood Event)
 * @param {string} userId
 * @param {object} survival
 * @param {string} childName
 * @returns {Promise<{ ok: boolean, reason?: string, cgId?: string }>}
 */
async function triggerParenthood(userId, survival, childName = "Cahaya Hoshino") {
  const status = await getMarriageStatus(userId, survival);
  if (!status.isMarried) {
    return { ok: false, reason: "not_married" };
  }

  const state = (survival && survival.rpg_state) || {};
  if (state.has_child) {
    return { ok: false, reason: "already_has_child" };
  }

  const unlockedCgs = Array.isArray(state.unlocked_cgs) ? [...state.unlocked_cgs] : [];
  const familyCgId = `family_${status.spouseId}`;
  if (!unlockedCgs.includes(familyCgId)) {
    unlockedCgs.push(familyCgId);
  }

  survival.rpg_state = {
    ...state,
    has_child: true,
    child_name: childName,
    child_born_at: new Date().toISOString(),
    unlocked_cgs: unlockedCgs,
  };

  if (typeof survival.changed === "function") survival.changed("rpg_state", true);
  if (typeof survival.save === "function") {
    await survival.save({ fields: ["rpg_state"] });
  }

  return { ok: true, cgId: familyCgId };
}

/**
 * Memeriksa apakah sebuah Visual CG sudah resmi dibuka oleh pemain
 * @param {object} survival
 * @param {string} cgId
 * @returns {boolean}
 */
function isCgUnlocked(survival, cgId) {
  const state = (survival && survival.rpg_state) || {};
  const list = Array.isArray(state.unlocked_cgs) ? state.unlocked_cgs : [];
  return list.includes(cgId);
}

/**
 * Membuka Visual CG baru dan menyimpannya ke profil pemain
 * @param {object} survival
 * @param {string} cgId
 * @returns {Promise<boolean>}
 */
async function unlockCg(survival, cgId) {
  if (!survival || !cgId) return false;
  const state = survival.rpg_state || {};
  const list = Array.isArray(state.unlocked_cgs) ? [...state.unlocked_cgs] : [];

  if (list.includes(cgId)) return true; // Sudah terbuka sebelumnya

  list.push(cgId);
  survival.rpg_state = { ...state, unlocked_cgs: list };

  if (typeof survival.changed === "function") survival.changed("rpg_state", true);
  if (typeof survival.save === "function") {
    await survival.save({ fields: ["rpg_state"] });
  }
  return true;
}

module.exports = {
  ROMANCEABLE_FEMALES,
  SPOUSAL_DATA,
  getMarriageStatus,
  marryNpc,
  triggerParenthood,
  isCgUnlocked,
  unlockCg,
};
