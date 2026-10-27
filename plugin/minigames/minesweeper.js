/**
 * @module MinesweeperMinigame
 * @description Game Minesweeper klasik untuk Discord dengan grid spoiler.
 * 
 * Fitur:
 * - Grid yang dapat disesuaikan (5x5 hingga 14x14)
 * - Kepadatan bom default 15% dari total sel
 * - Emoji angka dan bom menggunakan Unicode
 * - Validasi batas karakter Discord (4000 karakter)
 * 
 * @example
 * // Default grid 9x9
 * /minesweeper
 * 
 * // Custom grid 12x12 dengan 20 bom
 * /minesweeper ukuran:12 bom:20
 * 
 * @author Naura Hoshino Development Team
 * @version 2.4.0
 */

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Konfigurasi default game
 * @type {Object}
 */
const DEFAULT_CONFIG = {
  gridSize: 9,
  bombDensity: 0.15,
  minGridSize: 5,
  maxGridSize: 14,
  maxMessageLength: 4000,
};

/**
 * Emoji angka untuk menampilkan jumlah bom di sekitar sel
 * @type {string[]}
 */
const NUMBER_EMOJIS = [
  "\u0030\ufe0f\u20e3", // 0??
  "\u0031\ufe0f\u20e3", // 1??
  "\u0032\ufe0f\u20e3", // 2??
  "\u0033\ufe0f\u20e3", // 3??
  "\u0034\ufe0f\u20e3", // 4??
  "\u0035\ufe0f\u20e3", // 5??
  "\u0036\ufe0f\u20e3", // 6??
  "\u0037\ufe0f\u20e3", // 7??
  "\u0038\ufe0f\u20e3", // 8??
];

/**
 * Emoji untuk bom
 * @type {string}
 */
const BOMB_EMOJI = "\ud83d\udca5"; // ??

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Membuat grid minesweeper dengan penempatan bom acak
 * @param {number} size - Ukuran grid (size x size)
 * @param {number} bombs - Jumlah bom yang akan ditempatkan
 * @returns {Array<Array<string|number>>} Grid minesweeper
 */
function createGrid(size, bombs) {
  const grid = Array.from({ length: size }, () => Array(size).fill(0));

  // Place bombs randomly
  let bombsPlaced = 0;
  while (bombsPlaced < bombs) {
    const r = Math.floor(Math.random() * size);
    const c = Math.floor(Math.random() * size);
    if (grid[r][c] !== "B") {
      grid[r][c] = "B";
      bombsPlaced++;
    }
  }

  // Calculate numbers for each cell
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

/**
 * Mengonversi grid menjadi string dengan emoji dan spoiler
 * @param {Array<Array<string|number>>} grid - Grid minesweeper
 * @returns {string} Representasi string grid
 */
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

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  isSubcommand: true,
  
  /**
   * Definisi slash command untuk minesweeper
   * @type {import('discord.js').SlashCommandSubcommandBuilder}
   */
  data: new SlashCommandBuilder()
    .setName("minesweeper")
    .setDescription("\ud83d\udca3 Mainkan game Minesweeper klasik di Discord!")
    .addIntegerOption((opt) =>
      opt
        .setName("ukuran")
        .setDescription("Ukuran grid (5-14)")
        .setRequired(false)
        .setMinValue(DEFAULT_CONFIG.minGridSize)
        .setMaxValue(DEFAULT_CONFIG.maxGridSize),
    )
    .addIntegerOption((opt) =>
      opt
        .setName("bom")
        .setDescription("Jumlah bom")
        .setRequired(false)
        .setMinValue(1),
    ),

  /**
   * Handler eksekusi command minesweeper
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const size = interaction.options.getInteger("ukuran") || DEFAULT_CONFIG.gridSize;
    let bombs =
      interaction.options.getInteger("bom") || Math.floor(size * size * DEFAULT_CONFIG.bombDensity);

    // Ensure at least one safe cell
    if (bombs >= size * size) {
      bombs = size * size - 1;
    }

    const grid = createGrid(size, bombs);
    const boardString = gridToString(grid);

    // Check message length limit
    if (boardString.length > DEFAULT_CONFIG.maxMessageLength) {
      const msg = {
        content: "\u274c Grid terlalu besar, melebihi batas karakter Discord.",
        flags: MessageFlags.Ephemeral,
      };
      return interaction.deferred ? interaction.editReply(msg) : interaction.reply(msg);
    }

    const {
      buildContainerV2,
    } = require("../../src/utils/NauraContainerBuilder");

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#95a5a6",
      authorName: "Naura Minesweeper Engine",
      title: `${ui.getEmoji("bomb") || "\ud83d\udca3"} Minesweeper (${size}x${size}) - ${bombs} Bom`,
      description: `Klik blok spoiler di bawah ini untuk mengungkap bidang!\n\n${boardString}`,
      footerText: ui.getFooter("core"),
    });

    if (interaction.deferred || interaction.replied) {
      await interaction.editReply(payload);
    } else {
      await interaction.reply(payload);
    }
  },
};
