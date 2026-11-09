"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "akinator",
  async execute(interaction, context) {
    const { user } = context;
    const gameId = genGameId("akinator", user.id);
    setState(gameId, States.WAITING_INPUT);
    let Aki, aki;
    try { ({ Aki } = require("aki-api")); aki = new Aki({ region: "id" }); }
    catch { await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss")); return interaction.editReply(buildErrorContainerV2({ title: "Akinator Sedang Pemeliharaan", description: "Modul Akinator sedang dalam perbaikan paket server. Silakan coba minigame seru lainnya dulu ya!", footerText: ui.getFooter("core") })); }
    await interaction.editReply(buildContainerV2({ accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF", title: "Akinator", iconURL: "https://i.imgur.com/2U5K1r1.png", description: "Sedang memanggil Akinator dari lampu ajaib... Mohon tunggu.", footerText: ui.getFooter("core") }));
    try { await aki.start(); }
    catch { await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss")); return interaction.editReply(buildErrorContainerV2({ title: "Akinator Offline", description: "Akinator sedang tidur atau tidak merespons, coba lagi nanti ya.", footerText: ui.getFooter("core") })); }
    let finished = false;
    let validAnswers = 0;
    const buildAkiUI = () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid(gameId, "aki_0")).setLabel("Ya").setStyle(ButtonStyle.Success),
        new ButtonBuilder().setCustomId(cid(gameId, "aki_1")).setLabel("Tidak").setStyle(ButtonStyle.Danger),
        new ButtonBuilder().setCustomId(cid(gameId, "aki_2")).setLabel("Tidak Tahu").setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId(cid(gameId, "aki_3")).setLabel("Mungkin").setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId(cid(gameId, "aki_4")).setLabel("Mungkin Tidak").setStyle(ButtonStyle.Primary),
      );
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(cid(gameId, "aki_back")).setLabel("Kembali").setStyle(ButtonStyle.Secondary).setDisabled(aki.currentStep === 0),
        new ButtonBuilder().setCustomId(cid(gameId, "aki_stop")).setLabel("Berhenti").setStyle(ButtonStyle.Danger),
      );
      return buildContainerV2({ accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF", title: "Akinator (Pertanyaan ke-" + (aki.currentStep + 1) + ")", description: "**" + aki.question + "**\n\n*Progres: " + Math.round(aki.progress) + "%*", iconURL: "https://i.imgur.com/2U5K1r1.png", buttonsRow: [row, row2], footerText: ui.getFooter("core") });
    };
    await interaction.editReply(buildAkiUI());
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ time: 120000 });
    collector.on("collect", async (i) => {
      if (finished) return;
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_8", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_8", true);
      validAnswers++;
      if (validAnswers > 1) tryReset(collector, gameId);
      await i.deferUpdate();
      try {
        if (parsed.action === "aki_stop") {
          finished = true;
          setState(gameId, States.FINISHED);
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss"));
          collector.stop("stopped");
          return i.editReply(buildErrorContainerV2({ title: "Akinator Dihentikan", description: "Permainan Akinator dihentikan.", footerText: ui.getFooter("core") }));
        }
        if (parsed.action === "aki_back") await aki.back();
        else { const answerId = parseInt(parsed.action.split("_")[1], 10); await aki.step(answerId); }
        if (aki.progress >= 85 || aki.currentStep >= 79) {
          finished = true;
          setState(gameId, States.FINISHED);
          await aki.win();
          const guess = aki.answers[0];
          if (!guess) { await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss")); collector.stop("lose"); return i.editReply(buildErrorContainerV2({ title: "Akinator Menyerah", description: "Akinator menyerah! Dia tidak bisa menebak karaktermu.", footerText: ui.getFooter("core") })); }
          await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "win"));
          collector.stop("win");
          return i.editReply(buildContainerV2({ accentColorHex: "#22c55e", title: "Akinator Berhasil Menebak!", description: "Saya yakin karakter yang kamu pikirkan adalah **" + guess.name + "**\n*" + guess.description + "*", footerText: "Akinator menebak pada percobaan ke-" + aki.currentStep }));
        }
        await i.editReply(buildAkiUI());
      } catch { finished = true; setState(gameId, States.FINISHED); await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss")); collector.stop("error"); return i.editReply(buildErrorContainerV2({ title: "Koneksi Error", description: "Terjadi kesalahan koneksi ke server Akinator.", footerText: ui.getFooter("core") })); }
    });
    collector.on("end", async (collected, reason) => {
      if (reason === "time" && !finished) { setState(gameId, States.EXPIRED); await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "akinator", "loss")); await interaction.editReply(buildErrorContainerV2({ title: "Waktu Habis", description: "Akinator bosan menunggu jawabanmu. Permainan dibatalkan.", footerText: ui.getFooter("core") })).catch(() => {}); }
    });
  },
};
