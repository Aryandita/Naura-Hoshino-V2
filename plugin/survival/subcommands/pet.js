"use strict";

/**
 * @module pet
 * @description Subcommand /survival pet - Pet companion system dengan taming, feeding, dan idle gathering.
 * 
 * Fitur Utama:
 * - Pet taming dengan success rate
 * - Feeding dan care system
 * - Idle gathering assignment
 * - Pet stat bonus ke owner
 * - Pet evolution/path
 */

const { logger } = require("../../../src/managers/logger");

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");

// ============================================================================
// CONSTANTS
// ============================================================================

const UserSurvival = require("../../../src/models/UserSurvival");
const UserPet = require("../../../src/models/UserPet");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const {
  safeParseInventory,
  findItem,
  takeItemsAtomic,
  addItemsAtomic,
} = require("../../../src/survival/engines/inventoryHelper");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const petActions = require("../../../src/survival/helpers/petActions");
const {
  getPetRarityInfo,
  rollPetForaging,
  REAL_WORLD_SPECIES,
} = require("../../../src/survival/helpers/petRarity");
const fs = require("fs");
const path = require("path");
const { AttachmentBuilder } = require("discord.js");

const COLLECTOR_MS = 60000;
const BREED_FEE = 5000;
const XP_PER_MEAL = 20;
const XP_PER_LEVEL = 100;

// ID di bawah ini sudah dicocokkan dengan katalog item.
const PET_FOODS = [
  { id: "bone", hunger: 20 },
  { id: "small_fish", hunger: 30 },
  { id: "mystic_herb", hunger: 40 },
  { id: "dragon_meat", hunger: 60 },
];

function e(name, fallback) {
  return ui.getEmoji(name) || fallback;
}

function ephemeral(content) {
  return { content, flags: MessageFlags.Ephemeral };
}

function petLabel(pet) {
  return pet.petName || pet.petType;
}

function statLines(pet) {
  const { species, tier, displayName } = getPetRarityInfo(pet);
  const buffText =
    pet.passiveSkill && pet.passiveSkill !== "none"
      ? `\n**Bakat Alam:** \`${pet.passiveSkill}\``
      : "";
  const hungerBar = survivalUI.buildVitalsBar({
    current: pet.hunger || 0,
    target: 100,
    length: 8,
    showPercentage: true,
  });
  const affectionBar = survivalUI.buildVitalsBar({
    current: pet.affection || 0,
    target: 100,
    length: 8,
    showPercentage: true,
  });
  return [
    `**Sahabat Setia:** **${displayName}**`,
    `**Spesies Alami:** ${species.emoji} **${species.name}** (*${species.latin}*)`,
    `**Tingkatan Rarity:** \`[Tier ${tier.badge}] ${tier.label}\``,
    `**Level Pertumbuhan:** Level ${pet.petLevel || 1} (${pet.petExp || 0}/${XP_PER_LEVEL} XP)`,
    `ðŸ **Kenyang:** \`${hungerBar.bar}\` | ðŸ’ **Afeksi:** \`${affectionBar.bar}\``,
    `**Kondisi Mood:** \`${String(pet.mood || "normal").toUpperCase()}\`${buffText}`,
  ].join("\n");
}

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  async autocomplete(interaction) {
    const {
      choice,
      safeRespond,
      fuzzyFilter,
    } = require("../../../src/utils/autocompleteHelper");
    const focusedValue = interaction.options.getFocused().toLowerCase();
    const pets = await UserPet.findAll({
      where: { userId: interaction.user.id },
    });
    if (pets.length === 0)
      return safeRespond(interaction, [
        choice(
          "âŒ Belum memiliki pet (Ketik /survival rpg pet untuk info)",
          "none",
        ),
      ]);

    const available = pets.map((p) =>
      choice(
        `${ui.getEmoji("cat_pet") || "ðŸ¾"} ${p.petName || p.petType} (Lv.${p.petLevel || 1})`,
        String(p.id),
      ),
    );

    return safeRespond(interaction, fuzzyFilter(available, focusedValue, 25));
  },

  /**
   * Handler utama untuk command /survival pet
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.user;
    await UserSurvival.findOrCreate({ where: { userId: user.id } });

    const pets = await UserPet.findAll({ where: { userId: user.id } });
    const action = interaction.options.getString("aksi");
    const targetPetIdOption = interaction.options.getInteger("target_pet_id");

    // Tangani kondisi pengguna belum memiliki pet
    if (pets.length === 0) {
      if (action === "adopt") {
        const starterType = interaction.options.getString("nama_pet") || "kucing_kampung";
        const species = REAL_WORLD_SPECIES[starterType] || REAL_WORLD_SPECIES.kucing_kampung;
        await UserPet.create({
          userId: user.id,
          petType: species.id,
          petName: species.name,
          isTamed: true,
          isActive: true,
          petLevel: 1,
          petExp: 0,
          hunger: 100,
          affection: species.baseAffection || 50,
          mood: "happy",
          evolutionStage: 1,
        });

        const adoptPayload = buildContainerV2({
          accentColorHex: survivalUI.getColor("emerald"),
          authorName: "Adopsi Sahabat Satwa Naura Wilds",
          title: `ðŸŽ‰ Selamat Mengadopsi ${species.name}!`,
          description: [
            `Kamu telah resmi mengangkat **${species.name}** (*${species.latin}*) sebagai sahabat setia petualanganmu!`,
            ``,
            `ðŸ“– **Profil Satwa:**`,
            `*${species.description}*`,
            ``,
            `ðŸ’¡ **Satu Sahabat Setia:** Di Naura Wilds, pengembara hanya memiliki 1 sahabat setia yang dirawat bersama. Ajak main, beri makan, dan kirim ke ekspedisi untuk menemukan barang berharga!`,
          ].join("\n"),
          buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
          footerText: ui.getFooter("survival"),
        });
        return interaction.editReply(adoptPayload);
      }
      return ui.sendError(interaction, "err_sys_55", true);
    }

    const targetPetId = interaction.options.getString("nama_pet");
    let pet = pets.find((p) => p.isActive) || pets[0];
    if (targetPetId) {
      const matchedPet = pets.find((p) => String(p.id) === targetPetId);
      if (matchedPet) pet = matchedPet;
    }

    // Aturan Wajib: 1 Pet Setia per User
    if (action === "adopt") {
      const { displayName, species } = getPetRarityInfo(pet);
      return interaction.editReply(
        buildErrorContainerV2({
          title: "Sudah Memiliki Sahabat Setia",
          description: `Kamu sudah memiliki sahabat setia **${displayName}** (${species.name}). Di Naura Wilds, setiap pengembara berfokus merawat 1 sahabat sejati untuk membangun ikatan jiwa yang mendalam!`,
          footerText: ui.getFooter("survival"),
        }),
      );
    }

    // 1. KUNJUNGI PET HABITAT (SANCTUARY)
    if (action === "habitat") {
      const petHabitatEngine = require("../../../src/survival/engines/petHabitatEngine");
      const canvasWorkerPool = require("../../../src/canvas/canvasWorkerPool");
      const habitatData = await petHabitatEngine.getHabitat(user.id);
      const files = [];

      try {
        const habitatBuffer = await canvasWorkerPool.execute("renderPetHabitat", habitatData);
        files.push(
          new AttachmentBuilder(habitatBuffer, { name: "pet_habitat.png" }),
        );
      } catch (err) {
        logger.warn("[pet:execute] Render visual canvas atau pemuatan aset gagal: " + (err?.message || err));
      }

      const active = habitatData.activePet || pet;
      const payload = buildContainerV2({
        accentColorHex: active.cosmicAura
          ? survivalUI.getRarityColor("epic")
          : survivalUI.getRarityColor("mythic"),
        authorName: `${ui.getEmoji("home") || "ðŸ¡"} Sanctuary & Cosmic Pet Habitat`,
        title: `${ui.getEmoji("sparkles") || "âœ¨"} Kamar Santai ${active.petName || active.petType}`,
        description: [
          `Selamat datang di ruang santai habitat peliharaanmu! Di sini kamu bisa merawat dan bermain bersama pet aktif.`,
          ``,
          `${ui.getEmoji("cat_pet") || "ðŸ¾"} **Pet Aktif:** **${active.petName || active.petType}** (Level ${active.petLevel || 1})`,
          `${ui.getEmoji("heart") || "ðŸ’–"} **Kasih Sayang:** \`${active.affection || 0}%\` | **Mood:** \`${String(active.mood || "happy").toUpperCase()}\``,
          active.cosmicAura
            ? `${ui.getEmoji("sparkle") || "ðŸŒŒ"} **Status Khusus:** \`COSMIC ASCENDED ${ui.getEmoji("sparkles") || "âœ¨"}\` (Skill: \`${active.passiveSkill}\`)`
            : `${ui.getEmoji("magic") || "ðŸ”®"} **Evolusi:** \`Stage ${active.evolutionStage || 1}\``,
          ``,
          `${ui.getEmoji("arcade") || "ðŸŽ¾"} **Mainan Tersedia:** \`Cyber Laser Pointer\`, \`Sakura Plush Ball\`, \`Catnip Circuit\``,
          ``,
          `-# ${ui.getEmoji("sparkle") || "ðŸ’¡"} *Untuk melakukan Cosmic Fusion, naikkan 2 pet ke Level 10 lalu jalankan \`/survival life pet aksi:fuse\`!*`,
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply({ ...payload, files });
    }

    // 2. COSMIC ASCENSION FUSION
    if (action === "fuse") {
      const petHabitatEngine = require("../../../src/survival/engines/petHabitatEngine");
      if (!targetPetIdOption) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pet Bahan Diperlukan",
            description:
              "Tentukan ID Pet kedua yang akan dikorbankan menggunakan opsi `target_pet_id`!",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const fuseRes = await petHabitatEngine.fusePets(
        user.id,
        pet.id,
        targetPetIdOption,
      );
      if (!fuseRes.success) {
        let msg = "Gagal melakukan Cosmic Fusion.";
        if (fuseRes.reason === "SAME_PET_SELECTED")
          msg = "Kamu tidak bisa menggabungkan pet dengan dirinya sendiri!";
        if (fuseRes.reason === "PETS_NOT_FOUND")
          msg = "Salah satu atau kedua pet tidak ditemukan di kandangmu!";
        if (fuseRes.reason === "MAX_LEVEL_REQUIRED")
          msg = `Kedua pet harus mencapai Level Maksimal (Level 10) untuk Cosmic Ascension! (Pet 1: Lv.${fuseRes.pet1Level}, Pet 2: Lv.${fuseRes.pet2Level})`;

        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Cosmic Fusion Gagal",
            description: msg,
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: survivalUI.getRarityColor("epic"),
        authorName: `${ui.getEmoji("sparkle") || "ðŸŒŒ"} Ritual Cosmic Pet Ascension`,
        title: `${ui.getEmoji("celebrate") || "ðŸŽ‰"} COSMIC ASCENSION BERHASIL!`,
        description: [
          `Selamat! Dua energi pet telah menyatu menjadi wujud baru: **${fuseRes.newType.toUpperCase().replace("_", " ")}**!`,
          ``,
          `${ui.getEmoji("sparkles") || "âœ¨"} **Cosmic Aura:** \`AKTIF ${ui.getEmoji("sparkle") || "ðŸŒŒ"}\``,
          `${ui.getEmoji("magic") || "ðŸ”®"} **Passive Skill Baru:** \`${fuseRes.passiveSkill}\``,
          `${ui.getEmoji("sparkles") || "ðŸ’«"} **Mood Abadi:** \`ASCENDED\``,
          ``,
          `-# ${ui.getEmoji("sparkle") || "ðŸ’¡"} *Pet varian Cosmic memberikan bonus drop rate dan damage tertinggi saat ekspedisi dan raid!*`,
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // 2b. PERKAWINAN SILANG (BREED)
    if (action === "breed") {
      const petHabitatEngine = require("../../../src/survival/engines/petHabitatEngine");
      if (!targetPetIdOption) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Pasangan Pet Diperlukan",
            description:
              "Tentukan ID Pet kedua sebagai pasangan perkawinan silang menggunakan opsi `target_pet_id`!",
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const breedRes = await petHabitatEngine.breedPets(
        user.id,
        pet.id,
        targetPetIdOption,
      );
      if (!breedRes.success) {
        let msg = "Gagal melakukan perkawinan silang.";
        if (breedRes.reason === "SAME_PET_SELECTED")
          msg = "Kamu tidak bisa mengawinkan pet dengan dirinya sendiri!";
        if (breedRes.reason === "PETS_NOT_FOUND")
          msg = "Salah satu pet tidak ditemukan di kandangmu!";
        if (breedRes.reason === "AFFECTION_TOO_LOW")
          msg =
            "Kedua pet harus memiliki kasih sayang maksimal (Affection >= 100) untuk dikawinkan!";
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Perkawinan Silang Gagal",
            description: msg,
            footerText: ui.getFooter("survival"),
          }),
        });
      }

      const baby = breedRes.offspring;
      const payload = buildContainerV2({
        accentColorHex: survivalUI.getRarityColor("mythic"),
        authorName: "PET BREEDING & GENETICS SANCTUARY",
        title: "ðŸ§¬ Kelahiran Pet Hibrida Berhasil!",
        description: [
          `Selamat! Dari perkawinan silang penuh kasih sayang, lahir bayi pet baru: **${baby.petName || baby.petType}**!`,
          "",
          `ðŸ¾ **Spesies Hibrida:** \`${baby.petType.toUpperCase()}\``,
          `â­ **Bakat Pasif Terwaris:** \`${baby.passiveSkill || "HYBRID_VITALITY"}\``,
          `ðŸ’– **Status Awal:** Kasih Sayang \`${baby.affection}%\` | Mood \`${String(baby.mood || "happy").toUpperCase()}\``,
          "",
          `-# ðŸ’¡ *Rawat buah hati peliharaan barumu di Pet Habitat dengan mainan dan makanan lezat!*`,
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
        footerText: ui.getFooter("survival"),
      });

      return interaction.editReply(payload);
    }

    // Handle Image attachment
    const getPetImage = (petType) => {
      const imgPath = path.join(
        __dirname,
        "../../../assets/survival/pets",
        `${petType}.png`,
      );
      if (fs.existsSync(imgPath)) {
        return new AttachmentBuilder(imgPath, { name: "pet.png" });
      }
      return null;
    };

    const buildPetPayload = (moodEmoji, closing, imgAttachment, buttonsRow) =>
      buildContainerV2({
        accentColorHex: survivalUI.getColor("emerald"),
        authorName: "Naura Pet Care",
        title: `${e(moodEmoji, "\uD83D\uDC3E")} ${petLabel(pet)} nemenin kamu`,
        iconURL: user.displayAvatarURL(),
        description: `${statLines(pet)}\n\n${closing}`,
        footerText: ui.getFooter("survival"),
        bannerAttachmentName: imgAttachment ? "pet.png" : undefined,
        files: imgAttachment ? [imgAttachment] : [],
        buttonsRow,
      });

    const greeting = `Naura sempat main sama ${petLabel(pet)} tadi, lucu banget! Rawat dia terus yaa. Kalau sudah cukup kuat, Ki Prawiro mau bantu breeding, lho.`;

    const buildRow = (disabled = false) =>
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("pet_feed")
          .setLabel("Beri Makan")
          .setStyle(ButtonStyle.Success)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pet_play")
          .setLabel("Ajak Main")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pet_forage")
          .setLabel("Ekspedisi Alam")
          .setStyle(ButtonStyle.Primary)
          .setDisabled(disabled),
        new ButtonBuilder()
          .setCustomId("pet_breed")
          .setLabel("Breeding (Ki Prawiro)")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(disabled),
      );

    const imgBase = getPetImage(pet.petType);
    const basePayload = buildPetPayload("happy", greeting, imgBase, [
      buildRow(),
    ]);

    const processPlay = async (responder, asFollowUp = true) => {
      pet.hunger = Math.max(0, (pet.hunger || 0) - 10);
      pet.affection = Math.min(100, (pet.affection || 0) + 15);
      pet.petExp = (pet.petExp || 0) + Math.floor(XP_PER_MEAL / 2);

      let naikLevel = false;
      while (pet.petExp >= XP_PER_LEVEL) {
        pet.petExp -= XP_PER_LEVEL;
        pet.petLevel = (pet.petLevel || 1) + 1;
        naikLevel = true;
      }

      petActions.evaluateMood(pet);
      const evo = petActions.evaluateEvolution(pet);
      // Rule 1.8: fields eksplisit sesuai kolom yang dimutasi play/feed.
      await pet.save({
        fields: [
          "hunger",
          "affection",
          "petExp",
          "petLevel",
          "mood",
          "evolutionStage",
          "petType",
        ],
      });

      if (evo.evolved) {
        const evoPayload = ephemeral(
          `${ui.getEmoji("star") || "ðŸŒŸ"} **LUAR BIASA!** Peliharaanmu **${evo.oldName}** berevolusi menjadi **${evo.newName}**!`,
        );
        if (asFollowUp) responder.followUp(evoPayload);
        else interaction.followUp(evoPayload);
      } else if (naikLevel) {
        const lvlPayload = ephemeral(
          `${e("impressed", "\uD83C\uDF89")} **${petLabel(pet)}** naik ke Level ${pet.petLevel}!`,
        );
        if (asFollowUp) responder.followUp(lvlPayload);
        else interaction.followUp(lvlPayload);
      }

      const img = getPetImage(pet.petType);
      const payload = buildPetPayload(
        pet.mood === "happy" ? "happy" : "normal",
        `Woof! ${petLabel(pet)} bereaksi diajak bermain.`,
        img,
        [buildRow()],
      );

      if (asFollowUp) return responder.editReply(payload);
      else return responder.reply(payload);
    };

    const processFeed = async (responder, asFollowUp = true) => {
      const profile = await cacheManager.getUserProfile(user.id);
      const inv = safeParseInventory(profile.inventory);

      const food = PET_FOODS.find((f) => findItem(inv, f.id));
      if (!food) {
        const errPayload = ephemeral(
          `${e("akward", "\u274C")} Tas kamu belum ada makanan hewan. Coba beli Tulang atau Ikan Kecil dulu yaa!`,
        );
        return asFollowUp
          ? responder.followUp(errPayload)
          : responder.reply(errPayload);
      }

      const taken = await takeItemsAtomic(user.id, [{ id: food.id, amount: 1 }]);
      if (!taken.ok) {
        const errPayload = ephemeral(
          `${e("akward", "\u274C")} Tas kamu belum ada makanan hewan. Coba beli Tulang atau Ikan Kecil dulu yaa!`,
        );
        return asFollowUp
          ? responder.followUp(errPayload)
          : responder.reply(errPayload);
      }

      pet.hunger = Math.min(100, (pet.hunger || 0) + food.hunger);
      pet.affection = Math.min(100, (pet.affection || 0) + 5);
      pet.petExp = (pet.petExp || 0) + XP_PER_MEAL;

      let naikLevel = false;
      while (pet.petExp >= XP_PER_LEVEL) {
        pet.petExp -= XP_PER_LEVEL;
        pet.petLevel = (pet.petLevel || 1) + 1;
        naikLevel = true;
      }

      petActions.evaluateMood(pet);
      const evo = petActions.evaluateEvolution(pet);
      // Rule 1.8: fields eksplisit sesuai kolom yang dimutasi play/feed.
      await pet.save({
        fields: [
          "hunger",
          "affection",
          "petExp",
          "petLevel",
          "mood",
          "evolutionStage",
          "petType",
        ],
      });

      const questGen = require("../../../src/survival/engines/questGenerator");
      await questGen
        .incrementQuestProgress(user.id, "pet_feed", 1)
        .catch(() => {});

      if (evo.evolved) {
        const evoPayload = ephemeral(
          `${ui.getEmoji("star") || "ðŸŒŸ"} **LUAR BIASA!** Peliharaanmu **${evo.oldName}** berevolusi menjadi **${evo.newName}**!`,
        );
        if (asFollowUp) responder.followUp(evoPayload);
        else interaction.followUp(evoPayload);
      } else if (naikLevel) {
        const lvlPayload = ephemeral(
          `${e("impressed", "\uD83C\uDF89")} **${petLabel(pet)}** naik ke Level ${pet.petLevel}! Naura bangga banget sama kalian berdua.`,
        );
        if (asFollowUp) responder.followUp(lvlPayload);
        else interaction.followUp(lvlPayload);
      }

      const img = getPetImage(pet.petType);
      const payload = buildPetPayload(
        pet.mood === "happy" ? "happy" : "normal",
        `Nyam nyam... ${petLabel(pet)} makan dengan lahap. Naura ikut senang lihatnya!`,
        img,
        [buildRow()],
      );

      if (asFollowUp) return responder.editReply(payload);
      else return responder.reply(payload);
    };

    const processForage = async (responder, asFollowUp = true) => {
      if ((pet.hunger || 0) < 20) {
        const hungryPayload = ephemeral(
          `${e("cry", "ðŸ˜¿")} **${petLabel(pet)}** tampak lesu dan kelaparan (${pet.hunger || 0}/100). Beri makan terlebih dahulu sebelum berangkat ekspedisi!`,
        );
        return asFollowUp
          ? responder.followUp(hungryPayload)
          : responder.reply(hungryPayload);
      }

      const foraged = rollPetForaging(pet);
      const { getItemFromCatalog } = require("../../../src/survival/data/items_catalog");
      const foundItem = getItemFromCatalog(foraged.itemId);

      pet.hunger = Math.max(0, (pet.hunger || 0) - 15);
      pet.petExp = (pet.petExp || 0) + foraged.earnedXp;
      pet.affection = Math.min(100, (pet.affection || 0) + 5);

      let naikLevel = false;
      while (pet.petExp >= XP_PER_LEVEL) {
        pet.petExp -= XP_PER_LEVEL;
        pet.petLevel = (pet.petLevel || 1) + 1;
        naikLevel = true;
      }

      petActions.evaluateMood(pet);
      await Promise.all([
        addItemsAtomic(user.id, [
          { id: foraged.itemId, amount: foraged.qty },
        ]),
        cacheManager.incrementUserProfile(user.id, "economy_wallet", foraged.bonusCoins),
        pet.save({
          fields: [
            "hunger",
            "affection",
            "petExp",
            "petLevel",
            "mood",
            "evolutionStage",
            "petType",
          ],
        }),
      ]);

      const questGen = require("../../../src/survival/engines/questGenerator");
      await questGen
        .incrementQuestProgress(user.id, "pet_forage", 1)
        .catch(() => {});

      const foragePayload = buildContainerV2({
        accentColorHex: foraged.tier.color || survivalUI.getColor("emerald"),
        authorName: `ðŸ§­ Ekspedisi Alam: ${foraged.petName}`,
        title: `ðŸŽ’ ${foraged.petName} Membawa Temuan Berharga!`,
        description: [
          `**${foraged.story}**`,
          ``,
          `ðŸ“¦ **Temuan Eksklusif Satwa:**`,
          `â€¢ ${foundItem ? foundItem.emoji : "ðŸ“¦"} **${foundItem ? foundItem.name : foraged.itemId}** x${foraged.qty} (\`Tier ${foraged.tier.badge} - ${foraged.tier.rarity}\`)`,
          `â€¢ ðŸª™ **Koin Ditemukan:** \`+${foraged.bonusCoins.toLocaleString("id-ID")} Coin\``,
          `â€¢ â­ **Pertumbuhan Pet:** \`+${foraged.earnedXp} XP\`, \`+5 Kasih Sayang\`${naikLevel ? `\nâ€¢ ðŸŽ‰ **Naik ke Level ${pet.petLevel}!**` : ""}`,
          `â€¢ ðŸ– **Kondisi:** \`-15 Kenyang\` (Sisa: ${pet.hunger}/100)`,
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("profile", user.id)],
        footerText: ui.getFooter("survival"),
      });

      return asFollowUp
        ? responder.followUp(foragePayload)
        : responder.reply(foragePayload);
    };

    let message = null;
    if (action === "feed") {
      const reply = await processFeed(interaction, false);
      if (reply) return;
    } else if (action === "play") {
      const reply = await processPlay(interaction, false);
      if (reply) return;
    } else if (action === "forage" || action === "ekspedisi") {
      const reply = await processForage(interaction, false);
      if (reply) return;
    } else if (action === "tame") {
      const tamePayload = ephemeral(
        "Naura belum menemukan hewan liar yang bisa dijinakkan di sekitar sini!",
      );
      return interaction.deferred || interaction.replied
        ? interaction.followUp(tamePayload)
        : interaction.reply(tamePayload);
    } else {
      message = await (interaction.deferred || interaction.replied
        ? interaction.editReply(basePayload)
        : interaction.reply({ ...basePayload, fetchReply: true }));
    }

    if (!message) {
      message = await interaction.fetchReply().catch(() => null);
    }
    if (!message) return;

    const collector = message.createMessageComponentCollector({
      filter: (i) => i.user.id === user.id,
      time: COLLECTOR_MS,
    });

    collector.on("collect", async (i) => {
      await i.deferUpdate();

      if (i.customId === "pet_feed") {
        await processFeed(i, true);
      }
      if (i.customId === "pet_play") {
        await processPlay(i, true);
      }
      if (i.customId === "pet_forage") {
        await processForage(i, true);
      }

      if (i.customId === "pet_breed") {
        const eligiblePets = pets.filter((p) => (p.petLevel || 1) >= 15);

        if (eligiblePets.length < 2) {
          return i.followUp(
            ephemeral(
              `${e("thinking", "\u274C")} **Ki Prawiro:** "Kamu butuh setidaknya dua peliharaan Level 15 ke atas untuk di-breeding. Kembalilah nanti ya."`,
            ),
          );
        }

        const profile = await cacheManager.getUserProfile(user.id);
        if ((profile.economy_wallet || 0) < BREED_FEE) {
          return i.followUp(
            ephemeral(
              `${e("cry", "\u274C")} **Ki Prawiro:** "Jasa breeding butuh ${BREED_FEE.toLocaleString("id-ID")} Coin. Uangmu belum cukup."`,
            ),
          );
        }

        // Rule 1.8/1.10: potong biaya lewat debit atomik; profile dari cache
        // tidak punya .decrement(), dan penulisan wajib lewat cacheManager.
        const breedDebit = await cacheManager.debitUserProfile(
          user.id,
          "economy_wallet",
          BREED_FEE,
        );
        if (!breedDebit.ok) {
          return i.followUp(
            ephemeral(
              `${e("cry", "\u274C")} **Ki Prawiro:** "Jasa breeding butuh ${BREED_FEE.toLocaleString("id-ID")} Coin. Uangmu belum cukup."`,
            ),
          );
        }

        // Kombinasikan dua pet pertama yang level >= 15
        const p1 = eligiblePets[0];
        const p2 = eligiblePets[1];

        let resultType = "mutant_" + p1.petType;
        if (p1.petType !== p2.petType) resultType = "chimera";

        // Reset level indukan ke level 1? Atau biarkan saja? Biarkan saja sebagai bonus breeding.
        await UserPet.create({
          userId: user.id,
          petType: resultType,
          isTamed: true,
          affection: 50,
          mood: "happy",
          evolutionStage: 2, // Lahir langsung kuat
          passiveSkill:
            petActions.EVOLUTION_TREE && petActions.EVOLUTION_TREE["default"]
              ? petActions.EVOLUTION_TREE["default"][2].passive
              : "none",
        });

        return i.followUp(
          ephemeral(
            `${e("cheers", "\uD83E\uDDEC")} Proses Breeding oleh Ki Prawiro berhasil! Dari gabungan **${p1.petType}** dan **${p2.petType}**, lahir peliharaan baru bertipe **${resultType.toUpperCase()}**. Selamat yaa!`,
          ),
        );
      }
    });

    collector.on("end", async (collected, reason) => {
      if (reason === "navigated") return;
      // Pesan Components V2 tidak boleh diedit hanya dengan components saja,
      // seluruh payload harus dikirim ulang.
      const closingImg = getPetImage(pet.petType);
      const closing = buildPetPayload(
        "sleepy",
        `${petLabel(pet)} sudah ngantuk. Panggil Naura lagi kalau mau main sama dia, yaa!`,
        closingImg,
        [buildRow(true)],
      );
      await interaction.editReply(closing).catch(() => {});
    });
  },
};





