/**
 * Page Template Generator for Naura OS v2.5
 * Use this to quickly update remaining pages
 */

const PAGE_TEMPLATE = `<!doctype html>
<html lang="id" data-theme="midnight" data-pillar="dashboard">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>{{PAGE_TITLE}} | Naura OS</title>
    <meta name="description" content="{{PAGE_DESCRIPTION}}" />
    <meta property="og:title" content="Naura OS" />
    <meta property="og:description" content="{{PAGE_DESCRIPTION}}" />
    <meta property="og:type" content="website" />
    <meta name="theme-color" content="#0b0c10" />
    <link rel="manifest" href="/manifest.json" />
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;600;700;900&family=Outfit:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;700&display=swap" rel="stylesheet" />
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" />
    <link rel="stylesheet" href="/src/css/naura-os.css" />
    {{EXTRA_HEAD}}
  </head>
  <body>
    <a href="#mainContent" class="skip-link">Lewati ke konten utama</a>

    <div class="app-shell">
      <div class="sidebar-backdrop" id="sidebarBackdrop"></div>

      <aside class="sidebar" id="sidebar" aria-label="Navigasi utama" role="navigation">
        <div class="sidebar-header">
          <div class="header-brand">
            <div class="header-brand-icon" aria-hidden="true">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 0 0-10 10c0 6.5 10 14 10 14s10-7.5 10-14a10 10 0 0 0-10-10z"/><path d="M12 6v4"/><path d="M12 14h.01"/></svg>
            </div>
            <span class="header-brand-text">Naura Hoshino</span>
          </div>
          <button type="button" class="btn btn-icon-only btn-ghost" id="sidebarCollapseBtn" aria-label="Toggle sidebar compact" title="Ciutkan Sidebar (Ctrl+B)">
            <i class="fa-solid fa-angles-left" aria-hidden="true"></i>
          </button>
        </div>

        <div class="pillar-indicator" id="pillarIndicator">
          <span class="pillar-indicator-label">{{PILLAR_LABEL}}</span>
        </div>

        <nav class="sidebar-nav" role="navigation" aria-label="Menu utama">
          {{SIDEBAR_NAV}}
        </nav>

        <div class="sidebar-footer">
          <div class="sidebar-user" id="sidebarUser" role="button" tabindex="0" aria-label="Buka profil" onclick="window.location.href='/profile'">
            <img src="/assets/core/avatar.png" alt="" class="sidebar-user-avatar" id="sidebarAvatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23f472b6%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22>N</text></svg>'" />
            <div class="sidebar-user-info">
              <div class="sidebar-user-name" id="sidebarUserName">Guest</div>
              <div class="sidebar-user-role" id="sidebarUserRole">Klik untuk login</div>
            </div>
            <a href="/login?redirect=/profile" title="Login Akun" class="sidebar-login-link" id="sidebarLoginBtn" aria-label="Login dengan Discord">
              <i class="fa-brands fa-discord" aria-hidden="true"></i>
            </a>
          </div>
        </div>
      </aside>

      <main class="main-content" role="main">
        <header class="app-header" role="banner">
          <div class="header-left">
            <button type="button" class="btn btn-icon-only btn-ghost" id="hamburgerBtn" aria-label="Buka menu navigasi" aria-expanded="false" aria-controls="sidebar">
              <i class="fa-solid fa-bars" aria-hidden="true"></i>
            </button>
            <div>
              <h1 class="page-title" id="pageTitle">{{PAGE_TITLE}}</h1>
              <nav class="breadcrumb" aria-label="Breadcrumb">
                <span>Naura OS</span>
                <span class="breadcrumb-sep" aria-hidden="true">/</span>
                <span>{{BREADCRUMB}}</span>
              </nav>
            </div>
          </div>

          <div class="header-right">
            <button type="button" class="btn btn-icon-only btn-ghost tooltip" id="themeToggle" data-tooltip="Ganti Tema (T)" aria-label="Ganti Tema">
              <i class="fa-solid fa-palette" aria-hidden="true"></i>
            </button>
            <button type="button" class="btn btn-icon-only btn-ghost tooltip" id="densityToggle" data-tooltip="Ganti Densitas" aria-label="Ganti Densitas">
              <i class="fa-solid fa-grip-lines" aria-hidden="true"></i>
            </button>
            <div class="wallet-badge" id="headerWallet" title="Naura Coins" role="status" aria-live="polite">
              <i class="fa-solid fa-coins" aria-hidden="true"></i>
              <span id="walletAmount">0</span>
            </div>
            <a href="/auth/discord" class="btn btn-primary btn-sm" id="headerAuthBtn" title="Login dengan Discord">
              <i class="fa-brands fa-discord" aria-hidden="true"></i>
              <span id="headerAuthLabel">Login</span>
            </a>
            <img src="/assets/core/avatar.png" alt="" class="header-avatar" id="headerAvatar" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 40 40%22><circle cx=%2220%22 cy=%2220%22 r=%2220%22 fill=%22%23f472b6%22/><text x=%2220%22 y=%2225%22 text-anchor=%22middle%22 fill=%22white%22 font-size=%2216%22>N</text></svg>'" />
          </div>
        </header>

        <div class="page" id="mainContent">
          {{PAGE_CONTENT}}
        </div>
      </main>

      <nav class="mobile-nav" aria-label="Navigasi mobile">
        <a href="/" class="mobile-nav-item {{HOME_ACTIVE}}">
          <span class="mobile-nav-item-icon" aria-hidden="true"><i class="fa-solid fa-gauge-high"></i></span>
          <span>Dashboard</span>
        </a>
        <a href="/lounge" class="mobile-nav-item {{LOUNGE_ACTIVE}}">
          <span class="mobile-nav-item-icon" aria-hidden="true"><i class="fa-solid fa-cube"></i></span>
          <span>3D Lounge</span>
        </a>
        <a href="/music" class="mobile-nav-item {{MUSIC_ACTIVE}}">
          <span class="mobile-nav-item-icon" aria-hidden="true"><i class="fa-solid fa-music"></i></span>
          <span>Music</span>
        </a>
        <a href="/world" class="mobile-nav-item {{WORLD_ACTIVE}}">
          <span class="mobile-nav-item-icon" aria-hidden="true"><i class="fa-solid fa-earth-asia"></i></span>
          <span>Wilds</span>
        </a>
        <a href="/settings" class="mobile-nav-item {{SETTINGS_ACTIVE}}">
          <span class="mobile-nav-item-icon" aria-hidden="true"><i class="fa-solid fa-gears"></i></span>
          <span>Settings</span>
        </a>
      </nav>
    </div>

    <script src="/src/js/naura-os.js"></script>
    {{PAGE_SCRIPTS}}
  </body>
</html>`;

// Navigation HTML (shared across all pages)
const SIDEBAR_NAV = `
<!-- Overview -->
<div class="nav-section">
  <span class="nav-section-title">Overview</span>
  <a href="/" class="nav-item {{HOME_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-gauge-high"></i></span>
    <span class="nav-item-label">Dashboard</span>
  </a>
  <a href="/lounge" class="nav-item {{LOUNGE_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles" style="color: var(--ui-primary);"></i></span>
    <span class="nav-item-label">3D AI Lounge</span>
    <span class="nav-item-badge">31 Anim</span>
  </a>
  <a href="/status" class="nav-item {{STATUS_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-signal"></i></span>
    <span class="nav-item-label">Live Status</span>
    <span class="nav-item-badge">Live</span>
  </a>
  <a href="/feed" class="nav-item {{FEED_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-rss"></i></span>
    <span class="nav-item-label">Activity Feed</span>
  </a>
</div>

<!-- Community -->
<div class="nav-section">
  <span class="nav-section-title">Community</span>
  <a href="/leaderboard" class="nav-item {{LEADERBOARD_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-trophy"></i></span>
    <span class="nav-item-label">Leaderboard</span>
  </a>
  <a href="/economy" class="nav-item {{ECONOMY_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-coins"></i></span>
    <span class="nav-item-label">Economy</span>
  </a>
  <a href="/clan" class="nav-item {{CLAN_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-users-rays"></i></span>
    <span class="nav-item-label">Sindikat & Klan</span>
  </a>
  <a href="/marketplace" class="nav-item {{MARKETPLACE_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-shop"></i></span>
    <span class="nav-item-label">Pasar Galaksi</span>
  </a>
  <a href="/topology" class="nav-item {{TOPOLOGY_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-network-wired"></i></span>
    <span class="nav-item-label">Guild Topology</span>
  </a>
</div>

<!-- Media & Audio -->
<div class="nav-section">
  <span class="nav-section-title">Media & Audio</span>
  <a href="/music" class="nav-item {{MUSIC_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-music"></i></span>
    <span class="nav-item-label">Music Hub</span>
  </a>
  <a href="/soundboard" class="nav-item {{SOUNDBOARD_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-sliders"></i></span>
    <span class="nav-item-label">Soundboard</span>
  </a>
  <a href="/jam" class="nav-item {{JAM_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-guitar"></i></span>
    <span class="nav-item-label">Jam Session</span>
  </a>
  <a href="/karaoke" class="nav-item {{KARAOKE_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-microphone"></i></span>
    <span class="nav-item-label">Karaoke</span>
  </a>
</div>

<!-- Naura Wilds RPG -->
<div class="nav-section">
  <span class="nav-section-title">Naura Wilds RPG</span>
  <a href="/world" class="nav-item {{WORLD_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-earth-asia"></i></span>
    <span class="nav-item-label">World Map</span>
  </a>
  <a href="/survival-map" class="nav-item {{SURVIVAL_MAP_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-map"></i></span>
    <span class="nav-item-label">Survival Map</span>
  </a>
  <a href="/inventory" class="nav-item {{INVENTORY_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-backpack"></i></span>
    <span class="nav-item-label">Tas & Ransel</span>
  </a>
  <a href="/arcade" class="nav-item {{ARCADE_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-gamepad"></i></span>
    <span class="nav-item-label">Retro Arcade</span>
  </a>
  <a href="/activity" class="nav-item {{ACTIVITY_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-bolt"></i></span>
    <span class="nav-item-label">Activity Hub</span>
  </a>
</div>

<!-- Configuration -->
<div class="nav-section">
  <span class="nav-section-title">Configuration</span>
  <a href="/settings" class="nav-item {{SETTINGS_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-gears"></i></span>
    <span class="nav-item-label">Settings</span>
  </a>
  <a href="/welcomer" class="nav-item {{WELCOMER_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-palette"></i></span>
    <span class="nav-item-label">Welcomer Card</span>
  </a>
  <a href="/builder" class="nav-item {{BUILDER_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-wand-magic-sparkles"></i></span>
    <span class="nav-item-label">Embed Builder</span>
  </a>
  <a href="/automations" class="nav-item {{AUTOMATIONS_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-robot"></i></span>
    <span class="nav-item-label">Automations</span>
  </a>
  <a href="/tickets" class="nav-item {{TICKETS_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-ticket"></i></span>
    <span class="nav-item-label">Tickets</span>
  </a>
  <a href="/admin" class="nav-item {{ADMIN_ACTIVE_CLASS}}">
    <span class="nav-item-icon" aria-hidden="true"><i class="fa-solid fa-screwdriver-wrench"></i></span>
    <span class="nav-item-label">Admin God Mode</span>
  </a>
</div>

<!-- More -->
<div class="nav-section">
  <span class="nav-section-title">More</span>
  <a href="/profile" class="nav-item {{PROFILE_ACTIVE_CLASS}}" style="color: var(--ui-primary);">
    <span class="nav-item-icon" aria-hidden="true" style="color: var(--ui-primary);"><i class="fa-solid fa-id-card"></i></span>
    <span class="nav-item-label" style="color: var(--ui-primary);">Profil Petualang</span>
  </a>
  <a href="/achievements" class="nav-item {{ACHIEVEMENTS_ACTIVE_CLASS}}" style="color: var(--color-warning);">
    <span class="nav-item-icon" aria-hidden="true" style="color: var(--color-warning);"><i class="fa-solid fa-trophy"></i></span>
    <span class="nav-item-label" style="color: var(--color-warning);">Ruang Trofi</span>
  </a>
  <a href="/portfolio" class="nav-item {{PORTFOLIO_ACTIVE_CLASS}}" style="color: var(--color-success);">
    <span class="nav-item-icon" aria-hidden="true" style="color: var(--color-success);"><i class="fa-solid fa-id-badge"></i></span>
    <span class="nav-item-label" style="color: var(--color-success);">Creator Portfolio</span>
  </a>
</div>
`;

module.exports = { PAGE_TEMPLATE, SIDEBAR_NAV };