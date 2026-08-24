"use strict";

const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const {
  advanceTime,
  getTimeState,
  getWeather,
  getSeason,
} = require("../../../src/survival/helpers/survivalTime");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const diffHelper = require("../../../src/survival/helpers/difficultyHelper");
const currency = require("../../../src/survival/engines/currency");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");

const JOBS = {
  janitor: {
    reqInt: 1,
    reqStr: 1,
    reqAgi: 1,
    baseSalary: 200,
    time: 2,
    title: "Tukang Sapu",
  },
  office: {
    reqInt: 10,
    reqStr: 1,
    reqAgi: 1,
    baseSalary: 500,
    time: 4,
    title: "Pekerja Kantoran",
  },
  doctor: {
    reqInt: 30,
    reqStr: 5,
    reqAgi: 20,
    baseSalary: 1500,
    time: 6,
    title: "Dokter Spesialis",
  },
  ceo: {
    reqInt: 80,
    reqStr: 10,
    reqAgi: 30,
    baseSalary: 4500,
    time: 8,
    title: "CEO Perusahaan",
  },
};

const BOOSTERS = {
  basic_shovel: { name: "Sekop Biasa", mult: 1.2 },
  steel_pickaxe: { name: "Beliung Baja", mult: 1.5 },
  enchanted_gloves: { name: "Sarung Tangan Ajaib", mult: 2.0 },
  lucky_charm: { name: "Jimat Keberuntungan", mult: 2.5 },
  laptop_gaming: { name: "Laptop Gaming", mult: 3.0 },
  vip_card: { name: "Kartu VIP", mult: 4.0 },
  golden_ticket: { name: "Tiket Emas", mult: 5.0 },
};

const CITY_LOCATIONS = ["kota", "city"];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const pekerjaan = interaction.options.getString("pekerjaan");

    const survival = await cacheManager.getUserSurvival(user.id);
    const profile = await cacheManager.getUserProfile(user.id);

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_68", true);
    if (!CITY_LOCATIONS.includes(survival.currentLocation))
      return ui.sendError(interaction, "err_sys_69", true);
    if ((survival.hunger || 0) <= 25 || (survival.thirst || 0) <= 25)
      return ui.sendError(interaction, "err_sys_70", true);

    const job = JOBS[pekerjaan] || JOBS.janitor;
    const int = survival.intelligence || 1;
    const str = survival.strength || 1;
    const agi = survival.agility || 1;

    if (int < job.reqInt || str < job.reqStr || agi < job.reqAgi) {
      return ui.sendError(
        interaction,
        [
          `Maaf ya, kemampuanmu belum cukup untuk jadi **${job.title}**. Naura yakin kamu bisa kalau berlatih sedikit lagi!`,
          "",
          `Syaratnya: ${e("read", "\uD83E\uDDE0")} ${job.reqInt} INT \u2022 ${e("happy", "\uD83D\uDCAA")} ${job.reqStr} STR \u2022 ${e("chirping", "\uD83C\uDFC3")} ${job.reqAgi} AGI`,
          `Punyamu sekarang: INT ${int} \u2022 STR ${str} \u2022 AGI ${agi}`,
        ].join("\n"),
        true,
      );
    }

    const rpgState = survival.rpg_state || {};

    if (rpgState.sick) {
      return ui.sendError(
        interaction,
        `${e("cry", "\uD83E\uDD12")} Kamu sedang sakit, jadi belum ada kantor yang mau menerimamu. Minum obat dan istirahat dulu ya, kesehatanmu lebih penting.`,
        true,
      );
    }

    const inventory = safeParseInventory(profile.inventory);

    if (pekerjaan === "doctor" || pekerjaan === "ceo") {
      const hasIjazah = inventory.some((i) => i && i.id === "certificate");
      if (!hasIjazah) {
        return ui.sendError(
          interaction,
          `${e("read", "\uD83C\uDF93")} Posisi **${job.title}** butuh sertifikat akademik resmi. Belajar dan ikut ujian Prof. Habibie dulu lewat \`/survival study\` ya, Naura dukung kamu!`,
          true,
        );
      }
    }

    const timeUpdate = await advanceTime(user.id, job.time);
    const timeState = getTimeState(timeUpdate.hour);
    const weather = getWeather(timeUpdate.day, timeUpdate.hour);
    const season = getSeason(timeUpdate.day);
    const diffConfig = diffHelper.getDifficultyConfig(
      rpgState.difficulty || "Normal",
    );

    const intBonus = int * 5;
    let salary = Math.floor(
      (job.baseSalary + intBonus) * diffConfig.coinMultiplier,
    );

    let bestMultiplier = 1;
    let activeBoosterName = null;

    for (const item of inventory) {
      const booster = item && BOOSTERS[item.id];
      if (booster && booster.mult > bestMultiplier) {
        bestMultiplier = booster.mult;
        activeBoosterName = booster.name;
      }
    }

    if (bestMultiplier > 1) salary = Math.floor(salary * bestMultiplier);

    const {
      getUserPremiumTier,
      getWorkWageBonus,
    } = require("../../../src/premium/premiumHelper");
    const tier = getUserPremiumTier(profile);
    const wageBonusPercent = getWorkWageBonus(tier);
    if (wageBonusPercent > 0) {
      salary = Math.floor(salary * (1 + wageBonusPercent));
    }

    const newHunger = Math.max(
      0,
      (survival.hunger || 0) -
        Math.floor(job.time * 5 * diffConfig.drainMultiplier),
    );
    const newThirst = Math.max(
      0,
      (survival.thirst || 0) -
        Math.floor(job.time * 6 * diffConfig.drainMultiplier),
    );

    await cacheManager.updateUserSurvival(user.id, {
      hunger: newHunger,
      thirst: newThirst,
    });

    // Pekerjaan ini ada di kota, jadi upahnya dibayar dalam Naura Coin dan
    // dicatat lewat modul mata uang, bukan menimpa kolom NSF langsung.
    const walletAfter = await currency.reward(
      currency.COIN,
      { survival, profile },
      salary,
    );

    const xpData = await leveling.addPlayerXP(user.id, job.time * 15);

    try {
      const { incrementQuestProgress } = require("../../../src/survival/engines/questGenerator");
      await incrementQuestProgress(user.id, `work_${pekerjaan}`);

      const UserQuest = require("../../../src/models/UserQuest");
      const today = new Date().toISOString().split("T")[0];
      const [quest] = await UserQuest.findOrCreate({
        where: { userId: user.id },
        defaults: { lastReset: today },
      });

      if (quest.lastReset !== today) {
        quest.workCount = 0;
        quest.dungeonKills = 0;
        quest.collectCount = 0;
        quest.isClaimed = false;
        quest.lastReset = today;
      }

      quest.workCount = (quest.workCount || 0) + 1;
      await quest.save();
    } catch (err) {
      // Papan misi opsional, jadi galatnya tidak boleh membatalkan gaji.
    }

    const lines = [
      `Kerja bagus! Kamu menyelesaikan shift sebagai **${job.title}** selama **${job.time} jam**. Naura bawakan minum, ya?`,
      "",
      `> ${e("cheers", "\uD83D\uDCB5")} Gaji diterima: ${currency.format(currency.COIN, salary)} *(termasuk bonus INT +${intBonus})*`,
      `> ${e("read", "\uD83D\uDC5D")} Saldo dompetmu sekarang: **${walletAfter.toLocaleString("id-ID")}**`,
    ];

    if (isVIP)
      lines.push(
        `> ${e("impressed", "\uD83D\uDC8E")} Bonus VIP **+50%** ikut dihitung`,
      );
    if (activeBoosterName)
      lines.push(
        `> ${e("happy", "\uD83D\uDE80")} Booster aktif: **${activeBoosterName}** (gaji x${bestMultiplier})`,
      );

    if (xpData && xpData.hasLeveledUp) {
      lines.push(
        "",
        `${e("impressed", "\uD83C\uDF1F")} **Naik level!** Kamu sekarang **Level ${xpData.currentLevel}**, dan batas statusmu naik jadi **${xpData.maxStatCap}**. Naura bangga banget!`,
      );
    }

    const fields = [
      {
        name: "Kondisi fisikmu",
        value: `${e("eat", "\uD83C\uDF54")} Lapar ${Math.floor(newHunger)}% \u2022 ${e("chirping", "\uD83E\uDD64")} Haus ${Math.floor(newThirst)}%`,
      },
      {
        name: "Waktu & cuaca",
        value: `${timeState.emoji} Hari ${timeUpdate.day}, ${String(timeUpdate.hour).padStart(2, "0")}:00\n${season.emoji} ${season.name} \u2022 ${weather.emoji} ${weather.name}`,
      },
    ];

    const weatherName = weather.name || "";
    const accentColor = weatherName.includes("Badai")
      ? "#1f2937"
      : weatherName.includes("Hujan")
        ? "#3b82f6"
        : weatherName.includes("Panas")
          ? "#ef4444"
          : ui.getColor("success");

    const payload = buildContainerV2({
      accentColorHex: accentColor,
      authorName: "Naura Employment Center",
      title: `${e("cheers", "\uD83C\uDFE2")} Shift selesai: ${job.title}`,
      iconURL: user.displayAvatarURL(),
      expression: "economy",
      description: lines.join("\n"),
      fields,
      footerText: ui.getFooter("survival"),
    });

    return interaction.editReply({ ...payload, embeds: [] });
  },
};
