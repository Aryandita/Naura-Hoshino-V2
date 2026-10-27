"use strict";

/**
 * 🏛️ Lightweight Service Container & IoC Registry - Naura Hoshino V2
 * -------------------------------------------------------------------
 * Provides Inversion of Control (IoC) and Service Locator pattern using
 * pure Node.js without heavy external dependencies (/ponytail).
 *
 * Features:
 * - Static Value Registration (value)
 * - Isolated Singleton Registration (singleton / lazy-loaded factory)
 * - Transient Registration (transient / fresh instance per-resolve)
 * - Circular Dependency Detection (resolution stack guard)
 * - Lifecycle Hooks: init() and dispose()
 *
 * @module src/core/container
 * @example
 * // Register a singleton service
 * container.singleton('dbManager', (c) => new DbManager(c.resolve('config')));
 *
 * // Resolve service (lazy-loaded on first call, cached thereafter)
 * const db = container.resolve('dbManager');
 *
 * // Register static value
 * container.value('config', { port: 3000 });
 */

const { EntityNotFoundError, SystemError } = require("../errors/DomainError");

// ============================================================================
// SERVICE CONTAINER CLASS
// ============================================================================

/**
 * IoC Container for dependency injection and service lifecycle management.
 * Supports singleton, transient, and static value registrations.
 */
class ServiceContainer {
  constructor() {
    /** @type {Map<string, any>} Cached singleton instances */
    this.instances = new Map();

    /** @type {Map<string, {factory: Function, isSingleton: boolean}>} Factory definitions */
    this.factories = new Map();

    /** @type {Set<string>} Stack for detecting circular dependencies during resolution */
    this.resolutionStack = new Set();
  }

  /**
   * Register a static value/instance directly as singleton.
   * Use this for pre-created objects or configuration values.
   * @param {string} name - Service identifier token
   * @param {any} instance - Service object to register
   * @returns {ServiceContainer} Returns this for method chaining
   * @throws {TypeError} If name is not a valid string
   * @example
   * container.value('config', { port: 3000, host: 'localhost' });
   */
  value(name, instance) {
    this._validateName(name);
    this.instances.set(name, instance);
    this.factories.delete(name);
    return this;
  }

  /**
   * Register a singleton factory function (cached after first resolve).
   * Factory receives container as parameter for dependency resolution.
   * @param {string} name - Service identifier token
   * @param {Function} factory - Creator function: (container) => instance
   * @returns {ServiceContainer} Returns this for method chaining
   * @throws {TypeError} If name is invalid or factory is not a function
   * @example
   * container.singleton('userService', (c) => {
   *   const db = c.resolve('dbManager');
   *   return new UserService(db);
   * });
   */
  singleton(name, factory) {
    this._validateName(name);
    this._validateFactory(name, factory);
    this.factories.set(name, { factory, isSingleton: true });
    this.instances.delete(name);
    return this;
  }

  /**
   * Register a transient factory function (new instance on every resolve).
   * Use this for stateless services or when fresh instance is required.
   * @param {string} name - Service identifier token
   * @param {Function} factory - Creator function: (container) => instance
   * @returns {ServiceContainer} Returns this for method chaining
   * @throws {TypeError} If name is invalid or factory is not a function
   * @example
   * container.transient('httpRequest', () => new HttpRequest());
   */
  transient(name, factory) {
    this._validateName(name);
    this._validateFactory(name, factory);
    this.factories.set(name, { factory, isSingleton: false });
    this.instances.delete(name);
    return this;
  }

  /**
   * Check if a service token is registered (as instance or factory).
   * @param {string} name - Service identifier token
   * @returns {boolean} True if service exists
   */
  has(name) {
    return this.instances.has(name) || this.factories.has(name);
  }

  /**
   * Resolve/retrieve a service by its token name.
   * For singletons: returns cached instance or creates via factory on first call.
   * For transients: always creates new instance via factory.
   * @param {string} name - Service identifier token
   * @returns {any} Resolved service instance
   * @throws {EntityNotFoundError} If service is not registered
   * @throws {SystemError} If circular dependency detected
   * @example
   * const userService = container.resolve('userService');
   */
  resolve(name) {
    // 1. Return cached singleton instance if available
    if (this.instances.has(name)) {
      return this.instances.get(name);
    }

    // 2. Get factory definition
    const definition = this.factories.get(name);
    if (!definition) {
      throw new EntityNotFoundError(
        `[ServiceContainer] Service '${name}' is not registered in the container.`,
      );
    }

    // 3. Detect circular dependencies using resolution stack
    if (this.resolutionStack.has(name)) {
      const cyclePath = [...this.resolutionStack, name].join(" -> ");
      throw new SystemError(
        `[ServiceContainer] Circular dependency detected while resolving '${name}': ${cyclePath}`,
      );
    }

    // 4. Execute factory with circular dependency guard
    this.resolutionStack.add(name);
    try {
      const instance = definition.factory(this);

      // Cache singleton instances for subsequent resolves
      if (definition.isSingleton) {
        this.instances.set(name, instance);
      }

      return instance;
    } finally {
      // Always clean up resolution stack (even if factory throws)
      this.resolutionStack.delete(name);
    }
  }

  /**
   * Run init() lifecycle hook on all active singletons that implement it.
   * Call this during application startup after all services are registered.
   * @returns {Promise<void>}
   * @throws {SystemError} If any service fails to initialize
   */
  async init() {
    for (const [name, instance] of this.instances.entries()) {
      if (instance && typeof instance.init === "function") {
        try {
          await instance.init();
        } catch (error) {
          throw new SystemError(
            `[ServiceContainer] Failed to initialize service '${name}': ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Run dispose() lifecycle hook on all active singletons during shutdown.
   * Continues cleanup even if individual services fail to dispose.
   * @returns {Promise<void>}
   */
  async dispose() {
    for (const [name, instance] of this.instances.entries()) {
      if (instance && typeof instance.dispose === "function") {
        try {
          await instance.dispose();
        } catch (error) {
          // Log error but continue disposing other services
          console.error(
            `[ServiceContainer] Error disposing service '${name}': ${error.message}`,
          );
        }
      }
    }
  }

  /**
   * Clear all registrations and cached instances.
   * Primarily useful for test isolation between test cases.
   */
  clear() {
    this.instances.clear();
    this.factories.clear();
    this.resolutionStack.clear();
  }

  /**
   * Validate that service name is a non-empty string.
   * @private
   * @param {string} name - Service name to validate
   * @throws {TypeError} If name is invalid
   */
  _validateName(name) {
    if (!name || typeof name !== "string") {
      throw new TypeError("[ServiceContainer] Service name must be a non-empty string.");
    }
  }

  /**
   * Validate that factory is a function.
   * @private
   * @param {string} name - Service name (for error message)
   * @param {Function} factory - Factory to validate
   * @throws {TypeError} If factory is not a function
   */
  _validateFactory(name, factory) {
    if (typeof factory !== "function") {
      throw new TypeError(`[ServiceContainer] Factory for '${name}' must be a function.`);
    }
  }
}

// ============================================================================
// GLOBAL RUNTIME INSTANCE
// ============================================================================

/**
 * Global ServiceContainer instance for application-wide dependency injection.
 * Use this singleton instead of creating new container instances.
 * @type {ServiceContainer}
 */
const container = new ServiceContainer();

// Self-reference pattern: Allow container to resolve itself
// This enables services to depend on the container itself if needed
container.container = container;

// Expose class for testing and type checking
container.ServiceContainer = ServiceContainer;

module.exports = container;
