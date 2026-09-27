"use strict";

const { claimOnboardingKit } = require("../../survival/engines/playerOnboardingEngine");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "sel_onboard_archetype",
    label: "player-onboarding-archetype-select",
    onError: "Gagal memilih jalur petualangan.",
    async handler(interaction) {
      const archetypeKey = interaction.values[0];
      const result = await claimOnboardingKit(interaction.user.id, archetypeKey);

      if (!result.success) {
        const errPayload = buildErrorContainerV2({
          title: "Sudah Terdaftar",
          errorMessage: result.message,
          footerText: ui.getFooter("survival"),
        });
        return interaction.update(errPayload);
      }

      const itemsList = result.items
        .map((it) => `${it.icon} **${it.name}** \u00D7${it.amount} : *${it.note}*`)
        .join("\n");

      const successPayload = buildContainerV2({
        accentColorHex: "#10B981",
        authorName: "NAURA WILDS ONBOARDING",
        title: `🎉 Selamat Bergabung, ${result.archetype.name}!`,
        iconURL: interaction.user.displayAvatarURL(),
        description: [
          result.message,
          "",
          "**🎁 Bekal Awal yang Diterima:**",
          itemsList,
          "",
          "Semua perlengkapan sudah dimasukkan ke dalam tas Kakak.",
          "- # *Coba ketik `/survival info` untuk memeriksa status vital atau `/survival collect` untuk mulai mengumpulkan bahan.*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.update(successPayload);
    },
  },
];
