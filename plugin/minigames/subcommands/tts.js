"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { ttsDB } = require("../helpers/minigameShared");

module.exports = {
  name: "tts",
  async execute(interaction, context) {
    const { user, nsfMultiplier, coinEmoji } = context;
    const gameData = ttsDB[Math.floor(Math.random() * ttsDB.length)];
    const rewardCoin = 400;

    const ttsPayload = buildContainerV2({
      accentColorHex: "#FF00FF",
      title: `${ui.getEmoji("notes") || "📝"} Teka Teki Silang Mini`,
      description: `Jawablah kedua klu di bawah ini secara berurutan, pisahkan dengan **spasi**.\n*(Contoh jawaban: \`buku pensil\`)*\n\n${gameData.clue}\n\n${ui.getEmoji("clock") || "⏳"} Waktu: **25 detik**\n> 💰 Hadiah: **${rewardCoin}** ${coinEmoji}`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(ttsPayload);
    const gameStartTime = Date.now();

    const filter = (m) => m.author.id === user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: 25000,
      max: 1,
    });

    collector.on("collect", async (m) => {
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
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(rewardCoin * nsfMultiplier);
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} JAWABAN TTS TEPAT!`,
          description: `Luar biasa! Kamu berhasil memecahkan TTS ini dengan sempurna.\n\n> 📝 **Kunci:** \`${gameData.answer}\`\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} JAWABAN TTS SALAH`,
          description: `Jawabanmu belum sesuai dengan kedua klu.\nJawaban yang tepat adalah: **${gameData.answer}**`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: "Teka Teki Silang Mini",
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu menyelesaikan TTS telah habis!\nJawaban yang benar adalah **${gameData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
