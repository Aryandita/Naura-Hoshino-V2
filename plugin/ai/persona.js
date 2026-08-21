"use strict";

const {
  SlashCommandBuilder,
  MessageFlags,
} = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const personaEngine = require("../../src/ai/personaEngine");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("persona")
    .setDescription("🤖 AI Multi-Persona Studio & Custom Companion Tuner")
    .addSubcommand((sub) =>
      sub
        .setName("create")
        .setDescription("Buat atau perbarui sub-persona AI khusus di server")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama sub-persona (contoh: Sakura Maid, Dr. Nexus)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("tone")
            .setDescription("Gaya bicara kepribadian AI")
            .addChoices(
              { name: "Tsundere (Ketus & Perhatian)", value: "TSUNDERE" },
              { name: "Cyber Hacker (Analitis & Cepat)", value: "CYBER_HACKER" },
              { name: "Ancient Sage (Puitis & Ramalan Kuno)", value: "ANCIENT_SAGE" },
              { name: "Blacksmith (Pandai Besi Lantang)", value: "BLACKSMITH" },
              { name: "Kuudere (Tenang & Logis)", value: "KUUDERE" },
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("instruksi")
            .setDescription("Instruksi sistem / latar belakang karakter")
            .setRequired(true),
        )
        .addChannelOption((opt) =>
          opt
            .setName("channel")
            .setDescription("Kaitkan persona ini ke channel tertentu (Opsional)")
            .setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("list")
        .setDescription("Lihat seluruh sub-persona AI yang aktif di server"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("chat")
        .setDescription("Bicara langsung dengan sub-persona AI di channel ini")
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Pesan yang ingin kamu sampaikan")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    if (!interaction.guild) {
      return interaction.reply({
        content: "❌ Command ini hanya dapat digunakan di server Discord.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guild.id;
    const channelId = interaction.channel.id;
    const username = interaction.user.displayName || interaction.user.username;

    // 1. CREATE PERSONA
    if (subcommand === "create") {
      await interaction.deferReply();
      const name = interaction.options.getString("nama");
      const tone = interaction.options.getString("tone");
      const systemPrompt = interaction.options.getString("instruksi");
      const targetChannel = interaction.options.getChannel("channel");

      const persona = await personaEngine.createOrUpdatePersona(guildId, {
        name,
        voiceTone: tone,
        systemPrompt,
        channelId: targetChannel ? targetChannel.id : null,
      });

      const payload = buildContainerV2({
        accentColorHex: "#C084FC",
        authorName: "🤖 AI Multi-Persona Studio",
        title: `✨ Persona Baru Terdaftar: ${persona.name}`,
        description: [
          `Sub-persona AI berhasil diaktifkan untuk server ini!`,
          ``,
          `🎭 **Gaya Bicara:** \`${persona.voiceTone}\``,
          `📍 **Channel Khusus:** ${persona.channelId ? `<#${persona.channelId}>` : "*Berlaku di seluruh server*"}`,
          `📜 **Instruksi Karakter:**`,
          `> *"${persona.systemPrompt}"*`,
          ``,
          `-# 💡 *Gunakan \`/persona chat pesan:<teks>\` untuk mulai mengobrol!*`,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    // 2. LIST PERSONAS
    if (subcommand === "list") {
      await interaction.deferReply();
      const list = await personaEngine.getPersonas(guildId);

      if (list.length === 0) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Belum Ada Persona",
            description: "Server ini belum memiliki persona kustom. Buat dengan `/persona create`!",
            footerText: ui.getFooter("core"),
          }),
        });
      }

      const personaList = list
        .map((p, idx) => `**${idx + 1}. ${p.name}** (\`${p.voiceTone}\`)\n- Lokasi: ${p.channelId ? `<#${p.channelId}>` : "Global"}\n- Prompt: *"${p.systemPrompt.substring(0, 60)}..."*`)
        .join("\n\n");

      const payload = buildContainerV2({
        accentColorHex: "#38BDF8",
        authorName: "📋 Daftar Persona AI Aktif",
        title: `Server: ${interaction.guild.name}`,
        description: personaList,
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }

    // 3. CHAT WITH PERSONA
    if (subcommand === "chat") {
      await interaction.deferReply();
      const userMessage = interaction.options.getString("pesan");
      const res = await personaEngine.chatWithPersona(guildId, channelId, userMessage, username);

      const payload = buildContainerV2({
        accentColorHex: "#F472B6",
        authorName: `💬 ${res.personaName} (${res.voiceTone})`,
        title: `Menjawab ${username}`,
        description: [
          `> *"${userMessage}"*`,
          ``,
          res.reply,
        ].join("\n"),
        footerText: ui.getFooter("core"),
      });

      return interaction.editReply(payload);
    }
  },
};
