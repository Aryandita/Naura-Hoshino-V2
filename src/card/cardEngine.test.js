"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CardEngine = require("./cardEngine");

test("Card Engine - Catalog & Code Generation", () => {
  const catalog = CardEngine.getCatalog();
  assert.ok(Array.isArray(catalog), "Katalog harus berupa array");
  assert.ok(catalog.length > 10, "Katalog karakter minimal 10 kartu");

  const code1 = CardEngine.generateCardCode();
  const code2 = CardEngine.generateCardCode();
  assert.ok(code1.startsWith("nra-"), "Kode kartu harus berawalan 'nra-'");
  assert.notEqual(code1, code2, "Dua kode acak tidak boleh sama");

  const quality = CardEngine.rollQuality();
  assert.ok(
    ["GEM_MINT", "EXCELLENT", "GOOD", "POOR"].includes(quality),
    "Kualitas harus valid",
  );
});

test("Card Engine - Fusion Validation Rules", async () => {
  // Test validasi 3 kartu wajib
  const res1 = await CardEngine.fuseCards("user123", "code1", "code2", null);
  assert.equal(res1.success, false);
  assert.equal(res1.reason, "THREE_CARDS_REQUIRED");

  // Test validasi duplikasi kode kartu
  const res2 = await CardEngine.fuseCards("user123", "code1", "code1", "code2");
  assert.equal(res2.success, false);
  assert.equal(res2.reason, "DUPLICATE_CODES_SELECTED");
});
