"use strict";

/**
 * @file serverLoreService.js
 * @description Blueprint Sistem Ingatan Budaya & Sejarah Server (Server Lore RAG).
 * Diarsipkan di pending_plugin untuk menghemat kuota embedding vector free-tier.
 */

class ServerLoreService {
  constructor() {
    this.memoryIndex = new Map();
  }

  /**
   * Mengindeks potongan sejarah atau budaya server.
   * @param {string} guildId
   * @param {string} topic
   * @param {string} content
   * @returns {Promise<{ success: boolean, loreId: string }>}
   */
  async indexLoreEntry(guildId, topic, content) {
    const loreId = `lore_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const entry = {
      loreId,
      guildId,
      topic,
      content,
      createdAt: new Date().toISOString(),
    };

    if (!this.memoryIndex.has(guildId)) {
      this.memoryIndex.set(guildId, []);
    }
    this.memoryIndex.get(guildId).push(entry);

    return { success: true, loreId };
  }

  /**
   * Mengambil konteks lore server terdekat berdasarkan kata kunci.
   * @param {string} guildId
   * @param {string} query
   * @returns {Promise<Array<Object>>}
   */
  async searchLore(guildId, query) {
    const entries = this.memoryIndex.get(guildId) || [];
    const qLower = String(query).toLowerCase();

    return entries.filter(
      (e) =>
        e.topic.toLowerCase().includes(qLower) ||
        e.content.toLowerCase().includes(qLower),
    );
  }
}

module.exports = new ServerLoreService();
