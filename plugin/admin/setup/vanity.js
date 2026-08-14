const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings, saveSettings }) {
  const text = interaction.options.getString("teks");
  const role = interaction.options.getRole("role");

  currentSettings.vanityText = text;
  currentSettings.vanityRoleId = role.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Vanity Status Module",
    title: "✍️ Setup Vanity Reward Berhasil",
    description: `Teks Status Dilihat: \`${text}\`\nRole Reward: <@&${role.id}>`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
