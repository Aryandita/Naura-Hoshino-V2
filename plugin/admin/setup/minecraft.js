const { buildContainerV2 } = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(interaction, { currentSettings, saveSettings }) {
  const channel = interaction.options.getChannel("channel");
  const ip = interaction.options.getString("ip");
  const port = interaction.options.getInteger("port");
  const password = interaction.options.getString("password");

  if (!currentSettings.minecraft) currentSettings.minecraft = {};
  currentSettings.minecraft.bridgeEnabled = true;
  currentSettings.minecraft.bridgeChannelId = channel.id;
  if (ip) currentSettings.minecraft.ip = ip;
  if (port) currentSettings.minecraft.rconPort = port;
  if (password) currentSettings.minecraft.rconPassword = password;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Minecraft Bridge Module",
    title: "🎮 Setup Jembatan Chat Minecraft Berhasil",
    description: `Channel Chat Bridge: <#${channel.id}>\nIP RCON: \`${currentSettings.minecraft.ip || "localhost"}\` | Port: \`${currentSettings.minecraft.rconPort || 25575}\``,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
