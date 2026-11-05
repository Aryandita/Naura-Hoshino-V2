"use strict";

/**
 * @file cleanup.js
 * @description Slash command /cleanup untuk membersihkan pesan bot, kartu canvas,
 * dan komponen container kosong (ghost shells) secara tuntas dari channel Discord.
 */

const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  MessageFlags,
} = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const {
  safeDeleteMessage,
  deleteAfterDelay,
} = require("../../src/utils/messageHelper");
const ui = require("../../src/config/ui");
const { logger } = require("../../src/managers/logger");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("cleanup")
    .setDescription(
      "🧹 Bersihkan pesan bot atau container kosong secara tuntas dari channel.",
    )
    .addIntegerOption((opt) =>
      opt
        .setName("jumlah")
        .setDescription(
          "Jumlah riwayat pesan yang diperiksa (1-100, default: 10)",
        )
        .setMinValue(1)
        .setMaxValue(100),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("hanya_bot")
        .setDescription(
          "Hanya bersihkan pesan yang dikirim oleh bot (default: true)",
        ),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("hanya_container")
        .setDescription(
          "Hanya bersihkan cangkang container atau pesan tanpa konten (default: false)",
        ),
    ),

  async execute(interaction) {
    const amount = interaction.options.getInteger("jumlah") || 10;
    const onlyBot = interaction.options.getBoolean("hanya_bot") ?? true;
    const onlyContainer =
      interaction.options.getBoolean("hanya_container") ?? false;

    // Pemeriksaan izin: jika membersihkan pesan selain bot di guild, butuh izin ManageMessages
    if (interaction.guild && !onlyBot) {
      const hasPerm = interaction.memberPermissions?.has(
        PermissionFlagsBits.ManageMessages,
      );
      if (!hasPerm) {
        const errorPayload = buildErrorContainerV2({
          title: "Izin Diperlukan",
          errorMessage:
            "Kakak membutuhkan izin `Manage Messages` untuk membersihkan pesan pengguna lain di channel ini.",
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply({
          ...errorPayload,
          flags: MessageFlags.Ephemeral,
        });
      }
    }

    // Tanggapi secara ephemeral agar proses pembersihan tidak meninggalkan jejak publik permanen
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    const channel = interaction.channel;
    if (!channel || typeof channel.messages?.fetch !== "function") {
      const errPayload = buildErrorContainerV2({
        title: "Channel Tidak Didukung",
        errorMessage: "Pembersihan pesan tidak dapat dilakukan di channel ini.",
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply(errPayload);
    }

    let cleanedCount = 0;
    let checkedCount = 0;

    try {
      const fetched = await channel.messages.fetch({ limit: amount });
      checkedCount = fetched.size;

      const selfBotId = interaction.client?.user?.id;
      const targetMessages = [];

      for (const msg of fetched.values()) {
        // Jangan hapus interaksi yang sedang berlangsung jika pesan itu adalah pesan ephemeral saat ini
        if (msg.id === interaction.id) continue;

        if (onlyBot) {
          const isBot =
            msg.author?.bot || (selfBotId && msg.author?.id === selfBotId);
          if (!isBot) continue;
        }

        if (onlyContainer) {
          const hasContent = Boolean(
            msg.content && msg.content.trim().length > 0,
          );
          const hasAttachments = Boolean(
            msg.attachments && msg.attachments.size > 0,
          );
          const hasEmbeds = Boolean(msg.embeds && msg.embeds.length > 0);
          const hasComponents =
            Array.isArray(msg.components) && msg.components.length > 0;

          // Ghost container: pesan tanpa teks, tanpa lampiran, dan tanpa embed aktif
          const isGhost =
            !hasContent && !hasAttachments && !hasEmbeds && !hasComponents;
          if (!isGhost) continue;
        }

        targetMessages.push(msg);
      }

      // Hapus pesan target satu per satu secara aman menggunakan safeDeleteMessage
      for (const msg of targetMessages) {
        const success = await safeDeleteMessage(msg);
        if (success) {
          cleanedCount++;
        }
      }
    } catch (err) {
      logger.debug(
        `[cleanup:execute] Galat saat mengambil atau menghapus pesan: ${err?.message || err}`,
      );
    }

    const resultPayload = buildContainerV2({
      accentColorHex: ui.getColor("success") || "#10B981",
      authorName: "Naura Cleaner Service",
      title: "🧹 Pembersihan Channel Selesai",
      expression: "sparkle",
      description: [
        "Pembersihan pesan telah berhasil dijalankan tanpa meninggalkan sisa container kosong.",
        "",
        `• **Pesan Diperiksa:** \`${checkedCount}\` riwayat pesan`,
        `• **Pesan Dihapus Total:** \`${cleanedCount}\` pesan`,
        `• **Filter Bot Saja:** \`${onlyBot ? "Ya" : "Tidak"}\``,
        `• **Filter Cangkang Container:** \`${onlyContainer ? "Ya" : "Tidak"}\``,
        "",
        "- # *Pemberitahuan ephemeral ini akan otomatis terhapus dalam beberapa detik.*",
      ].join("\n"),
      footerText: ui.getFooter("utility"),
    });

    await interaction.editReply(resultPayload);

    // Jadwalkan auto-delete untuk balasan ephemeral ini setelah 10 detik (dapat dinonaktifkan via _autoDismissMs)
    const autoDismissMs = interaction._autoDismissMs ?? 10000;
    if (autoDismissMs > 0) {
      deleteAfterDelay(interaction, autoDismissMs);
    }
  },
};
