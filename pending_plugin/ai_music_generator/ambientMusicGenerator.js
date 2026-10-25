"use strict";

/**
 * @file ambientMusicGenerator.js
 * @description Blueprint Generator Musik/Ambient Sound Berbasis Konteks RPG & Suasana Server.
 * Modul ini diarsipkan di pending_plugin/ agar tidak memicu pemanggilan LLM pada free-tier.
 */

const { logger } = require("../../src/managers/logger");

class AmbientMusicGenerator {
  constructor(generatorId, baseConfig = {}) {
    this.generatorId = generatorId;
    this.name = baseConfig.name || "AI Composer";
    this.defaultGenre = baseConfig.defaultGenre || "ambient";
    this.moodMapping = baseConfig.moodMapping || {
      peaceful: ["forest", "cafe", "morning"],
      tense: ["dungeon", "combat", "night"],
      epic: ["boss", "festival", "victory"],
      melancholy: ["rain", "ruins", "memorial"],
    };
  }

  /**
   * Menghasilkan prompt musik berdasarkan konteks RPG dan aktivitas server
   * @param {string} contextType - Tipe konteks ("rpg_event", "server_activity", "time_based", "user_request")
   * @param {object} contextData - Data konteks (location, weather, playerCount, event)
   * @returns {Promise<{ musicPrompt: string, suggestedTrack: string, duration: number }>}
   */
  async generateAmbientMusic(contextType, contextData = {}) {
    try {
      logger.info(`[AmbientMusic:${this.generatorId}] Generating music for context: ${contextType}`);

      const location = contextData.location || "village";
      const weather = contextData.weather || "clear";
      const timeOfDay = contextData.timeOfDay || "day";
      const playerActivity = contextData.playerActivity || "idle";

      let promptTemplate = `Buat deskripsi musik ambient untuk game RPG dengan detail berikut:\n`;
      promptTemplate += `Lokasi: ${location}. Cuaca: ${weather}. Waktu: ${timeOfDay}.\n`;
      promptTemplate += `Aktivitas pemain: ${playerActivity}. Genre dasar: ${this.defaultGenre}.\n`;
      promptTemplate += `Berikan rekomendasi track dalam format JSON: { title, mood, instruments[], tempo }.`;

      const mood = this._detectMood(location, weather, timeOfDay);
      const suggestedTrack = this._generateSimulatedTrack(mood, location);

      return {
        generatorId: this.generatorId,
        generatorName: this.name,
        promptPrepared: promptTemplate,
        detectedMood: mood,
        suggestedTrack,
        duration: 180,
        readyForAiActivation: true,
      };
    } catch (error) {
      logger.error(`[AmbientMusic] Galat pada generator ${this.generatorId}:`, error);
      return {
        generatorId: this.generatorId,
        generatorName: this.name,
        detectedMood: "neutral",
        suggestedTrack: { title: "Village Ambience", mood: "peaceful" },
        duration: 180,
        readyForAiActivation: false,
      };
    }
  }

  /**
   * Mendeteksi mood berdasarkan parameter lingkungan
   * @param {string} location
   * @param {string} weather
   * @param {string} timeOfDay
   * @returns {string}
   */
  _detectMood(location, weather, timeOfDay) {
    if (["dungeon", "boss_arena", "battlefield"].includes(location)) return "tense";
    if (["festival_grounds", "town_square"].includes(location)) return "epic";
    if (weather === "storm" || timeOfDay === "midnight") return "melancholy";
    return "peaceful";
  }

  _generateSimulatedTrack(mood, location) {
    const tracks = {
      peaceful: { title: `${location} Serenity`, mood: "calm", instruments: ["flute", "harp", "nature_sounds"], tempo: 70 },
      tense: { title: `Danger in ${location}`, mood: "suspense", instruments: ["drums", "strings", "bass"], tempo: 120 },
      epic: { title: `Glory of ${location}`, mood: "triumphant", instruments: ["orchestra", "choir", "percussion"], tempo: 140 },
      melancholy: { title: `${location} Memories`, mood: "nostalgic", instruments: ["piano", "cello", "rain"], tempo: 60 },
    };
    return tracks[mood] || tracks.peaceful;
  }
}

module.exports = {
  AmbientMusicGenerator,
};
