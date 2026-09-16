"use strict";

// Perhitungan data profil survival. Dipisah dari subcommand info supaya
// tampilannya mudah disunting tanpa menyentuh rumus level, stat, dan saldo.

const ui = require("../../config/ui");
const survivalUI = require("../../utils/survivalUIHelper");
const leveling = require("../engines/survivalLeveling");
const currencyHelper = require("../engines/currency");
const { getTimeState } = require("./survivalTime");
const { safeParseInventory } = require("../engines/inventoryHelper");
const { perksOf } = require("./specialEffects");
const StoryProgress = require("../../models/StoryProgress");
const storyData = require("../data/storyData");
const npcPerksEngine = require("../engines/npcPerksEngine");
const familyEngine = require("../engines/familyEngine");


const LOCATION_NAMES = {
  desa: "Desa Sukamaju",
  village: "Desa Sukamaju",
  desa_sukamaju: "Desa Sukamaju",
  sukamaju: "Desa Sukamaju",
  jalanan: "Pinggir Jalan",
  kota: "Kota Pratama",
  city: "Kota Pratama",
  kota_pratama: "Kota Pratama",
  pratama: "Kota Pratama",
  hutan: "Hutan Desa Sukamaju",
  laut: "Pesisir Sukamaju",
  pantai: "Pesisir Sukamaju",
  sawah: "Sawah Sukamaju",
  tambang: "Tambang Sukamaju",
  khulkhas: "Desa Khul'Khas",
  desa_khulkhas: "Desa Khul'Khas",
  draken: "Istana Draken",
  istana_draken: "Istana Draken",
  academy: "Naura Academy",
  park: "Amusement Park",
  prison: "Penjara Kota",
};

const PROPERTY_NAMES = {
  jalanan: "Pinggir Jalan",
  gudang: "Gudang Tua",
  kos: "Kos-kosan",
  rumah: "Rumah Nyaman",
  mansion: "Mansion Mewah",
};


const DIFF_BADGE = {
  Mudah: "diff_easy",
  Normal: "diff_normal",
  Sulit: "diff_hard",
  Ekstrim: "diff_extreme",
};

const PET_BONUS = {
  wolf: { strength: 2, note: "+2 Strength" },
  cat: { luck: 2, note: "+2 Luck" },
  dragon: { strength: 3, luck: 1, note: "+3 Strength, +1 Luck" },
};

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

/** Level dan XP, sekaligus memperbaiki XP yang menumpuk karena bug lama. */
async function resolveLeveling(userId, survival) {
  let level = parseInt(survival.survival_level, 10) || 1;
  let xp = parseInt(survival.survival_xp, 10) || 0;
  let reqXP = leveling.getExpRequirement(level);

  if (xp >= reqXP) {
    const fixed = await leveling.addPlayerXP(userId, 0);
    level = fixed.currentLevel;
    xp = fixed.currentXP;
    reqXP = fixed.reqXP;
    survival.survival_level = level;
    survival.survival_xp = xp;
  }

  return { level, xp, reqXP, maxStat: leveling.getMaxStatCap(level) };
}

function resolvePet(activePets) {
  if (!Array.isArray(activePets) || activePets.length === 0) {
    return {
      bonusStrength: 0,
      bonusLuck: 0,
      display: "Belum ada teman setia",
      name: null,
    };
  }

  const pet = activePets[0];
  const name = pet.petName || pet.petType;
  const bonus = PET_BONUS[pet.petType] || null;

  let display = `${e("pet")} **${name}**`;
  if (bonus) display += `\n> *Efek: ${bonus.note}*`;

  return {
    bonusStrength: bonus?.strength || 0,
    bonusLuck: bonus?.luck || 0,
    display,
    name,
  };
}

/** Alat, senjata, dan zirah yang sedang dipegang pemain. */
function resolveGear(inventory) {
  const has = (fn) =>
    inventory.some((it) => it && typeof it.id === "string" && fn(it.id));
  const armorPieces = inventory.filter(
    (it) =>
      it && typeof it.id === "string" && /helmet|chestplate|boots/.test(it.id),
  );

  return {
    axe: has((id) => id.includes("axe")),
    pickaxe: has((id) => id.includes("pick")),
    rod: has((id) => id.includes("fishing") || id.includes("rod")),
    sword: has((id) => id.includes("sword") || id.includes("blade")),
    bow: has((id) => id.includes("bow")),
    armorCount: armorPieces.length,
    armorNames: armorPieces.map((it) => it.name || it.id),
  };
}

function resolveWeather(rpgState) {
  const name = rpgState.weather || "cerah";
  let emoji = e("clear_sky");
  if (name === "hujan") emoji = e("rain");
  if (name === "badai") emoji = e("badai");
  return { name, emoji };
}

/** Saldo tiga mata uang sekaligus, lengkap dengan emoji resminya. */
function resolveBalances(survival, profile) {
  const holders = { survival, profile };
  return [
    currencyHelper.FRAGMENT,
    currencyHelper.COIN,
    currencyHelper.COUPON,
  ].map((kind) => {
    const currency = currencyHelper.byKind(kind);
    return {
      kind,
      name: currency.name,
      emoji: currencyHelper.emojiOf(currency),
      amount: currencyHelper.balanceOf(currency, holders),
    };
  });
}

async function buildStats({ userId, profile, survival, activePets }) {
  const rpgState = survival.rpg_state || {};
  const inventory = safeParseInventory(profile.inventory);

  const lvl = await resolveLeveling(userId, survival);
  const pet = resolvePet(activePets);
  const gear = resolveGear(inventory);

  const maxHp = leveling.calculateMaxHp(
    survival,
    rpgState.class_bonus?.hp || 0,
  );
  const hp =
    survival.hp !== undefined && survival.hp !== null ? survival.hp : maxHp;

  const hpVital = survivalUI.buildVitalsBar({
    current: hp,
    target: maxHp,
    length: 8,
  });
  const hungerVital = survivalUI.buildVitalsBar({
    current: survival.hunger || 0,
    target: 100,
    length: 8,
  });
  const thirstVital = survivalUI.buildVitalsBar({
    current: survival.thirst || 0,
    target: 100,
    length: 8,
  });
  const staminaVital = survivalUI.buildVitalsBar({
    current: survival.stamina || 0,
    target: 100,
    length: 8,
  });
  const xpVital = survivalUI.buildVitalsBar({
    current: lvl.xp,
    target: lvl.reqXP,
    length: 8,
  });

  const locationKey = survival.currentLocation || "desa";
  const difficulty = rpgState.difficulty || "Normal";

  let mainObjective = null;
  try {
    const storyProgress = await StoryProgress.findOne({ where: { userId } });
    const currentArc = storyProgress ? storyProgress.currentArc : 1;
    const currentChapter = storyProgress ? storyProgress.currentChapter : 1;

    if (currentArc !== -1) {
      const arc = storyData.find((a) => a.arc === currentArc);
      const chapter = arc?.chapters?.find((c) => c.chapter === currentChapter);
      if (arc && chapter) {
        mainObjective = {
          arc: arc.arc,
          arcName: arc.arcName,
          chapter: chapter.chapter,
          title: chapter.title,
          targetNpc: chapter.speakerNpcId,
          challengeLabel: chapter.challenge?.btnLabel || "Selesaikan bab ini",
        };
      }
    }
  } catch (_) {}

  const friendshipBuffs = await npcPerksEngine.getUserActivePerksSummary(userId).catch(() => []);
  const spouseInfo = await familyEngine.getMarriageStatus(userId, survival).catch(() => ({
    isMarried: false,
    spouseId: null,
    spouseName: null,
  }));

  return {
    level: lvl.level,
    xp: lvl.xp,
    reqXP: lvl.reqXP,
    maxStat: lvl.maxStat,
    xpBar: xpVital.bar,
    xpVital,
    hp,
    maxHp,
    hpBar: hpVital.bar,
    hpVital,
    hungerBar: hungerVital.bar,
    hungerVital,
    thirstBar: thirstVital.bar,
    thirstVital,
    staminaBar: staminaVital.bar,
    staminaVital,
    pet,
    gear,
    balances: resolveBalances(survival, profile),
    perks: perksOf(survival),
    rpgState,
    difficulty,
    difficultyEmoji: e(DIFF_BADGE[difficulty] || "diff_normal"),
    rebirthCount: rpgState.rebirth_count || 0,
    locationName:
      LOCATION_NAMES[locationKey] || String(locationKey).toUpperCase(),
    propertyName: PROPERTY_NAMES[survival.propertyId] || "Pinggir Jalan",
    timeState: getTimeState(survival.inGameHour || 6),
    weather: resolveWeather(rpgState),
    isSick: Boolean(rpgState.sick),
    isRegistered: inventory.some((it) => it && it.id === "survival_started"),
    mainObjective,
    friendshipBuffs,
    spouseInfo,
  };
}


module.exports = { buildStats, LOCATION_NAMES, PROPERTY_NAMES, PET_BONUS };
