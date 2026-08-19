"use strict";

const { MessageFlags } = require("discord.js");
const redisManager = require("../../managers/redisManager");
const currency = require("../../survival/engines/currency");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "arcade_trivia_",
    label: "arcade-trivia",
    defer: false,
    async handler(interaction) {
      const parts = interaction.customId.split("_");
      const sessionId = parts[2];
      const selectedIndex = parseInt(parts[3], 10);

      const rawSession = await redisManager.get(`arcade:trivia:${sessionId}`);
      if (!rawSession) {
        return interaction.reply({
          content: "❌ Waktu menjawab telah habis atau sesi sudah kedaluwarsa.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const session = JSON.parse(rawSession);
      if (interaction.user.id !== session.userId) {
        return interaction.reply({
          content: "❌ Anda bukan pemain yang memulai kuis ini.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferUpdate();
      await redisManager.del(`arcade:trivia:${sessionId}`);

      const isCorrect = selectedIndex === session.answerIndex;
      let rewardFrags = 50;
      if (session.bet > 0) {
        rewardFrags = isCorrect ? session.bet * 2 : 0;
      }

      if (isCorrect && rewardFrags > 0) {
        await currency.reward(session.userId, { starFragments: rewardFrags }, "Arcade Trivia Reward");
      }

      const resultPayload = buildContainerV2({
        accentColorHex: isCorrect ? "#86EFAC" : "#E74C3C",
        title: isCorrect ? "🎉 Jawaban Benar!" : "❌ Jawaban Salah!",
        description: isCorrect
          ? `Luar biasa! Jawaban Anda tepat.\n💰 Hadiah: **+${rewardFrags} Star Fragments** 🌟`
          : `Sayang sekali jawabanmu kurang tepat.\n${session.bet > 0 ? `Kehilangan **-${session.bet} Star Fragments**.` : "Coba lagi di pertanyaan lain!"}`,
        footerText: "Holo-Arcade Trivia Royale",
      });

      return interaction.editReply({ ...resultPayload, components: [] });
    },
  },
  {
    prefix: "arcade_rhythm_",
    label: "arcade-rhythm",
    defer: false,
    async handler(interaction) {
      const parts = interaction.customId.split("_");
      const sessionId = parts[2];
      const selectedColor = parts[3];

      const rawSession = await redisManager.get(`arcade:rhythm:${sessionId}`);
      if (!rawSession) {
        return interaction.reply({
          content: "❌ Waktu bermain telah habis atau sesi sudah kedaluwarsa.",
          flags: MessageFlags.Ephemeral,
        });
      }

      const session = JSON.parse(rawSession);
      if (interaction.user.id !== session.userId) {
        return interaction.reply({
          content: "❌ Anda bukan pemain yang memulai game ini.",
          flags: MessageFlags.Ephemeral,
        });
      }

      await interaction.deferUpdate();

      session.userInputs = session.userInputs || [];
      session.userInputs.push(selectedColor);

      const stepIndex = session.userInputs.length - 1;
      const expectedColor = session.targetSequence[stepIndex];

      if (selectedColor !== expectedColor) {
        await redisManager.del(`arcade:rhythm:${sessionId}`);
        const failPayload = buildContainerV2({
          accentColorHex: "#E74C3C",
          title: "💥 Missed Rhythm!",
          description: `Urutan tombol meleset di langkah ke-${stepIndex + 1}!\n${session.bet > 0 ? `Kehilangan **-${session.bet} Star Fragments**.` : ""}`,
          footerText: "Holo-Arcade Rhythm Tap",
        });
        return interaction.editReply({ ...failPayload, components: [] });
      }

      // Check if all steps completed
      if (session.userInputs.length === session.targetSequence.length) {
        await redisManager.del(`arcade:rhythm:${sessionId}`);
        const rewardFrags = session.bet > 0 ? session.bet * 2 : 100;
        await currency.reward(session.userId, { starFragments: rewardFrags }, "Arcade Rhythm Perfect Clear");

        const winPayload = buildContainerV2({
          accentColorHex: "#FFD700",
          title: "🔥 PERFECT COMBO!",
          description: `Semua 4 urutan nada berhasil ditekan dengan sempurna!\n💰 Payout: **+${rewardFrags} Star Fragments** 🌟`,
          footerText: "Holo-Arcade Rhythm Tap Master",
        });

        return interaction.editReply({ ...winPayload, components: [] });
      }

      // Save intermediate progress
      await redisManager.set(`arcade:rhythm:${sessionId}`, JSON.stringify(session), "EX", 60);
    },
  },
];
