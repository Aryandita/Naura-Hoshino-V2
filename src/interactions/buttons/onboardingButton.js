"use strict";

const { MessageFlags } = require("discord.js");
const { claimOnboardingKit } = require("../../survival/engines/playerOnboardingEngine");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const survivalUI = require("../../utils/survivalUIHelper");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "btn_onboard_claim_default",
    label: "player-onboard-claim-default",
    onError: "Gagal mengklaim starter pack.",
    async handler(interaction) {
      const result = await claimOnboardingKit(interaction.user.id, "farmer");

      if (!result.success) {
        const errPayload = buildErrorContainerV2({
          title: "Sudah Terdaftar",
          errorMessage: result.message,
          buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", interaction.user.id)],
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
        title: "🎒 Starter Kit Berhasil Diklaim!",
        iconURL: interaction.user.displayAvatarURL(),
        description: [
          result.message,
          "",
          "**🎁 Bekal Awal yang Diterima:**",
          itemsList,
          "",
          "Semua perlengkapan telah dimasukkan ke dalam tas Kakak.",
          "- # *Coba ketik `/survival info` untuk memeriksa status vital atau `/survival collect` untuk mulai mengumpulkan bahan.*",
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", interaction.user.id)],
        footerText: ui.getFooter("survival"),
      });

      return interaction.update(successPayload);
    },
  },
  {
    id: "btn_onboard_guide",
    label: "player-onboard-guide",
    onError: "Gagal menampilkan panduan.",
    async handler(interaction) {
      const guidePayload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "PANDUAN PETUALANG PEMULA",
        title: "📖 Langkah Demi Langkah di Naura Wilds",
        description: [
          "**1. Menjaga Vitalitas** 🥩💧",
          "Setiap aksi (menebang, menambang, memancing) menguras energi, rasa lapar, dan haus. Makan apel dan minum air jika bar status mulai menurun.",
          "",
          "**2. Mengumpulkan Sumber Daya** 🪓⛏️",
          "Gunakan `/survival chop` di hutan dan `/survival mine` di gua untuk mengumpulkan bahan baku dan tempa peralatan yang lebih kuat di `/survival forge`.",
          "",
          "**3. Berkebun & Berdagang** 🌾💰",
          "Tanam benih di perkebunan `/survival farm` dan jual hasil panen ke pasar komoditas `/survival shop` untuk mendapatkan Star Fragments (NSF).",
          "",
          "**4. Eksplorasi & Abyss** ⚔️🌀",
          "Setelah siap, masuki The Neo-Abyss (`/survival abyss`) untuk memburu relik kuno dan harta karun langka!",
          "",
          "- # *Klik tombol Klaim Starter Kit untuk memulai perjalanan Kakak!*",
        ].join("\n"),
        footerText: ui.getFooter("survival"),
      });

      return interaction.reply({
        ...guidePayload,
        flags: MessageFlags.Ephemeral,
      });
    },
  },
];
