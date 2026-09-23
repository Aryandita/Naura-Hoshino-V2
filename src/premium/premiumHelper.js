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
      return 0.1; // +10%
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

/**
 * Mendapatkan persentase diskon aus ketahanan alat (Durability Shield).
 */
function getDurabilityDiscount(tier) {
  switch (tier) {
    case "vip":
      return 0.5; // 50% lebih awet
    case "friends":
      return 0.4; // 40% lebih awet
    case "supporter":
      return 0.3; // 30% lebih awet
    case "starter":
      return 0.15; // 15% lebih awet
    default:
      return 0.0;
  }
}

/**
 * Mendapatkan persentase potongan pajak pasar / bursa lelang (Tax Haven).
 */
function getMarketTaxDiscount(tier) {
  switch (tier) {
    case "vip":
    case "friends":
    case "supporter":
      return 0.5; // Diskon 50% pajak pasar
    case "starter":
      return 0.25; // Diskon 25% pajak pasar
    default:
      return 0.0;
  }
}

/**
 * Mendapatkan persentase pemangkasan cooldown aksi survival.
 */
function getCooldownReduction(tier) {
  switch (tier) {
    case "vip":
      return 0.4; // 40% lebih cepat
    case "friends":
      return 0.3; // 30% lebih cepat
    case "supporter":
      return 0.2; // 20% lebih cepat
    case "starter":
      return 0.1; // 10% lebih cepat
    default:
      return 0.0;
  }
}

/**
 * Mendapatkan batas maksimal energi karakter (Max Energy Cap).
 */
function getMaxEnergy(tier) {
  switch (tier) {
    case "vip":
      return 150;
    case "friends":
      return 135;
    case "supporter":
      return 125;
    case "starter":
      return 115;
    default:
      return 100;
  }
}

/**
 * Mendapatkan paket dividen harian anggota premium (/premium claim).
 */
function getDailyStipend(tier) {
  switch (tier) {
    case "vip":
      return {
        coupons: 3,
        nsf: 2000,
        mysteryBox: "legendary_relic_box",
        dungeonKeys: 2,
      };
    case "friends":
      return {
        coupons: 2,
        nsf: 800,
        mysteryBox: "rare_mystery_box",
        dungeonKeys: 1,
      };
    case "supporter":
      return {
        coupons: 1,
        nsf: 350,
        mysteryBox: "common_mystery_box",
        dungeonKeys: 0,
      };
    case "starter":
      return { coupons: 0, nsf: 150, mysteryBox: null, dungeonKeys: 0 };
    default:
      return null;
  }
}

/**
 * Mengambil persona kustom obrolan AI yang dipilih pengguna.
 */
function getCustomPersona(userProfile) {
  if (!userProfile || !userProfile.isPremium) return "default";
  return userProfile.customPersona || "default";
}

module.exports = {
  checkPremiumStatus,
  getUserPremiumTier,
  getXpMultiplier,
  getMinigameMultiplier,
  getWorkWageBonus,
  getMaxPlaylists,
  getDurabilityDiscount,
  getMarketTaxDiscount,
  getCooldownReduction,
  getMaxEnergy,
  getDailyStipend,
  getCustomPersona,
};
