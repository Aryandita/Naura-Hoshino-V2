"use strict";

const { MessageFlags } = require("discord.js");
const {
  claimOnboardingKit,
  renderOnboardingPrompt,
  renderQuizStep,
  renderQuizVerdict,
} = require("../../survival/engines/playerOnboardingEngine");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const survivalUI = require("../../utils/survivalUIHelper");
const ui = require("../../config/ui");

// Sesi kuis sementara di memori
const quizSessions = new Map();

module.exports = [
  {
    id: "btn_onboard_claim_default",
    label: "player-onboard-claim-default",
    onError: "Gagal mengklaim starter pack.",
    async handler(interaction) {
      const result = await claimOnboardingKit(interaction.user.id, "farmer", "balai_desa");

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
          `📍 **Lokasi Awal:** ${result.location?.name || "Balai Desa Sukamaju"}`,
          "",
          "**🎁 Bekal Awal yang Diterima:**",
          itemsList,
          "",
          "Semua perlengkapan telah dimasukkan ke dalam tas Kakak.",
          "- # *Coba ketik `/survival info` untuk memeriksa status vital atau `/survival dailyquest` untuk melihat misi harianmu.*",
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
  {
    id: "btn_onboard_quiz_1",
    label: "player-onboard-quiz-start",
    onError: "Gagal memulai kuis cerita.",
    async handler(interaction) {
      quizSessions.set(interaction.user.id, {});
      const payload = renderQuizStep(interaction.user, 1, {});
      return interaction.update(payload);
    },
  },
  {
    prefix: "btn_onboard_ans_",
    label: "player-onboard-quiz-answer",
    onError: "Gagal mencatat jawaban kuis.",
    async handler(interaction) {
      const customId = interaction.customId;
      // Format: btn_onboard_ans_<step>_<optId>
      const parts = customId.replace("btn_onboard_ans_", "").split("_");
      const step = parseInt(parts[0], 10);
      const optId = parts.slice(1).join("_");

      const session = quizSessions.get(interaction.user.id) || {};
      session[step] = optId;
      quizSessions.set(interaction.user.id, session);

      if (step < 3) {
        const nextPayload = renderQuizStep(interaction.user, step + 1, session);
        return interaction.update(nextPayload);
      }

      // Langkah terakhir (step 3) selesai: tampilkan kesimpulan takdir
      const verdictPayload = renderQuizVerdict(interaction.user, session);
      return interaction.update(verdictPayload);
    },
  },
  {
    prefix: "btn_onboard_confirm_",
    label: "player-onboard-quiz-confirm",
    onError: "Gagal mengonfirmasi pendaftaran.",
    async handler(interaction) {
      // Format: btn_onboard_confirm_<archetype>_<location>
      const customId = interaction.customId;
      const parts = customId.replace("btn_onboard_confirm_", "").split("_");
      const archetypeKey = parts[0] || "farmer";
      const locationKey = parts.slice(1).join("_") || "balai_desa";

      quizSessions.delete(interaction.user.id);
      const result = await claimOnboardingKit(interaction.user.id, archetypeKey, locationKey);

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
        title: `✨ Resmi Bergabung sebagai ${result.archetype?.name}!`,
        iconURL: interaction.user.displayAvatarURL(),
        description: [
          result.message,
          "",
          `📍 **Lokasi Awal:** ${result.location?.name || "Balai Desa Sukamaju"} (${result.location?.title || ""})`,
          "",
          "**🎁 Bekal Awal yang Diterima:**",
          itemsList,
          "",
          "Semua perlengkapan dan bekal telah dimasukkan ke dalam tas Kakak.",
          "- # *Ketik `/survival info` untuk memeriksa statusmu atau `/survival dailyquest` untuk memulai misi harian pertama!*",
        ].join("\n"),
        buttonsRow: [survivalUI.buildSurvivalActionRow("gathering", interaction.user.id)],
        footerText: ui.getFooter("survival"),
      });

      return interaction.update(successPayload);
    },
  },
  {
    id: "btn_onboard_cancel",
    label: "player-onboard-cancel",
    onError: "Gagal membatalkan kuis.",
    async handler(interaction) {
      quizSessions.delete(interaction.user.id);
      const payload = renderOnboardingPrompt(interaction.user);
      return interaction.update(payload);
    },
  },
];
