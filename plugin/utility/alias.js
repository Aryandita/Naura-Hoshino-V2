"use strict";

const { SlashCommandBuilder } = require("discord.js");
const aliasService = require("../../src/services/aliasService");
const { buildContainerV2, buildSuccessContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("alias")
    .setDescription("Kelola shortcut perintah kustom pribadi Kakak")
    .addSubcommand((sub) =>
      sub
        .setName("set")
        .setDescription("Daftarkan atau perbarui shortcut perintah kustom")
        .addStringOption((opt) =>
          opt
            .setName("shortcut")
            .setDescription("Nama kata pemicu shortcut (contoh: f, d, lb)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("perintah")
            .setDescription("Perintah target lengkap yang akan dijalankan (contoh: farm status, daily, leaderboard)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat semua daftar shortcut perintah aktif Kakak"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("remove")
        .setDescription("Hapus shortcut perintah yang tidak lagi digunakan")
        .addStringOption((opt) =>
          opt
            .setName("shortcut")
            .setDescription("Nama shortcut yang ingin dihapus")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const sub = interaction.options.getSubcommand();
    const userId = interaction.user.id;

    try {
      if (sub === "set") {
        const shortcut = interaction.options.getString("shortcut");
        const targetCommand = interaction.options.getString("perintah");

        const result = await aliasService.setAlias(userId, shortcut, targetCommand);
        if (!result.success) {
          const errPayload = buildErrorContainerV2({
            title: "Gagal Menyimpan Shortcut",
            errorMessage: result.message,
            footerText: ui.getFooter("utility"),
          });
          return interaction.reply(errPayload);
        }

        const successPayload = buildSuccessContainerV2({
          title: "Shortcut Berhasil Disimpan",
          message: [
            result.message,
            "",
            "- # *Kakak sekarang bisa mengetik `n!" + shortcut + "` untuk langsung mengeksekusi perintah tersebut!*",
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply(successPayload);
      }

      if (sub === "remove") {
        const shortcut = interaction.options.getString("shortcut");
        const result = await aliasService.removeAlias(userId, shortcut);

        if (!result.success) {
          const errPayload = buildErrorContainerV2({
            title: "Shortcut Tidak Ditemukan",
            errorMessage: result.message,
            footerText: ui.getFooter("utility"),
          });
          return interaction.reply(errPayload);
        }

        const successPayload = buildSuccessContainerV2({
          title: "Shortcut Dihapus",
          message: result.message,
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply(successPayload);
      }

      if (sub === "list") {
        const aliases = await aliasService.getAliases(userId);

        if (!aliases || aliases.length === 0) {
          const emptyPayload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            authorName: "NAURA COMMAND SHORTCUTS",
            title: "⌨️ Daftar Shortcut Pribadi",
            description: [
              "Kakak belum memiliki shortcut perintah kustom.",
              "",
              "Daftarkan shortcut baru menggunakan:",
              "`/alias set shortcut:<nama> perintah:<tujuan>`",
              "- # *Contoh: `/alias set shortcut:f perintah:farm status`*",
            ].join("\n"),
            footerText: ui.getFooter("utility"),
          });
          return interaction.reply(emptyPayload);
        }

        const lines = aliases.map(
          (a, i) => `${i + 1}. \`${a.name}\` ➔ \`${a.targetCommand}\``,
        );

        const listPayload = buildContainerV2({
          accentColorHex: "#38BDF8",
          authorName: "NAURA COMMAND SHORTCUTS",
          title: `⌨️ Shortcut Pribadi Kakak (${aliases.length}/${aliasService.MAX_ALIASES_DEFAULT})`,
          description: [
            "Berikut adalah shortcut aktif yang dapat Kakak gunakan:",
            "",
            lines.join("\n"),
            "",
            "- # *Ketik `n!<shortcut>` pada channel teks untuk menjalankan shortcut.*",
          ].join("\n"),
          footerText: ui.getFooter("utility"),
        });
        return interaction.reply(listPayload);
      }
    } catch (err) {
      logger.error("Error executing /alias command:", err);
      const errPayload = buildErrorContainerV2({
        title: "Terjadi Kesalahan",
        errorMessage: "Gagal memproses pengaturan shortcut alias.",
        footerText: ui.getFooter("utility"),
      });
      return interaction.reply(errPayload).catch(() => {});
    }
  },
};
