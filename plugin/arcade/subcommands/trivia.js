"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { logger } = require("../../../src/managers/logger");
const cacheManager = require("../../../src/managers/cacheManager");
const geminiClient = require("../../../src/ai/geminiClient");
const { ValidationError } = require("../../../src/errors/DomainError");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { rewards, triviaDBFallback } = require("../helpers/minigameShared");
const { genGameId, cid, parseCid, setState, States, rewardOnce } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "trivia",
  async execute(interaction, context) {
    const { user, profile, nsfMultiplier, coinEmoji } = context;
    const diff = context.kesulitan || (interaction.options?.getString?.("kesulitan")) || "pemula";
    const conf = rewards[diff] || rewards.pemula;
    const gameId = genGameId("trivia", user.id);
    setState(gameId, States.WAITING_INPUT);
    let qData;
    try {
      const promptAI = "Buatkan 1 soal kuis trivia pengetahuan umum yang menarik, berbahasa Indonesia, secara acak dengan tingkat kesulitan: " + diff.toUpperCase() + ". Format balasan HARUS berupa JSON murni dengan struktur {q, options, a}.";
      const rawText = await geminiClient.generate({ model: "gemini-2.5-flash", parts: [{ text: promptAI }] });
      const jsonText = (rawText || "").replace(/```json/gi, "").replace(/```/gi, "").trim();
      qData = JSON.parse(jsonText);
      if (!qData.q || !qData.options || !qData.a || !qData.options.includes(qData.a)) throw new ValidationError("Format JSON dari AI tidak valid", { rawText: jsonText });
    } catch (error) {
      logger.error("Gagal generate soal dari AI, memakai soal cadangan:", error);
      const fallbackQuestions = triviaDBFallback[diff] || triviaDBFallback.pemula;
      qData = fallbackQuestions[Math.floor(Math.random() * fallbackQuestions.length)];
    }
    const shuffledOptions = [...qData.options].sort(() => Math.random() - 0.5);
    const correctIndex = shuffledOptions.indexOf(qData.a);
    const row = new ActionRowBuilder().addComponents(shuffledOptions.map((opt, index) => new ButtonBuilder().setCustomId(cid(gameId, "trivia_" + index)).setLabel(opt.length > 80 ? opt.substring(0, 77) + "..." : opt).setStyle(ButtonStyle.Primary)));
    const payload = buildContainerV2({ accentColorHex: conf.color, authorName: "Kuis Trivia AI [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: qData.q, description: "Pilih jawaban yang benar di bawah! Waktu: **" + (conf.time / 1000) + " detik**.\n\n> Hadiah: **" + conf.coin + "** " + coinEmoji + "\n> Skor: **+" + conf.score + "** Poin", buttonsRow: row, footerText: "Soal dibuat khusus oleh Naura AI" });
    await interaction.editReply(payload);
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: conf.time });
    let answered = false;
    collector.on("collect", async (i) => {
      if (answered) return;
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_5", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_5", true);
      answered = true;
      setState(gameId, States.RESOLVING);
      const selectedIndex = parseInt(parsed.action.split("_")[1], 10);
      const newRow = new ActionRowBuilder().addComponents(shuffledOptions.map((opt, index) => { const btn = new ButtonBuilder().setCustomId(cid(gameId, "done_" + index)).setLabel(opt).setDisabled(true); if (index === correctIndex) btn.setStyle(ButtonStyle.Success); else if (index === selectedIndex) btn.setStyle(ButtonStyle.Danger); else btn.setStyle(ButtonStyle.Secondary); return btn; }));
      await i.deferUpdate().catch(() => {});
      if (selectedIndex === correctIndex) {
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        try { profile.minigame_triviaScore = (profile.minigame_triviaScore || 0) + conf.score; await profile.save({ fields: ["minigame_triviaScore"] }); } catch (e) {}
        await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "trivia", "win"));
        setState(gameId, States.FINISHED);
        const winPayload = buildContainerV2({ accentColorHex: "#22c55e", authorName: "Kuis Trivia AI [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "JAWABAN TEPAT SEKALI!", description: "Hebat! Jawabanmu **" + qData.a + "** adalah benar!\n\n> Hadiah: +" + rewardNsf + " " + coinEmoji + "\n> Skor: +" + conf.score + " Poin", buttonsRow: newRow, footerText: ui.getFooter("core") });
        await interaction.editReply(winPayload);
      } else {
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "trivia", "loss"));
        setState(gameId, States.FINISHED);
        const losePayload = buildContainerV2({ accentColorHex: "#ef4444", authorName: "Kuis Trivia AI [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "JAWABAN KURANG TEPAT", description: "Sayang sekali! Jawaban yang benar adalah **" + qData.a + "**.\nTetap semangat dan coba lagi yaa!", buttonsRow: newRow, footerText: ui.getFooter("core") });
        await interaction.editReply(losePayload);
      }
      collector.stop("answered");
    });
    collector.on("end", async (collected, reason) => {
      if (reason !== "answered" && !answered) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "trivia", "loss"));
        const disabledRow = new ActionRowBuilder().addComponents(shuffledOptions.map((opt, index) => new ButtonBuilder().setCustomId(cid(gameId, "exp_" + index)).setLabel(opt).setStyle(index === correctIndex ? ButtonStyle.Success : ButtonStyle.Secondary).setDisabled(true)));
        const timePayload = buildContainerV2({ accentColorHex: "#f59e0b", authorName: "Kuis Trivia AI [" + diff.toUpperCase() + "]", iconURL: user.displayAvatarURL(), title: "WAKTU HABIS!", description: "Waktu berpikirmu telah habis!\nJawaban yang benar adalah **" + qData.a + "**.", buttonsRow: disabledRow, footerText: ui.getFooter("core") });
        interaction.editReply(timePayload).catch(() => {});
      }
    });
  },
};
