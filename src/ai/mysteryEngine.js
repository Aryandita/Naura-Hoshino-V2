"use strict";

const redisManager = require("../managers/redisManager");
const geminiClient = require("./geminiClient");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const SESSION_PREFIX = "mystery:session:";

const PRESET_SCENARIOS = [
  {
    title: "Misteri Pembunuhan di Lab Cyber-Sakura",
    victim: "Prof. Hiroshi (Ilmuwan Quantum)",
    location: "Laboratorium Sayap Barat Neo-Hoshino",
    crimeScene:
      "Korban ditemukan tergeletak dekat terminal holografis yang hangus.",
    weapon: "Overloaded Quantum Discharger",
    suspects: [
      {
        id: "dr_ren",
        name: "Dr. Ren (Asisten Peneliti)",
        motive: "Iri atas hak paten penemuan AI Quantum.",
        alibi:
          "Saya berada di ruang arsip memeriksa data hingga alarm berbunyi.",
        isCulprit: true,
        secretFlaw:
          "Log akses terminal menunjukkan sidik jari kuantum Dr. Ren 2 menit sebelum listrik padam.",
      },
      {
        id: "security_klaus",
        name: "Klaus (Kepala Keamanan Cyber)",
        motive: "Pernah diancam dipecat oleh korban.",
        alibi:
          "Saya sedang berpatroli di gerbang utama bersama drone pengawas.",
        isCulprit: false,
        secretFlaw: "Kamera gerbang utama mengonfirmasi kehadirannya.",
      },
      {
        id: "hacker_chloe",
        name: "Chloe (Spesialis Enkripsi)",
        motive: "Mencari source code protokol rahasia.",
        alibi: "Saya di kafetaria menikmati neon boba bersama teman-teman.",
        isCulprit: false,
        secretFlaw: "Struk pesanan boba tertera tepat di jam kejadian.",
      },
    ],
    clues: [
      "🔍 **Petunjuk 1 (Forensik):** Terdapat residu tegangan tinggi kuantum di sarung tangan termal.",
      "🔍 **Petunjuk 2 (Server Log):** Pintu gerbang utama terkunci dari dalam, drone mencatat patroli Klaus valid.",
      "🔍 **Petunjuk 3 (Bukti Krusial):** Terminal arsip sama sekali tidak pernah diakses selama 3 jam terakhir.",
    ],
  },
];

class MysteryEngine {
  /**
   * Mulai sesi penyelidikan kasus baru
   */
  static async createGameSession(guildId, hostUserId, playerList = []) {
    const scenario =
      PRESET_SCENARIOS[Math.floor(Math.random() * PRESET_SCENARIOS.length)];
    const sessionId = `case_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;

    const sessionData = {
      sessionId,
      guildId,
      hostUserId,
      players: playerList.map((p) => ({ id: p.id, username: p.username })),
      scenario,
      currentClueIndex: 0,
      interrogations: [],
      status: "INVESTIGATION", // INVESTIGATION, TRIAL, SOLVED, FAILED
      createdAt: Date.now(),
    };

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${SESSION_PREFIX}${guildId}`,
        JSON.stringify(sessionData),
        3600,
      );
    }

    logger.info(
      `[MysteryEngine] Kasus dimulai: ${scenario.title} di guild ${guildId}`,
    );
    return sessionData;
  }

  /**
   * Ambil data sesi aktif di guild
   */
  static async getSession(guildId) {
    if (!redisManager.isReady) return null;
    const raw = await redisManager.getCache(`${SESSION_PREFIX}${guildId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  /**
   * Buka petunjuk forensik berikutnya
   */
  static async revealNextClue(guildId) {
    const session = await this.getSession(guildId);
    if (!session || session.status !== "INVESTIGATION") {
      return { success: false, reason: "NO_ACTIVE_INVESTIGATION" };
    }

    if (session.currentClueIndex >= session.scenario.clues.length) {
      return { success: false, reason: "ALL_CLUES_REVEALED" };
    }

    const clue = session.scenario.clues[session.currentClueIndex];
    session.currentClueIndex += 1;

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${SESSION_PREFIX}${guildId}`,
        JSON.stringify(session),
        3600,
      );
    }

    return {
      success: true,
      clue,
      clueNumber: session.currentClueIndex,
      totalClues: session.scenario.clues.length,
    };
  }

  /**
   * Interogasi tersangka via Gemini AI
   */
  static async interrogateSuspect(
    guildId,
    suspectId,
    question,
    askerName = "Detektif",
  ) {
    const session = await this.getSession(guildId);
    if (!session || session.status !== "INVESTIGATION") {
      return { success: false, reason: "NO_ACTIVE_INVESTIGATION" };
    }

    const suspect = session.scenario.suspects.find((s) => s.id === suspectId);
    if (!suspect) {
      return { success: false, reason: "SUSPECT_NOT_FOUND" };
    }

    const safeQuestion = (question || "").substring(0, 150);

    const prompt = `Sebagai karakter tersangka bernama "${suspect.name}" dalam game misteri pembunuhan Cyberpunk.
Misteri Kasus: ${session.scenario.title} (Korban: ${session.scenario.victim}).
Motifmu: ${suspect.motive}.
Alibimu: ${suspect.alibi}.
Apakah kamu pelaku sebenarnya?: ${suspect.isCulprit ? "YA (Pelaku). Tutupi kesalahanmu dengan nada gelisah atau pembelaan cerdas tapi jangan pernah langsung mengaku!" : "TIDAK (Bukan Pelaku). Jawab dengan percaya diri dan sampaikan fakta alibimu."}
Pertanyaan dari detektif "${askerName}": "${safeQuestion}"
Jawab dalam 1-2 kalimat roleplay singkat, tegas, dan penuh karakter. TANPA EMOJI, TANPA FORMATTING ANEH.`;

    let responseText = null;
    try {
      const DJ_TIMEOUT_MS = 3500;
      responseText = await Promise.race([
        geminiClient.generate({ parts: [{ text: prompt }] }),
        new Promise((resolve) =>
          setTimeout(() => resolve(null), DJ_TIMEOUT_MS),
        ),
      ]);
    } catch (err) {
      logger.warn("[MysteryEngine] AI Interrogation error:", err.message);
    }

    if (!responseText) {
      responseText = suspect.isCulprit
        ? `Saya sudah katakan pada Anda, saya tidak ada hubungannya dengan insiden ini! Jangan buang waktu mencurigai saya.`
        : `Saya tidak bersalah. Alibi saya jelas dan bisa dibuktikan oleh rekaman sistem.`;
    }

    session.interrogations.push({
      askerName,
      suspectName: suspect.name,
      question: safeQuestion,
      answer: responseText,
      timestamp: Date.now(),
    });

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${SESSION_PREFIX}${guildId}`,
        JSON.stringify(session),
        3600,
      );
    }

    return {
      success: true,
      suspectName: suspect.name,
      answer: responseText,
    };
  }

  /**
   * Ajukan tuduhan akhir pada sidang vonis (Accuse Culprit)
   */
  static async submitAccusation(guildId, userId, accusedSuspectId) {
    const session = await this.getSession(guildId);
    if (
      !session ||
      (session.status !== "INVESTIGATION" && session.status !== "TRIAL")
    ) {
      return { success: false, reason: "NO_ACTIVE_INVESTIGATION" };
    }

    const culprit = session.scenario.suspects.find((s) => s.isCulprit);
    const chosenSuspect = session.scenario.suspects.find(
      (s) => s.id === accusedSuspectId,
    );

    if (!chosenSuspect) {
      return { success: false, reason: "INVALID_SUSPECT" };
    }

    const isCorrect = chosenSuspect.id === culprit.id;

    session.status = isCorrect ? "SOLVED" : "FAILED";
    session.solvedBy = userId;
    session.solvedAt = Date.now();

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${SESSION_PREFIX}${guildId}`,
        JSON.stringify(session),
        600,
      );
    }

    let reward = 0;
    if (isCorrect) {
      reward = 1000;
      await cacheManager.incrementUserSurvival(userId, "starFragments", reward);
    }

    return {
      success: true,
      isCorrect,
      accusedName: chosenSuspect.name,
      culpritName: culprit.name,
      flaw: culprit.secretFlaw,
      reward,
    };
  }
}

module.exports = MysteryEngine;
