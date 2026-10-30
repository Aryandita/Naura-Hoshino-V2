"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const version = require("./version");
const env = require("./env");
const packageJson = require("../../package.json");

test("SSOT Version - package.json defines canonical 2.4.0", () => {
  assert.equal(
    packageJson.version,
    "2.4.0",
    "package.json version harus 2.4.0 sebagai SSOT",
  );
});

test("SSOT Version - BOT_VERSION and ENGINE_VERSION match package.json", () => {
  assert.equal(
    version.BOT_VERSION,
    packageJson.version,
    "version.BOT_VERSION harus identik dengan package.json.version",
  );
  assert.equal(
    version.ENGINE_VERSION,
    packageJson.version,
    "version.ENGINE_VERSION harus identik dengan package.json.version",
  );
  assert.equal(
    version.getAppVersion(),
    packageJson.version,
    "version.getAppVersion() harus mengembalikan versi package.json",
  );
  assert.equal(
    version.getEngineVersion(),
    packageJson.version,
    "version.getEngineVersion() harus mengembalikan versi package.json",
  );
});

test("SSOT Version - env configuration inherits BOT_VERSION and ENGINE_VERSION", () => {
  assert.equal(
    env.BOT_VERSION,
    packageJson.version,
    "env.BOT_VERSION harus selaras dengan package.json",
  );
  assert.equal(
    env.ENGINE_VERSION,
    packageJson.version,
    "env.ENGINE_VERSION harus selaras dengan package.json",
  );
  assert.equal(
    env.BASE_VERSION,
    packageJson.version,
    "env.BASE_VERSION harus selaras dengan package.json",
  );
});

test("SSOT Version - Metadata constants are valid", () => {
  assert.ok(typeof version.CODENAME === "string" && version.CODENAME.length > 0, "CODENAME harus berupa string");
  assert.ok(typeof version.AUTHOR === "string" && version.AUTHOR.length > 0, "AUTHOR harus berupa string");
  assert.equal(version.getCodename(), version.CODENAME, "getCodename() harus mengembalikan CODENAME");
});

test("SSOT Version - FOOTERS parity across all categories", () => {
  const categories = [
    "core",
    "naura",
    "utility",
    "survival",
    "music",
    "ai",
    "partner",
    "admin",
    "premium",
    "premium_supporter",
    "premium_friends",
    "premium_vip",
  ];

  for (const cat of categories) {
    const footer = version.getFormattedFooter(cat);
    assert.ok(
      footer.includes(`v${packageJson.version}`),
      `Footer kategori "${cat}" harus memuat v${packageJson.version}`,
    );
  }

  // Fallback test
  const fallbackFooter = version.getFormattedFooter("non_existent_category");
  assert.equal(
    fallbackFooter,
    version.FOOTERS.core,
    "Kategori tidak dikenal harus fallback ke footer core",
  );
});
