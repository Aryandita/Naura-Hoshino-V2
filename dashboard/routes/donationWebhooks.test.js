"use strict";

const { describe, it, before, after } = require("node:test");
const assert = require("node:assert");
const crypto = require("crypto");
const http = require("http");
const express = require("express");
const donationWebhooks = require("./donationWebhooks");
const voteRewards = require("../utils/voteRewards");
const httpGuard = require("../utils/httpGuard");

describe("Donation Webhooks Router & Security Suite", () => {
  const TEST_SAWERIA_SECRET = "saweria_test_secret_key_123456789";
  const TEST_TRAKTEER_SECRET = "trakteer_test_secret_key_987654321";

  // Simpan method asli untuk di-restore
  const originalExtendPremium = voteRewards.extendPremium;
  const originalClaimOnce = httpGuard.claimOnce;

  let server;
  let baseUrl;
  let mockExtendedUsers = [];

  before(async () => {
    // Siapkan Express app pengujian
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
          username: `User_${id}`,
          send: async () => true,
        }),
      },
    };

    // Pasang router dengan secret override agar terisolasi dari env
    process.env.WEBHOOK_AUTH_SAWERIA = TEST_SAWERIA_SECRET;
    process.env.WEBHOOK_AUTH_TRAKTEER = TEST_TRAKTEER_SECRET;

    const router = donationWebhooks(mockClient, {
      saweriaSecret: TEST_SAWERIA_SECRET,
      trakteerSecret: TEST_TRAKTEER_SECRET,
      extendPremium: async (userId, durationMs, tier) => {
        mockExtendedUsers.push({ userId, durationMs, tier });
        return new Date(Date.now() + durationMs);
      },
    });
    app.use(router);

    // Jalankan server HTTP pada ephemeral port
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
    voteRewards.extendPremium = originalExtendPremium;
    httpGuard.claimOnce = originalClaimOnce;
    if (server) {
      await new Promise((resolve) => server.close(resolve));
    }
  });

  // ==============================================================
  // 1. PENGUJIAN REGEX SNOWFLAKE (17-20 DIGIT)
  // ==============================================================
  describe("extractDiscordId parsing Snowflake 17-20 digit", () => {
    const { extractDiscordId } = donationWebhooks;

    it("mengekstrak Discord ID 17 digit dari teks dan objek", () => {
      const id17 = "12345678901234567";
      assert.strictEqual(extractDiscordId(id17), id17);
      assert.strictEqual(extractDiscordId(`Tolong beri VIP ke ${id17} ya!`), id17);
      assert.strictEqual(extractDiscordId({ message: `ID: ${id17}` }), id17);
      assert.strictEqual(extractDiscordId({ discord_id: id17 }), id17);
    });

    it("mengekstrak Discord ID 18 digit (standar Discord saat ini)", () => {
      const id18 = "123456789012345678";
      assert.strictEqual(extractDiscordId(id18), id18);
      assert.strictEqual(extractDiscordId(`Semangat Naura! ${id18}`), id18);
      assert.strictEqual(extractDiscordId({ supporter_message: `Pesan ${id18}` }), id18);
      assert.strictEqual(extractDiscordId({ user_id: id18 }), id18);
    });

    it("mengekstrak Discord ID 19 digit", () => {
      const id19 = "1234567890123456789";
      assert.strictEqual(extractDiscordId(id19), id19);
      assert.strictEqual(extractDiscordId(`Halo ${id19} terima kasih`), id19);
      assert.strictEqual(extractDiscordId({ notes: `${id19}` }), id19);
    });

    it("mengekstrak Discord ID 20 digit", () => {
      const id20 = "12345678901234567890";
      assert.strictEqual(extractDiscordId(id20), id20);
      assert.strictEqual(extractDiscordId(`Donasi dari ${id20}`), id20);
      assert.strictEqual(extractDiscordId({ userId: id20 }), id20);
    });

    it("menolak angka kurang dari 17 digit atau lebih dari 20 digit", () => {
      assert.strictEqual(extractDiscordId("123456"), null);
      assert.strictEqual(extractDiscordId("1234567890123456"), null); // 16 digit
      assert.strictEqual(extractDiscordId("123456789012345678901"), null); // 21 digit
      assert.strictEqual(extractDiscordId(""), null);
      assert.strictEqual(extractDiscordId(null), null);
    });
  });

  // ==============================================================
  // 2. PENGUJIAN RESOLUSI TIER DONASI
  // ==============================================================
  describe("resolveTier", () => {
    const { resolveTier } = donationWebhooks;

    it("mengembalikan null jika nominal di bawah tier minimum (35.000)", () => {
      assert.strictEqual(resolveTier(10000), null);
      assert.strictEqual(resolveTier(34999), null);
    });

    it("mengidentifikasi Tier 1 (35.000) - Naura Supporter 30 Hari", () => {
      const tier = resolveTier(35000);
      assert.ok(tier);
      assert.strictEqual(tier.tier, "tier1");
      assert.strictEqual(tier.days, 30);
    });

    it("mengidentifikasi Tier 2 (50.000) - Naura Friends 180 Hari", () => {
      const tier = resolveTier(50000);
      assert.ok(tier);
      assert.strictEqual(tier.tier, "tier2");
      assert.strictEqual(tier.days, 180);
    });

    it("mengidentifikasi Tier 3 (75.000) - Naura Bestie 365 Hari", () => {
      const tier = resolveTier(75000);
      assert.ok(tier);
      assert.strictEqual(tier.tier, "tier3");
      assert.strictEqual(tier.days, 365);

      const higherTier = resolveTier(150000);
      assert.strictEqual(higherTier.tier, "tier3");
    });
  });

  // ==============================================================
  // 3. PENGUJIAN VERIFIKASI HMAC & TIMING SAFE EQUAL
  // ==============================================================
  describe("verifyWebhookSignature & Constant-Time Security", () => {
    const { verifyWebhookSignature } = donationWebhooks;

    it("lolos verifikasi jika token cocok persis (constant-time token comparison)", () => {
      const req = {
        headers: { "saweria-token": TEST_SAWERIA_SECRET },
        body: { amount: 35000 },
      };
      const res = verifyWebhookSignature(req, {
        headerNames: ["saweria-token"],
        secretOverride: TEST_SAWERIA_SECRET,
      });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.method, "token");
    });

    it("lolos verifikasi jika signature adalah HMAC SHA-256 yang sah dari payload", () => {
      const payload = JSON.stringify({ amount: 50000, message: "123456789012345678" });
      const hmac = crypto
        .createHmac("sha256", TEST_SAWERIA_SECRET)
        .update(payload)
        .digest("hex");

      const req = {
        headers: { "x-saweria-signature": hmac },
        body: JSON.parse(payload),
        rawBody: Buffer.from(payload),
      };

      const res = verifyWebhookSignature(req, {
        headerNames: ["x-saweria-signature"],
        secretOverride: TEST_SAWERIA_SECRET,
      });
      assert.strictEqual(res.ok, true);
      assert.strictEqual(res.method, "hmac");
    });

    it("menolak permintaan jika signature/token salah", () => {
      const req = {
        headers: { "saweria-token": "wrong_secret_token" },
        body: { amount: 35000 },
      };
      const res = verifyWebhookSignature(req, {
        headerNames: ["saweria-token"],
        secretOverride: TEST_SAWERIA_SECRET,
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "mismatch");
    });

    it("menolak permintaan jika header signature tidak ada", () => {
      const req = {
        headers: {},
        body: { amount: 35000 },
      };
      const res = verifyWebhookSignature(req, {
        headerNames: ["saweria-token"],
        secretOverride: TEST_SAWERIA_SECRET,
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "missing_signature");
    });

    it("menolak permintaan jika secret belum dikonfigurasi", () => {
      const req = {
        headers: { "saweria-token": "any_token" },
        body: {},
      };
      const res = verifyWebhookSignature(req, {
        headerNames: ["saweria-token"],
        secretOverride: "",
      });
      assert.strictEqual(res.ok, false);
      assert.strictEqual(res.reason, "unconfigured");
    });
  });

  // ==============================================================
  // 4. PENGUJIAN INTEGRASI HTTP ENDPOINT SAWERIA & TRAKTEER
  // ==============================================================
  describe("Express Endpoints /saweria and /trakteer", () => {
    before(() => {
      mockExtendedUsers = [];
      voteRewards.extendPremium = async (userId, durationMs, tier) => {
        mockExtendedUsers.push({ userId, durationMs, tier });
        return new Date(Date.now() + durationMs);
      };
    });

    it("menolak request tanpa otentikasi dengan status 401 Unauthorized", async () => {
      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: 50000, message: "123456789012345678" }),
      });
      assert.strictEqual(res.status, 401);
      const data = await res.json();
      assert.ok(data.error);
    });

    it("menolak request dengan signature HMAC yang salah (401)", async () => {
      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": "invalid_signature_hash",
        },
        body: JSON.stringify({ amount: 50000, message: "123456789012345678" }),
      });
      assert.strictEqual(res.status, 401);
    });

    it("menolak donasi tanpa nominal atau nominal 0 dengan status 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": TEST_SAWERIA_SECRET,
        },
        body: JSON.stringify({ amount: 0, message: "123456789012345678" }),
      });
      assert.strictEqual(res.status, 400);
    });

    it("menolak donasi tanpa Discord ID 17-20 digit dengan status 400 Bad Request", async () => {
      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": TEST_SAWERIA_SECRET,
        },
        body: JSON.stringify({ amount: 50000, message: "Terima kasih tanpa ID Discord" }),
      });
      assert.strictEqual(res.status, 400);
    });

    it("menerima donasi di bawah tier minimum dengan status 200 tanpa extend premium", async () => {
      const preCount = mockExtendedUsers.length;
      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": TEST_SAWERIA_SECRET,
        },
        body: JSON.stringify({
          amount: 15000,
          message: "Semangat Naura 123456789012345678",
          donator_name: "Kawan Baik",
        }),
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.ok, true);
      assert.strictEqual(mockExtendedUsers.length, preCount);
    });

    it("sukses memproses donasi Saweria sah dengan HMAC SHA-256 dan memperpanjang premium", async () => {
      const testUserId = "123456789012345678";
      const payloadObj = {
        id: "saweria_tx_001",
        amount: 50000,
        message: `Halo Naura! ID Discord saya ${testUserId}`,
        donator_name: "Sultan Naura",
      };
      const rawPayload = JSON.stringify(payloadObj);
      const hmac = crypto
        .createHmac("sha256", TEST_SAWERIA_SECRET)
        .update(rawPayload)
        .digest("hex");

      const res = await fetch(`${baseUrl}/api/webhook/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-saweria-signature": hmac,
        },
        body: rawPayload,
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.userId, testUserId);
      assert.strictEqual(data.tier, "Naura Friends (6 Bulan)");

      const recorded = mockExtendedUsers.find((u) => u.userId === testUserId);
      assert.ok(recorded, "User harus tercatat menerima perpanjangan premium");
      assert.strictEqual(recorded.durationMs, 180 * 24 * 60 * 60 * 1000);
      assert.strictEqual(recorded.tier, "tier2");
    });

    it("mencegah duplikasi transaksi pada replay webhook (Idempotency claimOnce)", async () => {
      const testUserId = "987654321098765432";
      const payloadObj = {
        id: "saweria_tx_replay_002",
        amount: 75000,
        message: `ID: ${testUserId}`,
        donator_name: "Dermawan",
      };

      // Panggilan pertama: berhasil
      const res1 = await fetch(`${baseUrl}/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": TEST_SAWERIA_SECRET,
        },
        body: JSON.stringify(payloadObj),
      });
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.success, true);

      const countAfterFirst = mockExtendedUsers.filter((u) => u.userId === testUserId).length;
      assert.strictEqual(countAfterFirst, 1);

      // Panggilan kedua dengan payload/id identik (replay): harus diabaikan secara idempoten
      const res2 = await fetch(`${baseUrl}/saweria`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "saweria-token": TEST_SAWERIA_SECRET,
        },
        body: JSON.stringify(payloadObj),
      });
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.ok, true);
      assert.strictEqual(data2.duplicate, true);

      // Durasi premium TIDAK boleh bertambah lagi
      const countAfterSecond = mockExtendedUsers.filter((u) => u.userId === testUserId).length;
      assert.strictEqual(countAfterSecond, 1, "Replay webhook tidak boleh menduplikasi perpanjangan");
    });

    it("sukses memproses donasi Trakteer dan mendukung path /trakteer", async () => {
      const testUserId = "112233445566778899";
      const payload = {
        transaction_id: "trakteer_tx_003",
        amount: 35000,
        supporter_message: `Semangat buat botnya! ${testUserId}`,
        supporter_name: "Pendukung Trakteer",
      };

      const res = await fetch(`${baseUrl}/trakteer`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-trakteer-token": TEST_TRAKTEER_SECRET,
        },
        body: JSON.stringify(payload),
      });

      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.success, true);
      assert.strictEqual(data.userId, testUserId);
      assert.strictEqual(data.tier, "Naura Supporter (1 Bulan)");

      const trakteerRecorded = mockExtendedUsers.find((u) => u.userId === testUserId);
      assert.ok(trakteerRecorded, "User harus tercatat menerima perpanjangan premium dari Trakteer");
      assert.strictEqual(trakteerRecorded.tier, "tier1");
    });

    it("endpoint health check merespons 200 OK", async () => {
      const res1 = await fetch(`${baseUrl}/health`);
      assert.strictEqual(res1.status, 200);
      const data1 = await res1.json();
      assert.strictEqual(data1.ok, true);

      const res2 = await fetch(`${baseUrl}/api/webhook/health`);
      assert.strictEqual(res2.status, 200);
      const data2 = await res2.json();
      assert.strictEqual(data2.ok, true);
    });
  });
});
