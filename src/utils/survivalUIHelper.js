"use strict";

// 🌿 Naura Wilds - Survival UI Helper
//
// Sumber kebenaran tunggal untuk token warna dan helper antarmuka sub-brand
// Naura Wilds (Hybrid Nature-Tech). Referensi desain lengkap ada di DESIGN.md
// bagian "Survival RPG Design System - Naura Wilds".
//
// Aturan pemakaian (AGENTS.md aturan 1.3 no.20):
// - Dilarang hardcode hex warna survival di plugin atau event handler.
// - Bar vital wajib lewat buildVitalsBar() dengan threshold moss/amber/danger.
// - Footer respons survival wajib getFooter() yang mendelegasikan ke
//   ui.getFooter('survival').

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { colors, footers } = require("../config/ui/palette");
const { buildGoalGradientBar } = require("./uxHelper");
const { buildContainerV2 } = require("./NauraContainerBuilder");

/**
 * Palet earth-tone Naura Wilds.
 * Harus selalu sinkron dengan tabel "Palet Earth-Tone Survival" di DESIGN.md.
 */
const survivalColors = {
  emerald: "#86EFAC", // Aksen utama survival, border panel kaca, glow judul
  moss: "#34D399", // Bar vital sehat (>50%), status panen siap
  amber: "#FBBF24", // Peringatan stamina rendah, energi, reward harian
  bark: "#92400E", // Crafting, kayu/material mentah, workshop
  river: "#7DD3FC", // Fishing, deep sea, vivarium, elemen air
  danger: "#F87171", // Dungeon, world boss, duel, coliseum, HP kritis
};

/**
 * Material glassmorphism bertint hijau untuk panel survival.
 * Menggantikan surface-glass pink global di dalam domain survival saja.
 */
const survivalGlass = {
  surface: "rgba(134, 239, 172, 0.06)",
  hairline: "rgba(134, 239, 172, 0.2)",
};

/**
 * Skala rarity item untuk inventory, gacha, shop, crafting, dan drop dungeon.
 * Harus selalu sinkron dengan tabel "Skala Rarity Item" di DESIGN.md.
 */
const rarityColors = {
  common: "#9CA3AF",
  uncommon: "#86EFAC",
  rare: "#93C5FD",
  epic: "#C084FC",
  legendary: "#FFD700",
  mythic: "#F9A8D4",
};

/**
 * Mengambil warna survival berdasarkan nama token, dengan fallback aman ke
 * palet global lalu ke emerald sebagai aksen default Naura Wilds.
 * @param {string} name - Nama token (emerald, moss, amber, bark, river, danger)
 * @returns {string} Hex color
 */
function getColor(name) {
  if (name && Object.prototype.hasOwnProperty.call(survivalColors, name)) {
    return survivalColors[name];
  }
  return (name && colors[name]) || survivalColors.emerald;
}

/**
 * Mengambil warna pill badge rarity item secara case-insensitive.
 * Rarity tidak dikenal jatuh ke Common (abu netral) agar tidak pernah crash.
 * @param {string} rarity - common | uncommon | rare | epic | legendary | mythic
 * @returns {string} Hex color
 */
function getRarityColor(rarity) {
  const key = String(rarity || "")
    .trim()
    .toLowerCase();
  return rarityColors[key] || rarityColors.common;
}

/**
 * Threshold vital otomatis sesuai kontrak desain Naura Wilds:
 * - >50%  : moss (sehat)
 * - 20-50%: amber (waspada)
 * - <20%  : danger (kritis)
 * @param {number} percent - Persentase vital (0-100)
 * @returns {string} Hex color
 */
function getVitalColor(percent) {
  const safePercent = Number.isFinite(percent)
    ? Math.max(0, Math.min(100, percent))
    : 0;
  if (safePercent <= 20) {
    return survivalColors.danger;
  }
  if (safePercent <= 50) {
    return survivalColors.amber;
  }
  return survivalColors.moss;
}

/**
 * Membangun bar vital bertema Naura Wilds (HP/Stamina/Hunger/XP).
 * Mendelegasikan rendering bar ke uxHelper.buildGoalGradientBar() agar visual
 * progress konsisten dengan sistem UX psikologi bot, lalu menambahkan warna
 * threshold otomatis (moss/amber/danger).
 * @param {object} options
 * @param {number} [options.current=0] - Nilai vital saat ini
 * @param {number} [options.target=100] - Nilai vital maksimum
 * @param {number} [options.length=10] - Panjang bar karakter
 * @param {object|string} [options.user=null] - User/interaction untuk pesan penyemangat personal
 * @param {string} [options.lang='id'] - Bahasa pesan penyemangat
 * @returns {{ bar: string, customBar: string, percent: number, current: number, target: number, remaining: number, cheerMessage: string, color: string }}
 */
function buildVitalsBar({
  current = 0,
  target = 100,
  length = 10,
  user = null,
  lang = "id",
} = {}) {
  const result = buildGoalGradientBar({
    current,
    target,
    length,
    user,
    lang,
  });
  return {
    ...result,
    color: getVitalColor(result.percent),
  };
}

/**
 * Footer terpusat untuk seluruh respons survival.
 * Selalu delegasikan ke footer 'survival' dari palet global agar teks versi
 * tidak pernah ditulis manual di plugin.
 * @returns {string}
 */
function getFooter() {
  return footers.survival || footers.core || "Naura Hoshino";
}

/**
 * Memformat angka stat (HP, damage, saldo fragment) menjadi string lokal id-ID
 * dengan penjagaan terhadap nilai non-numerik.
 * @param {number|string} value
 * @returns {string}
 */
/**
 * Memformat angka stat (HP, damage, saldo fragment) menjadi string lokal id-ID
 * dengan penjagaan terhadap nilai non-numerik.
 * @param {number|string} value
 * @returns {string}
 */
function formatStat(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) {
    return "0";
  }
  return num.toLocaleString("id-ID");
}

/**
 * Membangun satu blok HUD mini vital untuk disisipkan di atas deskripsi respons survival.
 * Format: ❤️ HP [▰▰▰▱▱] 80/100 • ⚡ [▰▰▱▱▱] 50/100 • 🍖 [▰▰▰▱▱] 60/100 • 💧 [▰▰▰▰▱] 85/100
 *
 * @param {object} survival - Objek data UserSurvival
 * @param {object} [options]
 * @param {number} [options.customMaxHp] - Batas maksimal HP
 * @param {number} [options.barLength=5] - Panjang bar mini
 * @returns {string} Teks mini HUD
 */
function buildSurvivalHUD(
  survival,
  { customMaxHp = null, barLength = 5 } = {},
) {
  const maxHp = customMaxHp || 100 + Number(survival?.survival_level || 1) * 20;
  const hp = Math.min(maxHp, Number(survival?.hp ?? maxHp));
  const stamina = Number(survival?.stamina ?? 100);
  const hunger = Number(survival?.hunger ?? 100);
  const thirst = Number(survival?.thirst ?? 100);

  const hpBar = buildVitalsBar({
    current: hp,
    target: maxHp,
    length: barLength,
  }).bar;
  const staBar = buildVitalsBar({
    current: stamina,
    target: 100,
    length: barLength,
  }).bar;
  const hunBar = buildVitalsBar({
    current: hunger,
    target: 100,
    length: barLength,
  }).bar;
  const thiBar = buildVitalsBar({
    current: thirst,
    target: 100,
    length: barLength,
  }).bar;

  return `❤️ HP ${hpBar} \`${hp}/${maxHp}\` \u2022 ⚡ ${staBar} \`${stamina}%\` \u2022 🍖 ${hunBar} \`${hunger}%\` \u2022 💧 ${thiBar} \`${thirst}%\``;
}

/**
 * Membangun satu baris indikator waktu, hari, dan lokasi petualang.
 */
function buildTimeLocationLine(survival) {
  const day = survival?.inGameDay || 1;
  const hour = survival?.inGameHour || 6;
  const loc = String(survival?.currentLocation || "desa").toUpperCase();
  const timeEmoji = hour >= 6 && hour < 18 ? "☀️" : "🌙";

  return `${timeEmoji} **Hari ke-${day}**, pukul ${String(hour).padStart(2, "0")}:00 \u2022 📍 **${loc}**`;
}

/**
 * Membangun ActionRow berisi tombol aksi kontekstual untuk Naura Wilds.
 * Memungkinkan pemain melanjutkan siklus bermain hanya dengan mengklik tombol.
 *
 * @param {'gathering'|'combat'|'crafting'|'vitals'|'town'|'economy'|'profile'|'custom'} context
 * @param {string} userId - ID pemain pemilik sesi (anti-hijack)
 * @param {object} [options]
 * @param {Array<string>} [options.exclude=[]] - ID aksi yang tidak ingin disertakan
 * @param {Array<{id: string, label: string, emoji?: string, style?: ButtonStyle}>} [options.customButtons=[]]
 * @returns {ActionRowBuilder}
 */
function buildSurvivalActionRow(context, userId, { exclude = [], customButtons = [] } = {}) {
  const row = new ActionRowBuilder();

  if (Array.isArray(customButtons) && customButtons.length > 0) {
    for (const btn of customButtons.slice(0, 5)) {
      const button = new ButtonBuilder()
        .setCustomId(`survival_act_${btn.id}:${userId}`)
        .setLabel(btn.label)
        .setStyle(btn.style || ButtonStyle.Secondary);
      if (btn.emoji) button.setEmoji(btn.emoji);
      row.addComponents(button);
    }
    return row;
  }

  const defs = {
    gathering: [
      { id: "chop", label: "Tebang Lagi", emoji: "🌲", style: ButtonStyle.Success },
      { id: "mine", label: "Menambang", emoji: "⛏️", style: ButtonStyle.Secondary },
      { id: "fish", label: "Memancing", emoji: "🎣", style: ButtonStyle.Secondary },
      { id: "inventory", label: "Buka Ransel", emoji: "🎒", style: ButtonStyle.Primary },
      { id: "rest", label: "Rehat", emoji: "💤", style: ButtonStyle.Secondary },
    ],
    combat: [
      { id: "dungeon", label: "Jelajah Lagi", emoji: "🗡️", style: ButtonStyle.Danger },
      { id: "consume", label: "Pulihkan HP", emoji: "🍖", style: ButtonStyle.Success },
      { id: "inventory", label: "Ransel", emoji: "🎒", style: ButtonStyle.Primary },
      { id: "skill", label: "Keahlian", emoji: "⚡", style: ButtonStyle.Secondary },
      { id: "rest", label: "Klinik / Rehat", emoji: "🏥", style: ButtonStyle.Secondary },
    ],
    crafting: [
      { id: "craft", label: "Buat Lagi", emoji: "🔨", style: ButtonStyle.Success },
      { id: "inventory", label: "Isi Ransel", emoji: "🎒", style: ButtonStyle.Primary },
      { id: "shop", label: "Toko Bahan", emoji: "🛒", style: ButtonStyle.Secondary },
      { id: "dungeon", label: "Uji Senjata", emoji: "🗡️", style: ButtonStyle.Danger },
      { id: "info", label: "Status Diri", emoji: "👤", style: ButtonStyle.Secondary },
    ],
    vitals: [
      { id: "consume", label: "Makan Lagi", emoji: "🍖", style: ButtonStyle.Success },
      { id: "cafe", label: "Mampir Kafe", emoji: "☕", style: ButtonStyle.Primary },
      { id: "inventory", label: "Buka Ransel", emoji: "🎒", style: ButtonStyle.Secondary },
      { id: "collect", label: "Cari Bahan", emoji: "🧺", style: ButtonStyle.Secondary },
      { id: "rest", label: "Tidur Pulas", emoji: "💤", style: ButtonStyle.Secondary },
    ],
    town: [
      { id: "shop", label: "Toko Desa", emoji: "🛒", style: ButtonStyle.Primary },
      { id: "cafe", label: "Kafe Desa", emoji: "☕", style: ButtonStyle.Secondary },
      { id: "bank", label: "Bank Sentral", emoji: "🏦", style: ButtonStyle.Secondary },
      { id: "npc", label: "Sapa Warga", emoji: "👥", style: ButtonStyle.Secondary },
      { id: "travel", label: "Peta Wilayah", emoji: "🗺️", style: ButtonStyle.Secondary },
    ],
    economy: [
      { id: "work", label: "Cari Nafkah", emoji: "💼", style: ButtonStyle.Success },
      { id: "shop", label: "Toko Desa", emoji: "🛒", style: ButtonStyle.Primary },
      { id: "bank", label: "Bank Sentral", emoji: "🏦", style: ButtonStyle.Secondary },
      { id: "wallet", label: "Cek Dompet", emoji: "💰", style: ButtonStyle.Secondary },
      { id: "town", label: "Alun-Alun", emoji: "🏛️", style: ButtonStyle.Secondary },
    ],
    profile: [
      { id: "inventory", label: "Isi Ransel", emoji: "🎒", style: ButtonStyle.Success },
      { id: "shop", label: "Pasar Desa", emoji: "🛒", style: ButtonStyle.Primary },
      { id: "collect", label: "Kumpul Bahan", emoji: "🧺", style: ButtonStyle.Secondary },
      { id: "dungeon", label: "Gua Misteri", emoji: "🗡️", style: ButtonStyle.Danger },
      { id: "skill", label: "Pohon Keahlian", emoji: "⚡", style: ButtonStyle.Secondary },
    ],
  };

  const list = defs[context] || defs.gathering;
  const excludeSet = new Set(exclude);
  const items = list.filter((item) => !excludeSet.has(item.id)).slice(0, 5);

  for (const item of items) {
    const btn = new ButtonBuilder()
      .setCustomId(`survival_act_${item.id}:${userId}`)
      .setLabel(item.label)
      .setStyle(item.style);
    if (item.emoji) btn.setEmoji(item.emoji);
    row.addComponents(btn);
  }

  return row;
}

/**
 * Pola A: Status Dashboard Card (Components V2)
 * Digunakan untuk tampilan ringkasan status vital, progres level, dan kondisi lingkungan.
 *
 * @param {object} params
 * @param {object} params.user - Discord User objek
 * @param {object} params.survival - Data UserSurvival
 * @param {object} [params.profile] - Data UserProfile
 * @param {object} [params.pulseInfo] - Output dari worldPulseEngine.getWorldPulse()
 * @param {Array<string>} [params.activeBuffs=[]] - Daftar status buff aktif
 * @param {ActionRowBuilder|Array<ActionRowBuilder>} [params.buttonsRow]
 * @returns {object} Payload Components V2 siap kirim
 */
function buildStatusDashboardCard({
  user,
  survival,
  profile = null,
  pulseInfo = null,
  activeBuffs = [],
  buttonsRow = null,
} = {}) {
  const userId = user?.id || "0";
  const hud = buildSurvivalHUD(survival);
  const timeLoc = buildTimeLocationLine(survival);

  const level = survival?.survival_level || 1;
  const xp = survival?.survival_xp || 0;
  const nextXp = level * 100;
  const xpBar = buildVitalsBar({ current: xp, target: nextXp, length: 8 }).bar;

  const nsf = Number(survival?.starFragments || 0).toLocaleString("id-ID");
  const coupons = Number(survival?.coupons || 0).toLocaleString("id-ID");
  const walletNc = Number(profile?.economy_wallet || 0).toLocaleString("id-ID");

  const lines = [
    timeLoc,
    pulseInfo?.pulseHeader ? `> ${pulseInfo.pulseHeader}` : "",
    pulseInfo?.flavorText ? `-# 🍃 *${pulseInfo.flavorText}*` : "",
    "",
    "**Status Fisik & Vital:**",
    hud,
    "",
    "**Kemajuan Petualang:**",
    `> Level: **${level}** \u2022 XP: ${xpBar} \`${xp}/${nextXp}\``,
    "",
    "**Dompet & Simpanan:**",
    `> 🌟 **${nsf}** NSF \u2022 🎟️ **${coupons}** Kupon \u2022 🪙 **${walletNc}** NC`,
  ];

  if (Array.isArray(activeBuffs) && activeBuffs.length > 0) {
    lines.push("", "**Efek Aktif:**");
    for (const buff of activeBuffs.slice(0, 5)) {
      lines.push(`> ✨ ${buff}`);
    }
  }

  const cleanDescription = lines.filter((l) => l !== "").join("\n");
  const defaultButtons = buttonsRow
    ? (Array.isArray(buttonsRow) ? buttonsRow : [buttonsRow])
    : [buildSurvivalActionRow("profile", userId)];

  return buildContainerV2({
    accentColorHex: survivalColors.emerald,
    authorName: user?.displayName
      ? `${user.displayName} \u2022 Status Petualang`
      : "Naura Wilds \u2022 Status Petualang",
    title: "🌿 Naura Wilds: Dashboard Status Petualang",
    iconURL: typeof user?.displayAvatarURL === "function" ? user.displayAvatarURL() : null,
    expression: "info",
    description: cleanDescription,
    buttonsRow: defaultButtons,
    footerText: getFooter(),
  });
}

/**
 * Pola B: Action Result Card (Components V2)
 * Digunakan untuk hasil aksi gathering (chop, mine, fish, harvest) dengan penekanan drop dan cuaca.
 *
 * @param {object} params
 * @param {object} params.user - Discord User objek
 * @param {string} params.action - Nama aksi (chop, mine, fish, harvest)
 * @param {string} params.title - Judul kartu hasil
 * @param {string} params.description - Narasi hasil aksi
 * @param {Array<{id: string, name: string, amount: number, emoji?: string}>} [params.itemsGained=[]]
 * @param {string} [params.weatherBonus=""] - Catatan efek bonus cuaca
 * @param {string} [params.warning=""] - Peringatan vital/stamina
 * @param {ActionRowBuilder|Array<ActionRowBuilder>} [params.buttonsRow]
 * @returns {object} Payload Components V2 siap kirim
 */
function buildActionResultCard({
  user,
  action = "gathering",
  title = "Hasil Petualangan",
  description = "",
  itemsGained = [],
  weatherBonus = "",
  warning = "",
  buttonsRow = null,
} = {}) {
  const userId = user?.id || "0";
  const lines = [description];

  if (Array.isArray(itemsGained) && itemsGained.length > 0) {
    lines.push("", "**Hasil Perolehan:**");
    for (const it of itemsGained.slice(0, 5)) {
      const icon = it.emoji || "📦";
      lines.push(`> ${icon} **${it.name || it.id}** x${it.amount || 1}`);
    }
  }

  if (weatherBonus) {
    lines.push("", `> 🌤️ *${weatherBonus}*`);
  }

  if (warning) {
    lines.push("", warning);
  }

  const cleanDesc = lines.filter((l) => l !== "").join("\n");
  const defaultButtons = buttonsRow
    ? (Array.isArray(buttonsRow) ? buttonsRow : [buttonsRow])
    : [buildSurvivalActionRow("gathering", userId)];

  return buildContainerV2({
    accentColorHex: survivalColors.moss,
    authorName: `Naura Wilds \u2022 ${String(action).toUpperCase()}`,
    title,
    iconURL: typeof user?.displayAvatarURL === "function" ? user.displayAvatarURL() : null,
    expression: "reward",
    description: cleanDesc,
    buttonsRow: defaultButtons,
    footerText: getFooter(),
  });
}

/**
 * Pola C: Danger Zone Card (Components V2)
 * Digunakan untuk dungeon, abyss, boss, dan ancaman bertingkat tinggi.
 *
 * @param {object} params
 * @param {object} params.user - Discord User objek
 * @param {string} params.title - Judul zona bahaya
 * @param {string} params.description - Deskripsi ancaman
 * @param {string} [params.threatLevel="TINGGI"] - Tingkat ancaman (SEDANG, TINGGI, EKSTREM)
 * @param {string} [params.dangerWarning=""] - Pesan peringatan bahaya
 * @param {ActionRowBuilder|Array<ActionRowBuilder>} [params.buttonsRow]
 * @returns {object} Payload Components V2 siap kirim
 */
function buildDangerZoneCard({
  user,
  title = "Zona Bahaya Terdeteksi!",
  description = "",
  threatLevel = "TINGGI",
  dangerWarning = "",
  buttonsRow = null,
} = {}) {
  const userId = user?.id || "0";
  const lines = [
    `⚠️ **PERINGATAN TINGKAT ANCAMAN [${threatLevel.toUpperCase()}]**`,
    "",
    description,
  ];

  if (dangerWarning) {
    lines.push("", `> 💀 **Peringatan:** ${dangerWarning}`);
  }

  const cleanDesc = lines.filter((l) => l !== "").join("\n");
  const defaultButtons = buttonsRow
    ? (Array.isArray(buttonsRow) ? buttonsRow : [buttonsRow])
    : [buildSurvivalActionRow("combat", userId)];

  return buildContainerV2({
    accentColorHex: survivalColors.danger,
    authorName: `Naura Wilds \u2022 ZONA BAHAYA [${threatLevel.toUpperCase()}]`,
    title,
    iconURL: typeof user?.displayAvatarURL === "function" ? user.displayAvatarURL() : null,
    expression: "alert",
    description: cleanDesc,
    buttonsRow: defaultButtons,
    footerText: getFooter(),
  });
}

module.exports = {
  survivalColors,
  survivalGlass,
  rarityColors,
  getColor,
  getRarityColor,
  getVitalColor,
  buildVitalsBar,
  getFooter,
  formatStat,
  buildSurvivalHUD,
  buildTimeLocationLine,
  buildSurvivalActionRow,
  buildStatusDashboardCard,
  buildActionResultCard,
  buildDangerZoneCard,
};
