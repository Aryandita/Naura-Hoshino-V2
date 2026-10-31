"use strict";

/**
 * @module tribunalEngine
 * @description Engine simulasi sidang pengadilan komunitas "Cyber-Tribunal Court" untuk Naura Hoshino V2.
 *
 * ## Architecture Overview
 * Modul ini mengimplementasikan sistem persidangan virtual berbasis AI yang mensimulasikan
 * tiga babak persidangan anime komedi: Jaksa Penuntut, Pengacara Pembela, dan Hakim Agung.
 * Menggunakan AiEnsembleRouter dengan task type TACTICAL_REASONING untuk menghasilkan
 * argumen dan vonis dalam format JSON terstruktur. Dilengkapi procedural fallback
 * deterministik saat semua provider AI tidak tersedia.
 *
 * ## Key Features
 * - Three-persona jury system: Hakim Vespera, Jaksa Cyber-Fang, Pembela Lyra
 * - AI-powered trial simulation via AiEnsembleRouter (TACTICAL_REASONING)
 * - Structured JSON verdict parsing dengan markdown cleanup
 * - Procedural fallback verdict generator (deterministic, no AI needed)
 * - Graceful degradation: AI fail -> procedural fallback tanpa error ke user
 * - Verdict status support: GUILTY, NOT_GUILTY, SETTLEMENT
 * - Symbolic penalty system (kopi, koin, permintaan maaf)
 * - Integration dengan AiEnsembleRouter circuit breaker untuk resiliensi
 *
 * ## Integration Points
 * - {@link module:ai/aiEnsembleRouter} - Multi-model AI routing untuk generate verdict
 * - {@link module:managers/logger} - Structured logging untuk AI failures
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const aiEnsembleRouter = require("./aiEnsembleRouter");
const { logger } = require("../managers/logger");

/**
 * Definisi tiga persona juri Cyber-Tribunal Court.
 * Setiap persona memiliki nama, gelar, dan tone bicara yang khas.
 * @readonly
 * @type {Object<string, {name: string, title: string, tone: string}>}
 */
const JURY_PERSONAS = {
  HAKIM_VESPERA: {
    name: "Hakim Agung Vespera ⚖️",
    title: "Ketua Mahkamah Kosmik",
    tone: "Bijaksana, netral, tegas, dan menjunjung tinggi keadilan.",
  },
  JAKSA_CYBERFANG: {
    name: "Jaksa Penuntut Cyber-Fang 🐺",
    title: "Jaksa Utama Distrik Cyber",
    tone: "Agresif, tanpa kompromi, menuntut denda kopi dan kompensasi maksimal.",
  },
  PEMBELA_LYRA: {
    name: "Pengacara Pembela Lyra 🌸",
    title: "Advokat Publik Neo-Hoshino",
    tone: "Tsundere, gigih membela klien, pura-pura tidak peduli tapi sangat teliti.",
  },
};

// ============================================================================
// CLASS: TribunalEngine
// ============================================================================

/**
 * Engine utama untuk menjalankan simulasi sidang Cyber-Tribunal Court.
 * Mengorkestrasi pemanggilan AI untuk menghasilkan argumen jaksa, pembela, dan vonis hakim.
 */
class TribunalEngine {
  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Menjalankan sidang virtual pengadilan komunitas Cyber-Tribunal Court.
   *
   * Alur eksekusi:
   * 1. Validasi input (plaintiffName, defendantName, allegation wajib ada)
   * 2. Generate procedural fallback verdict sebagai cadangan
   * 3. Cek apakah ada provider AI yang terkonfigurasi
   * 4. Jika ada, panggil AiEnsembleRouter dengan TACTICAL_REASONING
   * 5. Parse respons JSON AI, fallback ke procedural jika parse gagal
   * 6. Return hasil terstruktur dengan source indicator (AI provider atau PROCEDURAL)
   *
   * @param {Object} params
   * @param {string} params.plaintiffName - Nama penggugat
   * @param {string} params.defendantName - Nama terdakwa
   * @param {string} params.allegation - Tuntutan/perkara
   * @param {string} [params.evidenceText="Tidak ada bukti tambahan."] - Bukti teks
   * @returns {Promise<{success: boolean, source?: string, prosecutor?: string, defense?: string, judge?: string, verdictStatus?: string, penalty?: string, reason?: string}>}
   */
  async conductTrial({
    plaintiffName,
    defendantName,
    allegation,
    evidenceText = "Tidak ada bukti tambahan.",
  }) {
    if (!plaintiffName || !defendantName || !allegation) {
      return {
        success: false,
        reason: "MISSING_TRIAL_DATA",
      };
    }

    const fallbackVerdict = this._generateProceduralVerdict(
      plaintiffName,
      defendantName,
      allegation,
    );

    const hasConfiguredProvider =
      aiEnsembleRouter.isProviderConfigured("groq") ||
      aiEnsembleRouter.isProviderConfigured("gemini") ||
      aiEnsembleRouter.isProviderConfigured("ollama");

    if (!hasConfiguredProvider) {
      return {
        success: true,
        source: "PROCEDURAL",
        ...fallbackVerdict,
      };
    }

    try {
      const prompt = `Kamu adalah sistem simulasi sidang pengadilan anime komedi fiksi "Cyber-Tribunal Court" di server Discord Naura Hoshino.
Kasus perkara:
- Penggugat: ${plaintiffName}
- Terdakwa: ${defendantName}
- Tuntutan/Perkara: "${allegation}"
- Bukti yang diajukan: "${evidenceText}"

Simulasikan 3 babak persidangan dalam format JSON murni:
{
  "prosecutorArgument": "Argumen Jaksa Cyber-Fang (nada keras, menuntut)",
  "defenseArgument": "Argumen Pembela Lyra (nada tsundere, membela terdakwa)",
  "judgeVerdict": "Vonis Hakim Vespera (putusan final dan sanksi simbolis lucu/kopi/bebas)",
  "verdictStatus": "GUILTY" | "NOT_GUILTY" | "SETTLEMENT",
  "penalty": "Deskripsi sanksi simbolis atau kompensasi"
}
Balas HANYA dengan JSON murni tanpa markdown backtick.`;

      const aiResponse = await aiEnsembleRouter.generate({
        taskType: aiEnsembleRouter.TASK_TYPES.TACTICAL_REASONING,
        prompt,
      });

      const responseText = aiResponse.text || String(aiResponse);
      if (responseText) {
        const cleaned = responseText.replace(/```json|```/g, "").trim();
        const parsed = JSON.parse(cleaned);
        return {
          success: true,
          source: (aiResponse.provider || "AI").toUpperCase(),
          prosecutor:
            parsed.prosecutorArgument || fallbackVerdict.prosecutorArgument,
          defense: parsed.defenseArgument || fallbackVerdict.defenseArgument,
          judge: parsed.judgeVerdict || fallbackVerdict.judgeVerdict,
          verdictStatus: parsed.verdictStatus || fallbackVerdict.verdictStatus,
          penalty: parsed.penalty || fallbackVerdict.penalty,
        };
      }
    } catch (e) {
      logger.warn(
        `[TribunalEngine] AI generation failed: ${e.message}. Using procedural fallback.`,
      );
    }

    return {
      success: true,
      source: "PROCEDURAL",
      prosecutor: fallbackVerdict.prosecutorArgument,
      defense: fallbackVerdict.defenseArgument,
      judge: fallbackVerdict.judgeVerdict,
      verdictStatus: fallbackVerdict.verdictStatus,
      penalty: fallbackVerdict.penalty,
    };
  }

  // ==========================================================================
  // PRIVATE METHODS
  // ==========================================================================

  /**
   * Menghasilkan vonis prosedural acak berbasis template tanpa AI.
   * Digunakan sebagai fallback saat semua provider AI tidak tersedia atau gagal.
   * Memilih secara acak dari template GUILTY atau NOT_GUILTY.
   *
   * @private
   * @param {string} plaintiff - Nama penggugat
   * @param {string} defendant - Nama terdakwa
   * @param {string} allegation - Tuntutan/perkara
   * @returns {{prosecutorArgument: string, defenseArgument: string, judgeVerdict: string, verdictStatus: string, penalty: string}}
   */
  _generateProceduralVerdict(plaintiff, defendant, allegation) {
    const verdicts = [
      {
        verdictStatus: "GUILTY",
        prosecutorArgument: `Tindakan ${defendant} terhadap ${plaintiff} mengenai "${allegation}" jelas mencoreng ketertiban server! Saya menuntut terdakwa mentraktir 1 cangkir Kopi Kafe!`,
        defenseArgument: `H-hmph! Jangan asal menuduh klien saya! ${defendant} hanya khilaf sedikit dan tidak bermaksud buruk pada ${plaintiff}!`,
        judgeVerdict: `Setelah menimbang bukti perkara, Hakim menyatakan ${defendant} BERSALAH atas pelanggaran etika komunitas.`,
        penalty: `Terdakwa ${defendant} diwajibkan meminta maaf secara sportif dan mentraktir ${plaintiff} 100 koin!`,
      },
      {
        verdictStatus: "NOT_GUILTY",
        prosecutorArgument: `Terdakwa ${defendant} harus bertanggung jawab atas perkara "${allegation}"! Bukti sudah sangat jelas!`,
        defenseArgument: `Bohong! Klien saya ${defendant} tidak bersalah sama sekali, tuduhan ${plaintiff} hanya kesalahpahaman belaka!`,
        judgeVerdict: `Mahkamah menyatakan ${defendant} TIDAK BERSALAH karena kurangnya bukti otentik. Perkara ditutup!`,
        penalty: `Terdakwa ${defendant} dibebaskan dari segala tuntutan ganti rugi.`,
      },
    ];

    const pick = Math.floor(Math.random() * verdicts.length);
    return verdicts[pick];
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

/**
 * Singleton instance TribunalEngine dengan JURY_PERSONAS ter-attach.
 * @type {TribunalEngine & {JURY_PERSONAS: typeof JURY_PERSONAS}}
 */
const engineInstance = new TribunalEngine();
engineInstance.JURY_PERSONAS = JURY_PERSONAS;

module.exports = engineInstance;
