"use strict";

/**
 * @module rest
 * @description Subcommand /survival rest - Sistem istirahat dan tidur untuk memulihkan vitalitas pemain.
 * 
 * Fitur Utama:
 * - Tidur malam (8 jam) dengan regenerasi berdasarkan kualitas properti
 * - Rehat siang (power nap 2 jam) dengan pemulihan terbatas
 * - Bonus dekorasi tempat tidur meningkatkan kualitas istirahat
 * - Drainase lapar/haus selama periode istirahat
 * - Integrasi quest progress dan energy reset tracker
 * - UI Components V2 dengan vitals bar real-time
 * 
 * Mekanik Regenerasi:
 * - Base regen ditentukan oleh tipe properti (jalanan=50, mansion=100)
 * - Dekorasi premium menambah bonus stamina recovery
 * - HP pulih sebesar 50% dari stamina yang dipulihkan
 * - Lapar/haus berkurang lebih sedikit saat rehat siang vs tidur malam
 */

const UserSurvival = require("../../../src/models/UserSurvival");
const ui = require("../../../src/config/ui");
const {
  advanceTime,
  getTimeState,
} = require("../../../src/survival/helpers/survivalTime");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");

// ============================================================================
// CONSTANTS
// ============================================================================

const SLEEP_HOURS = 8;
const NAP_HOURS = 2;
const MAX_STAT = 100;
const HUNGER_DRAIN_NIGHT = 20;
const THIRST_DRAIN_NIGHT = 20;
const HUNGER_DRAIN_NAP = 5;
const THIRST_DRAIN_NAP = 5;
const NAP_STAMINA_CAP = 40;
const NAP_BASE_STAMINA = 30;
const NAP_HP_REGEN = 15;
const DAY_START_HOUR = 6;
const DAY_END_HOUR = 18;

const REGEN_BY_PROPERTY = {
  jalanan: 50,
  gudang: 60,
  kos: 70,
  rumah: 90,
  mansion: 100,
};

const DECO_BONUS = {
  deco_small_bed: 10,
  deco_premium_bed: 20,
};

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Mengambil emoji dari config atau fallback ke unicode
 * @param {string} name - Nama emoji di config
 * @param {string} fallback - Unicode emoji fallback
 * @returns {string} Emoji string
 */
function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

/**
 * Menghitung bonus stamina dari dekorasi aktif
 * @param {Array<{id: string}>} decorations - Array dekorasi aktif
 * @returns {number} Total bonus stamina dari dekorasi
 */
function bonusFromDecorations(decorations) {
  return decorations.reduce(
    (total, deco) => total + (DECO_BONUS[deco?.id] || 0),
    0,
  );
}

/**
 * Menentukan apakah waktu sekarang adalah siang hari in-game
 * @param {number} hour - Jam in-game (0-23)
 * @returns {boolean} True jika siang hari
 */
function isDaytime(hour) {
  return hour >= DAY_START_HOUR && hour < DAY_END_HOUR;
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Handler utama untuk command /survival rest
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    const daytime = isDaytime(survival.inGameHour);
    const rpgState = survival.rpg_state || {};
    const property = survival.propertyId || "jalanan";

    if (rpgState.house_seized && property !== "jalanan") {
      return ui.sendError(interaction, "err_sys_57", true);
    }

    let hoursToAdvance = SLEEP_HOURS;
    let regenStamina =
      (REGEN_BY_PROPERTY[property] || REGEN_BY_PROPERTY.jalanan) +
      bonusFromDecorations(rpgState.active_decorations || []);
    let regenHp = Math.round(regenStamina / 2);
    let hungerDrain = HUNGER_DRAIN_NIGHT;
    let thirstDrain = THIRST_DRAIN_NIGHT;
    let titleText = `${e("sleepy", "\uD83D\uDECF\uFE0F")} Tidur Pulas Semalaman`;
    let introText = `Kamu merebahkan badan di **${property.toUpperCase()}** dan tertidur pulas selama ${hoursToAdvance} jam. Naura jagain mimpimu, kok.`;

    if (daytime) {
      hoursToAdvance = NAP_HOURS;
      const decoBonus = bonusFromDecorations(rpgState.active_decorations || []);
      regenStamina = Math.min(NAP_STAMINA_CAP, NAP_BASE_STAMINA + Math.round(decoBonus / 2));
      regenHp = NAP_HP_REGEN;
      hungerDrain = HUNGER_DRAIN_NAP;
      thirstDrain = THIRST_DRAIN_NAP;
      titleText = `☕ Rehat Sejenak di Bawah Keteduhan`;
      introText = `Kamu duduk bersandar dan rehat sejenak di **${property.toUpperCase()}** selama ${hoursToAdvance} jam sambil menikmati semilir angin. Energimu terisi kembali!`;
    }

    const leveling = require("../../../src/survival/engines/survivalLeveling");
    const cacheManager = require("../../../src/managers/cacheManager");
    const questGen = require("../../../src/survival/engines/questGenerator");
    const survivalVitals = require("../../../src/survival/helpers/survivalVitals");

    const energyResetInfo = await survivalVitals.checkAndApplyEnergyReset(
      user.id,
      survival,
    );

    const maxHp = leveling.calculateMaxHp(survival);

    const newStamina = Math.min(
      MAX_STAT,
      (survival.stamina || 0) + regenStamina,
    );
    const newHp = Math.min(maxHp, (survival.hp || maxHp) + regenHp);
    const newHunger = Math.max(0, (survival.hunger || 0) - hungerDrain);
    const newThirst = Math.max(0, (survival.thirst || 0) - thirstDrain);

    const timeUpdate = await advanceTime(user.id, hoursToAdvance);
    const timeState = getTimeState(timeUpdate.hour);

    await cacheManager.updateUserSurvival(user.id, {
      stamina: newStamina,
      hp: newHp,
      hunger: newHunger,
      thirst: newThirst,
    });

    await questGen.incrementQuestProgress(user.id, "rest", 1).catch(() => {});

    const jam = timeUpdate.hour.toString().padStart(2, "0");

    const staBar = survivalUI.buildVitalsBar({ current: newStamina, target: MAX_STAT, length: 8, showPercentage: true });
    const hpBar = survivalUI.buildVitalsBar({ current: newHp, target: maxHp, length: 8, showPercentage: true });
    const hunBar = survivalUI.buildVitalsBar({ current: newHunger, target: 100, length: 8, showPercentage: true });
    const thiBar = survivalUI.buildVitalsBar({ current: newThirst, target: 100, length: 8, showPercentage: true });

    const description = [
      introText,
      "",
      `**Yang pulih waktu kamu ${daytime ? "rehat" : "tidur"}:**`,
      `> ⚡ Stamina: \`${staBar.bar}\` *(+${regenStamina})*`,
      `> ❤️ HP: \`${hpBar.bar}\` *(+${regenHp})*`,
      `> 🔋 **Reset Energi (5 Jam):** ${energyResetInfo.reset ? "Energi telah pulih 100%!" : "Siap dalam " + energyResetInfo.formattedCountdown}`,
      "",
      `**Kebutuhan fisik berkurang sedikit:**`,
      `> 🍖 Lapar: \`${hunBar.bar}\` *(-${hungerDrain}%)*`,
      `> 💧 Haus: \`${thiBar.bar}\` *(-${thirstDrain}%)*`,
      "",
      "**Sekarang sudah:**",
      `> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${jam}:00 (${timeState.label})`,
    ].join("\n");

    const bg = survivalUI.getSurvivalBackground(survival.currentLocation || "desa", timeUpdate.hour);
    const files = bg ? [bg.attachment] : [];

    const payload = buildContainerV2({
      accentColorHex: daytime ? survivalUI.getColor("river") : survivalUI.getColor("moss"),
      authorName: "Naura Survival Vitals",
      title: titleText,
      iconURL: interaction.client.user.displayAvatarURL(),
      topBannerAttachmentName: bg?.attachmentName,
      files,
      description,
      buttonsRow: [survivalUI.buildSurvivalActionRow("vitals", user.id)],
      footerText: `Jangan lupa minum air & makan ya \u2022 ${ui.getFooter("survival")}`,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply({ ...payload, files, embeds: [] });
    }
    return interaction.reply({ ...payload, files, embeds: [] });
  },
};
