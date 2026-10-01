"use strict";

const {
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  ActionRowBuilder,
  MessageFlags,
} = require("discord.js");
const { validateHubOwner } = require("../../utils/hubMenuHelper");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "hub_sel:",
    label: "hub-dropdown-select-menu",
    async handler(interaction, client) {
      // Format: hub_sel:category:userId
      const parts = interaction.customId.split(":");
      const category = parts[1];
      const ownerId = parts[2];
      const selectedValue = interaction.values[0];

      // Validasi kepemilikan pesan
      const isOwner = await validateHubOwner(interaction, ownerId, category);
      if (!isOwner) return;

      // Pilihan dropdown kategori minigame
      if (category === "minigame") {
        if (selectedValue === "minesweeper") {
          return require("../../../plugin/minigames/minesweeper").execute(interaction, client);
        }
        if (selectedValue === "arcade") {
          return require("../../../plugin/minigames/arcade").execute(interaction, client);
        }
        if (selectedValue === "akinator") {
          return require("../../../plugin/minigames/akinator").execute(interaction, client);
        }
        if (selectedValue === "hangman") {
          return require("../../../plugin/minigames/hangman").execute(interaction, client);
        }

        // Subgame internal: math, trivia, rps, tictactoe, memory, tebakkata, tod, leaderboard
        const mg = require("../../../plugin/minigames/minigame");
        return mg.launchSubgame(interaction, selectedValue);
      }

      // Pilihan dropdown kategori fun
      if (category === "fun") {
        if (selectedValue === "fortune") {
          return require("../../../plugin/utility/fortune").execute(interaction, client);
        }
        if (selectedValue === "coin") {
          return require("../../../plugin/utility/coinflip").execute(interaction, client);
        }
        if (selectedValue === "dice") {
          return require("../../../plugin/utility/diceroll").execute(interaction, client);
        }
        if (selectedValue === "meme") {
          return require("../../../plugin/utility/meme").execute(interaction, client);
        }
        if (selectedValue === "quote") {
          return require("../../../plugin/utility/quote").execute(interaction, client);
        }
        if (selectedValue === "8ball") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_8ball:${ownerId}`)
            .setTitle("Bola Ajaib Naura 🎱");
          const qInput = new TextInputBuilder()
            .setCustomId("question")
            .setLabel("Pertanyaan Kamu")
            .setPlaceholder("Contoh: Apakah esok akan cerah?")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(200);
          modal.addComponents(new ActionRowBuilder().addComponents(qInput));
          return interaction.showModal(modal);
        }
        if (selectedValue === "ship") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_ship:${ownerId}`)
            .setTitle("Kalkulator Kecocokan Cinta 💘");
          const targetInput = new TextInputBuilder()
            .setCustomId("ship_target")
            .setLabel("Nama atau Username Pasangan")
            .setPlaceholder("Masukkan nama seseorang...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(100);
          modal.addComponents(new ActionRowBuilder().addComponents(targetInput));
          return interaction.showModal(modal);
        }
      }

      // Pilihan dropdown kategori utility tool
      if (category === "tool") {
        if (selectedValue === "calc") {
          return require("../../../plugin/utility/calculator").execute(interaction, client);
        }
        if (selectedValue === "password") {
          return require("../../../plugin/utility/password").execute(interaction, client);
        }
        if (selectedValue === "qr") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_qr:${ownerId}`)
            .setTitle("Generator Kode QR 📱");
          const textInput = new TextInputBuilder()
            .setCustomId("qr_text")
            .setLabel("Teks atau Tautan URL")
            .setPlaceholder("https://contoh.com")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(500);
          modal.addComponents(new ActionRowBuilder().addComponents(textInput));
          return interaction.showModal(modal);
        }
        if (selectedValue === "color") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_color:${ownerId}`)
            .setTitle("Inspektur Warna 🎨");
          const colorInput = new TextInputBuilder()
            .setCustomId("color_code")
            .setLabel("Kode Warna Hex (Contoh: #FFB6C1)")
            .setPlaceholder("#7B68EE")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(20);
          modal.addComponents(new ActionRowBuilder().addComponents(colorInput));
          return interaction.showModal(modal);
        }
        if (selectedValue === "shorten") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_shorten:${ownerId}`)
            .setTitle("Pemendek URL 🔗");
          const urlInput = new TextInputBuilder()
            .setCustomId("shorten_url")
            .setLabel("Tautan URL Panjang")
            .setPlaceholder("https://sangat-panjang.com/halaman/...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(500);
          modal.addComponents(new ActionRowBuilder().addComponents(urlInput));
          return interaction.showModal(modal);
        }
        if (selectedValue === "download") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_download:${ownerId}`)
            .setTitle("Pengunduh Media 📥");
          const mediaInput = new TextInputBuilder()
            .setCustomId("download_url")
            .setLabel("Tautan Video / Media (TikTok, IG, YouTube)")
            .setPlaceholder("https://vt.tiktok.com/...")
            .setStyle(TextInputStyle.Short)
            .setRequired(true)
            .setMaxLength(500);
          modal.addComponents(new ActionRowBuilder().addComponents(mediaInput));
          return interaction.showModal(modal);
        }
      }

      // Pilihan dropdown kategori AI
      if (category === "ai") {
        if (selectedValue === "story") {
          return require("../../../plugin/ai/story-mode").execute(interaction, client);
        }
        if (selectedValue === "voice") {
          return require("../../../plugin/ai/voice").execute(interaction, client);
        }
        if (selectedValue === "persona") {
          return require("../../../plugin/ai/persona").execute(interaction, client);
        }
        if (selectedValue === "sensei") {
          return require("../../../plugin/ai/sensei").execute(interaction, client);
        }
        if (selectedValue === "mystery") {
          return require("../../../plugin/ai/mystery").execute(interaction, client);
        }
        if (selectedValue === "chat") {
          const modal = new ModalBuilder()
            .setCustomId(`modal_hub_ai_chat:${ownerId}`)
            .setTitle("Ngobrol Bareng Naura AI 💬");
          const chatInput = new TextInputBuilder()
            .setCustomId("chat_prompt")
            .setLabel("Apa yang ingin kamu tanyakan?")
            .setPlaceholder("Tanyakan apa saja kepada Naura...")
            .setStyle(TextInputStyle.Paragraph)
            .setRequired(true)
            .setMaxLength(1000);
          modal.addComponents(new ActionRowBuilder().addComponents(chatInput));
          return interaction.showModal(modal);
        }
        if (selectedValue === "vision") {
          return interaction.reply({
            ...buildContainerV2({
              authorName: "Naura Multimodal Vision",
              title: "👁️ Analisis Gambar Multimodal",
              description: [
                "Untuk menganalisis gambar menggunakan AI Naura:",
                "",
                "1. Unggah gambar ke Discord chat.",
                "2. Gunakan perintah </ai:0> atau mention Naura sambil menyertakan gambar.",
                "3. Naura akan mendeskripsikan, membaca teks OCR, atau menjawab pertanyaan terkait gambarmu! ✨",
              ].join("\n"),
              accentColorHex: "#38BDF8",
              lang: interaction.localeLang,
            }),
            flags: MessageFlags.Ephemeral,
          });
        }
      }

      return interaction.reply({
        content: `Pilihan **${selectedValue}** berhasil diproses.`,
        flags: MessageFlags.Ephemeral,
      }).catch(() => {});
    },
  },
];
