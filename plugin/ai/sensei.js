"use strict";

/**
 * @namespace: plugin/ai/sensei.js
 * @type: Command
 * @description: /sensei, AI Tutor & Pemandu Sistem Naura Hoshino
 */

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const nauraSensei = require("../../src/ai/nauraSensei");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("sensei")
    .setDescription("🎓 Tanya Naura Sensei tentang cara bermain dan fitur bot!")
    .addStringOption((opt) =>
      opt
        .setName("tanya")
        .setDescription(
          "Pertanyaanmu seputar cara main/fitur bot (contoh: cara dapet kupon, cara rawat pet)",
        )
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("topik")
        .setDescription("Pilih panduan kategori modul bot")
        .setRequired(false)
        .addChoices(
          { name: "⚔️ RPG & Survival", value: "survival_rpg" },
          { name: "💰 Ekonomi, Saham & Daily", value: "economy_finance" },
          { name: "🃏 Kartu Anime TCG & Tower", value: "card_tcg" },
          { name: "🐾 Pet & Vivarium", value: "pets_vivarium" },
          { name: "🎵 Musik & Lavalink Audio", value: "music_audio" },
          { name: "🌐 Web Portfolio & 3D Model", value: "portfolio_custom" },
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const user = interaction.user;
    const displayName = user.displayName || user.username;

    const userQuestion = interaction.options.getString("tanya");
    const selectedTopicKey = interaction.options.getString("topik");

    let query = userQuestion;
    if (!query && selectedTopicKey) {
      const matched = nauraSensei.SYSTEM_KNOWLEDGE_BASE.find(
        (t) => t.topic === selectedTopicKey,
      );
      query = matched ? matched.title : "panduan bot";
    } else if (!query) {
      query = "panduan umum cara bermain bot Naura";
    }

    const senseiResult = await nauraSensei.ask(query, displayName);

    const btnDaily = new ButtonBuilder()
      .setCustomId("sensei_nav_daily")
      .setLabel("Klaim /daily")
      .setStyle(ButtonStyle.Success)
      .setEmoji("🎁");

    const btnSurvival = new ButtonBuilder()
      .setCustomId("sensei_nav_survival")
      .setLabel("Mulai /survival")
      .setStyle(ButtonStyle.Primary)
      .setEmoji("⚔️");

    const row = new ActionRowBuilder().addComponents(btnDaily, btnSurvival);

    const payload = buildContainerV2({
      accentColorHex: "#C084FC",
      title: `🎓 Naura Sensei, ${senseiResult.topic}`,
      description: senseiResult.reply,
      expression: "smile",
      footerText: ui.getFooter("core"),
    });

    return interaction.editReply({
      ...payload,
      components: [...payload.components, row],
    });
  },
};
