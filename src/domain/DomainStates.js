// Lokasi: src/domain/DomainStates.js
// Implementasi Law 4: Make invalid states harder to represent
// Menyediakan state enums dan transition machine validator terpusat.

"use strict";

const { StateTransitionError } = require("../errors/DomainError");

/**
 * Status tiket bantuan
 * @readonly
 * @enum {string}
 */
const TicketStatus = Object.freeze({
  OPEN: "OPEN",
  CLAIMED: "CLAIMED",
  RESOLVED: "RESOLVED",
  CLOSED: "CLOSED",
});

/**
 * Peta transisi status tiket yang sah
 */
const ALLOWED_TICKET_TRANSITIONS = Object.freeze({
  [TicketStatus.OPEN]: Object.freeze([TicketStatus.CLAIMED, TicketStatus.CLOSED]),
  [TicketStatus.CLAIMED]: Object.freeze([TicketStatus.RESOLVED, TicketStatus.CLOSED, TicketStatus.OPEN]),
  [TicketStatus.RESOLVED]: Object.freeze([TicketStatus.CLOSED, TicketStatus.CLAIMED]),
  [TicketStatus.CLOSED]: Object.freeze([]), // Terminal state
});

/**
 * Status transaksi barter / trade antar pemain
 * @readonly
 * @enum {string}
 */
const TradeStatus = Object.freeze({
  PENDING: "PENDING",
  ACCEPTED: "ACCEPTED",
  REJECTED: "REJECTED",
  CANCELLED: "CANCELLED",
  COMPLETED: "COMPLETED",
});

/**
 * Peta transisi status transaksi barter yang sah
 */
const ALLOWED_TRADE_TRANSITIONS = Object.freeze({
  [TradeStatus.PENDING]: Object.freeze([TradeStatus.ACCEPTED, TradeStatus.REJECTED, TradeStatus.CANCELLED]),
  [TradeStatus.ACCEPTED]: Object.freeze([TradeStatus.COMPLETED, TradeStatus.CANCELLED]),
  [TradeStatus.REJECTED]: Object.freeze([]),
  [TradeStatus.CANCELLED]: Object.freeze([]),
  [TradeStatus.COMPLETED]: Object.freeze([]),
});

/**
 * Tipe mata uang dalam ekosistem bot
 * @readonly
 * @enum {string}
 */
const CurrencyKind = Object.freeze({
  WALLET: "WALLET",
  BANK: "BANK",
  STAR_FRAGMENTS: "STAR_FRAGMENTS",
  COUPONS: "COUPONS",
});

/**
 * Status pertarungan pemain
 * @readonly
 * @enum {string}
 */
const PlayerCombatStatus = Object.freeze({
  PEACEFUL: "PEACEFUL",
  IN_COMBAT: "IN_COMBAT",
  DOWNED: "DOWNED",
  RESTING: "RESTING",
});

/**
 * Peta transisi status pertarungan pemain yang sah
 */
const ALLOWED_COMBAT_TRANSITIONS = Object.freeze({
  [PlayerCombatStatus.PEACEFUL]: Object.freeze([PlayerCombatStatus.IN_COMBAT, PlayerCombatStatus.RESTING]),
  [PlayerCombatStatus.RESTING]: Object.freeze([PlayerCombatStatus.PEACEFUL, PlayerCombatStatus.IN_COMBAT]),
  [PlayerCombatStatus.IN_COMBAT]: Object.freeze([PlayerCombatStatus.PEACEFUL, PlayerCombatStatus.DOWNED]),
  [PlayerCombatStatus.DOWNED]: Object.freeze([PlayerCombatStatus.PEACEFUL, PlayerCombatStatus.RESTING]),
});

/**
 * Mengecek apakah transisi status dari status awal ke status tujuan sah
 * @param {Record<string, readonly string[]>} allowedMap
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @returns {boolean}
 */
function canTransitionState(allowedMap, currentStatus, targetStatus) {
  if (!allowedMap || !currentStatus || !targetStatus) return false;
  if (currentStatus === targetStatus) return true; // Status tidak berubah
  const targets = allowedMap[currentStatus];
  if (!Array.isArray(targets)) return false;
  return targets.includes(targetStatus);
}

/**
 * Memvalidasi transisi status dan melempar StateTransitionError bila ilegal
 * @param {Record<string, readonly string[]>} allowedMap
 * @param {string} currentStatus
 * @param {string} targetStatus
 * @param {Record<string, any>} [context={}]
 * @throws {StateTransitionError}
 */
function assertValidStateTransition(allowedMap, currentStatus, targetStatus, context = {}) {
  const isAllowed = canTransitionState(allowedMap, currentStatus, targetStatus);
  if (!isAllowed) {
    throw new StateTransitionError(
      `Transisi status dari '${currentStatus}' ke '${targetStatus}' tidak diizinkan.`,
      {
        currentStatus,
        targetStatus,
        ...context,
      }
    );
  }
}

module.exports = {
  TicketStatus,
  ALLOWED_TICKET_TRANSITIONS,
  TradeStatus,
  ALLOWED_TRADE_TRANSITIONS,
  CurrencyKind,
  PlayerCombatStatus,
  ALLOWED_COMBAT_TRANSITIONS,
  canTransitionState,
  assertValidStateTransition,
};
