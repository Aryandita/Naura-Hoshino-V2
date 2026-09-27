"use strict";

const crypto = require("node:crypto");
const { logger } = require("../managers/logger");
const mongoManager = require("../managers/mongoManager");
const DevAccessKey = require("../models/mongo/DevAccessKey");

// In-memory fallback saat MongoDB offline / untuk testing
const inMemoryKeys = new Map();

function generateKeyString() {
  const p1 = crypto.randomBytes(2).toString("hex").toUpperCase();
  const p2 = crypto.randomBytes(2).toString("hex").toUpperCase();
  return `NAURA-DEV-${p1}-${p2}`;
}

async function createKey({
  createdBy = "Owner",
  assignedToUserId = null,
  maxUses = 10,
  durationHours = 24,
}) {
  const keyString = generateKeyString();
  const parsedMaxUses = Number.isInteger(maxUses) && maxUses > 0 ? maxUses : 10;
  const expiresAt =
    typeof durationHours === "number" && !isNaN(durationHours)
      ? new Date(Date.now() + durationHours * 3600 * 1000)
      : null;

  const keyData = {
    keyString,
    createdBy,
    assignedToUserId: assignedToUserId || null,
    maxUses: parsedMaxUses,
    usedCount: 0,
    expiresAt,
    isActive: true,
    createdAt: new Date(),
  };

  if (mongoManager?.isReady && DevAccessKey?.create) {
    try {
      await DevAccessKey.create(keyData);
    } catch (err) {
      logger.warn(`[AccessKeyService] Gagal simpan ke Mongo, fallback memory: ${err.message}`);
      inMemoryKeys.set(keyString, keyData);
    }
  } else {
    inMemoryKeys.set(keyString, keyData);
  }

  logger.info(`[AccessKeyService] Kunci baru dibuat: ${keyString} (max: ${parsedMaxUses}, exp: ${expiresAt})`);
  return keyData;
}

async function getKey(keyString) {
  if (!keyString) return null;
  const clean = String(keyString).trim().toUpperCase();

  if (mongoManager?.isReady && DevAccessKey?.findOne) {
    try {
      const doc = await DevAccessKey.findOne({ keyString: clean }).lean();
      if (doc) return doc;
    } catch (err) {
      logger.warn(`[AccessKeyService] Gagal baca Mongo: ${err.message}`);
    }
  }

  return inMemoryKeys.get(clean) || null;
}

async function validateKey(keyString, userId = null) {
  if (!keyString) {
    return {
      valid: false,
      reason: "Kunci akses tidak disertakan. Masukkan kunci akses yang diberikan oleh Owner.",
    };
  }

  const keyData = await getKey(keyString);
  if (!keyData) {
    return {
      valid: false,
      reason: "Kunci akses tidak valid atau tidak terdaftar di sistem Naura.",
    };
  }

  // Periksa kuota pemakaian lebih dulu
  if (keyData.usedCount >= keyData.maxUses) {
    return {
      valid: false,
      reason: `Kuota pemakaian kunci akses telah habis (${keyData.usedCount}/${keyData.maxUses} kali digunakan).`,
    };
  }

  // Periksa tanggal kedaluwarsa
  if (keyData.expiresAt && new Date() > new Date(keyData.expiresAt)) {
    return {
      valid: false,
      reason: `Kunci akses ini telah kedaluwarsa pada ${new Date(keyData.expiresAt).toLocaleString("id-ID")}.`,
    };
  }

  if (!keyData.isActive) {
    return {
      valid: false,
      reason: "Kunci akses ini telah dicabut atau dinonaktifkan oleh Owner.",
    };
  }

  // Periksa apakah kunci dikunci khusus untuk user tertentu
  if (keyData.assignedToUserId && userId && keyData.assignedToUserId !== userId) {
    return {
      valid: false,
      reason: `Kunci akses ini terdaftar khusus untuk pengguna lain (<@${keyData.assignedToUserId}>).`,
    };
  }

  return {
    valid: true,
    keyData,
    remainingUses: keyData.maxUses - keyData.usedCount,
  };
}

async function consumeKey(keyString) {
  const clean = String(keyString).trim().toUpperCase();
  const keyData = await getKey(clean);
  if (!keyData) return null;

  const newUsedCount = (keyData.usedCount || 0) + 1;
  const shouldDeactivate = newUsedCount >= keyData.maxUses;

  if (mongoManager?.isReady && DevAccessKey?.findOneAndUpdate) {
    try {
      await DevAccessKey.findOneAndUpdate(
        { keyString: clean },
        {
          $inc: { usedCount: 1 },
          ...(shouldDeactivate ? { isActive: false } : {}),
        },
      );
    } catch (err) {
      logger.warn(`[AccessKeyService] Gagal update pemakaian di Mongo: ${err.message}`);
    }
  }

  keyData.usedCount = newUsedCount;
  if (shouldDeactivate) {
    keyData.isActive = false;
  }
  inMemoryKeys.set(clean, keyData);

  return keyData;
}

async function revokeKey(keyString) {
  const clean = String(keyString).trim().toUpperCase();
  const keyData = await getKey(clean);
  if (!keyData) return null;

  if (mongoManager?.isReady && DevAccessKey?.findOneAndUpdate) {
    try {
      await DevAccessKey.findOneAndUpdate(
        { keyString: clean },
        { isActive: false },
      );
    } catch (err) {
      logger.warn(`[AccessKeyService] Gagal revoke di Mongo: ${err.message}`);
    }
  }

  keyData.isActive = false;
  inMemoryKeys.set(clean, keyData);
  return keyData;
}

async function listKeys(limit = 15) {
  if (mongoManager?.isReady && DevAccessKey?.find) {
    try {
      return await DevAccessKey.find().sort({ createdAt: -1 }).limit(limit).lean();
    } catch (err) {
      logger.warn(`[AccessKeyService] Gagal list Mongo: ${err.message}`);
    }
  }

  return Array.from(inMemoryKeys.values())
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, limit);
}

module.exports = {
  generateKeyString,
  createKey,
  getKey,
  validateKey,
  consumeKey,
  revokeKey,
  listKeys,
  _inMemoryKeys: inMemoryKeys,
};
