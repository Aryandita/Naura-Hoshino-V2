"use strict";

const {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} = require("discord.js");

const cacheManager = require("../../../src/managers/cacheManager");
const itemsConfig = require("../../../src/survival/data/items");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const ui = require("../../../src/config/ui");
const leveling = require("../../../src/survival/engines/survivalLeveling");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const { applyItemEffect } = require("../../../src/survival/helpers/specialEffects");

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
      footerText: ui.getFooter("survival"),
    });

    const response = await interaction.editReply({
      ...menuPayload,
      embeds: [],
      components: [...menuPayload.components, selectRow],
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

        const idx = inventory.findIndex((inv) => inv && inv.id === selectedId);
        if (idx > -1) {
          inventory.splice(idx, 1);
          await cacheManager.updateUserProfile(user.id, { inventory });
        }

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
            title: "✨ Kirin Surgawi Menetas!",
            desc: "Makhluk sakral pelindung dimensi Hoshino ini kini setia menemanimu.",
            skillDesc: "+30 HP, +15 DMG, +8 Dodge, +8 Crit (All-Rounder)"
          },
          egg_leviathan: {
            petType: "leviathan",
            petName: "Leviathan Samudra",
            passiveSkill: "tank_1",
            imgName: "leviathan.png",
            title: "🌊 Leviathan Laut Dalam Menetas!",
            desc: "Raksasa samudra purba ini melindungimu dengan lapisan aura perisai air abadi.",
            skillDesc: "+80 HP (Drastis!), +2 DMG, +1 Dodge, +1 Crit (Immortal Tanker)"
          },
          egg_bahamut: {
            petType: "bahamut",
            petName: "Bahamut Kehancuran",
            passiveSkill: "berserk_1",
            imgName: "bahamut.png",
            title: "🔥 Bahamut Kehancuran Menetas!",
            desc: "Naga api apokaliptik pembawa kehancuran mutlak siap membakar semua lawanmu.",
            skillDesc: "+5 HP, +35 DMG (Drastis!), +1 Dodge, +2 Crit (Pure Berserker)"
          },
          egg_garuda: {
            petType: "garuda",
            petName: "Garuda Badai Surya",
            passiveSkill: "agility_1",
            imgName: "garuda.png",
            title: "⚡ Garuda Badai Surya Menetas!",
            desc: "Dewa angin dan kilat suci ini memberimu kecepatan gerak secepat cahaya.",
            skillDesc: "+10 HP, +5 DMG, +20 Dodge & +15 Crit (Drastis!) (Phantom God)"
          }
        };

        if (MYTHIC_HATCH_DATA[conf.effect]) {
          const UserPet = require("../../../src/models/UserPet");
          const fs = require("fs");
          const path = require("path");
          const { AttachmentBuilder } = require("discord.js");
          const hatch = MYTHIC_HATCH_DATA[conf.effect];

          // Nonaktifkan pet lama
          await UserPet.update({ isActive: false }, { where: { userId: user.id } });

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
            passiveSkill: hatch.passiveSkill
          });

          lines.push(
            `🌟 **KEJAIBAN MITOLOGI!** Telur mitologi bergetar dahsyat dan menetaskan **${hatch.petName}**!`,
            `${hatch.desc}`,
            `> ⚔️ **Passive Skill Aktif:** \`${hatch.passiveSkill}\` (${hatch.skillDesc})`,
            `> 🐾 Ketik \`/survival rpg pet\` untuk merawat, melihat evolusi, dan bermain bersamanya!`
          );

          let petAttachment = null;
          const imgPath = path.join(__dirname, `../../../assets/survival/pets/${hatch.imgName}`);
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
            embeds: []
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

      const effects = conf.effects || {};
      const newHunger = Math.min(
        100,
        (survival.hunger || 0) + (effects.hunger || 0),
      );
      const newThirst = Math.min(
        100,
        (survival.thirst || 0) + (effects.thirst || 0),
      );
      const newStamina = Math.min(
        100,
        (survival.stamina || 0) + (effects.stamina || 0),
      );

      const level = survival.survival_level || 1;
      const maxStat = leveling.getMaxStatCap(level);
      const activeStrength = Math.min(survival.strength || 1, maxStat);
      const maxPlayerHP =
        100 + Math.floor(level / 5) * 10 + activeStrength * 10;

      let newHP = survival.hp !== undefined ? survival.hp : maxPlayerHP;
      if (effects.hp) newHP = Math.min(maxPlayerHP, newHP + effects.hp);

      await cacheManager.updateUserSurvival(user.id, {
        hp: newHP,
        hunger: newHunger,
        thirst: newThirst,
        stamina: newStamina,
      });

      const idx = inventory.findIndex((inv) => inv && inv.id === selectedId);
      if (idx > -1) {
        inventory.splice(idx, 1);
        await cacheManager.updateUserProfile(user.id, { inventory });
      }

      await leveling.addPlayerXP(user.id, 1);

      const lines = [
        `Nyam nyam~ kamu menghabiskan **${conf.name}**. Enak, kan? Naura senang lihat kamu makan.`,
        "",
        `**${e("read", "\u2728")} Kondisimu sekarang**`,
        `> ${e("eat", "\uD83C\uDF54")} Lapar: \`${newHunger}/100\``,
        `> ${e("chirping", "\uD83E\uDD64")} Haus: \`${newThirst}/100\``,
        `> ${e("happy", "\u26A1")} Stamina: \`${newStamina}/100\``,
      ];

      if (effects.hp) {
        lines.push(
          `> ${e("cheers", "\u2764\uFE0F")} HP: pulih **+${effects.hp}**`,
        );
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
        footerText: ui.getFooter("survival"),
      });

      interaction.editReply({ ...timeout, embeds: [] }).catch(() => {});
    });
  },
};
