const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

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

module.exports = { checkPremiumStatus };
