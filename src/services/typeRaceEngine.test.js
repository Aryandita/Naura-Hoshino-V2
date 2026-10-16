"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const typeRaceEngine = require("./typeRaceEngine");

test("TypeRaceEngine - Quotes Bank & Random Quote Retrieval", () => {
  const quoteId = typeRaceEngine.getRandomQuote("medium", "id");
  assert.ok(quoteId.quote);
  assert.equal(quoteId.difficulty, "medium");
  assert.equal(quoteId.lang, "id");
  assert.ok(quoteId.quote.length >= 50 && quoteId.quote.length <= 300);

  const quoteEn = typeRaceEngine.getRandomQuote("easy", "en");
  assert.ok(quoteEn.quote);
  assert.equal(quoteEn.difficulty, "easy");
  assert.equal(quoteEn.lang, "en");

  const quoteHard = typeRaceEngine.getRandomQuote("hard", "id");
  assert.ok(quoteHard.quote.length >= 100);

  // Check no em-dash in any quote in QUOTES_BANK
  for (const lang of Object.keys(typeRaceEngine.QUOTES_BANK)) {
    for (const diff of Object.keys(typeRaceEngine.QUOTES_BANK[lang])) {
      for (const q of typeRaceEngine.QUOTES_BANK[lang][diff]) {
        assert.equal(q.includes("\u2014"), false, `Found em-dash in quote: ${q}`);
      }
    }
  }
});

test("TypeRaceEngine - WPM Calculation", () => {
  // 50 characters in 30 seconds (0.5 minutes) = (50 / 5) / 0.5 = 20 WPM
  const wpm = typeRaceEngine.calculateWPM(50, 30);
  assert.equal(wpm, 20);

  // 250 characters in 60 seconds (1 minute) = (250 / 5) / 1 = 50 WPM
  assert.equal(typeRaceEngine.calculateWPM(250, 60), 50);

  // Edge cases
  assert.equal(typeRaceEngine.calculateWPM(0, 30), 0);
  assert.equal(typeRaceEngine.calculateWPM(-10, 30), 0);
});

test("TypeRaceEngine - Accuracy & Levenshtein Distance", () => {
  const target = "Naura Hoshino V2";
  const exact = "Naura Hoshino V2";
  const typo = "Naura Hoshino V1"; // 1 character difference out of 16

  assert.equal(typeRaceEngine.calculateAccuracy(target, exact), 100);

  const accTypo = typeRaceEngine.calculateAccuracy(target, typo);
  assert.ok(accTypo >= 90 && accTypo < 100, `Expected 90 <= accTypo < 100, got ${accTypo}`);

  // Completely wrong text
  const garbage = "ZZZZZZZZZZZZZZZZZZZZ";
  const accGarbage = typeRaceEngine.calculateAccuracy(target, garbage);
  assert.ok(accGarbage < 50);

  // Edge cases
  assert.equal(typeRaceEngine.calculateAccuracy("", "test"), 0);
  assert.equal(typeRaceEngine.calculateAccuracy("test", ""), 0);
});

test("TypeRaceEngine - Net WPM Calculation", () => {
  // 100 WPM with 90% accuracy = 90 net WPM
  assert.equal(typeRaceEngine.calculateNetWPM(100, 90), 90);
  assert.equal(typeRaceEngine.calculateNetWPM(0, 100), 0);
  assert.equal(typeRaceEngine.calculateNetWPM(80, 0), 0);
});

test("TypeRaceEngine - Time Limit Validation", () => {
  assert.equal(typeRaceEngine.isWithinTimeLimit(45, 90), true);
  assert.equal(typeRaceEngine.isWithinTimeLimit(90, 90), true);
  assert.equal(typeRaceEngine.isWithinTimeLimit(91, 90), false);
  assert.equal(typeRaceEngine.isWithinTimeLimit(0, 90), false);
  assert.equal(typeRaceEngine.isWithinTimeLimit(-5, 90), false);
});

test("TypeRaceEngine - Reward Calculation", () => {
  // Case 1: Below 85% accuracy -> Rejected
  const lowAcc = typeRaceEngine.calculateReward({
    wpm: 90,
    accuracy: 80,
    bet: 100,
    isPremium: false,
  });
  assert.equal(lowAcc.success, false);
  assert.equal(lowAcc.payout, 0);

  // Case 2: Above 85% accuracy with bet -> Successful payout
  const withBet = typeRaceEngine.calculateReward({
    wpm: 75,
    accuracy: 98,
    bet: 100,
    isPremium: false,
  });
  assert.equal(withBet.success, true);
  assert.ok(withBet.payout > 100);

  // Case 3: Free play reward (no bet)
  const freePlay = typeRaceEngine.calculateReward({
    wpm: 60,
    accuracy: 95,
    bet: 0,
    isPremium: false,
  });
  assert.equal(freePlay.success, true);
  assert.ok(freePlay.rewardNsf >= 25);
  assert.equal(freePlay.payout, freePlay.rewardNsf);

  // Case 4: Premium multiplier increases free play reward
  const premiumPlay = typeRaceEngine.calculateReward({
    wpm: 60,
    accuracy: 95,
    bet: 0,
    isPremium: true,
  });
  assert.ok(premiumPlay.payout >= freePlay.payout);
});
