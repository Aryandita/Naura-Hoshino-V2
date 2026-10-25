"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

class TournamentBracketEngine {
  static async createTournament(guildId, organizerId, name, entryFee) {
    try {
      const tournamentId = `tourn_${Date.now()}`;
      const tournament = {
        id: tournamentId,
        guildId,
        organizerId,
        name: (name || "Turnamen").substring(0, 50),
        entryFee: Math.max(0, entryFee || 0),
        participants: [],
        brackets: [],
        currentRound: 0,
        status: "registration",
        createdAt: Date.now(),
      };

      await redisManager.set(`tournament:${tournamentId}`, JSON.stringify(tournament), "EX", 604800);
      logger.info(`[Tournament] Created ${tournamentId} in ${guildId}`);
      return { ok: true, tournamentId };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async registerParticipant(tournamentId, userId) {
    try {
      const raw = await redisManager.get(`tournament:${tournamentId}`);
      if (!raw) return { ok: false, reason: "TOURNAMENT_NOT_FOUND" };

      const tournament = JSON.parse(raw);
      if (tournament.status !== "registration") return { ok: false, reason: "REGISTRATION_CLOSED" };
      if (tournament.participants.includes(userId)) return { ok: false, reason: "ALREADY_REGISTERED" };

      tournament.participants.push(userId);
      await redisManager.set(`tournament:${tournamentId}`, JSON.stringify(tournament), "EX", 604800);

      return { ok: true, participantCount: tournament.participants.length };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static generateBrackets(participants) {
    const shuffled = [...participants].sort(() => Math.random() - 0.5);
    const rounds = [];
    const currentRound = [];

    for (let i = 0; i < shuffled.length; i += 2) {
      currentRound.push({
        matchId: `m_r0_${i / 2}`,
        player1: shuffled[i],
        player2: shuffled[i + 1] || null,
        winner: shuffled[i + 1] ? null : shuffled[i],
      });
    }
    rounds.push(currentRound);
    return rounds;
  }

  static async recordMatchResult(tournamentId, matchId, winnerId) {
    try {
      const raw = await redisManager.get(`tournament:${tournamentId}`);
      if (!raw) return { ok: false, reason: "TOURNAMENT_NOT_FOUND" };

      const tournament = JSON.parse(raw);
      let matchFound = false;

      for (const round of tournament.brackets) {
        const match = round.find((m) => m.matchId === matchId);
        if (match) {
          match.winner = winnerId;
          matchFound = true;
          break;
        }
      }

      if (!matchFound) return { ok: false, reason: "MATCH_NOT_FOUND" };

      await redisManager.set(`tournament:${tournamentId}`, JSON.stringify(tournament), "EX", 604800);
      return { ok: true, winner: winnerId };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }
}

module.exports = { TournamentBracketEngine };
