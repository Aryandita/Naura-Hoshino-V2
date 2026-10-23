"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert");
const {
  analyzeContent,
  isAllowedDomain,
  stripHomoglyphs,
  extractUrls,
  extractSld,
  scanMessage,
} = require("./phishingShield");

describe("PhishingShield Automod Module", () => {
  describe("Domain Allowlist and Subdomain Hierarchy (0 False Positives)", () => {
    it("Mengizinkan semua domain resmi Discord dan seluruh subdomain sahnya", () => {
      const allowedSamples = [
        "discord.com",
        "canary.discord.com",
        "ptb.discord.com",
        "discord.gg",
        "invite.discord.gg",
        "discord.gift",
        "claim.discord.gift",
        "discordapp.com",
        "cdn.discordapp.com",
        "status.discordapp.com",
        "discordapp.net",
        "media.discordapp.net",
        "images-ext-1.discordapp.net",
        "discordstatus.com",
        "dis.gd",
        "watchanimeattheoffice.net",
        "discord.design",
        "discord.dev",
        "discord.new",
        "discord.events",
      ];

      for (const domain of allowedSamples) {
        assert.strictEqual(
          isAllowedDomain(domain),
          true,
          `Domain resmi Discord harus diizinkan: ${domain}`,
        );
      }
    });

    it("Mengizinkan domain komunitas dan platform pihak ketiga yang sah", () => {
      const trustedSamples = [
        "top.gg",
        "api.top.gg",
        "discordbotlist.com",
        "bots.gg",
        "disboard.org",
        "discordservers.com",
        "discord.me",
        "discord.io",
        "discord.js.org",
        "discordjs.guide",
        "github.com",
        "raw.githubusercontent.com",
        "youtube.com",
        "youtu.be",
        "spotify.com",
        "google.com",
        "twitter.com",
        "x.com",
        "steamcommunity.com",
        "steampowered.com",
        "tenor.com",
        "giphy.com",
      ];

      for (const domain of trustedSamples) {
        assert.strictEqual(
          isAllowedDomain(domain),
          true,
          `Domain terpercaya harus diizinkan: ${domain}`,
        );
      }
    });

    it("Menolak domain jahat yang mencoba menyamar dengan suffix subdomain Discord palsu", () => {
      const maliciousVariants = [
        "discord.com.scam-server.ru",
        "discord.gift.free-nitro.xyz",
        "discordapp.com.phishing.click",
        "evil-discord.com",
        "notdiscord.com",
        "faketop.gg",
      ];

      for (const domain of maliciousVariants) {
        assert.strictEqual(
          isAllowedDomain(domain),
          false,
          `Domain peniru tidak boleh diizinkan: ${domain}`,
        );
      }
    });
  });

  describe("Helper Functions (stripHomoglyphs, extractUrls, extractSld)", () => {
    it("stripHomoglyphs menetralkan karakter Cyrillic, Greek, zero-width, dan leetspeak", () => {
      // Cyrillic i, o, a, c, e
      assert.strictEqual(stripHomoglyphs("d\u0456sc\u043Erd"), "discord");
      assert.strictEqual(stripHomoglyphs("n\u0456tr\u043E"), "nitro");
      assert.strictEqual(stripHomoglyphs("d\u0456sc\u043Ercl"), "discord"); // 'cl' -> 'd'

      // Zero-width characters removal
      const withZeroWidth = "d\u200Bisc\u200Cord";
      assert.strictEqual(stripHomoglyphs(withZeroWidth), "discord");

      // Leetspeak substitutions
      assert.strictEqual(stripHomoglyphs("d1sc0rd"), "discord");
      assert.strictEqual(stripHomoglyphs("n1tr0"), "nitro");
    });

    it("extractUrls mengekstrak seluruh URL dari string teks secara akurat", () => {
      const text = "Lihat server ini https://discord.gg/abc1234 dan kunjungi http://dlscord-nitro.com/gift sekarang!";
      const extracted = extractUrls(text);

      assert.strictEqual(extracted.length, 2);
      assert.strictEqual(extracted[0].hostname, "discord.gg");
      assert.strictEqual(extracted[1].hostname, "dlscord-nitro.com");
    });

    it("extractSld mengekstrak Second-Level Domain untuk domain reguler maupun multi-part TLD", () => {
      assert.strictEqual(extractSld("discord.com"), "discord");
      assert.strictEqual(extractSld("canary.discord.com"), "discord");
      assert.strictEqual(extractSld("dlscord-nitro.com"), "dlscord-nitro");
      assert.strictEqual(extractSld("nitro-gift.xyz"), "nitro-gift");
      assert.strictEqual(extractSld("scam-discord.co.uk"), "scam-discord");
      assert.strictEqual(extractSld("claim-gift.com.au"), "claim-gift");
      assert.strictEqual(extractSld("login.discord.org.uk"), "discord");
    });
  });

  describe("Content Analysis & Phishing Detection", () => {
    it("Pesan percakapan biasa dan link resmi tidak terdeteksi sebagai phishing (0 False Positive)", () => {
      const safeMessages = [
        "Halo semua, selamat pagi!",
        "Ayo ngobrol di voice channel nanti malam.",
        "Join server kita di https://discord.gg/naura-community ya!",
        "Hadiah Nitro asli: https://discord.gift/XyZ123ValidCode",
        "Dokumentasi bot ada di https://discord.js.org/#/docs",
        "Cek video ini https://www.youtube.com/watch?v=dQw4w9WgXcQ",
        "Repo GitHub: https://github.com/discord/discord-api-docs",
        "Gambar kucing lucu https://cdn.discordapp.com/attachments/123/456/cat.png",
        "Status server https://discordstatus.com",
        "Beli game di https://store.steampowered.com",
      ];

      for (const msg of safeMessages) {
        const result = analyzeContent(msg);
        assert.strictEqual(
          result.isPhishing,
          false,
          `Pesan aman tidak boleh terdeteksi: "${msg}"`,
        );
        assert.strictEqual(result.detectedDomain, null);
      }
    });

    it("Mendeteksi variasi typosquatting brand Discord pada SLD (Levenshtein distance 1-2)", () => {
      const typosquats = [
        "https://dlscord.gift/free-nitro",
        "https://discorcl.com/claim",
        "https://d1scord.gift/claim",
        "https://disc0rd.org/gift",
        "https://discrod.com/airdrop",
        "https://dicsord.gift",
        "https://disccord.com/login",
        "https://disscord.gift",
        "https://dicord.com",
        "https://discorde.gift",
        "https://dlscordapp.com/gift",
      ];

      for (const link of typosquats) {
        const result = analyzeContent(`Klaim hadiah gratis kamu di ${link}`);
        assert.strictEqual(
          result.isPhishing,
          true,
          `Typosquatting wajib terdeteksi: ${link}`,
        );
        assert.ok(result.reason, `Alasan harus ada untuk: ${link}`);
        assert.ok(result.detectedDomain, `Domain terdeteksi harus ada untuk: ${link}`);
      }
    });

    it("Mendeteksi manipulasi karakter homoglyph Cyrillic dan Greek", () => {
      const homoglyphLinks = [
        "https://d\u0456scord.com/nitro", // Cyrillic Ukrainian i
        "https://disc\u043Erd.gift/nitro", // Cyrillic o
        "https://d\u0456sc\u043Erd.com/free", // Cyrillic i & o
        "https://dis\u0441ord.com/airdrop", // Cyrillic c
        "https://disc\u03BFrd.com/gift", // Greek omicron
      ];

      for (const link of homoglyphLinks) {
        const result = analyzeContent(`Dapatkan Nitro cuma-cuma: ${link}`);
        assert.strictEqual(
          result.isPhishing,
          true,
          `Homoglyph wajib terdeteksi: ${link}`,
        );
      }
    });

    it("Mendeteksi penggunaan merek Discord pada domain pihak ketiga yang tidak resmi", () => {
      const unauthorizedBrandLinks = [
        "https://discord-nitro.com/gift",
        "https://discord-gift.ru",
        "https://discord-airdrop.xyz/claim",
        "https://discord-free.site",
        "https://steam-discord.com/login",
        "https://discord-claim.top",
        "https://discord.com.scam-domain.ru",
      ];

      for (const link of unauthorizedBrandLinks) {
        const result = analyzeContent(`Klik link ini: ${link}`);
        assert.strictEqual(
          result.isPhishing,
          true,
          `Domain tidak resmi dengan nama Discord wajib terdeteksi: ${link}`,
        );
      }
    });

    it("Mendeteksi jebakan scam Nitro yang menggabungkan kata kunci Nitro dengan umpan atau TLD mencurigakan", () => {
      const nitroScams = [
        "https://nitro-gift.xyz/claim",
        "https://free-nitro.ru/download",
        "https://claim-nitro.click",
        "https://nitro-airdrop.com/free",
        "https://steam-nitro-gift.com/start",
        "https://nitro-promo.online/promo",
        "https://nitro-drop.site/boost",
        "https://free-nitro-steam.com",
      ];

      for (const link of nitroScams) {
        const result = analyzeContent(`Buruan sebelum kehabisan: ${link}`);
        assert.strictEqual(
          result.isPhishing,
          true,
          `Scam Nitro kombinasi umpan wajib terdeteksi: ${link}`,
        );
      }
    });
  });

  describe("Performance Benchmark Latency (< 50ms Guarantee)", () => {
    it("Eksekusi deteksi harus selesai dalam waktu strictly < 50ms (assert elapsedMs < 50)", () => {
      const testCases = [
        "Pesan santai tanpa tautan sama sekali",
        "Kunjungi dokumentasi resmi di https://discord.com/developers/docs/intro",
        "Klaim Nitro gratisan kamu https://dlscord-nitro.com/gift?promo=fake123",
        "Link homoglyph jebakan https://d\u0456sc\u043Erd.gift/claim?id=999",
        "Tautan normal https://github.com/discord/discord-api-docs",
      ];

      for (const content of testCases) {
        const result = analyzeContent(content);
        assert.ok(
          result.elapsedMs < 50,
          `Latency (${result.elapsedMs.toFixed(2)}ms) harus strictly < 50ms untuk: "${content}"`,
        );
      }
    });

    it("Benchmark 100 iterasi konsekutif membuktikan latensi rata-rata sub-milidetik (< 5ms)", () => {
      const iterations = 100;
      let totalElapsed = 0;
      let maxElapsed = 0;

      for (let i = 0; i < iterations; i++) {
        const payload = `Halo bro, klaim hadiah https://dlscord-nitro.xyz/promo?iter=${i} sekarang juga!`;
        const result = analyzeContent(payload);
        totalElapsed += result.elapsedMs;
        if (result.elapsedMs > maxElapsed) {
          maxElapsed = result.elapsedMs;
        }
        assert.ok(
          result.elapsedMs < 100,
          `Setiap iterasi harus < 100ms, ditemukan: ${result.elapsedMs.toFixed(2)}ms pada iterasi ${i}`,
        );
      }

      const avgElapsed = totalElapsed / iterations;
      assert.ok(
        avgElapsed < 5,
        `Rata-rata latensi (${avgElapsed.toFixed(3)}ms) harus < 5ms`,
      );
      assert.ok(
        maxElapsed < 100,
        `Latensi maksimum (${maxElapsed.toFixed(3)}ms) harus strictly < 100ms`,
      );
    });
  });

  describe("Message Action & Integration Handler (scanMessage)", () => {
    it("Mengabaikan pesan dari bot tanpa melakukan scanning", async () => {
      const mockMessage = {
        content: "https://dlscord-nitro.com/gift",
        author: { bot: true, id: "12345" },
      };

      const result = await scanMessage(mockMessage, {});
      assert.strictEqual(result.isPhishing, false);
    });

    it("Menghapus pesan phishing, mengirim peringatan di channel, dan mencatat ke mod log", async () => {
      const cacheManager = require("../managers/cacheManager");
      const origGet = cacheManager.getGuildSettings;
      cacheManager.getGuildSettings = async () => ({ settings: { auditLogChannel: "123" } });

      let deleteCalled = false;
      let channelSendCalled = false;
      let channelSentPayload = null;

      const mockMessage = {
        id: "msg_999",
        content: "Klik ini https://dlscord-nitro.com/gift untuk dapat Nitro gratis!",
        author: {
          bot: false,
          id: "user_111",
          username: "scammer_user",
          tag: "scammer_user#1234",
        },
        guild: {
          id: "guild_888",
          channels: {
            cache: new Map([
              ["123", { id: "123", send: async () => {} }],
            ]),
          },
        },
        channel: {
          id: "channel_777",
          send: async (payload) => {
            channelSendCalled = true;
            channelSentPayload = payload;
            return {
              delete: async () => {},
            };
          },
        },
        delete: async () => {
          deleteCalled = true;
        },
      };

      try {
        const result = await scanMessage(mockMessage, {});
        assert.strictEqual(result.isPhishing, true);
        assert.strictEqual(result.detectedDomain, "dlscord-nitro.com");
        assert.strictEqual(deleteCalled, true, "Pesan phishing harus langsung dihapus");
        assert.strictEqual(channelSendCalled, true, "Peringatan harus dikirim ke channel");
        assert.ok(
          channelSentPayload.content.includes("user_111") ||
          channelSentPayload.content.includes("dlscord-nitro.com"),
          "Peringatan channel harus memuat identitas atau domain",
        );
      } finally {
        cacheManager.getGuildSettings = origGet;
      }
    });
  });
});
