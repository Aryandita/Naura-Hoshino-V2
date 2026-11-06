const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../utils/NauraContainerBuilder");
const { logger } = require("../managers/logger");
const env = require("../config/env");
const ui = require("../config/ui");
const gemini = require("./geminiClient");
const {
  checkModeration,
  checkRateLimit,
  simulateTypingDelay,
  performWebSearchIfNeeded,
  updateGeminiHistory,
  getGeminiHistory,
} = require("./aiHelper");
const AIMemory = require("./aiMemory");
const { SystemError, ExternalAPIError } = require("../errors/DomainError");
class AIRouterManager {
  static async processMessage(
    client,
    message,
    userMessage,
    persona,
    previousBotMessage,
    isOwner,
    isPremiumUser,
    settings,
  ) {
    let replyText = "";

    if (settings && settings.settings) {
      const set = settings.settings;
      if (set.ai && set.ai.customPersona) {
        persona += `\n[Sifat Khusus Server]: ${set.ai.customPersona}`;
      }
      if (set.ai && set.ai.serverKnowledge) {
        persona += `\n[Aturan/FAQ Server (Jadikan Pedoman Menjawab)]: ${set.ai.serverKnowledge}`;
      }
      if (set.aiPersona) {
        persona += `\n[Persona/Sifat Khusus Tambahan (Guild)]: ${set.aiPersona}`;
      }
    }

    // Ambil persona dari profil user (Premium Feature)
    const cacheManager = require("../managers/cacheManager");
    const userProfile = await cacheManager.getUserProfile(message.author.id);
    if (userProfile && userProfile.aiPersona) {
      const uPersona =
        typeof userProfile.aiPersona === "string"
          ? JSON.parse(userProfile.aiPersona)
          : userProfile.aiPersona;
      if (uPersona.systemPrompt) {
        persona += `\n[Persona Khusus User (${message.author.username})]: ${uPersona.systemPrompt}`;
      }
    }

    const userMemory = await AIMemory.getMemoryContext(message.author.id);
    if (userMemory) {
      persona += userMemory;
    }

    const modResult = await checkModeration(userMessage);
    if (modResult.flagged) {
      return ui.sendError(
        message,
        `Maaf ya, Naura tidak bisa menjawab pesan itu karena ${modResult.reason.toLowerCase()}. Yuk ngobrol yang lain, Naura tetap senang menemanimu.`,
      );
    }

    const rateLimit = await checkRateLimit(
      message.author.id,
      isOwner,
      isPremiumUser,
    );
    if (!rateLimit.allowed) {
      return ui.sendError(
        message,
        `Pelan-pelan ya, Naura masih mengejar napas. Beri Naura ${rateLimit.retryAfter} detik lagi, nanti Naura balas lagi dengan senang hati.`,
      );
    }

    const attachment = message.attachments.first();

    if (attachment) {
      // Opsi A: Analisis gambar / Vision Multimodal adalah fitur eksklusif member Premium
      if (!isOwner && !isPremiumUser) {
        const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
        const rowUpgrade = new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setLabel("✨ Upgrade VIP")
            .setStyle(ButtonStyle.Link)
            .setURL("https://saweria.co/aryandita")
            .setEmoji("⭐"),
          new ButtonBuilder()
            .setLabel("🗳️ Vote Top.gg (12j VIP)")
            .setStyle(ButtonStyle.Link)
            .setURL("https://top.gg/bot/1483665745727721543/vote")
            .setEmoji("🎁"),
        );

        const vipCard = buildContainerV2({
          accentColorHex: "#F59E0B",
          authorName: "NAURA VISION • FITUR PREMIUM",
          title: "🔒 Fitur Analisis Gambar Khusus Member VIP",
          description: [
            "Halo! Kemampuan melihat dan menganalisis foto/gambar secara instan merupakan **fitur eksklusif untuk Member Premium & VIP**.",
            "",
            "> 🌟 **Keuntungan Member VIP:**",
            "> • 👁️ Analisis gambar dan dokumen multimodal",
            "> • ⚡ Jalur cepat prioritas (Groq ~300 token/detik)",
            "> • 🎙️ Akses Duplex Voice Agent di Voice Channel",
            "> • ♾️ Kuota chat harian tanpa batas",
            "",
            "Kamu juga bisa mendapatkan **VIP Gratis selama 12 jam** hanya dengan melakukan voting di Top.gg!",
          ].join("\n"),
          buttonsRow: [rowUpgrade],
          footerText: ui.getFooter("core"),
        });

        return message.reply(vipCard).catch(() => {});
      }

      try {
        if (!gemini.isAvailable())
          throw new SystemError("GEMINI_API tidak dikonfigurasi.");

        const res = await fetch(attachment.url);
        const arrayBuffer = await res.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const searchResult = await performWebSearchIfNeeded(userMessage || "");
        const parts = [
          {
            text: `${persona}${previousBotMessage}\n\nPesan: ${userMessage || "Tolong jelaskan gambar ini."}${searchResult ? searchResult : ""}`,
          },
          {
            inlineData: {
              data: buffer.toString("base64"),
              mimeType: attachment.contentType,
            },
          },
        ];

        replyText = await gemini.generate({ parts });
      } catch (error) {
        logger.error("[GEMINI VISION ERROR]", error);
        const errPayload = buildErrorContainerV2({
          title: "Naura belum bisa melihatnya",
          description:
            "Maaf ya, mata Naura sedang buram. Layanan pembaca gambar lagi bermasalah. Coba kirim lagi sebentar lagi, Naura tunggu.",
          footerText: ui.getFooter("core"),
        });
        return message.reply(errPayload).catch(() => {});
      }
    } else {
      let useVerba = true;
      let forceGeminiForTools = false;
      let usedTools = false;

      // Check intent for function calling (8 Core Tools)
      const toolKeywords =
        /saldo|uang|koin|profil|level|xp|premium|informasi|lagu|musik|putar|mainkan|jeda|pause|skip|stop|antrean|queue|tas|inventory|barang|item|peringkat|leaderboard|top|server|anggota|member|ingatkan|reminder|ingat|daily|hadiah|klaim/i;
      if (toolKeywords.test(userMessage || "")) {
        const redisManager = require("../managers/redisManager");
        if (isOwner || isPremiumUser) {
          forceGeminiForTools = true;
        } else if (redisManager.isReady) {
          const quotaKey = `gemini_tools_quota:${message.author.id}`;
          const todayUsage = parseInt(
            (await redisManager.getCache(quotaKey)) || "0",
            10,
          );
          if (todayUsage < 25) {
            // Limit 25/day for free users
            forceGeminiForTools = true;
          }
        }
      }

      if (forceGeminiForTools) {
        useVerba = false;
      }

      try {
        if (!useVerba) throw new SystemError("INTENT_TOOL_CALL");

        const contextPrompt = `${persona}${previousBotMessage}\n\nPesan dari User (${message.author.username}): ${userMessage || "(Menyapa)"}`;

        let targetSlug =
          env.VERBA_SLUG_GENERAL || env.VERBA_CHARACTER_SLUG || "naura";
        if (isOwner) {
          targetSlug =
            env.VERBA_SLUG_OWNER || env.VERBA_CHARACTER_SLUG || "naura";
        } else if (isPremiumUser) {
          targetSlug =
            env.VERBA_SLUG_PREMIUM || env.VERBA_CHARACTER_SLUG || "naura";
        }

        const requestBody = {
          character: targetSlug,
          messages: [{ role: "user", content: contextPrompt }],
        };

        const redisManager = require("../managers/redisManager");
        const sessionKey = `verba_session_${message.author.id}`;
        const sessionId = await redisManager.getCache(sessionKey);
        if (sessionId) {
          requestBody.session_id = sessionId;
        }

        const response = await fetch("https://api.verba.ink/v1/response", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.VERBA_API_KEY}`,
            "Content-Type": "application/json",
            "User-Agent":
              "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
          },
          body: JSON.stringify(requestBody),
        });

        const rawText = await response.text();
        if (!response.ok) {
          let errorMessage = `HTTP ${response.status}`;
          try {
            const errorData = JSON.parse(rawText);
            errorMessage =
              errorData.error?.message || errorData.message || errorMessage;
          } catch (e) {
            errorMessage = `${errorMessage} - Non-JSON response`;
          }
          throw new ExternalAPIError(`Verba API error: ${errorMessage}`);
        }

        let data;
        try {
          data = JSON.parse(rawText);
        } catch (parseError) {
          throw new ExternalAPIError(
            `Invalid JSON response dari Verba API (HTTP ${response.status})`,
          );
        }

        if (data.session_id) {
          await redisManager.setCache(sessionKey, data.session_id, 86400);
        }

        replyText =
          data?.choices?.[0]?.message?.content ||
          data?.message?.content ||
          data?.content ||
          "";

        if (!replyText)
          throw new ExternalAPIError(
            "Balasan Verba API kosong atau formatnya tidak dikenali.",
          );

        await updateGeminiHistory(
          message.author.id,
          "user",
          userMessage || "(Menyapa)",
        );
        await updateGeminiHistory(message.author.id, "model", replyText);
      } catch (verbaError) {
        logger.warn(
          `[Verba AI] ${verbaError.message} -> Mengalihkan ke AI Ensemble Router`,
        );

        const userRole = isOwner
          ? "Owner"
          : isPremiumUser
            ? "Premium User"
            : "User";
        logger.info(
          `[AI Router] Pemanggilan AI Ensemble untuk ${userRole} (${message.author.username})`,
        );

        const promptText = `${persona}${previousBotMessage}\n\nPesan dari ${userRole} (${message.author.username}): ${userMessage || "(Menyapa)"}`;

        try {
          const aiEnsembleRouter = require("./aiEnsembleRouter");
          const history = await getGeminiHistory(message.author.id);
          const { tools } = require("./functionDispatcher");

          const opts = {
            taskType: forceGeminiForTools
              ? aiEnsembleRouter.TASK_TYPES.CODE_LOGIC
              : aiEnsembleRouter.TASK_TYPES.GENERAL_CHAT,
            prompt: promptText,
            history,
            message,
            userId: message.author.id,
            userTier: isOwner ? "owner" : isPremiumUser ? "premium" : "free",
            isPremium: Boolean(isOwner || isPremiumUser),
          };

          if (forceGeminiForTools) {
            opts.config = { tools: [{ functionDeclarations: tools }] };
            usedTools = true;
          }

          const ensembleRes = await aiEnsembleRouter.routeTask(opts);
          replyText = ensembleRes.text;

          if (usedTools && !isOwner && !isPremiumUser) {
            const redisManager = require("../managers/redisManager");
            if (redisManager.isReady) {
              const quotaKey = `gemini_tools_quota:${message.author.id}`;
              const todayUsage = parseInt(
                (await redisManager.getCache(quotaKey)) || "0",
                10,
              );
              await redisManager.setCache(quotaKey, todayUsage + 1, 86400); // 24h expiration roughly
            }
          }

          await updateGeminiHistory(message.author.id, "user", promptText);
          await updateGeminiHistory(message.author.id, "model", replyText);
        } catch (ensembleError) {
          logger.error("[AI ENSEMBLE ROUTER ERROR]", ensembleError);
          return ui.sendError(
            message,
            "Aduh, semua jalur berpikir Naura sedang tersendat. Naura benar-benar ingin menjawabmu, coba sapa Naura lagi sebentar lagi ya.",
          );
        }
      }
    }

    await simulateTypingDelay(replyText);

    const lines = replyText.split("\n");
    const chunks = [];
    let currentChunk = "";
    let inCodeBlock = false;

    for (const line of lines) {
      if (line.includes("```")) {
        const backticksCount = (line.match(/```/g) || []).length;
        if (backticksCount % 2 !== 0) inCodeBlock = !inCodeBlock;
      }

      if (currentChunk.length + line.length + 1 > 3900) {
        if (inCodeBlock) {
          chunks.push(currentChunk + "\n```");
          currentChunk = "```\n" + line + "\n";
        } else {
          chunks.push(currentChunk);
          currentChunk = line + "\n";
        }
      } else {
        currentChunk += line + "\n";
      }
    }
    if (currentChunk.trim().length > 0) chunks.push(currentChunk.trim());
    if (chunks.length === 0) chunks.push("...");

    const headTitle = `${ui.getEmoji("naura") || "\ud83d\udcac"} Naura menjawab`;

    for (let i = 0; i < chunks.length; i++) {
      const isFirst = i === 0;
      const isLast = i === chunks.length - 1;

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        authorName: isFirst ? "Naura AI" : undefined,
        title: isFirst ? headTitle : undefined,
        iconURL: isFirst ? client.user.displayAvatarURL() : undefined,
        description: chunks[i] || "...",
        footerText: isLast
          ? `Powered by Naura Intelligent System \u2022 Untuk ${message.author.displayName || message.author.username}`
          : undefined,
      });

      if (isFirst) {
        await message.reply(payload).catch(() => {});
      } else {
        await message.channel.send(payload).catch(() => {});
      }
    }

    // Jalankan ekstraksi memori otomatis di latar belakang (non-blocking)
    AIMemory.extractAndSave(
      message.author.id,
      userMessage,
      replyText,
      gemini,
    ).catch((err) => {
      logger.warn(
        "[AI Router] Background memory extraction error:",
        err.message,
      );
    });

    if (
      settings &&
      settings.aiVoiceEnabled &&
      message.member &&
      message.member.voice.channel
    ) {
      const VoiceManager = require("../managers/voiceManager");
      VoiceManager.speak(replyText, message.member).catch((err) => {
        logger.error("[TTS EXECUTION ERROR]", err);
      });
    }
  }
}

module.exports = AIRouterManager;
