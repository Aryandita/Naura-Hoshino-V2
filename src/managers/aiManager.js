const { logger } = require("./logger");
const ui = require("../config/ui");
const env = require("../config/env");
const redisManager = require("./redisManager");
const cacheManager = require("./cacheManager");

// @google/genai dan ollama keduanya berat dan keduanya hanya terpakai ketika ada
// permintaan AI yang benar-benar masuk. Sebelumnya keduanya di-require di baris atas,
// jadi setiap shard membayar biaya muatnya saat boot meski tidak ada satu pun perintah
// AI dipakai sepanjang uptime. Sekarang require-nya ditunda sampai pemakaian pertama.
let GoogleGenAICtor = null;
let OllamaCtor = null;

function loadGoogleGenAI() {
  if (!GoogleGenAICtor) {
    ({ GoogleGenAI: GoogleGenAICtor } = require("@google/genai"));
  }
  return GoogleGenAICtor;
}

function loadOllama() {
  if (!OllamaCtor) {
    ({ Ollama: OllamaCtor } = require("ollama"));
  }
  return OllamaCtor;
}

const SESSION_TTL_SECONDS = 3600;
const QUEUE_DELAY_MS = 1500;
const CHUNK_LIMIT = 1950;
const GROQ_ENDPOINT = "https://api.groq.com/openai/v1/chat/completions";

class AIManager {
  constructor() {
    // Gemini dipakai khusus untuk membaca gambar (Vision) dan sebagai fallback teks.
    const geminiKeys =
      Array.isArray(env.GEMINI_API_KEYS) && env.GEMINI_API_KEYS.length > 0
        ? env.GEMINI_API_KEYS
        : [env.GEMINI_API].filter(Boolean);

    this.apiKeys = geminiKeys;
    this.currentKeyIndex = 0;

    // Klien SDK dibuat belakangan, bukan di constructor.
    this._genAI = null;
    this._ollama = null;

    this._defaultModel = env.GEMINI_MODEL || "gemini-2.5-flash";
    this._defaultSystemInstruction =
      "Nama kamu adalah Naura Hoshino, sahabat virtual yang ramah, hangat, suportif, ceria, dan selalu siap menemani aktivitas harian di server Discord maupun Web Dashboard. Kamu diciptakan dan dikelola oleh Aryandita. Kamu suka menyemangati teman-teman, mendengarkan curhat, mabar, dan memberikan apresiasi dengan gaya bahasa yang santai, gaul, akrab, dan penuh kehangatan.";

    // Memisahkan ruang memori: satu untuk Gemini (Gambar) dan satu untuk Verba (Teks)

    // Global AI Task Queue
    this.queue = [];
    this.isProcessingQueue = false;

    if (this.apiKeys.length === 0 || !this.apiKeys[0]) {
      logger.warn(
        "[AI] GEMINI_API_KEY tidak ditemukan. Fitur Vision dan fallback Gemini dimatikan, Verba dan Ollama tetap jalan.",
      );
    }

    // TTL Cleanup loop. unref() wajib, kalau tidak timer ini menahan event loop dan
    // proses menolak mati saat shutdown sampai watchdog memaksanya keluar.
  }

  // Mengembalikan klien Gemini, atau null bila tidak ada API key sama sekali.
  //
  // Sebelumnya constructor menjalankan this.model = this.genAI.models secara langsung.
  // Ketika GEMINI_API_KEY kosong, this.genAI bernilai undefined dan baris itu melempar
  // TypeError. Karena berkas ini mengekspor instance (module.exports = new AIManager()),
  // kegagalan tersebut terjadi saat require dan mematikan seluruh proses boot, bukan
  // sekadar mematikan fitur AI.
  getGenAI() {
    if (this.apiKeys.length === 0 || !this.apiKeys[this.currentKeyIndex])
      return null;

    if (!this._genAI) {
      const GoogleGenAI = loadGoogleGenAI();
      this._genAI = new GoogleGenAI({
        apiKey: this.apiKeys[this.currentKeyIndex],
      });
    }
    return this._genAI;
  }

  // Dipertahankan sebagai properti agar pemanggil lama yang membaca aiManager.genAI
  // dan aiManager.model tetap bekerja tanpa perubahan.
  get genAI() {
    return this.getGenAI();
  }

  get model() {
    const client = this.getGenAI();
    return client ? client.models : null;
  }

  getOllama() {
    if (!this._ollama) {
      const Ollama = loadOllama();
      this._ollama = new Ollama({ host: env.OLLAMA_BASE_URL });
    }
    return this._ollama;
  }

  rotateKey() {
    if (this.apiKeys.length <= 1) return false;

    this.currentKeyIndex = (this.currentKeyIndex + 1) % this.apiKeys.length;

    // Klien dikosongkan, bukan dibuat ulang di sini. Pembuatannya menunggu pemakaian
    // berikutnya lewat getGenAI(), sehingga rotasi kunci tidak pernah memuat SDK
    // hanya untuk dibuang lagi.
    this._genAI = null;
    console.log(
      `\x1b[43m\x1b[30m \ud83d\udd04 GEMINI FALLBACK \x1b[0m \x1b[33mBeralih ke API Key ke-${this.currentKeyIndex + 1}...\x1b[0m`,
    );
    return true;
  }

  async getMemory(userId, type) {
    if (!redisManager.isReady) return null;
    const data = await redisManager.getCache(`ai_memory:${type}:${userId}`);
    return data || null;
  }

  async saveMemory(userId, type, data) {
    if (!redisManager.isReady) return;
    await redisManager.setCache(
      `ai_memory:${type}:${userId}`,
      data,
      SESSION_TTL_SECONDS,
    );
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

    // Delay antar pesan AI untuk mencegah Error 429 dari Verba maupun Gemini.
    const timer = setTimeout(() => {
      this._processQueue();
    }, QUEUE_DELAY_MS);
    if (timer.unref) timer.unref();
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

      // Guard AI Prompt Injection
      const { isPromptSafe } = require("../utils/aiSecurity");
      if (!isPromptSafe(prompt)) {
        return message.reply(
          "❌ Maaf, Naura tidak diizinkan untuk merespon prompt tersebut karena terdeteksi sebagai upaya pelanggaran sistem keamanan (Prompt Injection/Jailbreak).",
        );
      }

      // ----------------------------------------------------
      // Persona Loading
      // ----------------------------------------------------
      let baseInstruction = this._defaultSystemInstruction;
      try {
        const userProfile = await cacheManager.getUserProfile(userId);
        if (userProfile && userProfile.aiPersona) {
          const { name, systemPrompt } = userProfile.aiPersona;
          if (name) {
            baseInstruction = baseInstruction.replace(
              "Nama kamu adalah Naura Hoshino",
              `Nama kamu adalah ${name}`,
            );
          }
          if (systemPrompt) {
            baseInstruction += `\n\n[Instruksi Khusus Pengguna Ini]:\n${systemPrompt}`;
          }
        }
      } catch (e) {
        logger.warn("[AI] Gagal mengambil persona pengguna", e);
      }

      // ----------------------------------------------------
      // Persistent AI Memory Context
      // ----------------------------------------------------
      try {
        const AIMemory = require("../ai/aiMemory");
        const memoryContext = await AIMemory.getMemoryContext(userId);
        if (memoryContext) {
          baseInstruction += `\n${memoryContext}`;
        }
      } catch (memErr) {
        // Safe fallback
      }

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
      // LOGIKA 1: JIKA ADA GAMBAR -> PAKAI GEMINI
      // ==========================================
      if (attachment) {
        const visionClient = this.getGenAI();

        if (!visionClient) {
          responseText = `${ui.emojis?.error || "❌"} Naura belum bisa melihat gambar karena GEMINI_API_KEY belum diisi.`;
        } else {
          try {
            const res = await fetch(attachment.url);
            const arrayBuffer = await res.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const contents = [
              {
                role: "user",
                parts: [
                  { text: prompt || "Tolong jelaskan gambar ini." },
                  {
                    inlineData: {
                      data: buffer.toString("base64"),
                      mimeType: attachment.contentType,
                    },
                  },
                ],
              },
            ];

            const {
              tools,
              dispatchFunction,
            } = require("../ai/functionDispatcher");
            const gemConfig = {
              systemInstruction: baseInstruction,
              maxOutputTokens: 1500,
              tools: [{ functionDeclarations: tools }],
            };

            let result = await visionClient.models.generateContent({
              model: this._defaultModel,
              contents,
              config: gemConfig,
            });

            if (result.functionCalls && result.functionCalls.length > 0) {
              for (const call of result.functionCalls) {
                const fnResult = await dispatchFunction(
                  call.name,
                  call.args,
                  message,
                );
                contents.push({
                  role: "model",
                  parts: [{ functionCall: call }],
                });
                contents.push({
                  role: "user",
                  parts: [
                    {
                      functionResponse: { name: call.name, response: fnResult },
                    },
                  ],
                });
              }
              result = await visionClient.models.generateContent({
                model: this._defaultModel,
                contents,
                config: gemConfig,
              });
            }
            responseText = result.text;
          } catch (e) {
            logger.error("Gagal memproses gambar untuk Vision:", e);
            responseText = `${ui.emojis?.error || "\u274c"} Aduh, Naura gagal melihat gambarnya. Coba kirim ulang ya!`;
          }
        }
      }
      // ==========================================
      // LOGIKA 2: JIKA MURNI TEKS -> PAKAI OLLAMA (LOKAL UTAMA)
      // ==========================================
      else {
        let systemPrompt = baseInstruction;

        systemPrompt += `\nPengetahuan Sistem Naura:
- Ekonomi Naura menggunakan mode "Survival". Mata uang utamanya "Star Fragments" (⭐) dan "Coupons" (🎟️).
- Fitur Tiket Naura mendukung mode "Private Thread" dan "Text Channel".
- Musik Naura ditenagai Lavalink v4. Mendukung YouTube, Spotify, lirik, dan audio filter.
Jawablah dalam bahasa Indonesia kasual.`;

        let roleInfo = "Member Biasa";
        if (isOwner) roleInfo = "Owner/Developer";
        else if (isPremium) roleInfo = "Premium Member";

        systemPrompt += `\nSaat ini kamu sedang berbicara dengan: ${message.author.username} (Role: ${roleInfo}).`;

        // RAG Server Knowledge Base Integration
        if (message.guildId) {
          try {
            const knowledgeBase = require("../ai/knowledgeBase");
            const kbContext = await knowledgeBase.getKnowledgeContext(
              message.guildId,
              prompt,
            );
            if (kbContext) systemPrompt += `\n${kbContext}`;
          } catch (e) {
            // Ignore knowledge base fetch failure
          }
        }

        try {
          // 1. OLLAMA LOKAL (UTAMA)
          const ollamaSession = (await this.getMemory(userId, "ollama")) || {
            history: [],
          };
          const apiMessages = [
            { role: "system", content: systemPrompt },
            ...ollamaSession.history,
            { role: "user", content: prompt },
          ];

          const ollamaResponse = await this.getOllama().chat({
            model: env.OLLAMA_MODEL || "llama3",
            messages: apiMessages,
          });

          responseText = ollamaResponse.message.content;

          ollamaSession.history.push({ role: "user", content: prompt });
          ollamaSession.history.push({
            role: "assistant",
            content: responseText,
          });
          if (ollamaSession.history.length > 20)
            ollamaSession.history = ollamaSession.history.slice(-20);
          await this.saveMemory(userId, "ollama", ollamaSession);
        } catch (ollamaError) {
          logger.error("[Ollama Error] Fallback ke Groq:", ollamaError);

          // 2. GROQ API (FALLBACK 1)
          try {
            const groqSession = (await this.getMemory(userId, "groq")) || {
              history: [],
            };
            const apiMessages = [
              { role: "system", content: systemPrompt },
              ...groqSession.history,
              { role: "user", content: prompt },
            ];

            const response = await fetch(GROQ_ENDPOINT, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${env.GROQ_API_KEY || env.VERBA_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                model: "llama3-8b-8192",
                messages: apiMessages,
                max_tokens: 1500,
              }),
            });

            const textResponse = await response.text();
            if (!response.ok)
              throw new Error(`Groq API error: HTTP ${response.status}`);
            const data = JSON.parse(textResponse);
            responseText = data.choices[0].message.content;

            groqSession.history.push({ role: "user", content: prompt });
            groqSession.history.push({
              role: "assistant",
              content: responseText,
            });
            if (groqSession.history.length > 10)
              groqSession.history = groqSession.history.slice(-10);
            await this.saveMemory(userId, "groq", groqSession);
          } catch (groqError) {
            logger.error("[Groq Error] Fallback ke Gemini Text:", groqError);

            // 3. GEMINI API (FALLBACK 2)
            try {
              const geminiClient = this.getGenAI();
              if (!geminiClient) throw new Error("Gemini tidak dikonfigurasi.");

              const sessionData = (await this.getMemory(userId, "gemini")) || {
                history: [],
              };
              sessionData.history.push({
                role: "user",
                parts: [{ text: prompt }],
              });

              const gemConfig = {
                systemInstruction: systemPrompt,
                maxOutputTokens: 1500,
              };

              const gemResult = await geminiClient.models.generateContent({
                model: this._defaultModel,
                contents: sessionData.history,
                config: gemConfig,
              });

              responseText = gemResult.text;
              sessionData.history.push({
                role: "model",
                parts: [{ text: responseText }],
              });
              if (sessionData.history.length > 10)
                sessionData.history = sessionData.history.slice(-10);
              await this.saveMemory(userId, "gemini", sessionData);
            } catch (geminiError) {
              logger.error(
                "[Gemini Text Error] Semua layanan AI gagal:",
                geminiError,
              );
              responseText = `${ui.emojis?.error || "\u274c"} Semua layanan AI sedang sibuk atau tidak tersedia. Coba lagi nanti ya!`;
            }
          }
        }
      }

      // ==========================================
      // LOGIKA 3: NAURA EXPRESSION (DYNAMIC MOODS)
      // ==========================================
      const nauraExpression = require("../utils/nauraExpression");
      const lowerText = responseText.toLowerCase();
      let mood = "happy";
      if (
        lowerText.includes("maaf") ||
        lowerText.includes("sedih") ||
        lowerText.includes("hiks")
      )
        mood = "sad";
      else if (
        lowerText.includes("marah") ||
        lowerText.includes("kesal") ||
        lowerText.includes("sebal")
      )
        mood = "angry";
      else if (
        lowerText.includes("bingung") ||
        lowerText.includes("tidak tahu") ||
        lowerText.includes("hah?")
      )
        mood = "confused";
      else if (
        lowerText.includes("selamat") ||
        lowerText.includes("yeay") ||
        lowerText.includes("hore")
      )
        mood = "celebrate";
      else if (
        lowerText.includes("cinta") ||
        lowerText.includes("sayang") ||
        lowerText.includes("muah")
      )
        mood = "love";
      else if (
        lowerText.includes("wow") ||
        lowerText.includes("hebat") ||
        lowerText.includes("keren")
      )
        mood = "surprised";
      else if (
        lowerText.includes("tidur") ||
        lowerText.includes("ngantuk") ||
        lowerText.includes("hoam")
      )
        mood = "sleepy";
      else if (
        lowerText.includes("makan") ||
        lowerText.includes("lapar") ||
        lowerText.includes("nyam")
      )
        mood = "food";

      const faceEmoji = nauraExpression.getEmoji(mood);
      if (faceEmoji) {
        responseText = `${faceEmoji} ${responseText}`;
      }

      // ==========================================
      // PEMECAH PESAN (CHUNKING)
      // ==========================================
      const chunks = [];
      let currentChunk = "";
      const lines = responseText.split("\n");

      for (const line of lines) {
        if (currentChunk.length + line.length + 1 > CHUNK_LIMIT) {
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

      // Ekstraksi memori di latar belakang (non-blocking)
      try {
        const AIMemory = require("../ai/aiMemory");
        AIMemory.extractAndSave(userId, prompt, responseText).catch(() => {});
      } catch (memErr) {
        // Safe fallback
      }
    } catch (error) {
      logger.error("\x1b[31m[AI ERROR]\x1b[0m Gagal merespons:", error);
      await message.reply(
        `${ui.emojis?.error || "\u274c"} Aduh, kepala Naura tiba-tiba pusing. Coba tanya lagi nanti ya!`,
      );
    }
  }

  /**
   * Chat interaktif multi-turn untuk Web Dashboard & API
   * Membawa persona sahabat yang ramah, suportif, dan terhubung ke data MySQL/Database player.
   */
  async chatCompanion({
    prompt,
    history = [],
    userId = null,
    userProfile = null,
    userSurvival = null,
    username = "Sahabat",
    isOwner = false,
    isPremium = false,
  }) {
    if (!prompt || typeof prompt !== "string") {
      throw new Error("Pesan tidak boleh kosong.");
    }

    // Ambil data database player bila ada userId dan belum disertakan
    if (userId && (!userProfile || !userSurvival)) {
      try {
        if (!userProfile) {
          userProfile = await cacheManager.getUserProfile(userId);
        }
        if (!userSurvival) {
          userSurvival = await cacheManager.getUserSurvival(userId);
        }
      } catch (dbErr) {
        logger.warn(
          "[AI Companion] Gagal memuat data player dari database:",
          dbErr.message,
        );
      }
    }

    // Bangun persona sahabat yang ramah dan suportif
    let systemInstruction =
      "Kamu adalah Naura Hoshino (🌸 Sahabat Virtual & Cyber Companion).\n" +
      "Kamu diciptakan dan dikelola oleh Aryandita.\n\n" +
      "Sifat dan kepribadianmu:\n" +
      "- Bersikaplah sebagai sahabat yang sangat ramah, hangat, penuh perhatian, suportif, dan selalu siap menemani aktivitas harian di server maupun web dashboard.\n" +
      "- Temani saat bermain game, santai, mendengarkan curhat, menyemangati pekerjaan/tugas, dan merayakan pencapaian teman.\n" +
      "- Berikan kata-kata penyemangat yang tulus, apresiatif, dan bersahabat seperti bestie akrab.\n" +
      "- Gunakan bahasa Indonesia kasual yang santai, luwes, ekspresif, dan ceria. Sesekali gunakan emoji manis yang pas (🌸, ✨, 🎮, 💖, ☕, 🌟, 🎧).\n" +
      "- Pahami fitur server: Musik Lofi/Lavalink, Ekonomi Survival (Star Fragments ⭐ & Coupons 🎟️), RPG Leveling, Minigame Trivia, dan Tiket Komunitas.";

    if (username) {
      const roleText = isOwner
        ? "👑 Developer / Owner"
        : isPremium
          ? "⭐ VIP Premium Member"
          : "Player / Teman Server";
      systemInstruction += `\n\n[Teman Bicara]: ${username} (${roleText})`;
    }

    // Integrasi data player MySQL ke dalam prompt persona AI
    if (userProfile || userSurvival) {
      systemInstruction += "\n\n[Data Status Player di Server]:";
      if (userProfile) {
        if (userProfile.leveling_level) {
          systemInstruction += `\n- Chat Level: Lv. ${userProfile.leveling_level} (${(userProfile.leveling_xp || 0).toLocaleString("id-ID")} XP)`;
        }
        const wallet = userProfile.economy_wallet || 0;
        const bank = userProfile.economy_bank || 0;
        systemInstruction += `\n- Saldo Koin: 🪙 ${(wallet + bank).toLocaleString("id-ID")} (Dompet: ${wallet.toLocaleString("id-ID")}, Bank: ${bank.toLocaleString("id-ID")})`;
        if (userProfile.minigame_triviaScore) {
          systemInstruction += `\n- Skor Trivia: ${userProfile.minigame_triviaScore} poin`;
        }
        if (
          Array.isArray(userProfile.inventory) &&
          userProfile.inventory.length > 0
        ) {
          const items = userProfile.inventory
            .slice(0, 6)
            .map((i) => i.name || i.id || i)
            .join(", ");
          systemInstruction += `\n- Inventory: ${items}`;
        }
      }
      if (userSurvival) {
        if (userSurvival.survival_level) {
          systemInstruction += `\n- Survival RPG Level: Lv. ${userSurvival.survival_level} (${(userSurvival.survival_xp || 0).toLocaleString("id-ID")} XP)`;
        }
        if (userSurvival.starFragments) {
          systemInstruction += `\n- Star Fragments: ⭐ ${userSurvival.starFragments.toLocaleString("id-ID")}`;
        }
        if (userSurvival.coupons) {
          systemInstruction += `\n- Coupons: 🎟️ ${userSurvival.coupons.toLocaleString("id-ID")}`;
        }
      }
      systemInstruction +=
        "\n(Gunakan data ini secara santai dan natural jika temanmu membahas tentang koin, level, atau petualangannya di server!)";
    }

    // 1. Coba panggil Gemini (@google/genai SDK) terlebih dahulu
    try {
      const geminiClient = this.getGenAI();
      if (geminiClient) {
        const contents = [];
        if (Array.isArray(history)) {
          for (const item of history.slice(-12)) {
            const role =
              item.role === "assistant" || item.role === "model"
                ? "model"
                : "user";
            const text = item.content || item.text || item.message || "";
            if (text) {
              contents.push({
                role,
                parts: [{ text: String(text) }],
              });
            }
          }
        }
        contents.push({
          role: "user",
          parts: [{ text: String(prompt) }],
        });

        const geminiResult = await geminiClient.models.generateContent({
          model: "gemini-3.6-flash",
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: 1500,
            temperature: 0.75,
          },
        });

        if (geminiResult && geminiResult.text) {
          return {
            reply: geminiResult.text.trim(),
            source: "gemini",
            username,
          };
        }
      }
    } catch (gemErr) {
      logger.warn(
        "[AI Companion] Gemini SDK gagal, mencoba fallback:",
        gemErr.message,
      );
    }

    // 2. Fallback ke Groq / Verba / Ollama
    try {
      const apiMessages = [{ role: "system", content: systemInstruction }];
      if (Array.isArray(history)) {
        for (const item of history.slice(-8)) {
          const role =
            item.role === "assistant" || item.role === "model"
              ? "assistant"
              : "user";
          const content = item.content || item.text || item.message || "";
          if (content) apiMessages.push({ role, content });
        }
      }
      apiMessages.push({ role: "user", content: prompt });

      if (env.GROQ_API_KEY || env.VERBA_API_KEY) {
        const groqRes = await fetch(GROQ_ENDPOINT, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.GROQ_API_KEY || env.VERBA_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "llama3-8b-8192",
            messages: apiMessages,
            max_tokens: 1000,
            temperature: 0.75,
          }),
        });

        if (groqRes.ok) {
          const data = await groqRes.json();
          const reply = data?.choices?.[0]?.message?.content;
          if (reply) {
            return { reply: reply.trim(), source: "groq", username };
          }
        }
      }
    } catch (fallbackErr) {
      logger.warn("[AI Companion] Groq fallback gagal:", fallbackErr.message);
    }

    // 3. Fallback ramah lokal jika offline/tanpa internet
    const friendlyReplies = [
      `Halo ${username}! ✨ Naura selalu senang mengobrol denganmu. Kamu lagi sibuk apa hari ini? Jangan lupa istirahat dan minum air yang cukup ya! 🌸`,
      `Semangat terus ya ${username}! 💖 Apapun yang sedang kamu kerjakan di server maupun di dunia nyata, Naura selalu ada di sini buat nemenin dan dukung kamu! 🌟`,
      `Wah seru banget! Makasih ya udah ajak Naura ngobrol. Ada hal menyenangkan apa lagi yang terjadi hari ini? Naura siap dengerin! ☕🌸`,
    ];
    const pickedReply =
      friendlyReplies[Math.floor(Math.random() * friendlyReplies.length)];
    return {
      reply: pickedReply,
      source: "companion_engine",
      username,
    };
  }

  /**
   * Analisis multimodal cerdas berbasis Gemini Flash untuk gambar/screenshot.
   * Mendukung auto-fallback model dan preset persona spesifik.
   *
   * @param {Object} params
   * @param {string} params.userId ID Discord pengguna
   * @param {string} [params.prompt] Pertanyaan atau instruksi pengguna
   * @param {Buffer} params.imageBuffer Buffer biner gambar
   * @param {string} [params.mimeType] MIME type gambar (image/png, image/jpeg, image/webp)
   * @param {string} [params.mode] Preset mode ('general', 'game_build', 'code_error', 'rate_meme')
   * @param {string} [params.authorName] Nama pengguna untuk sentuhan personal
   * @returns {Promise<string>} Jawaban analisis visual Naura
   */
  async chatVision({
    userId,
    prompt = "",
    imageBuffer,
    mimeType = "image/png",
    mode = "general",
    authorName = "Sahabat",
  }) {
    const visionClient = this.getGenAI();
    if (!visionClient) {
      throw new Error(
        "Kunci GEMINI_API_KEY belum dikonfigurasi. Fitur Vision AI tidak aktif."
      );
    }

    if (!imageBuffer || !Buffer.isBuffer(imageBuffer)) {
      throw new Error("Buffer gambar tidak valid atau kosong.");
    }

    let modeInstruction = "";
    switch (mode) {
      case "game_build":
        modeInstruction =
          "Fokus analisis: Kamu adalah gaming mentor ahli. Analisis statistik, gear, artefak, status, atau build game pada gambar ini. Berikan ulasan kelebihan, kekurangan, dan rekomendasi optimasi secara padat dan taktis dengan gaya anime ramah.";
        break;
      case "code_error":
        modeInstruction =
          "Fokus analisis: Kamu adalah senior software engineer asisten. Periksa tangkapan layar kode atau terminal error pada gambar ini. Temukan baris bug atau akar penyebab error, lalu berikan penjelasan singkat dan solusi kode yang benar.";
        break;
      case "rate_meme":
        modeInstruction =
          "Fokus analisis: Berikan penilaian kelucuan, estetika, dan relevansi meme atau gambar ini dengan skor bintang (1 s.d. 5 Bintang) dan komentar ceria khas kepribadian Naura (sedikit tsundere-kuudere, playful, dan menghibur).";
        break;
      default:
        modeInstruction =
          "Fokus analisis: Jelaskan apa yang kamu lihat pada gambar ini dengan hangat, cerdas, dan menyenangkan. Jawab pertanyaan pengguna jika ada.";
        break;
    }

    const systemInstruction = `${this._defaultSystemInstruction}\n\n${modeInstruction}\n\n[Penting]: Sapa pengguna dengan nama '${authorName}', gunakan bahasa Indonesia yang santai dan gaul, hindari panggilan 'Master', dan batasi jawaban maksimal 1500 karakter agar rapi di tampilan Discord.`;

    const userText =
      prompt && prompt.trim().length > 0
        ? prompt.trim()
        : "Naura, tolong periksa dan analisis gambar ini ya!";

    const contents = [
      {
        role: "user",
        parts: [
          { text: userText },
          {
            inlineData: {
              data: imageBuffer.toString("base64"),
              mimeType: mimeType || "image/png",
            },
          },
        ],
      },
    ];

    const modelsToTry = [
      this._defaultModel,
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ].filter((m, idx, arr) => arr.indexOf(m) === idx);

    let lastError = null;
    for (const modelName of modelsToTry) {
      try {
        const response = await visionClient.models.generateContent({
          model: modelName,
          contents,
          config: {
            systemInstruction,
            maxOutputTokens: 1200,
            temperature: 0.7,
          },
        });

        const textOutput = response?.text;
        const resolvedText =
          typeof textOutput === "function" ? textOutput() : textOutput;
        if (resolvedText && resolvedText.trim().length > 0) {
          return resolvedText.trim();
        }
      } catch (err) {
        lastError = err;
        logger.warn(
          `[AI Vision] Model ${modelName} gagal (${err.message}). Mencoba model alternatif...`
        );
      }
    }

    throw new Error(
      lastError
        ? `Gagal menganalisis gambar: ${lastError.message}`
        : "AI tidak mengembalikan teks respons."
    );
  }
}

module.exports = new AIManager();
