"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const env = require("../../src/config/env");
const {
  resolveGuildLanguage,
  createMockInteraction,
  face,
} = require("./helpers/coreShared");

const ping = require("./subcommands/ping");
const stats = require("./subcommands/stats");
const info = require("./subcommands/info");
const about = require("./subcommands/about");
const partner = require("./subcommands/partner");
const language = require("./subcommands/language");
const help = require("./subcommands/help");

const SUBCOMMANDS = {
  ping,
  stats,
  info,
  about,
  partner,
  partnership: partner,
  language,
  help,
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("core")
    .setDescription("Pusat Informasi & Sistem Inti Naura Hoshino / Core System")
    .addSubcommand((s) => s.setName("ping").setDescription("Cek respons latensi Discord, Supabase, & Lavalink."))
    .addSubcommand((s) => s.setName("stats").setDescription("Lihat diagnostik spesifikasi server, RAM, dan OS Naura."))
    .addSubcommand((s) => s.setName("info").setDescription("Tampilkan info spesifik server saat ini atau info bot."))
    .addSubcommand((s) => s.setName("about").setDescription("Kenalan lebih dekat dengan Naura dan Aryandita!"))
    .addSubcommand((s) =>
      s.setName("help").setDescription("Buka panduan perintah interaktif Naura.")
        .addStringOption((o) => o.setName("command").setDescription("Cari nama command spesifik").setAutocomplete(true)),
    )
    .addSubcommand((s) =>
      s.setName("language").setDescription("Ubah bahasa bot di server ini / Change bot language")
        .addStringOption((o) =>
          o.setName("lang").setDescription("Pilih bahasa / Select language").setRequired(true)
            .addChoices({ name: "Indonesian", value: "id" }, { name: "English", value: "en" }),
        ),
    )
    .addSubcommand((s) => s.setName("partner").setDescription("Informasi program partnership komunitas resmi.")),

  aliases: ["ping", "stats", "info", "about", "help", "partner", "partnership"],

  async autocomplete(interaction, client) {
    if (interaction.options.getSubcommand() === "help") {
      return help.autocomplete(interaction, client);
    }
  },

  async executePrefix(message, args, client) {
    const prefix = env.PREFIX || "n!";
    const cmdName = message.content.slice(prefix.length).trim().split(/ +/)[0].toLowerCase();

    let subcommand = cmdName === "core" ? (args[0]?.toLowerCase() || null) : cmdName;
    if (subcommand === "lang") subcommand = "language";
    if (subcommand === "partnership") subcommand = "partner";

    const languageManager = require("../../src/managers/languageManager");
    const lang = message.localeLang
      ? (languageManager.getLanguageSync(message.localeLang) || await resolveGuildLanguage(message.guild?.id))
      : await resolveGuildLanguage(message.guild?.id);
    const handler = SUBCOMMANDS[subcommand];
    if (!handler) {
      return message.reply(
        lang.ERROR_INVALID_SUBCOMMAND ||
          `${face("error", "\u274C")} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`,
      );
    }

    const val = cmdName === "core" ? args[1] : args[0];
    const mockInteraction = createMockInteraction(message, client, {
      lang: val?.toLowerCase() || null,
      pilihan: val?.toLowerCase() || null,
      command: (cmdName === "core" ? args.slice(1).join(" ") : args.join(" ")) || null,
      subcommand,
    });

    return handler(mockInteraction, client, lang);
  },

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const handler = SUBCOMMANDS[subcommand];
    const languageManager = require("../../src/managers/languageManager");
    const lang = interaction.localeLang
      ? (languageManager.getLanguageSync(interaction.localeLang) || await resolveGuildLanguage(interaction.guild?.id))
      : await resolveGuildLanguage(interaction.guild?.id);

    if (!handler) {
      return interaction.reply({
        content:
          lang.ERROR_INVALID_SUBCOMMAND ||
          `${face("error", "\u274C")} Aduh, Naura belum kenal perintah itu. Coba cek lewat menu help yaa~`,
        flags: MessageFlags.Ephemeral,
      });
    }

    return handler(interaction, interaction.client, lang);
  },
};
