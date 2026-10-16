"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const UserSurvival = require("../../../src/models/UserSurvival");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "duel",
  async execute(interaction, context) {
    const { user, survival, coinEmoji, nsfEmoji, sendError } = context;
    const opponent = interaction.options.getUser("lawan");
    const taruhan = interaction.options.getInteger("taruhan") || 0;

    if (!opponent) return sendError("Harap tentukan pemain yang ingin kamu tantang duel!");
    if (opponent.bot) return sendError("Kamu tidak bisa menantang mesin/bot!");
    if (opponent.id === user.id) return sendError("Kamu tidak bisa menantang dirimu sendiri!");

    const [opponentSurvival] = await UserSurvival.findOrCreate({
      where: { userId: opponent.id },
    });

    if (taruhan > 0) {
      const userNsf = Number(survival.starFragments || 0);
      const oppNsf = Number(opponentSurvival.starFragments || 0);
      if (userNsf < taruhan) {
        return sendError(
          `Saldo Star Fragments (NSF) kamu tidak cukup untuk bertaruh sebesar **${taruhan.toLocaleString()}** ${coinEmoji}! (Saldo: ${userNsf.toLocaleString()} ${nsfEmoji})`,
        );
      }
      if (oppNsf < taruhan) {
        return sendError(
          `Saldo Star Fragments (NSF) <@${opponent.id}> tidak cukup untuk taruhan ini!`,
        );
      }
    }

    const rowInvite = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("duel_accept")
        .setLabel("Terima")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("duel_decline")
        .setLabel("Tolak")
        .setStyle(ButtonStyle.Danger),
    );

    const invitePayload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#00FFFF",
      title: `${ui.getEmoji("battle") || "⚔️"} TANTANGAN DUEL ${ui.getEmoji("battle") || "⚔️"}`,
      description: `<@${user.id}> menantang <@${opponent.id}> untuk duel matematika kecepatan!\n\n**Taruhan:** ${taruhan.toLocaleString()} ${coinEmoji}\n\nApakah kamu berani menerima tantangan ini?`,
      buttonsRow: rowInvite,
      footerText: "Tantangan ini akan kadaluarsa dalam 30 detik.",
    });

    const response = await interaction.editReply({
      ...invitePayload,
      fetchReply: true,
    });

    const filter = (i) => i.user.id === opponent.id;
    const collectorInvite = response.createMessageComponentCollector({
      filter,
      time: 30000,
    });

    collectorInvite.on("collect", async (i) => {
      if (i.customId === "duel_decline") {
        await i.update({
          content: `❌ <@${opponent.id}> menolak tantangan duel.`,
          embeds: [],
          components: [],
        });
        return collectorInvite.stop();
      }

      await i.deferUpdate();
      collectorInvite.stop();

      const num1 = Math.floor(Math.random() * 50) + 10;
      const num2 = Math.floor(Math.random() * 50) + 10;
      const answer = num1 + num2;

      const options = [
        answer,
        answer + Math.floor(Math.random() * 5) + 1,
        answer - Math.floor(Math.random() * 5) - 1,
        answer + 10,
      ].sort(() => Math.random() - 0.5);

      const rowGame = new ActionRowBuilder().addComponents(
        options.map((opt) =>
          new ButtonBuilder()
            .setCustomId(`duel_${opt}`)
            .setLabel(opt.toString())
            .setStyle(ButtonStyle.Primary),
        ),
      );

      const duelPayload = buildContainerV2({
        accentColorHex: "#FF0055",
        title: `${ui.getEmoji("battle") || "⚔️"} DUEL DIMULAI: SIAPA CEPAT DIA DAPAT!`,
        description: `Berapa hasil dari: **${num1} + ${num2}** ?\n\nSiapapun yang menekan jawaban benar lebih dulu akan menang!`,
        buttonsRow: rowGame,
        footerText: "Waktu menjawab: 15 detik",
      });

      await interaction.editReply({ content: null, ...duelPayload });

      const gameCollector = response.createMessageComponentCollector({
        filter: (gi) => gi.user.id === user.id || gi.user.id === opponent.id,
        time: 15000,
      });

      gameCollector.on("collect", async (gi) => {
        const chosen = parseInt(gi.customId.split("_")[1]);
        const winner = gi.user;
        const loser = winner.id === user.id ? opponent : user;

        if (chosen === answer) {
          gameCollector.stop("win");
          await gi.deferUpdate().catch(() => {});

          await cacheManager.incrementUserProfile(winner.id, {
            minigame_duelScore: 10,
          });

          if (taruhan > 0) {
            await cacheManager.incrementUserSurvival(
              winner.id,
              "starFragments",
              taruhan,
            );
            await cacheManager.debitUserSurvival(
              loser.id,
              "starFragments",
              taruhan,
            );
          }

          const winPayload = buildContainerV2({
            accentColorHex: "#22c55e",
            title: `${ui.getEmoji("trophy") || "🏆"} PEMENANG DUEL`,
            description: `Tembakan cepat dari <@${winner.id}> tepat sasaran!\n\n**Jawaban Benar:** ${answer}\n\n**Hadiah Pemenang:**\n> +10 Poin Duel\n> ${taruhan > 0 ? `+${taruhan.toLocaleString()} ${coinEmoji}` : "Tidak ada taruhan"}`,
            footerText: ui.getFooter("core"),
          });

          await interaction.editReply(winPayload);
        } else {
          await ui.sendError(gi, "err_sys_4", true);
        }
      });

      gameCollector.on("end", (collected, reason) => {
        if (reason === "time") {
          interaction
            .editReply({
              content: `${ui.getEmoji("clock") || "⏰"} Pertandingan dibatalkan karena waktu habis, tidak ada yang menjawab.`,
              embeds: [],
              components: [],
            })
            .catch(() => {});
        }
      });
    });

    collectorInvite.on("end", (collected, reason) => {
      if (reason === "time") {
        interaction
          .editReply({
            content: `${ui.getEmoji("clock") || "⏰"} <@${opponent.id}> terlalu lama merespons. Tantangan dibatalkan.`,
            embeds: [],
            components: [],
          })
          .catch(() => {});
      }
    });
  },
};
