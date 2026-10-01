"use strict";

const { SlashCommandBuilder, ButtonStyle } = require("discord.js");
const UserProfile = require("../../src/models/UserProfile");
const chat = require("./subcommands/chat");

function isPremium(profile) {
  return Boolean(
    profile.isPremium &&
    profile.premiumUntil &&
    profile.premiumUntil > new Date(),
  );
}

module.exports = {
  data: new SlashCommandBuilder()
    .setName("ai")
    .setDescription("🤖 Pusat Kecerdasan Buatan Naura: chat, story RPG, voice DJ dan asisten pintar")
    .addStringOption((opt) =>
      opt
        .setName("pesan")
        .setDescription("Tanyakan apa saja langsung ke Naura AI (opsional)")
        .setRequired(false),
    ),

  async execute(interaction, client) {
    const directMessage = interaction.options ? interaction.options.getString("pesan") : null;
    if (directMessage) {
      await interaction.deferReply();
      const mockInteraction = new Proxy(interaction, {
        get(target, prop) {
          if (prop === "options") {
            return {
              getString: () => directMessage,
              getAttachment: () => null,
            };
          }
          const val = target[prop];
          return typeof val === "function" ? val.bind(target) : val;
        },
      });
      const [profile] = await UserProfile.findOrCreate({
        where: { userId: interaction.user.id },
      });
      return chat(mockInteraction, {
        profile,
        isPremiumUser: isPremium(profile),
      });
    }

    const { buildInteractiveHubPayload } = require("../../src/utils/hubMenuHelper");
    const payload = buildInteractiveHubPayload({
      title: "🤖 Naura Artificial Intelligence Suite",
      authorName: "Naura Intelligent Core",
      description: [
        "Hai! Aku **Naura Hoshino**, asisten AI pribadimu di Discord! ✨",
        "Pilih fitur kecerdasan buatan yang ingin kamu gunakan:",
        "Ngobrol santai, bertualang di Story Mode RPG, berbincang di Voice Channel, atau minta bantuan belajar bersama Naura Sensei!",
        "",
        "💡 *Pilih salah satu tombol cepat di bawah atau buka menu dropdown untuk melihat semua kapabilitas AI.*",
      ].join("\n"),
      accentColorHex: "#38BDF8",
      quickButtons: [
        { id: "chat", label: "Ngobrol AI", emoji: "💬", style: ButtonStyle.Primary },
        { id: "story", label: "Story Mode RPG", emoji: "📖", style: ButtonStyle.Success },
        { id: "voice", label: "Voice Companion", emoji: "🎙️", style: ButtonStyle.Secondary },
      ],
      selectOptions: [
        { value: "chat", label: "Dialog Percakapan AI", emoji: "💬", description: "Tanya jawab cerdas, diskusi santai, dan bantuan kreatif" },
        { value: "story", label: "Story Mode RPG", emoji: "📖", description: "Petualangan RPG naratif interaktif bersama AI Dungeon Master" },
        { value: "voice", label: "Voice Companion dan DJ", emoji: "🎙️", description: "Bercakap dengan suara asli Naura di Voice Channel" },
        { value: "vision", label: "Analisis Gambar Multimodal", emoji: "👁️", description: "Pahami konteks foto, screenshot, dan diagram visual" },
        { value: "sensei", label: "Naura Sensei", emoji: "🎓", description: "Tutor dan pemandu sistem bot serta pembelajaran" },
        { value: "mystery", label: "Detektif Misteri AI", emoji: "🕵️", description: "Game deduksi sosial dan pemecahan kasus pembunuhan" },
        { value: "persona", label: "Pengaturan Persona", emoji: "🎭", description: "Kustomisasi gaya bicara dan sifat unik Naura AI" },
      ],
      category: "ai",
      userId: interaction.user.id,
      lang: interaction.localeLang,
    });

    return interaction.reply(payload);
  },
};
