"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const typeRaceEngine = require("../../../src/services/typeRaceEngine");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "typerace",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const kesulitan = interaction.options.getString("kesulitan") || "medium";
    const taruhan = interaction.options.getInteger("taruhan") || 0;

    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv
      ? Number(curSurv.starFragments || 0)
      : Number(survival.starFragments || 0);

    // Validate bet if placed
    if (taruhan > 0) {
      if (taruhan < 10) {
        return sendError("Minimal taruhan untuk TypeRacer adalah **10 SC**!");
      }
      if (taruhan > 10000) {
        return sendError("Maksimal taruhan untuk TypeRacer adalah **10.000 SC**!");
      }
      if (curNsf < taruhan) {
        return sendError(
          `Saldo Sukamaju Koin (SC) tidak mencukupi untuk taruhan **${taruhan.toLocaleString()}** ${coinEmoji}! (Saldo saat ini: ${curNsf.toLocaleString()} ${nsfEmoji})`,
        );
      }

      // Upfront atomic debit
      const debitRes = await cacheManager.debitUserSurvival(user.id, "starFragments", taruhan);
      if (!debitRes || !debitRes.ok) {
        return sendError("Gagal memotong saldo taruhan. Silakan coba lagi.");
      }
    }

    const lang = (interaction.localeLang === "en") ? "en" : "id";
    const quoteObj = typeRaceEngine.getRandomQuote(kesulitan, lang);
    const raceId = `${user.id}_${Date.now()}`;

    // Store race session
    typeRaceEngine.saveRaceSession(raceId, {
      raceId,
      userId: user.id,
      quote: quoteObj.quote,
      difficulty: kesulitan,
      bet: taruhan,
      createdAt: Date.now(),
      isPremium: Boolean(profile?.isPremium || context?.premiumTier > 0),
    });

    const diffLabels = {
      easy: "Mudah (Kalimat Pendek)",
      medium: "Sedang (Paragraf Standar)",
      hard: "Sulit (Kutipan Tantangan)",
    };

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`typerace_start_${raceId}`)
        .setLabel("Mulai Ketik 🏁")
        .setStyle(ButtonStyle.Success),
    );

    const descriptionLines = [
      "Siapkan jarimu dan uji kecepatan ketik WPM di bawah tekanan waktu!",
      "",
      "📜 **Teks Target yang Harus Diketik:**",
      `>>> ${quoteObj.quote}`,
      "",
      "📊 **Detail Balapan:**",
      `> 🎚️ **Tingkat Kesulitan:** ${diffLabels[kesulitan] || kesulitan}`,
      `> 📏 **Panjang Teks:** \`${quoteObj.length}\` karakter`,
      `> 💰 **Taruhan:** ${taruhan > 0 ? `**${taruhan.toLocaleString()}** ${coinEmoji}` : "*Mode Latihan (Bebas Biaya)*"}`,
      `> ⏱️ **Batas Waktu:** \`90 detik\``,
      "",
      "💡 *Tekan tombol **[ Mulai Ketik 🏁 ]** di bawah ini untuk membuka modal pengetikan. Timer dimulai saat modal dibuka!*",
    ];

    const payload = buildContainerV2({
      accentColorHex: "#3B82F6",
      authorName: "TypeRacer Speed Arena",
      iconURL: user.displayAvatarURL(),
      title: "⌨️ Arena Balapan Ketik",
      description: descriptionLines.join("\n"),
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    return interaction.editReply(payload);
  },
};
