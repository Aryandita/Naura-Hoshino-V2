---
version: 2.4.0-naura-os
name: Naura Hoshino OS
description: Antarmuka sistem kontrol Naura OS dengan tema cyber-anime. Brand memakai dua-tier warna pink: Sakura Pink #FFC0CB untuk identitas karakter, dan Naura Rose #F472B6 untuk chrome UI. Latar kanvas gelap #0b0c10, glassmorphism terbatas pada shell + satu hero stage per halaman, dan tipografi Orbitron + Outfit + JetBrains Mono.
brand:
  identity-color: "#FFC0CB"
  ui-color: "#F472B6"
  live-color: "#22D3EE"
colors:
  brand-sakura-pink: "#FFC0CB"
  brand-sakura-rose: "#F472B6"
  brand-sakura-soft: "#FF9EBB"
  brand-cyan-neon: "#00FFFF"
  premium-gold: "#FFD700"
  discord-blurple: "#5865F2"
  discord-blurple-hover: "#4752C4"
  ui-primary: "#F472B6"
  ui-primary-glow: "rgba(244, 114, 182, 0.25)"
  ui-primary-hover: "#f472b6"
  accent-cyan-live: "#22D3EE"
  accent-pink: "#F9A8D4"
  accent-purple: "#C084FC"
  accent-blue: "#93C5FD"
  accent-green: "#86EFAC"
  canvas: "#0b0c10"
  layer: "#12151f"
  layer-elevated: "#171b26"
  surface-glass: "rgba(255, 255, 255, 0.03)"
  surface-glass-hover: "rgba(255, 255, 255, 0.05)"
  surface-elevated: "rgba(0, 0, 0, 0.4)"
  ink: "#ffffff"
  body: "#9ca3af"
  body-strong: "#d1d5db"
  muted: "#6b7280"
  on-primary: "#0b0c10"
  on-dark: "#ffffff"
  hairline: "rgba(255, 192, 203, 0.15)"
  hairline-strong: "rgba(255, 192, 203, 0.3)"
  hairline-brand: "rgba(244, 114, 182, 0.35)"
  status-online: "#22C55E"
  status-idle: "#F59E0B"
  status-dnd: "#EF4444"
  status-maintenance: "#A855F7"
  status-syncing: "#38BDF8"
  wilds-emerald: "#86EFAC"
  wilds-moss: "#34D399"
  wilds-amber: "#FBBF24"
  wilds-bark: "#92400E"
  wilds-river: "#7DD3FC"
  wilds-danger: "#F87171"
  surface-glass-wilds: "rgba(134, 239, 172, 0.06)"
  hairline-wilds: "rgba(134, 239, 172, 0.2)"
  rarity-common: "#9CA3AF"
  rarity-uncommon: "#86EFAC"
  rarity-rare: "#93C5FD"
  rarity-epic: "#C084FC"
  rarity-legendary: "#FFD700"
  rarity-mythic: "#F9A8D4"
  premium-voter: "#F43F5E"
  premium-starter: "#38BDF8"
  premium-supporter: "#C0C0C0"
  premium-friends: "#A855F7"
  premium-vip: "#FFD700"
typography:
  display-xl:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 48px
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: 1px
  display-lg:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 36px
    fontWeight: 700
    lineHeight: 1.2
    letterSpacing: 0.5px
  display-md:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  display-sm:
    fontFamily: "'Orbitron', sans-serif"
    fontSize: 20px
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: 0
  title-lg:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 24px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 0
  title-md:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 18px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  title-sm:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  label-uppercase:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 12px
    fontWeight: 700
    lineHeight: 1.3
    letterSpacing: 1.5px
  body-md:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 300
    lineHeight: 1.6
    letterSpacing: 0
  body-sm:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 14px
    fontWeight: 300
    lineHeight: 1.5
    letterSpacing: 0
  caption:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 12px
    fontWeight: 300
    lineHeight: 1.4
    letterSpacing: 0.5px
  button:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 14px
    fontWeight: 700
    lineHeight: 1
    letterSpacing: 0.5px
  nav-link:
    fontFamily: "'Outfit', sans-serif"
    fontSize: 16px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
  mono-sm:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 12px
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: 0
  mono-md:
    fontFamily: "'JetBrains Mono', monospace"
    fontSize: 14px
    fontWeight: 500
    lineHeight: 1.4
    letterSpacing: 0
rounded:
  none: 0px
  sm: 6px
  md: 8px
  lg: 12px
  xl: 16px
  xxl: 24px
  full: 9999px
spacing:
  xxs: 4px
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
  xl: 32px
  xxl: 48px
  section: 64px
motion:
  spring: "cubic-bezier(0.16, 1, 0.3, 1)"
  tactile: "cubic-bezier(0.34, 1.56, 0.64, 1)"
  base: "200ms"
  slow: "300ms"
components:
  sidebar-nav:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.body}"
    typography: "{typography.nav-link}"
    width: 256px
    material: "glass"
    borderRight: "1px solid {colors.hairline}"
  top-header:
    backgroundColor: "{colors.surface-glass}"
    textColor: "{colors.on-dark}"
    height: 80px
    material: "glass"
    borderBottom: "1px solid {colors.hairline}"
  mobile-bottom-nav:
    backgroundColor: "{colors.surface-glass}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.muted}"
    activeTextColor: "{colors.ui-primary}"
    activeIndicatorColor: "{colors.ui-primary-glow}"
    height: 64px
    rounded: "{rounded.xxl}"
    padding: 8px 16px
    material: "glass"
    position: "fixed-bottom"
  telemetry-card:
    backgroundColor: "{colors.layer}"
    textColor: "{colors.ink}"
    typography: "{typography.display-lg}"
    rounded: "{rounded.lg}"
    padding: 24px
    border: "1px solid {colors.hairline}"
    material: "matte"
    borderLeft: "4px solid {colors.accent-cyan-live}"
  module-status-card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.on-dark}"
    typography: "{typography.title-md}"
    rounded: "{rounded.lg}"
    padding: 20px
    material: "matte"
  empty-state-card:
    backgroundColor: "{colors.surface-glass}"
    borderColor: "{colors.hairline}"
    textColor: "{colors.body-strong}"
    rounded: "{rounded.xl}"
    padding: 24px
    material: "glass"
  data-card:
    backgroundColor: "{colors.layer}"
    borderColor: "{colors.hairline}"
    rounded: "{rounded.md}"
    padding: 16px
    material: "matte"
  badge:
    backgroundColor: "rgba(255, 255, 255, 0.06)"
    borderColor: "{colors.hairline}"
    textColor: "{colors.body-strong}"
    rounded: "{rounded.full}"
    padding: "4px 10px"
    material: "matte"
  button-primary:
    backgroundColor: "{colors.ui-primary}"
    textColor: "{colors.on-primary}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
    height: 48px
  button-discord:
    backgroundColor: "{colors.discord-blurple}"
    textColor: "{colors.on-dark}"
    typography: "{typography.button}"
    rounded: "{rounded.lg}"
    padding: "12px 24px"
    height: 48px
  wilds-hud-container:
    backgroundColor: "{colors.surface-glass-wilds}"
    borderColor: "{colors.hairline-wilds}"
    textColor: "{colors.on-dark}"
    accentColor: "{colors.wilds-emerald}"
    rounded: "{rounded.xxl}"
    padding: 24px
    material: "glass-wilds"
  wilds-status-vital-card:
    backgroundColor: "{colors.surface-elevated}"
    textColor: "{colors.body-strong}"
    healthyColor: "{colors.wilds-moss}"
    warningColor: "{colors.wilds-amber}"
    criticalColor: "{colors.wilds-danger}"
    rounded: "{rounded.lg}"
    padding: 12px
    material: "matte"
---

