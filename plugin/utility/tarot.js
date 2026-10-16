"use strict";

const {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} = require("discord.js");
const tarotEngine = require("../../src/services/tarotEngine");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  isSubcommand: true,

  /**
   * Eksekutor subcommand /astral spread dengan Discord Components V2 layout 5-lapisan.
   * @param {import("discord.js").ChatInputCommandInteraction} interaction
   */
  async execute(interaction) {
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply();
    }

    const user = interaction.user;
    const displayName =
      interaction.member?.displayName || user.displayName || user.username;

    const spread = await tarotEngine.drawThreeCardSpread(user.id);

    if (!spread.canDraw) {
      const payload = buildContainerV2({
        accentColorHex: ui.getColor("warning") || "#F59E0B",
        authorName: "HOSHINO ASTRAL SANCTUARY • TAROT SPREAD",
        title: "⏳ Energi Bintang Masih Menyelaraskan",
        description: spread.message,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({
        ...payload,
        flags: MessageFlags.IsComponentsV2,
      });
    }

    const cardFields = spread.cards
      .map((c) => {
        return `• **${c.card.emoji} ${c.position.label}: ${c.card.title}** (${c.orientation})\n> *"${c.meaning}"*`;
      })
      .join("\n\n");

    const buffText = `• **${spread.activeBuff.name}**: \`+${spread.activeBuff.bonusPercent}%\` (${spread.activeBuff.durationHours} jam)\n> *${spread.activeBuff.description}*`;

    const description = [
      `Halo, **${displayName}**! Tiga kartu takdir telah terbuka di hadapanmu:\n`,
      cardFields,
      `\n🔮 **Bimbingan Semesta:**`,
      `> *"${spread.summaryAdvice}"*\n`,
      `✨ **Berkah Takdir Aktif (24 Jam):**`,
      buffText,
    ].join("\n");

    const actionRow = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("astral_weather_quick")
        .setLabel("Cuaca Astral")
        .setEmoji("🌌")
        .setStyle(ButtonStyle.Secondary),
    );

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#A855F7",
      authorName: "HOSHINO ASTRAL SANCTUARY • TAROT SPREAD",
      title: "🎴 Tebaran Tiga Bintang: Masa Lalu, Kini, & Depan",
      description,
      buttonsRow: [actionRow],
      footerText: ui.getFooter("utility"),
    });

    return interaction.editReply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
