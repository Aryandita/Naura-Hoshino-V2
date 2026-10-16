"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const blackjackEngine = require("./blackjackEngine");

test("BlackjackEngine - Deck Creation & 52-Card Standard", () => {
  const deck = blackjackEngine.createDeck();
  assert.equal(deck.length, 52);

  const suits = new Set(deck.map((c) => c.suit));
  assert.equal(suits.size, 4);
  assert.ok(suits.has("♠"));
  assert.ok(suits.has("♥"));
  assert.ok(suits.has("♦"));
  assert.ok(suits.has("♣"));

  for (const suit of blackjackEngine.SUITS) {
    const cardsInSuit = deck.filter((c) => c.suit === suit);
    assert.equal(cardsInSuit.length, 13);
  }

  // Shuffle test
  const shuffled = blackjackEngine.shuffleDeck(deck);
  assert.equal(shuffled.length, 52);
});

test("BlackjackEngine - Hand Evaluation with Soft & Hard Aces", () => {
  // Hard Hand
  const hardHand = [
    { rank: "10", value: 10 },
    { rank: "7", value: 7 },
  ];
  const evalHard = blackjackEngine.calculateHand(hardHand);
  assert.equal(evalHard.score, 17);
  assert.equal(evalHard.isBust, false);
  assert.equal(evalHard.isBlackjack, false);
  assert.equal(evalHard.isSoft, false);

  // Natural Blackjack (A + 10)
  const bjHand = [
    { rank: "A", value: 11 },
    { rank: "K", value: 10 },
  ];
  const evalBJ = blackjackEngine.calculateHand(bjHand);
  assert.equal(evalBJ.score, 21);
  assert.equal(evalBJ.isBlackjack, true);
  assert.equal(evalBJ.isBust, false);
  assert.equal(evalBJ.isSoft, true);

  // Soft Ace Hand (A + 6 = 17 soft)
  const soft17 = [
    { rank: "A", value: 11 },
    { rank: "6", value: 6 },
  ];
  const evalSoft17 = blackjackEngine.calculateHand(soft17);
  assert.equal(evalSoft17.score, 17);
  assert.equal(evalSoft17.isSoft, true);

  // Ace Reduction (A + 8 + 5 = 14, not 24)
  const aceReduction = [
    { rank: "A", value: 11 },
    { rank: "8", value: 8 },
    { rank: "5", value: 5 },
  ];
  const evalReduction = blackjackEngine.calculateHand(aceReduction);
  assert.equal(evalReduction.score, 14);
  assert.equal(evalReduction.isBust, false);
  assert.equal(evalReduction.isSoft, false);

  // Multiple Aces (A + A + 9 = 21: 11 + 1 + 9)
  const multiAces = [
    { rank: "A", value: 11 },
    { rank: "A", value: 11 },
    { rank: "9", value: 9 },
  ];
  const evalMulti = blackjackEngine.calculateHand(multiAces);
  assert.equal(evalMulti.score, 21);
  assert.equal(evalMulti.isBust, false);
  assert.equal(evalMulti.isBlackjack, false); // 3 cards is not natural blackjack

  // Bust Hand
  const bustHand = [
    { rank: "10", value: 10 },
    { rank: "9", value: 9 },
    { rank: "8", value: 8 },
  ];
  const evalBust = blackjackEngine.calculateHand(bustHand);
  assert.equal(evalBust.score, 27);
  assert.equal(evalBust.isBust, true);
});

test("BlackjackEngine - Dealer Rules: Stand on All 17s (Hard and Soft)", () => {
  // Dealer hits on 16
  const hand16 = [
    { rank: "10", value: 10 },
    { rank: "6", value: 6 },
  ];
  assert.equal(blackjackEngine.shouldDealerHit(hand16), true);

  // Dealer stands on Hard 17
  const handHard17 = [
    { rank: "10", value: 10 },
    { rank: "7", value: 7 },
  ];
  assert.equal(blackjackEngine.shouldDealerHit(handHard17), false);

  // Dealer stands on Soft 17 (A + 6)
  const handSoft17 = [
    { rank: "A", value: 11 },
    { rank: "6", value: 6 },
  ];
  assert.equal(blackjackEngine.shouldDealerHit(handSoft17), false);

  // Dealer stands on 18
  const hand18 = [
    { rank: "10", value: 10 },
    { rank: "8", value: 8 },
  ];
  assert.equal(blackjackEngine.shouldDealerHit(hand18), false);

  // Dealer does not hit if bust
  const handBust = [
    { rank: "10", value: 10 },
    { rank: "10", value: 10 },
    { rank: "5", value: 5 },
  ];
  assert.equal(blackjackEngine.shouldDealerHit(handBust), false);
});

test("BlackjackEngine - Dealer Play Simulation", () => {
  // Deterministic deck for dealer
  const mockDeck = [
    { suit: "♠", rank: "4", value: 4 }, // Drawn first (pop)
    { suit: "♠", rank: "10", value: 10 },
  ];
  // Dealer initial: 7 + 5 = 12. Hits: draws 10 (score 22 -> bust? wait, pop order: 10 then 4)
  const dealerInitial = [
    { suit: "♥", rank: "7", value: 7 },
    { suit: "♦", rank: "5", value: 5 },
  ];
  // If deck is [4, 10], pop() gives 10. 12 + 10 = 22 bust.
  const outcome = blackjackEngine.dealerPlay(mockDeck, dealerInitial);
  assert.ok(outcome.score >= 17 || outcome.isBust);
});

test("BlackjackEngine - Player Actions: Double Down and Split Eligibility", () => {
  // Double Down: only 2 cards, not already doubled, not stand, not bust
  assert.equal(blackjackEngine.canDoubleDown({ cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }] }), true);
  assert.equal(blackjackEngine.canDoubleDown({ cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }, { rank: "2", value: 2 }] }), false);
  assert.equal(blackjackEngine.canDoubleDown({ cards: [{ rank: "5", value: 5 }, { rank: "6", value: 6 }], isDoubled: true }), false);

  // Split: 2 cards with same rank or same 10-value, single hand
  assert.equal(blackjackEngine.canSplit({ cards: [{ rank: "8", value: 8 }, { rank: "8", value: 8 }] }, 1), true);
  assert.equal(blackjackEngine.canSplit({ cards: [{ rank: "10", value: 10 }, { rank: "K", value: 10 }] }, 1), true);
  assert.equal(blackjackEngine.canSplit({ cards: [{ rank: "A", value: 11 }, { rank: "A", value: 11 }] }, 1), true);
  assert.equal(blackjackEngine.canSplit({ cards: [{ rank: "8", value: 8 }, { rank: "9", value: 9 }] }, 1), false);
  assert.equal(blackjackEngine.canSplit({ cards: [{ rank: "8", value: 8 }, { rank: "8", value: 8 }] }, 2), false); // Cannot resplit
});

test("BlackjackEngine - Round Evaluation & Payout Calculations", () => {
  const bet = 100;

  // 1. Natural Blackjack (3:2 payout) -> 100 + 150 = 250 payout (profit 150)
  const pBJ = { cards: [{ rank: "A", value: 11 }, { rank: "10", value: 10 }] };
  const dNormal = { cards: [{ rank: "10", value: 10 }, { rank: "9", value: 9 }] };
  const resBJ = blackjackEngine.calculatePayout(pBJ, dNormal, bet);
  assert.equal(resBJ.outcome, "BLACKJACK");
  assert.equal(resBJ.payout, 250);
  assert.equal(resBJ.profit, 150);

  // 2. Both Natural Blackjack -> Push (payout = bet, profit = 0)
  const dBJ = { cards: [{ rank: "A", value: 11 }, { rank: "J", value: 10 }] };
  const resPushBJ = blackjackEngine.calculatePayout(pBJ, dBJ, bet);
  assert.equal(resPushBJ.outcome, "PUSH");
  assert.equal(resPushBJ.payout, 100);
  assert.equal(resPushBJ.profit, 0);

  // 3. Regular Win 1:1 -> 100 * 2 = 200 payout (profit 100)
  const p20 = { cards: [{ rank: "10", value: 10 }, { rank: "K", value: 10 }] };
  const d18 = { cards: [{ rank: "10", value: 10 }, { rank: "8", value: 8 }] };
  const resWin = blackjackEngine.calculatePayout(p20, d18, bet);
  assert.equal(resWin.outcome, "WIN");
  assert.equal(resWin.payout, 200);
  assert.equal(resWin.profit, 100);

  // 4. Dealer Bust -> Win 1:1
  const dBust = { cards: [{ rank: "10", value: 10 }, { rank: "7", value: 7 }, { rank: "6", value: 6 }] };
  const resDBust = blackjackEngine.calculatePayout(p20, dBust, bet);
  assert.equal(resDBust.outcome, "WIN");
  assert.equal(resDBust.payout, 200);

  // 5. Player Bust -> Loss (payout 0, profit -100)
  const pBust = { cards: [{ rank: "10", value: 10 }, { rank: "8", value: 8 }, { rank: "5", value: 5 }] };
  const resPBust = blackjackEngine.calculatePayout(pBust, d18, bet);
  assert.equal(resPBust.outcome, "BUST");
  assert.equal(resPBust.payout, 0);
  assert.equal(resPBust.profit, -100);

  // 6. Regular Push (Equal scores) -> refund bet
  const p18 = { cards: [{ rank: "10", value: 10 }, { rank: "8", value: 8 }] };
  const resPush = blackjackEngine.calculatePayout(p18, d18, bet);
  assert.equal(resPush.outcome, "PUSH");
  assert.equal(resPush.payout, 100);
  assert.equal(resPush.profit, 0);

  // 7. Regular Loss -> payout 0
  const p17 = { cards: [{ rank: "10", value: 10 }, { rank: "7", value: 7 }] };
  const resLose = blackjackEngine.calculatePayout(p17, d18, bet);
  assert.equal(resLose.outcome, "LOSE");
  assert.equal(resLose.payout, 0);
  assert.equal(resLose.profit, -100);
});

test("BlackjackEngine - Format Helpers", () => {
  const card = { suit: "♠", rank: "A", value: 11 };
  assert.equal(blackjackEngine.formatCard(card), "[♠ A]");

  const hand = [
    { suit: "♠", rank: "10", value: 10 },
    { suit: "♥", rank: "7", value: 7 },
  ];
  const formattedHidden = blackjackEngine.formatHand(hand, true);
  assert.match(formattedHidden, /\[♠ 10\] \[🂠 \?\]/);

  const formattedVisible = blackjackEngine.formatHand(hand, false);
  assert.match(formattedVisible, /\[♠ 10\] \[♥ 7\]/);
  assert.match(formattedVisible, /Skor: \*\*17\*\*/);
});
