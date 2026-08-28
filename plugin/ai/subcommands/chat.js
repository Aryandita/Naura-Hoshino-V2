"use strict";

const geminiClient = require("../../../src/ai/geminiClient");
const { tools } = require("../../../src/ai/functionDispatcher");
const AIMemory = require("../../../src/ai/aiMemory");
const ui = require("../../../src/config/ui");
const GuildSettings = require("../../../src/models/GuildSettings");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const MODEL = "gemini-2.5-flash";
const PROVIDER = "Gemini 2.5 Flash";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/** Rangkai perintah sistem, lengkap dengan memori user & penyesuaian khusus server. */
async function buildInstruction(guildId, userId, username) {
  let instruction =
    "Kamu adalah Naura Hoshino, gadis asisten virtual yang ceria, perhatian, suportif, dan murah senyum. " +
    "Bicaralah langsung kepada pengguna dengan hangat dan akrab, seperti sahabat dekat yang senang membantu. " +
    'Sebut dirimu "Naura", bukan "saya". Jika kamu menggunakan tools/function call untuk mengambil data, sampaikan hasilnya dengan gaya bahasa yang natural, santai, dan ramah.';

  if (username) {
    instruction += ` Kamu saat ini sedang berbicara dengan ${username}.`;
  }

  // Inject AI Memory Context (nama panggilan, preferensi musik, fakta)
  if (userId) {
    try {
      const memoryContext = await AIMemory.getMemoryContext(userId);
      if (memoryContext) {
        instruction += `\n${memoryContext}`;
      }
    } catch (memErr) {
      logger.warn("[AI Chat] Gagal memuat AIMemory:", memErr.message);
    }
  }

  // Server-specific settings
  try {
    const [row] = await GuildSettings.findOrCreate({
      where: { guildId: guildId || "DM" },
    });
    const settings = row.settings || {};

    if (settings.ai?.customPersona) {
      instruction += ` Sifat khusus di server ini: ${settings.ai.customPersona}`;
    }
    if (settings.ai?.serverKnowledge) {
      instruction += ` Hal khusus yang perlu kamu tahu tentang server ini: ${settings.ai.serverKnowledge}`;
    }
  } catch (err) {
    // Abaikan error DB settings
  }

  return instruction;
}

module.exports = async function chat(interaction) {
  const prompt = interaction.options.getString("pesan");
  const userId = interaction.user.id;
  const username = interaction.user.username;
  const systemInstruction = await buildInstruction(
    interaction.guildId,
    userId,
    username,
  );

  const messageProxy = {
    author: interaction.user,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
  };

  let replyText;
  try {
    replyText = await geminiClient.generate({
      parts: [{ text: prompt }],
      model: MODEL,
      config: {
        systemInstruction,
        tools: [{ functionDeclarations: tools }],
      },
      message: messageProxy,
    });

    // Jalankan ekstraksi memori otomatis di latar belakang (non-blocking)
    AIMemory.extractAndSave(userId, prompt, replyText, geminiClient).catch(
      (err) => {
        logger.warn(
          "[AI Chat] Background memory extraction error:",
          err.message,
        );
      },
    );
  } catch (error) {
    logger.error("[AI Chat] Gemini gagal menjawab:", error);
    replyText =
      "Maaf yaa, pikiran Naura lagi tersendat sedikit. Coba tanya lagi sebentar lagi, ya?";
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura AI Chat",
    title: `${e("happy", "\uD83D\uDCAC")} Naura menjawab`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description: `**Kamu bertanya:**\n${prompt}\n\n**Naura:**\n${replyText}`,
    footerText: `Powered by Naura Intelligent System \u2022 Diminta oleh ${interaction.user.displayName || interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
