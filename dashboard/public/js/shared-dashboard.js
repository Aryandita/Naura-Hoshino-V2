"use strict";

/**
 * Shared Dashboard Client Runtime
 * Mengonsolidasikan koneksi WebSocket, Live Activity Feed, Toast UI, dan navigasi responsif.
 */

(function () {
  let _socket = null;
  let _toastContainer = null;

  /**
   * Mengambil atau menginisialisasi instance Socket.IO singleton klien.
   * @returns {object|null}
   */
  function getDashboardSocket() {
    if (_socket) return _socket;
    if (typeof window.io === "function") {
      try {
        _socket = window.io({
          transports: ["websocket", "polling"],
          reconnectionAttempts: 5,
          reconnectionDelay: 2000,
        });
      } catch (_) {
        _socket = null;
      }
    }
    return _socket;
  }

  /**
   * Menampilkan toast notification yang rapi di pojok layar.
   * @param {string} message
   * @param {"info"|"success"|"warning"|"error"} [type="info"]
   * @param {number} [duration=3500]
   */
  function showToast(message, type = "info", duration = 3500) {
    if (!_toastContainer) {
      _toastContainer = document.getElementById("naura-toast-container");
      if (!_toastContainer) {
        _toastContainer = document.createElement("div");
        _toastContainer.id = "naura-toast-container";
        _toastContainer.style.cssText = `
          position: fixed;
          bottom: 24px;
          right: 24px;
          z-index: 99999;
          display: flex;
          flex-direction: column;
          gap: 10px;
          pointer-events: none;
          max-width: 360px;
        `;
        document.body.appendChild(_toastContainer);
      }
    }

    const toast = document.createElement("div");
    toast.className = `naura-toast naura-toast-${type}`;
    toast.style.cssText = `
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 13.5px;
      font-weight: 500;
      color: #fff;
      background: rgba(14, 17, 24, 0.92);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border: 1px solid rgba(255, 255, 255, 0.12);
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      pointer-events: auto;
      cursor: pointer;
      opacity: 0;
      transform: translateY(12px);
      transition: opacity 0.25s ease, transform 0.25s ease;
    `;

    const typeBorders = {
      success: "#22c55e",
      warning: "#f59e0b",
      error: "#ef4444",
      info: "#38bdf8",
    };
    if (typeBorders[type]) {
      toast.style.borderLeft = `4px solid ${typeBorders[type]}`;
    }

    toast.textContent = message;
    _toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
      toast.style.opacity = "1";
      toast.style.transform = "translateY(0)";
    });

    const removeToast = () => {
      toast.style.opacity = "0";
      toast.style.transform = "translateY(8px)";
      setTimeout(() => {
        if (toast.parentNode) toast.parentNode.removeChild(toast);
      }, 250);
    };

    const timer = setTimeout(removeToast, duration);
    toast.addEventListener("click", () => {
      clearTimeout(timer);
      removeToast();
    });
  }

  /**
   * Menginisialisasi Live Activity Feed terpadu via WebSocket.
   * @param {string} containerId - ID elemen DOM container feed
   * @param {number} [maxItems=12]
   */
  function initLiveActivityFeed(containerId, maxItems = 12) {
    const container = document.getElementById(containerId);
    if (!container) return;

    const socket = getDashboardSocket();
    if (!socket) return;

    function addFeedItem(title, text, timeStr = "Baru saja", badgeColor = "#38bdf8") {
      const item = document.createElement("div");
      item.className = "feed-activity-card";
      item.style.cssText = `
        padding: 10px 14px;
        margin-bottom: 8px;
        border-radius: 8px;
        background: rgba(255, 255, 255, 0.03);
        border: 1px solid rgba(255, 255, 255, 0.06);
        display: flex;
        flex-direction: column;
        gap: 4px;
        animation: fadeIn 0.3s ease;
      `;

      item.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; font-size:12px;">
          <strong style="color: ${badgeColor}; font-weight:600;">${title}</strong>
          <span style="opacity:0.6; font-size:11px;">${timeStr}</span>
        </div>
        <div style="font-size:13px; opacity:0.9;">${text}</div>
      `;

      container.prepend(item);
      while (container.children.length > maxItems) {
        container.removeChild(container.lastChild);
      }
    }

    socket.on("dashboard_feed_activity", (data) => {
      if (!data) return;
      addFeedItem(data.title || "Aktivitas", data.message || "", data.time, data.color);
    });

    socket.on("soundboard_played", (data) => {
      if (!data) return;
      const soundName = data.sound?.title || data.sound?.id || "Suara";
      const requester = data.requester?.username ? `@${data.requester.username}` : "Pengguna";
      addFeedItem("🔊 Soundboard", `${requester} membunyikan "${soundName}"`, "Realtime", "#ec4899");
    });

    socket.on("system_broadcast", (data) => {
      if (!data || !data.message) return;
      addFeedItem("📢 Pengumuman", data.message, "Penting", "#eab308");
      showToast(data.message, "warning", 6000);
    });
  }

  /**
   * Mengaktifkan toggle sidebar untuk tampilan mobile viewport.
   */
  function initResponsiveNavigation() {
    const toggleBtn = document.querySelector(".sidebar-mobile-toggle, #sidebar-toggle, .mobile-menu-btn");
    const sidebar = document.querySelector(".dashboard-sidebar, .sidebar, #main-sidebar");

    if (toggleBtn && sidebar) {
      toggleBtn.addEventListener("click", () => {
        sidebar.classList.toggle("open");
        sidebar.classList.toggle("active");
      });

      // Tutup jika mengklik di luar sidebar saat mobile
      document.addEventListener("click", (e) => {
        if (
          sidebar.classList.contains("open") &&
          !sidebar.contains(e.target) &&
          !toggleBtn.contains(e.target)
        ) {
          sidebar.classList.remove("open");
          sidebar.classList.remove("active");
        }
      });
    }
  }

  // Auto initialize on DOM ready
  document.addEventListener("DOMContentLoaded", () => {
    initResponsiveNavigation();
  });

  // Ekspor global untuk browser
  window.SharedDashboard = {
    getSocket: getDashboardSocket,
    showToast,
    initLiveActivityFeed,
    initResponsiveNavigation,
  };
})();
