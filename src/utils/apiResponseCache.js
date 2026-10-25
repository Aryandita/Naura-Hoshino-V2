"use strict";

const crypto = require("crypto");

class ApiResponseCache {
  constructor(options = {}) {
    this.ttl = options.ttl || 300000;
    this.maxSize = options.maxSize || 1000;
    this.cache = new Map();
    
    setInterval(() => this.cleanup(), 60000).unref?.();
  }

  _generateKey(prefix, params) {
    const hash = crypto.createHash("md5").update(JSON.stringify(params)).digest("hex").slice(0, 8);
    return `${prefix}:${hash}`;
  }

  get(prefix, params) {
    const key = this._generateKey(prefix, params);
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data;
  }

  set(prefix, params, data) {
    if (this.cache.size >= this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
    }
    
    const key = this._generateKey(prefix, params);
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }

  invalidate(prefix, params) {
    const key = this._generateKey(prefix, params);
    this.cache.delete(key);
  }

  clear() {
    this.cache.clear();
  }

  cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.ttl) {
        this.cache.delete(key);
      }
    }
  }

  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      ttl: this.ttl,
    };
  }
}

const globalCache = new ApiResponseCache({ ttl: 300000, maxSize: 500 });

module.exports = {
  ApiResponseCache,
  globalCache,
};
