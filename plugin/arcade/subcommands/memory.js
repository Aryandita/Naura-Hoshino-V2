"use strict";
const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { genGameId, cid, parseCid, setState, States, rewardOnce, tryReset } = require("../../../src/arcade/arcadeSession");
const ArcadeEngine = require("../../../src/arcade/arcadeEngine");

module.exports = {
  name: "memory",
  async execute(interaction, context) {
    const { user, profile, coinEmoji } = context;
    const gameId = genGameId("memory", user.id);
    setState(gameId, States.WAITING_INPUT);
    const emojis = ["APEL","PISANG","ANGGUR","SEMANGKA","STROBERI","CERI"];
    const board = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let flipped = [];
    const matched = [];
    let attempts = 0;
    let finished = false;
    const buildMemoryBoard = (disableAll) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 4; j++) {
          const idx = i * 4 + j;
          const isFlipped = flipped.includes(idx) || matched.includes(idx);
          row.addComponents(new ButtonBuilder().setCustomId(cid(gameId, "mem_" + idx)).setLabel(isFlipped ? board[idx] : "?").setStyle(matched.includes(idx) ? ButtonStyle.Success : isFlipped ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled(disableAll || isFlipped));
        }
        rows.push(row);
      }
      return rows;
    };
    const renderMemory = (desc, disabled) => buildContainerV2({ accentColorHex: ui.getColor("primary") || "#00FFFF", title: "Memory Match", description: desc, buttonsRow: buildMemoryBoard(disabled), footerText: ui.getFooter("core") });
    await interaction.editReply(renderMemory("Cocokkan pasangan!\nPercobaan: **" + attempts + "**"));
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });
    collector.on("collect", async (i) => {
      if (finished) return;
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_9", true);
      const parsed = parseCid(i.customId);
      if (!parsed || parsed.gameId !== gameId) return ui.sendError(i, "err_sys_9", true);
      const idx = parseInt(parsed.action.split("_")[1], 10);
      if (flipped.includes(idx) || matched.includes(idx)) return;
      flipped.push(idx);
      if (flipped.length === 2) {
        attempts++;
        await i.update(renderMemory("Cocokkan pasangan!\nPercobaan: **" + attempts + "**", true));
        const [first, second] = flipped;
        if (board[first] === board[second]) matched.push(first, second);
        setTimeout(async () => {
          if (finished) return;
          flipped = [];
          const isWin = matched.length === board.length;
          if (isWin) {
            finished = true;
            setState(gameId, States.FINISHED);
            const rewardNsf = profile.isPremium ? 500 : 250;
            await cacheManager.incrementUserSurvival(user.id, "starFragments", rewardNsf);
            await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "memory", "win"));
            await interaction.editReply(renderMemory("Berhasil mencocokkan semua dalam **" + attempts + "** percobaan!\nKamu mendapat **" + rewardNsf + "** " + coinEmoji + "!", true));
            collector.stop("win");
          } else {
            await interaction.editReply(renderMemory("Cocokkan pasangan!\nPercobaan: **" + attempts + "**"));
          }
        }, 1000).unref?.();
      } else {
        await i.update(renderMemory("Cocokkan pasangan!\nPercobaan: **" + attempts + "**"));
      }
      tryReset(collector, gameId);
    });
    collector.on("end", async (collected, reason) => {
      if (reason === "time" && !finished) {
        setState(gameId, States.EXPIRED);
        await rewardOnce(gameId, () => ArcadeEngine.postGame(user.id, "memory", "loss"));
        await interaction.editReply(renderMemory("WAKTU HABIS! Waktu untuk mencocokkan telah habis!", true)).catch(() => {});
      }
    });
  },
};
