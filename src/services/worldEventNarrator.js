"use strict";

/**
 * @file worldEventNarrator.js
 * @description Narator Peristiwa Dunia yang Mengubah Log Server Menjadi Narasi Sinematik via OpenRouter.
 * Terintegrasi ke aiEnsembleRouter dengan fallback prosedural instan saat offline atau circuit-breaker aktif.
 */

const { logger } = require("../managers/logger");
const aiEnsembleRouter = require("../ai/aiEnsembleRouter");

class WorldEventNarrator {
  /**
   * @param {string} [narratorId="default_narrator"] - ID unik narator
   * @param {object} [baseConfig={}] - Konfigurasi gaya narasi dan nama narator
   */
  constructor(narratorId = "default_narrator", baseConfig = {}) {
    this.narratorId = narratorId;
    this.name = baseConfig.name || "AI Lore Narrator";
    this.narrativeStyles = {
      epic: "Gaya epik seperti kronik kerajaan kuno",
      mysterious: "Gaya misterius dengan nuansa gelap dan teka-teki",
      cheerful: "Gaya ceria untuk perayaan dan festival",
      dramatic: "Gaya dramatis untuk konflik dan pertempuran besar",
      poetic: "Gaya puitis dengan metafora dan rima",
    };
    this.eventTemplates = new Map();
  }

  /**
   * Menghasilkan narasi sinematik dari log peristiwa server menggunakan OpenRouter
   * Mendukung dua variasi signature:
   * 1. narrateWorldEvent(guildId, eventData, narrativeStyle)
   * 2. narrateWorldEvent(eventData, narrativeStyle)
   *
   * @param {string|object} guildIdOrEventData - ID Guild Discord atau objek eventData langsung
   * @param {object|string} [eventDataOrStyle={}] - Data peristiwa atau nama gaya narasi
   * @param {string} [maybeStyle="epic"] - Nama gaya narasi jika parameter pertama adalah guildId
   * @returns {Promise<{ narratorId: string, narratorName: string, promptPrepared: string, narration: string, text: string, title: string, style: string, embedReady: boolean, readyForAiActivation: boolean, isAiGenerated: boolean }>}
   */
  async narrateWorldEvent(guildIdOrEventData, eventDataOrStyle = {}, maybeStyle = "epic") {
    try {
      let guildId = null;
      let eventData = {};
      let narrativeStyle = "epic";

      if (typeof guildIdOrEventData === "string") {
        guildId = guildIdOrEventData;
        eventData = typeof eventDataOrStyle === "object" && eventDataOrStyle !== null ? eventDataOrStyle : {};
        narrativeStyle = typeof maybeStyle === "string" ? maybeStyle : "epic";
      } else if (typeof guildIdOrEventData === "object" && guildIdOrEventData !== null) {
        eventData = guildIdOrEventData;
        narrativeStyle = typeof eventDataOrStyle === "string" ? eventDataOrStyle : "epic";
        guildId = eventData.guildId || null;
      }

      logger.info(`[WorldNarrator:${this.narratorId}] Narrating event for guild ${guildId || "global"}`);

      const eventType =
        String(eventData.type || "generic")
          .replace(/[\r\n`]/g, " ")
          .trim()
          .slice(0, 48) || "generic";
      const participants = Array.isArray(eventData.participants)
        ? eventData.participants.map((p) =>
            String(p).replace(/[\r\n`]/g, " ").trim().slice(0, 48),
          )
        : [];
      const outcome =
        String(eventData.outcome || "unknown")
          .replace(/[\r\n`]/g, " ")
          .trim()
          .slice(0, 48) || "unknown";
      const location =
        String(eventData.location || "Naura Wilds")
          .replace(/[\r\n`]/g, " ")
          .trim()
          .slice(0, 64) || "Naura Wilds";
      const selectedStyle = this.narrativeStyles[narrativeStyle] || this.narrativeStyles.epic;

      const participantList = participants.length > 0
        ? participants.slice(0, 5).join(", ") + (participants.length > 5 ? ", dkk." : "")
        : "para petualang";

      let promptTemplate = `Ubah log peristiwa berikut menjadi narasi sinematik RPG:\n`;
      promptTemplate += `Gaya narasi: ${selectedStyle}.\n`;
      promptTemplate += `Tipe event: ${eventType}. Lokasi: ${location}.\n`;
      promptTemplate += `Partisipan (${participants.length}): ${participantList}.\n`;
      promptTemplate += `Hasil: ${outcome}.\n`;
      promptTemplate += `Buat narasi 2-3 paragraf dalam bahasa Indonesia. Cantumkan judul dramatis pada baris pertama dengan awalan "Judul: [Nama Judul]". Jangan gunakan karakter em dash.`;

      const simulatedNarration = this._generateSimulatedNarration(
        eventType,
        participants,
        outcome,
        narrativeStyle,
        location
      );

      let finalTitle = simulatedNarration.title;
      let finalNarrationText = simulatedNarration.text;
      let isAi = false;

      try {
        const aiResponse = await aiEnsembleRouter.generate({
          taskType: aiEnsembleRouter.TASK_TYPES.ROLEPLAY_STORY,
          prompt: promptTemplate,
          systemInstruction:
            "Kamu adalah AI Lore Narrator dan Chronicler Naura Wilds. Ciptakan narasi sinematik RPG yang imersif dan hidup dalam bahasa Indonesia. Baris pertama wajib diawali dengan format 'Judul: [Judul Event]'. Jangan pernah gunakan karakter em dash.",
          config: { temperature: 0.8, maxOutputTokens: 600 },
          userId: eventData.userId || null,
          userTier: eventData.tier || eventData.premium_tier || "free",
        });

        if (
          aiResponse &&
          typeof aiResponse.text === "string" &&
          aiResponse.text.trim().length > 0 &&
          aiResponse.provider !== "fallback" &&
          !aiResponse.isPremiumRestricted
        ) {
          const rawText = aiResponse.text.replace(/[\u2014\u2013]/g, "-").trim();
          const lines = rawText.split("\n").map((l) => l.trim()).filter(Boolean);

          if (lines.length > 0) {
            const firstLine = lines[0];
            const titleMatch = firstLine.match(/^(?:Judul|Title):\s*(.+)$/i);

            if (titleMatch) {
              finalTitle = titleMatch[1].trim();
              finalNarrationText = lines.slice(1).join("\n\n").trim();
            } else if (firstLine.startsWith("#")) {
              finalTitle = firstLine.replace(/^#+\s*/, "").trim();
              finalNarrationText = lines.slice(1).join("\n\n").trim();
            } else {
              finalNarrationText = rawText;
            }
            if (!finalNarrationText) {
              finalNarrationText = rawText;
            }
            isAi = true;
          }
        }
      } catch (aiErr) {
        logger.warn(
          `[WorldNarrator:${this.narratorId}] OpenRouter gagal (${aiErr.message}), beralih ke narasi prosedural.`
        );
      }

      // Pastikan string bersih dari em dash
      finalTitle = String(finalTitle || "Peristiwa Dunia").replace(/[\u2014\u2013]/g, "-");
      finalNarrationText = String(finalNarrationText || "Peristiwa telah terjadi di Naura Wilds.").replace(
        /[\u2014\u2013]/g,
        "-"
      );

      return {
        narratorId: this.narratorId,
        narratorName: this.name,
        promptPrepared: promptTemplate,
        narration: finalNarrationText,
        text: finalNarrationText,
        title: finalTitle,
        style: narrativeStyle,
        embedReady: true,
        readyForAiActivation: true,
        isAiGenerated: isAi,
      };
    } catch (error) {
      logger.error(`[WorldNarrator] Galat pada narrator ${this.narratorId}:`, error);
      return {
        narratorId: this.narratorId,
        narratorName: this.name,
        promptPrepared: "",
        narration: "Sebuah peristiwa telah terjadi di Naura Wilds...",
        text: "Sebuah peristiwa telah terjadi di Naura Wilds...",
        title: "Peristiwa Dunia",
        style: "epic",
        embedReady: false,
        readyForAiActivation: false,
        isAiGenerated: false,
      };
    }
  }

  /**
   * Mendaftarkan template narasi khusus untuk tipe event tertentu
   * @param {string} eventType
   * @param {string} template
   */
  registerEventTemplate(eventType, template) {
    this.eventTemplates.set(eventType, template);
    logger.info(`[WorldNarrator:${this.narratorId}] Template registered for: ${eventType}`);
  }

  /**
   * Generator narasi prosedural instan sebagai fallback tanpa biaya
   * @param {string} type
   * @param {Array<string>} participants
   * @param {string} outcome
   * @param {string} style
   * @param {string} location
   * @returns {{ title: string, text: string }}
   */
  _generateSimulatedNarration(type, participants, outcome, style, location) {
    const participantList = Array.isArray(participants) && participants.length > 0
      ? participants.slice(0, 3).join(", ")
      : "para petualang pemberani";

    const narratives = {
      boss_defeat: {
        epic: {
          title: `Kemenangan Gemilang di ${location}`,
          text: `Di bawah langit kelam ${location}, ${participantList} berdiri tegak menghadapi sang tiran. Dengan tekad membara dan pedang berkilau, mereka menumbangkan musuh yang telah lama meneror desa. Sejarah akan mencatat hari ini sebagai awal era baru.`,
        },
        dramatic: {
          title: `Pertarungan Terakhir di ${location}`,
          text: `Darah dan keringat membasahi tanah ${location}. ${participantList} hampir kehilangan harapan ketika monster itu bangkit kembali. Namun dengan serangan terakhir yang menentukan, kegelapan pun sirna. Kemenangan diraih dengan harga yang mahal.`,
        },
      },
      festival: {
        cheerful: {
          title: `Kegembiraan Melanda ${location}`,
          text: `Sorak sorai terdengar di seluruh penjuru ${location}! ${participantList} memimpin perayaan dengan tarian dan nyanyian. Makanan lezat tersaji, hadiah dibagikan, dan senyum menghiasi wajah setiap warga. Hari yang takkan terlupakan!`,
        },
      },
      trade_milestone: {
        epic: {
          title: `Era Kemakmuran Ekonomi di ${location}`,
          text: `Pasar ${location} kini lebih hidup dari sebelumnya. ${participantList} telah mencapai tonggak perdagangan yang mengesankan. Emas mengalir, barang langka berpindah tangan, dan ekonomi desa memasuki babak baru yang menjanjikan.`,
        },
      },
      dungeon_clear: {
        epic: {
          title: `Penaklukan Dungeon ${location}`,
          text: `Kegelapan dungeon ${location} akhirnya terusir oleh cahaya keberanian ${participantList}. Setiap ruangan yang dilewati dipenuhi jebakan mematikan, namun tekad mereka tak pernah padam. Harta karun legendaris kini menjadi milik mereka!`,
        },
      },
      clan_war: {
        dramatic: {
          title: `Pertempuran Klan di ${location}`,
          text: `Tanah ${location} berguncang oleh benturan senjata dan teriakan perang. ${participantList} memimpin klan mereka menuju kemenangan epik. Strategi brilian dan kerja sama tim mengalahkan kekuatan musuh.`,
        },
      },
      generic: {
        epic: {
          title: `Catatan dari ${location}`,
          text: `Di ${location}, sebuah peristiwa penting telah tercatat. ${participantList} terlibat dalam kejadian yang akan mengubah jalannya sejarah. Petualangan baru telah dimulai.`,
        },
      },
    };

    const typeNarratives = narratives[type] || narratives.generic;
    const styleNarrative = typeNarratives[style] || typeNarratives.epic || Object.values(typeNarratives)[0];

    return (
      styleNarrative || {
        title: `Peristiwa di ${location}`,
        text: `${participantList} mengalami sesuatu yang luar biasa di ${location}.`,
      }
    );
  }
}

const defaultEventNarrator = new WorldEventNarrator("default_narrator");

module.exports = WorldEventNarrator;
module.exports.WorldEventNarrator = WorldEventNarrator;
module.exports.defaultEventNarrator = defaultEventNarrator;
