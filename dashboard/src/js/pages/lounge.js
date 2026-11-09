/**
 * Lounge Page - 3D AI Lounge Studio
 * Handled by nauraLounge3D.js (ES module)
 * This file handles non-3D UI interactions
 */

class LoungePage {
  constructor() {
    this.init();
  }

  init() {
    this.setupModelButtons();
    this.setupKeyboardShortcuts();
  }

  setupModelButtons() {
    // Handled by nauraLounge3D.js
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;

      switch (e.key.toLowerCase()) {
        case 'f':
          document.getElementById('loungeBtnFullscreen')?.click();
          break;
        case 's':
          document.getElementById('loungeBtnSnapshot')?.click();
          break;
        case 'r':
          document.getElementById('loungeBtnResetCam')?.click();
          break;
        case 'h':
          document.getElementById('loungeBtnHalo')?.click();
          break;
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          const anims = ['Idle', 'Wave', 'Thinking', 'Cheers', 'Shy'];
          const idx = parseInt(e.key) - 1;
          if (anims[idx]) {
            window.nauraLounge3D?.setAnimation(anims[idx]);
          }
          break;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.loungePage = new LoungePage();
});