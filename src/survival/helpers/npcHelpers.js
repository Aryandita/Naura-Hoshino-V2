"use strict";

const fs = require("fs");
const path = require("path");
const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");

// Aturan main
const GREET_COOLDOWN_MS = 30 * 60 * 1000;
const MAX_DAILY_GIFTS = 3;
const GIFT_COST = 200;
const REPAIR_COST = 500;
const SEIZE_FINE = 1000;
const COLLECTOR_MS = 120000;

// Layanan khusus milik NPC tertentu. Disimpan terpisah dari npcs.js supaya
// berkas konfigurasi karakter tetap murni berisi jati diri mereka.
const NPC_SERVICES = {
  bagas: "repair",
  pak_anif: "tax",
};

const CHARACTER_DIR = path.join(
  __dirname,
  "..",
  "..",
  "assets",
  "survival",
  "characters",
);
const IMAGE_EXTENSIONS = [".png", ".webp", ".jpeg", ".jpg"];

/** Emoji dari ui.js, dengan cadangan sederhana bila kunci belum terisi. */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Cari potret NPC. Nama berkas di konfigurasi didahulukan, lalu ditebak dari id.
 * Mengembalikan null bila memang tidak ada, sehingga NPC tanpa gambar tetap
 * bisa diajak bicara.
 */
function findPortrait(npc) {
  const candidates = [];
  if (npc.image) candidates.push(path.join(CHARACTER_DIR, npc.image));
  for (const ext of IMAGE_EXTENSIONS) {
    candidates.push(path.join(CHARACTER_DIR, `${npc.id}${ext}`));
  }

  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch (error) {
      // Kegagalan akses disk diperlakukan sama seperti berkas tidak ada.
    }
  }
  return null;
}

/** Bagian hari berdasarkan jam dalam game, dipakai untuk mewarnai sapaan. */
function timeOfDayKey(hour) {
  if (hour >= 5 && hour < 11) return "npc.time_morning";
  if (hour >= 11 && hour < 15) return "npc.time_noon";
  if (hour >= 15 && hour < 19) return "npc.time_evening";
  return "npc.time_night";
}

/** Apakah dua tanggal jatuh pada hari yang sama. Dipakai mereset jatah hadiah. */
function isSameDay(a, b) {
  if (!a || !b) return false;
  const left = a instanceof Date ? a : new Date(a);
  const right = b instanceof Date ? b : new Date(b);
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

/** Naikkan tingkat hubungan bila afeksinya sudah pantas. */
function refreshRelationship(npcData, npc) {
  if (npcData.relationshipLevel >= 4) return;
  if (npcData.affection >= 30 && npcData.relationshipLevel < 1)
    npcData.relationshipLevel = 1;
  if (npcData.affection >= 60 && npcData.relationshipLevel < 2)
    npcData.relationshipLevel = 2;
  if (
    npcData.affection >= 90 &&
    npc.type === "romansa" &&
    npcData.relationshipLevel < 3
  ) {
    npcData.relationshipLevel = 3;
  }
}

/** Rakit tombol sesuai NPC dan keadaan hubungan saat ini. */
function buildActions(npc, npcData, t) {
  const row = new ActionRowBuilder();

  row.addComponents(
    new ButtonBuilder()
      .setCustomId("npc_greet")
      .setLabel(t("npc.btn_greet"))
      .setEmoji(e("npc_talk", "\uD83D\uDCAC"))
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("npc_gift")
      .setLabel(t("npc.btn_gift"))
      .setEmoji(e("gift", "\uD83C\uDF81"))
      .setStyle(ButtonStyle.Secondary),
  );

  // Lamaran hanya muncul bila memang sudah pantas, jadi tombolnya sendiri
  // sudah menjadi petunjuk kemajuan hubungan.
  if (
    npc.type === "romansa" &&
    npcData.relationshipLevel === 3 &&
    npcData.affection >= 100
  ) {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("npc_marry")
        .setLabel(t("npc.btn_marry"))
        .setEmoji(e("wedding_ring", "\uD83D\uDC8D"))
        .setStyle(ButtonStyle.Success),
    );
  }

  const service = NPC_SERVICES[npc.id];
  if (service === "repair") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("npc_repair")
        .setLabel(t("npc.btn_repair"))
        .setStyle(ButtonStyle.Secondary),
    );
  } else if (service === "tax") {
    row.addComponents(
      new ButtonBuilder()
        .setCustomId("npc_tax_pay")
        .setLabel(t("npc.btn_tax"))
        .setStyle(ButtonStyle.Secondary),
    );
  }

  return row;
}

/**
 * Balasan singkat yang hanya terlihat oleh pemain. Flag Components V2 harus
 * digabung dengan flag ephemeral, bukan lewat opsi ephemeral yang lama.
 */
function reply(i, title, description, colorName = "success") {
  const payload = buildContainerV2({
    accentColorHex: ui.getColor(colorName) || "#FFB6C1",
    title,
    description,
    footerText: ui.getFooter("survival"),
  });

  return i.followUp({
    ...payload,
    flags:
      (payload.flags || MessageFlags.IsComponentsV2) | MessageFlags.Ephemeral,
  });
}

function fail(i, message, t) {
  return reply(
    i,
    `${e("cry", "\u274C")} ${t("common.error.title")}`,
    message,
    "error",
  );
}

module.exports = {
  GREET_COOLDOWN_MS,
  MAX_DAILY_GIFTS,
  GIFT_COST,
  REPAIR_COST,
  SEIZE_FINE,
  COLLECTOR_MS,
  NPC_SERVICES,
  e,
  findPortrait,
  timeOfDayKey,
  isSameDay,
  refreshRelationship,
  buildActions,
  reply,
  fail,
};
