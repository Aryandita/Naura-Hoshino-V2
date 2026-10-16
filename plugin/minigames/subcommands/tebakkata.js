"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { rewards, anagramDB } = require("../helpers/minigameShared");

module.exports = {
  name: "tebakkata",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji } = context;
    const diff = interaction.options.getString("kesulitan") || "mudah";
    const words = anagramDB[diff] || anagramDB.mudah;
    const targetWord = words[Math.floor(Math.random() * words.length)];

    let shuffledWord = targetWord;
    while (shuffledWord === targetWord) {
      shuffledWord = targetWord
        .split("")
        .sort(() => Math.random() - 0.5)
        .join(" ");
    }

    const conf = diff === "mudah" ? rewards.pemula : rewards.lanjut;
    const rewardCoin = Math.floor(conf.coin * 1.5);

    const tebakKataPayload = buildContainerV2({
      accentColorHex: conf.color,
      title: `🔠 Tebak Kata [${diff.toUpperCase()}]`,
      description: `Susun kembali huruf-huruf berikut menjadi kata yang benar:\n\n**${shuffledWord}**\n\n⏳ Ketik jawabanmu dalam waktu **${conf.time / 1000} detik**!\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });
    await interaction.editReply(tebakKataPayload);
    const gameStartTime = Date.now();

    const filter1 = (m) => m.author.id === user.id;
    const collector1 = interaction.channel.createMessageCollector({
      filter: filter1,
      time: conf.time,
      max: 1,
    });

    collector1.on("collect", async (m) => {
      const userAns = String(m.content)
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
      const targetAns = String(targetWord)
        .replace(/\s+/g, "")
        .trim()
        .toUpperCase();
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
          return collector1.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} SUSUNAN KATA BENAR!`,
          description: `Pintar sekali! Kata yang tepat adalah **${targetWord}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} TEBAKAN SALAH`,
          description: `Kata yang benar adalah **${targetWord}**.\nCoba lagi di permainan berikutnya yaa!`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector1.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Tebak Kata [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menyusun kata telah habis!\nKata yang benar adalah **${targetWord}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
