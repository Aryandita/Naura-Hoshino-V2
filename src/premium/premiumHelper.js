const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const ui = require("../config/ui");

/**
 * Mengecek dan memvalidasi status premium user menggunakan cacheManager (Read-Through Redis).
 * Jika premium sudah kadaluarsa, akan otomatis mengubah isPremium menjadi false di DB & Cache.
 * @param {string} userId - ID Discord User
 * @returns {Promise<boolean>} True jika masih premium, False jika tidak.
 */
async function checkPremiumStatus(userId) {
  if (!userId) return false;

  try {
    const userProfile = await cacheManager.getUserProfile(userId);

    if (!userProfile) return false;
    if (!userProfile.isPremium) return false;

    // Pengecekan Tanggal Kadaluarsa
    const now = new Date();
    const premiumUntil = userProfile.premiumUntil
      ? new Date(userProfile.premiumUntil)
      : null;

    if (premiumUntil && premiumUntil < now) {
      // Premium sudah habis! Cabut statusnya secara otomatis (Write-Behind)
      await cacheManager.updateUserProfile(userId, {
        isPremium: false,
        premiumUntil: null,
      });
      return false;
    }

    return true; // Lolos verifikasi, user adalah premium aktif
  } catch (error) {
    logger.error("[Premium Check Error]", error.message);
    return false;
  }
}

/**
 * Menentukan tier premium user berdasarkan sisa hari aktif.
 * @param {object} userProfile
 * @returns {string} 'none' | 'starter' | 'supporter' | 'friends' | 'vip'
 */
function getUserPremiumTier(userProfile) {
  if (!userProfile || !userProfile.isPremium || !userProfile.premiumUntil) {
    return "none";
  }
  const now = new Date();
  const until = new Date(userProfile.premiumUntil);
  if (until <= now) return "none";

  const diffMs = until.getTime() - now.getTime();
  const daysLeft = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  return ui.getPremiumTier(daysLeft, true);
}

/**
 * Mendapatkan pengali XP global berdasarkan tier.
 */
function getXpMultiplier(tier) {
  switch (tier) {
    case "vip":
      return 2.0;
    case "friends":
      return 1.75;
    case "supporter":
      return 1.5;
    case "starter":
      return 1.25;
    case "voter":
      return 1.15;
    default:
      return 1.0;
  }
}

/**
 * Mendapatkan pengali hadiah Minigame (Star Fragments / NSF).
 */
function getMinigameMultiplier(tier) {
  switch (tier) {
    case "vip":
      return 2.0;
    case "friends":
      return 1.5;
    case "supporter":
    case "starter":
      return 1.25;
    case "voter":
      return 1.15;
    default:
      return 1.0;
  }
}

/**
 * Mendapatkan bonus persentase gaji kerja Survival (/work).
 */
function getWorkWageBonus(tier) {
  switch (tier) {
    case "vip":
      return 1.0; // +100%
    case "friends":
      return 0.5; // +50%
    case "supporter":
      return 0.25; // +25%
    case "starter":
      return 0.15; // +15%
    case "voter":
      return 0.10; // +10%
    default:
      return 0.0;
  }
}

/**
 * Mendapatkan batas kapasitas penyimpanan Playlist musik.
 */
function getMaxPlaylists(tier) {
  switch (tier) {
    case "vip":
    case "friends":
      return Infinity;
    case "supporter":
      return 10;
    case "starter":
      return 5;
    default:
      return 3;
  }
}

module.exports = {
  checkPremiumStatus,
  getUserPremiumTier,
  getXpMultiplier,
  getMinigameMultiplier,
  getWorkWageBonus,
  getMaxPlaylists,
};
