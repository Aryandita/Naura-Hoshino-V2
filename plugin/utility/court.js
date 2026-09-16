"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const tribunalEngine = require("../../src/ai/tribunalEngine");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("court")
    .setDescription(
      "⚖️ Gelar sidang pengadilan komunitas interaktif bersama 3 Juri AI",
    )
    .addUserOption((opt) =>
      opt
        .setName("terdakwa")
        .setDescription("Member yang diajukan ke meja hijau persidangan")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("perkara")
        .setDescription("Tuntutan atau pokok perkara perkara yang diperkarakan")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("bukti")
        .setDescription("Bukti atau keterangan tambahan (opsional)")
        .setRequired(false),
    )
    .addAttachmentOption((opt) =>
      opt
        .setName("berkas_bukti")
        .setDescription("Lampiran berkas bukti (PDF, DOCX, TXT, CSV log) untuk disidangkan")
        .setRequired(false),
    ),

  async execute(interaction) {
    const plaintiff = interaction.user;
    const defendant = interaction.options.getUser("terdakwa");
    const allegation = interaction.options.getString("perkara");
    let evidence =
      interaction.options.getString("bukti") ||
      "Keterangan saksi mata di server.";

    const attachment = interaction.options.getAttachment("berkas_bukti");
    if (attachment) {
      try {
        const { parseDocument } = require("../../src/ai/documentParser");
        const parsed = await parseDocument(attachment.url, { fileName: attachment.name });
        const snippet = parsed.text ? parsed.text.slice(0, 1500) : "";
        evidence += `\n\n[Lampiran Dokumen Bukti: ${attachment.name}]\n${snippet}`;
      } catch (err) {
        evidence += `\n\n[Lampiran Berkas: ${attachment.name} (Gagal diekstrak: ${err.message})]`;
      }
    }

    const plaintiffName =
      interaction.member?.displayName ||
      plaintiff.displayName ||
      plaintiff.username;
    const defendantName = defendant.displayName || defendant.username;

    if (defendant.id === plaintiff.id) {
      const payload = buildErrorContainerV2({
        title: "Perkara Ditolak",
        description: "Kamu tidak bisa menuntut dirimu sendiri ke pengadilan!",
        footerText: ui.getFooter("utility"),
      });
      return interaction.reply({
        ...payload,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
      });
    }

    await interaction.deferReply();

    const trial = await tribunalEngine.conductTrial({
      plaintiffName,
      defendantName,
      allegation,
      evidenceText: evidence,
    });

    if (!trial.success) {
      const payload = buildErrorContainerV2({
        title: "Sidang Batal",
        description: "Gagal memproses jalannya persidangan perkara!",
        footerText: ui.getFooter("utility"),
      });
      return interaction.editReply(payload);
    }

    const verdictEmoji =
      trial.verdictStatus === "GUILTY"
        ? "🔨 BERSALAH"
        : trial.verdictStatus === "NOT_GUILTY"
          ? "🕊️ TIDAK BERSALAH (BEBAS)"
          : "🤝 DAMAI / RESTORATIF";

    const payload = buildContainerV2({
      authorName: "MAHKAMAH KOMUNITAS CYBER-TRIBUNAL",
      title: `⚖️ Risalah Sidang Perkara: ${plaintiffName} vs ${defendantName}`,
      description: [
        `**📜 Pokok Perkara:** "${allegation}"`,
        `**🔍 Bukti Perkara:** _${evidence}_`,
        ``,
        `🐺 **Argumen Jaksa Cyber-Fang:**`,
        `> "${trial.prosecutor || trial.prosecutorArgument}"`,
        ``,
        `🌸 **Pembelaan Advokat Lyra:**`,
        `> "${trial.defense || trial.defenseArgument}"`,
        ``,
        `⚖️ **Vonis Hakim Agung Vespera [${verdictEmoji}]:**`,
        `> "${trial.judge || trial.judgeVerdict}"`,
        ``,
        `📌 **Ketetapan / Sanksi:** \`${trial.penalty}\``,
      ].join("\n"),
      footerText: ui.getFooter("utility"),
    });

    return interaction.editReply({
      ...payload,
      flags: MessageFlags.IsComponentsV2,
    });
  },
};
