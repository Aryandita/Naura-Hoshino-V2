"use strict";
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../../src/managers/cacheManager");
const { tebakGambarDB } = require("../helpers/minigameShared");
const { genGameId, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "tebakgambar",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji, sendError } = context;
    const gameId = genGameId("tebakgambar", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    const gameData = tebakGambarDB[Math.floor(Math.random() * tebakGambarDB.length)];
    const rewardCoin = 250;
    let attemptsLeft = 3;
    let finished = false;
    await interaction.editReply(buildContainerV2({ accentColorHex: ui.getColor ? ui.getColor("primary") : "#00FFFF", title: "Tebak Gambar Objek", description: "Ketik apa objek yang ada pada gambar di atas!\n\nKlu: " + gameData.clue + "\n\nWaktu: **20 detik**, 3 kesempatan.\n> Hadiah: **" + rewardCoin + "** " + coinEmoji, footerText: ui.getFooter("core") }));
    const gameStartTime = Date.now();
    const collector = interaction.channel.createMessageCollector({ filter: (m) => m.author.id === user.id, time: 20000 });
    collector.on("collect", async (m) => {
      if (finished) return;
      attemptsLeft--;
      const userAns = String(m.content).replace(/\s+/g, "").trim().toLowerCase();
      const targetAns = String(gameData.answer).replace(/\s+/g, "").trim().toLowerCase();
      if (userAns === targetAns) {
        finished = true;
        setState(gameId, States.FINISHED);
        if (Date.now() - gameStartTime < 1000) {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakgambar", "loss"));
          await m.reply(buildContainerV2({ accentColorHex: "#ef4444", title: "ANTI-CHEAT", description: "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.", footerText: ui.getFooter("core") }));
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakgambar", "win"));
        await m.reply(buildContainerV2({ accentColorHex: "#22c55e", authorName: "Tebak Gambar Objek", iconURL: user.displayAvatarURL(), title: "TEBAKAN OBJEK BENAR!", description: "Hebat! Objek pada gambar tersebut memang **" + gameData.answer + "**.\n\n> Hadiah: +" + rewardNsf + " " + coinEmoji, footerText: ui.getFooter("core") }));
        collector.stop("win");
        return;
      }
      if (attemptsLeft > 0) { await m.reply(buildContainerV2({ accentColorHex: "#f59e0b", title: "Tebakan Kurang Tepat", description: "Sisa kesempatan: **" + attemptsLeft + "**. Coba lagi!", footerText: ui.getFooter("core") })); return; }
      finished = true;
      setState(gameId, States.FINISHED);
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakgambar", "loss"));
      await m.reply(buildContainerV2({ accentColorHex: "#ef4444", authorName: "Tebak Gambar Objek", iconURL: user.displayAvatarURL(), title: "TEBAKAN SALAH", description: "Bukan itu objeknya!\nJawaban yang benar adalah **" + gameData.answer + "**.", footerText: ui.getFooter("core") }));
      collector.stop("lose");
    });
    collector.on("end", async (collected) => {
      if (!finished && collected.size === 0) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "tebakgambar", "loss"));
        await interaction.editReply(buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Tebak Gambar Objek", iconURL: user.displayAvatarURL(), title: "WAKTU HABIS!", description: "Waktu menebak telah habis!\nObjek yang benar adalah **" + gameData.answer + "**.", footerText: ui.getFooter("core") })).catch(() => {});
      }
    });
  },
};
