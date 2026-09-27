"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { evaluateMilestoneRoles } = require("./roleSyncService");

describe("RoleSyncService - Milestone Evaluation Math", () => {
  const sampleRules = [
    { type: "level", threshold: 5, roleId: "role_lv5" },
    { type: "level", threshold: 10, roleId: "role_lv10" },
    { type: "survival_level", threshold: 15, roleId: "role_surv15" },
    { type: "wealth", threshold: 100000, roleId: "role_tycoon" },
    { type: "fragments", threshold: 5000, roleId: "role_star_collector" },
  ];

  it("memberikan role level yang sesuai saat threshold terlampaui", () => {
    const stats = { level: 7, survival_level: 2, wealth: 500, fragments: 100 };
    const earned = evaluateMilestoneRoles(sampleRules, stats);

    assert.ok(earned.includes("role_lv5"));
    assert.strictEqual(earned.includes("role_lv10"), false);
    assert.strictEqual(earned.includes("role_surv15"), false);
  });

  it("mengakumulasikan beberapa role milestone sekaligus bila stats tinggi", () => {
    const stats = {
      level: 12,
      survival_level: 20,
      wealth: 250000,
      fragments: 10000,
    };
    const earned = evaluateMilestoneRoles(sampleRules, stats);

    assert.strictEqual(earned.length, 5);
    assert.ok(earned.includes("role_lv5"));
    assert.ok(earned.includes("role_lv10"));
    assert.ok(earned.includes("role_surv15"));
    assert.ok(earned.includes("role_tycoon"));
    assert.ok(earned.includes("role_star_collector"));
  });

  it("mengembalikan array kosong jika tidak ada aturan atau stats tidak memenuhi syarat", () => {
    const stats = { level: 1, survival_level: 1, wealth: 0, fragments: 0 };
    const earned = evaluateMilestoneRoles(sampleRules, stats);
    assert.deepStrictEqual(earned, []);

    const emptyRules = evaluateMilestoneRoles([], { level: 100 });
    assert.deepStrictEqual(emptyRules, []);
  });
});
