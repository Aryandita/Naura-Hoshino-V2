"use strict";

const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");

class KnowledgeBase {
  constructor() {
    this.keyPrefix = "ai_kb:";
  }

  /**
   * Split text into overlapping or paragraph chunks
   * @param {string} text
   * @param {number} chunkSize
   * @returns {string[]}
   */
  _chunkText(text, chunkSize = 400) {
    if (!text || typeof text !== "string") return [];
    const paragraphs = text.split(/\n\s*\n/);
    const chunks = [];

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (!trimmed) continue;
      if (trimmed.length <= chunkSize) {
        chunks.push(trimmed);
      } else {
        // Subdivide long paragraphs
        const sentences = trimmed.split(/(?<=[.!?])\s+/);
        let current = "";
        for (const sentence of sentences) {
          if (
            (current + " " + sentence).length > chunkSize &&
            current.length > 0
          ) {
            chunks.push(current.trim());
            current = sentence;
          } else {
            current = current ? current + " " + sentence : sentence;
          }
        }
        if (current.trim()) chunks.push(current.trim());
      }
    }

    return chunks;
  }

  /**
   * Add knowledge content for a guild
   * @param {string} guildId
   * @param {string} title
   * @param {string} content
   * @returns {Promise<number>} Number of chunks added
   */
  async addKnowledge(guildId, title, content) {
    if (!guildId || !content) return 0;
    try {
      const chunks = this._chunkText(content);
      const key = `${this.keyPrefix}${guildId}`;

      let currentData = [];
      const existing = await redisManager.getCache(key);
      if (existing) {
        currentData =
          typeof existing === "string" ? JSON.parse(existing) : existing;
      }

      const newEntries = chunks.map((chunk, idx) => ({
        id: `${Date.now()}_${idx}`,
        title: title || "Dokumen Server",
        text: chunk,
        keywords: this._extractKeywords(chunk),
        createdAt: new Date().toISOString(),
      }));

      const combined = [...currentData, ...newEntries];
      // Simpan maksimal 50 chunks per guild
      const trimmed = combined.slice(-50);
      await redisManager.setCache(key, JSON.stringify(trimmed), 86400 * 30); // 30 days TTL
      return newEntries.length;
    } catch (e) {
      logger.error(
        `[KnowledgeBase] Gagal menambahkan knowledge untuk guild ${guildId}:`,
        e,
      );
      return 0;
    }
  }

  _extractKeywords(text) {
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);
  }

  /**
   * Cari potongan knowledge yang paling relevan dengan pertanyaan user
   * @param {string} guildId
   * @param {string} query
   * @param {number} topK
   * @returns {Promise<Array<{title: string, text: string, score: number}>>}
   */
  async searchKnowledge(guildId, query, topK = 3) {
    if (!guildId || !query) return [];
    try {
      const key = `${this.keyPrefix}${guildId}`;
      const existing = await redisManager.getCache(key);
      if (!existing) return [];

      const data =
        typeof existing === "string" ? JSON.parse(existing) : existing;
      if (!Array.isArray(data) || data.length === 0) return [];

      const queryKeywords = this._extractKeywords(query);
      if (queryKeywords.length === 0) return data.slice(0, topK);

      const scored = data.map((item) => {
        let score = 0;
        const itemLower = item.text.toLowerCase();
        for (const word of queryKeywords) {
          if (itemLower.includes(word)) {
            score += 1;
          }
        }
        return { ...item, score };
      });

      return scored
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
    } catch (e) {
      logger.error(
        `[KnowledgeBase] Gagal mencari knowledge untuk guild ${guildId}:`,
        e,
      );
      return [];
    }
  }

  /**
   * Format hasil knowledge ke string konteks prompt
   * @param {string} guildId
   * @param {string} query
   * @returns {Promise<string>}
   */
  async getKnowledgeContext(guildId, query) {
    if (!guildId) return "";
    const relevant = await this.searchKnowledge(guildId, query, 3);
    if (relevant.length === 0) return "";

    const contextList = relevant
      .map((r, i) => `[Dokumen ${i + 1}: ${r.title}]\n${r.text}`)
      .join("\n\n");

    return `\n--- INFORMASI RESMI & PERATURAN SERVER ---\nGunakan informasi berikut untuk menjawab pertanyaan jika relevan:\n${contextList}\n--- AKHIR INFORMASI SERVER ---\n`;
  }

  /**
   * Hapus seluruh data knowledge guild
   */
  async clearKnowledge(guildId) {
    if (!guildId) return;
    await redisManager.deleteCache(`${this.keyPrefix}${guildId}`);
  }

  /**
   * List judul dokumen tersimpan di guild
   */
  async listKnowledge(guildId) {
    if (!guildId) return [];
    const key = `${this.keyPrefix}${guildId}`;
    const existing = await redisManager.getCache(key);
    if (!existing) return [];
    const data = typeof existing === "string" ? JSON.parse(existing) : existing;
    const uniqueTitles = Array.from(new Set(data.map((d) => d.title)));
    return uniqueTitles;
  }
}

module.exports = new KnowledgeBase();
