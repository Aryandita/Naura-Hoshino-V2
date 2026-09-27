const {
  SlashCommandBuilder,
  ChannelType,
  MessageFlags,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");

const VERIFICATION_LEVELS = {
  0: "Bebas (None)",
  1: "Rendah (Low: Email Terverifikasi)",
  2: "Sedang (Medium: Akun > 5 Menit)",
  3: "Tinggi (High: Member Server > 10 Menit)",
  4: "Sangat Tinggi (Highest: Verifikasi Nomor HP)",
};

const TIER_NAMES = {
  0: "Level 0 (Tanpa Boost)",
  1: "Level 1",
  2: "Level 2",
  3: "Level 3",
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName("serverinfo")
    .setDescription("Tampilkan informasi mendalam dan statistik server Discord ini"),

  async execute(interaction) {
    const guild = interaction.guild;
    if (!guild) {
      return interaction.reply({
        content: "Perintah ini hanya dapat dijalankan di dalam server Discord.",
        flags: MessageFlags.Ephemeral,
      });
    }

    const createdUnix = Math.floor(guild.createdTimestamp / 1000);
    const owner = await guild.fetchOwner().catch(() => null);
    const ownerTag = owner ? `${owner.user.tag} (<@${owner.id}>)` : `<@${guild.ownerId}>`;

    const channels = guild.channels.cache;
    const textChannels = channels.filter(
      (c) => c.type === ChannelType.GuildText || c.type === ChannelType.GuildAnnouncement,
    ).size;
    const voiceChannels = channels.filter(
      (c) => c.type === ChannelType.GuildVoice || c.type === ChannelType.GuildStageVoice,
    ).size;
    const categoryChannels = channels.filter(
      (c) => c.type === ChannelType.GuildCategory,
    ).size;

    const rolesCount = guild.roles.cache.size;
    const emojisCount = guild.emojis.cache.size;
    const stickersCount = guild.stickers.cache.size;

    const boostTier = TIER_NAMES[guild.premiumTier] || `Level ${guild.premiumTier}`;
    const boostCount = guild.premiumSubscriptionCount || 0;
    const verification = VERIFICATION_LEVELS[guild.verificationLevel] || "Tidak diketahui";

    const fields = [
      {
        name: "👑 Pemilik Server",
        value: ownerTag,
      },
      {
        name: "📅 Tanggal Pembuatan",
        value: `<t:${createdUnix}:F> (<t:${createdUnix}:R>)`,
      },
      {
        name: "👥 Populasi Anggota",
        value: `**${guild.memberCount.toLocaleString("id-ID")}** total anggota server`,
      },
      {
        name: "💬 Struktur Saluran (Channels)",
        value: `📝 Teks: **${textChannels}** | 🔊 Suara: **${voiceChannels}** | 📁 Kategori: **${categoryChannels}**`,
      },
      {
        name: "🚀 Status Nitro Boost",
        value: `Tier: **${boostTier}** (${boostCount} Boosts)`,
      },
      {
        name: "🛡️ Keamanan & Verifikasi",
        value: `Tingkat: **${verification}**`,
      },
      {
        name: "🎨 Aset Kustom",
        value: `🏷️ Peran: **${rolesCount}** | 😀 Emoji: **${emojisCount}** | 🏷️ Stiker: **${stickersCount}**`,
      },
    ];

    const icon = guild.iconURL({ dynamic: true, size: 256 });

    const payload = buildContainerV2({
      accentColorHex: ui.getColor("primary") || "#6366f1",
      title: `Informasi Server: ${guild.name}`,
      iconURL: icon || undefined,
      expression: "sparkle",
      description: guild.description
        ? `> *${guild.description}*\n\nBerikut ringkasan statistik dan konfigurasi server.`
        : "Berikut ringkasan statistik, keamanan, dan konfigurasi server.",
      fields,
      footerText: ui.getFooter("utility"),
    });

    return interaction.reply(payload);
  },
};
