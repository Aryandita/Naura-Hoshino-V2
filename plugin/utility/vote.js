const {
  SlashCommandBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("vote")
    .setDescription("🗳️ Vote Naura Hoshino dan dapatkan Trial V.I.P 12 Jam!"),

  async execute(interaction) {
    const topGgLink = "https://top.gg/bot/1483665745727721543?s=00487c531de33";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Vote Sekarang")
        .setStyle(ButtonStyle.Link)
        .setURL(topGgLink)
        .setEmoji(ui.parseEmoji(ui.getEmoji("heart") || "💖")),
    );

    const container = buildContainerV2({
      accentColorHex: "#FFD700",
      authorName: "🌟 Dukung Naura Hoshino!",
      title: "Vote & Dapatkan Reward VIP",
      iconURL: interaction.client.user.displayAvatarURL(),
      description: `Bantu Naura untuk terus berkembang dengan memberikan **Vote harian** di Top.gg!\n\n🎁 **REWARD INSTAN:**\nSebagai tanda terima kasih, sistem kami akan langsung menyuntikkan **Trial V.I.P Premium selama 12 Jam** ke akunmu secara otomatis setelah proses voting selesai!`,
      buttonsRow: row,
      footerText: ui.getFooter("utility"),
    });

    await interaction.reply(container);
  },

  async executePrefix(message) {
    const topGgLink = "https://top.gg/bot/1483665745727721543?s=00487c531de33";

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel("Vote Sekarang")
        .setStyle(ButtonStyle.Link)
        .setURL(topGgLink)
        .setEmoji(ui.parseEmoji(ui.getEmoji("heart") || "💖")),
    );

    const container = buildContainerV2({
      accentColorHex: "#FFD700",
      authorName: "🌟 Dukung Naura Hoshino!",
      title: "Vote & Dapatkan Reward VIP",
      iconURL: message.client.user.displayAvatarURL(),
      description: `Bantu Naura untuk terus berkembang dengan memberikan **Vote harian** di Top.gg!\n\n🎁 **REWARD INSTAN:**\nSebagai tanda terima kasih, sistem kami akan langsung menyuntikkan **Trial V.I.P Premium selama 12 Jam** ke akunmu secara otomatis setelah proses voting selesai!`,
      buttonsRow: row,
      footerText: ui.getFooter("utility"),
    });

    await message.reply(container);
  },
};
