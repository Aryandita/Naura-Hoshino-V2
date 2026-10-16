"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require("discord.js");
const { logger } = require("../../../src/managers/logger");
const cacheManager = require("../../../src/managers/cacheManager");
const geminiClient = require("../../../src/ai/geminiClient");
const { ValidationError } = require("../../../src/errors/DomainError");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const { rewards, triviaDBFallback } = require("../helpers/minigameShared");

module.exports = {
  name: "trivia",
  async execute(interaction, context) {
    const { user, profile, nsfMultiplier, coinEmoji } = context;
    const diff = interaction.options.getString("kesulitan") || "pemula";
    const conf = rewards[diff] || rewards.pemula;
    let qData;

    try {
      const promptAI = `Buatkan 1 soal kuis trivia pengetahuan umum yang menarik, berbahasa Indonesia, secara acak dengan tingkat kesulitan: ${diff.toUpperCase()}. 
              Format balasan HARUS berupa JSON murni (tanpa tanda markdown \`\`\`json) dengan struktur persis seperti ini:
              {
                  "q": "Tulis pertanyaan di sini",
                  "options": ["Pilihan A", "Pilihan B", "Pilihan C", "Pilihan D"],
                  "a": "Tulis jawaban yang benar di sini (harus sama persis dengan salah satu isi options)"
              }`;

      const rawText = await geminiClient.generate({
        model: "gemini-2.5-flash",
        parts: [{ text: promptAI }],
      });

      const jsonText = (rawText || "")
        .replace(/```json/gi, "")
        .replace(/```/gi, "")
        .trim();
      qData = JSON.parse(jsonText);

      if (
        !qData.q ||
        !qData.options ||
        !qData.a ||
        !qData.options.includes(qData.a)
      ) {
        throw new ValidationError(
          "Format JSON dari AI tidak valid atau tidak memiliki kunci pertanyaan/jawaban yang lengkap.",
          { rawText: jsonText },
        );
      }
    } catch (error) {
      logger.error(
        "Gagal generate soal dari AI, memakai soal cadangan:",
        error,
      );
      const fallbackQuestions = triviaDBFallback[diff] || triviaDBFallback.pemula;
      qData =
        fallbackQuestions[
          Math.floor(Math.random() * fallbackQuestions.length)
        ];
    }

    const shuffledOptions = [...qData.options].sort(
      () => Math.random() - 0.5,
    );
    const correctIndex = shuffledOptions.indexOf(qData.a);

    const row = new ActionRowBuilder().addComponents(
      shuffledOptions.map((opt, index) =>
        new ButtonBuilder()
          .setCustomId(`trivia_${index}`)
          .setLabel(opt.length > 80 ? opt.substring(0, 77) + "..." : opt)
          .setStyle(ButtonStyle.Primary),
      ),
    );

    const payload = buildContainerV2({
      accentColorHex: conf.color,
      authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
      iconURL: user.displayAvatarURL(),
      title: qData.q,
      description: `⏳ Pilih jawaban yang benar di bawah! Waktu: **${conf.time / 1000} detik**.\n\n> 💰 Hadiah: **${conf.coin}** ${coinEmoji}\n> 🏆 Skor: **+${conf.score}** Poin`,
      buttonsRow: row,
      footerText: "Soal dibuat khusus oleh Naura AI",
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: conf.time,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_5", true);

      const selectedIndex = parseInt(i.customId.split("_")[1]);

      const newRow = new ActionRowBuilder().addComponents(
        shuffledOptions.map((opt, index) => {
          const btn = new ButtonBuilder()
            .setCustomId(`done_${index}`)
            .setLabel(opt)
            .setDisabled(true);
          if (index === correctIndex) btn.setStyle(ButtonStyle.Success);
          else if (index === selectedIndex) btn.setStyle(ButtonStyle.Danger);
          else btn.setStyle(ButtonStyle.Secondary);
          return btn;
        }),
      );

      await i.deferUpdate().catch(() => {});

      if (selectedIndex === correctIndex) {
        const rewardNsf = Math.floor(conf.coin * nsfMultiplier);
        profile.minigame_triviaScore += conf.score;
        await profile.save({ fields: ["minigame_triviaScore"] });
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          rewardNsf,
        );

        const winPayload = buildContainerV2({
          accentColorHex: "#22c55e",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("celebrate") || "🎉"} JAWABAN TEPAT SEKALI!`,
          description: `Hebat! Jawabanmu **${qData.a}** adalah benar!\n\n> 💰 **Hadiah:** +${rewardNsf} ${coinEmoji}\n> 🏆 **Skor:** +${conf.score} Poin`,
          buttonsRow: newRow,
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(winPayload);
      } else {
        const losePayload = buildContainerV2({
          accentColorHex: "#ef4444",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("error") || "❌"} JAWABAN KURANG TEPAT`,
          description: `Sayang sekali! Jawaban yang benar adalah **${qData.a}**.\nTetap semangat dan coba lagi yaa!`,
          buttonsRow: newRow,
          footerText: ui.getFooter("core"),
        });

        await interaction.editReply(losePayload);
      }
      collector.stop("answered");
    });

    collector.on("end", (collected, reason) => {
      if (reason !== "answered") {
        const disabledRow = new ActionRowBuilder().addComponents(
          shuffledOptions.map((opt, index) =>
            new ButtonBuilder()
              .setCustomId(`exp_${index}`)
              .setLabel(opt)
              .setStyle(
                index === correctIndex
                  ? ButtonStyle.Success
                  : ButtonStyle.Secondary,
              )
              .setDisabled(true),
          ),
        );
        const timePayload = buildContainerV2({
          accentColorHex: "#f59e0b",
          authorName: `Kuis Trivia AI [${diff.toUpperCase()}]`,
          iconURL: user.displayAvatarURL(),
          title: `${ui.getEmoji("clock") || "⏰"} WAKTU HABIS!`,
          description: `Waktu berpikirmu telah habis!\nJawaban yang benar adalah **${qData.a}**.`,
          buttonsRow: disabledRow,
          footerText: ui.getFooter("core"),
        });

        interaction.editReply(timePayload).catch(() => {});
      }
    });
  },
};
