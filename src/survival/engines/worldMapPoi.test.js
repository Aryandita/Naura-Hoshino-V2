"use strict";

const { test } = require("node:test");
const assert = require("node:assert/strict");

const { REGIONS, getPoiById } = require("../data/worldMapData");
const {
  isPoiOpen,
  getActivePois,
  getPoiDetail,
} = require("./poiEngine");

test("Peta Dunia memiliki 4 Wilayah Resmi dengan struktur lengkap", () => {
  assert.ok(REGIONS.desa_sukamaju);
  assert.ok(REGIONS.kota_pratama);
  assert.ok(REGIONS.desa_khulkhas);
  assert.ok(REGIONS.istana_draken);

  // Desa Sukamaju mencakup balai desa, bengkel, kebun, klinik, sekolah, dermaga pantai, padepokan satwa, tambang, dan warung jamu
  const sukamajuPois = REGIONS.desa_sukamaju.pois.map((p) => p.id);
  assert.ok(sukamajuPois.includes("balai_desa"));
  assert.ok(sukamajuPois.includes("bengkel_bagas"));
  assert.ok(sukamajuPois.includes("dermaga_ujang"));
  assert.ok(sukamajuPois.includes("padepokan_satwa"));
  assert.ok(sukamajuPois.includes("tambang_sukamaju"));
  assert.ok(sukamajuPois.includes("sekolah_desa"));
  assert.ok(sukamajuPois.includes("warung_jamu"));

  // Kota Pratama memiliki bursa kerja, balai kota, dan bank sentral
  const pratamaPois = REGIONS.kota_pratama.pois.map((p) => p.id);
  assert.ok(pratamaPois.includes("bank_sentral_pratama"));
  assert.ok(pratamaPois.includes("balai_kota_pratama"));
  assert.ok(pratamaPois.includes("bursa_kerja"));
});

test("isPoiOpen memeriksa jam operasional fasilitas secara akurat", () => {
  const warungJamu = getPoiById("warung_jamu");
  assert.ok(warungJamu);

  // Lapak Jamu Mbak Siti buka jam 06:00 sampai 17:00
  assert.equal(isPoiOpen(warungJamu, 12), true);
  assert.equal(isPoiOpen(warungJamu, 2), false);
  assert.equal(isPoiOpen(warungJamu, 20), false);

  // Klinik Sari buka 24 jam untuk darurat
  const klinik = getPoiById("klinik_sari");
  assert.ok(klinik);
  assert.equal(isPoiOpen(klinik, 3), true);
  assert.equal(isPoiOpen(klinik, 15), true);
});

test("getActivePois mengembalikan data penduduk yang menetap di POI", () => {
  const activePois = getActivePois("desa_sukamaju", 8);
  assert.ok(activePois.length > 0);

  const sekolah = activePois.find((p) => p.id === "sekolah_desa");
  assert.ok(sekolah);
  assert.ok(sekolah.residents.length >= 2);
  const residentIds = sekolah.residents.map((r) => r.id);
  assert.ok(residentIds.includes("bu_ratna"));
});

test("getPoiDetail mengembalikan info operasional, fasilitas, dan penduduk", async () => {
  const detail = await getPoiDetail("klinik_sari", 10);
  assert.ok(detail);
  assert.equal(detail.name, "Klinik Pengobatan Bidan Sari");
  assert.equal(detail.isOpen, true);
  assert.ok(detail.residents.some((r) => r.id === "bidan_sari"));
});
