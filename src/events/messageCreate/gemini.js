const { GoogleGenAI } = require("@google/genai");
const env = require("../../config/env");

/**
 * Satu titik masuk untuk seluruh pemanggilan Gemini di alur messageCreate.
 *
 * Dulu setiap blok membuat kliennya sendiri dengan env.GEMINI_API, padahal
 * env.js mendefinisikan GEMINI_API_KEY. Akibatnya klien selalu null dan
 * kegagalannya tertelan diam-diam oleh blok catch di sekitarnya.
 */
const MODEL = "gemini-3.6-flash";

const client = env.GEMINI_API_KEY
  ? new GoogleGenAI({ apiKey: env.GEMINI_API_KEY })
  : null;

function isAvailable() {
  return Boolean(client);
}

/**
 * SDK @google/genai memakai models.generateContent() dan mengembalikan teks
 * lewat properti .text, bukan getGenerativeModel() dan response.response.text()
 * milik paket lama @google/generative-ai.
 *
 * @returns {Promise<string|null>} null bila kunci API tidak dipasang.
 */
async function generateText(prompt) {
  if (!client) return null;

  const response = await client.models.generateContent({
    model: MODEL,
    contents: prompt,
  });

  return typeof response.text === "string" ? response.text.trim() : null;
}

module.exports = { MODEL, isAvailable, generateText };
