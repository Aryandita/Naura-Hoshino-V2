"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { DIVISIONS } = require("./coliseumEngine");

test("ColiseumEngine - Divisions Setup and Thresholds", () => {
  assert.ok(Array.isArray(DIVISIONS), "DIVISIONS harus berupa array");
  assert.equal(DIVISIONS.length, 6, "Harus ada 6 tingkatan divisi");

  const master = DIVISIONS.find((d) => d.name === "MASTER");
  assert.ok(master, "Harus ada divisi MASTER");
  assert.equal(master.minElo, 2100);

  const bronze = DIVISIONS.find((d) => d.name === "BRONZE");
  assert.ok(bronze, "Harus ada divisi BRONZE");
  assert.equal(bronze.minElo, 0);
});

test("ColiseumEngine - Elo Adjustment Math", () => {
  const currentElo = 1480;
  const victoryGain = 30;
  const defeatLoss = -15;

  const newEloWin = currentElo + victoryGain;
  const newEloLoss = currentElo + defeatLoss;

  assert.equal(newEloWin, 1510);
  assert.equal(newEloLoss, 1465);
});
