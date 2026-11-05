"use strict";

const { MessageFlags } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "hangman",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji } = context;
    const words = [
      "ASTRONOT",
      "KOMPUTER",
      "TELEVISI",
      "MIKROSKOP",
      "HELIKOPTER",
      "METEOROLOGI",
      "KONSTITUSI",
      "UNIVERSITAS",
    ];
    const word = words[Math.floor(Math.random() * words.length)];
    const guessed = [];
    let wrongAttempts = 0;
    const maxAttempts = 6;

    const buildHangmanString = () => {
      let str = "";
      for (const char of word) {
        if (guessed.includes(char)) str += char + " ";
        else str += "_ ";
      }
      return str.trim();
    };

    const renderHangmanStage = (attempts) => {
      const stages = [
        "\n\n\n\n\n\n=========",
        "\n      |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n      |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n      |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n  |   |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n /|\\  |\n      |\n      |\n      |\n=========",
        "  +---+\n  O   |\n /|\\  |\n / \\  |\n      |\n      |\n=========",
      ];
      return stages[attempts];
    };

    const payload = buildContainerV2({
      accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
      title: `${ui.getEmoji("desc") || "🔤"} Hangman`,
      description:
        "Ketik satu huruf untuk menebak kata berikut!\n\n**" +
        buildHangmanString() +
        "**\n\n```" +
        renderHangmanStage(wrongAttempts) +
        "```\n\nKesempatan tersisa: **" +
        (maxAttempts - wrongAttempts) +
        "**",
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);

    const filter = (m) =>
      m.author.id === user.id &&
      m.content.length === 1 &&
      /[a-zA-Z]/.test(m.content);
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (m) => {
      const char = m.content.toUpperCase();
      m.delete().catch(() => {});

      if (guessed.includes(char)) {
        return interaction.followUp({
          content: "Kamu sudah menebak huruf itu!",
          flags: MessageFlags.Ephemeral,
        });
      }

      guessed.push(char);

      if (!word.includes(char)) {
        wrongAttempts++;
      }

      const isWin = word.split("").every((c) => guessed.includes(c));

      if (isWin) {
        const rewardNsf = Math.floor(250 * nsfMultiplier);
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: `${ui.getEmoji("celebrate") || "🎉"} TEPAT SEKALI!`,
          description:
            "Kata yang benar adalah: **" +
            word +
            "**\n\nKamu berhasil menyelamatkannya!\nKamu mendapatkan **" +
            rewardNsf +
            "** " +
            coinEmoji +
            "!",
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(winPayload);
        collector.stop("win");
        return;
      }

      if (wrongAttempts >= maxAttempts) {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          title: `${ui.getEmoji("skull") || "💀"} GAME OVER`,
          description:
            "Kata yang benar adalah: **" +
            word +
            "**\n\n```" +
            renderHangmanStage(wrongAttempts) +
            "```",
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(losePayload);
        collector.stop("lose");
        return;
      }

      const updatePayload = buildContainerV2({
        accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
        title: `${ui.getEmoji("desc") || "🔤"} Hangman`,
        description:
          "Huruf tertebak: " +
          guessed.join(", ") +
          "\n\n**" +
          buildHangmanString() +
          "**\n\n```" +
          renderHangmanStage(wrongAttempts) +
          "```\n\nKesempatan tersisa: **" +
          (maxAttempts - wrongAttempts) +
          "**",
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(updatePayload);
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu bermain telah habis!\nKata yang benar adalah **${word}**.`,
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
