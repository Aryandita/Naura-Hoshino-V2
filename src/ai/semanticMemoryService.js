"use strict";

/**
 * @file semanticMemoryService.js
 * @description Service pengelola memori semantik berbasis embedding dan vector search.
 * Mendukung penyimpanan memori episodik user, aturan server, serta retrieval context untuk LLM.
 */

const SemanticMemory = require("../models/SemanticMemory");
const geminiClient = require("./geminiClient");
const { logger } = require("../managers/logger");

const EMBEDDING_MODEL = "text-embedding-004";

/**
 * Menghitung cosine similarity antara dua vektor float murni (Law 5: Pure Calculation)
 * @param {number[]} vecA
 * @param {number[]} vecB
 * @returns {number} Nilai cosine similarity antara -1.0 s.d. 1.0
 */
function cosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || !Array.isArray(vecA) || !Array.isArray(vecB)) return 0;
  if (vecA.length !== vecB.length || vecA.length === 0) return 0;

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < vecA.length; i++) {
    const valA = vecA[i];
    const valB = vecB[i];
    dotProduct += valA * valB;
    normA += valA * valA;
    normB += valB * valB;
  }

  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

class SemanticMemoryService {
  /**
   * Menghasilkan representasi vector embedding dari teks menggunakan Gemini API
   * @param {string} text - Teks yang akan di-embed
   * @returns {Promise<number[]|null>} Array angka embedding atau null jika gagal
   */
  async generateEmbedding(text) {
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return null;
    }

    const client = geminiClient.getClient();
    if (!client) {
      return null;
    }

    try {
      const response = await client.models.embedContent({
        model: EMBEDDING_MODEL,
        contents: text.trim(),
      });

      if (response && response.embedding && Array.isArray(response.embedding.values)) {
        return response.embedding.values;
      }
      return null;
    } catch (err) {
      logger.warn(`[SemanticMemory] Gagal generate embedding: ${err.message}`);
      return null;
    }
  }

  /**
   * Simpan memori semantik baru ke database
   * @param {string} userId - ID pengguna Discord
   * @param {string} content - Konten teks memori
   * @param {object} [options]
   * @param {string} [options.guildId] - ID guild (opsional)
   * @param {string} [options.memoryType="USER_FACT"] - Tipe memori (USER_FACT, SERVER_RULE, LORE)
   * @param {object} [options.metadata={}] - Data tambahan
   * @returns {Promise<SemanticMemory|null>}
   */
  async saveMemory(userId, content, options = {}) {
    if (!userId || !content || typeof content !== "string") {
      return null;
    }

    const { guildId = null, memoryType = "USER_FACT", metadata = {} } = options;
    const cleanContent = content.trim();

    try {
      // 1. Generate vector embedding
      const embedding = await this.generateEmbedding(cleanContent);

      // 2. Simpan ke database Sequelize
      const record = await SemanticMemory.create({
        userId,
        guildId,
        memoryType,
        content: cleanContent,
        embedding,
        metadata,
      });

      logger.info(
        `[SemanticMemory] Berhasil mencatat memori (${memoryType}) untuk user ${userId}.`,
      );
      return record;
    } catch (err) {
      logger.error(`[SemanticMemory] Gagal menyimpan memori: ${err.message}`);
      return null;
    }
  }

  /**
   * Cari memori yang paling relevan secara semantik terhadap query
   * @param {string} query - Kalimat pertanyaan / konteks pengguna
   * @param {object} [filter]
   * @param {string} [filter.userId] - Batasi pada user tertentu
   * @param {string} [filter.guildId] - Batasi pada guild tertentu
   * @param {string} [filter.memoryType] - Batasi pada tipe memori
   * @param {number} [filter.limit=3] - Jumlah maksimal memori yang dikembalikan
   * @param {number} [filter.minSimilarity=0.45] - Ambang batas minimal relevansi
   * @returns {Promise<Array<{ content: string, memoryType: string, similarity: number }>>}
   */
  async searchMemories(query, filter = {}) {
    if (!query || typeof query !== "string") {
      return [];
    }

    const {
      userId,
      guildId,
      memoryType,
      limit = 3,
      minSimilarity = 0.45,
    } = filter;

    try {
      const whereClause = {};
      if (userId) whereClause.userId = userId;
      if (guildId) whereClause.guildId = guildId;
      if (memoryType) whereClause.memoryType = memoryType;

      const records = await SemanticMemory.findAll({
        where: whereClause,
        order: [["id", "DESC"]],
        limit: 100, // Ambil sampel 100 memori terbaru untuk dievaluasi
      });

      if (records.length === 0) {
        return [];
      }

      // Generate embedding untuk query pencarian
      const queryEmbedding = await this.generateEmbedding(query);

      // Jika query embedding berhasil didapat, hitung cosine similarity
      if (queryEmbedding && Array.isArray(queryEmbedding)) {
        const scored = [];

        for (const record of records) {
          const recVec = record.embedding;
          if (!recVec || !Array.isArray(recVec)) continue;

          const similarity = cosineSimilarity(queryEmbedding, recVec);
          if (similarity >= minSimilarity) {
            scored.push({
              id: record.id,
              content: record.content,
              memoryType: record.memoryType,
              similarity,
              createdAt: record.createdAt,
            });
          }
        }

        // Urutkan berdasarkan similarity tertinggi
        scored.sort((a, b) => b.similarity - a.similarity);
        return scored.slice(0, limit);
      }

      // Fallback: Jika embedding API tidak tersedia, kembalikan memori terbaru
      return records.slice(0, limit).map((r) => ({
        id: r.id,
        content: r.content,
        memoryType: r.memoryType,
        similarity: 1.0,
        createdAt: r.createdAt,
      }));
    } catch (err) {
      logger.error(`[SemanticMemory] Gagal mencari memori semantik: ${err.message}`);
      return [];
    }
  }

  /**
   * Format daftar memori hasil pencarian menjadi blok teks konteks siap pakai untuk LLM
   * @param {Array<{ content: string, memoryType: string }>} memories
   * @returns {string}
   */
  formatMemoriesForContext(memories) {
    if (!Array.isArray(memories) || memories.length === 0) {
      return "";
    }

    const lines = ["[MEMORI & FAKTA PENGGUNA TERSIMPAN DI DATABASE]"];
    for (const item of memories) {
      lines.push(`- (${item.memoryType}) ${item.content}`);
    }
    lines.push(
      "Gunakan informasi di atas secara natural bila relevan dengan percakapan.",
    );
    return lines.join("\n");
  }

  /**
   * Nightly Reflection: Mensintesis riwayat aktivitas & interaksi harian menjadi memori semantik jangka panjang.
   * Dipicu setiap malam via cronManager untuk memperkaya Living AI Naura.
   */
  async synthesizeDailyMemories() {
    try {
      const mongoManager = require("../managers/mongoManager");
      if (!mongoManager.isReady) {
        logger.info("[SemanticMemory] MongoDB offline, melewatkan sintesis nightly memory.");
        return { count: 0 };
      }

      // Ambil 50 log interaksi terbaru 24 jam terakhir
      const recentLogs = await mongoManager.getCommandAuditLogs({}, 50).catch(() => []);
      if (!recentLogs || recentLogs.length === 0) {
        return { count: 0 };
      }

      // Kelompokkan berdasarkan userId
      const userLogsMap = new Map();
      for (const log of recentLogs) {
        if (!log.userId) continue;
        if (!userLogsMap.has(log.userId)) userLogsMap.set(log.userId, []);
        userLogsMap.get(log.userId).push(log.commandName || "command");
      }

      let synthesizedCount = 0;
      for (const [userId, commands] of userLogsMap.entries()) {
        const topCommands = [...new Set(commands)].slice(0, 3).join(", ");
        const reflectionContent = `Pengguna aktif berinteraksi dengan fitur: ${topCommands}. Menunjukkan ketertarikan tinggi pada aktivitas ekosistem bot.`;

        await this.storeMemory({
          userId,
          content: reflectionContent,
          memoryType: "reflection",
        }).catch(() => {});

        synthesizedCount++;
      }

      logger.success(`[SemanticMemory] Berhasil melakukan nightly reflection untuk ${synthesizedCount} petualang aktif.`);
      return { count: synthesizedCount };
    } catch (err) {
      logger.error(`[SemanticMemory] Gagal mengeksekusi nightly reflection: ${err.message}`);
      return { count: 0, error: err.message };
    }
  }
}

module.exports = {
  SemanticMemoryService,
  cosineSimilarity,
  service: new SemanticMemoryService(),
};
