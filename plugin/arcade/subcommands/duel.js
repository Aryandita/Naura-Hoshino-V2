"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "duel",
  async execute(interaction, context) {
    const { user, survival, coinEmoji, nsfEmoji, sendError } = context;
    const opponent = context.lawan || interaction.options?.getUser?.("lawan") || null;
    const taruhan = context.taruhan || (interaction.options?.getInteger?.("taruhan")) || 0;
    const gameId = genGameId("duel", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!opponent) return sendError("Harap tentukan pemain yang ingin kamu tantang duel! Contoh: `/arcade play game:duel lawan:@user`");
    if (opponent.bot) return sendError("Kamu tidak bisa menantang mesin/bot!");
    if (opponent.id === user.id) return sendError("Kamu tidak bisa menantang dirimu sendiri!");
    const [opponentSurvival] = await UserSurvival.findOrCreate({ where: { userId: opponent.id } });
    // Escrow upfront both sides via atomic debit; refund if not accepted
    if (taruhan > 0) {
      const userNsf = Number(survival.starFragments || 0);
      const oppNsf = Number(opponentSurvival.starFragments || 0);
      if (userNsf < taruhan) return sendError("Saldo Star Fragments (NSF) kamu tidak cukup untuk bertaruh sebesar **" + taruhan.toLocaleString() + "** " + coinEmoji + "! (Saldo: " + userNsf.toLocaleString() + " " + nsfEmoji + ")");
      if (oppNsf < taruhan) return sendError("Saldo Star Fragments <@" + opponent.id + "> tidak cukup untuk taruhan ini!");
      const debitRes = await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
      if (!debitRes || !debitRes.ok) return sendError("Gagal memotong taruhan di muka.");
      // Opponent escrow will be debited on accept; to keep atomic we debit opponent now too and refund on decline/timeout
      const oppDebit = await cacheManager.debitUserSurvival(opponent.id, "starFragments", taruhan);
      if (!oppDebit || !oppDebit.ok) {
        await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan);
        return sendError("Gagal memotong saldo lawan. Taruhan dikembalikan.");
      }
    }
    const rowInvite = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(cid(gameId, "duel_accept")).setLabel("Terima").setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(cid(gameId, "duel_decline")).setLabel("Tolak").setStyle(ButtonStyle.Danger),
    );
    const invitePayload = buildContainerV2({ accentColorHex: ui.colors.primary || "#00FFFF", title: "TANTANGAN DUEL", description: "<@" + user.id + "> menantang <@" + opponent.id + "> untuk duel matematika kecepatan!\n\n**Taruhan:** " + taruhan.toLocaleString() + " " + coinEmoji + "\n\nApakah kamu berani menerima tantangan ini?", buttonsRow: rowInvite, footerText: "Tantangan ini akan kadaluarsa dalam 30 detik." });
    const response = await interaction.editReply({ ...invitePayload, fetchReply: true });
    const filter = (i) => { const p = parseCid(i.customId); return i.user.id === opponent.id && p && p.gameId === gameId; };
    const collectorInvite = response.createMessageComponentCollector({ filter, time: 30000 });
    let invited = false;
    collectorInvite.on("collect", async (i) => {
      if (invited) return;
      const parsed = parseCid(i.customId);
      if (!parsed) return;
      if (parsed.action === "duel_decline") {
        invited = true;
        if (taruhan > 0) { await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan); await cacheManager.incrementUserSurvival(opponent.id, "starFragments", taruhan); }
        await i.update({ content: "<@" + opponent.id + "> menolak tantangan duel. Taruhan dikembalikan.", embeds: [], components: [] });
        collectorInvite.stop("declined");
        return;
      }
      invited = true;
      await i.deferUpdate();
      collectorInvite.stop("accepted");
      const num1 = Math.floor(Math.random() * 50) + 10;
      const num2 = Math.floor(Math.random() * 50) + 10;
      const answer = num1 + num2;
      const opts = [answer, answer + Math.floor(Math.random() * 5) + 1, answer - Math.floor(Math.random() * 5) - 1, answer + 10].sort(() => Math.random() - 0.5);
      const rowGame = new ActionRowBuilder().addComponents(opts.map((opt) => new ButtonBuilder().setCustomId(cid(gameId, "duel_" + opt)).setLabel(opt.toString()).setStyle(ButtonStyle.Primary)));
      const duelPayload = buildContainerV2({ accentColorHex: "#FF0055", title: "DUEL DIMULAI: SIAPA CEPAT DIA DAPAT!", description: "Berapa hasil dari: **" + num1 + " + " + num2 + "** ?\n\nSiapapun yang menekan jawaban benar lebih dulu akan menang!", buttonsRow: rowGame, footerText: "Waktu menjawab: 15 detik" });
      await interaction.editReply(duelPayload);
      const gameCollector = response.createMessageComponentCollector({ filter: (gi) => { const p = parseCid(gi.customId); return (gi.user.id === user.id || gi.user.id === opponent.id) && p && p.gameId === gameId; }, time: 15000 });
      let gameDone = false;
      gameCollector.on("collect", async (gi) => {
        if (gameDone) return;
        const p = parseCid(gi.customId);
        if (!p) return;
        const chosen = parseInt(p.action.split("_")[1], 10);
        const winner = gi.user;
        const loser = winner.id === user.id ? opponent : user;
        if (chosen === answer) {
          gameDone = true;
          setState(gameId, States.FINISHED);
          gameCollector.stop("win");
          await gi.deferUpdate().catch(() => {});
          await cacheManager.incrementUserProfile(winner.id, { minigame_duelScore: 10 });
          await rewardOnce(gameId, () => ArcadeEngine.postGame(winner.id, "duel", "win"));
          if (taruhan > 0) await cacheManager.incrementUserSurvival(winner.id, "starFragments", taruhan * 2);
          const winPayload = buildContainerV2({ accentColorHex: "#22c55e", title: "PEMENANG DUEL", description: "Tembakan cepat dari <@" + winner.id + "> tepat sasaran!\n\n**Jawaban Benar:** " + answer + "\n\n**Hadiah Pemenang:**\n> +10 Poin Duel\n> " + (taruhan > 0 ? "+" + (taruhan * 2).toLocaleString() + " " + coinEmoji : "Tidak ada taruhan"), footerText: ui.getFooter("core") });
          await interaction.editReply(winPayload);
        } else {
          await ui.sendError(gi, "err_sys_4", true);
        }
      });
      gameCollector.on("end", async (collected, reason) => {
        if (reason === "time" && !gameDone) {
          setState(gameId, States.EXPIRED);
          if (taruhan > 0) { await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan); await cacheManager.incrementUserSurvival(opponent.id, "starFragments", taruhan); }
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "duel", "loss"));
          await interaction.editReply({ content: "Pertandingan dibatalkan karena waktu habis, tidak ada yang menjawab. Taruhan dikembalikan.", embeds: [], components: [] }).catch(() => {});
        }
      });
    });
    collectorInvite.on("end", async (collected, reason) => {
      if (reason === "time") {
        if (taruhan > 0) { await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan); await cacheManager.incrementUserSurvival(opponent.id, "starFragments", taruhan); }
        await interaction.editReply({ content: "<@" + opponent.id + "> terlalu lama merespons. Tantangan dibatalkan. Taruhan dikembalikan.", embeds: [], components: [] }).catch(() => {});
      }
    });
  },
};
