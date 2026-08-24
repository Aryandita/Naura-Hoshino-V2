"use strict";

const dns = require("dns");
const mongoose = require("mongoose");
const env = require("../config/env");
const { logger } = require("./logger");

// Setup fallback DNS publik untuk mencegah querySrv ECONNREFUSED di Windows/ISP tertentu
try {
  dns.setServers(["8.8.8.8", "1.1.1.1", "8.8.4.4"]);
} catch (dnsErr) {
  // Safe fallback
}

// Import model-model MongoDB
const TicketTranscript = require("../models/mongo/TicketTranscript");
const AiChatHistory = require("../models/mongo/AiChatHistory");
const CommandAuditLog = require("../models/mongo/CommandAuditLog");
const AiMemory = require("../models/mongo/AiMemory");
const UserRoom = require("../models/mongo/UserRoom");
const TimeCapsule = require("../models/mongo/TimeCapsule");

class MongoManager {
  constructor() {
    this.models = {
      TicketTranscript,
      AiChatHistory,
      CommandAuditLog,
      AiMemory,
      UserRoom,
      TimeCapsule,
    };
    this._isConnecting = false;
    this._setupListeners();
  }

  _setupListeners() {
    mongoose.connection.on("connected", () => {
      logger.success("[MongoDB] Terhubung ke MongoDB Atlas Cloud.");
    });

    mongoose.connection.on("error", (err) => {
      logger.error("[MongoDB] Error koneksi:", err.message);
    });

    mongoose.connection.on("disconnected", () => {
      logger.warn("[MongoDB] Koneksi terputus dari MongoDB Atlas.");
    });

    mongoose.connection.on("reconnected", () => {
      logger.success("[MongoDB] Berhasil terhubung kembali ke MongoDB Atlas.");
    });
  }

  /** Status kesiapan koneksi MongoDB (1 = connected). */
  get isReady() {
    return mongoose.connection.readyState === 1;
  }

  /**
   * Menghubungkan ke MongoDB Atlas menggunakan MONGODB_URI dari env.js
   * @returns {Promise<boolean>}
   */
  async connect() {
    const uri = env.MONGODB_URI;
    if (!uri) {
      logger.warn(
        "[MongoDB] MONGODB_URI tidak dikonfigurasi di .env. Modul MongoDB dinonaktifkan.",
      );
      return false;
    }

    if (this.isReady || this._isConnecting) return true;

    try {
      this._isConnecting = true;
      await mongoose.connect(uri, {
        serverSelectionTimeoutMS: 15000,
        socketTimeoutMS: 45000,
        maxPoolSize: 20,
        minPoolSize: 2,
        autoIndex: true,
      });
      this._isConnecting = false;
      return true;
    } catch (error) {
      this._isConnecting = false;
      logger.error(
        "[MongoDB] Gagal terhubung ke MongoDB Atlas:",
        error.message,
      );
      return false;
    }
  }

  /**
   * Menutup koneksi MongoDB secara aman (Graceful Shutdown)
   */
  async disconnect() {
    if (mongoose.connection.readyState !== 0) {
      try {
        await mongoose.disconnect();
        logger.info("[MongoDB] Koneksi MongoDB ditutup dengan aman.");
      } catch (error) {
        logger.error("[MongoDB] Gagal menutup koneksi MongoDB:", error.message);
      }
    }
  }

  /**
   * Status detail koneksi MongoDB
   */
  getStatus() {
    const states = ["disconnected", "connected", "connecting", "disconnecting"];
    return {
      state: states[mongoose.connection.readyState] || "unknown",
      readyState: mongoose.connection.readyState,
      host: mongoose.connection.host || null,
      name: mongoose.connection.name || null,
      models: Object.keys(this.models),
    };
  }

  // ==========================================
  // 🎫 1. TICKET & MODMAIL TRANSCRIPT APIS
  // ==========================================

  /**
   * Simpan arsip transkrip tiket
   * @param {Object} transcriptData
   */
  async saveTicketTranscript(transcriptData) {
    if (!this.isReady) return null;
    try {
      const { ticketId } = transcriptData;
      return await TicketTranscript.findOneAndUpdate(
        { ticketId },
        {
          ...transcriptData,
          totalMessages: transcriptData.messages?.length || 0,
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      logger.error("[MongoDB] Gagal menyimpan transkrip tiket:", error.message);
      return null;
    }
  }

  /**
   * Ambil data transkrip tiket berdasarkan ticketId
   * @param {string} ticketId
   */
  async getTicketTranscript(ticketId) {
    if (!this.isReady) return null;
    try {
      return await TicketTranscript.findOne({ ticketId }).lean();
    } catch (error) {
      logger.error("[MongoDB] Gagal membaca transkrip tiket:", error.message);
      return null;
    }
  }

  // ==========================================
  // 🤖 2. AI CONVERSATION HISTORY APIS
  // ==========================================

  /**
   * Simpan riwayat interaksi percakapan AI
   * @param {Object} aiData
   */
  async saveAiMessage(aiData) {
    if (!this.isReady) return null;
    try {
      return await AiChatHistory.create(aiData);
    } catch (error) {
      logger.error("[MongoDB] Gagal menyimpan histori AI:", error.message);
      return null;
    }
  }

  /**
   * Ambil histori percakapan AI untuk memori konteks
   * @param {string} userId
   * @param {string} channelId
   * @param {number} limit
   */
  async getAiHistory(userId, channelId, limit = 20) {
    if (!this.isReady) return [];
    try {
      const records = await AiChatHistory.find({ userId, channelId })
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
      return records.reverse(); // Urutan kronologis lama -> baru
    } catch (error) {
      logger.error("[MongoDB] Gagal mengambil histori AI:", error.message);
      return [];
    }
  }

  /**
   * Hapus histori percakapan AI
   * @param {string} userId
   * @param {string} channelId
   */
  async clearAiHistory(userId, channelId) {
    if (!this.isReady) return false;
    try {
      await AiChatHistory.deleteMany({ userId, channelId });
      return true;
    } catch (error) {
      logger.error("[MongoDB] Gagal menghapus histori AI:", error.message);
      return false;
    }
  }

  // ==========================================
  // 📊 3. COMMAND AUDIT LOG APIS
  // ==========================================

  /**
   * Catat log audit pemakaian command
   * @param {Object} logData
   */
  async logCommand(logData) {
    if (!this.isReady) return null;
    try {
      return await CommandAuditLog.create(logData);
    } catch (error) {
      logger.error("[MongoDB] Gagal mencatat command audit log:", error.message);
      return null;
    }
  }

  /**
   * Ambil log audit command berdasarkan filter
   * @param {Object} filter
   * @param {number} limit
   */
  async getCommandAuditLogs(filter = {}, limit = 50) {
    if (!this.isReady) return [];
    try {
      return await CommandAuditLog.find(filter)
        .sort({ createdAt: -1 })
        .limit(limit)
        .lean();
    } catch (error) {
      logger.error("[MongoDB] Gagal mengambil command audit logs:", error.message);
      return [];
    }
  }

  // ==========================================
  // 🧠 4. AI PERSISTENT MEMORY APIS
  // ==========================================

  /**
   * Simpan atau perbarui memori AI jangka panjang untuk user
   * @param {string} userId
   * @param {Object} memoryData
   */
  async saveAiMemory(userId, memoryData) {
    if (!this.isReady || !userId) return null;
    try {
      return await AiMemory.findOneAndUpdate(
        { userId },
        {
          ...memoryData,
          userId,
          lastInteraction: new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true },
      );
    } catch (error) {
      logger.error("[MongoDB] Gagal menyimpan AiMemory:", error.message);
      return null;
    }
  }

  /**
   * Ambil data memori AI user
   * @param {string} userId
   */
  async getAiMemory(userId) {
    if (!this.isReady || !userId) return null;
    try {
      return await AiMemory.findOne({ userId }).lean();
    } catch (error) {
      logger.error("[MongoDB] Gagal mengambil AiMemory:", error.message);
      return null;
    }
  }
}

module.exports = new MongoManager();
