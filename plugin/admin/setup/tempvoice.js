const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  const voiceChan = interaction.options.getChannel("channel");
  const category = interaction.options.getChannel("kategori");

  currentSettings.tempvoiceChannel = voiceChan.id;
  if (category) currentSettings.tempvoiceCategory = category.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura TempVoice Module",
    title: "🔊 Setup TempVoice Berhasil",
    description: `Generator Voice: <#${voiceChan.id}>\nKategori Voice: ${category ? `<#${category.id}>` : "*Otomatis*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
