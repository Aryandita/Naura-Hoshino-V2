"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

const NUMBER_LABELS = ["0","1","2","3","4","5","6","7","8"];
function createGrid(size, bombs) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));
  let placed = 0;
  while (placed < bombs) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (grid[r][c] !== "B") { grid[r][c] = "B"; placed++; }
  }
  for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) {
    if (grid[r][c] === "B") continue;
    let count = 0;
    for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      if (r + i >= 0 && r + i < size && c + j >= 0 && c + j < size && grid[r + i][c + j] === "B") count++;
    }
    grid[r][c] = count;
  }
  return grid;
}

module.exports = {
  name: "minesweeper",
  async execute(interaction, context) {
    const { user, sendError } = context;
    const size = context.ukuran || (interaction.options?.getInteger?.("ukuran")) || 9;
    const bombs = context.bom || (interaction.options?.getInteger?.("bom")) || Math.floor(size * size * 0.15);
    const gameId = genGameId("minesweeper", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (bombs >= size * size) return sendError("Jumlah bom tidak boleh sama dengan total sel.");
    const grid = createGrid(size, bombs);
    const revealed = new Set();
    const flagged = new Set();
    let finished = false;
    let validAnswers = 0;

    function revealAll() { for (let r = 0; r < size; r++) for (let c = 0; c < size; c++) revealed.add(r + "_" + c); }
    function checkWin() { return revealed.size >= size * size - bombs; }

    function buildBoard(disabled) {
      const rows = [];
      for (let r = 0; r < size; r++) {
        const row = new ActionRowBuilder();
        for (let c = 0; c < size; c++) {
          const key = r + "_" + c;
          const isRevealed = revealed.has(key);
          const isFlagged = flagged.has(key);
          let label = "?";
          let style = ButtonStyle.Secondary;
          if (isFlagged) { label = "FLAG"; style = ButtonStyle.Danger; }
          else if (isRevealed) {
            const cell = grid[r][c];
            if (cell === "B") { label = "BOM"; style = ButtonStyle.Danger; }
            else { label = NUMBER_LABELS[cell]; style = cell === 0 ? ButtonStyle.Secondary : ButtonStyle.Primary; }
          }
          btn_add(row, cid(gameId, "cell_" + r + "_" + c), label, style, disabled);
        }
        rows.push(row);
      }
      return rows;
    }
    function btn_add(row, customId, label, style, disabled) {
      const b = new ButtonBuilder().setCustomId(customId).setLabel(label).setStyle(style).setDisabled(!!disabled);
      row.addComponents(b);
    }
    function render(desc, disabled) {
      return buildContainerV2({ accentColorHex: ui.getColor("primary") || "#95a5a6", authorName: "Naura Minesweeper Engine", title: "Minesweeper (" + size + "x" + size + ") - " + bombs + " Bom", description: desc + "\n\nKlik sel untuk membuka. Klik tombol FLAG untuk mode flag.", buttonsRow: buildBoard(disabled), footerText: ui.getFooter("core") });
    }

    let flagMode = false;
    const flagRow = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(cid(gameId, "toggle_flag")).setLabel("FLAG: OFF").setStyle(ButtonStyle.Secondary));
    function renderWithFlag(desc, disabled) {
      const p = render(desc, disabled);
      p.components.push(flagRow);
      return p;
    }

    await interaction.editReply(renderWithFlag("Bongkar papan tanpa meledak! Klik sel untuk membuka. Gunakan FLAG untuk menandai bom."));
    const msg = await interaction.fetchReply();
    const collector = msg.createMessageComponentCollector({ componentType: ComponentType.Button, time: 120000 });

    collector.on("collect", async (i) => {
      if (finished) return;
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_6", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_6", true);
      validAnswers++;
      if (validAnswers > 1) tryReset(collector, gameId);
      if (parsed.action === "toggle_flag") {
        flagMode = !flagMode;
        flagRow.components = [new ButtonBuilder().setCustomId(cid(gameId, "toggle_flag")).setLabel(flagMode ? "FLAG: ON" : "FLAG: OFF").setStyle(flagMode ? ButtonStyle.Danger : ButtonStyle.Secondary)];
        await i.update(renderWithFlag(flagMode ? "Mode FLAG aktif. Klik sel untuk menandai bom." : "Mode FLAG nonaktif. Klik sel untuk membuka."));
        return;
      }
      const parts = parsed.action.split("_");
      if (parts[0] !== "cell") return;
      const r = parseInt(parts[1], 10);
      const c = parseInt(parts[2], 10);
      const key = r + "_" + c;
      if (flagMode) {
        if (revealed.has(key)) return;
        if (flagged.has(key)) flagged.delete(key); else flagged.add(key);
        await i.update(renderWithFlag("Flag: " + flagged.size + "/" + bombs + " ditandai."));
        return;
      }
      if (revealed.has(key) || flagged.has(key)) return;
      if (grid[r][c] === "B") {
        finished = true;
        setState(gameId, States.FINISHED);
        revealAll();
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "minesweeper", "loss"));
        await i.update(renderWithFlag("BOOM! Kamu meledak di sel " + r + "," + c + ". Semua bom terungkap. Coba lagi!"));
        collector.stop("lose");
        return;
      }
      // Flood reveal for zeros
      const stack = [[r, c]];
      while (stack.length) {
        const [cr, cc] = stack.pop();
        const k = cr + "_" + cc;
        if (revealed.has(k) || flagged.has(k)) continue;
        revealed.add(k);
        if (grid[cr][cc] === 0) {
          for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nr = cr + dr, nc = cc + dc;
            if (nr >= 0 && nr < size && nc >= 0 && nc < size && !revealed.has(nr + "_" + nc)) stack.push([nr, nc]);
          }
        }
      }
      if (checkWin()) {
        finished = true;
        setState(gameId, States.FINISHED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "minesweeper", "win"));
        await i.update(renderWithFlag("MENANG! Semua sel aman terbuka. Kerja bagus!"));
        collector.stop("win");
        return;
      }
      await i.update(renderWithFlag("Terbuka " + revealed.size + "/" + (size * size - bombs) + " sel aman. Lanjutkan!"));
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "time" && !finished) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "minesweeper", "loss"));
        await interaction.editReply(renderWithFlag("WAKTU HABIS! Papan ditutup.")).catch(() => {});
      }
    });
  },
};
