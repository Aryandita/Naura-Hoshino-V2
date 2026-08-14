const {
  buildContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  const trapChannel = interaction.options.getChannel("channel");
  currentSettings.softbanChannelId = trapChannel.id;
  currentSettings.honeypotChannelId = trapChannel.id;
  await saveSettings(currentSettings);

  const payload = buildContainerV2({
    accentColorHex: "#FF0000",
    authorName: "Naura Anti-Scammer Governance",
    title: "🛡️ Channel Softban (Scammer Trap) Berhasil Diatur!",
    description:
      `Channel <#${trapChannel.id}> kini resmi dikonfigurasikan sebagai **Perangkap Scammer (Honeypot)**!\n\n` +
      `⚠️ **Cara Kerja:** Setiap akun biasa (bukan Admin/Bot) yang mengirim pesan di channel <#${trapChannel.id}> akan **langsung di-banned dari server secara instan**, dan seluruh riwayat pesannya selama 7 hari akan dibersihkan!\n\n` +
      `💡 **Saran:** Buat channel bernama \`#verify-here\` atau \`#click-to-verify\` agar para bot scammer terjebak di sana.`,
    footerText: ui.getFooter("core"),
  });

  return interaction.reply(payload);
};
