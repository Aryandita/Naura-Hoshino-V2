"use strict";
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { wordleWords } = require("../helpers/minigameShared");
const { genGameId, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "wordle",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = context.taruhan || (interaction.options?.getInteger?.("taruhan")) || 0;
    const gameId = genGameId("wordle", user.id);
    setState(gameId, States.WAITING_INPUT);
    if (!interaction.channel) return sendError("Channel tidak tersedia.");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv ? Number(curSurv.starFragments || 0) : Number(survival.starFragments || 0);
    if (taruhan > 0) {
      if (curNsf < taruhan) return sendError("Saldo Star Fragments (NSF) tidak cukup untuk taruhan **" + taruhan.toLocaleString() + "**! (Saldo: " + curNsf.toLocaleString() + " " + nsfEmoji + ")");
      const debitRes = await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
      if (!debitRes || !debitRes.ok) return sendError("Gagal memotong taruhan di muka.");
    }
    const targetWord = wordleWords[Math.floor(Math.random() * wordleWords.length)];
    let attempts = 0;
    const maxAttempts = 6;
    const gridHistory = [];
    const desc = ["Aku telah memikirkan **Kata 5 Huruf** (Bahasa Indonesia).", "Ketik tebakanmu di chat ini!", "", "**Kesempatan:** " + (maxAttempts - attempts), taruhan > 0 ? "**Taruhan:** " + taruhan.toLocaleString() + " " + coinEmoji + " (Menang = 3x Lipat)" : "**Mode:** Arcade Game (Hadiah +25 MP)"].join("\n");
    const payload = buildContainerV2({ accentColorHex: "#2b2d31", title: "Naura Wordle (ID)", description: desc, footerText: "Ketik 5 huruf sekarang..." });
    await interaction.editReply(payload);
    const filter = (m) => m.author.id === user.id && m.content.length === 5;
    const collector = interaction.channel.createMessageCollector({ filter, time: 60000 });
    let validAnswers = 0;
    collector.on("collect", async (m) => {
      const guess = m.content.toUpperCase();
      attempts++;
      validAnswers = attempts;
      const targetArr = targetWord.split("");
      const guessArr = guess.split("");
      const statusArr = ["PUTIH", "PUTIH", "PUTIH", "PUTIH", "PUTIH"];
      for (let i = 0; i < 5; i++) if (guessArr[i] === targetArr[i]) { statusArr[i] = "HIJAU"; targetArr[i] = null; guessArr[i] = null; }
      for (let i = 0; i < 5; i++) if (guessArr[i] !== null && targetArr.includes(guessArr[i])) { statusArr[i] = "KUNING"; targetArr[targetArr.indexOf(guessArr[i])] = null; }
      gridHistory.push("`" + guess + "` | " + statusArr.join(" "));
      if (guess === targetWord) {
        setState(gameId, States.FINISHED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "wordle", "win"));
        let rewardDesc = "Hadiah Arcade: +25 MP";
        try { profile.minigame_wordleWin = (profile.minigame_wordleWin || 0) + 1; await profile.save({ fields: ["minigame_wordleWin"] }); } catch (e) {}
        if (taruhan > 0) { const winMultiplier = profile.isPremium ? 6 : 3; const winNsf = taruhan * winMultiplier; await cacheManager.incrementUserSurvival(user.id, "starFragments", winNsf); rewardDesc += " | Menang taruhan **+" + winNsf.toLocaleString() + "** " + coinEmoji + "!"; }
        const winPayload = buildContainerV2({ accentColorHex: "#22c55e", title: "TEPAT SEKALI!", description: "Target Kata: **" + targetWord + "**\n\n" + gridHistory.join("\n") + "\n\n" + rewardDesc, footerText: ui.getFooter("core") });
        await interaction.editReply(winPayload);
        collector.stop("win");
        return;
      }
      if (attempts >= maxAttempts) {
        setState(gameId, States.FINISHED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "wordle", "loss"));
        const losePayload = buildContainerV2({ accentColorHex: "#ef4444", title: "KESEMPATAN HABIS!", description: "Target Kata yang benar adalah: **" + targetWord + "**\n\n" + gridHistory.join("\n") + "\n\n" + (taruhan > 0 ? "Kamu kehilangan taruhanmu." : "Coba lagi di ronde berikutnya!"), footerText: ui.getFooter("core") });
        await interaction.editReply(losePayload);
        collector.stop("lose");
        return;
      }
      const updatePayload = buildContainerV2({ accentColorHex: "#2b2d31", title: "Naura Wordle", description: "**Riwayat Tebakan:**\n" + gridHistory.join("\n") + "\n\nSisa kesempatan: **" + (maxAttempts - attempts) + "**", footerText: ui.getFooter("core") });
      await interaction.editReply(updatePayload);
      if (validAnswers > 1) tryReset(collector, gameId);
    });
    collector.on("end", async (collected, reason) => {
      if (reason === "time") {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "wordle", "loss"));
        const timePayload = buildContainerV2({ accentColorHex: "#f59e0b", title: "WAKTU MENEBAK HABIS!", description: "Waktu bermain telah habis!\nTarget Kata yang benar adalah **" + targetWord + "**. " + (taruhan > 0 ? "Taruhan hilang." : ""), footerText: ui.getFooter("core") });
        await interaction.editReply(timePayload).catch(() => {});
      }
    });
  },
};
