"use strict";

/**
 * @module auction
 * @description Subcommand /survival economy auction - Sistem Lelang Market Place
 * 
 * Fitur Utama:
 * - List lelang aktif dengan filter waktu expired
 * - Sell item ke market lelang dengan harga awal dan opsi buyout
 * - Bid/nawar lelang dengan validasi minimum bid
 * - Instant buyout untuk pembelian langsung
 * - Claim hasil lelang (penjual dapat uang, pemenang dapat barang)
 * - Rate limiter untuk mencegah race condition bidding
 * - Economy Guard integration untuk deteksi fraud
 * - Dynamic tax calculation untuk penjualan
 * - Autocomplete untuk item inventory dan auction ID
 * 
 * @requires discord.js
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/utils/survivalUIHelper
 * @requires ../../../src/models/MarketAuction
 * @requires ../../../src/managers/cacheManager
 * @requires ../../../src/config/ui
 * @requires ../../../src/survival/engines/inventoryHelper
 * @requires ../../../src/utils/rateLimiter
 * @requires ../../../src/services/economyGuardEngine
 * @requires sequelize
 * @requires ../../../src/utils/autocompleteHelper
 */

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const MarketAuction = require("../../../src/models/MarketAuction");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const {
  safeParseInventory,
  takeItemsAtomic,
  addItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const RateLimiter = require("../../../src/utils/rateLimiter");
const economyGuard = require("../../../src/services/economyGuardEngine");
const { Op } = require("sequelize");
const {
  choice,
  safeRespond,
  fuzzyFilter,
} = require("../../../src/utils/autocompleteHelper");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {number} AUCTION_DURATION_HOURS - Durasi lelang dalam jam */
const AUCTION_DURATION_HOURS = 24;

/** @const {number} AUTOCOMPLETE_LIMIT - Limit hasil autocomplete */
const AUTOCOMPLETE_LIMIT = 25;

/** @const {number} LIST_DISPLAY_LIMIT - Limit tampilan list lelang */
const LIST_DISPLAY_LIMIT = 10;

/** @const {number} RATE_LIMIT_WINDOW_SEC - Window rate limit untuk bidding (detik) */
const RATE_LIMIT_WINDOW_SEC = 3;

/** @const {number} MINUTES_PER_HOUR - Konversi menit ke jam */
const MINUTES_PER_HOUR = 60;

/** @const {number} MS_PER_MINUTE - Milidetik per menit */
const MS_PER_MINUTE = 60000;

/** @const {Object} AUCTION_STATUS - Status lelang */
const AUCTION_STATUS = {
  ACTIVE: "active",
  EXPIRED: "expired",
  SOLD: "sold",
  CLAIMED: "claimed",
};

/** @const {Object} CURRENCY_TYPES - Tipe currency yang didukung */
const CURRENCY_TYPES = {
  NSF: "nsf",
  PD: "pd",
};

/** @const {Object} ACTIONS - Aksi yang tersedia */
const ACTIONS = {
  LIST: "list",
  SELL: "sell",
  BID: "bid",
  CLAIM: "claim",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Generate random auction ID
 * @returns {string} Auction ID uppercase 8 karakter
 */
function generateAuctionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

/**
 * Mendapatkan emoji dari UI config dengan fallback
 * @param {string} name - Nama emoji
 * @param {string} fallback - Emoji fallback
 * @returns {string} Emoji string
 */
function getEmoji(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

/**
 * Wrap payload dengan flag ephemeral
 * @param {Object} payload - Payload container V2
 * @returns {Object} Payload dengan flag ephemeral
 */
function makeEphemeral(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

/**
 * Dapatkan emoji currency berdasarkan tipe
 * @param {string} currency - Tipe currency (nsf/pd)
 * @returns {string} Emoji currency
 */
function getCurrencyEmoji(currency) {
  return currency === CURRENCY_TYPES.NSF ? getEmoji("nsf", "⭐") : getEmoji("coin", "🪙");
}

/**
 * Format waktu tersisa dalam format human-readable
 * @param {Date} expiresAt - Waktu expire lelang
 * @returns {string} Formatted time left (contoh: "2j" atau "30m")
 */
function formatTimeLeft(expiresAt) {
  const minutesLeft = Math.max(
    0,
    Math.ceil((new Date(expiresAt) - Date.now()) / MS_PER_MINUTE),
  );
  return minutesLeft > MINUTES_PER_HOUR
    ? `${Math.ceil(minutesLeft / MINUTES_PER_HOUR)}j`
    : `${minutesLeft}m`;
}

/**
 * Debit saldo user berdasarkan tipe currency
 * @param {string} userId - ID pengguna
 * @param {string} currency - Tipe currency
 * @param {number} amount - Jumlah yang didebit
 * @returns {Promise<Object>} Result debit operation
 */
async function debitByCurrency(userId, currency, amount) {
  if (currency === CURRENCY_TYPES.NSF) {
    return cacheManager.debitUserSurvival(userId, "starFragments", amount);
  }
  return cacheManager.debitUserProfile(userId, "economy_wallet", amount);
}

/**
 * Increment saldo user berdasarkan tipe currency
 * @param {string} userId - ID pengguna
 * @param {string} currency - Tipe currency
 * @param {number} amount - Jumlah yang ditambah
 * @returns {Promise<void>}
 */
async function incrementByCurrency(userId, currency, amount) {
  if (currency === CURRENCY_TYPES.NSF) {
    await cacheManager.incrementUserSurvival(userId, "starFragments", amount);
  } else {
    await cacheManager.incrementUserProfile(userId, "economy_wallet", amount);
  }
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  /**
   * Autocomplete handler untuk auction subcommand
   * @param {import('discord.js').AutocompleteInteraction} interaction - Interaksi autocomplete
   * @returns {Promise<void>}
   */
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const action = interaction.options.getString("action");
    
    if (!action) return safeRespond(interaction, []);

    if (focusedOption.name === "target") {
      const focusedValue = focusedOption.value.toLowerCase();

      if (action === ACTIONS.SELL) {
        return handleSellAutocomplete(interaction, focusedValue);
      } else if (action === ACTIONS.BID || action === ACTIONS.CLAIM) {
        return handleAuctionIdAutocomplete(interaction, focusedValue);
      }
    }

    return safeRespond(interaction, []);
  },

  /**
   * Eksekusi subcommand auction
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const action = interaction.options.getString("action");

    switch (action) {
      case ACTIONS.LIST:
        return handleList(interaction);
      case ACTIONS.SELL:
        return handleSell(interaction);
      case ACTIONS.BID:
        return handleBid(interaction);
      case ACTIONS.CLAIM:
        return handleClaim(interaction);
      default:
        return handleList(interaction);
    }
  },
};

// ============================================================================
// AUTOCOMPLETE HANDLERS
// ============================================================================

/**
 * Autocomplete untuk item inventory saat sell
 * @param {import('discord.js').AutocompleteInteraction} interaction - Interaksi autocomplete
 * @param {string} focusedValue - Nilai yang sedang diketik user
 * @returns {Promise<void>}
 */
async function handleSellAutocomplete(interaction, focusedValue) {
  const profile = await cacheManager.getUserProfile(interaction.user.id);
  const inventory = safeParseInventory(profile.inventory);

  const available = inventory.map((item) =>
    choice(`${item.name} (Jumlah: ${item.amount || 1})`, item.id),
  );

  return safeRespond(interaction, fuzzyFilter(available, focusedValue, AUTOCOMPLETE_LIMIT));
}

/**
 * Autocomplete untuk auction ID saat bid/claim
 * @param {import('discord.js').AutocompleteInteraction} interaction - Interaksi autocomplete
 * @param {string} focusedValue - Nilai yang sedang diketik user
 * @returns {Promise<void>}
 */
async function handleAuctionIdAutocomplete(interaction, focusedValue) {
  try {
    const auctions = await MarketAuction.findAll({
      where: { status: AUCTION_STATUS.ACTIVE, expiresAt: { [Op.gt]: new Date() } },
      order: [["expiresAt", "ASC"]],
      limit: AUTOCOMPLETE_LIMIT,
    });

    if (auctions.length === 0) {
      return safeRespond(interaction, [
        choice("❌ Tidak ada lelang aktif saat ini", "none"),
      ]);
    }

    const auctionChoices = auctions.map((auc) => {
      const timeLabel = formatTimeLeft(auc.expiresAt);
      const price = auc.currentBid || auc.startingPrice;
      const currencyLabel = auc.currency === CURRENCY_TYPES.NSF ? "SC" : "PD";
      const label = `[${auc.auctionId}] ${auc.itemName || auc.itemId} - ${price} ${currencyLabel} (${timeLabel} lagi)`;
      return choice(label, auc.auctionId);
    });

    return safeRespond(interaction, fuzzyFilter(auctionChoices, focusedValue, AUTOCOMPLETE_LIMIT));
  } catch (_e) {
    return safeRespond(interaction, []);
  }
}

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle list lelang aktif
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleList(interaction) {
  const auctions = await MarketAuction.findAll({
    where: { status: AUCTION_STATUS.ACTIVE, expiresAt: { [Op.gt]: new Date() } },
    order: [["expiresAt", "ASC"]],
    limit: LIST_DISPLAY_LIMIT,
  });

  if (auctions.length === 0) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Tidak ada barang yang sedang dilelang saat ini.",
        }),
      ),
    );
  }

  let desc = "Silakan gunakan `/survival economy auction action:Bid` beserta ID Lelang untuk menawar barang.\n\n";
  
  for (const auc of auctions) {
    const currencyEmoji = getCurrencyEmoji(auc.currency);
    const price = auc.currentBid > 0 ? auc.currentBid : auc.startingPrice;
    const expiresTimestamp = Math.floor(auc.expiresAt.getTime() / 1000);
    
    desc += `**ID: ${auc.id}** | Penjual: <@${auc.sellerId}>\n`;
    desc += `📦 Item: **${auc.itemId}** (Jumlah: ${auc.amount})\n`;
    desc += `💰 Harga Saat Ini: **${price}** ${currencyEmoji}\n`;
    if (auc.buyoutPrice) {
      desc += `⚡ Beli Instan (Buyout): **${auc.buyoutPrice}** ${currencyEmoji}\n`;
    }
    desc += `⏳ Berakhir: <t:${expiresTimestamp}:R>\n\n`;
  }

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: survivalUI.getColor("amber"),
      authorName: "Market Auction",
      title: "Daftar Lelang Aktif",
      iconURL: interaction.client.user.displayAvatarURL(),
      description: desc,
      footerText: ui.getFooter("survival"),
    }),
  );
}

/**
 * Handle jual item ke lelang
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleSell(interaction) {
  const targetId = interaction.options.getString("target");
  const price = interaction.options.getInteger("price") || 100;
  const buyout = interaction.options.getInteger("buyout");
  const amount = interaction.options.getInteger("amount") || 1;
  const currency = interaction.options.getString("currency") || CURRENCY_TYPES.NSF;
  const userId = interaction.user.id;

  // Validate parameters
  if (!targetId || price <= 0 || amount <= 0) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Mohon isi parameter **target**, **price**, dan **amount** dengan benar saat menjual barang.",
        }),
      ),
    );
  }

  // Validate buyout > price
  if (buyout && buyout <= price) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: `Harga beli instan (buyout) harus lebih tinggi dari harga awal lelang (**${price}**).`,
        }),
      ),
    );
  }

  // Check for duplicate auction
  const duplicateAuction = await MarketAuction.findOne({
    where: {
      itemId: targetId,
      startingPrice: price,
      status: AUCTION_STATUS.ACTIVE,
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (duplicateAuction) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: `Terdapat barang yang sama sedang dijual dengan harga awal yang sama persis (**${price}**).\nNaura merekomendasikanmu untuk mengubah harganya agar barangmu lebih menonjol dan cepat laku!`,
        }),
      ),
    );
  }

  // Get recommended price from economy guard
  const priceRec = await economyGuard.getRecommendedPrice(targetId, currency);

  // Deduct item from inventory
  const success = await takeItemsAtomic(userId, [{ id: targetId, amount }]);

  if (!success) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: `Gagal menjual. Pastikan kamu memiliki ${amount}x ${targetId} di dalam tas.`,
        }),
      ),
    );
  }

  // Create auction record
  const auctionId = generateAuctionId();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + AUCTION_DURATION_HOURS);

  await MarketAuction.create({
    id: auctionId,
    sellerId: userId,
    itemId: targetId,
    amount: amount,
    startingPrice: price,
    buyoutPrice: buyout || null,
    currency: currency,
    currentBid: 0,
    expiresAt: expiresAt,
    status: AUCTION_STATUS.ACTIVE,
  });

  const currencyEmoji = getCurrencyEmoji(currency);

  let desc = `Kamu telah melelang **${amount}x ${targetId}** dengan harga awal **${price}** ${currencyEmoji}`;
  if (buyout) {
    desc += ` (Beli Instan: **${buyout}** ${currencyEmoji})`;
  }
  desc += `.\n\n📊 **Rekomendasi Pasar (7 Hari Terakhir):**\n`;
  desc += `• Kisaran Wajar: **${priceRec.recommendedMin} - ${priceRec.recommendedMax}** ${currencyEmoji}\n`;
  desc += `• Rerata Transaksi: **${priceRec.averagePrice}** ${currencyEmoji} (${priceRec.sampleSize} data transaksi)\n\n`;
  desc += `Lelang ID: **${auctionId}**`;

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      authorName: "Market Auction",
      title: "Barang Berhasil Dilelang!",
      description: desc,
      footerText: ui.getFooter("survival"),
    }),
  );
}

/**
 * Handle bid/nawar lelang
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleBid(interaction) {
  const targetId = interaction.options.getString("target");
  const bidPrice = interaction.options.getInteger("price");
  const userId = interaction.user.id;

  // Validate parameters
  if (!targetId || !bidPrice) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Mohon isi parameter **target** (ID Lelang) dan **price** saat menawar barang.",
        }),
      ),
    );
  }

  // Rate limiter untuk mutex bidding
  const { limited } = await RateLimiter.consume(`auction_bid`, targetId, 1, RATE_LIMIT_WINDOW_SEC);
  if (limited) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Naura sedang memproses penawaran orang lain pada lelang ini. Silakan coba lagi dalam beberapa detik!",
        }),
      ),
    );
  }

  // Find auction
  const auction = await MarketAuction.findOne({
    where: { id: targetId, status: AUCTION_STATUS.ACTIVE },
  });
  
  if (!auction) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Lelang tidak ditemukan atau sudah tidak aktif.",
        }),
      ),
    );
  }

  // Prevent self-bidding
  if (auction.sellerId === userId) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Kamu tidak bisa menawar barang lelangmu sendiri!",
        }),
      ),
    );
  }

  // Check expiration
  if (auction.expiresAt < new Date()) {
    auction.status = AUCTION_STATUS.EXPIRED;
    await auction.save({ fields: ["status"] });
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({ description: "Waktu lelang ini sudah habis!" }),
      ),
    );
  }

  // Validate minimum bid
  const minBid = auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingPrice;
  if (bidPrice < minBid) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: `Tawaran terlalu rendah. Penawaran minimum saat ini adalah **${minBid}**.`,
        }),
      ),
    );
  }

  // Check if buyout
  const isBuyout = Boolean(auction.buyoutPrice && bidPrice >= auction.buyoutPrice);
  const actualCost = isBuyout ? auction.buyoutPrice : bidPrice;

  // Economy guard check
  const guardCheck = economyGuard.evaluateTransaction(
    userId,
    auction.sellerId,
    actualCost,
    isBuyout ? "auction_buyout" : "auction_bid",
  );
  
  if (!guardCheck.allowed) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: guardCheck.reason,
        }),
      ),
    );
  }

  // Debit from buyer
  const debitSuccess = await debitByCurrency(userId, auction.currency, actualCost);

  if (!debitSuccess?.ok) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: `Uang kamu tidak cukup untuk membayar sebesar **${actualCost}**.`,
        }),
      ),
    );
  }

  // Refund previous bidder
  if (auction.highestBidderId) {
    await incrementByCurrency(auction.highestBidderId, auction.currency, auction.currentBid);
  }

  const currencyEmoji = getCurrencyEmoji(auction.currency);

  // Handle instant buyout
  if (isBuyout) {
    return handleInstantBuyout(interaction, auction, userId, actualCost, currencyEmoji);
  }

  // Update auction with new bid
  auction.currentBid = bidPrice;
  auction.highestBidderId = userId;
  await auction.save({ fields: ["currentBid", "highestBidderId"] });

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      authorName: "Market Auction",
      description: `Kamu berhasil menawar Lelang **${auction.id}** sebesar **${bidPrice}** ${currencyEmoji}!`,
      footerText: ui.getFooter("survival"),
    }),
  );
}

/**
 * Handle instant buyout completion
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} auction - Auction record
 * @param {string} buyerId - ID pembeli
 * @param {number} actualCost - Biaya buyout
 * @param {string} currencyEmoji - Emoji currency
 * @returns {Promise<void>}
 */
async function handleInstantBuyout(interaction, auction, buyerId, actualCost, currencyEmoji) {
  // Update auction status
  auction.currentBid = actualCost;
  auction.highestBidderId = buyerId;
  auction.status = AUCTION_STATUS.SOLD;
  await auction.save({ fields: ["currentBid", "highestBidderId", "status"] });

  // Send items to buyer
  await addItemsAtomic(buyerId, [
    { id: auction.itemId, amount: auction.amount },
  ]);

  // Calculate tax and pay seller
  const taxRate = economyGuard.calculateDynamicTax();
  const tax = Math.floor(actualCost * taxRate);
  const finalEarn = actualCost - tax;
  
  await incrementByCurrency(auction.sellerId, auction.currency, finalEarn);

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      authorName: "Market Auction",
      title: "Beli Instan Berhasil!",
      description: `Kamu berhasil membeli instan (buyout) **${auction.amount}x ${auction.itemId}** seharga **${actualCost}** ${currencyEmoji}!\n\nBarang telah dikirim langsung ke tasmu. Penjual telah menerima pembayarannya.`,
      footerText: ui.getFooter("survival"),
    }),
  );
}

/**
 * Handle claim hasil lelang
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @returns {Promise<void>}
 */
async function handleClaim(interaction) {
  const targetId = interaction.options.getString("target");
  const userId = interaction.user.id;

  // Validate parameter
  if (!targetId) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Mohon isi parameter **target** (ID Lelang) saat mengklaim barang.",
        }),
      ),
    );
  }

  // Find auction
  const auction = await MarketAuction.findOne({ where: { id: targetId } });
  
  if (!auction) {
    return interaction.editReply(
      makeEphemeral(buildErrorContainerV2({ description: "Lelang tidak ditemukan." })),
    );
  }

  const isSeller = auction.sellerId === userId;
  const isWinner = auction.highestBidderId === userId;

  // Validate user role in auction
  if (!isSeller && !isWinner) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Kamu bukan penjual ataupun pemenang dari lelang ini.",
        }),
      ),
    );
  }

  // Check if already claimed
  if (auction.status === AUCTION_STATUS.CLAIMED) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Lelang ini sudah diklaim sebelumnya.",
        }),
      ),
    );
  }

  // Check if still active
  if (auction.status === AUCTION_STATUS.ACTIVE && auction.expiresAt > new Date()) {
    return interaction.editReply(
      makeEphemeral(
        buildErrorContainerV2({
          description: "Lelang ini masih berlangsung, belum bisa diklaim.",
        }),
      ),
    );
  }

  // Set status to expired if just ended
  if (auction.status === AUCTION_STATUS.ACTIVE) {
    auction.status = AUCTION_STATUS.EXPIRED;
  }

  const currencyEmoji = getCurrencyEmoji(auction.currency);

  // Handle sold auction
  if (auction.highestBidderId) {
    if (isSeller) {
      return handleSellerClaim(interaction, auction, userId, currencyEmoji);
    } else if (isWinner) {
      return handleWinnerClaim(interaction, auction, currencyEmoji);
    }
  } else {
    // Handle unsold auction
    if (isSeller) {
      return handleUnsoldClaim(interaction, auction, userId);
    }
  }

  return interaction.editReply(
    makeEphemeral(
      buildErrorContainerV2({ description: "Tindakan klaim tidak valid." }),
    ),
  );
}

/**
 * Handle seller claiming earnings from sold auction
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} auction - Auction record
 * @param {string} userId - ID penjual
 * @param {string} currencyEmoji - Emoji currency
 * @returns {Promise<void>}
 */
async function handleSellerClaim(interaction, auction, userId, currencyEmoji) {
  const rawEarn = auction.currentBid;
  const taxRate = economyGuard.calculateDynamicTax();
  const tax = Math.floor(rawEarn * taxRate);
  const finalEarn = rawEarn - tax;
  const taxPercent = (taxRate * 100).toFixed(1);

  await incrementByCurrency(userId, auction.currency, finalEarn);

  auction.status = AUCTION_STATUS.CLAIMED;
  await auction.save({ fields: ["status"] });

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      description: `Lelang laku! Kamu mendapatkan **${finalEarn}** ${currencyEmoji} (setelah pajak pasar ${taxPercent}% sebesar ${tax} dari ${rawEarn}).`,
    }),
  );
}

/**
 * Handle winner claiming items from won auction
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} auction - Auction record
 * @param {string} currencyEmoji - Emoji currency
 * @returns {Promise<void>}
 */
async function handleWinnerClaim(interaction, auction, currencyEmoji) {
  // Give items to winner
  await addItemsAtomic(auction.highestBidderId, [
    { id: auction.itemId, amount: auction.amount },
  ]);

  // Calculate tax and pay seller
  const tax = Math.floor(auction.currentBid * 0.05);
  const finalEarn = auction.currentBid - tax;

  await incrementByCurrency(auction.sellerId, auction.currency, finalEarn);

  auction.status = AUCTION_STATUS.CLAIMED;
  await auction.save({ fields: ["status"] });

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("success"),
      description: "Lelang telah diselesaikan! Pemenang menerima barang, dan uang telah dikirimkan ke penjual.",
    }),
  );
}

/**
 * Handle seller claiming back unsold items
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} auction - Auction record
 * @param {string} userId - ID penjual
 * @returns {Promise<void>}
 */
async function handleUnsoldClaim(interaction, auction, userId) {
  // Return items to seller
  await addItemsAtomic(userId, [
    { id: auction.itemId, amount: auction.amount },
  ]);

  auction.status = AUCTION_STATUS.CLAIMED;
  await auction.save({ fields: ["status"] });

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: survivalUI.getColor("amber"),
      description: `Lelang tidak ada yang menawar. Barang **${auction.amount}x ${auction.itemId}** telah dikembalikan ke tasmu.`,
    }),
  );
}
