"use strict";

/**
 * seasonPassEngine.js - Dynamic Seasonal Battle Pass & Star Path Milestones
 *
 * Mengelola progresi level musiman (Tier 1 - 50) Naura Wilds:
 * - Kalkulasi XP musiman dan kurva progresi matematis (Law 5)
 * - Katalog hadiah Jalur Gratis (Free) & Jalur Premium (Star Pass)
 * - Logika klaim hadiah atomik berbasis array klaim persisten
 */

const MAX_PASS_TIER = 50;
const BASE_TIER_XP = 500;
const TIER_XP_INCREMENT = 150;

/**
 * Menghitung kebutuhan XP untuk naik dari tier saat ini ke tier berikutnya.
 * @param {number} tier - Tier saat ini (1 s/d 50)
 * @returns {number}
 */
function getXpForTier(tier) {
  const safeTier = Math.max(
    1,
    Math.min(MAX_PASS_TIER, Math.floor(Number(tier) || 1)),
  );
  return BASE_TIER_XP + (safeTier - 1) * TIER_XP_INCREMENT;
}

/**
 * Menghitung total XP kumulatif yang dibutuhkan untuk mencapai suatu tier.
 * @param {number} targetTier - Tier tujuan (1 s/d 50)
 * @returns {number}
 */
function getTotalXpForTier(targetTier) {
  const safeTier = Math.max(
    1,
    Math.min(MAX_PASS_TIER, Math.floor(Number(targetTier) || 1)),
  );
  let total = 0;
  for (let t = 1; t < safeTier; t++) {
    total += getXpForTier(t);
  }
  return total;
}

/**
 * Menghitung status progresi tier saat ini berdasarkan total Season XP pemain.
 * @param {number} totalXp - Total XP Season Pass yang dikumpulkan pemain
 * @returns {{ tier: number, currentTierXp: number, xpNeeded: number, progressPercent: number, isMaxTier: boolean }}
 */
function calculatePassProgress(totalXp) {
  const safeXp = Math.max(0, Math.floor(Number(totalXp) || 0));

  let currentTier = 1;
  let remainingXp = safeXp;

  while (currentTier < MAX_PASS_TIER) {
    const needed = getXpForTier(currentTier);
    if (remainingXp >= needed) {
      remainingXp -= needed;
      currentTier++;
    } else {
      break;
    }
  }

  const isMaxTier = currentTier >= MAX_PASS_TIER;
  const xpNeeded = isMaxTier ? 0 : getXpForTier(currentTier);
  const progressPercent = isMaxTier
    ? 100
    : Math.min(100, Math.floor((remainingXp / xpNeeded) * 100));

  return {
    tier: currentTier,
    currentTierXp: isMaxTier ? 0 : remainingXp,
    xpNeeded,
    progressPercent,
    isMaxTier,
  };
}

/**
 * Menghasilkan katalog hadiah deterministik untuk tiap tier.
 * @param {number} tier - 1 s/d 50
 * @returns {{ free: Array<{ type: string, amount: number, label: string }>, premium: Array<{ type: string, amount: number, label: string }> }}
 */
function getTierRewards(tier) {
  const safeTier = Math.max(
    1,
    Math.min(MAX_PASS_TIER, Math.floor(Number(tier) || 1)),
  );

  // 1. Hadiah Jalur Gratis
  const free = [];
  const baseFragments = 150 + safeTier * 25;
  free.push({
    type: "fragments",
    amount: baseFragments,
    label: `${baseFragments.toLocaleString("id-ID")} NSF`,
  });

  if (safeTier % 5 === 0) {
    // Tiap kelipatan 5: Rations / Repair Kits
    free.push({
      type: "item",
      id: "survival_rations",
      amount: 2,
      label: "2x Survival Rations",
    });
  }
  if (safeTier % 10 === 0) {
    // Tiap kelipatan 10: Naura Coupon gratis
    free.push({ type: "coupons", amount: 1, label: "1x Naura Coupon" });
  }

  // 2. Hadiah Jalur Premium
  const premium = [];
  const premFragments = 300 + safeTier * 50;
  premium.push({
    type: "fragments",
    amount: premFragments,
    label: `${premFragments.toLocaleString("id-ID")} NSF`,
  });

  if (safeTier % 2 === 0) {
    premium.push({ type: "coupons", amount: 1, label: "1x Naura Coupon" });
  }
  if (safeTier % 5 === 0) {
    premium.push({
      type: "item",
      id: "starlight_crystal",
      amount: 1,
      label: "1x Starlight Crystal",
    });
  }
  if (safeTier === MAX_PASS_TIER) {
    premium.push({
      type: "title",
      id: "astral_pioneer",
      amount: 1,
      label: "Gelar Eksklusif: [Astral Pioneer]",
    });
  }

  return { free, premium };
}

/**
 * Memvalidasi dan mengeksekusi klaim hadiah tier Season Pass secara murni (Law 5).
 * @param {Object} params
 * @param {number} params.playerTotalXp - Total XP season pemain
 * @param {number} params.targetTier - Tier yang ingin diklaim (1 s/d 50)
 * @param {'free'|'premium'} [params.track='free'] - Jalur yang diklaim
 * @param {boolean} [params.hasPremiumPass=false] - Status kepemilikan pass premium
 * @param {Array<string>} [params.claimedTiers=[]] - Daftar key klaim pemain (misal: 'free_1', 'premium_1')
 * @returns {{ ok: boolean, error?: string, rewards?: Array<Object>, updatedClaims?: Array<string> }}
 */
function evaluateTierClaim({
  playerTotalXp = 0,
  targetTier = 1,
  track = "free",
  hasPremiumPass = false,
  claimedTiers = [],
}) {
  const safeTier = Math.max(
    1,
    Math.min(MAX_PASS_TIER, Math.floor(Number(targetTier) || 1)),
  );
  const safeTrack = track === "premium" ? "premium" : "free";

  // Guard Clause 1: Verifikasi apakah tier sudah tercapai
  const { tier: currentUnlockedTier } = calculatePassProgress(playerTotalXp);
  if (currentUnlockedTier < safeTier) {
    return {
      ok: false,
      error: `Tier ${safeTier} belum terbuka. Tier kamu saat ini adalah ${currentUnlockedTier}.`,
    };
  }

  // Guard Clause 2: Verifikasi kepemilikan jalur premium
  if (safeTrack === "premium" && !hasPremiumPass) {
    return {
      ok: false,
      error:
        "Jalur Premium terkunci. Aktifkan Star Pass untuk mengklaim hadiah ini.",
    };
  }

  // Guard Clause 3: Cek apakah hadiah sudah pernah diklaim sebelumnya
  const claimKey = `${safeTrack}_${safeTier}`;
  const claimSet = new Set(claimedTiers);
  if (claimSet.has(claimKey)) {
    return {
      ok: false,
      error: `Hadiah Tier ${safeTier} (${safeTrack.toUpperCase()}) sudah pernah diklaim.`,
    };
  }

  // Jalur Utama (Happy Path): Berikan hadiah dan tambahkan ke daftar klaim
  const allRewards = getTierRewards(safeTier);
  const rewardsToGrant =
    safeTrack === "premium" ? allRewards.premium : allRewards.free;

  claimSet.add(claimKey);

  return {
    ok: true,
    rewards: rewardsToGrant,
    updatedClaims: Array.from(claimSet),
  };
}

module.exports = {
  MAX_PASS_TIER,
  BASE_TIER_XP,
  TIER_XP_INCREMENT,
  getXpForTier,
  getTotalXpForTier,
  calculatePassProgress,
  getTierRewards,
  evaluateTierClaim,
};
