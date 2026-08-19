"use strict";

const { SlashCommandBuilder, MessageFlags } = require("discord.js");
const { buildContainerV2, buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const ui = require("../../src/config/ui");
const VoiceManager = require("../../src/managers/voiceManager");
const aiManager = require("../../src/managers/aiManager");

module.exports = {
  data: new SlashCommandBuilder()
    .setName("voice")
    .setDescription("🎙️ Interaksi suara dengan Naura Voice Companion")
    .addSubcommand((sub) =>
      sub
        .setName("speak")
        .setDescription("Minta Naura mengucapkan sesuatu di Voice Channel")
        .addStringOption((opt) =>
          opt
            .setName("pesan")
            .setDescription("Teks yang ingin diucapkan")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("chat")
        .setDescription("Bicara dengan Naura AI dan dengarkan jawabannya secara langsung")
        .addStringOption((opt) =>
          opt
            .setName("tanya")
            .setDescription("Pertanyaan atau sapaan ke Naura")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("waifu")
        .setDescription("Aktifkan mode Cyber Waifu Voice AI real-time di voice channel")
        .addBooleanOption((opt) =>
          opt
            .setName("aktif")
            .setDescription("Nyalakan atau matikan mode Cyber Waifu")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    const member = interaction.member;
    if (!member || !member.voice || !member.voice.channel) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Tidak di Voice Channel",
          description: "Kamu harus bergabung ke dalam Voice Channel terlebih dahulu sebelum memanggil suara Naura!",
          footerText: ui.getFooter("utility"),
        }),
        flags: MessageFlags.Ephemeral,
      });
    }

    const subcommand = interaction.options.getSubcommand();

    if (subcommand === "speak") {
      const text = interaction.options.getString("pesan");
      await interaction.deferReply();

      await VoiceManager.speak(text, member);

      const payload = buildContainerV2({
        accentColorHex: "#FFB6C1",
        authorName: "🎙️ Naura Voice Companion",
        title: "Transmisi Suara Selesai",
        description: `Naura sedang membacakan pesanmu di channel **${member.voice.channel.name}**:\n\n> "${text}"`,
        footerText: ui.getFooter("utility"),
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "chat") {
      const query = interaction.options.getString("tanya");
      await interaction.deferReply();

      try {
        const aiClient = aiManager.getGenAI();
        let replyText = "Halo! Senang bisa mengobrol denganmu di voice channel.";

        if (aiClient) {
          const res = await aiClient.models.generateContent({
            model: aiManager._defaultModel,
            contents: [{ role: "user", parts: [{ text: `Kamu adalah Naura Hoshino, asisten virtual anime yang ceria. Jawab singkat padat maksimal 2 kalimat ramah dalam bahasa Indonesia: ${query}` }] }],
          });
          replyText = res.text || replyText;
        }

        await VoiceManager.speak(replyText, member);

        const payload = buildContainerV2({
          accentColorHex: "#F9A8D4",
          authorName: "🎙️ Naura Voice Companion",
          title: "🌸 Respons Suara Naura",
          description: `**Kamu:** "${query}"\n\n**Naura:** "${replyText}"`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.editReply(payload);
      } catch (e) {
        return interaction.editReply({
          ...buildErrorContainerV2({
            title: "Gagal Berbicara",
            description: `Terjadi kendala saat menghasilkan respons suara: ${e.message}`,
            footerText: ui.getFooter("utility"),
          }),
        });
      }
    }

    if (subcommand === "waifu") {
      const aktif = interaction.options.getBoolean("aktif");
      const voiceAgent = require("../../src/ai/voiceAgent");

      if (aktif) {
        voiceAgent.startSession(interaction.guildId, {
          channelId: member.voice.channel.id,
          initiatorId: interaction.user.id,
        });

        const payload = buildContainerV2({
          accentColorHex: "#38BDF8",
          authorName: "🎙️ Cyber Waifu Voice AI",
          title: "🤖 Mode Cyber Waifu Aktif!",
          description: `Naura sekarang mendengarkan obrolan di **${member.voice.channel.name}**!\n\nPanggil nama **Naura** di voice chat untuk mulai berbicara dengannya secara real-time.`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.reply(payload);
      } else {
        voiceAgent.stopSession(interaction.guildId);

        const payload = buildContainerV2({
          accentColorHex: "#64748B",
          authorName: "🎙️ Cyber Waifu Voice AI",
          title: "💤 Mode Cyber Waifu Dinonaktifkan",
          description: `Naura telah berhenti mendengarkan voice channel **${member.voice.channel.name}**. Sampai jumpa lagi!`,
          footerText: ui.getFooter("utility"),
        });

        return interaction.reply(payload);
      }
    }
  },
};
