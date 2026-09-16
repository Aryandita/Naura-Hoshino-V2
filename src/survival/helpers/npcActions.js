"use strict";

const { AttachmentBuilder } = require("discord.js");

const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const {
  safeParseInventory,
  takeItemsAtomic,
} = require("../engines/inventoryHelper");
const cacheManager = require("../../managers/cacheManager");
const {
  GREET_COOLDOWN_MS,
  MAX_DAILY_GIFTS,
  GIFT_COST,
  REPAIR_COST,
  SEIZE_FINE,
  e,
  isSameDay,
  refreshRelationship,
  reply,
  fail,
} = require("./npcHelpers");

// Setiap aksi menerima wadah yang sama: { npc, npcData, survival, profile, t, coin, now }

/** Menyapa NPC. Afeksi naik sedikit, dibatasi jeda supaya tidak bisa dipanen. */
async function greet(i, ctx) {
  const { npc, npcData, t, now } = ctx;

  const last = npcData.lastInteraction
    ? new Date(npcData.lastInteraction)
    : null;
  if (last && now - last < GREET_COOLDOWN_MS) {
    return fail(i, t("npc.greet_cooldown", { name: npc.name }), t);
  }

  const bonus = Math.floor(Math.random() * 2) + 1;
  npcData.affection = Math.min(100, npcData.affection + bonus);
  npcData.lastInteraction = now;
  refreshRelationship(npcData, npc);
  // Rule 1.8: fields eksplisit agar penulisan tidak menimpa kolom lain
  // yang sedang menunggu di antrean flush cache.
  await npcData.save({
    fields: ["affection", "lastInteraction", "relationshipLevel"],
  });

  return reply(
    i,
    `${e("happy", "\uD83D\uDCAC")} ${t("npc.greet_title")}`,
    t("npc.greet_body", { name: npc.name, bonus }),
    "success",
    npc,
  );
}

/** Memberi hadiah ke NPC dengan evaluasi skala Relationship Points (RP) */
async function gift(i, ctx) {
  const { npc, npcData, survival, profile, t, coin, now } = ctx;

  const giftsToday = isSameDay(npcData.lastInteraction, now)
    ? npcData.dailyGifts || 0
    : 0;
  if (giftsToday >= MAX_DAILY_GIFTS) {
    return fail(
      i,
      t("npc.gift_limit", { name: npc.name, max: MAX_DAILY_GIFTS }),
      t,
    );
  }

  const npcGiftPreferences = require("../data/npcGiftPreferences");
  const inventory = safeParseInventory(profile.inventory);

  // Cari apakah pemain memiliki item di inventaris yang cocok untuk dijadikan hadiah
  let chosenItem = null;
  const preferredList = [
    ...(npcGiftPreferences.PREFERENCES[npc.id]?.loved || []),
    ...(npcGiftPreferences.PREFERENCES[npc.id]?.special || []),
    ...(npcGiftPreferences.PREFERENCES[npc.id]?.simple || []),
    ...npcGiftPreferences.GLOBAL_MYTHIC_ITEMS,
  ];

  for (const it of inventory) {
    if (it && preferredList.includes(it.id)) {
      chosenItem = it;
      break;
    }
  }

  let deltaRp = 5;
  let quote = "Terima kasih atas pemberianmu!";
  let giftDetail = "";

  if (chosenItem) {
    const taken = await takeItemsAtomic(profile.userId, [
      { id: chosenItem.id, amount: 1 },
    ]);
    if (taken.ok) {
      const evalResult = npcGiftPreferences.evaluateGift(npc.id, chosenItem.id);
      deltaRp = evalResult.rp;
      quote = evalResult.quote;
      giftDetail = `Kamu memberikan **${chosenItem.name || chosenItem.id}** (${evalResult.label}, ${deltaRp > 0 ? "+" + deltaRp : deltaRp} RP)!`;
    }
  }

  if (!giftDetail) {
    // Fallback potong koin bintang jika tidak ada item spesifik
    const debit = await cacheManager.debitUserSurvival(
      survival.userId,
      "starFragments",
      GIFT_COST,
    );
    if (!debit.ok) {
      return fail(i, t("npc.gift_poor", { cost: `${GIFT_COST} ${coin}` }), t);
    }
    giftDetail = `Kamu memberikan bingkisan koin bintang seharga \`${GIFT_COST} ${coin}\` (+5 RP)!`;
  }

  npcData.affection = Math.max(0, (npcData.affection || 0) + deltaRp);
  npcData.dailyGifts = giftsToday + 1;
  npcData.lastInteraction = now;
  refreshRelationship(npcData, npc);
  await npcData.save({
    fields: ["affection", "dailyGifts", "lastInteraction", "relationshipLevel"],
  });

  const questGen = require("../engines/questGenerator");
  await questGen
    .incrementQuestProgress(survival.userId, "gift_npc", 1)
    .catch(() => {});

  const bodyText = [
    giftDetail,
    "",
    `💬 **${npc.name}:** "${quote}"`,
    `💖 Total Affection: **${npcData.affection} RP**`,
  ].join("\n");

  return reply(
    i,
    `${e("cheers", "\uD83C\uDF81")} ${t("npc.gift_title")}`,
    bodyText,
    deltaRp >= 0 ? "success" : "warning",
    npc,
  );
}

/** Melamar. Hanya untuk NPC romansa, aturan ketat monogami (1 pasangan), butuh cincin dan afeksi. */
async function marry(i, ctx) {
  const { npc, npcData, survival, profile, t } = ctx;
  const familyEngine = require("../engines/familyEngine");

  // Penjaga: NPC berjenis teman tidak boleh dilamar
  if (npc.type !== "romansa") {
    return fail(i, t("npc.marry_wrong_type", { name: npc.name }), t);
  }

  // ATURAN KETAT MONOGAMI: Pemain tidak boleh menikahi lebih dari 1 wanita
  const marriageStatus = await familyEngine.getMarriageStatus(survival.userId, survival);
  if (marriageStatus.isMarried) {
    return fail(
      i,
      `Kamu sudah menikah dengan **${marriageStatus.spouseName}**! Di Naura Wilds, janji suci pernikahan hanya untuk satu orang pendamping hidup.`,
      t,
    );
  }

  const inventory = safeParseInventory(profile.inventory);
  const ringIndex = inventory.findIndex(
    (item) => item && (item.id === "wedding_ring" || item.id === "diamond_ring"),
  );
  if (ringIndex === -1) {
    return fail(
      i,
      "Kamu membutuhkan Cincin Berlian (Diamond Ring / Wedding Ring) di inventaris untuk melamar pujaan hatimu.",
      t,
    );
  }

  if (npcData.affection < 100 && (npcData.relationshipLevel || 0) < 3) {
    return fail(i, t("npc.marry_not_ready", { name: npc.name }), t);
  }

  const ringItem = inventory[ringIndex];
  const taken = await takeItemsAtomic(profile.userId, [
    { id: ringItem.id, amount: 1 },
  ]);
  if (!taken.ok) {
    return fail(i, t("npc.marry_no_ring"), t);
  }

  const marryResult = await familyEngine.marryNpc(survival.userId, survival, npc.id);
  if (!marryResult.ok) {
    return fail(i, "Prosesi pernikahan gagal disahkan: " + marryResult.reason, t);
  }

  const files = [];
  let bannerAttachmentName;
  const weddingBanner = ui.getBanner ? ui.getBanner("wedding") : null;
  if (weddingBanner) {
    files.push(new AttachmentBuilder(weddingBanner, { name: "wedding.png" }));
    bannerAttachmentName = "wedding.png";
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success") || "#22c55e",
    title: `${e("blowkiss", "\uD83D\uDC8D")} Janji Suci Pernikahan Bersama ${npc.name}`,
    description: [
      `Di hadapan saksi dan semesta Naura Wilds, kamu dan **${npc.name}** resmi menjadi pasangan suami istri!`,
      "",
      `💍 **Janji Suci ${npc.name}:**`,
      `*"${marryResult.vow}"*`,
      "",
      `📸 **Visual Wedding CG Telah Dibuka!** Foto momen pernikahan kalian telah diabadikan di \`/survival gallery\`!`,
    ].join("\n"),
    bannerAttachmentName,
    files,
    footerText: ui.getFooter("survival"),
  });

  return i.followUp(payload);
}


/** Bagas memperbaiki seluruh alat sekaligus. */
async function repair(i, ctx) {
  const { npc, survival, profile, t, coin } = ctx;

  // Rule 1.8: urutan aman "barang dulu, biaya belakangan". Perbarui alat
  // lebih dulu, lalu potong biaya lewat debit atomik. Bila saldo ternyata
  // tidak cukup saat pemotongan, nilai alat dikembalikan (kompensasi)
  // agar pemain tidak kehilangan uang tanpa mendapat apa pun.
  const previousDurability = {
    pickaxe: profile.tool_pickaxeDurability,
    axe: profile.tool_axeDurability,
    rod: profile.tool_fishingRodDurability,
  };

  profile.tool_pickaxeDurability = 100;
  profile.tool_axeDurability = 100;
  profile.tool_fishingRodDurability = 100;
  await profile.save({
    fields: [
      "tool_pickaxeDurability",
      "tool_axeDurability",
      "tool_fishingRodDurability",
    ],
  });

  const debit = await cacheManager.debitUserSurvival(
    survival.userId,
    "starFragments",
    REPAIR_COST,
  );
  if (!debit.ok) {
    profile.tool_pickaxeDurability = previousDurability.pickaxe;
    profile.tool_axeDurability = previousDurability.axe;
    profile.tool_fishingRodDurability = previousDurability.rod;
    await profile
      .save({
        fields: [
          "tool_pickaxeDurability",
          "tool_axeDurability",
          "tool_fishingRodDurability",
        ],
      })
      .catch(() => {});
    return fail(i, t("npc.repair_poor", { cost: `${REPAIR_COST} ${coin}` }), t);
  }

  return reply(
    i,
    `${e("impressed", "\u2692\uFE0F")} ${t("npc.repair_title")}`,
    t("npc.repair_body", { name: npc.name, cost: `${REPAIR_COST} ${coin}` }),
    "success",
    npc,
  );
}

/** Pak Anif menagih pajak, plus denda bila rumah sempat disita. */
async function tax(i, ctx) {
  const { npc, survival, t, coin } = ctx;

  const rpgState = survival.rpg_state || { tax_due: 0, house_seized: false };
  const taxDue = rpgState.tax_due || 0;

  if (taxDue <= 0 && !rpgState.house_seized) {
    return reply(
      i,
      `${e("read", "\uD83D\uDCBC")} ${t("npc.tax_title")}`,
      t("npc.tax_clean", { name: npc.name }),
      "primary",
    );
  }

  const cost = taxDue + (rpgState.house_seized ? SEIZE_FINE : 0);
  if (survival.starFragments < cost) {
    return fail(i, t("npc.tax_poor", { cost: `${cost} ${coin}` }), t);
  }

  // Rule 1.8: potong pajak lewat debit atomik, lalu bersihkan status pajak
  // di kolom JSON secara terpisah agar dua penulisan tidak saling menimpa.
  const debit = await cacheManager.debitUserSurvival(
    survival.userId,
    "starFragments",
    cost,
  );
  if (!debit.ok) {
    return fail(i, t("npc.tax_poor", { cost: `${cost} ${coin}` }), t);
  }

  rpgState.tax_due = 0;
  rpgState.house_seized = false;
  survival.rpg_state = rpgState;
  survival.changed("rpg_state", true);
  await survival.save({ fields: ["rpg_state"] });

  return reply(
    i,
    `${e("read", "\uD83D\uDCBC")} ${t("npc.tax_title")}`,
    t("npc.tax_paid", { name: npc.name, cost: `${cost} ${coin}` }),
    "primary",
    npc,
  );
}

module.exports = {
  npc_greet: greet,
  npc_gift: gift,
  npc_marry: marry,
  npc_repair: repair,
  npc_tax_pay: tax,
};
