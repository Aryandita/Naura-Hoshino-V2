const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("color")
    .setDescription("🎨 Lihat informasi dan visual warna HEX.")
    .addStringOption((opt) =>
      opt
        .setName("hex")
        .setDescription("Kode warna HEX (contoh: #ff0000 atau ff0000)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const hex = interaction.options.getString("hex").replace("#", "");

    if (!/^[0-9A-Fa-f]{6}$/i.test(hex)) {
      return interaction.reply({
        content: `${ui.getEmoji("cross") || "❌"} Format kode warna tidak valid. Gunakan 6 karakter HEX (contoh: FF0000).`,
        flags: MessageFlags.Ephemeral,
      });
    }

    try {
      const response = await fetch(`https://www.thecolorapi.com/id?hex=${hex}`);
      const data = await response.json();

      const hexColor = data.hex.value;
      const rgb = data.rgb.value;
      const cmyk = data.cmyk.value;
      const hsl = data.hsl.value;
      const name = data.name.value;

      const payload = buildContainerV2({
        accentColorHex: hexColor,
        title: `🎨 Warna: ${name}`,
        description: `**HEX:** \`${hexColor}\`\n**RGB:** \`${rgb}\`\n**HSL:** \`${hsl}\`\n**CMYK:** \`${cmyk}\``,
        footerText: ui.getFooter("core"),
      });

      await interaction.reply(payload);
    } catch (error) {
      logger.error("[Color Error]", error);
      await interaction.reply({
        content: `${ui.getEmoji("cross") || "❌"} Terjadi kesalahan saat mengambil informasi warna.`,
        flags: MessageFlags.Ephemeral,
      });
    }
  },
};
