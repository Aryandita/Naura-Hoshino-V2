"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const {
  FRAGMENT,
  COIN,
  COUPON,
  DIAMOND,
  MEDAL,
  SC_PER_PD,
  CURRENCIES,
  LOCATION_CURRENCY,
  currencyKindFor,
  currencyFor,
  byKind,
  emojiOf,
  nameOf,
  format,
  balanceOf,
  canAfford,
  convert,
} = require("../../src/survival/engines/currency");

test.describe("Currency Engine - Constants", () => {
  test("should export correct currency kinds", () => {
    assert.equal(FRAGMENT, "fragment");
    assert.equal(COIN, "coin");
    assert.equal(COUPON, "coupon");
    assert.equal(DIAMOND, "diamond");
    assert.equal(MEDAL, "medal");
  });

  test("SC_PER_PD should be 1000", () => {
    assert.equal(SC_PER_PD, 1000);
  });

  test("CURRENCIES should have all five types", () => {
    assert.ok(CURRENCIES[FRAGMENT]);
    assert.ok(CURRENCIES[COIN]);
    assert.ok(CURRENCIES[COUPON]);
    assert.ok(CURRENCIES[DIAMOND]);
    assert.ok(CURRENCIES[MEDAL]);
  });

  test("each currency should have required fields", () => {
    for (const [kind, currency] of Object.entries(CURRENCIES)) {
      assert.ok(currency.kind, `${kind} should have kind`);
      assert.ok(currency.name, `${kind} should have name`);
      assert.ok(currency.short, `${kind} should have short`);
      assert.ok(currency.field, `${kind} should have field`);
      assert.ok(currency.owner, `${kind} should have owner`);
    }
  });

  test("SC should be owned by survival", () => {
    assert.equal(CURRENCIES[FRAGMENT].owner, "survival");
  });

  test("PD should be owned by profile", () => {
    assert.equal(CURRENCIES[COIN].owner, "profile");
  });

  test("VB should not be convertible", () => {
    assert.equal(CURRENCIES[COUPON].convertible, false);
  });

  test("BA should not be convertible", () => {
    assert.equal(CURRENCIES[DIAMOND].convertible, false);
  });
});

test.describe("Currency Engine - currencyKindFor()", () => {
  test("should return fragment for desa", () => {
    assert.equal(currencyKindFor("desa"), FRAGMENT);
  });

  test("should return fragment for village", () => {
    assert.equal(currencyKindFor("village"), FRAGMENT);
  });

  test("should return coin for kota", () => {
    assert.equal(currencyKindFor("kota"), COIN);
  });

  test("should return coin for city", () => {
    assert.equal(currencyKindFor("city"), COIN);
  });

  test("should return diamond for istana_draken", () => {
    assert.equal(currencyKindFor("istana_draken"), DIAMOND);
  });

  test("should return medal for arcade", () => {
    assert.equal(currencyKindFor("arcade"), MEDAL);
  });

  test("should default to fragment for unknown location", () => {
    assert.equal(currencyKindFor("unknown_place"), FRAGMENT);
  });

  test("should handle null/undefined", () => {
    assert.equal(currencyKindFor(null), FRAGMENT);
    assert.equal(currencyKindFor(undefined), FRAGMENT);
  });

  test("should be case insensitive", () => {
    assert.equal(currencyKindFor("KOTA"), COIN);
    assert.equal(currencyKindFor("Desa"), FRAGMENT);
  });
});

test.describe("Currency Engine - byKind()", () => {
  test("should return correct currency object", () => {
    const sc = byKind(FRAGMENT);
    assert.equal(sc.kind, FRAGMENT);
    assert.equal(sc.name, "Sukamaju Koin");
  });

  test("should return fragment for unknown kind", () => {
    const unknown = byKind("unknown_kind");
    assert.equal(unknown.kind, FRAGMENT);
  });
});

test.describe("Currency Engine - currencyFor()", () => {
  test("should return currency for location", () => {
    const currency = currencyFor("kota");
    assert.equal(currency.kind, COIN);
  });

  test("should return SC currency for desa", () => {
    const currency = currencyFor("desa");
    assert.equal(currency.kind, FRAGMENT);
  });
});

test.describe("Currency Engine - nameOf()", () => {
  test("should return short name for SC", () => {
    assert.equal(nameOf(FRAGMENT), "SC");
  });

  test("should return short name for PD", () => {
    assert.equal(nameOf(COIN), "PD");
  });

  test("should return short name for VB", () => {
    assert.equal(nameOf(COUPON), "VB");
  });

  test("should return short name for BA", () => {
    assert.equal(nameOf(DIAMOND), "BA");
  });
});

test.describe("Currency Engine - format()", () => {
  test("should format SC amount", () => {
    const result = format(FRAGMENT, 1500);
    assert.ok(result.includes("1.500") || result.includes("1500"));
    assert.ok(result.includes("Sukamaju Koin"));
  });

  test("should format PD amount", () => {
    const result = format(COIN, 2500);
    assert.ok(result.includes("2.500") || result.includes("2500"));
    assert.ok(result.includes("Pratama Dollar"));
  });

  test("should handle zero amount", () => {
    const result = format(FRAGMENT, 0);
    assert.ok(result.includes("0"));
  });

  test("should handle negative amount as zero", () => {
    const result = format(FRAGMENT, -100);
    assert.ok(result.includes("0"));
  });
});

test.describe("Currency Engine - balanceOf()", () => {
  test("should read SC from survival", () => {
    const holders = {
      survival: { sukamajuCoins: 500 },
      profile: {},
    };
    assert.equal(balanceOf(FRAGMENT, holders), 500);
  });

  test("should read PD from profile", () => {
    const holders = {
      survival: {},
      profile: { pratamaDollars: 1000 },
    };
    assert.equal(balanceOf(COIN, holders), 1000);
  });

  test("should read VB from survival", () => {
    const holders = {
      survival: { scholarshipVouchers: 25 },
      profile: {},
    };
    assert.equal(balanceOf(COUPON, holders), 25);
  });

  test("should read BA from survival", () => {
    const holders = {
      survival: { adishaDiamonds: 10 },
      profile: {},
    };
    assert.equal(balanceOf(DIAMOND, holders), 10);
  });

  test("should return 0 for missing field", () => {
    const holders = { survival: {}, profile: {} };
    assert.equal(balanceOf(FRAGMENT, holders), 0);
  });

  test("should handle null holders", () => {
    assert.equal(balanceOf(FRAGMENT, {}), 0);
  });

  test("should read legacy starFragments field", () => {
    const holders = {
      survival: { starFragments: 300 },
      profile: {},
    };
    assert.equal(balanceOf(FRAGMENT, holders), 300);
  });

  test("should prefer new field over legacy", () => {
    const holders = {
      survival: { sukamajuCoins: 500, starFragments: 300 },
      profile: {},
    };
    assert.equal(balanceOf(FRAGMENT, holders), 500);
  });
});

test.describe("Currency Engine - canAfford()", () => {
  test("should return true when balance >= amount", () => {
    const holders = { survival: { sukamajuCoins: 500 }, profile: {} };
    assert.ok(canAfford(FRAGMENT, holders, 500));
    assert.ok(canAfford(FRAGMENT, holders, 400));
  });

  test("should return false when balance < amount", () => {
    const holders = { survival: { sukamajuCoins: 100 }, profile: {} };
    assert.ok(!canAfford(FRAGMENT, holders, 200));
  });

  test("should handle zero amount", () => {
    const holders = { survival: { sukamajuCoins: 0 }, profile: {} };
    assert.ok(canAfford(FRAGMENT, holders, 0));
  });
});

test.describe("Currency Engine - convert()", () => {
  test("should convert SC to PD at 1000:1 rate", () => {
    const result = convert(5000, FRAGMENT, COIN);
    assert.equal(result, 5);
  });

  test("should floor partial conversion", () => {
    const result = convert(1500, FRAGMENT, COIN);
    assert.equal(result, 1);
  });

  test("should return same value for same currency", () => {
    const result = convert(1000, FRAGMENT, FRAGMENT);
    assert.equal(result, 1000);
  });

  test("should block PD to SC conversion (one-way bridge)", () => {
    const result = convert(10, COIN, FRAGMENT);
    assert.equal(result, null);
  });

  test("should block VB conversion", () => {
    assert.equal(convert(100, COUPON, FRAGMENT), null);
    assert.equal(convert(100, FRAGMENT, COUPON), null);
  });

  test("should block BA conversion", () => {
    assert.equal(convert(100, DIAMOND, FRAGMENT), null);
    assert.equal(convert(100, FRAGMENT, DIAMOND), null);
  });

  test("should handle zero amount", () => {
    const result = convert(0, FRAGMENT, COIN);
    assert.equal(result, 0);
  });

  test("should handle negative amount as zero", () => {
    const result = convert(-100, FRAGMENT, COIN);
    assert.equal(result, 0);
  });
});

test.describe("Currency Engine - LOCATION_CURRENCY mapping", () => {
  test("should map natural areas to SC", () => {
    const naturalAreas = ["jalanan", "desa", "hutan", "tambang", "laut", "pantai", "sawah", "gunung"];
    for (const area of naturalAreas) {
      assert.equal(LOCATION_CURRENCY[area], FRAGMENT, `${area} should use SC`);
    }
  });

  test("should map urban areas to PD", () => {
    const urbanAreas = ["kota", "city", "academy", "prison"];
    for (const area of urbanAreas) {
      assert.equal(LOCATION_CURRENCY[area], COIN, `${area} should use PD`);
    }
  });

  test("should map Draken areas to BA", () => {
    const drakenAreas = ["istana_draken", "draken", "kastil_draken", "dungeon_draken"];
    for (const area of drakenAreas) {
      assert.equal(LOCATION_CURRENCY[area], DIAMOND, `${area} should use BA`);
    }
  });

  test("should map arcade to MP", () => {
    assert.equal(LOCATION_CURRENCY.arcade, MEDAL);
    assert.equal(LOCATION_CURRENCY.dm, MEDAL);
    assert.equal(LOCATION_CURRENCY.voice, MEDAL);
  });
});

test.describe("Currency Engine - Edge Cases", () => {
  test("emojiOf should return string", () => {
    const emoji = emojiOf(FRAGMENT);
    assert.equal(typeof emoji, "string");
    assert.ok(emoji.length > 0);
  });

  test("format should handle very large numbers", () => {
    const result = format(FRAGMENT, 999999999);
    assert.ok(result.length > 0);
  });

  test("balanceOf should coerce string values to numbers", () => {
    const holders = {
      survival: { sukamajuCoins: "500" },
      profile: {},
    };
    assert.equal(balanceOf(FRAGMENT, holders), 500);
  });

  test("convert should handle non-numeric input", () => {
    const result = convert("abc", FRAGMENT, COIN);
    assert.equal(result, 0);
  });
});
