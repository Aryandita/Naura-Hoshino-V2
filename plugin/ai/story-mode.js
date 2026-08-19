"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const redisManager = require("../../src/managers/redisManager");
const cacheManager = require("../../src/managers/cacheManager");
const aiManager = require("../../src/managers/aiManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("story")
    .setDescription("Mulai petualangan interaktif (Dungeon Master) dengan Naura!")
    .addStringOption((opt) =>
      opt
        .setName("aksi")
        .setDescription("Apa yang ingin kamu lakukan di dunia ini?")
        .setRequired(true)
    ),

  async execute(interaction, client) {
    const aksi = interaction.options.getString("aksi");
    const userId = interaction.user.id;

    // 1. Check Cooldown (5 minutes)
    const cooldownKey = `story:cooldown:${userId}`;
    const onCooldown = await redisManager.getCache(cooldownKey);
    if (onCooldown) {
      const remaining = Math.ceil((onCooldown - Date.now()) / 60000);
      return interaction.reply(
        buildErrorContainerV2({
          title: "Sedang Beristirahat",
          description: `⏳ | Naura masih memikirkan jalan ceritamu selanjutnya. Tunggu sekitar ${remaining} menit lagi ya!`,
          footerText: ui.getFooter("utility"),
        })
      );
    }

    await interaction.deferReply();
    
    // Set Cooldown 5 minutes
    await redisManager.setCache(cooldownKey, Date.now() + 5 * 60 * 1000, 300);

    const systemPrompt = `Kamu adalah AI Dungeon Master untuk game RPG. Pemain sedang mengirimkan aksinya: "${aksi}". 
Lanjutkan ceritanya dalam 2-3 paragraf singkat dengan bahasa Indonesia yang imersif dan menarik. 
Jangan membuat pilihan untuk pemain, tapi berikan mereka deskripsi apa yang terjadi.`;

    try {
      // 2. Fetch AI Response
      const aiClient = aiManager.getGenAI();
      if (!aiClient) {
        throw new Error("Gemini tidak dikonfigurasi.");
      }

      // Memory session for story
      const sessionData = (await aiManager.getMemory(userId, "story_gemini")) || { history: [] };
      sessionData.history.push({ role: "user", parts: [{ text: aksi }] });

      const gemConfig = {
        systemInstruction: systemPrompt,
        maxOutputTokens: 1000,
      };

      const gemResult = await aiClient.models.generateContent({
        model: aiManager._defaultModel,
        contents: sessionData.history,
        config: gemConfig,
      });

      const responseText = gemResult.text;
      sessionData.history.push({ role: "model", parts: [{ text: responseText }] });
      
      // Keep only last 10 messages for context window
      if (sessionData.history.length > 10) sessionData.history = sessionData.history.slice(-10);
      await aiManager.saveMemory(userId, "story_gemini", sessionData);

      // 3. Sync to RPG State (Give XP/Fragments for progressing the story)
      const xpReward = Math.floor(Math.random() * 20) + 10;
      await cacheManager.incrementUserSurvival(userId, "starFragments", xpReward);

      // 4. Send Response
      const payload = buildContainerV2({
        accentColorHex: "#3498DB",
        authorName: "Dungeon Master Naura",
        title: "📜 Catatan Petualangan",
        description: responseText + `\n\n**+${xpReward} Star Fragments** 🌟`,
        footerText: "Gunakan /story <aksi> lagi untuk melanjutkan!",
      });

      return interaction.editReply(payload);
    } catch (e) {
      await redisManager.client.del(cooldownKey);
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Sihir Gagal",
          description: "❌ | Naura kehilangan koneksi ke dunia fantasi. Coba lagi nanti ya!",
          footerText: ui.getFooter("utility"),
        })
      );
    }
  },
};
