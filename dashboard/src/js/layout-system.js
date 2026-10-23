/**
 * layout-system.js - Responsive App Shell with Collapsible Sidebar
 * 
 * Features:
 * - Responsive sidebar (desktop: collapsible, mobile: drawer)
 * - Bento Grid layout system
 * - Mobile-first breakpoints
 * - Keyboard shortcuts (Ctrl+B for sidebar toggle, Ctrl+K for search)
 * - Persistent sidebar state
 * 
 * Usage:
 *   import { LayoutSystem } from './layout-system.js';
 *   const layout = new LayoutSystem();
 */

class LayoutSystem {
  constructor() {
    this.sidebarCollapsed = this.getSavedSidebarState();
    this.mobileBreakpoint = 1024;
    
    this.init();
  }

  init() {
    // Wait for DOM ready
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => this.setup());
    } else {
      this.setup();
    }
  }

  setup() {
    this.cacheElements();
    this.setupSidebar();
    this.setupMobileNav();
    this.setupKeyboardShortcuts();
    this.setupResizeHandler();
    this.applyInitialState();
  }

  cacheElements() {
    this.sidebar = document.querySelector('.sidebar');
    this.overlay = document.querySelector('.sidebar-overlay');
    this.hamburger = document.querySelector('.hamburger-btn');
    this.closeBtn = document.querySelector('.sidebar-close-btn');
    this.mainContent = document.querySelector('.main-content');
  }

  setupSidebar() {
    if (!this.sidebar) return;

    // Hamburger toggle
    if (this.hamburger) {
      this.hamburger.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleSidebar();
      });
    }

    // Close button
    if (this.closeBtn) {
      this.closeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.closeSidebar();
      });
    }

    // Overlay click to close
    if (this.overlay) {
      this.overlay.addEventListener('click', () => {
        this.closeSidebar();
      });
    }

    // Close on Escape key
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isSidebarOpen()) {
        this.closeSidebar();
      }
    });

    // Add collapse button to sidebar brand
    this.addCollapseButton();

    // Close sidebar on nav item click (mobile)
    this.sidebar.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        if (window.innerWidth <= this.mobileBreakpoint) {
          this.closeSidebar();
        }
      });
    });
  }

  addCollapseButton() {
    const brand = this.sidebar?.querySelector('.sidebar-brand');
    if (brand && !brand.querySelector('.sidebar-collapse-btn')) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'sidebar-collapse-btn';
      btn.id = 'sidebarCollapseBtn';
      btn.title = 'Toggle Sidebar (Ctrl+B)';
      btn.setAttribute('aria-label', 'Toggle Compact Sidebar');
      btn.innerHTML = '<i class="fa-solid fa-chevron-left"></i>';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleCollapse();
      });
      brand.appendChild(btn);
    }
  }

  setupMobileNav() {
    // Create mobile bottom navigation if not exists
    if (!document.querySelector('.mobile-nav')) {
      const nav = document.createElement('nav');
      nav.className = 'mobile-nav';
      nav.setAttribute('aria-label', 'Mobile Navigation');
      nav.innerHTML = `
        <div class="mobile-nav-inner">
          <a href="/" class="mobile-nav-item" data-group="dashboard">
            <span class="mn-icon"><i class="fa-solid fa-gauge-high"></i></span>
            <span class="mn-label">Dashboard</span>
          </a>
          <a href="/world" class="mobile-nav-item" data-group="map">
            <span class="mn-icon"><i class="fa-solid fa-earth-asia"></i></span>
            <span class="mn-label">Map</span>
          </a>
          <a href="/automations" class="mobile-nav-item" data-group="config">
            <span class="mn-icon"><i class="fa-solid fa-sliders"></i></span>
            <span class="mn-label">Config</span>
          </a>
          <a href="/music" class="mobile-nav-item" data-group="system">
            <span class="mn-icon"><i class="fa-solid fa-microchip"></i></span>
            <span class="mn-label">System</span>
          </a>
          <a href="/settings" class="mobile-nav-item" data-group="settings">
            <span class="mn-icon"><i class="fa-solid fa-gears"></i></span>
            <span class="mn-label">Settings</span>
          </a>
        </div>
      `;
      document.body.appendChild(nav);
    }
  }

  setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
      // Ctrl+B: Toggle sidebar collapse
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'b') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
          e.preventDefault();
          this.toggleCollapse();
        }
      }

      // Ctrl+K: Open command palette
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA' && !e.target.isContentEditable) {
          e.preventDefault();
          this.openCommandPalette();
        }
      }
    });
  }

  setupResizeHandler() {
    let resizeTimer;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        this.handleResize();
      }, 150);
    });
  }

  handleResize() {
    const isMobile = window.innerWidth <= this.mobileBreakpoint;
    
    if (isMobile) {
      // On mobile, always start with closed sidebar
      this.closeSidebar();
      this.sidebar?.classList.remove('collapsed');
    } else {
      // On desktop, restore saved collapse state
      if (this.sidebarCollapsed) {
        this.sidebar?.classList.add('collapsed');
      }
    }
  }

  applyInitialState() {
    // Apply saved collapse state on desktop
    if (this.sidebarCollapsed && window.innerWidth > this.mobileBreakpoint) {
      this.sidebar?.classList.add('collapsed');
    }

    // Mark active nav items
    this.markActiveNavItems();
  }

  markActiveNavItems() {
    const currentPath = window.location.pathname.replace(/\/$/, '') || '/';
    
    document.querySelectorAll('.nav-item[href]').forEach(link => {
      const href = link.getAttribute('href')?.replace(/\/$/, '') || '';
      const isActive = href === currentPath || (href !== '/' && currentPath.startsWith(href));
      
      link.classList.toggle('active', isActive);
      if (isActive) {
        link.setAttribute('aria-current', 'page');
      } else {
        link.removeAttribute('aria-current');
      }
    });
  }

  // Public methods
  openSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.add('open');
    this.overlay?.classList.add('active');
    document.body.style.overflow = 'hidden';
    this.hamburger?.setAttribute('aria-expanded', 'true');
  }

  closeSidebar() {
    if (!this.sidebar) return;
    this.sidebar.classList.remove('open');
    this.overlay?.classList.remove('active');
    document.body.style.overflow = '';
    this.hamburger?.setAttribute('aria-expanded', 'false');
  }

  toggleSidebar() {
    if (this.isSidebarOpen()) {
      this.closeSidebar();
    } else {
      this.openSidebar();
    }
  }

  isSidebarOpen() {
    return this.sidebar?.classList.contains('open');
  }

  collapse() {
    if (window.innerWidth <= this.mobileBreakpoint) return;
    this.sidebar?.classList.add('collapsed');
    this.sidebarCollapsed = true;
    this.saveSidebarState(true);
    this.updateCollapseIcon();
  }

  expand() {
    this.sidebar?.classList.remove('collapsed');
    this.sidebarCollapsed = false;
    this.saveSidebarState(false);
    this.updateCollapseIcon();
  }

  toggleCollapse() {
    if (this.sidebarCollapsed) {
      this.expand();
    } else {
      this.collapse();
    }
  }

  updateCollapseIcon() {
    const btn = document.getElementById('sidebarCollapseBtn');
    if (btn) {
      const icon = btn.querySelector('i');
      if (icon) {
        icon.className = this.sidebarCollapsed ? 'fa-solid fa-chevron-right' : 'fa-solid fa-chevron-left';
      }
    }
  }

  getSavedSidebarState() {
    try {
      return localStorage.getItem('naura_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  }

  saveSidebarState(collapsed) {
    try {
      localStorage.setItem('naura_sidebar_collapsed', String(collapsed));
    } catch {
      // localStorage not available
    }
  }

  openCommandPalette() {
    // Trigger command palette (to be implemented)
    const trigger = document.getElementById('sidebarCmdTrigger');
    if (trigger) {
      trigger.click();
    }
  }
}

// Singleton instance
const layoutSystem = new LayoutSystem();

// Expose globally
if (typeof window !== 'undefined') {
  window.nauraLayout = layoutSystem;
}

export { LayoutSystem, layoutSystem };
