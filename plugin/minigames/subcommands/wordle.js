"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { wordleWords } = require("../helpers/minigameShared");

module.exports = {
  name: "wordle",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = interaction.options.getInteger("taruhan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv
      ? Number(curSurv.starFragments || 0)
      : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan) {
      return sendError(
        `Taruhan tidak valid atau saldo Star Fragments (NSF) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`,
      );
    }

    const targetWord =
      wordleWords[Math.floor(Math.random() * wordleWords.length)];
    let attempts = 0;
    const maxAttempts = 6;
    const gridHistory = [];

    await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);

    const payload = buildContainerV2({
      accentColorHex: "#2b2d31",
      title: "🟩 🟨 ⬛ Naura Wordle (ID)",
      description: `Aku telah memikirkan **Kata 5 Huruf** (Bahasa Indonesia).\nKetik tebakanmu di chat ini!\n\n**Kesempatan:** ${maxAttempts - attempts}\n**Taruhan:** ${taruhan.toLocaleString()} ${coinEmoji} (Menang = 3x Lipat)`,
      footerText: "Ketik 5 huruf sekarang...",
    });

    await interaction.editReply(payload);

    const filter = (m) => m.author.id === user.id && m.content.length === 5;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 60000,
    });

    collector.on("collect", async (m) => {
      const guess = m.content.toUpperCase();
      attempts++;

      let resultRow = "";
      const targetArr = targetWord.split("");
      const guessArr = guess.split("");
      const statusArr = ["⬛", "⬛", "⬛", "⬛", "⬛"];

      for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
          statusArr[i] = "🟩";
          targetArr[i] = null;
          guessArr[i] = null;
        }
      }
      for (let i = 0; i < 5; i++) {
        if (guessArr[i] !== null && targetArr.includes(guessArr[i])) {
          statusArr[i] = "🟨";
          targetArr[targetArr.indexOf(guessArr[i])] = null;
        }
      }

      resultRow = statusArr.join(" ");
      gridHistory.push(`\`${guess}\` | ${resultRow}`);

      if (guess === targetWord) {
        const winMultiplier = profile.isPremium ? 6 : 3;
        const winNsf = taruhan * winMultiplier;
        profile.minigame_wordleWin += 1;
        await profile.save({ fields: ["minigame_wordleWin"] });
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          winNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          title: `${ui.getEmoji("celebrate") || "🎉"} TEPAT SEKALI!`,
          description: `Target Kata: **${targetWord}**\n\n${gridHistory.join("\n")}\n\nKamu memenangkan **${winNsf.toLocaleString()}** ${coinEmoji}!`,
          footerText: ui.getFooter("core"),
        });

        await interaction.followUp(winPayload);
        collector.stop("win");
        return;
      }

      if (attempts >= maxAttempts) {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          title: `${ui.getEmoji("skull") || "💀"} KESEMPATAN HABIS!`,
          description: `Target Kata yang benar adalah: **${targetWord}**\n\n${gridHistory.join("\n")}\n\nKamu kehilangan taruhanmu.`,
          footerText: ui.getFooter("core"),
        });

        await interaction.followUp(losePayload);
        collector.stop("lose");
        return;
      }

      const updatePayload = buildContainerV2({
        accentColorHex: "#2b2d31",
        title: "🟩 🟨 ⬛ Naura Wordle",
        description: `**Riwayat Tebakan:**\n${gridHistory.join("\n")}\n\nSisa kesempatan: **${maxAttempts - attempts}**`,
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(updatePayload);
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU MENEBAK HABIS!`,
          description: `Waktu bermain telah habis!\nTarget Kata yang benar adalah **${targetWord}**.`,
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
