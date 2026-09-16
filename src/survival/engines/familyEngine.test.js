"use strict";

const { test, before, after } = require("node:test");
const assert = require("node:assert/strict");

const UserNPC = require("../../models/UserNPC");
const {
  ROMANCEABLE_FEMALES,
  SPOUSAL_DATA,
  getMarriageStatus,
  marryNpc,
  triggerParenthood,
  isCgUnlocked,
  unlockCg,
} = require("./familyEngine");

let origFindAll;
let origFindOrCreate;

before(() => {
  origFindAll = UserNPC.findAll;
  origFindOrCreate = UserNPC.findOrCreate;
  UserNPC.findAll = async () => [];
  UserNPC.findOrCreate = async () => [
    {
      relationshipLevel: 3,
      affection: 350,
      save: async () => {},
    },
    false,
  ];
});

after(() => {
  UserNPC.findAll = origFindAll;
  UserNPC.findOrCreate = origFindOrCreate;
});

test("Daftar 10 wanita yang dapat dinikahi terdaftar lengkap", () => {
  assert.equal(ROMANCEABLE_FEMALES.length, 10);
  assert.ok(ROMANCEABLE_FEMALES.includes("ningsih"));
  assert.ok(ROMANCEABLE_FEMALES.includes("wulan"));
  assert.ok(ROMANCEABLE_FEMALES.includes("bidan_sari"));
  assert.ok(ROMANCEABLE_FEMALES.includes("bu_ratna"));
  assert.ok(ROMANCEABLE_FEMALES.includes("tari"));
  assert.ok(ROMANCEABLE_FEMALES.includes("mbak_siti"));
  assert.ok(ROMANCEABLE_FEMALES.includes("laras"));
  assert.ok(ROMANCEABLE_FEMALES.includes("suster_maya"));
  assert.ok(ROMANCEABLE_FEMALES.includes("mbak_rini"));
  assert.ok(ROMANCEABLE_FEMALES.includes("shino_hoshino"));
});

test("SPOUSAL_DATA mendefinisikan janji suci dan sarapan untuk semua wanita romansa", () => {
  for (const femaleId of ROMANCEABLE_FEMALES) {
    const data = SPOUSAL_DATA[femaleId];
    assert.ok(data, `Data spousal untuk ${femaleId} harus ada`);
    assert.ok(data.vow.length > 0, `Janji pernikahan ${femaleId} tidak boleh kosong`);
    assert.ok(data.breakfast.length > 0, `Menu sarapan ${femaleId} tidak boleh kosong`);
    assert.ok(data.restoreHp > 0);
  }
});

test("getMarriageStatus mendeteksi pemain yang belum menikah", async () => {
  const survival = { rpg_state: {} };
  const status = await getMarriageStatus("dummy_user_1", survival);
  assert.equal(status.isMarried, false);
  assert.equal(status.spouseId, null);
});

test("getMarriageStatus mendeteksi pasangan jika pemain telah menikah", async () => {
  const survival = {
    rpg_state: {
      married_to: "wulan",
      married_at: new Date().toISOString(),
    },
  };
  const status = await getMarriageStatus("dummy_user_2", survival);
  assert.equal(status.isMarried, true);
  assert.equal(status.spouseId, "wulan");
  assert.equal(status.spouseName, "Wulan");
});

test("marryNpc menolak pernikahan jika NPC bukan wanita romansa", async () => {
  const survival = { rpg_state: {} };
  const result = await marryNpc("dummy_user_3", survival, "kades_tirto");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_romanceable");
});

test("ATURAN KETAT MONOGAMI: Pemain yang sudah menikah ditolak saat mencoba menikahi wanita lain", async () => {
  const survival = {
    rpg_state: {
      married_to: "ningsih",
      married_at: new Date().toISOString(),
    },
  };

  // Mencoba menikahi Wulan padahal sudah beristri Ningsih
  const result = await marryNpc("dummy_user_4", survival, "wulan");
  assert.equal(result.ok, false);
  assert.equal(result.reason, "already_married");
  assert.ok(result.spouseName.includes("Ningsih"));
});

test("triggerParenthood menolak jika pemain belum memiliki ikatan pernikahan", async () => {
  const survival = { rpg_state: {} };
  const result = await triggerParenthood("dummy_user_5", survival);
  assert.equal(result.ok, false);
  assert.equal(result.reason, "not_married");
});

test("triggerParenthood berhasil memicu kelahiran anak dan membuka Family CG bila sudah menikah", async () => {
  const survival = {
    rpg_state: {
      married_to: "ningsih",
      unlocked_cgs: ["wedding_ningsih"],
    },
  };

  const result = await triggerParenthood("dummy_user_6", survival, "Bintang Hoshino");
  assert.equal(result.ok, true);
  assert.equal(result.cgId, "family_ningsih");
  assert.equal(survival.rpg_state.has_child, true);
  assert.equal(survival.rpg_state.child_name, "Bintang Hoshino");
  assert.ok(isCgUnlocked(survival, "family_ningsih"));
});

test("KEAMANAN GALERI CG: isCgUnlocked dan unlockCg menjaga privasi album kenangan", async () => {
  const survival = {
    rpg_state: {
      unlocked_cgs: ["date_ningsih", "wedding_ningsih"],
    },
  };

  // CG yang sah dimiliki terbuka
  assert.equal(isCgUnlocked(survival, "date_ningsih"), true);
  assert.equal(isCgUnlocked(survival, "wedding_ningsih"), true);

  // CG yang belum pernah didapat terkunci rapat
  assert.equal(isCgUnlocked(survival, "wedding_wulan"), false);
  assert.equal(isCgUnlocked(survival, "family_ningsih"), false);

  // Membuka CG baru
  await unlockCg(survival, "family_ningsih");
  assert.equal(isCgUnlocked(survival, "family_ningsih"), true);
});
