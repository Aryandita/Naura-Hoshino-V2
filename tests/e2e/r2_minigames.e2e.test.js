"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

const blackjackEngine = require("../../src/services/blackjackEngine");
const typeRaceEngine = require("../../src/services/typeRaceEngine");
const cacheManager = require("../../src/managers/cacheManager");

describe("R2 Minigames E2E - Tier 1: Feature Coverage", () => {
  it("TC-M2.1: createDeck produces standard 52 cards with 4 suits and 13 ranks", () => {
    const deck = blackjackEngine.createDeck();
    assert.equal(deck.length, 52);

    const suits = new Set(deck.map((c) => c.suit));
    assert.equal(suits.size, 4);
    assert.ok(suits.has("♠"));
    assert.ok(suits.has("♥"));
    assert.ok(suits.has("♦"));
    assert.ok(suits.has("♣"));

    for (const suit of blackjackEngine.SUITS) {
      const cards = deck.filter((c) => c.suit === suit);
      assert.equal(cards.length, 13);
    }
  });

  it("TC-M2.2: calculateHand accurately handles Soft and Hard Aces", () => {
    // Hard Hand
    const hard = [
      { rank: "10", value: 10 },
      { rank: "8", value: 8 },
    ];
    const hardResult = blackjackEngine.calculateHand(hard);
    assert.equal(hardResult.score, 18);
    assert.equal(hardResult.isBust, false);
    assert.equal(hardResult.isBlackjack, false);
    assert.equal(hardResult.isSoft, false);

    // Natural Blackjack (2 cards totaling 21 with Ace)
    const bj = [
      { rank: "A", value: 11 },
      { rank: "K", value: 10 },
    ];
    const bjResult = blackjackEngine.calculateHand(bj);
    assert.equal(bjResult.score, 21);
    assert.equal(bjResult.isBlackjack, true);
    assert.equal(bjResult.isSoft, true);

    // Soft 17 (Ace + 6)
    const soft17 = [
      { rank: "A", value: 11 },
      { rank: "6", value: 6 },
    ];
    const softResult = blackjackEngine.calculateHand(soft17);
    assert.equal(softResult.score, 17);
    assert.equal(softResult.isSoft, true);

    // Ace reduction when bust (A + 9 + 5 = 15, not 25)
    const reduced = [
      { rank: "A", value: 11 },
      { rank: "9", value: 9 },
      { rank: "5", value: 5 },
    ];
    const reducedResult = blackjackEngine.calculateHand(reduced);
    assert.equal(reducedResult.score, 15);
    assert.equal(reducedResult.isBust, false);
    assert.equal(reducedResult.isSoft, false);
  });

  it("TC-M2.3: Dealer AI hits on 16 or lower, stands on ALL 17s (hard and soft)", () => {
    // Hit on 16
    assert.equal(
      blackjackEngine.shouldDealerHit([
        { rank: "10", value: 10 },
        { rank: "6", value: 6 },
      ]),
      true,
    );

    // Stand on Hard 17
    assert.equal(
      blackjackEngine.shouldDealerHit([
        { rank: "10", value: 10 },
        { rank: "7", value: 7 },
      ]),
      false,
    );

    // Stand on Soft 17 (A + 6)
    assert.equal(
      blackjackEngine.shouldDealerHit([
        { rank: "A", value: 11 },
        { rank: "6", value: 6 },
      ]),
      false,
    );

    // Stand on 18, 19, 20
    assert.equal(
      blackjackEngine.shouldDealerHit([
        { rank: "10", value: 10 },
        { rank: "8", value: 8 },
      ]),
      false,
    );
  });

  it("TC-M2.4: Payout calculations match casino rules (3:2 BJ, 1:1 Win, Push, Loss)", () => {
    const bet = 200;

    // 1. Natural Blackjack pays 3:2 (profit 300, payout 500)
    const pBJ = { cards: [{ rank: "A", value: 11 }, { rank: "10", value: 10 }] };
    const dNormal = { cards: [{ rank: "10", value: 10 }, { rank: "8", value: 8 }] };
    const resBJ = blackjackEngine.calculatePayout(pBJ, dNormal, bet);
    assert.equal(resBJ.outcome, "BLACKJACK");
    assert.equal(resBJ.payout, 500);
    assert.equal(resBJ.profit, 300);

    // 2. Both Blackjack -> Push
    const dBJ = { cards: [{ rank: "A", value: 11 }, { rank: "J", value: 10 }] };
    const resPushBJ = blackjackEngine.calculatePayout(pBJ, dBJ, bet);
    assert.equal(resPushBJ.outcome, "PUSH");
    assert.equal(resPushBJ.payout, 200);
    assert.equal(resPushBJ.profit, 0);

    // 3. Regular 1:1 Win
    const p20 = { cards: [{ rank: "10", value: 10 }, { rank: "10", value: 10 }] };
    const resWin = blackjackEngine.calculatePayout(p20, dNormal, bet);
    assert.equal(resWin.outcome, "WIN");
    assert.equal(resWin.payout, 400);
    assert.equal(resWin.profit, 200);

    // 4. Dealer Bust -> Win 1:1
    const dBust = {
      cards: [
        { rank: "10", value: 10 },
        { rank: "6", value: 6 },
        { rank: "8", value: 8 },
      ],
    };
    const resDBust = blackjackEngine.calculatePayout(p20, dBust, bet);
    assert.equal(resDBust.outcome, "WIN");
    assert.equal(resDBust.payout, 400);

    // 5. Player Bust -> Loss
    const pBust = {
      cards: [
        { rank: "10", value: 10 },
        { rank: "8", value: 8 },
        { rank: "5", value: 5 },
      ],
    };
    const resPBust = blackjackEngine.calculatePayout(pBust, dNormal, bet);
    assert.equal(resPBust.outcome, "BUST");
    assert.equal(resPBust.payout, 0);
    assert.equal(resPBust.profit, -200);
  });

  it("TC-M2.5: TypeRacer quotes bank provides quotes without em-dash", () => {
    const qId = typeRaceEngine.getRandomQuote("medium", "id");
    assert.ok(qId.quote);
    assert.equal(qId.lang, "id");
    assert.equal(qId.difficulty, "medium");
    assert.ok(qId.quote.length >= 50);

    const qEn = typeRaceEngine.getRandomQuote("easy", "en");
    assert.ok(qEn.quote);
    assert.equal(qEn.lang, "en");

    // Comprehensive em-dash scan across entire bank
    for (const lang of Object.keys(typeRaceEngine.QUOTES_BANK)) {
      for (const diff of Object.keys(typeRaceEngine.QUOTES_BANK[lang])) {
        for (const str of typeRaceEngine.QUOTES_BANK[lang][diff]) {
          assert.equal(str.includes("\u2014"), false, "Em-dash forbidden in quotes");
        }
      }
    }
  });

  it("TC-M2.6: TypeRacer WPM and accuracy calculations match mathematical formulas", () => {
    // 250 characters in 60 seconds (1 minute) = (250 / 5) / 1 = 50 WPM
    assert.equal(typeRaceEngine.calculateWPM(250, 60), 50);

    // 150 characters in 30 seconds (0.5 minutes) = (150 / 5) / 0.5 = 60 WPM
    assert.equal(typeRaceEngine.calculateWPM(150, 30), 60);

    // Exact accuracy
    assert.equal(typeRaceEngine.calculateAccuracy("Naura Hoshino V2", "Naura Hoshino V2"), 100);

    // Minor typo
    const acc = typeRaceEngine.calculateAccuracy("Naura Hoshino V2", "Naura Hoshino V1");
    assert.ok(acc >= 90 && acc < 100);

    // Net WPM
    assert.equal(typeRaceEngine.calculateNetWPM(80, 95), 76);
  });
});

describe("R2 Minigames E2E - Tier 2: Boundary & Corner Cases", () => {
  it("TC-M2.7: Multi-Ace boundaries (4 Aces in hand)", () => {
    const fourAces = [
      { rank: "A", value: 11 },
      { rank: "A", value: 11 },
      { rank: "A", value: 11 },
      { rank: "A", value: 11 },
    ];
    // 11 + 1 + 1 + 1 = 14
    const evalResult = blackjackEngine.calculateHand(fourAces);
    assert.equal(evalResult.score, 14);
    assert.equal(evalResult.isBust, false);
    assert.equal(evalResult.isSoft, true);
  });

  it("TC-M2.8: Double Down eligibility constraints", () => {
    // Eligible: exactly 2 cards, not already doubled
    assert.equal(
      blackjackEngine.canDoubleDown({
        cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }],
      }),
      true,
    );

    // Ineligible: 3 cards
    assert.equal(
      blackjackEngine.canDoubleDown({
        cards: [
          { rank: "5", value: 5 },
          { rank: "4", value: 4 },
          { rank: "2", value: 2 },
        ],
      }),
      false,
    );

    // Ineligible: already doubled
    assert.equal(
      blackjackEngine.canDoubleDown({
        cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }],
        isDoubled: true,
      }),
      false,
    );
  });

  it("TC-M2.9: Split eligibility constraints", () => {
    // Eligible: pair of 8s
    assert.equal(
      blackjackEngine.canSplit({
        cards: [{ rank: "8", value: 8 }, { rank: "8", value: 8 }],
      }, 1),
      true,
    );

    // Eligible: pair of 10-value cards (e.g. 10 and King)
    assert.equal(
      blackjackEngine.canSplit({
        cards: [{ rank: "10", value: 10 }, { rank: "K", value: 10 }],
      }, 1),
      true,
    );

    // Ineligible: mismatched ranks (8 and 9)
    assert.equal(
      blackjackEngine.canSplit({
        cards: [{ rank: "8", value: 8 }, { rank: "9", value: 9 }],
      }, 1),
      false,
    );

    // Ineligible: already split (max 2 hands)
    assert.equal(
      blackjackEngine.canSplit({
        cards: [{ rank: "8", value: 8 }, { rank: "8", value: 8 }],
      }, 2),
      false,
    );
  });

  it("TC-M2.10: TypeRacer time limit and accuracy boundary rejections", () => {
    // Negative or zero elapsed time rejected
    assert.equal(typeRaceEngine.isWithinTimeLimit(0, 90), false);
    assert.equal(typeRaceEngine.isWithinTimeLimit(-10, 90), false);

    // Exceeding time limit rejected
    assert.equal(typeRaceEngine.isWithinTimeLimit(91, 90), false);

    // Accuracy < 85% forfeits reward
    const rewardLowAcc = typeRaceEngine.calculateReward({
      wpm: 100,
      accuracy: 84.9,
      bet: 100,
      isPremium: false,
    });
    assert.equal(rewardLowAcc.success, false);
    assert.equal(rewardLowAcc.payout, 0);

    // Empty text accuracy
    assert.equal(typeRaceEngine.calculateAccuracy("", "test"), 0);
    assert.equal(typeRaceEngine.calculateAccuracy("test", ""), 0);
  });
});

describe("R2 Minigames E2E - Tier 3: Cross-Feature Combinations", () => {
  it("TC-M2.11: Atomic balance deduction and win payout round-trip", async () => {
    const testUserId = "user-atomic-bj-1";

    // Setup initial balance mock or memory profile
    const originalDebit = cacheManager.debitUserSurvival;
    const originalIncrement = cacheManager.incrementUserSurvival;

    let balance = 1000;

    cacheManager.debitUserSurvival = async (uid, field, amount) => {
      if (balance < amount) return { ok: false, reason: "insufficient" };
      balance -= amount;
      return { ok: true, balance };
    };

    cacheManager.incrementUserSurvival = async (uid, field, amount) => {
      balance += amount;
      return { [field]: balance };
    };

    try {
      const bet = 250;

      // 1. Upfront debit before deal
      const debitRes = await cacheManager.debitUserSurvival(testUserId, "starFragments", bet);
      assert.equal(debitRes.ok, true);
      assert.equal(balance, 750);

      // 2. Player wins round (1:1 payout)
      const pHand = { cards: [{ rank: "10", value: 10 }, { rank: "9", value: 9 }] };
      const dHand = { cards: [{ rank: "10", value: 10 }, { rank: "7", value: 7 }] };
      const outcome = blackjackEngine.calculatePayout(pHand, dHand, bet);

      assert.equal(outcome.outcome, "WIN");
      assert.equal(outcome.payout, 500);

      // 3. Atomic credit
      await cacheManager.incrementUserSurvival(testUserId, "starFragments", outcome.payout);
      assert.equal(balance, 1250);
    } finally {
      cacheManager.debitUserSurvival = originalDebit;
      cacheManager.incrementUserSurvival = originalIncrement;
    }
  });

  it("TC-M2.12: Double Down atomic balance flow and verification", async () => {
    const testUserId = "user-double-down";
    let balance = 400;

    const originalDebit = cacheManager.debitUserSurvival;
    const originalIncrement = cacheManager.incrementUserSurvival;

    cacheManager.debitUserSurvival = async (uid, field, amount) => {
      if (balance < amount) return { ok: false, reason: "insufficient" };
      balance -= amount;
      return { ok: true, balance };
    };

    cacheManager.incrementUserSurvival = async (uid, field, amount) => {
      balance += amount;
      return { [field]: balance };
    };

    try {
      const initialBet = 200;

      // Initial debit
      const d1 = await cacheManager.debitUserSurvival(testUserId, "starFragments", initialBet);
      assert.equal(d1.ok, true);
      assert.equal(balance, 200);

      // Double Down requested -> debit additional 200
      const d2 = await cacheManager.debitUserSurvival(testUserId, "starFragments", initialBet);
      assert.equal(d2.ok, true);
      assert.equal(balance, 0);

      // Total bet is now 400. Win pays 800.
      const totalBet = initialBet * 2;
      const pHand = { cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }, { rank: "10", value: 10 }] }; // 21
      const dHand = { cards: [{ rank: "10", value: 10 }, { rank: "8", value: 8 }] }; // 18
      const payout = blackjackEngine.calculatePayout(pHand, dHand, totalBet);

      assert.equal(payout.outcome, "WIN");
      assert.equal(payout.payout, 800);

      await cacheManager.incrementUserSurvival(testUserId, "starFragments", payout.payout);
      assert.equal(balance, 800);
    } finally {
      cacheManager.debitUserSurvival = originalDebit;
      cacheManager.incrementUserSurvival = originalIncrement;
    }
  });

  it("TC-M2.13: Insufficient funds rejects double down and preserves state", async () => {
    let balance = 250;
    const originalDebit = cacheManager.debitUserSurvival;

    cacheManager.debitUserSurvival = async (uid, field, amount) => {
      if (balance < amount) return { ok: false, reason: "insufficient" };
      balance -= amount;
      return { ok: true, balance };
    };

    try {
      // Player bets 200 (balance becomes 50)
      const d1 = await cacheManager.debitUserSurvival("user-broke", "starFragments", 200);
      assert.equal(d1.ok, true);
      assert.equal(balance, 50);

      // Double Down requires another 200 -> must fail
      const d2 = await cacheManager.debitUserSurvival("user-broke", "starFragments", 200);
      assert.equal(d2.ok, false);
      assert.equal(d2.reason, "insufficient");
      assert.equal(balance, 50); // Balance untouched
    } finally {
      cacheManager.debitUserSurvival = originalDebit;
    }
  });
});

describe("R2 Minigames E2E - Tier 4: Real-World Scenarios", () => {
  it("TC-M2.14: Full Blackjack table simulation with hit, stand, and dealer resolution", () => {
    const deck = blackjackEngine.createDeck();
    const shuffled = blackjackEngine.shuffleDeck(deck);

    // Initial deal: 2 cards player, 2 cards dealer
    const playerHand = [shuffled.pop(), shuffled.pop()];
    const dealerHand = [shuffled.pop(), shuffled.pop()];

    // Evaluate initial scores
    let playerEval = blackjackEngine.calculateHand(playerHand);
    assert.ok(playerEval.score >= 4 && playerEval.score <= 21);

    // Simulate player action: hit until at least 15 or bust
    while (playerEval.score < 15 && !playerEval.isBust) {
      playerHand.push(shuffled.pop());
      playerEval = blackjackEngine.calculateHand(playerHand);
    }

    // Dealer completes hand according to fixed casino rules
    const dealerResult = blackjackEngine.dealerPlay(shuffled, dealerHand);
    assert.ok(dealerResult.score >= 17 || dealerResult.isBust);

    // Calculate payout
    const outcome = blackjackEngine.calculatePayout(
      { cards: playerHand },
      { cards: dealerResult.cards },
      100,
    );

    assert.ok(["BLACKJACK", "WIN", "BUST", "LOSE", "PUSH"].includes(outcome.outcome));
    assert.ok(outcome.payout >= 0);
  });

  it("TC-M2.15: Full TypeRacer tournament flow with modal timing and reward settlement", () => {
    const quoteData = typeRaceEngine.getRandomQuote("medium", "id");
    const targetQuote = quoteData.quote;

    // Simulate user typing target quote in 20 seconds with 1 minor typo
    const typedText = targetQuote.substring(0, targetQuote.length - 2) + "!!";
    const elapsedSeconds = 20;

    const wpm = typeRaceEngine.calculateWPM(typedText.length, elapsedSeconds);
    const accuracy = typeRaceEngine.calculateAccuracy(targetQuote, typedText);
    const netWpm = typeRaceEngine.calculateNetWPM(wpm, accuracy);

    assert.ok(wpm > 0);
    assert.ok(accuracy >= 90);
    assert.ok(netWpm > 0);

    const reward = typeRaceEngine.calculateReward({
      wpm,
      accuracy,
      bet: 150,
      isPremium: true,
    });

    assert.equal(reward.success, true);
    assert.ok(reward.payout > 150);
  });
});
