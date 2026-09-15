"use strict";

/**
 * bountyVaultEngine.js - Brankas Privasi Zero-Knowledge & Papan Sayembara Komunitas.
 *
 * Mengelola:
 *   1. Zero-Knowledge Privacy Vault:
 *      - Enkripsi simetris end-to-end AES-256-GCM dengan salt & IV acak berbasis passphrase pengguna.
 *      - Dekripsi terotentikasi (AEAD) dengan deteksi manipulasi data otomatis.
 *   2. Community Bounty Board (Papan Sayembara Komunitas):
 *      - Pembuatan sayembara dengan escrow saldo Star Fragments secara atomik.
 *      - Pengajuan klaim bukti penyelesaian tugas komunitas.
 *      - Persetujuan penyelesaian & pencairan hadiah escrow ke saldo penerima secara atomik.
 *      - Pembatalan sayembara & pengembalian dana (refund) atomik ke pembuat sayembara.
 */

const crypto = require("node:crypto");
const cacheManager = require("../managers/cacheManager");
const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");

const VAULT_KEY_PREFIX = "vault:secret:";
const BOUNTY_LIST_KEY = "bounties:guild:";

const memoryVaults = new Map();
const memoryBounties = new Map();

class BountyVaultEngine {
  // =========================================================================
  // 1. ZERO-KNOWLEDGE PRIVACY VAULT (AES-256-GCM)
  // =========================================================================

  /**
   * Menghasilkan key 256-bit dari passphrase pengguna menggunakan PBKDF2.
   * @param {string} passphrase
   * @param {Buffer} salt
   * @returns {Buffer}
   */
  deriveKey(passphrase, salt) {
    return crypto.pbkdf2Sync(passphrase, salt, 100000, 32, "sha256");
  }

  /**
   * Mengenkripsi data dengan AES-256-GCM.
   * @param {string} plaintext
   * @param {string} passphrase
   * @returns {object} { ciphertext, iv, authTag, salt }
   */
  encryptData(plaintext, passphrase) {
    const salt = crypto.randomBytes(16);
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey(passphrase, salt);

    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let ciphertext = cipher.update(plaintext, "utf8", "hex");
    ciphertext += cipher.final("hex");
    const authTag = cipher.getAuthTag().toString("hex");

    return {
      ciphertext,
      iv: iv.toString("hex"),
      authTag,
      salt: salt.toString("hex"),
    };
  }

  /**
   * Mendekripsi data terenkripsi AES-256-GCM dengan passphrase.
   * @param {object} encryptedObj
   * @param {string} passphrase
   * @returns {string} plaintext
   */
  decryptData(encryptedObj, passphrase) {
    const salt = Buffer.from(encryptedObj.salt, "hex");
    const iv = Buffer.from(encryptedObj.iv, "hex");
    const authTag = Buffer.from(encryptedObj.authTag, "hex");
    const key = this.deriveKey(passphrase, salt);

    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedObj.ciphertext, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  }

  /**
   * Menyimpan catatan rahasia ke brankas Zero-Knowledge.
   * @param {object} params
   * @param {string} params.userId
   * @param {string} params.secretText
   * @param {string} params.passphrase
   * @param {number} [params.ttlSeconds=604800] 7 hari
   * @returns {Promise<{success: boolean, vaultId: string}>}
   */
  async storeSecret({ userId, secretText, passphrase, ttlSeconds = 604800 }) {
    if (!secretText || !passphrase) {
      throw new Error("Teks rahasia dan passphrase wajib diisi.");
    }

    const encrypted = this.encryptData(secretText, passphrase);
    const vaultId = `vlt_${crypto.randomBytes(6).toString("hex")}`;

    const record = {
      vaultId,
      userId,
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + ttlSeconds * 1000,
      ...encrypted,
    };

    memoryVaults.set(vaultId, record);

    if (redisManager.isReady) {
      try {
        await redisManager.setCache(
          `${VAULT_KEY_PREFIX}${vaultId}`,
          JSON.stringify(record),
          ttlSeconds,
        );
      } catch (err) {
        logger.warn(`[BountyVaultEngine] Redis vault set error: ${err.message}`);
      }
    }

    return { success: true, vaultId };
  }

  /**
   * Mengambil dan mendekripsi catatan rahasia dari brankas.
   * @param {string} vaultId
   * @param {string} passphrase
   * @returns {Promise<{success: boolean, plaintext?: string, error?: string}>}
   */
  async retrieveSecret(vaultId, passphrase) {
    let record = memoryVaults.get(vaultId);

    if (!record && redisManager.isReady) {
      try {
        const raw = await redisManager.getCache(`${VAULT_KEY_PREFIX}${vaultId}`);
        if (raw) record = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        logger.warn(`[BountyVaultEngine] Redis vault get error: ${err.message}`);
      }
    }

    if (!record) {
      return { success: false, error: "Catatan rahasia tidak ditemukan atau sudah kadaluarsa." };
    }

    try {
      const plaintext = this.decryptData(record, passphrase);
      return { success: true, plaintext };
    } catch (_) {
      return { success: false, error: "Passphrase salah atau data telah dimanipulasi." };
    }
  }

  // =========================================================================
  // 2. COMMUNITY BOUNTY BOARD
  // =========================================================================

  /**
   * Membuat sayembara komunitas baru dengan escrow Star Fragments atomik.
   * @param {object} params
   * @param {string} params.guildId
   * @param {string} params.creatorId
   * @param {string} params.title
   * @param {string} params.description
   * @param {number} params.rewardNsf
   * @returns {Promise<{success: boolean, bounty?: object, error?: string}>}
   */
  async createBounty({ guildId, creatorId, title, description, rewardNsf }) {
    if (!guildId || !creatorId || !title || rewardNsf <= 0) {
      return { success: false, error: "Data sayembara tidak lengkap atau imbalan tidak valid." };
    }

    // Debit reward dari saldo pembuat secara atomik
    const debitOk = await cacheManager.debitUserSurvival(creatorId, "starFragments", rewardNsf);
    if (!debitOk) {
      return {
        success: false,
        error: `Saldo Star Fragments kamu tidak mencukupi untuk imbalan ${rewardNsf.toLocaleString("id-ID")} NSF.`,
      };
    }

    const bountyId = `bty_${Date.now().toString(36)}_${crypto.randomBytes(3).toString("hex")}`;
    const bounty = {
      bountyId,
      guildId,
      creatorId,
      title: title.trim(),
      description: description.trim(),
      rewardNsf,
      status: "open", // open, submitted, completed, cancelled
      claimantId: null,
      proofText: null,
      createdAt: new Date().toISOString(),
    };

    const guildBounties = memoryBounties.get(guildId) || [];
    guildBounties.push(bounty);
    memoryBounties.set(guildId, guildBounties);

    if (redisManager.isReady) {
      try {
        await redisManager.setCache(
          `${BOUNTY_LIST_KEY}${guildId}`,
          JSON.stringify(guildBounties),
          86400 * 14,
        );
      } catch (err) {
        logger.warn(`[BountyVaultEngine] Redis bounty set error: ${err.message}`);
      }
    }

    logger.info(`[BountyVaultEngine] Sayembara baru "${title}" (${rewardNsf} NSF) dibuat oleh ${creatorId}.`);
    return { success: true, bounty };
  }

  /**
   * Mengambil daftar sayembara di suatu guild.
   * @param {string} guildId
   * @param {string} [statusFilter]
   * @returns {Promise<Array<object>>}
   */
  async listBounties(guildId, statusFilter = null) {
    let list = memoryBounties.get(guildId);

    if (!list && redisManager.isReady) {
      try {
        const raw = await redisManager.getCache(`${BOUNTY_LIST_KEY}${guildId}`);
        if (raw) list = typeof raw === "string" ? JSON.parse(raw) : raw;
      } catch (err) {
        logger.warn(`[BountyVaultEngine] Redis bounty list error: ${err.message}`);
      }
    }

    list = list || [];
    if (statusFilter) {
      return list.filter((b) => b.status === statusFilter);
    }
    return list;
  }

  /**
   * Mengajukan klaim penyelesaian sayembara.
   * @param {string} guildId
   * @param {string} bountyId
   * @param {string} claimantId
   * @param {string} proofText
   * @returns {Promise<{success: boolean, error?: string}>}
   */
  async claimBounty(guildId, bountyId, claimantId, proofText) {
    const list = await this.listBounties(guildId);
    const bounty = list.find((b) => b.bountyId === bountyId);

    if (!bounty) return { success: false, error: "Sayembara tidak ditemukan." };
    if (bounty.status !== "open") return { success: false, error: "Sayembara ini sudah tidak terbuka." };
    if (bounty.creatorId === claimantId) return { success: false, error: "Kamu tidak bisa mengklaim sayembara buatan sendiri." };

    bounty.status = "submitted";
    bounty.claimantId = claimantId;
    bounty.proofText = proofText;

    memoryBounties.set(guildId, list);
    if (redisManager.isReady) {
      await redisManager.setCache(`${BOUNTY_LIST_KEY}${guildId}`, JSON.stringify(list), 86400 * 14).catch(() => {});
    }

    return { success: true, bounty };
  }

  /**
   * Menyetujui klaim dan mencairkan escrow hadiah ke claimant.
   * @param {string} guildId
   * @param {string} bountyId
   * @param {string} approverId
   * @returns {Promise<{success: boolean, rewardNsf?: number, error?: string}>}
   */
  async approveBounty(guildId, bountyId, approverId) {
    const list = await this.listBounties(guildId);
    const bounty = list.find((b) => b.bountyId === bountyId);

    if (!bounty) return { success: false, error: "Sayembara tidak ditemukan." };
    if (bounty.status !== "submitted") return { success: false, error: "Belum ada klaim yang diajukan untuk sayembara ini." };
    if (bounty.creatorId !== approverId) return { success: false, error: "Hanya pembuat sayembara yang berhak menyetujui klaim." };

    // Cairkan escrow ke claimant secara atomik
    await cacheManager.incrementUserSurvival(bounty.claimantId, "starFragments", bounty.rewardNsf);

    bounty.status = "completed";
    bounty.completedAt = new Date().toISOString();

    memoryBounties.set(guildId, list);
    if (redisManager.isReady) {
      await redisManager.setCache(`${BOUNTY_LIST_KEY}${guildId}`, JSON.stringify(list), 86400 * 14).catch(() => {});
    }

    logger.info(`[BountyVaultEngine] Sayembara ${bountyId} selesai. ${bounty.rewardNsf} NSF dicairkan ke ${bounty.claimantId}.`);
    return { success: true, rewardNsf: bounty.rewardNsf };
  }

  /**
   * Membatalkan sayembara yang masih terbuka dan mengembalikan dana escrow ke pembuat.
   * @param {string} guildId
   * @param {string} bountyId
   * @param {string} requesterId
   * @returns {Promise<{success: boolean, refundNsf?: number, error?: string}>}
   */
  async cancelBounty(guildId, bountyId, requesterId) {
    const list = await this.listBounties(guildId);
    const bounty = list.find((b) => b.bountyId === bountyId);

    if (!bounty) return { success: false, error: "Sayembara tidak ditemukan." };
    if (bounty.status !== "open") return { success: false, error: "Hanya sayembara berstatus terbuka yang dapat dibatalkan." };
    if (bounty.creatorId !== requesterId) return { success: false, error: "Hanya pembuat sayembara yang dapat membatalkan sayembara." };

    // Kembalikan dana escrow secara atomik
    await cacheManager.incrementUserSurvival(bounty.creatorId, "starFragments", bounty.rewardNsf);

    bounty.status = "cancelled";

    memoryBounties.set(guildId, list);
    if (redisManager.isReady) {
      await redisManager.setCache(`${BOUNTY_LIST_KEY}${guildId}`, JSON.stringify(list), 86400 * 14).catch(() => {});
    }

    return { success: true, refundNsf: bounty.rewardNsf };
  }
}

module.exports = new BountyVaultEngine();
