/**
 * Naura Hoshino V2 - Web Components Library
 * 
 * Central export for all reusable Web Components.
 * Import this file to register all components at once.
 * 
 * Usage:
 *   import './components/index.js';
 * 
 * Or import individual components:
 *   import './components/naura-card.js';
 */

// Core Components
export { NauraCard } from './naura-card.js';
export { NauraStatCard } from './naura-stat-card.js';
export { NauraToast, ToastManager, toastManager } from './naura-toast.js';
export { NauraSkeleton } from './naura-skeleton.js';
export { default as NauraFloatingAvatar } from './naura-floating-avatar.js';

// Component registration is automatic when modules are imported
// Each component calls customElements.define() on load

console.log('[NauraComponents] All components registered');
