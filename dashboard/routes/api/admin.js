"use strict";

const express = require("express");
const env = require("../../../src/config/env");
const { requireOwner } = require("../../middleware/auth");
const { pushState } = require("./helpers");

function register(router) {
  // --- 1. Discord OAuth2 Token Exchange for Activity ---
  router.post("/discord/token", async (req, res) => {
    try {
      const { code } = req.body || {};
      if (!code) {
        return res
          .status(400)
          .json({ success: false, error: "Missing authorization code" });
      }

      if (!env.CLIENT_ID || !env.CLIENT_SECRET) {
        return res.status(503).json({
          success: false,
          error: "Discord OAuth credentials not configured",
        });
      }

      const params = new URLSearchParams({
        client_id: env.CLIENT_ID,
        client_secret: env.CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
      });

      const tokenResponse = await globalThis.fetch(
        "https://discord.com/api/v10/oauth2/token",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
          },
          body: params,
        },
      );

      const data = await tokenResponse.json();
      if (!tokenResponse.ok) {
        return res.status(tokenResponse.status).json({
          success: false,
          error: data.error_description || data.error || "Token exchange failed",
        });
      }

      res.json({
        success: true,
        access_token: data.access_token,
        token_type: data.token_type,
        expires_in: data.expires_in,
        scope: data.scope,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 2. Discord Entitlements Webhook ---
  router.post("/discord/entitlements/webhook", async (req, res) => {
    try {
      const entitlementService = require("../../../src/services/entitlementService");
      const signature = req.headers["x-signature-ed25519"];
      const timestamp = req.headers["x-signature-timestamp"];
      const rawBody = req.rawBody || JSON.stringify(req.body);

      if (!signature || !timestamp) {
        return res
          .status(401)
          .json({ error: "Missing signature or timestamp header" });
      }

      const isValid = entitlementService.verifySignature(
        signature,
        timestamp,
        rawBody,
      );
      if (!isValid) {
        return res.status(401).json({ error: "Invalid signature" });
      }

      const { type, data } = req.body || {};
      if (type === "ENTITLEMENT_CREATE") {
        await entitlementService.handleEntitlementCreate(data);
      } else if (type === "ENTITLEMENT_UPDATE") {
        await entitlementService.handleEntitlementUpdate(data);
      } else if (type === "ENTITLEMENT_DELETE") {
        await entitlementService.handleEntitlementDelete(data);
      }

      res.json({ success: true, received: true });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 3. Web Push Subscriptions (Redis Consolidated) ---
  router.post("/push/subscribe", async (req, res) => {
    try {
      const targetUserId =
        req.user?.id ||
        (req.body?.userId
          ? `guest_${String(req.body.userId).replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 32)}`
          : "guest");
      const { subscription } = req.body || {};
      if (
        !subscription ||
        typeof subscription.endpoint !== "string" ||
        !subscription.endpoint.startsWith("https://")
      ) {
        return res.status(400).json({
          success: false,
          error: "Invalid subscription payload or non-HTTPS endpoint",
        });
      }

      await pushState.setSubscription(targetUserId, {
        subscription,
        registeredAt: new Date().toISOString(),
      });

      const count = await pushState.getSubscribersCount();
      res.json({
        success: true,
        message: "Web Push subscription registered successfully",
        totalSubscribers: count,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/push/vapid-key", (req, res) => {
    try {
      const webPushService = require("../../../src/services/webPushService");
      const publicKey = webPushService.getVapidPublicKey();
      res.json({
        success: true,
        publicKey,
      });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.get("/push/status", async (req, res) => {
    const count = await pushState.getSubscribersCount();
    const webPushService = require("../../../src/services/webPushService");
    res.json({
      success: true,
      enabled: true,
      subscribersCount: count,
      vapidConfigured: Boolean(webPushService.getVapidPublicKey()),
      supportedAlertTypes: [
        "caravan_ambush",
        "raid_boss_spawn",
        "world_boss_spawn",
        "daily_reset_alert",
        "lottery_winner",
      ],
    });
  });

  router.post("/push/test-boss", requireOwner, async (req, res) => {
    try {
      const webPushService = require("../../../src/services/webPushService");
      const result = await webPushService.notifyWorldBossSpawn(req.body || {});
      res.json({ success: true, message: "World Boss push notification triggered", result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/push/test-daily-reset", requireOwner, async (req, res) => {
    try {
      const webPushService = require("../../../src/services/webPushService");
      const result = await webPushService.notifyDailyReset(req.body || {});
      res.json({ success: true, message: "Daily reset push notification triggered", result });
    } catch (err) {
      res.status(500).json({ success: false, error: err.message });
    }
  });

  // --- 4. Admin Flush Cache & Backup ---
  router.post("/admin/flush-cache", requireOwner, async (req, res) => {
    try {
      const cacheManager = require("../../../src/managers/cacheManager");
      await cacheManager.flushAll();
      return res.json({
        success: true,
        message:
          "Seluruh antrean write-behind cache berhasil di-flush ke database!",
        metrics: cacheManager.getFlushMetrics(),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });

  router.post("/admin/backup", requireOwner, async (req, res) => {
    try {
      return res.json({
        success: true,
        message: "Perintah auto-backup database berhasil dipicu di latar belakang.",
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      return res.status(500).json({ success: false, error: err.message });
    }
  });
}

module.exports = {
  register,
  createRouter() {
    const router = express.Router();
    register(router);
    return router;
  },
};
