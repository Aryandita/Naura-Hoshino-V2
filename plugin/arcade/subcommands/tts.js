"use strict";
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../../src/managers/cacheManager");
const { ttsDB } = require("../helpers/minigameShared");
const { genGameId, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "tts",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji, sendError } = context;
    const gameId = genGameId("tts", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    const gameData = ttsDB[Math.floor(Math.random() * ttsDB.length)];
    const rewardCoin = 400;
    let attemptsLeft = 3;
    let finished = false;
    await interaction.editReply(buildContainerV2({ accentColorHex: "#FF00FF", title: "Teka Teki Silang Mini", description: "Jawablah kedua klu di bawah ini secara berurutan, pisahkan dengan **spasi**.\n(Contoh jawaban: `buku pensil`)\n\n" + gameData.clue + "\n\nWaktu: **25 detik**, 3 kesempatan.\n> Hadiah: **" + rewardCoin + "** " + coinEmoji, footerText: ui.getFooter("core") }));
    const gameStartTime = Date.now();
    const collector = interaction.channel.createMessageCollector({ filter: (m) => m.author.id === user.id, time: 25000 });
    collector.on("collect", async (m) => {
      if (finished) return;
      attemptsLeft--;
      const userAns = String(m.content).replace(/\s+/g, "").trim().toLowerCase();
      const targetAns = String(gameData.answer).replace(/\s+/g, "").trim().toLowerCase();
      if (userAns === targetAns) {
        finished = true;
        setState(gameId, States.FINISHED);
        if (Date.now() - gameStartTime < 1000) {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tts", "loss"));
          await m.reply(buildContainerV2({ accentColorHex: "#ef4444", title: "ANTI-CHEAT", description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.", footerText: ui.getFooter("core") }));
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tts", "win"));
        await m.reply(buildContainerV2({ accentColorHex: "#22c55e", authorName: "Teka Teki Silang Mini", iconURL: user.displayAvatarURL(), title: "JAWABAN TTS TEPAT!", description: "Luar biasa! Kamu berhasil memecahkan TTS ini dengan sempurna.\n\n> Kunci: `" + gameData.answer + "`\n> Hadiah: +" + rewardNsf + " " + coinEmoji, footerText: ui.getFooter("core") }));
        collector.stop("win");
        return;
      }
      if (attemptsLeft > 0) { await m.reply(buildContainerV2({ accentColorHex: "#f59e0b", title: "Jawaban Belum Tepat", description: "Sisa kesempatan: **" + attemptsLeft + "**. Coba lagi!", footerText: ui.getFooter("core") })); return; }
      finished = true;
      setState(gameId, States.FINISHED);
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tts", "loss"));
      await m.reply(buildContainerV2({ accentColorHex: "#ef4444", authorName: "Teka Teki Silang Mini", iconURL: user.displayAvatarURL(), title: "JAWABAN TTS SALAH", description: "Jawabanmu belum sesuai dengan kedua klu.\nJawaban yang tepat adalah: **" + gameData.answer + "**", footerText: ui.getFooter("core") }));
      collector.stop("lose");
    });
    collector.on("end", async (collected) => {
      if (!finished && collected.size === 0) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tts", "loss"));
        await interaction.editReply(buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Teka Teki Silang Mini", iconURL: user.displayAvatarURL(), title: "WAKTU HABIS!", description: "Waktu menyelesaikan TTS telah habis!\nJawaban yang benar adalah **" + gameData.answer + "**.", footerText: ui.getFooter("core") })).catch(() => {});
      }
    });
  },
};
