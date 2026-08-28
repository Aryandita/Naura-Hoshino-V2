"use strict";

const GuildPersona = require("../models/GuildPersona");
const geminiClient = require("./geminiClient");
const { logger } = require("../managers/logger");

const PERSONA_TONES = {
  TSUNDERE:
    "Gaya bicara Tsundere: pura-pura kesal, ketus, suka bilang 'B-Bukan karena aku peduli padamu ya!', tapi sebenarnya perhatian.",
  CYBER_HACKER:
    "Gaya bicara Cyber Hacker: analitis, penuh istilah teknologi (firewall, proxy, glitch, mainframe), misterius.",
  ANCIENT_SAGE:
    "Gaya bicara Bijak Kuno: menggunakan bahasa puitis kuno, sering menyebut ramalan bintang dan takdir kosmis.",
  BLACKSMITH:
    "Gaya bicara Pandai Besi: lantang, percaya diri, bangga pada baja tempaan dan api peleburan.",
  KUUDERE:
    "Gaya bicara Kuudere: sangat tenang, dingin, minim emosi berlebihan, sangat efisien dan logis.",
};

class PersonaEngine {
  /**
   * Buat atau perbarui sub-persona di server
   */
  static async createOrUpdatePersona(
    guildId,
    { personaId, channelId, name, systemPrompt, voiceTone = "TSUNDERE" },
  ) {
    const pId = personaId || `persona_${Date.now()}`;
    const [persona, created] = await GuildPersona.findOrCreate({
      where: { personaId: pId },
      defaults: {
        personaId: pId,
        guildId,
        channelId: channelId || null,
        name,
        systemPrompt,
        voiceTone,
        isActive: true,
      },
    });

    if (!created) {
      persona.name = name;
      persona.systemPrompt = systemPrompt;
      persona.voiceTone = voiceTone;
      if (channelId) persona.channelId = channelId;
      await persona.save();
    }

    logger.info(
      `[PersonaEngine] Persona "${name}" (${voiceTone}) disimpan di guild ${guildId}.`,
    );
    return persona.toJSON();
  }

  /**
   * Ambil daftar persona di guild
   */
  static async getPersonas(guildId) {
    const list = await GuildPersona.findAll({ where: { guildId } });
    return list.map((p) => p.toJSON());
  }

  /**
   * Ambil persona aktif untuk channel tertentu
   */
  static async getActivePersona(guildId, channelId = null) {
    if (channelId) {
      const channelSpecific = await GuildPersona.findOne({
        where: { guildId, channelId, isActive: true },
      });
      if (channelSpecific) return channelSpecific.toJSON();
    }

    const defaultGuild = await GuildPersona.findOne({
      where: { guildId, isActive: true },
    });
    return defaultGuild ? defaultGuild.toJSON() : null;
  }

  /**
   * Hasilkan balasan dengan kepribadian persona via Gemini AI
   */
  static async chatWithPersona(
    guildId,
    channelId,
    userMessage,
    userName = "Pengguna",
  ) {
    const persona = await this.getActivePersona(guildId, channelId);

    const toneInstruction =
      persona && PERSONA_TONES[persona.voiceTone]
        ? PERSONA_TONES[persona.voiceTone]
        : PERSONA_TONES.TSUNDERE;
    const personaName = persona ? persona.name : "Naura (Cyber Maid)";
    const customPrompt = persona
      ? persona.systemPrompt
      : "Kamu adalah asisten anime cerdas di Discord.";

    const prompt = `Nama Persona: "${personaName}".
Instruksi Karakter: ${customPrompt}.
Panduan Tone: ${toneInstruction}.
Pengguna yang berbicara: "${userName}".
Pesan Pengguna: "${userMessage}".

Jawab dalam 1-3 kalimat yang sangat mencerminkan karakter di atas secara alami, interaktif, dan ramah. TANPA FORMATTING ANEH.`;

    let reply = null;
    try {
      reply = await geminiClient.generate({ parts: [{ text: prompt }] });
    } catch (err) {
      logger.warn("[PersonaEngine] Gagal memanggil AI:", err.message);
    }

    if (!reply) {
      reply = `Hmph! ${userName}, jangan membuatku menunggu jawaban terlalu lama ya!`;
    }

    return {
      personaName,
      voiceTone: persona ? persona.voiceTone : "TSUNDERE",
      reply,
    };
  }
}

module.exports = PersonaEngine;
module.exports.PERSONA_TONES = PERSONA_TONES;
