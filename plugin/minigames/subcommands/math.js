"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { rewards, generateMath } = require("../helpers/minigameShared");

module.exports = {
  name: "math",
  async execute(interaction, context) {
    const { user, profile, nsfMultiplier, coinEmoji } = context;
    const diff = interaction.options.getString("kesulitan") || "pemula";
    const conf = rewards[diff] || rewards.pemula;
    const mathData = generateMath(diff);

    const payload = buildContainerV2({
      accentColorHex: conf.color,
      authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
      iconURL: user.displayAvatarURL(),
      title: `Berapa hasil dari: **${mathData.question}** ?`,
      description: `⏳ Ketik jawabanmu di chat ini! Waktumu hanya **${conf.time / 1000} detik**.\n\n> 💰 Hadiah: **${conf.coin}** ${coinEmoji}\n> 🏆 Skor: **+${conf.score}** Poin`,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);
    const gameStartTime = Date.now();

    const filter = (m) => m.author.id === user.id;
    const collector = interaction.channel.createMessageCollector({
      filter,
      time: conf.time,
      max: 1,
    });

    collector.on("collect", async (m) => {
      if (
        String(m.content).replace(/\s+/g, "").trim() ===
        String(mathData.answer)
      ) {
        const timeTaken = Date.now() - gameStartTime;
        if (timeTaken < 1500 && diff === "grandmaster") {
          const cheatPayload = buildContainerV2({
            accentColorHex: "#ef4444",
            title: `${ui.getEmoji("shield_alert") || "🚨"} ANTI-CHEAT`,
            description:
              "Terdeteksi Auto-Typer / Selfbot. Kamu menjawab perhitungan rumit dalam waktu kurang dari 1.5 detik! Hadiah dibatalkan.",
            footerText: ui.getFooter("core"),
          });
          await m.reply(cheatPayload);
          return collector.stop("cheat");
        }
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        profile.minigame_mathScore += conf.score;
        await profile.save({ fields: ["minigame_mathScore"] });
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("success") || "✅"} HITUNGAN BENAR!`,
          description: `Luar biasa! Hasil hitungan dari **${mathData.question}** memang **${mathData.answer}**.\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}\n> 🏆 **Skor:** +${conf.score} Poin Math`,
          footerText: ui.getFooter("core"),
        });

        m.reply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} HITUNGAN SALAH`,
          description: `Jawabanmu belum tepat!\nHasil yang benar dari **${mathData.question}** adalah: **${mathData.answer}**`,
          footerText: ui.getFooter("core"),
        });

        m.reply(losePayload);
      }
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Kuis Matematika [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu berhitung telah habis, <@${user.id}>!\nHasil yang benar adalah: **${mathData.answer}**.`,
          footerText: ui.getFooter("core"),
        });

        interaction.followUp(timePayload).catch(() => {});
      }
    });
  },
};
