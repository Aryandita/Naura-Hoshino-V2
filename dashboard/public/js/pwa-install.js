"use strict";

// PWA Service Worker Registration & Install Prompt Handler
(function () {
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          console.log("[PWA] Service Worker registered successfully:", reg.scope);
        })
        .catch((err) => {
          console.warn("[PWA] Service Worker registration failed:", err);
        });
    });
  }

  let deferredPrompt = null;
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const banner = document.getElementById("pwa-install-banner");
    if (banner) {
      banner.style.display = "flex";
    }
  });

  window.installPwa = async function () {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log("[PWA] Install prompt outcome:", outcome);
    deferredPrompt = null;
    const banner = document.getElementById("pwa-install-banner");
    if (banner) {
      banner.style.display = "none";
    }
  };
})();
