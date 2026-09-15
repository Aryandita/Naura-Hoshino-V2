"use strict";

const npcs = require("../data/npcs");
const cacheManager = require("../../managers/cacheManager");

/**
 * Mendapatkan kondisi dan suasana Alun-Alun Kota (Town Square) berdasarkan jam in-game (0-23)
 * @param {number} hour - Jam in-game (0-23)
 * @returns {object}
 */
function getTownSquareState(hour) {
  let period = "pagi";
  let title = "Alun-Alun Kota: Embun Pagi";
  let atmosphere =
    "Matahari pagi menyinari bebatuan paving alun-alun kota. Kios-kios pasar mulai menggelar dagangannya dengan aroma roti panggang hangat dan kicauan burung.";
  let eventName = "Pasar Pagi Hasil Bumi";
  let eventBonus = "+15% Harga Jual Hasil Panen & Tangkapan Ikan";
  let activeNpcIds = ["luna_gacha", "ningsih", "kades_tirto"];

  if (hour >= 6 && hour < 12) {
    period = "pagi";
    title = "Alun-Alun Kota: Pasar Pagi";
    atmosphere =
      "Matahari pagi menyinari bebatuan paving alun-alun kota. Kios-kios pasar mulai menggelar dagangannya dengan aroma segar hasil bumi dan sapaan hangat para warga.";
    eventName = "Pasar Pagi Hasil Bumi";
    eventBonus = "+15% Harga Jual Hasil Panen & Tangkapan Ikan";
    activeNpcIds = ["luna_gacha", "ningsih", "kades_tirto"];
  } else if (hour >= 12 && hour < 18) {
    period = "siang";
    title = "Alun-Alun Kota: Siang Sibuk & Festival";
    atmosphere =
      "Alun-alun dipenuhi keramaian petualang dan pedagang lintas daerah. Air mancur pusat berkilau di bawah terik matahari, mengiringi tawa anak-anak yang bermain.";
    eventName = "Bazaar Kerajinan & Kuliner";
    eventBonus = "Diskon 10% di Kafe & Toko Bahan Makanan";
    activeNpcIds = ["bidan_sari", "bu_ratna", "tari"];
  } else if (hour >= 18 && hour < 24) {
    period = "malam";
    title = "Alun-Alun Kota: Lentera Malam & Musik";
    atmosphere =
      "Lentera neon dan obor temaram menyala di sekeliling air mancur. Alunan musik jalanan sayup-sayup terdengar, menemani para petualang yang melepas lelah setelah seharian bertualang.";
    eventName = "Panggung Akustik Malam Kota";
    eventBonus = "+20% EXP Friendship saat berinteraksi sosial";
    activeNpcIds = ["tari", "luna_gacha", "kades_tirto"];
  } else {
    period = "dini_hari";
    title = "Alun-Alun Kota: Hening Dini Hari";
    atmosphere =
      "Langkah kakimu bergema di keheningan alun-alun. Angin dingin malam berhembus lembut melintasi bangku-bangku taman yang kosong di bawah cahaya rembulan.";
    eventName = "Jam Jaga Petugas Malam";
    eventBonus = "Peluang menemukan jejak rumor rahasia di sudut alun-alun";
    activeNpcIds = ["kades_tirto"];
  }

  const activeNpcs = activeNpcIds
    .map((id) => npcs[id])
    .filter(Boolean)
    .map((npc) => ({
      id: npc.id,
      name: npc.name,
      title: npc.title,
      personality: npc.personality,
    }));

  return {
    hour,
    period,
    title,
    atmosphere,
    eventName,
    eventBonus,
    activeNpcs,
  };
}

/**
 * Menyapa NPC yang sedang berada di alun-alun kota
 * @param {string} npcId
 * @param {string} userId
 * @param {number} hour
 * @returns {Promise<{ reply: string, bonusText?: string }>}
 */
async function talkToTownNpc(npcId, userId, hour) {
  const npc = npcs[npcId];
  if (!npc) {
    return { reply: "Penduduk yang kamu cari sedang tidak terlihat di sekitar alun-alun." };
  }

  let greeting = "";
  if (npcId === "luna_gacha") {
    greeting =
      hour < 12
        ? "Halo petualang! Banner gacha edisi hari ini baru saja diisi ulang loh! Mau coba keberuntunganmu pagi ini?"
        : "Hai hai! Suasana alun-alun asyik banget ya buat pamer pernak-pernik langka!";
  } else if (npcId === "ningsih") {
    greeting =
      "Selamat beraktivitas! Bunga-bunga di taman alun-alun mekar indah sekali hari ini. Jangan lupa jaga tanamanmu ya!";
  } else if (npcId === "kades_tirto") {
    greeting =
      "Oh, halo anak muda. Senang melihat warga yang rajin meramaikan alun-alun. Jaga kebersihan dan ketertiban kota ya.";
  } else if (npcId === "bidan_sari") {
    greeting =
      "Halo sayang, jangan memaksakan diri kalau staminamu menipis ya. Sempatkan istirahat atau minum obat herbal jika lelah.";
  } else if (npcId === "bu_ratna") {
    greeting =
      "Membaca di bawah naungan pohon alun-alun kota selalu memberikan ketenangan pikiran. Belajar itu petualangan seumur hidup!";
  } else if (npcId === "tari") {
    greeting =
      "Oi! Nanti kalau ada waktu luang, ayo melaut bareng! Gelombang laut hari ini kelihatan menantang banget!";
  } else {
    greeting = `Halo di sana! Senang bisa bertemu denganmu di alun-alun kota.`;
  }

  // Generative AI Dialogue bertenaga Gemini 2.5 Flash / Ensemble Router
  const aiEnsembleRouter = require("../../ai/aiEnsembleRouter");
  let generativeReply = null;
  try {
    const aiPromise = aiEnsembleRouter.routeTask(aiEnsembleRouter.TASK_TYPES.GENERAL_CHAT, {
      message: `Pemain menyapamu di alun-alun kota pada jam ${hour}:00.`,
      systemInstruction: `Kamu adalah NPC "${npc.name}" (${npc.title}) di game Naura Wilds dengan kepribadian: ${npc.personality}. Jam in-game sekarang adalah jam ${hour}:00. Berikan sapaan 1-2 kalimat pendek dan ramah dalam bahasa Indonesia. Dilarang memakai karakter em-dash.`,
      config: { maxOutputTokens: 60, temperature: 0.7 },
    });

    // Timeout 1800ms agar interaksi Discord tetap cepat
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("AI_TIMEOUT")), 1800));
    const aiResult = await Promise.race([aiPromise, timeoutPromise]);
    if (aiResult && aiResult.text) {
      generativeReply = aiResult.text.replace(/[\u2014\u2013]/g, "-").trim();
    }
  } catch (e) {
    // Fallback ke greeting template
  }

  const finalReply = generativeReply || greeting;

  // Peluang mendapatkan buff sapaan warga (+20 Star Fragments) dengan cooldown 30 menit per pemain
  let bonusText = null;
  const cooldownKey = `town:greet_bonus:${userId}`;
  const redisManager = require("../../managers/redisManager");
  const hasRecentBonus = await redisManager.getCache(cooldownKey).catch(() => null);

  if (!hasRecentBonus && Math.random() < 0.35) {
    await cacheManager.incrementUserSurvival(userId, { starFragments: 20 }).catch(() => {});
    await redisManager.setCache(cooldownKey, "1", 1800).catch(() => {}); // 30 menit cooldown
    bonusText = "✨ Kamu menerima traktiran kopi hangat (+20 Star Fragments)!";
  }

  // Progres Hubungan & Affection dengan NPC (UserNPC)
  const UserNPC = require("../../models/UserNPC");
  let affinityText = null;
  try {
    const [userNpc] = await UserNPC.findOrCreate({
      where: { userId, npcId },
      defaults: { affection: 0, relationshipLevel: 0 },
    });

    const oldLevel = userNpc.relationshipLevel || 0;
    userNpc.affection = (userNpc.affection || 0) + 10;
    userNpc.lastInteraction = new Date();

    let newLevel = 0;
    if (userNpc.affection >= 300) newLevel = 3;
    else if (userNpc.affection >= 150) newLevel = 2;
    else if (userNpc.affection >= 50) newLevel = 1;

    userNpc.relationshipLevel = newLevel;
    await userNpc.save();

    const LEVEL_TITLES = ["Kenalan", "Teman", "Sahabat", "Sahabat Dekat"];
    if (newLevel > oldLevel) {
      affinityText = `💖 Hubunganmu dengan **${npc.name}** naik ke tingkat **${LEVEL_TITLES[newLevel]}**! (Affection: ${userNpc.affection})`;
    } else {
      affinityText = `💬 Affection dengan **${npc.name}** +10 (Total: ${userNpc.affection} - ${LEVEL_TITLES[newLevel]})`;
    }
  } catch (_) {
    // Non-blocking jika terjadi kendala DB
  }

  return {
    reply: finalReply,
    bonusText,
    affinityText,
  };
}

const WANDERING_MERCHANT_RELICS = [
  {
    id: "astral_compass",
    name: "Kompas Astral Kuno",
    description: "Relik penunjuk jalan ruang angkasa kuno. Menambah tingkat keberhasilan ekspedisi raid.",
    price: 1200,
    category: "relic",
    emoji: "🧭",
  },
  {
    id: "celestial_elixir",
    name: "Ramuan Surgawi Neo-Hoshino",
    description: "Elixir legendaris yang memulihkan seluruh vital sekaligus.",
    price: 800,
    category: "consumable",
    emoji: "🧪",
  },
  {
    id: "ancient_relic_shard",
    name: "Pecahan Relik Leluhur",
    description: "Bahan langka untuk meningkatkan peralatan ke grade Mythic.",
    price: 2500,
    category: "material",
    emoji: "💎",
  },
  {
    id: "dungeon_pass",
    name: "Tiket Ekspedisi Dungeon Langka",
    description: "Tiket masuk instan ke kedalaman dungeon tanpa syarat.",
    price: 1000,
    category: "pass",
    emoji: "🎫",
  },
];

/**
 * Memeriksa status kehadiran Pedagang Pengembara di Alun-Alun Kota
 * yang dibiayai oleh wanderingMerchantPool dari kas daur ulang Currency V2.
 */
async function getWanderingMerchant() {
  const RecyclingPoolEngine = require("./recyclingPoolEngine");
  const treasury = await RecyclingPoolEngine.getTreasury().catch(() => null);
  const pool = Number(treasury?.wanderingMerchantPool || 0);

  // Hadir jika pool dana kas daur ulang mencapai minimal 100 NSF
  const isPresent = pool >= 100;

  return {
    isPresent,
    merchantName: "Kaelen si Pengembara Astral",
    merchantTitle: "Pedagang Relik Antar Dimensi",
    poolBalance: pool,
    items: WANDERING_MERCHANT_RELICS,
  };
}

/**
 * Pembelian barang relik dari Pedagang Pengembara secara atomik
 */
async function buyFromWanderingMerchant(userId, itemId) {
  const { addItemsAtomic } = require("./inventoryHelper");
  const RecyclingPoolEngine = require("./recyclingPoolEngine");

  const merchant = await getWanderingMerchant();
  if (!merchant.isPresent) {
    return { ok: false, reason: "not_present", message: "Pedagang Pengembara sedang mengembara ke dimensi lain." };
  }

  const item = merchant.items.find((it) => it.id === itemId);
  if (!item) {
    return { ok: false, reason: "item_not_found", message: "Barang tidak ditemukan di lapak pengembara." };
  }

  const profile = await cacheManager.getUserSurvival(userId);
  const userNsf = Number(profile?.starFragments || 0);

  if (userNsf < item.price) {
    return {
      ok: false,
      reason: "insufficient_nsf",
      message: `Star Fragments kamu tidak cukup. Butuh ${item.price.toLocaleString("id-ID")} NSF, saldo kamu saat ini: ${userNsf.toLocaleString("id-ID")} NSF.`,
    };
  }

  // Potong saldo secara atomik
  const debitRes = await cacheManager.debitUserSurvival(userId, "starFragments", item.price);
  if (!debitRes) {
    return { ok: false, reason: "debit_failed", message: "Gagal memproses transaksi saldo." };
  }

  // Tambahkan item ke inventaris pemain
  const addRes = await addItemsAtomic(userId, [{ id: item.id, name: item.name, amount: 1 }]);
  if (!addRes.ok) {
    // Rollback saldo jika penambahan item gagal
    await cacheManager.incrementUserSurvival(userId, { starFragments: item.price }).catch(() => {});
    return { ok: false, reason: "inventory_failed", message: "Gagal memasukkan barang ke inventaris." };
  }

  // Serap subsidi dari kas daur ulang pedagang (15% dari harga beli)
  const treasury = await RecyclingPoolEngine.getTreasury().catch(() => null);
  if (treasury && Number(treasury.wanderingMerchantPool || 0) > 0) {
    const deduction = Math.min(Number(treasury.wanderingMerchantPool), Math.floor(item.price * 0.15));
    treasury.wanderingMerchantPool = Math.max(0, Number(treasury.wanderingMerchantPool) - deduction);
    await treasury.save({ fields: ["wanderingMerchantPool", "updatedAt"] }).catch(() => {});
  }

  return {
    ok: true,
    item,
    cost: item.price,
  };
}

module.exports = {
  getTownSquareState,
  talkToTownNpc,
  getWanderingMerchant,
  buyFromWanderingMerchant,
  WANDERING_MERCHANT_RELICS,
};
