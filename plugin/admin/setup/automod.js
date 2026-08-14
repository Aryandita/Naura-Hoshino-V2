const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  const enabled = interaction.options.getBoolean("aktif");
  const logChan = interaction.options.getChannel("log");

  if (!currentSettings.automod) currentSettings.automod = {};
  currentSettings.automod.enabled = enabled;
  if (logChan) currentSettings.automod.logChannel = logChan.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Security Module",
    title: "🛡️ Setup Automod Berhasil",
    description: `Status Automod: **${enabled ? "🟢 Aktif" : "🔴 Nonaktif"}**\nChannel Audit Log: ${logChan ? `<#${logChan.id}>` : "*Tidak Diubah*"}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
