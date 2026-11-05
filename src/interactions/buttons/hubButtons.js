"use strict";

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { validateHubOwner } = require("../../utils/hubMenuHelper");

module.exports = [
  {
    prefix: "hub_btn:",
    label: "hub-quick-action-button",
    async handler(interaction, client) {
      // Format: hub_btn:category:action:userId
      const parts = interaction.customId.split(":");
      const category = parts[1];
      const action = parts[2];
      const ownerId = parts[3];

      // Validasi kepemilikan pesan (anti-spam / anti-interupsi)
      const isOwner = await validateHubOwner(interaction, ownerId, category);
      if (!isOwner) return;

      // Aksi cepat kategori arcade / minigame
      if (category === "minigame" || category === "arcade") {
        const arcade = require("../../../plugin/arcade/arcade");
        if (action === "minesweeper" || action === "math") {
          return arcade.playGame(interaction, interaction.user, interaction.localeLang || "id", action);
        }
        return arcade.showHub(interaction, interaction.user, interaction.localeLang || "id");
      }

      // Aksi cepat kategori fun
      if (category === "fun") {
        if (action === "fortune") {
          const fortune = require("../../../plugin/utility/fortune");
          return fortune.execute(interaction, client);
        }
        if (action === "dice") {
          const dice = require("../../../plugin/utility/diceroll");
          return dice.execute(interaction, client);
        }
        if (action === "8ball") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_8ball:${ownerId}`)
            .setTitle("Bola Ajaib Naura 🎱");

          const qInput = new TextInputBuilder()
            .setCustomId("question")
            .setLabel("Pertanyaan Kamu")
            .setPlaceholder("Contoh: Apakah hari ini aku akan beruntung?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);

          modal.addComponents(new ActionRowBuilder().addComponents(qInput));
          return interaction.showModal(modal);
        }
        if (action === "tod") {
          const arcade = require("../../../plugin/arcade/arcade");
          return arcade.playGame(interaction, interaction.user, interaction.localeLang || "id", "tod");
        }
      }

      // Aksi cepat kategori utility tool
      if (category === "tool") {
        if (action === "calc") {
          const calc = require("../../../plugin/utility/calculator");
          return calc.execute(interaction, client);
        }
        if (action === "password") {
          const pass = require("../../../plugin/utility/password");
          return pass.execute(interaction, client);
        }
        if (action === "qr") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_qr:${ownerId}`)
            .setTitle("Generator Kode QR 📱");

          const textInput = new TextInputBuilder()
            .setCustomId("qr_text")
            .setLabel("Teks atau Tautan URL")
            .setPlaceholder("https://github.com/Aryandita/Naura-Hoshino-V2")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(500);

          modal.addComponents(new ActionRowBuilder().addComponents(textInput));
          return interaction.showModal(modal);
        }
      }

      // Aksi cepat kategori AI
      if (category === "ai") {
        if (action === "story") {
          const story = require("../../../plugin/ai/story-mode");
          return story.execute(interaction, client);
        }
        if (action === "voice") {
          const voice = require("../../../plugin/ai/voice");
          return voice.execute(interaction, client);
        }
        if (action === "chat") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_ai_chat:${ownerId}`)
            .setTitle("Ngobrol Bareng Naura AI 💬");

          const chatInput = new TextInputBuilder()
            .setCustomId("chat_prompt")
            .setLabel("Apa yang ingin kamu tanyakan?")
            .setPlaceholder("Halo Naura, ceritakan tentang dirimu...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);

          modal.addComponents(new ActionRowBuilder().addComponents(chatInput));
          return interaction.showModal(modal);
        }
      }

      return interaction.reply({
        content: `Aksi **${action}** berhasil dipilih.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    },
  },
];
