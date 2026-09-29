"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const cmdRun = require("./runCode");
const cmdNpm = require("./npm");
const cmdGithub = require("./github");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("dev")
    .setDescription("💻 Perkakas Developer: Eksekusi sandbox aman, pencarian NPM package, dan profil GitHub.")
    .addSubcommand((sub) =>
      sub
        .setName("run")
        .setDescription("Jalankan script JavaScript di sandbox aman menggunakan Dev Access Key")
        .addStringOption((opt) =>
          opt
            .setName("code")
            .setDescription("Kode JavaScript yang akan dieksekusi")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("key")
            .setDescription("Kunci akses pengembang (NAURA-DEV-XXXX-XXXX)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("npm")
        .setDescription("📦 Cari informasi package NPM.")
        .addStringOption((opt) =>
          opt
            .setName("package")
            .setDescription("Nama package NPM (contoh: discord.js)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("github")
        .setDescription("🐙 Cari profil pengguna GitHub.")
        .addStringOption((opt) =>
          opt
            .setName("username")
            .setDescription("Username GitHub")
            .setRequired(true),
        ),
    ),

  async execute(interaction, client) {
    const subcommand = interaction.options.getSubcommand();
    switch (subcommand) {
      case "run":
        return cmdRun.execute(interaction, client);
      case "npm":
        return cmdNpm.execute(interaction, client);
      case "github":
        return cmdGithub.execute(interaction, client);
      default:
        return interaction.reply({
          content: "Subcommand tidak dikenali.",
          flags: MessageFlags.Ephemeral,
        });
    }
  },
};
