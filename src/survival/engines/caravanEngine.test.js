"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const CaravanEngine = require("./caravanEngine");

test("CaravanEngine - Mercenary Roster & Expedition Modes", () => {
  const roster = CaravanEngine.getMercenaryRoster();
  assert.ok(roster.rookie);
  assert.ok(roster.veteran);
  assert.ok(roster.elite_cyber);
  assert.equal(roster.rookie.cost, 150);
  assert.equal(roster.veteran.ambushMitigation, 25);
  assert.equal(roster.elite_cyber.defenseBonus, 650);

  const modes = CaravanEngine.getExpeditionModes();
  assert.ok(modes.standard);
  assert.ok(modes.high_risk_heist);
  assert.ok(modes.void_chasm);
  assert.equal(modes.standard.riskPercent, 15);
  assert.equal(modes.high_risk_heist.profitMultiplier, 2.5);
  assert.equal(modes.void_chasm.riskPercent, 75);
});

test("CaravanEngine - calculateCaravanRisk without and with mercenaries", () => {
  const standardRisk = CaravanEngine.calculateCaravanRisk("standard");
  assert.equal(standardRisk.baseRisk, 15);
  assert.equal(standardRisk.finalRisk, 15);
  assert.equal(standardRisk.mitigation, 0);

  const heistWithVeteran = CaravanEngine.calculateCaravanRisk(
    "high_risk_heist",
    "veteran",
  );
  assert.equal(heistWithVeteran.baseRisk, 50);
  assert.equal(heistWithVeteran.mitigation, 25);
  assert.equal(heistWithVeteran.finalRisk, 25);

  const voidWithElite = CaravanEngine.calculateCaravanRisk(
    "void_chasm",
    "elite_cyber",
  );
  assert.equal(voidWithElite.baseRisk, 75);
  assert.equal(voidWithElite.mitigation, 45);
  assert.equal(voidWithElite.finalRisk, 30);
});

test("CaravanEngine - resolveAmbush mechanics", () => {
  // Deterministic roll where ambush does NOT occur (roll 50 >= finalRisk 15)
  const peaceful = CaravanEngine.resolveAmbush({
    modeKey: "standard",
    customRoll: 50,
  });
  assert.equal(peaceful.wasAmbushed, false);
  assert.equal(peaceful.survived, true);
  assert.equal(peaceful.lootLossPercent, 0);

  // Deterministic roll where ambush DOES occur (roll 5 < finalRisk 15)
  const ambushed = CaravanEngine.resolveAmbush({
    modeKey: "standard",
    customRoll: 5,
  });
  assert.equal(ambushed.wasAmbushed, true);
  assert.ok(ambushed.lootLossPercent === 25 || ambushed.lootLossPercent === 70);
});

test("CaravanEngine - calculatePayout with standard and high-risk modes", () => {
  const peacefulResult = { wasAmbushed: false, lootLossPercent: 0 };
  const standardPayout = CaravanEngine.calculatePayout(
    1000,
    "standard",
    peacefulResult,
  );
  assert.equal(standardPayout.grossProfit, 1350);
  assert.equal(standardPayout.netPayout, 1350);
  assert.equal(standardPayout.penalty, 0);

  const heistPayout = CaravanEngine.calculatePayout(
    1000,
    "high_risk_heist",
    peacefulResult,
  );
  assert.equal(heistPayout.grossProfit, 2500);
  assert.equal(heistPayout.netPayout, 2500);

  const ambushedResult = { wasAmbushed: true, lootLossPercent: 25 };
  const ambushedPayout = CaravanEngine.calculatePayout(
    1000,
    "high_risk_heist",
    ambushedResult,
  );
  assert.equal(ambushedPayout.grossProfit, 2500);
  assert.equal(ambushedPayout.penalty, 625);
  assert.equal(ambushedPayout.netPayout, 1875);
});
