"use strict";

const redisManager = require("../managers/redisManager");

class TelemetryMetrics {
  constructor() {
    this.commandExecutions = 0;
    this.startTime = Date.now();
  }

  incrementCommandExecution() {
    this.commandExecutions++;
  }

  /**
   * Menghasilkan metrik dalam format eksposur standar Prometheus
   * @param {import('discord.js').Client} client
   * @returns {string}
   */
  generatePrometheusMetrics(client) {
    const uptimeSec = Math.floor((Date.now() - this.startTime) / 1000);
    const mem = process.memoryUsage();
    const guildCount = client?.guilds?.cache?.size || 0;
    const userCount = client?.users?.cache?.size || 0;
    const ping = client?.ws?.ping || 0;
    const redisConnected = redisManager?.client?.isReady ? 1 : 0;
    const musicPlayersCount = client?.poru?.players?.size || 0;

    const lines = [
      "# HELP naura_uptime_seconds Bot uptime in seconds",
      "# TYPE naura_uptime_seconds gauge",
      `naura_uptime_seconds ${uptimeSec}`,
      "",
      "# HELP naura_memory_bytes Process memory usage in bytes",
      "# TYPE naura_memory_bytes gauge",
      `naura_memory_bytes{type="rss"} ${mem.rss}`,
      `naura_memory_bytes{type="heapTotal"} ${mem.heapTotal}`,
      `naura_memory_bytes{type="heapUsed"} ${mem.heapUsed}`,
      "",
      "# HELP naura_discord_guilds_total Total connected Discord guilds",
      "# TYPE naura_discord_guilds_total gauge",
      `naura_discord_guilds_total ${guildCount}`,
      "",
      "# HELP naura_discord_users_total Total cached Discord users",
      "# TYPE naura_discord_users_total gauge",
      `naura_discord_users_total ${userCount}`,
      "",
      "# HELP naura_discord_ws_ping_ms WebSocket ping latency in milliseconds",
      "# TYPE naura_discord_ws_ping_ms gauge",
      `naura_discord_ws_ping_ms ${ping >= 0 ? ping : 0}`,
      "",
      "# HELP naura_commands_executed_total Total interactions/commands executed",
      "# TYPE naura_commands_executed_total counter",
      `naura_commands_executed_total ${this.commandExecutions}`,
      "",
      "# HELP naura_redis_connected Redis connection status (1 = connected, 0 = disconnected)",
      "# TYPE naura_redis_connected gauge",
      `naura_redis_connected ${redisConnected}`,
      "",
      "# HELP naura_lavalink_players_active Active Poru Lavalink audio player sessions",
      "# TYPE naura_lavalink_players_active gauge",
      `naura_lavalink_players_active ${musicPlayersCount}`,
      "",
    ];

    return lines.join("\n");
  }
}

module.exports = new TelemetryMetrics();
