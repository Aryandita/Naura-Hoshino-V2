"use strict";

/**
 * 🏛️ Lightweight Service Container & IoC Registry (Naura Hoshino V2)
 * -------------------------------------------------------------------
 * Menyediakan pembalikan kontrol (Inversion of Control) dan Service Locator
 * murni berbasis Node.js standard tanpa dependensi eksternal berat (/ponytail).
 *
 * Mendukung:
 * - Registrasi Nilai Statis (value)
 * - Registrasi Singleton Terisolasi (singleton / lazy-loaded factory)
 * - Registrasi Transient (transient / fresh instance per-resolve)
 * - Deteksi Siklus Resolusi (Circular Dependency Guard)
 * - Lifecycle Hooks: init() dan dispose()
 */
const { EntityNotFoundError, SystemError } = require("../errors/DomainError");

class ServiceContainer {
  constructor() {
    this.instances = new Map();
    this.factories = new Map();
    this.resolutionStack = new Set();
  }

  /**
   * Daftarkan instans / nilai statis langsung sebagai singleton.
   * @param {string} name - Token pengenal layanan
   * @param {any} instance - Objek layanan
   * @returns {ServiceContainer}
   */
  value(name, instance) {
    if (!name || typeof name !== "string") {
      throw new TypeError("[ServiceContainer] Nama layanan harus berupa string.");
    }
    this.instances.set(name, instance);
    this.factories.delete(name);
    return this;
  }

  /**
   * Daftarkan factory function singleton yang di-cache saat pertama kali di-resolve.
   * @param {string} name - Token pengenal layanan
   * @param {Function} factory - Fungsi pembuat: (container) => instance
   * @returns {ServiceContainer}
   */
  singleton(name, factory) {
    if (!name || typeof name !== "string") {
      throw new TypeError("[ServiceContainer] Nama layanan harus berupa string.");
    }
    if (typeof factory !== "function") {
      throw new TypeError(`[ServiceContainer] Factory untuk '${name}' harus berupa function.`);
    }
    this.factories.set(name, { factory, isSingleton: true });
    this.instances.delete(name);
    return this;
  }

  /**
   * Daftarkan factory function transient (selalu menghasilkan instans baru tiap resolve).
   * @param {string} name - Token pengenal layanan
   * @param {Function} factory - Fungsi pembuat: (container) => instance
   * @returns {ServiceContainer}
   */
  transient(name, factory) {
    if (!name || typeof name !== "string") {
      throw new TypeError("[ServiceContainer] Nama layanan harus berupa string.");
    }
    if (typeof factory !== "function") {
      throw new TypeError(`[ServiceContainer] Factory untuk '${name}' harus berupa function.`);
    }
    this.factories.set(name, { factory, isSingleton: false });
    this.instances.delete(name);
    return this;
  }

  /**
   * Memeriksa apakah token layanan terdaftar (sebagai instance atau factory).
   * @param {string} name - Token pengenal layanan
   * @returns {boolean}
   */
  has(name) {
    return this.instances.has(name) || this.factories.has(name);
  }

  /**
   * Mengambil / meresolve layanan berdasarkan token nama.
   * @param {string} name - Token pengenal layanan
   * @returns {any}
   */
  resolve(name) {
    // 1. Cek cache instance singleton yang sudah ada
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    // 2. Cek apakah ada factory terdaftar
    const definition = this.factories.get(name);
    if (!definition) {
      throw new EntityNotFoundError(`[ServiceContainer] Layanan '${name}' belum terdaftar di container.`);
    }

    // 3. Deteksi ketergantungan sirkular pada resolution stack
    if (this.resolutionStack.has(name)) {
      const cyclePath = [...this.resolutionStack, name].join(" -> ");
      throw new SystemError(
        `[ServiceContainer] Circular dependency terdeteksi saat meresolve '${name}': ${cyclePath}`,
      );
    }

    this.resolutionStack.add(name);
    try {
      const instance = definition.factory(this);
      if (definition.isSingleton) {
        this.instances.set(name, instance);
      }
      return instance;
    } finally {
      this.resolutionStack.delete(name);
    }
  }

  /**
   * Menjalankan lifecycle hook init() pada seluruh singleton aktif yang mengimplementasikannya.
   * @returns {Promise<void>}
   */
  async init() {
    for (const [name, instance] of this.instances.entries()) {
      if (instance && typeof instance.init === "function") {
        try {
          await instance.init();
        } catch (error) {
          throw new SystemError(
            `[ServiceContainer] Gagal menginisialisasi layanan '${name}': ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Menjalankan lifecycle hook dispose() pada seluruh singleton aktif saat shutdown.
   * @returns {Promise<void>}
   */
  async dispose() {
    for (const [name, instance] of this.instances.entries()) {
      if (instance && typeof instance.dispose === "function") {
        try {
          await instance.dispose();
        } catch (error) {
          // Log error tanpa menghentikan pembersihan layanan lain
          console.error(
            `[ServiceContainer] Galat saat membersihkan layanan '${name}': ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Mengosongkan seluruh registrasi dan instance cache (berguna untuk isolasi testing).
   */
  clear() {
    this.instances.clear();
    this.factories.clear();
    this.resolutionStack.clear();
  }
}

// Global runtime instance
const container = new ServiceContainer();

module.exports = {
  container,
  ServiceContainer,
};
