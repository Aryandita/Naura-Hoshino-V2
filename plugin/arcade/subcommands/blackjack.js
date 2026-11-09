"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const blackjackEngine = require("../../../src/services/blackjackEngine");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "blackjack",
  async execute(interaction, context) {
    const { user, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = context.taruhan || (interaction.options?.getInteger?.("taruhan")) || 0;
    const gameId = genGameId("blackjack", user.id);
    setState(gameId, States.WAITING_INPUT);

    if (taruhan > 0) {
      if (taruhan < 10) return sendError("Minimal taruhan untuk Blackjack adalah **10 NSF**!");
      if (taruhan > 50000) return sendError("Maksimal taruhan untuk Blackjack adalah **50.000 NSF**!");
      const curSurv = await cacheManager.getUserSurvival(user.id);
      const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);
      if (curNsf < taruhan) return sendError("Saldo Star Fragments (NSF) tidak mencukupi untuk taruhan **" + taruhan.toLocaleString() + "** " + coinEmoji + "! (Saldo: " + curNsf.toLocaleString() + " " + nsfEmoji + ")");
      const debitRes = await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
      if (!debitRes || !debitRes.ok) return sendError("Gagal memotong saldo taruhan di muka. Silakan coba lagi.");
    }

    const deck = blackjackEngine.shuffleDeck(blackjackEngine.createDeck());
    const dealerCards = [deck.pop(), deck.pop()];
    const playerHands = [{ cards: [deck.pop(), deck.pop()], bet: taruhan, isDoubled: false, isStand: false, isBust: false, isSplitHand: false }];
    let activeHandIndex = 0;
    let isGameOver = false;

    function renderBoardPayload(statusText, options) {
      const opts = options || {};
      const hideHole = opts.hideHole !== undefined ? opts.hideHole : true;
      const isFinal = opts.isFinal || false;
      const accentColor = opts.accentColor || "#3B82F6";
      const dealerStr = blackjackEngine.formatHand(dealerCards, hideHole);
      const handsLines = playerHands.map((h, idx) => {
        const prefix = playerHands.length > 1 ? "**Tangan " + (idx + 1) + ":** " : "";
        const activeMarker = (!isFinal && idx === activeHandIndex) ? " (Sedang Dimainkan)" : "";
        const doubledTag = h.isDoubled ? " (Double Down)" : "";
        return prefix + blackjackEngine.formatHand(h.cards, false) + doubledTag + activeMarker;
      });
      const totalCurrentBet = playerHands.reduce((acc, h) => acc + h.bet, 0);
      const descriptionLines = ["**Dealer Naura:**", "> " + dealerStr, "", "**Kartu Kamu (" + user.username + "):**", ...handsLines.map((l) => "> " + l), "", "Total Taruhan: **" + totalCurrentBet.toLocaleString() + "** " + coinEmoji, "", statusText];
      const payload = { accentColorHex: accentColor, authorName: "Blackjack 21 Kasino", iconURL: user.displayAvatarURL(), title: "Meja Blackjack Kasino", description: descriptionLines.join("\n"), footerText: "Dealer stand pada 17 (Hard & Soft) - Natural Blackjack bayar 3:2" };
      if (!isFinal) {
        const curHand = playerHands[activeHandIndex];
        const canDouble = blackjackEngine.canDoubleDown(curHand);
        const canSplit = blackjackEngine.canSplit(curHand, playerHands.length);
        const row = new ActionRowBuilder().addComponents(
          new ButtonBuilder().setCustomId(cid(gameId, "blackjack_hit")).setLabel("Hit +").setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setCustomId(cid(gameId, "blackjack_stand")).setLabel("Stand").setStyle(ButtonStyle.Secondary),
          new ButtonBuilder().setCustomId(cid(gameId, "blackjack_double")).setLabel("Double").setStyle(ButtonStyle.Secondary).setDisabled(!canDouble),
          new ButtonBuilder().setCustomId(cid(gameId, "blackjack_split")).setLabel("Split").setStyle(ButtonStyle.Secondary).setDisabled(!canSplit),
        );
        payload.buttonsRow = row;
      }
      return buildContainerV2(payload);
    }

    const initialPlayerEval = blackjackEngine.calculateHand(playerHands[0].cards);
    if (initialPlayerEval.isBlackjack) {
      isGameOver = true;
      setState(gameId, States.FINISHED);
      const res = blackjackEngine.calculatePayout(playerHands[0], dealerCards, taruhan);
      let mpResult = "win";
      if (res.payout > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", res.payout);
      if (res.outcome === "PUSH") mpResult = "draw";
      else if (res.payout === 0) mpResult = "loss";
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "blackjack", mpResult));
      const winColor = res.outcome === "BLACKJACK" ? "#22C55E" : "#EAB308";
      const finalMsg = res.outcome === "BLACKJACK" ? "NATURAL BLACKJACK! Payout 3:2! Kamu memenangkan **+" + res.payout.toLocaleString() + "** " + coinEmoji + " (Profit: +" + res.profit.toLocaleString() + ")!" : "Seri (Push)! Keduanya memiliki Natural Blackjack. Taruhan **" + taruhan.toLocaleString() + "** " + coinEmoji + " dikembalikan.";
      return interaction.editReply(renderBoardPayload(finalMsg, { hideHole: false, isFinal: true, accentColor: winColor }));
    }

    const initialPayload = renderBoardPayload("Giliranmu! Pilih aksi di bawah dalam 60 detik:");
    const replyMsg = await interaction.editReply(initialPayload);

    const collector = replyMsg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    let validAnswers = 0;

    async function finishRound(triggerInteraction) {
      if (isGameOver) return;
      isGameOver = true;
      setState(gameId, States.FINISHED);
      collector.stop("round_ended");
      const allBusted = playerHands.every((h) => h.isBust);
      let finalDealerHand;
      if (allBusted) finalDealerHand = blackjackEngine.calculateHand(dealerCards);
      else finalDealerHand = blackjackEngine.dealerPlay(deck, dealerCards);
      let totalPayout = 0;
      let totalBet = 0;
      const roundSummaries = [];
      for (let i = 0; i < playerHands.length; i++) {
        const hand = playerHands[i];
        totalBet += hand.bet;
        const payoutInfo = blackjackEngine.calculatePayout(hand, finalDealerHand, hand.bet);
        totalPayout += payoutInfo.payout;
        const handLabel = playerHands.length > 1 ? "Tangan " + (i + 1) + ": " : "";
        if (payoutInfo.outcome === "BLACKJACK") roundSummaries.push(handLabel + "Natural Blackjack (+" + payoutInfo.payout.toLocaleString() + " SC)");
        else if (payoutInfo.outcome === "WIN") roundSummaries.push(handLabel + "Menang (+" + payoutInfo.payout.toLocaleString() + " SC)");
        else if (payoutInfo.outcome === "PUSH") roundSummaries.push(handLabel + "Seri (+" + payoutInfo.payout.toLocaleString() + " SC refund)");
        else if (payoutInfo.outcome === "BUST") roundSummaries.push(handLabel + "Bust (-" + hand.bet.toLocaleString() + " SC)");
        else roundSummaries.push(handLabel + "Kalah (-" + hand.bet.toLocaleString() + " SC)");
      }
      if (totalPayout > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", totalPayout);
      const netProfit = totalPayout - totalBet;
      let accentColor = "#EF4444";
      let summaryText = "";
      if (netProfit > 0) { accentColor = "#22C55E"; summaryText = "MENANG! Payout: **+" + totalPayout.toLocaleString() + "** " + coinEmoji + " (Profit bersih: **+" + netProfit.toLocaleString() + "**)"; }
      else if (netProfit === 0) { accentColor = "#EAB308"; summaryText = "SERI (Push)! Seluruh modal taruhan **" + totalBet.toLocaleString() + "** " + coinEmoji + " dikembalikan."; }
      else { accentColor = "#EF4444"; summaryText = "KALAH! Kehilangan modal taruhan **-" + Math.abs(netProfit).toLocaleString() + "** " + coinEmoji + "."; }
      let mpResult = "loss";
      if (netProfit > 0) mpResult = "win";
      else if (netProfit === 0 && taruhan === 0) mpResult = "draw";
      else if (netProfit === 0) mpResult = "draw";
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "blackjack", mpResult));
      const finalDescription = [...roundSummaries.map((s) => "> " + s), "", summaryText].join("\n");
      const finalPayload = renderBoardPayload(finalDescription, { hideHole: false, isFinal: true, accentColor });
      if (triggerInteraction && !triggerInteraction.replied && !triggerInteraction.deferred) await triggerInteraction.update(finalPayload);
      else await interaction.editReply(finalPayload).catch(() => {});
    }

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_6", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_6", true);
      validAnswers++;
      if (validAnswers > 1) {
        const { tryReset } = require("../../../src/arcade/arcadeSession");
        tryReset(collector, gameId);
      }
      const action = parsed.action;
      const curHand = playerHands[activeHandIndex];
      if (action === "blackjack_hit") {
        curHand.cards.push(deck.pop());
        const handEval = blackjackEngine.calculateHand(curHand.cards, curHand.isSplitHand);
        if (handEval.isBust) {
          curHand.isBust = true; curHand.isStand = true; activeHandIndex++;
          if (activeHandIndex >= playerHands.length) return finishRound(i);
        } else if (handEval.score === 21) {
          curHand.isStand = true; activeHandIndex++;
          if (activeHandIndex >= playerHands.length) return finishRound(i);
        }
        return i.update(renderBoardPayload("Kartu ditarik! Pilih aksi berikutnya:"));
      }
      if (action === "blackjack_stand") {
        curHand.isStand = true; activeHandIndex++;
        if (activeHandIndex >= playerHands.length) return finishRound(i);
        return i.update(renderBoardPayload("Lanjut ke tangan ke-" + (activeHandIndex + 1) + ":"));
      }
      if (action === "blackjack_double") {
        if (!blackjackEngine.canDoubleDown(curHand)) return i.reply({ content: "Double Down hanya dapat dilakukan pada 2 kartu pertama!", flags: MessageFlags.Ephemeral });
        const extraDebit = await cacheManager.debitUserSurvival(user.id, "starFragments", curHand.bet);
        if (!extraDebit || !extraDebit.ok) return i.reply({ content: "Saldo Star Fragments tidak mencukupi untuk Double Down (+" + curHand.bet.toLocaleString() + " SC)!", flags: MessageFlags.Ephemeral });
        curHand.bet *= 2; curHand.isDoubled = true; curHand.cards.push(deck.pop());
        const handEval = blackjackEngine.calculateHand(curHand.cards, curHand.isSplitHand);
        if (handEval.isBust) curHand.isBust = true;
        curHand.isStand = true; activeHandIndex++;
        if (activeHandIndex >= playerHands.length) return finishRound(i);
        return i.update(renderBoardPayload("Double Down berhasil! Lanjut ke tangan ke-" + (activeHandIndex + 1) + ":"));
      }
      if (action === "blackjack_split") {
        if (!blackjackEngine.canSplit(curHand, playerHands.length)) return i.reply({ content: "Kartu tidak memenuhi syarat untuk di-split!", flags: MessageFlags.Ephemeral });
        const splitDebit = await cacheManager.debitUserSurvival(user.id, "starFragments", curHand.bet);
        if (!splitDebit || !splitDebit.ok) return i.reply({ content: "Saldo Star Fragments tidak mencukupi untuk Split (+" + curHand.bet.toLocaleString() + " SC)!", flags: MessageFlags.Ephemeral });
        const secondCard = curHand.cards.pop();
        curHand.cards.push(deck.pop());
        curHand.isSplitHand = true;
        playerHands.push({ cards: [secondCard, deck.pop()], bet: curHand.bet, isDoubled: false, isStand: false, isBust: false, isSplitHand: true });
        return i.update(renderBoardPayload("Split berhasil! Dua tangan terbentuk. Mainkan tangan 1:"));
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && !isGameOver) { for (const h of playerHands) h.isStand = true; await finishRound(null); }
    });
  },
};
