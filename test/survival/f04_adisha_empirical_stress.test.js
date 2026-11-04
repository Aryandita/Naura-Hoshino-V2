"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "../..");

function flatten(obj, prefix = "", out = []) {
  if (obj === null || typeof obj !== "object" || Array.isArray(obj)) return out;
  for (const [key, value] of Object.entries(obj)) {
    const full = prefix ? `${prefix}.${key}` : key;
    if (value !== null && typeof value === "object" && !Array.isArray(value)) {
      flatten(value, full, out);
    } else {
      out.push(full);
    }
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 1: LOCALE PARSING, PARITY & RESIDUAL SUKAMAJU AUDIT
// ═══════════════════════════════════════════════════════════════════════════
test.describe("F04 Empirical Stress - Locale Parsing & Parity", () => {
  const locales = ["id", "en", "es", "ja"];
  const localeData = {};

  test("all 4 locale files parse as valid JSON without syntax errors", () => {
    for (const lang of locales) {
      const filePath = path.join(
        ROOT_DIR,
        "assets",
        "language",
        `${lang}.json`,
      );
      assert.ok(fs.existsSync(filePath), `Locale file must exist: ${filePath}`);
      const raw = fs.readFileSync(filePath, "utf-8");
      assert.doesNotThrow(() => {
        localeData[lang] = JSON.parse(raw);
      }, `Failed to parse ${lang}.json`);
      assert.ok(
        typeof localeData[lang] === "object" && localeData[lang] !== null,
        `${lang}.json must be an object`,
      );
    }
  });

  test("primary locales id.json and en.json strictly contain 508 flattened keys with 100% parity", () => {
    const idFlattened = flatten(localeData.id);
    const enFlattened = flatten(localeData.en);

    assert.equal(
      idFlattened.length,
      508,
      `id.json has ${idFlattened.length} flattened keys, expected 508`,
    );
    assert.equal(
      enFlattened.length,
      508,
      `en.json has ${enFlattened.length} flattened keys, expected 508`,
    );

    const idSet = new Set(idFlattened);
    const enSet = new Set(enFlattened);

    const missingInEn = [...idSet].filter((k) => !enSet.has(k));
    const extraInEn = [...enSet].filter((k) => !idSet.has(k));

    assert.deepEqual(
      missingInEn,
      [],
      "en.json is missing keys present in id.json",
    );
    assert.deepEqual(
      extraInEn,
      [],
      "en.json has extra keys not present in id.json",
    );
  });

  test("secondary locales es.json and ja.json have 485 flattened keys without M1 regressions", () => {
    const esFlattened = flatten(localeData.es);
    const jaFlattened = flatten(localeData.ja);

    assert.equal(
      esFlattened.length,
      485,
      `es.json has ${esFlattened.length} flattened keys, expected 485`,
    );
    assert.equal(
      jaFlattened.length,
      485,
      `ja.json has ${jaFlattened.length} flattened keys, expected 485`,
    );

    // Verify exact difference between id (508) and es (485):
    // 25 missing (chronicle, raidplan, economy, arcade) and 2 extra (setting.lang_es, setting.lang_ja) -> 508 - 25 + 2 = 485
    const idFlattened = flatten(localeData.id);
    const idSet = new Set(idFlattened);
    const esSet = new Set(esFlattened);
    const missingInEs = [...idSet].filter((k) => !esSet.has(k));
    const extraInEs = [...esSet].filter((k) => !idSet.has(k));
    assert.equal(
      missingInEs.length,
      25,
      "es.json must be missing exactly 25 keys from id.json",
    );
    assert.equal(
      extraInEs.length,
      2,
      "es.json has 2 language setting keys not in id.json",
    );
  });

  test("zero empty or whitespace-only strings across all 4 locales", () => {
    function findEmptyStrings(obj, pathPrefix = "") {
      const emptyPaths = [];
      for (const [key, value] of Object.entries(obj)) {
        const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (typeof value === "string") {
          if (value.trim().length === 0) {
            emptyPaths.push(fullPath);
          }
        } else if (typeof value === "object" && value !== null) {
          emptyPaths.push(...findEmptyStrings(value, fullPath));
        }
      }
      return emptyPaths;
    }

    for (const lang of locales) {
      const emptyEntries = findEmptyStrings(localeData[lang]);
      assert.deepEqual(
        emptyEntries,
        [],
        `Locale ${lang}.json contains empty string values at paths: ${emptyEntries.join(", ")}`,
      );
    }
  });

  test("audit zero residual 'Sukamaju' in user-facing keys across all 4 locales", () => {
    function scanForResiduals(obj, pathPrefix = "") {
      const occurrences = [];
      const sukamajuRegex = /sukamaju/i;

      for (const [key, value] of Object.entries(obj)) {
        const fullPath = pathPrefix ? `${pathPrefix}.${key}` : key;
        if (sukamajuRegex.test(key)) {
          occurrences.push({ type: "key", path: fullPath, match: key });
        }
        if (typeof value === "string") {
          if (sukamajuRegex.test(value)) {
            occurrences.push({ type: "value", path: fullPath, match: value });
          }
        } else if (typeof value === "object" && value !== null) {
          occurrences.push(...scanForResiduals(value, fullPath));
        }
      }
      return occurrences;
    }

    for (const lang of locales) {
      const matches = scanForResiduals(localeData[lang]);
      assert.deepEqual(
        matches,
        [],
        `Found ${matches.length} residual 'Sukamaju' references in ${lang}.json: ${JSON.stringify(matches, null, 2)}`,
      );
    }
  });

  test("zero em-dash (U+2014) characters in all 4 locale files", () => {
    for (const lang of locales) {
      const filePath = path.join(
        ROOT_DIR,
        "assets",
        "language",
        `${lang}.json`,
      );
      const raw = fs.readFileSync(filePath, "utf-8");
      const hasEmDash = raw.includes("\u2014");
      assert.equal(
        hasEmDash,
        false,
        `Locale ${lang}.json contains forbidden em-dash (U+2014)`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 2: ITEM CATALOG INTEGRITY & 44 RENAMED ADISHA OCCURRENCES
// ═══════════════════════════════════════════════════════════════════════════
test.describe("F04 Empirical Stress - Item Catalog & Lookups", () => {
  const itemsCatalog = require("../../src/survival/data/items_catalog");
  const { BALANCED_ITEMS_CATALOG, CATALOG_BY_ID, getItemFromCatalog } =
    itemsCatalog;

  test("catalog exports required data structures", () => {
    assert.ok(
      Array.isArray(BALANCED_ITEMS_CATALOG),
      "BALANCED_ITEMS_CATALOG must be an array",
    );
    assert.ok(CATALOG_BY_ID instanceof Map, "CATALOG_BY_ID must be a Map");
    assert.equal(
      typeof getItemFromCatalog,
      "function",
      "getItemFromCatalog must be a function",
    );
    assert.ok(
      BALANCED_ITEMS_CATALOG.length >= 100,
      `Catalog has ${BALANCED_ITEMS_CATALOG.length} items, expected >= 100`,
    );
    assert.equal(
      CATALOG_BY_ID.size,
      BALANCED_ITEMS_CATALOG.length,
      "Map size must match array length",
    );
  });

  test("every item in catalog satisfies structural integrity constraints", () => {
    const validTiers = new Set([1, 2, 3, 4, 5]);
    const validCategories = new Set([
      "weapon",
      "armor",
      "tool",
      "consumable",
      "material",
      "special",
      "pet_item",
    ]);

    for (const item of BALANCED_ITEMS_CATALOG) {
      assert.ok(
        item.id && typeof item.id === "string",
        `Item must have valid string id: ${JSON.stringify(item)}`,
      );
      assert.ok(
        item.name && typeof item.name === "string",
        `Item ${item.id} must have valid string name`,
      );
      assert.ok(
        item.description && typeof item.description === "string",
        `Item ${item.id} must have valid string description`,
      );
      assert.ok(
        typeof item.price === "number" && item.price >= 0,
        `Item ${item.id} must have price >= 0`,
      );
      assert.ok(
        typeof item.sellPrice === "number" && item.sellPrice >= 1,
        `Item ${item.id} must have sellPrice >= 1`,
      );
      assert.ok(
        validCategories.has(item.category),
        `Item ${item.id} category '${item.category}' must be valid`,
      );
      assert.ok(
        validTiers.has(item.tier),
        `Item ${item.id} tier '${item.tier}' must be between 1 and 5`,
      );
      assert.ok(item.rarity, `Item ${item.id} must have rarity label`);
      assert.ok(item.badge, `Item ${item.id} must have tier badge`);
      assert.ok(item.emoji, `Item ${item.id} must have emoji`);
    }
  });

  test("audit zero residual 'Sukamaju' in item names and descriptions", () => {
    const sukamajuRegex = /sukamaju/i;
    const residualItems = [];

    for (const item of BALANCED_ITEMS_CATALOG) {
      if (
        sukamajuRegex.test(item.name) ||
        sukamajuRegex.test(item.description)
      ) {
        residualItems.push({
          id: item.id,
          name: item.name,
          description: item.description,
        });
      }
    }

    assert.deepEqual(
      residualItems,
      [],
      `Found residual 'Sukamaju' in item catalog: ${JSON.stringify(residualItems, null, 2)}`,
    );
  });

  test("verify renamed items contain exactly 44 occurrences of 'Adisha' across catalog", () => {
    const adishaRegex = /adisha/i;
    let nameOccurrences = 0;
    let descOccurrences = 0;

    for (const item of BALANCED_ITEMS_CATALOG) {
      if (adishaRegex.test(item.name)) nameOccurrences++;
      if (adishaRegex.test(item.description)) descOccurrences++;
    }

    const totalOccurrences = nameOccurrences + descOccurrences;
    assert.equal(
      totalOccurrences,
      44,
      `Expected exactly 44 occurrences of 'Adisha' (13 names + 31 descriptions), found ${totalOccurrences} (${nameOccurrences} names, ${descOccurrences} descriptions)`,
    );

    const distinctAdishaItems = BALANCED_ITEMS_CATALOG.filter(
      (item) =>
        adishaRegex.test(item.name) || adishaRegex.test(item.description),
    );
    assert.equal(
      distinctAdishaItems.length,
      33,
      `Expected 33 distinct items with 'Adisha' in name/description, found ${distinctAdishaItems.length}`,
    );
  });

  test("getItemFromCatalog resolves all items with 100% fidelity", () => {
    for (const item of BALANCED_ITEMS_CATALOG) {
      const resolved = getItemFromCatalog(item.id);
      assert.strictEqual(
        resolved,
        item,
        `Lookup failed for item id ${item.id}`,
      );
    }
  });

  test("getItemFromCatalog handles adversarial edge cases without throwing", () => {
    const edgeCases = [
      null,
      undefined,
      "",
      "   ",
      12345,
      {},
      [],
      "__DEFINITELY_NOT_AN_ITEM__",
      "WOODEN_SWORD",
      "null",
      "undefined",
      NaN,
      Symbol("item"),
    ];

    for (const badInput of edgeCases) {
      assert.doesNotThrow(
        () => {
          const result = getItemFromCatalog(badInput);
          assert.equal(
            result,
            null,
            `Expected null for input: ${String(badInput)}`,
          );
        },
        `Threw exception on input: ${String(badInput)}`,
      );
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 3: DATABASE INVARIANCE (sukamajuCoins & desa_sukamaju)
// ═══════════════════════════════════════════════════════════════════════════
test.describe("F04 Empirical Stress - Database & Non-Destructive Invariants", () => {
  test("adishaWorldData preserves desa_sukamaju id and sukamajuCoins currency", () => {
    const {
      ADISHA_REGIONS,
      ADISHA_VEHICLES,
    } = require("../../src/survival/data/adishaWorldData");
    assert.ok(ADISHA_REGIONS, "ADISHA_REGIONS must exist");

    // Test region invariance
    const desa = ADISHA_REGIONS.desa_sukamaju;
    assert.ok(desa, "Region 'desa_sukamaju' must exist in ADISHA_REGIONS");
    assert.equal(
      desa.id,
      "desa_sukamaju",
      "desa_sukamaju id must be preserved",
    );
    assert.equal(
      desa.currencyCode,
      "sukamajuCoins",
      "currencyCode 'sukamajuCoins' must be preserved",
    );
    assert.equal(
      desa.name,
      "Desa Adisha",
      "Display name must be updated to 'Desa Adisha'",
    );

    // Test vehicle invariance
    const motorBebek = ADISHA_VEHICLES.motor_bebek_sukamaju;
    assert.ok(
      motorBebek,
      "Vehicle 'motor_bebek_sukamaju' must exist in ADISHA_VEHICLES",
    );
    assert.equal(
      motorBebek.id,
      "motor_bebek_sukamaju",
      "Vehicle id must be preserved",
    );
    assert.equal(
      motorBebek.locationOrigin,
      "desa_sukamaju",
      "Vehicle origin must be 'desa_sukamaju'",
    );
    assert.ok(
      motorBebek.name.includes("Adisha"),
      "Vehicle display name must include 'Adisha'",
    );
  });

  test("worldMapData preserves REGIONS.desa_sukamaju with full alias support", () => {
    const { REGIONS } = require("../../src/survival/data/worldMapData");
    assert.ok(REGIONS, "REGIONS must exist");
    const desa = REGIONS.desa_sukamaju;
    assert.ok(desa, "REGIONS.desa_sukamaju must exist");
    assert.equal(desa.id, "desa_sukamaju");
    assert.equal(desa.currencyCode, "sukamajuCoins");
    assert.equal(desa.name, "Desa Adisha");

    // Check aliases contain backward-compatible and new names
    assert.ok(
      desa.aliases.includes("sukamaju"),
      "Aliases must include sukamaju",
    );
    assert.ok(
      desa.aliases.includes("desa_adisha"),
      "Aliases must include desa_adisha",
    );
    assert.ok(desa.aliases.includes("adisha"), "Aliases must include adisha");
    assert.ok(desa.aliases.includes("desa"), "Aliases must include desa");
    assert.ok(desa.aliases.includes("village"), "Aliases must include village");
  });

  test("roamLocations preserves ROAM_LOCATIONS.desa_sukamaju and locations", () => {
    const { ROAM_LOCATIONS } = require("../../src/survival/data/roamLocations");
    assert.ok(ROAM_LOCATIONS, "ROAM_LOCATIONS must exist");
    const desa = ROAM_LOCATIONS.desa_sukamaju;
    assert.ok(desa, "ROAM_LOCATIONS.desa_sukamaju must exist");
    assert.equal(desa.id, "desa_sukamaju");
    assert.equal(desa.name, "Desa Adisha");
    assert.ok(desa.locations.balai_desa, "balai_desa must exist");
    assert.ok(desa.locations.warung, "warung must exist");
    assert.ok(desa.locations.kebun, "kebun must exist");
  });

  test("storyData preserves quest requirements while updating narrative", () => {
    const storyData = require("../../src/survival/data/storyData");
    assert.ok(
      Array.isArray(storyData),
      "storyData must be an array of story arcs",
    );

    // Arc 1 check
    const arc1 = storyData.find((a) => a.arc === 1);
    assert.ok(arc1, "Arc 1 must exist");
    assert.equal(
      arc1.region,
      "desa_sukamaju",
      "Arc 1 region must be 'desa_sukamaju'",
    );

    // Check that chapters reference Adisha in narrative
    const ch1 = arc1.chapters.find((c) => c.chapter === 1);
    assert.ok(ch1, "Chapter 1 must exist");
    assert.ok(
      ch1.narrative.includes("Desa Adisha"),
      "Chapter 1 narrative must reference 'Desa Adisha'",
    );

    // Verify no residual Sukamaju in dialogues across all arcs
    for (const arc of storyData) {
      if (Array.isArray(arc.chapters)) {
        for (const chapter of arc.chapters) {
          if (Array.isArray(chapter.dialogue)) {
            for (const line of chapter.dialogue) {
              if (line.text) {
                assert.equal(
                  /sukamaju/i.test(line.text),
                  false,
                  `Found residual Sukamaju in dialogue text: ${line.text}`,
                );
              }
            }
          }
        }
      }
    }
  });

  test("currencyEngine operates on sukamajuCoins without error", () => {
    const currency = require("../../src/survival/engines/currency");
    const { CURRENCIES, FRAGMENT, balanceOf, canAfford, convert } = currency;

    assert.equal(
      CURRENCIES[FRAGMENT].field,
      "sukamajuCoins",
      "field must be sukamajuCoins",
    );
    assert.equal(CURRENCIES[FRAGMENT].short, "SC");

    // Balance check
    const holders = { survival: { sukamajuCoins: 5000 }, profile: {} };
    assert.equal(balanceOf(FRAGMENT, holders), 5000);

    // Legacy fallback check
    const legacyHolders = { survival: { starFragments: 1200 }, profile: {} };
    assert.equal(balanceOf(FRAGMENT, legacyHolders), 1200);

    // Precedence check
    const bothHolders = {
      survival: { sukamajuCoins: 3000, starFragments: 1200 },
      profile: {},
    };
    assert.equal(balanceOf(FRAGMENT, bothHolders), 3000);

    // Affordability check
    assert.equal(canAfford(FRAGMENT, holders, 5000), true);
    assert.equal(canAfford(FRAGMENT, holders, 5001), false);

    // Currency conversion check (1000 SC -> 1 PD)
    assert.equal(convert(5000, FRAGMENT, "coin"), 5);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// SUITE 4: ZERO EM-DASH COMPLIANCE ON ALL TOUCHED FILES
// ═══════════════════════════════════════════════════════════════════════════
test.describe("F04 Empirical Stress - Zero Em-Dash & File Sanity", () => {
  const touchedFiles = [
    "assets/language/id.json",
    "assets/language/en.json",
    "assets/language/es.json",
    "assets/language/ja.json",
    "src/survival/data/items_catalog.js",
    "src/survival/data/storyData.js",
    "src/survival/data/adishaWorldData.js",
    "src/survival/data/worldMapData.js",
    "src/survival/data/roamLocations.js",
    "dashboard/src/pages/activity.html",
    "dashboard/src/pages/adisha-map.html",
    "dashboard/src/pages/survival-map.html",
    "dashboard/src/pages/world.html",
    "dashboard/src/components/Activity/activity3dWorld.js",
  ];

  for (const relPath of touchedFiles) {
    test(`file '${relPath}' has zero em-dash characters (U+2014)`, () => {
      const fullPath = path.join(ROOT_DIR, relPath);
      assert.ok(fs.existsSync(fullPath), `Target file must exist: ${relPath}`);
      const content = fs.readFileSync(fullPath, "utf-8");
      const emDashIndex = content.indexOf("\u2014");
      assert.equal(
        emDashIndex,
        -1,
        `File ${relPath} contains em-dash (U+2014) at index ${emDashIndex}`,
      );
    });
  }

  test("dashboard HTML pages display Adisha in titles and headers", () => {
    const htmlFiles = [
      "dashboard/src/pages/activity.html",
      "dashboard/src/pages/adisha-map.html",
      "dashboard/src/pages/survival-map.html",
      "dashboard/src/pages/world.html",
    ];

    for (const relPath of htmlFiles) {
      const fullPath = path.join(ROOT_DIR, relPath);
      const content = fs.readFileSync(fullPath, "utf-8");
      assert.ok(
        content.includes("Adisha"),
        `HTML page ${relPath} should include 'Adisha'`,
      );
    }
  });
});
