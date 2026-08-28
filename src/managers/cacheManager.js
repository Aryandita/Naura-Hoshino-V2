// src/managers/cacheManager.js
const { Op } = require("sequelize");
const redisManager = require("./redisManager");
const { logger } = require("../managers/logger");
const { sequelize } = require("./dbManager");
const UserProfile = require("../models/UserProfile");
const UserSurvival = require("../models/UserSurvival");
const GuildSettings = require("../models/GuildSettings");

// Jeda pengumpulan tulisan sebelum dikirim ke database. Semakin besar semakin
// hemat query, tetapi semakin banyak data yang berisiko hilang bila proses mati
// mendadak. Lima detik adalah kompromi yang aman karena shutdown() mem-flush antrean.
const FLUSH_INTERVAL_MS = 5000;

const PROFILE_TTL = 3600; // 1 jam
const SURVIVAL_TTL = 1800; // 30 menit
const GUILD_TTL = 300; // 5 menit

// Nama kolom hanya boleh berasal dari skema model. Pola ini menutup kemungkinan
// nama kolom dinamis menyusup ke dalam ekspresi SQL.
const SAFE_COLUMN = /^[A-Za-z_][A-Za-z0-9_]*$/;

function quoteColumn(field) {
  try {
    return sequelize.getQueryInterface().quoteIdentifier(field);
  } catch (error) {
    return `"${field}"`;
  }
}

// Salinan dalam untuk nilai kolom JSON. Mutator harus bekerja pada salinan, bukan
// pada objek milik instance model, supaya pembatalan benar-benar tidak menyisakan
// perubahan apa pun di memori.
function cloneJson(value) {
  if (value === null || typeof value !== "object") return value;
  try {
    return structuredClone(value);
  } catch (error) {
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (parseError) {
      return value;
    }
  }
}

/**
 * CacheManager: Read-Through and Write-Behind Caching Layer
 *
 * Empat aturan penting:
 * 1. Nilai absolut (nama, status, timestamp) memakai update*(). Nilai yang bersifat
 *    akumulatif (koin, XP, HP) WAJIB memakai increment*() supaya perubahan dari dua
 *    shard tidak saling menimpa.
 * 2. Pengurangan saldo yang tidak boleh minus WAJIB memakai debit*(), bukan
 *    increment*() dengan angka negatif. Hanya debit*() yang memeriksa kecukupan
 *    saldo di dalam query yang sama dengan pemotongannya.
 * 3. Kolom JSON (inventory, rpg_state, cooldowns, economy_investments) WAJIB diubah
 *    lewat mutate*Json(). Kolom JSON tidak bisa dimajukan dengan increment SQL,
 *    jadi satu-satunya cara aman adalah mengunci barisnya.
 * 4. Semua tulisan tertunda harus bisa di-flush lewat flushAll() saat shutdown.
 */
class CacheManager {
  constructor() {
    // userId -> { set: {...}, inc: {...} }
    this.writeQueue = new Map(); // UserProfile
    this.survivalQueue = new Map(); // UserSurvival
    this.flushTimer = null;
    this.isFlushing = false;
    this._currentFlush = null;
  }

  /** Jumlah user yang masih menunggu ditulis ke database. */
  get pendingWrites() {
    return this.writeQueue.size + this.survivalQueue.size;
  }

  // ==========================================
  // ✍️ ANTREAN TULIS (WRITE-BEHIND)
  // ==========================================

  _enqueue(queue, userId, { set = null, inc = null } = {}) {
    if (!userId) return;
    if (!queue.has(userId)) queue.set(userId, { set: {}, inc: {} });
    const entry = queue.get(userId);

    if (set && typeof set === "object") {
      for (const [field, value] of Object.entries(set)) {
        if (!SAFE_COLUMN.test(field)) continue;
        entry.set[field] = value;
        // Nilai absolut yang lebih baru membatalkan delta yang belum ditulis.
        delete entry.inc[field];
      }
    }

    if (inc && typeof inc === "object") {
      for (const [field, delta] of Object.entries(inc)) {
        if (!SAFE_COLUMN.test(field)) continue;
        const amount = Number(delta) || 0;
        if (Object.prototype.hasOwnProperty.call(entry.set, field)) {
          // Sudah ada nilai absolut menunggu; majukan nilainya saja.
          entry.set[field] = (Number(entry.set[field]) || 0) + amount;
        } else {
          entry.inc[field] = (entry.inc[field] || 0) + amount;
        }
      }
    }

    this._scheduleFlush();
  }

  _scheduleFlush() {
    if (this.flushTimer) return;
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null;
      this.flushAll().catch((err) =>
        logger.error("[CacheManager] Flush terjadwal gagal:", err.message),
      );
    }, FLUSH_INTERVAL_MS);
    if (this.flushTimer.unref) this.flushTimer.unref();
  }

  /**
   * Menulis seluruh antrean ke database. Aman dipanggil berkali-kali; pemanggilan
   * yang tumpang tindih akan menunggu putaran yang sedang berjalan.
   */
  async flushAll() {
    if (this.isFlushing && this._currentFlush) {
      await this._currentFlush;
    }
    if (this.pendingWrites === 0) return;

    this.isFlushing = true;
    this._currentFlush = Promise.all([
      this._flushQueue(this.writeQueue, UserProfile, "UserProfile"),
      this._flushQueue(this.survivalQueue, UserSurvival, "UserSurvival"),
    ]);

    try {
      await this._currentFlush;
    } finally {
      this.isFlushing = false;
      this._currentFlush = null;
    }
  }

  /**
   * Menulis antrean milik satu user saja.
   *
   * Wajib dipanggil sebelum pemotongan bersyarat. Tanpa ini, syarat
   * `saldo >= nominal` dievaluasi terhadap nilai lama di database, sementara
   * penambahan yang baru saja terjadi masih menunggu di antrean.
   */
  async flushUser(userId) {
    if (!userId) return;
    await this._flushOne(this.writeQueue, UserProfile, "UserProfile", userId);
    await this._flushOne(
      this.survivalQueue,
      UserSurvival,
      "UserSurvival",
      userId,
    );
  }

  async _flushOne(queue, Model, label, userId) {
    const entry = queue.get(userId);
    if (!entry) return;
    queue.delete(userId);

    try {
      const validAttributes =
        Model && Model.rawAttributes ? Model.rawAttributes : null;
      const setKeys = Object.keys(entry.set).filter(
        (k) => SAFE_COLUMN.test(k) && (!validAttributes || validAttributes[k]),
      );
      const incKeys = Object.keys(entry.inc).filter(
        (k) => SAFE_COLUMN.test(k) && (!validAttributes || validAttributes[k]),
      );

      if (setKeys.length > 0) {
        const safeSet = {};
        for (const k of setKeys) safeSet[k] = entry.set[k];
        await Model.update(safeSet, { where: { userId } });
      }
      if (incKeys.length > 0) {
        const safeInc = {};
        for (const k of incKeys) safeInc[k] = entry.inc[k];
        await Model.increment(safeInc, { where: { userId } });
      }
    } catch (error) {
      logger.error(
        `[CacheManager] Gagal menulis ${label} untuk ${userId}:`,
        error.message,
      );
    }
  }

  async _flushQueue(queue, Model, label) {
    if (queue.size === 0) return;

    const entries = Array.from(queue.entries());
    queue.clear();

    const validAttributes =
      Model && Model.rawAttributes ? Model.rawAttributes : null;

    for (const [userId, { set, inc }] of entries) {
      try {
        const setKeys = Object.keys(set).filter(
          (k) =>
            SAFE_COLUMN.test(k) && (!validAttributes || validAttributes[k]),
        );
        const incKeys = Object.keys(inc).filter(
          (k) =>
            SAFE_COLUMN.test(k) && (!validAttributes || validAttributes[k]),
        );

        if (setKeys.length > 0) {
          const safeSet = {};
          for (const k of setKeys) safeSet[k] = set[k];
          await Model.update(safeSet, { where: { userId } });
        }
        if (incKeys.length > 0) {
          const safeInc = {};
          for (const k of incKeys) safeInc[k] = inc[k];
          await Model.increment(safeInc, { where: { userId } });
        }
      } catch (error) {
        logger.error(
          `[CacheManager] Gagal menulis ${label} untuk ${userId}:`,
          error.message,
        );
      }
    }
  }

  /** @deprecated Dipertahankan untuk pemanggil lama. Gunakan flushAll(). */
  async _processWriteQueue() {
    return this.flushAll();
  }

  /** Helper bersama untuk increment atomik pada model mana pun. */
  async _increment(userId, deltas, { cacheKey, ttl, loader, queue }) {
    if (!userId || !deltas || typeof deltas !== "object") return false;

    const cleanDeltas = {};
    for (const [field, delta] of Object.entries(deltas)) {
      if (SAFE_COLUMN.test(field)) {
        cleanDeltas[field] = Number(delta) || 0;
      }
    }
    if (Object.keys(cleanDeltas).length === 0) return false;

    try {
      const current = await loader();
      if (current) {
        for (const [field, delta] of Object.entries(cleanDeltas)) {
          current[field] = (Number(current[field]) || 0) + delta;
        }
        await redisManager.setCache(cacheKey, current, ttl);
      }
    } catch (error) {
      logger.error(
        "[CacheManager] Gagal memperbarui cache saat increment:",
        error.message,
      );
    }

    // Database tetap menerima delta, bukan hasil hitungan lokal.
    this._enqueue(queue, userId, { inc: cleanDeltas });
    return true;
  }

  /**
   * Memotong saldo lewat satu UPDATE bersyarat.
   *
   * Pola lama membaca saldo, membandingkannya di memori, lalu menulis hasilnya.
   * Dua klik yang tiba bersamaan sama-sama lolos pemeriksaan, sehingga uang yang
   * sama bisa dibelanjakan dua kali. Di sini pemeriksaan dan pemotongan terjadi
   * dalam satu pernyataan SQL, jadi klik kedua tidak menemukan baris yang cocok.
   *
   * Berbeda dari increment dengan angka negatif, fungsi ini tidak pernah
   * menghasilkan saldo minus.
   *
   * @returns {Promise<{ ok: boolean, amount?: number, reason?: string }>}
   */
  async _debit(userId, field, amount, { Model, cacheKey, label }) {
    const value = Math.floor(Number(amount) || 0);
    if (!userId || !field) return { ok: false, reason: "invalid" };
    if (value < 0) return { ok: false, reason: "invalid" };
    if (value === 0) return { ok: true, amount: 0 };
    if (!SAFE_COLUMN.test(field)) return { ok: false, reason: "invalid_field" };

    await this.flushUser(userId);

    try {
      const column = quoteColumn(field);
      const [affected] = await Model.update(
        { [field]: sequelize.literal(`${column} - ${value}`) },
        { where: { userId, [field]: { [Op.gte]: value } } },
      );

      if (!affected) return { ok: false, reason: "insufficient" };

      // Cache dihapus, bukan dihitung ulang di memori. Nilai yang benar hanya
      // diketahui oleh database setelah pemotongan.
      await redisManager.deleteCache(cacheKey);
      return { ok: true, amount: value };
    } catch (error) {
      logger.error(
        `[CacheManager] Gagal memotong ${label}.${field} untuk ${userId}:`,
        error.message,
      );
      return { ok: false, reason: "error" };
    }
  }

  /** Memotong kolom numerik UserProfile. Gagal bila saldo tidak cukup. */
  async debitUserProfile(userId, field, amount) {
    return this._debit(userId, field, amount, {
      Model: UserProfile,
      cacheKey: `user:profile:${userId}`,
      label: "UserProfile",
    });
  }

  /** Memotong kolom numerik UserSurvival. Gagal bila saldo tidak cukup. */
  async debitUserSurvival(userId, field, amount) {
    return this._debit(userId, field, amount, {
      Model: UserSurvival,
      cacheKey: `user:survival:${userId}`,
      label: "UserSurvival",
    });
  }

  // ==========================================
  // 🧩 PERUBAHAN KOLOM JSON (BACA-UBAH-TULIS AMAN)
  // ==========================================

  /**
   * Mengubah satu kolom JSON dengan barisnya dikunci lebih dulu.
   *
   * Kolom JSON tidak punya padanan `kolom = kolom + delta`, jadi increment atomik
   * tidak bisa dipakai. Yang dilakukan di sini: buka transaksi, ambil baris dengan
   * SELECT ... FOR UPDATE, ubah salinannya di memori, tulis satu kolom saja, lalu
   * lepas kunci. Klik kedua menunggu di kunci itu dan membaca hasil klik pertama.
   *
   * Pola lama (baca dari cache, ubah di memori, update*()) membuat dua klik yang
   * tiba bersamaan sama-sama menulis inventory versi lama plus satu barang, jadi
   * salah satu barang hilang. Pada tiket dungeon akibatnya lebih parah: keduanya
   * lolos pemeriksaan, tiket hanya berkurang satu, dan pertempuran jalan dua kali.
   *
   * @param {string} userId
   * @param {string} field - Nama kolom JSON sesuai skema model.
   * @param {Function} mutator - Menerima salinan nilai lama dan mengembalikan nilai
   *   baru. Kembalikan null atau undefined untuk membatalkan tanpa menulis apa pun,
   *   misalnya ketika barang yang diminta ternyata tidak cukup.
   * @returns {Promise<{ ok: boolean, value?: any, reason?: string }>}
   */
  async _mutateJson(userId, field, mutator, { Model, cacheKey, label }) {
    if (!userId || !field || typeof mutator !== "function")
      return { ok: false, reason: "invalid" };
    if (!SAFE_COLUMN.test(field)) return { ok: false, reason: "invalid_field" };

    // Antrean tulis harus mendarat lebih dulu. Tanpa ini mutator membaca nilai
    // lama dari database, lalu flush lima detik kemudian menimpa hasil mutasi.
    await this.flushUser(userId);

    // SQLite tidak mengenal SELECT ... FOR UPDATE. Di berkas SQLite penulisan
    // sudah diserialkan, jadi kuncinya cukup dilewati.
    const rowLock = sequelize.getDialect() === "sqlite" ? {} : { lock: true };

    try {
      const outcome = await sequelize.transaction(async (t) => {
        let row = await Model.findOne({
          where: { userId },
          transaction: t,
          ...rowLock,
        });
        if (!row) {
          await Model.findOrCreate({ where: { userId }, transaction: t });
          row = await Model.findOne({
            where: { userId },
            transaction: t,
            ...rowLock,
          });
        }
        if (!row) return { ok: false, reason: "no_row" };

        const next = await mutator(cloneJson(row[field]));
        if (next === null || next === undefined)
          return { ok: false, reason: "aborted" };

        row.set(field, next);
        // Kolom JSON kadang tidak terdeteksi berubah bila isinya mirip.
        // Penandaan manual memastikan UPDATE benar-benar dikirim.
        row.changed(field, true);
        await row.save({ fields: [field], transaction: t });
        return { ok: true, value: next };
      });

      if (outcome.ok) {
        // Cache dihapus, bukan ditambal. Nilai yang benar hanya diketahui
        // database setelah transaksi ditutup.
        await redisManager.deleteCache(cacheKey);
      }
      return outcome;
    } catch (error) {
      logger.error(
        `[CacheManager] Gagal mengubah ${label}.${field} untuk ${userId}:`,
        error.message,
      );
      return { ok: false, reason: "error" };
    }
  }

  /**
   * Mengubah kolom JSON UserProfile: inventory, cooldowns, economy_investments,
   * economy_deposit, music_playlist, dan sejenisnya.
   */
  async mutateUserProfileJson(userId, field, mutator) {
    return this._mutateJson(userId, field, mutator, {
      Model: UserProfile,
      cacheKey: `user:profile:${userId}`,
      label: "UserProfile",
    });
  }

  /** Mengubah kolom JSON UserSurvival: rpg_state dan shop_purchases. */
  async mutateUserSurvivalJson(userId, field, mutator) {
    return this._mutateJson(userId, field, mutator, {
      Model: UserSurvival,
      cacheKey: `user:survival:${userId}`,
      label: "UserSurvival",
    });
  }

  // ==========================================
  // 👤 USER PROFILE CACHE
  // ==========================================

  /**
   * Mengambil UserProfile dari Cache. Jika tidak ada, fetch dari DB dan set ke Cache.
   *
   * PENTING: hasilnya adalah objek JSON biasa, BUKAN instance Sequelize.
   * Objek ini tidak punya .save() maupun .changed(). Semua penulisan harus lewat
   * updateUserProfile(), incrementUserProfile(), debitUserProfile(), atau
   * mutateUserProfileJson() untuk kolom JSON.
   *
   * @param {string} userId - ID Discord User
   * @returns {Promise<Object>} Data profil pengguna (JSON)
   */
  async getUserProfile(userId) {
    if (!userId) return null;
    const cacheKey = `user:profile:${userId}`;

    try {
      // 1. Coba ambil dari Redis
      const cachedProfile = await redisManager.getCache(cacheKey);
      if (cachedProfile) return cachedProfile;

      // 2. Jika tidak ada di Redis, ambil dari Database Utama (findOrCreate)
      const [dbProfile] = await UserProfile.findOrCreate({ where: { userId } });
      if (dbProfile) {
        const profileData = dbProfile.toJSON();
        await redisManager.setCache(cacheKey, profileData, PROFILE_TTL);
        return profileData;
      }

      return null;
    } catch (error) {
      logger.error("[CacheManager] Error getUserProfile:", error.message);
      // Fallback: Jika redis down, tembak DB langsung
      try {
        const [dbProfile] = await UserProfile.findOrCreate({
          where: { userId },
        });
        return dbProfile ? dbProfile.toJSON() : null;
      } catch (dbError) {
        return null;
      }
    }
  }

  /**
   * Menyimpan nilai ABSOLUT pada UserProfile.
   * Untuk nilai akumulatif (koin, XP), pakai incrementUserProfile().
   * Untuk pengurangan saldo, pakai debitUserProfile().
   * Untuk kolom JSON, pakai mutateUserProfileJson().
   *
   * @param {string} userId - ID Discord User
   * @param {Object|string} fieldOrData - Key/Value pasang untuk diupdate atau nama kolom
   * @param {any} [maybeValue] - Nilai jika parameter kedua adalah nama kolom
   * @returns {Promise<boolean>} Status keberhasilan cache
   */
  async updateUserProfile(userId, fieldOrData, maybeValue) {
    if (!userId || fieldOrData === undefined || fieldOrData === null)
      return false;
    let updateData = fieldOrData;
    if (typeof fieldOrData === "string") {
      updateData = { [fieldOrData]: maybeValue };
    }
    if (!updateData || typeof updateData !== "object") return false;
    const cacheKey = `user:profile:${userId}`;

    try {
      let profile = await this.getUserProfile(userId);

      if (!profile) {
        try {
          const [newDbProfile] = await UserProfile.findOrCreate({
            where: { userId },
            defaults: updateData,
          });
          profile = newDbProfile.toJSON();
        } catch (e) {
          return false;
        }
      }

      Object.assign(profile, updateData);
      await redisManager.setCache(cacheKey, profile, PROFILE_TTL);
      this._enqueue(this.writeQueue, userId, { set: updateData });

      return true;
    } catch (error) {
      logger.error("[CacheManager] Error updateUserProfile:", error.message);
      this._enqueue(this.writeQueue, userId, { set: updateData });
      return false;
    }
  }

  /**
   * Menambah/mengurangi kolom numerik UserProfile secara atomik di level SQL.
   * Gunakan ini untuk economy_wallet, economy_bank, leveling_xp, dan sejenisnya.
   *
   * @param {string} userId
   * @param {Object<string, number>|string} fieldOrDeltas - Contoh: { economy_wallet: 250, leveling_xp: 15 } atau 'economy_wallet'
   * @param {number} [maybeAmount] - Nilai penambahan jika parameter kedua adalah nama kolom
   */
  async incrementUserProfile(userId, fieldOrDeltas, maybeAmount) {
    let deltas = fieldOrDeltas;
    if (typeof fieldOrDeltas === "string") {
      deltas = { [fieldOrDeltas]: maybeAmount };
    }
    return this._increment(userId, deltas, {
      cacheKey: `user:profile:${userId}`,
      ttl: PROFILE_TTL,
      loader: () => this.getUserProfile(userId),
      queue: this.writeQueue,
    });
  }

  // ==========================================
  // 🏠 GUILD SETTINGS CACHE (Rule 1.9)
  // ==========================================

  /**
   * Mengambil GuildSettings dari Cache. Jika tidak ada, fetch dari DB dan set ke Cache.
   * Wajib digunakan di messageCreate dan interactionCreate, bukan GuildSettings.findOne() langsung.
   * @param {string} guildId - ID Discord Guild
   * @returns {Promise<Object|null>} Settings JSON atau null jika guild belum terdaftar
   */
  async getGuildSettings(guildId) {
    if (!guildId) return null;
    const cacheKey = `guild:settings:${guildId}`;

    try {
      const cached = await redisManager.getCache(cacheKey);
      if (cached) return cached;

      const [db] = await GuildSettings.findOrCreate({ where: { guildId } });
      if (db) {
        const settingsData = db.toJSON();
        await redisManager.setCache(cacheKey, settingsData, GUILD_TTL);
        return settingsData;
      }

      return null;
    } catch (error) {
      logger.error("[CacheManager] Error getGuildSettings:", error.message);
      try {
        const [db] = await GuildSettings.findOrCreate({ where: { guildId } });
        return db ? db.toJSON() : null;
      } catch (dbError) {
        return null;
      }
    }
  }

  /**
   * Menghapus cache GuildSettings untuk guild tertentu.
   *
   * Sejak hook invalidasi dipasang di model GuildSettings, fungsi ini tidak perlu
   * lagi dipanggil manual setelah setiap penulisan. Dipertahankan untuk pemanggil
   * lama dan untuk kasus khusus.
   *
   * @param {string} guildId - ID Discord Guild
   */
  async invalidateGuildSettings(guildId) {
    if (!guildId) return;
    const cacheKey = `guild:settings:${guildId}`;
    try {
      await redisManager.deleteCache(cacheKey);
    } catch (error) {
      logger.error(
        "[CacheManager] Error invalidateGuildSettings:",
        error.message,
      );
    }
  }

  // ==========================================
  // ⚔️ USER SURVIVAL CACHE
  // ==========================================

  /**
   * Mengambil UserSurvival dari Cache / DB.
   *
   * Sama seperti getUserProfile, hasilnya objek JSON biasa tanpa .save().
   *
   * @param {string} userId - ID Discord User
   * @returns {Promise<Object>} Data survival pengguna (JSON)
   */
  async getUserSurvival(userId) {
    if (!userId) return null;
    const cacheKey = `user:survival:${userId}`;

    try {
      const cached = await redisManager.getCache(cacheKey);
      if (cached) return cached;

      const [db] = await UserSurvival.findOrCreate({ where: { userId } });
      if (db) {
        const data = db.toJSON();
        await redisManager.setCache(cacheKey, data, SURVIVAL_TTL);
        return data;
      }
      return null;
    } catch (error) {
      logger.error("[CacheManager] Error getUserSurvival:", error.message);
      try {
        const [db] = await UserSurvival.findOrCreate({ where: { userId } });
        return db ? db.toJSON() : null;
      } catch {
        return null;
      }
    }
  }

  /**
   * Menyimpan nilai ABSOLUT pada UserSurvival.
   * Untuk kolom JSON (rpg_state, shop_purchases), pakai mutateUserSurvivalJson().
   *
   * @param {string} userId - ID Discord User
   * @param {Object|string} fieldOrData - Data yang diupdate atau nama kolom
   * @param {any} [maybeValue] - Nilai jika parameter kedua adalah nama kolom
   */
  async updateUserSurvival(userId, fieldOrData, maybeValue) {
    if (!userId || fieldOrData === undefined || fieldOrData === null)
      return false;
    let updateData = fieldOrData;
    if (typeof fieldOrData === "string") {
      updateData = { [fieldOrData]: maybeValue };
    }
    if (!updateData || typeof updateData !== "object") return false;
    const cacheKey = `user:survival:${userId}`;

    try {
      const survival = await this.getUserSurvival(userId);
      if (!survival) return false;

      Object.assign(survival, updateData);
      await redisManager.setCache(cacheKey, survival, SURVIVAL_TTL);
      this._enqueue(this.survivalQueue, userId, { set: updateData });

      return true;
    } catch (error) {
      logger.error("[CacheManager] Error updateUserSurvival:", error.message);
      this._enqueue(this.survivalQueue, userId, { set: updateData });
      return false;
    }
  }

  /**
   * Menambah/mengurangi kolom numerik UserSurvival secara atomik.
   * Gunakan untuk starFragments, coupons, hp, hunger, thirst, stamina, survival_xp.
   *
   * @param {string} userId
   * @param {Object<string, number>|string} fieldOrDeltas - Contoh: { starFragments: 120, hunger: -5 } atau 'starFragments'
   * @param {number} [maybeAmount] - Nilai penambahan jika parameter kedua adalah nama kolom
   */
  async incrementUserSurvival(userId, fieldOrDeltas, maybeAmount) {
    let deltas = fieldOrDeltas;
    if (typeof fieldOrDeltas === "string") {
      deltas = { [fieldOrDeltas]: maybeAmount };
    }
    return this._increment(userId, deltas, {
      cacheKey: `user:survival:${userId}`,
      ttl: SURVIVAL_TTL,
      loader: () => this.getUserSurvival(userId),
      queue: this.survivalQueue,
    });
  }
}

module.exports = new CacheManager();
