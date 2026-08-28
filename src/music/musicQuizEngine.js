"use strict";

const redisManager = require("../managers/redisManager");
const cacheManager = require("../managers/cacheManager");
const { logger } = require("../managers/logger");

const QUIZ_PREFIX = "music:quiz:";

const SONG_QUESTIONS = [
  {
    audioHint: "🎵 *Oshiete oshiete yo sono shikumi wo...*",
    correctAnswer: "Unravel",
    artist: "TK from Ling Tosite Sigure",
    anime: "Tokyo Ghoul",
    choices: ["Unravel", "Gurenge", "Silhouette", "Blue Bird"],
  },
  {
    audioHint: "🎵 *Tsuyoku nareru riyuu wo shitta...*",
    correctAnswer: "Gurenge",
    artist: "LiSA",
    anime: "Demon Slayer",
    choices: ["Homura", "Gurenge", "Crossing Field", "Cry Baby"],
  },
  {
    audioHint: "🎵 *Muteki no egao de arasu media...*",
    correctAnswer: "Idol",
    artist: "YOASOBI",
    anime: "Oshi no Ko",
    choices: ["Idol", "Racing into the Night", "Monster", "Kaibutsu"],
  },
  {
    audioHint: "🎵 *Habataitara modoranai to itte...*",
    correctAnswer: "Blue Bird",
    artist: "Ikimono Gakari",
    anime: "Naruto Shippuden",
    choices: ["Silhouette", "Sign", "Blue Bird", "Go!!!"],
  },
  {
    audioHint: "🎵 *Uzon muzon no koushin no mae ni...*",
    correctAnswer: "Kaikai Kitan",
    artist: "Eve",
    anime: "Jujutsu Kaisen",
    choices: ["Specialz", "Lost in Paradise", "Kaikai Kitan", "Vivid Vice"],
  },
  {
    audioHint: "🎵 *Bling-bang-bang, bling-bang-bang-born!*",
    correctAnswer: "Bling-Bang-Bang-Born",
    artist: "Creepy Nuts",
    anime: "Mashle",
    choices: ["Bling-Bang-Bang-Born", "Otonoke", "Yofukashi no Uta", "Daten"],
  },
];

class MusicQuizEngine {
  /**
   * Mulai sesi kuis musik baru
   */
  static async startQuizSession(guildId, channelId, totalRounds = 5) {
    const shuffled = [...SONG_QUESTIONS].sort(() => 0.5 - Math.random());
    const rounds = shuffled.slice(
      0,
      Math.min(totalRounds, SONG_QUESTIONS.length),
    );

    const sessionData = {
      guildId,
      channelId,
      currentRoundIndex: 0,
      totalRounds: rounds.length,
      rounds,
      scores: {}, // { userId: { username, score, streak } }
      roundAnsweredUsers: [],
      status: "PLAYING",
      startedAt: Date.now(),
    };

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${QUIZ_PREFIX}${guildId}`,
        JSON.stringify(sessionData),
        1800,
      );
    }

    logger.info(
      `[MusicQuiz] Sesi kuis dimulai di guild ${guildId} (${rounds.length} ronde).`,
    );
    return sessionData;
  }

  /**
   * Ambil sesi kuis aktif
   */
  static async getSession(guildId) {
    if (!redisManager.isReady) return null;
    const raw = await redisManager.getCache(`${QUIZ_PREFIX}${guildId}`);
    if (!raw) return null;
    return typeof raw === "string" ? JSON.parse(raw) : raw;
  }

  /**
   * Jawab pertanyaan ronde aktif
   */
  static async submitAnswer(
    guildId,
    userId,
    username = "Peserta",
    chosenChoice,
    responseTimeMs = 3000,
  ) {
    const session = await this.getSession(guildId);
    if (!session || session.status !== "PLAYING") {
      return { success: false, reason: "NO_ACTIVE_QUIZ" };
    }

    const currentRound = session.rounds[session.currentRoundIndex];
    if (!currentRound) return { success: false, reason: "ROUND_NOT_FOUND" };

    if (!session.roundAnsweredUsers) session.roundAnsweredUsers = [];
    if (session.roundAnsweredUsers.includes(userId)) {
      return { success: false, reason: "ALREADY_ANSWERED" };
    }

    session.roundAnsweredUsers.push(userId);

    const isCorrect =
      chosenChoice.trim().toLowerCase() ===
      currentRound.correctAnswer.toLowerCase();
    if (!session.scores[userId]) {
      session.scores[userId] = { username, score: 0, streak: 0 };
    }

    let pointsGained = 0;
    if (isCorrect) {
      session.scores[userId].streak = (session.scores[userId].streak || 0) + 1;
      const speedBonus = Math.max(
        0,
        Math.floor((10000 - responseTimeMs) / 200),
      );
      const streakMultiplier = Math.min(
        2.0,
        1.0 + (session.scores[userId].streak - 1) * 0.2,
      );
      pointsGained = Math.floor((100 + speedBonus) * streakMultiplier);
      session.scores[userId].score += pointsGained;
    } else {
      session.scores[userId].streak = 0;
    }

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${QUIZ_PREFIX}${guildId}`,
        JSON.stringify(session),
        1800,
      );
    }

    return {
      success: true,
      isCorrect,
      correctAnswer: currentRound.correctAnswer,
      pointsGained,
      currentTotalScore: session.scores[userId].score,
      streak: session.scores[userId].streak,
    };
  }

  /**
   * Pindah ke ronde berikutnya
   */
  static async nextRound(guildId) {
    const session = await this.getSession(guildId);
    if (!session) return { success: false, reason: "NO_SESSION" };

    session.currentRoundIndex += 1;
    session.roundAnsweredUsers = [];

    if (session.currentRoundIndex >= session.totalRounds) {
      session.status = "FINISHED";
      return await this.finishQuiz(guildId);
    }

    if (redisManager.isReady) {
      await redisManager.setCache(
        `${QUIZ_PREFIX}${guildId}`,
        JSON.stringify(session),
        1800,
      );
    }

    return {
      success: true,
      isFinished: false,
      roundNumber: session.currentRoundIndex + 1,
      totalRounds: session.totalRounds,
      roundData: session.rounds[session.currentRoundIndex],
    };
  }

  /**
   * Selesaikan kuis dan bagikan hadiah ke pemenang Top 3
   */
  static async finishQuiz(guildId) {
    const session = await this.getSession(guildId);
    if (!session) return { success: false, reason: "NO_SESSION" };

    const sortedPlayers = Object.entries(session.scores)
      .map(([id, data]) => ({ userId: id, ...data }))
      .sort((a, b) => b.score - a.score);

    // Hadiah untuk Top 3
    if (sortedPlayers.length > 0 && sortedPlayers[0].score > 0) {
      await cacheManager.incrementUserSurvival(
        sortedPlayers[0].userId,
        "starFragments",
        500,
      );
    }
    if (sortedPlayers.length > 1 && sortedPlayers[1].score > 0) {
      await cacheManager.incrementUserSurvival(
        sortedPlayers[1].userId,
        "starFragments",
        300,
      );
    }
    if (sortedPlayers.length > 2 && sortedPlayers[2].score > 0) {
      await cacheManager.incrementUserSurvival(
        sortedPlayers[2].userId,
        "starFragments",
        150,
      );
    }

    if (redisManager.isReady) {
      await redisManager.deleteCache(`${QUIZ_PREFIX}${guildId}`);
    }

    return {
      success: true,
      isFinished: true,
      leaderboard: sortedPlayers,
    };
  }
}

module.exports = MusicQuizEngine;
