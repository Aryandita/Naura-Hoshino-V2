/**
 * @module ArcadeMinigame
 * @description Sistem Holo-Arcade dengan mini-game interaktif dan taruhan MP.
 * 
 * Fitur yang tersedia:
 * - Cyber Trivia Royale: Kuis anime/gaming dengan taruhan opsional
 * - Rhythm Tap: Game mengikuti pola warna berurutan
 * - Cyber Roulette: Taruhan pada warna atau angka (0-36)
 * 
 * Mata Uang:
 * - Menggunakan MP (MP) untuk taruhan
 * - Sesi game disimpan di Redis dengan TTL 60 detik
 * 
 * @example
 * // Main trivia tanpa taruhan
 * /arcade trivia
 * 
 * // Main roulette dengan taruhan
 * /arcade roulette choice:RED bet:100
 * 
 * @author Naura Hoshino Development Team
 * @version 2.4.0
 */

"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const crypto = require("crypto");
const ArcadeEngine = require("../../src/arcade/arcadeEngine");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const redisManager = require("../../src/managers/redisManager");
const arcadeContract = require("../../src/domain/contracts/arcadeContract");

// ============================================================================
// CONSTANTS
// ============================================================================

/**
 * Konfigurasi taruhan
 * @type {Object}
 */
const BET_CONFIG = {
  minValue: 10,
  maxValue: 50000,
};

/**
 * Pilihan warna valid untuk roulette
 * @type {string[]}
 */
const ROULETTE_COLORS = ["RED", "BLACK", "GREEN"];

/**
 * TTL sesi game di Redis (detik)
 * @type {number}
 */
const SESSION_TTL = 60;

/**
 * Emoji untuk warna roulette
 * @type {Object<string, string>}
 */
const COLOR_EMOJIS = {
  RED: "\ud83d\udd34",
  BLACK: "\u26ab",
  GREEN: "\ud83d\udfe2",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Menghasilkan session ID unik
 * @returns {string} Session ID hex (12 karakter)
 */
function generateSessionId() {
  return crypto.randomBytes(6).toString("hex");
}

/**
 * Memvalidasi pilihan roulette
 * @param {string} choice - Pilihan user
 * @returns {boolean} True jika valid
 */
function isValidRouletteChoice(choice) {
  if (ROULETTE_COLORS.includes(choice)) return true;
  const numChoice = parseInt(choice, 10);
  return !isNaN(numChoice) && numChoice >= 0 && numChoice <= 36;
}

// ============================================================================
// MODULE EXPORTS
// ============================================================================

module.exports = {
  /**
   * Definisi slash command untuk arcade
   * @type {import('discord.js').SlashCommandSubcommandBuilder}
   */
  data: new SlashCommandBuilder()
    .setName("holo-arcade")
    .setDescription(
      "\ud83d\udd79\ufe0f Holo-Arcade: Mainkan mini-game interaktif dan kumpulkan MP!",
    )
    .addSubcommand((sub) =>
      sub
        .setName("trivia")
        .setDescription(
          "\ud83e\udde0 Cyber Trivia Royale: Jawab kuis anime/gaming dengan cepat!",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Taruhan MP (Opsional)")
            .setMinValue(BET_CONFIG.minValue)
            .setMaxValue(BET_CONFIG.maxValue)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("rhythm")
        .setDescription(
          "\ud83c\udfb6 Rhythm Tap: Ikuti urutan tombol warna cyber yang muncul!",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Taruhan MP (Opsional)")
            .setMinValue(BET_CONFIG.minValue)
            .setMaxValue(BET_CONFIG.maxValue)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("roulette")
        .setDescription(
          "\ud83c\udfb0 Cyber Roulette: Pasang taruhan pada warna atau angka keberuntungan!",
        )
        .addStringOption((opt) =>
          opt
            .setName("choice")
            .setDescription(
              "Pilihan taruhan (RED, BLACK, GREEN, atau angka 0-36)",
            )
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Jumlah taruhan MP")
            .setMinValue(BET_CONFIG.minValue)
            .setMaxValue(BET_CONFIG.maxValue)
            .setRequired(true),
        ),
    ),

  /**
   * Handler eksekusi command arcade
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Discord interaction
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    // Helper untuk mengirim error ephemeral
    const sendEphemeralError = async (title, description) => {
      return interaction.reply({
        ...buildErrorContainerV2({
          title,
          description,
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    };

    // ========================================================================
    // ROULETTE SUBCOMMAND
    // ========================================================================
    if (subcommand === "roulette") {
      const choice = interaction.options
        .getString("choice")
        .trim()
        .toUpperCase();
      const bet = interaction.options.getInteger("bet");

      if (!isValidRouletteChoice(choice)) {
        return sendEphemeralError(
          "Pilihan Roulette Tidak Valid",
          "Pilihan harus berupa `RED`, `BLACK`, `GREEN`, atau angka antara `0` sampai `36`.",
        );
      }

      await interaction.deferReply();

      const chargeResult = await arcadeContract.chargeGameFee(userId, bet);
      if (!chargeResult.ok) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Saldo MP Kurang",
            description: `Anda membutuhkan **${bet} MP** untuk bermain roulette.`,
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const result = ArcadeEngine.spinRoulette(choice, bet);

      if (result.isWon) {
        await require("../../src/managers/cacheManager").incrementUserProfile(userId, { medaliPermainan: result.payout });
      }

      const colorEmoji = COLOR_EMOJIS[result.color] || "";
      const statusText = result.isWon
        ? `\ud83c\udf89 **SELAMAT! ANDA MENANG!**\n\ud83d\udcb0 Payout (${result.multiplier}x): **+${result.payout} MP** \ud83c\udf1f`
        : `\ud83d\udc80 **Sayang sekali, Anda kalah!**\nKehilangan **-${bet} MP**. Coba lagi di putaran berikutnya!`;

      const payload = buildContainerV2({
        accentColorHex: result.isWon ? "#FFD700" : "#E74C3C",
        title: "\ud83c\udfb0 Cyber Roulette Wheel Spin!",
        description: "Bola berhenti di angka: " + colorEmoji + " **" + result.number + " (" + result.color + ")**\nTaruhan Anda: `" + choice + "` (" + bet + " MP)\n\n" + statusText,
        footerText: "Holo-Arcade Casino Engine",
      });

      return interaction.editReply(payload);
    }

    // ========================================================================
    // TRIVIA SUBCOMMAND
    // ========================================================================
    if (subcommand === "trivia") {
      const bet = interaction.options.getInteger("bet") || 0;
      await interaction.deferReply();

      if (bet > 0) {
        const chargeResult = await arcadeContract.chargeGameFee(userId, bet);
        if (!chargeResult.ok) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Saldo MP Kurang",
              description: `Anda membutuhkan **${bet} MP** untuk taruhan kuis ini.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
      }

      const trivia = ArcadeEngine.getRandomTrivia();
      const sessionId = generateSessionId();

      const sessionData = {
        userId,
        bet,
        answerIndex: trivia.answerIndex,
      };

      await redisManager.set(
        `arcade:trivia:${sessionId}`,
        JSON.stringify(sessionData),
        "EX",
        SESSION_TTL,
      );

      const actionRow = new ActionRowBuilder();
      trivia.options.forEach((opt, idx) => {
        actionRow.addComponents(
          new ButtonBuilder()
            .setCustomId(`arcade_trivia_${sessionId}_${idx}`)
            .setLabel(`${idx + 1}. ${opt}`)
            .setStyle(ButtonStyle.Primary),
        );
      });

      const payload = buildContainerV2({
        accentColorHex: "#93C5FD",
        title: `\ud83e\udde0 Cyber Trivia Royale [${trivia.category}]`,
        description: "**Pertanyaan:**\n" + trivia.q + "\n\n\u23f1\ufe0f *Waktu menjawab: 60 detik!*\n\ud83d\udcb0 *Taruhan:* `" + bet + " MP`",
        footerText: "Holo-Arcade Quiz Engine",
        buttonsRow: actionRow,
      });

      return interaction.editReply(payload);
    }

    // ========================================================================
    // RHYTHM SUBCOMMAND
    // ========================================================================
    if (subcommand === "rhythm") {
      const bet = interaction.options.getInteger("bet") || 0;
      await interaction.deferReply();

      if (bet > 0) {
        const chargeResult = await arcadeContract.chargeGameFee(userId, bet);
        if (!chargeResult.ok) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Saldo MP Kurang",
              description: `Anda membutuhkan **${bet} MP** untuk bermain Rhythm Tap.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
      }

      const sequence = ArcadeEngine.generateRhythmSequence(4);
      const sessionId = generateSessionId();

      const sessionData = {
        userId,
        bet,
        targetSequence: sequence.map((s) => s.color),
        userInputs: [],
      };

      await redisManager.set(
        `arcade:rhythm:${sessionId}`,
        JSON.stringify(sessionData),
        "EX",
        SESSION_TTL,
      );

      const displayPattern = sequence.map((s) => s.emoji).join("  ");

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_RED`)
          .setLabel("\ud83d\udd34 Red")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_BLUE`)
          .setLabel("\ud83d\udd35 Blue")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_GREEN`)
          .setLabel("\ud83d\udfe2 Green")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_YELLOW`)
          .setLabel("\ud83d\udfe1 Yellow")
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        title: `${ui.getEmoji("music_note") || "\ud83c\udfb6"} Rhythm Tap: Ikuti Pola Warna!`,
        description: `Tekan tombol warna berikut secara berurutan:\n\n# ${displayPattern}\n\n${ui.getEmoji("clock") || "\u23f1\ufe0f"} *Tekan tombol sesuai urutan dari kiri ke kanan!*`,
        footerText: "Holo-Arcade Rhythm Engine",
        buttonsRow: actionRow,
      });

      return interaction.editReply(payload);
    }
  },
};