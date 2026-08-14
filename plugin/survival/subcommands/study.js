"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { advanceTime, getTimeState } = require("../../../src/survival/helpers/survivalTime");
const diffHelper = require("../../../src/survival/helpers/difficultyHelper");
const currency = require("../../../src/survival/engines/currency");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");

const COLLECTOR_MS = 120000;
const STUDY_HOURS = 3;
const EXAM_HOURS = 2;
const REMEDIAL_COST = 200;

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(payload) {
  return { ...payload, flags: (payload.flags || 0) | MessageFlags.Ephemeral };
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison")
      return ui.sendError(interaction, "err_sys_63", true);
    if (survival.currentLocation !== "academy")
      return ui.sendError(interaction, "err_sys_64", true);
    if ((survival.hunger || 0) <= 15 || (survival.thirst || 0) <= 15)
      return ui.sendError(interaction, "err_sys_65", true);

    const profile = await cacheManager.getUserProfile(user.id);
    const rpgState = survival.rpg_state || {};
    const inventory = safeParseInventory(profile.inventory);
    const hasIjazah = inventory.some((i) => i && i.id === "certificate");

    const academyPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Academy",
      title: `${e("read", "\uD83C\uDFEB")} Selamat datang di Naura Academy`,
      iconURL: user.displayAvatarURL(),
      expression: "info",
      description: [
        "Perpustakaannya sepi dan wangi buku baru. Naura suka suasana di sini!",
        "",
        `> ${e("read", "\uD83D\uDCD6")} **Membaca buku** menambah kepintaranmu`,
        `> ${e("impressed", "\uD83C\uDF93")} **Ujian Prof. Habibie** memberi ijazah untuk pekerjaan tingkat tinggi`,
        "",
        "Mau yang mana dulu? Naura temani belajar kok.",
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("study_book")
        .setLabel(`Membaca buku (${STUDY_HOURS} jam)`)
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("study_exam")
        .setLabel("Ikut ujian sertifikasi")
        .setStyle(ButtonStyle.Primary),
    );

    const response = await interaction.editReply({
      ...academyPayload,
      embeds: [],
      components: [...academyPayload.components, row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
      max: 1,
    });

    collector.on("collect", async (i) => {
      if (i.customId === "study_book") {
        await i.deferUpdate().catch(() => {});

        let intGain = Math.floor(Math.random() * 3) + 1;
        const decos = rpgState.active_decorations || [];
        if (
          Array.isArray(decos) &&
          decos.some((d) => d && d.id === "deco_bookshelf")
        )
          intGain += 1;

        const diffConfig = diffHelper.getDifficultyConfig(
          rpgState.difficulty || "Normal",
        );
        const drainHunger = Math.floor(15 * diffConfig.drainMultiplier);
        const drainThirst = Math.floor(20 * diffConfig.drainMultiplier);

        const newHunger = Math.max(0, (survival.hunger || 0) - drainHunger);
        const newThirst = Math.max(0, (survival.thirst || 0) - drainThirst);
        const newInt = (survival.intelligence || 1) + intGain;

        // Statistik disimpan dulu, baru waktunya dimajukan, supaya
        // instance lama tidak menimpa jam hasil advanceTime.
        await cacheManager.updateUserSurvival(user.id, {
          hunger: newHunger,
          thirst: newThirst,
          intelligence: newInt,
        });

        const timeUpdate = await advanceTime(user.id, STUDY_HOURS);
        const timeState = getTimeState(timeUpdate.hour);

        try {
          const { incrementQuestProgress } = require("../../../src/survival/engines/questGenerator");
          await incrementQuestProgress(user.id, "study");
        } catch (err) {
          // Papan misi opsional.
        }

        const lines = [
          `Kamu membaca buku tebal selama **${STUDY_HOURS} jam** tanpa mengeluh. Rajin banget, Naura kagum!`,
          "",
          `> ${e("impressed", "\uD83D\uDCA1")} Kepintaran **+${intGain}** menjadi **${newInt}**`,
          `> ${e("eat", "\uD83C\uDF56")} Lapar **-${drainHunger}** \u2022 ${e("chirping", "\uD83D\uDCA7")} Haus **-${drainThirst}**`,
          `> ${timeState.emoji} Sekarang hari ke-**${timeUpdate.day}**, jam ${String(timeUpdate.hour).padStart(2, "0")}:00 (${timeState.label})`,
        ];

        if (timeUpdate.passedOut) {
          lines.push(
            "",
            `${e("cry", "\uD83D\uDE91")} Kamu kelelahan sampai pingsan di meja baca dan dirawat di **${timeUpdate.clinic}**. Biayanya ${currency.format(currency.FRAGMENT, timeUpdate.penalty)}. Jangan belajar sampai lupa makan ya, Naura khawatir.`,
          );
        }

        const studyPayload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#FFC0CB",
          authorName: "Naura Academy",
          title: `${e("read", "\uD83D\uDCD6")} Selesai belajar`,
          iconURL: user.displayAvatarURL(),
          expression: timeUpdate.passedOut ? "error" : "success",
          description: lines.join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return i.editReply({ ...studyPayload, embeds: [] }).catch(() => {});
      }

      if (i.customId !== "study_exam") return;

      if (hasIjazah) {
        const already = buildErrorContainerV2({
          title: `${e("cheers", "\uD83C\uDF93")} Kamu sudah lulus`,
          description:
            '**Prof. Habibie:** "Nilaimu sudah memuaskan, tidak perlu mengulang ujian lagi." Naura ikut bangga, lho!',
          footerText: ui.getFooter("survival"),
        });

        return i.reply(ephemeral({ ...already, embeds: [] })).catch(() => {});
      }

      // Ujian remedial dibayar dengan Naura Coin karena kampus ada di kota.
      if ((rpgState.test_cd || 0) > (survival.inGameDay || 1)) {
        const paid = await currency.charge(
          currency.COIN,
          { survival, profile },
          REMEDIAL_COST,
        );

        if (paid === null) {
          const cdPayload = buildErrorContainerV2({
            title: `${e("sleepy", "\uD83C\uDF93")} Belum bisa ikut ujian`,
            description: `**Prof. Habibie:** "Kamu gagal ujian kemarin. Tunggu hari berikutnya, atau bayar ${currency.format(currency.COIN, REMEDIAL_COST)} untuk ujian remedial sekarang." Sabar ya, Naura yakin kamu siap!`,
            footerText: ui.getFooter("survival"),
          });

          return i
            .reply(ephemeral({ ...cdPayload, embeds: [] }))
            .catch(() => {});
        }
      }

      await i.deferUpdate().catch(() => {});

      const passChance = Math.min(0.9, (survival.intelligence || 1) / 100);

      if (Math.random() < passChance) {
        inventory.push({
          id: "certificate",
          name: "Ijazah Kelulusan",
          amount: 1,
          type: "special",
        });
        await cacheManager.updateUserProfile(user.id, { inventory });
        await advanceTime(user.id, EXAM_HOURS);

        const passPayload = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#22c55e",
          authorName: "Naura Academy",
          title: `${e("cheers", "\uD83C\uDF93")} Kamu lulus!`,
          iconURL: user.displayAvatarURL(),
          expression: "achievement",
          description: [
            '**Prof. Habibie:** "Luar biasa, analisismu sangat tajam."',
            "",
            `${e("impressed", "\uD83C\uDF89")} **Ijazah Kelulusan** sudah masuk ke tasmu. Sekarang kamu bisa melamar jadi Dokter atau CEO lewat \`/survival work\`.`,
            "",
            "Naura bangga banget sama kamu, sungguh!",
          ].join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return i.editReply({ ...passPayload, embeds: [] }).catch(() => {});
      }

      await cacheManager.updateUserSurvival(user.id, {
        rpg_state: { ...rpgState, test_cd: (survival.inGameDay || 1) + 1 },
      });
      await advanceTime(user.id, EXAM_HOURS);

      const failPayload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#FFB347",
        authorName: "Naura Academy",
        title: `${e("cry", "\uD83C\uDF93")} Ujiannya belum lulus`,
        iconURL: user.displayAvatarURL(),
        expression: "fail",
        description: [
          '**Prof. Habibie:** "Jawabanmu kurang tepat. Belajar lebih giat lagi, ya."',
          "",
          "Jangan berkecil hati! Baca buku beberapa kali lagi, lalu coba ujian besok. Naura temani belajar sampai kamu lulus.",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return i.editReply({ ...failPayload, embeds: [] }).catch(() => {});
    });
  },
};
