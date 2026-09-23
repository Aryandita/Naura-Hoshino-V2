"use strict";

const { logger } = require("../managers/logger");
const aiManager = require("../managers/aiManager");
const canvasWorkerPool = require("../canvas/canvasWorkerPool");

// Preset aura fallback jika AI offline / rate-limited
const FALLBACK_AURAS = [
  {
    auraName: "ASTRAL MELODIC VOYAGER",
    description:
      "Jiwa musikmu memancarkan resonansi frekuensi kosmik yang tenang, memadukan ketukan ritmis dengan harmoni melankolis nan syahdu.",
    primaryColor: "#38BDF8",
    secondaryColor: "#C084FC",
    signatureTrack: "City Lights & Rainy Lo-Fi",
    genres: ["Lo-Fi Beats", "Chillhop", "Synthwave"],
    energy: 68,
    tempo: 84,
  },
  {
    auraName: "CYBERPUNK NEON DRIFTER",
    description:
      "Detak musikmu dipenuhi distorsi bass futuristik dan energi distrik malam kota megapolitan yang tak pernah terlelap.",
    primaryColor: "#00F2FF",
    secondaryColor: "#FF2A85",
    signatureTrack: "Neon Skyline Overdrive",
    genres: ["Cyberpunk", "Synthwave", "Electro House"],
    energy: 92,
    tempo: 128,
  },
  {
    auraName: "COSMIC EUPHORIA HARMONIST",
    description:
      "Setiap nada yang kamu putar membangkitkan euforia murni, mengalirkan semangat tanpa batas ke seluruh jiwa di sekitarmu.",
    primaryColor: "#F59E0B",
    secondaryColor: "#EC4899",
    signatureTrack: "Starlight Anthem Festival",
    genres: ["Anime OST", "J-Pop", "Future Bass"],
    energy: 88,
    tempo: 140,
  },
  {
    auraName: "ETHEREAL MIDNIGHT DREAMER",
    description:
      "Koleksi alunan lagumu seperti kabut malam yang menenangkan batin, membawamu mengembara di antara mimpi dan kenyataan.",
    primaryColor: "#8B5CF6",
    secondaryColor: "#06B6D4",
    signatureTrack: "Velvet Moon Reverie",
    genres: ["Ambient", "Post-Rock", "Acoustic"],
    energy: 45,
    tempo: 72,
  },
  {
    auraName: "VERDANT NATURE REVERIE",
    description:
      "Harmoni petualanganmu selaras dengan bisikan dedaunan hutan belantara Naura Wilds dan gemericik air sungai alami.",
    primaryColor: "#10B981",
    secondaryColor: "#38BDF8",
    signatureTrack: "Wilderness Morning Flute",
    genres: ["Folk", "Orchestral", "Indie Pop"],
    energy: 60,
    tempo: 90,
  },
];

/**
 * Generate music aura personality analysis & rendered canvas card.
 * @param {object} params
 * @param {string} params.username - Username pengguna Discord
 * @param {string} params.avatarUrl - URL Avatar PNG pengguna
 * @param {Array<string>} [params.tracks] - Daftar judul lagu yang pernah diputar
 * @param {string} [params.guildName] - Nama Server Discord
 * @returns {Promise<{ auraData: object, cardBuffer: Buffer }>}
 */
async function generateMusicAura({
  username,
  avatarUrl,
  tracks = [],
  guildName = "",
}) {
  let auraData = null;

  // 1. Upayakan ekstraksi aura dari Gemini AI
  try {
    const genAI = aiManager.getGenAI();
    if (genAI && tracks.length > 0) {
      const trackSample = tracks.slice(0, 10).join(", ");
      const prompt = `Analisis selera musik dan tentukan kepribadian aura musik untuk pengguna "${username}" di server "${guildName || "Komunitas"}".
Daftar trek musik yang sering didengarkan: ${trackSample}.
Balas HANYA dalam format JSON valid tanpa markdown tambahan dengan struktur berikut:
{
  "auraName": "NAMA AURA HURUF KAPITAL (contoh: CYBERPUNK MELANCHOLY atau ASTRAL RESONATOR)",
  "description": "2-3 kalimat deskripsi puitis kepribadian musik dalam bahasa Indonesia santai dan keren",
  "primaryColor": "#HEXCOLOR (warna neon utama)",
  "secondaryColor": "#HEXCOLOR (warna neon pendukung)",
  "signatureTrack": "Judul trek yang paling ikonik",
  "genres": ["Genre1", "Genre2", "Genre3"],
  "energy": 75,
  "tempo": 120
}`;

      const aiResponse = await genAI.models.generateContent({
        model: aiManager._defaultModel || "gemini-2.5-flash",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
      });

      const rawText = aiResponse.text ? aiResponse.text.trim() : "";
      const cleanedJson = rawText
        .replace(/```json/g, "")
        .replace(/```/g, "")
        .trim();
      auraData = JSON.parse(cleanedJson);
    }
  } catch (aiErr) {
    logger.warn(`[MusicAuraService] AI analysis fallback: ${aiErr.message}`);
  }

  // 2. Fallback deterministik jika AI tidak mengembalikan JSON
  if (!auraData || !auraData.auraName) {
    let hash = 0;
    const seed = `${username}_${tracks.join("_")}`;
    for (let i = 0; i < seed.length; i++) {
      hash = (hash << 5) - hash + seed.charCodeAt(i);
      hash |= 0;
    }
    const idx = Math.abs(hash) % FALLBACK_AURAS.length;
    auraData = { ...FALLBACK_AURAS[idx] };
    if (tracks.length > 0) {
      auraData.signatureTrack = tracks[0];
    }
  }

  // Lengkapi field pengguna
  auraData.username = username;
  auraData.avatarUrl = avatarUrl;

  // 3. Render kartu kanvas melalui worker thread
  const cardBuffer = await canvasWorkerPool.runTask(
    "renderMusicAura",
    auraData,
  );

  return {
    auraData,
    cardBuffer,
  };
}

module.exports = {
  generateMusicAura,
  FALLBACK_AURAS,
};
