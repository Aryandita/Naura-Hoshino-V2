#!/usr/bin/env node
"use strict";

/**
 * generate-css-tokens.js
 *
 * Menghasilkan dashboard/src/css/tokens.generated.css dari src/config/tokens/designTokens.js
 * Ini adalah Single Source of Truth (SSOT) untuk semua CSS Custom Properties.
 * Mendukung Ekosistem 3-Pilar (Naura, Adisha/Survival, OSIS/Dashboard).
 *
 * Jalankan: node scripts/generate-css-tokens.js
 * Atau via npm: npm run tokens:generate
 */

const path = require("path");
const fs = require("fs");

// Import design tokens
const defaultTokens = require("../src/config/tokens/designTokens");

const OUTPUT_FILE = path.resolve(
  __dirname,
  "../dashboard/src/css/tokens.generated.css",
);

/**
 * Generate CSS Custom Properties dari token object
 * @param {object} [tokensToUse] - Opsional, token object untuk diuji
 */
function generateCssVariables(tokensToUse = defaultTokens) {
  const tokens = tokensToUse;
  const lines = [
    "/* ==========================================================================",
    " * AUTO-GENERATED FILE - DO NOT EDIT MANUALLY",
    " * Generated from: src/config/tokens/designTokens.js",
    ` * Timestamp: ${new Date().toISOString()}`,
    " * ========================================================================== */",
    "",
    ":root {",
  ];

  // Brand tokens
  lines.push("  /* -- Brand Tokens -- */");
  if (tokens.BRAND) {
    for (const [, token] of Object.entries(tokens.BRAND)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
        lines.push(`  ${token.cssVar}-int: ${token.int};`);
      }
    }
  }
  lines.push("");

  // Survival tokens
  lines.push("  /* -- Survival/Wilds Tokens -- */");
  if (tokens.SURVIVAL) {
    for (const [, token] of Object.entries(tokens.SURVIVAL)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      }
    }
  }
  lines.push("");

  // Rarity tokens
  lines.push("  /* -- Rarity Tokens -- */");
  if (tokens.RARITY) {
    for (const [, token] of Object.entries(tokens.RARITY)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
        lines.push(`  ${token.cssVar}-emoji: "${token.emoji || ""}";`);
        lines.push(`  ${token.cssVar}-tier: ${token.tier || 1};`);
      }
    }
  }
  lines.push("");

  // Status tokens
  lines.push("  /* -- Status Tokens -- */");
  if (tokens.STATUS) {
    for (const [, token] of Object.entries(tokens.STATUS)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
        lines.push(`  ${token.cssVar}-badge: "${token.badge || ""}";`);
      }
    }
  }
  lines.push("");

  // System tokens
  lines.push("  /* -- System Tokens -- */");
  if (tokens.SYSTEMS) {
    for (const [, token] of Object.entries(tokens.SYSTEMS)) {
      if (token && token.cssVar && token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      }
    }
  }
  lines.push("");

  // Semantic tokens
  lines.push("  /* -- Semantic Tokens -- */");
  if (tokens.SEMANTIC) {
    for (const [, token] of Object.entries(tokens.SEMANTIC)) {
      if (token && token.cssVar) {
        if (token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
          if (token.rgb) {
            lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
          }
        } else if (typeof token === "object" && token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex};`);
        }
      }
    }
  }
  lines.push("");

  // Shared Primitive Foundation (3-Pillar Primitives)
  if (tokens.SHARED_PRIMITIVES) {
    lines.push("  /* -- 3-Pillar Shared Primitives -- */");
    if (tokens.SHARED_PRIMITIVES.canvas) {
      for (const [, token] of Object.entries(tokens.SHARED_PRIMITIVES.canvas)) {
        if (token && token.cssVar && token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
          lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
        }
      }
    }
    if (tokens.SHARED_PRIMITIVES.typography) {
      lines.push(
        `  --font-display: ${tokens.SHARED_PRIMITIVES.typography.display};`,
      );
      lines.push(`  --font-body: ${tokens.SHARED_PRIMITIVES.typography.body};`);
      lines.push(
        `  --font-telemetry: ${tokens.SHARED_PRIMITIVES.typography.telemetry};`,
      );
    }
    if (tokens.SHARED_PRIMITIVES.physics) {
      lines.push(
        `  --ease-spring-snappy: ${tokens.SHARED_PRIMITIVES.physics.spring};`,
      );
      lines.push(
        `  --ease-spring-tactile: ${tokens.SHARED_PRIMITIVES.physics.springTactile};`,
      );
      lines.push(
        `  --spring-duration: ${tokens.SHARED_PRIMITIVES.physics.springDurationMs}ms;`,
      );
      lines.push(
        `  --card-tilt-max: ${tokens.SHARED_PRIMITIVES.physics.maxTiltDeg}deg;`,
      );
    }
    lines.push("");
  }

  // Pillar 1, 2, 3 Token Declarations
  if (tokens.PILLARS) {
    lines.push("  /* -- Pillar 1: THEME_NAURA (Senja Ruang Ekskul) -- */");
    if (tokens.PILLARS.THEME_NAURA && tokens.PILLARS.THEME_NAURA.colors) {
      for (const [, token] of Object.entries(
        tokens.PILLARS.THEME_NAURA.colors,
      )) {
        if (token && token.cssVar && token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
          lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
          lines.push(`  ${token.cssVar}-int: ${token.int};`);
        }
      }
      lines.push(
        `  --pillar-naura-discord: #${tokens.PILLARS.THEME_NAURA.discordAccent.toString(16)};`,
      );
      lines.push(
        `  --pillar-naura-discord-int: ${tokens.PILLARS.THEME_NAURA.discordAccent};`,
      );
    }
    lines.push("");

    lines.push(
      "  /* -- Pillar 2: THEME_SURVIVAL (Jurnal Ekspedisi Dunia Adisha) -- */",
    );
    if (tokens.PILLARS.THEME_SURVIVAL && tokens.PILLARS.THEME_SURVIVAL.colors) {
      for (const [, token] of Object.entries(
        tokens.PILLARS.THEME_SURVIVAL.colors,
      )) {
        if (token && token.cssVar && token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
          lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
          lines.push(`  ${token.cssVar}-int: ${token.int};`);
        }
      }
      lines.push(
        `  --pillar-survival-discord: #${tokens.PILLARS.THEME_SURVIVAL.discordAccent.toString(16)};`,
      );
      lines.push(
        `  --pillar-survival-discord-int: ${tokens.PILLARS.THEME_SURVIVAL.discordAccent};`,
      );
    }
    lines.push("");

    lines.push("  /* -- Pillar 3: THEME_DASHBOARD (Studio Kontrol OSIS) -- */");
    if (
      tokens.PILLARS.THEME_DASHBOARD &&
      tokens.PILLARS.THEME_DASHBOARD.colors
    ) {
      for (const [, token] of Object.entries(
        tokens.PILLARS.THEME_DASHBOARD.colors,
      )) {
        if (token && token.cssVar && token.hex) {
          lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
          lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
          lines.push(`  ${token.cssVar}-int: ${token.int};`);
        }
      }
      lines.push(
        `  --pillar-dashboard-discord: #${tokens.PILLARS.THEME_DASHBOARD.discordAccent.toString(16)};`,
      );
      lines.push(
        `  --pillar-dashboard-discord-int: ${tokens.PILLARS.THEME_DASHBOARD.discordAccent};`,
      );
    }
    lines.push("");

    // Active Pillar Defaults on :root (Default: Naura)
    lines.push("  /* -- Active Pillar Current Fallback (Default: Naura) -- */");
    lines.push('  --active-pillar: "naura";');
    lines.push('  --pillar-current-id: "naura";');
    lines.push('  --pillar-current-name: "Senja Ruang Ekskul";');
    lines.push('  --pillar-current-icon: "🌸";');
    lines.push(
      "  --pillar-current-primary: var(--pillar-naura-primary, #ffc0cb);",
    );
    lines.push("  --pillar-current-primary-rgb: 255, 192, 203;");
    lines.push(
      "  --pillar-current-accent: var(--pillar-naura-accent, #00ffff);",
    );
    lines.push(
      "  --pillar-current-canvas: var(--pillar-naura-canvas, #060810);",
    );
    lines.push(
      "  --pillar-current-surface: var(--pillar-naura-surface, #12151f);",
    );
    lines.push(
      "  --pillar-current-elevated: var(--pillar-naura-elevated, #171b26);",
    );
    lines.push("");
  }

  // UI Chrome tokens (additional dashboard-specific tokens)
  lines.push("  /* -- UI Chrome Tokens -- */");
  lines.push("  --ui-primary: var(--naura-secondary, #f472b6);");
  lines.push("  --ui-primary-glow: rgba(244, 114, 182, 0.25);");
  lines.push("  --ui-primary-hover: #f472b6;");
  lines.push("  --accent-cyan-live: var(--wilds-moss, #34d399);");
  lines.push("  --accent-pink: #f9a8d4;");
  lines.push("  --accent-purple: #c084fc;");
  lines.push("  --accent-blue: #93c5fd;");
  lines.push("  --accent-green: var(--wilds-emerald, #86efac);");
  lines.push("");

  // Surface tokens
  lines.push("  /* -- Surface Tokens -- */");
  lines.push("  --surface-glass: rgba(255, 255, 255, 0.03);");
  lines.push("  --surface-glass-hover: rgba(255, 255, 255, 0.05);");
  lines.push("  --surface-elevated: rgba(0, 0, 0, 0.4);");
  lines.push("");

  // Text tokens
  lines.push("  /* -- Text Tokens -- */");
  lines.push("  --ink: #ffffff;");
  lines.push("  --body: #9ca3af;");
  lines.push("  --body-strong: #d1d5db;");
  lines.push("  --muted: #6b7280;");
  lines.push("  --on-primary: #0b0c10;");
  lines.push("  --on-dark: #ffffff;");
  lines.push("");

  // Hairline/Border tokens
  lines.push("  /* -- Hairline & Border Tokens -- */");
  lines.push("  --hairline: rgba(255, 192, 203, 0.15);");
  lines.push("  --hairline-strong: rgba(255, 192, 203, 0.3);");
  lines.push("  --hairline-brand: rgba(244, 114, 182, 0.35);");
  lines.push("");

  // Glass specular & focus
  lines.push("  /* -- Glass Specular & Focus -- */");
  lines.push("  --glass-specular: inset 0 1px 0 0 rgba(255, 255, 255, 0.08);");
  lines.push(
    "  --glass-specular-strong: inset 0 1px 0 0 rgba(255, 255, 255, 0.16);",
  );
  lines.push(
    "  --glass-specular-primary: inset 0 1px 0 0 rgba(255, 192, 203, 0.25);",
  );
  lines.push("  --focus-ring: 0 0 0 2px #060810, 0 0 0 4px var(--ui-primary);");
  lines.push("");

  // Breakpoints
  lines.push("  /* -- Breakpoints -- */");
  lines.push("  --bp-mobile: 480px;");
  lines.push("  --bp-tablet: 768px;");
  lines.push("  --bp-desktop: 1024px;");
  lines.push("  --bp-wide: 1280px;");
  lines.push("");

  // Motion (spring physics)
  lines.push("  /* -- Motion (Anti-Slop: spring physics) -- */");
  lines.push("  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);");
  lines.push("  --ease-tactile: cubic-bezier(0.34, 1.56, 0.64, 1);");
  lines.push("  --touch-target-min: 44px;");
  lines.push("");

  // Fluid typography
  lines.push("  /* -- Fluid Typography -- */");
  lines.push("  --fs-display: clamp(2rem, 4vw + 0.5rem, 3.25rem);");
  lines.push("  --fs-h1: clamp(1.625rem, 3vw + 0.25rem, 2.375rem);");
  lines.push("  --fs-h2: clamp(1.25rem, 2vw + 0.2rem, 1.625rem);");
  lines.push("  --fs-h3: clamp(1.05rem, 1.5vw + 0.15rem, 1.25rem);");
  lines.push("  --fs-body: clamp(0.875rem, 0.2vw + 0.825rem, 0.965rem);");
  lines.push("");

  // Density
  lines.push("  /* -- Density -- */");
  lines.push("  --density: comfortable;");
  lines.push("  --sp-card-padding: var(--sp-5, 20px);");
  lines.push("  --sp-card-gap: var(--sp-3, 12px);");
  lines.push("  --r-card-inner: var(--r-lg, 14px);");
  lines.push("  --fs-stat-val: 28px;");
  lines.push("");

  // Tabular nums
  lines.push("  /* -- Tabular Nums -- */");
  lines.push("  --font-mono: 'JetBrains Mono', monospace;");
  lines.push("}");
  lines.push("");

  // Density modes
  lines.push("/* -- Density Modes -- */");
  lines.push('[data-density="compact"] {');
  lines.push("  --density: compact;");
  lines.push("  --sp-card-padding: 12px;");
  lines.push("  --sp-card-gap: 8px;");
  lines.push("  --r-card-inner: 10px;");
  lines.push("  --fs-stat-val: 22px;");
  lines.push("}");
  lines.push('[data-density="comfortable"] {');
  lines.push("  --density: comfortable;");
  lines.push("  --sp-card-padding: 20px;");
  lines.push("  --sp-card-gap: 12px;");
  lines.push("  --r-card-inner: 14px;");
  lines.push("  --fs-stat-val: 28px;");
  lines.push("}");
  lines.push('[data-density="spacious"] {');
  lines.push("  --density: spacious;");
  lines.push("  --sp-card-padding: 28px;");
  lines.push("  --sp-card-gap: 16px;");
  lines.push("  --r-card-inner: 18px;");
  lines.push("  --fs-stat-val: 34px;");
  lines.push("}");
  lines.push("");

  // Scoped 3-Pillar Dataset Rules
  lines.push(
    "/* ==========================================================================",
  );
  lines.push(
    " * Scoped 3-Pillar Dataset Rules (Anti-Slop Theming Architecture)",
  );
  lines.push(
    " * Memungkinkan re-theming instan per halaman atau per komponen.",
  );
  lines.push(
    " * ========================================================================== */",
  );
  lines.push("");

  // Pilar 1: THEME_NAURA
  lines.push("/* Pilar 1: THEME_NAURA (Senja Ruang Ekskul) */");
  lines.push(':root[data-pillar="naura"], [data-pillar="naura"],');
  lines.push(':root[data-pillar="theme_naura"], [data-pillar="theme_naura"],');
  lines.push(':root[data-pillar="ekskul"], [data-pillar="ekskul"] {');
  lines.push('  --active-pillar: "naura";');
  lines.push('  --pillar-current-id: "naura";');
  lines.push('  --pillar-current-name: "Senja Ruang Ekskul";');
  lines.push('  --pillar-current-icon: "🌸";');
  lines.push(
    "  --pillar-current-primary: var(--pillar-naura-primary, #ffc0cb);",
  );
  lines.push("  --pillar-current-primary-rgb: 255, 192, 203;");
  lines.push("  --pillar-current-accent: var(--pillar-naura-accent, #00ffff);");
  lines.push("  --pillar-current-canvas: var(--pillar-naura-canvas, #060810);");
  lines.push(
    "  --pillar-current-surface: var(--pillar-naura-surface, #12151f);",
  );
  lines.push(
    "  --pillar-current-elevated: var(--pillar-naura-elevated, #171b26);",
  );
  lines.push("  --ui-primary: var(--pillar-naura-chrome, #f472b6);");
  lines.push("  --ui-primary-glow: rgba(244, 114, 182, 0.25);");
  lines.push("  --ui-primary-hover: #f472b6;");
  lines.push("  --bg-deep: var(--pillar-naura-canvas, #060810);");
  lines.push("  --bg-layer: var(--pillar-naura-surface, #12151f);");
  lines.push("  --bg-layer-elevated: var(--pillar-naura-elevated, #171b26);");
  lines.push("  --hairline: rgba(255, 192, 203, 0.15);");
  lines.push("  --hairline-strong: rgba(255, 192, 203, 0.3);");
  lines.push("  --hairline-brand: rgba(244, 114, 182, 0.35);");
  lines.push("  --focus-ring: 0 0 0 2px #060810, 0 0 0 4px var(--ui-primary);");
  lines.push("}");
  lines.push("");

  // Pilar 2: THEME_SURVIVAL
  lines.push("/* Pilar 2: THEME_SURVIVAL (Jurnal Ekspedisi Dunia Adisha) */");
  lines.push(':root[data-pillar="survival"], [data-pillar="survival"],');
  lines.push(
    ':root[data-pillar="theme_survival"], [data-pillar="theme_survival"],',
  );
  lines.push(':root[data-pillar="adisha"], [data-pillar="adisha"],');
  lines.push(':root[data-pillar="wilds"], [data-pillar="wilds"] {');
  lines.push('  --active-pillar: "survival";');
  lines.push('  --pillar-current-id: "survival";');
  lines.push('  --pillar-current-name: "Jurnal Ekspedisi Dunia Adisha";');
  lines.push('  --pillar-current-icon: "🏕️";');
  lines.push(
    "  --pillar-current-primary: var(--pillar-survival-primary, #86efac);",
  );
  lines.push("  --pillar-current-primary-rgb: 134, 239, 172;");
  lines.push(
    "  --pillar-current-accent: var(--pillar-survival-vitals, #34d399);",
  );
  lines.push(
    "  --pillar-current-canvas: var(--pillar-survival-canvas, #061209);",
  );
  lines.push(
    "  --pillar-current-surface: var(--pillar-survival-surface, #0b1c11);",
  );
  lines.push(
    "  --pillar-current-elevated: var(--pillar-survival-elevated, #122a1a);",
  );
  lines.push("  --ui-primary: var(--pillar-survival-primary, #86efac);");
  lines.push("  --ui-primary-glow: rgba(134, 239, 172, 0.28);");
  lines.push("  --ui-primary-hover: #34d399;");
  lines.push("  --bg-deep: var(--pillar-survival-canvas, #061209);");
  lines.push("  --bg-layer: var(--pillar-survival-surface, #0b1c11);");
  lines.push(
    "  --bg-layer-elevated: var(--pillar-survival-elevated, #122a1a);",
  );
  lines.push("  --hairline: rgba(134, 239, 172, 0.18);");
  lines.push("  --hairline-strong: rgba(134, 239, 172, 0.35);");
  lines.push("  --hairline-brand: rgba(52, 211, 153, 0.35);");
  lines.push("  --focus-ring: 0 0 0 2px #061209, 0 0 0 4px var(--ui-primary);");
  lines.push("}");
  lines.push("");

  // Pilar 3: THEME_DASHBOARD
  lines.push("/* Pilar 3: THEME_DASHBOARD (Studio Kontrol OSIS) */");
  lines.push(':root[data-pillar="dashboard"], [data-pillar="dashboard"],');
  lines.push(
    ':root[data-pillar="theme_dashboard"], [data-pillar="theme_dashboard"],',
  );
  lines.push(':root[data-pillar="kontrol"], [data-pillar="kontrol"],');
  lines.push(':root[data-pillar="osis"], [data-pillar="osis"] {');
  lines.push('  --active-pillar: "dashboard";');
  lines.push('  --pillar-current-id: "dashboard";');
  lines.push('  --pillar-current-name: "Studio Kontrol OSIS";');
  lines.push('  --pillar-current-icon: "🎛️";');
  lines.push(
    "  --pillar-current-primary: var(--pillar-dashboard-primary, #22d3ee);",
  );
  lines.push("  --pillar-current-primary-rgb: 34, 211, 238;");
  lines.push(
    "  --pillar-current-accent: var(--pillar-dashboard-hub, #7b68ee);",
  );
  lines.push(
    "  --pillar-current-canvas: var(--pillar-dashboard-canvas, #0b0c10);",
  );
  lines.push(
    "  --pillar-current-surface: var(--pillar-dashboard-surface, #12151f);",
  );
  lines.push(
    "  --pillar-current-elevated: var(--pillar-dashboard-elevated, #171b26);",
  );
  lines.push("  --ui-primary: var(--pillar-dashboard-primary, #22d3ee);");
  lines.push("  --ui-primary-glow: rgba(34, 211, 238, 0.25);");
  lines.push("  --ui-primary-hover: #06b6d4;");
  lines.push("  --bg-deep: var(--pillar-dashboard-canvas, #0b0c10);");
  lines.push("  --bg-layer: var(--pillar-dashboard-surface, #12151f);");
  lines.push(
    "  --bg-layer-elevated: var(--pillar-dashboard-elevated, #171b26);",
  );
  lines.push("  --hairline: rgba(34, 211, 238, 0.18);");
  lines.push("  --hairline-strong: rgba(34, 211, 238, 0.35);");
  lines.push("  --hairline-brand: rgba(34, 211, 238, 0.35);");
  lines.push("  --focus-ring: 0 0 0 2px #0b0c10, 0 0 0 4px var(--ui-primary);");
  lines.push("}");
  lines.push("");

  return lines.join("\n");
}

module.exports = {
  generateCssVariables,
  OUTPUT_FILE,
};

// Eksekusi bila dijalankan langsung via CLI
if (require.main === module) {
  const cssContent = generateCssVariables();
  try {
    fs.writeFileSync(OUTPUT_FILE, cssContent, "utf8");
    console.log(`✅ Generated: ${OUTPUT_FILE}`);
    console.log(`   Size: ${(cssContent.length / 1024).toFixed(2)} KB`);
    console.log(`   Lines: ${cssContent.split("\n").length}`);
  } catch (err) {
    console.error(`❌ Failed to generate tokens:`, err.message);
    process.exit(1);
  }
}
