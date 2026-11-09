"use strict";
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../../src/managers/cacheManager");
const { genGameId, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "tebakkata",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji, sendError } = context;
    const gameId = genGameId("tebakkata", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    const diff = context.kesulitan || "mudah";
    const { rewards, anagramDB } = require("../helpers/minigameShared");
    const words = anagramDB[diff] || anagramDB.mudah;
    const targetWord = words[Math.floor(Math.random() * words.length)];
    let shuffledWord = targetWord;
    while (shuffledWord === targetWord) shuffledWord = targetWord.split("").sort(() => Math.random() - 0.5).join(" ");
    const conf = diff === "mudah" ? rewards.pemula : rewards.lanjut;
    const rewardCoin = Math.floor(conf.coin * 1.5);
    let attemptsLeft = 3;
    let finished = false;
    await interaction.editReply(buildContainerV2({ accentColorHex: conf.color, title: "Tebak Kata [" + diff.toUpperCase() + "]", description: "Susun kembali huruf-huruf berikut menjadi kata yang benar:\n\n**" + shuffledWord + "**\n\nKetik jawabanmu dalam waktu **" + (conf.time / 1000) + " detik**! Kamu punya 3 kesempatan.\n> Hadiah: **" + rewardCoin + "** " + coinEmoji, footerText: ui.getFooter("core") }));
    const gameStartTime = Date.now();
    const collector = interaction.channel.createMessageCollector({ filter: (m) => m.author.id === user.id, time: conf.time });
    collector.on("collect", async (m) => {
      if (finished) return;
      attemptsLeft--;
      const userAns = String(m.content).replace(/\s+/g, "").trim().toUpperCase();
      const targetAns = String(targetWord).replace(/\s+/g, "").trim().toUpperCase();
      if (userAns === targetAns) {
        finished = true;
        setState(gameId, States.FINISHED);
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1000) {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakkata", "loss"));
          await m.reply(buildContainerV2({ accentColorHex: "#ef4444", title: "ANTI-CHEAT", description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.", footerText: ui.getFooter("core") }));
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakkata", "win"));
        await m.reply(buildContainerV2({ accentColorHex: "#22c55e", authorName: "Tebak Kata [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "SUSUNAN KATA BENAR!", description: "Pintar sekali! Kata yang tepat adalah **" + targetWord + "**.\n\n> Hadiah: +" + rewardNsf + " " + coinEmoji, footerText: ui.getFooter("core") }));
        collector.stop("win");
        return;
      }
      if (attemptsLeft > 0) { await m.reply(buildContainerV2({ accentColorHex: "#f59e0b", title: "Tebakan Kurang Tepat", description: "Sisa kesempatan: **" + attemptsLeft + "**. Coba lagi!", footerText: ui.getFooter("core") })); return; }
      finished = true;
      setState(gameId, States.FINISHED);
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakkata", "loss"));
      await m.reply(buildContainerV2({ accentColorHex: "#ef4444", authorName: "Tebak Kata [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "TEBAKAN SALAH", description: "Kata yang benar adalah **" + targetWord + "**.\nCoba lagi di permainan berikutnya yaa!", footerText: ui.getFooter("core") }));
      collector.stop("lose");
    });
    collector.on("end", async (collected) => {
      if (!finished && collected.size === 0) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakkata", "loss"));
        await interaction.editReply(buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Tebak Kata [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "WAKTU HABIS!", description: "Waktu menyusun kata telah habis!\nKata yang benar adalah **" + targetWord + "**.", footerText: ui.getFooter("core") })).catch(() => {});
      }
    });
  },
};
