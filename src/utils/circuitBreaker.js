"use strict";

const { logger } = require("../managers/logger");

const STATE = {
  CLOSED: "CLOSED",
  OPEN: "OPEN",
  HALF_OPEN: "HALF_OPEN",
};

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.failureThreshold = options.failureThreshold || 5;
    this.resetTimeout = options.resetTimeout || 60000;
    this.halfOpenMaxAttempts = options.halfOpenMaxAttempts || 3;
    
    this.state = STATE.CLOSED;
    this.failureCount = 0;
    this.lastFailureTime = null;
    this.halfOpenAttempts = 0;
    
    this._stateChangeListeners = [];
  }

  async execute(fn) {
    if (this.state === STATE.OPEN) {
      const now = Date.now();
      if (now - this.lastFailureTime >= this.resetTimeout) {
        this.transitionTo(STATE.HALF_OPEN);
      } else {
        throw new CircuitBreakerOpenError(
          `Circuit breaker "${this.name}" is OPEN. Retry after ${Math.ceil((this.resetTimeout - (now - this.lastFailureTime)) / 1000)}s`,
        );
      }
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  onSuccess() {
    if (this.state === STATE.HALF_OPEN) {
      this.halfOpenAttempts++;
      if (this.halfOpenAttempts >= this.halfOpenMaxAttempts) {
        this.transitionTo(STATE.CLOSED);
      }
    } else if (this.state === STATE.CLOSED) {
      this.failureCount = 0;
    }
  }

  onFailure() {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === STATE.HALF_OPEN) {
      this.transitionTo(STATE.OPEN);
    } else if (this.state === STATE.CLOSED && this.failureCount >= this.failureThreshold) {
      this.transitionTo(STATE.OPEN);
    }
  }

  transitionTo(newState) {
    const oldState = this.state;
    this.state = newState;
    
    if (newState === STATE.CLOSED) {
      this.failureCount = 0;
      this.halfOpenAttempts = 0;
    } else if (newState === STATE.HALF_OPEN) {
      this.halfOpenAttempts = 0;
    }

    logger.info(`[CircuitBreaker] ${this.name}: ${oldState} -> ${newState}`);
    this._stateChangeListeners.forEach((cb) => cb(newState, oldState));
  }

  onStateChange(callback) {
    this._stateChangeListeners.push(callback);
  }

  getState() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      lastFailureTime: this.lastFailureTime,
      halfOpenAttempts: this.halfOpenAttempts,
    };
  }

  reset() {
    this.transitionTo(STATE.CLOSED);
  }
}

class CircuitBreakerOpenError extends Error {
  constructor(message) {
    super(message);
    this.name = "CircuitBreakerOpenError";
    this.code = "CIRCUIT_BREAKER_OPEN";
  }
}

const breakers = new Map();

function getOrCreateBreaker(name, options) {
  if (!breakers.has(name)) {
    breakers.set(name, new CircuitBreaker(name, options));
  }
  return breakers.get(name);
}

function getAllBreakers() {
  return Array.from(breakers.values()).map((b) => b.getState());
}

module.exports = {
  CircuitBreaker,
  CircuitBreakerOpenError,
  getOrCreateBreaker,
  getAllBreakers,
  STATE,
};
