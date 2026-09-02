"use strict";

const { MessageFlags } = require("discord.js");
const UserSurvival = require("../../../src/models/UserSurvival");
const UserNPC = require("../../../src/models/UserNPC");
const cacheManager = require("../../../src/managers/cacheManager");
const {
  safeParseInventory,
  takeItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const {
  advanceTime,
  getTimeState,
} = require("../../../src/survival/helpers/survivalTime");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const currency = require("../../../src/survival/engines/currency");
const {
  rollCouponDrop,
  dropLine,
} = require("../../../src/survival/helpers/couponRewards");

// Perampokan terjadi di kota, jadi rampasan dan dendanya memakai Naura Coin.
const LOOT_MIN = 50;
const LOOT_MAX = 150;
const BANK_PENALTY = 50;
const AFFECTION_PENALTY = 30;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

function fail(interaction, title, description) {
  const payload = buildContainerV2({
    accentColorHex: ui.getColor("error") || "#ef4444",
    authorName: "Naura Central Bank",
    title,
    expression: "error",
    description,
    footerText: ui.getFooter("survival"),
  });
  return interaction.reply(ephemeral(payload));
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });
    const profile = await cacheManager.getUserProfile(user.id);
    const holders = { survival, profile };

    if (survival.currentLocation !== "kota") {
      return fail(
        interaction,
        `${e("shy", "\uD83D\uDE45")} Kamu belum sampai di kota`,
        "Naura Central Bank cuma ada di **Kota**, lho. Pakai `/survival travel` dulu ya, Naura tunggu di sana!",
      );
    }

    const timeState = getTimeState(survival.inGameHour || 6);
    const isNight =
      timeState.label.toLowerCase().includes("malam") ||
      survival.inGameHour <= 5 ||
      survival.inGameHour >= 22;

    if (!isNight) {
      return fail(
        interaction,
        `${e("thinking", "\uD83D\uDD52")} Banknya masih ramai`,
        "Sekarang bank masih buka dan dijaga ketat Satpam Yanto. Naura sih nyaranin datang lagi tengah malam waktu sepi. Sabar sedikit ya!",
      );
    }

    const inventory = safeParseInventory(profile.inventory);
    const hasMask = inventory.some((i) => i && i.id === "heist_mask");
    const bombIndex = inventory.findIndex((i) => i && i.id === "c4_bomb");

    if (!hasMask || bombIndex === -1) {
      return fail(
        interaction,
        `${e("akward", "\uD83D\uDE05")} Perlengkapanmu belum lengkap`,
        `Duh, kamu belum siap-siap! Kamu wajib pakai ${e("mask", "\uD83C\uDFAD")} **Topeng Perampok** dan bawa ${e("bomb", "\uD83D\uDCA5")} **Bom Rakitan (C4)** buat membuka brankasnya. Rakit dulu di meja perakitan, Naura temani.`,
      );
    }

    const taken = await takeItemsAtomic(user.id, [
      { id: "c4_bomb", amount: 1 },
    ]);
    if (!taken) {
      return fail(
        interaction,
        `${e("error", "❌")} Bom tidak ditemukan`,
        "Sepertinya bomnya hilang saat kamu sedang bersiap.",
      );
    }

    const agility = survival.agility || 1;
    const luck = survival.luck || 1;
    const successChance =
      10 + Math.min(80, agility) * 0.5 + Math.min(100, luck) * 0.2;

    if (Math.random() * 100 <= successChance) {
      const loot =
        LOOT_MIN + Math.floor(Math.random() * (LOOT_MAX - LOOT_MIN + 1));
      await currency.reward(currency.COIN, holders, loot);
      await advanceTime(user.id, 4);

      const questGen = require("../../../src/survival/engines/questGenerator");
      await questGen
        .incrementQuestProgress(user.id, "heist", 1)
        .catch(() => {});

      const coupon = await rollCouponDrop("heist_success", { survival });
      const couponText = dropLine(coupon);

      const lines = [
        "Brankasnya kebuka! Kamu kabur lewat gang belakang tepat sebelum Bripka Agus datang. Naura sempat nahan napas lihat kamu, tahu!",
        "",
        `${e("impressed", "\uD83D\uDCB0")} **Rampasan:** ${currency.format(currency.COIN, loot)}`,
        "",
        "Kamu ngumpet dulu **4 jam** buat menghilangkan jejak. Hati-hati ya, Naura khawatir.",
      ];

      if (couponText) lines.push("", couponText);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        authorName: "Naura Central Bank",
        title: `${e("cheers", "\uD83D\uDCA5")} Perampokan sukses!`,
        iconURL: user.displayAvatarURL(),
        expression: "success",
        description: lines.join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply(payload);
    }

    // GAGAL: seluruh NSF di kantong disita dan bank memotong denda Naura Coin.
    const seized = survival.starFragments || 0;
    if (seized > 0) {
      await cacheManager.debitUserSurvival(user.id, "starFragments", seized);
    }

    const bankBalance = profile.economy_bank || 0;
    const paidPenalty = Math.min(bankBalance, BANK_PENALTY);
    if (paidPenalty > 0) {
      await cacheManager.debitUserProfile(user.id, "economy_bank", paidPenalty);
    }

    const allNPCs = await UserNPC.findAll({ where: { userId: user.id } });
    for (const npc of allNPCs) {
      npc.affection = Math.max(0, npc.affection - AFFECTION_PENALTY);
      npc.relationshipLevel = Math.max(0, npc.relationshipLevel - 1);
      await npc.save({ fields: ["affection", "relationshipLevel"] });
    }

    // advanceTime memulangkan pemain ke desa, jadi status penjara harus
    // ditulis sesudahnya supaya tidak ikut tertimpa.
    await advanceTime(user.id, 24);
    await survival.reload().catch(() => {});
    survival.currentLocation = "prison";
    survival.stamina = 10;
    survival.hp = 10;
    // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain seperti
    // starFragments yang mungkin berubah lewat jalur atomik.
    await survival.save({ fields: ["currentLocation", "stamina", "hp"] });

    const lines = [
      "Alarmnya bunyi kencang banget! Bripka Agus dan timnya nyergap kamu sebelum sempat keluar dari brankas. Naura sedih lihat kamu digelandang...",
      "",
      "Kamu ditahan di **Penjara** selama **24 jam**.",
      "",
      `${e("cry", "\uD83D\uDCB8")} Isi kantong disita: ${currency.format(currency.FRAGMENT, seized)}`,
      `${e("cry", "\uD83D\uDCB8")} Denda bank: ${currency.format(currency.COIN, paidPenalty)}`,
    ];

    if (allNPCs.length > 0) {
      lines.push(
        "",
        `${e("hmph", "\uD83D\uDC94")} Berita penangkapanmu kesebar ke mana-mana. **Semua NPC** kecewa, afeksi mereka turun dan level hubungannya berkurang satu tingkat.`,
      );
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("error") || "#ef4444",
      authorName: "Naura Central Bank",
      title: `${e("shocked", "\u26D3\uFE0F")} Kamu tertangkap!`,
      iconURL: user.displayAvatarURL(),
      expression: "error",
      description: lines.join("\n"),
      footerText: ui.getFooter("survival"),
    });

    return interaction.reply(payload);
  },
};
