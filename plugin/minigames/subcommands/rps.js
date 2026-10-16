"use strict";

const { ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType, MessageFlags } = require("discord.js");
const cacheManager = require("../../../src/managers/cacheManager");
const ui = require("../../../src/config/ui");
const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");

module.exports = {
  name: "rps",
  async execute(interaction, context) {
    const { user, profile, survival, coinEmoji, nsfEmoji, sendError } = context;
    const taruhan = interaction.options.getInteger("taruhan") || 0;
    const opponent = interaction.options.getUser("lawan");
    const curSurv = await cacheManager.getUserSurvival(user.id);
    const curNsf = curSurv
      ? Number(curSurv.starFragments || 0)
      : Number(survival.starFragments || 0);

    if (taruhan <= 0 || curNsf < taruhan) {
      return sendError(
        `Taruhan tidak valid atau saldo Star Fragments (NSF) tidak cukup! (Saldo: ${curNsf.toLocaleString()} ${nsfEmoji})`,
      );
    }

    if (opponent && !opponent.bot && opponent.id !== user.id) {
      return interaction.editReply({
        content:
          "Fitur PvP RPS melawan pemain nyata sedang dalam pengembangan! Untuk sementara, silakan bermain melawan AI.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rps_batu")
        .setLabel("Batu 🪨")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_gunting")
        .setLabel("Gunting ✂️")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("rps_kertas")
        .setLabel("Kertas 📄")
        .setStyle(ButtonStyle.Primary),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.colors.primary || "#00FFFF",
      authorName: "Batu Gunting Kertas",
      iconURL: user.displayAvatarURL(),
      description: `Kamu mempertaruhkan **${taruhan.toLocaleString()}** ${coinEmoji}.\nSilakan pilih gerakanmu dalam **15 detik**!`,
      buttonsRow: row,
      footerText: ui.getFooter("core"),
    });

    await interaction.editReply(payload);
    const message = await interaction.fetchReply();

    const collector = message.createMessageComponentCollector({
      componentType: ComponentType.Button,
      time: 15000,
    });

    collector.on("collect", async (i) => {
      if (i.user.id !== user.id) return ui.sendError(i, "err_sys_6", true);

      const userChoice = i.customId.split("_")[1];
      const choices = ["batu", "gunting", "kertas"];
      const botChoice = choices[Math.floor(Math.random() * choices.length)];

      let result = "";
      let color = "#FFD700";

      if (userChoice === botChoice) {
        result = `SERI! Kalian berdua memilih **${userChoice}**.\nTaruhan NSF dikembalikan.`;
        color = "#FFFF00";
      } else if (
        (userChoice === "batu" && botChoice === "gunting") ||
        (userChoice === "gunting" && botChoice === "kertas") ||
        (userChoice === "kertas" && botChoice === "batu")
      ) {
        const winNsf = profile.isPremium ? taruhan * 2 : taruhan;
        profile.minigame_rpsWin += 1;
        await profile.save({ fields: ["minigame_rpsWin"] });
        await cacheManager.incrementUserSurvival(
          user.id,
          "starFragments",
          winNsf,
        );
        result = `MENANG! Bot memilih **${botChoice}**.\nKamu memenangkan **${(taruhan * 2).toLocaleString()}** ${coinEmoji}!`;
        color = "#00FF00";
      } else {
        await cacheManager.debitUserSurvival(
          user.id,
          "starFragments",
          taruhan,
        );
        result = `KALAH! Bot memilih **${botChoice}**.\nKamu kehilangan **${taruhan.toLocaleString()}** ${coinEmoji}.`;
        color = "#FF0000";
      }

      const resPayload = buildContainerV2({
        accentColorHex: color,
        title: `Pilihanmu: ${userChoice.toUpperCase()} | Pilihan Bot: ${botChoice.toUpperCase()}`,
        description: result,
        footerText: ui.getFooter("core"),
      });

      await i.update(resPayload);
      collector.stop();
    });

    collector.on("end", (collected) => {
      if (collected.size === 0) {
        interaction.editReply({
          content: `⏰ Waktu memilih habis! Taruhan dibatalkan.`,
          embeds: [],
          components: [],
        });
      }
    });
  },
};
