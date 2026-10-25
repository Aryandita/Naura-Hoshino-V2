"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

const roamEngine = require("../src/survival/engines/roamEngine");
const { ROAM_LOCATIONS, DATE_TICKETS, canWorkAt } = require("../src/survival/data/roamLocations");

test("RoamEngine - getAreaData() retrieves valid areas and locations", () => {
  const desa = roamEngine.getAreaData("desa_sukamaju");
  assert.ok(desa, "Area desa_sukamaju harus ada");
  assert.equal(desa.id, "desa_sukamaju");
  assert.ok(desa.locations, "Area harus memiliki daftar locations");
  assert.ok(desa.locations.warung, "Desa harus memiliki lokasi warung");
});

test("RoamEngine - getLocationData() retrieves individual location correctly", () => {
  const warung = roamEngine.getLocationData("desa_sukamaju", "warung");
  assert.ok(warung, "Lokasi warung harus ditemukan");
  assert.equal(warung.id, "warung");
  assert.equal(warung.type, "shop");

  const invalid = roamEngine.getLocationData("desa_sukamaju", "non_existent_loc");
  assert.equal(invalid, null);
});

test("RoamEngine - getAvailableLocations() maps location list for UI display", () => {
  const list = roamEngine.getAvailableLocations("desa_sukamaju");
  assert.ok(Array.isArray(list));
  assert.ok(list.length > 0);

  const warungEntry = list.find((loc) => loc.id === "warung");
  assert.ok(warungEntry);
  assert.equal(warungEntry.name, "Warung Bu Yati");
  assert.equal(warungEntry.type, "shop");

  const empty = roamEngine.getAvailableLocations("non_existent_area");
  assert.deepEqual(empty, []);
});

test("RoamLocations Data - DATE_TICKETS definition and requirements", () => {
  assert.ok(DATE_TICKETS.ningsih, "Tiket kencan Ningsih harus terdefinisi");
  assert.equal(DATE_TICKETS.ningsih.itemId, "ticket_picnic");
  assert.equal(DATE_TICKETS.ningsih.cost, 200);
  assert.equal(DATE_TICKETS.ningsih.currency, "fragment");

  assert.ok(DATE_TICKETS.tari, "Tiket kencan Tari harus terdefinisi");
  assert.equal(DATE_TICKETS.tari.itemId, "ticket_beach");
  assert.equal(DATE_TICKETS.tari.cost, 300);
  assert.equal(DATE_TICKETS.tari.currency, "fragment");
});

test("RoamLocations Data - canWorkAt() evaluates user stats capability", () => {
  const kebun = ROAM_LOCATIONS.desa_sukamaju.locations.kebun;
  assert.ok(kebun.workAvailable);

  // Kebun requires strength: 3
  const allowed = canWorkAt(kebun, { strength: 5 });
  assert.equal(allowed, true);

  const insufficient = canWorkAt(kebun, { strength: 1 });
  assert.equal(insufficient, false);
});
