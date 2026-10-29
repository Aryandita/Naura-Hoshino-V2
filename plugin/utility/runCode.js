"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const sandboxService = require("../../src/services/sandboxService");
const accessKeyService = require("../../src/services/accessKeyService");
const { logger } = require("../../src/managers/logger");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("run")
    .setDescription("Jalankan script JavaScript di sandbox aman menggunakan Dev Access Key")
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("Kode JavaScript yang akan dieksekusi (contoh: const a = 5; return a * 10;)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("key")
        .setDescription("Kunci akses pengembang yang diberikan oleh Owner (NAURA-DEV-XXXX-XXXX)")
        .setRequired(true),
    ),

  async execute(interaction) {
    const rawCode = interaction.options.getString("code");
    const rawKey = interaction.options.getString("key");

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });

    try {
      // 1. Validasi Kunci Akses Pengembang
      const keyValidation = await accessKeyService.validateKey(rawKey, interaction.user.id);
      if (!keyValidation.valid) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Sandbox Ditolak",
          errorMessage: keyValidation.reason,
          footerText: ui.getFooter("core"),
        });
        return await interaction.editReply(errPayload);
      }

      // 2. Jalankan Kode di Lingkungan Sandbox Terisolasi
      const execResult = await sandboxService.executeSandboxedCode(rawCode);

      // 3. Kurangi Kuota Pemakaian Kunci Akses
      const consumed = await accessKeyService.consumeKey(rawKey);
      const remainingUses = consumed ? Math.max(0, consumed.maxUses - consumed.usedCount) : 0;

      // 4. Bangun Fields Tampilan Hasil
      const fields = [
        {
          name: "⏱️ Waktu Eksekusi",
          value: `\`${execResult.executionTimeMs} ms\``,
          inline: true,
        },
        {
          name: "🔑 Sisa Kuota Kunci",
          value: `\`${remainingUses} kali\``,
          inline: true,
        },
      ];

      if (execResult.logs && execResult.logs.length > 0) {
        const joinedLogs = execResult.logs.join("\n");
        const truncatedLogs = joinedLogs.length > 900 ? `${joinedLogs.substring(0, 900)}\n... (output dipotong)` : joinedLogs;
        fields.push({
          name: "📜 Output Konsol (Logs)",
          value: `\`\`\`text\n${truncatedLogs}\n\`\`\``,
          inline: false,
        });
      }

      if (execResult.error) {
        fields.push({
          name: "⚠️ Pesan Error",
          value: `\`\`\`text\n${execResult.error.substring(0, 900)}\n\`\`\``,
          inline: false,
        });
      } else {
        const resultString = String(execResult.result);
        const truncatedResult = resultString.length > 900 ? `${resultString.substring(0, 900)}\n... (hasil dipotong)` : resultString;
        fields.push({
          name: "📦 Nilai Kembalian (Return Value)",
          value: `\`\`\`javascript\n${truncatedResult}\n\`\`\``,
          inline: false,
        });
      }

      const accentColor = execResult.success
        ? (ui.getColor("success") || "#10B981")
        : (ui.getColor("warning") || "#F59E0B");

      const responsePayload = buildContainerV2({
        accentColorHex: accentColor,
        title: execResult.success ? "⚡ Eksekusi Sandbox Berhasil" : "⚠️ Eksekusi Sandbox Mengalami Masalah",
        description: execResult.success
          ? "Skrip Anda telah selesai dieksekusi di dalam lingkungan terisolasi Node.js VM."
          : "Skrip Anda dieksekusi tetapi mengembalikan error atau melebihi batas sumber daya yang diizinkan.",
        fields,
        footerText: ui.getFooter("core"),
      });

      return await interaction.editReply(responsePayload);
    } catch (err) {
      logger.error("[RunCode Plugin Error]:", err);
      const errPayload = buildErrorContainerV2({
        title: "Gagal Menjalankan Sandbox",
        errorMessage: `Terjadi kendala internal saat memproses perintah: ${err.message}`,
        footerText: ui.getFooter("core"),
      });
      return await interaction.editReply(errPayload);
    }
  },
};
