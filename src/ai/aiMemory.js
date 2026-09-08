"use strict";

const redisManager = require("../managers/redisManager");
const mongoManager = require("../managers/mongoManager");
const { logger } = require("../managers/logger");

const MEMORY_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days in seconds

class AIMemory {
  /**
   * Mengambil konteks memori pengguna untuk disuntikkan ke prompt AI.
   * Urutan: Redis Cache -> MongoDB Atlas -> Formatter.
   * @param {string} userId
   * @returns {Promise<string>}
   */
  static async getMemoryContext(userId, query = "") {
    if (!userId) return "";

    let memoryData = null;

    // 1. Coba ambil dari Redis Cache terlebih dahulu
    if (redisManager.isReady) {
      try {
        const cached = await redisManager.getCache(`ai:memory:obj:${userId}`);
        if (cached && typeof cached === "object") {
          memoryData = cached;
        }
      } catch (e) {
        // Abaikan error cache redis
      }
    }

    // 2. Fallback baca ke MongoDB jika belum ada di cache
    if (
      !memoryData &&
      (mongoManager.isReady || typeof mongoManager.getAiMemory === "function")
    ) {
      try {
        const doc = await mongoManager.getAiMemory(userId);
        if (doc) {
          memoryData = {
            nickname: doc.nickname || "",
            musicPrefs: Array.isArray(doc.musicPrefs) ? doc.musicPrefs : [],
            facts: Array.isArray(doc.facts) ? doc.facts : [],
            summary: doc.summary || "",
          };

          // Simpan ke Redis cache
          if (redisManager.isReady) {
            await redisManager.setCache(
              `ai:memory:obj:${userId}`,
              memoryData,
              MEMORY_TTL_SECONDS,
            );
          }
        }
      } catch (mongoErr) {
        logger.warn(
          `[AIMemory] Gagal membaca MongoDB untuk user ${userId}:`,
          mongoErr.message,
        );
      }
    }

    // 3. Fallback string lama di Redis jika masih ada
    if (!memoryData && redisManager.isReady) {
      try {
        const rawString = await redisManager.getCache(`ai:memory:${userId}`);
        if (rawString && typeof rawString === "string" && rawString.trim()) {
          return `\n[Catatan Ingatan AI tentang User]: ${rawString}\n`;
        }
      } catch (e) {
        // Safe fallback
      }
    }

    const lines = [];

    if (memoryData) {
      // 4. Susun konteks memori yang scannable dan informatif
      if (memoryData.nickname) {
        lines.push(
          `- Nama panggilan/panggilan akrab user: "${memoryData.nickname}" (panggillah dengan nama ini).`,
        );
      }
      if (
        Array.isArray(memoryData.musicPrefs) &&
        memoryData.musicPrefs.length > 0
      ) {
        lines.push(
          `- Preferensi musik favorit user: ${memoryData.musicPrefs.join(", ")}.`,
        );
      }
      if (Array.isArray(memoryData.facts) && memoryData.facts.length > 0) {
        lines.push(
          `- Fakta penting tentang user: ${memoryData.facts.join("; ")}.`,
        );
      }
      if (memoryData.summary) {
        lines.push(`- Riwayat/catatan obrolan sebelumnya: ${memoryData.summary}`);
      }
    }

    // 5. Tambahkan memori semantik jangka panjang (pgvector / vector search)
    if (query && typeof query === "string" && query.trim()) {
      try {
        const { service } = require("./semanticMemoryService");
        const semanticHits = await service.searchMemories(query.trim(), {
          userId,
          limit: 3,
          minSimilarity: 0.5,
        });
        if (semanticHits.length > 0) {
          for (const hit of semanticHits) {
            lines.push(`- (Memori Semantik) ${hit.content}`);
          }
        }
      } catch (err) {
        // Abaikan error semantic search agar konteks utama tetap jalan
      }
    }

    if (lines.length === 0) return "";
    return `\n[Catatan Ingatan AI tentang User]:\n${lines.join("\n")}\n`;
  }

  /**
   * Ekstrak fakta penting (nama panggilan, musik favorit) secara otomatis & non-blocking.
   * @param {string} userId
   * @param {string} userMessage
   * @param {string} botReply
   */
  static async extractAndSave(userId, userMessage = "", botReply = "") {
    if (!userId || !userMessage) return;

    try {
      let updated = false;
      const updates = {};

      // 1. Deteksi nama panggilan
      const nickMatch = userMessage.match(
        /(?:panggil\s+(?:aku|saya|gue|gw)\s+(?:sebagai\s+)?|nama(?:ku|saya)?\s+(?:adalah\s+)?|namaku\s+|call\s+me\s+)([a-zA-Z0-9_\-\u00C0-\u017F]{2,25})/i,
      );
      if (nickMatch && nickMatch[1]) {
        const rawNick = nickMatch[1].trim();
        if (!/^(naura|bot|kamu|dia|siapa|apa|kenapa)$/i.test(rawNick)) {
          updates.nickname = rawNick;
          updated = true;
        }
      }

      // 2. Deteksi preferensi musik
      const musicMatch = userMessage.match(
        /(?:suka\s+lagu|genre\s+favorit(?:ku)?|musik\s+favorit(?:ku)?|lagu\s+favorit(?:ku)?|suka\s+musik)\s+([a-zA-Z0-9\s,\-]+)/i,
      );
      if (musicMatch && musicMatch[1]) {
        const musicItem = musicMatch[1].trim();
        if (musicItem.length >= 3 && musicItem.length <= 40) {
          let existingPrefs = [];
          if (
            mongoManager.isReady ||
            typeof mongoManager.getAiMemory === "function"
          ) {
            const current = await mongoManager.getAiMemory(userId);
            if (current && Array.isArray(current.musicPrefs)) {
              existingPrefs = current.musicPrefs;
            }
          }
          if (!existingPrefs.includes(musicItem)) {
            updates.musicPrefs = [...existingPrefs, musicItem].slice(-5);
            updated = true;
          }
        }
      }

      if (!updated) return;

      // Simpan ke MongoDB jika terhubung
      if (
        mongoManager.isReady ||
        typeof mongoManager.saveAiMemory === "function"
      ) {
        await mongoManager.saveAiMemory(userId, updates);
      }

      // Update cache di Redis
      if (redisManager.isReady) {
        const currentCache =
          (await redisManager.getCache(`ai:memory:obj:${userId}`)) || {};
        const merged = { ...currentCache, ...updates };
        await redisManager.setCache(
          `ai:memory:obj:${userId}`,
          merged,
          MEMORY_TTL_SECONDS,
        );
      }

      // 3. Simpan memori semantik jangka panjang jika ada pernyataan personal
      const personalFactMatch = userMessage.match(
        /(?:aku|saya|gue|gw)\s+(?:suka|hobi|tinggal di|alergi|pengen|cita-cita|kerja sebagai)\s+([^.!?\n]+)/i,
      );
      if (personalFactMatch) {
        const factContent = `Pengguna ${personalFactMatch[0].trim()}`;
        try {
          const { service } = require("./semanticMemoryService");
          await service.saveMemory(userId, factContent, {
            memoryType: "USER_FACT",
          });
        } catch (_) {}
      }
    } catch (e) {
      logger.warn(
        `[AIMemory] Ekstraksi fakta gagal untuk user ${userId}:`,
        e.message,
      );
    }
  }

  /**
   * Menyimpan atau menambahkan ringkasan memori AI
   * @param {string} userId
   * @param {string} summary
   */
  static async appendMemory(userId, summary) {
    if (!userId || !summary) return;

    try {
      if (
        mongoManager.isReady ||
        typeof mongoManager.saveAiMemory === "function"
      ) {
        await mongoManager.saveAiMemory(userId, { summary });
      }
      if (redisManager.isReady) {
        await redisManager.setCache(
          `ai:memory:${userId}`,
          summary,
          MEMORY_TTL_SECONDS,
        );
        const obj =
          (await redisManager.getCache(`ai:memory:obj:${userId}`)) || {};
        obj.summary = summary;
        await redisManager.setCache(
          `ai:memory:obj:${userId}`,
          obj,
          MEMORY_TTL_SECONDS,
        );
      }
    } catch (e) {
      logger.warn(
        `[AIMemory] Gagal menyimpan memori untuk user ${userId}:`,
        e.message,
      );
    }
  }

  /**
   * Kompresi riwayat chat jika sudah panjang, lalu ekstrak poin pentingnya
   * @param {object} geminiClient
   * @param {Array} historyArray
   * @param {string} userId
   * @returns {Promise<Array>}
   */
  static async compressHistoryIfNeeded(geminiClient, historyArray, userId) {
    if (!historyArray || historyArray.length < 20) return historyArray;

    try {
      const toSummarize = historyArray.slice(0, 10);
      const remainder = historyArray.slice(10);

      const conversationText = toSummarize
        .map(
          (msg) =>
            `${msg.role}: ${msg.parts?.map((p) => p.text).join(" ") || ""}`,
        )
        .join("\n");

      const prompt = `Rangkum poin-poin penting dari percakapan berikut dalam 2-3 kalimat singkat. Fokus pada preferensi user, nama, atau detail penting lainnya. Jika tidak ada yang penting, balas dengan "TIDAK_ADA_YANG_PENTING".\n\nPercakapan:\n${conversationText}`;

      const responseText = await geminiClient.generate({
        parts: [{ text: prompt }],
      });

      if (responseText && !responseText.includes("TIDAK_ADA_YANG_PENTING")) {
        let existingSummary = "";
        if (mongoManager.isReady) {
          const doc = await mongoManager.getAiMemory(userId);
          existingSummary = doc?.summary || "";
        } else if (redisManager.isReady) {
          existingSummary =
            (await redisManager.getCache(`ai:memory:${userId}`)) || "";
        }

        let newSummary = existingSummary
          ? `${existingSummary} | ${responseText}`
          : responseText;

        if (newSummary.length > 800) {
          newSummary = newSummary.substring(newSummary.length - 800);
        }

        await this.appendMemory(userId, newSummary);
      }

      return remainder;
    } catch (e) {
      logger.warn(`[AIMemory] Gagal kompresi histori:`, e.message);
      return historyArray.slice(-10);
    }
  }
}

module.exports = AIMemory;
