"use strict";

/**
 * @module bank
 * @description Subcommand /survival bank - Naura Central Bank System
 * 
 * Fitur Utama:
 * - Menu utama bank dengan navigasi interaktif
 * - Penukaran mata uang (SC <-> PD) dengan kurs dinamis
 * - Tabungan (setor/tarik PD dari rekening)
 * - Deposito berjangka dengan bunga
 * - Investasi portofolio aset virtual
 * - Chat collector untuk input nominal transaksi
 * - Quick chip buttons untuk nominal preset
 * 
 * Arsitektur:
 * - Konfigurasi di bankConfig.js
 * - Transaksi di bankActions.js
 * - Tampilan di bankViews.js
 * - File ini hanya mengatur alur kontrol
 * 
 * @requires discord.js
 * @requires ../../../src/managers/logger
 * @requires ../../../src/config/ui
 * @requires ../../../src/managers/cacheManager
 * @requires ../../../src/survival/engines/currency
 * @requires ../../../src/survival/helpers/bankActions
 * @requires ../../../src/survival/helpers/bankViews
 * @requires ../../../src/survival/data/bankConfig
 * @requires ../../../src/utils/NauraContainerBuilder
 */

const { MessageFlags } = require("discord.js");
const { logger } = require("../../../src/managers/logger");
const ui = require("../../../src/config/ui");
const cacheManager = require("../../../src/managers/cacheManager");
const currencyHelper = require("../../../src/survival/engines/currency");
const actions = require("../../../src/survival/helpers/bankActions");
const views = require("../../../src/survival/helpers/bankViews");
const {
  COLLECTOR_MS,
  ANSWER_MS,
  MIN_DEPOSIT_COIN,
  MIN_INVEST_COIN,
  assetOf,
} = require("../../../src/survival/data/bankConfig");
const {
  disableContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {Array<string>} CITY_KEYS - Lokasi yang memiliki akses bank */
const CITY_KEYS = ["kota", "city"];

/** @const {Object} FAIL_MESSAGE - Pesan error berdasarkan reason code */
const FAIL_MESSAGE = {
  invalid_amount: "Nominalnya belum terbaca. Tulis angkanya saja ya, misalnya `1500`.",
  below_minimum: "Nominalnya masih di bawah batas minimum.",
  insufficient: "Saldonya belum cukup untuk transaksi ini.",
  coupon_locked: "Voucher Beasiswa (VB) tidak bisa ditukar, itu barang langka!",
  unsupported_pair: "Pasangan mata uang itu belum dilayani loket Naura.",
  same_currency: "Itu mata uang yang sama, jadi tidak perlu ditukar~",
  already_active: "Masih ada yang aktif. Selesaikan yang itu dulu, ya.",
  no_deposit: "Kamu belum punya deposito yang bisa dicairkan.",
  locked: "Depositomu masih terkunci.",
  no_asset: "Kamu belum punya portofolio itu.",
  no_profile: "Naura belum bisa membaca datamu. Coba beberapa saat lagi.",
  unknown_term: "Pilihan jangka waktunya tidak Naura kenali.",
  unknown_asset: "Portofolio itu tidak Naura kenali.",
  one_way_restricted: "Kebijakan Moneter Bank Sentral: Penukaran Pratama Dollar (PD) ke Sukamaju Koin (SC) dibatasi satu arah untuk menjaga integritas tantangan survival di alam liar.",
};

/** @const {Object} BUTTON_IDS - Custom ID untuk tombol bank */
const BUTTON_IDS = {
  BACK: "bank_back",
  CHIP_PREFIX: "bank_chip_",
  MENU_EXCHANGE: "bank_menu_exchange",
  MENU_SAVINGS: "bank_menu_savings",
  MENU_DEPOSIT: "bank_menu_deposit",
  MENU_INVEST: "bank_menu_invest",
  EXCHANGE_TO_NSF: "bank_ex_to_nsf",
  EXCHANGE_TO_COIN: "bank_ex_to_coin",
  SAVINGS_IN: "bank_savings_in",
  SAVINGS_OUT: "bank_savings_out",
  DEPOSIT_CREATE_PREFIX: "bank_dep_create_",
  DEPOSIT_CLAIM: "bank_dep_claim",
  INVEST_BUY_PREFIX: "bank_inv_buy_",
  INVEST_SELL_PREFIX: "bank_inv_sell_",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

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
 * Format pesan error berdasarkan result object
 * @param {Object} result - Result object dari transaksi
 * @param {string} result.reason - Reason code error
 * @param {number} [result.shortage] - Jumlah kekurangan saldo
 * @param {number} [result.minimum] - Minimum amount required
 * @param {number} [result.daysLeft] - Hari tersisa untuk unlock
 * @returns {string} Formatted error message
 */
function formatFailMessage(result) {
  const base = FAIL_MESSAGE[result.reason] || "Ada yang kurang pas dengan transaksinya.";
  
  if (result.reason === "insufficient" && result.shortage) {
    return `${base} Kamu masih kurang **${views.n(result.shortage)}**.`;
  }
  if (result.reason === "below_minimum" && result.minimum) {
    return `${base} Minimalnya **${views.n(result.minimum)}**.`;
  }
  if (result.reason === "locked" && result.daysLeft) {
    return `${base} Sisa **${result.daysLeft}** hari lagi.`;
  }
  
  return base;
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  /**
   * Eksekusi subcommand bank
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const user = interaction.user;
    const survival = await cacheManager.getUserSurvival(user.id);

    // Guard: prison location
    if (survival.currentLocation === "prison") {
      return ui.sendError(interaction, "err_sys_34", true);
    }

    // Guard: must be in city
    if (!CITY_KEYS.includes(survival.currentLocation)) {
      return ui.sendError(
        interaction,
        "Naura Central Bank cuma ada di Kota, lho. Pakai `/survival travel` dulu ya, Naura tunggu di sana!",
        true,
      );
    }

    // Helper to get fresh snapshot
    const snapshotNow = async () =>
      actions.snapshot(await actions.freshData(user.id));

    // Initialize main view
    let currentView = views.mainView(user, await snapshotNow());

    // Helper to refresh and show main view
    const showMain = async (target) => {
      currentView = views.mainView(user, await snapshotNow());
      return target.editReply(currentView);
    };

    const response = await interaction.editReply(currentView);

    // Setup button collector
    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let activePromptRun = null;

    /**
     * Prompt user untuk input nominal via chat atau quick chips
     * @param {import('discord.js').ButtonInteraction} i - Button interaction
     * @param {Object} options - Opsi prompt
     * @param {string} options.title - Judul prompt
     * @param {string} options.description - Deskripsi prompt
     * @param {number} [options.balance=0] - Saldo tersedia
     * @param {string} [options.unit=""] - Unit currency
     * @param {Function} options.run - Fungsi transaksi yang dijalankan
     */
    const askAmount = async (i, { title, description, balance = 0, unit = "", run }) => {
      activePromptRun = run;
      currentView = views.promptView(title, description, balance, unit);
      await i.editReply(currentView);

      if (!interaction.channel) return;

      const chat = interaction.channel.createMessageCollector({
        filter: (m) => m.author.id === user.id,
        time: ANSWER_MS,
        max: 1,
      });

      chat.on("collect", async (m) => {
        try {
          activePromptRun = null;
          const result = await run(m.content.trim());
          await m.reply(
            result.ok
              ? views.successView(result.title, result.description)
              : views.failView(formatFailMessage(result)),
          );
        } catch (err) {
          logger.error("[BANK TRANSACTION]", err);
          await m
            .reply(
              views.failView(
                "Ada yang tersangkut di sistem bank. Naura sudah catat, coba lagi sebentar lagi ya.",
              ),
            )
            .catch(() => {});
        } finally {
          await showMain(interaction).catch(() => {});
        }
      });

      chat.on("end", async (collected) => {
        if (collected.size === 0 && activePromptRun) {
          activePromptRun = null;
          await interaction
            .followUp({
              ...views.failView(
                "Waktunya habis, jadi transaksinya Naura batalkan dulu. Tidak ada saldo yang berkurang, kok!",
              ),
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            })
            .catch(() => {});
          await showMain(interaction).catch(() => {});
        }
      });
    };

    // Handle button interactions
    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();
        const id = i.customId;

        // Back button
        if (id === BUTTON_IDS.BACK) return showMain(i);

        // Quick chip buttons
        if (id.startsWith(BUTTON_IDS.CHIP_PREFIX)) {
          const parts = id.split("_");
          const chipAmount = parts[parts.length - 1];
          if (activePromptRun && chipAmount) {
            const runner = activePromptRun;
            activePromptRun = null;
            const result = await runner(chipAmount);
            await interaction.followUp({
              ...(result.ok
                ? views.successView(result.title, result.description)
                : views.failView(formatFailMessage(result))),
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return showMain(interaction);
          }
        }

        // Menu navigation
        if (id === BUTTON_IDS.MENU_EXCHANGE) {
          currentView = views.exchangeView(await snapshotNow());
          return i.editReply(currentView);
        }

        if (id === BUTTON_IDS.MENU_SAVINGS) {
          currentView = views.savingsView(await snapshotNow());
          return i.editReply(currentView);
        }

        if (id === BUTTON_IDS.MENU_DEPOSIT) {
          currentView = views.depositView(await snapshotNow());
          return i.editReply(currentView);
        }

        if (id === BUTTON_IDS.MENU_INVEST) {
          const snap = await snapshotNow();
          currentView = views.investView(
            snap,
            actions.valuate(snap.investments, snap.day),
          );
          return i.editReply(currentView);
        }

        // Exchange actions
        if (id === BUTTON_IDS.EXCHANGE_TO_NSF) {
          return handleOneWayRestriction(i);
        }

        if (id === BUTTON_IDS.EXCHANGE_TO_COIN) {
          return handleExchangeToCoin(i, user, snapshotNow, askAmount);
        }

        // Savings actions
        if (id === BUTTON_IDS.SAVINGS_IN || id === BUTTON_IDS.SAVINGS_OUT) {
          return handleSavingsAction(i, user, id, snapshotNow, askAmount);
        }

        // Deposit actions
        if (id.startsWith(BUTTON_IDS.DEPOSIT_CREATE_PREFIX)) {
          return handleDepositCreate(i, user, id, snapshotNow, askAmount);
        }

        if (id === BUTTON_IDS.DEPOSIT_CLAIM) {
          return handleDepositClaim(i, user, showMain);
        }

        // Investment actions
        if (id.startsWith(BUTTON_IDS.INVEST_BUY_PREFIX)) {
          return handleInvestBuy(i, user, id, askAmount);
        }

        if (id.startsWith(BUTTON_IDS.INVEST_SELL_PREFIX)) {
          return handleInvestSell(i, user, id, showMain);
        }
      } catch (error) {
        logger.error("[BANK MENU]", error);
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "navigated") return;
      if (currentView) {
        await interaction.editReply(disableContainerV2(currentView)).catch(() => {});
      }
    });
  },
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle one-way restriction warning untuk PD -> SC
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @returns {Promise<void>}
 */
async function handleOneWayRestriction(i) {
  return i.reply({
    content: `${getEmoji("warning")} **Kebijakan One-Way Bridge:**\nNaura Central Bank tidak melayani penukaran Pratama Dollar (PD) kembali ke Sukamaju Koin (SC) untuk menjaga keadilan ekosistem bertahan hidup di alam liar Naura Wilds~`,
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle penukaran SC ke PD
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @param {Function} snapshotNow - Function to get fresh snapshot
 * @param {Function} askAmount - Function to prompt for amount
 * @returns {Promise<void>}
 */
async function handleExchangeToCoin(i, user, snapshotNow, askAmount) {
  const snap = await snapshotNow();
  const fromKind = currencyHelper.FRAGMENT;
  const toKind = currencyHelper.COIN;
  const fromCurrency = currencyHelper.byKind(fromKind);
  const toCurrency = currencyHelper.byKind(toKind);
  const availableBalance = snap.fragment;

  const quote = await currencyHelper.getDynamicRateAndFee(availableBalance);

  return askAmount(i, {
    title: `Tukar ${fromCurrency.short} ke ${toCurrency.short}`,
    description: `Tulis jumlah **${fromCurrency.name}** yang mau ditukar.\n${getEmoji("info")} Kurs dinamis hari ini: **${views.n(quote.rate)} ${fromCurrency.short} = 1 ${toCurrency.short}** (Biaya admin progresif 5% - 15% didaur ulang ke komunitas).`,
    balance: availableBalance,
    unit: fromCurrency.short,
    run: async (raw) => {
      const result = await actions.exchangeMoney(user.id, fromKind, toKind, raw);
      if (!result.ok) return result;

      const feeText = result.feeNsf > 0
        ? `\n💼 **Biaya Admin (${result.feePercent * 100}%):** ${views.n(result.feeNsf)} SC didaur ulang ke fasilitas komunitas.`
        : "";
      const ticketText = result.ticketsAwarded > 0
        ? `\n🎟️ **Bonus Undian:** Kamu mendapatkan **+${result.ticketsAwarded} Tiket Astral Lottery**!`
        : "";

      return {
        ok: true,
        title: "Penukaran berhasil!",
        description: [
          `Kamu menukar **${views.n(result.spent)} ${fromCurrency.short}** menjadi ${currencyHelper.format(toCurrency, result.received)}.`,
          feeText,
          ticketText,
          "",
          `${currencyHelper.emojiOf(fromCurrency)} Sisa ${fromCurrency.short}: \`${views.n(result.balanceFrom)}\``,
          `${currencyHelper.emojiOf(toCurrency)} ${toCurrency.short} sekarang: \`${views.n(result.balanceTo)}\``,
        ]
          .filter(Boolean)
          .join("\n"),
      };
    },
  });
}

/**
 * Handle aksi tabungan (setor/tarik)
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @param {string} id - Custom ID button
 * @param {Function} snapshotNow - Function to get fresh snapshot
 * @param {Function} askAmount - Function to prompt for amount
 * @returns {Promise<void>}
 */
async function handleSavingsAction(i, user, id, snapshotNow, askAmount) {
  const snap = await snapshotNow();
  const toBank = id === BUTTON_IDS.SAVINGS_IN;
  const availableBalance = toBank ? snap.coin : snap.bank;

  return askAmount(i, {
    title: toBank ? "Setor ke rekening" : "Tarik ke dompet",
    description: toBank
      ? "Tulis jumlah **Pratama Dollar (PD)** yang mau kamu simpan di rekening."
      : "Tulis jumlah **Pratama Dollar (PD)** yang mau kamu ambil dari rekening.",
    balance: availableBalance,
    unit: "PD",
    run: async (raw) => {
      const result = await actions.moveSavings(user.id, raw, toBank);
      if (!result.ok) return result;
      return {
        ok: true,
        title: toBank ? "Setoran diterima!" : "Penarikan selesai!",
        description: [
          toBank
            ? `**${views.n(result.amount)} Pratama Dollar (PD)** sudah aman di rekeningmu.`
            : `**${views.n(result.amount)} Pratama Dollar (PD)** sudah pindah ke dompetmu.`,
          "",
          `${getEmoji("bank")} Rekening: \`${views.n(result.bank)}\``,
          `${getEmoji("wallet")} Dompet: \`${views.n(result.wallet)}\``,
        ].join("\n"),
      };
    },
  });
}

/**
 * Handle buka deposito baru
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @param {string} id - Custom ID button
 * @param {Function} snapshotNow - Function to get fresh snapshot
 * @param {Function} askAmount - Function to prompt for amount
 * @returns {Promise<void>}
 */
async function handleDepositCreate(i, user, id, snapshotNow, askAmount) {
  const snap = await snapshotNow();
  const termKey = id.replace(BUTTON_IDS.DEPOSIT_CREATE_PREFIX, "");
  
  return askAmount(i, {
    title: "Buka deposito baru",
    description: `Tulis jumlah **Pratama Dollar (PD)** dari rekening yang mau dititipkan. Minimal **${views.n(MIN_DEPOSIT_COIN)} PD**.`,
    balance: snap.bank,
    unit: "PD",
    run: async (raw) => {
      const result = await actions.createDeposit(user.id, termKey, raw);
      if (!result.ok) return result;
      return {
        ok: true,
        title: "Deposito dibuka!",
        description: `**${views.n(result.amount)} Pratama Dollar (PD)** tersimpan dalam paket **${result.term.label}** (${result.term.name}).\nJatuh tempo pada hari ke-**${result.unlockDay}**. Naura ingatkan nanti, ya!`,
      };
    },
  });
}

/**
 * Handle klaim deposito jatuh tempo
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @returns {Promise<void>}
 */
async function handleDepositClaim(i, user, showMain) {
  const result = await actions.claimDeposit(user.id);
  
  if (!result.ok) {
    return i.followUp({
      ...views.failView(formatFailMessage(result)),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  await i.followUp({
    ...views.successView(
      "Deposito dicairkan!",
      [
        `Pokok **${views.n(result.amount)} PD** ditambah bunga **${views.n(result.interest)} PD**.`,
        `Total **${views.n(result.payout)} PD** sudah masuk rekeningmu dari paket ${result.termName}.`,
      ].join("\n"),
    ),
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  
  return showMain(i);
}

/**
 * Handle beli investasi
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @param {string} id - Custom ID button
 * @param {Function} askAmount - Function to prompt for amount
 * @returns {Promise<void>}
 */
async function handleInvestBuy(i, user, id, askAmount) {
  const assetKey = id.replace(BUTTON_IDS.INVEST_BUY_PREFIX, "");
  const asset = assetOf(assetKey);
  if (!asset) return;

  return askAmount(i, {
    title: `Beli ${asset.name}`,
    description: `Tulis jumlah **Pratama Dollar (PD)** dari rekening yang mau diinvestasikan. Minimal **${views.n(MIN_INVEST_COIN)} PD**.`,
    run: async (raw) => {
      const result = await actions.buyInvestment(user.id, assetKey, raw);
      if (!result.ok) return result;
      return {
        ok: true,
        title: "Investasi tercatat!",
        description: `**${views.n(result.amount)} Pratama Dollar (PD)** masuk ke portofolio **${result.asset.name}**. Naura pantau nilainya tiap hari!`,
      };
    },
  });
}

/**
 * Handle jual investasi
 * @param {import('discord.js').ButtonInteraction} i - Button interaction
 * @param {Object} user - Discord user
 * @param {string} id - Custom ID button
 * @returns {Promise<void>}
 */
async function handleInvestSell(i, user, id, showMain) {
  const assetKey = id.replace(BUTTON_IDS.INVEST_SELL_PREFIX, "");
  const result = await actions.sellInvestment(user.id, assetKey);

  if (!result.ok) {
    return i.followUp({
      ...views.failView(formatFailMessage(result)),
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    });
  }

  const sign = result.profit >= 0 ? "+" : "";
  await i.followUp({
    ...views.successView(
      "Portofolio dicairkan!",
      [
        `**${result.asset.name}** sudah dijual seluruhnya.`,
        "",
        `> Modal awal: **${views.n(result.principal)} Coin**`,
        `> Lama investasi: **${result.elapsed}** hari`,
        `> Hasil pencairan: **${views.n(result.value)} Coin**`,
        `> ${result.profit >= 0 ? getEmoji("dungeon_win") : getEmoji("naura_akward")} Selisih: **${sign}${views.n(result.profit)} Coin** (${sign}${result.roi.toFixed(2)}%)`,
      ].join("\n"),
    ),
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
  });
  
  return showMain(i);
}
