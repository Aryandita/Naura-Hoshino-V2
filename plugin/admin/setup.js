const {
  SlashCommandBuilder,
  PermissionFlagsBits,
  ChannelType,
} = require("discord.js");
const GuildSettings = require("../../src/models/GuildSettings");
const { logger } = require("../../src/managers/logger");
const cacheManager = require("../../src/managers/cacheManager");
const { buildErrorContainerV2 } = require("../../src/utils/NauraContainerBuilder");

// Import handlers modular
const handlers = {
  dashboard: require("./setup/dashboard"),
  softban: require("./setup/softban"),
  greetings: require("./setup/greetings"),
  automod: require("./setup/automod"),
  modmail: require("./setup/modmail"),
  ticket: require("./setup/ticket"),
  tempvoice: require("./setup/tempvoice"),
  autorole: require("./setup/autorole"),
  ai: require("./setup/ai"),
  "ai-automod": require("./setup/ai"),
  "ai-config": require("./setup/ai"),
  "ai-kb": require("./setup/ai"),
  vanity: require("./setup/vanity"),
  minecraft: require("./setup/minecraft"),
  faq: require("./setup/faq"),
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("setup")
    .setDescription("⚙️ [ADMIN] Master Setup Dashboard Governance Naura Hoshino.")
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
    .addSubcommand((sub) =>
      sub
        .setName("dashboard")
        .setDescription("🖥️ Buka Master Dashboard Setup Interaktif"),
    )
    .addSubcommand((sub) =>
      sub
        .setName("softban")
        .setDescription("🛡️ Atur Channel Softban / Perangkap Scammer (Honeypot Trap)")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Pilih channel yang dijadikan perangkap scammer").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("greetings")
        .setDescription("👋 Atur channel & status pesan Welcome/Leave")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel Selamat Datang").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addBooleanOption((opt) =>
          opt.setName("aktif").setDescription("Aktifkan pesan selamat datang?").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("automod")
        .setDescription("🛡️ Atur modul Automod & Log Audit Security")
        .addBooleanOption((opt) =>
          opt.setName("aktif").setDescription("Aktifkan sistem Anti-Spam & Automod?").setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName("log").setDescription("Channel log audit keamanan").addChannelTypes(ChannelType.GuildText).setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("modmail")
        .setDescription("📩 Atur kategori & role staff Modmail")
        .addChannelOption((opt) =>
          opt.setName("kategori").setDescription("Kategori untuk tiket Modmail").addChannelTypes(ChannelType.GuildCategory).setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role Staff Modmail").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ticket")
        .setDescription("🎫 Atur kategori & log Sistem Tiket")
        .addStringOption((opt) =>
          opt.setName("mode").setDescription("Gunakan Private Thread atau Text Channel?")
            .addChoices({ name: "Private Thread", value: "thread" }, { name: "Text Channel", value: "channel" }).setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName("kategori").setDescription("Kategori channel tiket (wajib jika mode channel)").addChannelTypes(ChannelType.GuildCategory).setRequired(false),
        )
        .addChannelOption((opt) =>
          opt.setName("log").setDescription("Channel log penutupan tiket").addChannelTypes(ChannelType.GuildText).setRequired(false),
        )
        .addChannelOption((opt) =>
          opt.setName("panel").setDescription("Channel tempat mengirim pesan Panel Buka Tiket").addChannelTypes(ChannelType.GuildText).setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("tempvoice")
        .setDescription("🔊 Atur generator Voice Channel dinamis")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Voice Channel generator").addChannelTypes(ChannelType.GuildVoice).setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName("kategori").setDescription("Kategori tempat room dibuat").addChannelTypes(ChannelType.GuildCategory).setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("autorole")
        .setDescription("🎭 Atur role otomatis saat member baru bergabung")
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role member baru").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai")
        .setDescription("🧠 Atur channel untuk percakapan AI otomatis")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel teks untuk chat AI").addChannelTypes(ChannelType.GuildText).setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-kb")
        .setDescription("📚 Atur Knowledge Base / Dokumen Peraturan Server untuk AI")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Pilih tindakan")
            .addChoices(
              { name: "Tambah Dokumen", value: "tambah" },
              { name: "Lihat Daftar", value: "list" },
              { name: "Reset Knowledge Base", value: "reset" },
            )
            .setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("judul").setDescription("Judul dokumen / topik").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("konten").setDescription("Teks lengkap dokumen / peraturan / FAQ").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("vanity")
        .setDescription("✍️ Atur role reward untuk Custom Status member")
        .addStringOption((opt) =>
          opt.setName("teks").setDescription("Teks status yang dicari (mis. .gg/nama-server)").setRequired(true),
        )
        .addRoleOption((opt) =>
          opt.setName("role").setDescription("Role reward vanity").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("minecraft")
        .setDescription("🎮 Atur Jembatan Chat & Status Server Minecraft")
        .addChannelOption((opt) =>
          opt.setName("channel").setDescription("Channel jembatan chat Discord-Minecraft").addChannelTypes(ChannelType.GuildText).setRequired(true),
        )
        .addStringOption((opt) =>
          opt.setName("ip").setDescription("Alamat IP RCON").setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt.setName("port").setDescription("Port RCON (Default 25575)").setRequired(false),
        )
        .addStringOption((opt) =>
          opt.setName("password").setDescription("Password RCON").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-automod")
        .setDescription("🤖 Atur AI Auto-mod berbasis Gemini (Report Pesan)")
        .addBooleanOption((opt) =>
          opt.setName("aktif").setDescription("Aktifkan fitur AI Report?").setRequired(true),
        )
        .addChannelOption((opt) =>
          opt.setName("audit-channel").setDescription("Channel log laporan AI Automod").addChannelTypes(ChannelType.GuildText).setRequired(false),
        )
        .addIntegerOption((opt) =>
          opt.setName("threshold").setDescription("Skor minimum pelanggaran untuk aksi otomatis (0-100, default 70)").setMinValue(0).setMaxValue(100).setRequired(false),
        )
        .addBooleanOption((opt) =>
          opt.setName("learning-mode").setDescription("Mode belajar: log saja, tidak ada aksi otomatis").setRequired(false),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("ai-config")
        .setDescription("🤖 Atur Persona & Custom System Prompt Gemini AI Server")
        .addStringOption((opt) =>
          opt.setName("persona").setDescription("Tulis instruksi persona/sifat khusus AI untuk server ini").setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName("faq")
        .setDescription("📚 Kelola data FAQ / Knowledge Base server untuk AI Naura")
        .addStringOption((opt) =>
          opt
            .setName("aksi")
            .setDescription("Pilih aksi")
            .setRequired(true)
            .addChoices(
              { name: "Tambah FAQ", value: "add" },
              { name: "Hapus FAQ", value: "hapus" },
              { name: "Lihat Daftar", value: "list" },
              { name: "Reset Semua", value: "clear" },
            ),
        )
        .addStringOption((opt) =>
          opt
            .setName("pertanyaan")
            .setDescription("Pertanyaan atau topik FAQ (untuk aksi add)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("jawaban")
            .setDescription("Jawaban atau panduan lengkap (untuk aksi add)")
            .setRequired(false),
        )
        .addStringOption((opt) =>
          opt
            .setName("id")
            .setDescription("ID FAQ yang ingin dihapus (untuk aksi hapus)")
            .setRequired(false),
        ),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand() || "dashboard";

    const [settingsRecord] = await GuildSettings.findOrCreate({
      where: { guildId: interaction.guild.id },
    });

    let currentSettings;
    try {
      currentSettings = typeof settingsRecord.settings === "string"
        ? JSON.parse(settingsRecord.settings)
        : settingsRecord.settings || {};
    } catch (e) {
      currentSettings = {};
    }

    const saveSettings = async (newSettings) => {
      settingsRecord.settings = newSettings;
      settingsRecord.changed("settings", true);
      await settingsRecord.save();
      // ✅ Rule 1.9: Invalidate cache setelah settings berubah
      await cacheManager.invalidateGuildSettings(interaction.guild.id).catch(() => {});
    };

    const handler = handlers[subcommand];
    if (!handler) {
      return interaction.reply({
        ...buildErrorContainerV2({
          title: "Subcommand Tidak Ditemukan",
          description: `Tidak ada handler untuk \`/setup ${subcommand}\`.`,
        }),
        ephemeral: true,
      });
    }

    try {
      await handler(interaction, { currentSettings, saveSettings }, subcommand);
    } catch (error) {
      logger.error(`[Setup] Gagal mengeksekusi subcommand ${subcommand}:`, error);
      
      const errMsg = {
        ...buildErrorContainerV2({
          title: "Setup Gagal",
          description: "Terjadi kesalahan saat memproses permintaanmu.",
        }),
        ephemeral: true,
      };

      if (interaction.deferred || interaction.replied) {
        await interaction.editReply(errMsg).catch(() => {});
      } else {
        await interaction.reply(errMsg).catch(() => {});
      }
    }
  },
};
