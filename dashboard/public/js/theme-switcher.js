"use strict";

/**
 * @file theme-switcher.js
 * @description Dynamic multi-theme switcher for Stellar Glass OS
 */

(function () {
  function applyTheme(themeId) {
    if (!themeId || themeId === "stellar-dark" || themeId === "midnight") {
      document.documentElement.removeAttribute("data-theme");
      if (document.body) document.body.removeAttribute("data-theme");
    } else {
      document.documentElement.setAttribute("data-theme", themeId);
      if (document.body) document.body.setAttribute("data-theme", themeId);
    }
    try {
      localStorage.setItem("naura_theme", themeId);
      localStorage.setItem("naura-theme", themeId);
    } catch (_) {}
  }

  // Load saved theme immediately to prevent FOUC
  const savedTheme = (function () {
    try {
      return localStorage.getItem("naura_theme") || localStorage.getItem("naura-theme") || "midnight";
    } catch (_) {
      return "midnight";
    }
  })();
  applyTheme(savedTheme);

  window.setDashboardTheme = applyTheme;

  // Pastikan tidak ada widget terapung yang menghalangi sidebar atau area pandangan
  window.addEventListener("DOMContentLoaded", () => {
    const existing = document.getElementById("stellar-theme-widget");
    if (existing) {
      existing.remove();
    }
  });
})();

