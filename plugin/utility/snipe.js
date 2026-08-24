const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("snipe")
    .setDescription("Melihat pesan yang terakhir dihapus di channel ini."),

  async execute(interaction) {
    const sniped = interaction.client.snipes?.get(interaction.channelId);

    if (!sniped) {
      return interaction.reply({
        content: "Tidak ada pesan yang dihapus baru-baru ini.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#FFB6C1",
      authorName: `${ui.getEmoji("search") || "🔍"} Membongkar Pesan yang Dihapus (${sniped.author.tag || sniped.author.username})`,
      title: `Pesan Dihapus oleh ${sniped.author.username}`,
      iconURL: sniped.author.displayAvatarURL(),
      description: `**Pengirim:** <@${sniped.author.id}>\n\n**Isi Pesan:**\n${sniped.content ? `> ${sniped.content}` : "*Pesan kosong (Hanya media)*"}`,
      mediaAttachmentNames: sniped.image ? [sniped.image] : [],
      footerText: ui.getFooter("utility"),
    });

    await interaction.reply(payload);
  },
};
