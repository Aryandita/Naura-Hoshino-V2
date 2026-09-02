"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const worldEvent = require("./worldEventEngine");

test("worldEventEngine - getActiveEvent detection on Independence Day", () => {
  const independenceDate = new Date("2026-08-17T10:00:00Z");
  const event = worldEvent.getActiveEvent(independenceDate);

  assert.ok(event !== null);
  assert.strictEqual(event.id, "independence_day");
  assert.strictEqual(event.dropBoost, 1.5);
  assert.strictEqual(event.exclusiveItem, "bendera_merah_putih");
});

test("worldEventEngine - getActiveEvent detection on Naura Birthday", () => {
  const birthdayDate = new Date("2026-06-12T12:00:00Z");
  const event = worldEvent.getActiveEvent(birthdayDate);

  assert.ok(event !== null);
  assert.strictEqual(event.id, "naura_birthday");
  assert.strictEqual(event.dropBoost, 2.0);
});

test("worldEventEngine - applyEventBonuses scaling", () => {
  const mockEvent = {
    dropBoost: 1.5,
    salaryBoost: 1.25,
  };

  const boostedDrop = worldEvent.applyEventBonuses(100, mockEvent, "drop");
  assert.strictEqual(boostedDrop, 150);

  const boostedSalary = worldEvent.applyEventBonuses(200, mockEvent, "salary");
  assert.strictEqual(boostedSalary, 250);

  const fallback = worldEvent.applyEventBonuses(100, null);
  assert.strictEqual(fallback, 100);
});
