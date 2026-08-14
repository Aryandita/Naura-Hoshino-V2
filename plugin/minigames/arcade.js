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
const currency = require("../../src/survival/engines/currency");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("arcade")
    .setDescription(
      "🕹️ Holo-Arcade: Mainkan mini-game interaktif dan kumpulkan Star Fragments!",
    )
    .addSubcommand((sub) =>
      sub
        .setName("trivia")
        .setDescription(
          "🧠 Cyber Trivia Royale: Jawab kuis anime/gaming dengan cepat!",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Taruhan Star Fragments (Opsional)")
            .setMinValue(10)
            .setMaxValue(50000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("rhythm")
        .setDescription(
          "🎶 Rhythm Tap: Ikuti urutan tombol warna cyber yang muncul!",
        )
        .addIntegerOption((opt) =>
          opt
            .setName("bet")
            .setDescription("Taruhan Star Fragments (Opsional)")
            .setMinValue(10)
            .setMaxValue(50000)
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("roulette")
        .setDescription(
          "🎰 Cyber Roulette: Pasang taruhan pada warna atau angka keberuntungan!",
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
            .setDescription("Jumlah taruhan Star Fragments")
            .setMinValue(10)
            .setMaxValue(50000)
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    if (subcommand === "roulette") {
      const choice = interaction.options
        .getString("choice")
        .trim()
        .toUpperCase();
      const bet = interaction.options.getInteger("bet");

      const validColors = ["RED", "BLACK", "GREEN"];
      const numChoice = parseInt(choice, 10);
      const isValidNum = !isNaN(numChoice) && numChoice >= 0 && numChoice <= 36;

      if (!validColors.includes(choice) && !isValidNum) {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Pilihan Roulette Tidak Valid",
            description:
              "Pilihan harus berupa `RED`, `BLACK`, `GREEN`, atau angka antara `0` sampai `36`.",
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferReply();

      const canDebit = await currency.charge(
        userId,
        { starFragments: bet },
        "Arcade Roulette Bet",
      );
      if (!canDebit) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Saldo Star Fragments Kurang",
            description: `Anda membutuhkan **${bet} Star Fragments** untuk bermain roulette.`,
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const result = ArcadeEngine.spinRoulette(choice, bet);

      if (result.isWon) {
        await currency.reward(
          userId,
          { starFragments: result.payout },
          "Arcade Roulette Win",
        );
      }

      const colorEmoji =
        result.color === "RED" ? "🔴" : result.color === "BLACK" ? "⚫" : "🟢";
      const statusText = result.isWon
        ? `🎉 **SELAMAT! ANDA MENANG!**\n💰 Payout (${result.multiplier}x): **+${result.payout} Star Fragments** 🌟`
        : `💀 **Sayang sekali, Anda kalah!**\nKehilangan **-${bet} Star Fragments**. Coba lagi di putaran berikutnya!`;

      const payload = buildContainerV2({
        accentColorHex: result.isWon ? "#FFD700" : "#E74C3C",
        title: "🎰 Cyber Roulette Wheel Spin!",
        description: `Bola berhenti di angka: ${colorEmoji} **${result.number} (${result.color})**\nTaruhan Anda: \`${choice}\` (${bet} NSF)\n\n${statusText}`,
        footerText: "Holo-Arcade Casino Engine",
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "trivia") {
      const bet = interaction.options.getInteger("bet") || 0;
      await interaction.deferReply();

      if (bet > 0) {
        const canDebit = await currency.charge(
          userId,
          { starFragments: bet },
          "Arcade Trivia Bet Escrow",
        );
        if (!canDebit) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Saldo Kurang",
              description: `Anda membutuhkan **${bet} Star Fragments** untuk taruhan kuis ini.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
      }

      const trivia = ArcadeEngine.getRandomTrivia();
      const sessionId = crypto.randomBytes(6).toString("hex");

      const sessionData = {
        userId,
        bet,
        answerIndex: trivia.answerIndex,
      };

      await redisManager.set(
        `arcade:trivia:${sessionId}`,
        JSON.stringify(sessionData),
        "EX",
        60,
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
        title: `🧠 Cyber Trivia Royale [${trivia.category}]`,
        description: `**Pertanyaan:**\n${trivia.q}\n\n⏱️ *Waktu menjawab: 60 detik!*\n💰 *Taruhan:* \`${bet} Star Fragments\``,
        footerText: "Holo-Arcade Quiz Engine",
        buttonsRow: actionRow,
      });

      return interaction.editReply({ ...payload, components: [actionRow] });
    }

    if (subcommand === "rhythm") {
      const bet = interaction.options.getInteger("bet") || 0;
      await interaction.deferReply();

      if (bet > 0) {
        const canDebit = await currency.charge(
          userId,
          { starFragments: bet },
          "Arcade Rhythm Bet Escrow",
        );
        if (!canDebit) {
          return interaction.editReply({
            ...buildErrorContainerV2({
              title: "Saldo Kurang",
              description: `Anda membutuhkan **${bet} Star Fragments** untuk bermain Rhythm Tap.`,
              footerText: ui.getFooter("core"),
            }),
          });
        }
      }

      const sequence = ArcadeEngine.generateRhythmSequence(4);
      const sessionId = crypto.randomBytes(6).toString("hex");

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
        60,
      );

      const displayPattern = sequence.map((s) => s.emoji).join("  ");

      const actionRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_RED`)
          .setLabel("🔴 Red")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_BLUE`)
          .setLabel("🔵 Blue")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_GREEN`)
          .setLabel("🟢 Green")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`arcade_rhythm_${sessionId}_YELLOW`)
          .setLabel("🟡 Yellow")
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: "#F9A8D4",
        title: "🎶 Rhythm Tap: Ikuti Pola Warna!",
        description: `Tekan tombol warna berikut secara berurutan:\n\n# ${displayPattern}\n\n⏱️ *Tekan tombol sesuai urutan dari kiri ke kanan!*`,
        footerText: "Holo-Arcade Rhythm Engine",
        buttonsRow: actionRow,
      });

      return interaction.editReply({ ...payload, components: [actionRow] });
    }
  },
};
