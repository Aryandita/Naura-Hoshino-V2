/**
 * tactileTilt.js - Anti-Slop Micro-Tilt 3D Perspective & Specular Light Engine
 *
 * Provides subtle 3D physical micro-tilt interactions for cards in Naura Hoshino V2.
 * Strictly adheres to anti-slop guidelines:
 * - RotateX and rotateY strictly clamped to max 3.5 degrees
 * - Smooth spring physics with linear interpolation (lerp factor 0.15) via requestAnimationFrame
 * - Zero layout thrashing: getBoundingClientRect is cached once on pointerenter
 * - Specular border light tracking cursor coordinates via --specular-x and --specular-y
 * - Full accessibility bypass for prefers-reduced-motion and pointer: coarse (touch devices)
 * - Zero em-dash compliance (\u2014 is strictly forbidden)
 */

(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    root.TactileTilt = factory();
  }
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  const MAX_TILT_DEG = 3.5;
  const LERP_FACTOR = 0.15;
  const REST_THRESHOLD = 0.01;

  const DEFAULT_SELECTORS = [
    '.card-interactive',
    '.stat-card-stellar',
    '.card-stellar[data-interactive="true"]',
    '.card-stellar.is-interactive',
    '.metric-card',
    '.rpg-item-card',
    'naura-card[interactive]',
    'naura-card[clickable]',
    'naura-stat-card[interactive]',
  ].join(', ');

  /**
   * Pure mathematical tilt calculation
   * Clamps rotateX and rotateY strictly to [-maxDeg, maxDeg]
   *
   * @param {number} clientX - Pointer X coordinate
   * @param {number} clientY - Pointer Y coordinate
   * @param {DOMRect|Object} rect - Cached bounding client rect
   * @param {number} maxDeg - Max tilt angle in degrees (default: 3.5)
   * @returns {{ rotX: number, rotY: number, specularX: number, specularY: number }}
   */
  function calculateTilt(clientX, clientY, rect, maxDeg = MAX_TILT_DEG) {
    if (!rect || rect.width <= 0 || rect.height <= 0) {
      return { rotX: 0, rotY: 0, specularX: 0, specularY: 0 };
    }

    const relX = clientX - rect.left;
    const relY = clientY - rect.top;

    // Normalized coordinates from card center in range [-1, 1]
    const normX = Math.max(-1, Math.min(1, (relX / rect.width) * 2 - 1));
    const normY = Math.max(-1, Math.min(1, (relY / rect.height) * 2 - 1));

    // Calculate rotation angles:
    // Pushing top pushes down (rotX > 0 tilts backward in CSS 3D perspective)
    // Clamped strictly to maxDeg
    const rotX = Math.max(-maxDeg, Math.min(maxDeg, -normY * maxDeg));
    const rotY = Math.max(-maxDeg, Math.min(maxDeg, normX * maxDeg));

    return {
      rotX: Number(rotX.toFixed(3)),
      rotY: Number(rotY.toFixed(3)),
      specularX: Number(relX.toFixed(1)),
      specularY: Number(relY.toFixed(1)),
    };
  }

  /**
   * Linear interpolation helper
   *
   * @param {number} current
   * @param {number} target
   * @param {number} factor
   * @returns {number}
   */
  function lerp(current, target, factor = LERP_FACTOR) {
    return current + (target - current) * factor;
  }

  /**
   * Check if tactile tilt should be bypassed for accessibility or device constraints
   *
   * @returns {boolean}
   */
  function shouldBypassTactileTilt() {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return false;
    }

    // Guardrail 1: prefers-reduced-motion (cards remain flat)
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) {
      return true;
    }

    // Guardrail 2: Touch / coarse pointer devices (save mobile GPU and battery)
    const isCoarse = window.matchMedia('(pointer: coarse)').matches ||
                     window.matchMedia('(hover: none)').matches;
    if (isCoarse) {
      return true;
    }

    return false;
  }

  /**
   * Controller managing individual card tilt animation state
   */
  class CardTiltController {
    constructor(element, options = {}) {
      this.el = element;
      this.maxTilt = typeof options.maxTilt === 'number' ? options.maxTilt : MAX_TILT_DEG;
      this.lerpFactor = typeof options.lerpFactor === 'number' ? options.lerpFactor : LERP_FACTOR;

      // Layout cache - populated once on pointerenter to prevent layout thrashing
      this.rect = null;

      // Current animated values
      this.currentRotX = 0;
      this.currentRotY = 0;
      this.targetRotX = 0;
      this.targetRotY = 0;

      // Specular light coordinates
      this.currentSpecX = 0;
      this.currentSpecY = 0;
      this.targetSpecX = 0;
      this.targetSpecY = 0;
      this.specularOpacity = 0;
      this.targetSpecularOpacity = 0;

      this.rafId = null;
      this.isHovering = false;

      this.boundEnter = this.onPointerEnter.bind(this);
      this.boundMove = this.onPointerMove.bind(this);
      this.boundLeave = this.onPointerLeave.bind(this);

      this.bindEvents();
    }

    bindEvents() {
      this.el.addEventListener('pointerenter', this.boundEnter, { passive: true });
      this.el.addEventListener('pointermove', this.boundMove, { passive: true });
      this.el.addEventListener('pointerleave', this.boundLeave, { passive: true });
      this.el.classList.add('has-tactile-tilt');
    }

    onPointerEnter(e) {
      if (shouldBypassTactileTilt()) return;

      // Cache bounding rect once to avoid layout thrashing during mouse movement
      this.rect = this.el.getBoundingClientRect();
      this.isHovering = true;
      this.targetSpecularOpacity = 1;

      this.updateTargets(e.clientX, e.clientY);
      this.startLoop();
    }

    onPointerMove(e) {
      if (!this.isHovering || shouldBypassTactileTilt()) return;

      this.updateTargets(e.clientX, e.clientY);
      this.startLoop();
    }

    updateTargets(clientX, clientY) {
      if (!this.rect) {
        this.rect = this.el.getBoundingClientRect();
      }

      const tilt = calculateTilt(clientX, clientY, this.rect, this.maxTilt);
      this.targetRotX = tilt.rotX;
      this.targetRotY = tilt.rotY;
      this.targetSpecX = tilt.specularX;
      this.targetSpecY = tilt.specularY;
    }

    onPointerLeave() {
      this.isHovering = false;
      this.targetRotX = 0;
      this.targetRotY = 0;
      this.targetSpecularOpacity = 0;
      this.startLoop();
    }

    startLoop() {
      if (!this.rafId) {
        this.rafId = requestAnimationFrame(this.tick.bind(this));
      }
    }

    tick() {
      this.currentRotX = lerp(this.currentRotX, this.targetRotX, this.lerpFactor);
      this.currentRotY = lerp(this.currentRotY, this.targetRotY, this.lerpFactor);
      this.currentSpecX = lerp(this.currentSpecX, this.targetSpecX, this.lerpFactor);
      this.currentSpecY = lerp(this.currentSpecY, this.targetSpecY, this.lerpFactor);
      this.specularOpacity = lerp(this.specularOpacity, this.targetSpecularOpacity, this.lerpFactor);

      const rotDelta = Math.abs(this.currentRotX - this.targetRotX) + Math.abs(this.currentRotY - this.targetRotY);
      const isResting = !this.isHovering && rotDelta < REST_THRESHOLD && this.specularOpacity < REST_THRESHOLD;

      if (isResting) {
        this.resetStyles();
        this.rafId = null;
        this.rect = null; // Invalidate cached rect
        return;
      }

      // Apply hardware-accelerated 3D transform with clamped angles
      this.el.style.transform = `perspective(1000px) rotateX(${this.currentRotX.toFixed(3)}deg) rotateY(${this.currentRotY.toFixed(3)}deg) translateY(-2px) scale3d(1.01, 1.01, 1.01)`;
      this.el.style.setProperty('--specular-x', `${this.currentSpecX.toFixed(1)}px`);
      this.el.style.setProperty('--specular-y', `${this.currentSpecY.toFixed(1)}px`);
      this.el.style.setProperty('--specular-opacity', `${this.specularOpacity.toFixed(2)}`);

      this.rafId = requestAnimationFrame(this.tick.bind(this));
    }

    resetStyles() {
      this.currentRotX = 0;
      this.currentRotY = 0;
      this.specularOpacity = 0;
      this.el.style.transform = '';
      this.el.style.removeProperty('--specular-x');
      this.el.style.removeProperty('--specular-y');
      this.el.style.removeProperty('--specular-opacity');
    }

    destroy() {
      if (this.rafId) {
        cancelAnimationFrame(this.rafId);
        this.rafId = null;
      }
      this.el.removeEventListener('pointerenter', this.boundEnter);
      this.el.removeEventListener('pointermove', this.boundMove);
      this.el.removeEventListener('pointerleave', this.boundLeave);
      this.resetStyles();
      this.el.classList.remove('has-tactile-tilt');
    }
  }

  // Active element to controller map
  const activeControllers = new WeakMap();
  let mutationObserver = null;
  let isInitialized = false;

  const TactileTilt = {
    MAX_TILT_DEG,
    LERP_FACTOR,
    DEFAULT_SELECTORS,

    calculateTilt,
    lerp,
    shouldBypassTactileTilt,

    /**
     * Initialize tactile tilt across the document
     *
     * @param {Element|Document} root
     * @param {string} selector
     */
    init(root = typeof document !== 'undefined' ? document : null, selector = DEFAULT_SELECTORS) {
      if (!root) return;
      if (shouldBypassTactileTilt()) return;

      this.scan(root, selector);
      this.observe(root, selector);
      this.listenAccessibility();
      isInitialized = true;
    },

    /**
     * Scan and bind tactile tilt to matching elements
     *
     * @param {Element|Document} root
     * @param {string} selector
     */
    scan(root = document, selector = DEFAULT_SELECTORS) {
      if (!root || !root.querySelectorAll) return;

      const elements = root.querySelectorAll(selector);
      for (let i = 0; i < elements.length; i++) {
        this.attach(elements[i]);
      }

      // Support Open Shadow DOM in Web Components (e.g., naura-card, naura-stat-card)
      const customElements = root.querySelectorAll('naura-card, naura-stat-card');
      for (let i = 0; i < customElements.length; i++) {
        const ce = customElements[i];
        if (ce.shadowRoot) {
          const innerCards = ce.shadowRoot.querySelectorAll('.card, .stat-card');
          for (let j = 0; j < innerCards.length; j++) {
            this.attach(innerCards[j]);
          }
        }
      }
    },

    /**
     * Attach tilt controller to a single element
     *
     * @param {HTMLElement} element
     * @param {Object} options
     * @returns {CardTiltController|null}
     */
    attach(element, options = {}) {
      if (!element || activeControllers.has(element)) {
        return activeControllers.get(element) || null;
      }
      const controller = new CardTiltController(element, options);
      activeControllers.set(element, controller);
      return controller;
    },

    /**
     * Detach tilt controller from an element
     *
     * @param {HTMLElement} element
     */
    detach(element) {
      const controller = activeControllers.get(element);
      if (controller) {
        controller.destroy();
        activeControllers.delete(element);
      }
    },

    /**
     * Observe dynamic DOM additions
     *
     * @param {Element|Document} root
     * @param {string} selector
     */
    observe(root = document, selector = DEFAULT_SELECTORS) {
      if (typeof MutationObserver === 'undefined' || mutationObserver) return;

      mutationObserver = new MutationObserver((mutations) => {
        if (shouldBypassTactileTilt()) return;
        for (let i = 0; i < mutations.length; i++) {
          const addedNodes = mutations[i].addedNodes;
          for (let j = 0; j < addedNodes.length; j++) {
            const node = addedNodes[j];
            if (node.nodeType === 1) { // Node.ELEMENT_NODE
              if (node.matches && node.matches(selector)) {
                this.attach(node);
              }
              if (node.querySelectorAll) {
                this.scan(node, selector);
              }
            }
          }
        }
      });

      const target = root.body || root;
      if (target) {
        mutationObserver.observe(target, { childList: true, subtree: true });
      }
    },

    /**
     * Listen for accessibility preference changes
     */
    listenAccessibility() {
      if (typeof window === 'undefined' || !window.matchMedia) return;

      const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
      if (mediaQuery.addEventListener) {
        mediaQuery.addEventListener('change', (e) => {
          if (e.matches) {
            this.destroyAll();
          } else {
            this.scan();
          }
        });
      }
    },

    /**
     * Destroy all active controllers and clean up observers
     */
    destroyAll(root = typeof document !== 'undefined' ? document : null) {
      if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
      }

      if (root && root.querySelectorAll) {
        const elements = root.querySelectorAll('.has-tactile-tilt');
        for (let i = 0; i < elements.length; i++) {
          this.detach(elements[i]);
        }
      }
      isInitialized = false;
    },

    isReady() {
      return isInitialized;
    },
  };

  // Auto-initialize when loaded in browser environments
  if (typeof window !== 'undefined' && typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => TactileTilt.init());
    } else {
      TactileTilt.init();
    }
  }

  return TactileTilt;
});
