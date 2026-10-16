"use strict";

const typeRaceEngine = require("../../services/typeRaceEngine");
const cacheManager = require("../../managers/cacheManager");
const ui = require("../../config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../utils/NauraContainerBuilder");

module.exports = [
  {
    prefix: "typerace_modal_",
    label: "typerace-modal-submit",
    defer: "reply",
    async handler(interaction) {
      const raceId = interaction.customId.replace("typerace_modal_", "");
      const session = typeRaceEngine.getRaceSession(raceId);

      if (!session) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Sesi Tidak Ditemukan",
            errorMessage: "Sesi balapan ketik ini telah berakhir atau tidak valid.",
            expression: "warning",
          }),
        );
      }

      if (interaction.user.id !== session.userId) {
        return interaction.editReply(
          buildErrorContainerV2({
            title: "Akses Ditolak",
            errorMessage: "Hanya pemain yang memulai sesi yang dapat mengirimkan hasil balapan.",
            expression: "sad",
          }),
        );
      }

      // Delete session so it cannot be submitted twice
      typeRaceEngine.deleteRaceSession(raceId);

      const typedText = interaction.fields.getTextInputValue("typed_text") || "";
      const startTime = session.startedAt || session.createdAt || Date.now();
      const elapsedSeconds = Math.max(1, Math.round((Date.now() - startTime) / 1000));

      const wpm = typeRaceEngine.calculateWPM(typedText.length, elapsedSeconds);
      const accuracy = typeRaceEngine.calculateAccuracy(session.quote, typedText);
      const netWPM = typeRaceEngine.calculateNetWPM(wpm, accuracy);
      const isWithinTime = typeRaceEngine.isWithinTimeLimit(elapsedSeconds, 90);

      const nsfEmoji = ui.getEmoji("nsf") || ui.getEmoji("star_fragment") || "⭐";

      // Case: Time exceeded
      if (!isWithinTime) {
        const timeoutPayload = buildContainerV2({
          accentColorHex: "#EF4444",
          title: "⏰ Waktu Pengetikan Habis!",
          expression: "sad",
          description: [
            `Waktu pengetikanmu adalah **${elapsedSeconds} detik** (melebihi batas maksimal **90 detik**).`,
            "",
            session.bet > 0
              ? `Taruhan sebesar **${session.bet.toLocaleString()} ${nsfEmoji}** hangus.`
              : "Coba lagi dan ketik lebih cepat pada putaran berikutnya!",
          ].join("\n"),
          footerText: ui.getFooter("core"),
        });
        return interaction.editReply(timeoutPayload);
      }

      // Calculate reward
      const reward = typeRaceEngine.calculateReward({
        wpm,
        accuracy,
        difficulty: session.difficulty,
        bet: session.bet,
        isPremium: session.isPremium,
      });

      let payoutReceived = 0;
      if (reward.success && reward.payout > 0) {
        payoutReceived = reward.payout;
        await cacheManager.incrementUserSurvival(
          session.userId,
          "starFragments",
          payoutReceived,
        );
      }

      const isWin = reward.success && (session.bet === 0 || payoutReceived > session.bet);
      const isPush = reward.success && session.bet > 0 && payoutReceived === session.bet;

      let statusTitle = "🏁 Balapan Ketik Selesai!";
      let accentColor = "#3B82F6";
      let expression = "cheers";

      if (accuracy < 85) {
        statusTitle = "⚠️ Akurasi Terlalu Rendah";
        accentColor = "#F59E0B";
        expression = "warning";
      } else if (isWin) {
        statusTitle = "🎉 Luar Biasa! Kecepatan Menakjubkan!";
        accentColor = "#22C55E";
        expression = "celebrate";
      } else if (isPush) {
        statusTitle = "🤝 Hasil Imbang";
        accentColor = "#EAB308";
        expression = "cheers";
      } else if (session.bet > 0) {
        statusTitle = "💔 Taruhan Tidak Tercapai";
        accentColor = "#EF4444";
        expression = "sad";
      }

      const descriptionLines = [
        `**Statistik Pengetikan:**`,
        `> ⚡ **Kecepatan (Gross):** \`${wpm}\` WPM`,
        `> 🎯 **Akurasi:** \`${accuracy}%\``,
        `> 🚀 **Kecepatan Bersih (Net):** \`${netWPM}\` WPM`,
        `> ⏱️ **Waktu:** \`${elapsedSeconds}\` detik`,
        "",
      ];

      if (session.bet > 0) {
        if (payoutReceived > session.bet) {
          const profit = payoutReceived - session.bet;
          descriptionLines.push(
            `💰 **Hasil Taruhan:** Menang! Mendapatkan **+${payoutReceived.toLocaleString()} ${nsfEmoji}** (Profit: +${profit.toLocaleString()})`,
          );
        } else if (payoutReceived === session.bet) {
          descriptionLines.push(
            `💰 **Hasil Taruhan:** Balik modal. Taruhan **${session.bet.toLocaleString()} ${nsfEmoji}** dikembalikan.`,
          );
        } else {
          descriptionLines.push(
            `💸 **Hasil Taruhan:** Kalah. Kehilangan taruhan **${session.bet.toLocaleString()} ${nsfEmoji}**.`,
          );
        }
      } else if (payoutReceived > 0) {
        descriptionLines.push(
          `🎁 **Hadiah NSF:** Kamu mendapatkan **+${payoutReceived.toLocaleString()} ${nsfEmoji}**!`,
        );
      } else {
        descriptionLines.push(
          `💡 *Tips: Capai minimal akurasi 85% untuk membawa pulang hadiah Star Fragments.*`,
        );
      }

      const payload = buildContainerV2({
        accentColorHex: accentColor,
        title: statusTitle,
        expression,
        description: descriptionLines.join("\n"),
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    },
  },
];
