"use strict";

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

const SLEEP_HOURS = 8;
const MAX_STAT = 100;
const HUNGER_DRAIN = 20;
const THIRST_DRAIN = 20;

// Semakin nyaman tempat tinggalnya, semakin pulas tidurnya.
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

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function bonusFromDecorations(decorations) {
  return decorations.reduce(
    (total, deco) => total + (DECO_BONUS[deco?.id] || 0),
    0,
  );
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    const isDaytime = survival.inGameHour >= 6 && survival.inGameHour < 18;
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
    let hungerDrain = HUNGER_DRAIN;
    let thirstDrain = THIRST_DRAIN;
    let titleText = `${e("sleepy", "\uD83D\uDECF\uFE0F")} Tidur Pulas Semalaman`;
    let introText = `Kamu merebahkan badan di **${property.toUpperCase()}** dan tertidur pulas selama ${hoursToAdvance} jam. Naura jagain mimpimu, kok.`;

    if (isDaytime) {
      // Rehat Sejenak / Power Nap di siang hari
      hoursToAdvance = 2;
      regenStamina = Math.min(40, 30 + Math.round(bonusFromDecorations(rpgState.active_decorations || []) / 2));
      regenHp = 15;
      hungerDrain = 5;
      thirstDrain = 5;
      titleText = `☕ Rehat Sejenak di Bawah Keteduhan`;
      introText = `Kamu duduk bersandar dan rehat sejenak di **${property.toUpperCase()}** selama ${hoursToAdvance} jam sambil menikmati semilir angin. Energimu terisi kembali!`;
    }

    const leveling = require("../../../src/survival/engines/survivalLeveling");
    const cacheManager = require("../../../src/managers/cacheManager");
    const questGen = require("../../../src/survival/engines/questGenerator");

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

    const description = [
      introText,
      "",
      `**Yang pulih waktu kamu ${isDaytime ? "rehat" : "tidur"}:**`,
      `> Stamina **+${regenStamina}** (sekarang ${newStamina}%)`,
      `> HP **+${regenHp}** (sekarang ${newHp})`,
      "",
      `**Kebutuhan fisik berkurang sedikit:**`,
      `> Lapar **-${hungerDrain}%** (sisa ${newHunger}%)`,
      `> Haus **-${thirstDrain}%** (sisa ${newThirst}%)`,
      "",
      "**Sekarang sudah:**",
      `> ${timeState.emoji} **Hari ke-${timeUpdate.day}**, jam ${jam}:00 (${timeState.label})`,
    ].join("\n");

    const payload = buildContainerV2({
      accentColorHex: isDaytime ? "#38BDF8" : (ui.getColor("primary") || "#FFB6C1"),
      authorName: "Naura Survival Vitals",
      title: titleText,
      iconURL: interaction.client.user.displayAvatarURL(),
      description,
      buttonsRow: [survivalUI.buildSurvivalActionRow("vitals", user.id)],
      footerText: `Jangan lupa minum air & makan ya \u2022 ${ui.getFooter("survival")}`,
    });

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(payload);
    }
    return interaction.reply(payload);
  },
};
