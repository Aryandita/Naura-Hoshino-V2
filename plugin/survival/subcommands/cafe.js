"use strict";

/**
 * @module cafe
 * @description Subcommand /survival cafe - Cozy Cyber-Cafe & Maid Lounge Management
 * 
 * Fitur Utama:
 * - Status kafe dengan canvas card rendering
 * - Masak menu/resep untuk etalase
 * - Layani pelanggan NPC untuk pendapatan
 * - Klaim pendapatan pasif (idle revenue)
 * - Buku resep lengkap dengan bahan dan buff
 * - Order dari kafe pemain lain (multiplayer trading)
 * - Button collector untuk interaksi cepat
 * - Level progression dan reputation system
 * 
 * @requires discord.js
 * @requires ../../../src/managers/logger
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/utils/survivalUIHelper
 * @requires ../../../src/config/ui
 * @requires ../../../src/survival/engines/cafeEngine
 * @requires ../../../src/survival/data/cafeRecipes
 * @requires ../../../src/canvas/cafeCanvas
 */

const { logger } = require("../../../src/managers/logger");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const cafeEngine = require("../../../src/survival/engines/cafeEngine");
const {
  CAFE_RECIPES,
  getRecipeById,
} = require("../../../src/survival/data/cafeRecipes");
const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {number} COLLECTOR_TIMEOUT_MS - Waktu timeout collector dalam milidetik */
const COLLECTOR_TIMEOUT_MS = 60000;

/** @const {string} CAFE_IMAGE_NAME - Nama file untuk cafe status card */
const CAFE_IMAGE_NAME = "cafe_status.png";

/** @const {string} DEFAULT_RECIPE_ID - Resep default saat tidak ada input */
const DEFAULT_RECIPE_ID = "sakura_latte";

/** @const {Object} BUTTON_IDS - Custom ID untuk tombol kafe */
const BUTTON_IDS = {
  COOK: "cafe_btn_cook",
  SERVE: "cafe_btn_serve",
  COLLECT: "cafe_btn_collect",
  MENU: "cafe_btn_menu",
};

/** @const {Object} ACTIONS - Aksi yang tersedia */
const ACTIONS = {
  STATUS: "status",
  COOK: "cook",
  SERVE: "serve",
  COLLECT: "collect",
  ORDER: "order",
};

/** @const {Object} ACCENT_COLORS - Warna aksen untuk berbagai konteks */
const ACCENT_COLORS = {
  CAFE_PINK: "#F9A8D4",
  SUCCESS_GREEN: "#86EFAC",
  SERVE_BLUE: "#38BDF8",
  RECIPE_YELLOW: "#FDE047",
  ORDER_PURPLE: "#A855F7",
};

/** @const {Object} FAIL_REASONS - Reason codes untuk kegagalan */
const FAIL_REASONS = {
  RECIPE_NOT_FOUND: "RECIPE_NOT_FOUND",
  RECIPE_LOCKED: "RECIPE_LOCKED",
  INSUFFICIENT_INGREDIENTS: "INSUFFICIENT_INGREDIENTS",
  CANNOT_ORDER_FROM_SELF: "CANNOT_ORDER_FROM_SELF",
  SELLER_NO_CAFE: "SELLER_NO_CAFE",
  OUT_OF_STOCK: "OUT_OF_STOCK",
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format ringkasan hidangan aktif di etalase
 * @param {Object} dishes - Object dishes dengan id sebagai key dan count sebagai value
 * @returns {string} Formatted dish summary markdown
 */
function formatDishSummary(dishes) {
  const entries = Object.entries(dishes || {}).filter(([, count]) => Number(count) > 0);
  
  if (entries.length === 0) {
    return "_Etalase masih kosong. Masak hidangan baru untuk mulai berjualan!_";
  }

  return entries
    .map(([id, count]) => {
      const r = getRecipeById(id);
      const emoji = r ? r.emoji : "🍽️";
      const name = r ? r.name : id;
      const price = r ? r.price : 200;
      return `- ${emoji} **${name}**: \`${count} porsi\` (*${price} SC*)`;
    })
    .join("\n");
}

/**
 * Build baris tombol untuk status kafe
 * @returns {ActionRowBuilder} Baris komponen Discord
 */
function buildCafeButtonsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.COOK)
      .setLabel("🍳 Masak Menu")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.SERVE)
      .setLabel("👥 Layani Tamu")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.COLLECT)
      .setLabel("💰 Klaim Pendapatan")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.MENU)
      .setLabel("📖 Buku Resep")
      .setStyle(ButtonStyle.Secondary),
  );
}

/**
 * Format daftar resep lengkap untuk buku resep
 * @returns {string} Formatted recipe list markdown
 */
function formatRecipeBook() {
  return CAFE_RECIPES.map((r) => {
    const ingList = r.ingredients
      .map((i) => `${i.amount}x ${i.name}`)
      .join(", ");
    return `### ${r.emoji} ${r.name} (\`${r.id}\`)\n- **Kategori:** \`${r.category}\` | **Harga Jual:** \`${r.price} ⭐\`\n- **Bahan Diperlukan:** ${ingList}\n- **Efek Buff:** *${r.buff.description}*`;
  }).join("\n\n");
}

/**
 * Dapatkan pesan error berdasarkan reason code untuk cook
 * @param {string} reason - Reason code kegagalan
 * @param {string} targetRecipe - ID resep yang dicoba
 * @param {number} [requiredLevel] - Level yang diperlukan jika locked
 * @returns {string} Pesan error formatted
 */
function getCookFailMessage(reason, targetRecipe, requiredLevel) {
  switch (reason) {
    case FAIL_REASONS.RECIPE_NOT_FOUND:
      return `Resep dengan ID \`${targetRecipe}\` tidak ditemukan! Gunakan buku resep untuk melihat daftar.`;
    case FAIL_REASONS.RECIPE_LOCKED:
      return `Resep ini masih terkunci! Memerlukan kafe Level ${requiredLevel}.`;
    case FAIL_REASONS.INSUFFICIENT_INGREDIENTS:
      return "Bahan mentah di inventarismu tidak cukup untuk memasak hidangan ini!";
    default:
      return "Gagal memasak menu kafe.";
  }
}

/**
 * Dapatkan pesan error berdasarkan reason code untuk order
 * @param {string} reason - Reason code kegagalan
 * @param {string} targetUserId - ID penjual
 * @param {string} targetRecipe - ID resep yang dipesan
 * @param {number} [price] - Harga jika insufficient funds
 * @returns {string} Pesan error formatted
 */
function getOrderFailMessage(reason, targetUserId, targetRecipe, price) {
  switch (reason) {
    case FAIL_REASONS.CANNOT_ORDER_FROM_SELF:
      return "Kamu tidak bisa memesan makanan dari kafemu sendiri!";
    case FAIL_REASONS.SELLER_NO_CAFE:
      return `<@${targetUserId}> belum membuka usaha kafe!`;
    case FAIL_REASONS.OUT_OF_STOCK:
      return `Menu \`${targetRecipe}\` di kafe <@${targetUserId}> sedang habis!`;
    case FAIL_REASONS.INSUFFICIENT_FUNDS:
      return `Saldo Sukamaju Koin (SC) milikmu tidak cukup (${price} SC)!`;
    default:
      return "Gagal memesan hidangan.";
  }
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  name: "cafe",
  description: "☕ Kelola Cozy Cyber-Cafe & Maid Lounge, masak menu, dan layani pelanggan!",

  /**
   * Eksekusi subcommand cafe
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const action = interaction.options?.getString?.("aksi") || ACTIONS.STATUS;
    const recipeId = interaction.options?.getString?.("resep") || null;
    const targetUser = interaction.options?.getUser?.("target_user") || null;
    const userId = interaction.user.id;
    const username = interaction.user.displayName || interaction.user.username;

    switch (action) {
      case ACTIONS.STATUS:
        return handleStatus(interaction, userId, username);
      
      case ACTIONS.COOK:
        return handleCook(interaction, userId, recipeId);
      
      case ACTIONS.SERVE:
        return handleServe(interaction, userId);
      
      case ACTIONS.COLLECT:
        return handleCollect(interaction, userId);
      
      case ACTIONS.ORDER:
        return handleOrder(interaction, userId, username, targetUser, recipeId);
      
      default:
        return handleStatus(interaction, userId, username);
    }
  },
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle status kafe dengan canvas card dan button collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @param {string} username - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleStatus(interaction, userId, username) {
  const cafe = await cafeEngine.openOrGetCafe(userId, username);
  const files = [];

  // Render cafe card
  try {
    const cardBuffer = await canvasWorkerPool.execute("renderCafe", cafe);
    files.push(new AttachmentBuilder(cardBuffer, { name: CAFE_IMAGE_NAME }));
  } catch (err) {
    logger.warn("[cafe:execute] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
  }

  const dishSummary = formatDishSummary(cafe.activeDishes);
  const buttonsRow = buildCafeButtonsRow();

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.CAFE_PINK,
    authorName: "☕ Cozy Cyber-Cafe & Maid Lounge",
    title: `✨ ${cafe.cafeName} (Level ${cafe.level})`,
    description: [
      "Selamat datang di lounge santaimu! Tempat berkumpul hangat para petualang Neo-Hoshino.",
      "",
      `⭐ **Reputasi Kafe:** \`${cafe.reputation} REP\` (Level Up: \`${cafe.level * 100} REP\`)`,
      `👥 **Total Tamu Dilayani:** \`${cafe.customersServed} Orang\``,
      `💰 **Pendapatan Pasif Siap Klaim:** \`${Number(cafe.uncollectedRevenue || 0).toLocaleString("id-ID")} Sukamaju Koin (SC)\``,
      "",
      "🍽️ **Menu Aktif di Etalase:**",
      dishSummary,
      "",
      "-# 💡 *Tips: Gunakan tombol di bawah atau command `/survival life cafe aksi:cook resep:sakura_latte`!*",
    ].join("\n"),
    footerText: ui.getFooter("survival"),
    buttonsRow,
  });

  const msg = await interaction.editReply({ ...payload, files });

  // Setup button collector
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECTOR_TIMEOUT_MS,
  });

  collector.on("collect", async (btnInteraction) => {
    if (btnInteraction.user.id !== userId) {
      return btnInteraction.reply({
        content: "❌ Ini adalah panel kafe milik pemain lain!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await btnInteraction.deferUpdate();

    switch (btnInteraction.customId) {
      case BUTTON_IDS.COLLECT:
        return handleCollectorCollect(interaction, userId);
      
      case BUTTON_IDS.SERVE:
        return handleCollectorServe(interaction, userId);
      
      case BUTTON_IDS.MENU:
        return handleCollectorMenu(interaction);
      
      case BUTTON_IDS.COOK:
        return handleCollectorCook(interaction, userId);
    }
  });
}

/**
 * Handle tombol collect dari collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleCollectorCollect(interaction, userId) {
  const collectRes = await cafeEngine.collectIdleRevenue(userId);
  
  if (!collectRes.success) {
    return interaction.followUp({
      ...buildErrorContainerV2({
        title: "Belum Ada Pendapatan",
        description: "Belum ada akumulasi koin yang bisa diklaim saat ini. Tunggu beberapa waktu lagi!",
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: ACCENT_COLORS.SUCCESS_GREEN,
      title: "💰 Pendapatan Berhasil Diklaim!",
      description: `Kamu berhasil mengumpulkan **+${collectRes.collectedAmount.toLocaleString("id-ID")} Sukamaju Koin (SC)** dari pendapatan pasif tokomu!`,
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle tombol serve dari collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleCollectorServe(interaction, userId) {
  const serveRes = await cafeEngine.serveNpcCustomers(userId);
  
  if (!serveRes.success) {
    return interaction.followUp({
      ...buildErrorContainerV2({
        title: "Etalase Kosong",
        description: "Tidak ada makanan/minuman yang siap disajikan! Masak menu terlebih dahulu.",
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  // Increment quest progress
  const questGen = require("../../../src/survival/engines/questGenerator");
  await questGen.incrementQuestProgress(userId, "cafe_serve", 1).catch(() => {});

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: ACCENT_COLORS.SERVE_BLUE,
      title: "👥 Pelanggan Telah Dilayani!",
      description: [
        `Pelanggan baru saja membeli **${serveRes.soldQuantity}x ${serveRes.emoji} ${serveRes.dishName}**!`,
        "",
        `💵 **Hasil Penjualan:** \`+${serveRes.earnings.toLocaleString("id-ID")} SC\` (Termasuk tips \`${serveRes.tips} SC\`)`,
        `📦 **Sisa Stok:** \`${serveRes.remainingStock} Porsi\``,
        `👥 **Total Tamu:** \`${serveRes.customersServed} Orang\``,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle tombol menu dari collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleCollectorMenu(interaction) {
  const recipeList = formatRecipeBook();

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: ACCENT_COLORS.RECIPE_YELLOW,
      authorName: "📖 Buku Resep & Kuliner Kafe",
      title: "Daftar Resep & Khasiat Hidangan",
      description: recipeList,
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle tombol cook dari collector (default recipe)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleCollectorCook(interaction, userId) {
  const cookRes = await cafeEngine.cookRecipe(userId, DEFAULT_RECIPE_ID, 1);
  
  if (!cookRes.success) {
    return interaction.followUp({
      ...buildErrorContainerV2({
        title: "Gagal Memasak",
        description: `Bahan mentah di tas tidak cukup untuk memasak **Sakura Blossom Latte**! Kumpulkan herbal dan air bersih dari aktivitas gathering.`,
      }),
      flags: MessageFlags.Ephemeral,
    });
  }

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: ACCENT_COLORS.CAFE_PINK,
      title: "🍳 Berhasil Memasak Hidangan!",
      description: [
        `Kamu berhasil memasak **1x ${cookRes.emoji} ${cookRes.dishName}** dan menaruhnya di etalase kafe!`,
        "",
        `⭐ **Reputasi:** \`+${cookRes.repGain} REP\` (Total: \`${cookRes.currentRep} REP\`)`,
        `📦 **Total Stok Etalase:** \`${cookRes.totalStock} Porsi\``,
        cookRes.levelUp
          ? `\n🎉 **KAFE NAIK LEVEL!** Sekarang kafe milikmu berada di **Level ${cookRes.newLevel}**!`
          : "",
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle aksi masak menu (cook)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @param {string|null} recipeId - ID resep yang dimasak
 * @returns {Promise<void>}
 */
async function handleCook(interaction, userId, recipeId) {
  const targetRecipe = recipeId || DEFAULT_RECIPE_ID;
  const cookRes = await cafeEngine.cookRecipe(userId, targetRecipe, 1);

  if (!cookRes.success) {
    const msg = getCookFailMessage(cookRes.reason, targetRecipe, cookRes.requiredLevel);
    
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Gagal Memasak",
        description: msg,
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.CAFE_PINK,
    authorName: "🍳 Dapur Cozy Cafe",
    title: "✨ Masakan Selesai & Masuk Etalase!",
    description: [
      `Kamu telah selesai memasak **1x ${cookRes.emoji} ${cookRes.dishName}**!`,
      "",
      `⭐ **Reputasi Kafe:** \`+${cookRes.repGain} REP\` (Total: \`${cookRes.currentRep} REP\`)`,
      `📦 **Stok Saat Ini:** \`${cookRes.totalStock} Porsi\``,
      `✨ **Khasiat Buff:** *${cookRes.buff.description}*`,
      cookRes.levelUp
        ? `\n🎉 **KAFE NAIK LEVEL!** Kafe kini mencapai **Level ${cookRes.newLevel}**!`
        : "",
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle aksi layani pelanggan (serve)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleServe(interaction, userId) {
  const serveRes = await cafeEngine.serveNpcCustomers(userId);
  
  if (!serveRes.success) {
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Etalase Kosong",
        description: "Tidak ada makanan atau minuman siap saji di etalasemu! Masak hidangan terlebih dahulu.",
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  // Increment quest progress
  const questGen = require("../../../src/survival/engines/questGenerator");
  await questGen.incrementQuestProgress(userId, "cafe_serve", 1).catch(() => {});

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.SERVE_BLUE,
    authorName: "👥 Layanan Tamu Kafe",
    title: "✨ Pelanggan Menikmati Pesanan!",
    description: [
      `Tamu baru saja membeli dan menghabiskan **${serveRes.soldQuantity}x ${serveRes.emoji} ${serveRes.dishName}**!`,
      "",
      `💵 **Pendapatan Bersih:** \`+${serveRes.earnings.toLocaleString("id-ID")} ⭐\` (Tips: \`${serveRes.tips} ⭐\`)`,
      `📦 **Sisa Stok:** \`${serveRes.remainingStock} Porsi\``,
      `👥 **Total Tamu Dilayani:** \`${serveRes.customersServed} Orang\``,
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("town", userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle aksi klaim pendapatan pasif (collect)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleCollect(interaction, userId) {
  const collectRes = await cafeEngine.collectIdleRevenue(userId);
  
  if (!collectRes.success) {
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Belum Ada Pendapatan",
        description: "Belum ada akumulasi pendapatan pasif yang bisa diklaim saat ini. Tunggu beberapa waktu lagi!",
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.SUCCESS_GREEN,
    authorName: "💰 Kasir Kafe",
    title: "✨ Pendapatan Pasif Diklaim!",
    description: [
      `Kamu telah memanen hasil usaha dari **${collectRes.cafeName}**!`,
      "",
      `💰 **Total Koin Masuk:** \`+${collectRes.collectedAmount.toLocaleString("id-ID")} Sukamaju Koin (SC)\``,
      `📈 **Level Usaha:** \`Level ${collectRes.level}\``,
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("town", userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle aksi order dari kafe pemain lain
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pembeli
 * @param {string} username - Display name pembeli
 * @param {Object|null} targetUser - Target user pemilik kafe
 * @param {string|null} recipeId - ID resep yang dipesan
 * @returns {Promise<void>}
 */
async function handleOrder(interaction, userId, username, targetUser, recipeId) {
  // Guard: target user required
  if (!targetUser) {
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Pemain Tidak Ditentukan",
        description: "Tentukan pemilik kafe yang ingin kamu kunjungi menggunakan opsi `target_user`!",
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  const targetRecipe = recipeId || DEFAULT_RECIPE_ID;
  const orderRes = await cafeEngine.orderDishFromUser(
    userId,
    targetUser.id,
    targetRecipe,
    username,
  );

  if (!orderRes.success) {
    const msg = getOrderFailMessage(orderRes.reason, targetUser.id, targetRecipe, orderRes.price);
    
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Pesanan Gagal",
        description: msg,
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.ORDER_PURPLE,
    authorName: "🛍️ Pesanan Kafe Antar-Pemain",
    title: "✨ Pesanan Kuliner Berhasil!",
    description: [
      `Kamu berhasil membeli **1x ${orderRes.emoji} ${orderRes.dishName}** dari **${orderRes.sellerCafeName}** (<@${targetUser.id}>)!`,
      "",
      `💸 **Biaya:** \`${orderRes.price} Sukamaju Koin (SC)\``,
      `✨ **Khasiat Buff Aktif:** *${orderRes.buff.description}* (Berlaku selama ${orderRes.buff.durationHours} jam)`,
      "",
      "-# 💡 *Koin telah langsung dikirimkan ke pemilik kafe dan reputasi kafenya bertambah!*",
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("town", userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}
