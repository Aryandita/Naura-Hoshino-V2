/**
 * @namespace: plugin/utility/fortune.js
 * @type: Command
 * @copyright 2026 Aryandita Praftian
 * @assistant Naura Hoshino
 * @version 1.0.0
 * @description Daily AI Fortune / Omikuji & RPG Daily Buff
 */

const { SlashCommandBuilder } = require("discord.js");
const cacheManager = require("../../src/managers/cacheManager");
const geminiClient = require("../../src/ai/geminiClient");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const FORTUNE_TIERS = [
  {
    tier: "Daikichi",
    kanji: "大吉",
    title: "Keberuntungan Luar Biasa (Great Blessing)",
    emoji: "🌸",
    color: "#FFD700",
    expBoost: 0.15,
    goldBoost: 0.15,
    fragments: 10,
    desc: "Hari ini adalah hari terbaikmu! Segala usaha dan petualanganmu akan menuai berkah berlimpah.",
  },
  {
    tier: "Chukichi",
    kanji: "中吉",
    title: "Keberuntungan Sedang (Middle Blessing)",
    emoji: "🌟",
    color: "#A855F7",
    expBoost: 0.1,
    goldBoost: 0.1,
    fragments: 5,
    desc: "Peluang baik menantimu di perjalanan. Tetap semangat dan jangan ragu melangkah!",
  },
  {
    tier: "Shokichi",
    kanji: "小吉",
    title: "Keberuntungan Kecil (Small Blessing)",
    emoji: "✨",
    color: "#60A5FA",
    expBoost: 0.05,
    goldBoost: 0.05,
    fragments: 2,
    desc: "Hal-hal kecil yang menyenangkan akan membuat harimu terasa lebih manis dan damai.",
  },
  {
    tier: "Kichi",
    kanji: "吉",
    title: "Berkah Biasa (Blessing)",
    emoji: "🍀",
    color: "#34D399",
    expBoost: 0.05,
    goldBoost: 0.0,
    fragments: 1,
    desc: "Ketenangan dan konsistensi adalah kuncimu hari ini. Jalani harimu dengan senyuman.",
  },
  {
    tier: "Suekichi",
    kanji: "末吉",
    title: "Harapan Masa Depan (Future Blessing)",
    emoji: "🔮",
    color: "#F472B6",
    expBoost: 0.03,
    goldBoost: 0.03,
    fragments: 1,
    desc: "Mungkin terasa biasa sekarang, tapi benih kebaikan yang kamu tanam hari ini akan berbuah manis kelak.",
  },
  {
    tier: "Kyo",
    kanji: "凶",
    title: "Kemalangan (Misfortune)",
    emoji: "⛈️",
    color: "#94A3B8",
    expBoost: 0.0,
    goldBoost: 0.0,
    fragments: 0,
    desc: "Hari yang menantang. Tapi jangan khawatir, Naura memberimu jimat pelindung keberuntungan!",
  },
];

const LUCKY_ITEMS = [
  "Teh Chamomile Hangat",
  "Pena Tinta Emas",
  "Buku Catatan Kecil",
  "Gantungan Kunci Kucing",
  "Kopi Latte Vanilla",
  "Pita Merah Muda",
  "Headphone Nirkabel",
  "Cincin Perak",
  "Tanaman Sukulen",
  "Payung Lipat Bintang",
];

const LUCKY_COLORS = [
  "Sakura Pink",
  "Sky Blue",
  "Sunset Gold",
  "Emerald Green",
  "Lavender Purple",
  "Crimson Red",
  "Mint Green",
  "Cosmic Indigo",
];

const LUCKY_DIRECTIONS = ["Utara", "Timur Laut", "Timur", "Tenggara", "Selatan", "Barat Daya", "Barat", "Barat Laut"];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("fortune")
    .setDescription("Tarik ramalan harian Omikuji dari Naura & dapatkan Buff RPG harian!"),

  async execute(interaction) {
    await interaction.deferReply();
    const userId = interaction.user.id;
    const now = new Date();
    const todayStr = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-${String(now.getUTCDate()).padStart(2, "0")}`;

    const survivalData = await cacheManager.getUserSurvival(userId);
    const rpgState = survivalData?.rpg_state || {};

    if (rpgState.last_fortune_date === todayStr) {
      const lastFortune = rpgState.last_fortune || {};
      const payload = buildContainerV2({
        accentColorHex: lastFortune.color || ui.getColor("primary") || "#FFB6C1",
        authorName: "Naura Daily Omikuji",
        title: `${lastFortune.emoji || "🌸"} Ramalan Hari Ini Sudah Ditarik`,
        description: [
          `Kamu sudah menarik ramalan Omikuji untuk hari ini (${todayStr})!`,
          "",
          `**Tingkat:** ${lastFortune.kanji || "吉"} **${lastFortune.title || "Berkah"}**`,
          `**Buff Aktif:** *+${Math.round((lastFortune.expBoost || 0) * 100)}% EXP / +${Math.round((lastFortune.goldBoost || 0) * 100)}% Gold*`,
          `**Warna Keberuntungan:** ${lastFortune.luckyColor || "Sakura Pink"}`,
          `**Barang Pembawa Hoki:** ${lastFortune.luckyItem || "Teh Hangat"}`,
          "",
          `${ui.getEmoji("sparkle") || "💡"} *Kembalilah besok setelah pergantian hari untuk menarik ramalan baru!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply(payload);
    }

    // Roll Fortune
    const roll = Math.random();
    let picked;
    if (roll < 0.15) picked = FORTUNE_TIERS[0]; // Daikichi 15%
    else if (roll < 0.40) picked = FORTUNE_TIERS[1]; // Chukichi 25%
    else if (roll < 0.65) picked = FORTUNE_TIERS[2]; // Shokichi 25%
    else if (roll < 0.85) picked = FORTUNE_TIERS[3]; // Kichi 20%
    else if (roll < 0.95) picked = FORTUNE_TIERS[4]; // Suekichi 10%
    else picked = FORTUNE_TIERS[5]; // Kyo 5%

    const luckyItem = LUCKY_ITEMS[Math.floor(Math.random() * LUCKY_ITEMS.length)];
    const luckyColor = LUCKY_COLORS[Math.floor(Math.random() * LUCKY_COLORS.length)];
    const luckyDirection = LUCKY_DIRECTIONS[Math.floor(Math.random() * LUCKY_DIRECTIONS.length)];
    const luckyNumber = Math.floor(Math.random() * 99) + 1;

    // AI Wisdom from Naura persona
    let aiWisdom = picked.desc;
    try {
      const prompt = `Kamu adalah Naura Hoshino, asisten virtual anime yang imut dan bijak. User ${interaction.user.username} baru saja menarik ramalan harian Omikuji dan mendapatkan ${picked.kanji} (${picked.title}). Berikan satu nasehat harian atau kata-kata penyemangat yang manis, hangat, dan menginspirasi dalam bahasa Indonesia. Maksimal 2 kalimat.`;
      const response = await geminiClient.generate({ parts: [{ text: prompt }] });
      if (response) aiWisdom = response.trim();
    } catch (_) {}

    // Simpan status buff ke rpg_state
    await cacheManager.mutateUserSurvivalJson(userId, "rpg_state", (state) => {
      const updated = state ? { ...state } : {};
      updated.last_fortune_date = todayStr;
      updated.last_fortune = {
        tier: picked.tier,
        kanji: picked.kanji,
        title: picked.title,
        emoji: picked.emoji,
        color: picked.color,
        expBoost: picked.expBoost,
        goldBoost: picked.goldBoost,
        luckyItem,
        luckyColor,
      };
      updated.daily_buff = {
        date: todayStr,
        expMultiplier: 1.0 + picked.expBoost,
        goldMultiplier: 1.0 + picked.goldBoost,
      };
      return updated;
    });

    if (picked.fragments > 0) {
      await cacheManager.incrementUserSurvival(userId, "starFragments", picked.fragments);
    }

    const rewardText = picked.fragments > 0
      ? `${ui.getEmoji("sparkles") || "✨"} **Hadiah Keberuntungan:** +${picked.fragments} Star Fragments\n${ui.getEmoji("star") || "🌟"} **Buff RPG (24 Jam):** +${Math.round(picked.expBoost * 100)}% EXP & +${Math.round(picked.goldBoost * 100)}% Gold Boost`
      : `${ui.getEmoji("shield") || "🛡️"} **Amulet Perlindungan Naura:** Menghalau segala energi negatif hari ini!`;

    const payload = buildContainerV2({
      accentColorHex: picked.color,
      authorName: `Omikuji Harian • ${interaction.user.displayName || interaction.user.username}`,
      title: `${picked.emoji} ${picked.kanji}, ${picked.title}`,
      description: [
        `*"${aiWisdom}"*`,
        "",
        `### ${ui.getEmoji("fortune") || "🍀"} Elemen Keberuntungan Hari Ini:`,
        `• **Barang Hoki:** ${luckyItem}`,
        `• **Warna Hoki:** ${luckyColor}`,
        `• **Arah Hoki:** ${luckyDirection}`,
        `• **Angka Hoki:** \`${luckyNumber}\``,
        "",
        rewardText,
      ].join("\n"),
      footerText: "Ramalan Omikuji reset setiap hari pukul 00:00 UTC",
    });

    return interaction.editReply(payload);
  },
};
