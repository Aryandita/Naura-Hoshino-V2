// Lokasi: src/errors/DomainError.js
// Implementasi Law 6: Make errors useful
// Menyediakan error domain terstruktur dengan kode mesin, pesan pengguna, dan konteks diagnostik.

"use strict";

/**
 * Representasi error domain terstruktur yang aman disajikan ke pengguna
 * dan memuat metadata diagnostik untuk logging tanpa data sensitif.
 */
class DomainError extends Error {
  /**
   * @param {string} code Kode unik mesin (contoh: 'INSUFFICIENT_FUNDS')
   * @param {string} userMessage Pesan ramah pengguna yang siap dirender di Discord UI
   * @param {Record<string, any>} [context={}] Metadata tambahan untuk audit/logging
   * @param {Error} [cause] Error asal bila membungkus error lain
   */
  constructor(code, userMessage, context = {}, cause = undefined) {
    super(userMessage || code);
    this.name = this.constructor.name;
    this.code = code;
    this.userMessage = userMessage || "Terjadi kesalahan pada sistem.";
    this.context = Object.freeze({ ...context });
    this.isOperational = true;
    if (cause) {
      this.cause = cause;
    }
    Error.captureStackTrace(this, this.constructor);
  }

  /**
   * Serialisasi error ke bentuk objek aman JSON
   */
  toJSON() {
    return {
      name: this.name,
      code: this.code,
      userMessage: this.userMessage,
      context: this.context,
      isOperational: this.isOperational,
    };
  }
}

class InsufficientFundsError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("INSUFFICIENT_FUNDS", userMessage || "Saldo Anda tidak mencukupi untuk transaksi ini.", context);
  }
}

class RateLimitError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("RATE_LIMITED", userMessage || "Anda melakukan aksi terlalu cepat. Silakan coba sesaat lagi.", context);
  }
}

class PermissionDeniedError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("PERMISSION_DENIED", userMessage || "Anda tidak memiliki izin untuk melakukan tindakan ini.", context);
  }
}

class StateTransitionError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("INVALID_STATE_TRANSITION", userMessage || "Perubahan status tidak diizinkan pada tahap ini.", context);
  }
}

class EntityNotFoundError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("ENTITY_NOT_FOUND", userMessage || "Data yang dicari tidak ditemukan.", context);
  }
}

class ValidationError extends DomainError {
  /**
   * @param {string} userMessage
   * @param {Record<string, any>} [context={}]
   */
  constructor(userMessage, context = {}) {
    super("VALIDATION_ERROR", userMessage || "Input yang diberikan tidak valid.", context);
  }
}

/**
 * Mengecek apakah sebuah objek error merupakan turunan DomainError
 * @param {unknown} err
 * @returns {boolean}
 */
function isDomainError(err) {
  return err instanceof DomainError || (Boolean(err) && typeof err === "object" && err.isOperational === true && typeof err.code === "string");
}

module.exports = {
  DomainError,
  InsufficientFundsError,
  RateLimitError,
  PermissionDeniedError,
  StateTransitionError,
  EntityNotFoundError,
  ValidationError,
  isDomainError,
};
