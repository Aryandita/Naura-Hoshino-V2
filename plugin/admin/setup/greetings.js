const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings, saveSettings }) {
  const welcomeChan = interaction.options.getChannel("channel");
  const enabled = interaction.options.getBoolean("aktif") ?? true;

  if (!currentSettings.greetings) currentSettings.greetings = {};
  currentSettings.greetings.welcome = {
    enabled,
    channelId: welcomeChan.id,
    message:
      currentSettings.greetings.welcome?.message ||
      "Selamat datang di server {user}!",
    image: true,
  };
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("success"),
    authorName: "Naura Greetings Module",
    title: "👋 Setup Greetings Berhasil",
    description: `Pesan Selamat Datang kini **${enabled ? "Aktif 🟢" : "Nonaktif 🔴"}** dan diarahkan ke <#${welcomeChan.id}>.`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
