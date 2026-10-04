"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");

const cacheManager = require("../../../src/managers/cacheManager");
const itemsConfig = require("../../../src/survival/data/items");
const {
  safeParseInventory,
  takeItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const {
  applyItemEffect,
} = require("../../../src/survival/helpers/specialEffects");

const COLLECTOR_MS = 60000;
const MAX_OPTIONS = 25;

const ITEM_EMOJI = {
  apple: "\uD83C\uDF4E",
  mineral_water: "\uD83D\uDCA7",
  diamond_ring: "\uD83D\uDC8E",
  luck_crown: "\uD83D\uDC51",
  midas_gloves: "\uD83E\uDDE4",
  void_backpack: "\uD83C\uDF92",
  star_compass: "\uD83E\uDDED",
  memory_album: "\uD83D\uDCD4",
  phoenix_charm: "\uD83E\uDEB6",
  eternal_pet_egg: "\uD83E\uDD5A",
};

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

// Pesan penolakan khas Naura untuk setiap alasan kegagalan dari specialEffects.
const EFFECT_FAIL = {
  no_bond:
    "Kamu belum punya kedekatan sama siapa pun, jadi cincinnya belum ada yang bisa dipakaikan. Coba akrab dulu lewat `/survival npc` ya, Naura bantu doakan!",
  already_married:
    "Kamu kan sudah menikah, sayang. Cincinnya Naura simpan balik ke tas, jangan sampai ada yang cemburu!",
  already_owned:
    "Khasiat barang ini sudah menempel permanen di kamu, jadi nggak bisa dipakai dua kali. Naura simpan lagi ya biar nggak terbuang.",
  unknown_effect:
    "Hmm, Naura belum tahu cara memakai barang ini. Nanti Naura tanya Bagas dulu, ya!",
};

function optionEmoji(id) {
  const raw = ITEM_EMOJI[id] || e("soup", "\uD83C\uDF72");
  return ui.parseEmoji(raw) || { name: "\uD83C\uDF72" };
}

module.exports = {
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      if (typeof interaction.deferUpdate === "function") {
        await interaction.deferUpdate().catch(() => {});
      } else if (typeof interaction.deferReply === "function") {
        await interaction.deferReply().catch(() => {});
      }
    }

    try {
      const user = interaction.user;
      const profile = await cacheManager.getUserProfile(user.id);
      const survival = await cacheManager.getUserSurvival(user.id);

      const inventory = safeParseInventory(profile.inventory);
      const usable = {};

      // Selain perbekalan biasa, barang Naura Coupon berkhasiat juga bisa
      // dipakai dari sini supaya pemain tidak perlu perintah terpisah.
      for (const entry of inventory) {
        if (!entry || !entry.id) continue;
        const conf = itemsConfig.find((it) => it.id === entry.id);
        if (!conf) continue;
        if (conf.category !== "consumable" && !conf.effect) continue;

        if (!usable[conf.id]) usable[conf.id] = { ...conf, count: 1 };
        else usable[conf.id].count += 1;
      }

      const keys = Object.keys(usable).slice(0, MAX_OPTIONS);

      if (keys.length === 0) {
        const empty = buildErrorContainerV2({
          title: `${e("shy", "\uD83C\uDF92")} Tas kamu kosong`,
          description:
            "Duh, nggak ada bekal sama sekali di tasmu. Yuk mancing, nambang, atau mampir ke warung Pak Damar dulu. Naura temani!",
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply({ ...empty, embeds: [] });
      }

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("consume_item")
        .setPlaceholder("Pilih bekal atau barang yang mau dipakai...")
        .addOptions(
          keys.map((id) => {
            const it = usable[id];
            return new StringSelectMenuOptionBuilder()
              .setLabel(`${it.name} (x${it.count})`.substring(0, 100))
              .setDescription(
                (it.effect
                  ? "Khasiat permanen"
                  : it.description || "Perbekalan"
                ).substring(0, 100),
              )
              .setEmoji(optionEmoji(id))
              .setValue(id);
          }),
        );

      const selectRow = new ActionRowBuilder().addComponents(selectMenu);

      const menuPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Naura Survival Kit",
        title: `${e("happy", "\uD83C\uDF92")} Bekal survival kamu`,
        iconURL: user.displayAvatarURL(),
        expression: "info",
        description:
          "Ini isi tasmu yang Naura rapikan! Mau makan, minum, atau pakai barang spesial? Pilih saja di bawah, Naura siapkan.",
        buttonsRow: selectRow,
        footerText: ui.getFooter("survival"),
      });

      const response = await interaction.editReply({
        ...menuPayload,
        embeds: [],
      });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
      max: 1,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      const selectedId = i.values[0];
      const conf = itemsConfig.find((it) => it.id === selectedId);
      if (!conf) return;

      // Jalur barang berkhasiat: tidak menyentuh statistik lapar/haus.
      if (conf.effect) {
        const result = await applyItemEffect(conf.effect, {
          survival,
          userId: user.id,
        });

        if (!result.ok) {
          const reject = buildErrorContainerV2({
            title: `${e("akward", "\uD83D\uDE05")} Belum bisa dipakai`,
            description:
              EFFECT_FAIL[result.reason] || EFFECT_FAIL.unknown_effect,
            footerText: ui.getFooter("survival"),
          });
          return i.editReply({
            ...reject,
            embeds: [],
            components: reject.components,
          });
        }

        await takeItemsAtomic(user.id, [{ id: selectedId, amount: 1 }]);

        const lines = [
          `Kamu memakai **${conf.name}**, dan khasiatnya menempel permanen!`,
          "",
        ];

        const MYTHIC_HATCH_DATA = {
          mythic_celestial_egg: {
            petType: "kirin",
            petName: "Kirin Surgawi",
            passiveSkill: "celestial_1",
            imgName: "kirin.png",
            title: `${ui.getEmoji("sparkles") || "✨"} Kirin Surgawi Menetas!`,
            desc: "Makhluk sakral pelindung dimensi Hoshino ini kini setia menemanimu.",
            skillDesc: "+30 HP, +15 DMG, +8 Dodge, +8 Crit (All-Rounder)",
          },
          egg_leviathan: {
            petType: "leviathan",
            petName: "Leviathan Samudra",
            passiveSkill: "tank_1",
            imgName: "leviathan.png",
            title: `${ui.getEmoji("water") || "🌊"} Leviathan Laut Dalam Menetas!`,
            desc: "Raksasa samudra purba ini melindungimu dengan lapisan aura perisai air abadi.",
            skillDesc:
              "+80 HP (Drastis!), +2 DMG, +1 Dodge, +1 Crit (Immortal Tanker)",
          },
          egg_bahamut: {
            petType: "bahamut",
            petName: "Bahamut Kehancuran",
            passiveSkill: "berserk_1",
            imgName: "bahamut.png",
            title: `${ui.getEmoji("fire") || "🔥"} Bahamut Kehancuran Menetas!`,
            desc: "Naga api apokaliptik pembawa kehancuran mutlak siap membakar semua lawanmu.",
            skillDesc:
              "+5 HP, +35 DMG (Drastis!), +1 Dodge, +2 Crit (Pure Berserker)",
          },
          egg_garuda: {
            petType: "garuda",
            petName: "Garuda Badai Surya",
            passiveSkill: "agility_1",
            imgName: "garuda.png",
            title: `${ui.getEmoji("stamina") || "⚡"} Garuda Badai Surya Menetas!`,
            desc: "Dewa angin dan kilat suci ini memberimu kecepatan gerak secepat cahaya.",
            skillDesc:
              "+10 HP, +5 DMG, +20 Dodge & +15 Crit (Drastis!) (Phantom God)",
          },
        };

        if (MYTHIC_HATCH_DATA[conf.effect]) {
          const UserPet = require("../../../src/models/UserPet");
          const fs = require("fs");
          const path = require("path");
          const { AttachmentBuilder } = require("discord.js");
          const hatch = MYTHIC_HATCH_DATA[conf.effect];

          // Nonaktifkan pet lama
          await UserPet.update(
            { isActive: false },
            { where: { userId: user.id } },
          );

          // Buat Pet Mitologi Baru
          await UserPet.create({
            userId: user.id,
            petName: hatch.petName,
            petType: hatch.petType,
            isTamed: true,
            isActive: true,
            petLevel: 1,
            affection: 100,
            mood: "happy",
            evolutionStage: 1,
            passiveSkill: hatch.passiveSkill,
          });

          lines.push(
            `${ui.getEmoji("star") || "🌟"} **KEJAIBAN MITOLOGI!** Telur mitologi bergetar dahsyat dan menetaskan **${hatch.petName}**!`,
            `${hatch.desc}`,
            `> ${ui.getEmoji("battle") || "⚔️"} **Passive Skill Aktif:** \`${hatch.passiveSkill}\` (${hatch.skillDesc})`,
            `> ${ui.getEmoji("cat_pet") || "🐾"} Ketik \`/survival rpg pet\` untuk merawat, melihat evolusi, dan bermain bersamanya!`,
          );

          let petAttachment = null;
          const imgPath = path.join(
            __dirname,
            `../../../assets/survival/pets/${hatch.imgName}`,
          );
          if (fs.existsSync(imgPath)) {
            petAttachment = new AttachmentBuilder(imgPath, { name: "pet.png" });
          }

          const done = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFD700",
            authorName: "Naura Mythic Hatching",
            title: hatch.title,
            iconURL: user.displayAvatarURL(),
            expression: "cheers",
            description: lines.join("\n"),
            bannerAttachmentName: petAttachment ? "pet.png" : undefined,
            footerText: ui.getFooter("survival"),
          });

          return i.editReply({
            ...done,
            files: petAttachment ? [petAttachment] : [],
            embeds: [],
          });
        } else if (conf.effect === "max_romance") {
          lines.push(
            `${e("blowkiss", "\uD83D\uDC8D")} Kamu resmi menikah dengan **${result.npcName}**! Naura ikut menangis bahagia, sungguh...`,
          );
        } else if (conf.effect === "luck_crown") {
          lines.push(
            `${e("impressed", "\uD83D\uDC51")} LUCK kamu naik dari **${result.before}** jadi **${result.after}** (+${result.gained}) selamanya!`,
          );
        } else {
          lines.push(
            `${e("cheers", "\u2728")} **${result.label}** sudah aktif buat kamu, permanen tanpa kedaluwarsa.`,
          );
        }

        const done = buildContainerV2({
          accentColorHex: ui.getColor("success") || "#00FF00",
          authorName: "Naura Survival Kit",
          title: `${e("cheers", "\uD83C\uDF1F")} Khasiatnya aktif!`,
          iconURL: user.displayAvatarURL(),
          expression: "reward",
          description: lines.join("\n"),
          footerText: ui.getFooter("survival"),
        });

        return i.editReply({ ...done, embeds: [] });
      }

      // Normalisasi: item katalog pakai kunci 'health', item lama pakai 'hp'.
      const effects = conf.effects || {};
      const hpGain = Number(effects.hp || effects.health || 0);
      const hungerGain = Number(effects.hunger || 0);
      const thirstGain = Number(effects.thirst || 0);
      const staminaGain = Number(effects.stamina || 0);

      // Hitung level cap HP
      const level = survival.survival_level || 1;
      const maxStat = leveling.getMaxStatCap(level);
      const activeStrength = Math.min(survival.strength || 1, maxStat);
      const maxPlayerHP =
        100 + Math.floor(level / 5) * 10 + activeStrength * 10;

      // Hitung nilai baru dengan clamp agar tidak melebihi batas maksimum
      const currentHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;
      const newHP = Math.min(maxPlayerHP, currentHP + hpGain);
      const newHunger = Math.min(100, Math.max(0, (survival.hunger || 0) + hungerGain));
      const newThirst = Math.min(100, Math.max(0, (survival.thirst || 0) + thirstGain));
      const newStamina = Math.min(100, Math.max(0, (survival.stamina || 0) + staminaGain));

      // Simpan hanya kolom yang berubah secara atomik
      const survivalPatch = {};
      if (hungerGain !== 0) survivalPatch.hunger = newHunger;
      if (thirstGain !== 0) survivalPatch.thirst = newThirst;
      if (staminaGain !== 0) survivalPatch.stamina = newStamina;
      if (hpGain !== 0) survivalPatch.hp = newHP;

      if (Object.keys(survivalPatch).length > 0) {
        await cacheManager.updateUserSurvival(user.id, survivalPatch);
      }

      await takeItemsAtomic(user.id, [{ id: selectedId, amount: 1 }]);
      await leveling.addPlayerXP(user.id, 1);

      // Susun pesan kondisi setelah konsumsi
      const refreshed = await cacheManager.getUserSurvival(user.id);
      const displayHunger = refreshed.hunger ?? newHunger;
      const displayThirst = refreshed.thirst ?? newThirst;
      const displayStamina = refreshed.stamina ?? newStamina;
      const displayHP = refreshed.hp ?? newHP;

      const lines = [
        `Nyam nyam~ kamu menghabiskan **${conf.name}**. Enak, kan? Naura senang lihat kamu makan.`,
        "",
        `**${e("read", "\u2728")} Kondisimu sekarang**`,
      ];

      if (hungerGain > 0)
        lines.push(`> ${e("eat", "\uD83C\uDF54")} Lapar: \`${displayHunger}/100\` *(+${hungerGain})*`);
      if (thirstGain > 0)
        lines.push(`> ${e("chirping", "\uD83E\uDD64")} Haus: \`${displayThirst}/100\` *(+${thirstGain})*`);
      if (staminaGain > 0)
        lines.push(`> ${e("happy", "\u26A1")} Stamina: \`${displayStamina}/100\` *(+${staminaGain})*`);
      if (hpGain > 0)
        lines.push(`> ${e("cheers", "\u2764\uFE0F")} HP: \`${displayHP}\` *(+${hpGain} dipulihkan)*`);

      if (hungerGain === 0 && thirstGain === 0 && staminaGain === 0 && hpGain === 0) {
        lines.push("> *(Item ini tidak memberikan efek statistik langsung.)*");
      }

      lines.push(
        "",
        `${e("impressed", "\uD83C\uDF1F")} Naura kasih bonus **+1 XP**. Semangat terus, ya!`,
      );

      const success = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Naura Survival Kit",
        title: `${e("eat", "\uD83D\uDE0B")} Yummy, habis!`,
        iconURL: user.displayAvatarURL(),
        expression: "success",
        description: lines.join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("vitals", user.id)],
        footerText: ui.getFooter("survival"),
      });

      await i.editReply({ ...success, embeds: [] });
    });

      collector.on("end", (collected) => {
        if (collected.size > 0) return;

        const timeout = buildErrorContainerV2({
          title: `${e("sleepy", "\u231B")} Waktunya habis`,
          description:
            "Naura sudah tunggu satu menit, tapi belum ada yang dipilih. Nggak apa-apa, panggil Naura lagi kalau perut kamu sudah keroncongan!",
          buttonsRow: [survivalUI.buildSurvivalActionRow("vitals", user.id)],
          footerText: ui.getFooter("survival"),
        });

        interaction.editReply({ ...timeout, embeds: [] }).catch(() => {});
      });
    } catch (err) {
      logger.error("[SURVIVAL CONSUME ERROR]", err);
      const errPayload = buildErrorContainerV2({
        title: `${e("akward", "😅")} Gagal Membuka Bekal`,
        description:
          "Duh, ada sedikit kendala waktu Naura merapikan bekalmu. Coba buka kembali sebentar lagi ya!",
        footerText: ui.getFooter("survival"),
      });
      return interaction.editReply({ ...errPayload, embeds: [] }).catch(() => {});
    }
  },
};
