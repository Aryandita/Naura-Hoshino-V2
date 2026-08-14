"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { msToTime } = require("./time");

test("msToTime formats milliseconds to human readable string", () => {
  assert.equal(msToTime(500), "Baru saja mulai ✨");
  assert.equal(msToTime(1000), "1s");
  assert.equal(msToTime(65000), "1m 5s");
  assert.equal(msToTime(3665000), "1h 1m 5s");
  assert.equal(msToTime(90065000), "1d 1h 1m 5s");
});
