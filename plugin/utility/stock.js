"use strict";

const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const stockMarketEngine = require("../../src/services/stockMarketEngine");
const GuildClan = require("../../src/models/GuildClan");
const UserStockHolding = require("../../src/models/UserStockHolding");
const {
  choice,
  safeRespond,
  fuzzyFilter,
} = require("../../src/utils/autocompleteHelper");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { drawStockMarket } = require("../../src/canvas/stockCanvas");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("stock")
    .setDescription("📈 Bursa Efek Virtual Neo-Hoshino & Virtual Startup")
    .addSubcommand((sub) =>
      sub
        .setName("market")
        .setDescription(
          "Lihat ringkasan pergerakan harga seluruh saham di bursa efek",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("buy")
        .setDescription("Beli lembar saham di bursa efek")
        .addStringOption((opt) =>
          opt
            .setName("ticker")
            .setDescription(
              "Kode Ticker Saham (contoh: HOSHINO_AI, NAURA_COIN, NEO_ENERGY)",
            )
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("jumlah")
            .setDescription("Jumlah lembar yang ingin dibeli")
            .setMinValue(1)
            .setMaxValue(10000)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("sell")
        .setDescription("Jual lembar saham yang kamu miliki")
        .addStringOption((opt) =>
          opt
            .setName("ticker")
            .setDescription("Kode Ticker Saham yang ingin dijual")
            .setAutocomplete(true)
            .setRequired(true),
        )
        .addIntegerOption((opt) =>
          opt
            .setName("jumlah")
            .setDescription("Jumlah lembar yang ingin dijual")
            .setMinValue(1)
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("portfolio")
        .setDescription(
          "Lihat portofolio investasi saham, valuasi aset, dan laba/rugi",
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ipo")
        .setDescription(
          "Daftarkan startup baru klan ke bursa efek (Biaya: 25.000 ⭐ dari kas klan)",
        )
        .addStringOption((opt) =>
          opt
            .setName("ticker")
            .setDescription("Kode Ticker unik (contoh: CLAN_LTD, CYBER_CORP)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama lengkap perusahaan startup")
            .setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt
            .setName("high_risk")
            .setDescription(
              "Apakah startup ini bertipe High Risk High Reward? (Opsional)",
            )
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const userId = interaction.user.id;
    const username = interaction.user.displayName || interaction.user.username;

    // 1. MARKET OVERVIEW
    if (subcommand === "market") {
      await interaction.deferReply();
      const stocks = await stockMarketEngine.getMarketOverview();
      const files = [];

      try {
        const stockBuf = await canvasWorkerPool
          .execute({
            task: "renderStockMarket",
            payload: stocks,
            userId,
          })
          .catch(() => drawStockMarket(stocks));
        files.push(
          new AttachmentBuilder(stockBuf, { name: "stock_market.png" }),
        );
      } catch (err) {
        // Fallback jika canvas terkendala
      }

      const eGreen = ui.getEmoji("greenping") || "🟢";
      const eRed = ui.getEmoji("redping") || "🔴";
      const eFire = ui.getEmoji("fire") || "🔥";
      const eStar = ui.getEmoji("star") || "⭐";
      const eChart = ui.getEmoji("chart") || "📈";
      const eFlash = ui.getEmoji("stamina") || "⚡";
      const eSparkle = ui.getEmoji("sparkle") || "💡";

      const stockList = stocks
        .map((s) => {
          const isUp = (s.currentPrice || 100) >= (s.previousPrice || 100);
          const icon = isUp ? `${eGreen} ▲` : `${eRed} ▼`;
          const tag = s.isHighRisk ? ` ${eFire} \`[HIGH RISK]\`` : "";
          return `**• ${s.name}** (\`${s.ticker}\`)${tag}\n  - Harga: **${s.currentPrice} ${eStar}** (${icon}) | Dividen: \`${Math.floor(s.dividendYield * 100)}%\``;
        })
        .join("\n\n");

      const buttonsRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("stock_btn_port")
          .setLabel("Portofolio")
          .setEmoji(ui.parseEmoji(ui.getEmoji("briefcase")) || { name: "💼" })
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("stock_btn_refresh")
          .setLabel("Refresh Pasar")
          .setStyle(ButtonStyle.Secondary),
      );

      const payload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: `${eChart} Bursa Efek Virtual Neo-Hoshino`,
        title: `${eFlash} Daftar Saham & Indeks Pasar`,
        description: [
          `Selamat datang di pasar modal bursa efek virtual Neo-Hoshino!`,
          ``,
          stockList,
          ``,
          `-# ${eSparkle} *Beli saham dengan \`/stock buy ticker:HOSHINO_AI jumlah:10\` atau jalankan IPO klan dengan \`/stock ipo\`!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
        buttonsRow,
      });

      return interaction.editReply({ ...payload, files });
    }

    // 2. BUY STOCK
    if (subcommand === "buy") {
      await interaction.deferReply();
      const ticker = interaction.options.getString("ticker").toUpperCase();
      const quantity = interaction.options.getInteger("jumlah");

      const res = await stockMarketEngine.tradeStock(
        userId,
        ticker,
        "BUY",
        quantity,
      );
      if (!res.success) {
        let msg = "Gagal membeli saham.";
        if (res.reason === "STOCK_NOT_FOUND")
          msg = `Saham dengan ticker \`${ticker}\` tidak ditemukan di bursa efek!`;
        if (res.reason === "INSUFFICIENT_FUNDS")
          msg = `Saldo Star Fragments tidak cukup! Butuh ${res.cost.toLocaleString("id-ID")} ⭐ untuk membeli ${quantity} lembar ${ticker}.`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Transaksi Beli Ditolak",
            description: msg,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const eChart = ui.getEmoji("chart") || "📈";
      const eCelebrate = ui.getEmoji("celebrate") || "🎉";
      const eWallet = ui.getEmoji("wallet") || "💵";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eBriefcase = ui.getEmoji("briefcase") || "💼";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: `${eChart} Konfirmasi Pembelian Saham`,
        title: `${eCelebrate} Pembelian Saham Berhasil!`,
        description: [
          `Kamu telah membeli **${res.quantity} Lembar** saham **${res.ticker}**!`,
          ``,
          `${eWallet} **Harga Satuan:** \`${res.unitPrice} ${eStar} / lembar\``,
          `${eCoin} **Total Biaya Transaksi:** \`${res.totalCost.toLocaleString("id-ID")} Star Fragments\``,
          `${eBriefcase} **Total Kepemilikan:** \`${res.currentShares} Lembar\``,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // 3. SELL STOCK
    if (subcommand === "sell") {
      await interaction.deferReply();
      const ticker = interaction.options.getString("ticker").toUpperCase();
      const quantity = interaction.options.getInteger("jumlah");

      const res = await stockMarketEngine.tradeStock(
        userId,
        ticker,
        "SELL",
        quantity,
      );
      if (!res.success) {
        let msg = "Gagal menjual saham.";
        if (res.reason === "STOCK_NOT_FOUND")
          msg = `Saham dengan ticker \`${ticker}\` tidak ditemukan di bursa efek!`;
        if (res.reason === "INSUFFICIENT_SHARES")
          msg = `Kamu hanya memiliki ${res.owned} lembar saham ${ticker}, tidak cukup untuk menjual ${res.requested} lembar!`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Transaksi Jual Ditolak",
            description: msg,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const eChartDown = ui.getEmoji("chart_down") || "📉";
      const eCelebrate = ui.getEmoji("celebrate") || "🎉";
      const eWallet = ui.getEmoji("wallet") || "💵";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eBriefcase = ui.getEmoji("briefcase") || "💼";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#86EFAC",
        authorName: `${eChartDown} Konfirmasi Penjualan Saham`,
        title: `${eCelebrate} Penjualan Saham Berhasil!`,
        description: [
          `Kamu telah menjual **${res.quantity} Lembar** saham **${res.ticker}**!`,
          ``,
          `${eWallet} **Harga Jual Satuan:** \`${res.unitPrice} ${eStar} / lembar\``,
          `${eCoin} **Dana Diterima:** \`+${res.totalGained.toLocaleString("id-ID")} Star Fragments\``,
          `${eBriefcase} **Sisa Kepemilikan:** \`${res.remainingShares} Lembar\``,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // 4. PORTFOLIO
    if (subcommand === "portfolio") {
      await interaction.deferReply();
      const port = await stockMarketEngine.getUserPortfolio(userId);

      if (port.holdings.length === 0) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Portofolio Kosong",
            description:
              "Kamu belum memiliki lembar saham apa pun di bursa efek! Buka `/stock market` untuk mulai berinvestasi.",
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const eGreen = ui.getEmoji("greenping") || "🟢";
      const eRed = ui.getEmoji("redping") || "🔴";
      const eStar = ui.getEmoji("star") || "⭐";
      const eBriefcase = ui.getEmoji("briefcase") || "💼";
      const ePoll = ui.getEmoji("poll") || "📊";

      const holdingsList = port.holdings
        .map((h) => {
          const plSign = h.profitLoss >= 0 ? "+" : "";
          const plColor = h.profitLoss >= 0 ? eGreen : eRed;
          return `**• ${h.name}** (\`${h.ticker}\`)\n  - Jumlah: \`${h.shares} Lembar\` (Avg: \`${h.avgBuyPrice} ${eStar}\` | Now: \`${h.currentPrice} ${eStar}\`)\n  - Valuasi: **${h.currentValue.toLocaleString("id-ID")} ${eStar}** (${plColor} ${plSign}${h.profitPercent}%)`;
        })
        .join("\n\n");

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: `${eBriefcase} Portofolio Investasi Saham`,
        title: `Investor: ${username}`,
        description: [
          `${ePoll} **Total Nilai Portofolio:** \`${port.totalPortfolioValue.toLocaleString("id-ID")} Star Fragments\``,
          ``,
          holdingsList,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    // 5. IPO STARTUP REGISTRATION
    if (subcommand === "ipo") {
      await interaction.deferReply();
      const ticker = interaction.options.getString("ticker");
      const name = interaction.options.getString("nama");
      const isHighRisk = interaction.options.getBoolean("high_risk") || false;

      // Temukan klan pengguna
      const allClans = await GuildClan.findAll();
      const userClan = allClans.find((c) => {
        const members = Array.isArray(c.members)
          ? c.members
          : typeof c.members === "string"
            ? JSON.parse(c.members)
            : [];
        return c.leaderId === userId || members.includes(userId);
      });

      if (!userClan) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Klan Diperlukan",
            description:
              "Hanya klan terdaftar yang dapat menerbitkan Initial Public Offering (IPO) untuk mendirikan Virtual Startup!",
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const ipoRes = await stockMarketEngine.launchStartupIPO(
        userClan.id,
        ticker,
        name,
        isHighRisk,
      );
      if (!ipoRes.success) {
        let msg = "Gagal menerbitkan IPO.";
        if (ipoRes.reason === "TICKER_ALREADY_EXISTS")
          msg = `Kode ticker \`${ticker}\` sudah digunakan oleh korporat lain di bursa efek!`;
        if (ipoRes.reason === "INSUFFICIENT_VAULT")
          msg = `Kas brankas klan tidak cukup! Butuh ${ipoRes.cost.toLocaleString("id-ID")} ⭐ dari kas klan.`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pendaftaran IPO Ditolak",
            description: msg,
            footerText: ui.getFooter("utility"),
          }),
        });
      }

      const eBell = ui.getEmoji("bell") || "🔔";
      const eCelebrate = ui.getEmoji("celebrate") || "🎉";
      const eWallet = ui.getEmoji("wallet") || "💵";
      const eBox = ui.getEmoji("shop_box") || "📦";
      const eChart = ui.getEmoji("chart") || "📈";
      const eFire = ui.getEmoji("fire") || "🔥";
      const eCoin = ui.getEmoji("coin") || "💰";
      const eStar = ui.getEmoji("star") || "⭐";

      const payload = buildContainerV2({
        accentColorHex: "#FFD700",
        authorName: `${eBell} Bel Pembukaan Bursa Saham (IPO)`,
        title: `${eCelebrate} INITIAL PUBLIC OFFERING RESMI!`,
        description: [
          `Selamat! Klan **${userClan.name}** resmi meluncurkan startup **${ipoRes.stock.name}** (\`${ipoRes.stock.ticker}\`) ke bursa efek!`,
          ``,
          `${eWallet} **Harga Perdana (IPO Price):** \`100.0 ${eStar} / lembar\``,
          `${eBox} **Total Lembar Tersedia:** \`10.000 Lembar\``,
          `${eChart} **Tipe Startup:** \`${ipoRes.stock.isHighRisk ? `High Risk High Reward ${eFire}` : "Standard Corporate"}\``,
          `${eCoin} **Dividen:** \`${Math.floor(ipoRes.stock.dividendYield * 100)}%\``,
          ``,
          `Seluruh petualang di server kini dapat memperdagangkan saham klanmu!`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }
  },

  async autocomplete(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const userId = interaction.user.id;

    if (subcommand === "buy") {
      try {
        const stocks = await stockMarketEngine.getMarketOverview();
        const choices = stocks.map((s) => {
          const price = Number(s.currentPrice || 0).toFixed(1);
          const riskEmoji = s.isHighRisk ? "🔥 " : "";
          const label = `${riskEmoji}[${s.ticker}] ${s.name} (${price} ⭐)`;
          return choice(label, s.ticker);
        });
        return safeRespond(interaction, fuzzyFilter(choices, focusedValue, 25));
      } catch (_e) {
        return safeRespond(interaction, []);
      }
    }

    if (subcommand === "sell") {
      try {
        const holdings = await UserStockHolding.findAll({
          where: { userId },
        });
        if (holdings.length === 0) {
          return safeRespond(interaction, [
            choice("❌ Kamu belum memiliki saham apa pun", "none"),
          ]);
        }
        const choices = holdings
          .filter((h) => (h.sharesOwned || 0) > 0)
          .map((h) => {
            const label = `[${h.ticker}] Dimiliki: ${h.sharesOwned} lembar (Beli: ${Number(h.averageBuyPrice || 0).toFixed(1)} ⭐)`;
            return choice(label, h.ticker);
          });
        return safeRespond(interaction, fuzzyFilter(choices, focusedValue, 25));
      } catch (_e) {
        return safeRespond(interaction, []);
      }
    }

    return safeRespond(interaction, []);
  },
};
