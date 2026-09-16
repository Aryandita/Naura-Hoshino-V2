/**
 * shared-nav.js, Shared Navigation & Layout Initializer
 * Naura Hoshino V2 Dashboard Preview
 *
 * Provides sidebar toggle, mobile nav, page transitions,
 * and active state management for all dashboard pages.
 */

(function () {
  'use strict';

  // ── Sidebar Toggle & Mobile Drawer ──────────────────────────────
  const sidebar = document.querySelector('.sidebar');
  const overlay = document.querySelector('.sidebar-overlay');
  const hamburger = document.querySelector('.hamburger-btn');
  const closeBtn = document.querySelector('.sidebar-close-btn');

  function openSidebar() {
    if (!sidebar) return;
    sidebar.classList.add('open');
    if (overlay) { overlay.classList.add('active'); document.body.style.overflow = 'hidden'; }
    if (hamburger) hamburger.setAttribute('aria-expanded', 'true');
  }

  function closeSidebar() {
    if (!sidebar) return;
    sidebar.classList.remove('open');
    if (overlay) { overlay.classList.remove('active'); document.body.style.overflow = ''; }
    if (hamburger) hamburger.setAttribute('aria-expanded', 'false');
  }

  if (hamburger) {
    hamburger.addEventListener('click', (e) => {
      e.stopPropagation();
      sidebar?.classList.contains('open') ? closeSidebar() : openSidebar();
    });
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      closeSidebar();
    });
  }

  if (overlay) {
    overlay.addEventListener('click', closeSidebar);
  }

  // Close on mobile when clicking any navigation link
  sidebar?.querySelectorAll('.nav-item').forEach((item) => {
    item.addEventListener('click', () => {
      if (window.innerWidth <= 1024) {
        closeSidebar();
      }
    });
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeSidebar();
  });

  // ── Active Nav Item ─────────────────────────────────────────────
  const currentPath = window.location.pathname.replace(/\/$/, '') || '/';

  document.querySelectorAll('.nav-item[href], .mobile-nav-item[href]').forEach((link) => {
    const linkPath = link.getAttribute('href')?.replace(/\/$/, '') || '';
    const isHome = (linkPath === '' || linkPath === '/') && (currentPath === '' || currentPath === '/');
    const isMatch = linkPath !== '' && linkPath !== '/' && (currentPath === linkPath || currentPath.startsWith(linkPath + '/'));

    if (isHome || isMatch) {
      link.classList.add('active');
    } else {
      link.classList.remove('active');
    }
  });

  // ── Page Transition Fade-In ──────────────────────────────────────
  document.body.style.opacity = '0';
  document.body.style.transition = 'opacity 0.25s ease';

  window.addEventListener('load', () => {
    requestAnimationFrame(() => {
      document.body.style.opacity = '1';
    });
  });

  // Smooth exit on internal navigation
  document.querySelectorAll('a[href^="/"], a[href^="./"]').forEach((anchor) => {
    anchor.addEventListener('click', (e) => {
      const href = anchor.getAttribute('href');
      if (e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      document.body.style.opacity = '0';
      setTimeout(() => { window.location.href = href; }, 200);
    });
  });

  // ── Loading Screen Dismissal ─────────────────────────────────────
  const loadingScreen = document.querySelector('.loading-screen');
  if (loadingScreen) {
    window.addEventListener('load', () => {
      setTimeout(() => {
        loadingScreen.classList.add('fade-out');
        setTimeout(() => loadingScreen.remove(), 500);
      }, 600);
    });
  }

  // ── Stagger Animate-In ────────────────────────────────────────────
  window.addEventListener('load', () => {
    document.querySelectorAll('.animate-in, .animate-in-left, .animate-scale').forEach((el, i) => {
      if (!el.style.animationDelay) {
        el.style.animationDelay = `${i * 0.04}s`;
      }
    });
  });

  // ── Toast Helper ─────────────────────────────────────────────────
  window.showToast = function (message, type = 'info', duration = 3500) {
    let stack = document.querySelector('.toast-stack');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'toast-stack';
      document.body.appendChild(stack);
    }

    const icons = { info: '🌸', success: '✅', error: '❌', warning: '⚠️' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
      <span style="font-size:18px;flex-shrink:0;">${icons[type] || '🌸'}</span>
      <div>
        <div style="font-size:13px;color:var(--text-primary);font-weight:600;">${message}</div>
      </div>
      <button onclick="this.closest('.toast').remove()" style="margin-left:auto;background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:14px;flex-shrink:0;">✕</button>
    `;
    stack.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(20px)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, duration);
  };

  // ── Supabase Realtime Telemetry Loader ───────────────────────────
  if (!document.getElementById('supabase-realtime-script')) {
    const s = document.createElement('script');
    s.id = 'supabase-realtime-script';
    s.src = '/src/js/supabase-realtime.js';
    document.body.appendChild(s);
  }

  // ── Universal Auth & Session Manager Loader ──────────────────────
  if (!document.getElementById('naura-auth-script')) {
    const a = document.createElement('script');
    a.id = 'naura-auth-script';
    a.src = '/src/js/auth-manager.js';
    document.body.appendChild(a);
  }

})();

