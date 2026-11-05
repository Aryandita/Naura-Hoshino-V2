"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { tebakGambarDB } = require("../helpers/minigameShared");

module.exports = {
  name: "tebakgambar",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji } = context;
    const gameData =
      tebakGambarDB[Math.floor(Math.random() * tebakGambarDB.length)];
    const rewardCoin = 250;

    const tebakGambarPayload = buildContainerV2({
      accentColorHex: ui.getColor ? ui.getColor("primary") : "#00FFFF",
      title: `${ui.getEmoji("desc") || "🖼️"} Tebak Gambar Objek`,
      description: `Ketik apa objek yang ada pada gambar di atas!\n\n${ui.getEmoji("sparkle") || "💡"} **Klu:** ${gameData.clue}\n\n${ui.getEmoji("clock") || "⏳"} Waktu: **20 detik**\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(tebakGambarPayload);
    const gameStartTime = Date.now();

    const filter2 = (m) => m.author.id === user.id;
    const collector2 = interaction.channel.createMessageCollector({
      filter: filter2,
      time: 20000,
      max: 1,
    });

    collector2.on("collect", async (m) => {
      const userAns = String(m.content)
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();
      const targetAns = String(gameData.answer)
        .replace(/\s+/g, "")
        .trim()
        .toLowerCase();
      if (userAns === targetAns) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1000) {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description:
              "Jawaban terlalu cepat (< 1 detik). Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector2.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} TEBAKAN OBJEK BENAR!`,
          description: `Hebat! Objek pada gambar tersebut memang **${gameData.answer}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} TEBAKAN SALAH`,
          description: `Bukan itu objeknya!\nJawaban yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector2.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: "Tebak Gambar Objek",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menebak telah habis!\nObjek yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
