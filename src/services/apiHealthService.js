"use strict";

const { logger } = require("../managers/logger");
const env = require("../config/env");
const axios = require("axios");
const { getAllBreakers } = require("../utils/circuitBreaker");

const API_ENDPOINTS = [
  { name: "Open-Meteo (Weather)", url: "https://api.open-meteo.com/v1/forecast?latitude=0&longitude=0", timeout: 5000 },
  { name: "Jikan (Anime)", url: "https://api.jikan.moe/v4/anime?q=test&limit=1", timeout: 5000 },
  { name: "AniList (Anime)", url: "https://graphql.anilist.co", method: "POST", body: { query: "{ Media(type: ANIME) { id } }" }, timeout: 5000 },
  { name: "TVMaze (Movie)", url: "https://api.tvmaze.com/search/shows?q=test", timeout: 5000 },
  { name: "Mojang (Minecraft)", url: "https://api.mojang.com/users/profiles/minecraft/Notch", timeout: 5000 },
  { name: "Cobalt Directory", url: "https://instances.cobalt.best/api/instances", timeout: 6000 },
];

class ApiHealthService {
  constructor() {
    this.lastCheck = null;
    this.results = [];
    this.checkInterval = null;
  }

  async checkEndpoint(endpoint) {
    const start = Date.now();
    
    try {
      const config = {
        timeout: endpoint.timeout,
        method: endpoint.method || "GET",
        headers: { "User-Agent": `NauraBot-HealthCheck/${env.BOT_VERSION}` },
      };

      if (endpoint.body) {
        config.data = endpoint.body;
        config.headers["Content-Type"] = "application/json";
      }

      const response = await axios(endpoint.url, config);
      const latency = Date.now() - start;

      return {
        name: endpoint.name,
        status: "healthy",
        latency,
        statusCode: response.status,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      const latency = Date.now() - start;
      
      return {
        name: endpoint.name,
        status: error.code === "ECONNABORTED" ? "timeout" : "unhealthy",
        latency,
        error: error.message,
        timestamp: new Date().toISOString(),
      };
    }
  }

  async runHealthCheck() {
    logger.info("[ApiHealth] Starting health check for external APIs...");
    
    const checks = API_ENDPOINTS.map((ep) => this.checkEndpoint(ep));
    this.results = await Promise.all(checks);
    this.lastCheck = new Date().toISOString();

    const healthy = this.results.filter((r) => r.status === "healthy").length;
    const total = this.results.length;
    
    logger.info(`[ApiHealth] Check complete: ${healthy}/${total} APIs healthy`);
    
    return this.getReport();
  }

  getReport() {
    const breakers = getAllBreakers();
    
    return {
      timestamp: this.lastCheck,
      apis: this.results,
      circuitBreakers: breakers,
      summary: {
        total: this.results.length,
        healthy: this.results.filter((r) => r.status === "healthy").length,
        unhealthy: this.results.filter((r) => r.status !== "healthy").length,
        avgLatency: Math.round(
          this.results.reduce((sum, r) => sum + r.latency, 0) / this.results.length,
        ),
      },
    };
  }

  startPeriodicCheck(intervalMs = 300000) {
    if (this.checkInterval) clearInterval(this.checkInterval);
    
    this.runHealthCheck();
    this.checkInterval = setInterval(() => {
      this.runHealthCheck().catch((err) => {
        logger.error("[ApiHealth] Periodic check failed:", err);
      });
    }, intervalMs).unref?.();
    
    logger.info(`[ApiHealth] Periodic health check started (interval: ${intervalMs}ms)`);
  }

  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
      logger.info("[ApiHealth] Periodic health check stopped");
    }
  }
}

module.exports = new ApiHealthService();
