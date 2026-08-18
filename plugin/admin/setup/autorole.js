const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings, saveSettings }) {
  const role = interaction.options.getRole("role");
  currentSettings.autoroleId = role.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Roles Module",
    title: "🎭 Setup Auto-Role Berhasil",
    description: `Role Baru Member: <@&${role.id}>`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
