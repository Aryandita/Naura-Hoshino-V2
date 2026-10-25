"use strict";
const { logger } = require("../../managers/logger");

const ui = require("../../config/ui");
const cacheManager = require("../../managers/cacheManager");

// Lima mata uang Naura (Era Slice of Life + Adisha + Arcade).
// - Sukamaju Koin (SC)       : mata uang desa & seluruh wilayah alam (Tier 1 - Paling Umum).
// - Pratama Dollar (PD)      : mata uang kota, akademi, dan penjara (Tier 2 - Mid Range).
// - Voucher Beasiswa (VB)    : mata uang prestasi & festival langka (Tier 3 - Langka).
// - Berlian Adisha (BA)      : mata uang legendaris endgame (Tier 4 - Legendaris).
// - Medali Permainan (MP)    : mata uang arcade/minigame global (Tier 5 - Arcade Only).
const FRAGMENT = "fragment";      // SC
const COIN = "coin";              // PD
const COUPON = "coupon";          // VB
const DIAMOND = "diamond";        // BA
const MEDAL = "medal";            // MP

// Kurs resmi: 1000 SC = 1 PD.
const SC_PER_PD = 1000;

// Emoji resmi dari server. Berkas ini jadi satu-satunya sumber kebenaran untuk
// lambang mata uang, jadi seluruh ekosistem cukup memanggil emojiOf().
// Kalau nanti ID emojinya diubah di ui.js, nilai di sana yang dipakai lebih dulu.
const EMOJI = {
  [FRAGMENT]: {
    raw: "<:NauraStarFragment:1534169151336222760>",
    id: "1534169151336222760",
    name: "NauraStarFragment",
    animated: false,
  },
  [COIN]: {
    raw: "<a:NauraCoin:1534169156520513677>",
    id: "1534169156520513677",
    name: "NauraCoin",
    animated: true,
  },
  [COUPON]: {
    raw: "<:NauraCoupon:1534169148807053472>",
    id: "1534169148807053472",
    name: "NauraCoupon",
    animated: false,
  },
  [DIAMOND]: {
    raw: "💎",
    id: null,
    name: "BerlianAdisha",
    animated: false,
  },
  [MEDAL]: {
    raw: "🏅",
    id: null,
    name: "MedaliPermainan",
    animated: false,
  },
};

// Kunci lama tempat Naura Coupon dulu disimpan di dalam rpg_state. Hanya dipakai
// untuk membaca sisa data pada objek yang sudah lebih dulu masuk cache sebelum
// migrasi v6 berjalan. Jangan pernah menulis ke kunci ini lagi.
const LEGACY_COUPON_KEY = "coupons";

const CURRENCIES = {
  [FRAGMENT]: {
    kind: FRAGMENT,
    name: "Sukamaju Koin",
    short: "SC",
    emojiKey: "sc",
    emojiFallback: EMOJI[FRAGMENT].raw,
    field: "sukamajuCoins",
    legacyField: "starFragments",
    owner: "survival",
    convertible: true,
  },
  [COIN]: {
    kind: COIN,
    name: "Pratama Dollar",
    short: "PD",
    emojiKey: "pd",
    emojiFallback: EMOJI[COIN].raw,
    field: "pratamaDollars",
    legacyField: "economy_wallet",
    owner: "profile",
    convertible: true,
  },
  [COUPON]: {
    kind: COUPON,
    name: "Voucher Beasiswa",
    short: "VB",
    emojiKey: "vb",
    emojiFallback: EMOJI[COUPON].raw,
    field: "scholarshipVouchers",
    legacyField: "coupons",
    owner: "survival",
    convertible: false,
  },
  [DIAMOND]: {
    kind: DIAMOND,
    name: "Berlian Adisha",
    short: "BA",
    emojiKey: "berlian_adisha",
    emojiFallback: EMOJI[DIAMOND].raw,
    field: "adishaDiamonds",
    legacyField: null,
    owner: "survival",
    convertible: false,
    description: "Kristal murni dari jantung dunia Adisha. Hanya didapatkan melalui tantangan tertinggi.",
  },
  [MEDAL]: {
    kind: MEDAL,
    name: "Medali Permainan",
    short: "MP",
    emojiKey: "medali_permainan",
    emojiFallback: EMOJI[MEDAL].raw,
    field: "medaliPermainan",
    legacyField: null,
    owner: "profile",
    convertible: false,
    description: "Medali eksklusif untuk minigame & arcade. Didapat dari bermain, bukan grinding.",
  },
};

const LOCATION_CURRENCY = {
  jalanan: FRAGMENT,
  desa: FRAGMENT,
  village: FRAGMENT,
  hutan: FRAGMENT,
  tambang: FRAGMENT,
  laut: FRAGMENT,
  pantai: FRAGMENT,
  sawah: FRAGMENT,
  gunung: FRAGMENT,
  kota: COIN,
  city: COIN,
  academy: COIN,
  prison: COIN,
  istana_draken: DIAMOND,
  draken: DIAMOND,
  kastil_draken: DIAMOND,
  dungeon_draken: DIAMOND,
  arcade: MEDAL,
  dm: MEDAL,
  voice: MEDAL,
};

function currencyKindFor(location) {
  return (
    LOCATION_CURRENCY[String(location || "jalanan").toLowerCase()] || FRAGMENT
  );
}

function byKind(kind) {
  return CURRENCIES[kind] || CURRENCIES[FRAGMENT];
}

function currencyFor(location) {
  return byKind(currencyKindFor(location));
}

function resolve(currency) {
  return typeof currency === "string"
    ? byKind(currency)
    : currency || CURRENCIES[FRAGMENT];
}

function emojiOf(currency) {
  const c = resolve(currency);
  return ui.getEmoji(c.emojiKey) || c.emojiFallback;
}

// Menu pilihan Discord menolak emoji berbentuk teks, jadi komponen select harus
// memakai bentuk objek ini.
function emojiObjectOf(currency) {
  const c = resolve(currency);
  const entry = EMOJI[c.kind];
  if (!entry) return undefined;
  return { id: entry.id, name: entry.name, animated: entry.animated };
}

function format(currency, amount) {
  const c = resolve(currency);
  const value = Number(amount) || 0;
  return `${emojiOf(c)} **${value.toLocaleString("id-ID")} ${c.name}**`;
}

function nameOf(currency) {
  const c = resolve(currency);
  return c.short || c.name;
}

function stateOf(survival) {
  return (survival && survival.rpg_state) || {};
}

/**
 * Saldo kupon pada objek survival.
 *
 * Objek survival bisa berasal dari cache Redis yang ditulis sebelum migrasi v6
 * berjalan, dan cache itu hidup sampai 30 menit. Selama masa peralihan, saldo
 * lama di dalam rpg_state tetap dibaca supaya tidak ada pemain yang melihat
 * kuponnya hilang. Sesudah cache habis, cabang ini tidak pernah terpakai lagi.
 */
function couponBalanceOf(survival) {
  const row = survival || {};
  if (row.scholarshipVouchers !== undefined && row.scholarshipVouchers !== null)
    return Number(row.scholarshipVouchers) || 0;
  if (row.coupons !== undefined && row.coupons !== null)
    return Number(row.coupons) || 0;
  return Number(stateOf(row)[LEGACY_COUPON_KEY]) || 0;
}

function balanceOf(currency, holders = {}) {
  const c = resolve(currency);
  const { survival, profile } = holders;

  if (c.kind === COUPON) return couponBalanceOf(survival);
  if (c.owner === "profile") {
    const row = profile || {};
    const val = row[c.field] !== undefined ? row[c.field] : row[c.legacyField];
    return Number(val) || 0;
  }
  const row = survival || {};
  const val = row[c.field] !== undefined ? row[c.field] : row[c.legacyField];
  return Number(val) || 0;
}

function userIdOf(holders = {}) {
  if (typeof holders === "string") return holders;
  if (!holders) return null;
  const { survival, profile, userId } = holders;
  return (
    userId ||
    (survival && survival.userId) ||
    (profile && profile.userId) ||
    null
  );
}

/**
 * Menyelaraskan objek di memori dengan nilai yang baru ditulis ke database.
 *
 * Pemanggil sering menampilkan saldo dari objek yang sama sesaat setelah
 * transaksi, jadi objeknya perlu ikut maju. Fungsi ini sengaja TIDAK menulis ke
 * database supaya tidak terjadi penulisan ganda.
 */
function syncLocal(currency, holders, nextValue) {
  const c = resolve(currency);
  const { survival, profile } = holders || {};

  if (c.owner === "profile") {
    if (profile) profile[c.field] = nextValue;
    return;
  }
  if (!survival) return;

  survival[c.field] = nextValue;

  // Sisa saldo lama dibuang dari salinan di memori supaya couponBalanceOf()
  // tidak pernah kembali membaca angka basi dari rpg_state.
  if (c.kind === COUPON && stateOf(survival)[LEGACY_COUPON_KEY] !== undefined) {
    const nextState = { ...stateOf(survival) };
    delete nextState[LEGACY_COUPON_KEY];
    survival.rpg_state = nextState;
    if (typeof survival.changed === "function")
      survival.changed("rpg_state", true);
  }
}

function canAfford(currency, holders, amount) {
  return balanceOf(currency, holders) >= (Number(amount) || 0);
}

/**
 * Memotong saldo. Mengembalikan saldo akhir, atau null bila uangnya kurang.
 *
 * Pemeriksaan kecukupan dan pemotongan terjadi dalam satu pernyataan SQL, jadi
 * dua klik yang tiba bersamaan tidak bisa membelanjakan uang yang sama dua kali.
 * Sejak migrasi v5, aturan ini berlaku untuk ketiga mata uang tanpa kecuali.
 */
async function charge(currency, holders = {}, amount) {
  // Dukungan signature fleksibel: charge(userId, { starFragments: 50 }, reason)
  if (
    typeof currency === "string" &&
    /^\d{15,22}$/.test(currency) &&
    holders &&
    typeof holders === "object"
  ) {
    const targetUserId = currency;
    let finalBalance = null;
    for (const [currKey, currAmount] of Object.entries(holders)) {
      if (typeof currAmount !== "number" || currAmount <= 0) continue;
      const res = await charge(currKey, { userId: targetUserId }, currAmount);
      if (res === null) return null;
      finalBalance = res;
    }
    return finalBalance !== null ? finalBalance : 0;
  }

  const c = resolve(currency);
  const cost = Math.max(0, Math.floor(Number(amount) || 0));
  const balance = balanceOf(c, holders);
  if (cost === 0) return balance;

  const userId = userIdOf(holders);
  if (!userId) return null;

  const result =
    c.owner === "profile"
      ? await cacheManager.debitUserProfile(userId, c.field, cost)
      : await cacheManager.debitUserSurvival(userId, c.field, cost);

  if (!result.ok) return null;

  const next = Math.max(0, balance - cost);
  syncLocal(c, holders, next);
  return next;
}

async function reward(currency, holders = {}, amount) {
  // Dukungan signature fleksibel: reward(userId, { starFragments: 50 }, reason)
  if (
    typeof currency === "string" &&
    /^\d{15,22}$/.test(currency) &&
    holders &&
    typeof holders === "object"
  ) {
    const targetUserId = currency;
    let finalBalance = 0;
    for (const [currKey, currAmount] of Object.entries(holders)) {
      if (typeof currAmount !== "number" || currAmount <= 0) continue;
      const res = await reward(currKey, { userId: targetUserId }, currAmount);
      finalBalance = res;
    }
    return finalBalance;
  }

  const c = resolve(currency);
  let gain = Math.max(0, Math.floor(Number(amount) || 0));
  const balance = balanceOf(c, holders);
  if (gain === 0) return balance;

  const userId = userIdOf(holders);
  if (!userId) return balance;

  // Buff Kolaboratif Klan (hanya untuk mata uang non-Kupon, non-Diamond)
  if (holders.survival && holders.survival.clanId && c.kind !== COUPON && c.kind !== DIAMOND) {
    try {
      const GuildClan = require("../../models/GuildClan");
      const clan = await GuildClan.findByPk(holders.survival.clanId);
      if (clan) {
        const buffMultiplier = 1 + clan.level * 0.02; // +2% per level
        gain = Math.floor(gain * buffMultiplier);
      }
    } catch (e) {
      // Intentional: Abaikan jika error agar tidak mengganggu sistem utama
    }
  }

  if (c.owner === "profile") {
    await cacheManager.incrementUserProfile(userId, { [c.field]: gain });
  } else {
    await cacheManager.incrementUserSurvival(userId, { [c.field]: gain });
  }

  const next = balance + gain;
  syncLocal(c, holders, next);
  return next;
}

// Konversi nominal antar mata uang biasa.
// Aturan One-Way Bridge: Hanya mengizinkan SC -> PD.
// Konversi PD -> SC ditolak untuk menjaga integritas survival.
// VB dan BA TIDAK bisa dikonversi dari/ke mata uang lain.
function convert(amount, fromKind, toKind) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (fromKind === toKind) return value;
  if (fromKind === COUPON || toKind === COUPON) return null;
  if (fromKind === DIAMOND || toKind === DIAMOND) return null;
  if (fromKind === COIN && toKind === FRAGMENT) return null;
  if (fromKind === FRAGMENT && toKind === COIN)
    return Math.floor(value / SC_PER_PD);
  return null;
}

/**
 * Menghitung kurs dinamis dan persentase biaya admin progresif
 * @param {number} scAmount - Jumlah Sukamaju Koin (SC)
 * @returns {Promise<{rate: number, feePercent: number, dailyVolume: number}>}
 */
async function getDynamicRateAndFee(scAmount = 0) {
  let dailyVolume = 0;
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) {
      dailyVolume = Number((await redisManager.client.get("economy:volume:sc:daily")) || 0);
    }
  } catch (err) {
    dailyVolume = 0;
  }

  // Setiap 1.000.000 SC yang dicairkan hari ini, kurs melemah +50 SC per 1 PD (maksimal 1.500 SC = 1 PD)
  const volStep = Math.min(10, Math.floor(dailyVolume / 1000000));
  const rate = Math.min(1500, 1000 + volStep * 50);

  // Biaya administrasi progresif: 5% (standar), 10% (>50.000), 15% (>200.000)
  const val = Number(scAmount) || 0;
  let feePercent = 0.05;
  if (val > 200000) {
    feePercent = 0.15;
  } else if (val > 50000) {
    feePercent = 0.10;
  }

  return {
    rate,
    feePercent,
    dailyVolume,
  };
}

// Tukar uang di penukaran resmi dengan aturan One-Way Bridge dan Dynamic Spread.
// Hanya mendukung SC -> PD (Sukamaju Koin ke Pratama Dollar).
async function exchange(holders, fromKind, toKind, amount) {
  const from = byKind(fromKind);
  const to = byKind(toKind);
  const value = Math.max(0, Math.floor(Number(amount) || 0));

  if (from.kind === to.kind) return { ok: false, reason: "same_currency" };
  if (from.kind === COUPON || to.kind === COUPON)
    return { ok: false, reason: "coupon_locked" };
  if (from.kind === DIAMOND || to.kind === DIAMOND)
    return { ok: false, reason: "diamond_locked" };
  if (from.kind === COIN && to.kind === FRAGMENT)
    return { ok: false, reason: "one_way_restricted" };
  if (value <= 0) return { ok: false, reason: "invalid_amount" };

  const { rate, feePercent, dailyVolume } = await getDynamicRateAndFee(value);
  const feeSc = Math.floor(value * feePercent);
  const netSc = value - feeSc;
  const received = Math.floor(netSc / rate);

  if (received <= 0) {
    const minNeeded = Math.ceil(rate / (1 - feePercent));
    return { ok: false, reason: "below_minimum", minimum: minNeeded };
  }

  const spent = value;
  const remaining = await charge(from, holders, spent);
  if (remaining === null) {
    return {
      ok: false,
      reason: "insufficient",
      balance: balanceOf(from, holders),
      needed: spent,
    };
  }

  await reward(to, holders, received);

  // Alirkan biaya admin ke sistem daur ulang 4 saluran & berikan tiket undian
  const recyclingPoolEngine = require("./recyclingPoolEngine");
  await recyclingPoolEngine.allocateSinkFunds(feeSc);
  const userId = userIdOf(holders);
  let tickets = 0;
  if (userId) {
    tickets = await recyclingPoolEngine.awardLotteryTickets(userId, feeSc);
  }

  // Akumulasikan volume harian di Redis
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) {
      await redisManager.client.incrBy("economy:volume:sc:daily", spent);
    }
  } catch (err) {
    logger.warn("[currency:exchange] Operasi cache Redis gagal: " + (err?.message || err));
  }

  return {
    ok: true,
    from: from.kind,
    to: to.kind,
    spent,
    received,
    feeSc,
    rate,
    feePercent,
    dailyVolume,
    ticketsAwarded: tickets,
    remainder: 0,
    balanceFrom: remaining,
    balanceTo: balanceOf(to, holders),
  };
}

module.exports = {
  FRAGMENT,
  COIN,
  COUPON,
  DIAMOND,
  MEDAL,
  SC_PER_PD,
  LEGACY_COUPON_KEY,
  EMOJI,
  CURRENCIES,
  LOCATION_CURRENCY,
  currencyKindFor,
  currencyFor,
  byKind,
  emojiOf,
  emojiObjectOf,
  nameOf,
  format,
  balanceOf,
  canAfford,
  charge,
  reward,
  convert,
  exchange,
  getDynamicRateAndFee,
};
