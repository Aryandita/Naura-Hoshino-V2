"use strict";

const {
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const path = require("path");
const fs = require("fs");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const {
  advanceTime,
  getTimeState,
} = require("../../../src/survival/helpers/survivalTime");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const currency = require("../../../src/survival/engines/currency");
const encounter = require("../../../src/survival/helpers/npcEncounter");
const roam = require("../../../src/survival/helpers/npcEncounterView");

const BANDIT_CHANCE = 0.15;
const BANDIT_LOSS = 50;
const COLLECTOR_MS = 120000;
const BACKGROUND_DIR = path.join(
  process.cwd(),
  "assets",
  "survival",
  "background",
);

// Data NPC memakai `desa`, sedangkan pilihan perintah memakai `village`.
const LOCATION_ALIAS = { village: "desa", city: "kota" };

const LOCATION_NAMES = {
  village: "Desa Pemula",
  desa: "Desa Pemula",
  kota: "Naura City",
  academy: "Naura Academy",
  hutan: "Hutan Terlarang",
  tambang: "Gua Penambang",
  laut: "Pantai & Dermaga",
};

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function timePeriodOf(label) {
  const lower = String(label || "").toLowerCase();
  if (lower.includes("siang")) return "siang";
  if (lower.includes("sore")) return "sore";
  if (lower.includes("malam")) return "malam";
  return "pagi";
}

function findBackground(locKey, period) {
  const candidates = [
    `${locKey}_${period}.png`,
    `${locKey}.png`,
    "placeholder.png",
  ];

  for (const name of candidates) {
    const full = path.join(BACKGROUND_DIR, name);
    if (fs.existsSync(full)) return { full, name };
  }

  return null;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const tujuan = interaction.options.getString("lokasi");
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    if (survival.currentLocation === "prison") {
      return ui.sendError(
        interaction,
        `${e("hmph", "\u26D3\uFE0F")} Kamu masih di penjara, jadi belum bisa ke mana-mana. Naura tunggu sampai kamu bebas, ya.`,
        true,
      );
    }

    const normalizedNow =
      LOCATION_ALIAS[survival.currentLocation] || survival.currentLocation;
    const normalizedTarget = LOCATION_ALIAS[tujuan] || tujuan;

    if (normalizedNow === normalizedTarget)
      return ui.sendError(interaction, "err_sys_66", true);

    const hasNoVehicle = !survival.vehicle || survival.vehicle === "none";
    const hasNoHouse =
      !survival.propertyId || survival.propertyId === "jalanan";

    if (normalizedTarget !== "desa" && (hasNoVehicle || hasNoHouse)) {
      return ui.sendError(interaction, "err_sys_67", true);
    }

    let travelTime = 2;
    let vehName = "jalan kaki";
    if (survival.vehicle === "bicycle") {
      travelTime = 1;
      vehName = "sepeda kayuh";
    }
    if (survival.vehicle === "motorcycle") {
      travelTime = 0.5;
      vehName = "sepeda motor";
    }

    survival.currentLocation = tujuan;
    // Rule 1.8: fields eksplisit agar tidak menimpa kolom lain.
    await survival.save({ fields: ["currentLocation"] });

    const timeUpdate = await advanceTime(user.id, Math.ceil(travelTime));
    const timeState = getTimeState(timeUpdate.hour);

    let encounterText = "";

    if (!timeUpdate.passedOut && Math.random() < BANDIT_CHANCE) {
      if (Math.random() < 0.5) {
        // Dulu saldonya hanya diubah di memori setelah save, jadi
        // penaltinya tidak pernah benar-benar tercatat.
        await survival.reload().catch(() => {});
        const profile = await cacheManager.getUserProfile(user.id);
        const lost = Math.min(
          BANDIT_LOSS,
          currency.balanceOf(currency.FRAGMENT, { survival, profile }),
        );

        if (lost > 0)
          await currency.charge(currency.FRAGMENT, { survival, profile }, lost);

        encounterText = [
          "",
          `${e("shocked", "\uD83E\uDD77")} **Ada kejadian di jalan!**`,
          `Kamu dicegat bandit di tengah perjalanan. Untung kamu lolos, tapi ${currency.format(currency.FRAGMENT, lost)} jatuh berserakan. Naura khawatir banget, hati-hati ya!`,
        ].join("\n");
      } else {
        encounterText = [
          "",
          `${e("happy", "\uD83C\uDF92")} **Ada kejadian di jalan!**`,
          'Kamu berpapasan dengan **Pak Damar**. "Psst, kalau butuh barang langka, temui aku di pojok kota malam ini," bisiknya sambil tersenyum.',
        ].join("\n");
      }
    }

    const currentHour = timeUpdate.hour || survival.inGameHour || 6;
    const crowd = encounter.npcsAt(normalizedTarget, currentHour);

    const lines = [
      `Kamu berangkat ke **${LOCATION_NAMES[normalizedTarget] || tujuan}** dengan **${vehName}**. Hati-hati di jalan ya!`,
      "",
      `> ${e("sleepy", "\u23F1\uFE0F")} Waktu tempuh: **${travelTime} jam**`,
      `> ${timeState.emoji} Sekarang **hari ke-${timeUpdate.day}, jam ${String(timeUpdate.hour).padStart(2, "0")}:00** (${timeState.label})`,
      `> ${e("npc_group", "\uD83D\uDC65")} Ada **${crowd.length} penduduk** yang sedang berkegiatan di sekitar sini.`,
    ];

    if (encounterText) lines.push(encounterText);

    if (timeUpdate.passedOut) {
      lines.push(
        "",
        `${e("cry", "\uD83D\uDE91")} **Kamu pingsan di jalan!**`,
        `Kamu kelelahan atau melanggar jam malam, lalu dilarikan ke **${timeUpdate.clinic}** dan dipulangkan ke desa. Biaya medisnya ${currency.format(currency.FRAGMENT, timeUpdate.penalty)}. Naura sedih lihat kamu begini, tolong jaga kesehatanmu.`,
      );
    }

    const background = findBackground(
      normalizedTarget === "academy" ? "kota" : normalizedTarget,
      timePeriodOf(timeState.label),
    );

    const files = [];
    let bannerAttachmentName;

    if (background) {
      bannerAttachmentName = background.name;
      files.push(
        new AttachmentBuilder(background.full, { name: background.name }),
      );
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: "Naura Travel",
      title: `${e("cheers", "\uD83D\uDDFA\uFE0F")} Kamu sudah sampai!`,
      iconURL: user.displayAvatarURL(),
      expression: timeUpdate.passedOut ? "error" : "success",
      description: lines.join("\n"),
      bannerAttachmentName,
      files,
      footerText: ui.getFooter("survival"),
    });

    const components = [...payload.components];

    if (crowd.length > 0 && !timeUpdate.passedOut) {
      components.push(
        new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("travel_roam")
            .setLabel("Jalan-jalan keliling")
            .setEmoji(e("run", "\uD83C\uDFC3"))
            .setStyle(ButtonStyle.Success),
        ),
      );
    }

    const response = await interaction.editReply({ ...payload, components });

    if (components.length === payload.components.length) return response;
    if (
      !response ||
      typeof response.createMessageComponentCollector !== "function"
    )
      return response;

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id && i.customId === "travel_roam",
      time: COLLECTOR_MS,
      max: 1,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate().catch(() => {});

      // Tombolnya dimatikan tanpa membuang isi kartu Components V2.
      const disabledRow = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("travel_roam_done")
          .setLabel("Sedang berkeliling...")
          .setEmoji(e("run", "\uD83C\uDFC3"))
          .setStyle(ButtonStyle.Success)
          .setDisabled(true),
      );

      await interaction
        .editReply({
          ...payload,
          components: [...payload.components, disabledRow],
        })
        .catch(() => {});

      try {
        await roam.runRoam({
          interaction,
          location: normalizedTarget,
          hour: currentHour,
          luck: survival.luck || 1,
        });
      } catch (error) {
        // Perjalanannya tetap sah walau sesi jalan-jalan gagal dibuka.
      }
    });

    return response;
  },
};
