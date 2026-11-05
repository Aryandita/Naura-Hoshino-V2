"use strict";

const { MessageFlags } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

const DEFAULT_CONFIG = {
  gridSize: 9,
  bombDensity: 0.15,
  minGridSize: 5,
  maxGridSize: 14,
  maxMessageLength: 4000,
};

const NUMBER_EMOJIS = [
  "0️⃣",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
];

const BOMB_EMOJI = "💥";

function createGrid(size, bombs) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  let bombsPlaced = 0;
  while (bombsPlaced < bombs) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (grid[r][c] !== "B") {
      grid[r][c] = "B";
      bombsPlaced++;
    }
  }

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (grid[r][c] === "B") continue;

      let count = 0;
      for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
          if (r + i >= 0 && r + i < size && c + j >= 0 && c + j < size) {
            if (grid[r + i][c + j] === "B") count++;
          }
        }
      }
      grid[r][c] = count;
    }
  }

  return grid;
}

function gridToString(grid) {
  let boardString = "";
  for (let r = 0; r < grid.length; r++) {
    for (let c = 0; c < grid[r].length; c++) {
      const cell = grid[r][c];
      const emoji = cell === "B" ? BOMB_EMOJI : NUMBER_EMOJIS[cell];
      boardString += `||${emoji}||`;
    }
    boardString += "\n";
  }
  return boardString;
}

module.exports = {
  name: "minesweeper",

  async execute(interaction, context) {
    const size =
      (interaction.options && typeof interaction.options.getInteger === "function"
        ? interaction.options.getInteger("ukuran")
        : null) || DEFAULT_CONFIG.gridSize;

    let bombs =
      (interaction.options && typeof interaction.options.getInteger === "function"
        ? interaction.options.getInteger("bom")
        : null) || Math.floor(size * size * DEFAULT_CONFIG.bombDensity);

    if (bombs >= size * size) {
      bombs = size * size - 1;
    }

    const grid = createGrid(size, bombs);
    const boardString = gridToString(grid);

    if (boardString.length > DEFAULT_CONFIG.maxMessageLength) {
      const msg = {
        content: "❌ Grid terlalu besar, melebihi batas karakter Discord.",
        flags: MessageFlags.Ephemeral,
      };
      return interaction.deferred || interaction.replied
        ? interaction.editReply(msg)
        : interaction.reply(msg);
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#95a5a6",
      authorName: "Naura Minesweeper Engine",
      title: `${ui.getEmoji("bomb") || "💣"} Minesweeper (${size}x${size}) - ${bombs} Bom`,
      description: `Klik blok spoiler di bawah ini untuk mengungkap bidang!\n\n${boardString}`,
      footerText: ui.getFooter("core"),
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }
    return interaction.reply(payload);
  },
};

