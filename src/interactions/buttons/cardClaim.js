"use strict";

const { AttachmentBuilder, MessageFlags } = require("discord.js");
const CardEngine = require("../../card/cardEngine");
const { drawAnimeCard } = require("../../canvas/cardCanvas");
const { buildContainerV2, buildErrorContainerV2 } = require("../../utils/NauraContainerBuilder");
const ui = require("../../config/ui");

module.exports = {
  prefix: "card_claim_",
  label: "card-claim",

  async handler(interaction) {
    const cardIndex = parseInt(interaction.customId.replace("card_claim_", ""), 10);
    const channelId = interaction.channelId;
    const userId = interaction.user.id;

    const result = await CardEngine.claimDropCard(channelId, cardIndex, userId);

    if (!result.success) {
      if (result.reason === "ALREADY_CLAIMED") {
        return interaction.reply({
          ...buildErrorContainerV2({
            title: "Terlambat!",
            description: `Kartu ini sudah diklaim lebih dulu oleh <@${result.claimedBy}>!`,
            footerText: ui.getFooter("core"),
          }),
          flags: MessageFlags.Ephemeral,
        });
      }

      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Sesi Kadaluarsa",
          description: "Sesi drop kartu ini sudah berakhir atau tidak ditemukan.",
          footerText: ui.getFooter("core"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const card = result.card;
    const cardBuffer = await drawAnimeCard(card);
    const attachment = new AttachmentBuilder(cardBuffer, { name: `${card.cardCode}.png` });

    const payload = buildContainerV2({
      accentColorHex: "#FFB6C1",
      authorName: "🎴 Anime Card Claimed!",
      title: `✨ ${card.characterName} (#${card.printNumber})`,
      description: [
        `Selamat <@${userId}>! Kamu berhasil mengklaim kartu:`,
        ``,
        `• **Karakter:** ${card.characterName}`,
        `• **Seri:** ${card.seriesName}`,
        `• **Nomor Cetak:** \`#${card.printNumber}\``,
        `• **Kondisi:** \`${card.quality}\``,
        `• **Kode Kartu:** \`${card.cardCode}\``,
      ].join("\n"),
      files: [attachment],
      footerText: "Gunakan /card view code:<kode> untuk melihat kartumu!",
    });

    return interaction.editReply(payload);
  },
};
