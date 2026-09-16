"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const economyBatchService = require("./economyBatchService");

test("economyBatchService: previewBatch correctly calculates currency totals", () => {
  const csvData =
    "Discord_ID,Jumlah,Mata_Uang,Catatan\n" +
    "123456789,100,starFragments,Pemenang 1\n" +
    "234567890,50,coins,Pemenang 2\n" +
    "345678901,5,coupons,Pemenang 3\n" +
    "456789012,200,nsf,Pemenang 4\n";

  const preview = economyBatchService.previewBatch(csvData);

  assert.equal(preview.validRows.length, 4);
  assert.equal(preview.totals.starFragments, 300); // 100 + 200
  assert.equal(preview.totals.coins, 50);
  assert.equal(preview.totals.coupons, 5);
  assert.equal(preview.invalidCount, 0);
});
