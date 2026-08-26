"use strict";

const { ActionRowBuilder, StringSelectMenuBuilder } = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const UserFarm = require("../../../src/models/UserFarm");
const UserPet = require("../../../src/models/UserPet");
const UserNPC = require("../../../src/models/UserNPC");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const currency = require("../../../src/survival/engines/currency");
const { rollCouponDrop } = require("../../../src/survival/helpers/couponRewards");
const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");

const REQUIRED_LEVEL = 100;
const COLLECTOR_MS = 60000;

const DIFFICULTIES = [
  {
    value: "Mudah",
    label: "Rebirth Mode MUDAH",
    emojiKey: "diff_easy",
    fallback: "\uD83D\uDFE2",
    perk: "EXP +15%, NSF +5%, penurunan stamina -10%",
  },
  {
    value: "Normal",
    label: "Rebirth Mode NORMAL",
    emojiKey: "diff_normal",
    fallback: "\uD83D\uDFE1",
    perk: "EXP +10%, NSF +3%, penurunan stamina -5%",
  },
  {
    value: "Sulit",
    label: "Rebirth Mode SULIT",
    emojiKey: "diff_hard",
    fallback: "\uD83D\uDFE0",
    perk: "EXP +5%, NSF +2,5%, penurunan stamina -3%",
  },
  {
    value: "Ekstrim",
    label: "Rebirth Mode EKSTRIM",
    emojiKey: "diff_extreme",
    fallback: "\uD83D\uDD34",
    perk: "musuh 100% lebih kuat, harga toko melonjak, EXP & NSF -20%. Tamatkan untuk gelar **The Strongest & Smartest Survivor**",
  },
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

module.exports = {
  async execute(interaction) {
    const user = interaction.user;
    const [survival] = await UserSurvival.findOrCreate({
      where: { userId: user.id },
    });

    const currentLevel = survival.survival_level || 1;
    if (currentLevel < REQUIRED_LEVEL) {
      return ui.sendError(
        interaction,
        `Sabar dulu yaa! Kamu perlu **Level ${REQUIRED_LEVEL}** untuk membuka Gerbang Reinkarnasi. Sekarang kamu masih di level ${currentLevel}, tapi Naura yakin kamu bisa sampai sana kok!`,
        true,
      );
    }

    const introPayload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFC0CB",
      authorName: "Gerbang Reinkarnasi",
      title: `${e("impressed", "\uD83C\uDF0C")} Kamu sudah sampai di puncak, lho!`,
      iconURL: user.displayAvatarURL(),
      description: [
        '> *"Naura ikut terharu lihat perjalananmu sampai sejauh ini... Tapi kalau kamu mau mulai lagi dari awal, Naura temani kok!"*',
        "",
        "Reinkarnasi akan **mengorbankan uang, properti, level, dan seluruh barangmu** demi bonus permanen di kehidupan berikutnya.",
        "",
        `${e("naura", "\uD83D\uDC96")} **Yang tetap kamu bawa:** Naura Coupon, khasiat permanen (Mahkota Keberuntungan dan kawan-kawannya), serta album kenangan fotomu. Itu kenangan dan hasil kerja kerasmu, jadi Naura nggak akan ambil.`,
        "",
        "*Pilih tingkat kesulitan kehidupan barumu:*",
        ...DIFFICULTIES.map(
          (d) => `> ${e(d.emojiKey, d.fallback)} **${d.value}:** ${d.perk}`,
        ),
      ].join("\n"),
      footerText: ui.getFooter("survival"),
    });

    const row = new ActionRowBuilder().addComponents(
      new StringSelectMenuBuilder()
        .setCustomId("rebirth_diff")
        .setPlaceholder("Pilih nasibmu selanjutnya...")
        .addOptions(
          DIFFICULTIES.map((d) => ({
            label: d.label,
            value: d.value,
            description: `Kehidupan baru tingkat ${d.value}`,
          })),
        ),
    );

    const response = await interaction.reply({
      ...introPayload,
      components: [...introPayload.components, row],
    });

    const collector = response.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();
      const difficulty = i.values[0];

      const profile = await cacheManager.getUserProfile(user.id);
      const previous = survival.rpg_state || {};

      // Hanya hal-hal yang memang hak milik pemain yang diwariskan ke
      // kehidupan berikutnya. Sisanya benar-benar direset.
      const carriedState = {
        difficulty,
        rebirth_count: (previous.rebirth_count || 0) + 1,
        beat_extreme:
          previous.beat_extreme || previous.difficulty === "Ekstrim",
        coupons: previous.coupons || 0,
        perks: previous.perks || {},
        gallery_album: previous.gallery_album || [],
        unlocked_cutscenes: previous.unlocked_cutscenes || [],
        vote_streak: previous.vote_streak || 0,
        vote_total: previous.vote_total || 0,
        last_vote_at: previous.last_vote_at || null,
        weather: "cerah",
        weather_hour: 0,
        unlocked_recipes: [],
        sick: false,
        tax_due: 0,
        house_seized: false,
        failed_exams: 0,
        test_cd: 0,
      };

      survival.hunger = 100;
      survival.thirst = 100;
      survival.stamina = 100;
      survival.hp = 100;
      survival.strength = 1;
      survival.agility = 1;
      survival.intelligence = 1;
      survival.luck = 1;
      survival.survival_xp = 0;
      survival.survival_level = 1;
      survival.starFragments = 0;
      survival.propertyId = "jalanan";
      // Memakai 'desa' agar cocok dengan data NPC dan toko.
      survival.currentLocation = "desa";
      survival.vehicle = null;
      survival.inGameDay = 1;
      survival.inGameHour = 6;
      survival.shop_purchases = {};
      survival.shop_last_reset_day = 1;
      survival.rpg_state = carriedState;
      survival.changed("rpg_state", true);

      // Dompet kota ikut dikosongkan; sebelumnya hanya tabungan yang direset
      // sehingga pemain bisa membawa seluruh Naura Coin melewati reinkarnasi.
      // Rule 1.10: penulisan UserProfile wajib lewat cacheManager agar cache
      // tidak menyimpan nilai lama dan antrean flush tidak tertimpa.
      await cacheManager.updateUserProfile(user.id, {
        economy_wallet: 0,
        economy_bank: 0,
        inventory: [],
        tool_pickaxeLevel: 1,
        tool_pickaxeDurability: 100,
        tool_axeLevel: 1,
        tool_axeDurability: 100,
        tool_fishingRodLevel: 1,
        tool_fishingRodDurability: 100,
        weapon_level: 1,
        dungeon_floor: 1,
      });

      await UserNPC.destroy({ where: { userId: user.id } });
      await UserFarm.destroy({ where: { userId: user.id } });
      await UserPet.destroy({ where: { userId: user.id } });

      // Rule 1.8: fields eksplisit sesuai daftar kolom yang memang direset.
      await survival.save({
        fields: [
          "hunger",
          "thirst",
          "stamina",
          "hp",
          "strength",
          "agility",
          "intelligence",
          "luck",
          "survival_xp",
          "survival_level",
          "starFragments",
          "propertyId",
          "currentLocation",
          "vehicle",
          "inGameDay",
          "inGameHour",
          "shop_purchases",
          "shop_last_reset_day",
          "rpg_state",
        ],
      });

      // Hadiah keberanian memulai dari nol.
      const coupon = await rollCouponDrop("rebirth", { survival });
      const couponEmoji = currency.emojiOf(currency.COUPON);

      const successPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFC0CB",
        authorName: "Gerbang Reinkarnasi",
        title: `${e("cheers", "\u2728")} Kamu lahir kembali!`,
        iconURL: user.displayAvatarURL(),
        description: [
          '> *"Cahaya hangat menyelimutimu... Selamat datang kembali! Naura senang banget bisa menemani kamu dari awal lagi."*',
          "",
          `Kamu terbangun sebagai sosok baru di tingkat kesulitan **${difficulty.toUpperCase()}**, tepat di Desa Pemula.`,
          coupon.gained
            ? `${couponEmoji} Naura titipkan **${coupon.gained} Naura Coupon** sebagai tanda hormat atas keberanianmu. Total kuponmu sekarang **${coupon.total}**.`
            : "",
          "",
          `${e("read", "\uD83D\uDCD6")} Reinkarnasi ke-**${carriedState.rebirth_count}**. Mulai lagi dengan \`/survival start\` yaa!`,
        ]
          .filter(Boolean)
          .join("\n"),
        footerText: ui.getFooter("survival"),
      });

      await i.editReply({
        ...successPayload,
        components: successPayload.components,
      });
      collector.stop();
    });
  },
};
