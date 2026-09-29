"use strict";

const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "modal_hub_8ball:",
    label: "hub-8ball-modal",
    async handler(interaction) {
      const question = interaction.fields.getTextInputValue("question");
      const answers = [
        "Pasti iya!",
        "Tentu saja tidak diragukan lagi.",
        "Sepertinya begitu deh~",
        "Tanda-tanda mengarah ke ya!",
        "Hmm, coba tanyakan lagi nanti ya.",
        "Lebih baik Naura tidak memberitahumu sekarang...",
        "Konsentrasi dan tanyakan lagi.",
        "Jangan terlalu berharap ya.",
        "Jawabanku adalah tidak.",
        "Sumber Naura bilang tidak.",
        "Sangat meragukan...",
      ];
      const randomAnswer = answers[Math.floor(Math.random() * answers.length)];

      const payload = buildContainerV2({
        authorName: "Naura Magic 8-Ball",
        title: "🎱 Ramalan Bola Ajaib",
        description: [
          `❓ **Pertanyaan:** *"${question}"*`,
          "",
          `🔮 **Jawaban Naura:** **${randomAnswer}**`,
        ].join("\n"),
        accentColorHex: "#9B59B6",
        lang: interaction.localeLang,
      });

      return interaction.reply(payload);
    },
  },
  {
    prefix: "modal_hub_ship:",
    label: "hub-ship-modal",
    async handler(interaction) {
      const target = interaction.fields.getTextInputValue("ship_target");
      const percentage = Math.floor(Math.random() * 101);

      let comment = "Hmm... butuh perjuangan ekstra nih!";
      if (percentage >= 80) comment = "Wah! Pasangan serasi yang ditakdirkan bersama! 💖";
      else if (percentage >= 50) comment = "Cocok kok! Ada chemistry manis di antara kalian~ ✨";
      else if (percentage >= 30) comment = "Bisa berteman baik dulu, siapa tahu jodoh! 😊";

      const payload = buildContainerV2({
        authorName: "Naura Love Calculator",
        title: "💘 Hasil Kecocokan Cinta",
        description: [
          `👤 **Kamu:** <@${interaction.user.id}>`,
          `🎯 **Target:** **${target}**`,
          "",
          `📊 **Tingkat Kecocokan:** **${percentage}%**`,
          `💬 *${comment}*`,
        ].join("\n"),
        accentColorHex: "#FF69B4",
        lang: interaction.localeLang,
      });

      return interaction.reply(payload);
    },
  },
  {
    prefix: "modal_hub_qr:",
    label: "hub-qr-modal",
    async handler(interaction, client) {
      const text = interaction.fields.getTextInputValue("qr_text");
      const qrCmd = require("../../../plugin/utility/qr");
      const mockInteraction = {
        ...interaction,
        options: {
          getString: () => text,
        },
      };
      return qrCmd.execute(mockInteraction, client);
    },
  },
  {
    prefix: "modal_hub_color:",
    label: "hub-color-modal",
    async handler(interaction, client) {
      const hex = interaction.fields.getTextInputValue("color_code");
      const colorCmd = require("../../../plugin/utility/color");
      const mockInteraction = {
        ...interaction,
        options: {
          getString: () => hex,
        },
      };
      return colorCmd.execute(mockInteraction, client);
    },
  },
  {
    prefix: "modal_hub_shorten:",
    label: "hub-shorten-modal",
    async handler(interaction, client) {
      const url = interaction.fields.getTextInputValue("shorten_url");
      const shortenCmd = require("../../../plugin/utility/shorten");
      const mockInteraction = {
        ...interaction,
        options: {
          getString: () => url,
        },
      };
      return shortenCmd.execute(mockInteraction, client);
    },
  },
  {
    prefix: "modal_hub_download:",
    label: "hub-download-modal",
    async handler(interaction, client) {
      const url = interaction.fields.getTextInputValue("download_url");
      const dlCmd = require("../../../plugin/utility/downloader");
      const mockInteraction = {
        ...interaction,
        options: {
          getString: () => url,
        },
      };
      return dlCmd.execute(mockInteraction, client);
    },
  },
  {
    prefix: "modal_hub_ai_chat:",
    label: "hub-ai-chat-modal",
    async handler(interaction, client) {
      const prompt = interaction.fields.getTextInputValue("chat_prompt");
      const chatSub = require("../../../plugin/ai/subcommands/chat");
      const mockInteraction = {
        ...interaction,
        options: {
          getString: () => prompt,
          getAttachment: () => null,
        },
      };
      return chatSub.execute(mockInteraction, client);
    },
  },
];
