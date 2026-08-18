const { SlashCommandBuilder, PermissionFlagsBits } = require("discord.js");
const path = require("node:path");
const fs = require("node:fs");
const { logger } = require("../../src/managers/logger");
const GuildSettings = require("../../src/models/GuildSettings");
const VoiceManager = require("../../src/managers/voiceManager");
const ui = require("../../src/config/ui");
const {
  buildContainerV2,
  buildErrorContainerV2,
} = require("../../src/utils/NauraContainerBuilder");

const OFFICIAL_SOUNDBOARDS = {
  intro: {
    name: "intro",
    title: "Naura Intro (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Intro (ID).mp3"),
  },
  "intro-en": {
    name: "intro-en",
    title: "Naura Intro (English)",
    file: path.resolve(__dirname, "../../assets/audio/Intro (EN).mp3"),
  },
  "ai-chat": {
    name: "ai-chat",
    title: "AI Chat Greeting (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Ai Chat Intro (ID).mp3"),
  },
  "ai-chat-en": {
    name: "ai-chat-en",
    title: "AI Chat Greeting (English)",
    file: path.resolve(__dirname, "../../assets/audio/Ai Chat Intro (EN).mp3"),
  },
  welcome: {
    name: "welcome",
    title: "Server Welcome Greeting (Indonesian)",
    file: path.resolve(__dirname, "../../assets/audio/Server Join (ID).mp3"),
  },
  "welcome-en": {
    name: "welcome-en",
    title: "Server Welcome Greeting (English)",
    file: path.resolve(__dirname, "../../assets/audio/Server Join (EN).mp3"),
  },
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("soundboard")
    .setDescription("Sistem Efek Suara (Soundboard) Kustom Server")
    .addSubcommand((sub) =>
      sub
        .setName("play")
        .setDescription("Mainkan efek suara tanpa memotong antrean")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama soundboard yang ingin diputar")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub.setName("list").setDescription("Lihat daftar soundboard server ini"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("add")
        .setDescription("Tambahkan soundboard baru (Admin)")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama pendek efek suara (misal: bruh)")
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt
            .setName("url")
            .setDescription("URL audio (MP3/WAV atau YouTube URL)")
            .setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("hapus")
        .setDescription("Hapus soundboard (Admin)")
        .addStringOption((opt) =>
          opt
            .setName("nama")
            .setDescription("Nama soundboard")
            .setRequired(true),
        ),
    ),

  async execute(interaction) {
    await interaction.deferReply();

    const subcommand = interaction.options.getSubcommand();
    const guildId = interaction.guildId;

    const cacheManager = require("../../src/managers/cacheManager");
    const settingsData = await cacheManager.getGuildSettings(guildId);
    const [settings] = await GuildSettings.findOrCreate({ where: { guildId } });
    const currentSettings = settingsData?.settings || settings.settings || {};
    if (!currentSettings.soundboards) currentSettings.soundboards = {};

    if (subcommand === "add") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description:
            "❌ Kamu harus memiliki izin Manage Server untuk menambah soundboard.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      const nama = interaction.options.getString("nama").toLowerCase();
      const url = interaction.options.getString("url");

      if (Object.keys(currentSettings.soundboards).length >= 20) {
        const errPayload = buildErrorContainerV2({
          title: "Batas Maksimum",
          description: "❌ Batas maksimal soundboard adalah 20 per server.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      currentSettings.soundboards[nama] = url;
      settings.settings = currentSettings;
      settings.changed("settings", true);
      await settings.save();
      cacheManager.invalidateGuildSettings(guildId);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("success") || "#22c55e",
        title: "Soundboard Ditambahkan",
        description: `✅ Soundboard **${nama}** berhasil ditambahkan!\nGunakan \`/soundboard play ${nama}\` untuk memutarnya.`,
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(payload);
    }

    if (subcommand === "hapus") {
      if (
        !interaction.member.permissions.has(PermissionFlagsBits.ManageGuild)
      ) {
        const errPayload = buildErrorContainerV2({
          title: "Akses Ditolak",
          description:
            "❌ Kamu harus memiliki izin Manage Server untuk menghapus soundboard.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      const nama = interaction.options.getString("nama").toLowerCase();
      if (!currentSettings.soundboards[nama]) {
        const errPayload = buildErrorContainerV2({
          title: "Tidak Ditemukan",
          description: "❌ Soundboard tidak ditemukan.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      delete currentSettings.soundboards[nama];
      settings.settings = currentSettings;
      settings.changed("settings", true);
      await settings.save();
      cacheManager.invalidateGuildSettings(guildId);

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("error") || "#ef4444",
        title: "Soundboard Dihapus",
        description: `🗑️ Soundboard **${nama}** berhasil dihapus.`,
        footerText: ui.getFooter("music"),
      });
      return interaction.editReply(payload);
    }

    if (subcommand === "list") {
      const customList = Object.keys(currentSettings.soundboards);
      const officialList = Object.keys(OFFICIAL_SOUNDBOARDS);

      const fields = [
        {
          name: "✨ Soundboard Resmi (Official)",
          value: officialList
            .map((name) => `• \`/soundboard play ${name}\` - *${OFFICIAL_SOUNDBOARDS[name].title}*`)
            .join("\n"),
        },
      ];

      if (customList.length > 0) {
        fields.push({
          name: "🎙️ Soundboard Kustom Server",
          value: customList.map((name) => `• **${name}**`).join("\n"),
        });
      }

      const payload = buildContainerV2({
        accentColorHex: ui.getColor("primary") || "#FFB6C1",
        title: "🎙️ Daftar Efek Suara Soundboard",
        description:
          "Mainkan efek suara langsung di Voice Channel tanpa menghentikan antrean musik utama!",
        fields,
        footerText: "Gunakan /soundboard play <nama> untuk memutar",
      });

      return interaction.editReply(payload);
    }

    if (subcommand === "play") {
      const voiceChannel = interaction.member.voice.channel;
      if (!voiceChannel) {
        const errPayload = buildErrorContainerV2({
          title: "Koneksi Gagal",
          description: "❌ Kamu harus berada di Voice Channel terlebih dahulu.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      const nama = interaction.options.getString("nama").toLowerCase();
      const official = OFFICIAL_SOUNDBOARDS[nama];

      // JALUR 1: Official Preset (File Audio Lokal)
      if (official && fs.existsSync(official.file)) {
        const played = await VoiceManager.playFile(
          official.file,
          interaction.member,
        );

        if (played) {
          const payload = buildContainerV2({
            accentColorHex: ui.getColor("primary") || "#FFB6C1",
            title: "🎙️ Naura Official Soundboard",
            description: `✨ Memutar efek suara resmi: **${official.title}** di <#${voiceChannel.id}>!`,
            footerText: ui.getFooter("music"),
          });
          return interaction.editReply(payload);
        }
      }

      // JALUR 2: Custom Server Soundboard URL
      const url = currentSettings.soundboards[nama];

      if (!url) {
        const errPayload = buildErrorContainerV2({
          title: "Tidak Ditemukan",
          description: `❌ Soundboard **${nama}** tidak ditemukan. Gunakan \`/soundboard list\` untuk melihat daftar yang tersedia.`,
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      const poru = interaction.client.musicManager.poru;
      let player = poru.players.get(guildId);

      if (!player) {
        player = poru.createConnection({
          guildId,
          voiceChannel: voiceChannel.id,
          textChannel: interaction.channel.id,
          deaf: true,
        });
      } else if (player.voiceChannel !== voiceChannel.id) {
        const errPayload = buildErrorContainerV2({
          title: "Voice Channel Berbeda",
          description: "❌ Bot sedang berada di Voice Channel lain.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }

      try {
        const res = await poru.resolve({
          query: url,
          requester: interaction.user,
        });
        if (!res || !res.tracks || res.tracks.length === 0) {
          const errPayload = buildErrorContainerV2({
            title: "Gagal Muat Audio",
            description: "❌ Gagal memuat efek suara. Pastikan URL valid.",
            footerText: ui.getFooter("music"),
          });
          return interaction.editReply(errPayload);
        }

        const sbTrack = res.tracks[0];
        let desc = "";

        if (player.isPlaying && player.currentTrack) {
          const mainTrack = player.currentTrack;
          mainTrack.info.resumePosition = player.position;
          player.queue.unshift(mainTrack);
          await player.play(sbTrack);
          desc = `🎙️ Memutar efek suara **${nama}**... (Lagu utama dijeda sementara)`;
        } else {
          player.queue.unshift(sbTrack);
          if (!player.isPlaying && !player.isPaused) player.play();
          desc = `🎙️ Memutar efek suara **${nama}**...`;
        }

        const payload = buildContainerV2({
          accentColorHex: ui.getColor("primary") || "#00FFFF",
          title: "🎙️ Soundboard FX",
          description: desc,
          footerText: ui.getFooter("music"),
        });

        return interaction.editReply(payload);
      } catch (error) {
        logger.error("[SOUNDBOARD ERROR]", error);
        const errPayload = buildErrorContainerV2({
          title: "Gagal Jaringan",
          description: "❌ Terjadi kesalahan jaringan saat memuat efek suara.",
          footerText: ui.getFooter("music"),
        });
        return interaction.editReply(errPayload);
      }
    }
  },
};
