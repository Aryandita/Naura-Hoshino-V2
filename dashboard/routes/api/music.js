"use strict";

const express = require("express");
const { requireGuildManager, requireApiLogin, isOwner } = require("../../middleware/auth");

function register(router, client) {
  const getMusicPlaybackState = () => {
    const rawPlayers = client.poru?.players
      ? Array.from(client.poru.players.values())
      : [];
    const player = rawPlayers[0] || null;

    if (!player || !player.currentTrack) {
      return {
        success: true,
        isPlaying: false,
        isPaused: false,
        volume: 70,
        currentTrack: {
          title: "Cyber Kawaii Lo-Fi Stream",
          author: "Naura Radio FM",
          artwork: "/assets/core/avatar.png",
          duration: 180000,
          position: 45000,
        },
        node: {
          connected: true,
          name: "Lavalink-Node-SG",
          latency: 12,
        },
      };
    }

    const track = player.currentTrack.info || {};
    return {
      success: true,
      isPlaying: !!player.isPlaying,
      isPaused: !player.isPlaying,
      volume: player.volume || 100,
      currentTrack: {
        title: track.title || "Track",
        author: track.author || "Artis",
        artwork: track.image || "/assets/core/avatar.png",
        duration: track.length || 0,
        position: player.position || 0,
      },
      node: {
        connected: true,
        name: player.node?.name || "Lavalink-Primary",
        latency: player.node?.stats?.ping || 12,
      },
    };
  };

  // --- 1. Music State ---
  router.get("/music/state", (req, res) => {
    try {
      const guildId = req.query.guildId;
      let player = null;
      if (guildId && client.poru?.players) {
        player = client.poru.players.get(String(guildId));
      }
      if (!player && client.poru?.players?.size > 0) {
        const rawPlayers = client.poru.players.values
          ? Array.from(client.poru.players.values())
          : [];
        player = rawPlayers[0] || null;
      }

      if (!player || !player.currentTrack) {
        return res.json({
          success: true,
          isPlaying: false,
          isPaused: false,
          currentTrack: {
            title: "Cyber Kawaii Lo-Fi Stream",
            author: "Naura Radio FM",
            artwork: "/assets/core/avatar.png",
            duration: 180000,
            position: 45000,
          },
          volume: 80,
          queue: [
            {
              title: "Sakura Falling Beats",
              author: "Naura Lofi",
              duration: 165000,
            },
            {
              title: "Midnight Highway Drive",
              author: "Synthwave Girl",
              duration: 210000,
            },
          ],
        });
      }

      const track = player.currentTrack.info || {};
      res.json({
        success: true,
        isPlaying: !!player.isPlaying,
        isPaused: !!player.isPaused,
        currentTrack: {
          title: track.title || "Track Tanpa Judul",
          author: track.author || "Artis Tidak Diketahui",
          artwork: track.image || "/assets/core/avatar.png",
          duration: track.length || 0,
          position: player.position || 0,
        },
        volume: player.volume || 80,
        queue: (player.queue || []).map((t) => ({
          title: t.info?.title || "Track",
          author: t.info?.author || "Artis",
          duration: t.info?.length || 0,
        })),
      });
    } catch (_) {
      res.json({
        success: true,
        isPlaying: false,
        isPaused: false,
        currentTrack: {
          title: "Cyber Kawaii Lo-Fi Stream",
          author: "Naura Radio FM",
          artwork: "/assets/core/avatar.png",
          duration: 180000,
          position: 0,
        },
        volume: 80,
        queue: [],
      });
    }
  });

  // --- 2. Music Control Handler ---
  const handleMusicControl = async (req, res) => {
    try {
      const { action, value } = req.body || {};
      if (!action) {
        return res.status(400).json({ success: false, error: "Missing action" });
      }

      const targetGuildId = req.guildId;
      let player = null;
      if (
        targetGuildId &&
        targetGuildId !== "current" &&
        targetGuildId !== "sandbox" &&
        targetGuildId !== "demo"
      ) {
        player = client.poru?.players?.get(String(targetGuildId)) || null;
      }

      if (!player) {
        return res.json({
          success: true,
          message: `Aksi ${action} diterima dalam mode simulasi aktif.`,
          action,
        });
      }

      if (action === "playpause") {
        if (player.isPaused) player.pause(false);
        else player.pause(true);
      } else if (action === "resume") {
        player.pause(false);
      } else if (action === "pause") {
        player.pause(true);
      } else if (action === "skip") {
        if (typeof player.stopTrack === "function") player.stopTrack();
        else player.stop();
      } else if (action === "previous") {
        if (typeof player.previousTrack === "function") player.previousTrack();
      } else if (action === "stop") {
        player.destroy();
      } else if (action === "volume") {
        const vol = Math.min(Math.max(parseInt(value, 10) || 80, 0), 100);
        player.setVolume(vol);
      } else if (action === "shuffle") {
        if (player.queue && typeof player.queue.shuffle === "function")
          player.queue.shuffle();
      } else if (action === "clear") {
        if (player.queue && typeof player.queue.clear === "function")
          player.queue.clear();
      } else if (action === "loop") {
        if (typeof player.setLoop === "function")
          player.setLoop(player.loop === "track" ? "none" : "track");
      }

      res.json({
        success: true,
        action,
        isPlaying: !!player.isPlaying,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  };

  router.post("/music/control", requireGuildManager, handleMusicControl);

  router.post("/music/:action", requireGuildManager, (req, res, next) => {
    if (req.params.action === "control") return next();
    req.body = req.body || {};
    req.body.action = req.params.action;
    if (req.params.action === "volume" && req.body.volume !== undefined) {
      req.body.value = req.body.volume;
    }
    if (req.params.action === "filter" && req.body.filter !== undefined) {
      req.body.value = req.body.filter;
    }
    return handleMusicControl(req, res);
  });

  // --- 3. Now Playing & Queue ---
  router.get("/music/now-playing", (req, res) => {
    try {
      res.json(getMusicPlaybackState());
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/music/queue", (req, res) => {
    try {
      const rawPlayers = client.poru?.players
        ? Array.from(client.poru.players.values())
        : [];
      const player = rawPlayers[0] || null;

      if (!player || !player.queue || player.queue.length === 0) {
        return res.json({
          success: true,
          queue: [
            {
              title: "Sakura Falling Beats",
              author: "Naura Lofi",
              duration: 165000,
            },
            {
              title: "Midnight Highway Drive",
              author: "Synthwave Girl",
              duration: 210000,
            },
          ],
        });
      }

      const queue = (player.queue || []).map((t) => ({
        title: t.info?.title || "Track",
        author: t.info?.author || "Artis",
        duration: t.info?.length || 0,
      }));

      res.json({ success: true, queue });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 4. Soundboard Sounds & Play ---
  router.get("/soundboard/sounds", async (req, res) => {
    try {
      const soundboardService = require("../../../src/services/soundboardService");
      const guildId = req.query.guildId || null;
      const sounds = await soundboardService.getAvailableSounds(guildId);
      res.json({ success: true, sounds });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/soundboard/play", requireApiLogin, async (req, res) => {
    try {
      const { guildId, soundId, voiceChannelId } = req.body || {};
      if (!guildId || !soundId) {
        return res
          .status(400)
          .json({ success: false, error: "Missing guildId or soundId" });
      }

      const RateLimiter = require("../../../src/utils/rateLimiter");
      const rateLimitKey = `user_${req.user.id}`;
      const isLimited = await RateLimiter.isRateLimited(
        rateLimitKey,
        "api_soundboard_play",
        5,
        10,
      );
      if (isLimited) {
        return res.status(429).json({
          success: false,
          error:
            "Terlalu banyak permintaan pemutaran soundboard. Mohon tunggu sebentar.",
        });
      }

      const targetGuild = client.guilds?.cache?.get(guildId);
      if (!targetGuild) {
        return res.status(404).json({
          success: false,
          error: "Bot tidak berada di server tujuan.",
        });
      }

      const isBotOwner = isOwner(req.user.id);
      let isMember = false;
      if (isBotOwner) {
        isMember = true;
      } else {
        const cachedMember = targetGuild.members?.cache?.get(req.user.id);
        if (cachedMember) {
          isMember = true;
        } else {
          const fetchedMember = await targetGuild.members
            .fetch(req.user.id)
            .catch(() => null);
          if (fetchedMember) isMember = true;
        }
      }

      if (!isMember) {
        return res.status(403).json({
          success: false,
          error:
            "Kamu harus menjadi anggota server ini untuk memutar soundboard.",
        });
      }

      const soundboardService = require("../../../src/services/soundboardService");
      const result = await soundboardService.playSound({
        client,
        guildId,
        soundId,
        voiceChannelId,
        requester: req.user,
      });

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  register,
  createRouter(client) {
    const router = express.Router();
    register(router, client);
    return router;
  },
};
