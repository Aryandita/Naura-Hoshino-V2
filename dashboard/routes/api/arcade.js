"use strict";
const express = require("express");
const { requireApiLogin } = require("../../middleware/auth");

function register(router, client) {
  router.get("/arcade/games", async (req, res) => {
    try {
      const ArcadeEngine = require("../../../src/arcade/arcadeEngine");
      return res.json({ success: true, games: ArcadeEngine.ALL_GAMES, config: ArcadeEngine.GAME_CONFIG });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  });

  router.get("/arcade/balance", async (req, res) => {
    try {
      if (!req.user) return res.json({ success: true, balanceMP: 0, isGuest: true });
      const arcadeContract = require("../../../src/domain/contracts/arcadeContract");
      const balanceMP = await arcadeContract.getBalance(req.user.id);
      return res.json({ success: true, balanceMP, isGuest: false });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  });

  router.get("/arcade/mp-leaderboard", async (req, res) => {
    try {
      const arcadeContract = require("../../../src/domain/contracts/arcadeContract");
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit || "10", 10) || 10));
      const leaderboard = await arcadeContract.getGlobalLeaderboard(limit);
      return res.json({ success: true, leaderboard });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  });

  router.post("/arcade/play", async (req, res) => {
    try {
      if (!req.user) return res.json({ success: false, error: "Login required", code: 401 });
      const { game, taruhan, kesulitan, lawan, ukuran, bom } = req.body || {};
      const ArcadeEngine = require("../../../src/arcade/arcadeEngine");
      if (!ArcadeEngine.ALL_GAMES[game]) return res.status(400).json({ success: false, error: "Game tidak valid" });
      const bet = Math.max(0, Math.min(50000, parseInt(taruhan || "0", 10) || 0));
      // MP fee handled in Discord layer; dashboard only records intent for educational games
      return res.json({ success: true, game, bet, schwierigkeit: kesulitan || null, queue: "discord", message: "Bermain via Discord /arcade play dengan MP fee 5. Berjalan dengan sessionId unik." });
    } catch (err) { return res.status(500).json({ success: false, error: err.message }); }
  });
}

module.exports = { register };
