"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { MessageFlags } = require("discord.js");

const {
  getPillar,
  getPillarColor,
  createToken,
  hexToInt,
  hexToRgb,
} = require("../src/config/tokens/designTokens");

const {
  buildContainerV2,
  resolveContainerAccentColor,
} = require("../src/utils/NauraContainerBuilder");

const { generateCssVariables } = require("../scripts/generate-css-tokens");

// -----------------------------------------------------------------------------
// Test Suite 1: Feature F01 - getPillar Boundary & Stress Testing
// -----------------------------------------------------------------------------
test("F01 Stress - getPillar standard IDs, case sensitivity, and whitespace trimming", () => {
  // Exact standard IDs
  assert.equal(getPillar("naura").id, "naura");
  assert.equal(getPillar("survival").id, "survival");
  assert.equal(getPillar("dashboard").id, "dashboard");

  // Wild casing
  assert.equal(getPillar("NAURA").id, "naura");
  assert.equal(getPillar("SuRvIvAl").id, "survival");
  assert.equal(getPillar("DASHBOARD").id, "dashboard");

  // Whitespace, newlines, tabs
  assert.equal(getPillar("  naura  ").id, "naura");
  assert.equal(getPillar("\n\tsurvival\t\n").id, "survival");
  assert.equal(getPillar("   dashboard   ").id, "dashboard");
});

test("F01 Stress - getPillar alias resolution across all theme & dock variants", () => {
  // Naura aliases
  assert.equal(getPillar("ekskul").id, "naura");
  assert.equal(getPillar("theme_naura").id, "naura");
  assert.equal(getPillar("  EKSKUL  ").id, "naura");

  // Survival aliases
  assert.equal(getPillar("adisha").id, "survival");
  assert.equal(getPillar("wilds").id, "survival");
  assert.equal(getPillar("theme_survival").id, "survival");
  assert.equal(getPillar("  ADISHA  ").id, "survival");
  assert.equal(getPillar("  WILDS  ").id, "survival");

  // Dashboard aliases
  assert.equal(getPillar("kontrol").id, "dashboard");
  assert.equal(getPillar("osis").id, "dashboard");
  assert.equal(getPillar("theme_dashboard").id, "dashboard");
  assert.equal(getPillar("  KONTROL  ").id, "dashboard");
  assert.equal(getPillar("  OSIS  ").id, "dashboard");
});

test("F01 Stress - getPillar boundary, nullish, non-string, and bizarre inputs", () => {
  // Falsy / nullish values must safely fallback to default (THEME_NAURA)
  assert.equal(getPillar(null).id, "naura");
  assert.equal(getPillar(undefined).id, "naura");
  assert.equal(getPillar("").id, "naura");
  assert.equal(getPillar("   ").id, "naura");
  assert.equal(getPillar(0).id, "naura");
  assert.equal(getPillar(false).id, "naura");
  assert.equal(getPillar(NaN).id, "naura");

  // Numbers & booleans
  assert.equal(getPillar(12345).id, "naura");
  assert.equal(getPillar(true).id, "naura");
  assert.equal(getPillar(-1).id, "naura");

  // Objects & arrays
  assert.equal(getPillar({}).id, "naura");
  assert.equal(getPillar([]).id, "naura");
  assert.equal(getPillar({ id: "survival" }).id, "naura");

  // Symbol input (must not throw TypeError: Cannot convert a Symbol value to a string)
  assert.doesNotThrow(() => {
    const res = getPillar(Symbol("survival"));
    assert.equal(res.id, "naura");
  });

  // Prototype pollution keys should safely fallback to default naura
  assert.equal(getPillar("constructor").id, "naura");
  assert.equal(getPillar("__proto__").id, "naura");
  assert.equal(getPillar("toString").id, "naura");
  assert.equal(getPillar("valueOf").id, "naura");
  assert.equal(getPillar("hasOwnProperty").id, "naura");
});

test("F01 Stress - PILLARS immutability and deep freeze integrity", () => {
  const p = getPillar("naura");
  assert.ok(Object.isFrozen(p), "Pillar object must be frozen");
  assert.ok(Object.isFrozen(p.colors), "Pillar colors must be frozen");

  // Attempting mutation must fail in strict mode
  assert.throws(() => {
    p.name = "Mutated Naura";
  }, TypeError);

  assert.throws(() => {
    p.colors.primary = null;
  }, TypeError);
});

// -----------------------------------------------------------------------------
// Test Suite 2: Feature F01 - getPillarColor Stress Testing
// -----------------------------------------------------------------------------
test("F01 Stress - getPillarColor valid lookups, aliases, and fallbacks", () => {
  // Direct lookups
  assert.equal(getPillarColor("naura", "primary").hex, "#FFC0CB");
  assert.equal(getPillarColor("survival", "primary").hex, "#86EFAC");
  assert.equal(getPillarColor("dashboard", "primary").hex, "#22D3EE");

  // Aliases lookup
  assert.equal(getPillarColor("adisha", "primary").hex, "#86EFAC");
  assert.equal(getPillarColor("ekskul", "primary").hex, "#FFC0CB");
  assert.equal(getPillarColor("kontrol", "primary").hex, "#22D3EE");

  // Specific non-primary colors
  assert.equal(getPillarColor("survival", "vitals").hex, "#34D399");
  assert.equal(getPillarColor("dashboard", "economy").hex, "#FFD700");

  // Missing or unknown colorKey fallback to primary
  assert.equal(getPillarColor("naura", "nonexistent_color").hex, "#FFC0CB");
  assert.equal(getPillarColor("survival", "fake_key").hex, "#86EFAC");

  // Nullish pillar / colorKey
  assert.equal(getPillarColor(null, "primary").hex, "#FFC0CB");
  assert.equal(getPillarColor(undefined, "primary").hex, "#FFC0CB");
  assert.equal(getPillarColor("naura", null).hex, "#FFC0CB");
  assert.equal(getPillarColor("naura", undefined).hex, "#FFC0CB");
  assert.equal(getPillarColor("naura", 12345).hex, "#FFC0CB");
});

test("F01 Stress - getPillarColor with prototype property keys", () => {
  // Investigating behavior when colorKey is a prototype property name
  const tokenConstructor = getPillarColor("naura", "constructor");
  const tokenProto = getPillarColor("naura", "__proto__");
  const tokenToString = getPillarColor("naura", "toString");

  // A resilient implementation should either return a valid token with .hex or fallback to primary
  const isSafeToken = (t) =>
    t &&
    typeof t === "object" &&
    typeof t.hex === "string" &&
    typeof t.int === "number";

  const constructorSafe = isSafeToken(tokenConstructor);
  const protoSafe = isSafeToken(tokenProto);
  const toStringSafe = isSafeToken(tokenToString);

  assert.ok(
    constructorSafe,
    `getPillarColor('naura', 'constructor') must return a valid token, got: ${typeof tokenConstructor}`,
  );
  assert.ok(
    protoSafe,
    `getPillarColor('naura', '__proto__') must return a valid token, got: ${typeof tokenProto}`,
  );
  assert.ok(
    toStringSafe,
    `getPillarColor('naura', 'toString') must return a valid token, got: ${typeof tokenToString}`,
  );
});

// -----------------------------------------------------------------------------
// Test Suite 3: Feature F01 - createToken, hexToInt, hexToRgb Stress Testing
// -----------------------------------------------------------------------------
test("F01 Stress - createToken signature flexibility and boundary arguments", () => {
  // Standard signature: (hex, cssVar, label)
  const t1 = createToken("#AABBCC", "--custom-var", "Custom");
  assert.equal(t1.hex, "#AABBCC");
  assert.equal(t1.int, 0xaabbcc);
  assert.equal(t1.cssVar, "--custom-var");
  assert.equal(t1.label, "Custom");
  assert.ok(Object.isFrozen(t1));

  // Inverted signature: (key, hex, label)
  const t2 = createToken("vitals", "#34D399", "Moss Vitals");
  assert.equal(t2.hex, "#34D399");
  assert.equal(t2.int, 0x34d399);
  assert.equal(t2.cssVar, "--pillar-vitals");
  assert.equal(t2.label, "Moss Vitals");

  // Inverted with existing -- prefix: (cssVar, hex, label)
  const t3 = createToken("--my-color", "#123456", "My Color");
  assert.equal(t3.hex, "#123456");
  assert.equal(t3.cssVar, "--my-color");

  // Lowercase hex input
  const t4 = createToken("#ffc0cb", "--lower", "Lower");
  assert.equal(t4.hex, "#FFC0CB");

  // Nullish and boundary inputs
  assert.doesNotThrow(() => {
    const tNull = createToken(null, null);
    assert.equal(tNull.hex, "");
    assert.equal(tNull.int, 0);
    assert.equal(tNull.rgb, "0, 0, 0");
    assert.equal(tNull.cssVar, "");
  });

  assert.doesNotThrow(() => {
    const tUndef = createToken(undefined, undefined);
    assert.equal(tUndef.hex, "");
    assert.equal(tUndef.int, 0);
  });

  // Numeric inputs to createToken
  assert.doesNotThrow(() => {
    const tNum = createToken(12345, 6789);
    assert.equal(typeof tNum.hex, "string");
    assert.equal(typeof tNum.int, "number");
  });
});

test("F01 Stress - hexToInt and hexToRgb boundary resilience", () => {
  // Standard
  assert.equal(hexToInt("#FFFFFF"), 16777215);
  assert.equal(hexToInt("#000000"), 0);
  assert.equal(hexToRgb("#FFFFFF"), "255, 255, 255");
  assert.equal(hexToRgb("#000000"), "0, 0, 0");

  // Without leading hash
  assert.equal(hexToInt("FFC0CB"), 0xffc0cb);
  assert.equal(hexToRgb("FFC0CB"), "255, 192, 203");

  // Whitespace around hex
  assert.equal(hexToInt("  #FFC0CB  "), 0xffc0cb);
  assert.equal(hexToRgb("  #FFC0CB  "), "255, 192, 203");

  // Null, undefined, empty string
  assert.equal(hexToInt(null), 0);
  assert.equal(hexToInt(undefined), 0);
  assert.equal(hexToInt(""), 0);
  assert.equal(hexToRgb(null), "0, 0, 0");
  assert.equal(hexToRgb(undefined), "0, 0, 0");
  assert.equal(hexToRgb(""), "0, 0, 0");

  // Invalid hex strings
  assert.equal(hexToInt("ZZZZZZ"), 0);
  assert.equal(hexToRgb("ZZZZZZ"), "0, 0, 0");
});

// -----------------------------------------------------------------------------
// Test Suite 4: Feature F03 - resolveContainerAccentColor Stress Testing
// -----------------------------------------------------------------------------
test("F03 Stress - resolveContainerAccentColor priority hierarchy verification", () => {
  // Priority 1: accentColorHex beats color, pillar, and footerCategory
  const p1 = resolveContainerAccentColor({
    accentColorHex: "#112233",
    color: 0x445566,
    pillar: "dashboard",
    footerCategory: "survival",
  });
  assert.equal(p1, 0x112233);

  // Priority 2: color beats pillar and footerCategory
  const p2 = resolveContainerAccentColor({
    color: 0x445566,
    pillar: "dashboard",
    footerCategory: "survival",
  });
  assert.equal(p2, 0x445566);

  // Priority 2 with hex string in color parameter
  const p2Hex = resolveContainerAccentColor({
    color: "#445566",
    pillar: "dashboard",
    footerCategory: "survival",
  });
  assert.equal(p2Hex, 0x445566);

  // Priority 3: pillar beats footerCategory
  const p3 = resolveContainerAccentColor({
    pillar: "survival",
    footerCategory: "admin",
  });
  assert.equal(p3, 0x86efac);

  // Priority 4: footerCategory when no color or pillar
  const p4 = resolveContainerAccentColor({
    footerCategory: "admin",
  });
  assert.equal(p4, 0x22d3ee);

  // Priority 5: default fallback (0xFFC0CB)
  const p5 = resolveContainerAccentColor({});
  assert.equal(p5, 0xffc0cb);
});

test("F03 Stress - color=0 (Black) boundary value preservation", () => {
  // In JavaScript, 0 is falsy. A naive `color || fallback` will wrongly replace 0 with fallback!
  // It MUST resolve to 0.
  const colorZero = resolveContainerAccentColor({
    color: 0,
    pillar: "survival",
    footerCategory: "survival",
  });
  assert.equal(
    colorZero,
    0,
    "Color 0 (black) must be preserved and not fall through to pillar",
  );

  const hexZero = resolveContainerAccentColor({
    accentColorHex: "#000000",
    pillar: "survival",
  });
  assert.equal(hexZero, 0, "#000000 must resolve to 0");
});

test("F03 Stress - malformed and boundary color inputs", () => {
  // Malformed accentColorHex fallbacks to next in hierarchy
  assert.equal(
    resolveContainerAccentColor({ accentColorHex: "", pillar: "survival" }),
    0x86efac,
  );
  assert.equal(
    resolveContainerAccentColor({ accentColorHex: "   ", pillar: "survival" }),
    0x86efac,
  );
  assert.equal(
    resolveContainerAccentColor({ accentColorHex: null, pillar: "survival" }),
    0x86efac,
  );
  assert.equal(
    resolveContainerAccentColor({
      accentColorHex: undefined,
      pillar: "survival",
    }),
    0x86efac,
  );

  // Non-finite color numbers
  assert.equal(
    resolveContainerAccentColor({ color: NaN, pillar: "survival" }),
    0x86efac,
  );
  assert.equal(
    resolveContainerAccentColor({ color: Infinity, pillar: "survival" }),
    0x86efac,
  );
  assert.equal(
    resolveContainerAccentColor({ color: -Infinity, pillar: "survival" }),
    0x86efac,
  );
});

test("F03 Stress - all pillar aliases in resolveContainerAccentColor", () => {
  // Test every canonical pillar ID and alias
  const nauraCases = [
    "naura",
    "THEME_NAURA",
    "ekskul",
    "  naura  ",
    "  EKSKUL  ",
  ];
  const survivalCases = [
    "survival",
    "THEME_SURVIVAL",
    "adisha",
    "wilds",
    "  survival  ",
    "  ADISHA  ",
    "  wilds  ",
  ];
  const dashboardCases = [
    "dashboard",
    "THEME_DASHBOARD",
    "kontrol",
    "osis",
    "  dashboard  ",
    "  KONTROL  ",
    "  OSIS  ",
  ];

  const results = {
    naura: {},
    survival: {},
    dashboard: {},
  };

  for (const alias of nauraCases) {
    const res = resolveContainerAccentColor({
      pillar: alias,
      footerCategory: "nonexistent",
    });
    results.naura[alias] = res;
    assert.equal(
      res,
      0xffc0cb,
      `Pillar alias '${alias}' must resolve to Naura accent 0xFFC0CB`,
    );
  }

  for (const alias of survivalCases) {
    const res = resolveContainerAccentColor({
      pillar: alias,
      footerCategory: "nonexistent",
    });
    results.survival[alias] = res;
    assert.equal(
      res,
      0x86efac,
      `Pillar alias '${alias}' must resolve to Survival accent 0x86EFAC`,
    );
  }

  for (const alias of dashboardCases) {
    const res = resolveContainerAccentColor({
      pillar: alias,
      footerCategory: "nonexistent",
    });
    results.dashboard[alias] = res;
    assert.equal(
      res,
      0x22d3ee,
      `Pillar alias '${alias}' must resolve to Dashboard accent 0x22D3EE`,
    );
  }
});

test("F03 Stress - prototype property inputs on pillar and footerCategory", () => {
  const dangerousKeys = ["constructor", "__proto__", "toString", "valueOf"];

  for (const key of dangerousKeys) {
    const pillarRes = resolveContainerAccentColor({
      pillar: key,
      footerCategory: "core",
    });
    const footerRes = resolveContainerAccentColor({ footerCategory: key });

    assert.ok(
      typeof pillarRes === "number" && Number.isFinite(pillarRes),
      `pillar="${key}" must resolve to a finite integer, got: ${typeof pillarRes} (${String(pillarRes)})`,
    );
    assert.ok(
      typeof footerRes === "number" && Number.isFinite(footerRes),
      `footerCategory="${key}" must resolve to a finite integer, got: ${typeof footerRes} (${String(footerRes)})`,
    );
  }
});

// -----------------------------------------------------------------------------
// Test Suite 5: Feature F03 - buildContainerV2 Stress Testing
// -----------------------------------------------------------------------------
test("F03 Stress - buildContainerV2 dual signature and boundary inputs", () => {
  const mockClient = { user: { id: "bot_12345" } };

  // 1. Standard options-only signature
  const p1 = buildContainerV2({
    title: "Options Only",
    pillar: "survival",
  });
  assert.equal(p1.components[0].accent_color, 0x86efac);
  assert.equal(p1.flags, MessageFlags.IsComponentsV2);

  // 2. Dual signature (client, options)
  const p2 = buildContainerV2(mockClient, {
    title: "Client + Options",
    pillar: "dashboard",
  });
  assert.equal(p2.components[0].accent_color, 0x22d3ee);

  // 3. Zero args
  assert.doesNotThrow(() => {
    const pZero = buildContainerV2();
    assert.equal(pZero.components[0].accent_color, 0xffc0cb);
  });

  // 4. Null arg1
  assert.doesNotThrow(() => {
    const pNull = buildContainerV2(null);
    assert.equal(pNull.components[0].accent_color, 0xffc0cb);
  });

  // 5. Client with null arg2
  assert.doesNotThrow(() => {
    const pClientNull = buildContainerV2(mockClient, null);
    assert.equal(typeof pClientNull.components[0].accent_color, "number");
  });

  // 6. Non-object inputs
  assert.doesNotThrow(() => {
    const pStr = buildContainerV2("string_input");
    assert.equal(pStr.components[0].accent_color, 0xffc0cb);
  });

  assert.doesNotThrow(() => {
    const pNum = buildContainerV2(99999);
    assert.equal(pNum.components[0].accent_color, 0xffc0cb);
  });
});

test("F03 Stress - buildContainerV2 color=0 preservation in payload", () => {
  const payload = buildContainerV2({
    title: "Black Accent Test",
    color: 0,
  });
  assert.equal(
    payload.components[0].accent_color,
    0,
    "Container accent_color must be 0 for black",
  );
});

// -----------------------------------------------------------------------------
// Test Suite 6: Feature F02 - CSS Generator Output & Property Verification
// -----------------------------------------------------------------------------
test("F02 Stress - CSS generator syntax, pillar custom properties, and dataset rules", () => {
  const css = generateCssVariables();

  // 1. Basic structure
  assert.ok(
    css.startsWith(
      "/* ==========================================================================",
    ),
  );
  assert.ok(css.includes(":root {"));
  assert.ok(css.includes("}"));

  // 2. Braces balance check
  const openBraces = (css.match(/\{/g) || []).length;
  const closeBraces = (css.match(/\}/g) || []).length;
  assert.equal(openBraces, closeBraces, "CSS braces must be balanced");

  // 3. Pillar 1 variables
  assert.ok(
    css.includes("--pillar-naura-primary: #ffc0cb;"),
    "Naura primary token in CSS",
  );
  assert.ok(
    css.includes("--pillar-naura-chrome: #f472b6;"),
    "Naura chrome token in CSS",
  );
  assert.ok(
    css.includes("--pillar-naura-discord: #ffc0cb;"),
    "Naura discord accent in CSS",
  );

  // 4. Pillar 2 variables (Adisha / Survival)
  assert.ok(
    css.includes("--pillar-survival-primary: #86efac;"),
    "Survival primary token in CSS",
  );
  assert.ok(
    css.includes("--pillar-survival-vitals: #34d399;"),
    "Survival vitals token in CSS",
  );
  assert.ok(
    css.includes("--pillar-survival-discord: #86efac;"),
    "Survival discord accent in CSS",
  );

  // 5. Pillar 3 variables (OSIS / Dashboard)
  assert.ok(
    css.includes("--pillar-dashboard-primary: #22d3ee;"),
    "Dashboard primary token in CSS",
  );
  assert.ok(
    css.includes("--pillar-dashboard-hub: #7b68ee;"),
    "Dashboard hub token in CSS",
  );
  assert.ok(
    css.includes("--pillar-dashboard-discord: #22d3ee;"),
    "Dashboard discord accent in CSS",
  );

  // 6. Scoped dataset selectors
  assert.ok(css.includes('[data-pillar="naura"]'), "Dataset selector naura");
  assert.ok(css.includes('[data-pillar="ekskul"]'), "Dataset selector ekskul");
  assert.ok(
    css.includes('[data-pillar="survival"]'),
    "Dataset selector survival",
  );
  assert.ok(css.includes('[data-pillar="adisha"]'), "Dataset selector adisha");
  assert.ok(css.includes('[data-pillar="wilds"]'), "Dataset selector wilds");
  assert.ok(
    css.includes('[data-pillar="dashboard"]'),
    "Dataset selector dashboard",
  );
  assert.ok(
    css.includes('[data-pillar="kontrol"]'),
    "Dataset selector kontrol",
  );
  assert.ok(css.includes('[data-pillar="osis"]'), "Dataset selector osis");

  // 7. Zero em-dash compliance
  assert.ok(
    !css.includes("\u2014"),
    "Generated CSS must not contain em-dash (U+2014)",
  );
});
