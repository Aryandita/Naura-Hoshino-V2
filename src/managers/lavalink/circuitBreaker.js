"use strict";

/**
 * 🔌 Circuit Breaker Manager - Naura Hoshino V2
 * ----------------------------------------------
 * Manages circuit breaker state machines for Lavalink node fault tolerance.
 * Implements automatic node quarantine and recovery testing.
 *
 * State Machine:
 *   CLOSED (normal) → OPEN (quarantined) → HALF_OPEN (testing) → CLOSED or OPEN
 *
 * @module src/managers/lavalink/circuitBreaker
 */

const { logger } = require("../logger");
const { logWithBanner } = require("../../utils/loggerBanner");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Circuit breaker configuration */
const CB_CONFIG = {
  ERROR_THRESHOLD: 3,        // Max consecutive errors before opening
  WINDOW_MS: 30000,          // Time window for error counting (30 seconds)
  QUARANTINE_MS: 300000,     // Quarantine duration (5 minutes)
};

/** Circuit breaker states */
const CB_STATE = {
  CLOSED: "CLOSED",          // Normal operation
  OPEN: "OPEN",              // Node quarantined
  HALF_OPEN: "HALF_OPEN",    // Testing if node recovered
};

// ============================================================================
// CIRCUIT BREAKER MANAGER CLASS
// ============================================================================

/**
 * Manages circuit breaker state for multiple nodes.
 * Each node has independent state tracking and quarantine timer.
 */
class CircuitBreakerManager {
  constructor() {
    /** @type {Map<string, CircuitBreakerState>} Node name → CB state */
    this.circuitBreakers = new Map();
  }

  /**
   * Record a failure/error on a node and evaluate circuit breaker state.
   * Transitions to OPEN state when threshold exceeded within time window.
   * @param {string} nodeName - Node identifier
   * @param {Error|string} [error] - Error object or message
   * @example
   * cb.recordNodeError('node-1', new Error('Connection timeout'));
   */
  recordNodeError(nodeName, error) {
    if (!nodeName) return;

    const now = Date.now();
    let cb = this.circuitBreakers.get(nodeName);

    // Initialize CB state if first error
    if (!cb) {
      cb = {
        state: CB_STATE.CLOSED,
        failures: 0,
        lastFailureTime: 0,
        quarantineUntil: 0,
      };
      this.circuitBreakers.set(nodeName, cb);
    }

    // Reset counter if outside sliding window
    if (now - cb.lastFailureTime > CB_CONFIG.WINDOW_MS) {
      cb.failures = 1;
    } else {
      cb.failures += 1;
    }

    cb.lastFailureTime = now;

    // HALF_OPEN failure → immediate re-quarantine
    if (cb.state === CB_STATE.HALF_OPEN) {
      cb.state = CB_STATE.OPEN;
      cb.quarantineUntil = now + CB_CONFIG.QUARANTINE_MS;
      logWithBanner(
        "warn",
        "🚨 CIRCUIT BREAKER",
        `Node "${nodeName}" failed recovery test, re-quarantined: ${error?.message || error}`,
      );
      return;
    }

    // Threshold exceeded → enter quarantine
    if (cb.failures >= CB_CONFIG.ERROR_THRESHOLD && cb.state !== CB_STATE.OPEN) {
      cb.state = CB_STATE.OPEN;
      cb.quarantineUntil = now + CB_CONFIG.QUARANTINE_MS;
      logWithBanner(
        "warn",
        "🚨 CIRCUIT BREAKER",
        `Node "${nodeName}" quarantined for 5 minutes due to ${cb.failures} consecutive errors: ${error?.message || error}`,
      );
    }
  }

  /**
   * Alias for recordNodeError for backward compatibility.
   * @param {string} nodeName - Node identifier
   * @param {Error|string} [error] - Error object or message
   */
  recordFailure(nodeName, error) {
    return this.recordNodeError(nodeName, error);
  }

  /**
   * Record successful connection/playback on a node (reset circuit breaker).
   * Call this after successful operations to clear error state.
   * @param {string} nodeName - Node identifier
   */
  recordNodeSuccess(nodeName) {
    if (!nodeName) return;

    const cb = this.circuitBreakers.get(nodeName);
    if (cb) {
      cb.state = CB_STATE.CLOSED;
      cb.failures = 0;
      cb.quarantineUntil = 0;
    }
  }

  /**
   * Check if a node is currently in quarantine isolation.
   * Automatically transitions OPEN → HALF_OPEN when quarantine expires.
   * @param {string} nodeName - Node identifier
   * @returns {boolean} True if node should not receive traffic
   */
  isNodeQuarantined(nodeName) {
    if (!nodeName) return false;

    const cb = this.circuitBreakers.get(nodeName);
    if (!cb) return false;

    // CLOSED state = healthy
    if (cb.state === CB_STATE.CLOSED) return false;

    // OPEN state = check if quarantine expired
    if (cb.state === CB_STATE.OPEN) {
      if (Date.now() <= cb.quarantineUntil) {
        return true; // Still in quarantine period
      }

      // Quarantine expired → enter recovery testing phase
      cb.state = CB_STATE.HALF_OPEN;
      cb.failures = 0;
      logWithBanner(
        "info",
        "🔄 CIRCUIT BREAKER",
        `Node "${nodeName}" quarantine ended. Entering recovery test (HALF_OPEN).`,
      );
    }

    // HALF_OPEN = still testing, don't route traffic yet
    return true;
  }

  /**
   * Get current circuit breaker state for a node.
   * @param {string} nodeName - Node identifier
   * @returns {{state: string, failures: number, quarantineUntil: number}|null}
   */
  getState(nodeName) {
    const cb = this.circuitBreakers.get(nodeName);
    if (!cb) return null;

    return {
      state: cb.state,
      failures: cb.failures,
      quarantineUntil: cb.quarantineUntil,
    };
  }

  /**
   * Manually reset circuit breaker for a node.
   * Useful for administrative override or after manual intervention.
   * @param {string} nodeName - Node identifier
   */
  reset(nodeName) {
    if (!nodeName) return;

    const cb = this.circuitBreakers.get(nodeName);
    if (cb) {
      cb.state = CB_STATE.CLOSED;
      cb.failures = 0;
      cb.quarantineUntil = 0;
      logger.info(`[CircuitBreaker] Manual reset for node "${nodeName}"`);
    }
  }

  /**
   * Clear all circuit breaker states.
   * Primarily used for testing or full system reset.
   */
  clearAll() {
    this.circuitBreakers.clear();
  }
}

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * @typedef {Object} CircuitBreakerState
 * @property {string} state - Current state (CLOSED, OPEN, HALF_OPEN)
 * @property {number} failures - Consecutive failure count
 * @property {number} lastFailureTime - Timestamp of last failure
 * @property {number} quarantineUntil - Timestamp when quarantine ends
 */

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  CircuitBreakerManager,
  CB_CONFIG,
  CB_STATE,
};
