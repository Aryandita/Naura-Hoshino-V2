"use strict";

// Tabel jarahan dan pemrosesan hasil eksplorasi /survival collect.
// Semua id barang di sini sudah dicocokkan dengan katalog items.js, supaya
// pemain tidak pernah lagi menerima barang bernama sama dengan id mentahnya.

const UserQuest = require("../../models/UserQuest");
const cacheManager = require("../../managers/cacheManager");
const items = require("../data/items");
const leveling = require("../engines/survivalLeveling");
const currency = require("../engines/currency");
const { advanceTime, getTimeState } = require("./survivalTime");
const { addItemsAtomic } = require("../engines/inventoryHelper");

// Sesudah pulang, pemain selalu diantar kembali ke desa.
const HOME_LOCATION = "desa";

// Statistik yang terkuras setiap kali pemain bekerja.
const DRAIN_FIELDS = ["hunger", "thirst", "stamina"];

const LOOT = {
  hutan: {
    base: ["wood", "wood", "fiber", "apple", "stone"],
    cat: ["apple", "seed_apple"],
    cost: { hunger: 5, thirst: 8, stamina: 10 },
    hours: 1,
    xp: 5,
  },
  tambang: {
    base: ["stone", "stone", "iron_ore", "iron_ore", "silver_ore", "diamond"],
    cat: ["diamond", "silver_ore"],
    cost: { hunger: 10, thirst: 15, stamina: 20 },
    hours: 2,
    xp: 10,
  },
  laut: {
    base: ["salmon", "golden_fish", "trash", "worm_bait"],
    cat: ["salmon", "golden_fish"],
    cost: { hunger: 3, thirst: 5, stamina: 5 },
    hours: 1,
    xp: 5,
  },
  sampah: {
    base: ["trash", "fiber", "mineral_water"],
    cat: ["mineral_water"],
    cost: { hunger: 4, thirst: 6, stamina: 8 },
    hours: 1,
    xp: 4,
  },
};

// Upah kecil berupa Naura Star Fragment untuk setiap sesi eksplorasi yang
// berhasil. Grinding barang kini ikut memberi makan loop mata uang: kerja di
// kota membayar Coin, eksplorasi alam membayar NSF, dan Coupon tetap langka.
const NSF_REWARD = {
  hutan: 30,
  tambang: 80,
  laut: 25,
  sampah: 10,
};

// Peluang jarahan bonus per sesi. Sengaja rendah supaya tetap terasa sebagai
// kejutan, bukan jatah pasti yang bisa dihitung pemain.
const BONUS_LOOT_CHANCE = 0.2;

// Mengais tanpa alat: hasilnya sedikit, tenaganya terkuras jauh lebih banyak.
const BARE_HANDS = {
  hutan: {
    loot: ["wood", "trash"],
    cost: { hunger: 10, thirst: 15, stamina: 25 },
    hours: 1,
    xp: 3,
    story:
      "Kamu mengais hutan dengan tangan kosong. Tanganmu perih, tapi tetap dapat sesuatu.",
  },
  tambang: {
    loot: ["stone", "trash"],
    cost: { hunger: 15, thirst: 20, stamina: 35 },
    hours: 2,
    xp: 4,
    story:
      "Kamu mencungkil bebatuan dengan tangan kosong. Jarimu lecet, tapi tidak pulang dengan tangan hampa.",
  },
};

function nameOf(id) {
  const found = items.find((it) => it && it.id === id);
  return found ? found.name : id;
}

function lootTable(lokasi) {
  return LOOT[lokasi] || LOOT.hutan;
}

function bareHandsTable(lokasi) {
  return BARE_HANDS[lokasi] || null;
}

/** Alat apa yang wajib dibawa ke lokasi tertentu. */
function gearCheck(lokasi, inventory) {
  const has = (fn) =>
    inventory.some((it) => it && typeof it.id === "string" && fn(it.id));
  const hasRod = has((id) => id.includes("fishing") || id.includes("rod"));
  const hasAxe = has((id) => id.includes("axe"));
  const hasPickaxe = has((id) => id.includes("pick"));

  if (lokasi === "laut" && !hasRod)
    return { allowed: false, reason: "need_rod" };
  if (lokasi === "hutan" && !hasAxe) return { allowed: true, bareHands: true };
  if (lokasi === "tambang" && !hasPickaxe)
    return { allowed: true, bareHands: true };
  return { allowed: true, bareHands: false };
}

/** Peluang QTE per lokasi. Laut selalu QTE karena ikannya harus disentak. */
function shouldQte(lokasi) {
  if (lokasi === "laut") return true;
  if (lokasi === "tambang") return Math.random() < 0.4;
  if (lokasi === "hutan") return Math.random() < 0.3;
  return false;
}

function petBonus(activePets) {
  const types = (activePets || []).map((p) => p.petType);
  return { wolf: types.includes("wolf"), cat: types.includes("cat") };
}

/**
 * Antar pemain kembali ke desa tanpa memberi hadiah apa pun.
 * Lewat cacheManager, bukan UserSurvival.update() langsung, supaya cache
 * user:survival tidak menyimpan lokasi lama sampai TTL-nya habis.
 */
async function goHome(userId) {
  await cacheManager.updateUserSurvival(userId, {
    currentLocation: HOME_LOCATION,
  });
}

/**
 * Bagikan hasil eksplorasi: barang, biaya tenaga, waktu, XP, dan progres quest.
 * Selalu dipanggil sesudah pemain berhasil, jadi tidak ada jalur yang memotong
 * stamina tanpa memberi apa pun.
 */
async function grantLoot({ userId, lokasi, bareHands, activePets }) {
  const profile = await cacheManager.getUserProfile(userId);
  const survival = await cacheManager.getUserSurvival(userId);
  if (!profile || !survival) return { ok: false, reason: "no_profile" };

  const bonus = petBonus(activePets);
  const bare = bareHands ? bareHandsTable(lokasi) : null;
  const table = lootTable(lokasi);

  const gained = [];

  if (bare) {
    bare.loot.forEach((id) => gained.push({ id, name: nameOf(id), amount: 1 }));
  } else {
    const pool = bonus.cat ? table.base.concat(table.cat) : table.base;
    const rolled = pool[Math.floor(Math.random() * pool.length)];
    gained.push({ id: rolled, name: nameOf(rolled), amount: 1 });

    // Jarahan bonus: satu gulungan ekstra dari pool yang sama. Serigala
    // membantu berburu di hutan sehingga peluangnya naik sedikit.
    const bonusChance =
      lokasi === "hutan" && bonus.wolf
        ? BONUS_LOOT_CHANCE + 0.1
        : BONUS_LOOT_CHANCE;
    if (Math.random() < bonusChance) {
      const extra = pool[Math.floor(Math.random() * pool.length)];
      gained.push({
        id: extra,
        name: nameOf(extra),
        amount: 1,
        bonus: true,
      });
    }
  }

  // Serigala membantu menghemat tenaga saat menambang.
  const cost = { ...(bare ? bare.cost : table.cost) };
  if (!bare && lokasi === "tambang" && bonus.wolf) {
    cost.hunger = Math.max(0, cost.hunger - 4);
    cost.thirst = Math.max(0, cost.thirst - 5);
    cost.stamina = Math.max(0, cost.stamina - 5);
  }

  const hours = bare ? bare.hours : table.hours;
  const xp = bare ? bare.xp : table.xp;

  // Barang dulu, biaya tenaga kemudian. Kalau penyimpanan gagal, pemain tidak
  // boleh kehilangan stamina untuk hasil yang tidak pernah masuk tas.
  const stored = await addItemsAtomic(userId, gained);
  if (!stored.ok) return { ok: false, reason: "write_failed" };

  // Upah NSF lewat modul mata uang agar buff klan dan sinkronisasi cache
  // diterapkan sama seperti sumber pendapatan lainnya.
  let nsf = 0;
  try {
    nsf = await currency.reward(
      currency.FRAGMENT,
      { survival, profile },
      NSF_REWARD[lokasi] || 10,
    );
  } catch (e) {
    // Hadiah uang bersifat pemanis; kegagalannya tidak membatalkan jarahan.
  }

  // Statistik dikurangi sebagai delta, bukan nilai absolut hasil pembacaan.
  // Nilai absolut membuat dua eksplorasi yang selesai berdekatan saling menimpa,
  // sehingga salah satu pengurasan hilang. Hanya statistik yang memang akan
  // menyentuh nol ditulis sebagai angka pasti supaya tidak pernah minus.
  const drain = {};
  const floored = {};
  for (const field of DRAIN_FIELDS) {
    const amount = Number(cost[field]) || 0;
    if (amount <= 0) continue;
    const now = Number(survival[field]) || 0;
    if (now - amount <= 0) floored[field] = 0;
    else drain[field] = -amount;
  }

  if (Object.keys(drain).length > 0) {
    await cacheManager.incrementUserSurvival(userId, drain);
  }
  await cacheManager.updateUserSurvival(userId, {
    ...floored,
    currentLocation: HOME_LOCATION,
  });

  const timeUpdate = await advanceTime(userId, hours);
  await leveling.addPlayerXP(userId, xp);

  // Progres quest bersifat pemanis, jadi kegagalannya tidak boleh membatalkan hadiah.
  try {
    const { incrementQuestProgress } = require("../engines/questGenerator");
    await incrementQuestProgress(userId, "collect");

    const today = new Date().toISOString().split("T")[0];
    const [quest] = await UserQuest.findOrCreate({
      where: { userId },
      defaults: { lastReset: today },
    });
    if (quest.lastReset !== today) {
      quest.workCount = 0;
      quest.dungeonKills = 0;
      quest.collectCount = 0;
      quest.isClaimed = false;
      quest.lastReset = today;
    }
    quest.collectCount = (quest.collectCount || 0) + 1;
    // Rule 1.8: fields eksplisit karena cabang reset menulis lima kolom.
    await quest.save({
      fields: [
        "workCount",
        "dungeonKills",
        "collectCount",
        "isClaimed",
        "lastReset",
      ],
    });
  } catch (e) {
    // Diamkan saja, hadiah utamanya sudah masuk.
  }

  return {
    ok: true,
    gained,
    cost,
    hours,
    xp,
    nsf,
    bareStory: bare ? bare.story : null,
    day: timeUpdate.day,
    hour: timeUpdate.hour,
    timeState: getTimeState(timeUpdate.hour),
    passedOut: Boolean(timeUpdate.passedOut),
  };
}

module.exports = {
  HOME_LOCATION,
  LOOT,
  BARE_HANDS,
  nameOf,
  lootTable,
  bareHandsTable,
  gearCheck,
  shouldQte,
  petBonus,
  goHome,
  grantLoot,
};
