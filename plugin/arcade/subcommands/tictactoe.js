"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "tictactoe",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = interaction.options.getInteger("taruhan") || 0;
    const opponent = interaction.options.getUser("lawan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv
      ? Number(curSurv.starFragments || 0)
      : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan) {
      return sendError(
        `Taruhan tidak valid atau saldo Sukamaju Koin (SC) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`,
      );
    }

    if (opponent && !opponent.bot && opponent.id !== user.id) {
      return interaction.editReply({
        content:
          "Fitur PvP Tic-Tac-Toe melawan pemain nyata sedang dalam pengembangan! Untuk sementara, silakan bermain melawan AI dengan mengosongkan argumen lawan.",
      });
    }

    const board = [0, 1, 2, 3, 4, 5, 6, 7, 8];
    const checkWin = (b) => {
      const wins = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6],
      ];
      for (const w of wins) {
        if (b[w[0]] === b[w[1]] && b[w[1]] === b[w[2]]) return b[w[0]];
      }
      if (b.every((c) => c === "X" || c === "O")) return "DRAW";
      return null;
    };

    const buildBoardUI = (b, disabled = false) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 3; j++) {
          const idx = i * 3 + j;
          const val = b[idx];
          const btn = new ButtonBuilder()
            .setCustomId(`ttt_${idx}`)
            .setDisabled(disabled || val === "X" || val === "O");
          if (val === "X") btn.setLabel("❌").setStyle(ButtonStyle.Primary);
          else if (val === "O") btn.setLabel("⭕").setStyle(ButtonStyle.Danger);
          else btn.setLabel("➖").setStyle(ButtonStyle.Secondary);
          row.addComponents(btn);
        }
        rows.push(row);
      }
      return rows;
    };

    const renderTtt = (desc, disabled = false) =>
      buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: `${ui.getEmoji("arcade") || "🕹️"} Tic-Tac-Toe Minigame`,
        description: desc,
        buttonsRow: buildBoardUI(board, disabled),
        footerText: ui.getFooter("core"),
      });

    await interaction.editReply(
      renderTtt(
        `Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\nKamu adalah ❌. Lawan AI bot ⭕!`,
      ),
    );
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_7", true);

      const pos = parseInt(i.customId.split("_")[1]);
      board[pos] = "X";
      let status = checkWin(board);

      if (!status) {
        const emptySpots = board.filter((s) => s !== "X" && s !== "O");
        if (emptySpots.length > 0) {
          const botMove =
            emptySpots[Math.floor(Math.random() * emptySpots.length)];
          board[botMove] = "O";
          status = checkWin(board);
        }
      }

      if (status) {
        let msg = "";
        if (status === "X") {
          const winNsf = profile.isPremium ? taruhan * 2 : taruhan;
          profile.minigame_tttWin += 1;
          await profile.save({ fields: ["minigame_tttWin"] });
          await cacheManager.incrementUserSurvival(
            user.id,
            "starFragments",
            winNsf,
          );
          msg = `${ui.getEmoji("trophy") || "🏆"} **KAMU MENANG!** Kamu mendapatkan **${(taruhan * 2).toLocaleString()}** ${coinEmoji}.`;
        } else if (status === "O") {
          await cacheManager.debitUserSurvival(
            user.id,
            "starFragments",
            taruhan,
          );
          msg = `${ui.getEmoji("skull") || "💀"} **KAMU KALAH!** Bot AI memenangkan taruhan **${taruhan.toLocaleString()}** ${coinEmoji}.`;
        } else {
          msg = `${ui.getEmoji("handshake") || "🤝"} **SERI!** Permainan imbang, taruhan SC dikembalikan.`;
        }
        await i.update(renderTtt(msg, true));
        collector.stop();
      } else {
        await i.update(
          renderTtt(
            `Taruhan: **${taruhan.toLocaleString()}** ${coinEmoji}\nGiliran berikutnya! Kamu ❌ vs AI ⭕.`,
          ),
        );
        collector.resetTimer();
      }
    });

    collector.on("end", async () => {
      if (checkWin(board) === null) {
        await cacheManager.debitUserSurvival(
          user.id,
          "starFragments",
          taruhan,
        );
        await interaction
          .editReply(
            renderTtt(
              `⏰ **WAKTU HABIS!** Kamu dianggap WO dan kehilangan taruhan.`,
              true,
            ),
          )
          .catch(() => {});
      }
    });
  },
};
