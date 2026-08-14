"use strict";

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

const FILE_NAME = "naura_art.png";
const VERBA_URL = "https://api.verba.ink/v1/image";
const POLLINATIONS_URL = "https://image.pollinations.ai/prompt";
const FETCH_TIMEOUT_MS = 120000;

// ==========================================
// STYLE PRESETS
// Setiap gaya menambahkan trigger words ke prompt asli agar hasil lebih terarah.
// ==========================================
const STYLE_PRESETS = {
  "kawaii-anime": {
    label: "Kawaii Anime",
    suffix:
      ", anime style, kawaii, vibrant colors, soft lighting, detailed illustration, Makoto Shinkai style, high quality",
  },
  cyberpunk: {
    label: "Cyberpunk",
    suffix:
      ", cyberpunk, neon lights, futuristic city, dark atmosphere, rain, digital art, blade runner aesthetic, 8K",
  },
  realistic: {
    label: "Realistis",
    suffix:
      ", hyperrealistic, DSLR photograph, 8K ultra HD, photorealistic, bokeh, professional lighting",
  },
  watercolor: {
    label: "Cat Air",
    suffix:
      ", watercolor painting, soft brush strokes, artistic, pastel colors, flowing ink, traditional art style",
  },
  fantasy: {
    label: "Fantasi Epik",
    suffix:
      ", epic fantasy, dramatic lighting, concept art, artstation, magical atmosphere, cinematic, highly detailed",
  },
  none: {
    label: "Prompt Murni",
    suffix: "",
  },
};

// Gaya default bila tidak dipilih
const DEFAULT_STYLE = "kawaii-anime";

// Rate limit: jumlah max request per window
const RATE_LIMIT_NORMAL = 3; // non-premium
const RATE_LIMIT_PREMIUM = 10; // premium
const RATE_LIMIT_WINDOW = 300; // 5 menit (detik)

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

// ==========================================
// RATE LIMITING
// ==========================================
async function checkRateLimit(userId, isPremiumUser) {
  const limit = isPremiumUser ? RATE_LIMIT_PREMIUM : RATE_LIMIT_NORMAL;
  const key = `ratelimit:imagine:${userId}`;

  // Jika Redis tidak siap, izinkan saja (degraded mode)
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

// ==========================================
// GENERATOR FUNCTIONS (Pipeline: Gemini → Verba → Fooocus → Pollinations)
// ==========================================

/** Sumber 1: Google Gemini Imagen. Gratis dalam batas dan berkualitas tinggi. */
async function generateWithGemini(prompt) {
  if (!env.GEMINI_API) throw new Error("GEMINI_API tidak dikonfigurasi.");

  const { GoogleGenAI } = require("@google/genai");
  const client = new GoogleGenAI({ apiKey: env.GEMINI_API });

  // Gemini Imagen 3 (model terbaru untuk generasi gambar)
  const response = await client.models.generateImages({
    model: "imagen-3.0-generate-002",
    prompt,
    config: {
      numberOfImages: 1,
      outputMimeType: "image/png",
    },
  });

  const base64 = response.generatedImages?.[0]?.image?.imageBytes;
  if (!base64) throw new Error("Gemini Imagen tidak mengembalikan gambar.");

  return `data:image/png;base64,${base64}`;
}

/** Sumber 2: Verba API. Diprioritaskan bila API key tersedia. */
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
    throw new Error(`Verba API error: ${detail}`);
  }

  const data = response.data || {};
  const url =
    data.url ||
    data.image ||
    data.imageUrl ||
    data.image_url ||
    data.data?.[0]?.url ||
    data.choices?.[0]?.url;

  if (!url) throw new Error("Format balasan API gambar Verba tidak dikenali.");
  return url;
}

/** Sumber 3: Fooocus lokal. Wajib pakai env.FOOOCUS_BASE_URL (bukan process.env langsung). */
async function generateWithFooocus(prompt) {
  const baseUrl = env.FOOOCUS_BASE_URL; // Perbaikan bug: env.js bukan process.env
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
  throw new Error("Format balasan Fooocus tidak valid.");
}

/** Sumber 4: Pollinations AI. Fallback gratis yang selalu tersedia. */
function pollinationsUrl(prompt) {
  const encoded = encodeURIComponent(prompt);
  return `${POLLINATIONS_URL}/${encoded}?width=512&height=512&nologo=true&enhance=true`;
}

/**
 * Coba semua sumber gambar secara berurutan.
 * Mengembalikan { url, source } dari sumber pertama yang berhasil.
 */
async function tryAllSources(prompt) {
  // Sumber 1: Gemini Imagen
  if (env.GEMINI_API) {
    try {
      const url = await generateWithGemini(prompt);
      return { url, source: "Gemini Imagen 3" };
    } catch (err) {
      logger.warn(`[AI Imagine] Gemini Imagen gagal: ${err.message}`);
    }
  }

  // Sumber 2: Verba API
  if (env.VERBA_API_KEY) {
    try {
      const url = await generateWithVerba(prompt);
      return { url, source: "Verba Image API" };
    } catch (err) {
      logger.warn(`[AI Imagine] Verba gagal: ${err.message}`);
    }
  }

  // Sumber 3: Fooocus lokal
  try {
    const url = await generateWithFooocus(prompt);
    return { url, source: "Fooocus Local AI" };
  } catch (err) {
    logger.warn(`[AI Imagine] Fooocus gagal: ${err.message}`);
  }

  // Sumber 4: Pollinations (selalu berhasil selama ada internet)
  return { url: pollinationsUrl(prompt), source: "Pollinations AI" };
}

/**
 * Ubah URL atau base64 menjadi AttachmentBuilder nyata untuk Discord.
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

// ==========================================
// HANDLER UTAMA
// ==========================================
module.exports = async function imagine(interaction, { isPremiumUser }) {
  const prompt = interaction.options.getString("prompt");
  const gaya = interaction.options.getString("gaya") || DEFAULT_STYLE;
  const jumlahRaw = interaction.options.getInteger("jumlah") || 1;

  // Pengguna non-premium tidak bisa multi-gambar dan mengakses fitur ini
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

  // Rate limiting
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

  // Jumlah gambar: non-premium dibatasi 1, premium maks 4
  const jumlah = isPremiumUser ? Math.min(jumlahRaw, 4) : 1;

  // Ambil style preset dan bangun prompt akhir
  const stylePreset = STYLE_PRESETS[gaya] || STYLE_PRESETS[DEFAULT_STYLE];
  const enhancedPrompt = prompt + stylePreset.suffix;

  try {
    // Generate semua gambar secara paralel
    const generateTasks = Array.from({ length: jumlah }, (_, i) =>
      tryAllSources(enhancedPrompt).catch((err) => {
        logger.error(`[AI Imagine] Variasi ${i + 1} gagal:`, err);
        return null;
      }),
    );
    const results = (await Promise.all(generateTasks)).filter(Boolean);

    if (results.length === 0) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: `${e("cry", "❌")} Lukisan Gagal`,
          description:
            "Semua sumber gambar tidak dapat dihubungi. Coba lagi dalam beberapa saat ya!",
          footerText: ui.getFooter("core"),
        }),
      );
    }

    // Convert semua hasil ke attachment
    const attachments = [];
    const attachmentNames = [];
    for (let i = 0; i < results.length; i++) {
      const fileName =
        results.length > 1 ? `naura_art_${i + 1}.png` : FILE_NAME;
      try {
        const att = await toAttachment(results[i].url, fileName);
        attachments.push(att);
        attachmentNames.push(fileName);
      } catch (err) {
        logger.error(`[AI Imagine] Gagal mengunduh variasi ${i + 1}:`, err);
      }
    }

    if (attachments.length === 0) {
      return interaction.editReply(
        buildErrorContainerV2({
          title: `${e("cry", "❌")} Gagal Mengambil Gambar`,
          description:
            "Gambarnya sudah jadi, tapi Naura kesulitan mengambilnya. Coba sekali lagi yaa?",
          footerText: ui.getFooter("core"),
        }),
      );
    }

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
      // Gambar pertama sebagai banner, sisanya sebagai media gallery
      bannerAttachmentName: attachmentNames[0],
      mediaAttachmentNames: attachmentNames.slice(1),
      files: attachments,
      footerText: `${primarySource} \u2022 ${remainingInfo}`,
    });

    return interaction.editReply(payload);
  } catch (error) {
    logger.error("[AI Imagine] Error tidak terduga:", error);
    return interaction.editReply(
      buildErrorContainerV2({
        title: `${e("cry", "❌")} Terjadi Kesalahan`,
        description:
          "Ada masalah yang tidak terduga. Naura sudah mencatatnya ya!",
        footerText: ui.getFooter("core"),
      }),
    );
  }
};
