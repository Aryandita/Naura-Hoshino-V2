"use strict";

const aiEnsembleRouter = require("./aiEnsembleRouter");
const { logger } = require("../managers/logger");

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

class TribunalEngine {
  /**
   * Menjalankan sidang virtual pengadilan komunitas
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

const engineInstance = new TribunalEngine();
engineInstance.JURY_PERSONAS = JURY_PERSONAS;

module.exports = engineInstance;
