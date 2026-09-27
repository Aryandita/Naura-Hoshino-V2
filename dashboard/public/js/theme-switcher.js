"use strict";

/**
 * @file theme-switcher.js
 * @description Dynamic multi-theme switcher for Stellar Glass OS (Feature #17)
 */

(function () {
  const THEMES = [
    { id: "stellar-dark", name: "Stellar Dark", icon: "🌌" },
    { id: "cyber-neon", name: "Cyber Neon", icon: "⚡" },
    { id: "emerald-nature", name: "Emerald Wilds", icon: "🌿" },
    { id: "light-horizon", name: "Light Horizon", icon: "☀️" },
  ];

  function applyTheme(themeId) {
    if (themeId === "stellar-dark") {
      document.documentElement.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
    }
    try {
      localStorage.setItem("naura-theme", themeId);
    } catch (_) {}
  }

  // Load saved theme immediately to prevent FOUC
  const savedTheme = (function () {
    try {
      return localStorage.getItem("naura-theme") || "stellar-dark";
    } catch (_) {
      return "stellar-dark";
    }
  })();
  applyTheme(savedTheme);

  window.setDashboardTheme = applyTheme;

  // Inject sleek floating theme switcher widget
  window.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("stellar-theme-widget")) return;

    const widget = document.createElement("div");
    widget.id = "stellar-theme-widget";
    widget.style.cssText =
      "position:fixed;bottom:24px;left:24px;z-index:9998;display:flex;align-items:center;background:rgba(10,13,24,0.75);backdrop-filter:blur(16px);border:1px solid rgba(255,255,255,0.12);border-radius:9999px;padding:4px;box-shadow:0 8px 32px rgba(0,0,0,0.4);gap:4px;transition:all 0.3s ease;";

    THEMES.forEach((t) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.title = t.name;
      btn.innerHTML = `<span>${t.icon}</span>`;
      btn.style.cssText =
        "background:transparent;border:none;color:#fff;cursor:pointer;padding:6px 10px;border-radius:9999px;font-size:14px;transition:all 0.2s;";
      btn.addEventListener("mouseenter", () => {
        btn.style.background = "rgba(255,255,255,0.15)";
      });
      btn.addEventListener("mouseleave", () => {
        btn.style.background = "transparent";
      });
      btn.addEventListener("click", () => {
        applyTheme(t.id);
      });
      widget.appendChild(btn);
    });

    document.body.appendChild(widget);
  });
})();
