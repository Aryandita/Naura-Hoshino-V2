"use strict";

process.env.NODE_ENV = "test";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const http = require("node:http");
const express = require("express");

const donationWebhooks = require("../../dashboard/routes/donationWebhooks");
const entitlementService = require("../../src/services/entitlementService");
const cacheManager = require("../../src/managers/cacheManager");

describe("Milestone M1 Adversarial Stress & Verification Suite", () => {
  const TEST_SAWERIA_SECRET = "super_secret_saweria_key_999";
  const TEST_TRAKTEER_SECRET = "super_secret_trakteer_key_888";

  let server;
  let baseUrl;
  const extendedPremiumLog = [];
  const inMemoryClaimMap = new Map();

  before(async () => {
    const app = express();
    app.use(
      express.json({
        verify: (req, res, buf) => {
          req.rawBody = buf;
        },
      }),
    );
    app.use(express.urlencoded({ extended: true }));

    const mockClient = {
      users: {
        fetch: async (id) => ({
          id,
          username: `TestUser_${id}`,
          send: async () => true,
        }),
      },
    };

    // Custom claimOnce in-memory mock that is atomic and thread-safe in Node.js event loop
    const customClaimOnce = async (key, ttl) => {
      if (inMemoryClaimMap.has(key)) {
        return false;
      }
      inMemoryClaimMap.set(key, Date.now() + ttl * 1000);
      return true;
    };

    const router = donationWebhooks(mockClient, {
      saweriaSecret: TEST_SAWERIA_SECRET,
      trakteerSecret: TEST_TRAKTEER_SECRET,
      extendPremium: async (userId, durationMs) => {
        extendedPremiumLog.push({ userId, durationMs, timestamp: Date.now() });
        return new Date(Date.now() + durationMs);
      },
      claimOnce: customClaimOnce,
    });
    app.use(router);

    // Express error boundary for malformed JSON to return 400 instead of default 500 HTML
    app.use((err, req, res, next) => {
      if (err instanceof SyntaxError && err.status === 400 && "body" in err) {
        return res.status(400).json({ error: "Invalid JSON syntax" });
      }
      next(err);
    });

    await new Promise((resolve) => {
      server = http.createServer(app);
      server.listen(0, "127.0.0.1", () => {
        const port = server.address().port;
        baseUrl = `http://127.0.0.1:${port}`;
        resolve();
      });
    });
  });

  after(async () => {
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ==========================================================================
  // SECTION 1: donationWebhooks.js Adversarial Tests
  // ==========================================================================
  describe("1. donationWebhooks.js Security & Robustness Harness", () => {
    const { verifyWebhookSignature, extractDiscordId } = donationWebhooks;

    describe("1.1 Signature Forgery & Tampering Stress", () => {
      it("ADV-WH-01: Rejects forged signatures of varying lengths and encodings", () => {
        const forgeries = [
          "a",
          "12345",
          "wrong_secret",
          "sha256=1234567890abcdef",
          "Bearer wrong_token_value",
          "d41d8cd98f00b204e9800998ecf8427e", // MD5
          "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855", // SHA-256 of empty string
          "0".repeat(64),
          "f".repeat(64),
          "xyz!".repeat(16),
          "🔥".repeat(16),
        ];

        for (const forged of forgeries) {
          const req = {
            headers: { "saweria-token": forged },
            body: { amount: 50000, message: "123456789012345678" },
          };
          const auth = verifyWebhookSignature(req, {
            headerNames: ["saweria-token"],
            secretOverride: TEST_SAWERIA_SECRET,
          });
          assert.equal(auth.ok, false, `Forged token '${forged.slice(0, 10)}...' must be rejected`);
        }
      });

      it("ADV-WH-02: Rejects tampered payload even if valid HMAC of different payload is supplied", () => {
        const originalPayload = JSON.stringify({ amount: 50000, message: "123456789012345678" });
        const validHmacForOriginal = crypto
          .createHmac("sha256", TEST_SAWERIA_SECRET)
          .update(originalPayload)
          .digest("hex");

        // Attacker tampered with amount to 100000
        const tamperedPayload = JSON.stringify({ amount: 100000, message: "123456789012345678" });

        const req = {
          headers: { "x-saweria-signature": validHmacForOriginal },
          body: JSON.parse(tamperedPayload),
          rawBody: Buffer.from(tamperedPayload),
        };

        const auth = verifyWebhookSignature(req, {
          headerNames: ["x-saweria-signature"],
          secretOverride: TEST_SAWERIA_SECRET,
        });
        assert.equal(auth.ok, false, "Tampered payload with mismatched HMAC must be rejected");
      });

      it("ADV-WH-03: Prefix / suffix extension attack does not bypass secret match", () => {
        const bypasses = [
          TEST_SAWERIA_SECRET + "_extra",
          "prefix_" + TEST_SAWERIA_SECRET,
          TEST_SAWERIA_SECRET.slice(0, 10),
          TEST_SAWERIA_SECRET + "\0evil",
          TEST_SAWERIA_SECRET + " ",
          " " + TEST_SAWERIA_SECRET,
        ];

        for (const bp of bypasses) {
          const req = {
            headers: { "saweria-token": bp },
            body: { amount: 50000 },
          };
          const auth = verifyWebhookSignature(req, {
            headerNames: ["saweria-token"],
            secretOverride: TEST_SAWERIA_SECRET,
          });
          if (bp.trim() !== TEST_SAWERIA_SECRET) {
            assert.equal(auth.ok, false, `Bypass attempt '${bp}' must be rejected`);
          }
        }
      });
    });

    describe("1.2 timingSafeEqual Length-Mismatch & Buffer Stress", () => {
      it("ADV-WH-04: Never throws RangeError on buffer length mismatches across arbitrary buffer sizes", () => {
        const testLengths = [0, 1, 2, 15, 16, 31, 32, 33, 63, 64, 65, 128, 256, 1024, 65536];

        for (const len of testLengths) {
          const testBuffer = Buffer.alloc(len, 0x41); // 'A' repeated
          const testStr = testBuffer.toString("utf8");

          const req = {
            headers: { "x-signature": testStr },
            body: { amount: 50000 },
            rawBody: Buffer.from(JSON.stringify({ amount: 50000 })),
          };

          let threw = false;
          let authResult = null;
          try {
            authResult = verifyWebhookSignature(req, {
              headerNames: ["x-signature"],
              secretOverride: TEST_SAWERIA_SECRET,
            });
          } catch (err) {
            threw = true;
          }

          assert.equal(threw, false, `Length ${len} buffer must NOT throw RangeError in timingSafeEqual`);
          assert.equal(authResult.ok, false, `Length ${len} buffer must fail authentication safely`);
        }
      });
    });

    describe("1.3 Missing Body, Empty Body, & Malformed Payloads", () => {
      it("ADV-WH-05: Missing or empty body does not crash handler and returns 400", async () => {
        const res = await fetch(`${baseUrl}/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: JSON.stringify({}),
        });

        assert.equal(res.status, 400);
        const data = await res.json();
        assert.ok(data.error);
      });

      it("ADV-WH-06: Non-object body (array, primitive number, string) handled safely without crash", async () => {
        const resArr = await fetch(`${baseUrl}/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: JSON.stringify([{ amount: 50000, message: "123456789012345678" }]),
        });
        assert.equal(resArr.status, 400);

        const resNum = await fetch(`${baseUrl}/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: JSON.stringify(12345),
        });
        assert.equal(resNum.status, 400);
      });

      it("ADV-WH-07: Malformed JSON returns 400 Bad Request via error boundary", async () => {
        const res = await fetch(`${baseUrl}/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: "{ unclosed_json: true, ",
        });

        assert.equal(res.status, 400);
      });

      it("ADV-WH-08: Negative, NaN, or non-finite donation amounts are rejected with 400", async () => {
        const invalidAmounts = [-50000, 0, "free", null, undefined, -1];

        for (const amt of invalidAmounts) {
          const res = await fetch(`${baseUrl}/saweria`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "saweria-token": TEST_SAWERIA_SECRET,
            },
            body: JSON.stringify({ amount: amt, message: "123456789012345678" }),
          });
          assert.equal(res.status, 400, `Amount ${amt} must be rejected with 400`);
        }
      });
    });

    describe("1.4 Snowflake ID Boundaries & Adversarial Regex Mining", () => {
      it("ADV-WH-09: Strict validation of 16 vs 17 vs 20 vs 21 digit Snowflakes", () => {
        // 16 digits: MUST FAIL
        assert.equal(extractDiscordId("1234567890123456"), null);
        assert.equal(extractDiscordId({ user_id: "1234567890123456" }), null);

        // 17 digits: MUST SUCCEED
        assert.equal(extractDiscordId("12345678901234567"), "12345678901234567");
        assert.equal(extractDiscordId({ user_id: "12345678901234567" }), "12345678901234567");

        // 20 digits: MUST SUCCEED
        assert.equal(extractDiscordId("12345678901234567890"), "12345678901234567890");
        assert.equal(extractDiscordId({ user_id: "12345678901234567890" }), "12345678901234567890");

        // 21 digits: MUST FAIL
        assert.equal(extractDiscordId("123456789012345678901"), null);
        assert.equal(extractDiscordId({ user_id: "123456789012345678901" }), null);
      });

      it("ADV-WH-10: Adversarial strings with letters mixed with digits are rejected", () => {
        const adversarialInputs = [
          "user123456789012345678", // letters immediately preceding
          "123456789012345678user", // letters immediately following
          "12345678a901234567", // letter inside 18 digits
          "123456789012345678_admin", // underscore attached
          "admin_123456789012345678", // leading underscore attached
          "a1b2c3d4e5f6789012345678", // hex-like mix
          "ID:1234567890123456a", // 16 digits + letter
        ];

        for (const input of adversarialInputs) {
          const res = extractDiscordId(input);
          assert.equal(
            res,
            null,
            `Adversarial input '${input}' must not match as a Snowflake ID`,
          );
        }
      });

      it("ADV-WH-11: Valid IDs embedded in Discord formatting and messages are correctly parsed", () => {
        const validFormats = [
          { msg: "<@123456789012345678>", expected: "123456789012345678" },
          { msg: "<@!123456789012345678>", expected: "123456789012345678" },
          { msg: "Tolong donasi ini untuk (123456789012345678), makasih!", expected: "123456789012345678" },
          { msg: "ID: [123456789012345678]", expected: "123456789012345678" },
          { msg: "User ID = 123456789012345678; amount = 50000", expected: "123456789012345678" },
        ];

        for (const { msg, expected } of validFormats) {
          assert.equal(extractDiscordId(msg), expected);
        }
      });
    });

    describe("1.5 Concurrency & Rapid Double Delivery Harness", () => {
      it("ADV-WH-12: High concurrency stress: 20 simultaneous duplicate webhooks result in EXACTLY ONE extension", async () => {
        const testUserId = "998877665544332211";
        const testTxId = "stress_concurrent_tx_999";
        const preCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;

        const payload = {
          id: testTxId,
          amount: 50000,
          message: `ID ${testUserId}`,
          donator_name: "Stress Tester",
        };

        const requests = Array.from({ length: 20 }, () =>
          fetch(`${baseUrl}/saweria`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "saweria-token": TEST_SAWERIA_SECRET,
            },
            body: JSON.stringify(payload),
          }),
        );

        const responses = await Promise.all(requests);
        const dataList = await Promise.all(responses.map((r) => r.json()));

        for (const res of responses) {
          assert.equal(res.status, 200);
        }

        const successCount = dataList.filter((d) => d.success === true).length;
        const duplicateCount = dataList.filter((d) => d.duplicate === true).length;

        assert.equal(successCount, 1, "Exactly ONE request should receive success: true");
        assert.equal(duplicateCount, 19, "Exactly 19 requests should be marked duplicate: true");

        const postCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;
        assert.equal(postCount - preCount, 1, "extendPremium must be executed exactly ONCE");
      });

      it("ADV-WH-13: Rapid double delivery without explicit transaction ID (fingerprint mode)", async () => {
        const testUserId = "887766554433221100";
        const preCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;

        const payload = {
          amount: 75000,
          message: `Dukungan untuk ${testUserId}`,
          donator_name: "Fingerprint Tester",
        };

        const requests = Array.from({ length: 5 }, () =>
          fetch(`${baseUrl}/saweria`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "saweria-token": TEST_SAWERIA_SECRET,
            },
            body: JSON.stringify(payload),
          }),
        );

        const responses = await Promise.all(requests);
        const dataList = await Promise.all(responses.map((r) => r.json()));

        const successCount = dataList.filter((d) => d.success === true).length;
        const duplicateCount = dataList.filter((d) => d.duplicate === true).length;

        assert.equal(successCount, 1, "Only first request should succeed in fingerprint mode");
        assert.equal(duplicateCount, 4, "Subsequent requests should be flagged duplicate");

        const postCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;
        assert.equal(postCount - preCount, 1, "extendPremium executed only once in fingerprint mode");
      });
    });

    describe("1.6 Route Reachability Matrix & Dual-Rail Route Verification", () => {
      it("ADV-WH-14: Explicit reachability on all 4 route endpoints (/saweria, /trakteer, /api/webhook/saweria, /api/webhook/trakteer)", async () => {
        const routes = [
          {
            path: "/saweria",
            headers: { "saweria-token": TEST_SAWERIA_SECRET },
            body: { amount: 35000, message: "ID 123456789012345678", id: "reach_sw_1" },
            expectedTier: "Naura Supporter (1 Bulan)",
          },
          {
            path: "/api/webhook/saweria",
            headers: { "saweria-token": TEST_SAWERIA_SECRET },
            body: { amount: 50000, message: "ID 123456789012345678", id: "reach_sw_2" },
            expectedTier: "Naura Friends (6 Bulan)",
          },
          {
            path: "/trakteer",
            headers: { "x-trakteer-token": TEST_TRAKTEER_SECRET },
            body: { amount: 35000, supporter_message: "ID 123456789012345678", transaction_id: "reach_tr_1" },
            expectedTier: "Naura Supporter (1 Bulan)",
          },
          {
            path: "/api/webhook/trakteer",
            headers: { "x-trakteer-token": TEST_TRAKTEER_SECRET },
            body: { amount: 75000, supporter_message: "ID 123456789012345678", transaction_id: "reach_tr_2" },
            expectedTier: "Naura Bestie (1 Tahun)",
          },
        ];

        for (const r of routes) {
          const res = await fetch(`${baseUrl}${r.path}`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...r.headers,
            },
            body: JSON.stringify(r.body),
          });

          assert.equal(res.status, 200, `Route ${r.path} must respond with 200 OK`);
          const data = await res.json();
          assert.equal(data.success, true, `Route ${r.path} must process donation successfully`);
          assert.equal(data.tier, r.expectedTier, `Route ${r.path} must resolve expected tier`);
        }
      });

      it("ADV-WH-15: Dual-mount shadowing defense: server mounting order does not intercept or shadow routes", async () => {
        const dualApp = express();
        dualApp.use(
          express.json({
            verify: (req, res, buf) => {
              req.rawBody = buf;
            },
          }),
        );
        dualApp.use(express.urlencoded({ extended: true }));

        const donationRouter = donationWebhooks(
          { users: { fetch: async () => ({ send: async () => true }) } },
          {
            saweriaSecret: TEST_SAWERIA_SECRET,
            trakteerSecret: TEST_TRAKTEER_SECRET,
            extendPremium: async () => new Date(),
            claimOnce: async () => true,
          },
        );

        const legacyRouter = express.Router();
        legacyRouter.post("/api/webhook/legacy", (req, res) => res.json({ legacy: true }));

        dualApp.use(donationRouter);
        dualApp.use(legacyRouter);

        let dualServer;
        let dualBaseUrl;
        await new Promise((resolve) => {
          dualServer = http.createServer(dualApp);
          dualServer.listen(0, "127.0.0.1", () => {
            dualBaseUrl = `http://127.0.0.1:${dualServer.address().port}`;
            resolve();
          });
        });

        try {
          const paths = ["/saweria", "/trakteer", "/api/webhook/saweria", "/api/webhook/trakteer"];
          for (const p of paths) {
            const isSaweria = p.includes("saweria");
            const res = await fetch(`${dualBaseUrl}${p}`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...(isSaweria
                  ? { "saweria-token": TEST_SAWERIA_SECRET }
                  : { "x-trakteer-token": TEST_TRAKTEER_SECRET }),
              },
              body: JSON.stringify({
                amount: 50000,
                message: "123456789012345678",
                supporter_message: "123456789012345678",
              }),
            });
            assert.equal(res.status, 200, `Path ${p} must be reachable and not shadowed`);
            const data = await res.json();
            assert.equal(data.success, true);
          }
        } finally {
          await new Promise((resolve) => dualServer.close(resolve));
        }
      });

      it("ADV-WH-16: Concurrent replay attack on /trakteer with 30 rapid requests", async () => {
        const testUserId = "776655443322110099";
        const testTxId = "trakteer_concurrent_tx_888";
        const preCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;

        const payload = {
          transaction_id: testTxId,
          amount: 50000,
          supporter_message: `Dukungan untuk ${testUserId}`,
          supporter_name: "Trakteer Concurrent Tester",
        };

        const requests = Array.from({ length: 30 }, () =>
          fetch(`${baseUrl}/api/webhook/trakteer`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-trakteer-token": TEST_TRAKTEER_SECRET,
            },
            body: JSON.stringify(payload),
          }),
        );

        const responses = await Promise.all(requests);
        const dataList = await Promise.all(responses.map((r) => r.json()));

        for (const res of responses) {
          assert.equal(res.status, 200);
        }

        const successCount = dataList.filter((d) => d.success === true).length;
        const duplicateCount = dataList.filter((d) => d.duplicate === true).length;

        assert.equal(successCount, 1, "Exactly ONE Trakteer request should receive success: true");
        assert.equal(duplicateCount, 29, "Exactly 29 Trakteer requests should be marked duplicate: true");

        const postCount = extendedPremiumLog.filter((u) => u.userId === testUserId).length;
        assert.equal(postCount - preCount, 1, "extendPremium must be executed exactly ONCE for concurrent Trakteer webhooks");
      });

      it("ADV-WH-17: End-to-end HTTP Snowflake boundary testing (16 vs 17 vs 20 vs 21 digits)", async () => {
        // 16-digit: must return 400
        const res16 = await fetch(`${baseUrl}/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: JSON.stringify({ amount: 50000, message: "User: 1234567890123456" }),
        });
        assert.equal(res16.status, 400, "16-digit ID must return 400 Bad Request");

        // 17-digit: must return 200
        const res17 = await fetch(`${baseUrl}/api/webhook/saweria`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "saweria-token": TEST_SAWERIA_SECRET,
          },
          body: JSON.stringify({ amount: 50000, message: "User: 12345678901234567", id: "tx_17digit" }),
        });
        assert.equal(res17.status, 200, "17-digit ID must return 200 OK");
        const data17 = await res17.json();
        assert.equal(data17.userId, "12345678901234567");

        // 20-digit: must return 200
        const res20 = await fetch(`${baseUrl}/trakteer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-trakteer-token": TEST_TRAKTEER_SECRET,
          },
          body: JSON.stringify({ amount: 50000, supporter_message: "User: 12345678901234567890", transaction_id: "tx_20digit" }),
        });
        assert.equal(res20.status, 200, "20-digit ID must return 200 OK");
        const data20 = await res20.json();
        assert.equal(data20.userId, "12345678901234567890");

        // 21-digit: must return 400
        const res21 = await fetch(`${baseUrl}/api/webhook/trakteer`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-trakteer-token": TEST_TRAKTEER_SECRET,
          },
          body: JSON.stringify({ amount: 50000, supporter_message: "User: 123456789012345678901" }),
        });
        assert.equal(res21.status, 400, "21-digit ID must return 400 Bad Request");
      });

      it("ADV-WH-18: HTTP timingSafeEqual buffer length stress over wire", async () => {
        const lengths = [0, 1, 15, 31, 32, 33, 63, 64, 65, 128, 512, 1024];
        for (const len of lengths) {
          const forgedSig = "x".repeat(len);
          const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-saweria-signature": forgedSig,
            },
            body: JSON.stringify({ amount: 50000, message: "123456789012345678" }),
          });
          assert.equal(res.status, 401, `Forged signature of length ${len} must return 401 without server crash`);
        }
      });
    });
  });

  // ==========================================================================
  // SECTION 2: entitlementService.js Adversarial Tests
  // ==========================================================================
  describe("2. entitlementService.js Edge Cases & Robustness Harness", () => {
    describe("2.1 Replayed Entitlement Events Stress", () => {
      it("ADV-ES-01: Replay attack with same entitlementId yields duplicate: true and 0 coupons across simulated process restart", async () => {
        const testUserId = "user_stress_replay_01";
        const testEntitlementId = "ent_stress_replay_1001";
        let couponsGranted = 0;

        const persistentRpgState = { entitlements: {}, processed_entitlements: [] };

        const origMutate = cacheManager.mutateUserProfileJson;
        const origIncrement = cacheManager.incrementUserSurvival;
        const origGetUserProfile = cacheManager.getUserProfile;
        const origUpdateUserProfile = cacheManager.updateUserProfile;

        cacheManager.getUserProfile = async () => ({ isPremium: false, premiumUntil: null });
        cacheManager.updateUserProfile = async () => true;
        cacheManager.incrementUserSurvival = async (uid, field, amt) => {
          if (field === "coupons") couponsGranted += amt;
          return { ok: true };
        };
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
          const res = fn(persistentRpgState);
          Object.assign(persistentRpgState, res);
          return persistentRpgState;
        };

        try {
          const res1 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_premium_vip",
            entitlementId: testEntitlementId,
          });

          assert.equal(res1.success, true);
          assert.equal(res1.rewardCoupons, 25);
          assert.equal(couponsGranted, 25);

          entitlementService.processedEntitlements.clear();

          const res2 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_premium_vip",
            entitlementId: testEntitlementId,
          });

          assert.equal(res2.success, true);
          assert.equal(res2.duplicate, true);
          assert.equal(res2.rewardCoupons, 0);
          assert.equal(couponsGranted, 25, "Coupons must not be incremented on replay even after in-memory cache clear");
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.incrementUserSurvival = origIncrement;
          cacheManager.getUserProfile = origGetUserProfile;
          cacheManager.updateUserProfile = origUpdateUserProfile;
        }
      });
    });

    describe("2.2 SKU Edge Cases & Negative Coupon Injection", () => {
      it("ADV-ES-02: Unknown SKU safely resolves to GENERIC_PREMIUM fallback without crashing", () => {
        const unknownSkus = [
          "completely_random_sku_abc",
          "sku_custom_enterprise",
          "undefined",
          "12345",
        ];

        for (const sku of unknownSkus) {
          const resolved = entitlementService.resolveSku(sku);
          assert.ok(resolved, `Unknown SKU '${sku}' must resolve to generic fallback`);
          assert.equal(resolved.type, "GENERIC_PREMIUM");
          assert.equal(resolved.tier, "tier1");
          assert.equal(resolved.durationDays, 30);
          assert.equal(resolved.rewardCoupons, 10);
        }
      });

      it("ADV-ES-03: Null, undefined, or empty SKU returns graceful error object without throwing TypeError in handleEntitlementCreate", async () => {
        assert.equal(entitlementService.resolveSku(null), null);
        assert.equal(entitlementService.resolveSku(""), null);
        assert.equal(entitlementService.resolveSku(undefined), null);

        const res = await entitlementService.handleEntitlementCreate({
          userId: "user_null_sku",
          skuId: null,
          entitlementId: "ent_null_sku",
        });

        assert.equal(res.success, false);
        assert.equal(res.error, "Invalid or missing SKU in entitlement");
        assert.equal(res.userId, "user_null_sku");
      });

      it("ADV-ES-03b: Null SKU returns graceful error object without throwing TypeError in handleEntitlementUpdate", async () => {
        const res = await entitlementService.handleEntitlementUpdate({
          userId: "user_null_sku",
          skuId: null,
        });

        assert.equal(res.success, false);
        assert.equal(res.error, "Invalid or missing SKU in entitlement");
        assert.equal(res.userId, "user_null_sku");
      });

      it("ADV-ES-04: Negative reward coupons does NOT decrement user coupons", async () => {
        const testUserId = "user_negative_reward_test";
        let couponsMutated = 0;

        const origMutate = cacheManager.mutateUserProfileJson;
        const origIncrement = cacheManager.incrementUserSurvival;
        const origGetUserProfile = cacheManager.getUserProfile;
        const origUpdateUserProfile = cacheManager.updateUserProfile;

        cacheManager.getUserProfile = async () => ({ isPremium: false });
        cacheManager.updateUserProfile = async () => true;
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});
        cacheManager.incrementUserSurvival = async (uid, field, amt) => {
          if (field === "coupons") couponsMutated += amt;
          return { ok: true };
        };

        const origSkus = { ...entitlementService.skus };
        entitlementService.skus = {
          ...origSkus,
          SKU_MALICIOUS_NEGATIVE: {
            id: "sku_malicious_negative",
            type: "EXPLOIT",
            name: "Negative Coupon Exploit",
            durationDays: 30,
            rewardCoupons: -100,
            rewardStarFragments: -500,
            tier: "tier1",
          },
        };

        try {
          const res = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_malicious_negative",
            entitlementId: "ent_negative_01",
          });

          assert.equal(res.success, true);
          assert.equal(couponsMutated, 0, "Negative coupons must NOT trigger debit or negative increment");
        } finally {
          entitlementService.skus = origSkus;
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.incrementUserSurvival = origIncrement;
          cacheManager.getUserProfile = origGetUserProfile;
          cacheManager.updateUserProfile = origUpdateUserProfile;
        }
      });
    });

    describe("2.3 Entitlement Deletion Lifecycle & Blast Radius", () => {
      it("ADV-ES-05: Deletion on non-existent entitlement or empty rpg_state succeeds safely without crash", async () => {
        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdateUserProfile = cacheManager.updateUserProfile;

        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});
        cacheManager.updateUserProfile = async () => true;

        try {
          const res = await entitlementService.handleEntitlementDelete({
            userId: "user_non_existent_ent",
            skuId: "sku_star_pass",
          });

          assert.equal(res.success, true);
          assert.equal(res.revoked, false, "Non-existent entitlement was not active, so revoked should be false");
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdateUserProfile;
        }
      });

      it("ADV-ES-06: Repeated double deletion of same entitlement does not crash", async () => {
        const sharedState = {
          entitlements: {
            sku_star_pass: { active: false, revokedAt: new Date().toISOString() },
          },
        };

        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdateUserProfile = cacheManager.updateUserProfile;

        cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
          const res = fn(sharedState);
          Object.assign(sharedState, res);
          return sharedState;
        };
        cacheManager.updateUserProfile = async () => true;

        try {
          const res = await entitlementService.handleEntitlementDelete({
            userId: "user_double_delete",
            skuId: "sku_star_pass",
          });

          assert.equal(res.success, true);
          assert.equal(res.revoked, false, "Repeated deletion of inactive entitlement returns revoked: false");
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdateUserProfile;
        }
      });

      it("ADV-ES-07: Deleting one entitlement when another is still active preserves premium status", async () => {
        const testUserId = "user_multi_entitlements";
        let profilePatch = null;

        const sharedState = {
          entitlements: {
            sku_star_pass: { active: true },
            sku_premium_vip: { active: true },
          },
        };

        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdateUserProfile = cacheManager.updateUserProfile;

        cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
          const res = fn(sharedState);
          Object.assign(sharedState, res);
          return sharedState;
        };
        cacheManager.updateUserProfile = async (uid, patch) => {
          profilePatch = patch;
          return true;
        };

        try {
          const res = await entitlementService.handleEntitlementDelete({
            userId: testUserId,
            skuId: "sku_star_pass",
          });

          assert.equal(res.success, true);
          assert.equal(res.revoked, true);

          assert.equal(profilePatch, null, "User profile must remain premium since sku_premium_vip is still active");
          assert.equal(sharedState.entitlements.sku_star_pass.active, false);
          assert.equal(sharedState.entitlements.sku_premium_vip.active, true);
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdateUserProfile;
        }
      });

      it("ADV-ES-08: Deleting non-existent entitlement does NOT wipe external (Saweria/Trakteer) premium", async () => {
        // SCENARIO UNDER INVESTIGATION:
        // User has active 1-year premium from Saweria donation.
        // User has NO Discord entitlements in rpg_state.
        // Discord webhook delivers ENTITLEMENT_DELETE for sku_star_pass.
        const testUserId = "user_saweria_donor_blast_radius";
        let profilePatchApplied = null;
        const sharedState = { entitlements: {} };

        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdateUserProfile = cacheManager.updateUserProfile;
        const origGetUserProfile = cacheManager.getUserProfile;

        cacheManager.getUserProfile = async () => ({
          isPremium: true,
          premiumUntil: new Date(Date.now() + 365 * 86400 * 1000).toISOString(),
          premium_tier: "tier3",
        });

        cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
          const res = fn(sharedState);
          Object.assign(sharedState, res);
          return sharedState;
        };
        cacheManager.updateUserProfile = async (uid, patch) => {
          profilePatchApplied = patch;
          return true;
        };

        try {
          const res = await entitlementService.handleEntitlementDelete({
            userId: testUserId,
            skuId: "sku_star_pass", // User NEVER had this SKU
          });

          // VERIFIED FIX:
          // handleEntitlementDelete does not wipe external premium because sku was not active
          assert.equal(res.success, true);
          assert.equal(res.revoked, false);
          assert.equal(profilePatchApplied, null, "UserProfile must not be wiped when deleting unowned entitlement");
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdateUserProfile;
          cacheManager.getUserProfile = origGetUserProfile;
        }
      });
    });

    describe("2.4 Comprehensive Matrix: Null/Undefined/Empty/Nonexistent SKU Resilience", () => {
      it("ADV-ES-09: handleEntitlementCreate matrix handles null, undefined, empty string, and nonexistent SKU without throwing", async () => {
        const testSkus = [null, undefined, "", "nonexistent_sku_12345"];
        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdate = cacheManager.updateUserProfile;
        const origGet = cacheManager.getUserProfile;
        const origInc = cacheManager.incrementUserSurvival;

        cacheManager.getUserProfile = async () => ({ isPremium: false, premiumUntil: null });
        cacheManager.updateUserProfile = async () => true;
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});
        cacheManager.incrementUserSurvival = async () => ({ ok: true });

        try {
          for (const sku of testSkus) {
            let threw = false;
            let result = null;
            try {
              result = await entitlementService.handleEntitlementCreate({
                userId: "user_matrix_test",
                skuId: sku,
                entitlementId: `ent_matrix_${String(sku)}`,
              });
            } catch (err) {
              threw = true;
            }

            assert.equal(threw, false, `handleEntitlementCreate must not throw for sku: ${sku}`);
            assert.ok(result, `handleEntitlementCreate must return an object for sku: ${sku}`);

            if (!sku) {
              assert.equal(result.success, false);
              assert.equal(result.error, "Invalid or missing SKU in entitlement");
            } else {
              assert.equal(result.success, true);
              assert.equal(result.tier, "tier1");
            }
          }
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdate;
          cacheManager.getUserProfile = origGet;
          cacheManager.incrementUserSurvival = origInc;
        }
      });

      it("ADV-ES-10: handleEntitlementUpdate matrix handles null, undefined, empty string, and nonexistent SKU without throwing", async () => {
        const testSkus = [null, undefined, "", "nonexistent_sku_12345"];
        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdate = cacheManager.updateUserProfile;

        cacheManager.updateUserProfile = async () => true;
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});

        try {
          for (const sku of testSkus) {
            let threw = false;
            let result = null;
            try {
              result = await entitlementService.handleEntitlementUpdate({
                userId: "user_matrix_test",
                skuId: sku,
              });
            } catch (err) {
              threw = true;
            }

            assert.equal(threw, false, `handleEntitlementUpdate must not throw for sku: ${sku}`);
            assert.ok(result, `handleEntitlementUpdate must return an object for sku: ${sku}`);

            if (!sku) {
              assert.equal(result.success, false);
              assert.equal(result.error, "Invalid or missing SKU in entitlement");
            } else {
              assert.equal(result.success, true);
            }
          }
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdate;
        }
      });

      it("ADV-ES-11: handleEntitlementDelete matrix handles null, undefined, empty string, and nonexistent SKU without throwing", async () => {
        const testSkus = [null, undefined, "", "nonexistent_sku_12345"];
        const origMutate = cacheManager.mutateUserProfileJson;
        const origUpdate = cacheManager.updateUserProfile;
        const origGet = cacheManager.getUserProfile;

        cacheManager.getUserProfile = async () => ({ isPremium: false, premiumUntil: null });
        cacheManager.updateUserProfile = async () => true;
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});

        try {
          for (const sku of testSkus) {
            let threw = false;
            let result = null;
            try {
              result = await entitlementService.handleEntitlementDelete({
                userId: "user_matrix_test",
                skuId: sku,
              });
            } catch (err) {
              threw = true;
            }

            assert.equal(threw, false, `handleEntitlementDelete must not throw for sku: ${sku}`);
            assert.ok(result, `handleEntitlementDelete must return an object for sku: ${sku}`);

            if (!sku) {
              assert.equal(result.success, false);
              assert.equal(result.revoked, false);
              assert.equal(result.error, "Invalid or missing SKU in entitlement");
            } else {
              assert.equal(result.success, true);
              assert.equal(result.revoked, false);
            }
          }
        } finally {
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.updateUserProfile = origUpdate;
          cacheManager.getUserProfile = origGet;
        }
      });
    });

    describe("2.5 Tier Hierarchy Matrix Verification", () => {
      it("ADV-ES-12: User with active tier3 receiving tier1, tier2, or vip_starter is NOT downgraded", async () => {
        const testUserId = "user_tier3_hierarchy_test";
        let capturedPatch = null;

        const origGet = cacheManager.getUserProfile;
        const origUpdate = cacheManager.updateUserProfile;
        const origMutate = cacheManager.mutateUserProfileJson;
        const origInc = cacheManager.incrementUserSurvival;

        cacheManager.getUserProfile = async () => ({
          isPremium: true,
          premiumUntil: new Date(Date.now() + 30 * 86400 * 1000).toISOString(),
          premium_tier: "tier3",
        });

        cacheManager.updateUserProfile = async (uid, patch) => {
          capturedPatch = patch;
          return true;
        };
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});
        cacheManager.incrementUserSurvival = async () => ({ ok: true });

        try {
          // 1. Receiving tier1 (Star Pass) via handleEntitlementCreate
          capturedPatch = null;
          const resTier1 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_star_pass",
            entitlementId: "ent_t1_hierarchy",
          });
          assert.equal(resTier1.success, true);
          assert.equal(capturedPatch.isPremium, true);
          assert.equal(capturedPatch.premium_tier, undefined, "Active tier3 must not be downgraded to tier1");

          // 2. Receiving tier2 (VIP Member) via handleEntitlementCreate
          capturedPatch = null;
          const resTier2 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_premium_vip",
            entitlementId: "ent_t2_hierarchy",
          });
          assert.equal(resTier2.success, true);
          assert.equal(capturedPatch.isPremium, true);
          assert.equal(capturedPatch.premium_tier, undefined, "Active tier3 must not be downgraded to tier2");

          // 3. Receiving vip_starter (Voter trial) via extendUserPremium
          capturedPatch = null;
          await entitlementService.extendUserPremium(testUserId, 12 * 3600 * 1000, "vip_starter");
          assert.equal(capturedPatch.isPremium, true);
          assert.equal(capturedPatch.premium_tier, undefined, "Active tier3 must not be downgraded to vip_starter");

          // 4. Receiving tier3 (VVIP Elite) preserves tier3
          capturedPatch = null;
          const resTier3 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_premium_vvip",
            entitlementId: "ent_t3_hierarchy",
          });
          assert.equal(resTier3.success, true);
          assert.equal(capturedPatch.isPremium, true);
          assert.equal(capturedPatch.premium_tier, "tier3", "tier3 can refresh tier3");
        } finally {
          cacheManager.getUserProfile = origGet;
          cacheManager.updateUserProfile = origUpdate;
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.incrementUserSurvival = origInc;
        }
      });
    });

    describe("2.6 Double Duration Extension Oracle", () => {
      it("ADV-ES-13: Purchasing 30-day subscription extends premiumUntil by exactly 30 days from now, and second purchase extends by exactly 30 days from previous expiry (not 60+ days)", async () => {
        const testUserId = "user_duration_oracle_test";
        const THIRTY_DAYS_MS = 30 * 86400 * 1000;
        let simulatedProfile = { isPremium: false, premiumUntil: null, premium_tier: "none" };

        const origGet = cacheManager.getUserProfile;
        const origUpdate = cacheManager.updateUserProfile;
        const origMutate = cacheManager.mutateUserProfileJson;
        const origInc = cacheManager.incrementUserSurvival;

        cacheManager.getUserProfile = async () => ({ ...simulatedProfile });
        cacheManager.updateUserProfile = async (uid, patch) => {
          Object.assign(simulatedProfile, patch);
          return true;
        };
        cacheManager.mutateUserProfileJson = async (uid, field, fn) => fn({});
        cacheManager.incrementUserSurvival = async () => ({ ok: true });

        try {
          const t0 = Date.now();

          // Purchase 1: Initial 30-day subscription
          const res1 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_star_pass",
            entitlementId: "ent_duration_first_01",
          });

          assert.equal(res1.success, true);
          assert.ok(res1.expiry instanceof Date);

          const expiry1Time = res1.expiry.getTime();
          const deltaFromT0 = expiry1Time - t0;

          // Must be within 5 seconds of exactly 30 days
          assert.ok(
            Math.abs(deltaFromT0 - THIRTY_DAYS_MS) < 5000,
            `First purchase must extend by ~30 days (actual delta: ${deltaFromT0} ms)`,
          );
          // Crucial check: must NOT have doubled to 60 days on the first purchase
          assert.ok(
            deltaFromT0 < 35 * 86400 * 1000,
            "First purchase must NOT be 60+ days",
          );

          // Update simulated profile with first purchase expiry
          simulatedProfile = {
            isPremium: true,
            premiumUntil: res1.expiry.toISOString(),
            premium_tier: "tier1",
          };

          // Purchase 2: Stacking second 30-day subscription
          const res2 = await entitlementService.handleEntitlementCreate({
            userId: testUserId,
            skuId: "sku_star_pass",
            entitlementId: "ent_duration_second_02",
          });

          assert.equal(res2.success, true);
          assert.ok(res2.expiry instanceof Date);

          const expiry2Time = res2.expiry.getTime();
          const deltaBetweenExpiries = expiry2Time - expiry1Time;

          // Second purchase must extend from previous expiry by EXACTLY 30 days
          assert.equal(
            deltaBetweenExpiries,
            THIRTY_DAYS_MS,
            `Second purchase must extend from previous expiry by exactly 30 days (actual delta: ${deltaBetweenExpiries} ms)`,
          );

          // Total duration from t0 must be ~60 days, NOT 90+ or 120+ days
          const totalDelta = expiry2Time - t0;
          assert.ok(
            Math.abs(totalDelta - 2 * THIRTY_DAYS_MS) < 5000,
            `Total duration must be ~60 days (actual delta: ${totalDelta} ms)`,
          );
        } finally {
          cacheManager.getUserProfile = origGet;
          cacheManager.updateUserProfile = origUpdate;
          cacheManager.mutateUserProfileJson = origMutate;
          cacheManager.incrementUserSurvival = origInc;
        }
      });
    });

    describe("2.7 External Premium (Saweria) Retention on Discord Entitlement Deletion", () => {
      it("ADV-ES-14: User with active Saweria premium receiving handleEntitlementDelete for Discord SKU retains isPremium: true and premiumUntil", async () => {
        const testUserId = "user_saweria_retention_test";
        const externalExpiry = new Date(Date.now() + 180 * 86400 * 1000);
        let patchAttempted = null;

        const origGet = cacheManager.getUserProfile;
        const origUpdate = cacheManager.updateUserProfile;
        const origMutate = cacheManager.mutateUserProfileJson;

        // User has active Saweria premium (180 days)
        cacheManager.getUserProfile = async () => ({
          isPremium: true,
          premiumUntil: externalExpiry.toISOString(),
          premium_tier: "friends",
        });

        // User previously also had sku_star_pass recorded in rpg_state
        const userState = {
          entitlements: {
            sku_star_pass: { active: true, planName: "Naura Star Pass" },
          },
        };

        cacheManager.mutateUserProfileJson = async (uid, field, fn) => {
          const res = fn(userState);
          Object.assign(userState, res);
          return userState;
        };

        cacheManager.updateUserProfile = async (uid, patch) => {
          patchAttempted = patch;
          return true;
        };

        try {
          const res = await entitlementService.handleEntitlementDelete({
            userId: testUserId,
            skuId: "sku_star_pass",
          });

          // Deletion of Discord SKU succeeds
          assert.equal(res.success, true);
          assert.equal(res.revoked, true);
          assert.equal(userState.entitlements.sku_star_pass.active, false);

          // CRITICAL ORACLE:
          // UserProfile must NOT have isPremium cleared to false or premiumUntil set to null
          // because external premium from Saweria is still active!
          assert.equal(
            patchAttempted,
            null,
            "UserProfile must not be updated to revoke premium when active Saweria premium remains",
          );

          // Verify through isUserPremium oracle
          const isStillPremium = await entitlementService.isUserPremium(testUserId);
          assert.equal(isStillPremium, true, "User must still be recognized as premium due to active Saweria donation");
        } finally {
          cacheManager.getUserProfile = origGet;
          cacheManager.updateUserProfile = origUpdate;
          cacheManager.mutateUserProfileJson = origMutate;
        }
      });
    });
  });
});
