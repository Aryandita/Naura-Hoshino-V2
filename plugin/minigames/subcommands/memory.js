"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "memory",
  async execute(interaction, context) {
    const { user, profile, coinEmoji } = context;
    const emojis = ["🍎", "🍌", "🍇", "🍉", "🍓", "🍒"];
    const board = [...emojis, ...emojis].sort(() => Math.random() - 0.5);
    let flipped = [];
    const matched = [];
    let attempts = 0;

    const buildMemoryBoard = (disableAll = false) => {
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder();
        for (let j = 0; j < 4; j++) {
          const idx = i * 4 + j;
          const isFlipped = flipped.includes(idx) || matched.includes(idx);
          row.addComponents(
            new ButtonBuilder()
              .setCustomId("mem_" + idx)
              .setLabel(isFlipped ? board[idx] : "❓")
              .setStyle(
                matched.includes(idx)
                  ? ButtonStyle.Success
                  : isFlipped
                    ? ButtonStyle.Primary
                    : ButtonStyle.Secondary,
              )
              .setDisabled(disableAll || isFlipped),
          );
        }
        rows.push(row);
      }
      return rows;
    };

    const renderMemory = (desc, disabled = false) =>
      buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#00FFFF",
        title: `${ui.getEmoji("arcade") || "🎴"} Memory Match`,
        description: desc,
        buttonsRow: buildMemoryBoard(disabled),
        footerText: ui.getFooter("core"),
      });

    await interaction.editReply(
      renderMemory(
        "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
      ),
    );
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 60000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_9", true);

      const idx = parseInt(i.customId.split("_")[1]);
      flipped.push(idx);

      if (flipped.length === 2) {
        attempts++;
        await i.update(
          renderMemory(
            "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
            true,
          ),
        );

        const [first, second] = flipped;
        if (board[first] === board[second]) {
          matched.push(first, second);
        }

        setTimeout(async () => {
          flipped = [];
          const isWin = matched.length === board.length;

          if (isWin) {
            const rewardNsf = profile.isPremium ? 500 : 250;
            await cacheManager.incrementUserSurvival(
              user.id,
              "starFragments",
              rewardNsf,
            );
            await interaction.editReply(
              renderMemory(
                "Berhasil mencocokkan semua dalam **" +
                  attempts +
                  "** percobaan!\nKamu mendapat **" +
                  rewardNsf +
                  "** " +
                  coinEmoji +
                  "!",
                true,
              ),
            );
            collector.stop("win");
          } else {
            await interaction.editReply(
              renderMemory(
                "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
              ),
            );
          }
        }, 1000);
      } else {
        await i.update(
          renderMemory(
            "Cocokkan pasangan emoji!\nPercobaan: **" + attempts + "**",
          ),
        );
      }
      collector.resetTimer();
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description:
            "Waktu untuk mencocokkan emoji telah habis! Silakan coba lagi kapan-kapan yaa! 👋",
          footerText: ui.getFooter("core"),
        });
        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
