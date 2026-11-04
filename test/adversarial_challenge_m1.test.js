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
  PILLARS,
} = require("../src/config/tokens/designTokens");

const {
  buildContainerV2,
  resolveContainerAccentColor,
} = require("../src/utils/NauraContainerBuilder");

// =============================================================================
// CHALLENGE 1: Prototype Property Defense & Prototype Pollution Resilience
// =============================================================================

test("CHALLENGE 1.1: getPillarColor rejects built-in Object prototype keys", () => {
  const dangerousKeys = [
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "hasOwnProperty",
    "toLocaleString",
  ];

  const pillars = ["naura", "survival", "dashboard", "adisha", "kontrol"];

  for (const pillar of pillars) {
    for (const key of dangerousKeys) {
      const token = getPillarColor(pillar, key);
      assert.ok(
        token && typeof token === "object",
        `getPillarColor('${pillar}', '${key}') must return a valid token object`,
      );
      assert.ok(
        typeof token.hex === "string" && token.hex.startsWith("#"),
        `getPillarColor('${pillar}', '${key}').hex must be a valid hex color string, got: ${token.hex}`,
      );
      assert.ok(
        typeof token.int === "number" && Number.isFinite(token.int),
        `getPillarColor('${pillar}', '${key}').int must be a finite number, got: ${token.int}`,
      );

      // It must have fallen back to the pillar's primary token!
      const expectedPrimary = getPillarColor(pillar, "primary");
      assert.equal(
        token.hex,
        expectedPrimary.hex,
        `getPillarColor('${pillar}', '${key}') must fall back to primary token`,
      );
    }
  }
});

test("CHALLENGE 1.2: Active Prototype Pollution Resilience", () => {
  // Deliberately pollute Object.prototype with traps
  const traps = {
    polluted_color: { hex: "#BADC0DE", int: 0xbadc0d },
    polluted_pillar: 0x666666,
    evil: "malicious_string",
    primary: "hijacked_primary",
    naura: 0x999999,
  };

  try {
    for (const [k, v] of Object.entries(traps)) {
      Object.prototype[k] = v;
    }

    // 1. getPillarColor must ignore polluted properties
    const nauraToken = getPillarColor("naura", "polluted_color");
    assert.equal(
      nauraToken.hex,
      "#FFC0CB",
      "getPillarColor must not return polluted property on Object.prototype",
    );

    // 2. resolveContainerAccentColor must ignore polluted pillar
    const accentFromPollutedPillar = resolveContainerAccentColor({
      pillar: "polluted_pillar",
      footerCategory: "core",
    });
    assert.equal(
      accentFromPollutedPillar,
      0xffc0cb,
      "resolveContainerAccentColor must not resolve polluted pillar name",
    );

    // 3. resolveContainerAccentColor must ignore polluted footerCategory
    const accentFromPollutedFooter = resolveContainerAccentColor({
      footerCategory: "polluted_pillar",
    });
    assert.equal(
      accentFromPollutedFooter,
      0xffc0cb,
      "resolveContainerAccentColor must not resolve polluted footerCategory",
    );
  } finally {
    // Clean up prototype pollution immediately
    for (const k of Object.keys(traps)) {
      delete Object.prototype[k];
    }
  }
});

test("CHALLENGE 1.3: resolveContainerAccentColor with prototype keys as pillar or footer", () => {
  const dangerousKeys = [
    "constructor",
    "__proto__",
    "toString",
    "valueOf",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "hasOwnProperty",
  ];

  for (const key of dangerousKeys) {
    // When pillar is prototype key and footerCategory is absent -> should resolve to default 0xFFC0CB
    const resDefault = resolveContainerAccentColor({ pillar: key });
    assert.equal(
      resDefault,
      0xffc0cb,
      `pillar="${key}" with default footerCategory must resolve to 0xFFC0CB`,
    );

    // When pillar is prototype key but footerCategory is valid ("survival") -> must fall back to footerCategory!
    const resFallback = resolveContainerAccentColor({
      pillar: key,
      footerCategory: "survival",
    });
    assert.equal(
      resFallback,
      0x86efac,
      `pillar="${key}" must safely fall back to footerCategory="survival" (0x86EFAC)`,
    );

    // When footerCategory is prototype key -> must fall back to default
    const resFooter = resolveContainerAccentColor({ footerCategory: key });
    assert.equal(
      resFooter,
      0xffc0cb,
      `footerCategory="${key}" must safely fall back to default (0xFFC0CB)`,
    );
  }
});

// =============================================================================
// CHALLENGE 2: Priority Hierarchy Strict Verification
// Hierarchy: accentColorHex > color > pillar > footerCategory > default
// =============================================================================

test("CHALLENGE 2.1: Priority 1 (accentColorHex) dominates all lower tiers", () => {
  const result = resolveContainerAccentColor({
    accentColorHex: "#AABBCC",
    color: 0x112233,
    pillar: "dashboard",
    footerCategory: "survival",
    defaultColor: "#999999",
  });
  assert.equal(result, 0xaabbcc);
});

test("CHALLENGE 2.2: Priority 2 (color number & hex string) dominates lower tiers", () => {
  // Numeric color dominates
  const numResult = resolveContainerAccentColor({
    accentColorHex: null, // absent/invalid P1
    color: 0x445566,
    pillar: "dashboard",
    footerCategory: "survival",
    defaultColor: "#999999",
  });
  assert.equal(numResult, 0x445566);

  // Hex string color dominates
  const strResult = resolveContainerAccentColor({
    accentColorHex: "", // empty P1
    color: "#556677",
    pillar: "survival",
    footerCategory: "dashboard",
  });
  assert.equal(strResult, 0x556677);
});

test("CHALLENGE 2.3: Priority 2 Boundary - color=0 (Black) preservation", () => {
  // Numeric 0 must NOT be treated as falsy and must NOT fall through to pillar/footer
  const zeroColorResult = resolveContainerAccentColor({
    color: 0,
    pillar: "survival",
    footerCategory: "dashboard",
  });
  assert.equal(
    zeroColorResult,
    0,
    "Numeric color=0 must be preserved as 0, not fall through to pillar",
  );

  // accentColorHex "#000000" must also resolve to 0
  const zeroHexResult = resolveContainerAccentColor({
    accentColorHex: "#000000",
    pillar: "survival",
  });
  assert.equal(zeroHexResult, 0, "accentColorHex=#000000 must resolve to 0");

  // color string "#000000" must also resolve to 0
  const zeroStrResult = resolveContainerAccentColor({
    color: "#000000",
    pillar: "dashboard",
  });
  assert.equal(zeroStrResult, 0, "color=#000000 must resolve to 0");
});

test("CHALLENGE 2.4: Priority 3 (pillar) dominates footerCategory and default", () => {
  const p1 = resolveContainerAccentColor({
    pillar: "survival",
    footerCategory: "dashboard",
  });
  assert.equal(p1, 0x86efac);

  const p2 = resolveContainerAccentColor({
    pillar: "dashboard",
    footerCategory: "survival",
  });
  assert.equal(p2, 0x22d3ee);

  const p3 = resolveContainerAccentColor({
    pillar: "naura",
    footerCategory: "survival",
  });
  assert.equal(p3, 0xffc0cb);
});

test("CHALLENGE 2.5: Priority 4 (footerCategory) dominates default when higher tiers absent", () => {
  const fSurvival = resolveContainerAccentColor({
    footerCategory: "survival",
    defaultColor: "#123456",
  });
  assert.equal(fSurvival, 0x86efac);

  const fDashboard = resolveContainerAccentColor({
    footerCategory: "dashboard",
    defaultColor: "#123456",
  });
  assert.equal(fDashboard, 0x22d3ee);

  const fAdmin = resolveContainerAccentColor({
    footerCategory: "admin",
    defaultColor: "#123456",
  });
  assert.equal(fAdmin, 0x22d3ee);
});

test("CHALLENGE 2.6: Priority 5 (defaultColor / hardcoded fallback) when all tiers absent", () => {
  // With explicit custom defaultColor
  const dCustom = resolveContainerAccentColor({
    pillar: "unknown_xyz",
    footerCategory: "unknown_category",
    defaultColor: "#778899",
  });
  assert.equal(dCustom, 0x778899);

  // Without defaultColor -> fallback to Naura accent 0xFFC0CB
  const dStandard = resolveContainerAccentColor({
    pillar: "unknown_xyz",
    footerCategory: "unknown_category",
    defaultColor: null,
  });
  assert.equal(dStandard, 0xffc0cb);

  // Empty object
  const dEmpty = resolveContainerAccentColor({});
  assert.equal(dEmpty, 0xffc0cb);
});

// =============================================================================
// CHALLENGE 3: Edge Cases, Malformed Inputs & Whitespace Handling
// =============================================================================

test("CHALLENGE 3.1: Case-insensitivity across all pillar and footer variants", () => {
  const variations = [
    { input: "NAURA", expected: 0xffc0cb },
    { input: "nAuRa", expected: 0xffc0cb },
    { input: "THEME_NAURA", expected: 0xffc0cb },
    { input: "ThEmE_nAuRa", expected: 0xffc0cb },
    { input: "EKSKUL", expected: 0xffc0cb },
    { input: "SURVIVAL", expected: 0x86efac },
    { input: "SuRvIvAl", expected: 0x86efac },
    { input: "THEME_SURVIVAL", expected: 0x86efac },
    { input: "ADISHA", expected: 0x86efac },
    { input: "aDiShA", expected: 0x86efac },
    { input: "WILDS", expected: 0x86efac },
    { input: "DASHBOARD", expected: 0x22d3ee },
    { input: "DaShBoArD", expected: 0x22d3ee },
    { input: "THEME_DASHBOARD", expected: 0x22d3ee },
    { input: "KONTROL", expected: 0x22d3ee },
    { input: "kOnTrOl", expected: 0x22d3ee },
    { input: "OSIS", expected: 0x22d3ee },
  ];

  for (const { input, expected } of variations) {
    // Test as pillar
    const resPillar = resolveContainerAccentColor({ pillar: input });
    assert.equal(
      resPillar,
      expected,
      `Pillar casing '${input}' must resolve to ${expected.toString(16)}`,
    );

    // Test as footerCategory
    const resFooter = resolveContainerAccentColor({ footerCategory: input });
    assert.equal(
      resFooter,
      expected,
      `FooterCategory casing '${input}' must resolve to ${expected.toString(16)}`,
    );
  }
});

test("CHALLENGE 3.2: Whitespace, tabs, and newline trimming resilience", () => {
  const whitespaceInputs = [
    { input: "  naura  ", expected: 0xffc0cb },
    { input: "\tsurvival\t", expected: 0x86efac },
    { input: "\n\r dashboard \r\n", expected: 0x22d3ee },
    { input: "   adisha   ", expected: 0x86efac },
    { input: "  THEME_SURVIVAL  ", expected: 0x86efac },
  ];

  for (const { input, expected } of whitespaceInputs) {
    const resPillar = resolveContainerAccentColor({ pillar: input });
    assert.equal(resPillar, expected);

    const resFooter = resolveContainerAccentColor({ footerCategory: input });
    assert.equal(resFooter, expected);
  }

  // Whitespace around hex colors
  assert.equal(
    resolveContainerAccentColor({ accentColorHex: "  #123456  " }),
    0x123456,
  );
  assert.equal(
    resolveContainerAccentColor({ color: "\t 0x123456 \n" }),
    0x123456,
  );
  assert.equal(
    resolveContainerAccentColor({ accentColorHex: "  #000000  " }),
    0,
  );
});

test("CHALLENGE 3.3: Bizarre, non-string, and malformed inputs to resolveContainerAccentColor", () => {
  const bizarreInputs = [
    null,
    undefined,
    "",
    "   ",
    false,
    true,
    NaN,
    Infinity,
    -Infinity,
    [],
    {},
    () => {},
    Symbol("bizarre"),
    12345n, // BigInt
  ];

  for (const bad of bizarreInputs) {
    // Should never throw, should return finite integer
    assert.doesNotThrow(() => {
      const res = resolveContainerAccentColor({
        accentColorHex: bad,
        color: bad,
        pillar: bad,
        footerCategory: bad,
      });
      assert.ok(
        typeof res === "number" && Number.isFinite(res),
        `Bizarre input ${String(bad)} must resolve to finite number, got: ${res}`,
      );
    });
  }
});

test("CHALLENGE 3.4: buildContainerV2 end-to-end integration with color=0 and pillars", () => {
  // Test black color preservation in Discord container payload
  const blackPayload = buildContainerV2({
    title: "Empirical Black Color Test",
    color: 0,
    pillar: "survival",
  });
  assert.equal(
    blackPayload.components[0].accent_color,
    0,
    "Payload accent_color must be 0 for black color",
  );
  assert.equal(blackPayload.flags, MessageFlags.IsComponentsV2);

  // Test pillar resolution in container payload
  const survivalPayload = buildContainerV2({
    title: "Survival Pillar Test",
    pillar: "adisha",
  });
  assert.equal(
    survivalPayload.components[0].accent_color,
    0x86efac,
    "Payload accent_color must be 0x86EFAC for adisha pillar",
  );

  const dashboardPayload = buildContainerV2({
    title: "Dashboard Pillar Test",
    pillar: "kontrol",
  });
  assert.equal(
    dashboardPayload.components[0].accent_color,
    0x22d3ee,
    "Payload accent_color must be 0x22D3EE for kontrol pillar",
  );

  // Test dual signature: buildContainerV2(client, options)
  const clientPayload = buildContainerV2(
    { user: { id: "test" } },
    {
      title: "Client Sig Test",
      accentColorHex: "#FEDCBA",
    },
  );
  assert.equal(clientPayload.components[0].accent_color, 0xfedcba);
});
