"use strict";

const redisManager = require("../managers/redisManager");

class TelemetryMetrics {
  constructor() {
    this.commandExecutions = 0;
    this.startTime = Date.now();
    this.commandSuccess = new Map();
    this.commandErrors = new Map();
    this.commandLatency = new Map();
  }

  incrementCommandExecution() {
    this.commandExecutions++;
  }

  incrementCommandSuccess(commandName) {
    this.commandSuccess.set(commandName, (this.commandSuccess.get(commandName) || 0) + 1);
  }

  incrementCommandError(commandName, errorType = "unknown") {
    const key = `${commandName}:${errorType.substring(0, 50)}`;
    this.commandErrors.set(key, (this.commandErrors.get(key) || 0) + 1);
  }

  recordCommandLatency(commandName, latencyMs) {
    if (!this.commandLatency.has(commandName)) {
      this.commandLatency.set(commandName, []);
    }
    const latencies = this.commandLatency.get(commandName);
    latencies.push(latencyMs);
    if (latencies.length > 100) latencies.shift();
  }

  getCommandStats(commandName) {
    const success = this.commandSuccess.get(commandName) || 0;
    const errors = [...this.commandErrors.entries()]
      .filter(([k]) => k.startsWith(`${commandName}:`))
      .reduce((sum, [, v]) => sum + v, 0);
    const latencies = this.commandLatency.get(commandName) || [];
    const avgLatency = latencies.length > 0 
      ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) 
      : 0;
    
    return { success, errors, avgLatency, total: success + errors };
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

    for (const [cmd, count] of this.commandSuccess) {
      lines.push(
        `# HELP naura_command_success_total Success count per command`,
        `# TYPE naura_command_success_total counter`,
        `naura_command_success_total{command="${cmd}"} ${count}`,
        ""
      );
    }

    for (const [key, count] of this.commandErrors) {
      const [cmd, errType] = key.split(":");
      lines.push(
        `# HELP naura_command_error_total Error count per command`,
        `# TYPE naura_command_error_total counter`,
        `naura_command_error_total{command="${cmd}",error="${errType}"} ${count}`,
        ""
      );
    }

    return lines.join("\n");
  }
}

module.exports = new TelemetryMetrics();
