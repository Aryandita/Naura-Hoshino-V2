"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const radioService = require("../../src/services/radioService");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("radio")
    .setDescription("📻 Naura Virtual Radio DJ & Voice Channel Companion")
    .addSubcommand((sub) =>
      sub
        .setName("status")
        .setDescription("Lihat status siaran radio Naura di Voice Channel saat ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("message")
        .setDescription("Kirimkan titipan salam atau curhat ke stasiun radio Naura")
        .addStringOption((opt) => opt.setName("pesan").setDescription("Isi pesan yang ingin dibacakan").setRequired(true).setMaxLength(180))
        .addBooleanOption((opt) => opt.setName("anon").setDescription("Kirim sebagai pengirim rahasia (anonim)").setRequired(false)),
    )
    .addSubcommand((sub) =>
      sub
        .setName("lofi")
        .setDescription("Nyalakan mode Midnight Lo-Fi & Starlight Chill Soundscape"),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const user = interaction.user;
    const displayName = interaction.member?.displayName || user.displayName || user.username;
    const guildId = interaction.guildId;

    if (subcommand === "status") {
      await interaction.deferReply();
      const pending = await radioService.getPendingRadioMessages(guildId);
      const presets = radioService.getPresets();

      const msgLines = pending.length > 0
        ? pending.map((m) => `• **${m.author}**: "${m.text}"`).join("\n")
        : "*Belum ada titipan salam di antrean radio.*";

      const presetLines = presets.map((p) => `• **${p.name}**\n  _${p.desc}_`).join("\n");

      const payload = buildContainerV2({
        authorName: "NAURA VIRTUAL RADIO 2.1",
        title: "📻 Stasiun Radio Naura Hoshino Mengudara!",
        description: `Halo, **${displayName}**! Stasiun Radio Naura siap menemani sesi mengobrol dan belajar di Voice Channel dengan host AI yang ramah.\n\n🎙️ **Antrean Titipan Salam Radio:**\n${msgLines}\n\n🎧 **Preset Soundscape Santai:**\n${presetLines}\n\n> *Gunakan \`/radio message\` untuk mengirimkan salam atau curhatmu ke siaran live!*`,
        footerText: ui.getFooter("music"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "message") {
      await interaction.deferReply();
      const pesan = interaction.options.getString("pesan");
      const isAnon = interaction.options.getBoolean("anon") || false;

      const entry = await radioService.queueRadioMessage(guildId, displayName, pesan, isAnon);

      const payload = buildContainerV2({
        authorName: "NAURA VIRTUAL RADIO 2.1",
        title: "💌 Titipan Salam Radio Berhasil Terkirim!",
        description: `Pesan dari **${entry.author}** telah masuk ke antrean siaran Radio Naura!\n\n> *"${entry.text}"*\n\n📻 *Naura akan membacakan pesan ini di Voice Channel pada jeda pergantian lagu berikutnya.*`,
        footerText: ui.getFooter("music"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }

    if (subcommand === "lofi") {
      await interaction.deferReply();
      const payload = buildContainerV2({
        authorName: "NAURA VIRTUAL RADIO 2.1",
        title: "🌧️ Midnight Lo-Fi & Starlight Chill Aktif!",
        description: `Suasana radio telah dialihkan ke gelombang santai **Midnight Lo-Fi & Rintik Hujan** untuk **${displayName}** dan seluruh kawan-kawan di server!\n\n☕ *Selamat bersantai, belajar, dan beristirahat di bawah naungan bintang kosmik.*`,
        footerText: ui.getFooter("music"),
      });

      return interaction.editReply({ ...payload, flags: MessageFlags.IsComponentsV2 });
    }
  },
};
