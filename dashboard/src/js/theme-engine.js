/**
 * theme-engine.js - Multi-Theme Engine with CSS Container Queries
 * 
 * Features:
 * - 6 themes: midnight, sakura, cyber-neon, emerald-nature, light-horizon, oled
 * - 3 density modes: compact, comfortable, spacious
 * - Automatic system preference detection
 * - Persistent user preference via localStorage
 * - A11y live announcer for screen readers
 * 
 * Usage:
 *   import { ThemeEngine } from './theme-engine.js';
 *   const theme = new ThemeEngine();
 *   theme.setTheme('sakura');
 */

class ThemeEngine {
  constructor() {
    this.themes = [
      { id: 'midnight', label: 'Midnight', icon: 'fa-moon', dark: true },
      { id: 'sakura', label: 'Sakura', icon: 'fa-fan', dark: true },
      { id: 'cyber-neon', label: 'Cyber Neon', icon: 'fa-bolt', dark: true },
      { id: 'emerald-nature', label: 'Emerald Wilds', icon: 'fa-leaf', dark: true },
      { id: 'light-horizon', label: 'Light Horizon', icon: 'fa-sun', dark: false },
      { id: 'oled', label: 'OLED Black', icon: 'fa-circle-half-stroke', dark: true },
    ];

    this.densities = ['compact', 'comfortable', 'spacious'];
    
    this.currentTheme = this.getSavedTheme() || 'midnight';
    this.currentDensity = this.getSavedDensity() || 'comfortable';
    
    this.init();
  }

  init() {
    // Apply saved or default theme
    this.applyTheme(this.currentTheme, false);
    this.applyDensity(this.currentDensity, false);

    // Listen for system preference changes
    if (window.matchMedia) {
      const darkModeQuery = window.matchMedia('(prefers-color-scheme: dark)');
      darkModeQuery.addEventListener('change', (e) => {
        if (!this.getSavedTheme()) {
          // Only auto-switch if user hasn't set a preference
          this.applyTheme(e.matches ? 'midnight' : 'light-horizon', true);
        }
      });
    }

    // Initialize A11y announcer
    this.initAnnouncer();
  }

  getSavedTheme() {
    try {
      return localStorage.getItem('naura_theme');
    } catch {
      return null;
    }
  }

  getSavedDensity() {
    try {
      return localStorage.getItem('naura_density');
    } catch {
      return null;
    }
  }

  saveTheme(themeId) {
    try {
      localStorage.setItem('naura_theme', themeId);
    } catch {
      // localStorage not available
    }
  }

  saveDensity(density) {
    try {
      localStorage.setItem('naura_density', density);
    } catch {
      // localStorage not available
    }
  }

  applyTheme(themeId, announce = true) {
    // Validate theme
    const theme = this.themes.find(t => t.id === themeId);
    if (!theme) {
      console.warn(`[ThemeEngine] Unknown theme: ${themeId}`);
      return;
    }

    // Handle special cases
    let effectiveTheme = themeId;
    if (themeId === 'light') effectiveTheme = 'light-horizon';
    if (themeId === 'dark') effectiveTheme = 'midnight';

    // Apply to document
    if (effectiveTheme === 'midnight') {
      document.documentElement.removeAttribute('data-theme');
      document.body.removeAttribute('data-theme');
    } else {
      document.documentElement.setAttribute('data-theme', effectiveTheme);
      document.body.setAttribute('data-theme', effectiveTheme);
    }

    this.currentTheme = effectiveTheme;
    this.saveTheme(effectiveTheme);

    // Update UI controls
    this.updateThemeControls();

    // Announce to screen readers
    if (announce) {
      this.announce(`Theme changed to ${theme.label}`);
    }

    // Dispatch event
    this.dispatchEvent('themechange', { theme: effectiveTheme, themeData: theme });
  }

  applyDensity(density, announce = true) {
    if (!this.densities.includes(density)) {
      console.warn(`[ThemeEngine] Unknown density: ${density}`);
      return;
    }

    document.documentElement.setAttribute('data-density', density);
    document.body.setAttribute('data-density', density);

    this.currentDensity = density;
    this.saveDensity(density);

    // Update UI controls
    this.updateDensityControls();

    // Announce to screen readers
    if (announce) {
      this.announce(`Density changed to ${density}`);
    }

    // Dispatch event
    this.dispatchEvent('densitychange', { density });
  }

  setTheme(themeId) {
    this.applyTheme(themeId, true);
  }

  setDensity(density) {
    this.applyDensity(density, true);
  }

  toggleDarkLight() {
    const currentIsLight = this.currentTheme === 'light-horizon';
    if (currentIsLight) {
      // Switch to last dark theme or default
      const lastDark = localStorage.getItem('naura_last_dark_theme') || 'midnight';
      this.applyTheme(lastDark, true);
    } else {
      // Save current dark theme and switch to light
      localStorage.setItem('naura_last_dark_theme', this.currentTheme);
      this.applyTheme('light-horizon', true);
    }
  }

  cycleTheme() {
    const currentIndex = this.themes.findIndex(t => t.id === this.currentTheme);
    const nextIndex = (currentIndex + 1) % this.themes.length;
    this.applyTheme(this.themes[nextIndex].id, true);
  }

  cycleDensity() {
    const currentIndex = this.densities.indexOf(this.currentDensity);
    const nextIndex = (currentIndex + 1) % this.densities.length;
    this.applyDensity(this.densities[nextIndex], true);
  }

  getCurrentTheme() {
    return this.themes.find(t => t.id === this.currentTheme) || this.themes[0];
  }

  getCurrentDensity() {
    return this.currentDensity;
  }

  isDarkMode() {
    const theme = this.getCurrentTheme();
    return theme.dark !== false;
  }

  updateThemeControls() {
    // Update theme switcher pill
    const pill = document.getElementById('themeSwitcherPill');
    if (pill) {
      const theme = this.getCurrentTheme();
      pill.innerHTML = `<i class="fa-solid ${theme.icon}"></i> <span>${theme.label}</span>`;
      pill.setAttribute('aria-label', `Current theme: ${theme.label}. Click to change.`);
    }

    // Update dark/light toggle
    const dlBtn = document.getElementById('themeDarkLightToggle');
    if (dlBtn) {
      const isLight = this.currentTheme === 'light-horizon';
      dlBtn.setAttribute('aria-pressed', isLight ? 'true' : 'false');
      dlBtn.setAttribute('title', isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode');
      dlBtn.innerHTML = `<i class="fa-solid ${isLight ? 'fa-moon' : 'fa-sun'}"></i> <span>${isLight ? 'Dark' : 'Light'}</span>`;
    }
  }

  updateDensityControls() {
    const densityBtn = document.getElementById('densitySwitcherPill');
    if (densityBtn) {
      const icons = { compact: 'fa-compress', comfortable: 'fa-arrows-alt', spacious: 'fa-expand' };
      densityBtn.innerHTML = `<i class="fa-solid ${icons[this.currentDensity]}"></i> <span>${this.currentDensity.charAt(0).toUpperCase() + this.currentDensity.slice(1)}</span>`;
      densityBtn.setAttribute('aria-label', `Current density: ${this.currentDensity}. Click to change.`);
    }
  }

  initAnnouncer() {
    if (!document.getElementById('a11yLiveAnnouncer')) {
      const announcer = document.createElement('div');
      announcer.id = 'a11yLiveAnnouncer';
      announcer.className = 'sr-only';
      announcer.setAttribute('aria-live', 'polite');
      announcer.setAttribute('aria-atomic', 'true');
      announcer.style.cssText = 'position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0, 0, 0, 0); white-space: nowrap; border: 0;';
      document.body.appendChild(announcer);
    }
  }

  announce(message) {
    const announcer = document.getElementById('a11yLiveAnnouncer');
    if (announcer) {
      announcer.textContent = message;
    }
  }

  dispatchEvent(eventName, detail) {
    document.dispatchEvent(new CustomEvent(eventName, { detail, bubbles: true }));
  }

  // Get all available themes
  getThemes() {
    return [...this.themes];
  }

  // Get all available densities
  getDensities() {
    return [...this.densities];
  }
}

// Singleton instance
const themeEngine = new ThemeEngine();

// Expose globally
if (typeof window !== 'undefined') {
  window.nauraTheme = themeEngine;
  window.setDashboardTheme = (themeId) => themeEngine.setTheme(themeId);
}

export { ThemeEngine, themeEngine };
