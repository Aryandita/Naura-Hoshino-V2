"use strict";

/**
 * 🎨 Imagine Subcommand - AI Image Generation - Naura Hoshino V2
 * ---------------------------------------------------------------
 * Generates images using multiple AI sources with fallback pipeline.
 * Supports style presets, rate limiting, and premium-only access.
 *
 * Features:
 * - Multi-source image generation (Gemini → Verba → Fooocus → Pollinations)
 * - 6 style presets (Kawaii Anime, Cyberpunk, Realistic, Watercolor, Fantasy, Pure)
 * - Rate limiting via Redis (3/5min normal, 10/5min premium)
 * - Premium-only feature gating
 * - Parallel multi-image generation (up to 4 variations)
 * - Automatic fallback between sources
 *
 * @module plugin/ai/subcommands/imagine
 */

const { AttachmentBuilder } = require("discord.js");
const axios = require("axios");

const ui = require("../../../src/config/ui");
const env = require("../../../src/config/env");
const { logger } = require("../../../src/managers/logger");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const redisManager = require("../../../src/managers/redisManager");
const { DomainError } = require("../../../src/errors/DomainError");

// ============================================================================
// CONSTANTS
// ============================================================================

/** Default filename for generated images */
const FILE_NAME = "naura_art.png";

/** API endpoints */
const VERBA_URL = "https://api.verba.ink/v1/image";
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";

/** Timeout for external API calls (2 minutes) */
const FETCH_TIMEOUT_MS = 120000;

/** Rate limit configuration */
const RATE_LIMIT_NORMAL = 3;      // non-premium requests per window
const RATE_LIMIT_PREMIUM = 10;    // premium requests per window
const RATE_LIMIT_WINDOW = 300;    // 5 minutes in seconds

/** Default style preset */
const DEFAULT_STYLE = "kawaii-anime";

/** Style presets with prompt suffixes for better results */
const STYLE_PRESETS = {
  "kawaii-anime": {
    label: "Kawaii Anime",
    suffix: ", anime style, kawaii, vibrant colors, soft lighting, detailed illustration, Makoto Shinkai style, high quality",
  },
  cyberpunk: {
    label: "Cyberpunk",
    suffix: ", cyberpunk, neon lights, futuristic city, dark atmosphere, rain, digital art, blade runner aesthetic, 8K",
  },
  realistic: {
    label: "Realistis",
    suffix: ", hyperrealistic, DSLR photograph, 8K ultra HD, photorealistic, bokeh, professional lighting",
  },
  watercolor: {
    label: "Cat Air",
    suffix: ", watercolor painting, soft brush strokes, artistic, pastel colors, flowing ink, traditional art style",
  },
  fantasy: {
    label: "Fantasi Epik",
    suffix: ", epic fantasy, dramatic lighting, concept art, artstation, magical atmosphere, cinematic, highly detailed",
  },
  none: {
    label: "Prompt Murni",
    suffix: "",
  },
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Get emoji by name with fallback.
 * @param {string} name - Emoji key
 * @param {string} fallback - Fallback emoji
 * @returns {string} Resolved emoji
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Check rate limit for user via Redis.
 * @param {string} userId - User ID
 * @param {boolean} isPremiumUser - Is premium user
 * @returns {Promise<{allowed: boolean, remaining: number, used?: number, limit?: number}>}
 */
async function checkRateLimit(userId, isPremiumUser) {
  const limit = isPremiumUser ? RATE_LIMIT_PREMIUM : RATE_LIMIT_NORMAL;
  const key = `ratelimit:imagine:${userId}`;

  // Allow if Redis not ready (degraded mode)
  if (!redisManager.isReady) return { allowed: true, remaining: limit - 1 };

  const count = await redisManager.increment(key, RATE_LIMIT_WINDOW);
  if (count === null) return { allowed: true, remaining: limit - 1 };

  const remaining = Math.max(0, limit - count);
  return {
    allowed: count <= limit,
    remaining,
    used: count,
    limit,
  };
}

// ============================================================================
// IMAGE GENERATION SOURCES
// ============================================================================

/**
 * Source 1: Google Gemini Imagen (high quality, free tier available).
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} Image URL or base64 data URI
 * @throws {DomainError} If generation fails
 */
async function generateWithGemini(prompt) {
  if (!env.GEMINI_API) {
    throw new DomainError("CONFIG_ERROR", "GEMINI_API tidak dikonfigurasi.");
  }

  const { GoogleGenAI } = require("@google/genai");
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API });

  // Gemini Imagen 3 (latest model for image generation)
  const response = await client.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: "image/png",
    },
  });

  const base64 = response.generatedImages?.[0]?.image?.imageBytes;
  if (!base64) {
    throw new DomainError("EMPTY_GENERATION", "Gemini Imagen tidak mengembalikan gambar.");
  }

  return `data:image/png;base64,${base64}`;
}

/**
 * Source 2: Verba API (prioritized when API key available).
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} Image URL
 * @throws {DomainError} If API call fails
 */
async function generateWithVerba(prompt) {
  const response = await axios.post(
    VERBA_URL,
    {
      character: env.VERBA_CHARACTER_SLUG || "naura",
      prompt,
      size: "512x512",
    },
    {
      headers: {
        Authorization: `Bearer ${env.VERBA_API_KEY}`,
        "Content-Type": "application/json",
      },
      timeout: FETCH_TIMEOUT_MS,
      validateStatus: () => true,
    },
  );

  if (response.status < 200 || response.status >= 300) {
    const detail =
      response.data?.error?.message ||
      response.data?.message ||
      `HTTP ${response.status}`;
    throw new DomainError("EXTERNAL_API_ERROR", `Verba API error: ${detail}`, {
      status: response.status,
      detail,
    });
  }

  const data = response.data || {};
  const url =
    data.url ||
    data.image ||
    data.imageUrl ||
    data.image_url ||
    data.data?.[0]?.url ||
    data.choices?.[0]?.url;

  if (!url) {
    throw new DomainError("INVALID_RESPONSE_FORMAT", "Format balasan API gambar Verba tidak dikenali.");
  }
  return url;
}

/**
 * Source 3: Local Fooocus instance (requires env.FOOOCUS_BASE_URL).
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<string>} Image URL or base64 data URI
 * @throws {DomainError} If generation fails
 */
async function generateWithFooocus(prompt) {
  const baseUrl = env.FOOOCUS_BASE_URL;
  const response = await axios.post(
    `${baseUrl}/v1/generation/text-to-image`,
    {
      prompt,
      performance_selection: "Speed",
      aspect_ratios_selection: "1024*1024",
      image_number: 1,
    },
    {
      headers: { "Content-Type": "application/json" },
      timeout: FETCH_TIMEOUT_MS,
    },
  );

  const first = Array.isArray(response.data) ? response.data[0] : null;
  if (first?.base64) return `data:image/png;base64,${first.base64}`;
  if (first?.url) return first.url;
  throw new DomainError("INVALID_RESPONSE_FORMAT", "Format balasan Fooocus tidak valid.");
}

/**
 * Source 4: Pollinations AI (free fallback, always available).
 * @param {string} prompt - Enhanced prompt
 * @returns {string} Image URL
 */
function pollinationsUrl(prompt) {
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_URL}/${encoded}?width=512&height=512&nologo=true&enhance=true`;
}

/**
 * Try all image sources in order, return first successful result.
 * Pipeline: Gemini → Verba → Fooocus → Pollinations
 * @param {string} prompt - Enhanced prompt
 * @returns {Promise<{url: string, source: string}>} Generated image info
 */
async function tryAllSources(prompt) {
  // Source 1: Gemini Imagen
  if (env.GEMINI_API) {
    try {
      const url = await generateWithGemini(prompt);
      return { url, source: "Gemini Imagen 3" };
    } catch (err) {
      logger.warn(`[AI Imagine] Gemini Imagen failed: ${err.message}`);
    }
  }

  // Source 2: Verba API
  if (env.VERBA_API_KEY) {
    try {
      const url = await generateWithVerba(prompt);
      return { url, source: "Verba Image API" };
    } catch (err) {
      logger.warn(`[AI Imagine] Verba failed: ${err.message}`);
    }
  }

  // Source 3: Local Fooocus
  try {
    const url = await generateWithFooocus(prompt);
    return { url, source: "Fooocus Local AI" };
  } catch (err) {
    logger.warn(`[AI Imagine] Fooocus failed: ${err.message}`);
  }

  // Source 4: Pollinations (always works with internet)
  return { url: pollinationsUrl(prompt), source: "Pollinations AI" };
}

/**
 * Convert URL or base64 to Discord AttachmentBuilder.
 * @param {string} imageUrl - Image URL or base64 data URI
 * @param {string} [fileName=FILE_NAME] - Output filename
 * @returns {Promise<AttachmentBuilder>} Discord attachment
 */
async function toAttachment(imageUrl, fileName = FILE_NAME) {
  if (imageUrl.startsWith("data:image")) {
    const base64 = imageUrl.replace(/^data:image\/\w+;base64,/, "");
    return new AttachmentBuilder(Buffer.from(base64, "base64"), {
      name: fileName,
    });
  }

  const download = await axios.get(imageUrl, {
    responseType: "arraybuffer",
    timeout: FETCH_TIMEOUT_MS,
  });
  return new AttachmentBuilder(Buffer.from(download.data), { name: fileName });
}

// ============================================================================
// MAIN HANDLER
// ============================================================================

/**
 * Execute imagine subcommand.
 * Generates AI images with style presets and rate limiting.
 * @param {object} interaction - Discord interaction
 * @param {{isPremiumUser: boolean}} options - User premium status
 * @returns {Promise<void>}
 */
module.exports = async function imagine(interaction, { isPremiumUser }) {
  // Extract options
  const prompt = interaction.options.getString("prompt");
  const gaya = interaction.options.getString("gaya") || DEFAULT_STYLE;
  const jumlahRaw = interaction.options.getInteger("jumlah") || 1;

  // Premium-only feature gate
  if (!isPremiumUser) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${e("hmph", "💎")} Fitur khusus V.I.P`,
        description:
          "Maaf yaa, melukis gambar resolusi tinggi itu berat sekali buat server Naura. " +
          "Fitur ini khusus untuk member **Premium**. Naura tunggu kamu di sana!",
        footerText: ui.getFooter("core"),
      }),
    );
  }

  // Rate limiting check
  const rateCheck = await checkRateLimit(interaction.user.id, isPremiumUser);
  if (!rateCheck.allowed) {
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${e("clock", "⏱️")} Terlalu Cepat!`,
        description: `Naura sedang kelelahan melukis! Kamu sudah membuat ${rateCheck.used} gambar dalam 5 menit terakhir.\nLimit: **${rateCheck.limit}x / 5 menit**. Coba lagi sebentar lagi ya!`,
        footerText: ui.getFooter("core"),
      }),
    );
  }

  // Limit image count (non-premium: 1, premium: max 4)
  const jumlah = isPremiumUser ? Math.min(jumlahRaw, 4) : 1;

  // Apply style preset to prompt
  const stylePreset = STYLE_PRESETS[gaya] || STYLE_PRESETS[DEFAULT_STYLE];
  const enhancedPrompt = prompt + stylePreset.suffix;

  try {
    // Generate all images in parallel
    const generateTasks = Array.from({ length: jumlah }, (_, i) =>
      tryAllSources(enhancedPrompt).catch((err) => {
        logger.error(`[AI Imagine] Variation ${i + 1} failed:`, err);
        return null;
      }),
    );
    const results = (await Promise.all(generateTasks)).filter(Boolean);

    if (results.length === 0) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: `${e("cry", "❌")} Lukisan Gagal`,
          description: "Semua sumber gambar tidak dapat dihubungi. Coba lagi dalam beberapa saat ya!",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    // Convert all results to attachments
    const attachments = [];
    const attachmentNames = [];
    for (let i = 0; i < results.length; i++) {
      const fileName = results.length > 1 ? `naura_art_${i + 1}.png` : FILE_NAME;
      try {
        const att = await toAttachment(results[i].url, fileName);
        attachments.push(att);
        attachmentNames.push(fileName);
      } catch (err) {
        logger.error(`[AI Imagine] Failed to download variation ${i + 1}:`, err);
      }
    }

    if (attachments.length === 0) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: `${e("cry", "❌")} Gagal Mengambil Gambar`,
          description: "Gambarnya sudah jadi, tapi Naura kesulitan mengambilnya. Coba sekali lagi yaa?",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    // Build success response
    const primarySource = results[0]?.source || "AI Generator";
    const styleLabel = stylePreset.label;
    const remainingInfo =
      rateCheck.remaining > 0
        ? `${rateCheck.remaining} slot tersisa hari ini`
        : "limit habis";

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Art Studio",
      title: `${e("impressed", "🎨")} Kanvas ${jumlah > 1 ? `${attachments.length} Variasi` : ""} Siap!`,
      iconURL: interaction.client.user.displayAvatarURL(),
      description:
        `Naura lukis sepenuh hati buat kamu, semoga suka yaa!\n\n` +
        `> **Prompt:** *${prompt}*\n` +
        `> **Gaya:** ${styleLabel}\n` +
        (jumlah > 1 ? `> **Variasi:** ${attachments.length} gambar\n` : ""),
      bannerAttachmentName: attachmentNames[0],
      mediaAttachmentNames: attachmentNames.slice(1),
      files: attachments,
      footerText: `${primarySource} • ${remainingInfo}`,
    });

    return interaction.editReply(payload);
  } catch (error) {
    logger.error("[AI Imagine] Unexpected error:", error);
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${e("cry", "❌")} Terjadi Kesalahan`,
        description: "Ada masalah yang tidak terduga. Naura sudah mencatatnya ya!",
        footerText: ui.getFooter("core"),
      }),
    );
  }
};
