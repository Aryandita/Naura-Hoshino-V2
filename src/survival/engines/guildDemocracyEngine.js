"use strict";

const { logger } = require("../../managers/logger");
const redisManager = require("../../managers/redisManager");

const ELECTION_DURATION_MS = 259200000;
const POSITIONS = ["leader", "officer", "treasurer"];

class GuildDemocracyEngine {
  static async startElection(guildId, position, candidates) {
    try {
      if (!POSITIONS.includes(position)) return { ok: false, reason: "INVALID_POSITION" };
      if (candidates.length < 2) return { ok: false, reason: "NEED_MIN_2_CANDIDATES" };

      const electionId = `election_${guildId}_${position}_${Date.now()}`;
      const election = {
        id: electionId,
        guildId,
        position,
        candidates: candidates.map((c) => ({ id: c, votes: 0 })),
        voters: [],
        startedAt: Date.now(),
        endsAt: Date.now() + ELECTION_DURATION_MS,
        status: "active",
      };

      await redisManager.set(`guild_election:${electionId}`, JSON.stringify(election), "EX", Math.ceil(ELECTION_DURATION_MS / 1000));
      logger.info(`[GuildDemocracy] Election started for ${position} in ${guildId}`);
      return { ok: true, electionId };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async castVote(electionId, voterId, candidateId) {
    try {
      const raw = await redisManager.get(`guild_election:${electionId}`);
      if (!raw) return { ok: false, reason: "ELECTION_NOT_FOUND" };

      const election = JSON.parse(raw);
      if (election.status !== "active") return { ok: false, reason: "ELECTION_CLOSED" };
      if (election.voters.includes(voterId)) return { ok: false, reason: "ALREADY_VOTED" };
      if (Date.now() > election.endsAt) return { ok: false, reason: "ELECTION_ENDED" };

      const candidate = election.candidates.find((c) => c.id === candidateId);
      if (!candidate) return { ok: false, reason: "INVALID_CANDIDATE" };

      candidate.votes++;
      election.voters.push(voterId);

      const ttl = Math.max(60, Math.ceil((election.endsAt - Date.now()) / 1000));
      await redisManager.set(`guild_election:${electionId}`, JSON.stringify(election), "EX", ttl);

      return { ok: true, candidateVotes: candidate.votes };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static async tallyResults(electionId) {
    try {
      const raw = await redisManager.get(`guild_election:${electionId}`);
      if (!raw) return { ok: false, reason: "ELECTION_NOT_FOUND" };

      const election = JSON.parse(raw);
      const sorted = [...election.candidates].sort((a, b) => b.votes - a.votes);
      const winner = sorted[0];

      election.status = "completed";
      election.winner = winner.id;
      await redisManager.set(`guild_election:${electionId}`, JSON.stringify(election), "EX", 86400);

      logger.info(`[GuildDemocracy] ${winner.id} won ${election.position} election`);
      return { ok: true, winner: winner.id, results: sorted, totalVoters: election.voters.length };
    } catch (error) {
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }
}

module.exports = { GuildDemocracyEngine, ELECTION_DURATION_MS, POSITIONS };
