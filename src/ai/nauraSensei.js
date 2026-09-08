"use strict";

/**
 * @namespace: src/ai/nauraSensei.js
 * @type: Service / AI Engine
 * @description: Naura Sensei, Knowledge Tutor & Onboarding Companion untuk seluruh fitur bot
 */

const { logger } = require("../managers/logger");
const geminiClient = require("./geminiClient");

// Basis Pengetahuan Komprehensif Sistem Naura Hoshino V2
const SYSTEM_KNOWLEDGE_BASE = [
  {
    topic: "survival_rpg",
    title: "Sistem Survival & RPG Naura Wilds",
    keywords: [
      "survival",
      "rpg",
      "dungeon",
      "abyss",
      "boss",
      "level",
      "stamina",
      "hp",
      "strength",
      "agility",
      "luck",
      "craft",
      "gathering",
      "chop",
      "mine",
      "fish",
      "rebirth",
    ],
    summary:
      "Sistem Survival RPG Naura Wilds memiliki 41+ fitur:\n" +
      "• **Memulai:** `/survival start` untuk starter kit.\n" +
      "• **Gathering:** `/survival mine` (tambang ore), `/survival chop` (kayu), `/survival fish` (ikan).\n" +
      "• **Combat & Hunting:** `/survival dungeon` (lawan monster lantai), `/survival abyss` (tower tantangan tanpa batas), `/survival raid` (world boss multiplayer).\n" +
      "• **Stats & Vitals:** HP, Stamina, STR, AGI, INT, LCK. Konsumsi makanan via `/survival consume` atau istirahat via `/survival rest`.\n" +
      "• **Rebirth:** Capai Level 100 untuk melakukan `/survival rebirth` membuka bonus stat multiplier permanen.\n" +
      "• **Mata Uang:** Star Fragments (mata uang RPG) dan Naura Coupon (mata uang terlangka).",
  },
  {
    topic: "economy_finance",
    title: "Sistem Ekonomi, Investasi & Daily Streak",
    keywords: [
      "ekonomi",
      "economy",
      "duit",
      "uang",
      "gold",
      "wallet",
      "bank",
      "daily",
      "streak",
      "stock",
      "saham",
      "predict",
      "market",
      "auction",
      "lelang",
    ],
    summary:
      "Sistem Finansial & Pasar Naura:\n" +
      "• **Daily Login Streak:** Gunakan `/daily` setiap hari untuk mendapatkan Gold, Star Fragments, dan Naura Coupons di Day 5 & 7.\n" +
      "• **Bank & Bunga:** Simpan uang di `/survival bank` atau deposito dengan bunga harian.\n" +
      "• **Pasar Saham ($NRA):** Beli saham server di `/stock buy` dengan harga fluktuatif real-time.\n" +
      "• **Prediction Market:** Taruhan hasil event komunitas di `/predict`.\n" +
      "• **Auction House:** Lelang item langka dan kartu anime di `/survival auction`.",
  },
  {
    topic: "card_tcg",
    title: "Anime TCG & Tower of Babel",
    keywords: [
      "card",
      "kartu",
      "tcg",
      "babel",
      "deck",
      "gacha",
      "fusion",
      "awakening",
      "print",
      "rarity",
      "battle",
    ],
    summary:
      "Sistem Koleksi Kartu Anime TCG:\n" +
      "• **Dapatkan Kartu:** `/card drop` (setiap beberapa jam) atau klaim `/card daily`.\n" +
      "• **Rarity:** N, R, SR, SSR, hingga UR dengan serial number (Print #1).\n" +
      "• **Tower of Babel:** Susun 3 kartu terkuatmu di `/card deck` dan panjat tower di `/card tower`.\n" +
      "• **Card Fusion & Awakening:** Gabungkan kartu duplikat untuk membuka status AWAKENED dengan aura petir.",
  },
  {
    topic: "pets_vivarium",
    title: "Sistem Pet & Habitat Vivarium",
    keywords: [
      "pet",
      "hewan",
      "peliharaan",
      "vivarium",
      "mood",
      "evolution",
      "cosmic",
      "feed",
      "habitat",
    ],
    summary:
      "Sistem Peliharaan Digital & Vivarium:\n" +
      "• **Adopsi & Tangkap:** `/survival pet adopt` atau temukan di dungeon.\n" +
      "• **Rawat:** Beri makan (`/survival pet feed`) dan ajak main agar mood tetap Happy.\n" +
      "• **Evolution & Cosmic Aura:** Naikkan level pet ke batas maksimal untuk membuka Cosmic Ascended status.\n" +
      "• **Passive Skills:** Pet aktif memberikan buff stat (misal: +10% Gold drop atau +15% XP).",
  },
  {
    topic: "music_audio",
    title: "Lavalink Audio & AI DJ",
    keywords: [
      "music",
      "musik",
      "lagu",
      "play",
      "queue",
      "spotify",
      "quiz",
      "karaoke",
      "lofi",
      "filter",
    ],
    summary:
      "Sistem Musik Berkualitas Tinggi:\n" +
      "• **Putar Lagu:** `/music play <judul/link>` (mendukung Spotify, YouTube, SoundCloud).\n" +
      "• **Music Quiz:** Tebak intro lagu bersama teman di `/music quiz`.\n" +
      "• **DSP Audio Filters:** Nightcore, Vaporwave, 8D Audio, Bassboost via `/music filter`.\n" +
      "• **Analytics:** Lihat total durasi mendengar dan top track di `/music profile`.",
  },
  {
    topic: "portfolio_custom",
    title: "Member Web Portfolio & 3D Dashboard",
    keywords: [
      "portfolio",
      "web",
      "profile",
      "profil",
      "3d",
      "pamer",
      "badge",
      "theme",
      "showcase",
    ],
    summary:
      "Sistem Web Portfolio Publik Member:\n" +
      "• **Atur di Discord:** `/portfolio bio`, `/portfolio tagline`, `/portfolio theme`.\n" +
      "• **Buka ke Publik:** `/portfolio toggle` untuk mempublikasikan halaman portfoliomu.\n" +
      "• **Link Publik:** Bagikan link `.../u/<userId>` ke temanmu untuk memamerkan stats, pet, klan, dan koleksi kartumu!",
  },
];

class NauraSensei {
  /**
   * Cari topik bantuan yang relevan dengan pertanyaan user
   * @param {string} query
   * @returns {Array<object>}
   */
  searchTopics(query) {
    if (!query || typeof query !== "string") return [SYSTEM_KNOWLEDGE_BASE[0]];
    const q = query.toLowerCase();
    const keywords = q
      .replace(/[^\w\s]/g, "")
      .split(/\s+/)
      .filter((w) => w.length > 2);

    const scored = SYSTEM_KNOWLEDGE_BASE.map((topic) => {
      let score = 0;
      for (const kw of keywords) {
        if (topic.keywords.some((k) => k.includes(kw) || kw.includes(k)))
          score += 2;
        if (topic.title.toLowerCase().includes(kw)) score += 3;
        if (topic.summary.toLowerCase().includes(kw)) score += 1;
      }
      return { ...topic, score };
    });

    const matches = scored
      .filter((s) => s.score > 0)
      .sort((a, b) => b.score - a.score);
    return matches.length > 0 ? matches : [SYSTEM_KNOWLEDGE_BASE[0]];
  }

  /**
   * Berikan penjelasan AI ramah gaya Naura Sensei
   * @param {string} userQuestion
   * @param {string} userName
   * @returns {Promise<{ reply: string, topic: string, commands: string[] }>}
   */
  async ask(userQuestion, userName = "Petualang") {
    const matchedTopics = this.searchTopics(userQuestion);
    const primaryTopic = matchedTopics[0];

    const contextDoc = matchedTopics
      .map((t) => `### ${t.title}\n${t.summary}`)
      .join("\n\n");

    const systemPrompt =
      `Kamu adalah **Naura Sensei**, mentor dan pemandu AI yang ceria, pintar, dan berpengetahuan luas tentang semua sistem bot Naura Hoshino V2.\n` +
      `Gunakan nada bicara ramah, antusias ala anime kawaii kawaii-mentor, dan jelaskan dengan struktur yang rapi (gunakan bullet points, bold, dan rekomendasi command konkret).\n` +
      `Sebut nama pengguna: ${userName}.\n\n` +
      `DOKUMENTASI SISTEM BOT NAURA:\n${contextDoc}\n\n` +
      `Instruksi:\n` +
      `1. Jawab pertanyaan pengguna secara spesifik berdasarkan dokumentasi di atas.\n` +
      `2. Berikan command Discord yang tepat (misal: \`/survival start\`, \`/daily\`, \`/card drop\`).\n` +
      `3. Berikan 1 tips rahasia (Pro-Tip) yang menguntungkan pemain.\n` +
      `4. Jaga panjang respon dalam 3-4 paragraf yang nyaman dibaca di Discord.`;

    try {
      const aiResponse = await geminiClient.generateText(
        systemPrompt,
        userQuestion,
      );
      if (aiResponse && aiResponse.text) {
        return {
          reply: aiResponse.text,
          topic: primaryTopic.title,
          topicKey: primaryTopic.topic,
        };
      }
    } catch (err) {
      logger.warn(
        `[NauraSensei] AI fallback to static summary: ${err.message}`,
      );
    }

    // Fallback natural jika AI offline
    return {
      reply:
        `Halo Kak **${userName}**! Naura Sensei siap membantu! 🎓✨\n\n` +
        `**Mengenai ${primaryTopic.title}:**\n` +
        `${primaryTopic.summary}\n\n` +
        `💡 **Pro-Tip dari Sensei:** Jangan lupa selalu jalankan \`/daily\` setiap hari dan cek \`/survival quest\` untuk mempercepat perkembangan karaktermu!`,
      topic: primaryTopic.title,
      topicKey: primaryTopic.topic,
    };
  }
}

module.exports = new NauraSensei();
module.exports.SYSTEM_KNOWLEDGE_BASE = SYSTEM_KNOWLEDGE_BASE;
