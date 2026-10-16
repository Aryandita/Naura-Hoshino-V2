"use strict";

/**
 * Blackjack Engine - Pure Logic Standard 52-Card Blackjack Game
 *
 * Rules:
 * - Standard 52-card deck with Fisher-Yates shuffle
 * - Ace counts as 11 or 1 (best score without busting)
 * - Natural Blackjack: Ace + 10-value card on initial 2 cards (pays 3:2)
 * - Dealer stands on all 17s (hard 17 and soft 17)
 * - Player actions: Hit, Stand, Double Down, Split
 * - Payouts: Win (1:1), Natural Blackjack (3:2), Push (refund original bet), Loss (0)
 */

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = [
  { rank: "2", value: 2 },
  { rank: "3", value: 3 },
  { rank: "4", value: 4 },
  { rank: "5", value: 5 },
  { rank: "6", value: 6 },
  { rank: "7", value: 7 },
  { rank: "8", value: 8 },
  { rank: "9", value: 9 },
  { rank: "10", value: 10 },
  { rank: "J", value: 10 },
  { rank: "Q", value: 10 },
  { rank: "K", value: 10 },
  { rank: "A", value: 11 },
];

/**
 * Generates a fresh 52-card standard deck
 * @returns {Array<{suit: string, rank: string, value: number}>}
 */
function createDeck() {
  const deck = [];
  for (const suit of SUITS) {
    for (const r of RANKS) {
      deck.push({ suit, rank: r.rank, value: r.value });
    }
  }
  return deck;
}

/**
 * Shuffles deck using Fisher-Yates algorithm
 * @param {Array} deck
 * @returns {Array}
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Calculates the score of a hand, handling soft and hard Aces
 * @param {Array<{rank: string, value: number}>} cards
 * @param {boolean} [isSplitHand=false]
 * @returns {{score: number, isBust: boolean, isBlackjack: boolean, isSoft: boolean, cards: Array}}
 */
function calculateHand(cards = [], isSplitHand = false) {
  let score = 0;
  let aceCount = 0;

  for (const card of cards) {
    score += card.value;
    if (card.rank === "A") {
      aceCount += 1;
    }
  }

  // Adjust Aces from 11 to 1 as needed
  while (score > 21 && aceCount > 0) {
    score -= 10;
    aceCount -= 1;
  }

  const isBust = score > 21;
  // Natural Blackjack is only possible on initial 2 cards without split
  const isBlackjack = !isSplitHand && cards.length === 2 && score === 21;
  const isSoft = !isBust && aceCount > 0;

  return {
    score,
    isBust,
    isBlackjack,
    isSoft,
    cards,
  };
}

/**
 * Checks if dealer should hit (Dealer MUST stand on all 17s: hard 17 and soft 17)
 * @param {Array|{cards: Array}} handOrCards
 * @returns {boolean}
 */
function shouldDealerHit(handOrCards) {
  const cards = Array.isArray(handOrCards) ? handOrCards : (handOrCards?.cards || []);
  const { score, isBust } = calculateHand(cards);
  if (isBust) return false;
  return score < 17;
}

/**
 * Simulates dealer playing until stand (>= 17) or bust
 * @param {Array} deck
 * @param {Array|{cards: Array}} dealerHand
 * @returns {{score: number, isBust: boolean, isBlackjack: boolean, isSoft: boolean, cards: Array}}
 */
function dealerPlay(deck, dealerHand) {
  const cards = [...(Array.isArray(dealerHand) ? dealerHand : (dealerHand?.cards || []))];
  while (shouldDealerHit(cards) && deck.length > 0) {
    cards.push(deck.pop());
  }
  return calculateHand(cards);
}

/**
 * Checks if player can Double Down (only on initial 2 cards)
 * @param {{cards: Array, isDoubled?: boolean, isStand?: boolean, isBust?: boolean}} hand
 * @returns {boolean}
 */
function canDoubleDown(hand) {
  if (!hand || !Array.isArray(hand.cards)) return false;
  return hand.cards.length === 2 && !hand.isDoubled && !hand.isStand && !hand.isBust;
}

/**
 * Checks if player can Split (allowed if initial 2 cards have identical rank or 10-value)
 * @param {{cards: Array}} hand
 * @param {number} [currentHandsCount=1]
 * @returns {boolean}
 */
function canSplit(hand, currentHandsCount = 1) {
  if (!hand || !Array.isArray(hand.cards) || hand.cards.length !== 2) return false;
  if (currentHandsCount !== 1) return false;
  const [c1, c2] = hand.cards;
  return c1.rank === c2.rank || (c1.value === 10 && c2.value === 10);
}

/**
 * Evaluates round between a player hand and dealer hand
 * @param {{cards: Array, isBust?: boolean, isBlackjack?: boolean, score?: number, isSplitHand?: boolean}} playerHand
 * @param {{cards: Array, isBust?: boolean, isBlackjack?: boolean, score?: number}} dealerHand
 * @returns {{outcome: string, payoutMultiplier: number, reason: string}}
 */
function evaluateRound(playerHand, dealerHand) {
  const pEval = playerHand.score !== undefined ? playerHand : calculateHand(playerHand.cards, playerHand.isSplitHand);
  const dEval = dealerHand.score !== undefined ? dealerHand : calculateHand(dealerHand.cards);

  // Player busted
  if (pEval.isBust) {
    return { outcome: "BUST", payoutMultiplier: 0, reason: "Pemain melebihi 21 (Bust)" };
  }

  // Player natural blackjack
  if (pEval.isBlackjack) {
    if (dEval.isBlackjack) {
      return { outcome: "PUSH", payoutMultiplier: 1, reason: "Seri! Keduanya memiliki Natural Blackjack" };
    }
    return { outcome: "BLACKJACK", payoutMultiplier: 2.5, reason: "Natural Blackjack! Payout 3:2" };
  }

  // Dealer natural blackjack (player does not have natural blackjack)
  if (dEval.isBlackjack) {
    return { outcome: "LOSE", payoutMultiplier: 0, reason: "Dealer memiliki Natural Blackjack" };
  }

  // Dealer busted
  if (dEval.isBust) {
    return { outcome: "WIN", payoutMultiplier: 2, reason: "Dealer melebihi 21 (Bust)!" };
  }

  // Score comparison
  if (pEval.score > dEval.score) {
    return { outcome: "WIN", payoutMultiplier: 2, reason: "Skor pemain lebih tinggi dari dealer" };
  }
  if (pEval.score === dEval.score) {
    return { outcome: "PUSH", payoutMultiplier: 1, reason: "Skor seri (Push), modal taruhan dikembalikan" };
  }
  return { outcome: "LOSE", payoutMultiplier: 0, reason: "Skor dealer lebih tinggi dari pemain" };
}

/**
 * Calculates exact payout in NSF
 * Upfront bet was already debited, so:
 * - Natural Blackjack: bet + floor(bet * 1.5)
 * - Win (1:1): bet * 2
 * - Push: bet (refund)
 * - Loss/Bust: 0
 * @param {Object} playerHand
 * @param {Object} dealerHand
 * @param {number} bet
 * @returns {{outcome: string, payoutMultiplier: number, reason: string, bet: number, payout: number, profit: number}}
 */
function calculatePayout(playerHand, dealerHand, bet) {
  const evalRes = evaluateRound(playerHand, dealerHand);
  let payout = 0;

  if (evalRes.outcome === "BLACKJACK") {
    payout = bet + Math.floor(bet * 1.5);
  } else if (evalRes.outcome === "WIN") {
    payout = bet * 2;
  } else if (evalRes.outcome === "PUSH") {
    payout = bet;
  } else {
    payout = 0;
  }

  const profit = payout - bet;

  return {
    ...evalRes,
    bet,
    payout,
    profit,
  };
}

/**
 * Formats a card to string representation
 * @param {{suit: string, rank: string}} card
 * @returns {string}
 */
function formatCard(card) {
  if (!card) return "[?]";
  return `[${card.suit} ${card.rank}]`;
}

/**
 * Formats a hand to string representation
 * @param {Array|{cards: Array}} handOrCards
 * @param {boolean} [hideHoleCard=false]
 * @returns {string}
 */
function formatHand(handOrCards, hideHoleCard = false) {
  const cards = Array.isArray(handOrCards) ? handOrCards : (handOrCards?.cards || []);
  if (cards.length === 0) return "*(Kosong)*";

  if (hideHoleCard) {
    const visible = formatCard(cards[0]);
    const upScore = cards[0].rank === "A" ? "11 / 1" : cards[0].value;
    return `${visible} [🂠 ?] (Terbuka: **${upScore}**)`;
  }

  const handEval = calculateHand(cards);
  const cardStr = cards.map(formatCard).join(" ");
  let tag = "";
  if (handEval.isBlackjack) tag = " 🃏 **BLACKJACK!**";
  else if (handEval.isBust) tag = " 💥 **BUST!**";
  else if (handEval.isSoft) tag = " *(Soft)*";

  return `${cardStr} (Skor: **${handEval.score}**)${tag}`;
}

module.exports = {
  SUITS,
  RANKS,
  createDeck,
  shuffleDeck,
  calculateHand,
  shouldDealerHit,
  dealerPlay,
  canDoubleDown,
  canSplit,
  evaluateRound,
  calculatePayout,
  formatCard,
  formatHand,
};
