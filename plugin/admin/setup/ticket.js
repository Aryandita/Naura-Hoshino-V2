const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../../src/utils/NauraContainerBuilder");
const ui = require("../../../src/config/ui");
const { logger } = require("../../../src/managers/logger");

module.exports = async function handle(
  interaction,
  { currentSettings, saveSettings },
) {
  const mode = interaction.options.getString("mode");
  const category = interaction.options.getChannel("kategori");
  const logChan = interaction.options.getChannel("log");
  const panel = interaction.options.getChannel("panel");

  if (mode === "channel" && !category) {
    return interaction.reply(
      buildErrorContainerV2({
        title: "Kategori Diperlukan",
        description:
          "Kamu memilih mode `Text Channel`, jadi opsi `kategori` wajib diisi!",
        footerText: ui.getFooter("core"),
      }),
    );
  }

  currentSettings.ticketMode = mode;
  currentSettings.ticketCategory = category ? category.id : null;
  if (logChan) currentSettings.ticketLogChannel = logChan.id;
  await saveSettings(currentSettings);

  let extraMsg = "";
  if (panel) {
    try {
      const panelPayload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: "Naura Helpdesk Services",
        title: "🎫 Pusat Bantuan & Pelayanan",
        description:
          "Selamat datang di Pusat Bantuan!\n\nJika kamu memiliki pertanyaan, ingin melaporkan sesuatu, atau membutuhkan bantuan dari Staff/Admin, silakan buat tiket baru dengan menekan tombol di bawah.\n\n⚠️ **Mohon jangan menyalahgunakan sistem tiket!**",
        buttonsRow: new ActionRowBuilder().addComponents(
          new ButtonBuilder()
            .setCustomId("btn_ticket_open")
            .setLabel("Buka Tiket Baru")
            .setEmoji("🎫")
            .setStyle(ButtonStyle.Primary),
        ),
        footerText: ui.getFooter("core"),
      });
      await panel.send(panelPayload);
      extraMsg = `\n✅ Pesan panel tiket berhasil dikirim ke <#${panel.id}>.`;
    } catch (err) {
      logger.error(`[SetupTicket] Gagal mengirim panel: ${err.message}`);
      extraMsg = `\n❌ Gagal mengirim panel ke <#${panel.id}>. Pastikan bot memiliki izin Send Messages & View Channel.`;
    }
  }

  const payload = buildContainerV2({
    accentColorHex: ui.getColor("primary"),
    authorName: "Naura Ticketing Module",
    title: "🎫 Setup Tiket Berhasil",
    description: `Mode: **${mode === "thread" ? "Private Thread" : "Text Channel"}**\nKategori Tiket: ${category ? `<#${category.id}>` : "*Otomatis di Thread*"}\nChannel Log Tiket: ${logChan ? `<#${logChan.id}>` : "*Belum Diatur*"}${extraMsg}`,
    footerText: ui.getFooter("core"),
  });
  return interaction.reply(payload);
};
