"use strict";

const { MessageFlags } = require("discord.js");
const UserPet = require("../../../src/models/UserPet");
const UserSurvival = require("../../../src/models/UserSurvival");
const redisManager = require("../../../src/managers/redisManager");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const { addItemsAtomic } = require("../../../src/survival/engines/inventoryHelper");
const notificationManager = require("../../../src/managers/notificationManager");

const EXPEDITION_DURATIONS = {
  1: { hours: 1, seconds: 3600, exp: 150, fragments: 80, loot: [{ id: "mystic_herb", amount: 2 }] },
  4: { hours: 4, seconds: 14400, exp: 600, fragments: 350, loot: [{ id: "dragon_meat", amount: 2 }, { id: "iron_ore", amount: 5 }] },
  8: { hours: 8, seconds: 28800, exp: 1500, fragments: 900, loot: [{ id: "legendary_gem", amount: 1 }, { id: "ancient_relic", amount: 2 }] },
};

module.exports = {
  async execute(interaction) {
    const userId = interaction.user.id;
    const durationHours = interaction.options.getInteger("durasi") || 1;

    const pet = await UserPet.findOne({ where: { userId, isActive: true } });
    if (!pet) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Tidak Ada Pet Aktif",
          description: "Kamu harus mengaktifkan satu Pet terlebih dahulu sebelum memulai ekspedisi!\nGunakan `/survival pet` untuk memilih pet aktif.",
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const expConfig = EXPEDITION_DURATIONS[durationHours] || EXPEDITION_DURATIONS[1];
    const redisKey = `pet_expedition:${userId}`;

    // Cek apakah sedang dalam ekspedisi
    const existing = await redisManager.getCache(redisKey);
    if (existing) {
      const expData = typeof existing === "string" ? JSON.parse(existing) : existing;
      const now = Date.now();
      const timeLeft = Math.max(0, Math.ceil((expData.endTime - now) / 1000));

      if (timeLeft > 0) {
        const minutes = Math.ceil(timeLeft / 60);
        return interaction.reply({
          ...buildContainerV2({
            accentColorHex: "#F59E0B",
            authorName: `${ui.getEmoji("cat_pet") || "🐾"} Pet Dungeon Expedition`,
            title: "Pet Sedang Menjelajah!",
            description: `Pet aktifmu **${pet.petName || pet.petType}** sedang dalam ekspedisi dungeon.\n\nSisa waktu: **${minutes} menit** lagi.\nNaura akan mengirimkan notifikasi saat pet kamu kembali membawa jarahan!`,
            footerText: ui.getFooter("survival"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      } else {
        // Klaim hasil ekspedisi
        await redisManager.deleteCache(redisKey);

        // Tambah Star Fragments dan Item
        await UserSurvival.increment({ starFragments: expData.fragments }, { where: { userId } });
        await addItemsAtomic(userId, expData.loot);

        // Tambah Pet EXP
        pet.petExp = (pet.petExp || 0) + expData.exp;
        if (pet.petExp >= 100) {
          pet.petLevel = (pet.petLevel || 1) + Math.floor(pet.petExp / 100);
          pet.petExp = pet.petExp % 100;
        }
        // Rule 1.8: fields eksplisit agar tidak menimpa kolom pet lain.
        await pet.save({ fields: ["petExp", "petLevel"] });

        const lootList = expData.loot.map((it) => `• **${it.id.replace("_", " ")}** x${it.amount}`).join("\n");
        const claimContainer = buildContainerV2({
          accentColorHex: "#10B981",
          authorName: `${ui.getEmoji("cat_pet") || "🐾"} Ekspedisi Selesai!`,
          title: `Pet ${pet.petName || pet.petType} Telah Kembali!`,
          description: `Pet kamu berhasil pulang membawa banyak jarahan berharga!\n\n**Hasil Ekspedisi:**\n- ${ui.getEmoji("star") || "⭐"} **+${expData.fragments} Star Fragments**\n- ${ui.getEmoji("cat_pet") || "🐾"} **+${expData.exp} Pet EXP** (Level Sekarang: **Lv.${pet.petLevel}**)\n\n**Barang Jarahan:**\n${lootList}`,
          footerText: ui.getFooter("survival"),
        });

        return interaction.reply(claimContainer);
      }
    }

    // Mulai ekspedisi baru
    const endTime = Date.now() + (expConfig.seconds * 1000);
    const expeditionPayload = {
      petId: pet.id,
      petName: pet.petName || pet.petType,
      durationHours,
      endTime,
      fragments: expConfig.fragments,
      exp: expConfig.exp,
      loot: expConfig.loot,
    };

    await redisManager.setCache(redisKey, JSON.stringify(expeditionPayload), expConfig.seconds + 60);

    const payload = buildContainerV2({
      accentColorHex: "#38BDF8",
      authorName: `${ui.getEmoji("cat_pet") || "🐾"} Pet Dungeon Expedition`,
      title: "Pet Berangkat Menjelajah!",
      description: `Pet kamu **${pet.petName || pet.petType}** telah berangkat menjelajahi dungeon selama **${durationHours} jam**!\n\n**Estimasi Hadiah:**\n- ${ui.getEmoji("star") || "⭐"} **+${expConfig.fragments} Star Fragments**\n- ${ui.getEmoji("cat_pet") || "🐾"} **+${expConfig.exp} Pet EXP**\n- ${ui.getEmoji("gift") || "🎁"} Bahan material langka`,
      footerText: ui.getFooter("survival"),
    });

    return interaction.reply(payload);
  },
};
