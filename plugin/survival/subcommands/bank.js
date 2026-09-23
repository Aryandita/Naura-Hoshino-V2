"use strict";

// Naura Central Bank. Konfigurasinya di bankConfig.js, transaksinya di
// bankActions.js, tampilannya di bankViews.js. Berkas ini hanya mengatur alur.
//
// Versi lama berkas ini memanggil variabel yang tidak pernah dibuat
// (assetObj, currentVal, embed, logger), sehingga tab deposito dan investasi
// selalu gagal di tengah jalan. Semua itu sudah dibereskan di sini.

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

const CITY_KEYS = ["kota", "city"];

const FAIL_MESSAGE = {
  invalid_amount:
    "Nominalnya belum terbaca. Tulis angkanya saja ya, misalnya `1500`.",
  below_minimum: "Nominalnya masih di bawah batas minimum.",
  insufficient: "Saldonya belum cukup untuk transaksi ini.",
  coupon_locked: "Naura Coupon tidak bisa ditukar, itu barang langka!",
  unsupported_pair: "Pasangan mata uang itu belum dilayani loket Naura.",
  same_currency: "Itu mata uang yang sama, jadi tidak perlu ditukar~",
  already_active: "Masih ada yang aktif. Selesaikan yang itu dulu, ya.",
  no_deposit: "Kamu belum punya deposito yang bisa dicairkan.",
  locked: "Depositomu masih terkunci.",
  no_asset: "Kamu belum punya portofolio itu.",
  no_profile: "Naura belum bisa membaca datamu. Coba beberapa saat lagi.",
  unknown_term: "Pilihan jangka waktunya tidak Naura kenali.",
  unknown_asset: "Portofolio itu tidak Naura kenali.",
  one_way_restricted:
    "Kebijakan Moneter Central Bank: Penukaran Coin ke Star Fragments (NSF) dikunci satu arah untuk menjaga integritas tantangan survival di alam liar.",
};

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

function failText(result) {
  const base =
    FAIL_MESSAGE[result.reason] || "Ada yang kurang pas dengan transaksinya.";
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

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const survival = await cacheManager.getUserSurvival(user.id);

    if (survival.currentLocation === "prison") {
      return ui.sendError(interaction, "err_sys_34", true);
    }

    if (!CITY_KEYS.includes(survival.currentLocation)) {
      return ui.sendError(
        interaction,
        "Naura Central Bank cuma ada di Kota, lho. Pakai `/survival travel` dulu ya, Naura tunggu di sana!",
        true,
      );
    }

    const snapshotNow = async () =>
      actions.snapshot(await actions.freshData(user.id));

    const showMain = async (target) => {
      const payload = views.mainView(user, await snapshotNow());
      return target.editReply(payload);
    };

    const response = await interaction.editReply(
      views.mainView(user, await snapshotNow()),
    );

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    let activePromptRun = null;

    /**
     * Tanya nominal lewat chat atau quick chips, lalu jalankan transaksinya.
     * Kartu utama selalu dirapikan kembali setelah selesai.
     */
    const askAmount = async (
      i,
      { title, description, balance = 0, unit = "", run },
    ) => {
      activePromptRun = run;
      await i.editReply(views.promptView(title, description, balance, unit));

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
              : views.failView(failText(result)),
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

    collector.on("collect", async (i) => {
      try {
        await i.deferUpdate();
        const id = i.customId;

        if (id === "bank_back") return showMain(i);

        if (id.startsWith("bank_chip_")) {
          const parts = id.split("_");
          const chipAmount = parts[parts.length - 1];
          if (activePromptRun && chipAmount) {
            const runner = activePromptRun;
            activePromptRun = null;
            const result = await runner(chipAmount);
            await interaction.followUp({
              ...(result.ok
                ? views.successView(result.title, result.description)
                : views.failView(failText(result))),
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
            return showMain(interaction);
          }
        }

        if (id === "bank_menu_exchange") {
          return i.editReply(views.exchangeView(await snapshotNow()));
        }

        if (id === "bank_menu_savings") {
          return i.editReply(views.savingsView(await snapshotNow()));
        }

        if (id === "bank_menu_deposit") {
          return i.editReply(views.depositView(await snapshotNow()));
        }

        if (id === "bank_menu_invest") {
          const snap = await snapshotNow();
          const { payload, rows } = views.investView(
            snap,
            actions.valuate(snap.investments, snap.day),
          );
          return i.editReply({
            ...payload,
            components: [...payload.components, ...rows],
          });
        }

        // --- Penukaran mata uang ---
        if (id === "bank_ex_to_nsf") {
          return i.reply({
            content: `${e("warning")} **Kebijakan One-Way Bridge:**\nNaura Central Bank tidak melayani penukaran Naura Coin kembali ke Star Fragments (NSF) untuk menjaga keadilan ekosistem bertahan hidup di alam liar Naura Wilds~`,
            flags: MessageFlags.Ephemeral,
          });
        }

        if (id === "bank_ex_to_coin") {
          const snap = await snapshotNow();
          const fromKind = currencyHelper.FRAGMENT;
          const toKind = currencyHelper.COIN;
          const fromCurrency = currencyHelper.byKind(fromKind);
          const toCurrency = currencyHelper.byKind(toKind);
          const availableBalance = snap.fragment;

          const quote =
            await currencyHelper.getDynamicRateAndFee(availableBalance);

          return askAmount(i, {
            title: `Tukar ${fromCurrency.short} ke ${toCurrency.short}`,
            description: `Tulis jumlah **${fromCurrency.name}** yang mau ditukar.\n${e("info")} Kurs dinamis hari ini: **${views.n(quote.rate)} ${fromCurrency.short} = 1 ${toCurrency.short}** (Biaya admin progresif 5% - 15% didaur ulang ke komunitas).`,
            balance: availableBalance,
            unit: fromCurrency.short,
            run: async (raw) => {
              const result = await actions.exchangeMoney(
                user.id,
                fromKind,
                toKind,
                raw,
              );
              if (!result.ok) return result;

              const feeText =
                result.feeNsf > 0
                  ? `\n💼 **Biaya Admin (${result.feePercent * 100}%):** ${views.n(result.feeNsf)} NSF didaur ulang ke fasilitas komunitas.`
                  : "";
              const ticketText =
                result.ticketsAwarded > 0
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

        // --- Tabungan ---
        if (id === "bank_savings_in" || id === "bank_savings_out") {
          const snap = await snapshotNow();
          const toBank = id === "bank_savings_in";
          const availableBalance = toBank ? snap.coin : snap.bank;

          return askAmount(i, {
            title: toBank ? "Setor ke rekening" : "Tarik ke dompet",
            description: toBank
              ? "Tulis jumlah **Naura Coin** yang mau kamu simpan di rekening."
              : "Tulis jumlah **Naura Coin** yang mau kamu ambil dari rekening.",
            balance: availableBalance,
            unit: "Coin",
            run: async (raw) => {
              const result = await actions.moveSavings(user.id, raw, toBank);
              if (!result.ok) return result;
              return {
                ok: true,
                title: toBank ? "Setoran diterima!" : "Penarikan selesai!",
                description: [
                  toBank
                    ? `**${views.n(result.amount)} Naura Coin** sudah aman di rekeningmu.`
                    : `**${views.n(result.amount)} Naura Coin** sudah pindah ke dompetmu.`,
                  "",
                  `${e("bank")} Rekening: \`${views.n(result.bank)}\``,
                  `${e("wallet")} Dompet: \`${views.n(result.wallet)}\``,
                ].join("\n"),
              };
            },
          });
        }

        // --- Deposito ---
        if (id.startsWith("bank_dep_create_")) {
          const snap = await snapshotNow();
          const termKey = id.replace("bank_dep_create_", "");
          return askAmount(i, {
            title: "Buka deposito baru",
            description: `Tulis jumlah **Naura Coin** dari rekening yang mau dititipkan. Minimal **${views.n(MIN_DEPOSIT_COIN)} Coin**.`,
            balance: snap.bank,
            unit: "Coin",
            run: async (raw) => {
              const result = await actions.createDeposit(user.id, termKey, raw);
              if (!result.ok) return result;
              return {
                ok: true,
                title: "Deposito dibuka!",
                description: `**${views.n(result.amount)} Naura Coin** tersimpan dalam paket **${result.term.label}** (${result.term.name}).\nJatuh tempo pada hari ke-**${result.unlockDay}**. Naura ingatkan nanti, ya!`,
              };
            },
          });
        }

        if (id === "bank_dep_claim") {
          const result = await actions.claimDeposit(user.id);
          if (!result.ok) {
            return i.followUp({
              ...views.failView(failText(result)),
              flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            });
          }

          await i.followUp({
            ...views.successView(
              "Deposito dicairkan!",
              [
                `Pokok **${views.n(result.amount)} Coin** ditambah bunga **${views.n(result.interest)} Coin**.`,
                `Total **${views.n(result.payout)} Coin** sudah masuk rekeningmu dari paket ${result.termName}.`,
              ].join("\n"),
            ),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return showMain(i);
        }

        // --- Investasi ---
        if (id.startsWith("bank_inv_buy_")) {
          const assetKey = id.replace("bank_inv_buy_", "");
          const asset = assetOf(assetKey);
          if (!asset) return;

          return askAmount(i, {
            title: `Beli ${asset.name}`,
            description: `Tulis jumlah **Naura Coin** dari rekening yang mau diinvestasikan. Minimal **${views.n(MIN_INVEST_COIN)} Coin**.`,
            run: async (raw) => {
              const result = await actions.buyInvestment(
                user.id,
                assetKey,
                raw,
              );
              if (!result.ok) return result;
              return {
                ok: true,
                title: "Investasi tercatat!",
                description: `**${views.n(result.amount)} Naura Coin** masuk ke portofolio **${result.asset.name}**. Naura pantau nilainya tiap hari!`,
              };
            },
          });
        }

        if (id.startsWith("bank_inv_sell_")) {
          const assetKey = id.replace("bank_inv_sell_", "");
          const result = await actions.sellInvestment(user.id, assetKey);

          if (!result.ok) {
            return i.followUp({
              ...views.failView(failText(result)),
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
                `> ${result.profit >= 0 ? e("dungeon_win") : e("naura_akward")} Selisih: **${sign}${views.n(result.profit)} Coin** (${sign}${result.roi.toFixed(2)}%)`,
              ].join("\n"),
            ),
            flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
          });
          return showMain(i);
        }
      } catch (error) {
        logger.error("[BANK MENU]", error);
      }
    });

    // Pesan Components V2 tidak boleh dikosongkan komponennya, jadi kartu
    // penutup dirender ulang seperti biasa.
    collector.on("end", async () => {
      const snap = await snapshotNow().catch(() => null);
      if (!snap) return;
      const closing = views.mainView(user, snap);
      await interaction.editReply(closing).catch(() => {});
    });
  },
};
