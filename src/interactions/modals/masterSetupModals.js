const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
const { updateGuildSetting } = require("../../managers/guildSettingsService");
const ui = require("../../config/ui");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const { logger } = require("../../managers/logger");

module.exports = [
  {
    id: "modal_setup_ticket",
    label: "modal-setup-ticket",
    async handler(interaction) {
      const categoryId =
        interaction.fields.getTextInputValue("ticket_category");
      const logId = interaction.fields.getTextInputValue("ticket_log");
      const panelId = interaction.fields.getTextInputValue("ticket_panel");

      // Save settings
      await updateGuildSetting(interaction.guild.id, (settings) => {
        settings.ticketCategory = categoryId;
        if (logId) settings.ticketLogChannel = logId;
      });

      let extraMsg = "";

      // Send panel if ID provided
      if (panelId) {
        try {
          const panelChannel = await interaction.guild.channels
            .fetch(panelId)
            .catch(() => null);
          if (panelChannel) {
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
            await panelChannel.send(panelPayload);
            extraMsg = `\n✅ Pesan panel tiket berhasil dikirim ke <#${panelId}>.`;
          } else {
            extraMsg = `\n❌ Channel panel dengan ID ${panelId} tidak ditemukan.`;
          }
        } catch (err) {
          logger.error(
            `[ModalSetupTicket] Gagal mengirim panel: ${err.message}`,
          );
          extraMsg = `\n❌ Gagal mengirim panel ke <#${panelId}>. Pastikan bot memiliki izin Send Messages & View Channel.`;
        }
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary"),
        authorName: "Naura Ticketing Module",
        title: "🎫 Setup Tiket Berhasil",
        description: `Kategori Tiket: <#${categoryId}>\nChannel Log Tiket: ${logId ? `<#${logId}>` : "*Belum Diatur*"}${extraMsg}`,
        footerText: ui.getFooter("core"),
      });

      return interaction.reply(payload);
    },
  },
];
