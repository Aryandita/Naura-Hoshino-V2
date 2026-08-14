const { GoogleGenerativeAI } = require("@google/generative-ai");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const env = require("../../src/config/env");
const cacheManager = require("../../src/managers/cacheManager");

// Ollama Client untuk fallback AI lokal
const { Ollama } = require("ollama");
const ollamaClient = new Ollama({ host: env.OLLAMA_BASE_URL });

class AIManager {
  constructor() {
    // Inisialisasi Gemini AI (Tetap digunakan khusus untuk membaca gambar/Vision)
    const geminiKeys = process.env.GEMINI_API_KEYS
      ? process.env.GEMINI_API_KEYS.split(",")
          .map((k) => k.trim())
          .filter(Boolean)
      : [process.env.GEMINI_API_KEY];

    this.apiKeys = geminiKeys;
    this.currentKeyIndex = 0;

    if (this.apiKeys.length > 0 && this.apiKeys[0]) {
      this.genAI = new GoogleGenerativeAI(this.apiKeys[0]);
    } else {
      logger.error(
        "\x1b[31m[💥 GEMINI ERROR]\x1b[0m GEMINI_API_KEY tidak ditemukan di .env",
      );
    }

    this.rotateKey = () => {
      if (this.apiKeys.length <= 1) return false;

      this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;
      this.genAI = new GoogleGenerativeAI(this.apiKeys[this.currentKeyIndex]);
      console.log(
        `\x1b[43m\x1b[30m 🔄 GEMINI FALLBACK \x1b[0m \x1b[33mBeralih ke API Key ke-${this.currentKeyIndex + 1}...\x1b[0m`,
      );
      return true;
    };
    this.model = this.genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      systemInstruction:
        "Nama kamu adalah Naura Hoshino, asisten Discord virtual yang ceria, ramah, dan sangat pintar. Kamu diciptakan dan dikelola oleh Aryandita. Kamu suka menggunakan emoji dalam setiap kalimat. Gunakan bahasa Indonesia yang santai, gaul, namun tetap sopan dan sangat membantu.",
    });

    // Memisahkan ruang memori: satu untuk Gemini (Gambar) dan satu untuk Verba (Teks)
    this.geminiSessions = new Map();
    this.verbaSessions = new Map();

    // Global AI Task Queue
    this.queue = [];
    this.isProcessingQueue = false;

    // TTL Cleanup loop (berjalan setiap 5 menit)
    setInterval(() => this.cleanupSessions(), 5 * 60 * 1000);
  }

  cleanupSessions() {
    const now = Date.now();
    // Bersihkan sesi Gemini
    for (const [userId, sessionData] of this.geminiSessions.entries()) {
      if (now - sessionData.lastAccess > 3600000) {
        this.geminiSessions.delete(userId);
      }
    }
    // Bersihkan sesi Verba
    for (const [userId, sessionData] of this.verbaSessions.entries()) {
      if (now - sessionData.lastAccess > 3600000) {
        this.verbaSessions.delete(userId);
      }
    }
  }

  async _processQueue() {
    if (this.queue.length === 0) {
      this.isProcessingQueue = false;
      return;
    }

    this.isProcessingQueue = true;
    const task = this.queue.shift();

    try {
      await this._executeMessage(
        task.message,
        task.prompt,
        task.isOwner,
        task.isPremium,
      );
    } catch (e) {
      logger.error("[AI Queue Error]", e);
    }

    // Delay 1.5 detik antar pesan AI untuk mencegah Error 429 dari Verba/Gemini
    setTimeout(() => {
      this._processQueue();
    }, 1500);
  }

  async handleMessage(message, prompt, isOwner = false, isPremium = false) {
    this.queue.push({ message, prompt, isOwner, isPremium });
    if (!this.isProcessingQueue) {
      this._processQueue();
    }
  }

  async _executeMessage(message, prompt, isOwner, isPremium) {
    const userId = message.author.id;

    try {
      // Indikator bot sedang "mengetik" di Discord
      await message.channel.sendTyping();

      // Cek apakah ada attachment gambar
      let attachment = message.attachments.find(
        (a) => a.contentType && a.contentType.startsWith("image/"),
      );
      if (!attachment && message.reference) {
        try {
          const referencedMsg = await message.channel.messages.fetch(
            message.reference.messageId,
          );
          attachment = referencedMsg.attachments.find(
            (a) => a.contentType && a.contentType.startsWith("image/"),
          );
        } catch (e) {
          /* ignore error fetch reply */
        }
      }

      let responseText = "";

      // ==========================================
      // LOGIKA 1: JIKA ADA GAMBAR -> PAKA GEMINI
      // ==========================================
      if (attachment) {
        if (!this.geminiSessions.has(userId)) {
          const chatSession = this.model.startChat({
            history: [],
            generationConfig: { maxOutputTokens: 1500 },
          });
          this.geminiSessions.set(userId, {
            chat: chatSession,
            lastAccess: Date.now(),
          });
        }

        const sessionData = this.geminiSessions.get(userId);
        sessionData.lastAccess = Date.now();
        const chat = sessionData.chat;

        try {
          const res = await fetch(attachment.url);
          const arrayBuffer = await res.arrayBuffer();
          const buffer = Buffer.from(arrayBuffer);

          const messageParts = [
            prompt || "Tolong jelaskan gambar ini.",
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: attachment.contentType,
              },
            },
          ];

          const result = await chat.sendMessage(messageParts);
          responseText = result.response.text();
        } catch (e) {
          logger.error("Gagal memproses gambar untuk Vision:", e);
          responseText = `${ui.emojis?.error || "❌"} Aduh, Naura gagal melihat gambarnya. Coba kirim ulang ya!`;
        }
      }
      // ==========================================
      // LOGIKA 2: JIKA MURNI TEKS -> PAKAI VERBA API
      // ==========================================
      else {
        let characterSlug =
          process.env.VERBA_SLUG_GENERAL ||
          process.env.VERBA_CHARACTER_SLUG ||
          "naura";
        let roleInfo = "Member Biasa";
        if (isOwner) {
          characterSlug =
            process.env.VERBA_SLUG_OWNER ||
            process.env.VERBA_CHARACTER_SLUG ||
            "naura";
          roleInfo = "Owner/Developer";
        } else if (isPremium) {
          characterSlug =
            process.env.VERBA_SLUG_PREMIUM ||
            process.env.VERBA_CHARACTER_SLUG ||
            "naura";
          roleInfo = "Premium Member";
        }

        try {
          const requestBody = {
            character: characterSlug,
            messages: [{ role: "user", content: prompt }],
          };

          // Ambil memori Verba jika ada
          if (this.verbaSessions.has(userId)) {
            requestBody.session_id = this.verbaSessions.get(userId).sessionId;
          }

          const response = await fetch("https://api.verba.ink/v1/response", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${require("../../src/config/env").VERBA_API_KEY}`,
              "Content-Type": "application/json",
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            },
            body: JSON.stringify(requestBody),
          });

          const textResponse = await response.text();
          if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
              const errorData = JSON.parse(textResponse);
              errorMessage =
                errorData.error?.message || errorData.message || errorMessage;
            } catch (e) {
              errorMessage = `${errorMessage} - Non-JSON response`;
            }
            throw new Error(`Verba API error: ${errorMessage}`);
          }

          let data;
          try {
            data = JSON.parse(textResponse);
          } catch (err) {
            throw new Error(
              `Invalid JSON response dari Verba API (HTTP ${response.status})`,
            );
          }

          // Update memori Verba
          if (data.session_id) {
            this.verbaSessions.set(userId, {
              sessionId: data.session_id,
              lastAccess: Date.now(),
            });
          } else if (this.verbaSessions.has(userId)) {
            this.verbaSessions.get(userId).lastAccess = Date.now();
          }

          responseText = data.choices[0].message.content;
        } catch (verbaError) {
          logger.error("[Verba Error] Fallback ke Gemini:", verbaError);

          // FALLBACK KE-2: Pakai Gemini
          try {
            const historyLimit = isPremium ? 40 : 10;
            if (!this.geminiSessions.has(userId)) {
              const fallbackModel = this.genAI.getGenerativeModel({
                model: "gemini-2.5-flash",
                systemInstruction: `Nama kamu adalah Naura Hoshino. Kamu diciptakan oleh Aryandita. Pengguna yang sedang berbicara denganmu memiliki peran: ${roleInfo}. Sesuaikan nada bicaramu dengan perannya (sangat hormat untuk Owner, ramah & elegan untuk Premium, dan santai untuk Member biasa). Gunakan bahasa Indonesia kasual.`,
              });
              const chatSession = fallbackModel.startChat({
                history: [],
                generationConfig: { maxOutputTokens: 1500 },
              });
              this.geminiSessions.set(userId, {
                chat: chatSession,
                lastAccess: Date.now(),
              });
            }

            const sessionData = this.geminiSessions.get(userId);
            sessionData.lastAccess = Date.now();

            // Prune history count & total character length to prevent token overflow
            if (sessionData.chat && Array.isArray(sessionData.chat._history)) {
              if (sessionData.chat._history.length > historyLimit) {
                sessionData.chat._history = sessionData.chat._history.slice(
                  sessionData.chat._history.length - historyLimit,
                );
              }
              let totalChars = sessionData.chat._history.reduce(
                (sum, msg) => sum + (msg.parts?.[0]?.text?.length || 0),
                0,
              );
              while (
                totalChars > 4000 &&
                sessionData.chat._history.length > 2
              ) {
                sessionData.chat._history.splice(0, 2); // Hapus 1 pasang (user + bot)
                totalChars = sessionData.chat._history.reduce(
                  (sum, msg) => sum + (msg.parts?.[0]?.text?.length || 0),
                  0,
                );
              }
            }

            const result = await sessionData.chat.sendMessage(prompt);
            responseText = result.response.text();
          } catch (geminiError) {
            // Rotasi API key jika kuota habis
            if (
              geminiError.message &&
              (geminiError.message.includes("429") ||
                geminiError.message.includes("quota"))
            ) {
              this.rotateKey();
            }

            // FALLBACK KE-3: Pakai Ollama (Local)
            logger.error(
              "[Gemini Fallback Error] Beralih ke Ollama:",
              geminiError,
            );
            try {
              const ollamaResponse = await ollamaClient.chat({
                model: env.OLLAMA_MODEL,
                messages: [{ role: "user", content: prompt }],
              });
              responseText = ollamaResponse.message.content;
            } catch (ollamaError) {
              logger.error(
                "[Ollama Error] Semua layanan AI gagal:",
                ollamaError,
              );
              responseText = `${ui.emojis?.error || "❌"} Semua layanan AI (Verba, Gemini, dan Ollama) sedang tidak tersedia. Coba lagi nanti ya!`;
            }
          }
        }
      }

      // ==========================================
      // PEMECAH PESAN (CHUNKING)
      // ==========================================
      const chunks = [];
      let currentChunk = "";
      const lines = responseText.split("\n");

      for (const line of lines) {
        if (currentChunk.length + line.length + 1 > 1950) {
          chunks.push(currentChunk);
          currentChunk = line + "\n";
        } else {
          currentChunk += line + "\n";
        }
      }
      if (currentChunk.trim()) chunks.push(currentChunk);

      // Balas pesan user secara berurutan
      for (let i = 0; i < chunks.length; i++) {
        if (i === 0) {
          await message.reply(chunks[i]);
        } else {
          await message.channel.send(chunks[i]);
        }
      }
    } catch (error) {
      logger.error("\x1b[31m[AI ERROR]\x1b[0m Gagal merespons:", error);
      await message.reply(
        `${ui.emojis?.error || "❌"} Aduh, kepala Naura tiba-tiba pusing. Coba tanya lagi nanti ya!`,
      );
    }
  }
}

module.exports = new AIManager();
