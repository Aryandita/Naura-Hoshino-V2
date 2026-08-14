"use strict";

/**
 * Sumber Naura Coupon dari dalam permainan.
 *
 * Sesuai pilihan desain: mayoritas kupon didapat dengan bermain, vote hanya
 * mempercepat. Angkanya sengaja kecil karena satu barang obsidian butuh 14-20
 * kupon, jadi perjalanan mengumpulkannya harus terasa berarti.
 */

const currency = require("../engines/currency");

// peluang: kemungkinan menjatuhkan kupon; min/max: jumlah bila menang.
const DROP_TABLE = {
  raid_victory: { chance: 0.25, min: 1, max: 2, label: "Kemenangan Raid" },
  clan_boss_kill: { chance: 0.5, min: 2, max: 4, label: "Bos Klan Tumbang" },
  dungeon_clear: { chance: 0.15, min: 1, max: 1, label: "Dungeon Tuntas" },
  dungeon_boss: { chance: 0.4, min: 1, max: 3, label: "Bos Dungeon" },
  achievement_rare: { chance: 1, min: 1, max: 2, label: "Pencapaian Langka" },
  achievement_mythic: { chance: 1, min: 3, max: 5, label: "Pencapaian Mitos" },
  rebirth: { chance: 1, min: 5, max: 5, label: "Reinkarnasi" },
  quest_weekly: { chance: 0.35, min: 1, max: 2, label: "Misi Mingguan" },
  heist_success: { chance: 0.1, min: 1, max: 1, label: "Perampokan Sukses" },
};

// LUCK menaikkan peluang, tetapi dibatasi supaya Mahkota Keberuntungan tidak
// membuat kupon mengalir tanpa henti.
const LUCK_CAP = 0.2;

function luckBonus(survival) {
  const luck = Number((survival || {}).luck) || 1;
  return Math.min(LUCK_CAP, luck * 0.002);
}

function rollAmount(entry) {
  const span = entry.max - entry.min;
  return entry.min + Math.floor(Math.random() * (span + 1));
}

/**
 * Undi kupon untuk satu sumber. Tidak menyentuh database bila kalah undian.
 *
 * @returns {Promise<{gained: number, total?: number, label?: string}>}
 */
async function rollCouponDrop(source, { survival }) {
  const entry = DROP_TABLE[source];
  if (!entry || !survival) return { gained: 0 };

  const chance = Math.min(1, entry.chance + luckBonus(survival));
  if (Math.random() > chance) return { gained: 0, label: entry.label };

  const gained = rollAmount(entry);
  const total = await currency.reward(currency.COUPON, { survival }, gained);
  return { gained, total, label: entry.label };
}

/** Baris teks siap tempel untuk kartu hasil, kosong bila tidak dapat kupon. */
function dropLine(result) {
  if (!result || !result.gained) return "";
  const emoji = currency.emojiOf(currency.COUPON);
  return `${emoji} Naura kasih **${result.gained} Naura Coupon** buat kamu! Total sekarang **${result.total}**.`;
}

module.exports = { DROP_TABLE, rollCouponDrop, dropLine, luckBonus };
