"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, StringSelectMenuBuilder } = require("discord.js");
const cacheManager = require("../../managers/cacheManager");
const UserSurvival = require("../../models/UserSurvival");
const { addItemsAtomic, safeParseInventory } = require("./inventoryHelper");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

const STARTER_FLAG = "survival_started";

const ARCHETYPES = {
  farmer: {
    id: "farmer",
    name: "Petani Hijau (Agronomist)",
    emoji: "🌾",
    description: "Spesialis perkebunan dan peternakan dengan bonus bibit unggul",
    bonusItems: [
      { id: "seed_wheat", name: "Benih Gandum Unggul", amount: 5, icon: "🌾", note: "Bibit cepat tumbuh" },
      { id: "fertilizer", name: "Pupuk Organik", amount: 2, icon: "🧪", note: "Mempercepat panen" },
    ],
  },
  miner: {
    id: "miner",
    name: "Penambang Gua (Excavator)",
    emoji: "⛏️",
    description: "Ahli geologi dan mineral dengan ketahanan alat ekstra",
    bonusItems: [
      { id: "copper_ore", name: "Bijih Tembaga", amount: 5, icon: "🪨", note: "Bahan tempa awal" },
      { id: "bandage", name: "Perban Medis", amount: 2, icon: "🩹", note: "Penyembuh luka darurat" },
    ],
  },
  warrior: {
    id: "warrior",
    name: "Pendekar Tempur (Vanguard)",
    emoji: "⚔️",
    description: "Petarung garis depan yang siap menjelajah The Neo-Abyss",
    bonusItems: [
      { id: "energy_drink", name: "Minuman Isotonik", amount: 2, icon: "🥤", note: "Pemulih stamina tempur" },
      { id: "monster_lure", name: "Umpan Monster", amount: 1, icon: "🍖", note: "Penarik buruan langka" },
    ],
  },
};

const BASE_STARTER_KIT = [
  { id: STARTER_FLAG, name: "Surat Pendaftaran", amount: 1, icon: "📜", note: "Bukti kamu resmi jadi warga" },
  { id: "wooden_axe", name: "Kapak Kayu (Lv. 1)", amount: 1, icon: "🪓", note: "Buat menebang pohon di hutan" },
  { id: "wooden_pickaxe", name: "Beliung Kayu (Lv. 1)", amount: 1, icon: "⛏️", note: "Buat menambang batu di gua" },
  { id: "wooden_sword", name: "Pedang Kayu (Lv. 1)", amount: 1, icon: "🗡️", note: "Senjata latihan pertamamu" },
  { id: "apple", name: "Apel Segar", amount: 3, icon: "🍎", note: "Camilan pemulih lapar" },
  { id: "mineral_water", name: "Air Mineral", amount: 3, icon: "💧", note: "Pelepas dahaga di perjalanan" },
];

/**
 * Menyusun respons Container V2 onboarding interaktif untuk petualang baru.
 * @param {import('discord.js').User} user
 * @param {string} [lang='id']
 * @returns {object}
 */
function renderOnboardingPrompt(user, lang = "id") {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("sel_onboard_archetype")
    .setPlaceholder("Pilih Jalur Keahlian Awal Petualangan...")
    .addOptions(
      Object.values(ARCHETYPES).map((arch) => ({
        label: arch.name,
        value: arch.id,
        description: arch.description,
        emoji: arch.emoji,
      })),
    );

  const selectRow = new ActionRowBuilder().addComponents(selectMenu);

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("btn_onboard_claim_default")
      .setLabel("🎒 Klaim Starter Kit (Umum)")
      .setStyle(ButtonStyle.Success),
    new ButtonBuilder()
      .setCustomId("btn_onboard_guide")
      .setLabel("📖 Panduan Singkat")
      .setStyle(ButtonStyle.Secondary),
  );

  return buildContainerV2({
    accentColorHex: "#10B981",
    authorName: "NAURA WILDS ONBOARDING",
    title: "🌲 Selamat Datang di Dunia Survival!",
    iconURL: user.displayAvatarURL(),
    description: [
      `Halo Kak **${user.username}**! Kakak belum terdaftar sebagai petualang aktif di Naura Wilds.`,
      "",
      "Sebelum mulai menjelajah, silakan pilih **Jalur Keahlian Awal** untuk mendapatkan paket bekal petualang pertama Kakak:",
      "• 🌾 **Petani Hijau**: Bonus benih gandum & pupuk organik.",
      "• ⛏️ **Penambang Gua**: Bonus bijih temaga & perban darurat.",
      "• ⚔️ **Pendekar Tempur**: Bonus minuman isotonik & umpan monster.",
      "",
      "- # *Atau langsung klik tombol di bawah untuk klaim starter pack standar.*",
    ].join("\n"),
    selectMenu: selectRow,
    buttonsRow: buttonRow,
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Memproses klaim starter kit beserta bonus arketipe secara atomik.
 * @param {string} userId
 * @param {string} [archetypeKey='farmer']
 * @returns {Promise<{success: boolean, message: string, archetype?: object, items?: Array}>}
 */
async function claimOnboardingKit(userId, archetypeKey = "farmer") {
  if (!userId) return { success: false, message: "User ID diperlukan." };

  const profile = await cacheManager.getUserProfile(userId);
  const inventory = safeParseInventory(profile.inventory);

  if (inventory.some((item) => item?.id === STARTER_FLAG)) {
    return {
      success: false,
      message: "Kakak sudah pernah mengambil Starter Kit sebelumnya!",
    };
  }

  const selectedArch = ARCHETYPES[archetypeKey] || ARCHETYPES.farmer;
  const fullKit = [...BASE_STARTER_KIT, ...selectedArch.bonusItems];

  await addItemsAtomic(userId, fullKit);
  await UserSurvival.findOrCreate({ where: { userId } });

  // Update profil dengan spesialisasi awal
  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
    state.archetype = selectedArch.id;
    state.onboardingCompletedAt = new Date();
    return state;
  });

  return {
    success: true,
    message: `Selamat! Kakak resmi memulai petualangan sebagai **${selectedArch.name}**!`,
    archetype: selectedArch,
    items: fullKit,
  };
}

module.exports = {
  ARCHETYPES,
  BASE_STARTER_KIT,
  renderOnboardingPrompt,
  claimOnboardingKit,
};
