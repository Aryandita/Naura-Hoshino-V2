"use strict";

const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const ServerChronicleEngine = require("../../src/ai/serverChronicleEngine");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("chronicle")
    .setDescription(
      "📰 Baca Koran Harian & Ramalan Server 'The Hoshino Times'",
    )
    .addStringOption((opt) =>
      opt
        .setName("topik")
        .setDescription(
          "Sorotan topik atau headline khusus yang ingin diangkat (opsional)",
        )
        .setRequired(false),
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content:
          "❌ Command ini hanya dapat digunakan di dalam server Discord.",
        flags: MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    try {
      const chronicleData = await ServerChronicleEngine.generateChronicleData(
        interaction.guild,
      );
      const customTopic = interaction.options.getString("topik");
      if (customTopic) {
        chronicleData.headline = customTopic.substring(0, 120);
      }

      const imgBuffer = await canvasWorkerPool.execute({
        task: "renderChronicle",
        payload: chronicleData,
        userId: interaction.user.id,
      });
      const attachment = new AttachmentBuilder(imgBuffer, {
        name: "hoshino-times.png",
      });

      const payload = buildContainerV2({
        accentColorHex: "#FFB6C1",
        title: `📰 THE HOSHINO TIMES - Edisi ${chronicleData.date}`,
        description: `Berikut adalah koran rangkuman harian resmi untuk guild **${interaction.guild.name}**!\n\n👑 **Member of the Day:** **${chronicleData.topUser.username}** (\`${chronicleData.topUser.count} pesan\`)\n⚡ **Headline:** *${chronicleData.headline}*`,
        footerText: ui.getFooter("utility"),
        media: attachment,
      });

      return interaction.editReply({ ...payload, files: [attachment] });
    } catch (error) {
      return interaction.editReply({
        ...buildErrorContainerV2({
          title: "Gagal Menerbitkan Koran",
          description: `Terjadi kendala saat menerbitkan koran server: ${error.message}`,
          footerText: ui.getFooter("utility"),
        }),
      });
    }
  },
};
