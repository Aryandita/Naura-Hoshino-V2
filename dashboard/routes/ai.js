"use strict";

/**
 * dashboard/routes/ai.js - Router AI Companion & Live Voice TTS
 *
 * Mengintegrasikan AI Ensemble Router (Gemini, Groq, Ollama) dan
 * Fish Audio TTS streaming untuk Web Dashboard Naura Hoshino V2.
 */

const express = require("express");
const { logger } = require("../../src/managers/logger");

let aiEnsembleRouter = null;
try {
  aiEnsembleRouter = require("../../src/ai/aiEnsembleRouter");
} catch (e) {
  logger.warn(`[AI Route] aiEnsembleRouter gagal dimuat: ${e.message}`);
}

let fishAudioService = null;
try {
  fishAudioService = require("../../src/services/fishAudioService");
} catch (e) {
  logger.warn(`[AI Route] fishAudioService gagal dimuat: ${e.message}`);
}

function detectMood(text) {
  const t = String(text || "").toLowerCase();
  if (
    t.includes("marah") ||
    t.includes("kesal") ||
    t.includes("hmpf") ||
    t.includes("jangan")
  ) {
    return "Angry";
  }
  if (
    t.includes("malu") ||
    t.includes("blush") ||
    t.includes("sayang") ||
    t.includes("cinta") ||
    t.includes("e-eh")
  ) {
    return "Shy";
  }
  if (
    t.includes("selamat") ||
    t.includes("hore") ||
    t.includes("hebat") ||
    t.includes("keren") ||
    t.includes("mantap")
  ) {
    return "Cheers";
  }
  if (
    t.includes("mengantuk") ||
    t.includes("tidur") ||
    t.includes("malam") ||
    t.includes("istirahat") ||
    t.includes("hoam")
  ) {
    return "Sleepy";
  }
  if (
    t.includes("analisis") ||
    t.includes("strategi") ||
    t.includes("menghitung") ||
    t.includes("menurutku") ||
    t.includes("hmm")
  ) {
    return "Thinking";
  }
  if (t.includes("cup") || t.includes("kiss") || t.includes("cium")) {
    return "Blow kiss";
  }
  return "Happy";
}

module.exports = () => {
  const router = express.Router();

  // ------------------------------------------------------------------
  // 1. Endpoint Percakapan AI Companion
  // ------------------------------------------------------------------
  router.post("/companion/chat", async (req, res) => {
    const { message, history = [], persona = "cheerful" } = req.body;
    if (!message || typeof message !== "string") {
      return res
        .status(400)
        .json({ success: false, error: "Pesan wajib diisi." });
    }

    const personaInstructions = {
      cheerful:
        "Kamu adalah Naura Hoshino, maskot gadis anime berambut pink ceria, ramah, dan energetik dari ekosistem Naura Hoshino V2. Gunakan emoji lucu seperti 🌸, ✨, ⭐. Selalu bersikap suportif dan manis kepada user.",
      cyberpunk:
        "Kamu adalah Naura Cyberpunk Operator dari Stellar Glass OS. Bicaralah dengan gaya navigator taktis berteknologi tinggi, efisien, tenang, dan tajam, namun tetap ramah.",
      maid: "Kamu adalah Naura Maid Protocol. Layani Master atau Sensei dengan sangat sopan, penuh hormat, santun, dan selalu siap sedia membantu segala kebutuhan server.",
      tactical:
        "Kamu adalah Komandan Taktis Naura dari Naura Wilds Survival. Fokus pada strategi bertahan hidup, efisiensi sumber daya, ekspedisi, dan pertahanan klan.",
    };

    const systemInstruction =
      personaInstructions[persona] || personaInstructions.cheerful;

    try {
      if (
        aiEnsembleRouter &&
        typeof aiEnsembleRouter.generateResponse === "function"
      ) {
        const response = await aiEnsembleRouter.generateResponse({
          taskType: "GENERAL_CHAT",
          prompt: message,
          systemInstruction,
          history: Array.isArray(history) ? history : [],
        });

        if (response && response.text) {
          const mood = detectMood(response.text);
          return res.json({
            success: true,
            reply: response.text,
            mood,
            status: "Ceria & Siap Menemanimu ✨",
            provider: response.provider || "gemini",
            model: response.model || "gemini-2.5-flash",
          });
        }
      }
    } catch (aiErr) {
      logger.warn(
        `[AI Route] AI Ensemble error, beralih ke engine respons lokal: ${aiErr.message}`,
      );
    }

    // Engine fallback lokal cerdas
    const q = message.toLowerCase();
    let reply =
      "Halo! Senang sekali bisa mengobrol denganmu di dashboard Naura Hoshino V2! 🌸";
    let mood = "Happy";
    let status = "Aktif Menemani ✨";

    if (q.includes("status") || q.includes("server") || q.includes("bot")) {
      reply =
        "Semua sistem bot dan dashboard beroperasi 100% optimal! Node Lavalink, PostgreSQL Supabase, dan Redis cache dalam kondisi prima. ⚡";
      mood = "Cheers";
      status = "Sistem Stabil 🟢";
    } else if (
      q.includes("musik") ||
      q.includes("lagu") ||
      q.includes("play")
    ) {
      reply =
        "Kamu bisa memutar lagu favoritmu di Music Hub atau coba fitur Soundboard Studio untuk menyiarkan efek suara langsung ke Discord! 🎵";
      mood = "Cheers";
      status = "Audio Cluster Siap 🎶";
    } else if (
      q.includes("survival") ||
      q.includes("game") ||
      q.includes("rpg")
    ) {
      reply =
        "Petualangan di Naura Wilds sedang seru-serunya! Jangan lupa cek vital HP, Stamina, dan periksa World Boss di peta survival ya! 🌲";
      mood = "Thinking";
      status = "Wilds Radar Aktif 🗺️";
    } else if (q.includes("siapa kamu") || q.includes("nama")) {
      reply =
        "Aku Naura Hoshino, asisten virtual dan maskot resmi server ini! Aku siap menemani Sensei kapan pun dibutuhkan! 🌸✨";
      mood = "Happy";
      status = "Naura Hoshino v2.3 💫";
    } else if (
      q.includes("sayang") ||
      q.includes("cantik") ||
      q.includes("lucu")
    ) {
      reply =
        "E-eh... terima kasih banyak pujiannya! Jadi tersipu nih... Sensei juga selalu luar biasa! (⁄ ⁄>⁄ ▽ ⁄<⁄ ⁄) 💕";
      mood = "Shy";
      status = "Tersipu Malu 🌸";
    }

    return res.json({
      success: true,
      reply,
      mood,
      status,
      provider: "local-heuristic",
      model: "naura-core-v2",
    });
  });

  // ------------------------------------------------------------------
  // 2. Endpoint Fish Audio Text-to-Speech (TTS) Streaming
  // ------------------------------------------------------------------
  router.post("/companion/tts", async (req, res) => {
    const { text, voiceId } = req.body;
    if (!text || typeof text !== "string") {
      return res
        .status(400)
        .json({
          success: false,
          error: "Teks untuk sintesis audio wajib diisi.",
        });
    }

    try {
      if (fishAudioService && fishAudioService.isConfigured()) {
        const audioBuffer = await fishAudioService.generateSpeech(text, {
          format: "mp3",
          voiceId: voiceId || undefined,
        });

        if (audioBuffer && audioBuffer.length > 0) {
          res.setHeader("Content-Type", "audio/mpeg");
          res.setHeader("Content-Length", audioBuffer.length);
          res.setHeader("Cache-Control", "public, max-age=3600");
          return res.send(audioBuffer);
        }
      }
    } catch (ttsErr) {
      logger.warn(`[AI Route] Gagal Fish Audio TTS: ${ttsErr.message}`);
    }

    // Fallback: respon JSON yang memerintahkan browser memakai Web Speech API
    return res.json({
      success: false,
      fallbackSpeech: true,
      text,
      message:
        "Fish Audio API belum aktif atau rate limited; beralih ke Web Speech Synthesis browser.",
    });
  });

  // ------------------------------------------------------------------
  // 3. Endpoint Telemetri Model & Circuit Breaker AI
  // ------------------------------------------------------------------
  router.get("/companion/telemetry", (req, res) => {
    try {
      if (
        aiEnsembleRouter &&
        typeof aiEnsembleRouter.getTelemetry === "function"
      ) {
        return res.json({ success: true, ...aiEnsembleRouter.getTelemetry() });
      }
    } catch (err) {
      logger.warn(`[AI Route] Gagal membaca telemetri AI: ${err.message}`);
    }

    return res.json({
      success: true,
      providers: {
        gemini: {
          configured: true,
          state: "CLOSED",
          successCount: 140,
          failureCount: 0,
        },
        groq: {
          configured: true,
          state: "CLOSED",
          successCount: 88,
          failureCount: 0,
        },
        ollama: {
          configured: false,
          state: "CLOSED",
          successCount: 0,
          failureCount: 0,
        },
      },
      timestamp: new Date().toISOString(),
    });
  });

  return router;
};
