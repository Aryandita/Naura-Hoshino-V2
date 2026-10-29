"use strict";

/**
 * @module semanticMemoryService
 * @description Service pengelola memori semantik berbasis embedding dan vector search untuk Naura Hoshino V2.
 *
 * ## Architecture Overview
 * Modul ini mengimplementasikan sistem memori semantik (RAG - Retrieval Augmented Generation)
 * yang memungkinkan AI Naura mengingat fakta pengguna, aturan server, dan lore secara persisten.
 * Menggunakan Gemini text-embedding-004 untuk menghasilkan vektor embedding, kemudian
 * menyimpannya di PostgreSQL via Sequelize. Pencarian menggunakan cosine similarity
 * untuk menemukan memori yang paling relevan secara semantik terhadap query pengguna.
 *
 * ## Key Features
 * - Vector embedding generation menggunakan Gemini text-embedding-004
 * - Cosine similarity search untuk semantic retrieval (pure function, Law 5)
 * - Multi-type memory support: USER_FACT, SERVER_RULE, LORE, reflection
 * - Document ingestion pipeline untuk Server RAG (chunked document parsing)
 * - Nightly reflection synthesis dari audit log MongoDB
 * - Duplicate memory pruning dengan cosine similarity threshold
 * - Age-based memory cleanup (maxAgeDays dengan importance score protection)
 * - Graceful fallback saat embedding API tidak tersedia (return newest memories)
 * - Document management: list, purge by filename
 * - Context formatting untuk LLM prompt injection
 *
 * ## Integration Points
 * - {@link module:models/SemanticMemory} - Sequelize model untuk storage vektor
 * - {@link module:ai/geminiClient} - Gemini API client untuk embedding generation
 * - {@link module:managers/logger} - Structured logging
 * - {@link module:managers/mongoManager} - MongoDB audit logs untuk nightly reflection
 * - {@link module:ai/documentParser} - Document parsing untuk RAG ingestion
 */

// ============================================================================
// CONSTANTS
// ============================================================================

const SemanticMemory = require("../models/SemanticMemory");
const geminiClient = require("./geminiClient");
const { logger } = require("../managers/logger");

const EMBEDDING_MODEL = "text-embedding-004";

// ============================================================================
// PURE FUNCTIONS (Law 5: Stateless Calculations)
// ============================================================================

/**
 * Menghitung cosine similarity antara dua vektor float murni (Law 5: Pure Calculation).
 * Digunakan untuk mengukur kemiripan semantik antara embedding query dan embedding memori.
 *
 * Algoritma:
 * 1. Hitung dot product kedua vektor
 * 2. Hitung magnitude (norm) masing-masing vektor
 * 3. Return dot / (normA * normB)
 *
 * @param {number[]} vecA - Vektor pertama
 * @param {number[]} vecB - Vektor kedua
 * @returns {number} Nilai cosine similarity antara -1.0 s.d. 1.0, atau 0 jika invalid
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

// ============================================================================
// CLASS: SemanticMemoryService
// ============================================================================

/**
 * Service utama untuk operasi memori semantik: simpan, cari, format, ingest, dan prune.
 * Menggunakan Gemini embedding API untuk vektorisasi dan cosine similarity untuk pencarian.
 */
class SemanticMemoryService {
  /**
   * Menghasilkan representasi vector embedding dari teks menggunakan Gemini API
   * @param {string} text - Teks yang akan di-embed
   * @returns {Promise<number[]|null>} Array angka embedding atau null jika gagal
   */
  // ==========================================================================
  // PUBLIC METHODS
  // ==========================================================================

  /**
   * Menghasilkan representasi vector embedding dari teks menggunakan Gemini API.
   * Model: text-embedding-004 (768 dimensi).
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
   * Simpan memori semantik baru ke database.
   * Alur: generate embedding -> simpan ke Sequelize dengan vektor.
   * @param {string} userId - ID pengguna Discord
   * @param {string} content - Konten teks memori
   * @param {object} [options]
   * @param {string} [options.guildId] - ID guild (opsional)
   * @param {string} [options.memoryType="USER_FACT"] - Tipe memori (USER_FACT, SERVER_RULE, LORE)
   * @param {object} [options.metadata={}] - Data tambahan (fileName, chunkIndex, dll)
   * @returns {Promise<SemanticMemory|null>} Record yang tersimpan atau null jika gagal
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
   * Cari memori yang paling relevan secara semantik terhadap query.
   *
   * Alur pencarian:
   * 1. Ambil sampel 100 memori terbaru dari DB (filtered by userId/guildId/type)
   * 2. Generate embedding untuk query
   * 3. Hitung cosine similarity query vs setiap memori
   * 4. Filter hasil >= minSimilarity, sort descending, slice top-N
   * 5. Fallback: jika embedding API gagal, kembalikan memori terbaru
   *
   * @param {string} query - Kalimat pertanyaan / konteks pengguna
   * @param {object} [filter]
   * @param {string} [filter.userId] - Batasi pada user tertentu
   * @param {string} [filter.guildId] - Batasi pada guild tertentu
   * @param {string} [filter.memoryType] - Batasi pada tipe memori
   * @param {number} [filter.limit=3] - Jumlah maksimal memori yang dikembalikan
   * @param {number} [filter.minSimilarity=0.45] - Ambang batas minimal relevansi
   * @returns {Promise<Array<{id: number, content: string, memoryType: string, similarity: number, createdAt: Date}>>}
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
   * Format daftar memori hasil pencarian menjadi blok teks konteks siap pakai untuk LLM.
   * Output format: [MEMORI & FAKTA PENGGUNA TERSIMPAN DI DATABASE] dengan bullet points.
   * @param {Array<{content: string, memoryType: string}>} memories - Hasil dari searchMemories
   * @returns {string} Blok teks konteks atau empty string jika tidak ada memori
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
   * Nightly Reflection: Mensintesis riwayat aktivitas dan interaksi harian menjadi memori semantik jangka panjang.
   * Dipicu setiap malam via cronManager untuk memperkaya Living AI Naura.
   *
   * Alur:
   * 1. Ambil 50 log interaksi terbaru dari MongoDB (24 jam terakhir)
   * 2. Kelompokkan per userId, ambil top 3 command unik
   * 3. Sintesis refleksi tekstual per user
   * 4. Simpan sebagai memori tipe "reflection"
   *
   * @returns {Promise<{count: number, error?: string}>} Jumlah user yang direfleksikan
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

  /**
   * Ingest dokumen hasil parsing ke dalam memori semantik (Server RAG).
   * Setiap chunk dokumen di-embed dan disimpan sebagai memori terpisah dengan metadata fileName/chunkIndex.
   * @param {string} guildId - ID server Discord
   * @param {string} uploaderId - ID user pengunggah
   * @param {object} parsedDocument - Hasil dari documentParser.parseDocument (harus punya .chunks array)
   * @param {string} [memoryType="SERVER_RULE"] - Tipe memori untuk semua chunk
   * @returns {Promise<{success: boolean, fileName?: string, chunksIngested?: number, totalChunks?: number, reason?: string}>}
   */
  async ingestDocument(guildId, uploaderId, parsedDocument, memoryType = "SERVER_RULE") {
    if (!guildId || !parsedDocument || !Array.isArray(parsedDocument.chunks)) {
      return { success: false, reason: "INVALID_DOCUMENT" };
    }

    const chunks = parsedDocument.chunks;
    let ingested = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const record = await this.saveMemory(uploaderId, chunk, {
        guildId,
        memoryType,
        metadata: {
          fileName: parsedDocument.fileName,
          fileType: parsedDocument.fileType,
          chunkIndex: i,
          totalChunks: chunks.length,
        },
      });

      if (record) ingested++;
    }

    logger.success(
      `[SemanticMemory] Berhasil meng-ingest dokumen ${parsedDocument.fileName} (${ingested}/${chunks.length} chunks) untuk guild ${guildId}.`,
    );

    return {
      success: true,
      fileName: parsedDocument.fileName,
      chunksIngested: ingested,
      totalChunks: chunks.length,
    };
  }

  /**
   * Dapatkan daftar berkas dokumen pengetahuan yang terdaftar di guild.
   * Mengelompokkan record berdasarkan metadata.fileName dan menghitung chunk count.
   * @param {string} guildId - ID server Discord
   * @returns {Promise<Array<{fileName: string, fileType: string, chunkCount: number, updatedAt: Date}>>}
   */
  async listDocuments(guildId) {
    if (!guildId) return [];

    try {
      const records = await SemanticMemory.findAll({
        where: { guildId },
        attributes: ["metadata", "updatedAt"],
      });

      const docMap = new Map();
      for (const rec of records) {
        const meta =
          typeof rec.metadata === "string"
            ? JSON.parse(rec.metadata)
            : rec.metadata || {};
        const fn = meta.fileName;
        if (!fn) continue;

        if (!docMap.has(fn)) {
          docMap.set(fn, {
            fileName: fn,
            fileType: meta.fileType || "doc",
            chunkCount: 0,
            updatedAt: rec.updatedAt,
          });
        }
        const item = docMap.get(fn);
        item.chunkCount++;
        if (rec.updatedAt > item.updatedAt) item.updatedAt = rec.updatedAt;
      }

      return Array.from(docMap.values());
    } catch (err) {
      logger.error(`[SemanticMemory] Gagal membaca daftar dokumen: ${err.message}`);
      return [];
    }
  }

  /**
   * Hapus seluruh memori semantik yang berasal dari berkas dokumen tertentu.
   * Iterasi semua record guild, cek metadata.fileName, destroy yang cocok.
   * @param {string} guildId - ID server Discord
   * @param {string} fileName - Nama file dokumen yang akan dihapus memorinya
   * @returns {Promise<{success: boolean, deletedCount: number, error?: string}>}
   */
  async purgeDocument(guildId, fileName) {
    if (!guildId || !fileName) return { success: false, deletedCount: 0 };

    try {
      const allGuildRecords = await SemanticMemory.findAll({
        where: { guildId },
      });

      let deleted = 0;
      for (const rec of allGuildRecords) {
        const meta =
          typeof rec.metadata === "string"
            ? JSON.parse(rec.metadata)
            : rec.metadata || {};
        if (meta.fileName === fileName) {
          await rec.destroy();
          deleted++;
        }
      }

      logger.info(
        `[SemanticMemory] Berhasil menghapus ${deleted} memori untuk dokumen ${fileName} di guild ${guildId}.`,
      );
      return { success: true, deletedCount: deleted };
    } catch (err) {
      logger.error(`[SemanticMemory] Gagal menghapus memori dokumen: ${err.message}`);
      return { success: false, deletedCount: 0, error: err.message };
    }
  }

  /**
   * Pemangkasan memori vektor berkala: de-duplikasi dan pembersihan entri usang.
   *
   * Alur pruning:
   * 1. Hapus memori berusia > maxAgeDays dengan importanceScore < 5
   * 2. Kelompokkan memori per userId+memoryType
   * 3. Bandingkan pasangan vektor dalam kelompok (O(n^2))
   * 4. Jika similarity >= threshold, pertahankan yang importanceScore lebih tinggi
   * 5. Increment importanceScore entri yang dipertahankan (max 10)
   *
   * @param {number} [similarityThreshold=0.92] - Ambang batas kemiripan untuk dianggap duplikat
   * @param {number} [maxAgeDays=90] - Usia maksimum memori sebelum dihapus (kecuali high importance)
   * @returns {Promise<{prunedCount: number, duplicatesMerged: number, error?: string}>}
   */
  async pruneDuplicateMemories(similarityThreshold = 0.92, maxAgeDays = 90) {
    try {
      const allMemories = await SemanticMemory.findAll();
      if (!allMemories || allMemories.length === 0) {
        return { prunedCount: 0, duplicatesMerged: 0 };
      }

      const now = Date.now();
      const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
      let prunedCount = 0;
      let duplicatesMerged = 0;

      const userGroup = new Map();
      for (const mem of allMemories) {
        const age = now - new Date(mem.updatedAt || mem.createdAt).getTime();
        if (age > maxAgeMs && (mem.importanceScore || 0) < 5) {
          await mem.destroy().catch(() => {});
          prunedCount++;
          continue;
        }

        const key = `${mem.userId || "global"}_${mem.memoryType}`;
        if (!userGroup.has(key)) userGroup.set(key, []);
        userGroup.get(key).push(mem);
      }

      for (const [, list] of userGroup) {
        for (let i = 0; i < list.length; i++) {
          const itemA = list[i];
          if (!itemA || !itemA.embedding) continue;
          const vecA =
            typeof itemA.embedding === "string"
              ? JSON.parse(itemA.embedding)
              : itemA.embedding;

          for (let j = i + 1; j < list.length; j++) {
            const itemB = list[j];
            if (!itemB || !itemB.embedding) continue;
            const vecB =
              typeof itemB.embedding === "string"
                ? JSON.parse(itemB.embedding)
                : itemB.embedding;

            const sim = cosineSimilarity(vecA, vecB);
            if (sim >= similarityThreshold) {
              const toKeep =
                (itemA.importanceScore || 0) >= (itemB.importanceScore || 0)
                  ? itemA
                  : itemB;
              const toRemove = toKeep === itemA ? itemB : itemA;

              toKeep.importanceScore = Math.min(
                10,
                (toKeep.importanceScore || 1) + 1,
              );
              await toKeep
                .save({ fields: ["importanceScore"] })
                .catch(() => {});
              await toRemove.destroy().catch(() => {});

              duplicatesMerged++;
              list.splice(j, 1);
              j--;
            }
          }
        }
      }

      logger.info(
        `[SemanticMemory] Pruning selesai: ${duplicatesMerged} duplikat digabung, ${prunedCount} entri usang dibersihkan.`,
      );
      return { prunedCount, duplicatesMerged };
    } catch (err) {
      logger.error(
        `[SemanticMemory] Gagal melakukan memory pruning: ${err.message}`,
      );
      return { prunedCount: 0, duplicatesMerged: 0, error: err.message };
    }
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  SemanticMemoryService,
  cosineSimilarity,
  service: new SemanticMemoryService(),
};
