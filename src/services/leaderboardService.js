"use strict";

const UserProfile = require("../models/UserProfile");
const UserSurvival = require("../models/UserSurvival");
const UserCardDeck = require("../models/UserCardDeck");
const redisManager = require("../managers/redisManager");

/**
 * Daftar kategori papan peringkat yang didukung sistem Naura Hoshino.
 */
const LEADERBOARD_CATEGORIES = [
  {
    id: "wallet",
    label: "Pundi Dompet (NC)",
    emoji: "💰",
    description: "Peringkat koin aktif di dompet pemain",
    model: "UserProfile",
    order: [["economy_wallet", "DESC"]],
    formatScore: (row) => `${(row.economy_wallet || 0).toLocaleString("id-ID")} NC`,
  },
  {
    id: "bank",
    label: "Deposito Bank (NC)",
    emoji: "🏦",
    description: "Peringkat saldo tersimpan di bank",
    model: "UserProfile",
    order: [["economy_bank", "DESC"]],
    formatScore: (row) => `${(row.economy_bank || 0).toLocaleString("id-ID")} NC`,
  },
  {
    id: "fragments",
    label: "Star Fragments (NSF)",
    emoji: "⭐",
    description: "Peringkat mata uang survival Naura Wilds",
    model: "UserSurvival",
    order: [["starFragments", "DESC"]],
    formatScore: (row) => `${(row.starFragments || 0).toLocaleString("id-ID")} NSF`,
  },
  {
    id: "level",
    label: "Level Global Server",
    emoji: "⚡",
    description: "Peringkat pengalaman obrolan server",
    model: "UserProfile",
    order: [
      ["leveling_level", "DESC"],
      ["leveling_xp", "DESC"],
    ],
    formatScore: (row) => `Lv. ${row.leveling_level || 1} (${(row.leveling_xp || 0).toLocaleString("id-ID")} XP)`,
  },
  {
    id: "survival_level",
    label: "Level Petualang Wilds",
    emoji: "🌲",
    description: "Peringkat level eksplorasi survival",
    model: "UserSurvival",
    order: [
      ["survival_level", "DESC"],
      ["survival_xp", "DESC"],
    ],
    formatScore: (row) => `Lv. ${row.survival_level || 1} (${(row.survival_xp || 0).toLocaleString("id-ID")} EXP)`,
  },
  {
    id: "card_elo",
    label: "Master Arena Kartu (ELO)",
    emoji: "🃏",
    description: "Peringkat kecakapan bertarung kartu",
    model: "UserCardDeck",
    order: [["eloRating", "DESC"]],
    formatScore: (row) => `${row.eloRating || 1000} ELO (${row.wins || 0} Menang)`,
  },
  {
    id: "reputation",
    label: "Poin Reputasi",
    emoji: "🌟",
    description: "Peringkat kehormatan & apresiasi komunitas",
    model: "UserProfile",
    order: [["reputation", "DESC"]],
    formatScore: (row) => `${(row.reputation || 0).toLocaleString("id-ID")} Rep`,
  },
];

/**
 * Mendapatkan konfigurasi kategori berdasarkan ID.
 * @param {string} categoryId
 * @returns {object}
 */
function getCategoryConfig(categoryId) {
  const normalized = (categoryId || "wallet").toLowerCase();
  return LEADERBOARD_CATEGORIES.find((c) => c.id === normalized) || LEADERBOARD_CATEGORIES[0];
}

/**
 * Mengambil data peringkat terpaginasi untuk kategori tertentu.
 * @param {string} categoryId - ID kategori peringkat.
 * @param {number} page - Halaman aktif (1-indexed).
 * @param {number} pageSize - Jumlah entri per halaman.
 * @returns {Promise<{category: object, page: number, totalPages: number, totalCount: number, items: Array}>}
 */
function extractNumericScore(config, row) {
  if (config.id === "wallet") return Number(row.economy_wallet) || 0;
  if (config.id === "bank") return Number(row.economy_bank) || 0;
  if (config.id === "fragments") return Number(row.starFragments) || 0;
  if (config.id === "level") return Number(row.leveling_xp) || 0;
  if (config.id === "survival_level") return Number(row.survival_xp) || 0;
  if (config.id === "card_elo") return Number(row.eloRating) || 1000;
  if (config.id === "reputation") return Number(row.reputation) || 0;
  return 0;
}

/**
 * Memperbarui nilai skor seorang pengguna pada Sorted Set Redis O(log N).
 * @param {string} categoryId
 * @param {string} userId
 * @param {number} score
 */
async function updateLeaderboardScore(categoryId, userId, score) {
  if (!redisManager.isReady || !userId) return;
  const config = getCategoryConfig(categoryId);
  const zsetKey = `leaderboard:zset:${config.id}`;
  await redisManager.zAdd(zsetKey, Number(score) || 0, String(userId));
}

/**
 * Mengambil peringkat global pengguna dalam kategori tertentu secara O(1).
 * @param {string} categoryId
 * @param {string} userId
 * @returns {Promise<number|null>} Peringkat 1-indexed, atau null jika belum ada.
 */
async function getUserRank(categoryId, userId) {
  if (!redisManager.isReady || !userId) return null;
  const config = getCategoryConfig(categoryId);
  const zsetKey = `leaderboard:zset:${config.id}`;
  const rank = await redisManager.zRevRank(zsetKey, String(userId));
  return rank !== null ? rank + 1 : null;
}

/**
 * Mengambil data peringkat terpaginasi untuk kategori tertentu dengan Redis Sorted Sets O(1).
 * @param {string} categoryId - ID kategori peringkat.
 * @param {number} page - Halaman aktif (1-indexed).
 * @param {number} pageSize - Jumlah entri per halaman.
 * @returns {Promise<{category: object, page: number, totalPages: number, totalCount: number, items: Array}>}
 */
async function fetchLeaderboard(categoryId = "wallet", page = 1, pageSize = 10) {
  const config = getCategoryConfig(categoryId);
  const safePage = Math.max(1, parseInt(page, 10) || 1);
  const safePageSize = Math.min(25, Math.max(1, parseInt(pageSize, 10) || 10));
  const offset = (safePage - 1) * safePageSize;
  const medalEmojis = ["🥇", "🥈", "🥉"];
  const zsetKey = `leaderboard:zset:${config.id}`;

  // 1. Coba baca dari Redis Sorted Sets O(1) / O(log N + M)
  if (redisManager.isReady) {
    try {
      const cachedCount = await redisManager.zCard(zsetKey);
      if (cachedCount > 0) {
        const cachedSlice = await redisManager.zRevRangeWithScores(
          zsetKey,
          offset,
          offset + safePageSize - 1,
        );

        if (cachedSlice && cachedSlice.length > 0) {
          const totalPages = Math.max(1, Math.ceil(cachedCount / safePageSize));
          const items = cachedSlice.map((entry, index) => {
            const rank = offset + index + 1;
            const badge = rank <= 3 ? medalEmojis[rank - 1] : `**#${rank}**`;
            const scoreNum = Math.round(Number(entry.score) || 0);

            let formattedScore = `${scoreNum.toLocaleString("id-ID")}`;
            if (config.id === "wallet" || config.id === "bank") {
              formattedScore = `${scoreNum.toLocaleString("id-ID")} NC`;
            } else if (config.id === "fragments") {
              formattedScore = `${scoreNum.toLocaleString("id-ID")} NSF`;
            } else if (config.id === "card_elo") {
              formattedScore = `${scoreNum} ELO`;
            } else if (config.id === "reputation") {
              formattedScore = `${scoreNum.toLocaleString("id-ID")} Rep`;
            } else if (config.id === "level") {
              formattedScore = `${scoreNum.toLocaleString("id-ID")} XP`;
            } else if (config.id === "survival_level") {
              formattedScore = `${scoreNum.toLocaleString("id-ID")} EXP`;
            }

            return {
              rank,
              badge,
              userId: entry.value,
              formattedScore,
              raw: { userId: entry.value, score: scoreNum },
            };
          });

          return {
            category: config,
            page: safePage,
            totalPages,
            totalCount: cachedCount,
            items,
          };
        }
      }
    } catch (_) {
      // Fallback ke database Sequelize bila Redis bermasalah
    }
  }

  // 2. Query Database Sequelize
  let model;
  if (config.model === "UserSurvival") {
    model = UserSurvival;
  } else if (config.model === "UserCardDeck") {
    model = UserCardDeck;
  } else {
    model = UserProfile;
  }

  const { rows, count } = await model.findAndCountAll({
    order: config.order,
    limit: safePageSize,
    offset,
  });

  const totalPages = Math.max(1, Math.ceil(count / safePageSize));

  const items = rows.map((row, index) => {
    const rank = offset + index + 1;
    const badge = rank <= 3 ? medalEmojis[rank - 1] : `**#${rank}**`;
    return {
      rank,
      badge,
      userId: row.userId,
      formattedScore: config.formatScore(row),
      raw: row.toJSON ? row.toJSON() : row,
    };
  });

  // 3. Populasikan kembali ke Redis Sorted Sets untuk request berikutnya
  if (redisManager.isReady && rows.length > 0) {
    try {
      for (const row of rows) {
        const sc = extractNumericScore(config, row);
        await redisManager.zAdd(zsetKey, sc, row.userId);
      }
    } catch (_) {}
  }

  return {
    category: config,
    page: safePage,
    totalPages,
    totalCount: count,
    items,
  };
}

/**
 * Menghasilkan komponen Discord Container V2 untuk papan peringkat.
 * @param {string} categoryId
 * @param {number} page
 * @param {import('discord.js').Client} [client]
 * @returns {Promise<object>}
 */
async function renderLeaderboardPayload(categoryId = "wallet", page = 1, client = null) {
  const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
  const { buildContainerV2 } = require("../utils/NauraContainerBuilder");
  const ui = require("../config/ui");

  const data = await fetchLeaderboard(categoryId, page, 10);
  const { category, totalPages, totalCount, items } = data;

  const colorMap = {
    wallet: "#F59E0B",
    bank: "#10B981",
    fragments: "#EC4899",
    level: "#3B82F6",
    survival_level: "#059669",
    card_elo: "#8B5CF6",
    reputation: "#FBBF24",
  };

  let descriptionLines = [];
  if (items.length === 0) {
    descriptionLines.push("*Belum ada petualang yang tercatat dalam kategori ini.*");
  } else {
    descriptionLines = items.map((item) => {
      const userMention = `<@${item.userId}>`;
      return `${item.badge} ${userMention} • **${item.formattedScore}**`;
    });
  }

  descriptionLines.push("");
  descriptionLines.push(`-# Menampilkan ${items.length} dari total ${totalCount} petualang terdaftar.`);

  // Dropdown Select Menu Kategori
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("sel_lb_cat")
    .setPlaceholder("Pilih Kategori Papan Peringkat...")
    .addOptions(
      LEADERBOARD_CATEGORIES.map((cat) => ({
        label: cat.label,
        value: cat.id,
        description: cat.description,
        emoji: cat.emoji,
        default: cat.id === category.id,
      })),
    );

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  // Tombol Paginasi
  const pageButtons = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_lb_prev_${category.id}_${data.page}`)
      .setLabel("◀️ Sebelumnya")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page <= 1),
    new ButtonBuilder()
      .setCustomId(`btn_lb_page_info`)
      .setLabel(`Halaman ${data.page} / ${totalPages}`)
      .setStyle(ButtonStyle.Primary)
      .setDisabled(true),
    new ButtonBuilder()
      .setCustomId(`btn_lb_next_${category.id}_${data.page}`)
      .setLabel("Selanjutnya ▶️")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(data.page >= totalPages),
  );

  return buildContainerV2({
    accentColorHex: colorMap[category.id] || "#3B82F6",
    authorName: "NAURA HALL OF FAME",
    title: `${category.emoji} Papan Peringkat: ${category.label}`,
    description: descriptionLines.join("\n"),
    selectMenu: selectRow,
    buttonsRow: pageButtons,
    footerText: ui.getFooter("utility"),
  });
}

module.exports = {
  LEADERBOARD_CATEGORIES,
  getCategoryConfig,
  fetchLeaderboard,
  renderLeaderboardPayload,
  updateLeaderboardScore,
  getUserRank,
};
