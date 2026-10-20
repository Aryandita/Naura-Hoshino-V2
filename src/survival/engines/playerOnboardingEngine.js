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

const STARTING_LOCATIONS = {
  balai_desa: {
    id: "balai_desa",
    name: "Balai Desa Sukamaju",
    title: "Pusat Warga & Lembah Asri",
    emoji: "🏛️",
    description: "Kawasan pemukiman yang ramah, dekat dengan Kades Tirto dan pasar sayur.",
  },
  tambang_gua: {
    id: "tambang_gua",
    name: "Lereng Gua Tambang",
    title: "Bukit Mineral & Perapian Tempa",
    emoji: "⛏️",
    description: "Perbukitan berbatu dekat bengkel pandai besi Bagas dan mulut tambang bijih.",
  },
  hutan_pinus: {
    id: "hutan_pinus",
    name: "Pos Hutan Pinus",
    title: "Tepian Rimba & Sarang Satwa",
    emoji: "🌲",
    description: "Pondok pengawas di tengah semilir angin hutan, dekat rute jelajah monster liar.",
  },
};

const QUIZ_STEPS = [
  {
    step: 1,
    title: "🔮 Pertanyaan 1 dari 3: Panggilan Jiwa",
    question: "Saat kabut pagi tersibak di gerbang Naura Wilds, hal pertama apa yang memanggil hatimu?",
    options: [
      { id: "farmer", label: "Hamparan tanah subur & semerbak bunga", emoji: "🌾" },
      { id: "miner", label: "Kilau batu permata di celah tebing terjal", emoji: "⛏️" },
      { id: "warrior", label: "Gema auman monster di kejauhan rimba", emoji: "⚔️" },
    ],
  },
  {
    step: 2,
    title: "⚔️ Pertanyaan 2 dari 3: Taktik Bertahan",
    question: "Tiba-tiba seekor monster liar menghadang jalan setapakmu! Bagaimana caramu menghadapinya?",
    options: [
      { id: "farmer", label: "Beri pakan buah segar agar ia tenang dan jinak", emoji: "🍎" },
      { id: "miner", label: "Gunakan beliung memecah batu untuk menjebaknya", emoji: "🪨" },
      { id: "warrior", label: "Cabut pedang kayu dan hadapi langsung dari depan", emoji: "🗡️" },
    ],
  },
  {
    step: 3,
    title: "🏕️ Pertanyaan 3 dari 3: Lokasi Kemah Pertama",
    question: "Di sudut manakah kamu ingin mendirikan tenda dan memulai kisah barumu malam ini?",
    options: [
      { id: "balai_desa", label: "Dekat Balai Desa Sukamaju (Hangat & Ramah)", emoji: "🏛️" },
      { id: "tambang_gua", label: "Di Lereng Gua Tambang (Kaya Bijih Mineral)", emoji: "⛏️" },
      { id: "hutan_pinus", label: "Di Tepi Hutan Pinus (Penuh Petualangan)", emoji: "🌲" },
    ],
  },
];

function evaluateQuizAnswers(answers = {}) {
  const q1 = answers[1] || "farmer";
  const q2 = answers[2] || "farmer";
  const q3 = answers[3] || "balai_desa";

  // Hitung kecenderungan arketipe
  const scores = { farmer: 0, miner: 0, warrior: 0 };
  scores[q1] = (scores[q1] || 0) + 1;
  scores[q2] = (scores[q2] || 0) + 1;

  let chosenArchetype = "farmer";
  let maxScore = -1;
  for (const [key, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      chosenArchetype = key;
    }
  }

  const chosenLocation = STARTING_LOCATIONS[q3] ? q3 : "balai_desa";

  return {
    archetypeKey: chosenArchetype,
    locationKey: chosenLocation,
  };
}

/**
 * Menyusun respons Container V2 onboarding interaktif untuk petualang baru.
 * @param {import('discord.js').User} user
 * @param {string} [lang='id']
 * @returns {object}
 */
function renderOnboardingPrompt(user, lang = "id") {
  const selectMenu = new StringSelectMenuBuilder()
    .setCustomId("sel_onboard_archetype")
    .setPlaceholder("Atau pilih langsung Jalur Keahlian Awal...")
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
      .setCustomId("btn_onboard_quiz_1")
      .setLabel("🔮 Mulai Kuis Takdir (Cerita)")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId("btn_onboard_claim_default")
      .setLabel("🎒 Klaim Cepat Starter Kit")
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
      `Halo Kak **${user.username}**! Naura senang sekali menyambut kedatanganmu di gerbang Naura Wilds.`,
      "",
      "Sebelum mulai menjelajah, mari temukan takdir petualangmu melalui **Kuis Cerita Takdir** bersama Naura:",
      "• 🌾 **Petani Hijau**: Keahlian ladang, bonus benih unggul & pupuk organik.",
      "• ⛏️ **Penambang Gua**: Keahlian geologi, bonus bijih tembaga & perban darurat.",
      "• ⚔️ **Pendekar Tempur**: Keahlian perang, bonus isotonik & umpan monster.",
      "",
      "- # *Klik tombol 'Mulai Kuis Takdir' untuk dipandu Naura, atau pilih arketipe langsung di bawah.*",
    ].join("\n"),
    selectMenu: selectRow,
    buttonsRow: [buttonRow],
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Render satu langkah pertanyaan kuis naratif.
 * @param {import('discord.js').User} user
 * @param {number} stepNumber
 * @param {object} answersSoFar
 * @returns {object}
 */
function renderQuizStep(user, stepNumber, answersSoFar = {}) {
  const stepIdx = Math.max(1, Math.min(QUIZ_STEPS.length, stepNumber));
  const stepData = QUIZ_STEPS[stepIdx - 1];

  const buttons = stepData.options.map((opt) => {
    // encode pilihan jawaban ke customId: btn_onboard_ans_<step>_<optId>
    return new ButtonBuilder()
      .setCustomId(`btn_onboard_ans_${stepIdx}_${opt.id}`)
      .setLabel(opt.label)
      .setEmoji(opt.emoji)
      .setStyle(ButtonStyle.Primary);
  });

  const buttonRows = [];
  while (buttons.length > 0) {
    buttonRows.push(new ActionRowBuilder().addComponents(buttons.splice(0, 3)));
  }

  // Tambahkan tombol batal/reset
  buttonRows.push(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("btn_onboard_cancel")
        .setLabel("Kembali ke Awal")
        .setStyle(ButtonStyle.Secondary),
    ),
  );

  const progressDots = QUIZ_STEPS.map((s, idx) => (idx + 1 === stepIdx ? "🟢" : idx + 1 < stepIdx ? "✅" : "⚪")).join(" ");

  return buildContainerV2({
    accentColorHex: "#38BDF8",
    authorName: `KUIS TAKDIR PETUALANG • Langkah ${stepIdx} dari ${QUIZ_STEPS.length}`,
    title: stepData.title,
    iconURL: user.displayAvatarURL(),
    description: [
      `Progres Kuis: ${progressDots}`,
      "",
      `*"${stepData.question}"*`,
      "",
      "Pilih salah satu tanggapan di bawah yang paling mencerminkan kata hatimu:",
    ].join("\n"),
    buttonsRow: buttonRows,
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Render hasil evaluasi kuis naratif dan rekomendasi takdir dari Naura.
 * @param {import('discord.js').User} user
 * @param {object} answers
 * @returns {object}
 */
function renderQuizVerdict(user, answers = {}) {
  const { archetypeKey, locationKey } = evaluateQuizAnswers(answers);
  const archetype = ARCHETYPES[archetypeKey] || ARCHETYPES.farmer;
  const location = STARTING_LOCATIONS[locationKey] || STARTING_LOCATIONS.balai_desa;

  const bonusLines = archetype.bonusItems
    .map((item) => `• ${item.icon} **${item.name}** ×${item.amount} : *${item.note}*`)
    .join("\n");

  const buttonRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`btn_onboard_confirm_${archetypeKey}_${locationKey}`)
      .setLabel(`Klaim Takdir ${archetype.name}`)
      .setStyle(ButtonStyle.Success)
      .setEmoji("✨"),
    new ButtonBuilder()
      .setCustomId("btn_onboard_quiz_1")
      .setLabel("Ulangi Kuis")
      .setStyle(ButtonStyle.Secondary)
      .setEmoji("🔄"),
  );

  return buildContainerV2({
    accentColorHex: "#A855F7",
    authorName: "NAURA WILDS • Hasil Pembacaan Bintang",
    title: `✨ Takdir Terungkap: Jiwa ${archetype.name}!`,
    iconURL: user.displayAvatarURL(),
    description: [
      `Naura telah membaca kata hatimu, Kak **${user.username}**!`,
      "",
      `🌟 **Jalur Karakter:** ${archetype.emoji} **${archetype.name}**`,
      `> ${archetype.description}`,
      "",
      `📍 **Lokasi Awal Muncul:** ${location.emoji} **${location.name}** (${location.title})`,
      `> *${location.description}*`,
      "",
      "**🎁 Paket Bekal Petualang Khususmu:**",
      bonusLines,
      "• 📜 **Surat Pendaftaran Warga Resmi**",
      "• 🪓 Kapak Kayu, ⛏️ Beliung Kayu, 🗡️ Pedang Kayu, 🍎 3x Apel, 💧 3x Air Mineral",
      "",
      "Klik tombol di bawah untuk mengesahkan pendaftaran dan menerima seluruh bekalmu!",
    ].join("\n"),
    buttonsRow: [buttonRow],
    footerText: ui.getFooter("survival"),
  });
}

/**
 * Memproses klaim starter kit beserta bonus arketipe dan lokasi awal secara atomik.
 * @param {string} userId
 * @param {string} [archetypeKey='farmer']
 * @param {string} [startingLocation='balai_desa']
 * @returns {Promise<{success: boolean, message: string, archetype?: object, location?: object, items?: Array}>}
 */
async function claimOnboardingKit(userId, archetypeKey = "farmer", startingLocation = "balai_desa") {
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
  const selectedLoc = STARTING_LOCATIONS[startingLocation] || STARTING_LOCATIONS.balai_desa;
  const fullKit = [...BASE_STARTER_KIT, ...selectedArch.bonusItems];

  await addItemsAtomic(userId, fullKit);

  const [survivalRecord] = await UserSurvival.findOrCreate({
    where: { userId },
    defaults: {
      userId,
      currentLocation: selectedLoc.id,
      propertyId: "jalanan",
    },
  });

  if (survivalRecord.currentLocation !== selectedLoc.id) {
    await cacheManager.updateUserSurvival(userId, { currentLocation: selectedLoc.id });
  }

  // Update profil dengan spesialisasi dan lokasi awal
  await cacheManager.mutateUserProfileJson(userId, "rpg_state", (state) => {
    state.archetype = selectedArch.id;
    state.startingLocation = selectedLoc.id;
    state.onboardingCompletedAt = new Date();
    return state;
  });

  return {
    success: true,
    message: `Selamat! Kakak resmi memulai petualangan sebagai **${selectedArch.name}** di **${selectedLoc.name}**!`,
    archetype: selectedArch,
    location: selectedLoc,
    items: fullKit,
  };
}

module.exports = {
  ARCHETYPES,
  BASE_STARTER_KIT,
  STARTING_LOCATIONS,
  QUIZ_STEPS,
  evaluateQuizAnswers,
  renderOnboardingPrompt,
  renderQuizStep,
  renderQuizVerdict,
  claimOnboardingKit,
};
