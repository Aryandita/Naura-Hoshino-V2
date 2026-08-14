const { SlashCommandBuilder } = require("discord.js");
const languageManager = require("../../src/managers/languageManager");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("language")
    .setDescription("Ubah bahasa utama Naura untuk dirimu sendiri.")
    .addStringOption((option) =>
      option
        .setName("pilihan")
        .setDescription("Pilih bahasa yang ingin digunakan.")
        .setRequired(true)
        .addChoices(
          { name: "🇮🇩 Indonesia", value: "id" },
          { name: "🇬🇧 English", value: "en" },
          { name: "⚙️ Ikuti Server (Default)", value: "default" },
        ),
    ),

  async execute(interaction) {
    // Tampilkan pesan loading terlebih dahulu (agar tidak timeout)
    await interaction.deferReply({ flags: 64 });

    const lang = interaction.localeLang;
    const pilihan = interaction.options.getString("pilihan");
    const userId = interaction.user.id;

    // Ambil string dari languageManager
    const str = languageManager.getString(lang, "core.language") || {};

    let setLang = pilihan;
    if (pilihan === "default") {
      setLang = null; // Menyetel ke null agar fallback ke GuildSettings aktif
    }

    try {
      await languageManager.setUserLanguage(userId, setLang);

      // Karena bahasa baru saja berubah, kita ambil language identifier yang aktif sekarang
      const newLangId = await languageManager.getUserLanguage(
        userId,
        interaction.guildId,
      );

      // Ambil respons sukses berdasarkan bahasa yang baru
      const newStr =
        languageManager.getString(newLangId, "core.language") || {};
      const title = newStr.successTitle || "✅ Bahasa Diperbarui!";
      const descId = "Bahasa kamu berhasil diubah menjadi **Indonesia**.";
      const descEn =
        "Your language has been successfully changed to **English**.";
      const descDefault =
        "Bahasa kamu sekarang mengikuti pengaturan bawaan server ini.";

      let desc = "";
      if (pilihan === "id") desc = descId;
      else if (pilihan === "en") desc = descEn;
      else desc = descDefault;

      const payload = buildContainerV2({
        title: title,
        description: desc,
        color: ui.getBrandColor("primary"),
        footerText: ui.getFooter("core"),
      });

      await interaction.editReply(payload);
    } catch (error) {
      const errorMsg =
        str.error || "Terjadi kesalahan saat menyimpan pengaturan bahasa.";
      const payload = buildContainerV2({
        title: "❌ Gagal",
        description: errorMsg,
        color: "#FF0000",
        footerText: ui.getFooter("core"),
      });
      await interaction.editReply(payload);
    }
  },
};
