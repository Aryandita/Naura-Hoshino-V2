"use strict";

const UserPet = require("../../models/UserPet");
const cacheManager = require("../../managers/cacheManager");
const { logger } = require("../../managers/logger");

const AVAILABLE_TOYS = [
  {
    id: "laser_pointer",
    name: "Cyber Laser Pointer",
    cost: 25,
    moodBoost: "energized",
    expGain: 100,
  },
  {
    id: "sakura_ball",
    name: "Sakura Plush Ball",
    cost: 25,
    moodBoost: "happy",
    expGain: 100,
  },
  {
    id: "catnip_circuit",
    name: "Digital Catnip Circuit",
    cost: 35,
    moodBoost: "ascended",
    expGain: 150,
  },
];

class PetHabitatEngine {
  /**
   * Ambil status habitat dan daftar pet milik pemain
   */
  static async getHabitat(userId) {
    let pets = [];
    try {
      pets = await UserPet.findAll({ where: { userId } });
    } catch {
      pets = [];
    }
    const activePet = pets.find((p) => p.isActive) || pets[0] || null;

    return {
      pets: pets.map((p) => p.toJSON()),
      activePet: activePet
        ? typeof activePet.toJSON === "function"
          ? activePet.toJSON()
          : activePet
        : null,
      availableToys: AVAILABLE_TOYS,
    };
  }

  /**
   * Bermain dengan pet menggunakan mainan habitat
   */
  static async playWithToy(userId, petId, toyId = "laser_pointer") {
    const pet = await UserPet.findOne({ where: { id: petId, userId } });
    if (!pet) return { success: false, reason: "PET_NOT_FOUND" };

    const toyCost = 25;
    const debit = await cacheManager.debitUserSurvival(
      userId,
      "starFragments",
      toyCost,
    );
    if (!debit.ok) {
      return { success: false, reason: "INSUFFICIENT_FUNDS", cost: toyCost };
    }

    const expGain = 100;
    const newExp = Number(pet.petExp || 0) + expGain;
    let newLevel = Number(pet.petLevel || 1);
    let levelUp = false;

    const expReq = newLevel * 150;
    if (newExp >= expReq && newLevel < 10) {
      newLevel += 1;
      levelUp = true;
    }

    pet.petExp = newExp;
    pet.petLevel = newLevel;
    pet.affection = Math.min(100, Number(pet.affection || 0) + 15);
    pet.mood = pet.cosmicAura ? "ascended" : "energized";
    await pet.save({ fields: ["petExp", "petLevel", "affection", "mood"] });

    logger.info(
      `[PetHabitat] User ${userId} bermain dengan pet ${pet.petName || pet.petType}. Affection: ${pet.affection}`,
    );
    return {
      success: true,
      petName: pet.petName || pet.petType,
      mood: pet.mood,
      affection: pet.affection,
      expGain,
      currentLevel: newLevel,
      levelUp,
    };
  }

  /**
   * Peleburan 2 Pet Level 10 menjadi 1 Cosmic Ascended Pet (Pet Fusion)
   */
  static async fusePets(userId, petId1, petId2) {
    if (petId1 === petId2) {
      return { success: false, reason: "SAME_PET_SELECTED" };
    }

    const pet1 = await UserPet.findOne({ where: { id: petId1, userId } });
    const pet2 = await UserPet.findOne({ where: { id: petId2, userId } });

    if (!pet1 || !pet2) {
      return { success: false, reason: "PETS_NOT_FOUND" };
    }

    if (Number(pet1.petLevel) < 10 || Number(pet2.petLevel) < 10) {
      return {
        success: false,
        reason: "MAX_LEVEL_REQUIRED",
        pet1Level: pet1.petLevel,
        pet2Level: pet2.petLevel,
      };
    }

    // Hapus pet kedua sebagai bahan pengorbanan
    await pet2.destroy();

    // Naikkan pet pertama ke wujud Cosmic Ascension
    const originalType = pet1.petType.replace("cosmic_", "");
    pet1.petType = `cosmic_${originalType}`;
    pet1.cosmicAura = true;
    pet1.evolutionStage = 3;
    pet1.fusionCount = Number(pet1.fusionCount || 0) + 1;
    pet1.passiveSkill = "ASTRAL_BLESSING_SURGE";
    pet1.mood = "ascended";
    pet1.petLevel = 1;
    pet1.petExp = 0;
    await pet1.save({
      fields: [
        "petType",
        "cosmicAura",
        "evolutionStage",
        "fusionCount",
        "passiveSkill",
        "mood",
        "petLevel",
        "petExp",
      ],
    });

    logger.info(
      `[PetHabitat] User ${userId} membangkitkan Cosmic Pet: ${pet1.petType} (#${pet1.id})!`,
    );
    return {
      success: true,
      pet: pet1.toJSON(),
      newType: pet1.petType,
      passiveSkill: pet1.passiveSkill,
    };
  }

  /**
   * Perkawinan silang 2 pet afeksi maksimal (Affection >= 100) untuk menghasilkan keturunan hibrida
   * @param {string} userId
   * @param {number} petId1
   * @param {number} petId2
   * @returns {Promise<{ success: boolean, reason?: string, offspring?: object }>}
   */
  static async breedPets(userId, petId1, petId2) {
    if (Number(petId1) === Number(petId2)) {
      return { success: false, reason: "SAME_PET_SELECTED" };
    }

    const pet1 = await UserPet.findOne({ where: { id: petId1, userId } });
    const pet2 = await UserPet.findOne({ where: { id: petId2, userId } });

    if (!pet1 || !pet2) {
      return { success: false, reason: "PETS_NOT_FOUND" };
    }

    if (Number(pet1.affection || 0) < 100 || Number(pet2.affection || 0) < 100) {
      return {
        success: false,
        reason: "AFFECTION_TOO_LOW",
        pet1Affection: pet1.affection,
        pet2Affection: pet2.affection,
      };
    }

    const hybridType =
      pet1.petType === pet2.petType
        ? pet1.petType
        : `hybrid_${pet1.petType}_${pet2.petType}`;

    const hasCosmic = Boolean(pet1.cosmicAura || pet2.cosmicAura);
    const baby = await UserPet.create({
      userId,
      petType: hybridType,
      petName: `${pet1.petName || pet1.petType} Jr.`,
      isTamed: true,
      tamingProgress: 100,
      hunger: 100,
      affection: 40,
      isActive: false,
      petLevel: 1,
      petExp: 0,
      mood: "happy",
      evolutionStage: 1,
      passiveSkill: "HYBRID_VITALITY",
      cosmicAura: hasCosmic,
    });

    // Reset afeksi kedua indukan pasca melahirkan
    pet1.affection = 50;
    pet2.affection = 50;
    await pet1.save({ fields: ["affection"] }).catch(() => {});
    await pet2.save({ fields: ["affection"] }).catch(() => {});

    logger.info(
      `[PetHabitat] User ${userId} berhasil breeding ${pet1.petType} + ${pet2.petType} -> ${baby.petType} (#${baby.id})`,
    );

    return {
      success: true,
      offspring: baby.toJSON(),
    };
  }
}

module.exports = PetHabitatEngine;
module.exports.AVAILABLE_TOYS = AVAILABLE_TOYS;
