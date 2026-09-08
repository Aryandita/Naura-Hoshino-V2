"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const tribunalEngine = require("./tribunalEngine");

test("TribunalEngine - Procedural Fallback Verification", async () => {
  const trial = await tribunalEngine.conductTrial({
    plaintiffName: "Arya",
    defendantName: "Bagas",
    allegation: "Mencuri potongan pizza terakhir di kafe",
    evidenceText: "Bukti foto CCTV",
  });

  assert.equal(trial.success, true);
  assert.ok(trial.prosecutor, "Harus ada argumen jaksa");
  assert.ok(trial.defense, "Harus ada argumen pembela");
  assert.ok(trial.judge, "Harus ada vonis hakim");
  assert.ok(
    ["GUILTY", "NOT_GUILTY", "SETTLEMENT"].includes(trial.verdictStatus),
  );
  assert.ok(trial.penalty, "Harus ada sanksi atau ketetapan");
});

test("TribunalEngine - Validates Missing Inputs", async () => {
  const trial = await tribunalEngine.conductTrial({
    plaintiffName: "",
    defendantName: "Bagas",
    allegation: "",
  });

  assert.equal(trial.success, false);
  assert.equal(trial.reason, "MISSING_TRIAL_DATA");
});
