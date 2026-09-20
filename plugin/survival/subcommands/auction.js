"use strict";

const { MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
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

// Helper random ID generator if nanoId is not available
function generateAuctionId() {
  return Math.random().toString(36).substring(2, 10).toUpperCase();
}

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

function hidden(payload) {
  return {
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  };
}

module.exports = {
  async autocomplete(interaction) {
    const focusedOption = interaction.options.getFocused(true);
    const action = interaction.options.getString("action");
    if (!action) return safeRespond(interaction, []);

    if (focusedOption.name === "target") {
      const focusedValue = focusedOption.value.toLowerCase();

      if (action === "sell") {
        // Tampilkan item dari inventory user
        const profile = await cacheManager.getUserProfile(interaction.user.id);
        const inventory = safeParseInventory(profile.inventory);

        const available = inventory.map((item) =>
          choice(`${item.name} (Jumlah: ${item.amount || 1})`, item.id),
        );

        return safeRespond(
          interaction,
          fuzzyFilter(available, focusedValue, 25),
        );
      } else if (action === "bid" || action === "claim") {
        // Tampilkan active auction IDs agar user bisa pilih langsung
        try {
          const auctions = await MarketAuction.findAll({
            where: { status: "active", expiresAt: { [Op.gt]: new Date() } },
            order: [["expiresAt", "ASC"]],
            limit: 25,
          });

          if (auctions.length === 0) {
            return safeRespond(interaction, [
              choice("❌ Tidak ada lelang aktif saat ini", "none"),
            ]);
          }

          const auctionChoices = auctions.map((auc) => {
            const timeLeft = Math.max(
              0,
              Math.ceil((new Date(auc.expiresAt) - Date.now()) / 60000),
            );
            const timeLabel =
              timeLeft > 60 ? `${Math.ceil(timeLeft / 60)}j` : `${timeLeft}m`;
            const label =
              `[${auc.auctionId}] ${auc.itemName || auc.itemId} - ` +
              `${auc.currentBid || auc.startingPrice} ${auc.currency === "nsf" ? "NSF" : "Koin"} (${timeLabel} lagi)`;
            return choice(label, auc.auctionId);
          });

          return safeRespond(
            interaction,
            fuzzyFilter(auctionChoices, focusedValue, 25),
          );
        } catch (_e) {
          return safeRespond(interaction, []);
        }
      }
    }

    return safeRespond(interaction, []);
  },

  async execute(interaction) {
    // Survival.js already deferred the reply.
    // Wait, let's check if we should editReply instead of followUp.
    // Survival uses editReply.

    const action = interaction.options.getString("action");

    if (action === "list") {
      return handleList(interaction);
    } else if (action === "sell") {
      return handleSell(interaction);
    } else if (action === "bid") {
      return handleBid(interaction);
    } else if (action === "claim") {
      return handleClaim(interaction);
    }
  },
};

async function handleList(interaction) {
  const auctions = await MarketAuction.findAll({
    where: { status: "active", expiresAt: { [Op.gt]: new Date() } },
    order: [["expiresAt", "ASC"]],
    limit: 10,
  });

  if (auctions.length === 0) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Tidak ada barang yang sedang dilelang saat ini.",
        }),
      ),
    );
  }

  let desc =
    "Silakan gunakan `/survival economy auction action:Bid` beserta ID Lelang untuk menawar barang.\n\n";
  for (const auc of auctions) {
    const currencyEmoji =
      auc.currency === "nsf" ? e("nsf", "⭐") : e("coin", "🪙");
    const price = auc.currentBid > 0 ? auc.currentBid : auc.startingPrice;
    desc += `**ID: ${auc.id}** | Penjual: <@${auc.sellerId}>\n`;
    desc += `📦 Item: **${auc.itemId}** (Jumlah: ${auc.amount})\n`;
    desc += `💰 Harga Saat Ini: **${price}** ${currencyEmoji}\n`;
    if (auc.buyoutPrice) {
      desc += `⚡ Beli Instan (Buyout): **${auc.buyoutPrice}** ${currencyEmoji}\n`;
    }
    desc += `⏳ Berakhir: <t:${Math.floor(auc.expiresAt.getTime() / 1000)}:R>\n\n`;
  }

  return interaction.editReply(
    buildContainerV2({
      accentColorHex: ui.getColor("primary"),
      authorName: "Market Auction",
      title: "Daftar Lelang Aktif",
      iconURL: interaction.client.user.displayAvatarURL(),
      description: desc,
      footerText: ui.getFooter("survival"),
    }),
  );
}

async function handleSell(interaction) {
  const targetId = interaction.options.getString("target");
  const price = interaction.options.getInteger("price") || 100;
  const buyout = interaction.options.getInteger("buyout");
  const amount = interaction.options.getInteger("amount") || 1;
  const currency = interaction.options.getString("currency") || "nsf";
  const userId = interaction.user.id;

  if (!targetId || price <= 0 || amount <= 0) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description:
            "Mohon isi parameter **target**, **price**, dan **amount** dengan benar saat menjual barang.",
        }),
      ),
    );
  }

  if (buyout && buyout <= price) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: `Harga beli instan (buyout) harus lebih tinggi dari harga awal lelang (**${price}**).`,
        }),
      ),
    );
  }

  // Cek apakah ada barang yang dijual dengan harga sama persis
  const duplicateAuction = await MarketAuction.findOne({
    where: {
      itemId: targetId,
      startingPrice: price,
      status: "active",
      expiresAt: { [Op.gt]: new Date() },
    },
  });

  if (duplicateAuction) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: `Terdapat barang yang sama sedang dijual dengan harga awal yang sama persis (**${price}**).\nNaura merekomendasikanmu untuk mengubah harganya agar barangmu lebih menonjol dan cepat laku!`,
        }),
      ),
    );
  }

  // Hitung kisaran harga rekomendasi 7 hari terakhir
  const priceRec = await economyGuard.getRecommendedPrice(targetId, currency);

  // Deduct item safely
  const success = await takeItemsAtomic(userId, [{ id: targetId, amount }]);

  if (!success) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: `Gagal menjual. Pastikan kamu memiliki ${amount}x ${targetId} di dalam tas.`,
        }),
      ),
    );
  }

  const auctionId = generateAuctionId();
  const expiresAt = new Date();
  expiresAt.setHours(expiresAt.getHours() + 24); // 24 jam batas lelang

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
    status: "active",
  });

  const currencyEmoji = currency === "nsf" ? e("nsf", "⭐") : e("coin", "🪙");

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

async function handleBid(interaction) {
  const targetId = interaction.options.getString("target"); // Auction ID
  const bidPrice = interaction.options.getInteger("price");
  const userId = interaction.user.id;

  if (!targetId || !bidPrice) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description:
            "Mohon isi parameter **target** (ID Lelang) dan **price** saat menawar barang.",
        }),
      ),
    );
  }

  // Rate Limiter untuk Mutex Bidding (1 bid per 3 detik per lelang untuk mencegah race condition)
  const { limited } = await RateLimiter.consume(`auction_bid`, targetId, 1, 3);
  if (limited) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description:
            "Naura sedang memproses penawaran orang lain pada lelang ini. Silakan coba lagi dalam beberapa detik!",
        }),
      ),
    );
  }

  // Find auction
  const auction = await MarketAuction.findOne({
    where: { id: targetId, status: "active" },
  });
  if (!auction) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Lelang tidak ditemukan atau sudah tidak aktif.",
        }),
      ),
    );
  }

  if (auction.sellerId === userId) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Kamu tidak bisa menawar barang lelangmu sendiri!",
        }),
      ),
    );
  }

  if (auction.expiresAt < new Date()) {
    auction.status = "expired";
    await auction.save({ fields: ["status"] });
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({ description: "Waktu lelang ini sudah habis!" }),
      ),
    );
  }

  const minBid =
    auction.currentBid > 0 ? auction.currentBid + 1 : auction.startingPrice;
  if (bidPrice < minBid) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: `Tawaran terlalu rendah. Penawaran minimum saat ini adalah **${minBid}**.`,
        }),
      ),
    );
  }

  const isBuyout = Boolean(auction.buyoutPrice && bidPrice >= auction.buyoutPrice);
  const actualCost = isBuyout ? auction.buyoutPrice : bidPrice;

  // Evaluasi integritas penawaran melalui Economy Guard & Circuit Breaker
  const guardCheck = economyGuard.evaluateTransaction(
    userId,
    auction.sellerId,
    actualCost,
    isBuyout ? "auction_buyout" : "auction_bid",
  );
  if (!guardCheck.allowed) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: guardCheck.reason,
        }),
      ),
    );
  }

  // Deduct from buyer
  let debitSuccess = false;
  if (auction.currency === "nsf") {
    debitSuccess = await cacheManager.debitUserSurvival(
      userId,
      "starFragments",
      actualCost,
    );
  } else {
    debitSuccess = await cacheManager.debitUserProfile(
      userId,
      "economy_wallet",
      actualCost,
    );
  }

  if (!debitSuccess) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: `Uang kamu tidak cukup untuk membayar sebesar **${actualCost}**.`,
        }),
      ),
    );
  }

  // Refund previous bidder
  if (auction.highestBidderId) {
    if (auction.currency === "nsf") {
      await cacheManager.incrementUserSurvival(
        auction.highestBidderId,
        "starFragments",
        auction.currentBid,
      );
    } else {
      await cacheManager.incrementUserProfile(
        auction.highestBidderId,
        "economy_wallet",
        auction.currentBid,
      );
    }
  }

  const currencyEmoji =
    auction.currency === "nsf" ? e("nsf", "⭐") : e("coin", "🪙");

  if (isBuyout) {
    // Selesaikan langsung lelang (instant buyout)
    auction.currentBid = actualCost;
    auction.highestBidderId = userId;
    auction.status = "sold";
    await auction.save({ fields: ["currentBid", "highestBidderId", "status"] });

    // Kirim barang ke pembeli
    await addItemsAtomic(userId, [
      { id: auction.itemId, amount: auction.amount },
    ]);

    // Beri hasil penjualan ke penjual setelah dipotong pajak
    const taxRate = economyGuard.calculateDynamicTax();
    const tax = Math.floor(actualCost * taxRate);
    const finalEarn = actualCost - tax;
    if (auction.currency === "nsf") {
      await cacheManager.incrementUserSurvival(
        auction.sellerId,
        "starFragments",
        finalEarn,
      );
    } else {
      await cacheManager.incrementUserProfile(
        auction.sellerId,
        "economy_wallet",
        finalEarn,
      );
    }

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

  // Update auction
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

async function handleClaim(interaction) {
  const targetId = interaction.options.getString("target");
  const userId = interaction.user.id;

  if (!targetId) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description:
            "Mohon isi parameter **target** (ID Lelang) saat mengklaim barang.",
        }),
      ),
    );
  }

  const auction = await MarketAuction.findOne({ where: { id: targetId } });
  if (!auction) {
    return interaction.editReply(
      hidden(buildErrorContainerV2({ description: "Lelang tidak ditemukan." })),
    );
  }

  const isSeller = auction.sellerId === userId;
  const isWinner = auction.highestBidderId === userId;

  if (!isSeller && !isWinner) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Kamu bukan penjual ataupun pemenang dari lelang ini.",
        }),
      ),
    );
  }

  if (auction.status === "claimed") {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Lelang ini sudah diklaim sebelumnya.",
        }),
      ),
    );
  }

  if (auction.status === "active" && auction.expiresAt > new Date()) {
    return interaction.editReply(
      hidden(
        buildErrorContainerV2({
          description: "Lelang ini masih berlangsung, belum bisa diklaim.",
        }),
      ),
    );
  }

  // Set status if it just expired
  if (auction.status === "active") {
    auction.status = "expired";
  }

  // Resolve auction
  const currencyEmoji =
    auction.currency === "nsf" ? e("nsf", "⭐") : e("coin", "🪙");

  if (auction.highestBidderId) {
    // Auction sold
    if (isSeller) {
      // Seller gets money minus dynamic tax
      const rawEarn = auction.currentBid;
      const taxRate = economyGuard.calculateDynamicTax();
      const tax = Math.floor(rawEarn * taxRate);
      const finalEarn = rawEarn - tax;
      const taxPercent = (taxRate * 100).toFixed(1);

      if (auction.currency === "nsf") {
        await cacheManager.incrementUserSurvival(
          userId,
          "starFragments",
          finalEarn,
        );
      } else {
        await cacheManager.incrementUserProfile(
          userId,
          "economy_wallet",
          finalEarn,
        );
      }

      auction.status = "claimed";
      await auction.save({ fields: ["status"] });

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("success"),
          description: `Lelang laku! Kamu mendapatkan **${finalEarn}** ${currencyEmoji} (setelah pajak pasar ${taxPercent}% sebesar ${tax} dari ${rawEarn}).`,
        }),
      );
    } else if (isWinner) {
      // Winner gets items
      await addItemsAtomic(userId, [
        { id: auction.itemId, amount: auction.amount },
      ]);

      const tax = Math.floor(auction.currentBid * 0.05);
      const finalEarn = auction.currentBid - tax;

      // Give seller money
      if (auction.currency === "nsf") {
        await cacheManager.incrementUserSurvival(
          auction.sellerId,
          "starFragments",
          finalEarn,
        );
      } else {
        await cacheManager.incrementUserProfile(
          auction.sellerId,
          "economy_wallet",
          finalEarn,
        );
      }

      // Give winner items
      await addItemsAtomic(auction.highestBidderId, [
        { id: auction.itemId, amount: auction.amount },
      ]);

      auction.status = "claimed";
      await auction.save({ fields: ["status"] });

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("success"),
          description: `Lelang telah diselesaikan! Pemenang menerima barang, dan uang telah dikirimkan ke penjual.`,
        }),
      );
    }
  } else {
    // Auction unsold
    if (isSeller) {
      // Return items
      await addItemsAtomic(userId, [
        { id: auction.itemId, amount: auction.amount },
      ]);

      auction.status = "claimed";
      await auction.save({ fields: ["status"] });

      return interaction.editReply(
        buildContainerV2({
          accentColorHex: ui.getColor("primary"),
          description: `Lelang tidak ada yang menawar. Barang **${auction.amount}x ${auction.itemId}** telah dikembalikan ke tasmu.`,
        }),
      );
    }
  }

  return interaction.editReply(
    hidden(
      buildErrorContainerV2({ description: "Tindakan klaim tidak valid." }),
    ),
  );
}
