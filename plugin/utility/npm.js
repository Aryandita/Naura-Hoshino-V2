const { SlashCommandBuilder } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("npm")
    .setDescription("📦 Cari informasi package NPM.")
    .addStringOption((opt) =>
      opt
        .setName("package")
        .setDescription("Nama package NPM (contoh: discord.js)")
        .setRequired(true),
    ),

  async execute(interaction) {
    await interaction.deferReply();
    const pkg = interaction.options.getString("package").toLowerCase();

    try {
      const response = await fetch(
        `https://registry.npmjs.org/${encodeURIComponent(pkg)}`,
      );

      if (response.status === 404) {
        const errPayload = buildErrorContainerV2({
          title: "Package Tidak Ditemukan",
          description: `Package **${pkg}** tidak ditemukan di NPM.`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply(errPayload);
      }

      const data = await response.json();
      const latest = data["dist-tags"].latest;
      const latestData = data.versions[latest];

      const payload = buildContainerV2({
        accentColorHex: "#cb3837",
        authorName: "NPM Package Registry",
        title: `${ui.getEmoji("shop_box") || "📦"} ${data.name}`,
        iconURL:
          "https://raw.githubusercontent.com/npm/logos/master/npm%20logo/npm-logo-red.png",
        description: `${data.description || "Tidak ada deskripsi."}\n\n${ui.getEmoji("about") || "🔗"} [Lihat Halaman NPM](https://www.npmjs.com/package/${data.name})`,
        fields: [
          {
            name: `${ui.getEmoji("desc") || "🏷️"} Versi Terbaru`,
            value: `\`${latest}\``,
          },
          {
            name: `${ui.getEmoji("notes") || "📄"} Lisensi`,
            value: `\`${latestData.license || "Tidak diketahui"}\``,
          },
          {
            name: `${ui.getEmoji("about") || "👤"} Author`,
            value: data.author
              ? data.author.name || JSON.stringify(data.author)
              : "Tidak diketahui",
          },
        ],
        footerText: ui.getFooter("utility"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      logger.error("[NPM Error]", error);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Mengambil Data",
        description: "Terjadi kesalahan saat mencari package NPM.",
        footerText: ui.getFooter("utility"),
      });
      await interaction.editReply(errPayload);
    }
  },
};
