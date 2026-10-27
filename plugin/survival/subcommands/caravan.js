"use strict";

/**
 * @module caravan
 * @description Subcommand /survival caravan - Ekspedisi Karavan Dagang Antariksa & Bursa Komoditas
 * 
 * Fitur Utama:
 * - Market prices dan routes information
 * - Mercenary roster dan expedition modes
 * - Dispatch karavan dengan komoditas dan rute pilihan
 * - Claim profit setelah karavan tiba
 * - Escort system untuk mengawal karavan pemain lain
 * - Ambush PvP untuk menyergap karavan musuh
 * - Board listing untuk kontrak pengawalan
 * - Status tracking karavan aktif
 * 
 * @requires discord.js
 * @requires ../../../src/services/tradeEngine
 * @requires ../../../src/survival/engines/caravanEngine
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/config/ui
 */

const { MessageFlags } = require("discord.js");
const tradeEngine = require("../../../src/services/tradeEngine");
const caravanEngine = require("../../../src/survival/engines/caravanEngine");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {Object} ACTIONS - Daftar aksi yang tersedia */
const ACTIONS = {
  MARKET: "market",
  MERCENARY: "mercenary",
  DISPATCH: "dispatch",
  CLAIM: "claim",
  ESCORT: "escort",
  BOARD: "board",
  AMBUSH: "ambush",
  STATUS: "status",
};

/** @const {Object} ACCENT_COLORS - Warna aksen untuk berbagai konteks */
const ACCENT_COLORS = {
  MERCENARY_BLUE: "#38BDF8",
  AMBUSH_RED: "#F43F5E",
};

/** @const {number} DEFAULT_COMMODITY_AMOUNT - Jumlah default komoditas */
const DEFAULT_COMMODITY_AMOUNT = 10;

/** @const {string} DEFAULT_COMMODITY - Komoditas default */
const DEFAULT_COMMODITY = "GOLDEN_WOOD";

/** @const {string} DEFAULT_ROUTE - Rute default */
const DEFAULT_ROUTE = "tokyo";

/** @const {string} DEFAULT_MODE - Mode ekspedisi default */
const DEFAULT_MODE = "standard";

/** @const {number} ESCORT_COMBAT_POWER - Combat power yang disumbang pengawal */
const ESCORT_COMBAT_POWER = 150;

/** @const {number} ESCORT_PROFIT_SHARE_PERCENT - Bagi hasil untuk pengawal */
const ESCORT_PROFIT_SHARE_PERCENT = 15;

/** @const {number} AMBUSH_ATTACK_POWER - Attack power untuk ambush */
const AMBUSH_ATTACK_POWER = 200;

/** @const {Object} FAIL_REASONS - Reason codes untuk kegagalan */
const FAIL_REASONS = {
  INSUFFICIENT_FUNDS: "INSUFFICIENT_FUNDS",
  CARAVAN_ALREADY_ACTIVE: "CARAVAN_ALREADY_ACTIVE",
  MINIMUM_AMOUNT: "MINIMUM_AMOUNT",
  NO_ACTIVE_CARAVAN: "NO_ACTIVE_CARAVAN",
  STILL_TRAVELING: "STILL_TRAVELING",
  ALREADY_ESCORTING: "ALREADY_ESCORTING",
  CARAVAN_NOT_AVAILABLE: "CARAVAN_NOT_AVAILABLE",
  CANNOT_AMBUSH_OWN_CARAVAN: "CANNOT_AMBUSH_OWN_CARAVAN",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Format timestamp Unix untuk Discord
 * @param {Date|number} date - Date object atau timestamp
 * @returns {number} Unix timestamp dalam detik
 */
function toUnixTimestamp(date) {
  return Math.floor(new Date(date).getTime() / 1000);
}

/**
 * Format market prices list
 * @param {Object} market - Market prices object
 * @returns {string} Formatted market lines
 */
function formatMarketPrices(market) {
  return Object.values(market)
    .map((m) => `• **${m.name}**: \`${m.currentPrice.toLocaleString("id-ID")}\` Koin / ${m.unit} (${m.trend})`)
    .join("\n");
}

/**
 * Format routes list
 * @param {Object} routes - Routes object
 * @returns {string} Formatted route lines
 */
function formatRoutes(routes) {
  return Object.values(routes)
    .map((r) => `• **${r.name}**\n  ⏱️ Durasi: \`${r.durationMinutes}m\` | 📈 Margin: \`+${r.profitMarginPercent}%\` | ⚠️ Risiko: \`${r.riskPercent}%\``)
    .join("\n");
}

/**
 * Format mercenary roster list
 * @param {Object} roster - Mercenary roster object
 * @returns {string} Formatted mercenary lines
 */
function formatMercenaryRoster(roster) {
  return Object.values(roster)
    .map((m) => `• **${m.name}**\n  💰 Biaya: \`${m.cost} SC\` | 🛡️ Def: \`+${m.defenseBonus}\` | 🎯 Mitigasi Risiko: \`-${m.ambushMitigation}%\``)
    .join("\n");
}

/**
 * Format expedition modes list
 * @param {Object} modes - Expedition modes object
 * @returns {string} Formatted mode lines
 */
function formatExpeditionModes(modes) {
  return Object.values(modes)
    .map((m) => `• **${m.name}**\n  ⚠️ Risiko Ambush: \`${m.riskPercent}%\` | 📈 Pengganda Hasil: \`${m.profitMultiplier}x\``)
    .join("\n");
}

/**
 * Format escort board listing
 * @param {Array<Object>} board - Array caravan contracts
 * @returns {string} Formatted board lines
 */
function formatEscortBoard(board) {
  return board.map((c) => {
    const finishTs = toUnixTimestamp(c.finishTime);
    return [
      `🐫 **ID:** \`${c.caravanId}\` (Pemilik: **${c.ownerName}**)`,
      `   📦 Muatan: \`${c.commodityId}\` | 🎯 Estimasi Tiba: <t:${finishTs}:R>`,
      `   🛡️ Pengawal: \`${c.escortCount}/${c.maxEscorts}\` | 💰 Hadiah: \`+${c.escortReward.toLocaleString("id-ID")}\` Koin`,
      `   👉 *Kawal dengan \`/survival caravan aksi:escort caravan_id:${c.caravanId}\`*`,
    ].join("\n");
  }).join("\n\n");
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  name: "caravan",
  description: "🐫 Ekspedisi Karavan Dagang Antariksa & Bursa Komoditas Global",

  /**
   * Eksekusi subcommand caravan
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @param {Object} context - Context object (unused)
   * @returns {Promise<void>}
   */
  async execute(interaction, context) {
    const action = interaction.options.getString("aksi") || ACTIONS.STATUS;
    const user = interaction.user;
    const displayName = interaction.member?.displayName || user.displayName || user.username;

    switch (action) {
      case ACTIONS.MARKET:
        return handleMarket(interaction, displayName);
      
      case ACTIONS.MERCENARY:
        return handleMercenary(interaction, displayName);
      
      case ACTIONS.DISPATCH:
        return handleDispatch(interaction, user, displayName);
      
      case ACTIONS.CLAIM:
        return handleClaim(interaction, user, displayName);
      
      case ACTIONS.ESCORT:
        return handleEscort(interaction, user, displayName);
      
      case ACTIONS.BOARD:
        return handleBoard(interaction, displayName);
      
      case ACTIONS.AMBUSH:
        return handleAmbush(interaction, user, displayName);
      
      case ACTIONS.STATUS:
      default:
        return handleStatus(interaction, user, displayName);
    }
  },
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle market prices dan routes info
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleMarket(interaction, displayName) {
  const market = tradeEngine.getMarketPrices();
  const routes = tradeEngine.getRoutes();

  const marketLines = formatMarketPrices(market);
  const routeLines = formatRoutes(routes);

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

/**
 * Handle mercenary roster dan expedition modes info
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleMercenary(interaction, displayName) {
  const roster = caravanEngine.getMercenaryRoster();
  const modes = caravanEngine.getExpeditionModes();

  const mercLines = formatMercenaryRoster(roster);
  const modeLines = formatExpeditionModes(modes);

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.MERCENARY_BLUE,
    authorName: "MERCENARY GUILD & HIGH-RISK EXPEDITIONS",
    title: "🛡️ Roster Tentara Bayaran & Mode Ekspedisi",
    description: [
      `Halo, **${displayName}**! Lindungi karavan dagangmu dari sergapan perompak kosmik dengan menyewa pengawal profesional:`,
      "",
      "⚔️ **Daftar Tentara Bayaran:**",
      mercLines,
      "",
      "🗺️ **Mode Ekspedisi High-Risk High-Reward:**",
      modeLines,
      "",
      "-# 💡 *Sewa saat dispatch: `/survival caravan dispatch ... pengawal:<pilihan> mode:<pilihan>`!*",
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle dispatch karavan baru
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleDispatch(interaction, user, displayName) {
  const routeId = interaction.options.getString("rute") || DEFAULT_ROUTE;
  const commodity = interaction.options.getString("komoditas") || DEFAULT_COMMODITY;
  const amount = interaction.options.getInteger("jumlah") || DEFAULT_COMMODITY_AMOUNT;
  const modeKey = interaction.options.getString("mode") || DEFAULT_MODE;
  const mercenaryKey = interaction.options.getString("pengawal");

  // Hire mercenary if selected
  let hiredMerc = null;
  if (mercenaryKey) {
    const hireRes = await caravanEngine.hireMercenary(user.id, mercenaryKey);
    
    if (!hireRes.success) {
      const description = hireRes.reason === FAIL_REASONS.INSUFFICIENT_FUNDS
        ? `Saldo SC kamu tidak mencukupi untuk menyewa pengawal ini (Dibutuhkan: \`${hireRes.required} SC\`, Saldo: \`${hireRes.currentNsf} SC\`).`
        : "Pilihan pengawal bayaran tidak valid.";
      
      const payload = buildErrorContainerV2({
        title: "Gagal Menyewa Pengawal",
        description,
        footerText: ui.getFooter("survival"),
      });
      
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }
    
    hiredMerc = hireRes.mercenary;
  }

  // Dispatch caravan
  const res = await tradeEngine.dispatchCaravan(
    user.id,
    displayName,
    routeId,
    commodity,
    amount,
  );

  if (!res.success) {
    let msg = "Gagal memberangkatkan karavan.";
    
    if (res.reason === FAIL_REASONS.INSUFFICIENT_FUNDS) {
      msg = `Saldo koinmu tidak cukup untuk membeli muatan modal karavan (\`${res.requiredCost.toLocaleString("id-ID")}\` Koin)!`;
    } else if (res.reason === FAIL_REASONS.CARAVAN_ALREADY_ACTIVE) {
      msg = `Kamu sudah memiliki karavan yang sedang dalam perjalanan menuju **${res.caravan?.route?.name}**!`;
    } else if (res.reason === FAIL_REASONS.MINIMUM_AMOUNT) {
      msg = "Jumlah muatan minimal yang dapat diberangkatkan adalah 5 unit!";
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

  // Build success response
  const crv = res.caravan;
  const finishTs = toUnixTimestamp(crv.finishTime);
  const expeditionMode = caravanEngine.getExpeditionModes()[modeKey] || caravanEngine.getExpeditionModes().standard;
  const finalRiskData = caravanEngine.calculateCaravanRisk(modeKey, mercenaryKey);

  const descriptionLines = [
    `Selamat jalan, **${displayName}**! Karavanmu telah memulai perjalanan ekspedisi melintasi rute kosmik.`,
    "",
    `🗺️ **Rute Tujuan:** **${crv.route.name}**`,
    `⚡ **Mode Ekspedisi:** **${expeditionMode.name}** (Risiko: \`${finalRiskData.finalRisk}%\`)`,
    `📦 **Muatan Kargo:** \`${crv.amount}x\` **${crv.commodity.name}**`,
    `💰 **Modal Investasi:** \`${crv.investedCost.toLocaleString("id-ID")}\` Koin`,
    `📈 **Potensi Hasil Penjualan:** \`${crv.potentialProfit.toLocaleString("id-ID")}\` Koin`,
  ];

  if (hiredMerc) {
    descriptionLines.push(
      `🛡️ **Pengawal:** **${hiredMerc.name}** (Mitigasi Risiko: \`-${hiredMerc.ambushMitigation}%\`)`,
    );
  }

  descriptionLines.push(
    `⏳ **Estimasi Tiba:** <t:${finishTs}:R> (<t:${finishTs}:t>)`,
    "",
    "-# 💡 *Setelah karavan tiba, gunakan `/survival caravan claim` untuk mencairkan seluruh laba perdaganganmu!*",
  );

  const payload = buildContainerV2({
    authorName: "GALACTIC MERCHANT CARTEL",
    title: "🐫 Karavan Dagang Berhasil Diberangkatkan!",
    description: descriptionLines.join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle claim profit karavan
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleClaim(interaction, user, displayName) {
  const res = await tradeEngine.claimCaravanProfits(user.id, displayName);

  if (!res.success) {
    let msg = "Tidak ada laba yang dapat diklaim.";
    
    if (res.reason === FAIL_REASONS.NO_ACTIVE_CARAVAN) {
      msg = "Kamu tidak memiliki karavan yang sedang aktif atau menunggu klaim!";
    } else if (res.reason === FAIL_REASONS.STILL_TRAVELING) {
      msg = `Karavanmu masih dalam perjalanan! Sisa waktu tempuh sekitar \`${res.remainingMinutes} menit\` lagi.`;
    }

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
      "",
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

/**
 * Handle join sebagai pengawal karavan
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleEscort(interaction, user, displayName) {
  const caravanId = interaction.options.getString("caravan_id");
  
  // Guard: caravan ID required
  if (!caravanId) {
    const payload = buildErrorContainerV2({
      title: "ID Karavan Diperlukan",
      description: "Silakan masukkan `caravan_id` target yang ingin kamu kawal!",
      footerText: ui.getFooter("survival"),
    });
    
    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  }

  const res = await tradeEngine.joinEscort(caravanId, user.id, ESCORT_COMBAT_POWER);
  
  if (!res.success) {
    let msg = "Gagal bergabung sebagai pengawal.";
    
    if (res.reason === FAIL_REASONS.ALREADY_ESCORTING) {
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
    accentColorHex: ACCENT_COLORS.MERCENARY_BLUE,
    authorName: "GALACTIC MERCHANT CARTEL",
    title: "🛡️ Terdaftar Sebagai Pengawal Bersenjata!",
    description: [
      `Petualang **${displayName}** resmi dikontrak sebagai pengawal keamanan karavan \`${caravanId}\`!`,
      "",
      `⚔️ **Kekuatan Pertahanan Disumbang:** \`+${ESCORT_COMBAT_POWER} Combat Power\``,
      `💰 **Bagi Hasil Keuntungan:** \`${ESCORT_PROFIT_SHARE_PERCENT}%\` saat karavan berhasil mendarat selamat.`,
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle tampilkan board kontrak pengawalan
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleBoard(interaction, displayName) {
  const board = await tradeEngine.getEscortBoard();

  // Guard: empty board
  if (!board || board.length === 0) {
    const payload = buildContainerV2({
      authorName: "MERCENARY ESCORT BOARD",
      title: "📋 Papan Kontrak Pengawalan Karavan",
      description: [
        `Halo, **${displayName}**! Saat ini belum ada karavan dagang yang membuka lowongan pengawal.`,
        "",
        "> *Klan dan pedagang dapat membuka kontrak pengawalan saat memberangkatkan ekspedisi antariksa!*",
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });
    
    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  }

  const lines = formatEscortBoard(board);

  const payload = buildContainerV2({
    accentColorHex: ACCENT_COLORS.MERCENARY_BLUE,
    authorName: "MERCENARY ESCORT BOARD",
    title: "📋 Papan Bursa Kontrak Pengawalan Karavan",
    description: [
      "Daftar karavan aktif yang membutuhkan pengawalan tempur:\n",
      lines,
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });
  
  return interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}

/**
 * Handle ambush karavan pemain lain
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleAmbush(interaction, user, displayName) {
  const caravanId = interaction.options.getString("caravan_id");
  
  // Guard: caravan ID required
  if (!caravanId) {
    const payload = buildErrorContainerV2({
      title: "ID Karavan Diperlukan",
      description: "Silakan masukkan `caravan_id` target yang ingin kamu sergap!",
      footerText: ui.getFooter("survival"),
    });
    
    return interaction.reply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  }

  const res = await tradeEngine.ambushCaravan(caravanId, user.id, AMBUSH_ATTACK_POWER);
  
  if (!res.success) {
    let msg = "Penyergapan gagal dilakukan.";
    
    if (res.reason === FAIL_REASONS.CARAVAN_NOT_AVAILABLE) {
      msg = "Karavan tidak ditemukan atau sudah selesai melintas rute.";
    } else if (res.reason === FAIL_REASONS.CANNOT_AMBUSH_OWN_CARAVAN) {
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

  // Ambush success
  if (res.raided) {
    const payload = buildContainerV2({
      accentColorHex: ACCENT_COLORS.AMBUSH_RED,
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
    // Ambush failed
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

/**
 * Handle status karavan aktif
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} user - Discord user
 * @param {string} displayName - Display name pengguna
 * @returns {Promise<void>}
 */
async function handleStatus(interaction, user, displayName) {
  const active = await tradeEngine.getActiveCaravan(user.id);
  
  // Guard: no active caravan
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

  const finishTs = toUnixTimestamp(active.finishTime);
  const isDone = Date.now() >= new Date(active.finishTime).getTime();

  const payload = buildContainerV2({
    authorName: "GALACTIC MERCHANT CARTEL",
    title: isDone
      ? "✨ Karavan Telah Tiba di Tujuan!"
      : "🐫 Karavan Sedang Melintasi Rute Kosmik",
    description: [
      `Berikut adalah status ekspedisi karavan milik **${displayName}**:`,
      "",
      `🗺️ **Rute:** **${active.route.name}**`,
      `📦 **Kargo:** \`${active.amount}x\` **${active.commodity.name}**`,
      `💰 **Modal:** \`${active.investedCost.toLocaleString("id-ID")}\` Koin`,
      `📈 **Estimasi Hasil:** \`${active.potentialProfit.toLocaleString("id-ID")}\` Koin`,
      `⏳ **Status Waktu:** ${isDone ? "**Sudah Tiba & Siap Diklaim!**" : `Tiba <t:${finishTs}:R>`}`,
      "",
      isDone
        ? `👉 *Ketik \`/survival caravan claim\` untuk mengambil koin labamu!*`
        : "*Pengawal karavan sedang berjaga-jaga dari ancaman bandit.*",
    ].join("\n"),
    footerText: ui.getFooter("survival"),
  });

  return interaction.reply({
    ...payload,
    flags: MessageFlags.IsComponentsV2,
  });
}
