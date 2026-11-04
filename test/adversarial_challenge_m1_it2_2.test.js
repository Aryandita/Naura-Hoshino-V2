"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT_DIR = path.resolve(__dirname, "..");

// ═══════════════════════════════════════════════════════════════════════════
// Helper: Flatten JSON objects
// ═══════════════════════════════════════════════════════════════════════════
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
// CHALLENGE SUITE 1: Item Catalog Deep Invariance & Adversarial Probes
// ═══════════════════════════════════════════════════════════════════════════
test.describe("Adversarial Challenge 2 - Item Catalog & Lookup Resilience", () => {
  const itemsCatalog = require("../src/survival/data/items_catalog");
  const { BALANCED_ITEMS_CATALOG, CATALOG_BY_ID, getItemFromCatalog } = itemsCatalog;

  test("AC2.1: getItemFromCatalog rejects dangerous prototype pollution strings", () => {
    const dangerousKeys = [
      "constructor",
      "__proto__",
      "prototype",
      "toString",
      "valueOf",
      "isPrototypeOf",
      "propertyIsEnumerable",
      "hasOwnProperty",
      "toLocaleString",
    ];

    for (const key of dangerousKeys) {
      const res = getItemFromCatalog(key);
      assert.strictEqual(
        res,
        null,
        `getItemFromCatalog('${key}') must return null, got: ${typeof res}`,
      );
    }
  });

  test("AC2.2: catalog integrity - all items have valid prices, categories, and tiers", () => {
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
      assert.ok(item.id && typeof item.id === "string", `Item id missing: ${item}`);
      assert.ok(item.name && typeof item.name === "string", `Item ${item.id} name missing`);
      assert.ok(typeof item.price === "number" && !isNaN(item.price) && item.price >= 0, `Item ${item.id} invalid price: ${item.price}`);
      assert.ok(typeof item.sellPrice === "number" && !isNaN(item.sellPrice) && item.sellPrice >= 1, `Item ${item.id} invalid sellPrice: ${item.sellPrice}`);
      assert.ok(validCategories.has(item.category), `Item ${item.id} invalid category: ${item.category}`);
      assert.ok([1, 2, 3, 4, 5].includes(item.tier), `Item ${item.id} invalid tier: ${item.tier}`);
      assert.ok(item.rarity, `Item ${item.id} missing rarity`);
      assert.ok(item.emoji, `Item ${item.id} missing emoji`);
    }
  });

  test("AC2.3: catalog zero-residual Sukamaju audit across all fields", () => {
    const sukamajuRegex = /sukamaju/i;
    const residual = [];

    for (const item of BALANCED_ITEMS_CATALOG) {
      if (
        sukamajuRegex.test(item.name) ||
        sukamajuRegex.test(item.description) ||
        sukamajuRegex.test(item.category) ||
        sukamajuRegex.test(item.id)
      ) {
        residual.push(item);
      }
    }

    assert.deepEqual(residual, [], `Found residual 'Sukamaju' in catalog items: ${JSON.stringify(residual)}`);
  });

  test("AC2.4: getItemFromCatalog 100% fidelity on valid IDs and case sensitivity", () => {
    for (const item of BALANCED_ITEMS_CATALOG) {
      const found = getItemFromCatalog(item.id);
      assert.strictEqual(found, item, `getItemFromCatalog(${item.id}) did not return exact object`);
    }
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHALLENGE SUITE 2: Currency Engine Invariants & Edge Case Stress
// ═══════════════════════════════════════════════════════════════════════════
test.describe("Adversarial Challenge 2 - Currency Engine Invariance & Edge Cases", () => {
  const currency = require("../src/survival/engines/currency");
  const { CURRENCIES, FRAGMENT, COIN, COUPON, DIAMOND, MEDAL, balanceOf, canAfford, convert, currencyKindFor, currencyFor, format } = currency;

  test("AC2.5: currency constant invariants (sukamajuCoins mapping)", () => {
    assert.equal(CURRENCIES[FRAGMENT].field, "sukamajuCoins", "FRAGMENT must map to sukamajuCoins");
    assert.equal(CURRENCIES[FRAGMENT].legacyField, "starFragments", "legacyField must be starFragments");
    assert.equal(CURRENCIES[FRAGMENT].owner, "survival", "FRAGMENT owner must be survival");
    assert.equal(CURRENCIES[FRAGMENT].short, "SC", "FRAGMENT short must be SC");
    assert.equal(CURRENCIES[FRAGMENT].convertible, true, "FRAGMENT must be convertible");

    assert.equal(CURRENCIES[DIAMOND].field, "adishaDiamonds", "DIAMOND must map to adishaDiamonds");
    assert.equal(CURRENCIES[DIAMOND].owner, "survival", "DIAMOND owner must be survival");
    assert.equal(CURRENCIES[DIAMOND].short, "BA", "DIAMOND short must be BA");
    assert.equal(CURRENCIES[DIAMOND].convertible, false, "DIAMOND must not be convertible");
  });

  test("AC2.6: balanceOf resilience with strings, undefined, prototypes, and fallbacks", () => {
    // Standard survival holder
    assert.equal(balanceOf(FRAGMENT, { survival: { sukamajuCoins: 1250 } }), 1250);

    // String coercion
    assert.equal(balanceOf(FRAGMENT, { survival: { sukamajuCoins: "2500" } }), 2500);

    // Legacy fallback
    assert.equal(balanceOf(FRAGMENT, { survival: { starFragments: 800 } }), 800);

    // Priority: new field dominates legacy field
    assert.equal(balanceOf(FRAGMENT, { survival: { sukamajuCoins: 1500, starFragments: 500 } }), 1500);

    // Empty and default holders
    assert.equal(balanceOf(FRAGMENT, undefined), 0);
    assert.equal(balanceOf(FRAGMENT, {}), 0);
    assert.equal(balanceOf(FRAGMENT, { survival: {} }), 0);

    // Prototype property keys on survival holder
    const protoHolder = { survival: Object.create({ sukamajuCoins: 9999 }) };
    assert.equal(balanceOf(FRAGMENT, protoHolder), 9999);
  });

  test("AC2.7: canAfford boundary values and extreme inputs", () => {
    const holder = { survival: { sukamajuCoins: 500 } };

    assert.equal(canAfford(FRAGMENT, holder, 0), true);
    assert.equal(canAfford(FRAGMENT, holder, 500), true);
    assert.equal(canAfford(FRAGMENT, holder, 501), false);
    assert.equal(canAfford(FRAGMENT, holder, -100), true); // Negative cost is trivially affordable
    assert.equal(canAfford(FRAGMENT, holder, 1e9), false);
  });

  test("AC2.8: currency conversion rules and bridge locks", () => {
    // 1000 SC = 1 PD
    assert.equal(convert(1000, FRAGMENT, COIN), 1);
    assert.equal(convert(2500, FRAGMENT, COIN), 2); // Floored
    assert.equal(convert(999, FRAGMENT, COIN), 0);
    assert.equal(convert(0, FRAGMENT, COIN), 0);
    assert.equal(convert(-500, FRAGMENT, COIN), 0);

    // Same currency identity
    assert.equal(convert(500, FRAGMENT, FRAGMENT), 500);

    // Reverse conversion (PD -> SC) is locked and returns null
    assert.strictEqual(convert(10, COIN, FRAGMENT), null);

    // Non-convertible currencies return null
    assert.strictEqual(convert(100, DIAMOND, COIN), null);
    assert.strictEqual(convert(100, COUPON, COIN), null);
    assert.strictEqual(convert(100, MEDAL, COIN), null);
  });

  test("AC2.9: currencyKindFor location resolutions", () => {
    // Natural / village locations -> fragment
    assert.equal(currencyKindFor("desa"), FRAGMENT);
    assert.equal(currencyKindFor("village"), FRAGMENT);
    assert.equal(currencyKindFor("hutan"), FRAGMENT);
    assert.equal(currencyKindFor("tambang"), FRAGMENT);

    // Urban -> coin
    assert.equal(currencyKindFor("kota"), COIN);
    assert.equal(currencyKindFor("city"), COIN);
    assert.equal(currencyKindFor("academy"), COIN);
    assert.equal(currencyKindFor("prison"), COIN);

    // Dungeon -> diamond
    assert.equal(currencyKindFor("istana_draken"), DIAMOND);
    assert.equal(currencyKindFor("draken"), DIAMOND);

    // Arcade -> medal
    assert.equal(currencyKindFor("arcade"), MEDAL);

    // Unknown -> defaults to fragment
    assert.equal(currencyKindFor("unknown_zone_xyz"), FRAGMENT);
    assert.equal(currencyKindFor(null), FRAGMENT);
    assert.equal(currencyKindFor(undefined), FRAGMENT);
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHALLENGE SUITE 3: Database & Migration Non-Destructive Invariants
// ═══════════════════════════════════════════════════════════════════════════
test.describe("Adversarial Challenge 2 - Database Non-Destructive Invariants", () => {
  test("AC2.10: dbMigrator v47, v48, v49, v50 preserve sukamajuCoins and schema", () => {
    const migratorPath = path.join(ROOT_DIR, "src", "managers", "dbMigrator.js");
    assert.ok(fs.existsSync(migratorPath), "dbMigrator.js must exist");
    const content = fs.readFileSync(migratorPath, "utf-8");

    // Check v47 exists
    assert.ok(content.includes("v47_rename_currencies_to_slice_of_life"), "v47 migration must exist");
    assert.ok(content.includes("sukamajuCoins INT DEFAULT 500"), "v47 SQLite must add sukamajuCoins with default 500");
    assert.ok(content.includes('"sukamajuCoins" INTEGER DEFAULT 500'), "v47 PostgreSQL must add sukamajuCoins with default 500");

    // Check v48 exists
    assert.ok(content.includes("v48_add_adisha_diamonds"), "v48 migration must exist");
    assert.ok(content.includes("adishaDiamonds INT DEFAULT 0"), "v48 SQLite must add adishaDiamonds");

    // Check v50 exists
    assert.ok(content.includes("v50_create_story_progress_and_user_npcs"), "v50 migration must exist");

    // Invariant: No DROP or destructive modification of sukamajuCoins anywhere in dbMigrator
    const dropSukamajuRegex = /DROP\s+(COLUMN\s+)?(")?sukamajuCoins(")?/i;
    assert.equal(dropSukamajuRegex.test(content), false, "dbMigrator must never DROP sukamajuCoins");

    const dropUserSurvivalsRegex = /DROP\s+TABLE\s+(")?UserSurvivals(")?/i;
    assert.equal(dropUserSurvivalsRegex.test(content), false, "dbMigrator must never DROP UserSurvivals");
  });

  test("AC2.11: UserSurvival model defines sukamajuCoins, adishaDiamonds and virtual aliases", () => {
    const modelPath = path.join(ROOT_DIR, "src", "models", "UserSurvival.js");
    assert.ok(fs.existsSync(modelPath), "UserSurvival.js must exist");
    const content = fs.readFileSync(modelPath, "utf-8");

    // sukamajuCoins column
    assert.ok(content.includes("sukamajuCoins:"), "UserSurvival must define sukamajuCoins column");
    assert.ok(content.includes("defaultValue: 500"), "UserSurvival sukamajuCoins must default to 500");

    // adishaDiamonds column
    assert.ok(content.includes("adishaDiamonds:"), "UserSurvival must define adishaDiamonds column");

    // Virtual starFragments
    assert.ok(content.includes("starFragments:"), "UserSurvival must define virtual starFragments");
    assert.ok(content.includes('this.getDataValue("sukamajuCoins")'), "virtual starFragments getter must read sukamajuCoins");
    assert.ok(content.includes('this.setDataValue("sukamajuCoins", val)'), "virtual starFragments setter must write sukamajuCoins");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHALLENGE SUITE 4: World, Roam, and Story Region Invariants
// ═══════════════════════════════════════════════════════════════════════════
test.describe("Adversarial Challenge 2 - World, Roam, and Story Region Invariants", () => {
  test("AC2.12: adishaWorldData preserves desa_sukamaju and vehicles", () => {
    const { ADISHA_REGIONS, ADISHA_VEHICLES } = require("../src/survival/data/adishaWorldData");
    assert.ok(ADISHA_REGIONS.desa_sukamaju, "ADISHA_REGIONS.desa_sukamaju must exist");
    assert.equal(ADISHA_REGIONS.desa_sukamaju.id, "desa_sukamaju");
    assert.equal(ADISHA_REGIONS.desa_sukamaju.currencyCode, "sukamajuCoins");
    assert.equal(ADISHA_REGIONS.desa_sukamaju.name, "Desa Adisha");

    assert.ok(ADISHA_VEHICLES.motor_bebek_sukamaju, "motor_bebek_sukamaju vehicle must exist");
    assert.equal(ADISHA_VEHICLES.motor_bebek_sukamaju.locationOrigin, "desa_sukamaju");
  });

  test("AC2.13: worldMapData getRegion resolves canonical and alias inputs", () => {
    const { REGIONS, getRegion, getPoiById } = require("../src/survival/data/worldMapData");

    const aliasesToTest = [
      "desa_sukamaju",
      "DESA_SUKAMAJU",
      "sukamaju",
      "SUKAMAJU",
      "adisha",
      "ADISHA",
      "desa_adisha",
      "DESA_ADISHA",
      "desa",
      "village",
      "  adisha  ",
    ];

    for (const alias of aliasesToTest) {
      const region = getRegion(alias);
      assert.ok(region, `getRegion('${alias}') must resolve to a region`);
      assert.equal(region.id, "desa_sukamaju", `getRegion('${alias}') must resolve to desa_sukamaju`);
      assert.equal(region.name, "Desa Adisha", `getRegion('${alias}') name must be 'Desa Adisha'`);
    }

    // Default when null/empty
    assert.equal(getRegion(null).id, "desa_sukamaju");
    assert.equal(getRegion("").id, "desa_sukamaju");

    // Invalid region returns null
    assert.strictEqual(getRegion("totally_nonexistent_region_999"), null);

    // POI lookup
    const balaiDesa = getPoiById("balai_desa");
    assert.ok(balaiDesa, "getPoiById('balai_desa') must resolve");
    assert.equal(balaiDesa.regionId, "desa_sukamaju");
  });

  test("AC2.14: roamLocations preserves desa_sukamaju and locations", () => {
    const { ROAM_LOCATIONS } = require("../src/survival/data/roamLocations");
    assert.ok(ROAM_LOCATIONS.desa_sukamaju, "ROAM_LOCATIONS.desa_sukamaju must exist");
    assert.equal(ROAM_LOCATIONS.desa_sukamaju.id, "desa_sukamaju");
    assert.equal(ROAM_LOCATIONS.desa_sukamaju.name, "Desa Adisha");
    assert.equal(ROAM_LOCATIONS.desa_sukamaju.currency, "fragment");
    assert.ok(ROAM_LOCATIONS.desa_sukamaju.locations.warung, "warung must exist");
    assert.ok(ROAM_LOCATIONS.desa_sukamaju.locations.balai_desa, "balai_desa must exist");
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// CHALLENGE SUITE 5: Strict 508-Key Parity and Zero Em-Dash Invariants
// ═══════════════════════════════════════════════════════════════════════════
test.describe("Adversarial Challenge 2 - Strict 508-Key Parity & Em-Dash Invariants", () => {
  test("AC2.15: id.json and en.json have exact 508 keys with zero discrepancy", () => {
    const idPath = path.join(ROOT_DIR, "assets", "language", "id.json");
    const enPath = path.join(ROOT_DIR, "assets", "language", "en.json");

    const idJson = JSON.parse(fs.readFileSync(idPath, "utf-8"));
    const enJson = JSON.parse(fs.readFileSync(enPath, "utf-8"));

    const idKeys = flatten(idJson);
    const enKeys = flatten(enJson);

    assert.equal(idKeys.length, 508, `id.json must have 508 keys, got: ${idKeys.length}`);
    assert.equal(enKeys.length, 508, `en.json must have 508 keys, got: ${enKeys.length}`);

    const idSet = new Set(idKeys);
    const enSet = new Set(enKeys);

    const missingInEn = [...idSet].filter((k) => !enSet.has(k));
    const extraInEn = [...enSet].filter((k) => !idSet.has(k));

    assert.deepEqual(missingInEn, [], "en.json missing keys");
    assert.deepEqual(extraInEn, [], "en.json extra keys");
  });

  test("AC2.16: all 4 locale files have zero residual 'Sukamaju' and zero em-dash", () => {
    const locales = ["id", "en", "es", "ja"];
    const sukamajuRegex = /sukamaju/i;

    for (const lang of locales) {
      const p = path.join(ROOT_DIR, "assets", "language", `${lang}.json`);
      const raw = fs.readFileSync(p, "utf-8");

      assert.equal(raw.includes("\u2014"), false, `${lang}.json contains forbidden em-dash (U+2014)`);

      const data = JSON.parse(raw);
      const keys = flatten(data);

      function checkNoSukamaju(obj, prefix = "") {
        for (const [k, v] of Object.entries(obj)) {
          const current = prefix ? `${prefix}.${k}` : k;
          assert.equal(sukamajuRegex.test(k), false, `Key ${current} in ${lang}.json contains 'Sukamaju'`);
          if (typeof v === "string") {
            assert.equal(sukamajuRegex.test(v), false, `Value at ${current} in ${lang}.json contains 'Sukamaju': "${v}"`);
          } else if (typeof v === "object" && v !== null && !Array.isArray(v)) {
            checkNoSukamaju(v, current);
          }
        }
      }

      checkNoSukamaju(data);
    }
  });
});
