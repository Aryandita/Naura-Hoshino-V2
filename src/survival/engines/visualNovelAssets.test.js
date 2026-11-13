"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const path = require("node:path");
const renderer = require("./visualNovelRenderer");

test("potret NPC bersubfolder ditemukan dan fallback ke netral", () => {
  assert.equal(path.basename(renderer.getCharacterPortrait("naura", "happy")), "naura_happy.png");
  assert.equal(path.basename(renderer.getCharacterPortrait("naura", "unknown")), "naura_neutral.png");
  assert.equal(renderer.getCharacterPortrait("../../other", "neutral"), null);
});

test("latar berwilayah ditemukan dan path di luar aset ditolak", () => {
  assert.equal(path.basename(renderer.getBackground("desa_sukamaju/kebun_morning")), "kebun_morning.png");
  assert.equal(renderer.getBackground("../kebun_morning"), null);
  assert.equal(renderer.getBackground("tidak_ada"), null);
});

test("payload scene memuat thumbnail dan attachment yang sesuai", async () => {
  const payload = await renderer.renderScene({ characterId: "naura", characterEmotion: "happy", speakerName: "Naura", dialogText: "Selamat datang.", choices: [{ label: "Lanjut" }] });
  const text = JSON.stringify(payload.components);
  assert.match(text, /attachment:\/\/vn_char_naura_happy\.png/);
  assert.ok(payload.files.some((file) => file.name === "vn_char_naura_happy.png"));
  assert.match(text, /Lanjut/);
});
test("lampiran latar regional memakai nama file yang valid", async () => {
  const payload = await renderer.renderScene({ backgroundId: "desa_sukamaju/kebun_morning", speakerName: "Ningsih", dialogText: "Selamat datang." });
  const serialized = JSON.stringify(payload.components);
  assert.match(serialized, /attachment:\/\/vn_bg_desa_sukamaju_kebun_morning\.png/);
  assert.ok(payload.files.some((file) => file.name === "vn_bg_desa_sukamaju_kebun_morning.png"));
});