"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const capsuleService = require("../../src/services/capsuleService");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("capsule")
    .setDescription("⏳ Naura Chronicle & Memory Time-Capsule Komunitas")
    .addSubcommand((sub) =>
      sub
        .setName("bury")
        .setDescription("Kubur Kapsul Waktu berisi pesan & kenangan untuk dibuka di masa depan")
        .addStringOption((opt) => opt.setName("judul").setDescription("Judul kapsul kenangan").setRequired(true).setMaxLength(80))
        .addStringOption((opt) => opt.setName("pesan").setDescription("Isi pesan masa lalu").setRequired(true).setMaxLength(600))
        .addIntegerOption((opt) =>
          opt
            .setName("durasi")
            .setDescription("Durasi penguncian kapsul dalam bulan (1 - 12 bulan)")
            .setRequired(false)
            .setMinValue(1)
            .setMaxValue(12),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat daftar Kapsul Waktu yang terkunci di server ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("reveal")
        .setDescription("Buka Kapsul Waktu yang telah jatuh tempo")
        .addStringOption((opt) => opt.setName("kode").setDescription("Kode kapsul (misal: cps-abc12)").setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user;
    const displayName = interaction.member?.displayName || user.displayName || user.username;
    const guildId = interaction.guildId;

    if (subcommand === "bury") {
      await interaction.deferReply();
      const title = interaction.options.getString("judul");
      const message = interaction.options.getString("pesan");
      const duration = interaction.options.getInteger("durasi") || 1;

      const capsule = await capsuleService.buryCapsule(guildId, user.id, displayName, title, message, duration);
      const unlockTs = Math.floor(new Date(capsule.unlockDate).getTime() / 1000);

      const payload = buildContainerV2({
        authorName: "NAURA CHRONICLE & TIME CAPSULE",
        title: "⏳ Kapsul Waktu Berhasil Dikunci!",
        description: [
          `Pesan kenangan dari **${displayName}** telah disegel aman di dalam Brankas Memori Bintang!`,
          ``,
          `📜 **Judul Kapsul:** **${capsule.title}**`,
          `🔑 **Kode Kapsul:** \`${capsule.capsuleCode}\``,
          `🔒 **Durasi Kunci:** \`${duration} Bulan\``,
          `✨ **Tanggal Pembukaan:** <t:${unlockTs}:D> (<t:${unlockTs}:R>)`,
          ``,
          `-# 💡 *Saat tanggal pembukaan tiba, gunakan \`/capsule reveal ${capsule.capsuleCode}\` untuk membuka kenangan masa lalu ini bersama seluruh server!*`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "list") {
      await interaction.deferReply();
      const capsules = await capsuleService.listGuildCapsules(guildId);

      if (!capsules || capsules.length === 0) {
        const payload = buildContainerV2({
          authorName: "NAURA CHRONICLE & TIME CAPSULE",
          title: "⏳ Daftar Kapsul Waktu Server",
          description: `Belum ada Kapsul Waktu yang dikubur di server ini.\n\n💡 *Gunakan \`/capsule bury\` untuk menyegel pesan berharga pertama servermu!*`,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
      }

      const lines = capsules.map((c) => {
        const unlockTs = Math.floor(new Date(c.unlockDate).getTime() / 1000);
        const status = c.isUnlocked ? "🔓 Telah Dibuka" : `🔒 Terkunci (Buka <t:${unlockTs}:R>)`;
        return `• \`${c.capsuleCode}\` **${c.title}** (oleh ${c.authorName})\n  └ ${status}`;
      });

      const payload = buildContainerV2({
        authorName: "NAURA CHRONICLE & TIME CAPSULE",
        title: "⏳ Daftar Kapsul Waktu Server",
        description: `Berikut adalah brankas kapsul waktu yang tersimpan di server ini:\n\n${lines.join("\n\n")}\n\n> *Gunakan \`/capsule reveal <kode>\` untuk membuka kapsul yang sudah jatuh tempo.*`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "reveal") {
      await interaction.deferReply();
      const code = interaction.options.getString("kode");

      const res = await capsuleService.openCapsule(guildId, code, displayName);

      if (!res.success) {
        let msg = "Kapsul tidak dapat dibuka.";
        if (res.reason === "NOT_FOUND") msg = `Kapsul dengan kode \`${code}\` tidak ditemukan di server ini!`;
        if (res.reason === "LOCKED") {
          const unlockTs = Math.floor(new Date(res.unlockDate).getTime() / 1000);
          msg = `Kapsul ini masih disegel oleh sihir waktu! Kapsul baru dapat dibuka pada <t:${unlockTs}:F> (<t:${unlockTs}:R>).`;
        }

        const payload = buildErrorContainerV2({
          title: "Pembukaan Kapsul Tertahan",
          description: msg,
          footerText: ui.getFooter("utility"),
        });
        return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
      }

      const cap = res.capsule;
      const buryTs = Math.floor(new Date(cap.buryDate).getTime() / 1000);

      const payload = buildContainerV2({
        authorName: "NAURA CHRONICLE & TIME CAPSULE",
        title: `🔓 Kapsul Waktu Terbuka: "${cap.title}"`,
        description: [
          `Kapsul waktu yang disegel oleh **${cap.authorName}** pada <t:${buryTs}:D> (<t:${buryTs}:R>) kini terbuka di hadapan **${displayName}** dan seluruh kawan server!`,
          ``,
          `💌 **Pesan Masa Lalu:**`,
          `>>> *"${cap.message}"*`,
          ``,
          `✨ **Kilas Balik AI:**`,
          `_${cap.aiNostalgiaSummary || "Kenangan indah melintasi waktu, menghubungkan masa lalu dengan hari ini."}_`,
        ].join("\n"),
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
  },
};
