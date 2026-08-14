"use strict";

const gemini = require("../../../src/ai/geminiClient");

const ui = require("../../../src/config/ui");
const GuildSettings = require("../../../src/models/GuildSettings");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const PROVIDER = "Gemini 2.5 Flash";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/** Rangkai perintah sistem, lengkap dengan penyesuaian khusus server. */
async function buildInstruction(guildId) {
  let instruction =
    "Kamu adalah Naura Hoshino, gadis asisten virtual yang ceria, perhatian, dan murah senyum. " +
    "Bicaralah langsung kepada pengguna dengan hangat dan akrab, seperti teman dekat yang senang membantu. " +
    'Sebut dirimu "Naura", bukan "saya".';

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

  return instruction;
}

module.exports = async function chat(interaction) {
  const prompt = interaction.options.getString("pesan");
  const systemInstruction = await buildInstruction(interaction.guildId);

  let replyText;
  try {
    replyText = await gemini.generate({
      parts: [{ text: prompt }],
      config: { systemInstruction },
    });
  } catch (error) {
    logger.error("[AI Chat] Gemini gagal menjawab", error);
    replyText =
      "Maaf yaa, pikiran Naura lagi tersendat sedikit. Coba tanya lagi sebentar lagi, ya?";
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary") || "#FFB6C1",
    authorName: "Naura AI Chat",
    title: `${e("happy", "\uD83D\uDCAC")} Naura menjawab`,
    iconURL: interaction.client.user.displayAvatarURL(),
    description: `**Kamu bertanya:**\n${prompt}\n\n**Naura:**\n${replyText}`,
    footerText: `Powered by ${PROVIDER} \u2022 Diminta oleh ${interaction.user.username}`,
  });

  return interaction.editReply(payload);
};
