"use strict";

const { MessageFlags } = require("discord.js");

const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const { safeParseInventory } = require("../../../src/survival/engines/inventoryHelper");
const survivalUI = require("../../../src/utils/survivalUIHelper");
const {
  renderOnboardingPrompt,
} = require("../../../src/survival/engines/playerOnboardingEngine");

const STARTER_FLAG = "survival_started";

module.exports = {
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

    // Tampilkan Interactive Onboarding Wizard V2 (Kuis Takdir, Arketipe, & Bekal Awal)
    const onboardingPayload = renderOnboardingPrompt(user, "id");

    if (interaction.deferred || interaction.replied) {
      return interaction.editReply(onboardingPayload);
    }
    return interaction.reply(onboardingPayload);
  },
};
