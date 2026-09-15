const redisManager = require("../managers/redisManager");
const { logger } = require("../managers/logger");
const RateLimiter = require("../utils/rateLimiter");

const BAD_WORDS = [
  "anjing",
  "bangsat",
  "kontol",
  "babi",
  "ngentot",
  "memek",
  "jembut",
  "tolol",
  "goblok",
];
const PROMPT_INJECTIONS = [
  "abaikan instruksi",
  "ignore previous instructions",
  "abaikan semua",
  "abaikan prompt",
  "system prompt",
];

async function checkModeration(text) {
  const lowerText = text.toLowerCase();

  // Check bad words
  for (const word of BAD_WORDS) {
    if (lowerText.includes(word)) {
      return { flagged: true, reason: "Kata kasar terdeteksi" };
    }
  }

  // Check prompt injection
  for (const phrase of PROMPT_INJECTIONS) {
    if (lowerText.includes(phrase)) {
      return {
        flagged: true,
        reason: "Percobaan manipulasi AI (Prompt Injection) terdeteksi",
      };
    }
  }

  return { flagged: false };
}

async function checkRateLimit(userId, isOwner, isPremium) {
  if (isOwner) return { allowed: true }; // Owner unlimited

  const maxRequests = isPremium ? 15 : 5;
  const windowSeconds = 60; // 1 minute

  try {
    const { limited, retryAfter } = await RateLimiter.consume(
      userId,
      "ai",
      maxRequests,
      windowSeconds,
    );

    if (limited) {
      return { allowed: false, retryAfter };
    }

    return { allowed: true };
  } catch (e) {
    logger.error("[RATE LIMIT ERROR]", e);
    return { allowed: true }; // Fail open
  }
}

async function simulateTypingDelay(replyText) {
  const charCount = replyText.length;
  let delayMs = Math.floor(charCount * 25);

  if (delayMs > 5000) delayMs = 5000;
  if (delayMs < 1000) delayMs = 1000;

  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function performWebSearchIfNeeded(text) {
  const searchKeywords = [
    "siapa",
    "apa",
    "kapan",
    "dimana",
    "bagaimana",
    "kenapa",
    "cari",
    "info",
    "harga",
  ];
  const lowerText = text.toLowerCase();

  let needsSearch = false;
  for (const kw of searchKeywords) {
    if (lowerText.includes(kw)) {
      needsSearch = true;
      break;
    }
  }

  if (!needsSearch) return null;

  try {
    // googlethis di-require di sini, bukan di puncak berkas. Sebagian besar
    // pesan tidak memicu pencarian, jadi modulnya tidak perlu ikut dimuat
    // saat boot hanya karena aiHelper.js ikut ter-require.
    const google = require("googlethis");

    const options = {
      page: 0,
      safe: false,
      additional_params: { hl: "id" },
    };
    const response = await google.search(text, options);

    let searchContext = "\n\n[HASIL PENCARIAN GOOGLE TERKINI]:\n";

    if (response.knowledge_panel.title) {
      searchContext += `- ${response.knowledge_panel.title}: ${response.knowledge_panel.description}\n`;
    }

    const topResults = response.results.slice(0, 3);
    topResults.forEach((res) => {
      searchContext += `- ${res.title}: ${res.description}\n`;
    });

    return searchContext;
  } catch (e) {
    logger.error("[WEB SEARCH ERROR]", e);
    return null;
  }
}

async function updateGeminiHistory(userId, role, content) {
  if (!redisManager.client || !redisManager.client.isReady) return;

  const key = `gemini_history_${userId}`;
  try {
    let history = (await redisManager.getCache(key)) || [];
    history.push({ role, parts: [{ text: content }] });

    if (history.length > 20) {
      const AIMemory = require("./aiMemory");
      const geminiClient = require("./geminiClient");
      if (geminiClient.isAvailable()) {
        history = await AIMemory.compressHistoryIfNeeded(
          geminiClient,
          history,
          userId,
        );
      } else {
        history = history.slice(history.length - 20);
      }
    }

    await redisManager.setCache(key, history, 86400); // 24 hours
  } catch (e) {
    logger.error("[GEMINI HISTORY ERROR]", e);
  }
}

async function getGeminiHistory(userId) {
  if (!redisManager.client || !redisManager.client.isReady) return [];

  const key = `gemini_history_${userId}`;
  try {
    const data = await redisManager.getCache(key);
    if (Array.isArray(data)) return data;
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        return [];
      }
    }
    return [];
  } catch (e) {
    return [];
  }
}

// Satu titik ekspor. Sebelumnya berkas ini memanggil module.exports di tengah
// berkas lalu menambal dua fungsi lagi di bawahnya, yang membuat urutan
// deklarasi jadi penting tanpa alasan.
module.exports = {
  checkModeration,
  checkRateLimit,
  simulateTypingDelay,
  performWebSearchIfNeeded,
  updateGeminiHistory,
  getGeminiHistory,
};
