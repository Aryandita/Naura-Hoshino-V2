"use strict";

/**
 * @module abyss
 * @description Subcommand /survival abyss - Labirin Rogue-lite Prosedural 50 Lantai (The Neo-Abyss)
 * 
 * Fitur Utama:
 * - Memulai ekspedisi labirin prosedural dengan opsi taruhan wager
 * - Memilih jalur ruangan (3 pilihan) di setiap lantai
 * - Sistem HP, ATK, dan Relic collection
 * - Mekanisme keluar aman (leave) untuk mengamankan jarahan
 * - Kemenangan total setelah menaklukkan 50 lantai
 * - Button collector untuk interaksi real-time
 * 
 * @requires discord.js
 * @requires ../../../src/utils/NauraContainerBuilder
 * @requires ../../../src/utils/survivalUIHelper
 * @requires ../../../src/config/ui
 * @requires ../../../src/survival/engines/abyssEngine
 */

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ComponentType,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
  disableContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const ui = require("../../../src/config/ui");
const abyssEngine = require("../../../src/survival/engines/abyssEngine");

// ============================================================================
// KONSTANTA
// ============================================================================

/** @const {number} COLLECTOR_TIMEOUT_MS - Waktu timeout collector dalam milidetik */
const COLLECTOR_TIMEOUT_MS = 60000;

/** @const {number} MAX_FLOORS - Jumlah maksimum lantai di Neo-Abyss */
const MAX_FLOORS = 50;

/** @const {number} VICTORY_BONUS_COINS - Bonus koin saat mencapai kemenangan total */
const VICTORY_BONUS_COINS = 1000;

/** @const {string} BTN_PREFIX - Prefix untuk custom ID tombol abyss */
const BTN_PREFIX = "abyss_btn_";

/** @const {Object} BUTTON_IDS - Daftar custom ID untuk tombol */
const BUTTON_IDS = {
  CHOICE_1: `${BTN_PREFIX}1`,
  CHOICE_2: `${BTN_PREFIX}2`,
  CHOICE_3: `${BTN_PREFIX}3`,
  LEAVE: `${BTN_PREFIX}leave`,
};

/** @const {Object} RUN_STATUS - Status ekspedisi labirin */
const RUN_STATUS = {
  DEFEATED: "DEFEATED",
  VICTORY: "VICTORY",
};

/** @const {Object} ACTIONS - Aksi yang tersedia untuk subcommand */
const ACTIONS = {
  LEAVE: "leave",
  START: "start",
  ROOM_PREFIX: "room_",
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Membuat baris tombol untuk pilihan ruangan dan keluar
 * @returns {ActionRowBuilder} Baris komponen Discord dengan 4 tombol
 */
function buildAbyssButtonsRow() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CHOICE_1)
      .setLabel("🚪 Pilihan 1")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CHOICE_2)
      .setLabel("🚪 Pilihan 2")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.CHOICE_3)
      .setLabel("🚪 Pilihan 3")
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(BUTTON_IDS.LEAVE)
      .setLabel("🏁 Keluar")
      .setStyle(ButtonStyle.Danger),
  );
}

/**
 * Format teks hasil taruhan wager jika ada
 * @param {Object} result - Hasil dari finishRun atau data run
 * @param {number} result.wagerPayout - Pembayaran taruhan
 * @param {number} result.wagerMultiplier - Multiplier taruhan
 * @param {number} result.wager - Modal taruhan awal
 * @returns {string} Teks formatted atau string kosong
 */
function formatWagerResult(result) {
  if (!result.wagerPayout || result.wagerPayout <= 0) return "";
  return `🔥 **Hasil Taruhan Wager (${result.wagerMultiplier}x):** \`+${result.wagerPayout.toLocaleString("id-ID")} SC\` (Modal: ${result.wager.toLocaleString("id-ID")} SC)`;
}

/**
 * Format daftar pilihan ruangan
 * @param {Array<Object>} choices - Array pilihan ruangan
 * @returns {string} Teks formatted daftar pilihan
 */
function formatRoomChoices(choices) {
  return choices
    .map((c, idx) => `**Pilihan ${idx + 1}:** ${c.label}`)
    .join("\n");
}

/**
 * Format daftar relic aktif
 * @param {Array<string>} relics - Array nama relic
 * @returns {string} Teks formatted relic atau placeholder
 */
function formatRelics(relics) {
  if (!relics || relics.length === 0) return "*Belum ada Relic*";
  return relics.map((r) => `\`${r}\``).join(", ");
}

/**
 * Mendapatkan index pilihan dari custom ID tombol
 * @param {string} customId - Custom ID tombol yang ditekan
 * @returns {number} Index pilihan (0-2)
 */
function getChoiceIndexFromButton(customId) {
  if (customId === BUTTON_IDS.CHOICE_2) return 1;
  if (customId === BUTTON_IDS.CHOICE_3) return 2;
  return 0;
}

// ============================================================================
// HANDLER UTAMA
// ============================================================================

module.exports = {
  name: "abyss",
  description:
    "🌀 Jelajahi Labirin Rogue-lite Prosedural 50 Lantai (The Neo-Abyss)",

  /**
   * Eksekusi subcommand abyss
   * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
   * @returns {Promise<void>}
   */
  async execute(interaction) {
    const action = interaction.options.getString("aksi") || ACTIONS.START;
    const wager = interaction.options.getInteger("taruhan") || 0;
    const userId = interaction.user.id;

    // Handle leave action
    if (action === ACTIONS.LEAVE) {
      return handleLeave(interaction, userId);
    }

    // Get or start run
    let run = await abyssEngine.getRun(userId);
    let outcomeText = "";

    if (!run || run.status === RUN_STATUS.DEFEATED || run.status === RUN_STATUS.VICTORY) {
      const startResult = await handleStartRun(interaction, userId, wager);
      if (!startResult.success) return;
      run = startResult.run;
      outcomeText = startResult.outcomeText;
    } else if (action.startsWith(ACTIONS.ROOM_PREFIX)) {
      const choiceIdx = parseInt(action.replace(ACTIONS.ROOM_PREFIX, ""), 10) - 1;
      const processRes = await abyssEngine.chooseRoom(userId, choiceIdx);
      run = processRes.run;
      outcomeText = processRes.outcome.log;
    }

    // Handle terminal states
    if (run.status === RUN_STATUS.DEFEATED) {
      return handleDefeat(interaction, run, outcomeText);
    }

    if (run.status === RUN_STATUS.VICTORY) {
      return handleVictory(interaction, run, outcomeText);
    }

    // Display active room selection
    await displayRoomSelection(interaction, run, outcomeText, userId);
  },
};

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Handle aksi keluar dari labirin
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleLeave(interaction, userId) {
  const leaveRes = await abyssEngine.finishRun(userId);
  
  if (!leaveRes.success) {
    return interaction.editReply({
      ...buildErrorContainerV2({
        title: "Tidak Ada Ekspedisi",
        description: "Kamu sedang tidak berada di dalam labirin The Neo-Abyss.",
        footerText: ui.getFooter("survival"),
      }),
    });
  }

  const wagerNote = formatWagerResult(leaveRes);

  const descriptionLines = [
    "Kamu telah memutuskan untuk keluar dan mengamankan seluruh jarahanmu!",
    "",
    `🏰 **Lantai Tertinggi Ditaklukkan:** \`Lantai ${leaveRes.floorsCleared}\``,
    `🎁 **Total Relic Dikumpulkan:** \`${leaveRes.relicsGained} Relic\``,
    `💰 **Total Koin Diamankan:** \`+${leaveRes.totalCoins.toLocaleString("id-ID")} SC\``,
  ];
  if (wagerNote) descriptionLines.push(wagerNote);

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("emerald"),
    authorName: "🏁 Pintu Keluar The Neo-Abyss",
    title: "✨ Ekspedisi Berhasil Diselesaikan!",
    description: descriptionLines.join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", userId)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle memulai run baru
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @param {number} wager - Jumlah taruhan
 * @returns {Promise<{success: boolean, run?: Object, outcomeText?: string}>}
 */
async function handleStartRun(interaction, userId, wager) {
  const startRes = await abyssEngine.startRun(userId, {}, wager);
  
  if (startRes && startRes.success === false && startRes.reason === "INSUFFICIENT_FUNDS") {
    await interaction.editReply({
      ...buildErrorContainerV2({
        title: "Saldo SC Tidak Mencukupi",
        description: `Kamu membutuhkan minimal **${wager.toLocaleString("id-ID")} SC** untuk memasang taruhan ekspedisi ini (Saldo saat ini: ${startRes.currentNsf.toLocaleString("id-ID")} SC).`,
        footerText: ui.getFooter("survival"),
      }),
    });
    return { success: false };
  }

  const outcomeText = wager > 0
    ? `🔥 *Kamu memasang taruhan High-Risk sebesar **${wager.toLocaleString("id-ID")} SC** dan melangkah masuk ke gerbang The Neo-Abyss Lantai 1!*`
    : "🚀 *Kamu melangkah masuk ke dalam gerbang dimensi The Neo-Abyss Lantai 1!*";

  return { success: true, run: startRes, outcomeText };
}

/**
 * Handle kekalahan di labirin
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} run - Data run saat kalah
 * @param {string} outcomeText - Teks log outcome terakhir
 * @returns {Promise<void>}
 */
async function handleDefeat(interaction, run, outcomeText) {
  const payload = buildContainerV2({
    accentColorHex: survivalUI.getColor("danger"),
    authorName: "☠️ Ekspedisi Berakhir Tragis",
    title: "Kamu Gugur di Dalam Labirin!",
    description: [
      outcomeText,
      "",
      `🏰 **Lantai Terakhir:** \`Lantai ${run.currentFloor}\``,
      `💰 **Koin yang Hilang:** \`${run.fragmentsCollected} ⭐\``,
      "",
      `-# 💡 *Tingkatkan level karakter dan persenjataanmu sebelum menantang The Neo-Abyss kembali!*`,
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Handle kemenangan total (50 lantai)
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} run - Data run saat menang
 * @param {string} outcomeText - Teks log outcome terakhir
 * @returns {Promise<void>}
 */
async function handleVictory(interaction, run, outcomeText) {
  const totalCoins = run.fragmentsCollected + VICTORY_BONUS_COINS;
  
  const payload = buildContainerV2({
    accentColorHex: survivalUI.getRarityColor("legendary"),
    authorName: "👑 Penakluk Legendaris Neo-Abyss",
    title: `🎉 KEMENANGAN TOTAL! ${MAX_FLOORS} LANTAI DITAKLUKKAN!`,
    description: [
      outcomeText,
      "",
      `💰 **Total Koin Masuk Tas:** \`+${totalCoins.toLocaleString("id-ID")} SC\``,
      "🏆 Gelar kehormatan dan hadiah musim telah berhasil diklaim!",
    ].join("\n"),
    buttonsRow: [survivalUI.buildSurvivalActionRow("combat", interaction.user.id)],
    footerText: ui.getFooter("survival"),
  });

  return interaction.editReply(payload);
}

/**
 * Tampilkan UI pemilihan ruangan aktif dengan button collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {Object} run - Data run aktif
 * @param {string} outcomeText - Teks log outcome terakhir
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function displayRoomSelection(interaction, run, outcomeText, userId) {
  const choicesDesc = formatRoomChoices(run.availableChoices);
  const relicsDesc = formatRelics(run.relics);
  const buttonsRow = buildAbyssButtonsRow();

  const wagerMultiplier = abyssEngine.calculateWagerMultiplier(
    Math.max(0, run.currentFloor - 1),
  );
  
  const wagerDesc = run.wager > 0
    ? `🔥 **Taruhan Wager:** \`${run.wager.toLocaleString("id-ID")} SC\` (Multiplier: \`${wagerMultiplier}x\`)\n`
    : "";

  const authorName = run.wager > 0
    ? `🌀 The Neo-Abyss · Lantai ${run.currentFloor} / ${MAX_FLOORS} (Taruhan: ${run.wager.toLocaleString("id-ID")} SC)`
    : `🌀 The Neo-Abyss · Lantai ${run.currentFloor} / ${MAX_FLOORS}`;

  const payload = buildContainerV2({
    accentColorHex: survivalUI.getRarityColor("epic"),
    authorName,
    title: `❤️ HP: ${run.currentHp}/${run.maxHp}  |  ⚔️ ATK: ${run.attackPower}  |  💰 ${run.fragmentsCollected} ⭐`,
    description: [
      outcomeText ? `${outcomeText}\n` : "",
      wagerDesc,
      "🧭 **PILIH JALUR RUANGAN BERIKUTNYA:**",
      choicesDesc,
      "",
      `🎁 **Relic Aktif:** ${relicsDesc}`,
      "",
      "-# 💡 *Tekan tombol di bawah untuk memilih pintu ruangan yang ingin kamu masuki!*",
    ].join("\n"),
    footerText: ui.getFooter("survival"),
    buttonsRow,
  });

  const msg = await interaction.editReply(payload);

  // Setup button collector
  const collector = msg.createMessageComponentCollector({
    componentType: ComponentType.Button,
    time: COLLECTOR_TIMEOUT_MS,
  });

  collector.on("collect", async (btnInteraction) => {
    if (btnInteraction.user.id !== userId) {
      return btnInteraction.reply({
        content: "❌ Ini bukan ekspedisi labirin milikmu!",
        flags: MessageFlags.Ephemeral,
      });
    }

    await btnInteraction.deferUpdate();

    // Handle leave button
    if (btnInteraction.customId === BUTTON_IDS.LEAVE) {
      return handleCollectorLeave(interaction, userId);
    }

    // Handle room choice buttons
    const choiceIdx = getChoiceIndexFromButton(btnInteraction.customId);
    return handleCollectorRoomChoice(interaction, userId, choiceIdx);
  });

  collector.on("end", async (collected, reason) => {
    if (reason === "navigated") return;
    await interaction.editReply(disableContainerV2(payload)).catch(() => {});
  });
}

/**
 * Handle tombol keluar dari collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @returns {Promise<void>}
 */
async function handleCollectorLeave(interaction, userId) {
  const leaveRes = await abyssEngine.finishRun(userId);
  const wagerBonusText = leaveRes.wagerPayout > 0
    ? `\n🔥 **Hasil Taruhan Wager (${leaveRes.wagerMultiplier}x):** +${leaveRes.wagerPayout.toLocaleString("id-ID")} SC!`
    : "";

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: survivalUI.getColor("emerald"),
      title: "✨ Ekspedisi Berhasil Diselesaikan!",
      description: `Kamu berhasil mengamankan **+${leaveRes.totalCoins.toLocaleString("id-ID")} Sukamaju Koin (SC)**!${wagerBonusText}`,
      buttonsRow: [survivalUI.buildSurvivalActionRow("combat", userId)],
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}

/**
 * Handle tombol pilihan ruangan dari collector
 * @param {import('discord.js').ChatInputCommandInteraction} interaction - Interaksi Discord
 * @param {string} userId - ID pengguna
 * @param {number} choiceIdx - Index pilihan ruangan (0-2)
 * @returns {Promise<void>}
 */
async function handleCollectorRoomChoice(interaction, userId, choiceIdx) {
  const processRes = await abyssEngine.chooseRoom(userId, choiceIdx);
  const nextRun = processRes.run;

  const accentColor = nextRun.status === RUN_STATUS.DEFEATED
    ? survivalUI.getColor("danger")
    : survivalUI.getRarityColor("epic");

  return interaction.followUp({
    ...buildContainerV2({
      accentColorHex: accentColor,
      title: `Lantai ${nextRun.currentFloor} / ${MAX_FLOORS} (HP: ${nextRun.currentHp}/${nextRun.maxHp})`,
      description: processRes.outcome.log,
      footerText: ui.getFooter("survival"),
    }),
    flags: MessageFlags.Ephemeral,
  });
}
