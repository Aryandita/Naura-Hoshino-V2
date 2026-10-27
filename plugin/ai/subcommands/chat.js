"use strict";

/**
 * 💬 AI Chat Subcommand - Naura AI Conversation - Naura Hoshino V2
 * -----------------------------------------------------------------
 * Handles AI chat interactions with Gemini 2.5 Flash model.
 * Supports document attachments, AI memory context, and custom personas.
 *
 * Features:
 * - Gemini 2.5 Flash model integration
 * - Document attachment parsing (PDF, text, etc.)
 * - AI Memory context injection (user preferences, facts)
 * - Server-specific custom persona support
 * - Automatic memory extraction in background
 * - Function calling support via tools
 *
 * @module plugin/ai/subcommands/chat
 */

const geminiClient = require("../../../src/ai/geminiClient");
const { tools } = require("../../../src/ai/functionDispatcher");
const AIMemory = require("../../../src/ai/aiMemory");
const ui = require("../../../src/config/ui");
const GuildSettings = require("../../../src/models/GuildSettings");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

// ============================================================================
// CONSTANTS
// ============================================================================

/** AI model identifier for chat interactions */
const MODEL = "gemini-2.5-flash";

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get emoji by name with fallback.
 * @param {string} name - Emoji key
 * @param {string} fallback - Fallback emoji
 * @returns {string} Resolved emoji
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Build system instruction with user memory and server settings.
 * Combines base persona, user context, and server-specific customization.
 * @param {string} guildId - Guild ID for server settings
 * @param {string} userId - User ID for memory context
 * @param {string} username - Username for personalization
 * @returns {Promise<string>} Complete system instruction
 */
async function buildInstruction(guildId, userId, username) {
  let instruction =
    "Kamu adalah Naura Hoshino, gadis asisten virtual yang ceria, perhatian, suportif, dan murah senyum. " +
    "Bicaralah langsung kepada pengguna dengan hangat dan akrab, seperti sahabat dekat yang senang membantu. " +
    'Sebut dirimu "Naura", bukan "saya". Jika kamu menggunakan tools/function call untuk mengambil data, sampaikan hasilnya dengan gaya bahasa yang natural, santai, dan ramah.';

  // Add username context
  if (username) {
    instruction += ` Kamu saat ini sedang berbicara dengan ${username}.`;
  }

  // Inject AI Memory Context (nickname, music preferences, facts)
  if (userId) {
    try {
      const memoryContext = await AIMemory.getMemoryContext(userId);
      if (memoryContext) {
        instruction += `\n${memoryContext}`;
      }
    } catch (memErr) {
      logger.warn("[AI Chat] Failed to load AIMemory:", memErr.message);
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
    logger.error("[chat:buildInstruction] Database operation failed: " + (err?.message || err), err);
  }

  return instruction;
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Execute AI chat subcommand.
 * Processes user message with optional document attachment and returns AI response.
 * @param {object} interaction - Discord interaction
 * @returns {Promise<void>}
 */
module.exports = async function chat(interaction) {
  // Extract user input
  const basePrompt = interaction.options.getString("pesan");
  const attachment = interaction.options.getAttachment("lampiran");
  let documentContext = "";

  // Parse document attachment if provided
  if (attachment) {
    try {
      const { parseDocument } = require("../../../src/ai/documentParser");
      const parsed = await parseDocument(attachment.url, { fileName: attachment.name });
      const snippet = (parsed.text || "").slice(0, 4000);
      documentContext = `\n\n--- LAMPIRAN DOKUMEN (${attachment.name}) ---\n${snippet}\n--- AKHIR LAMPIRAN ---`;
    } catch (docErr) {
      documentContext = `\n\n[Gagal membaca lampiran ${attachment.name}: ${docErr.message}]`;
    }
  }

  // Build complete prompt with document context
  const prompt = `${basePrompt}${documentContext}`;
  const userId = interaction.user.id;
  const username = interaction.user.username;

  // Build system instruction with memory and server settings
  const systemInstruction = await buildInstruction(
    interaction.guildId,
    userId,
    username,
  );

  // Create message proxy for function calling context
  const messageProxy = {
    author: interaction.user,
    user: interaction.user,
    member: interaction.member,
    guild: interaction.guild,
    channel: interaction.channel,
  };

  // Generate AI response
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

    // Run automatic memory extraction in background (non-blocking)
    AIMemory.extractAndSave(userId, prompt, replyText, geminiClient).catch(
      (err) => {
        logger.warn(
          "[AI Chat] Background memory extraction error:",
          err.message,
        );
      },
    );
  } catch (error) {
    logger.error("[AI Chat] Gemini failed to respond:", error);
    replyText =
      "Maaf yaa, pikiran Naura lagi tersendat sedikit. Coba tanya lagi sebentar lagi, ya?";
  }

  // Build and send response
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura AI Chat",
    title: `${e("happy", "💬")} Naura menjawab`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description: `**Kamu bertanya:**\n${prompt}\n\n**Naura:**\n${replyText}`,
    footerText: `Powered by Naura Intelligent System • Diminta oleh ${interaction.user.displayName || interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
