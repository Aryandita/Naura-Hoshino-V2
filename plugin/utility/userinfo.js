const {
  SlashCommandBuilder,
  PermissionsBitField,
} = require("discord.js");
const ui = require("../../src/config/ui");
const { buildContainerV2 } = require("../../src/utils/NauraContainerBuilder");
const cacheManager = require("../../src/managers/cacheManager");

const KEY_PERMISSIONS = [
  { flag: PermissionsBitField.Flags.Administrator, name: "Administrator" },
  { flag: PermissionsBitField.Flags.ManageGuild, name: "Manage Server" },
  { flag: PermissionsBitField.Flags.BanMembers, name: "Ban Members" },
  { flag: PermissionsBitField.Flags.KickMembers, name: "Kick Members" },
  { flag: PermissionsBitField.Flags.ModerateMembers, name: "Moderate Members" },
  { flag: PermissionsBitField.Flags.ManageChannels, name: "Manage Channels" },
  { flag: PermissionsBitField.Flags.ManageMessages, name: "Manage Messages" },
  { flag: PermissionsBitField.Flags.MentionEveryone, name: "Mention Everyone" },
];

module.exports = {
  data: new SlashCommandBuilder()
    .setName("userinfo")
    .setDescription("Tampilkan kartu identitas Discord dan status keanggotaan pengguna")
    .addUserOption((opt) =>
      opt
        .setName("user")
        .setDescription("Pengguna yang ingin diperiksa profilnya")
        .setRequired(false),
    ),

  async execute(interaction) {
    const targetUser = interaction.options.getUser("user") || interaction.user;
    const guild = interaction.guild;
    const member = guild
      ? await guild.members.fetch(targetUser.id).catch(() => null)
      : null;

    const createdUnix = Math.floor(targetUser.createdTimestamp / 1000);
    const joinedUnix = member ? Math.floor(member.joinedTimestamp / 1000) : null;

    // Ambil data profil Naura Wilds jika ada
    const survival = await cacheManager
      .getUserSurvival(targetUser.id)
      .catch(() => null);

    const roles = member
      ? member.roles.cache
          .filter((r) => r.id !== guild.id)
          .sort((a, b) => b.position - a.position)
      : null;

    const roleMentions = roles && roles.size > 0
      ? roles.map((r) => `<@&${r.id}>`).slice(0, 10).join(" ") + (roles.size > 10 ? ` *(+${roles.size - 10} lainnya)*` : "")
      : "Tidak memiliki peran khusus";

    const keyPerms = member
      ? KEY_PERMISSIONS.filter((p) => member.permissions.has(p.flag)).map((p) => p.name)
      : [];

    const permText = keyPerms.length > 0
      ? keyPerms.join(", ")
      : "Izin Standar Anggota";

    const avatarUrl = targetUser.displayAvatarURL({ dynamic: true, size: 256 });

    const fields = [
      {
        name: "👤 Identitas Akun",
        value: `**Username:** \`${targetUser.username}\`\n**ID:** \`${targetUser.id}\`\n**Tipe:** ${targetUser.bot ? "🤖 Bot Discord" : "🧑 Anggota Manusia"}`,
        inline: true,
      },
      {
        name: "📅 Registrasi Akun",
        value: `<t:${createdUnix}:F>\n*(<t:${createdUnix}:R>)*`,
        inline: true,
      },
    ];

    if (member) {
      fields.push({
        name: "📥 Bergabung ke Server",
        value: joinedUnix
          ? `<t:${joinedUnix}:F>\n*(<t:${joinedUnix}:R>)*`
          : "Tidak diketahui",
        inline: true,
      });

      fields.push({
        name: "🏷️ Peran di Server",
        value: roleMentions,
        inline: false,
      });

      fields.push({
        name: "🛡️ Otoritas & Izin Kunci",
        value: permText,
        inline: false,
      });
    }

    if (survival) {
      fields.push({
        name: "🌲 Ekosistem Naura Wilds",
        value: `⭐ **Level:** ${survival.level || 1} | 💰 **NSF:** ${(survival.starFragments || 0).toLocaleString("id-ID")} | ❤️ **HP:** ${survival.hp || 100}/100`,
        inline: false,
      });
    }

    const payload = buildContainerV2({
      accentColorHex: member?.displayHexColor !== "#000000"
        ? member?.displayHexColor
        : (ui.getColor("primary") || "#6366f1"),
      title: `Profil Pengguna: ${targetUser.username}`,
      iconURL: avatarUrl,
      expression: "happy",
      description: `Berikut adalah ringkasan kartu profil dan catatan keanggotaan untuk <@${targetUser.id}>.`,
      fields,
      footerText: ui.getFooter("utility"),
    });

    return interaction.reply(payload);
  },
};
