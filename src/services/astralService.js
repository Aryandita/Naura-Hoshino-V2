"use strict";

const redisManager = require("../managers/redisManager");

const ASTRAL_WEATHERS = [
  {
    id: "aurora_fortune",
    name: "Aurora of Fortune",
    emoji: "✨",
    color: "#10B981",
    secondaryColor: "#FFD700",
    description:
      "Pancaran aura kosmik hijau-emas meningkatkan keberuntungan seluruh server.",
    buffs: {
      fishingBonus: 20,
      gachaLuck: 15,
      miningExp: 15,
    },
    lore: "Bintang-bintang bersinar terang, menarik rezeki dan ikan-ikan legendaris ke permukaan air.",
  },
  {
    id: "cosmic_storm",
    name: "Cosmic Storm",
    emoji: "⚡",
    color: "#C084FC",
    secondaryColor: "#9333EA",
    description:
      "Badai ion kosmik memicu ketegangan di dungeon dan boss battle.",
    buffs: {
      dungeonLoot: 25,
      couponDropChance: 10,
      bossAtk: 10,
    },
    lore: "Energi kehampaan bergolak di langit malam. Monster dungeon menjadi lebih ganas namun menyimpan kupon langka!",
  },
  {
    id: "starlit_serenity",
    name: "Starlit Serenity",
    emoji: "🌌",
    color: "#06B6D4",
    secondaryColor: "#38BDF8",
    description:
      "Kedamaian langit malam menenangkan pikiran dan mempercepat pemulihan energi.",
    buffs: {
      chatExpMultiplier: 2,
      staminaRegen: 50,
      restCooldown: -30,
    },
    lore: "Keheningan angkasa membawa ketenangan mendalam bagi seluruh pengelana yang beristirahat.",
  },
  {
    id: "eclipse_shadows",
    name: "Eclipse of Shadows",
    emoji: "🌑",
    color: "#F43F5E",
    secondaryColor: "#FB7185",
    description:
      "Gerhana kosmik membuka lorong pasar gelap dan transaksi rahasia.",
    buffs: {
      marketTaxDiscount: 30,
      stealthBonus: 20,
      auctionDiscount: 15,
    },
    lore: "Bayangan gerhana menutupi pantauan pengawas, menurunkan pajak dan mempercepat perdagangan pasar.",
  },
  {
    id: "sakura_breeze",
    name: "Sakura Cosmic Breeze",
    emoji: "🌸",
    color: "#FFB6C1",
    secondaryColor: "#F472B6",
    description:
      "Semilir angin kelopak sakura kosmik menghangatkan hubungan sosial dan pertemanan.",
    buffs: {
      npcAffectionBonus: 30,
      cafeDiscount: 20,
      datingSuccess: 25,
    },
    lore: "Aroma bunga sakura antariksa melembutkan hati NPC dan membuka kisah-kisah romantis baru.",
  },
  {
    id: "celestial_harmony",
    name: "Celestial Harmony",
    emoji: "💎",
    color: "#E2E8F0",
    secondaryColor: "#94A3B8",
    description:
      "Keseimbangan sempurna rasi bintang memperkuat perisai dan ekonomi komunitas.",
    buffs: {
      clanShieldBonus: 25,
      bankInterestBonus: 15,
      craftSuccessRate: 20,
    },
    lore: "Semua rasi bintang tersusun simetris, melindungi wilayah guild dari segala marabahaya.",
  },
];

const OMIKUJI_TIERS = [
  {
    tier: "DAI_KICHI",
    name: "Bintang Agung (大吉 - Great Blessing)",
    starCount: 5,
    color: "#FFD700",
    rewardCoin: 1500,
    rewardStamina: 40,
    lore: "Puncak keberuntungan kosmik memayungi setiap langkahmu hari ini!",
  },
  {
    tier: "CHU_KICHI",
    name: "Bintang Menengah (中吉 - Medium Blessing)",
    starCount: 4,
    color: "#06B6D4",
    rewardCoin: 800,
    rewardStamina: 25,
    lore: "Cahaya bintang bersinar hangat membawa kelancaran rezeki dan usaha.",
  },
  {
    tier: "SHO_KICHI",
    name: "Bintang Kecil (小吉 - Small Blessing)",
    starCount: 3,
    color: "#10B981",
    rewardCoin: 400,
    rewardStamina: 15,
    lore: "Kebaikan-kebaikan kecil akan menemanimu sepanjang hari.",
  },
  {
    tier: "KICHI",
    name: "Bintang Tenang (吉 - Neutral Blessing)",
    starCount: 2,
    color: "#C084FC",
    rewardCoin: 200,
    rewardStamina: 10,
    lore: "Hari yang damai untuk belajar, meneliti, dan bersiap menyambut peluang.",
  },
];

const CONSTELLATIONS = [
  {
    name: "Lyra (Harpa Kosmik)",
    star: "Vega",
    bonus: "+150 Stardust",
    stardust: 150,
  },
  {
    name: "Cygnus (Angsa Bintang)",
    star: "Deneb",
    bonus: "+180 Stardust",
    stardust: 180,
  },
  {
    name: "Aquila (Elang Angkasa)",
    star: "Altair",
    bonus: "+200 Stardust",
    stardust: 200,
  },
  {
    name: "Orion (Pemburu Galaksi)",
    star: "Betelgeuse",
    bonus: "+250 Stardust",
    stardust: 250,
  },
  {
    name: "Phoenix (Burung Api Abadi)",
    star: "Ankaa",
    bonus: "+300 Stardust",
    stardust: 300,
  },
  {
    name: "Cassiopeia (Mahkota Ratu)",
    star: "Schedar",
    bonus: "+220 Stardust",
    stardust: 220,
  },
];

class AstralService {
  /**
   * Menghasilkan cuaca astral harian per server (deterministic per hari & guildId)
   * @param {string} guildId
   * @returns {Promise<Object>}
   */
  async getGuildAstralWeather(guildId) {
    const today = new Date().toISOString().slice(0, 10);
    const cacheKey = `cache:astral_weather:${guildId || "global"}:${today}`;

    if (redisManager.isReady) {
      try {
        const cached = await redisManager.get(cacheKey);
        if (cached) return JSON.parse(cached);
      } catch (_) {}
    }

    // Hash deterministik hari + guildId
    let hash = 0;
    const str = `${guildId || "naura-global"}-${today}`;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    const index = Math.abs(hash) % ASTRAL_WEATHERS.length;
    const weather = {
      ...ASTRAL_WEATHERS[index],
      date: today,
      guildId: guildId || "global",
    };

    if (redisManager.isReady) {
      try {
        await redisManager.set(cacheKey, JSON.stringify(weather), 86400);
      } catch (_) {}
    }

    return weather;
  }

  /**
   * Menarik ramalan harian Omikuji Bintang
   * @param {string} userId
   * @param {string} displayName
   * @returns {Promise<{ canClaim: boolean, result?: Object, remainingTime?: string }>}
   */
  async drawDailyOmikuji(userId, displayName = "Pengelana") {
    const today = new Date().toISOString().slice(0, 10);
    const userKey = `cache:astral_omikuji:${userId}:${today}`;

    if (redisManager.isReady) {
      try {
        const alreadyDrawn = await redisManager.get(userKey);
        if (alreadyDrawn) {
          return {
            canClaim: false,
            result: JSON.parse(alreadyDrawn),
            message: `Kamu sudah menarik Omikuji Bintang hari ini! Kembali lagi besok setelah pergantian tengah malam ya, ${displayName}~ ✨`,
          };
        }
      } catch (_) {}
    }

    // Hitung roll acak dengan pembobotan
    const roll = Math.random() * 100;
    let tierObj = OMIKUJI_TIERS[3]; // KICHI default
    if (roll < 15) {
      tierObj = OMIKUJI_TIERS[0]; // DAI_KICHI (15%)
    } else if (roll < 45) {
      tierObj = OMIKUJI_TIERS[1]; // CHU_KICHI (30%)
    } else if (roll < 75) {
      tierObj = OMIKUJI_TIERS[2]; // SHO_KICHI (30%)
    }

    const categories = {
      wealth: Math.floor(Math.random() * 30) + 70,
      romance: Math.floor(Math.random() * 30) + 70,
      adventure: Math.floor(Math.random() * 30) + 70,
      mood: Math.floor(Math.random() * 30) + 70,
    };

    const luckyNumber = Math.floor(Math.random() * 99) + 1;
    const luckyColor = [
      "Sakura Pink",
      "Cyber Cyan",
      "Emerald Green",
      "Neon Gold",
      "Astral Violet",
    ][Math.floor(Math.random() * 5)];

    const personalQuotes = [
      `"Langkah berani yang ${displayName} ambil hari ini akan membuahkan hasil manis di masa depan."`,
      `"Dengarkan intuisimu, ${displayName}. Semesta sedang menuntunmu ke arah yang tepat."`,
      `"Pertahankan senyuman dan kehangatanmu, ${displayName}. Energimu menerangi sekeliling."`,
      `"Hari yang sempurna bagi ${displayName} untuk mencoba hal baru dan merajut koneksi berharga."`,
    ];
    const personalQuote =
      personalQuotes[Math.floor(Math.random() * personalQuotes.length)];

    const result = {
      date: today,
      userId,
      displayName,
      tier: tierObj,
      categories,
      luckyNumber,
      luckyColor,
      personalQuote,
    };

    if (redisManager.isReady) {
      try {
        await redisManager.set(userKey, JSON.stringify(result), 86400);
      } catch (_) {}
    }

    return {
      canClaim: true,
      result,
    };
  }

  /**
   * Mengamati rasi bintang server
   * @param {string} userId
   * @param {string} displayName
   * @returns {Object}
   */
  observeConstellation(userId, displayName = "Pengelana") {
    const selected =
      CONSTELLATIONS[Math.floor(Math.random() * CONSTELLATIONS.length)];
    return {
      userId,
      displayName,
      constellation: selected,
      timestamp: new Date().toISOString(),
    };
  }
}

module.exports = new AstralService();
