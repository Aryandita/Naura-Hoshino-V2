"use strict";

const {
  SlashCommandBuilder,
  AttachmentBuilder,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const canvasWorkerPool = require("../../src/canvas/canvasWorkerPool");
const { logger } = require("../../src/managers/logger");

const SUPPORTED_LANGUAGES = [
  { name: "JavaScript", value: "javascript" },
  { name: "TypeScript", value: "typescript" },
  { name: "Python", value: "python" },
  { name: "Rust", value: "rust" },
  { name: "Go", value: "go" },
  { name: "HTML", value: "html" },
  { name: "CSS", value: "css" },
  { name: "JSON", value: "json" },
  { name: "Bash", value: "bash" },
];

const SUPPORTED_THEMES = [
  { name: "Dracula", value: "dracula" },
  { name: "Monokai", value: "monokai" },
  { name: "One Dark", value: "one-dark" },
  { name: "Stellar Cyberpunk", value: "stellar" },
];

module.exports = {
  name: "carbon",
  aliases: ["codeview"],
  description: "Render potongan kode program menjadi kartu visual editor macOS yang elegan.",

  data: new SlashCommandBuilder()
    .setName("carbon")
    .setDescription("📸 Render potongan kode program menjadi kartu visual editor macOS")
    .addStringOption((opt) =>
      opt
        .setName("code")
        .setDescription("Potongan kode program yang ingin dirender (maks 2000 karakter)")
        .setRequired(true),
    )
    .addStringOption((opt) =>
      opt
        .setName("language")
        .setDescription("Bahasa pemrograman untuk penyorotan sintaks")
        .setRequired(false)
        .addChoices(...SUPPORTED_LANGUAGES),
    )
    .addStringOption((opt) =>
      opt
        .setName("theme")
        .setDescription("Tema warna editor jendela")
        .setRequired(false)
        .addChoices(...SUPPORTED_THEMES),
    )
    .addBooleanOption((opt) =>
      opt
        .setName("show_line_numbers")
        .setDescription("Tampilkan kolom nomor baris (Default: Benar)")
        .setRequired(false),
    )
    .addStringOption((opt) =>
      opt
        .setName("title")
        .setDescription("Judul file pada titlebar jendela (contoh: main.js)")
        .setRequired(false),
    ),

  async execute(interaction) {
    let code = interaction.options?.getString("code");
    const language = interaction.options?.getString("language") || "javascript";
    const theme = interaction.options?.getString("theme") || "one-dark";
    const showLineNumbers =
      interaction.options?.getBoolean("show_line_numbers") ?? true;
    const customTitle = interaction.options?.getString("title") || null;

    if (!code || typeof code !== "string" || code.trim().length === 0) {
      const errContainer = buildContainerV2({
        accentColorHex: ui.getColor("error") || "#EF4444",
        authorName: "Naura Carbon Studio",
        title: "Kode Tidak Boleh Kosong",
        description: "Silakan masukkan potongan kode sumber yang ingin dirender menjadi kartu visual.",
        footerText: ui.getFooter("core"),
      });
      return interaction.reply({
        ...errContainer,
        flags: MessageFlags.Ephemeral,
      });
    }

    // Bersihkan karakter markdown wrapper codeblock jika user memasukkan ```lang ... ```
    const codeBlockMatch = code.match(/^```(?:[a-zA-Z0-9_-]+)?\r?\n([\s\S]*?)\r?\n?```$/);
    if (codeBlockMatch) {
      code = codeBlockMatch[1];
    }

    // Batasi panjang maksimum 2000 karakter
    if (code.length > 2000) {
      code = code.slice(0, 2000);
    }

    // Defer reply karena rendering Canvas berjalan via worker thread pool
    if (!interaction.deferred && !interaction.replied) {
      await interaction.deferReply().catch(() => {});
    }

    try {
      const buffer = await canvasWorkerPool.runTask("renderCarbon", {
        code,
        language,
        theme,
        showLineNumbers,
        title: customTitle,
      });

      const attachment = new AttachmentBuilder(buffer, { name: "carbon.png" });

      const langUpper = language.toUpperCase();
      const previewSnippet =
        code.length > 120 ? code.slice(0, 117).trim() + "..." : code.trim();

      const container = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#38BDF8",
        authorName: "Naura Carbon Studio",
        title: `Editor Visual: ${customTitle || `${language}_snippet`}`,
        description: [
          `Bahasa: **${langUpper}** • Tema: **${theme}** • Nomor Baris: **${showLineNumbers ? "Aktif" : "Nonaktif"}**`,
          "",
          "```" + language,
          previewSnippet,
          "```",
        ].join("\n"),
        footerText: `Dirender untuk ${interaction.user.username} • Naura Smart Utilities`,
        withBanner: false,
      });

      await interaction.editReply({
        ...container,
        files: [attachment],
      });
    } catch (err) {
      logger.error("[Carbon] Gagal merender kartu visual kode:", err);

      const errContainer = buildContainerV2({
        accentColorHex: ui.getColor("error") || "#EF4444",
        authorName: "Naura Carbon Studio",
        title: "Gagal Merender Kode",
        description: "Terjadi kendala saat memproses rendering gambar kode program. Silakan coba kembali beberapa saat lagi.",
        footerText: ui.getFooter("core"),
      });

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply({ ...errContainer }).catch(() => {});
      } else {
        await interaction.reply({
          ...errContainer,
          flags: MessageFlags.Ephemeral,
        }).catch(() => {});
      }
    }
  },
};
