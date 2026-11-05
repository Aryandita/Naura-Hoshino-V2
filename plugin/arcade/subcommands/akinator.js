"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const ui = require("../../../src/config/ui");
const { buildContainerV2, buildErrorContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "akinator",
  async execute(interaction, context) {
    const { user } = context;
    let Aki;
    let aki;
    try {
      ({ Aki } = require("aki-api"));
      const region = "id";
      aki = new Aki({ region });
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Akinator Sedang Pemeliharaan",
        description:
          "Modul Akinator sedang dalam perbaikan paket server. Silakan coba minigame seru lainnya dulu ya!",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    const loadingAki = buildContainerV2({
      accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
      title: `${ui.getEmoji("magic") || "🧞"} Akinator`,
      iconURL: "https://i.imgur.com/2U5K1r1.png",
      description:
        "Sedang memanggil Akinator dari lampu ajaib... Mohon tunggu.",
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(loadingAki);

    try {
      await aki.start();
    } catch {
      const errPayload = buildErrorContainerV2({
        title: "Akinator Offline",
        description:
          "Akinator sedang tidur atau tidak merespons, coba lagi nanti ya.",
        footerText: ui.getFooter("core"),
      });
      return interaction.editReply(errPayload);
    }

    const buildAkiUI = () => {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aki_0")
          .setLabel("Ya")
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId("aki_1")
          .setLabel("Tidak")
          .setStyle(ButtonStyle.Danger),
        new ButtonBuilder()
          .setCustomId("aki_2")
          .setLabel("Tidak Tahu")
          .setStyle(ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId("aki_3")
          .setLabel("Mungkin")
          .setStyle(ButtonStyle.Primary),
        new ButtonBuilder()
          .setCustomId("aki_4")
          .setLabel("Mungkin Tidak")
          .setStyle(ButtonStyle.Primary),
      );

      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId("aki_back")
          .setLabel("Kembali")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(aki.currentStep === 0),
        new ButtonBuilder()
          .setCustomId("aki_stop")
          .setLabel("Berhenti")
          .setStyle(ButtonStyle.Danger),
      );

      return buildContainerV2({
        accentColorHex: ui.colors ? ui.colors.primary : "#00FFFF",
        title: `${ui.getEmoji("magic") || "🧞"} Akinator (Pertanyaan ke-${aki.currentStep + 1})`,
        description:
          "**" +
          aki.question +
          "**\n\n*Progres: " +
          Math.round(aki.progress) +
          "%\*",
        iconURL: "https://i.imgur.com/2U5K1r1.png",
        buttonsRow: [row, row2],
        footerText: ui.getFooter("core"),
      });
    };

    await interaction.editReply(buildAkiUI());
    const message = await interaction.fetchReply();
    const collector = message.createMessageComponentCollector({
      time: 120000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_8", true);

      await i.deferUpdate();
      collector.resetTimer();

      try {
        if (i.customId === "aki_stop") {
          collector.stop("stopped");
          const errPayload = buildErrorContainerV2({
            title: "Akinator Dihentikan",
            description: "Permainan Akinator dihentikan.",
            footerText: ui.getFooter("core"),
          });
          return i.editReply(errPayload);
        }

        if (i.customId === "aki_back") {
          await aki.back();
        } else {
          const answerId = parseInt(i.customId.split("_")[1]);
          await aki.step(answerId);
        }

        if (aki.progress >= 85 || aki.currentStep >= 79) {
          await aki.win();
          const guess = aki.answers[0];

          if (!guess) {
            const errPayload = buildErrorContainerV2({
              title: "Akinator Menyerah",
              description:
                "Akinator menyerah! Dia tidak bisa menebak karaktermu.",
              footerText: ui.getFooter("core"),
            });
            return i.editReply(errPayload);
          }

          const winPayload = buildContainerV2({
            accentColorHex: "#22c55e",
            title: `${ui.getEmoji("magic") || "🧞"} Akinator Berhasil Menebak!`,
            description:
              "Saya yakin karakter yang kamu pikirkan adalah **" +
              guess.name +
              "**\n*" +
              guess.description +
              "*",
            footerText:
              "Akinator menebak pada percobaan ke-" + aki.currentStep,
          });

          collector.stop("win");
          return i.editReply(winPayload);
        }

        await i.editReply(buildAkiUI());
      } catch {
        collector.stop("error");
        const errPayload = buildErrorContainerV2({
          title: "Koneksi Error",
          description: "Terjadi kesalahan koneksi ke server Akinator.",
          footerText: ui.getFooter("core"),
        });
        return i.editReply(errPayload);
      }
    });

    collector.on("end", (collected, reason) => {
      if (reason === "time") {
        const errPayload = buildErrorContainerV2({
          title: "Waktu Habis",
          description:
            "Akinator bosan menunggu jawabanmu. Permainan dibatalkan.",
          footerText: ui.getFooter("core"),
        });
        interaction
          .editReply(errPayload)
          .catch(() => {});
      }
    });
  },
};
