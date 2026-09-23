// Lokasi: src/domain/decisions/dungeonDecisions.js
// Implementasi Law 5: Separate decisions from actions & Law 2: Name things by meaning
// Mesin kalkulasi murni (pure function) untuk keputusan dan status pertarungan dungeon tanpa I/O.

"use strict";

const VALID_CAVE_LOCATIONS = Object.freeze(["tambang", "desa", "village"]);
const MIN_VITAL_THRESHOLD = 20;
const DEFAULT_FREE_FLOOR_LIMIT = 50;

/**
 * Mengevaluasi kelayakan pemain untuk memasuki dungeon secara deterministik
 *
 * @param {Object} params
 * @param {string} params.currentLocation - Lokasi pemain saat ini
 * @param {number} params.hp - Poin HP pemain saat ini
 * @param {number} params.stamina - Poin Stamina pemain saat ini
 * @param {number} params.floor - Lantai dungeon yang dituju
 * @param {boolean} params.isPremium - Apakah akun pemain berstatus aktif premium
 * @param {number} params.normalPassCount - Jumlah tiket dungeon biasa
 * @param {number} params.specialPassCount - Jumlah tiket dungeon spesial
 * @param {number} [params.freeFloorLimit=50] - Batas lantai dungeon untuk pemain gratis
 * @returns {Readonly<{
 *   isAllowed: boolean,
 *   reasonCode: string|null,
 *   errorMessage: string|null,
 *   suggestShopCta: boolean
 * }>}
 */
function evaluateDungeonEntryRequirement({
  currentLocation,
  hp,
  stamina,
  floor = 1,
  isPremium = false,
  normalPassCount = 0,
  specialPassCount = 0,
  freeFloorLimit = DEFAULT_FREE_FLOOR_LIMIT,
}) {
  const safeNormal = Math.max(0, Number(normalPassCount) || 0);
  const safeSpecial = Math.max(0, Number(specialPassCount) || 0);
  const safeHp = Number(hp) || 0;
  const safeStamina = Number(stamina) || 0;
  const safeFloor = Math.max(1, Number(floor) || 1);

  // Guard 1: Ketersediaan tiket dungeon
  if (safeNormal < 1 && safeSpecial < 1) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "NO_PASS_AVAILABLE",
      errorMessage: "Kamu tidak memiliki tiket dungeon biasa maupun spesial.",
      suggestShopCta: true,
    });
  }

  // Guard 2: Validasi lokasi gua dungeon
  const loc = String(currentLocation || "").toLowerCase();
  if (!VALID_CAVE_LOCATIONS.includes(loc)) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "INVALID_LOCATION",
      errorMessage: "Pintu dungeon berada di gua tambang dekat desa.",
      suggestShopCta: false,
    });
  }

  // Guard 3: Batas kondisi fisik minimum (HP dan Stamina)
  if (safeHp <= MIN_VITAL_THRESHOLD || safeStamina <= MIN_VITAL_THRESHOLD) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "VITALS_TOO_LOW",
      errorMessage:
        "Kondisi fisikmu terlalu lemah (HP atau Stamina <= 20). Istirahatlah terlebih dahulu.",
      suggestShopCta: false,
    });
  }

  // Guard 4: Pembatasan lantai untuk pemain non-premium
  if (!isPremium && safeFloor > freeFloorLimit) {
    return Object.freeze({
      isAllowed: false,
      reasonCode: "FREE_FLOOR_LIMIT_EXCEEDED",
      errorMessage: `Lantai ${freeFloorLimit} adalah batas maksimal untuk penjelajah non-premium.`,
      suggestShopCta: false,
    });
  }

  return Object.freeze({
    isAllowed: true,
    reasonCode: null,
    errorMessage: null,
    suggestShopCta: false,
  });
}

/**
 * Menghitung kalkulasi satu putaran serangan dungeon
 *
 * @param {Object} params
 * @param {number} params.playerDamage - Damage yang dihasilkan pemain
 * @param {number} params.playerHp - Sisa HP pemain
 * @param {number} params.enemyHp - Sisa HP musuh
 * @param {number} params.enemyDamage - Damage yang dihasilkan musuh
 * @param {boolean} [params.dodgeSuccess=false] - Apakah pemain berhasil menghindar
 * @returns {Readonly<{
 *   nextPlayerHp: number,
 *   nextEnemyHp: number,
 *   effectiveEnemyHit: number,
 *   roundStatus: "ONGOING"|"PLAYER_VICTORY"|"PLAYER_DEFEAT"
 * }>}
 */
function evaluateCombatRound({
  playerDamage,
  playerHp,
  enemyHp,
  enemyDamage,
  dodgeSuccess = false,
}) {
  const safePlayerDmg = Math.max(0, Math.floor(Number(playerDamage) || 0));
  const safeEnemyDmg = Math.max(0, Math.floor(Number(enemyDamage) || 0));
  const initialPlayerHp = Math.max(0, Math.floor(Number(playerHp) || 0));
  const initialEnemyHp = Math.max(0, Math.floor(Number(enemyHp) || 0));

  const nextEnemyHp = Math.max(0, initialEnemyHp - safePlayerDmg);

  // Jika musuh tumbang pada serangan pemain
  if (nextEnemyHp === 0) {
    return Object.freeze({
      nextPlayerHp: initialPlayerHp,
      nextEnemyHp: 0,
      effectiveEnemyHit: 0,
      roundStatus: "PLAYER_VICTORY",
    });
  }

  // Jika musuh masih hidup, musuh membalas serangan
  const effectiveEnemyHit = dodgeSuccess ? 0 : safeEnemyDmg;
  const nextPlayerHp = Math.max(0, initialPlayerHp - effectiveEnemyHit);

  const roundStatus = nextPlayerHp === 0 ? "PLAYER_DEFEAT" : "ONGOING";

  return Object.freeze({
    nextPlayerHp,
    nextEnemyHp,
    effectiveEnemyHit,
    roundStatus,
  });
}

module.exports = {
  VALID_CAVE_LOCATIONS,
  MIN_VITAL_THRESHOLD,
  DEFAULT_FREE_FLOOR_LIMIT,
  evaluateDungeonEntryRequirement,
  evaluateCombatRound,
};
