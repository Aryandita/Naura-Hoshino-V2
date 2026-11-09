/**
 * Naura OS v2.5 - Core Interaction System
 * Modern minimalist dashboard interactions: sidebar, theme, density, toasts, modals, etc.
 */

(function () {
  "use strict";

  // ── State ────────────────────────────────────────────────────────
  const state = {
    sidebarCollapsed: false,
    sidebarOpen: false,
    legacySidebar: false,
    theme: "midnight",
    density: "comfortable",
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)")
      .matches,
  };

  // ── DOM References ──────────────────────────────────────────────
  const els = {
    html: document.documentElement,
    body: document.body,
    sidebar: document.getElementById("sidebar"),
    sidebarBackdrop: document.getElementById("sidebarBackdrop"),
    sidebarCollapseBtn: document.getElementById("sidebarCollapseBtn"),
    sidebarCloseBtn: document.getElementById("sidebarCloseBtn"),
    hamburgerBtn: document.getElementById("hamburgerBtn"),
    themeToggle: document.getElementById("themeToggle"),
    densityToggle: document.getElementById("densityToggle"),
    pageTitle: document.getElementById("pageTitle"),
    welcomeUser: document.getElementById("welcomeUser"),
    walletAmount: document.getElementById("walletAmount"),
    headerAuthBtn: document.getElementById("headerAuthBtn"),
    headerAuthLabel: document.getElementById("headerAuthLabel"),
    headerAvatar: document.getElementById("headerAvatar"),
    sidebarUserName: document.getElementById("sidebarUserName"),
    sidebarUserRole: document.getElementById("sidebarUserRole"),
    sidebarAvatar: document.getElementById("sidebarAvatar"),
    sidebarLoginBtn: document.getElementById("sidebarLoginBtn"),
    pillarIndicator: document.getElementById("pillarIndicator"),
  };

  // ── Utility Functions ────────────────────────────────────────────
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) =>
    Array.from(root.querySelectorAll(selector));

  function saveState() {
    localStorage.setItem(
      "nauraOS",
      JSON.stringify({
        sidebarCollapsed: state.sidebarCollapsed,
        theme: state.theme,
        density: state.density,
      }),
    );
  }

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem("nauraOS") || "{}");
      state.sidebarCollapsed = saved.sidebarCollapsed ?? false;
      state.theme = saved.theme ?? "midnight";
      state.density = saved.density ?? "comfortable";
    } catch {
      /* ignore */
    }
  }

  function applyTheme(theme) {
    state.theme = theme;
    els.html.setAttribute("data-theme", theme);
    saveState();
  }

  function applyDensity(density) {
    state.density = density;
    els.html.setAttribute("data-density", density);
    saveState();
  }

  function applySidebarCollapsed(collapsed) {
    state.sidebarCollapsed = collapsed;
    if (els.sidebar) {
      els.sidebar.classList.toggle("collapsed", collapsed);
      if (els.sidebarCollapseBtn) {
        const icon = els.sidebarCollapseBtn.querySelector("i");
        if (icon) {
          icon.className = collapsed
            ? "fa-solid fa-angles-right"
            : "fa-solid fa-angles-left";
        }
        els.sidebarCollapseBtn.setAttribute(
          "aria-label",
          collapsed ? "Perluas Sidebar (Ctrl+B)" : "Ciutkan Sidebar (Ctrl+B)",
        );
        els.sidebarCollapseBtn.setAttribute(
          "title",
          collapsed ? "Perluas Sidebar (Ctrl+B)" : "Ciutkan Sidebar (Ctrl+B)",
        );
      }
    }
    saveState();
  }

  function applySidebarOpen(open) {
    state.sidebarOpen = open;
    if (els.sidebar) {
      els.sidebar.setAttribute("aria-expanded", open);
    }
    if (els.sidebarBackdrop) {
      els.sidebarBackdrop.classList.toggle("visible", open);
    }
    if (els.hamburgerBtn) {
      els.hamburgerBtn.setAttribute("aria-expanded", open);
      const icon = els.hamburgerBtn.querySelector("i");
      if (icon) {
        icon.className = open ? "fa-solid fa-xmark" : "fa-solid fa-bars";
      }
    }
  }

  // ── Theme System ─────────────────────────────────────────────────
  const themes = [
    { id: "midnight", label: "Midnight", icon: "fa-solid fa-moon" },
    { id: "sakura", label: "Sakura Blossom", icon: "fa-solid fa-seedling" },
    { id: "cyber-neon", label: "Cyber Neon", icon: "fa-solid fa-bolt" },
    { id: "wilds", label: "Emerald Wilds", icon: "fa-solid fa-tree" },
    { id: "light", label: "Light Horizon", icon: "fa-solid fa-sun" },
    { id: "oled", label: "OLED Obsidian", icon: "fa-solid fa-circle" },
  ];

  function createThemeMenu() {
    const menu = document.createElement("div");
    menu.className = "theme-menu";
    menu.setAttribute("role", "menu");
    menu.style.cssText = `
      position: fixed;
      top: calc(var(--header-height) + 8px);
      right: 16px;
      background: var(--bg-layer);
      border: 1px solid var(--hairline);
      border-radius: var(--radius-xl);
      box-shadow: 0 16px 40px rgba(6,8,16,0.5), var(--glass-specular);
      padding: var(--space-2);
      z-index: var(--z-dropdown);
      display: none;
      min-width: 200px;
      animation: scale-in var(--spring-emphatic) forwards;
    `;
    menu.innerHTML = themes
      .map(
        (t) => `
      <button type="button" role="menuitem" data-theme="${t.id}" class="theme-option" style="
        display: flex; align-items: center; gap: var(--space-3);
        width: 100%; padding: var(--space-2) var(--space-3);
        background: transparent; border: none; border-radius: var(--radius-lg);
        color: var(--text-secondary); font-family: inherit; font-size: var(--text-sm);
        font-weight: 500; cursor: pointer; text-align: left;
        transition: all var(--spring-gentle);
      " ${t.id === state.theme ? 'aria-current="true"' : ""}>
        <i class="${t.icon}" style="font-size: 1.1em; width: 20px; text-align: center; color: ${t.id === state.theme ? "var(--ui-primary)" : "var(--text-muted)"};"></i>
        <span>${t.label}</span>
        ${t.id === state.theme ? '<i class="fa-solid fa-check" style="margin-left: auto; color: var(--ui-primary);"></i>' : ""}
      </button>
    `,
      )
      .join("");
    document.body.appendChild(menu);

    $$(".theme-option", menu).forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        applyTheme(theme);
        $$(".theme-option", menu).forEach((b) => {
          b.style.color = "var(--text-secondary)";
          b.querySelector("i").style.color = "var(--text-muted)";
          b.innerHTML = b.innerHTML.replace(
            /<i class="fa-solid fa-check".*?<\/i>/,
            "",
          );
        });
        btn.style.color = "var(--ink)";
        btn.querySelector("i").style.color = "var(--ui-primary)";
        btn.innerHTML +=
          '<i class="fa-solid fa-check" style="margin-left: auto; color: var(--ui-primary);"></i>';
        closeThemeMenu();
      });

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "var(--surface-glass-hover)";
        btn.style.color = "var(--ink)";
      });
      btn.addEventListener("mouseleave", () => {
        if (btn.dataset.theme !== state.theme) {
          btn.style.background = "transparent";
          btn.style.color = "var(--text-secondary)";
        }
      });
    });

    return menu;
  }

  let themeMenu = null;

  function openThemeMenu() {
    if (!themeMenu) themeMenu = createThemeMenu();
    const rect = els.themeToggle.getBoundingClientRect();
    themeMenu.style.top = `${rect.bottom + 8}px`;
    themeMenu.style.right = "16px";
    themeMenu.style.display = "block";
    els.themeToggle.setAttribute("aria-expanded", "true");
    document.addEventListener("click", closeThemeMenuOnOutside);
  }

  function closeThemeMenu() {
    if (themeMenu) {
      themeMenu.style.display = "none";
    }
    els.themeToggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", closeThemeMenuOnOutside);
  }

  function closeThemeMenuOnOutside(e) {
    if (
      themeMenu &&
      !themeMenu.contains(e.target) &&
      e.target !== els.themeToggle &&
      !els.themeToggle.contains(e.target)
    ) {
      closeThemeMenu();
    }
  }

  // ── Density System ───────────────────────────────────────────────
  const densities = [
    { id: "compact", label: "Compact", icon: "fa-solid fa-compress" },
    { id: "comfortable", label: "Comfortable", icon: "fa-solid fa-grip-lines" },
    { id: "spacious", label: "Spacious", icon: "fa-solid fa-expand" },
  ];

  function createDensityMenu() {
    const menu = document.createElement("div");
    menu.className = "density-menu";
    menu.setAttribute("role", "menu");
    menu.style.cssText = `
      position: fixed;
      top: calc(var(--header-height) + 8px);
      right: 16px;
      background: var(--bg-layer);
      border: 1px solid var(--hairline);
      border-radius: var(--radius-xl);
      box-shadow: 0 16px 40px rgba(6,8,16,0.5), var(--glass-specular);
      padding: var(--space-2);
      z-index: var(--z-dropdown);
      display: none;
      min-width: 180px;
      animation: scale-in var(--spring-emphatic) forwards;
    `;
    menu.innerHTML = densities
      .map(
        (d) => `
      <button type="button" role="menuitem" data-density="${d.id}" class="density-option" style="
        display: flex; align-items: center; gap: var(--space-3);
        width: 100%; padding: var(--space-2) var(--space-3);
        background: transparent; border: none; border-radius: var(--radius-lg);
        color: var(--text-secondary); font-family: inherit; font-size: var(--text-sm);
        font-weight: 500; cursor: pointer; text-align: left;
        transition: all var(--spring-gentle);
      " ${d.id === state.density ? 'aria-current="true"' : ""}>
        <i class="${d.icon}" style="font-size: 1.1em; width: 20px; text-align: center; color: ${d.id === state.density ? "var(--ui-primary)" : "var(--text-muted)"};"></i>
        <span>${d.label}</span>
        ${d.id === state.density ? '<i class="fa-solid fa-check" style="margin-left: auto; color: var(--ui-primary);"></i>' : ""}
      </button>
    `,
      )
      .join("");
    document.body.appendChild(menu);

    $$(".density-option", menu).forEach((btn) => {
      btn.addEventListener("click", () => {
        const density = btn.dataset.density;
        applyDensity(density);
        $$(".density-option", menu).forEach((b) => {
          b.style.color = "var(--text-secondary)";
          b.querySelector("i").style.color = "var(--text-muted)";
          b.innerHTML = b.innerHTML.replace(
            /<i class="fa-solid fa-check".*?<\/i>/,
            "",
          );
        });
        btn.style.color = "var(--ink)";
        btn.querySelector("i").style.color = "var(--ui-primary)";
        btn.innerHTML +=
          '<i class="fa-solid fa-check" style="margin-left: auto; color: var(--ui-primary);"></i>';
        closeDensityMenu();
      });

      btn.addEventListener("mouseenter", () => {
        btn.style.background = "var(--surface-glass-hover)";
        btn.style.color = "var(--ink)";
      });
      btn.addEventListener("mouseleave", () => {
        if (btn.dataset.density !== state.density) {
          btn.style.background = "transparent";
          btn.style.color = "var(--text-secondary)";
        }
      });
    });

    return menu;
  }

  let densityMenu = null;

  function openDensityMenu() {
    if (!densityMenu) densityMenu = createDensityMenu();
    const rect = els.densityToggle.getBoundingClientRect();
    densityMenu.style.top = `${rect.bottom + 8}px`;
    densityMenu.style.right = "16px";
    densityMenu.style.display = "block";
    els.densityToggle.setAttribute("aria-expanded", "true");
    document.addEventListener("click", closeDensityMenuOnOutside);
  }

  function closeDensityMenu() {
    if (densityMenu) {
      densityMenu.style.display = "none";
    }
    els.densityToggle.setAttribute("aria-expanded", "false");
    document.removeEventListener("click", closeDensityMenuOnOutside);
  }

  function closeDensityMenuOnOutside(e) {
    if (
      densityMenu &&
      !densityMenu.contains(e.target) &&
      e.target !== els.densityToggle &&
      !els.densityToggle.contains(e.target)
    ) {
      closeDensityMenu();
    }
  }

  // ── Toast System ─────────────────────────────────────────────────
  let toastContainer = null;

  function getToastContainer() {
    if (!toastContainer) {
      toastContainer = document.createElement("div");
      toastContainer.className = "toast-container";
      toastContainer.setAttribute("role", "region");
      toastContainer.setAttribute("aria-label", "Notifikasi");
      toastContainer.setAttribute("aria-live", "polite");
      document.body.appendChild(toastContainer);
    }
    return toastContainer;
  }

  window.showToast = function ({
    title,
    message,
    type = "info",
    duration = 5000,
    action,
  }) {
    const container = getToastContainer();
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "alert");
    toast.setAttribute("aria-live", "assertive");

    const icons = {
      success: "fa-solid fa-circle-check",
      error: "fa-solid fa-circle-exclamation",
      warning: "fa-solid fa-triangle-exclamation",
      info: "fa-solid fa-circle-info",
    };

    toast.innerHTML = `
      <div class="toast-icon" aria-hidden="true">
        <i class="${icons[type]}"></i>
      </div>
      <div class="toast-content">
        <div class="toast-title">${title}</div>
        ${message ? `<div class="toast-message">${message}</div>` : ""}
      </div>
      ${action ? `<button type="button" class="toast-action btn btn-ghost btn-sm">${action.label}</button>` : ""}
      <button type="button" class="toast-close" aria-label="Tutup notifikasi">
        <i class="fa-solid fa-xmark" aria-hidden="true"></i>
      </button>
    `;

    if (action && action.onClick) {
      toast.querySelector(".toast-action").addEventListener("click", () => {
        action.onClick();
        removeToast(toast);
      });
    }

    toast
      .querySelector(".toast-close")
      .addEventListener("click", () => removeToast(toast));

    container.appendChild(toast);

    // Auto-remove
    if (duration > 0) {
      setTimeout(() => removeToast(toast), duration);
    }

    return toast;
  };

  function removeToast(toast) {
    toast.style.animation = "toast-exit var(--spring-emphatic) forwards";
    toast.addEventListener("animationend", () => toast.remove(), {
      once: true,
    });
  }

  // Add toast exit animation
  const style = document.createElement("style");
  style.textContent = `
    @keyframes toast-exit {
      from { opacity: 1; transform: translateX(0) translateY(0); }
      to { opacity: 0; transform: translateX(120%) translateY(-10px); }
    }
  `;
  document.head.appendChild(style);

  // ── Modal System ─────────────────────────────────────────────────
  let modalBackdrop = null;
  let activeModal = null;

  function getModalBackdrop() {
    if (!modalBackdrop) {
      modalBackdrop = document.createElement("div");
      modalBackdrop.className = "modal-backdrop";
      modalBackdrop.setAttribute("role", "presentation");
      document.body.appendChild(modalBackdrop);
      modalBackdrop.addEventListener("click", closeModal);
    }
    return modalBackdrop;
  }

  window.showModal = function ({ title, content, actions = [], size = "md" }) {
    const backdrop = getModalBackdrop();

    const modal = document.createElement("div");
    modal.className = "modal";
    modal.setAttribute("role", "dialog");
    modal.setAttribute("aria-modal", "true");
    modal.setAttribute("aria-labelledby", "modal-title");
    modal.style.maxWidth =
      size === "sm" ? "400px" : size === "lg" ? "720px" : "560px";

    modal.innerHTML = `
      <div class="modal-header">
        <h2 id="modal-title" class="modal-title">${title}</h2>
        <button type="button" class="modal-close" aria-label="Tutup dialog">
          <i class="fa-solid fa-xmark" aria-hidden="true"></i>
        </button>
      </div>
      <div class="modal-body">${content}</div>
      ${
        actions.length
          ? `
        <div class="modal-footer">
          ${actions
            .map(
              (a, i) => `
            <button type="button" class="btn ${a.variant || "btn-ghost"} ${a.class || ""}" data-action="${i}">
              ${a.icon ? `<i class="${a.icon}" aria-hidden="true"></i>` : ""}
              ${a.label}
            </button>
          `,
            )
            .join("")}
        </div>
      `
          : ""
      }
    `;

    document.body.appendChild(modal);

    // Focus management
    const focusable = modal.querySelectorAll(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])',
    );
    const firstFocusable = focusable[0];
    const lastFocusable = focusable[focusable.length - 1];

    modal.querySelector(".modal-close").addEventListener("click", closeModal);
    modal.querySelectorAll("[data-action]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const action = actions[parseInt(btn.dataset.action)];
        if (action.onClick) action.onClick();
        if (!action.keepOpen) closeModal();
      });
    });

    // Trap focus
    function trapFocus(e) {
      if (e.key !== "Tab") return;
      if (e.shiftKey) {
        if (document.activeElement === firstFocusable) {
          e.preventDefault();
          lastFocusable.focus();
        }
      } else {
        if (document.activeElement === lastFocusable) {
          e.preventDefault();
          firstFocusable.focus();
        }
      }
    }
    modal.addEventListener("keydown", trapFocus);

    // ESC to close
    function onEsc(e) {
      if (e.key === "Escape") closeModal();
    }
    document.addEventListener("keydown", onEsc);

    // Animate in
    requestAnimationFrame(() => {
      backdrop.classList.add("visible");
      modal.classList.add("visible");
      firstFocusable?.focus();
    });

    activeModal = modal;

    return {
      close: closeModal,
      updateContent: (html) => {
        modal.querySelector(".modal-body").innerHTML = html;
      },
      updateTitle: (text) => {
        modal.querySelector(".modal-title").textContent = text;
      },
    };
  };

  function closeModal() {
    if (activeModal) {
      activeModal.classList.remove("visible");
      modalBackdrop?.classList.remove("visible");
      setTimeout(() => {
        activeModal.remove();
        activeModal = null;
      }, 320);
    }
  }

  // ── Keyboard Shortcuts ───────────────────────────────────────────
  function handleKeyboard(e) {
    // Ctrl/Cmd + B: Toggle sidebar collapse
    if ((e.ctrlKey || e.metaKey) && e.key === "b") {
      e.preventDefault();
      if (els.sidebarCollapseBtn) els.sidebarCollapseBtn.click();
    }

    // Ctrl/Cmd + K: Command palette (future)
    if ((e.ctrlKey || e.metaKey) && e.key === "k") {
      e.preventDefault();
      showToast({
        title: "Command Palette",
        message: "Coming soon: Global search & actions (Ctrl+K)",
        type: "info",
      });
    }

    // Ctrl/Cmd + Shift + T: Toggle theme
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === "T") {
      e.preventDefault();
      if (els.themeToggle) els.themeToggle.click();
    }

    // Escape: Close sidebar on mobile
    if (e.key === "Escape" && state.sidebarOpen && !state.legacySidebar) {
      applySidebarOpen(false);
    }
  }

  // ── Initialize ───────────────────────────────────────────────────
  function init() {
    loadState();
    // Markup lama (sidebar-overlay) dikendalikan penuh oleh sharedNav.js.
    // Naura OS hanya mengelola tema/densitas/toast/modal agar tidak double-bind.
    state.legacySidebar = !!document.querySelector(".sidebar-overlay");
    if (state.legacySidebar) {
      // Tema legacy dikelola sharedNav.js via kunci "naura_theme"; jangan timpa.
      try {
        state.theme = localStorage.getItem("naura_theme") || state.theme;
      } catch {
        /* ignore */
      }
    } else {
      applyTheme(state.theme);
    }
    applyDensity(state.density);
    if (!state.legacySidebar) applySidebarCollapsed(state.sidebarCollapsed);

    // Sidebar toggle (collapse)
    if (!state.legacySidebar) {
      els.sidebarCollapseBtn?.addEventListener("click", () => {
        applySidebarCollapsed(!state.sidebarCollapsed);
      });

      // Sidebar close (mobile)
      els.sidebarCloseBtn?.addEventListener("click", () =>
        applySidebarOpen(false),
      );
      els.sidebarBackdrop?.addEventListener("click", () =>
        applySidebarOpen(false),
      );

      // Hamburger (mobile)
      els.hamburgerBtn?.addEventListener("click", () => {
        applySidebarOpen(!state.sidebarOpen);
      });
    }

    // Theme toggle
    els.themeToggle?.addEventListener("click", (e) => {
      e.stopPropagation();
      openThemeMenu();
    });

    // Density toggle
    els.densityToggle?.addEventListener("click", (e) => {
      e.stopPropagation();
      openDensityMenu();
    });

    // Nav items: close sidebar on mobile after navigation
    if (els.sidebar) {
      $$(".nav-item", els.sidebar).forEach((item) => {
        item.addEventListener("click", () => {
          if (!state.legacySidebar && window.innerWidth <= 768) applySidebarOpen(false);
          // Update active state
          $$(".nav-item", els.sidebar).forEach((i) =>
            i.classList.remove("active"),
          );
          item.classList.add("active");
        });
      });
    }

    // Mobile nav items
    $$(".mobile-nav-item").forEach((item) => {
      item.addEventListener("click", () => {
        $$(".mobile-nav-item").forEach((i) => i.classList.remove("active"));
        item.classList.add("active");
      });
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", handleKeyboard);

    // Reduced motion detection
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    mq.addEventListener("change", (e) => {
      state.reducedMotion = e.matches;
      els.html.style.setProperty(
        "--duration-instant",
        e.matches ? "0ms" : "50ms",
      );
      els.html.style.setProperty(
        "--duration-fast",
        e.matches ? "0ms" : "120ms",
      );
      els.html.style.setProperty(
        "--duration-base",
        e.matches ? "0ms" : "200ms",
      );
      els.html.style.setProperty(
        "--duration-slow",
        e.matches ? "0ms" : "300ms",
      );
      els.html.style.setProperty(
        "--duration-slower",
        e.matches ? "0ms" : "450ms",
      );
      els.html.style.setProperty(
        "--duration-slowest",
        e.matches ? "0ms" : "600ms",
      );
    });

    // Resize handler for mobile sidebar
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!state.legacySidebar && window.innerWidth > 768 && state.sidebarOpen) {
          applySidebarOpen(false);
        }
      }, 100);
    });

    // Announce ready
    console.log("[Naura OS] Core interaction system initialized", {
      theme: state.theme,
      density: state.density,
      sidebarCollapsed: state.sidebarCollapsed,
      reducedMotion: state.reducedMotion,
    });
  }

  // Run on DOM ready
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Export for other scripts
  window.NauraOS = {
    state,
    applyTheme,
    applyDensity,
    applySidebarCollapsed,
    applySidebarOpen,
    showToast,
    showModal,
    els,
  };
})();
