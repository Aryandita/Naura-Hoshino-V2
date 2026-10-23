#!/usr/bin/env node
"use strict";

/**
 * generate-css-tokens.js
 * 
 * Menghasilkan dashboard/src/css/tokens.generated.css dari src/config/tokens/designTokens.js
 * Ini adalah Single Source of Truth (SSOT) untuk semua CSS Custom Properties.
 * 
 * Jalankan: node scripts/generate-css-tokens.js
 * Atau via npm: npm run tokens:generate
 */

const path = require("path");
const fs = require("fs");

// Import design tokens
const tokens = require("../src/config/tokens/designTokens");

const OUTPUT_FILE = path.join(__dirname, "../dashboard/src/css/tokens.generated.css");

/**
 * Generate CSS Custom Properties dari token object
 */
function generateCssVariables() {
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
  lines.push("  /* ── Brand Tokens ── */");
  for (const [, token] of Object.entries(tokens.BRAND)) {
    if (token && token.cssVar && token.hex) {
      lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
      lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      lines.push(`  ${token.cssVar}-int: ${token.int};`);
    }
  }
  lines.push("");

  // Survival tokens
  lines.push("  /* ── Survival/Wilds Tokens ── */");
  for (const [, token] of Object.entries(tokens.SURVIVAL)) {
    if (token && token.cssVar && token.hex) {
      lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
      lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
    }
  }
  lines.push("");

  // Rarity tokens
  lines.push("  /* ── Rarity Tokens ── */");
  for (const [, token] of Object.entries(tokens.RARITY)) {
    if (token && token.cssVar && token.hex) {
      lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
      lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      lines.push(`  ${token.cssVar}-emoji: "${token.emoji || ""}";`);
      lines.push(`  ${token.cssVar}-tier: ${token.tier || 1};`);
    }
  }
  lines.push("");

  // Status tokens
  lines.push("  /* ── Status Tokens ── */");
  for (const [, token] of Object.entries(tokens.STATUS)) {
    if (token && token.cssVar && token.hex) {
      lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
      lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
      lines.push(`  ${token.cssVar}-badge: "${token.badge || ""}";`);
    }
  }
  lines.push("");

  // System tokens
  lines.push("  /* ── System Tokens ── */");
  for (const [, token] of Object.entries(tokens.SYSTEMS)) {
    if (token && token.cssVar && token.hex) {
      lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
      lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
    }
  }
  lines.push("");

  // Semantic tokens
  lines.push("  /* ── Semantic Tokens ── */");
  for (const [, token] of Object.entries(tokens.SEMANTIC)) {
    if (token && token.cssVar) {
      if (token.hex) {
        lines.push(`  ${token.cssVar}: ${token.hex.toLowerCase()};`);
        if (token.rgb) {
          lines.push(`  ${token.cssVar}-rgb: ${token.rgb};`);
        }
      } else if (typeof token === "object" && token.hex) {
        // Handle rgba values like premium_glow
        lines.push(`  ${token.cssVar}: ${token.hex};`);
      }
    }
  }
  lines.push("");

  // UI Chrome tokens (additional dashboard-specific tokens)
  lines.push("  /* ── UI Chrome Tokens ── */");
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
  lines.push("  /* ── Surface Tokens ── */");
  lines.push("  --surface-glass: rgba(255, 255, 255, 0.03);");
  lines.push("  --surface-glass-hover: rgba(255, 255, 255, 0.05);");
  lines.push("  --surface-elevated: rgba(0, 0, 0, 0.4);");
  lines.push("");

  // Text tokens
  lines.push("  /* ── Text Tokens ── */");
  lines.push("  --ink: #ffffff;");
  lines.push("  --body: #9ca3af;");
  lines.push("  --body-strong: #d1d5db;");
  lines.push("  --muted: #6b7280;");
  lines.push("  --on-primary: #0b0c10;");
  lines.push("  --on-dark: #ffffff;");
  lines.push("");

  // Hairline/Border tokens
  lines.push("  /* ── Hairline & Border Tokens ── */");
  lines.push("  --hairline: rgba(255, 192, 203, 0.15);");
  lines.push("  --hairline-strong: rgba(255, 192, 203, 0.3);");
  lines.push("  --hairline-brand: rgba(244, 114, 182, 0.35);");
  lines.push("");

  // Glass specular & focus
  lines.push("  /* ── Glass Specular & Focus ── */");
  lines.push("  --glass-specular: inset 0 1px 0 0 rgba(255, 255, 255, 0.08);");
  lines.push("  --glass-specular-strong: inset 0 1px 0 0 rgba(255, 255, 255, 0.16);");
  lines.push("  --glass-specular-primary: inset 0 1px 0 0 rgba(255, 192, 203, 0.25);");
  lines.push("  --focus-ring: 0 0 0 2px #060810, 0 0 0 4px var(--ui-primary);");
  lines.push("");

  // Breakpoints
  lines.push("  /* ── Breakpoints ── */");
  lines.push("  --bp-mobile: 480px;");
  lines.push("  --bp-tablet: 768px;");
  lines.push("  --bp-desktop: 1024px;");
  lines.push("  --bp-wide: 1280px;");
  lines.push("");

  // Motion (spring physics)
  lines.push("  /* ── Motion (Anti-Slop: spring physics) ── */");
  lines.push("  --ease-spring: cubic-bezier(0.16, 1, 0.3, 1);");
  lines.push("  --ease-tactile: cubic-bezier(0.34, 1.56, 0.64, 1);");
  lines.push("  --touch-target-min: 44px;");
  lines.push("");

  // Fluid typography
  lines.push("  /* ── Fluid Typography ── */");
  lines.push("  --fs-display: clamp(2rem, 4vw + 0.5rem, 3.25rem);");
  lines.push("  --fs-h1: clamp(1.625rem, 3vw + 0.25rem, 2.375rem);");
  lines.push("  --fs-h2: clamp(1.25rem, 2vw + 0.2rem, 1.625rem);");
  lines.push("  --fs-h3: clamp(1.05rem, 1.5vw + 0.15rem, 1.25rem);");
  lines.push("  --fs-body: clamp(0.875rem, 0.2vw + 0.825rem, 0.965rem);");
  lines.push("");

  // Density
  lines.push("  /* ── Density ── */");
  lines.push("  --density: comfortable;");
  lines.push("  --sp-card-padding: var(--sp-5, 20px);");
  lines.push("  --sp-card-gap: var(--sp-3, 12px);");
  lines.push("  --r-card-inner: var(--r-lg, 14px);");
  lines.push("  --fs-stat-val: 28px;");
  lines.push("");

  // Tabular nums
  lines.push("  /* ── Tabular Nums ── */");
  lines.push("  --font-mono: 'JetBrains Mono', monospace;");
  lines.push("}");
  lines.push("");

  // Density modes
  lines.push("/* ── Density Modes ── */");
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

  return lines.join("\n");
}

// Generate and write file
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
