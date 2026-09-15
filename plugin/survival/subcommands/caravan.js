"use strict";

const { MessageFlags } = require("discord.js");
const tradeEngine = require("../../../src/services/tradeEngine");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = {
  name: "caravan",
  description: "🐫 Ekspedisi Karavan Dagang Antariksa & Bursa Komoditas Global",

  async execute(interaction, context) {
    const action = interaction.options.getString("aksi") || "status";
    const user = interaction.user;
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;

    if (action === "market") {
      const market = tradeEngine.getMarketPrices();
      const routes = tradeEngine.getRoutes();

      const marketLines = Object.values(market)
        .map(
          (m) =>
            `• **${m.name}**: \`${m.currentPrice.toLocaleString("id-ID")}\` Koin / ${m.unit} (${m.trend})`,
        )
        .join("\n");

      const routeLines = Object.values(routes)
        .map(
          (r) =>
            `• **${r.name}**\n  ⏱️ Durasi: \`${r.durationMinutes}m\` | 📈 Margin: \`+${r.profitMarginPercent}%\` | ⚠️ Risiko: \`${r.riskPercent}%\``,
        )
        .join("\n");

      const payload = buildContainerV2({
        authorName: "GALACTIC MERCHANT CARTEL",
        title: "📈 Bursa Komoditas & Rute Ekspedisi Karavan",
        description: `Halo, **${displayName}**! Berikut adalah harga komoditas dan rute perdagangan antariksa terkini:\n\n📦 **Harga Komoditas Pasar:**\n${marketLines}\n\n🗺️ **Rute Perdagangan Aktif:**\n${routeLines}\n\n> *Gunakan \`/survival caravan dispatch\` untuk memberangkatkan karavan dagangmu!*`,
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (action === "dispatch") {
      const routeId = interaction.options.getString("rute") || "tokyo";
      const commodity =
        interaction.options.getString("komoditas") || "GOLDEN_WOOD";
      const amount = interaction.options.getInteger("jumlah") || 10;

      const res = await tradeEngine.dispatchCaravan(
        user.id,
        displayName,
        routeId,
        commodity,
        amount,
      );

      if (!res.success) {
        let msg = "Gagal memberangkatkan karavan.";
        if (res.reason === "INSUFFICIENT_FUNDS") {
          msg = `Saldo koinmu tidak cukup untuk membeli muatan modal karavan (\`${res.requiredCost.toLocaleString("id-ID")}\` Koin)!`;
        }
        if (res.reason === "CARAVAN_ALREADY_ACTIVE") {
          msg = `Kamu sudah memiliki karavan yang sedang dalam perjalanan menuju **${res.caravan?.route?.name}**!`;
        }
        if (res.reason === "MINIMUM_AMOUNT") {
          msg =
            "Jumlah muatan minimal yang dapat diberangkatkan adalah 5 unit!";
        }

        const payload = buildErrorContainerV2({
          title: "Ekspedisi Dibatalkan",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const crv = res.caravan;
      const finishTs = Math.floor(new Date(crv.finishTime).getTime() / 1000);

      const payload = buildContainerV2({
        authorName: "GALACTIC MERCHANT CARTEL",
        title: "🐫 Karavan Dagang Berhasil Diberangkatkan!",
        description: [
          `Selamat jalan, **${displayName}**! Karavanmu telah memulai perjalanan ekspedisi melintasi rute kosmik.`,
          ``,
          `🗺️ **Rute Tujuan:** **${crv.route.name}**`,
          `📦 **Muatan Kargo:** \`${crv.amount}x\` **${crv.commodity.name}**`,
          `💰 **Modal Investasi:** \`${crv.investedCost.toLocaleString("id-ID")}\` Koin`,
          `📈 **Potensi Hasil Penjualan:** \`${crv.potentialProfit.toLocaleString("id-ID")}\` Koin`,
          `⏳ **Estimasi Tiba:** <t:${finishTs}:R> (<t:${finishTs}:t>)`,
          ``,
          `-# 💡 *Setelah karavan tiba, gunakan \`/survival caravan claim\` untuk mencairkan seluruh laba perdaganganmu!*`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (action === "claim") {
      const res = await tradeEngine.claimCaravanProfits(user.id, displayName);

      if (!res.success) {
        let msg = "Tidak ada laba yang dapat diklaim.";
        if (res.reason === "NO_ACTIVE_CARAVAN")
          msg =
            "Kamu tidak memiliki karavan yang sedang aktif atau menunggu klaim!";
        if (res.reason === "STILL_TRAVELING")
          msg = `Karavanmu masih dalam perjalanan! Sisa waktu tempuh sekitar \`${res.remainingMinutes} menit\` lagi.`;

        const payload = buildErrorContainerV2({
          title: "Klaim Belum Siap",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const netProfit = res.profit - res.invested;
      const ambushNote = res.wasAmbushed
        ? "\n⚠️ *Karavan sempat disergap bandit antariksa, namun tim pengawal berhasil menyelamatkan 70% muatan kargo!*"
        : "\n✨ *Perjalanan berlangsung aman tanpa gangguan perompak kosmik!*";

      const payload = buildContainerV2({
        authorName: "GALACTIC MERCHANT CARTEL",
        title: "💰 Laba Ekspedisi Karavan Berhasil Dicairkan!",
        description: [
          `Karavan dagang milik **${displayName}** telah sampai di pangkalan dan seluruh komoditas **${res.commodityName}** berhasil terjual!`,
          ambushNote,
          ``,
          `📦 **Total Muatan Terjual:** \`${res.amount} unit\``,
          `💵 **Penerimaan Kotor:** \`+${res.profit.toLocaleString("id-ID")}\` Koin`,
          `📈 **Keuntungan Bersih:** \`+${netProfit >= 0 ? netProfit.toLocaleString("id-ID") : 0}\` Koin`,
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (action === "escort") {
      const caravanId = interaction.options.getString("caravan_id");
      if (!caravanId) {
        const payload = buildErrorContainerV2({
          title: "ID Karavan Diperlukan",
          description:
            "Silakan masukkan `caravan_id` target yang ingin kamu kawal!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const res = await tradeEngine.joinEscort(caravanId, user.id, 150);
      if (!res.success) {
        let msg = "Gagal bergabung sebagai pengawal.";
        if (res.reason === "ALREADY_ESCORTING") {
          msg = "Kamu sudah terdaftar sebagai pengawal pada karavan ini!";
        }
        const payload = buildErrorContainerV2({
          title: "Pendaftaran Pengawal Gagal",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "GALACTIC MERCHANT CARTEL",
        title: "🛡️ Terdaftar Sebagai Pengawal Bersenjata!",
        description: [
          `Petualang **${displayName}** resmi dikontrak sebagai pengawal keamanan karavan \`${caravanId}\`!`,
          "",
          "⚔️ **Kekuatan Pertahanan Disumbang:** `+150 Combat Power`",
          "💰 **Bagi Hasil Keuntungan:** `15%` saat karavan berhasil mendarat selamat.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    if (action === "ambush") {
      const caravanId = interaction.options.getString("caravan_id");
      if (!caravanId) {
        const payload = buildErrorContainerV2({
          title: "ID Karavan Diperlukan",
          description:
            "Silakan masukkan `caravan_id` target yang ingin kamu sergap!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      const res = await tradeEngine.ambushCaravan(caravanId, user.id, 200);
      if (!res.success) {
        let msg = "Penyergapan gagal dilakukan.";
        if (res.reason === "CARAVAN_NOT_AVAILABLE") {
          msg = "Karavan tidak ditemukan atau sudah selesai melintas rute.";
        }
        if (res.reason === "CANNOT_AMBUSH_OWN_CARAVAN") {
          msg = "Kamu tidak dapat menyergap karavan dagang milikmu sendiri!";
        }
        const payload = buildErrorContainerV2({
          title: "Operasi Sergapan Gagal",
          description: msg,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }

      if (res.raided) {
        const payload = buildContainerV2({
          accentColorHex: "#F43F5E",
          authorName: "PVP CARAVAN AMBUSH",
          title: "🏴‍☠️ Serangan Berhasil! Karavan Berhasil Dijarah!",
          description: [
            `Sergapan kilat **${displayName}** menembus pertahanan pengawal karavan (Peluang Menang: \`${res.winChance}%\`)!`,
            "",
            `💰 **Hasil Jarahan Muatan:** \`+${res.loot.toLocaleString("id-ID")}\` Koin masuk ke dompetmu!`,
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      } else {
        const payload = buildErrorContainerV2({
          title: "🏴‍☠️ Serangan Dipukul Mundur!",
          description: `Pengawal karavan terlalu tangguh! Seranganmu dipukul mundur (Peluang Menang: \`${res.winChance}%\`) dan kamu terkena serangan balik.`,
          footerText: ui.getFooter("survival"),
        });
        return interaction.reply({
          ...payload,
          flags: MessageFlags.IsComponentsV2,
        });
      }
    }

    // Default action: "status"
    const active = await tradeEngine.getActiveCaravan(user.id);
    if (!active) {
      const payload = buildContainerV2({
        authorName: "GALACTIC MERCHANT CARTEL",
        title: "🐫 Status Ekspedisi Karavan",
        description: `Halo, **${displayName}**! Saat ini kamu belum memberangkatkan karavan dagang.\n\n💡 *Gunakan \`/survival caravan market\` untuk mengecek bursa harga dan berangkatkan karavanmu!*`,
        footerText: ui.getFooter("survival"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const finishTs = Math.floor(new Date(active.finishTime).getTime() / 1000);
    const isDone = Date.now() >= new Date(active.finishTime).getTime();

    const payload = buildContainerV2({
      authorName: "GALACTIC MERCHANT CARTEL",
      title: isDone
        ? "✨ Karavan Telah Tiba di Tujuan!"
        : "🐫 Karavan Sedang Melintasi Rute Kosmik",
      description: [
        `Berikut adalah status ekspedisi karavan milik **${displayName}**:`,
        ``,
        `🗺️ **Rute:** **${active.route.name}**`,
        `📦 **Kargo:** \`${active.amount}x\` **${active.commodity.name}**`,
        `💰 **Modal:** \`${active.investedCost.toLocaleString("id-ID")}\` Koin`,
        `📈 **Estimasi Hasil:** \`${active.potentialProfit.toLocaleString("id-ID")}\` Koin`,
        `⏳ **Status Waktu:** ${isDone ? "**Sudah Tiba & Siap Diklaim!**" : `Tiba <t:${finishTs}:R>`}`,
        ``,
        isDone
          ? `👉 *Ketik \`/survival caravan claim\` untuk mengambil koin labamu!*`
          : `*Pengawal karavan sedang berjaga-jaga dari ancaman bandit.*`,
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
