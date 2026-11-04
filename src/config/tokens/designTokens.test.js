"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  BRAND,
  SURVIVAL,
  RARITY,
  STATUS,
  SYSTEMS,
  PILLARS,
  SHARED_PRIMITIVES,
  getPillar,
  getPillarColor,
  getColorHex,
  getColorInt,
  getColorRgb,
  getRarityToken,
  getStatusToken,
  generateCssVariables,
  createToken,
  hexToRgb,
  hexToInt,
} = require("./designTokens");

test("designTokens - hex conversion helpers", () => {
  assert.equal(hexToInt("#FFC0CB"), 16761035);
  assert.equal(hexToRgb("#FFC0CB"), "255, 192, 203");
  assert.equal(hexToInt("#86EFAC"), 8843180);
  assert.equal(hexToRgb("#86EFAC"), "134, 239, 172");
  assert.equal(hexToInt("#22D3EE"), 2282478);
  assert.equal(hexToRgb("#22D3EE"), "34, 211, 238");
});

test("designTokens - createToken argument flexibility", () => {
  // Signature standard: (hex, cssVar, label)
  const tok1 = createToken("#FFC0CB", "--naura-primary", "Sakura Pink");
  assert.equal(tok1.hex, "#FFC0CB");
  assert.equal(tok1.int, 16761035);
  assert.equal(tok1.cssVar, "--naura-primary");
  assert.equal(tok1.label, "Sakura Pink");

  // Signature alternative: (key, hex, label)
  const tok2 = createToken("primary", "#FFC0CB", "Sakura Pink");
  assert.equal(tok2.hex, "#FFC0CB");
  assert.equal(tok2.int, 16761035);
  assert.equal(tok2.cssVar, "--pillar-primary");
  assert.equal(tok2.label, "Sakura Pink");
});

test("designTokens - category token integrity", () => {
  assert.equal(BRAND.primary.hex, "#FFC0CB");
  assert.equal(BRAND.primary.int, 16761035);
  assert.equal(BRAND.primary.cssVar, "--naura-primary");
  assert.equal(SURVIVAL.emerald.hex, "#86EFAC");
  assert.equal(RARITY.legendary.hex, "#FFD700");
  assert.equal(STATUS.online.hex, "#22C55E");
  assert.equal(SYSTEMS.economy.hex, "#FFD700");
  assert.equal(BRAND.primary.rgb, "255, 192, 203");
});

test("designTokens - getters with fallbacks", () => {
  assert.equal(getColorHex("primary"), "#FFC0CB");
  assert.equal(getColorHex("unknown_color", "#123456"), "#123456");

  assert.equal(getColorInt("primary"), 16761035);
  assert.equal(getColorInt("unknown_color", "#000000"), 0);

  assert.equal(getColorRgb("primary"), "255, 192, 203");
});

test("designTokens - RARITY and STATUS getters", () => {
  const legendary = getRarityToken("legendary");
  assert.equal(legendary.hex, "#FFD700");
  assert.equal(legendary.emoji, "🟡");

  const unkRarity = getRarityToken("super_mythic_nonexistent");
  assert.equal(unkRarity.hex, "#9CA3AF");

  const online = getStatusToken("online");
  assert.equal(online.badge, "🟢 AKTIF");
});

test("designTokens - 3-pillar token immutability and metadata integrity", () => {
  assert.ok(Object.isFrozen(PILLARS), "PILLARS must be frozen");
  assert.ok(Object.isFrozen(PILLARS.THEME_NAURA), "THEME_NAURA must be frozen");
  assert.ok(
    Object.isFrozen(PILLARS.THEME_SURVIVAL),
    "THEME_SURVIVAL must be frozen",
  );
  assert.ok(
    Object.isFrozen(PILLARS.THEME_DASHBOARD),
    "THEME_DASHBOARD must be frozen",
  );

  // Pilar 1: THEME_NAURA
  assert.equal(PILLARS.THEME_NAURA.id, "naura");
  assert.equal(PILLARS.THEME_NAURA.name, "Senja Ruang Ekskul");
  assert.equal(PILLARS.THEME_NAURA.icon, "🌸");
  assert.equal(PILLARS.THEME_NAURA.discordAccent, 0xffc0cb);

  // Pilar 2: THEME_SURVIVAL (Adisha naming check)
  assert.equal(PILLARS.THEME_SURVIVAL.id, "survival");
  assert.equal(PILLARS.THEME_SURVIVAL.name, "Jurnal Ekspedisi Dunia Adisha");
  assert.equal(PILLARS.THEME_SURVIVAL.icon, "🏕️");
  assert.equal(PILLARS.THEME_SURVIVAL.discordAccent, 0x86efac);
  assert.ok(
    !PILLARS.THEME_SURVIVAL.name.includes("Sukamaju"),
    "Survival name must NOT contain Sukamaju",
  );
  assert.ok(
    PILLARS.THEME_SURVIVAL.name.includes("Adisha"),
    "Survival name must contain Adisha",
  );

  // Pilar 3: THEME_DASHBOARD
  assert.equal(PILLARS.THEME_DASHBOARD.id, "dashboard");
  assert.equal(PILLARS.THEME_DASHBOARD.name, "Studio Kontrol OSIS");
  assert.equal(PILLARS.THEME_DASHBOARD.icon, "🎛️");
  assert.equal(PILLARS.THEME_DASHBOARD.discordAccent, 0x22d3ee);
});

test("designTokens - 3-pillar color palette verification", () => {
  // Naura colors
  const nCols = PILLARS.THEME_NAURA.colors;
  assert.equal(nCols.primary.hex, "#FFC0CB");
  assert.equal(nCols.chrome.hex, "#F472B6");
  assert.equal(nCols.soft.hex, "#FF9EBB");
  assert.equal(nCols.accent.hex, "#00FFFF");
  assert.equal(nCols.canvas.hex, "#060810");
  assert.equal(nCols.surface.hex, "#12151F");
  assert.equal(nCols.elevated.hex, "#171B26");

  // Survival colors
  const sCols = PILLARS.THEME_SURVIVAL.colors;
  assert.equal(sCols.primary.hex, "#86EFAC");
  assert.equal(sCols.vitals.hex, "#34D399");
  assert.equal(sCols.amber.hex, "#FBBF24");
  assert.equal(sCols.bark.hex, "#92400E");
  assert.equal(sCols.river.hex, "#7DD3FC");
  assert.equal(sCols.canvas.hex, "#061209");
  assert.equal(sCols.surface.hex, "#0B1C11");
  assert.equal(sCols.elevated.hex, "#122A1A");

  // Dashboard colors
  const dCols = PILLARS.THEME_DASHBOARD.colors;
  assert.equal(dCols.primary.hex, "#22D3EE");
  assert.equal(dCols.hub.hex, "#7B68EE");
  assert.equal(dCols.economy.hex, "#FFD700");
  assert.equal(dCols.purple.hex, "#8A2BE2");
  assert.equal(dCols.canvas.hex, "#0B0C10");
  assert.equal(dCols.surface.hex, "#12151F");
  assert.equal(dCols.elevated.hex, "#171B26");
});

test("designTokens - shared primitives foundation", () => {
  assert.ok(
    Object.isFrozen(SHARED_PRIMITIVES),
    "SHARED_PRIMITIVES must be frozen",
  );
  assert.equal(SHARED_PRIMITIVES.canvas.void.hex, "#060810");
  assert.equal(SHARED_PRIMITIVES.canvas.dark.hex, "#0B0C10");
  assert.equal(SHARED_PRIMITIVES.canvas.shell.hex, "#12151F");
  assert.equal(SHARED_PRIMITIVES.canvas.elevated.hex, "#171B26");

  assert.equal(SHARED_PRIMITIVES.typography.display, "'Orbitron', sans-serif");
  assert.equal(SHARED_PRIMITIVES.typography.body, "'Outfit', sans-serif");
  assert.equal(
    SHARED_PRIMITIVES.typography.telemetry,
    "'JetBrains Mono', monospace",
  );

  assert.equal(
    SHARED_PRIMITIVES.physics.spring,
    "cubic-bezier(0.16, 1, 0.3, 1)",
  );
  assert.equal(SHARED_PRIMITIVES.physics.springDurationMs, 320);
  assert.equal(SHARED_PRIMITIVES.physics.maxTiltDeg, 3.5);
});

test("designTokens - getPillar and getPillarColor resolution and aliases", () => {
  // Standard IDs
  assert.equal(getPillar("naura").id, "naura");
  assert.equal(getPillar("survival").id, "survival");
  assert.equal(getPillar("dashboard").id, "dashboard");

  // Aliases (Dock Switcher and Lore)
  assert.equal(getPillar("ekskul").id, "naura");
  assert.equal(getPillar("theme_naura").id, "naura");
  assert.equal(getPillar("adisha").id, "survival");
  assert.equal(getPillar("wilds").id, "survival");
  assert.equal(getPillar("theme_survival").id, "survival");
  assert.equal(getPillar("kontrol").id, "dashboard");
  assert.equal(getPillar("osis").id, "dashboard");
  assert.equal(getPillar("theme_dashboard").id, "dashboard");

  // Fallbacks
  assert.equal(getPillar(null).id, "naura");
  assert.equal(getPillar("").id, "naura");
  assert.equal(getPillar("non_existent").id, "naura");

  // Color lookup
  assert.equal(getPillarColor("naura", "primary").hex, "#FFC0CB");
  assert.equal(getPillarColor("survival", "primary").hex, "#86EFAC");
  assert.equal(getPillarColor("dashboard", "primary").hex, "#22D3EE");
});

test("designTokens - CSS generator outputs pillar variables and scoped datasets", () => {
  const css = generateCssVariables();
  assert.match(css, /^:root \{/);
  assert.match(css, /--naura-primary: #ffc0cb;/);
  assert.match(css, /--pillar-naura-primary: #ffc0cb;/);
  assert.match(css, /--pillar-survival-primary: #86efac;/);
  assert.match(css, /--pillar-dashboard-primary: #22d3ee;/);

  // Full CSS generator test
  const {
    generateCssVariables: generateFullCss,
  } = require("../../../scripts/generate-css-tokens");
  const fullCss = generateFullCss();
  assert.match(fullCss, /--active-pillar: "naura";/);
  assert.match(fullCss, /\[data-pillar="naura"\]/);
  assert.match(fullCss, /\[data-pillar="survival"\]/);
  assert.match(fullCss, /\[data-pillar="dashboard"\]/);
  assert.match(fullCss, /\[data-pillar="adisha"\]/);
  assert.match(fullCss, /\[data-pillar="ekskul"\]/);
  assert.match(fullCss, /\[data-pillar="kontrol"\]/);
});

test("designTokens - zero em-dash compliance", () => {
  function verifyNoEmDash(obj, path = "root") {
    for (const [key, val] of Object.entries(obj)) {
      if (typeof val === "string") {
        assert.ok(
          !val.includes("\u2014"),
          `Em-dash detected at ${path}.${key}: ${val}`,
        );
      } else if (typeof val === "object" && val !== null) {
        verifyNoEmDash(val, `${path}.${key}`);
      }
    }
  }

  verifyNoEmDash(PILLARS, "PILLARS");
  verifyNoEmDash(SHARED_PRIMITIVES, "SHARED_PRIMITIVES");

  const css = generateCssVariables();
  assert.ok(!css.includes("\u2014"), "CSS variables must not contain em-dash");

  const {
    generateCssVariables: generateFullCss,
  } = require("../../../scripts/generate-css-tokens");
  const fullCss = generateFullCss();
  assert.ok(
    !fullCss.includes("\u2014"),
    "Full generated CSS must not contain em-dash",
  );
});
