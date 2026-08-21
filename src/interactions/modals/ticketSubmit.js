"use strict";

const { ChannelType, MessageFlags } = require("discord.js");
const { buildContainerV2 } = require("../../utils/NauraContainerBuilder");
const UserTicket = require("../../models/UserTicket");
const ui = require("../../config/ui");

module.exports = [
  {
    id: "ticket_submit",
    label: "ticket-submit",
    async handler(interaction) {
      await interaction.deferReply({ flags: MessageFlags.Ephemeral });

      const topic = interaction.fields.getTextInputValue("ticket_topic");
      const detail = interaction.fields.getTextInputValue("ticket_detail");
      const channel = interaction.channel;

      try {
        // Cek apakah user sudah punya tiket open di channel ini
        const existingTicket = await UserTicket.findOne({
          where: {
            guildId: interaction.guild.id,
            userId: interaction.user.id,
            status: "open",
          },
        });

        if (existingTicket) {
          return interaction.editReply(
            `❌ Kamu masih memiliki tiket yang aktif (<#${existingTicket.ticketId}>). Tutup tiket tersebut terlebih dahulu sebelum membuat yang baru.`,
          );
        }

        // Baca preferensi Guild
        const cacheManager = require("../../managers/cacheManager");
        let guildSettings = null;
        try {
          const data = await cacheManager.getGuildSettings(interaction.guild.id);
          guildSettings = data?.settings;
        } catch (e) {
          /* abaikan */
        }

        const mode = guildSettings?.ticketMode || "thread";
        const categoryId = guildSettings?.ticketCategory;

        const threadName = `🎫・${interaction.user.username}-${topic.substring(0, 15)}`;
        let ticketChannelOrThread;

        if (mode === "channel") {
          ticketChannelOrThread = await interaction.guild.channels.create({
            name: threadName,
            type: ChannelType.GuildText,
            parent: categoryId || null,
            permissionOverwrites: [
              {
                id: interaction.guild.roles.everyone.id,
                deny: ["ViewChannel"],
              },
              {
                id: interaction.user.id,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory"],
              },
              {
                id: interaction.client.user.id,
                allow: ["ViewChannel", "SendMessages", "ReadMessageHistory", "ManageChannels"],
              },
            ],
            reason: `Tiket baru dari ${interaction.user.tag}`,
          });
        } else {
          ticketChannelOrThread = await channel.threads.create({
            name: threadName,
            type: ChannelType.PrivateThread,
            invitable: false,
            reason: `Tiket baru dari ${interaction.user.tag}`,
          });
          await ticketChannelOrThread.members.add(interaction.user.id);
        }

        // Simpan ke DB
        await UserTicket.create({
          userId: interaction.user.id,
          guildId: interaction.guild.id,
          ticketId: ticketChannelOrThread.id,
          topic,
          status: "open",
        });

        // Visual step timeline tracker
        const timeline = ui.ux.buildVisualTimeline({
          steps: [
            { label: "Isi Formulir" },
            { label: "Verifikasi Staff" },
            { label: "Tiket Tuntas" },
          ],
          currentStepIndex: 1,
          user: interaction.user,
          lang: "id",
        });

        // Kirim pesan pertama di thread
        const threadContainer = buildContainerV2({
          title: `🎫 Tiket: ${topic}`,
          description: `${timeline.timeline}\n*${timeline.message}*\n\nHalo <@${interaction.user.id}>!\n\nTerima kasih telah menghubungi kami. Admin/Staff akan segera membalas tiketmu.\n\n**Detail Masalah:**\n\`\`\`${detail}\`\`\``,
          color: "#F9A8D4",
          footerText: "Gunakan tombol di bawah untuk menutup tiket.",
          buttonsRow: [
            {
              customId: "ticket_close",
              label: "Tutup Tiket",
              style: 4, // Danger (Red)
              emoji: "🔒",
            },
          ],
        });

        await ticketChannelOrThread.send({ content: `<@${interaction.user.id}>` });
        await ticketChannelOrThread.send(threadContainer);

        return interaction.editReply(
          `✅ Tiket berhasil dibuat! Silakan menuju ke sini: <#${ticketChannelOrThread.id}>`,
        );
      } catch (error) {
        console.error("[TicketSubmit] Gagal membuat tiket:", error);
        return interaction.editReply(
          '❌ Gagal membuat tiket. Pastikan Naura memiliki izin "Create Private Threads".',
        );
      }
    },
  },
];
