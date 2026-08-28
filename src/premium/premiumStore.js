// Seluruh baca-tulis status premium dikumpulkan di sini agar jalur slash dan
// jalur prefix tidak lagi memakai cara yang berbeda.
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");
const env = require("../config/env");

const DAY_MS = 24 * 60 * 60 * 1000;

function isOwner(userId) {
  return Boolean(env.OWNER_IDS && env.OWNER_IDS.includes(userId));
}

// premiumUntil bisa datang sebagai Date dari database atau string dari cache.
// Tanpa normalisasi ini, perbandingan string dengan Date menghasilkan NaN dan
// member premium aktif terbaca sebagai reguler.
function toDate(value) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function expiryOf(profile) {
  return profile ? toDate(profile.premiumUntil) : null;
}

function isActive(profile) {
  if (!profile || !profile.isPremium) return false;
  const expiry = expiryOf(profile);
  return Boolean(expiry && expiry.getTime() > Date.now());
}

function daysLeft(profile) {
  const expiry = expiryOf(profile);
  if (!expiry) return 0;
  const diff = expiry.getTime() - Date.now();
  return diff > 0 ? Math.ceil(diff / DAY_MS) : 0;
}

// Menyimpan perubahan lewat instance model bila tersedia, dan jatuh ke
// cacheManager bila cache mengembalikan objek biasa.
async function persist(userId, profile, changes) {
  if (profile) Object.assign(profile, changes);

  if (profile && typeof profile.save === "function") {
    try {
      const fields =
        changes && typeof changes === "object"
          ? Object.keys(changes)
          : undefined;
      await profile.save(fields ? { fields } : undefined);
      return true;
    } catch (error) {
      logger.error(
        "[Premium Store] Gagal menyimpan lewat model:",
        error.message,
      );
    }
  }

  try {
    await cacheManager.updateUserProfile(userId, changes);
    return true;
  } catch (error) {
    logger.error("[Premium Store] Gagal menyimpan lewat cache:", error.message);
    return false;
  }
}

// Mencabut status yang sudah lewat masa berlakunya, dipanggil saat pengecekan.
async function expireIfNeeded(userId, profile) {
  if (!profile || !profile.isPremium) return false;
  const expiry = expiryOf(profile);
  if (!expiry || expiry.getTime() > Date.now()) return false;

  await persist(userId, profile, { isPremium: false, premiumUntil: null });
  return true;
}

// Menambah durasi. Bila premium masih aktif, sisa waktunya ditumpuk.
async function grantPremium(userId, profile, days) {
  const current = isActive(profile) ? expiryOf(profile) : null;
  const newExpiry = current
    ? new Date(current.getTime() + days * DAY_MS)
    : new Date(Date.now() + days * DAY_MS);

  await persist(userId, profile, { isPremium: true, premiumUntil: newExpiry });
  return newExpiry;
}

async function revokePremium(userId, profile) {
  return persist(userId, profile, { isPremium: false, premiumUntil: null });
}

module.exports = {
  DAY_MS,
  isOwner,
  toDate,
  expiryOf,
  isActive,
  daysLeft,
  persist,
  expireIfNeeded,
  grantPremium,
  revokePremium,
};
