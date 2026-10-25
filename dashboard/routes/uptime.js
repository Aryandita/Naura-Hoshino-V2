"use strict";

const express = require("express");
const router = express.Router();
const { logger } = require("../../src/managers/logger");

router.get("/api/uptime", async (_req, res) => {
  try {
    const uptimeSeconds = process.uptime();
    const memoryUsage = process.memoryUsage();

    const shardStatus = [];
    if (global.client && global.client.shard) {
      try {
        const count = global.client.shard.count || 1;
        for (let i = 0; i < count; i++) {
          shardStatus.push({ id: i, status: "online" });
        }
      } catch (_) {
        shardStatus.push({ id: 0, status: "unknown" });
      }
    } else {
      shardStatus.push({ id: 0, status: "single_process" });
    }

    res.json({
      ok: true,
      uptime: {
        seconds: Math.floor(uptimeSeconds),
        formatted: formatUptime(uptimeSeconds),
        since: new Date(Date.now() - uptimeSeconds * 1000).toISOString(),
      },
      memory: {
        rss: memoryUsage.rss,
        heapUsed: memoryUsage.heapUsed,
        heapTotal: memoryUsage.heapTotal,
        external: memoryUsage.external,
        rssMB: Math.round(memoryUsage.rss / 1048576),
        heapUsedMB: Math.round(memoryUsage.heapUsed / 1048576),
      },
      shards: shardStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    logger.error("[UptimeAPI] Error:", error);
    res.status(500).json({ ok: false, error: "Internal server error" });
  }
});

function formatUptime(seconds) {
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0) parts.push(`${minutes}m`);
  parts.push(`${secs}s`);
  return parts.join(" ");
}

module.exports = router;
