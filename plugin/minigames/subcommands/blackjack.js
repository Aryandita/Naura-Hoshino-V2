"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const blackjackEngine = require("../../../src/services/blackjackEngine");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "blackjack",
  async execute(interaction, context) {
    const { user, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = interaction.options.getInteger("taruhan") || 0;

    if (taruhan < 10) {
      return sendError("Minimal taruhan untuk Blackjack adalah **10 SC**!");
    }
    if (taruhan > 50000) {
      return sendError("Maksimal taruhan untuk Blackjack adalah **50.000 SC**!");
    }

    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv
      ? Number(curSurv.starFragments || 0)
      : Number(survival.starFragments || 0);

    if (curNsf < taruhan) {
      return sendError(
        `Saldo Sukamaju Koin (SC) tidak mencukupi untuk taruhan **${taruhan.toLocaleString()}** ${coinEmoji}! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`,
      );
    }

    // Upfront atomic debit
    const debitRes = await cacheManager.debitUserSurvival(
      user.id,
      "starFragments",
      taruhan,
    );
    if (!debitRes || !debitRes.ok) {
      return sendError("Gagal memotong saldo taruhan di muka. Silakan coba lagi.");
    }

    // Initialize deck & deal
    const deck = blackjackEngine.shuffleDeck(blackjackEngine.createDeck());
    const dealerCards = [deck.pop(), deck.pop()];
    const playerHands = [
      {
        cards: [deck.pop(), deck.pop()],
        bet: taruhan,
        isDoubled: false,
        isStand: false,
        isBust: false,
        isSplitHand: false,
      },
    ];

    let activeHandIndex = 0;
    let isGameOver = false;

    // Helper: render game state container
    function renderBoardPayload(statusText, options = {}) {
      const { hideHole = true, isFinal = false, accentColor = "#3B82F6" } = options;
      const dealerStr = blackjackEngine.formatHand(dealerCards, hideHole);

      const handsLines = playerHands.map((h, idx) => {
        const prefix = playerHands.length > 1 ? `**Tangan ${idx + 1}:** ` : "";
        const activeMarker = (!isFinal && idx === activeHandIndex) ? " 👈 *(Sedang Dimainkan)*" : "";
        const doubledTag = h.isDoubled ? " *(Double Down 💰)*" : "";
        return `${prefix}${blackjackEngine.formatHand(h.cards, false)}${doubledTag}${activeMarker}`;
      });

      const totalCurrentBet = playerHands.reduce((acc, h) => acc + h.bet, 0);

      const descriptionLines = [
        `**Dealer Naura:**`,
        `> ${dealerStr}`,
        "",
        `**Kartu Kamu (${user.username}):**`,
        ...handsLines.map((l) => `> ${l}`),
        "",
        `💰 **Total Taruhan:** **${totalCurrentBet.toLocaleString()}** ${coinEmoji}`,
        "",
        statusText,
      ];

      const payload = {
        accentColorHex: accentColor,
        authorName: "Blackjack 21 Kasino",
        iconURL: user.displayAvatarURL(),
        title: "🃏 Meja Blackjack Kasino",
        description: descriptionLines.join("\n"),
        footerText: "Dealer stand pada 17 (Hard & Soft) • Natural Blackjack bayar 3:2",
      };

      if (!isFinal) {
        const curHand = playerHands[activeHandIndex];
        const canDouble = blackjackEngine.canDoubleDown(curHand);
        const canSplit = blackjackEngine.canSplit(curHand, playerHands.length);

        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("blackjack_hit")
            .setLabel("Hit ➕")
            .setStyle(ButtonStyle.Primary),
          new ButtonBuilder()
            .setCustomId("blackjack_stand")
            .setLabel("Stand 🛑")
            .setStyle(ButtonStyle.Secondary),
          new ButtonBuilder()
            .setCustomId("blackjack_double")
            .setLabel("Double 💰")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canDouble),
          new ButtonBuilder()
            .setCustomId("blackjack_split")
            .setLabel("Split ✌️")
            .setStyle(ButtonStyle.Secondary)
            .setDisabled(!canSplit),
        );
        payload.buttonsRow = row;
      }

      return buildContainerV2(payload);
    }

    // Check Initial Natural Blackjack on initial 2 cards
    const initialPlayerEval = blackjackEngine.calculateHand(playerHands[0].cards);
    if (initialPlayerEval.isBlackjack) {
      isGameOver = true;
      const res = blackjackEngine.calculatePayout(playerHands[0], dealerCards, taruhan);

      if (res.payout > 0) {
        await cacheManager.incrementUserSurvival(user.id, "starFragments", res.payout);
      }

      const winColor = res.outcome === "BLACKJACK" ? "#22C55E" : "#EAB308";
      const finalMsg = res.outcome === "BLACKJACK"
        ? `🎉 **NATURAL BLACKJACK!** Payout 3:2! Kamu memenangkan **+${res.payout.toLocaleString()}** ${coinEmoji} (Profit: +${res.profit.toLocaleString()})!`
        : `🤝 **Seri (Push)!** Keduanya memiliki Natural Blackjack. Taruhan **${taruhan.toLocaleString()}** ${coinEmoji} dikembalikan.`;

      const initialPayload = renderBoardPayload(finalMsg, {
        hideHole: false,
        isFinal: true,
        accentColor: winColor,
      });
      return interaction.editReply(initialPayload);
    }

    // Send initial interactive board
    const initialPayload = renderBoardPayload("Giliranmu! Pilih aksi di bawah dalam 60 detik:");
    const replyMsg = await interaction.editReply(initialPayload);

    // Setup interactive collector
    const collector = replyMsg.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    async function finishRound(triggerInteraction) {
      isGameOver = true;
      collector.stop("round_ended");

      // Check if all hands are busted
      const allBusted = playerHands.every((h) => h.isBust);

      let finalDealerHand;
      if (allBusted) {
        // Dealer doesn't need to hit if all player hands busted
        finalDealerHand = blackjackEngine.calculateHand(dealerCards);
      } else {
        // Dealer plays out (hits until >= 17)
        finalDealerHand = blackjackEngine.dealerPlay(deck, dealerCards);
      }

      let totalPayout = 0;
      let totalBet = 0;
      const roundSummaries = [];

      for (let i = 0; i < playerHands.length; i++) {
        const hand = playerHands[i];
        totalBet += hand.bet;
        const payoutInfo = blackjackEngine.calculatePayout(hand, finalDealerHand, hand.bet);
        totalPayout += payoutInfo.payout;

        const handLabel = playerHands.length > 1 ? `Tangan ${i + 1}: ` : "";
        if (payoutInfo.outcome === "BLACKJACK") {
          roundSummaries.push(`${handLabel}🎉 Natural Blackjack (+${payoutInfo.payout.toLocaleString()} SC)`);
        } else if (payoutInfo.outcome === "WIN") {
          roundSummaries.push(`${handLabel}✅ Menang (+${payoutInfo.payout.toLocaleString()} SC)`);
        } else if (payoutInfo.outcome === "PUSH") {
          roundSummaries.push(`${handLabel}🤝 Seri (+${payoutInfo.payout.toLocaleString()} SC refund)`);
        } else if (payoutInfo.outcome === "BUST") {
          roundSummaries.push(`${handLabel}💥 Bust (-${hand.bet.toLocaleString()} SC)`);
        } else {
          roundSummaries.push(`${handLabel}❌ Kalah (-${hand.bet.toLocaleString()} SC)`);
        }
      }

      if (totalPayout > 0) {
        await cacheManager.incrementUserSurvival(user.id, "starFragments", totalPayout);
      }

      const netProfit = totalPayout - totalBet;
      let accentColor = "#EF4444";
      let summaryText = "";

      if (netProfit > 0) {
        accentColor = "#22C55E";
        summaryText = `🎉 **MENANG!** Payout: **+${totalPayout.toLocaleString()}** ${coinEmoji} (Profit bersih: **+${netProfit.toLocaleString()}**)`;
      } else if (netProfit === 0) {
        accentColor = "#EAB308";
        summaryText = `🤝 **SERI (Push)!** Seluruh modal taruhan **${totalBet.toLocaleString()}** ${coinEmoji} dikembalikan.`;
      } else {
        accentColor = "#EF4444";
        summaryText = `💀 **KALAH!** Kehilangan modal taruhan **-${Math.abs(netProfit).toLocaleString()}** ${coinEmoji}.`;
      }

      const finalDescription = [
        ...roundSummaries.map((s) => `> ${s}`),
        "",
        summaryText,
      ].join("\n");

      const finalPayload = renderBoardPayload(finalDescription, {
        hideHole: false,
        isFinal: true,
        accentColor,
      });

      if (triggerInteraction && !triggerInteraction.replied && !triggerInteraction.deferred) {
        await triggerInteraction.update(finalPayload);
      } else {
        await interaction.editReply(finalPayload).catch(() => {});
      }
    }

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) {
        return ui.sendError(i, "err_sys_6", true);
      }

      const action = i.customId;
      const curHand = playerHands[activeHandIndex];

      if (action === "blackjack_hit") {
        curHand.cards.push(deck.pop());
        const handEval = blackjackEngine.calculateHand(curHand.cards, curHand.isSplitHand);

        if (handEval.isBust) {
          curHand.isBust = true;
          curHand.isStand = true;
          activeHandIndex++;

          if (activeHandIndex >= playerHands.length) {
            return finishRound(i);
          }
        } else if (handEval.score === 21) {
          curHand.isStand = true;
          activeHandIndex++;

          if (activeHandIndex >= playerHands.length) {
            return finishRound(i);
          }
        }

        const nextPayload = renderBoardPayload("Kartu ditarik! Pilih aksi berikutnya:");
        return i.update(nextPayload);
      }

      if (action === "blackjack_stand") {
        curHand.isStand = true;
        activeHandIndex++;

        if (activeHandIndex >= playerHands.length) {
          return finishRound(i);
        }

        const nextPayload = renderBoardPayload(`Lanjut ke tangan ke-${activeHandIndex + 1}:`);
        return i.update(nextPayload);
      }

      if (action === "blackjack_double") {
        if (!blackjackEngine.canDoubleDown(curHand)) {
          return i.reply({
            content: "❌ Double Down hanya dapat dilakukan pada 2 kartu pertama!",
            flags: MessageFlags.Ephemeral,
          });
        }

        // Debit additional bet
        const extraDebit = await cacheManager.debitUserSurvival(
          user.id,
          "starFragments",
          curHand.bet,
        );

        if (!extraDebit || !extraDebit.ok) {
          return i.reply({
            content: `❌ Saldo Star Fragments tidak mencukupi untuk Double Down (+${curHand.bet.toLocaleString()} SC)!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        curHand.bet *= 2;
        curHand.isDoubled = true;
        curHand.cards.push(deck.pop());
        const handEval = blackjackEngine.calculateHand(curHand.cards, curHand.isSplitHand);

        if (handEval.isBust) {
          curHand.isBust = true;
        }
        curHand.isStand = true;
        activeHandIndex++;

        if (activeHandIndex >= playerHands.length) {
          return finishRound(i);
        }

        const nextPayload = renderBoardPayload(`Double Down berhasil! Lanjut ke tangan ke-${activeHandIndex + 1}:`);
        return i.update(nextPayload);
      }

      if (action === "blackjack_split") {
        if (!blackjackEngine.canSplit(curHand, playerHands.length)) {
          return i.reply({
            content: "❌ Kartu tidak memenuhi syarat untuk di-split!",
            flags: MessageFlags.Ephemeral,
          });
        }

        // Debit additional bet for split hand
        const splitDebit = await cacheManager.debitUserSurvival(
          user.id,
          "starFragments",
          curHand.bet,
        );

        if (!splitDebit || !splitDebit.ok) {
          return i.reply({
            content: `❌ Saldo Star Fragments tidak mencukupi untuk Split (+${curHand.bet.toLocaleString()} SC)!`,
            flags: MessageFlags.Ephemeral,
          });
        }

        // Perform split
        const secondCard = curHand.cards.pop();
        curHand.cards.push(deck.pop());
        curHand.isSplitHand = true;

        const secondHand = {
          cards: [secondCard, deck.pop()],
          bet: curHand.bet,
          isDoubled: false,
          isStand: false,
          isBust: false,
          isSplitHand: true,
        };
        playerHands.push(secondHand);

        const nextPayload = renderBoardPayload("Split berhasil! Dua tangan terbentuk. Mainkan tangan 1:");
        return i.update(nextPayload);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && !isGameOver) {
        // Auto-stand remaining hands and resolve
        for (const h of playerHands) {
          h.isStand = true;
        }
        await finishRound(null);
      }
    });
  },
};
