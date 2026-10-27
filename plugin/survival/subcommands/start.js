"use strict";

/**
 * @module start
 * @description Subcommand /survival start - Entry point untuk pemain baru memulai petualangan survival.
 * 
 * Fitur Utama:
 * - Deteksi pemain yang sudah pernah mengambil Starter Kit
 * - Interactive Onboarding Wizard V2 (Kuis Takdir, Arketipe, Bekal Awal)
 * - Validasi inventory flag "survival_started" untuk mencegah duplikasi starter
 * - Redirect ke gathering action row jika sudah memulai
 * - Ephemeral response untuk pemain yang sudah terdaftar
 * 
 * Alur Eksekusi:
 * 1. Cek profil dan inventory pemain via cacheManager
 * 2. Jika ada flag STARTER_FLAG -> tampilkan kartu "sudah memulai"
 * 3. Jika belum -> render onboarding prompt interaktif
 */

const { MessageFlags } = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const {
  renderOnboardingPrompt,
} = require("../../../src/survival/engines/playerOnboardingEngine");

// ============================================================================
// CONSTANTS
// ============================================================================

const STARTER_FLAG = "survival_started";

// ============================================================================
// HANDLER
// ============================================================================

module.exports = {
  /**
   * Handler utama untuk command /survival start
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    const user = interaction.user;

    const profile = await cacheManager.getUserProfile(user.id);
    const [survival] = await UserSurvival.findOrCreate({ where: { userId: user.id } });

    const inventory = safeParseInventory(profile.inventory);

    if (inventory.some((item) => item?.id === STARTER_FLAG)) {
      const rpgState = profile.rpg_state || {};
      const archName = rpgState.archetype ? ` Jalur: **${rpgState.archetype}**` : "";
      const locName = survival.currentLocation ? ` • Lokasi: \`${survival.currentLocation}\`` : "";

      const payload = survivalUI.buildEmptyStateCard({
        user,
        title: "Sudah Memulai Petualangan",
        description:
          `Starter Kit sudah kamu ambil sebelumnya dan hanya bisa diambil sekali.${archName}${locName}\n\n` +
          "Ayo lanjutkan petualanganmu dengan aksi di bawah, yaa!",
        emoji: "🌿",
        buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", user.id)],
      });
      if (interaction.deferred || interaction.replied) {
        return interaction.editReply(payload);
      }
      return interaction.reply({ ...payload, flags: MessageFlags.Ephemeral });
    }

    const onboardingPayload = renderOnboardingPrompt(user, "id");

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(onboardingPayload);
    }
    return interaction.reply(onboardingPayload);
  },
};
