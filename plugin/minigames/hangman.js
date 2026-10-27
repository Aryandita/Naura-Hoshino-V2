/**
 * @module HangmanMinigame
 * @description Game tebak kata (Hangman) interaktif dengan collector pesan.
 * 
 * Fitur:
 * - Kata acak dari daftar predefined
 * - Visualisasi ASCII art untuk setiap tahap kesalahan
 * - Collector pesan otomatis dengan timeout 5 menit
 * - Deteksi menang/kalah real-time
 * 
 * @example
 * /hangman
 * // Kemudian ketik huruf di chat untuk menebak
 * 
 * @author Naura Hoshino Development Team
 * @version 2.4.0
 */

const { SlashCommandBuilder } = require("discord.js");
const ui = require("../../src/config/ui");

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Daftar kata untuk game hangman
 * @type {string[]}
 */
const WORD_LIST = [
  "DISCORD",
  "JAVASCRIPT",
  "PROGRAMMING",
  "BOT",
  "SERVER",
  "INDONESIA",
  "COMPUTER",
  "INTERNET",
  "DEVELOPER",
  "KEYBOARD",
  "GAMING",
  "ANIME",
  "MUSIC",
  "SYSTEM",
  "DATABASE",
];

/**
 * Jumlah maksimal kesalahan sebelum kalah
 * @type {number}
 */
const MAX_MISTAKES = 6;

/**
 * Timeout collector dalam milidetik (5 menit)
 * @type {number}
 */
const COLLECTOR_TIMEOUT = 300000;

/**
 * Tahapan visual hangman (ASCII art)
 * @type {string[]}
 */
const HANGMAN_STAGES = [
  `\n\n\n\n\n===`,
  `\n  |\n  |\n  |\n  |\n===`,
  `  +---+\n  |\n  |\n  |\n  |\n===`,
  `  +---+\n  |   O\n  |\n  |\n  |\n===`,
  `  +---+\n  |   O\n  |   |\n  |\n  |\n===`,
  `  +---+\n  |   O\n  |  /|\\\n  |\n  |\n===`,
  `  +---+\n  |   O\n  |  /|\\\n  |  / \\\n  |\n===`,
];

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Menghasilkan board hangman saat ini
 * @param {string} word - Kata yang ditebak
 * @param {Set<string>} guessed - Huruf yang sudah ditebak
 * @param {number} mistakes - Jumlah kesalahan saat ini
 * @returns {string} Representasi board dalam code block
 */
function generateBoard(word, guessed, mistakes) {
  const displayWord = word
    .split("")
    .map((char) => (guessed.has(char) ? char : "_"))
    .join(" ");
  return `\`\`\`\n${HANGMAN_STAGES[mistakes]}\n\nKata: ${displayWord}\n\nTebakan: ${Array.from(guessed).join(", ")}\n\`\`\``;
}

/**
 * Memilih kata acak dari daftar
 * @returns {string} Kata acak
 */
function getRandomWord() {
  return WORD_LIST[Math.floor(Math.random() * WORD_LIST.length)];
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  isSubcommand: true,
  
  /**
   * Definisi slash command untuk hangman
   * @type {import('discord.js').SlashCommandSubcommandBuilder}
   */
  data: new SlashCommandBuilder()
    .setName("hangman")
    .setDescription("\ud83d\udd24 Main game tebak kata (Hangman) interaktif."),

  /**
   * Handler eksekusi command hangman
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const word = getRandomWord();
    const guessed = new Set();
    let mistakes = 0;

    const {
      buildContainerV2,
    } = require("../../src/utils/NauraContainerBuilder");

    /**
     * Menghasilkan payload respons hangman
     * @returns {Object} Payload Components V2
     */
    const generatePayload = () => {
      return buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#3498db",
        authorName: "Naura Hangman System",
        title: `${ui.getEmoji("desc") || "\ud83d\udd24"} Hangman Game (Sisa Nyawa: ${MAX_MISTAKES - mistakes})`,
        description: `${generateBoard(word, guessed, mistakes)}\n\n> *Ketik 1 huruf di chat untuk menebak!*`,
        footerText: ui.getFooter("core"),
      });
    };

    await interaction.reply(generatePayload());

    // Filter hanya menerima pesan dari user yang memulai dengan 1 huruf
    const filter = (m) =>
      m.author.id === interaction.user.id &&
      m.content.length === 1 &&
      /[a-zA-Z]/.test(m.content);
    
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: COLLECTOR_TIMEOUT,
    });

    collector.on("collect", async (m) => {
      const char = m.content.toUpperCase();
      m.delete().catch(() => {});

      if (guessed.has(char)) {
        return; // Already guessed
      }

      guessed.add(char);

      if (!word.includes(char)) {
        mistakes++;
      }

      const isWin = word.split("").every((c) => guessed.has(c));
      const isLose = mistakes >= MAX_MISTAKES;

      if (isWin || isLose) {
        collector.stop();

        const finalPayload = buildContainerV2({
          accentColorHex: isWin
            ? ui.getColor("success") || "#00FF00"
            : ui.getColor("error") || "#FF0000",
          authorName: "Naura Hangman System",
          title: isWin
            ? `${ui.getEmoji("trophy") || "\ud83c\udfc6"} Kamu Menang!`
            : `${ui.getEmoji("skull") || "\ud83d\udc80"} Kamu Kalah!`,
          description: `\`\`\`\n${HANGMAN_STAGES[mistakes]}\n\nKata yang benar adalah: ${word}\n\`\`\``,
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(finalPayload);
      } else {
        await interaction.editReply(generatePayload());
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timeoutPayload = buildContainerV2({
          accentColorHex: "#FF0000",
          authorName: "Naura Hangman System",
          title: "\u23f0 Waktu Habis",
          description: `Kamu terlalu lama berpikir! Kata yang benar adalah: **${word}**`,
          footerText: ui.getFooter("core"),
        });
        interaction.editReply(timeoutPayload).catch(() => {});
      }
    });
  },
};
