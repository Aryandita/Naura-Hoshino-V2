"use strict";

const { logger } = require("../../managers/logger");
const cacheManager = require("../../managers/cacheManager");

const GENETIC_TRAITS = ["swift", "strong", "lucky", "resilient", "intelligent"];
const MAX_GENERATION = 10;

class PetBreedingEngine {
  static async breedPets(userId, petId1, petId2) {
    try {
      const survival = await cacheManager.getUserSurvival(userId);
      const pets = survival?.pets || [];

      const pet1 = pets.find((p) => p.id === petId1);
      const pet2 = pets.find((p) => p.id === petId2);

      if (!pet1 || !pet2) return { ok: false, reason: "PET_NOT_FOUND" };
      if (pet1.species !== pet2.species) return { ok: false, reason: "INCOMPATIBLE_SPECIES" };

      const childGeneration = Math.min(MAX_GENERATION, Math.max(pet1.generation || 1, pet2.generation || 1) + 1);
      const inheritedTraits = this._inheritTraits(pet1.traits || [], pet2.traits || []);

      const childPet = {
        id: `pet_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        species: pet1.species,
        name: `${pet1.species} Gen${childGeneration}`,
        generation: childGeneration,
        traits: inheritedTraits,
        stats: this._inheritStats(pet1.stats || {}, pet2.stats || {}),
        bornAt: Date.now(),
      };

      pets.push(childPet);
      await cacheManager.updateUserSurvival(userId, { pets });

      logger.info(`[PetBreeding] ${userId} bred ${petId1} + ${petId2} -> ${childPet.id}`);
      return { ok: true, childPet };
    } catch (error) {
      logger.error(`[PetBreeding] Breed error:`, error);
      return { ok: false, reason: "INTERNAL_ERROR" };
    }
  }

  static _inheritTraits(parent1Traits, parent2Traits) {
    const allTraits = [...new Set([...parent1Traits, ...parent2Traits])];
    const inherited = [];
    for (const trait of allTraits) {
      if (Math.random() < 0.6) inherited.push(trait);
    }
    if (inherited.length === 0 && GENETIC_TRAITS.length > 0) {
      inherited.push(GENETIC_TRAITS[Math.floor(Math.random() * GENETIC_TRAITS.length)]);
    }
    return inherited.slice(0, 3);
  }

  static _inheritStats(stats1, stats2) {
    const childStats = {};
    const keys = new Set([...Object.keys(stats1), ...Object.keys(stats2)]);
    for (const key of keys) {
      const v1 = stats1[key] || 0;
      const v2 = stats2[key] || 0;
      childStats[key] = Math.round((v1 + v2) / 2 * (0.9 + Math.random() * 0.2));
    }
    return childStats;
  }
}

module.exports = { PetBreedingEngine, GENETIC_TRAITS, MAX_GENERATION };
