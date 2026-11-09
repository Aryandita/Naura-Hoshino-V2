"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "tictactoe",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = context.taruhan || (interaction.options?.getInteger?.("taruhan")) || 0;
    const opponent = context.lawan || interaction.options?.getUser?.("lawan") || null;
    const gameId = genGameId("tictactoe", user.id);
    setState(gameId, States.WAITING_INPUT);
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);
    if (taruhan > 0 && curNsf < taruhan) return sendError("Saldo Star Fragments (NSF) tidak cukup untuk taruhan **" + taruhan.toLocaleString() + "**! (Saldo: " + curNsf.toLocaleString() + " " + nsfEmoji + ")");
    if (taruhan > 0) {
      const debitRes = await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
      if (!debitRes || !debitRes.ok) return sendError("Gagal memotong taruhan di muka.");
    }
    if (opponent && !opponent.bot && opponent.id !== user.id) {
      if (taruhan > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan);
      return interaction.editReply({ content: "Fitur PvP Tic-Tac-Toe melawan pemain nyata sedang dalam pengembangan! Untuk sementara, silakan bermain melawan AI dengan mengosongkan argumen lawan." });
    }
    const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const checkWin = (b) => {
      const wins = [[0,1,2],[3,4,5],[6,7,8],[0,3,6],[1,4,7],[2,5,8],[0,4,8],[2,4,6]];
      for (const w of wins) if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) return b[w[0]];
      if (b.every((c) => c === "X" || c === "O")) return "DRAW";
      return null;
    };
    const buildBoardUI = (b, disabled) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          const idx = i * 3 + j;
          const val = b[idx];
          const btn = new ButtonBuilder().setCustomId(cid(gameId, "ttt_" + idx)).setDisabled(disabled || val === "X" || val === "O");
          if (val === "X") btn.setLabel("X").setStyle(ButtonStyle.Primary);
          else if (val === "O") btn.setLabel("O").setStyle(ButtonStyle.Danger);
          else btn.setLabel("-").setStyle(ButtonStyle.Secondary);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      return rows;
    };
    const renderTtt = (desc, disabled) => buildContainerV2({ accentColorHex: ui.getColor("primary") || "#FFB6C1", title: "Tic-Tac-Toe Minigame", description: desc, buttonsRow: buildBoardUI(board, disabled), footerText: ui.getFooter("core") });
    await interaction.editReply(renderTtt("Taruhan: **" + taruhan.toLocaleString() + "** " + coinEmoji + "\nKamu adalah X. Lawan AI bot O!"));
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    let validAnswers = 0;
    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_7", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_7", true);
      validAnswers++;
      if (validAnswers > 1) tryReset(collector, gameId);
      const pos = parseInt(parsed.action.split("_")[1], 10);
      if (board[pos] === "X" || board[pos] === "O") return;
      board[pos] = "X";
      let status = checkWin(board);
      if (!status) {
        const emptySpots = board.filter((s) => s !== "X" && s !== "O");
        if (emptySpots.length > 0) { const botMove = emptySpots[Math.floor(Math.random() * emptySpots.length)]; board[botMove] = "O"; status = checkWin(board); }
      }
      if (status) {
        setState(gameId, States.FINISHED);
        let msg = "";
        if (status === "X") {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tictactoe", "win"));
          try { profile.minigame_tttWin = (profile.minigame_tttWin || 0) + 1; await profile.save({ fields: ["minigame_tttWin"] }); } catch (e) {}
          if (taruhan > 0) { const winNsf = profile.isPremium ? taruhan * 2 : taruhan; await cacheManager.incrementUserSurvival(user.id, "starFragments", winNsf); }
          msg = "KAMU MENANG! +25 MP" + (taruhan > 0 ? " | Menang taruhan **+" + (taruhan * 2).toLocaleString() + "** " + coinEmoji : "");
        } else if (status === "O") {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tictactoe", "loss"));
          msg = "KAMU KALAH! Bot AI memenangkan ronde ini." + (taruhan > 0 ? " Kehilangan taruhan **" + taruhan.toLocaleString() + "** " + coinEmoji + "." : "");
        } else {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tictactoe", "draw"));
          if (taruhan > 0) await cacheManager.incrementUserSurvival(user.id, "starFragments", taruhan);
          msg = "SERI! Permainan imbang, +5 MP" + (taruhan > 0 ? ", modal taruhan dikembalikan." : ".");
        }
        await i.update(renderTtt(msg, true));
        collector.stop("finished");
      } else {
        await i.update(renderTtt(taruhan > 0 ? "Taruhan: **" + taruhan.toLocaleString() + "** " + coinEmoji + "\nGiliran berikutnya! Kamu X vs AI O." : "Giliran berikutnya! Kamu X vs AI O."));
      }
    });
    collector.on("end", async (collected, reason) => {
      if (checkWin(board) === null && reason === "time") {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tictactoe", "loss"));
        await interaction.editReply(renderTtt("WAKTU HABIS! Kamu dianggap WO dan kehilangan taruhan.", true)).catch(() => {});
      }
    });
  },
};
