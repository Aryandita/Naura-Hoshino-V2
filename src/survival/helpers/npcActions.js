"use strict";

const { AttachmentBuilder } = require("discord.js");

const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { safeParseInventory } = require("../engines/inventoryHelper");
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
  await npcData.save();

  return reply(
    i,
    `${e("happy", "\uD83D\uDCAC")} ${t("npc.greet_title")}`,
    t("npc.greet_body", { name: npc.name, bonus }),
    "success",
    npc,
  );
}

/** Memberi hadiah. Jatahnya harian dan menguras serpihan bintang. */
async function gift(i, ctx) {
  const { npc, npcData, survival, t, coin, now } = ctx;

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

  if (survival.starFragments < GIFT_COST) {
    return fail(i, t("npc.gift_poor", { cost: `${GIFT_COST} ${coin}` }), t);
  }

  survival.starFragments -= GIFT_COST;
  await survival.save({ fields: ["starFragments"] });

  const bonus = Math.floor(Math.random() * 5) + 3;
  npcData.affection = Math.min(100, npcData.affection + bonus);
  npcData.dailyGifts = giftsToday + 1;
  npcData.lastInteraction = now;
  refreshRelationship(npcData, npc);
  await npcData.save({
    fields: ["affection", "dailyGifts", "lastInteraction", "relationshipLevel"],
  });

  return reply(
    i,
    `${e("cheers", "\uD83C\uDF81")} ${t("npc.gift_title")}`,
    t("npc.gift_body", { name: npc.name, cost: `${GIFT_COST} ${coin}`, bonus }),
    "success",
    npc,
  );
}

/** Melamar. Hanya untuk NPC romansa, butuh cincin dan afeksi penuh. */
async function marry(i, ctx) {
  const { npc, npcData, survival, profile, t, now } = ctx;

  // Penjaga yang sebelumnya tidak ada: NPC berjenis teman tidak boleh dilamar.
  if (npc.type !== "romansa") {
    return fail(i, t("npc.marry_wrong_type", { name: npc.name }), t);
  }

  const inventory = safeParseInventory(profile.inventory);
  const ringIndex = inventory.findIndex(
    (item) => item && item.id === "wedding_ring",
  );
  if (ringIndex === -1) {
    return fail(i, t("npc.marry_no_ring"), t);
  }

  if (npcData.affection < 100) {
    return fail(i, t("npc.marry_not_ready", { name: npc.name }), t);
  }

  inventory.splice(ringIndex, 1);
  profile.inventory = inventory;
  profile.changed("inventory", true);
  await profile.save({ fields: ["inventory"] });

  npcData.relationshipLevel = 4;
  npcData.lastInteraction = now;
  await npcData.save({ fields: ["relationshipLevel", "lastInteraction"] });

  let extraMsg = "";
  const rpgState = survival.rpg_state || {};
  if (!Array.isArray(rpgState.unlocked_cutscenes))
    rpgState.unlocked_cutscenes = [];
  if (!rpgState.unlocked_cutscenes.includes("wedding")) {
    rpgState.unlocked_cutscenes.push("wedding");
    survival.rpg_state = rpgState;
    survival.changed("rpg_state", true);
    await survival.save({ fields: ["rpg_state"] });
    extraMsg = t("npc.cutscene_unlocked");
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
    title: `${e("blowkiss", "\uD83D\uDC8D")} ${t("npc.marry_title")}`,
    description: `${t("npc.marry_body", { name: npc.name })}${extraMsg}`,
    bannerAttachmentName,
    files,
    footerText: ui.getFooter("survival"),
  });

  return i.followUp(payload);
}

/** Bagas memperbaiki seluruh alat sekaligus. */
async function repair(i, ctx) {
  const { npc, survival, profile, t, coin } = ctx;

  if (survival.starFragments < REPAIR_COST) {
    return fail(i, t("npc.repair_poor", { cost: `${REPAIR_COST} ${coin}` }), t);
  }

  survival.starFragments -= REPAIR_COST;
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
  await survival.save({ fields: ["starFragments"] });

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

  survival.starFragments -= cost;
  rpgState.tax_due = 0;
  rpgState.house_seized = false;
  survival.rpg_state = rpgState;
  survival.changed("rpg_state", true);
  await survival.save({ fields: ["starFragments", "rpg_state"] });

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
