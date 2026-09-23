"use strict";

const ui = require("../../config/ui");
const cacheManager = require("../../managers/cacheManager");

// Tiga mata uang Naura.
// - Naura Star Fragment (NSF) : mata uang desa & seluruh wilayah alam.
// - Naura Coin              : mata uang kota, akademi, dan penjara.
// - Naura Coupon            : mata uang langka, tidak bisa ditukar dari uang biasa.
const FRAGMENT = "fragment";
const COIN = "coin";
const COUPON = "coupon";

// Kurs resmi: 1000 NSF = 1 Naura Coin.
const FRAGMENT_PER_COIN = 1000;

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
};

// Kunci lama tempat Naura Coupon dulu disimpan di dalam rpg_state. Hanya dipakai
// untuk membaca sisa data pada objek yang sudah lebih dulu masuk cache sebelum
// migrasi v6 berjalan. Jangan pernah menulis ke kunci ini lagi.
const LEGACY_COUPON_KEY = "coupons";

const CURRENCIES = {
  [FRAGMENT]: {
    kind: FRAGMENT,
    name: "Naura Star Fragment",
    short: "NSF",
    emojiKey: "nsf",
    emojiFallback: EMOJI[FRAGMENT].raw,
    field: "starFragments",
    owner: "survival",
  },
  [COIN]: {
    kind: COIN,
    name: "Naura Coin",
    short: "Coin",
    emojiKey: "coin",
    emojiFallback: EMOJI[COIN].raw,
    field: "economy_wallet",
    owner: "profile",
  },
  [COUPON]: {
    kind: COUPON,
    name: "Naura Coupon",
    short: "Coupon",
    emojiKey: "coupon",
    emojiFallback: EMOJI[COUPON].raw,
    // Sejak migrasi v5, kupon punya kolom angka sendiri di UserSurvivals.
    // Sebelumnya ia menumpang di dalam rpg_state, dan itu membuatnya jadi
    // satu-satunya mata uang yang dipotong dengan pola baca-ubah-tulis.
    field: "coupons",
    owner: "survival",
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
  if (row.coupons !== undefined && row.coupons !== null)
    return Number(row.coupons) || 0;
  return Number(stateOf(row)[LEGACY_COUPON_KEY]) || 0;
}

function balanceOf(currency, holders = {}) {
  const c = resolve(currency);
  const { survival, profile } = holders;

  if (c.kind === COUPON) return couponBalanceOf(survival);
  if (c.owner === "profile") return Number((profile || {})[c.field]) || 0;
  return Number((survival || {})[c.field]) || 0;
}

function userIdOf(holders = {}) {
  const { survival, profile } = holders;
  return (survival && survival.userId) || (profile && profile.userId) || null;
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
  const c = resolve(currency);
  let gain = Math.max(0, Math.floor(Number(amount) || 0));
  const balance = balanceOf(c, holders);
  if (gain === 0) return balance;

  const userId = userIdOf(holders);
  if (!userId) return balance;

  // Buff Kolaboratif Klan (hanya untuk mata uang non-Kupon)
  if (holders.survival && holders.survival.clanId && c.kind !== COUPON) {
    try {
      const GuildClan = require("../../models/GuildClan");
      const clan = await GuildClan.findByPk(holders.survival.clanId);
      if (clan) {
        const buffMultiplier = 1 + clan.level * 0.02; // +2% per level
        gain = Math.floor(gain * buffMultiplier);
      }
    } catch (e) {
      // Abaikan jika error agar tidak mengganggu sistem utama
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
// Aturan One-Way Bridge: Hanya mengizinkan FRAGMENT -> COIN.
// Konversi COIN -> FRAGMENT ditolak untuk menjaga integritas survival.
function convert(amount, fromKind, toKind) {
  const value = Math.max(0, Math.floor(Number(amount) || 0));
  if (fromKind === toKind) return value;
  if (fromKind === COUPON || toKind === COUPON) return null;
  if (fromKind === COIN && toKind === FRAGMENT) return null;
  if (fromKind === FRAGMENT && toKind === COIN)
    return Math.floor(value / FRAGMENT_PER_COIN);
  return null;
}

/**
 * Menghitung kurs dinamis dan persentase biaya admin progresif
 * @param {number} nsfAmount
 * @returns {Promise<{rate: number, feePercent: number, dailyVolume: number}>}
 */
async function getDynamicRateAndFee(nsfAmount = 0) {
  let dailyVolume = 0;
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) {
      dailyVolume = Number(
        (await redisManager.client.get("economy:volume:nsf:daily")) || 0,
      );
    }
  } catch (err) {
    dailyVolume = 0;
  }

  // Setiap 1.000.000 NSF yang dicairkan hari ini, kurs melemah +50 NSF per 1 NC (maksimal 1.500 NSF = 1 NC)
  const volStep = Math.min(10, Math.floor(dailyVolume / 1000000));
  const rate = Math.min(1500, 1000 + volStep * 50);

  // Biaya administrasi progresif: 5% (standar), 10% (>50.000), 15% (>200.000)
  const val = Number(nsfAmount) || 0;
  let feePercent = 0.05;
  if (val > 200000) {
    feePercent = 0.15;
  } else if (val > 50000) {
    feePercent = 0.1;
  }

  return {
    rate,
    feePercent,
    dailyVolume,
  };
}

// Tukar uang di penukaran resmi dengan aturan One-Way Bridge dan Dynamic Spread.
async function exchange(holders, fromKind, toKind, amount) {
  const from = byKind(fromKind);
  const to = byKind(toKind);
  const value = Math.max(0, Math.floor(Number(amount) || 0));

  if (from.kind === to.kind) return { ok: false, reason: "same_currency" };
  if (from.kind === COUPON || to.kind === COUPON)
    return { ok: false, reason: "coupon_locked" };
  if (from.kind === COIN && to.kind === FRAGMENT)
    return { ok: false, reason: "one_way_restricted" };
  if (value <= 0) return { ok: false, reason: "invalid_amount" };

  const { rate, feePercent, dailyVolume } = await getDynamicRateAndFee(value);
  const feeNsf = Math.floor(value * feePercent);
  const netNsf = value - feeNsf;
  const received = Math.floor(netNsf / rate);

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
  await recyclingPoolEngine.allocateSinkFunds(feeNsf);
  const userId = userIdOf(holders);
  let tickets = 0;
  if (userId) {
    tickets = await recyclingPoolEngine.awardLotteryTickets(userId, feeNsf);
  }

  // Akumulasikan volume harian di Redis
  try {
    const redisManager = require("../../managers/redisManager");
    if (redisManager.client && redisManager.client.isReady) {
      await redisManager.client.incrBy("economy:volume:nsf:daily", spent);
    }
  } catch (err) {
    // Abaikan jika Redis offline
  }

  return {
    ok: true,
    from: from.kind,
    to: to.kind,
    spent,
    received,
    feeNsf,
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
  FRAGMENT_PER_COIN,
  LEGACY_COUPON_KEY,
  EMOJI,
  CURRENCIES,
  LOCATION_CURRENCY,
  currencyKindFor,
  currencyFor,
  byKind,
  emojiOf,
  emojiObjectOf,
  format,
  balanceOf,
  canAfford,
  charge,
  reward,
  convert,
  exchange,
  getDynamicRateAndFee,
};
