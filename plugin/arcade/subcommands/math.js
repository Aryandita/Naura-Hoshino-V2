"use strict";
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { rewards, generateMath } = require("../helpers/minigameShared");
const { genGameId, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "math",
  async execute(interaction, context) {
    const { user, profile, nsfMultiplier, coinEmoji, sendError } = context;
    const diff = context.kesulitan || (interaction.options?.getString?.("kesulitan")) || "pemula";
    const conf = rewards[diff] || rewards.pemula;
    const gameId = genGameId("math", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    const mathData = generateMath(diff);
    const payload = buildContainerV2({ accentColorHex: conf.color, authorName: "Kuis Matematika [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "Berapa hasil dari: **" + mathData.question + "** ?", description: "Ketik jawabanmu di chat ini! Waktumu hanya **" + (conf.time / 1000) + " detik**. Kamu punya 3 kesempatan.\n\n> Hadiah: **" + conf.coin + "** " + coinEmoji + "\n> Skor: **+" + conf.score + "** Poin", footerText: ui.getFooter("core") });
    await interaction.editReply(payload);
    const gameStartTime = Date.now();
    let attemptsLeft = 3;
    let finished = false;
    const filter = (m) => m.author.id === user.id;
    const collector = interaction.channel.createMessageCollector({ filter, time: conf.time });
    collector.on("collect", async (m) => {
      if (finished) return;
      attemptsLeft--;
      if (String(m.content).replace(/\s+/g, "").trim() === String(mathData.answer)) {
        finished = true;
        setState(gameId, States.FINISHED);
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1500 && diff === "grandmaster") {
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "math", "loss"));
          await m.reply(buildContainerV2({ accentColorHex: "#ef4444", title: "ANTI-CHEAT", description: "Terdeteksi Auto-Typer / Selfbot. Hadiah dibatalkan.", footerText: ui.getFooter("core") }));
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        try { profile.minigame_mathScore = (profile.minigame_mathScore || 0) + conf.score; await profile.save({ fields: ["minigame_mathScore"] }); } catch (e) {}
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "math", "win"));
        await m.reply(buildContainerV2({ accentColorHex: "#22c55e", authorName: "Kuis Matematika [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "HITUNGAN BENAR!", description: "Luar biasa! Hasil hitungan dari **" + mathData.question + "** memang **" + mathData.answer + "**.\n\n> Hadiah: +" + rewardNsf + " " + coinEmoji + "\n> Skor: +" + conf.score + " Poin Math", footerText: ui.getFooter("core") }));
        collector.stop("win");
        return;
      }
      if (attemptsLeft > 0) {
        await m.reply(buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Kuis Matematika", title: "Jawaban Belum Tepat", description: "Sisa kesempatan: **" + attemptsLeft + "**. Coba lagi!", footerText: ui.getFooter("core") }));
        return;
      }
      finished = true;
      setState(gameId, States.FINISHED);
      await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "math", "loss"));
      await m.reply(buildContainerV2({ accentColorHex: "#ef4444", authorName: "Kuis Matematika [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "HITUNGAN SALAH", description: "Jawabanmu belum tepat!\nHasil yang benar dari **" + mathData.question + "** adalah: **" + mathData.answer + "**", footerText: ui.getFooter("core") }));
      collector.stop("lose");
    });
    collector.on("end", async (collected) => {
      if (!finished && collected.size >= 0 && attemptsLeft > 0) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "math", "loss"));
        await interaction.editReply(buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Kuis Matematika [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "WAKTU HABIS!", description: "Waktu berhitung telah habis, <@" + user.id + ">!\nHasil yang benar adalah: **" + mathData.answer + "**.", footerText: ui.getFooter("core") })).catch(() => {});
      }
    });
  },
};
