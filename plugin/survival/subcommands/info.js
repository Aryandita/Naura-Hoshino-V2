"use strict";

// Kartu profil petualangan. Perhitungannya ada di plugin/survival/infoStats.js,
// berkas ini fokus pada cara Naura menceritakan keadaan pemain.

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { logger } = require("../../../src/managers/logger");
const UserPet = require("../../../src/models/UserPet");
const UserNPC = require("../../../src/models/UserNPC");
const UserAchievement = require("../../../src/models/UserAchievement");
const achievementsPool = require("../../../src/survival/data/achievementsData");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const skillTree = require("../../../src/survival/engines/skillTreeEngine");
const cacheManager = require("../../../src/managers/cacheManager");
const { buildStats } = require("../../../src/survival/helpers/infoStats");

const IMAGE_NAME = "naura-survival.png";

function e(name, fallback) {
  return ui.getEmoji(name) || fallback || "";
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;

    try {
      const [profile, survival, activePets, marriedNPCs, [userAch]] =
        await Promise.all([
          cacheManager.getUserProfile(user.id),
          cacheManager.getUserSurvival(user.id),
          UserPet.findAll({ where: { userId: user.id, isActive: true } }),
          UserNPC.findAll({ where: { userId: user.id, relationshipLevel: 4 } }),
          UserAchievement.findOrCreate({ where: { userId: user.id } }),
        ]);

      const stats = await buildStats({
        userId: user.id,
        profile,
        survival,
        activePets,
      });

      const userName = ui.ux.resolveUserName(interaction);
      const adaptive = ui.ux.buildAdaptiveDensityView({
        level: stats.level || 1,
        isVeteran: stats.rebirthCount > 0 || (stats.level || 1) > 5,
        user: interaction,
        lang: "id",
      });

      const partnerName = marriedNPCs.length > 0 ? marriedNPCs[0].npcId : null;
      const partnerDisplay = partnerName
        ? `${e("wedding_ring")} **${partnerName}** : Naura ikut senang lihat kalian bahagia!`
        : "Masih sendiri, dan itu sama sekali nggak apa-apa~";

      // --- Gelar dan pencapaian ---
      let titleBadge = "";
      if (stats.rpgState.beat_extreme) {
        titleBadge += `\n${e("naura_impressed")} **Gelar Khusus:** Penyintas Terkuat & Tercerdas`;
      }
      if (userAch && userAch.activeTitle) {
        const active = achievementsPool.find(
          (a) => a.id === userAch.activeTitle,
        );
        if (active) {
          titleBadge +=
            `\n${e("achievement_badge")} **Gelar Aktif:** ${active.emoji || ""} ${active.title}`.replace(
              "  ",
              " ",
            );
        }
      }

      // --- Combat Path Synergy ---
      const synergy = skillTree.getPathSynergy(survival);
      let synergyLine = "";
      if (synergy.hasSynergy) {
        synergyLine = `\n${e("sparkle", "\u2728")} **Path Synergy Aktif:** ${synergy.label}\n> *${synergy.bonusDescription}*`;
      }

      // --- Perlengkapan ---
      const gear = stats.gear;
      const gearLines = [
        `${e("tools")} **Perlengkapanmu:**`,
        `> ${e("axe")} Kapak: ${gear.axe ? "siap dipakai" : "belum ada, masih tangan kosong"}`,
        `> ${e("pickaxe")} Beliung: ${gear.pickaxe ? "siap dipakai" : "belum ada, masih tangan kosong"}`,
        `> ${e("fishing_rod")} Pancingan: ${gear.rod ? "siap dipakai" : "belum ada"}`,
        `> ${e("sword")} Senjata: ${gear.sword || gear.bow ? "sudah ada, hati-hati ya" : "belum ada"}`,
        gear.armorCount > 0
          ? `> ${e("shield")} Zirah: **${gear.armorCount}** keping terpasang (${gear.armorNames.slice(0, 3).join(", ")})`
          : `> ${e("shield")} Zirah: belum ada, Naura khawatir kamu kenapa-kenapa`,
      ].join("\n");

      const vehicleLine = `${e("vehicle")} **Kendaraan:** ${survival.vehicle && survival.vehicle !== "none" ? survival.vehicle : "masih jalan kaki, semangat ya!"}`;

      let questLine = `${e("quest")} **Petunjuk Naura:** ${stats.isRegistered ? "Belum ada quest baru, santai dulu sebentar." : "Daftar dulu ke Pak Kades lewat `/survival start` ya!"}`;
      if (stats.isRegistered && !gear.axe && !gear.pickaxe) {
        questLine = `${e("quest")} **Petunjuk Naura:** Kumpulkan bahan dengan tangan kosong lewat \`/survival collect\`, lalu tempa alat pertamamu!`;
      }

      const sickLine = stats.isSick
        ? `\n${e("sick")} **Kamu sedang sakit!** Naura antar ke klinik, ya? Jangan dipaksa kerja dulu.`
        : "";

      const timeLine = `${stats.timeState.emoji} **Hari ke-${survival.inGameDay || 1}** \u2022 pukul ${(survival.inGameHour || 6).toString().padStart(2, "0")}:00 (${stats.timeState.label}) \u2022 cuaca ${stats.weather.emoji} **${stats.weather.name}**${sickLine}`;

      const balanceLines = stats.balances
        .map(
          (b) =>
            `> ${b.emoji} **${b.name}:** **${b.amount.toLocaleString("id-ID")}**`,
        )
        .join("\n");

      const perkNames = Object.keys(stats.perks || {});
      const perkLine =
        perkNames.length > 0
          ? `> ${e("sparkle")} Berkah aktif: **${perkNames.length}** (${perkNames.slice(0, 4).join(", ")})`
          : `> ${e("sparkle")} Belum ada berkah khusus. Kumpulkan Naura Coupon dulu, yuk!`;

      let files = [];
      let bannerAttachmentName;
      try {
        const {
          generateSurvivalProfileImage,
        } = require("../../../src/canvas/CanvasUtils");
        const botAvatar = interaction.client.user.displayAvatarURL({
          extension: "png",
          size: 128,
        });
        const buffer = await generateSurvivalProfileImage(
          interaction.user,
          profile,
          survival,
          ui,
          {
            activePets,
            marriedNPCs,
            botAvatar,
            gear: stats.gear,
            isRegistered: stats.isRegistered,
          },
        );
        if (buffer) {
          files = [new AttachmentBuilder(buffer, { name: IMAGE_NAME })];
          bannerAttachmentName = IMAGE_NAME;
        }
      } catch (canvasError) {
        logger.warn("[SURVIVAL INFO CANVAS]", canvasError.message);
      }

      const row1 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("info_cta_inventory")
          .setLabel("🎒 Ransel")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("info_cta_shop")
          .setLabel("🛒 Toko")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("info_cta_gather")
          .setLabel("🧺 Kumpul Bahan")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("info_cta_farm")
          .setLabel("🌾 Bertani")
          .setStyle(ButtonStyle.Secondary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("info_cta_dungeon")
          .setLabel("🗡️ Dungeon")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("info_cta_skill")
          .setLabel("⚡ Skill Tree")
          .setStyle(ButtonStyle.Secondary),
      );

      const buttonsRow = [row1, row2];

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getColor("emerald"),
        authorName: `Catatan Petualangan ${userName} \u2022 ${stats.rebirthCount}x Rebirth`,
        title: `${e("help_survival")} Profil Petualangan: ${userName} [${adaptive.modeBadge}]`,
        iconURL: user.displayAvatarURL(),
        expression: "Cheers",
        description: [
          `*${adaptive.focusTip}*`,
          "",
          `${e("clock")} **Waktu di dunia Naura:**`,
          timeLine,
          "",
          `${e("lokasi")} **Kamu sedang di:** ${stats.locationName} \u2022 ${e("property")} **Tempat tinggal:** ${stats.propertyName}`,
          `${stats.difficultyEmoji} **Mode ${stats.difficulty}**${titleBadge}${synergyLine}`,
          "",
          `${e("health")} **Keadaan badanmu:**`,
          `${e("health")} **HP:** ${stats.hp}/${stats.maxHp}\n${stats.hpBar}`,
          `${e("hunger")} **Lapar:** ${survival.hunger || 0}/100\n${stats.hungerBar}`,
          `${e("thirst")} **Haus:** ${survival.thirst || 0}/100\n${stats.thirstBar}`,
          `${e("stamina")} **Stamina:** ${survival.stamina || 0}/100\n${stats.staminaBar}`,
          "",
          gearLines,
          "",
          vehicleLine,
          questLine,
        ].join("\n"),
        fields: [
          {
            name: `${e("wallet")} Dompet & Kupon`,
            value: `${balanceLines}\n${perkLine}`,
          },
          {
            name: `${e("experience")} Progres Level (Lv. ${stats.level})`,
            value: `> **XP:** ${stats.xp} / ${stats.reqXP}\n> ${stats.xpBar}`,
          },
          {
            name: `${e("stats")} Statistik RPG (batas ${stats.maxStat})`,
            value: [
              `> ${e("strength")} STR: **${survival.strength || 1}** (+${stats.pet.bonusStrength}) : kekuatan serangan & crafting`,
              `> ${e("agility")} AGI: **${survival.agility || 1}** : peluang menghindar & diskon perjalanan`,
              `> ${e("intelligence")} INT: **${survival.intelligence || 1}** : bonus gaji & pengalaman belajar`,
              `> ${e("luck")} LUK: **${survival.luck || 1}** (+${stats.pet.bonusLuck}) : peluang jarahan langka & panen`,
            ].join("\n"),
          },
          {
            name: `${e("favorite")} Orang-orang di sekitarmu`,
            value: `> **Teman berbulu:** ${stats.pet.display}\n> **Pasangan:** ${partnerDisplay}`,
          },
        ],
        buttonsRow,
        bannerAttachmentName,
        files,
        footerText: ui.getFooter("survival"),
      });

      const message = await interaction.editReply(payload);

      if (
        !message ||
        typeof message.createMessageComponentCollector !== "function"
      ) {
        return;
      }

      const collector = message.createMessageComponentCollector({
        filter: (i) =>
          i.user.id === user.id && i.customId.startsWith("info_cta_"),
        time: 45000,
        max: 1,
      });

      collector.on("collect", async (i) => {
        await i.deferUpdate().catch(() => {});
        if (i.customId === "info_cta_inventory") {
          const invSub = require("./inventory.js");
          return invSub.execute(i);
        }
        if (i.customId === "info_cta_shop") {
          const shopSub = require("./shop.js");
          return shopSub.execute(i);
        }
        if (i.customId === "info_cta_gather") {
          const collectSub = require("./collect.js");
          return collectSub.execute(i);
        }
        if (i.customId === "info_cta_skill") {
          const skillSub = require("./skill.js");
          return skillSub.execute(i);
        }
        if (i.customId === "info_cta_dungeon") {
          const dungeonSub = require("./dungeon.js");
          return dungeonSub.execute(i);
        }
        if (i.customId === "info_cta_farm") {
          const farmSub = require("./farm.js");
          return farmSub.execute(i);
        }
        if (i.customId === "info_cta_work") {
          const workSub = require("./work.js");
          return workSub.execute(i);
        }
      });
    } catch (error) {
      logger.error("[SURVIVAL INFO ERROR]", error);
      const errPayload = buildErrorContainerV2({
        title: `${e("naura_cry")} Naura gagal membuka catatanmu`,
        description:
          "Maaf ya, ada yang tersangkut waktu Naura menyusun profilmu. Coba lagi sebentar lagi, Naura tunggu!",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply(errPayload);
    }
  },
};
