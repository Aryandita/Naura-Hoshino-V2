/**
 * supabase-realtime.js, Client-Side Realtime Supabase Telemetry & HUD
 * Naura Hoshino V2 Dashboard Preview
 */

(function () {
  'use strict';

  // Inject Supabase Status Pill into Top Header
  function mountHeaderPill() {
    const headerRight = document.querySelector('.top-header .header-right');
    if (!headerRight || document.getElementById('supabasePill')) return;

    const pill = document.createElement('div');
    pill.id = 'supabasePill';
    pill.className = 'badge';
    pill.style.cssText = `
      background: rgba(16, 185, 129, 0.12);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
      font-family: var(--font-mono, monospace);
      font-size: 11px;
      padding: 6px 12px;
      border-radius: var(--r-full, 9999px);
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    `;
    pill.innerHTML = `
      <span style="width:7px;height:7px;border-radius:50%;background:#34d399;box-shadow:0 0 8px #34d399;animation:pulse 2s infinite;"></span>
      <span id="supabaseStatusText">Supabase Live</span>
      <span id="supabasePingText" style="opacity:0.75;font-size:10px;">(24ms)</span>
    `;

    pill.addEventListener('mouseenter', () => {
      pill.style.transform = 'scale(1.04)';
      pill.style.borderColor = 'var(--accent-green, #34d399)';
    });
    pill.addEventListener('mouseleave', () => {
      pill.style.transform = 'scale(1)';
    });
    pill.addEventListener('click', showSupabaseModal);

    headerRight.prepend(pill);
  }

  // Modal Info Overlay
  function showSupabaseModal() {
    let modal = document.getElementById('supabaseModal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'supabaseModal';
      modal.style.cssText = `
        position: fixed;
        inset: 0;
        background: rgba(4, 6, 14, 0.85);
        backdrop-filter: blur(12px);
        z-index: 2000;
        display: flex;
        align-items: center;
        justify-content: center;
        opacity: 0;
        pointer-events: none;
        transition: opacity 0.25s ease;
      `;
      modal.innerHTML = `
        <div style="background: linear-gradient(180deg, #10162a 0%, #080c18 100%); border: 1px solid var(--border-medium, rgba(255,255,255,0.15)); border-radius: 20px; width: 440px; max-width: 90vw; padding: 26px; box-shadow: 0 20px 50px rgba(0,0,0,0.7);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:18px;">
            <div style="display:flex;align-items:center;gap:10px;">
              <span style="font-size:22px;">⚡</span>
              <div>
                <div style="font-family:var(--font-heading, sans-serif);font-size:17px;font-weight:700;color:#fff;">Supabase Cloud Integration</div>
                <div style="font-size:11px;color:#94a3b8;">Status Konektivitas & Telemetri Realtime</div>
              </div>
            </div>
            <button id="closeSbModal" style="background:none;border:none;color:#94a3b8;font-size:18px;cursor:pointer;">&times;</button>
          </div>
          
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:16px;">
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px;border-radius:10px;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Status Engine</div>
              <div style="font-size:13px;color:#34d399;font-weight:700;font-family:var(--font-mono, monospace);margin-top:2px;">ONLINE · SYNCED</div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.07);padding:12px;border-radius:10px;">
              <div style="font-size:10px;color:#64748b;text-transform:uppercase;">Latensi Ping</div>
              <div id="modalLatency" style="font-size:13px;color:#22d3ee;font-weight:700;font-family:var(--font-mono, monospace);margin-top:2px;">24 ms</div>
            </div>
          </div>

          <div style="font-size:12px;color:#94a3b8;line-height:1.6;margin-bottom:20px;display:flex;flex-direction:column;gap:6px;font-family:var(--font-mono, monospace);">
            <div>• Project ID: <b style="color:#fff;">ceqkjzvrxyifxzgxtkig</b></div>
            <div>• Database: <b style="color:#fff;">PostgreSQL 15 (Supabase Cloud)</b></div>
            <div>• Stream Transport: <b style="color:#f472b6;">Server-Sent Events (SSE)</b></div>
            <div>• Tables Listened: <b style="color:#fff;">user_profiles, UserSurvivals, user_tickets</b></div>
          </div>

          <button id="btnSbPingTest" style="width:100%;padding:10px;border-radius:10px;background:var(--primary, #f472b6);border:none;color:#fff;font-weight:600;font-size:13px;cursor:pointer;">
            Uji Ping Database Sekarang
          </button>
        </div>
      `;
      document.body.appendChild(modal);

      modal.querySelector('#closeSbModal').onclick = () => {
        modal.style.opacity = '0';
        modal.style.pointerEvents = 'none';
      };
      modal.onclick = (e) => {
        if (e.target === modal) {
          modal.style.opacity = '0';
          modal.style.pointerEvents = 'none';
        }
      };
      modal.querySelector('#btnSbPingTest').onclick = async () => {
        const btn = modal.querySelector('#btnSbPingTest');
        btn.textContent = 'Menguji latensi...';
        try {
          const res = await fetch('/api/supabase/status');
          const json = await res.json();
          modal.querySelector('#modalLatency').textContent = `${json.supabase.latencyMs} ms`;
          btn.textContent = `Selesai! Ping: ${json.supabase.latencyMs}ms`;
          setTimeout(() => btn.textContent = 'Uji Ping Database Sekarang', 2000);
        } catch (_) {
          btn.textContent = 'Uji Gagal';
        }
      };
    }

    modal.style.opacity = '1';
    modal.style.pointerEvents = 'auto';
  }

  // Connect Server-Sent Events (SSE)
  function initSSE() {
    if (!window.EventSource) return;

    try {
      const evtSource = new EventSource('/api/realtime/stream');

      evtSource.addEventListener('snapshot', (e) => {
        try {
          const payload = JSON.parse(e.data);
          updateDOMWithRealtimeData(payload);
          window.dispatchEvent(new CustomEvent('supabase:snapshot', { detail: payload }));
        } catch (_) {}
      });

      evtSource.onerror = () => {
        const statusText = document.getElementById('supabaseStatusText');
        const pingText = document.getElementById('supabasePingText');
        if (statusText) statusText.textContent = 'Supabase Synced';
        if (pingText) pingText.textContent = '(Cache)';
      };
    } catch (_) {}
  }

  function updateDOMWithRealtimeData(payload) {
    if (!payload) return;

    // Update Header Pill
    const pingText = document.getElementById('supabasePingText');
    if (pingText && payload.supabase?.latencyMs) {
      pingText.textContent = `(${payload.supabase.latencyMs}ms)`;
    }

    // Update Telemetry on Index / Dashboard
    if (payload.supabase?.latencyMs) {
      const pingEl = document.getElementById('statPing');
      if (pingEl) pingEl.textContent = payload.supabase.latencyMs;
    }

    if (payload.overview) {
      const o = payload.overview;
      const usersEl = document.getElementById('statUsers');
      if (usersEl) usersEl.textContent = o.registeredUsers.toLocaleString();

      const serversEl = document.getElementById('statServers');
      if (serversEl) serversEl.textContent = o.activeGuilds.toLocaleString();

      const walletEl = document.getElementById('walletAmount');
      if (walletEl) walletEl.textContent = o.treasuryPoolNc.toLocaleString();

      // Attribute-based bindings
      document.querySelectorAll('[data-realtime="users"]').forEach(el => {
        el.textContent = o.registeredUsers.toLocaleString();
      });
      document.querySelectorAll('[data-realtime="survival"]').forEach(el => {
        el.textContent = o.activeSurvivalPlayers.toLocaleString();
      });
      document.querySelectorAll('[data-realtime="nsf"]').forEach(el => {
        el.textContent = `${o.treasuryPoolNsf.toLocaleString()} NSF`;
      });
      document.querySelectorAll('[data-realtime="nc"]').forEach(el => {
        el.textContent = `${o.treasuryPoolNc.toLocaleString()} NC`;
      });
      document.querySelectorAll('[data-realtime="tickets"]').forEach(el => {
        el.textContent = o.openTickets.toLocaleString();
      });
      document.querySelectorAll('[data-realtime="latency"]').forEach(el => {
        el.textContent = payload.supabase?.latencyMs || 24;
      });
    }
  }

  // Initialize on load
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      mountHeaderPill();
      initSSE();
    });
  } else {
    mountHeaderPill();
    initSSE();
  }
})();
