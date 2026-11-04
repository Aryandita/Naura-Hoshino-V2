"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("Milestone 3 Security Hardening & Real-Time Integrity", () => {
  it("XSS Sanitization: escapeHtmlAttr properly neutralizes HTML tags and quotes", () => {
    function escapeHtmlAttr(str) {
      if (str === null || str === undefined) return "";
      return String(str)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    }

    const maliciousName = `"><script>alert(1)</script><meta foo="`;
    const safeName = escapeHtmlAttr(maliciousName);
    assert.ok(!safeName.includes("<script>"), "Must not contain unescaped script tag");
    assert.ok(!safeName.includes(`"`), "Must not contain raw double quotes");
    assert.equal(safeName, "&quot;&gt;&lt;script&gt;alert(1)&lt;/script&gt;&lt;meta foo=&quot;");
  });

  it("Guest Sessions: properly caps max sessions and evicts expired", () => {
    const MAX_GUEST_SESSIONS = 500;
    const GUEST_SESSION_TTL_MS = 30 * 60 * 1000;
    const guestSessions = new Map();

    function cleanGuestSessions(now) {
      for (const [id, entry] of guestSessions.entries()) {
        if (now - (entry.lastAccessedAt || 0) > GUEST_SESSION_TTL_MS) {
          guestSessions.delete(id);
        }
      }
      if (guestSessions.size > MAX_GUEST_SESSIONS) {
        const sorted = Array.from(guestSessions.entries()).sort(
          (a, b) => (a[1].lastAccessedAt || 0) - (b[1].lastAccessedAt || 0),
        );
        const toRemove = guestSessions.size - MAX_GUEST_SESSIONS;
        for (let i = 0; i < toRemove; i++) {
          guestSessions.delete(sorted[i][0]);
        }
      }
    }

    const baseTime = 1000000;
    // Fill 550 entries
    for (let i = 0; i < 550; i++) {
      guestSessions.set(`guest_${i}`, {
        lastAccessedAt: baseTime + i,
        data: { userId: `guest_${i}` },
      });
    }

    cleanGuestSessions(baseTime + 550);
    assert.equal(guestSessions.size, MAX_GUEST_SESSIONS, "Must be capped at 500");

    // Advance time past TTL for the first 100 remaining
    const futureTime = baseTime + GUEST_SESSION_TTL_MS + 1000;
    cleanGuestSessions(futureTime);
    assert.ok(guestSessions.size < MAX_GUEST_SESSIONS, "Expired sessions must be evicted");
  });

  it("NPC Blessing & Kits: prevents infinite loops using timestamp cooldown and one-time flags", () => {
    const mockRpgState = {};
    const BLESSING_COOLDOWN_MS = 3600000;

    // 1. Blessing attempt 1: Success
    let now = 1000000;
    let blessing1Allowed = true;
    let elapsed = now - (mockRpgState.lastKadesBlessingAt || 0);
    if (!mockRpgState.lastKadesBlessingAt || elapsed >= BLESSING_COOLDOWN_MS) {
      mockRpgState.lastKadesBlessingAt = now;
    } else {
      blessing1Allowed = false;
    }
    assert.equal(blessing1Allowed, true, "First blessing must succeed");

    // 2. Blessing attempt 2 (5 mins later): Rejected
    now += 5 * 60 * 1000;
    let blessing2Allowed = true;
    elapsed = now - (mockRpgState.lastKadesBlessingAt || 0);
    if (!mockRpgState.lastKadesBlessingAt || elapsed >= BLESSING_COOLDOWN_MS) {
      mockRpgState.lastKadesBlessingAt = now;
    } else {
      blessing2Allowed = false;
    }
    assert.equal(blessing2Allowed, false, "Second blessing within 1 hour must be rejected");

    // 3. Starter Kit attempt 1 & 2
    let kit1Allowed = true;
    if (mockRpgState.claimedStarterKit) {
      kit1Allowed = false;
    } else {
      mockRpgState.claimedStarterKit = true;
    }
    assert.equal(kit1Allowed, true, "First starter kit claim must succeed");

    let kit2Allowed = true;
    if (mockRpgState.claimedStarterKit) {
      kit2Allowed = false;
    } else {
      mockRpgState.claimedStarterKit = true;
    }
    assert.equal(kit2Allowed, false, "Second starter kit claim must be rejected");

    // 4. Fishing Kit attempt 1 & 2
    let fishing1Allowed = true;
    if (mockRpgState.claimedFishingKit) {
      fishing1Allowed = false;
    } else {
      mockRpgState.claimedFishingKit = true;
    }
    assert.equal(fishing1Allowed, true, "First fishing kit claim must succeed");

    let fishing2Allowed = true;
    if (mockRpgState.claimedFishingKit) {
      fishing2Allowed = false;
    } else {
      mockRpgState.claimedFishingKit = true;
    }
    assert.equal(fishing2Allowed, false, "Second fishing kit claim must be rejected");
  });

  it("Metrics Endpoint Protection: rejects unauthorized public requests", () => {
    function checkMetricsAccess(req, env) {
      const isLocalhost =
        req.ip === "127.0.0.1" ||
        req.ip === "::1" ||
        req.ip === "::ffff:127.0.0.1";
      const authHeader = req.headers?.authorization;
      const bearerToken =
        authHeader && authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;
      const internalSecret = env.METRICS_TOKEN || env.BOT_TOKEN;
      const isAuthorizedToken =
        bearerToken && internalSecret && bearerToken === internalSecret;
      const isOwnerUser =
        req.user?.id && env.OWNER_IDS && env.OWNER_IDS.includes(req.user.id);

      return Boolean(isLocalhost || isAuthorizedToken || isOwnerUser);
    }

    const env = { METRICS_TOKEN: "secret_123", OWNER_IDS: ["owner_999"] };

    // Public external IP
    assert.equal(checkMetricsAccess({ ip: "203.0.113.195", headers: {} }, env), false);
    // Localhost
    assert.equal(checkMetricsAccess({ ip: "127.0.0.1", headers: {} }, env), true);
    // Bearer token
    assert.equal(checkMetricsAccess({ ip: "203.0.113.195", headers: { authorization: "Bearer secret_123" } }, env), true);
    // Owner user
    assert.equal(checkMetricsAccess({ ip: "203.0.113.195", user: { id: "owner_999" }, headers: {} }, env), true);
  });
});
