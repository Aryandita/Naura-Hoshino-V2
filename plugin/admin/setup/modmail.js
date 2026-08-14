const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  const category = interaction.options.getChannel("kategori");
  const role = interaction.options.getRole("role");

  currentSettings.modmailCategory = category.id;
  if (role) currentSettings.modmailStaffRole = role.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Modmail Module",
    title: "📩 Setup Modmail Berhasil",
    description: `Kategori Tiket: <#${category.id}>\nRole Staff: ${role ? `<@&${role.id}>` : "*Belum Diatur*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
