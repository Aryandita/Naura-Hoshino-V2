const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("github")
    .setDescription("🐙 Cari profil pengguna GitHub.")
    .addStringOption((opt) =>
      opt
        .setName("username")
        .setDescription("Username GitHub")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const username = interaction.options.getString("username");

    try {
      const response = await fetch(
        `https://api.github.com/users/${encodeURIComponent(username)}`,
      );

      if (response.status === 404) {
        const errPayload = buildErrorContainerV2({
          title: "Profil Tidak Ditemukan",
          description: `Pengguna GitHub dengan username **${username}** tidak ditemukan.`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const data = await response.json();

      const payload = buildContainerV2({
        accentColorHex: "#2b3137",
        authorName: "GitHub Profile Search",
        title: `${ui.getEmoji("about") || "🐙"} ${data.name || data.login}`,
        iconURL:
          data.avatar_url ||
          "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
        description: `${data.bio || "Tidak ada bio."}\n\n${ui.getEmoji("about") || "🔗"} [Lihat Profil GitHub](${data.html_url})`,
        fields: [
          {
            name: `${ui.getEmoji("member") || "👥"} Followers / Following`,
            value: `${data.followers} / ${data.following}`,
          },
          {
            name: `${ui.getEmoji("shop_box") || "📁"} Public Repos`,
            value: `${data.public_repos}`,
          },
          {
            name: `${ui.getEmoji("bank") || "🏢"} Perusahaan`,
            value: data.company || "Tidak ada",
          },
          {
            name: `${ui.getEmoji("lokasi") || "📍"} Lokasi`,
            value: data.location || "Tidak diketahui",
          },
        ],
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[GitHub Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Mengambil Profil",
        description: "Terjadi kesalahan saat mencari profil GitHub.",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
